import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import { getBrands } from '@/services/api'
import { getPromoterRanking } from '@/services/scoringApi'
import { Brand, PromoterScore, scoreColor, SCORE_BADGE } from '@/types'
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
import { Award, ArrowLeft, Loader2, TrendingUp, TrendingDown, Minus, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Ranking: React.FC = () => {
  const { toast } = useToast()
  const navigate = useNavigate()

  const [brands, setBrands] = useState<Brand[]>([])
  const [promoters, setPromoters] = useState<PromoterScore[]>([])
  const [loading, setLoading] = useState(true)
  const [brandFilter, setBrandFilter] = useState('ALL')

  const load = async () => {
    try {
      setLoading(true)
      const [b, p] = await Promise.all([getBrands(), getPromoterRanking(undefined)])
      setBrands(b)
      setPromoters(p)
    } catch (err: any) {
      toast({ title: 'Erro ao carregar ranking', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Re-filter on brand change
  useEffect(() => {
    if (brandFilter === 'ALL') {
      getPromoterRanking(undefined)
        .then(setPromoters)
        .catch(() => {})
    } else {
      getPromoterRanking(brandFilter)
        .then(setPromoters)
        .catch(() => {})
    }
  }, [brandFilter])

  const topScore = promoters[0]?.avgScore ?? 10
  const podium = promoters.slice(0, 3)

  const trendIcon = (t: PromoterScore['trend']) => {
    if (t === 'up') return <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
    if (t === 'down') return <TrendingDown className="h-3.5 w-3.5 text-red-600" />
    return <Minus className="h-3.5 w-3.5 text-slate-400" />
  }

  return (
    <div className="space-y-6">
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
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Ranking de Promotores
            </h1>
            <p className="text-sm text-slate-500">
              Nota média dos promotores com base nas auditorias concluídas.
            </p>
          </div>
        </div>
        <Select value={brandFilter} onValueChange={setBrandFilter}>
          <SelectTrigger className="w-full sm:w-56 bg-white">
            <SelectValue placeholder="Todas as marcas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas as marcas</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-2" />
          <p className="text-sm text-slate-500">Calculando ranking...</p>
        </div>
      ) : promoters.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-slate-500">
            <Trophy className="h-10 w-10 mx-auto mb-2 text-slate-300" />
            Nenhum promotor com auditorias concluídas encontrado.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Podium */}
          {podium.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {podium.map((p, i) => {
                const color = scoreColor(p.avgScore)
                const place = i + 1
                const podiumStyle =
                  place === 1
                    ? 'bg-amber-50 border-amber-200'
                    : place === 2
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-orange-50 border-orange-200'
                return (
                  <Card key={p.promoterId} className={cn('border-2', podiumStyle)}>
                    <CardContent className="p-5 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
                        {p.promoter?.name?.slice(0, 1).toUpperCase() || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate">
                          {p.promoter?.name || '—'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {p.storeCount} loja{p.storeCount !== 1 ? 's' : ''} ·{' '}
                          {p.brandNames.join(', ') || '—'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn('text-2xl font-bold', SCORE_BADGE[color])}>
                          {p.avgScore.toFixed(1)}
                        </p>
                        <p className="text-[10px] text-slate-400">{place}º lugar</p>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {/* Full ranking with bars */}
          <Card className="overflow-hidden p-0">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <Award className="h-5 w-5 text-indigo-600" /> Classificação Geral
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              {promoters.map((p, i) => {
                const color = scoreColor(p.avgScore)
                const widthPct = (p.avgScore / 10) * 100
                return (
                  <div key={p.promoterId} className="p-4 flex items-center gap-4">
                    <span className="w-8 text-center font-bold text-slate-400 text-sm">
                      {i + 1}
                    </span>
                    <div className="h-10 w-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                      {p.promoter?.name?.slice(0, 1).toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-slate-900 truncate">
                          {p.promoter?.name || '—'}
                        </p>
                        {trendIcon(p.trend)}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden max-w-sm">
                          <div
                            className={cn('h-full rounded-full', scoreBarColor(color))}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {p.storeCount} loja{p.storeCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge variant="outline" className={SCORE_BADGE[color]}>
                        {p.avgScore.toFixed(1)}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

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
