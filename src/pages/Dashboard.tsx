import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  Award,
  ArrowRight,
  FileSpreadsheet,
  AlertTriangle,
  Store as StoreIcon,
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  Loader2,
  ShieldAlert,
  Gauge,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ROLE_LABELS, ROLE_BADGE_CLASSES, scoreColor, SCORE_BADGE } from '@/types'
import {
  loadDashboardData,
  loadTopPromoters,
  type DashboardMetrics,
  type BrandEvolutionSeries,
  type TopPromoter,
} from '@/services/dashboardApi'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CartesianGrid, Line, LineChart, XAxis, YAxis, Legend as RLegend } from 'recharts'
import { cn } from '@/lib/utils'

export const Dashboard: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [evolution, setEvolution] = useState<BrandEvolutionSeries[]>([])
  const [periods, setPeriods] = useState<{ period: string; label: string }[]>([])
  const [topPromoters, setTopPromoters] = useState<TopPromoter[]>([])
  const [loading, setLoading] = useState(true)
  const [brandScope, setBrandScope] = useState('ALL')

  useEffect(() => {
    let active = true
    async function load() {
      if (!user) return
      try {
        setLoading(true)
        const [data, promoters] = await Promise.all([loadDashboardData(), loadTopPromoters(5)])
        if (!active) return
        setMetrics(data.metrics)
        setEvolution(data.evolution)
        setPeriods(data.periods)
        setTopPromoters(promoters)
      } catch (err) {
        console.error('Error loading dashboard data:', err)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [user])

  const avgColor = metrics ? scoreColor(metrics.averageScore) : 'green'
  // brandScope selector is present for future per-brand filtering
  void brandScope

  // Build chart data: array of { period, label, [brandId]: value }
  const chartData = useMemo(() => {
    return periods.map((p) => {
      const row: Record<string, number | string | null> = { period: p.period, label: p.label }
      for (const series of evolution) {
        const point = series.data.find((d) => d.period === p.period)
        row[series.brandId] = point?.value ?? null
      }
      return row
    })
  }, [periods, evolution])

  const chartConfig: ChartConfig = useMemo(() => {
    const cfg: ChartConfig = {}
    for (const s of evolution) {
      cfg[s.brandId] = { label: s.brandName, color: s.color }
    }
    return cfg
  }, [evolution])

  if (!user) return null

  // For the circular progress
  const avgPct = metrics ? (metrics.averageScore / 10) * 100 : 0

  const todayFormatted = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-6 sm:p-8 text-white shadow-lg">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Painel Gerencial</h1>
              <span
                className={`px-3 py-1 text-xs font-semibold rounded-full border ${ROLE_BADGE_CLASSES[user.role]}`}
              >
                {ROLE_LABELS[user.role]}
              </span>
            </div>
            <p className="text-indigo-200 text-sm capitalize">{todayFormatted}</p>
            <p className="text-indigo-300/80 text-xs mt-1">
              Visão consolidada das auditorias de PDV e execução de books.
            </p>
          </div>
        </div>
      </div>

      {/* Indicator Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Nota Média Geral - circular */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Nota Média Geral
              </p>
              <div className="flex items-baseline gap-1 mt-2">
                <h3 className="text-3xl font-bold text-slate-900">
                  {loading ? '—' : metrics!.averageScore.toFixed(1)}
                </h3>
                <span className="text-sm text-slate-400 font-medium">/10</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {loading || !metrics ? '' : `${metrics.completedBooks} book(s) concluído(s)`}
              </p>
            </div>
            <CircularScore value={avgPct} color={avgColor} loading={loading} />
          </CardContent>
        </Card>

        {/* Total de Books */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total de Books
              </p>
              <h3 className="text-3xl font-bold text-slate-900 mt-2">
                {loading ? '—' : metrics!.totalBooks}
              </h3>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {metrics && (
                  <>
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
                    >
                      {metrics.booksByStatus.completed} concluídos
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                    >
                      {metrics.booksByStatus.pending_review} pendentes
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
                    >
                      {metrics.booksByStatus.reviewed} em análise
                    </Badge>
                  </>
                )}
              </div>
            </div>
            <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Rupturas Ativas */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Rupturas Ativas
              </p>
              <h3 className="text-3xl font-bold text-slate-900 mt-2">
                {loading ? '—' : metrics!.activeRuptures}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">SKUs em ruptura &lt; 15 dias</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold shrink-0">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Lojas Não Auditadas */}
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Lojas Não Auditadas
              </p>
              <h3 className="text-3xl font-bold text-slate-900 mt-2">
                {loading ? '—' : metrics!.unauditedStores}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">Ocorrências "Sem Foto — Loja"</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
              <StoreIcon className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Evolution chart + Top promoters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evolution Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-600" />
              Evolução de Notas por Marca
            </CardTitle>
            <Select value={brandScope} onValueChange={setBrandScope}>
              <SelectTrigger className="w-40 bg-white h-8 text-xs">
                <SelectValue placeholder="Escopo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Top 5 marcas</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              </div>
            ) : evolution.length === 0 || periods.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                <Gauge className="h-10 w-10 mb-2 text-slate-300" />
                <p className="text-sm">Sem books concluídos para exibir evolução.</p>
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    domain={[0, 10]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <RLegend wrapperStyle={{ fontSize: 11 }} />
                  {evolution.map((s) => (
                    <Line
                      key={s.brandId}
                      type="monotone"
                      dataKey={s.brandId}
                      name={s.brandName}
                      stroke={s.color}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Top 5 Promoters */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="h-5 w-5 text-indigo-600" />
              Top 5 Promotores
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/ranking')}
              className="text-indigo-600"
            >
              Ver tudo <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              </div>
            ) : topPromoters.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400">
                <Trophy className="h-10 w-10 mb-2 text-slate-300" />
                <p className="text-sm">Sem promotores com notas.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topPromoters.map((p, i) => {
                  const color = scoreColor(p.avgScore)
                  const widthPct = (p.avgScore / 10) * 100
                  return (
                    <div key={p.promoterId} className="flex items-center gap-3">
                      <span className="w-6 text-center font-bold text-slate-400 text-sm">
                        {i + 1}
                      </span>
                      <div className="h-9 w-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {p.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate text-sm">{p.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden max-w-[120px]">
                            <div
                              className={cn('h-full rounded-full', scoreBarColor(color))}
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-500">{p.storeCount} lojas</span>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn('text-xs', SCORE_BADGE[color])}>
                        {p.avgScore.toFixed(1)}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-50/50">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Books concluídos</p>
              <p className="text-xl font-bold text-slate-900">
                {loading ? '—' : (metrics?.completedBooks ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-50/50">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Gauge className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">SKUs analisados</p>
              <p className="text-xl font-bold text-slate-900">
                {loading ? '—' : (metrics?.totalSkuAnalyzed ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-50/50">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Books em processamento</p>
              <p className="text-xl font-bold text-slate-900">
                {loading ? '—' : (metrics?.booksByStatus.processing ?? 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      {(user.role === 'administrator' || user.role === 'analista_books') && (
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => navigate('/books')}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Gerenciar Books
          </Button>
          <Button variant="outline" onClick={() => navigate('/ranking')}>
            <Award className="mr-2 h-4 w-4" /> Ranking Completo
          </Button>
          <Button variant="outline" onClick={() => navigate('/ruptura')}>
            <AlertTriangle className="mr-2 h-4 w-4" /> Rupturas
          </Button>
        </div>
      )}

      {/* Unused icon refs to keep imports */}
      <span className="hidden">
        <TrendingDown /> <Minus />
      </span>
    </div>
  )
}

// ---- Circular score component ----
const CircularScore: React.FC<{ value: number; color: string; loading: boolean }> = ({
  value,
  color,
  loading,
}) => {
  const size = 64
  const stroke = 6
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c - (value / 100) * c
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={ringColor(color)}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={loading ? c : offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-slate-700">
          {loading ? '—' : Math.round(value)}
        </span>
      </div>
    </div>
  )
}

function ringColor(color: string): string {
  switch (color) {
    case 'green':
      return '#10b981'
    case 'yellow':
      return '#f59e0b'
    case 'orange':
      return '#f97316'
    default:
      return '#ef4444'
  }
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
