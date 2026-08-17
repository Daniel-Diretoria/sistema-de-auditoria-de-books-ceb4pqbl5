import React, { useEffect, useMemo, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import {
  getBooks,
  getBrands,
  getBrandById,
  getBookById,
  getSKUs,
  getSkuClassifications,
  formatDate,
} from '@/services/api'
import { computeBookScores, bookAverageScore } from '@/lib/scoring'
import { Book, Brand, Store, SKU, SkuClassification, scoreColor, SCORE_BADGE } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Loader2,
  Scale,
  TrendingUp,
  TrendingDown,
  Minus,
  Store as StoreIcon,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface BookAnalysis {
  book: Book
  classifications: SkuClassification[]
  storeScores: {
    storeId: string
    store?: Store
    score: number
    present: number
    absent: number
    justified: number
  }[]
  average: number
  byStore: Map<string, SkuClassification[]>
  byStoreSku: Map<string, SkuClassification>
}

export const Comparacao: React.FC = () => {
  const { toast } = useToast()
  const navigate = useNavigate()

  const [brands, setBrands] = useState<Brand[]>([])
  const [brandId, setBrandId] = useState('')
  const [books, setBooks] = useState<Book[]>([])
  const [bookAId, setBookAId] = useState('')
  const [bookBId, setBookBId] = useState('')
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)
  const [analysisA, setAnalysisA] = useState<BookAnalysis | null>(null)
  const [analysisB, setAnalysisB] = useState<BookAnalysis | null>(null)

  // Load brands
  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        const allBrands = await getBrands()
        setBrands(allBrands)
      } catch (err: any) {
        toast({
          title: 'Erro ao carregar marcas',
          description: err.message,
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Load books for selected brand
  useEffect(() => {
    if (!brandId) {
      setBooks([])
      return
    }
    setBookAId('')
    setBookBId('')
    setAnalysisA(null)
    setAnalysisB(null)
    getBooks(`brand = "${brandId}"`)
      .then(setBooks)
      .catch((err) =>
        toast({
          title: 'Erro ao carregar books',
          description: err.message,
          variant: 'destructive',
        }),
      )
  }, [brandId])

  const loadAnalysis = async (bookId: string): Promise<BookAnalysis | null> => {
    let book: Book
    try {
      book = await getBookById(bookId)
    } catch {
      return null
    }
    const brand = await getBrandById(book.brand)
    const stores: Store[] = brand.expand?.stores || []
    const skus = await getSKUs(`brand = "${book.brand}"`)
    const skuMap = new Map<string, SKU>()
    for (const s of skus) skuMap.set(s.id, s)
    const classifications = await getSkuClassifications(bookId)
    const clWithExpand = classifications.map((c) => ({
      ...c,
      expand: { ...c.expand, sku: skuMap.get(c.sku), store: stores.find((s) => s.id === c.store) },
    }))
    const scores = computeBookScores(clWithExpand, stores)
    const average = bookAverageScore(scores)
    const byStore = new Map<string, SkuClassification[]>()
    for (const c of clWithExpand) {
      if (!byStore.has(c.store)) byStore.set(c.store, [])
      byStore.get(c.store)!.push(c)
    }
    const byStoreSku = new Map<string, SkuClassification>()
    for (const c of clWithExpand) byStoreSku.set(`${c.store}|${c.sku}`, c)
    const storeScores = scores.map((s) => ({
      storeId: s.storeId,
      store: s.store,
      score: s.score,
      present: s.present,
      absent: s.absent,
      justified: s.justifiedRupture,
    }))
    return { book, classifications: clWithExpand, storeScores, average, byStore, byStoreSku }
  }

  // Compare when both selected
  useEffect(() => {
    if (!bookAId || !bookBId || bookAId === bookBId) {
      setAnalysisA(null)
      setAnalysisB(null)
      return
    }
    let active = true
    setComparing(true)
    Promise.all([loadAnalysis(bookAId), loadAnalysis(bookBId)])
      .then(([a, b]) => {
        if (!active) return
        setAnalysisA(a)
        setAnalysisB(b)
      })
      .catch((err) =>
        toast({
          title: 'Erro ao comparar books',
          description: err.message,
          variant: 'destructive',
        }),
      )
      .finally(() => {
        if (active) setComparing(false)
      })
    return () => {
      active = false
    }
  }, [bookAId, bookBId])

  // Comparison by store (common stores)
  const storeComparison = useMemo(() => {
    if (!analysisA || !analysisB) return []
    const aScores = new Map(analysisA.storeScores.map((s) => [s.storeId, s]))
    const bScores = new Map(analysisB.storeScores.map((s) => [s.storeId, s]))
    const common = Array.from(aScores.keys()).filter((sid) => bScores.has(sid))
    return common
      .map((sid) => {
        const a = aScores.get(sid)!
        const b = bScores.get(sid)!
        const delta = Math.round((b.score - a.score) * 10) / 10
        return {
          storeId: sid,
          store: a.store || b.store,
          scoreA: a.score,
          scoreB: b.score,
          delta,
          presentA: a.present,
          presentB: b.present,
          absentA: a.absent,
          absentB: b.absent,
          justifiedA: a.justified,
          justifiedB: b.justified,
        }
      })
      .sort((a, b) => (a.store?.number || '').localeCompare(b.store?.number || ''))
  }, [analysisA, analysisB])

  // Insights
  const insights = useMemo(() => {
    if (!analysisA || !analysisB) {
      return { improved: [], worsened: [], newRuptures: [], resolvedRuptures: [] as string[] }
    }
    const improved: string[] = []
    const worsened: string[] = []
    for (const sc of storeComparison) {
      const name = sc.store ? `${sc.store.number} — ${sc.store.name}` : sc.storeId
      if (sc.delta > 0) improved.push(`${name} (+${sc.delta.toFixed(1)})`)
      else if (sc.delta < 0) worsened.push(`${name} (${sc.delta.toFixed(1)})`)
    }
    // New ruptures: present in A, absent in B
    const newRuptures: string[] = []
    const resolvedRuptures: string[] = []
    const aMap = analysisA.byStoreSku
    const bMap = analysisB.byStoreSku
    const keys = new Set<string>([...aMap.keys(), ...bMap.keys()])
    for (const key of keys) {
      const ca = aMap.get(key)
      const cb = bMap.get(key)
      const skuName = (cb?.expand?.sku || ca?.expand?.sku)?.name || key
      if (
        ca?.category === 'presente_pdv' &&
        cb &&
        (cb.category === 'ausente_cobrar' || cb.category === 'validar_ruptura_antiga')
      ) {
        newRuptures.push(skuName)
      }
      if (
        ca &&
        (ca.category === 'ausente_cobrar' || ca.category === 'validar_ruptura_antiga') &&
        cb?.category === 'presente_pdv'
      ) {
        resolvedRuptures.push(skuName)
      }
    }
    return { improved, worsened, newRuptures, resolvedRuptures }
  }, [analysisA, analysisB, storeComparison])

  const deltaAvg =
    analysisA && analysisB ? Math.round((analysisB.average - analysisA.average) * 10) / 10 : 0

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-2" />
        <p className="text-sm text-slate-500">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="text-slate-500"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Scale className="h-6 w-6 text-indigo-600" />
              Comparação entre Períodos
            </h1>
            <p className="text-sm text-slate-500">
              Compare dois books da mesma marca e identifique variações.
            </p>
          </div>
        </div>
      </div>

      {/* Brand + book selectors */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Marca
            </label>
            <Select value={brandId} onValueChange={setBrandId}>
              <SelectTrigger className="w-full sm:w-80 bg-white mt-1">
                <SelectValue placeholder="Selecione uma marca" />
              </SelectTrigger>
              <SelectContent>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {brandId && (
            <>
              {books.length < 2 ? (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg p-4 flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <span>
                    Esta marca precisa de pelo menos 2 books para comparação. Atualmente possui{' '}
                    {books.length}.
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Book A
                    </label>
                    <Select value={bookAId} onValueChange={setBookAId}>
                      <SelectTrigger className="w-full bg-white mt-1">
                        <SelectValue placeholder="Selecione o book A" />
                      </SelectTrigger>
                      <SelectContent>
                        {books
                          .filter((b) => b.id !== bookBId)
                          .map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.title} ({formatDate(b.audit_date)})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Book B
                    </label>
                    <Select value={bookBId} onValueChange={setBookBId}>
                      <SelectTrigger className="w-full bg-white mt-1">
                        <SelectValue placeholder="Selecione o book B" />
                      </SelectTrigger>
                      <SelectContent>
                        {books
                          .filter((b) => b.id !== bookAId)
                          .map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.title} ({formatDate(b.audit_date)})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {comparing && (
        <div className="text-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600 mb-2" />
          <p className="text-sm text-slate-500">Comparando books...</p>
        </div>
      )}

      {/* Comparison results */}
      {!comparing && analysisA && analysisB && (
        <>
          {/* Side-by-side summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
            {/* Book A */}
            <BookSummaryCard
              title="Book A"
              book={analysisA.book}
              average={analysisA.average}
              storeCount={analysisA.storeScores.length}
            />
            {/* Delta */}
            <Card className="border-2 border-indigo-200 bg-indigo-50/40">
              <CardContent className="p-5 flex flex-col items-center justify-center text-center">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Variação da Nota Média
                </p>
                <div className="flex items-center gap-2 mt-3">
                  {deltaAvg > 0 ? (
                    <TrendingUp className="h-7 w-7 text-emerald-600" />
                  ) : deltaAvg < 0 ? (
                    <TrendingDown className="h-7 w-7 text-red-600" />
                  ) : (
                    <Minus className="h-7 w-7 text-slate-400" />
                  )}
                  <span
                    className={cn(
                      'text-3xl font-bold',
                      deltaAvg > 0
                        ? 'text-emerald-600'
                        : deltaAvg < 0
                          ? 'text-red-600'
                          : 'text-slate-500',
                    )}
                  >
                    {deltaAvg > 0 ? '+' : ''}
                    {deltaAvg.toFixed(1)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {deltaAvg > 0
                    ? 'Melhoria em relação ao Book A'
                    : deltaAvg < 0
                      ? 'Piora em relação ao Book A'
                      : 'Sem variação'}
                </p>
              </CardContent>
            </Card>
            {/* Book B */}
            <BookSummaryCard
              title="Book B"
              book={analysisB.book}
              average={analysisB.average}
              storeCount={analysisB.storeScores.length}
            />
          </div>

          {/* Store comparison table */}
          <Card className="overflow-hidden p-0">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <StoreIcon className="h-5 w-5 text-indigo-600" />
                Comparação por Loja ({storeComparison.length} comuns)
              </h3>
            </div>
            {storeComparison.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                Nenhuma loja em comum entre os dois books.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="text-left font-semibold px-3 py-2">Loja</th>
                      <th className="text-center font-semibold px-2 py-2" colSpan={3}>
                        Nota
                      </th>
                      <th className="text-center font-semibold px-2 py-2" colSpan={2}>
                        Presentes
                      </th>
                      <th className="text-center font-semibold px-2 py-2" colSpan={2}>
                        Ausentes
                      </th>
                      <th className="text-center font-semibold px-2 py-2" colSpan={2}>
                        Rupturas
                      </th>
                    </tr>
                    <tr className="text-[10px] text-slate-400">
                      <th></th>
                      <th className="px-2 py-1">A</th>
                      <th className="px-2 py-1">B</th>
                      <th className="px-2 py-1">Δ</th>
                      <th className="px-2 py-1">A</th>
                      <th className="px-2 py-1">B</th>
                      <th className="px-2 py-1">A</th>
                      <th className="px-2 py-1">B</th>
                      <th className="px-2 py-1">A</th>
                      <th className="px-2 py-1">B</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {storeComparison.map((sc) => {
                      const colorA = scoreColor(sc.scoreA)
                      const colorB = scoreColor(sc.scoreB)
                      return (
                        <tr key={sc.storeId} className="hover:bg-slate-50/70">
                          <td className="px-3 py-2">
                            <p className="font-medium text-slate-800 truncate max-w-[200px]">
                              {sc.store ? `${sc.store.number} — ${sc.store.name}` : sc.storeId}
                            </p>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <Badge
                              variant="outline"
                              className={cn('text-[10px]', SCORE_BADGE[colorA])}
                            >
                              {sc.scoreA.toFixed(1)}
                            </Badge>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <Badge
                              variant="outline"
                              className={cn('text-[10px]', SCORE_BADGE[colorB])}
                            >
                              {sc.scoreB.toFixed(1)}
                            </Badge>
                          </td>
                          <td className="px-2 py-2 text-center">
                            <span
                              className={cn(
                                'font-bold text-[11px]',
                                sc.delta > 0
                                  ? 'text-emerald-600'
                                  : sc.delta < 0
                                    ? 'text-red-600'
                                    : 'text-slate-400',
                              )}
                            >
                              {sc.delta > 0 ? '+' : ''}
                              {sc.delta.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center text-slate-600">{sc.presentA}</td>
                          <td className="px-2 py-2 text-center text-slate-600">{sc.presentB}</td>
                          <td className="px-2 py-2 text-center text-slate-600">{sc.absentA}</td>
                          <td className="px-2 py-2 text-center text-slate-600">{sc.absentB}</td>
                          <td className="px-2 py-2 text-center text-slate-600">{sc.justifiedA}</td>
                          <td className="px-2 py-2 text-center text-slate-600">{sc.justifiedB}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Insight cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InsightCard
              title="O que melhorou"
              icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
              color="emerald"
              items={insights.improved}
              emptyText="Nenhuma melhoria identificada."
            />
            <InsightCard
              title="O que piorou"
              icon={<TrendingDown className="h-5 w-5 text-red-600" />}
              color="red"
              items={insights.worsened}
              emptyText="Nenhuma piora identificada."
            />
            <InsightCard
              title="Novas rupturas"
              icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
              color="amber"
              items={insights.newRuptures}
              emptyText="Nenhuma nova ruptura."
              subtitle="Presentes no A → ausentes no B"
            />
            <InsightCard
              title="Rupturas resolvidas"
              icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
              color="emerald"
              items={insights.resolvedRuptures}
              emptyText="Nenhuma ruptura resolvida."
              subtitle="Ausentes no A → presentes no B"
            />
          </div>
        </>
      )}

      {/* Empty hint when brand selected but books not */}
      {brandId && books.length >= 2 && !bookAId && !bookBId && !comparing && (
        <Card>
          <CardContent className="p-8 text-center text-slate-500">
            <Scale className="h-10 w-10 mx-auto mb-2 text-slate-300" />
            <p className="text-sm">Selecione os dois books acima para iniciar a comparação.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ---- Sub-components ----

const BookSummaryCard: React.FC<{
  title: string
  book: Book
  average: number
  storeCount: number
}> = ({ title, book, average, storeCount }) => {
  const color = scoreColor(average)
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <Badge
            variant="outline"
            className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200"
          >
            {title}
          </Badge>
          <span className="text-xs text-slate-400">{formatDate(book.audit_date)}</span>
        </div>
        <div>
          <p className="font-semibold text-slate-900 text-sm truncate">{book.title}</p>
          <p className="text-xs text-slate-500">{book.expand?.brand?.name || '—'}</p>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Nota média</p>
            <p className={cn('text-2xl font-bold', SCORE_BADGE[color])}>{average.toFixed(1)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Lojas</p>
            <p className="text-2xl font-bold text-slate-900">{storeCount}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const InsightCard: React.FC<{
  title: string
  icon: React.ReactNode
  color: 'emerald' | 'red' | 'amber'
  items: string[]
  emptyText: string
  subtitle?: string
}> = ({ title, icon, color, items, emptyText, subtitle }) => {
  const colorClasses = {
    emerald: 'border-emerald-200 bg-emerald-50/40',
    red: 'border-red-200 bg-red-50/40',
    amber: 'border-amber-200 bg-amber-50/40',
  }
  return (
    <Card className={cn('border', colorClasses[color])}>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <h4 className="font-semibold text-slate-900 text-sm">{title}</h4>
          <Badge variant="outline" className="ml-auto text-[10px]">
            {items.length}
          </Badge>
        </div>
        {subtitle && <p className="text-[10px] text-slate-500 mb-2">{subtitle}</p>}
        {items.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">{emptyText}</p>
        ) : (
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {items.slice(0, 30).map((it, i) => (
              <li key={i} className="text-xs text-slate-700 flex items-start gap-1.5">
                <span className="text-slate-400 mt-0.5">•</span>
                <span className="truncate">{it}</span>
              </li>
            ))}
            {items.length > 30 && (
              <li className="text-[10px] text-slate-400">+{items.length - 30} outros</li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
