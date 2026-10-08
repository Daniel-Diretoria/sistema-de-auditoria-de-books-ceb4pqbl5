import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getAssortmentMatrix,
  createAssortmentItem,
  updateAssortmentItem,
  deleteAssortmentItem,
  getBrands,
  getAllStores,
  getSKUs,
} from '@/services/api'
import {
  AssortmentMatrixItem,
  AssortmentStatus,
  Brand,
  Store,
  SKU,
  ASSORTMENT_STATUS_LABELS,
  ASSORTMENT_STATUS_BADGE,
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
  Layers,
  Plus,
  FileSpreadsheet,
  Search,
  Filter,
  Trash2,
  Edit,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'

export const Sortimento: React.FC = () => {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [items, setItems] = useState<AssortmentMatrixItem[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [skus, setSkus] = useState<SKU[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('ALL')
  const [storeFilter, setStoreFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [networkFilter, setNetworkFilter] = useState('ALL')

  // Modal de criação / edição
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AssortmentMatrixItem | null>(null)
  const [saving, setSaving] = useState(false)

  // Campos do formulário
  const [formBrand, setFormBrand] = useState('')
  const [formSku, setFormSku] = useState('')
  const [formScope, setFormScope] = useState<'store' | 'network' | 'brand_default'>('store')
  const [formStore, setFormStore] = useState('')
  const [formNetwork, setFormNetwork] = useState('')
  const [formStatus, setFormStatus] = useState<AssortmentStatus>('obrigatorio')
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')
  const [formMinFacings, setFormMinFacings] = useState('')
  const [formNotes, setFormNotes] = useState('')

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [mat, brs, sts, sk] = await Promise.all([
        getAssortmentMatrix(),
        getBrands(),
        getAllStores(),
        getSKUs(),
      ])
      setItems(mat)
      setBrands(brs)
      setStores(sts)
      setSkus(sk)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar matriz de sortimento',
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

  // Redes distintas cadastradas nas lojas
  const networks = useMemo(() => {
    const s = new Set<string>()
    for (const st of stores) {
      if (st.network) s.add(st.network.trim())
    }
    return Array.from(s).sort()
  }, [stores])

  // SKUs filtrados pela marca selecionada no formulário
  const availableSkusForBrand = useMemo(() => {
    if (!formBrand) return skus
    return skus.filter((s) => s.brand === formBrand)
  }, [skus, formBrand])

  const openCreateModal = () => {
    setEditingItem(null)
    setFormBrand(brands[0]?.id || '')
    setFormSku('')
    setFormScope('store')
    setFormStore(stores[0]?.id || '')
    setFormNetwork('')
    setFormStatus('obrigatorio')
    setFormStartDate(new Date().toISOString().slice(0, 10))
    setFormEndDate('')
    setFormMinFacings('')
    setFormNotes('')
    setModalOpen(true)
  }

  const openEditModal = (item: AssortmentMatrixItem) => {
    setEditingItem(item)
    setFormBrand(item.brand)
    setFormSku(item.sku)
    if (item.store) {
      setFormScope('store')
      setFormStore(item.store)
      setFormNetwork('')
    } else if (item.network) {
      setFormScope('network')
      setFormNetwork(item.network)
      setFormStore('')
    } else {
      setFormScope('brand_default')
      setFormStore('')
      setFormNetwork('')
    }
    setFormStatus(item.status)
    setFormStartDate(item.start_date ? item.start_date.slice(0, 10) : '')
    setFormEndDate(item.end_date ? item.end_date.slice(0, 10) : '')
    setFormMinFacings(item.min_facings ? String(item.min_facings) : '')
    setFormNotes(item.notes || '')
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formBrand || !formSku) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Selecione a marca e o SKU.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const payload: any = {
        brand: formBrand,
        sku: formSku,
        status: formStatus,
        start_date: formStartDate || null,
        end_date: formEndDate || null,
        min_facings: formMinFacings ? parseInt(formMinFacings, 10) : null,
        notes: formNotes || '',
      }

      if (formScope === 'store') {
        payload.store = formStore || null
        payload.network = ''
      } else if (formScope === 'network') {
        payload.store = null
        payload.network = formNetwork || ''
      } else {
        payload.store = null
        payload.network = ''
      }

      if (editingItem) {
        await updateAssortmentItem(editingItem.id, payload)
        toast({ title: 'Item atualizado com sucesso' })
      } else {
        await createAssortmentItem(payload)
        toast({ title: 'Item adicionado à matriz' })
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
    if (!window.confirm('Tem certeza que deseja excluir esta regra de sortimento?')) return
    try {
      await deleteAssortmentItem(id)
      toast({ title: 'Regra excluída' })
      setItems((prev) => prev.filter((it) => it.id !== id))
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  // Filtragem dos dados
  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchBrand = brandFilter === 'ALL' || item.brand === brandFilter
      const matchStore = storeFilter === 'ALL' || item.store === storeFilter
      const matchStatus = statusFilter === 'ALL' || item.status === statusFilter
      const matchNetwork =
        networkFilter === 'ALL' || (item.network && item.network.trim() === networkFilter)

      const skuName = item.expand?.sku?.name || ''
      const skuCode = item.expand?.sku?.code || ''
      const storeName = item.expand?.store?.name || ''
      const storeNum = item.expand?.store?.number || ''
      const term = search.toLowerCase()

      const matchSearch =
        !search ||
        skuName.toLowerCase().includes(term) ||
        skuCode.toLowerCase().includes(term) ||
        storeName.toLowerCase().includes(term) ||
        storeNum.toLowerCase().includes(term) ||
        (item.network || '').toLowerCase().includes(term)

      return matchBrand && matchStore && matchStatus && matchNetwork && matchSearch
    })
  }, [items, brandFilter, storeFilter, statusFilter, networkFilter, search])

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-6 w-6 text-indigo-600" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Matriz de Sortimento Esperado
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Define quais SKUs são obrigatórios, opcionais ou não trabalhados por Marca × Rede × Loja
            com vigência.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => navigate('/sortimento/import')}
            className="border-slate-300"
          >
            <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" />
            Importar Planilha
          </Button>
          <Button onClick={openCreateModal} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="mr-2 h-4 w-4" />
            Nova Regra
          </Button>
        </div>
      </div>

      {/* Cartões de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 font-medium">Total de Regras</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{items.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-emerald-600 font-medium">Obrigatórios</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">
              {items.filter((i) => i.status === 'obrigatorio').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-blue-600 font-medium">Opcionais</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">
              {items.filter((i) => i.status === 'opcional').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 font-medium">Não Trabalhados</p>
            <p className="text-2xl font-bold text-slate-700 mt-1">
              {items.filter((i) => i.status === 'nao_trabalhado').length}
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
              placeholder="Buscar SKU, loja ou rede..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 bg-white"
            />
          </div>

          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Marca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas as Marcas</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={networkFilter} onValueChange={setNetworkFilter}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Rede" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas as Redes</SelectItem>
              {networks.map((net) => (
                <SelectItem key={net} value={net}>
                  {net}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os Status</SelectItem>
              <SelectItem value="obrigatorio">Obrigatório</SelectItem>
              <SelectItem value="opcional">Opcional</SelectItem>
              <SelectItem value="nao_trabalhado">Não Trabalhado</SelectItem>
              <SelectItem value="aguardando_confirmacao">Aguardando Confirmação</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Tabela de itens */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-2" />
            Carregando matriz de sortimento...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Layers className="h-10 w-10 mx-auto text-slate-300 mb-2" />
            Nenhuma regra de sortimento encontrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Marca</th>
                  <th className="text-left font-semibold px-4 py-3">SKU</th>
                  <th className="text-left font-semibold px-4 py-3">Escopo (Loja / Rede)</th>
                  <th className="text-left font-semibold px-4 py-3">Status Esperado</th>
                  <th className="text-left font-semibold px-4 py-3">Vigência</th>
                  <th className="text-left font-semibold px-4 py-3">Observação</th>
                  <th className="text-right font-semibold px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => {
                  const sku = item.expand?.sku
                  const store = item.expand?.store
                  const brand = item.expand?.brand

                  let scopeBadge = (
                    <Badge variant="outline" className="bg-slate-50 text-slate-700">
                      Geral da Marca
                    </Badge>
                  )
                  if (store) {
                    scopeBadge = (
                      <span className="font-medium text-slate-900">
                        {store.number} — {store.name}
                      </span>
                    )
                  } else if (item.network) {
                    scopeBadge = (
                      <Badge
                        variant="outline"
                        className="bg-indigo-50 text-indigo-700 border-indigo-200"
                      >
                        Rede: {item.network}
                      </Badge>
                    )
                  }

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-medium text-slate-900">{brand?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{sku?.name || '—'}</div>
                        <div className="text-xs font-mono text-slate-400">{sku?.code}</div>
                      </td>
                      <td className="px-4 py-3">{scopeBadge}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`text-xs ${ASSORTMENT_STATUS_BADGE[item.status]}`}
                        >
                          {ASSORTMENT_STATUS_LABELS[item.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {item.start_date ? item.start_date.slice(0, 10) : 'Início livre'}
                        {' → '}
                        {item.end_date ? item.end_date.slice(0, 10) : 'Indeterminado'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">
                        {item.notes || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(item)}
                            className="h-8 w-8 text-slate-500 hover:text-indigo-600"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item.id)}
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

      {/* Modal de Criação / Edição */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Editar Regra de Sortimento' : 'Adicionar Regra de Sortimento'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div>
              <Label>Marca *</Label>
              <Select value={formBrand} onValueChange={setFormBrand}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione a marca" />
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

            <div>
              <Label>SKU / Produto *</Label>
              <Select value={formSku} onValueChange={setFormSku}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {availableSkusForBrand.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Escopo da Regra</Label>
              <Select value={formScope} onValueChange={(v: any) => setFormScope(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="store">Loja Específica (Exceção)</SelectItem>
                  <SelectItem value="network">Padrão por Rede / Bandeira</SelectItem>
                  <SelectItem value="brand_default">Padrão Geral da Marca</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formScope === 'store' && (
              <div>
                <Label>Loja</Label>
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
            )}

            {formScope === 'network' && (
              <div>
                <Label>Nome da Rede / Bandeira</Label>
                <Input
                  value={formNetwork}
                  onChange={(e) => setFormNetwork(e.target.value)}
                  placeholder="Ex: FORT ATACADISTA"
                  className="mt-1"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status do Sortimento *</Label>
                <Select
                  value={formStatus}
                  onValueChange={(v: AssortmentStatus) => setFormStatus(v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="obrigatorio">Obrigatório</SelectItem>
                    <SelectItem value="opcional">Opcional</SelectItem>
                    <SelectItem value="nao_trabalhado">Não Trabalhado</SelectItem>
                    <SelectItem value="aguardando_confirmacao">Aguardando Confirmação</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Frentes Mínimas (Facing)</Label>
                <Input
                  type="number"
                  min="0"
                  value={formMinFacings}
                  onChange={(e) => setFormMinFacings(e.target.value)}
                  placeholder="Opcional"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vigência Início</Label>
                <Input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Vigência Fim</Label>
                <Input
                  type="date"
                  value={formEndDate}
                  onChange={(e) => setFormEndDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Observação / Justificativa</Label>
              <Input
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Ex: Loja sem espaço no freezer / Negociação regional"
                className="mt-1"
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Regra
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
