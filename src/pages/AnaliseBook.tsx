import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  getBookById,
  getBrandById,
  getSKUs,
  getSkuClassifications,
  updateSkuClassification,
  getFileUrl,
  formatDate,
} from '@/services/api'
import { runBookAnalysis, AnalysisProgress, priceMatchesExpected } from '@/lib/skuAnalysis'
import {
  Book,
  Brand,
  Store,
  SKU,
  SkuClassification,
  BookPhoto,
  SkuCategory,
  ConfidenceLevel,
  AnalysisStatus,
  SKU_CATEGORY_LABELS,
  SKU_CATEGORY_SHORT,
  SKU_CATEGORY_BADGE,
  CONFIDENCE_LABELS,
  CONFIDENCE_BADGE,
  ANALYSIS_STATUS_LABELS,
  ANALYSIS_STATUS_BADGE,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  ArrowLeft,
  Loader2,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Store as StoreIcon,
  Package,
  Search,
  ScanSearch,
  ImageOff,
  RefreshCw,
  Tag,
  CameraOff,
  Droplets,
} from 'lucide-react'

const CATEGORIES: SkuCategory[] = [
  'presente_pdv',
  'nao_identificado',
  'evidencia_insuficiente',
  'sem_foto_secao',
  'sem_foto_loja',
  'nao_verificado',
  'falha_tecnica',
  'ruptura_justificada',
  'validar_ruptura_antiga',
  'ausente_cobrar',
]

const CATEGORY_ICONS: Record<SkuCategory, React.ReactNode> = {
  presente_pdv: <CheckCircle2 className="h-5 w-5" />,
  nao_identificado: <ScanSearch className="h-5 w-5" />,
  evidencia_insuficiente: <AlertTriangle className="h-5 w-5" />,
  sem_foto_secao: <ImageOff className="h-5 w-5" />,
  sem_foto_loja: <StoreIcon className="h-5 w-5" />,
  nao_verificado: <Package className="h-5 w-5" />,
  falha_tecnica: <AlertTriangle className="h-5 w-5" />,
  ruptura_justificada: <AlertTriangle className="h-5 w-5" />,
  validar_ruptura_antiga: <AlertTriangle className="h-5 w-5" />,
  ausente_cobrar: <XCircle className="h-5 w-5" />,
}

type View = 'loading' | 'progress' | 'ready'

export const AnaliseBook: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [book, setBook] = useState<Book | null>(null)
  const [brand, setBrand] = useState<Brand | null>(null)
  const [stores, setStores] = useState<Store[]>([])
  const [skus, setSkus] = useState<SKU[]>([])
  const [classifications, setClassifications] = useState<SkuClassification[]>([])

  const [view, setView] = useState<View>('loading')
  const [progress, setProgress] = useState<AnalysisProgress>({ message: '', pct: 0 })
  const [running, setRunning] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [storeFilter, setStoreFilter] = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [confidenceFilter, setConfidenceFilter] = useState('ALL')

  // Review drawer
  const [reviewItem, setReviewItem] = useState<SkuClassification | null>(null)
  const [reviewSaving, setReviewSaving] = useState(false)
  const [reviewNotes, setReviewNotes] = useState('')
  // Price verification state
  const [priceChecked, setPriceChecked] = useState(false)
  const [priceMatch, setPriceMatch] = useState<boolean | null>(null)
  const [priceObserved, setPriceObserved] = useState('')
  const [priceExpected, setPriceExpected] = useState('')
  const [missingPriceTag, setMissingPriceTag] = useState(false)
  const [missingSplash, setMissingSplash] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    try {
      setView('loading')
      const b = await getBookById(id)
      setBook(b)
      const br = await getBrandById(b.brand)
      setBrand(br)
      setStores(br.expand?.stores || [])
      const sk = await getSKUs(`brand = "${b.brand}"`)
      setSkus(sk)
      const cl = await getSkuClassifications(id)
      setClassifications(cl)
      setView('ready')
    } catch (err: any) {
      toast({ title: 'Erro ao carregar análise', description: err.message, variant: 'destructive' })
      navigate('/books')
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const startAnalysis = async () => {
    if (!id) return
    setRunning(true)
    setView('progress')
    setProgress({ message: 'Iniciando análise...', pct: 0 })
    try {
      await runBookAnalysis(id, (p) => setProgress(p))
      toast({
        title: 'Análise concluída',
        description: 'As classificações de SKU foram geradas.',
      })
      await load()
    } catch (err: any) {
      toast({
        title: 'Erro na análise',
        description: err.message || 'Falha ao processar análise.',
        variant: 'destructive',
      })
      setView('ready')
    } finally {
      setRunning(false)
    }
  }

  // ---- Derived data ----
  const storeMap = useMemo(() => {
    const m = new Map<string, Store>()
    for (const s of stores) m.set(s.id, s)
    return m
  }, [stores])

  const skuMap = useMemo(() => {
    const m = new Map<string, SKU>()
    for (const s of skus) m.set(s.id, s)
    return m
  }, [skus])

  const summary = useMemo(() => {
    const s: Record<SkuCategory, number> = {
      presente_pdv: 0,
      nao_identificado: 0,
      evidencia_insuficiente: 0,
      sem_foto_secao: 0,
      sem_foto_loja: 0,
      nao_verificado: 0,
      falha_tecnica: 0,
      ruptura_justificada: 0,
      validar_ruptura_antiga: 0,
      ausente_cobrar: 0,
    }
    for (const c of classifications) s[c.category]++
    return s
  }, [classifications])

  const filtered = useMemo(() => {
    return classifications.filter((c) => {
      const sku = skuMap.get(c.sku)
      const store = storeMap.get(c.store)
      const matchSearch =
        !search ||
        (sku?.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (sku?.code || '').toLowerCase().includes(search.toLowerCase()) ||
        (store?.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (store?.number || '').toLowerCase().includes(search.toLowerCase())
      const matchStore = storeFilter === 'ALL' || c.store === storeFilter
      const matchCategory = categoryFilter === 'ALL' || c.category === categoryFilter
      const matchConfidence = confidenceFilter === 'ALL' || c.confidence === confidenceFilter
      return matchSearch && matchStore && matchCategory && matchConfidence
    })
  }, [classifications, search, storeFilter, categoryFilter, confidenceFilter, skuMap, storeMap])

  const groupedByStore = useMemo(() => {
    const map = new Map<string, { store: Store | undefined; items: SkuClassification[] }>()
    for (const c of filtered) {
      if (!map.has(c.store)) map.set(c.store, { store: storeMap.get(c.store), items: [] })
      map.get(c.store)!.items.push(c)
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.store?.number || '').localeCompare(b.store?.number || ''),
    )
  }, [filtered, storeMap])

  // ---- Review ----
  const openReview = (c: SkuClassification) => {
    setReviewItem(c)
    setReviewNotes(c.notes || '')
    setPriceChecked(!!c.price_checked)
    setPriceMatch(c.price_match ?? null)
    setPriceObserved(c.price_observed || '')
    setPriceExpected(c.price_expected || '')
    setMissingPriceTag(!!c.missing_price_tag)
    setMissingSplash(!!c.missing_splash)
  }

  const saveReview = async (action: 'confirm_present' | 'confirm_absent' | 'keep_review') => {
    if (!reviewItem) return
    setReviewSaving(true)
    try {
      const patch: Partial<SkuClassification> = {
        reviewer: user!.id,
        reviewed_at: new Date().toISOString(),
        notes: reviewNotes,
        price_checked: priceChecked,
        price_match: priceChecked ? priceMatch : null,
        price_observed: priceObserved,
        price_expected: priceExpected,
        missing_price_tag: missingPriceTag,
        missing_splash: missingSplash,
      }
      if (action === 'confirm_present') {
        patch.category = 'presente_pdv'
        patch.confidence = 'alta'
      } else if (action === 'confirm_absent') {
        patch.category = 'ausente_cobrar'
        patch.confidence = 'alta'
      }
      // keep_review: apenas atualiza notas + preço
      await updateSkuClassification(reviewItem.id, patch)
      setClassifications((prev) =>
        prev.map((c) => (c.id === reviewItem.id ? { ...c, ...patch } : c)),
      )
      toast({ title: 'Revisão salva', description: 'Classificação atualizada.' })
      setReviewItem(null)
    } catch (err: any) {
      toast({ title: 'Erro ao salvar revisão', description: err.message, variant: 'destructive' })
    } finally {
      setReviewSaving(false)
    }
  }

  // ---- Render ----
  if (view === 'loading') {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-2" />
        <p className="text-sm text-slate-500">Carregando análise...</p>
      </div>
    )
  }

  if (view === 'progress') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/books/${id}`)}
            className="text-slate-500"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Análise de SKUs</h1>
            <p className="text-sm text-slate-500">{book?.title}</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-12 text-center space-y-6">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
              <h2 className="text-lg font-semibold text-slate-900">Processando Análise...</h2>
              <p className="text-sm text-slate-500">{progress.message}</p>
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <Progress value={progress.pct} className="h-2" />
              <p className="text-xs text-slate-400 text-right">{progress.pct}%</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const analysisStatus: AnalysisStatus = book?.analysis_status || 'pending'
  const hasResults = classifications.length > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/books/${id}`)}
            className="text-slate-500"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Análise de SKUs</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-sm text-slate-500">{book?.title}</span>
              <span className="text-xs text-slate-400">·</span>
              <Badge
                variant="outline"
                className={`text-[11px] ${ANALYSIS_STATUS_BADGE[analysisStatus]}`}
              >
                {ANALYSIS_STATUS_LABELS[analysisStatus]}
              </Badge>
              {book?.analyzed_at && (
                <span className="text-xs text-slate-400">· {formatDate(book.analyzed_at)}</span>
              )}
            </div>
          </div>
        </div>
        <Button
          onClick={startAnalysis}
          disabled={running}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          {running ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          {hasResults ? 'Reprocessar Análise' : 'Iniciar Análise'}
        </Button>
      </div>

      {!hasResults ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <ScanSearch className="h-12 w-12 text-slate-300" />
              <div>
                <p className="font-medium text-slate-700">Nenhuma análise realizada</p>
                <p className="text-sm">
                  Clique em <strong>Iniciar Análise</strong> para classificar os SKUs da carteira
                  nas fotos do PDV.
                </p>
              </div>
              <Button
                onClick={startAnalysis}
                disabled={running}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {running ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Iniciar Análise
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {CATEGORIES.map((cat) => (
              <SummaryCard
                key={cat}
                icon={CATEGORY_ICONS[cat]}
                label={SKU_CATEGORY_SHORT[cat]}
                value={summary[cat]}
                color={SKU_CATEGORY_BADGE[cat]}
              />
            ))}
          </div>

          {/* Filters */}
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative lg:col-span-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar SKU ou loja..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10 bg-white"
                />
              </div>
              <Select value={storeFilter} onValueChange={setStoreFilter}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Loja" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas as lojas</SelectItem>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.number} — {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas as categorias</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {SKU_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Confiança" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Toda confiança</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="baixa">Baixa / Revisar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Sections by store */}
          <div className="space-y-4">
            {groupedByStore.length === 0 ? (
              <Card className="p-12 text-center text-slate-500">
                <Package className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                Nenhuma classificação corresponde aos filtros.
              </Card>
            ) : (
              groupedByStore.map((g) => {
                const storeCounts: Record<SkuCategory, number> = {
                  presente_pdv: 0,
                  nao_identificado: 0,
                  evidencia_insuficiente: 0,
                  sem_foto_secao: 0,
                  sem_foto_loja: 0,
                  nao_verificado: 0,
                  falha_tecnica: 0,
                  ruptura_justificada: 0,
                  validar_ruptura_antiga: 0,
                  ausente_cobrar: 0,
                }
                for (const it of g.items) storeCounts[it.category]++
                return (
                  <Card key={g.store?.id || 'none'}>
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <StoreIcon className="h-4 w-4 text-slate-400" />
                          <span className="font-semibold text-slate-900 text-sm">
                            {g.store ? `${g.store.number} — ${g.store.name}` : 'Sem loja'}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {g.items.length} SKU{g.items.length > 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {CATEGORIES.filter((c) => storeCounts[c] > 0).map((c) => (
                            <Badge
                              key={c}
                              variant="outline"
                              className={`text-[10px] ${SKU_CATEGORY_BADGE[c]}`}
                            >
                              {SKU_CATEGORY_SHORT[c]}: {storeCounts[c]}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                            <tr>
                              <th className="text-left font-semibold px-3 py-2">SKU</th>
                              <th className="text-left font-semibold px-3 py-2">Classificação</th>
                              <th className="text-left font-semibold px-3 py-2">Confiança</th>
                              <th className="text-left font-semibold px-3 py-2">Notas</th>
                              <th className="text-left font-semibold px-3 py-2">Preço</th>
                              <th className="text-right font-semibold px-3 py-2">Ação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {g.items.map((c) => {
                              const sku = skuMap.get(c.sku)
                              const imgUrl = sku?.image ? getFileUrl(sku, sku.image) : null
                              return (
                                <tr key={c.id} className="hover:bg-slate-50/70">
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-2">
                                      {imgUrl ? (
                                        <img
                                          src={imgUrl}
                                          alt={sku?.name}
                                          className="h-8 w-8 rounded object-cover border border-slate-200 shrink-0"
                                        />
                                      ) : (
                                        <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center shrink-0">
                                          <Package className="h-4 w-4 text-slate-400" />
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <p className="font-medium text-slate-900 truncate">
                                          {sku?.name || '—'}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-mono">
                                          {sku?.code || ''}
                                        </p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2">
                                    <Badge
                                      variant="outline"
                                      className={`text-[11px] ${SKU_CATEGORY_BADGE[c.category]}`}
                                    >
                                      {SKU_CATEGORY_SHORT[c.category]}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-2">
                                    {c.confidence && (
                                      <Badge
                                        variant="outline"
                                        className={`text-[10px] ${CONFIDENCE_BADGE[c.confidence]}`}
                                      >
                                        {CONFIDENCE_LABELS[c.confidence]}
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-xs text-slate-500 max-w-xs truncate">
                                    {c.notes || '—'}
                                  </td>
                                  <td className="px-3 py-2">
                                    <PriceAlerts compact c={c} />
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 text-indigo-600 hover:text-indigo-700"
                                      onClick={() => openReview(c)}
                                    >
                                      {c.confidence === 'baixa' ? 'Revisar' : 'Detalhar'}
                                    </Button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>

          {/* Flat table (all classifications) */}
          <Card className="overflow-hidden p-0">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">
                Todas as Classificações ({filtered.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="text-left font-semibold px-3 py-2">Loja</th>
                    <th className="text-left font-semibold px-3 py-2">SKU</th>
                    <th className="text-left font-semibold px-3 py-2">Classificação</th>
                    <th className="text-left font-semibold px-3 py-2">Confiança</th>
                    <th className="text-left font-semibold px-3 py-2">Similaridade</th>
                    <th className="text-left font-semibold px-3 py-2">Preço</th>
                    <th className="text-right font-semibold px-3 py-2">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.slice(0, 200).map((c) => {
                    const sku = skuMap.get(c.sku)
                    const store = storeMap.get(c.store)
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2 text-slate-700">
                          {store ? `${store.number} — ${store.name}` : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-900">{sku?.name || '—'}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {sku?.code || ''}
                            </span>
                            {c.assortment_status === 'nao_trabalhado' && (
                              <Badge
                                variant="outline"
                                className="text-[9px] bg-slate-100 text-slate-600"
                              >
                                Não Trabalhado
                              </Badge>
                            )}
                            {c.discrepancy_flag && (
                              <Badge
                                variant="outline"
                                className="text-[9px] bg-red-100 text-red-800 border-red-300"
                              >
                                Discrepância Visível vs Ruptura
                              </Badge>
                            )}
                            {c.is_inferred_link && (
                              <Badge
                                variant="outline"
                                className="text-[9px] bg-amber-50 text-amber-700 border-amber-200"
                              >
                                Vínculo Inferido
                              </Badge>
                            )}
                          </div>
                          {c.reason_text && (
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1 italic">
                              Motivo: {c.reason_text}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Badge
                            variant="outline"
                            className={`text-[11px] ${SKU_CATEGORY_BADGE[c.category]}`}
                          >
                            {SKU_CATEGORY_SHORT[c.category]}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          {c.confidence && (
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${CONFIDENCE_BADGE[c.confidence]}`}
                            >
                              {CONFIDENCE_LABELS[c.confidence]}
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500">
                          {c.similarity != null ? `${Math.round(c.similarity * 100)}%` : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <PriceAlerts compact c={c} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-indigo-600 hover:text-indigo-700"
                            onClick={() => openReview(c)}
                          >
                            {c.confidence === 'baixa' ? 'Revisar' : 'Detalhar'}
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {filtered.length > 200 && (
              <div className="p-3 text-center text-xs text-slate-400 border-t border-slate-100">
                Mostrando 200 de {filtered.length} classificações — use os filtros para refinar.
              </div>
            )}
          </Card>
        </>
      )}

      {/* Review Drawer */}
      <Sheet open={!!reviewItem} onOpenChange={(o) => !o && setReviewItem(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {reviewItem && (
            <ReviewDrawerContent
              item={reviewItem}
              sku={skuMap.get(reviewItem.sku)}
              store={storeMap.get(reviewItem.store)}
              matchedPhoto={reviewItem.expand?.matched_photo}
              notes={reviewNotes}
              setNotes={setReviewNotes}
              saving={reviewSaving}
              onConfirmPresent={() => saveReview('confirm_present')}
              onConfirmAbsent={() => saveReview('confirm_absent')}
              onKeepReview={() => saveReview('keep_review')}
              onClose={() => setReviewItem(null)}
              priceChecked={priceChecked}
              setPriceChecked={setPriceChecked}
              priceMatch={priceMatch}
              setPriceMatch={setPriceMatch}
              priceObserved={priceObserved}
              setPriceObserved={setPriceObserved}
              priceExpected={priceExpected}
              setPriceExpected={setPriceExpected}
              missingPriceTag={missingPriceTag}
              setMissingPriceTag={setMissingPriceTag}
              missingSplash={missingSplash}
              setMissingSplash={setMissingSplash}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ---- Sub-components ----

const SummaryCard: React.FC<{
  icon: React.ReactNode
  label: string
  value: number
  color: string
}> = ({ icon, label, value, color }) => (
  <Card className={`border ${color}`}>
    <CardContent className="p-3 flex items-center gap-2">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-none">{value}</p>
        <p className="text-[11px] font-medium mt-1 opacity-80 truncate">{label}</p>
      </div>
    </CardContent>
  </Card>
)

const ReviewDrawerContent: React.FC<{
  item: SkuClassification
  sku?: SKU
  store?: Store
  matchedPhoto?: BookPhoto
  notes: string
  setNotes: (v: string) => void
  saving: boolean
  onConfirmPresent: () => void
  onConfirmAbsent: () => void
  onKeepReview: () => void
  onClose: () => void
  priceChecked: boolean
  setPriceChecked: (v: boolean) => void
  priceMatch: boolean | null
  setPriceMatch: (v: boolean | null) => void
  priceObserved: string
  setPriceObserved: (v: string) => void
  priceExpected: string
  setPriceExpected: (v: string) => void
  missingPriceTag: boolean
  setMissingPriceTag: (v: boolean) => void
  missingSplash: boolean
  setMissingSplash: (v: boolean) => void
}> = ({
  item,
  sku,
  store,
  matchedPhoto,
  notes,
  setNotes,
  saving,
  onConfirmPresent,
  onConfirmAbsent,
  onKeepReview,
  onClose,
  priceChecked,
  setPriceChecked,
  priceMatch,
  setPriceMatch,
  priceObserved,
  setPriceObserved,
  priceExpected,
  setPriceExpected,
  missingPriceTag,
  setMissingPriceTag,
  missingSplash,
  setMissingSplash,
}) => {
  const skuImgUrl = sku?.image ? getFileUrl(sku, sku.image) : null
  const photoUrl = matchedPhoto?.image_data
    ? getFileUrl(matchedPhoto, matchedPhoto.image_data)
    : null
  return (
    <>
      <SheetHeader className="mb-4">
        <SheetTitle>Revisão Manual</SheetTitle>
        <SheetDescription>
          {store ? `${store.number} — ${store.name}` : 'Loja'} · {sku?.name || 'SKU'}
        </SheetDescription>
      </SheetHeader>
      <div className="space-y-4">
        {/* Side-by-side comparison */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide text-slate-500">Referência SKU</Label>
            {skuImgUrl ? (
              <img
                src={skuImgUrl}
                alt={sku?.name}
                className="w-full aspect-square object-contain rounded-lg border border-slate-200 bg-slate-50"
              />
            ) : (
              <div className="w-full aspect-square rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center">
                <ImageOff className="h-8 w-8 text-slate-300" />
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide text-slate-500">Foto do PDV</Label>
            {photoUrl ? (
              <img
                src={photoUrl}
                alt="Foto PDV"
                className="w-full aspect-square object-contain rounded-lg border border-slate-200 bg-slate-50"
              />
            ) : (
              <div className="w-full aspect-square rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center">
                <ImageOff className="h-8 w-8 text-slate-300" />
                <span className="text-[10px] text-slate-400 absolute mt-12">Sem foto</span>
              </div>
            )}
          </div>
        </div>

        {/* Current classification */}
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-500">Classificação atual:</span>
            <Badge variant="outline" className={`text-[11px] ${SKU_CATEGORY_BADGE[item.category]}`}>
              {SKU_CATEGORY_LABELS[item.category]}
            </Badge>
            {item.confidence && (
              <Badge
                variant="outline"
                className={`text-[10px] ${CONFIDENCE_BADGE[item.confidence]}`}
              >
                {CONFIDENCE_LABELS[item.confidence]}
              </Badge>
            )}
          </div>
          {item.similarity != null && (
            <p className="text-xs text-slate-500">
              Similaridade: {Math.round(item.similarity * 100)}%
            </p>
          )}
        </div>

        {/* Dimensões da Auditoria e Evidência */}
        <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 space-y-2 text-xs">
          <p className="font-semibold text-slate-700">Dimensões da Auditoria</p>
          <div className="grid grid-cols-2 gap-2 text-slate-600">
            <div>
              <span className="text-slate-400">Presença: </span>
              <span className="font-medium">{item.presence_dimension || 'Não avaliada'}</span>
            </div>
            <div>
              <span className="text-slate-400">Cobertura: </span>
              <span className="font-medium">{item.coverage_dimension || 'Padrão'}</span>
            </div>
            <div>
              <span className="text-slate-400">Ruptura: </span>
              <span className="font-medium">{item.rupture_dimension || 'Nenhuma'}</span>
            </div>
            <div>
              <span className="text-slate-400">Agenda Visita: </span>
              <span className="font-medium">{item.visit_dimension || 'Não vinculada'}</span>
            </div>
          </div>
          {item.reason_text && (
            <div className="pt-1 border-t border-slate-200 text-slate-700">
              <span className="font-semibold">Motivo registrado: </span>
              <span>{item.reason_text}</span>
            </div>
          )}
          {item.evidence_photo_url && (
            <div className="pt-1 text-indigo-600">
              <a
                href={item.evidence_photo_url}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-indigo-800"
              >
                Ver foto da evidência visual
              </a>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="rev-notes">Notas do analista / Justificativa</Label>
          <textarea
            id="rev-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-slate-200 bg-white p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Observações sobre a validação..."
          />
        </div>

        {/* Price verification */}
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wide text-indigo-700 flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" /> Verificação de Preço
            </Label>
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <Checkbox
                checked={priceChecked}
                onCheckedChange={(v) => setPriceChecked(v === true)}
              />
              Verificar preço
            </label>
          </div>
          {priceChecked && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-500">Preço esperado</Label>
                <Input
                  value={priceExpected}
                  onChange={(e) => setPriceExpected(e.target.value)}
                  placeholder="R$ 0,00"
                  className="bg-white h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-slate-500">Preço observado</Label>
                <Input
                  value={priceObserved}
                  onChange={(e) => {
                    const val = e.target.value
                    setPriceObserved(val)
                    // Regra: etiqueta conforme se bate com preço normal OU promo (tolerância 1 centavo).
                    if (item && val.trim()) {
                      const skuItem = sku || (sku?.id === item.sku ? sku : undefined)
                      if (skuItem) setPriceMatch(priceMatchesExpected(skuItem, val))
                    } else {
                      setPriceMatch(null)
                    }
                  }}
                  placeholder="R$ 0,00"
                  className="bg-white h-9 text-sm"
                />
              </div>
              <div className="col-span-2 flex flex-wrap gap-4 text-xs text-slate-600">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={priceMatch === true}
                    onCheckedChange={(v) => setPriceMatch(v === true ? true : null)}
                  />
                  Preço conforme
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={priceMatch === false}
                    onCheckedChange={(v) => setPriceMatch(v === true ? false : null)}
                  />
                  Preço divergente
                </label>
              </div>
              <label className="col-span-2 flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <Checkbox
                  checked={missingPriceTag}
                  onCheckedChange={(v) => setMissingPriceTag(v === true)}
                />
                <CameraOff className="h-3.5 w-3.5 text-amber-600" />
                Sem etiqueta de preço exposta
              </label>
              <label className="col-span-2 flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <Checkbox
                  checked={missingSplash}
                  onCheckedChange={(v) => setMissingSplash(v === true)}
                />
                <Droplets className="h-3.5 w-3.5 text-amber-600" />
                Em promoção sem splash visível
              </label>
            </div>
          )}
        </div>
      </div>
      <SheetFooter className="pt-6 flex-col gap-2 sm:flex-col">
        <Button
          onClick={onConfirmPresent}
          disabled={saving}
          className="w-full bg-emerald-600 hover:bg-emerald-700"
        >
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <CheckCircle2 className="mr-2 h-4 w-4" /> Confirmar Presença
        </Button>
        <Button
          onClick={onConfirmAbsent}
          disabled={saving}
          variant="outline"
          className="w-full text-red-700 border-red-200 hover:bg-red-50"
        >
          <XCircle className="mr-2 h-4 w-4" /> Confirmar Ausência
        </Button>
        <Button onClick={onKeepReview} disabled={saving} variant="outline" className="w-full">
          <RefreshCw className="mr-2 h-4 w-4" /> Manter como Revisar
        </Button>
        <Button variant="ghost" onClick={onClose} className="w-full">
          Cancelar
        </Button>
      </SheetFooter>
    </>
  )
}

// Compact price-verification alert badges shown inline in tables.
const PriceAlerts: React.FC<{ c: SkuClassification; compact?: boolean }> = ({ c }) => {
  if (!c.price_checked) {
    return <span className="text-[10px] text-slate-400">—</span>
  }
  return (
    <div className="flex flex-col gap-0.5">
      {c.price_checked && c.price_match === false && (
        <Badge
          variant="outline"
          className="text-[9px] bg-red-100 text-red-800 border-red-200 w-fit"
        >
          <Tag className="h-2.5 w-2.5 mr-0.5" /> Divergente
        </Badge>
      )}
      {c.price_match === true && (
        <Badge
          variant="outline"
          className="text-[9px] bg-emerald-100 text-emerald-800 border-emerald-200 w-fit"
        >
          <Tag className="h-2.5 w-2.5 mr-0.5" /> Conforme
        </Badge>
      )}
      {c.missing_price_tag && (
        <Badge
          variant="outline"
          className="text-[9px] bg-amber-100 text-amber-800 border-amber-200 w-fit"
        >
          <CameraOff className="h-2.5 w-2.5 mr-0.5" /> Sem preço
        </Badge>
      )}
      {c.missing_splash && (
        <Badge
          variant="outline"
          className="text-[9px] bg-amber-100 text-amber-800 border-amber-200 w-fit"
        >
          <Droplets className="h-2.5 w-2.5 mr-0.5" /> Sem splash
        </Badge>
      )}
    </div>
  )
}
