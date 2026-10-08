import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getVisitSchedules,
  createVisitSchedule,
  updateVisitSchedule,
  deleteVisitSchedule,
  getAllStores,
  getBrands,
  getPromoters,
} from '@/services/api'
import {
  VisitSchedule,
  VisitScheduleStatus,
  Store,
  Brand,
  Promoter,
  VISIT_SCHEDULE_STATUS_LABELS,
  VISIT_SCHEDULE_STATUS_BADGE,
} from '@/types'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DialogFooter,
} from '@/components/ui/dialog'
import {
  CalendarDays,
  Plus,
  FileSpreadsheet,
  Search,
  Trash2,
  Edit,
  Loader2,
  AlertTriangle,
  Clock,
  UserCheck,
} from 'lucide-react'

export const AgendaVisitas: React.FC = () => {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [schedules, setSchedules] = useState<VisitSchedule[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [promoters, setPromoters] = useState<Promoter[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [storeFilter, setStoreFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [promoterFilter, setPromoterFilter] = useState('ALL')

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<VisitSchedule | null>(null)
  const [saving, setSaving] = useState(false)

  // Formulário
  const [formStore, setFormStore] = useState('')
  const [formVisitDate, setFormVisitDate] = useState('')
  const [formPromoter, setFormPromoter] = useState('')
  const [formBrand, setFormBrand] = useState('')
  const [formStatus, setFormStatus] = useState<VisitScheduleStatus>(
    'visita_agendada_nao_confirmada',
  )
  const [formShift, setFormShift] = useState<'manha' | 'tarde' | 'integral'>('integral')
  const [formCheckin, setFormCheckin] = useState('')
  const [formCheckout, setFormCheckout] = useState('')
  const [formNotes, setFormNotes] = useState('')

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [sch, sts, brs, prs] = await Promise.all([
        getVisitSchedules(),
        getAllStores(),
        getBrands(),
        getPromoters(),
      ])
      setSchedules(sch)
      setStores(sts)
      setBrands(brs)
      setPromoters(prs)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar agenda',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openCreateModal = () => {
    setEditingItem(null)
    setFormStore(stores[0]?.id || '')
    setFormVisitDate(new Date().toISOString().slice(0, 10))
    setFormPromoter(promoters[0]?.id || '')
    setFormBrand(brands[0]?.id || '')
    setFormStatus('visita_agendada_nao_confirmada')
    setFormShift('integral')
    setFormCheckin('')
    setFormCheckout('')
    setFormNotes('')
    setModalOpen(true)
  }

  const openEditModal = (item: VisitSchedule) => {
    setEditingItem(item)
    setFormStore(item.store)
    setFormVisitDate(item.visit_date ? item.visit_date.slice(0, 10) : '')
    setFormPromoter(item.promoter || '')
    setFormBrand(item.brand || '')
    setFormStatus(item.status)
    setFormShift(item.shift || 'integral')
    setFormCheckin(item.checkin_time || '')
    setFormCheckout(item.checkout_time || '')
    setFormNotes(item.notes || '')
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formStore || !formVisitDate) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Selecione a loja e a data da visita.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const payload: any = {
        store: formStore,
        visit_date: formVisitDate,
        promoter: formPromoter || null,
        brand: formBrand || null,
        status: formStatus,
        shift: formShift,
        checkin_time: formCheckin || '',
        checkout_time: formCheckout || '',
        notes: formNotes || '',
        origin: editingItem?.origin || 'manual',
      }

      if (editingItem) {
        await updateVisitSchedule(editingItem.id, payload)
        toast({ title: 'Agendamento atualizado' })
      } else {
        await createVisitSchedule(payload)
        toast({ title: 'Visita agendada com sucesso' })
      }
      setModalOpen(false)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir este agendamento de visita?')) return
    try {
      await deleteVisitSchedule(id)
      toast({ title: 'Agendamento excluído' })
      setSchedules((prev) => prev.filter((it) => it.id !== id))
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const filtered = useMemo(() => {
    return schedules.filter((s) => {
      const sDate = s.visit_date ? s.visit_date.slice(0, 10) : ''
      const matchDate = !dateFilter || sDate === dateFilter
      const matchStore = storeFilter === 'ALL' || s.store === storeFilter
      const matchStatus = statusFilter === 'ALL' || s.status === statusFilter
      const matchPromoter = promoterFilter === 'ALL' || s.promoter === promoterFilter

      const storeName = s.expand?.store?.name || ''
      const storeNum = s.expand?.store?.number || ''
      const promoterName = s.expand?.promoter?.name || ''
      const term = search.toLowerCase()

      const matchSearch =
        !search ||
        storeName.toLowerCase().includes(term) ||
        storeNum.toLowerCase().includes(term) ||
        promoterName.toLowerCase().includes(term)

      return matchDate && matchStore && matchStatus && matchPromoter && matchSearch
    })
  }, [schedules, dateFilter, storeFilter, statusFilter, promoterFilter, search])

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-indigo-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Agenda de Visitas</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Planejamento e status de visitas por Loja, Data e Promotor. Ausência de fotos não
            comprova ausência de visita.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => navigate('/agenda/import')}
            className="border-slate-300"
          >
            <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" />
            Importar Roteiro
          </Button>
          <Button onClick={openCreateModal} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="mr-2 h-4 w-4" />
            Nova Visita
          </Button>
        </div>
      </div>

      {/* Cartões de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-slate-500 font-medium">Total de Visitas</p>
            <p className="text-xl font-bold text-slate-900 mt-0.5">{schedules.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-emerald-600 font-medium">Evidências Recebidas</p>
            <p className="text-xl font-bold text-emerald-700 mt-0.5">
              {schedules.filter((s) => s.status === 'visita_confirmada_evidencias').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-blue-600 font-medium">Fotos Pendentes</p>
            <p className="text-xl font-bold text-blue-700 mt-0.5">
              {schedules.filter((s) => s.status === 'visita_confirmada_fotos_pendentes').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-amber-600 font-medium">Conclusão Não Confirmada</p>
            <p className="text-xl font-bold text-amber-700 mt-0.5">
              {schedules.filter((s) => s.status === 'visita_agendada_nao_confirmada').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-slate-500 font-medium">Sem Agenda / Desconhecida</p>
            <p className="text-xl font-bold text-slate-700 mt-0.5">
              {
                schedules.filter(
                  (s) => s.status === 'sem_visita_agendada' || s.status === 'agenda_desconhecida',
                ).length
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar loja ou promotor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 bg-white"
            />
          </div>

          <div>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              placeholder="Filtrar por data"
              className="bg-white h-10"
            />
          </div>

          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Loja" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas as Lojas</SelectItem>
              {stores.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.number} — {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={promoterFilter} onValueChange={setPromoterFilter}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Promotor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os Promotores</SelectItem>
              {promoters.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os Status</SelectItem>
              <SelectItem value="visita_confirmada_evidencias">
                Confirmada, evidências recebidas
              </SelectItem>
              <SelectItem value="visita_confirmada_fotos_pendentes">
                Confirmada, fotos pendentes
              </SelectItem>
              <SelectItem value="visita_agendada_nao_confirmada">
                Agendada, conclusão não confirmada
              </SelectItem>
              <SelectItem value="sem_visita_agendada">Sem visita agendada</SelectItem>
              <SelectItem value="agenda_desconhecida">Agenda desconhecida</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Lista / Tabela */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-2" />
            Carregando agenda de visitas...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <CalendarDays className="h-10 w-10 mx-auto text-slate-300 mb-2" />
            Nenhuma visita encontrada com os filtros atuais.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Data</th>
                  <th className="text-left font-semibold px-4 py-3">Loja</th>
                  <th className="text-left font-semibold px-4 py-3">Promotor</th>
                  <th className="text-left font-semibold px-4 py-3">Status da Visita</th>
                  <th className="text-left font-semibold px-4 py-3">Horários / Turno</th>
                  <th className="text-left font-semibold px-4 py-3">Vínculo / Origem</th>
                  <th className="text-right font-semibold px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => {
                  const store = s.expand?.store
                  const promoter = s.expand?.promoter

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                        {s.visit_date ? s.visit_date.slice(0, 10) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {store ? `${store.number} — ${store.name}` : '—'}
                        </div>
                        {store?.network && (
                          <div className="text-xs text-slate-400">{store.network}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-800">
                        {promoter?.name || 'Promotor não atribuído'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`text-xs ${VISIT_SCHEDULE_STATUS_BADGE[s.status]}`}
                        >
                          {VISIT_SCHEDULE_STATUS_LABELS[s.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>{s.shift || 'Integral'}</span>
                        </div>
                        {(s.checkin_time || s.checkout_time) && (
                          <div className="text-[11px] text-slate-400">
                            In: {s.checkin_time || '—'} | Out: {s.checkout_time || '—'}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {s.is_inferred && (
                          <Badge
                            variant="outline"
                            className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
                          >
                            Vínculo Inferido
                          </Badge>
                        )}
                        {s.ambiguous_conflict && (
                          <div className="flex items-center gap-1 text-red-600 text-[11px] mt-0.5">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Conflito / Revisar</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(s)}
                            className="h-8 w-8 text-slate-500 hover:text-indigo-600"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(s.id)}
                            className="h-8 w-8 text-slate-500 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal de Nova / Edição */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Editar Agendamento de Visita' : 'Novo Agendamento de Visita'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div>
              <Label>Loja *</Label>
              <Select value={formStore} onValueChange={setFormStore}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a loja" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.number} — {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data da Visita *</Label>
                <Input
                  type="date"
                  value={formVisitDate}
                  onChange={(e) => setFormVisitDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Promotor</Label>
                <Select value={formPromoter} onValueChange={setFormPromoter}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o promotor" />
                  </SelectTrigger>
                  <SelectContent>
                    {promoters.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status da Visita</Label>
                <Select
                  value={formStatus}
                  onValueChange={(v: VisitScheduleStatus) => setFormStatus(v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visita_agendada_nao_confirmada">
                      Agendada, conclusão não confirmada
                    </SelectItem>
                    <SelectItem value="visita_confirmada_fotos_pendentes">
                      Confirmada, fotos pendentes
                    </SelectItem>
                    <SelectItem value="visita_confirmada_evidencias">
                      Confirmada, evidências recebidas
                    </SelectItem>
                    <SelectItem value="sem_visita_agendada">Sem visita agendada</SelectItem>
                    <SelectItem value="agenda_desconhecida">Agenda desconhecida</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Turno</Label>
                <Select value={formShift} onValueChange={(v: any) => setFormShift(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manha">Manhã</SelectItem>
                    <SelectItem value="tarde">Tarde</SelectItem>
                    <SelectItem value="integral">Integral</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Horário Check-in (Opcional)</Label>
                <Input
                  type="time"
                  value={formCheckin}
                  onChange={(e) => setFormCheckin(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Horário Check-out (Opcional)</Label>
                <Input
                  type="time"
                  value={formCheckout}
                  onChange={(e) => setFormCheckout(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Observações</Label>
              <Input
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Ex: Visita remarcada / Checkin manual"
                className="mt-1"
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Visita
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
