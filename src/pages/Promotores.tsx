import React, { useEffect, useState } from 'react'
import {
  getPromoters,
  createPromoter,
  updatePromoter,
  deletePromoter,
  getBrands,
  getAllStores,
} from '@/services/api'
import { Promoter, Brand, Store } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  Users,
  Phone,
  Store as StoreIcon,
  Loader2,
} from 'lucide-react'

export const Promotores: React.FC = () => {
  const [promoters, setPromoters] = useState<Promoter[]>([])
  const [allBrands, setAllBrands] = useState<Brand[]>([])
  const [allStores, setAllStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingPromoter, setEditingPromoter] = useState<Promoter | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form states
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [selectedStores, setSelectedStores] = useState<string[]>([])

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [promoterToDelete, setPromoterToDelete] = useState<Promoter | null>(null)

  const { toast } = useToast()
  const { user } = useAuth()

  const isReadOnly = user?.role === 'supervisor' || user?.role === 'gestor'

  const loadData = async () => {
    try {
      setLoading(true)
      const [pList, bList, stList] = await Promise.all([
        getPromoters(),
        getBrands(),
        getAllStores(),
      ])
      setPromoters(pList)
      setAllBrands(bList)
      setAllStores(stList)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar promotores',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenDrawer = (pm?: Promoter) => {
    if (pm) {
      setEditingPromoter(pm)
      setName(pm.name)
      setPhone(pm.phone || '')
      setSelectedBrands(pm.brands || [])
      setSelectedStores(pm.stores || [])
    } else {
      setEditingPromoter(null)
      setName('')
      setPhone('')
      setSelectedBrands([])
      setSelectedStores([])
    }
    setDrawerOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name) {
      toast({
        title: 'Atenção',
        description: 'Preencha o nome completo do promotor.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSubmitting(true)
      const payload = {
        name,
        phone,
        brands: selectedBrands,
        stores: selectedStores,
      }

      if (editingPromoter) {
        await updatePromoter(editingPromoter.id, payload)
        toast({ title: 'Sucesso', description: 'Promotor atualizado com sucesso.' })
      } else {
        await createPromoter(payload)
        toast({ title: 'Sucesso', description: 'Promotor cadastrado com sucesso.' })
      }

      setDrawerOpen(false)
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!promoterToDelete) return
    try {
      await deletePromoter(promoterToDelete.id)
      toast({ title: 'Sucesso', description: 'Promotor excluído com sucesso.' })
      setDeleteDialogOpen(false)
      setPromoterToDelete(null)
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    }
  }

  const filteredPromoters = promoters.filter((pm) =>
    pm.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Promotores de Campo</h1>
          <p className="text-sm text-slate-500">
            Equipe de merchandising responsável pela execução de PDV e auditorias.
          </p>
        </div>
        {!isReadOnly && (
          <Button onClick={() => handleOpenDrawer()} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="mr-2 h-4 w-4" />
            Novo Promotor
          </Button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome do promotor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 bg-white"
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-2" />
          <p className="text-sm text-slate-500">Carregando promotores...</p>
        </div>
      ) : filteredPromoters.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">Nenhum promotor encontrado.</Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPromoters.map((pm) => {
            const brandsCount = pm.brands?.length || 0
            const storesCount = pm.stores?.length || 0

            return (
              <Card key={pm.id} className="hover:shadow-md transition-shadow border-slate-200">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-sm shrink-0">
                        {pm.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">{pm.name}</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3" /> {pm.phone || 'Sem telefone'}
                        </p>
                      </div>
                    </div>

                    {!isReadOnly && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDrawer(pm)}
                          className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setPromoterToDelete(pm)
                            setDeleteDialogOpen(true)
                          }}
                          className="h-8 w-8 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700">
                      {brandsCount} {brandsCount === 1 ? 'marca' : 'marcas'}
                    </Badge>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700">
                      {storesCount} {storesCount === 1 ? 'loja' : 'lojas'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{editingPromoter ? 'Editar Promotor' : 'Novo Promotor'}</SheetTitle>
            <SheetDescription>
              Cadastre o promotor e atribua os roteiros de marcas e lojas.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pm-name">Nome Completo *</Label>
              <Input
                id="pm-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Carlos Eduardo Santos"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pm-phone">Telefone de Contato</Label>
              <Input
                id="pm-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 98765-4321"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Marcas Atendidas</Label>
              <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-white">
                {allBrands.map((b) => {
                  const isChecked = selectedBrands.includes(b.id)
                  return (
                    <label
                      key={b.id}
                      className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded text-xs cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBrands([...selectedBrands, b.id])
                          } else {
                            setSelectedBrands(selectedBrands.filter((id) => id !== b.id))
                          }
                        }}
                      />
                      <span className="font-semibold text-slate-800">{b.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Lojas em Roteiro</Label>
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-white">
                {allStores.map((st) => {
                  const isChecked = selectedStores.includes(st.id)
                  return (
                    <label
                      key={st.id}
                      className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded text-xs cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStores([...selectedStores, st.id])
                          } else {
                            setSelectedStores(selectedStores.filter((id) => id !== st.id))
                          }
                        }}
                      />
                      <span className="font-semibold text-slate-800">{st.number}</span>
                      <span className="truncate text-slate-600">{st.name}</span>
                    </label>
                  )
                })}
              </div>
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
                {editingPromoter ? 'Atualizar Promotor' : 'Cadastrar Promotor'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Promotor</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover o promotor <strong>{promoterToDelete?.name}</strong>?
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
