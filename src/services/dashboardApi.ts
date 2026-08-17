// Aggregation service for the Gerencial Dashboard.
// Pulls real data from PocketBase (books, sku_classifications, rupture_reports)
// and computes the indicators using the shared scoring engine.

import pb from '@/lib/pocketbase/client'
import { Book, Brand, SkuClassification, Store, Promoter, BookStatus } from '@/types'
import { computeBookScores, bookAverageScore } from '@/lib/scoring'
import { getPromoterRanking } from '@/services/scoringApi'

export interface DashboardMetrics {
  averageScore: number
  totalBooks: number
  booksByStatus: Record<BookStatus, number>
  activeRuptures: number
  unauditedStores: number
  totalSkuAnalyzed: number
  completedBooks: number
}

export interface EvolutionPoint {
  period: string // YYYY-MM
  periodLabel: string // "ago/26"
  byBrand: Record<string, { brandId: string; brandName: string; avg: number }>
}

export interface BrandEvolutionSeries {
  brandId: string
  brandName: string
  color: string
  data: { period: string; value: number | null }[]
}

const BRAND_COLORS = [
  '#4f46e5', // indigo-600
  '#d97706', // amber-600
  '#059669', // emerald-600
  '#dc2626', // red-600
  '#7c3aed', // violet-600
  '#0891b2', // cyan-600
  '#db2777', // pink-600
  '#65a30d', // lime-600
]

async function fetchAllClassifications(): Promise<SkuClassification[]> {
  const all: SkuClassification[] = []
  let page = 1
  // getPageList style; PocketBase max perPage is 500
  while (true) {
    const res = await pb.collection('sku_classifications').getList<SkuClassification>(page, 500, {
      expand: 'store,sku',
      sort: 'book,store,sku',
    })
    all.push(...res.items)
    if (res.items.length < 500) break
    page++
    if (page > 50) break // safety
  }
  return all
}

export async function loadDashboardData(): Promise<{
  metrics: DashboardMetrics
  evolution: BrandEvolutionSeries[]
  periods: { period: string; label: string }[]
  topBrands: { brandId: string; brandName: string; avg: number }[]
  brands: Brand[]
}> {
  const [books, brands, promoters, ruptures, classifications] = await Promise.all([
    pb.collection('books').getFullList<Book>({ sort: '-created', expand: 'brand,analyst' }),
    pb.collection('brands').getFullList<Brand>({ sort: 'name' }),
    pb.collection('promoters').getFullList<Promoter>({ sort: 'name', expand: 'brands,stores' }),
    pb.collection('rupture_reports').getFullList({ sort: '-report_date' }),
    fetchAllClassifications(),
  ])

  // Status breakdown
  const booksByStatus: Record<BookStatus, number> = {
    processing: 0,
    pending_review: 0,
    reviewed: 0,
    completed: 0,
  }
  for (const b of books) booksByStatus[b.status]++

  // Classifications grouped by book
  const classByBook = new Map<string, SkuClassification[]>()
  for (const c of classifications) {
    if (!classByBook.has(c.book)) classByBook.set(c.book, [])
    classByBook.get(c.book)!.push(c)
  }

  // Completed books with brand info — used for scoring + evolution
  const completed = books.filter((b) => b.status === 'completed')

  // Build brand name lookup
  const brandName = new Map<string, string>()
  for (const b of brands) brandName.set(b.id, b.name)
  for (const b of books) {
    if (b.expand?.brand) brandName.set(b.brand, b.expand.brand.name)
  }

  // Per-book average score (for completed books)
  const bookAvg = new Map<string, number>()
  const bookMonth = new Map<string, string>() // book -> YYYY-MM
  const bookBrand = new Map<string, string>()
  let scoreSum = 0
  let scoreCount = 0
  for (const b of completed) {
    const cs = classByBook.get(b.id) || []
    if (cs.length === 0) continue
    const stores: Store[] = []
    const seen = new Set<string>()
    for (const c of cs) {
      const s = c.expand?.store
      if (s && !seen.has(s.id)) {
        seen.add(s.id)
        stores.push(s)
      }
    }
    const scores = computeBookScores(cs, stores)
    const avg = bookAverageScore(scores)
    bookAvg.set(b.id, avg)
    scoreSum += avg
    scoreCount++
    const d = new Date(b.audit_date || b.created)
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    bookMonth.set(b.id, month)
    bookBrand.set(b.id, b.brand)
  }

  const averageScore = scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 10) / 10 : 0

  // Active ruptures (< 15 days in rupture)
  const activeRuptures = ruptures.filter(
    (r: any) => (r.days_in_rupture ?? 0) > 0 && (r.days_in_rupture ?? 0) < 15,
  ).length

  // Unaudited stores: count of sem_foto_loja classifications
  const unauditedStores = classifications.filter((c) => c.category === 'sem_foto_loja').length

  // Top brands by average score (for evolution series selection)
  const brandAgg = new Map<string, { sum: number; count: number }>()
  for (const b of completed) {
    const avg = bookAvg.get(b.id)
    if (avg === undefined) continue
    const bid = b.brand
    if (!brandAgg.has(bid)) brandAgg.set(bid, { sum: 0, count: 0 })
    const a = brandAgg.get(bid)!
    a.sum += avg
    a.count++
  }
  const topBrands = Array.from(brandAgg.entries())
    .map(([brandId, a]) => ({
      brandId,
      brandName: brandName.get(brandId) || '—',
      avg: a.count > 0 ? Math.round((a.sum / a.count) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5)

  // Evolution: average score per month per brand
  const allMonths = new Set<string>()
  for (const b of completed) {
    const m = bookMonth.get(b.id)
    if (m) allMonths.add(m)
  }
  const periods = Array.from(allMonths).sort()
  const periodLabels = periods.map((p) => {
    const [y, m] = p.split('-')
    const months = [
      'jan',
      'fev',
      'mar',
      'abr',
      'mai',
      'jun',
      'jul',
      'ago',
      'set',
      'out',
      'nov',
      'dez',
    ]
    return { period: p, label: `${months[parseInt(m, 10) - 1]}/${y.slice(2)}` }
  })

  // Build per-brand series for the top brands (and ensure at least all brands with data)
  const seriesBrands =
    topBrands.length > 0
      ? topBrands
      : Array.from(brandAgg.entries()).map(([brandId]) => ({
          brandId,
          brandName: brandName.get(brandId) || '—',
          avg: 0,
        }))
  const evolution: BrandEvolutionSeries[] = seriesBrands.map((tb, i) => {
    const color = BRAND_COLORS[i % BRAND_COLORS.length]
    const data = periods.map((p) => {
      const booksInMonth = completed.filter(
        (b) => bookMonth.get(b.id) === p && b.brand === tb.brandId,
      )
      const avgs = booksInMonth
        .map((b) => bookAvg.get(b.id))
        .filter((v): v is number => v !== undefined)
      const value =
        avgs.length > 0
          ? Math.round((avgs.reduce((s, v) => s + v, 0) / avgs.length) * 10) / 10
          : null
      return { period: p, value }
    })
    return { brandId: tb.brandId, brandName: tb.brandName, color, data }
  })

  const metrics: DashboardMetrics = {
    averageScore,
    totalBooks: books.length,
    booksByStatus,
    activeRuptures,
    unauditedStores,
    totalSkuAnalyzed: classifications.length,
    completedBooks: completed.length,
  }

  // suppress unused warning
  void promoters

  return { metrics, evolution, periods: periodLabels, topBrands, brands }
}

export interface TopPromoter {
  promoterId: string
  name: string
  avgScore: number
  storeCount: number
  brandNames: string[]
}

export async function loadTopPromoters(limit = 5): Promise<TopPromoter[]> {
  const ranking = await getPromoterRanking(undefined)
  return ranking.slice(0, limit).map((p) => ({
    promoterId: p.promoterId,
    name: p.promoter?.name || '—',
    avgScore: p.avgScore,
    storeCount: p.storeCount,
    brandNames: p.brandNames,
  }))
}
