import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import { getBookById, formatDate, getFileUrl } from '@/services/api'
import { getBookStoreScores } from '@/services/scoringApi'
import {
  Book,
  SkuClassification,
  StoreScore,
  scoreColor,
  SCORE_BADGE,
  SKU_CATEGORY_LABELS,
  SKU_CATEGORY_BADGE,
  SkuCategory,
} from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Loader2,
  Award,
  ChevronDown,
  ChevronRight,
  Store as StoreIcon,
  CheckCircle2,
  AlertTriangle,
  CameraOff,
  FileDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const NotasBook: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [book, setBook] = useState<Book | null>(null)
  const [scores, setScores] = useState<StoreScore[]>([])
  const [average, setAverage] = useState(0)
  const [classifications, setClassifications] = useState<SkuClassification[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedStore, setExpandedStore] = useState<string | null>(null)

  const load = async () => {
    if (!id) return
    try {
      setLoading(true)
      const b = await getBookById(id)
      setBook(b)
      const { scores: s, average: avg, classifications: cs } = await getBookStoreScores(id)
      setScores(s)
      setAverage(avg)
      setClassifications(cs)
    } catch (err: any) {
      toast({ title: 'Erro ao carregar notas', description: err.message, variant: 'destructive' })
      navigate('/books')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  const avgColor = scoreColor(average)

  const classByStore = useMemo(() => {
    const m = new Map<string, SkuClassification[]>()
    for (const c of classifications) {
      if (!m.has(c.store)) m.set(c.store, [])
      m.get(c.store)!.push(c)
    }
    return m
  }, [classifications])

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-2" />
        <p className="text-sm text-slate-500">Calculando notas...</p>
      </div>
    )
  }

  if (!book) return null

  const brand = book.expand?.brand
  const logoUrl = brand ? getFileUrl(brand, brand.logo) : null

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
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={brand?.name}
                className="h-10 w-10 rounded-xl object-contain border border-slate-100 p-1 bg-white"
              />
            ) : (
              <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center">
                {brand?.name?.slice(0, 2).toUpperCase() || '?'}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Notas — {book.title}
              </h1>
              <p className="text-xs text-slate-500">
                Auditoria: {formatDate(book.audit_date)} · {brand?.name}
              </p>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate(`/books/${id}/export`)}
          className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200"
        >
          <FileDown className="mr-2 h-4 w-4" /> Exportar PDF
        </Button>
      </div>

      {/* Average Card */}
      <Card className={cn('border-2', SCORE_BADGE[avgColor])}>
        <CardContent className="p-6 flex items-center gap-5">
          <div
            className={cn(
              'h-16 w-16 rounded-2xl flex items-center justify-center font-bold text-2xl',
              SCORE_BADGE[avgColor],
            )}
          >
            {scores.length > 0 && average > 0 ? average.toFixed(1) : '—'}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Award className="h-4 w-4 text-indigo-600" /> Nota Média do Book
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {scores.length > 0
                ? `Média das notas de ${scores.length} loja${scores.length !== 1 ? 's' : ''} auditadas`
                : 'Aguardando auditoria de lojas'}
            </p>
            <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden max-w-md">
              <div
                className={cn('h-full rounded-full', scoreBarColor(avgColor))}
                style={{ width: `${scores.length > 0 ? (average / 10) * 100 : 0}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Store Scores Table */}
      <Card className="overflow-hidden p-0">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Notas por Loja</h3>
        </div>
        {scores.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <AlertTriangle className="h-10 w-10 mx-auto mb-2 text-slate-300" />
            Nenhuma classificação encontrada. Execute a análise de SKUs primeiro.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {scores.map((s) => {
              const color = scoreColor(s.score)
              const isExpanded = expandedStore === s.storeId
              const storeName = s.store ? `${s.store.number} — ${s.store.name}` : 'Loja'
              const storeClasses = classByStore.get(s.storeId) || []
              return (
                <div key={s.storeId}>
                  <button
                    onClick={() => setExpandedStore(isExpanded ? null : s.storeId)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                    <StoreIcon className="h-4 w-4 text-slate-400" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{storeName}</p>
                      <p className="text-xs text-slate-500">
                        {s.present} presentes · {s.absent} ausentes · {s.justifiedRupture} rupturas
                        just.
                        {s.penalties > 0 && ` · ${s.penalties} penalidade(s)`}
                      </p>
                    </div>
                    <Badge variant="outline" className={SCORE_BADGE[color]}>
                      {s.score.toFixed(1)}
                    </Badge>
                  </button>
                  {isExpanded && (
                    <div className="bg-slate-50/50 p-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-xs">
                        <Stat label="Elegíveis" value={s.eligible} />
                        <Stat label="Presentes" value={s.present} color="text-emerald-600" />
                        <Stat label="Ausentes" value={s.absent} color="text-red-600" />
                        <Stat label="Penalidades" value={s.penalties} color="text-amber-600" />
                      </div>
                      <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                            <tr>
                              <th className="text-left font-semibold px-3 py-2">SKU</th>
                              <th className="text-left font-semibold px-3 py-2">Status</th>
                              <th className="text-left font-semibold px-3 py-2">Preço</th>
                              <th className="text-left font-semibold px-3 py-2">Observação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {storeClasses.map((c) => {
                              const sku = c.expand?.sku
                              return (
                                <tr key={c.id} className="hover:bg-slate-50/70">
                                  <td className="px-3 py-2">
                                    <p className="font-medium text-slate-800">{sku?.name || '—'}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">
                                      {sku?.code}
                                    </p>
                                  </td>
                                  <td className="px-3 py-2">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        'text-[10px]',
                                        SKU_CATEGORY_BADGE[c.category as SkuCategory],
                                      )}
                                    >
                                      {SKU_CATEGORY_LABELS[c.category as SkuCategory]}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex flex-col gap-0.5">
                                      {c.price_checked && c.price_match === false && (
                                        <span className="inline-flex items-center gap-1 text-[10px] text-red-600">
                                          <AlertTriangle className="h-3 w-3" /> Preço divergente
                                        </span>
                                      )}
                                      {c.missing_price_tag && (
                                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-600">
                                          <CameraOff className="h-3 w-3" /> Sem preço exposto
                                        </span>
                                      )}
                                      {c.missing_splash && (
                                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-600">
                                          <AlertTriangle className="h-3 w-3" /> Sem splash
                                        </span>
                                      )}
                                      {!c.price_checked && c.category === 'presente_pdv' && (
                                        <span className="text-[10px] text-slate-400">
                                          Não verificado
                                        </span>
                                      )}
                                      {c.price_checked && c.price_match === true && (
                                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
                                          <CheckCircle2 className="h-3 w-3" /> Conforme
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-slate-500">{c.notes || '—'}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

const Stat: React.FC<{ label: string; value: number; color?: string }> = ({
  label,
  value,
  color,
}) => (
  <div className="p-2 rounded-lg bg-white border border-slate-200">
    <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
    <p className={cn('text-lg font-bold', color || 'text-slate-900')}>{value}</p>
  </div>
)

function scoreBarColor(color: string): string {
  switch (color) {
    case 'green':
      return 'bg-emerald-500'
    case 'yellow':
      return 'bg-amber-500'
    case 'orange':
      return 'bg-orange-500'
    default:
      return 'bg-red-500'
  }
}
