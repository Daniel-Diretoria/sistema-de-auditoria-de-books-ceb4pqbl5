import React, { useEffect, useState } from 'react'
import {
  getSKUs,
  createSKU,
  updateSKU,
  deleteSKU,
  getBrands,
  getFileUrl,
  formatCurrency,
  formatDate,
} from '@/services/api'
import { SKU, Brand } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
import { Plus, Search, Edit2, Trash2, Package, Tag, Loader2, Sparkles } from 'lucide-react'

export const SKUs: React.FC = () => {
  const [skus, setSkus] = useState<SKU[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState<string>('ALL')
  const [onlyPromo, setOnlyPromo] = useState(false)

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingSKU, setEditingSKU] = useState<SKU | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form states
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [brandId, setBrandId] = useState('')
  const [normalPrice, setNormalPrice] = useState<number | ''>('')
  const [promoPrice, setPromoPrice] = useState<number | ''>('')
  const [promoStart, setPromoStart] = useState('')
  const [promoEnd, setPromoEnd] = useState('')
  const [mainGondola, setMainGondola] = useState(true)
  const [minQuantity, setMinQuantity] = useState(1)
  const [requiresSplash, setRequiresSplash] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [skuToDelete, setSkuToDelete] = useState<SKU | null>(null)

  const { toast } = useToast()
  const { user } = useAuth()

  const isReadOnly = user?.role === 'supervisor' || user?.role === 'gestor'

  const loadData = async () => {
    try {
      setLoading(true)
      const [skList, bList] = await Promise.all([getSKUs(), getBrands()])
      setSkus(skList)
      setBrands(bList)
    } catch (err: any) {
      toast({ title: 'Erro ao carregar SKUs', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenDrawer = (sku?: SKU) => {
    if (sku) {
      setEditingSKU(sku)
      setCode(sku.code)
      setName(sku.name)
      setBrandId(sku.brand)
      setNormalPrice(sku.normal_price)
      setPromoPrice(sku.promo_price || '')
      setPromoStart(sku.promo_start ? sku.promo_start.slice(0, 10) : '')
      setPromoEnd(sku.promo_end ? sku.promo_end.slice(0, 10) : '')
      setMainGondola(sku.main_gondola !== false)
      setMinQuantity(sku.min_quantity || 1)
      setRequiresSplash(sku.requires_splash || false)
    } else {
      setEditingSKU(null)
      setCode('')
      setName('')
      setBrandId(brands[0]?.id || '')
      setNormalPrice('')
      setPromoPrice('')
      setPromoStart('')
      setPromoEnd('')
      setMainGondola(true)
      setMinQuantity(1)
      setRequiresSplash(false)
    }
    setImageFile(null)
    setDrawerOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code || !name || !brandId || normalPrice === '') {
      toast({
        title: 'Atenção',
        description: 'Preencha código, nome, marca e preço normal.',
        variant: 'destructive',
      })
      return
    }

    try {
      setSubmitting(true)
      const formData = new FormData()
      formData.append('code', code)
      formData.append('name', name)
      formData.append('brand', brandId)
      formData.append('normal_price', String(normalPrice))

      if (promoPrice !== '') formData.append('promo_price', String(promoPrice))
      if (promoStart) formData.append('promo_start', promoStart)
      if (promoEnd) formData.append('promo_end', promoEnd)

      formData.append('main_gondola', String(mainGondola))
      formData.append('min_quantity', String(minQuantity))
      formData.append('requires_splash', String(requiresSplash))

      if (imageFile) formData.append('image', imageFile)

      if (editingSKU) {
        await updateSKU(editingSKU.id, formData)
        toast({ title: 'Sucesso', description: 'SKU atualizado com sucesso.' })
      } else {
        await createSKU(formData)
        toast({ title: 'Sucesso', description: 'SKU cadastrado com sucesso.' })
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
    if (!skuToDelete) return
    try {
      await deleteSKU(skuToDelete.id)
      toast({ title: 'Sucesso', description: 'SKU excluído com sucesso.' })
      setDeleteDialogOpen(false)
      setSkuToDelete(null)
      loadData()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    }
  }

  const filteredSKUs = skus.filter((sku) => {
    const matchSearch =
      sku.code.toLowerCase().includes(search.toLowerCase()) ||
      sku.name.toLowerCase().includes(search.toLowerCase())
    const matchBrand = brandFilter === 'ALL' || sku.brand === brandFilter
    const matchPromo = !onlyPromo || !!sku.promo_price
    return matchSearch && matchBrand && matchPromo
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Catálogo de SKUs</h1>
          <p className="text-sm text-slate-500">
            Cadastre os produtos, preços regulares, ofertas vigentes e regras de exposição.
          </p>
        </div>
        {!isReadOnly && (
          <Button onClick={() => handleOpenDrawer()} className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="mr-2 h-4 w-4" />
            Novo SKU
          </Button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por código ou nome do produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 bg-white"
          />
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto flex-wrap">
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

          <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-md border border-slate-200">
            <Switch id="promo-mode" checked={onlyPromo} onCheckedChange={setOnlyPromo} />
            <Label htmlFor="promo-mode" className="text-xs font-semibold cursor-pointer">
              Somente em promoção
            </Label>
          </div>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase">
                <th className="p-4">Código</th>
                <th className="p-4">Produto</th>
                <th className="p-4">Marca</th>
                <th className="p-4">Preço Normal</th>
                <th className="p-4">Preço Promocional</th>
                <th className="p-4">Regras de Exposição</th>
                {!isReadOnly && <th className="p-4 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Carregando SKUs...
                  </td>
                </tr>
              ) : filteredSKUs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              ) : (
                filteredSKUs.map((sku) => {
                  const brandObj = brands.find((b) => b.id === sku.brand)
                  const isPromo = !!sku.promo_price
                  return (
                    <tr key={sku.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-mono font-bold text-slate-900">{sku.code}</td>
                      <td className="p-4 font-semibold text-slate-900">{sku.name}</td>
                      <td className="p-4">
                        <Badge
                          variant="outline"
                          className="bg-indigo-50 text-indigo-700 border-indigo-200"
                        >
                          {brandObj?.name || 'Marca Desconhecida'}
                        </Badge>
                      </td>
                      <td className="p-4 font-mono font-medium text-slate-800">
                        {formatCurrency(sku.normal_price)}
                      </td>
                      <td className="p-4">
                        {isPromo ? (
                          <div className="flex flex-col">
                            <span className="font-mono font-bold text-emerald-600">
                              {formatCurrency(sku.promo_price!)}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Até {formatDate(sku.promo_end)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {sku.main_gondola && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] bg-indigo-50 text-indigo-700"
                            >
                              Gôndola Principal
                            </Badge>
                          )}
                          {sku.requires_splash && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] bg-amber-50 text-amber-700"
                            >
                              Splash
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px]">
                            Mín: {sku.min_quantity || 1}
                          </Badge>
                        </div>
                      </td>
                      {!isReadOnly && (
                        <td className="p-4 text-right space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDrawer(sku)}
                            className="h-8 w-8 text-slate-500 hover:text-indigo-600"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSkuToDelete(sku)
                              setDeleteDialogOpen(true)
                            }}
                            className="h-8 w-8 text-slate-500 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{editingSKU ? 'Editar SKU' : 'Novo SKU'}</SheetTitle>
            <SheetDescription>
              Cadastre e configure regras comerciais e de exposição do produto.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sku-code">Código do Produto * (Ex: SKU-001)</Label>
              <Input
                id="sku-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="SKU-001"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sku-name">Nome do Produto *</Label>
              <Input
                id="sku-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Café Moído Tradicional 500g"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sku-brand">Marca *</Label>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sku-nprice">Preço Normal (R$) *</Label>
                <Input
                  id="sku-nprice"
                  type="number"
                  step="0.01"
                  value={normalPrice}
                  onChange={(e) =>
                    setNormalPrice(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  placeholder="19.90"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sku-pprice">Preço Promocional (R$)</Label>
                <Input
                  id="sku-pprice"
                  type="number"
                  step="0.01"
                  value={promoPrice}
                  onChange={(e) =>
                    setPromoPrice(e.target.value === '' ? '' : parseFloat(e.target.value))
                  }
                  placeholder="14.90"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sku-pstart">Início da Oferta</Label>
                <Input
                  id="sku-pstart"
                  type="date"
                  value={promoStart}
                  onChange={(e) => setPromoStart(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sku-pend">Fim da Oferta</Label>
                <Input
                  id="sku-pend"
                  type="date"
                  value={promoEnd}
                  onChange={(e) => setPromoEnd(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100">
              <Label className="font-bold text-slate-900">Regras de Exposição na Gôndola</Label>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="main-gondola"
                  checked={mainGondola}
                  onCheckedChange={(c) => setMainGondola(!!c)}
                />
                <Label htmlFor="main-gondola" className="text-xs font-normal cursor-pointer">
                  Deve estar obrigatoriamente na gôndola principal
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="req-splash"
                  checked={requiresSplash}
                  onCheckedChange={(c) => setRequiresSplash(!!c)}
                />
                <Label htmlFor="req-splash" className="text-xs font-normal cursor-pointer">
                  Requer splash / placa promocional durante o período de oferta
                </Label>
              </div>

              <div className="space-y-1.5 pt-2">
                <Label htmlFor="min-qty" className="text-xs">
                  Quantidade mínima de frentes
                </Label>
                <Input
                  id="min-qty"
                  type="number"
                  min="1"
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(parseInt(e.target.value) || 1)}
                />
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
                {editingSKU ? 'Atualizar SKU' : 'Cadastrar SKU'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir SKU</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o produto <strong>{skuToDelete?.name}</strong>?
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
