import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getBrandById,
  getSKUs,
  getAuditRules,
  getPromoters,
  getFileUrl,
  formatCurrency,
  formatDate,
} from '@/services/api'
import { Brand, SKU, AuditRule, Promoter, FREQUENCY_LABELS, FREQUENCY_BADGE_CLASSES } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft, Store, Package, ClipboardList, Users, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export const DetalheMarca: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [brand, setBrand] = useState<Brand | null>(null)
  const [skus, setSkus] = useState<SKU[]>([])
  const [rules, setRules] = useState<AuditRule[]>([])
  const [promoters, setPromoters] = useState<Promoter[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadBrandData() {
      if (!id) return
      try {
        setLoading(true)
        const brandData = await getBrandById(id)
        setBrand(brandData)

        const [skList, rList, pList] = await Promise.all([
          getSKUs(`brand = '${id}'`),
          getAuditRules(`brand = '${id}'`),
          getPromoters(`brands ~ '${id}'`),
        ])

        setSkus(skList)
        setRules(rList)
        setPromoters(pList)
      } catch (err: any) {
        toast({
          title: 'Erro ao carregar detalhes',
          description: 'Marca não encontrada ou sem permissão de acesso.',
          variant: 'destructive',
        })
        navigate('/marcas')
      } finally {
        setLoading(false)
      }
    }

    loadBrandData()
  }, [id])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!brand) return null

  const logoUrl = getFileUrl(brand, brand.logo)
  const stores = brand.expand?.stores || []

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={() => navigate('/marcas')}
        className="text-slate-600 hover:text-slate-900 font-medium pl-0"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar para Marcas
      </Button>

      {/* Brand Header */}
      <Card className="bg-white border-slate-200">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={brand.name}
                  className="h-16 w-16 rounded-xl object-contain border border-slate-100 p-1 bg-white shrink-0"
                />
              ) : (
                <div className="h-16 w-16 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-xl shrink-0">
                  {brand.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-slate-900">{brand.name}</h1>
                  <Badge className={`text-xs ${FREQUENCY_BADGE_CLASSES[brand.frequency]}`}>
                    {FREQUENCY_LABELS[brand.frequency]}
                  </Badge>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  ID: <code className="font-mono">{brand.id}</code>
                </p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-4 sm:gap-6 border-t sm:border-t-0 sm:border-l border-slate-100 pt-4 sm:pt-0 sm:pl-6 w-full sm:w-auto">
              <div className="text-center">
                <span className="text-xs font-semibold text-slate-400 uppercase">Lojas</span>
                <p className="text-xl font-bold text-slate-900">{stores.length}</p>
              </div>
              <div className="text-center">
                <span className="text-xs font-semibold text-slate-400 uppercase">SKUs</span>
                <p className="text-xl font-bold text-slate-900">{skus.length}</p>
              </div>
              <div className="text-center">
                <span className="text-xs font-semibold text-slate-400 uppercase">Regras</span>
                <p className="text-xl font-bold text-slate-900">{rules.length}</p>
              </div>
              <div className="text-center">
                <span className="text-xs font-semibold text-slate-400 uppercase">Promotores</span>
                <p className="text-xl font-bold text-slate-900">{promoters.length}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="lojas" className="w-full">
        <TabsList className="bg-white border border-slate-200 p-1 rounded-xl">
          <TabsTrigger value="lojas" className="gap-2">
            <Store className="h-4 w-4" /> Lojas Atendidas ({stores.length})
          </TabsTrigger>
          <TabsTrigger value="skus" className="gap-2">
            <Package className="h-4 w-4" /> SKUs ({skus.length})
          </TabsTrigger>
          <TabsTrigger value="regras" className="gap-2">
            <ClipboardList className="h-4 w-4" /> Regras ({rules.length})
          </TabsTrigger>
          <TabsTrigger value="promotores" className="gap-2">
            <Users className="h-4 w-4" /> Promotores ({promoters.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Lojas */}
        <TabsContent value="lojas" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase">
                    <th className="p-4">Número</th>
                    <th className="p-4">Nome da Loja</th>
                    <th className="p-4">Endereço</th>
                    <th className="p-4">Rede / Bandeira</th>
                    <th className="p-4">Região</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {stores.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        Nenhuma loja associada a esta marca.
                      </td>
                    </tr>
                  ) : (
                    stores.map((st) => (
                      <tr key={st.id} className="hover:bg-slate-50/80">
                        <td className="p-4 font-mono font-bold text-indigo-600">{st.number}</td>
                        <td className="p-4 font-semibold text-slate-900">{st.name}</td>
                        <td className="p-4 text-slate-600 max-w-xs truncate">{st.address}</td>
                        <td className="p-4 font-medium text-slate-800">{st.network}</td>
                        <td className="p-4">
                          <Badge variant="secondary" className="text-xs">
                            {st.region}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: SKUs */}
        <TabsContent value="skus" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase">
                    <th className="p-4">Código</th>
                    <th className="p-4">Produto</th>
                    <th className="p-4">Preço Normal</th>
                    <th className="p-4">Oferta Promocional</th>
                    <th className="p-4">Regras de Exposição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {skus.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        Nenhum SKU cadastrado para esta marca.
                      </td>
                    </tr>
                  ) : (
                    skus.map((sku) => {
                      const isPromo = !!sku.promo_price
                      return (
                        <tr key={sku.id} className="hover:bg-slate-50/80">
                          <td className="p-4 font-mono font-bold text-slate-900">{sku.code}</td>
                          <td className="p-4 font-semibold text-slate-900">{sku.name}</td>
                          <td className="p-4 font-mono font-medium text-slate-700">
                            {formatCurrency(sku.normal_price)}
                          </td>
                          <td className="p-4">
                            {isPromo ? (
                              <div className="flex flex-col">
                                <span className="font-mono font-bold text-emerald-600">
                                  {formatCurrency(sku.promo_price!)}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  Vigência: {formatDate(sku.promo_start)} até{' '}
                                  {formatDate(sku.promo_end)}
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
                                  variant="outline"
                                  className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200"
                                >
                                  Gôndola Principal
                                </Badge>
                              )}
                              {sku.requires_splash && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-amber-50 text-amber-700 border-amber-200"
                                >
                                  Splash Exigido
                                </Badge>
                              )}
                              <Badge
                                variant="outline"
                                className="text-[10px] bg-slate-50 text-slate-700"
                              >
                                Mín: {sku.min_quantity || 1} frentes
                              </Badge>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Regras */}
        <TabsContent value="regras" className="mt-4">
          <div className="space-y-4">
            {rules.length === 0 ? (
              <Card className="p-8 text-center text-slate-500">
                Nenhuma regra de auditoria cadastrada para esta marca.
              </Card>
            ) : (
              rules.map((rule) => (
                <Card key={rule.id} className="p-6 border-slate-200">
                  <h3 className="font-bold text-slate-900 text-lg mb-2">{rule.title}</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    {rule.criteria || 'Sem critérios descritos.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    {rule.mandatory_layout && (
                      <span className="text-xs bg-slate-100 text-slate-700 px-3 py-1 rounded-full font-medium">
                        Layout: {rule.mandatory_layout}
                      </span>
                    )}
                    {rule.requires_splash && (
                      <span className="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-medium">
                        Splash em Oferta Exigido
                      </span>
                    )}
                    <span className="text-xs bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full font-medium">
                      Qtd Mínima: {rule.min_facings} frentes
                    </span>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Tab 4: Promotores */}
        <TabsContent value="promotores" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {promoters.length === 0 ? (
              <Card className="col-span-2 p-8 text-center text-slate-500">
                Nenhum promotor atrelado a esta marca no momento.
              </Card>
            ) : (
              promoters.map((pm) => (
                <Card key={pm.id} className="p-4 border-slate-200">
                  <h4 className="font-bold text-slate-900">{pm.name}</h4>
                  <p className="text-xs text-slate-500 mt-1">{pm.phone || 'Sem telefone'}</p>
                  <p className="text-xs font-semibold text-indigo-600 mt-3">
                    Atende {pm.stores?.length || 0} lojas vinculadas
                  </p>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
