import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import { getIntegrationByProvider, saveIntegration } from '@/services/api'
import pb from '@/lib/pocketbase/client'
import { Integration, IntegrationEnvironment } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Eye,
  EyeOff,
  Plug,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  Send,
  Loader2,
  RefreshCw,
  Info,
} from 'lucide-react'

export const Integracoes: React.FC = () => {
  const { toast } = useToast()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const [integration, setIntegration] = useState<Integration | null>(null)
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [environment, setEnvironment] = useState<IntegrationEnvironment>('producao')
  const [showApiKey, setShowApiKey] = useState(false)

  // Feedback do teste de conexão
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
    details?: string
  } | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const data = await getIntegrationByProvider('tradepro')
      if (data) {
        setIntegration(data)
        setBaseUrl(data.base_url || '')
        setApiKey(data.api_key || '')
        setEnvironment(data.environment || 'producao')
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar configurações',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const isConnected = !!(baseUrl.trim() && apiKey.trim())
      const saved = await saveIntegration({
        provider: 'tradepro',
        name: 'TradePRO',
        base_url: baseUrl.trim(),
        api_key: apiKey.trim(),
        environment,
        status: isConnected ? 'conectado' : 'nao_conectado',
        config_json: {
          description: 'Integração de dados de PDV, lojas, rotas e auditoria TradePRO',
          updated_by: 'Administrador',
          last_saved_at: new Date().toISOString(),
        },
      })
      setIntegration(saved)
      toast({
        title: 'Configurações salvas',
        description: 'Parâmetros da integração TradePRO atualizados com sucesso.',
      })
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

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)

    // Se chave ou URL não estiverem preenchidas
    if (!baseUrl.trim() || !apiKey.trim()) {
      setTimeout(() => {
        setTestResult({
          success: false,
          message:
            'A TradePRO não oferece API pública — a integração direta é contratada junto ao time comercial da plataforma.',
          details:
            'Cadastre a URL e o Token fornecidos pelo suporte TradePRO quando contratados, ou utilize o importador de planilhas Excel/CSV abaixo para processar os dados imediatamente.',
        })
        setTesting(false)
      }, 700)
      return
    }

    try {
      // Chama a rota do backend que testa a API TradePRO de verdade (servidor → servidor)
      const resp = await pb.send('/backend/v1/tradepro/test', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      setTestResult({
        success: !!resp.ok,
        message: resp.message || (resp.ok ? 'Conexão OK.' : 'Falha na conexão.'),
        details: resp.details || resp.raw || undefined,
      })
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Erro ao executar o teste de conexão.',
        details: err.message,
      })
    } finally {
      setTesting(false)
    }
  }

  const maskSecret = (key: string) => {
    if (!key) return 'Nenhuma chave cadastrada'
    if (key.length <= 8) return '••••••••'
    return `${key.slice(0, 3)}••••••••${key.slice(-3)}`
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <Plug className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            Integrações
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gerencie conexões de APIs de trade marketing, coleta de dados de campo e adaptadores de
            PDV.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="text-slate-600"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Recarregar
          </Button>
          <Button
            onClick={() => navigate('/integracoes/tradepro/import')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Importador TradePRO
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CARD PRINCIPAL: TRADEPRO */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center text-white font-black text-lg shadow-md shadow-indigo-600/20">
                    TP
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">
                        TradePRO
                      </CardTitle>
                      <a
                        href="https://tradepro.com.br"
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-normal"
                      >
                        tradepro.com.br
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <CardDescription className="text-xs text-slate-500 mt-0.5">
                      Plataforma de gestão de promotores de vendas, roteirização e auditoria em PDV.
                    </CardDescription>
                  </div>
                </div>

                <div className="text-right">
                  {integration?.status === 'conectado' ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                      Conectada
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-slate-100 text-slate-600 border-slate-200"
                    >
                      Não conectada
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              {/* Form de credenciais */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-indigo-600" />
                    Parâmetros da API
                  </h3>
                  <span className="text-xs text-slate-400">
                    Chave gravada com segurança no banco
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">URL Base da API</Label>
                    <Input
                      placeholder="https://api.tradepro.com.br/v1"
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      className="bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">Ambiente</Label>
                    <Select
                      value={environment}
                      onValueChange={(v: IntegrationEnvironment) => setEnvironment(v)}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="producao">Produção</SelectItem>
                        <SelectItem value="homologacao">Homologação / Staging</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium text-slate-700">
                      Chave de API / Token de Autenticação
                    </Label>
                    {apiKey && (
                      <span className="text-[11px] text-slate-400 font-mono">
                        Visualização mascarada: {maskSecret(apiKey)}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      placeholder="Ex: tp_live_sec_993882747183929..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="bg-white pr-10 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Ações: Salvar e Testar */}
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...
                      </>
                    ) : (
                      'Salvar Configurações'
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="border-slate-300 hover:bg-slate-50"
                  >
                    {testing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Testando conexão...
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5 mr-2 text-indigo-600" />
                        Testar Conexão
                      </>
                    )}
                  </Button>
                </div>

                {/* Feedback do teste */}
                {testResult && (
                  <div
                    className={`p-4 rounded-xl border text-sm space-y-1.5 transition-all animate-in fade-in ${
                      testResult.success
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-semibold">
                      {testResult.success ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                      )}
                      <span>{testResult.message}</span>
                    </div>
                    {testResult.details && (
                      <p className="text-xs opacity-90 pl-6 leading-relaxed">
                        {testResult.details}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* CARD DE ATALHO PARA O IMPORTADOR */}
          <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-white dark:from-indigo-950/20 dark:to-slate-900 border-2">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      Importação de arquivos e planilhas TradePRO
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
                    Enquanto a API direta estiver em processo de contratação, utilize o importador
                    dedicado. Ele detecta automaticamente planilhas de <strong>Lojas/Rotas</strong>,{' '}
                    <strong>Visitas/Fotos</strong> e <strong>Rupturas</strong>.
                  </p>
                </div>

                <Button
                  onClick={() => navigate('/integracoes/tradepro/import')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 shadow-sm"
                >
                  Abrir Importador
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SIDEBAR INFORMATIVA: COMO OBTER ACESSO */}
        <div className="space-y-6">
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-indigo-600" />
                Como obter acesso à API
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                A TradePRO não disponibiliza documentação aberta de API para autosserviço. Para
                conectar via sistema:
              </p>

              <ol className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
                <li className="flex gap-2.5">
                  <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    1
                  </span>
                  <div>
                    <strong className="block text-slate-900 dark:text-white">
                      Contate o time comercial
                    </strong>
                    Solicite ao gestor da conta TradePRO da sua empresa a liberação de credenciais
                    de API ou agendamento de integração técnica.
                  </div>
                </li>

                <li className="flex gap-2.5">
                  <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    2
                  </span>
                  <div>
                    <strong className="block text-slate-900 dark:text-white">
                      Obtenha a URL e a Chave
                    </strong>
                    O suporte TradePRO enviará os dados de acesso seguro (Token Bearer / API Key) e
                    o endereço de base da sua instância.
                  </div>
                </li>

                <li className="flex gap-2.5">
                  <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    3
                  </span>
                  <div>
                    <strong className="block text-slate-900 dark:text-white">
                      Cadastre e teste
                    </strong>
                    Insira as credenciais no formulário ao lado e clique em &quot;Testar
                    Conexão&quot; para validar a comunicação.
                  </div>
                </li>
              </ol>

              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                <Info className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                <span>
                  Em caso de dúvidas técnicas, envie as especificações recebidas da TradePRO ao time
                  de desenvolvimento do sistema.
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card de Formatos Aceitos */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-amber-600" />
                Formatos TradePRO aceitos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-3 text-xs text-slate-600 dark:text-slate-400">
              <div className="border-l-2 border-indigo-500 pl-3">
                <p className="font-semibold text-slate-900 dark:text-white">
                  1. Cadastro de PDVs / Rotas
                </p>
                <p className="text-[11px] text-slate-500">
                  Colunas de número de loja, nome fantasia, endereço, bandeira e promotores
                  responsáveis.
                </p>
              </div>

              <div className="border-l-2 border-emerald-500 pl-3">
                <p className="font-semibold text-slate-900 dark:text-white">
                  2. Relatório de Visitas & Fotos
                </p>
                <p className="text-[11px] text-slate-500">
                  Colunas de loja, data da visita, link ou nome da foto capturada em gôndola.
                </p>
              </div>

              <div className="border-l-2 border-amber-500 pl-3">
                <p className="font-semibold text-slate-900 dark:text-white">
                  3. Relatório de Ruptura
                </p>
                <p className="text-[11px] text-slate-500">
                  Colunas de loja, código/SKU, motivo de falta (total, parcial, zerado) e data.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
