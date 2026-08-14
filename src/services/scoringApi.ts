import pb from '@/lib/pocketbase/client'
import { Brand, Store, SKU, Promoter, RuptureReport, SkuClassification, StoreScore } from '@/types'
import { computeBookScores, computePromoterScores, bookAverageScore } from '@/lib/scoring'

// ---- RUPTURE REPORTS (extended) ----
export async function updateRuptureReport(
  id: string,
  data: FormData | Partial<RuptureReport>,
): Promise<RuptureReport> {
  return await pb.collection('rupture_reports').update<RuptureReport>(id, data)
}

export interface RuptureImportRow {
  storeRef: string
  skuRef: string
  motive: string
  date: string
  observation: string
}

export interface RuptureImportResult {
  created: number
  ignored: number
  errors: Array<{ row: number; reason: string }>
}

/**
 * Batch import rupture reports. Validates store (by number or name) and SKU
 * (by code). Returns a summary of created/ignored rows.
 */
export async function batchImportRuptures(
  brandId: string,
  rows: RuptureImportRow[],
  stores: Store[],
  skus: SKU[],
): Promise<RuptureImportResult> {
  const errors: Array<{ row: number; reason: string }> = []
  let created = 0
  let ignored = 0

  // Build lookup maps
  const storeByNumber = new Map<string, Store>()
  const storeByNameLower = new Map<string, Store>()
  for (const s of stores) {
    storeByNumber.set(s.number.trim(), s)
    storeByNameLower.set(s.name.trim().toLowerCase(), s)
  }
  const skuByCode = new Map<string, SKU>()
  const skuByCodeLower = new Map<string, SKU>()
  for (const s of skus) {
    skuByCode.set(s.code.trim(), s)
    skuByCodeLower.set(s.code.trim().toLowerCase(), s)
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // header is row 1

    // Validate store
    const ref = (row.storeRef || '').trim()
    if (!ref) {
      errors.push({ row: rowNum, reason: 'Loja não informada' })
      ignored++
      continue
    }
    const store = storeByNumber.get(ref) || storeByNameLower.get(ref.toLowerCase())
    if (!store) {
      errors.push({ row: rowNum, reason: `Loja não encontrada: "${ref}"` })
      ignored++
      continue
    }

    // Validate SKU
    const skuRef = (row.skuRef || '').trim()
    if (!skuRef) {
      errors.push({ row: rowNum, reason: 'SKU não informado' })
      ignored++
      continue
    }
    const sku = skuByCode.get(skuRef) || skuByCodeLower.get(skuRef.toLowerCase())
    if (!sku) {
      errors.push({ row: rowNum, reason: `SKU não encontrado: "${skuRef}"` })
      ignored++
      continue
    }

    // Validate date
    if (!row.date || isNaN(new Date(row.date).getTime())) {
      errors.push({ row: rowNum, reason: 'Data inválida' })
      ignored++
      continue
    }

    // Map motive to rupture_type
    const motiveLower = (row.motive || '').toLowerCase()
    let ruptureType: 'total' | 'parcial' | 'zerado' = 'total'
    if (motiveLower.includes('zerad') || motiveLower.includes('estoque zerado')) {
      ruptureType = 'zerado'
    } else if (motiveLower.includes('parcial')) {
      ruptureType = 'parcial'
    } else if (motiveLower.includes('total') || motiveLower.includes('ruptura')) {
      ruptureType = 'total'
    }

    // Parse days in rupture from observation if present (e.g. "há 18 dias")
    let daysInRupture: number | undefined
    const daysMatch = (row.observation || '').match(/(\d+)\s*dias/i)
    if (daysMatch) daysInRupture = parseInt(daysMatch[1], 10)

    try {
      await pb.collection('rupture_reports').create({
        brand: brandId,
        store: store.id,
        sku: sku.id,
        report_date: row.date,
        rupture_type: ruptureType,
        days_in_rupture: daysInRupture ?? 0,
      })
      created++
    } catch (err: any) {
      errors.push({ row: rowNum, reason: err?.message || 'Erro ao salvar' })
      ignored++
    }
  }

  return { created, ignored, errors }
}

// ---- SCORING ----
export async function getBookStoreScores(bookId: string): Promise<{
  scores: StoreScore[]
  average: number
  classifications: SkuClassification[]
}> {
  const classifications = await pb
    .collection('sku_classifications')
    .getFullList<SkuClassification>({
      filter: `book = "${bookId}"`,
      sort: 'store,sku',
      expand: 'store,sku,matched_photo,reviewer',
    })
  const stores = classifications
    .map((c) => c.expand?.store)
    .filter((s, i, arr): s is Store => !!s && arr.findIndex((x) => x?.id === s!.id) === i)
  const scores = computeBookScores(classifications, stores)
  const average = bookAverageScore(scores)
  return { scores, average, classifications }
}

export async function getPromoterRanking(
  brandFilter?: string,
): Promise<ReturnType<typeof computePromoterScores>> {
  const promoters = await pb.collection('promoters').getFullList<Promoter>({
    sort: 'name',
    expand: 'brands,stores',
  })
  const brands = await pb.collection('brands').getFullList<Brand>({
    sort: 'name',
  })

  // Gather all classifications for the relevant books.
  // For simplicity, fetch all completed books (optionally filtered by brand)
  // and aggregate store scores.
  const bookFilter = brandFilter ? `brand = "${brandFilter}"` : ''
  const books = await pb.collection('books').getFullList({
    filter: bookFilter || 'id != ""',
    sort: '-created',
  })

  const storeScoresByStore = new Map<string, StoreScore>()
  for (const book of books) {
    if (book.analysis_status !== 'completed') continue
    try {
      const { scores } = await getBookStoreScores(book.id)
      // Keep the most recent score per store (books are sorted desc by created)
      for (const s of scores) {
        if (!storeScoresByStore.has(s.storeId)) {
          storeScoresByStore.set(s.storeId, s)
        }
      }
    } catch {
      // ignore books with no classifications
    }
  }

  return computePromoterScores(promoters, storeScoresByStore, brands)
}
