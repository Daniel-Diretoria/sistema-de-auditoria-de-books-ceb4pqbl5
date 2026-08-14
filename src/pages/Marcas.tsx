import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  getAllStores,
  getUsers,
  getFileUrl,
} from '@/services/api'
import {
  Brand,
  Store,
  User,
  AuditFrequency,
  FREQUENCY_LABELS,
  FREQUENCY_BADGE_CLASSES,
} from '@/types'
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
  Tag,
  Loader2,
  Store as StoreIcon,
  ExternalLink,
} from 'lucide-react'

export const Marcas: React.FC = () => {
  const [brands, setBrands] = useState<Brand[]>([])
  const [allStores, setAllStores] = useState<Store[]>([])
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [freqFilter, setFreqFilter] = useState<string>('ALL')

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form states
  const [name, setName] = useState('')
  const [frequency, setFrequency] = useState<AuditFrequency>('diaria')
  const [selectedStores, setSelectedStores] = useState<string[]>([])
  const [selectedAnalysts, setSelectedAnalysts] = useState<string[]>([])
  const [selectedSupervisors, setSelectedSupervisors] = useState<string[]>([])
  const [logoFile, setLogoFile] = useState<File | null>(null)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [brandToDelete, setBrandToDelete] = useState<Brand | null>(null)

  const { toast } = useToast()
  const { user } = useAuth()
  const navigate = useNavigate()

  const isReadOnly = user?.role === 'supervisor' || user?.role === 'gestor'
  const isAdmin = user?.role === 'administrator'

  const loadData = async () => {
    try {
      setLoading(true)
      const [bList, stList] = await Promise.all([getBrands(), getAllStores()])
      setBrands(bList)
      setAllStores(stList)

      if (isAdmin) {
        const uList = await getUsers()
        setAllUsers(uList)
      }
    } catch (err: any) {
      toast({ title: 'Erro ao carregar marcas', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenDrawer = (b?: Brand) => {
    if (b) {
      setEditingBrand(b)
      setName(b.name)
      setFrequency(b.frequency)
      setSelectedStores(b.stores || [])
      setSelectedAnalysts(b.analysts || [])
      setSelectedSupervisors(b.supervisors || [])
    } else {
      setEditingBrand(null)
      setName('')
      setFrequency('diaria')
      setSelectedStores([])
      setSelectedAnalysts([])
      setSelectedSupervisors([])
    }
    setLogoFile(null)
    setDrawerOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !frequency) {
      toast({
        title: 'Atenção',
        description: 'Preencha o nome e a frequência.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSubmitting(true)
      const formData = new FormData()
      formData.append('name', name)
      formData.append('frequency', frequency)

      selectedStores.forEach((s) => formData.append('stores', s))
      selectedAnalysts.forEach((a) => formData.append('analysts', a))
      selectedSupervisors.forEach((s) => formData.append('supervisors', s))

      if (logoFile) {
        formData.append('logo', logoFile)
      }

      if (editingBrand) {
        await updateBrand(editingBrand.id, formData)
        toast({ title: 'Sucesso', description: 'Marca atualizada com sucesso.' })
      } else {
        await createBrand(formData)
        toast({ title: 'Sucesso', description: 'Marca criada com sucesso.' })
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
    if (!brandToDelete) return
    try {
      await deleteBrand(brandToDelete.id)
      toast({ title: 'Sucesso', description: 'Marca excluída com sucesso.' })
      setDeleteDialogOpen(false)
      setBrandToDelete(null)
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    }
  }

  const filteredBrands = brands.filter((b) => {
    const matchName = b.name.toLowerCase().includes(search.toLowerCase())
    const matchFreq = freqFilter === 'ALL' || b.frequency === freqFilter
    return matchName && matchFreq
  })

  const analystsOptions = allUsers.filter((u) => u.role === 'analista_books')
  const supervisorsOptions = allUsers.filter((u) => u.role === 'supervisor')

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Marcas Auditadas</h1>
          <p className="text-sm text-slate-500">
            Gerencie o portfólio de marcas, carteira de lojas e equipes responsáveis.
          </p>
        </div>
        {!isReadOnly && (
          <Button onClick={() => handleOpenDrawer()} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="mr-2 h-4 w-4" />
            Nova Marca
          </Button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar marca por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 bg-white"
          />
        </div>

        {isAdmin && (
          <Select value={freqFilter} onValueChange={setFreqFilter}>
            <SelectTrigger className="w-full sm:w-[220px] bg-white">
              <SelectValue placeholder="Todas as frequências" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas as frequências</SelectItem>
              <SelectItem value="diaria">Diária</SelectItem>
              <SelectItem value="seg_qua_sex">Seg / Qua / Sex</SelectItem>
              <SelectItem value="ter_qui_sab">Ter / Qui / Sáb</SelectItem>
              <SelectItem value="seg_qua_sex_sab">Seg / Qua / Sex / Sáb</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-2" />
          <p className="text-sm text-slate-500">Carregando marcas...</p>
        </div>
      ) : filteredBrands.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">
          Nenhuma marca encontrada com os filtros selecionados.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBrands.map((brand) => {
            const logoUrl = getFileUrl(brand, brand.logo)
            return (
              <Card
                key={brand.id}
                className="hover:shadow-md transition-all group flex flex-col justify-between border-slate-200"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={brand.name}
                          className="h-12 w-12 rounded-xl object-contain border border-slate-100 p-1 bg-white shrink-0"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-base shrink-0">
                          {brand.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">
                          {brand.name}
                        </h3>
                        <Badge
                          variant="outline"
                          className={`mt-1 text-[11px] ${FREQUENCY_BADGE_CLASSES[brand.frequency]}`}
                        >
                          {FREQUENCY_LABELS[brand.frequency]}
                        </Badge>
                      </div>
                    </div>

                    {!isReadOnly && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDrawer(brand)}
                          className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setBrandToDelete(brand)
                              setDeleteDialogOpen(true)
                            }}
                            className="h-8 w-8 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1.5 font-medium">
                      <StoreIcon className="h-4 w-4 text-slate-400" />
                      <span>{brand.stores?.length || 0} lojas em carteira</span>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/marcas/${brand.id}`)}
                      className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-semibold p-0 h-auto"
                    >
                      Acessar <ExternalLink className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Slide-over Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{editingBrand ? 'Editar Marca' : 'Nova Marca'}</SheetTitle>
            <SheetDescription>
              Preencha os dados da marca, cadastre a frequência de auditoria e associe a carteira.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="b-name">Nome da Marca *</Label>
              <Input
                id="b-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Café Santa Clara"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="b-logo">Logo da Marca</Label>
              <Input
                id="b-logo"
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="b-freq">Frequência de Auditoria *</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as AuditFrequency)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a frequência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diaria">Diária</SelectItem>
                  <SelectItem value="seg_qua_sex">Seg / Qua / Sex</SelectItem>
                  <SelectItem value="ter_qui_sab">Ter / Qui / Sáb</SelectItem>
                  <SelectItem value="seg_qua_sex_sab">Seg / Qua / Sex / Sáb</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Carteira de Lojas (Selecione as lojas que vendem a marca)</Label>
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
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-semibold text-slate-800">{st.number}</span>
                      <span className="truncate text-slate-600">{st.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            {isAdmin && (
              <>
                <div className="space-y-1.5">
                  <Label>Analistas Atribuídos</Label>
                  <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-white">
                    {analystsOptions.map((u) => {
                      const isChecked = selectedAnalysts.includes(u.id)
                      return (
                        <label
                          key={u.id}
                          className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded text-xs cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedAnalysts([...selectedAnalysts, u.id])
                              } else {
                                setSelectedAnalysts(selectedAnalysts.filter((id) => id !== u.id))
                              }
                            }}
                          />
                          <span className="font-semibold text-slate-800">{u.name}</span>
                          <span className="text-slate-400">({u.email})</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Supervisores Responsáveis</Label>
                  <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1 bg-white">
                    {supervisorsOptions.map((u) => {
                      const isChecked = selectedSupervisors.includes(u.id)
                      return (
                        <label
                          key={u.id}
                          className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded text-xs cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSupervisors([...selectedSupervisors, u.id])
                              } else {
                                setSelectedSupervisors(
                                  selectedSupervisors.filter((id) => id !== u.id),
                                )
                              }
                            }}
                          />
                          <span className="font-semibold text-slate-800">{u.name}</span>
                          <span className="text-slate-400">({u.email})</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </>
            )}

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
                {editingBrand ? 'Atualizar Marca' : 'Criar Marca'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Marca</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a marca <strong>{brandToDelete?.name}</strong>? Os SKUs
              e regras associados poderão ser afetados.
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
