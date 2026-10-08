import React, { useEffect, useState } from 'react'
import { getStores, createStore, updateStore, deleteStore } from '@/services/api'
import { Store, Region } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Store as StoreIcon,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

export const Lojas: React.FC = () => {
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  // Filters
  const [search, setSearch] = useState('')
  const [regionFilter, setRegionFilter] = useState<string>('ALL')

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingStore, setEditingStore] = useState<Store | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form states
  const [number, setNumber] = useState('')
  const [apiIdentifier, setApiIdentifier] = useState('')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [network, setNetwork] = useState('')
  const [region, setRegion] = useState<Region>('Sudeste')

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [storeToDelete, setStoreToDelete] = useState<Store | null>(null)

  const { toast } = useToast()
  const { user } = useAuth()

  const isAdmin = user?.role === 'administrator'

  const loadData = async (currentPage = 1) => {
    try {
      setLoading(true)
      let filterStr = ''
      const filters = []
      if (search) {
        filters.push(`(name ~ '${search}' || number ~ '${search}' || network ~ '${search}')`)
      }
      if (regionFilter !== 'ALL') {
        filters.push(`region = '${regionFilter}'`)
      }
      if (filters.length > 0) {
        filterStr = filters.join(' && ')
      }

      const res = await getStores(filterStr, currentPage, 15)
      setStores(res.items)
      setTotalPages(res.totalPages)
      setTotalItems(res.totalItems)
      setPage(currentPage)
    } catch (err: any) {
      toast({ title: 'Erro ao carregar lojas', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(1)
  }, [search, regionFilter])

  const handleOpenDrawer = (st?: Store) => {
    if (st) {
      setEditingStore(st)
      setNumber(st.number)
      setApiIdentifier(st.api_identifier || '')
      setName(st.name)
      setAddress(st.address)
      setNetwork(st.network)
      setRegion(st.region)
    } else {
      setEditingStore(null)
      setNumber('')
      setApiIdentifier('')
      setName('')
      setAddress('')
      setNetwork('')
      setRegion('Sudeste')
    }
    setDrawerOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!number || !name || !address || !network || !region) {
      toast({
        title: 'Atenção',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSubmitting(true)
      const payload: any = { number, name, address, network, region, api_identifier: apiIdentifier }

      if (editingStore) {
        await updateStore(editingStore.id, payload)
        toast({ title: 'Sucesso', description: 'Loja atualizada com sucesso.' })
      } else {
        await createStore(payload)
        toast({ title: 'Sucesso', description: 'Loja cadastrada com sucesso.' })
      }

      setDrawerOpen(false)
      loadData(page)
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Verifique se o número da loja é único.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!storeToDelete) return
    try {
      await deleteStore(storeToDelete.id)
      toast({ title: 'Sucesso', description: 'Loja excluída com sucesso.' })
      setDeleteDialogOpen(false)
      setStoreToDelete(null)
      loadData(page)
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Lojas do Sistema</h1>
          <p className="text-sm text-slate-500">
            {totalItems} supermercados e atacadistas cadastrados no mapa de auditagem.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => handleOpenDrawer()} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="mr-2 h-4 w-4" />
            Nova Loja
          </Button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome, número ou rede..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 bg-white"
          />
        </div>

        <Select value={regionFilter} onValueChange={setRegionFilter}>
          <SelectTrigger className="w-full sm:w-[200px] bg-white">
            <SelectValue placeholder="Todas as regiões" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas as regiões</SelectItem>
            <SelectItem value="Sul">Sul</SelectItem>
            <SelectItem value="Sudeste">Sudeste</SelectItem>
            <SelectItem value="Centro-Oeste">Centro-Oeste</SelectItem>
            <SelectItem value="Nordeste">Nordeste</SelectItem>
            <SelectItem value="Norte">Norte</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase">
                <th className="p-4">Número Comercial</th>
                <th className="p-4">ID Oficial API (TradePRO)</th>
                <th className="p-4">Nome da Loja</th>
                <th className="p-4">Endereço Completo</th>
                <th className="p-4">Rede / Bandeira</th>
                <th className="p-4">Região</th>
                {isAdmin && <th className="p-4 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Carregando lojas...
                  </td>
                </tr>
              ) : stores.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    Nenhuma loja encontrada.
                  </td>
                </tr>
              ) : (
                stores.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-mono font-bold text-indigo-600">{st.number}</td>
                    <td className="p-4 font-mono text-xs text-slate-600">
                      {st.api_identifier ? (
                        <Badge
                          variant="outline"
                          className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]"
                        >
                          {st.api_identifier}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-4 font-semibold text-slate-900">{st.name}</td>
                    <td className="p-4 text-slate-600 max-w-sm truncate">{st.address}</td>
                    <td className="p-4 font-medium text-slate-800">{st.network}</td>
                    <td className="p-4">
                      <Badge variant="outline" className="bg-slate-50 text-slate-700">
                        {st.region}
                      </Badge>
                    </td>
                    {isAdmin && (
                      <td className="p-4 text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDrawer(st)}
                          className="h-8 w-8 text-slate-500 hover:text-indigo-600"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setStoreToDelete(st)
                            setDeleteDialogOpen(true)
                          }}
                          className="h-8 w-8 text-slate-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-500">
            Página {page} de {totalPages} ({totalItems} lojas no total)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => loadData(page - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => loadData(page + 1)}
            >
              Próxima <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{editingStore ? 'Editar Loja' : 'Nova Loja'}</SheetTitle>
            <SheetDescription>
              Cadastre um novo ponto de venda para inclusão nos roteiros de auditoria.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="st-num">Número Comercial * (Ex: 085)</Label>
              <Input
                id="st-num"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="085"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="st-api-id">Identificador Oficial TradePRO (API)</Label>
              <Input
                id="st-api-id"
                value={apiIdentifier}
                onChange={(e) => setApiIdentifier(e.target.value)}
                placeholder="Ex: TP-90518 ou ID oficial do sistema TradePRO"
              />
              <p className="text-[11px] text-slate-400">
                Utilizado para conciliação automatizada segura com a API do TradePRO.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="st-name">Nome da Loja *</Label>
              <Input
                id="st-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Pão de Açúcar Anália Franco"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="st-net">Rede / Bandeira *</Label>
              <Input
                id="st-net"
                value={network}
                onChange={(e) => setNetwork(e.target.value)}
                placeholder="Ex: Carrefour, Assaí, Pão de Açúcar"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="st-reg">Região *</Label>
              <Select value={region} onValueChange={(v) => setRegion(v as Region)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a região" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sul">Sul</SelectItem>
                  <SelectItem value="Sudeste">Sudeste</SelectItem>
                  <SelectItem value="Centro-Oeste">Centro-Oeste</SelectItem>
                  <SelectItem value="Nordeste">Nordeste</SelectItem>
                  <SelectItem value="Norte">Norte</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="st-addr">Endereço Completo *</Label>
              <Input
                id="st-addr"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Av. Exemplo, 100 - Bairro, Cidade - UF"
                required
              />
            </div>

            <SheetFooter className="pt-6">
              <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingStore ? 'Atualizar Loja' : 'Cadastrar Loja'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Loja</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover a loja <strong>{storeToDelete?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
