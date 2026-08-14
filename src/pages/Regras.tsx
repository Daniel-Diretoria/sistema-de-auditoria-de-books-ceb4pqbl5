import React, { useEffect, useState } from 'react'
import {
  getAuditRules,
  createAuditRule,
  updateAuditRule,
  deleteAuditRule,
  getBrands,
} from '@/services/api'
import { AuditRule, Brand } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { Plus, Search, Edit2, Trash2, ClipboardList, Loader2 } from 'lucide-react'

export const Regras: React.FC = () => {
  const [rules, setRules] = useState<AuditRule[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState<string>('ALL')

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<AuditRule | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form states
  const [brandId, setBrandId] = useState('')
  const [title, setTitle] = useState('')
  const [criteria, setCriteria] = useState('')
  const [mandatoryLayout, setMandatoryLayout] = useState('')
  const [requiresSplash, setRequiresSplash] = useState(false)
  const [minFacings, setMinFacings] = useState(1)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [ruleToDelete, setRuleToDelete] = useState<AuditRule | null>(null)

  const { toast } = useToast()
  const { user } = useAuth()

  const isReadOnly = user?.role === 'supervisor' || user?.role === 'gestor'

  const loadData = async () => {
    try {
      setLoading(true)
      const [rList, bList] = await Promise.all([getAuditRules(), getBrands()])
      setRules(rList)
      setBrands(bList)
    } catch (err: any) {
      toast({ title: 'Erro ao carregar regras', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenDrawer = (rule?: AuditRule) => {
    if (rule) {
      setEditingRule(rule)
      setBrandId(rule.brand)
      setTitle(rule.title)
      setCriteria(rule.criteria || '')
      setMandatoryLayout(rule.mandatory_layout || '')
      setRequiresSplash(rule.requires_splash || false)
      setMinFacings(rule.min_facings || 1)
    } else {
      setEditingRule(null)
      setBrandId(brands[0]?.id || '')
      setTitle('')
      setCriteria('')
      setMandatoryLayout('')
      setRequiresSplash(false)
      setMinFacings(1)
    }
    setDrawerOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!brandId || !title) {
      toast({
        title: 'Atenção',
        description: 'Selecione a marca e informe o título da regra.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSubmitting(true)
      const payload = {
        brand: brandId,
        title,
        criteria,
        mandatory_layout: mandatoryLayout,
        requires_splash: requiresSplash,
        min_facings: minFacings,
      }

      if (editingRule) {
        await updateAuditRule(editingRule.id, payload)
        toast({ title: 'Sucesso', description: 'Regra atualizada com sucesso.' })
      } else {
        await createAuditRule(payload)
        toast({ title: 'Sucesso', description: 'Regra criada com sucesso.' })
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
    if (!ruleToDelete) return
    try {
      await deleteAuditRule(ruleToDelete.id)
      toast({ title: 'Sucesso', description: 'Regra excluída com sucesso.' })
      setDeleteDialogOpen(false)
      setRuleToDelete(null)
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    }
  }

  const filteredRules = rules.filter((rule) => {
    const matchSearch =
      rule.title.toLowerCase().includes(search.toLowerCase()) ||
      (rule.criteria && rule.criteria.toLowerCase().includes(search.toLowerCase()))
    const matchBrand = brandFilter === 'ALL' || rule.brand === brandFilter
    return matchSearch && matchBrand
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Regras de Auditoria</h1>
          <p className="text-sm text-slate-500">
            Critérios de exposição, frentes mínimas e sinalização obrigatória por marca.
          </p>
        </div>
        {!isReadOnly && (
          <Button onClick={() => handleOpenDrawer()} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="mr-2 h-4 w-4" />
            Nova Regra
          </Button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar regra por título ou critérios..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 bg-white"
          />
        </div>

        <Select value={brandFilter} onValueChange={setBrandFilter}>
          <SelectTrigger className="w-full sm:w-[220px] bg-white">
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

      {/* List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-2" />
          <p className="text-sm text-slate-500">Carregando regras de auditoria...</p>
        </div>
      ) : filteredRules.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">
          Nenhuma regra de auditoria encontrada.
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRules.map((rule) => {
            const brandObj = brands.find((b) => b.id === rule.brand)
            return (
              <Card key={rule.id} className="hover:shadow-md transition-shadow border-slate-200">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge
                          variant="outline"
                          className="bg-indigo-50 text-indigo-700 border-indigo-200"
                        >
                          {brandObj?.name || 'Marca Desconhecida'}
                        </Badge>
                        <h3 className="font-bold text-slate-900 text-lg">{rule.title}</h3>
                      </div>

                      <p className="text-sm text-slate-600 leading-relaxed">
                        {rule.criteria || 'Sem critérios cadastrados.'}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        {rule.mandatory_layout && (
                          <span className="text-xs bg-slate-100 text-slate-700 font-medium px-2.5 py-1 rounded-full">
                            Layout: {rule.mandatory_layout}
                          </span>
                        )}
                        {rule.requires_splash && (
                          <span className="text-xs bg-amber-100 text-amber-800 font-medium px-2.5 py-1 rounded-full">
                            Splash/Placa em Oferta Exigido
                          </span>
                        )}
                        <span className="text-xs bg-indigo-100 text-indigo-800 font-medium px-2.5 py-1 rounded-full">
                          Mínimo {rule.min_facings} {rule.min_facings === 1 ? 'frente' : 'frentes'}
                        </span>
                      </div>
                    </div>

                    {!isReadOnly && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDrawer(rule)}
                          className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setRuleToDelete(rule)
                            setDeleteDialogOpen(true)
                          }}
                          className="h-8 w-8 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
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
            <SheetTitle>{editingRule ? 'Editar Regra' : 'Nova Regra de Auditoria'}</SheetTitle>
            <SheetDescription>
              Defina as diretrizes para acompanhamento da execução do PDV em campo.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rule-brand">Marca *</Label>
              <Select value={brandId} onValueChange={setBrandId}>
                <SelectTrigger>
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

            <div className="space-y-1.5">
              <Label htmlFor="rule-title">Título da Regra *</Label>
              <Input
                id="rule-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Exposição Primária na Gôndola"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rule-crit">Critérios de Exposição</Label>
              <Textarea
                id="rule-crit"
                value={criteria}
                onChange={(e) => setCriteria(e.target.value)}
                placeholder="Descreva detalhadamente o padrão de exposição esperado..."
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rule-layout">Layout Obrigatório</Label>
              <Input
                id="rule-layout"
                value={mandatoryLayout}
                onChange={(e) => setMandatoryLayout(e.target.value)}
                placeholder="Ex: Gôndola principal, 2ª prateleira"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rule-facings">Quantidade Mínima de Frentes</Label>
              <Input
                id="rule-facings"
                type="number"
                min="1"
                value={minFacings}
                onChange={(e) => setMinFacings(parseInt(e.target.value) || 1)}
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="rule-splash"
                checked={requiresSplash}
                onCheckedChange={(c) => setRequiresSplash(!!c)}
              />
              <Label htmlFor="rule-splash" className="text-xs font-normal cursor-pointer">
                Exigir splash / placa promocional durante o período de oferta
              </Label>
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
                {editingRule ? 'Atualizar Regra' : 'Criar Regra'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Regra de Auditoria</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover a regra <strong>{ruleToDelete?.title}</strong>?
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
