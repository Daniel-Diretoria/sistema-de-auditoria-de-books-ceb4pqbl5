import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import {
  Tag,
  Store,
  Package,
  Users,
  UserCog,
  Plus,
  ArrowRight,
  Sparkles,
  ShieldAlert,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ROLE_LABELS,
  ROLE_BADGE_CLASSES,
  FREQUENCY_LABELS,
  FREQUENCY_BADGE_CLASSES,
  Brand,
  User,
} from '@/types'
import { getBrands, getUsers, getAllStores, getSKUs, getPromoters } from '@/services/api'

export const Dashboard: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [brands, setBrands] = useState<Brand[]>([])
  const [storesCount, setStoresCount] = useState(0)
  const [skusCount, setSkusCount] = useState(0)
  const [promotersCount, setPromotersCount] = useState(0)
  const [recentUsers, setRecentUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboardData() {
      if (!user) return
      try {
        setLoading(true)
        const [bData, stData, skData, pData] = await Promise.all([
          getBrands(),
          getAllStores(),
          getSKUs(),
          getPromoters(),
        ])

        setBrands(bData)
        setStoresCount(stData.length)
        setSkusCount(skData.length)
        setPromotersCount(pData.length)

        if (user.role === 'administrator') {
          const uData = await getUsers()
          setRecentUsers(uData.slice(0, 5))
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [user])

  if (!user) return null

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
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Olá, {user.name.split(' ')[0]} 👋
              </h1>
              <span
                className={`px-3 py-1 text-xs font-semibold rounded-full border ${ROLE_BADGE_CLASSES[user.role]}`}
              >
                {ROLE_LABELS[user.role]}
              </span>
            </div>
            <p className="text-indigo-200 text-sm capitalize">{todayFormatted}</p>
          </div>

          {(user.role === 'administrator' || user.role === 'analista_books') && (
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                onClick={() => navigate('/marcas')}
                className="bg-white text-indigo-900 hover:bg-indigo-50 font-semibold shadow-sm"
              >
                <Plus className="mr-2 h-4 w-4 text-indigo-600" />
                Nova Marca
              </Button>
              <Button
                onClick={() => navigate('/skus')}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo SKU
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Marcas
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {loading ? '—' : brands.length}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">Auditadas pelo sistema</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
              <Tag className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Lojas</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {loading ? '—' : storesCount}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">Cadastradas nas 5 regiões</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
              <Store className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                SKUs / Produtos
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {loading ? '—' : skusCount}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">Produtos em catálogo</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
              <Package className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Promotores
              </p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">
                {loading ? '—' : promotersCount}
              </h3>
              <p className="text-[11px] text-slate-400 mt-1">Atendendo em campo</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold shrink-0">
              <Users className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role-Aware Panel */}
      {user.role === 'administrator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Admin: Marcas Table Summary */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-bold text-slate-900">Resumo de Marcas</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/marcas')}
                className="text-indigo-600"
              >
                Ver todas <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-slate-100">
                {brands.slice(0, 6).map((brand) => (
                  <div
                    key={brand.id}
                    onClick={() => navigate(`/marcas/${brand.id}`)}
                    className="py-3 flex items-center justify-between hover:bg-slate-50/80 px-2 rounded-lg cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-xs">
                        {brand.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{brand.name}</p>
                        <p className="text-xs text-slate-500">
                          {brand.stores?.length || 0} lojas vinculadas
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[11px] ${FREQUENCY_BADGE_CLASSES[brand.frequency]}`}
                    >
                      {FREQUENCY_LABELS[brand.frequency]}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Admin: Recent Users */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-bold text-slate-900">
                Usuários Recentes
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/usuarios')}
                className="text-indigo-600"
              >
                Gerenciar <UserCog className="ml-1 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold">
                        {u.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900">{u.name}</p>
                        <p className="text-[11px] text-slate-500">{u.email}</p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border ${ROLE_BADGE_CLASSES[u.role]}`}
                    >
                      {ROLE_LABELS[u.role]}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {user.role === 'analista_books' && (
        <div className="space-y-6">
          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-indigo-600 shrink-0" />
            <p className="text-sm text-indigo-900">
              Você está visualizando as marcas e cadastros atribuídos ao seu perfil. Próxima etapa:
              submissão de books e relatórios de ruptura.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">Minhas Marcas Atribuídas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {brands.map((brand) => (
                  <div
                    key={brand.id}
                    onClick={() => navigate(`/marcas/${brand.id}`)}
                    className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all bg-white"
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="font-bold text-slate-900 text-base">{brand.name}</h4>
                      <Badge className={`text-[10px] ${FREQUENCY_BADGE_CLASSES[brand.frequency]}`}>
                        {FREQUENCY_LABELS[brand.frequency]}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      {brand.stores?.length || 0} lojas em carteira
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-4 text-xs font-semibold"
                    >
                      Acessar Detalhes
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {(user.role === 'supervisor' || user.role === 'gestor') && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold">
                {user.role === 'supervisor'
                  ? 'Marcas sob sua Supervisão'
                  : 'Todas as Marcas do Sistema'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {brands.map((brand) => (
                  <div
                    key={brand.id}
                    onClick={() => navigate(`/marcas/${brand.id}`)}
                    className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md cursor-pointer transition-all bg-white"
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="font-bold text-slate-900 text-base">{brand.name}</h4>
                      <Badge className={`text-[10px] ${FREQUENCY_BADGE_CLASSES[brand.frequency]}`}>
                        {FREQUENCY_LABELS[brand.frequency]}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      {brand.stores?.length || 0} lojas atendidas
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-4 text-xs font-semibold text-indigo-600"
                    >
                      Visualizar
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
