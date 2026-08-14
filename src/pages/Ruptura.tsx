import React, { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import {
  getRuptureReports,
  deleteRuptureReport,
  getBrands,
  getAllStores,
  getSKUs,
} from '@/services/api'
import { RuptureReport, Brand, Store, SKU, RuptureType, RUPTURE_TYPE_LABELS } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Loader2,
  Upload,
  Search,
  Trash2,
  AlertTriangle,
  Calendar,
  Package,
  Store as StoreIcon,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { formatDate } from '@/services/api'

const RUPTURE_TYPE_BADGE: Record<RuptureType, string> = {
  total: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300',
  parcial: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
  zerado: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-300',
}

const RUPTURE_OLD_DAYS = 15

export const Ruptura: React.FC = () => {
  const { toast } = useToast()
  const navigate = useNavigate()

  const [reports, setReports] = useState<RuptureReport[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('ALL')
  const [storeFilter, setStoreFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<RuptureReport | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const [r, b] = await Promise.all([getRuptureReports(), getBrands()])
      setReports(r)
      setBrands(b)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar rupturas',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const brandMap = useMemo(() => {
    const m = new Map<string, Brand>()
    for (const b of brands) m.set(b.id, b)
    return m
  }, [brands])

  const storesForBrand = useMemo(() => {
    if (brandFilter === 'ALL') return []
    const brand = brandMap.get(brandFilter)
    return brand?.expand?.stores || []
  }, [brandFilter, brandMap])

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      const sku = r.expand?.sku
      const store = r.expand?.store
      const brand = r.expand?.brand
      const matchSearch =
        !search ||
        (sku?.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (sku?.code || '').toLowerCase().includes(search.toLowerCase()) ||
        (store?.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (store?.number || '').toLowerCase().includes(search.toLowerCase()) ||
        (brand?.name || '').toLowerCase().includes(search.toLowerCase())
      const matchBrand = brandFilter === 'ALL' || r.brand === brandFilter
      const matchStore = storeFilter === 'ALL' || r.store === storeFilter
      const matchType = typeFilter === 'ALL' || r.rupture_type === typeFilter
      const matchFrom = !dateFrom || (r.report_date || '') >= dateFrom
      const matchTo = !dateTo || (r.report_date || '') <= dateTo
      return matchSearch && matchBrand && matchStore && matchType && matchFrom && matchTo
    })
  }, [reports, search, brandFilter, storeFilter, typeFilter, dateFrom, dateTo])

  const isOld = (r: RuptureReport) => (r.days_in_rupture || 0) > RUPTURE_OLD_DAYS

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      await deleteRuptureReport(deleteTarget.id)
      setReports((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      toast({ title: 'Ruptura excluída' })
      setDeleteTarget(null)
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
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
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Rupturas</h1>
            <p className="text-sm text-slate-500">
              Relatórios de ruptura importados — {reports.length} registros
            </p>
          </div>
        </div>
        <Button
          onClick={() => navigate('/ruptura/import')}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Upload className="mr-2 h-4 w-4" /> Importar Ruptura
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar loja, SKU ou marca..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 bg-white"
            />
          </div>
          <Select
            value={brandFilter}
            onValueChange={(v) => {
              setBrandFilter(v)
              setStoreFilter('ALL')
            }}
          >
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Marca" />
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
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Loja" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas as lojas</SelectItem>
              {storesForBrand.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.number} — {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os tipos</SelectItem>
              <SelectItem value="total">Ruptura Total</SelectItem>
              <SelectItem value="parcial">Ruptura Parcial</SelectItem>
              <SelectItem value="zerado">Estoque Zerado</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="bg-white h-10"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="bg-white h-10"
          />
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-2" />
            <p className="text-sm text-slate-500">Carregando rupturas...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <AlertTriangle className="h-10 w-10 mx-auto mb-2 text-slate-300" />
            Nenhuma ruptura encontrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="text-left font-semibold px-3 py-2">Marca</th>
                  <th className="text-left font-semibold px-3 py-2">Loja</th>
                  <th className="text-left font-semibold px-3 py-2">SKU</th>
                  <th className="text-left font-semibold px-3 py-2">Tipo</th>
                  <th className="text-left font-semibold px-3 py-2">Data</th>
                  <th className="text-left font-semibold px-3 py-2">Dias</th>
                  <th className="text-left font-semibold px-3 py-2">Status</th>
                  <th className="text-right font-semibold px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => {
                  const sku = r.expand?.sku
                  const store = r.expand?.store
                  const brand = r.expand?.brand
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2 text-slate-700">{brand?.name || '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <StoreIcon className="h-3.5 w-3.5 text-slate-400" />
                          <div>
                            <p className="font-medium text-slate-900">{store?.name || '—'}</p>
                            <p className="text-[10px] text-slate-400">{store?.number}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5 text-slate-400" />
                          <div>
                            <p className="font-medium text-slate-900">{sku?.name || '—'}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{sku?.code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          variant="outline"
                          className={`text-[11px] ${RUPTURE_TYPE_BADGE[r.rupture_type]}`}
                        >
                          {RUPTURE_TYPE_LABELS[r.rupture_type]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{formatDate(r.report_date)}</td>
                      <td className="px-3 py-2 text-slate-600">{r.days_in_rupture ?? '—'}</td>
                      <td className="px-3 py-2">
                        <Badge
                          variant="outline"
                          className={
                            isOld(r)
                              ? 'bg-orange-100 text-orange-800 border-orange-200'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                          }
                        >
                          {isOld(r) ? 'Antiga (>15 dias)' : 'Ativa'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setDeleteTarget(r)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 200 && (
          <div className="p-3 text-center text-xs text-slate-400 border-t border-slate-100">
            Mostrando {filtered.length} rupturas — use os filtros para refinar.
          </div>
        )}
      </Card>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Ruptura</DialogTitle>
            <DialogDescription>
              Excluir o relatório de ruptura deste SKU? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
