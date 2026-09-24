import React, { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { getBrands, getAllStores, getPromoters, getSKUs } from '@/services/api'
import { parseSpreadsheet } from '@/lib/spreadsheet'
import {
  TradeProExportType,
  TradeProDetectionResult,
  TRADEPRO_FIELDS_BY_TYPE,
  TRADEPRO_TYPE_LABELS,
  detectTradeProExportType,
  autoMapTradeProHeaders,
  processTradeProStores,
  processTradeProVisits,
  processTradeProRuptures,
  TradeProImportResult,
} from '@/lib/tradeproImport'
import { Brand, Store, Promoter, SKU } from '@/types'
import { Button } from '@/components/ui/button'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  Loader2,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Store as StoreIcon,
  Camera,
  AlertOctagon,
} from 'lucide-react'

type Step = 'upload' | 'mapping' | 'importing' | 'result'

export const ImportTradePro: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('upload')
  const [brands, setBrands] = useState<Brand[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [promoters, setPromoters] = useState<Promoter[]>([])
  const [skus, setSkus] = useState<SKU[]>([])

  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [parsed, setParsed] = useState<{ headers: string[]; rows: string[][] } | null>(null)

  // Tipo de exportação detectado ou escolhido
  const [detectedInfo, setDetectedInfo] = useState<TradeProDetectionResult | null>(null)
  const [exportType, setExportType] = useState<TradeProExportType>('stores_routes')
  const [mapping, setMapping] = useState<Record<string, string>>({})

  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<TradeProImportResult | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const [b, s, p] = await Promise.all([getBrands(), getAllStores(), getPromoters()])
        setBrands(b)
        setStores(s)
        setPromoters(p)
      } catch (err: any) {
        toast({
          title: 'Erro ao carregar dados base',
          description: err.message,
          variant: 'destructive',
        })
      }
    })()
  }, [])

  // Carregar SKUs quando a marca for selecionada
  useEffect(() => {
    if (!selectedBrandId) {
      setSkus([])
      return
    }
    ;(async () => {
      try {
        const list = await getSKUs(`brand = "${selectedBrandId}"`)
        setSkus(list)
      } catch {
        setSkus([])
      }
    })()
  }, [selectedBrandId])

  const selectedBrand = useMemo(
    () => brands.find((b) => b.id === selectedBrandId),
    [brands, selectedBrandId],
  )

  const brandStores = useMemo(() => {
    if (!selectedBrand) return stores
    const ids = new Set(selectedBrand.stores || [])
    return stores.filter((s) => ids.has(s.id))
  }, [selectedBrand, stores])

  const targetFields = useMemo(() => {
    return TRADEPRO_FIELDS_BY_TYPE[exportType] || []
  }, [exportType])

  const handleFile = async (f: File) => {
    const name = f.name.toLowerCase()
    if (!name.endsWith('.xlsx') && !name.endsWith('.csv') && !name.endsWith('.xlsm')) {
      toast({
        title: 'Formato inválido',
        description: 'Faça upload de um arquivo .xlsx ou .csv exportado do TradePRO.',
        variant: 'destructive',
      })
      return
    }

    setFile(f)
    try {
      const p = await parseSpreadsheet(f)
      if (p.headers.length === 0 || p.rows.length === 0) {
        toast({
          title: 'Arquivo sem registros',
          description: 'Nenhum cabeçalho ou linha de dados encontrada na planilha.',
          variant: 'destructive',
        })
        setFile(null)
        return
      }

      setParsed(p)

      // 1. Detectar tipo automaticamente
      const detection = detectTradeProExportType(p.headers)
      setDetectedInfo(detection)
      setExportType(detection.detectedType)

      // 2. Mapeamento automático inteligente
      const auto = autoMapTradeProHeaders(detection.detectedType, p.headers)
      setMapping(auto)

      setStep('mapping')
      toast({
        title: `Identificado: ${TRADEPRO_TYPE_LABELS[detection.detectedType]}`,
        description: detection.description,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao processar planilha',
        description: err.message,
        variant: 'destructive',
      })
      setFile(null)
    }
  }

  const handleTypeChange = (newType: TradeProExportType) => {
    setExportType(newType)
    if (parsed) {
      const auto = autoMapTradeProHeaders(newType, parsed.headers)
      setMapping(auto)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  const previewRows = useMemo(() => (parsed ? parsed.rows.slice(0, 5) : []), [parsed])

  const canImport = useMemo(() => {
    if (!parsed) return false

    // Se for visitas ou ruptura, requer marca selecionada
    if ((exportType === 'visits_photos' || exportType === 'rupture') && !selectedBrandId) {
      return false
    }

    // Checar campos obrigatórios mapeados
    const requiredFields = targetFields.filter((f) => f.required)
    return requiredFields.every((f) => !!mapping[f.key])
  }, [parsed, exportType, selectedBrandId, targetFields, mapping])

  const runImport = async () => {
    if (!parsed) return
    setImporting(true)
    setStep('importing')

    try {
      if (exportType === 'stores_routes') {
        const res = await processTradeProStores(
          parsed.rows,
          parsed.headers,
          mapping,
          stores,
          promoters,
          selectedBrand,
        )
        setResult(res)
        setStep('result')
        toast({
          title: 'Lojas e rotas importadas com sucesso!',
          description: `${res.createdCount} lojas cadastradas, ${res.updatedCount} atualizadas, ${res.ignoredCount} ignoradas.`,
        })
      } else if (exportType === 'visits_photos') {
        if (!selectedBrand || !user)
          throw new Error('Selecione uma marca para importar visitas/fotos.')
        const res = await processTradeProVisits(
          parsed.rows,
          parsed.headers,
          mapping,
          selectedBrand,
          brandStores,
          user.id,
        )
        setResult(res)
        setStep('result')
        toast({
          title: 'Auditoria de visitas TradePRO criada!',
          description: `${res.createdCount} fotos vinculadas. ${res.details?.identifiedCount || 0} lojas identificadas.`,
        })
      } else if (exportType === 'rupture') {
        if (!selectedBrand) throw new Error('Selecione uma marca para importar rupturas.')
        const res = await processTradeProRuptures(
          parsed.rows,
          parsed.headers,
          mapping,
          selectedBrand.id,
          brandStores,
          skus,
        )
        setResult({
          createdCount: res.created,
          updatedCount: 0,
          ignoredCount: res.ignored,
          errors: res.errors,
        })
        setStep('result')
        toast({
          title: 'Rupturas importadas com sucesso!',
          description: `${res.created} ocorrências cadastradas, ${res.ignored} ignoradas.`,
        })
      }
    } catch (err: any) {
      toast({
        title: 'Erro durante a importação',
        description: err.message,
        variant: 'destructive',
      })
      setStep('mapping')
    } finally {
      setImporting(false)
    }
  }

  const reset = () => {
    setFile(null)
    setParsed(null)
    setDetectedInfo(null)
    setMapping({})
    setResult(null)
    setStep('upload')
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/integracoes')}
            className="text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Importador de Dados TradePRO
              </h1>
              <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">
                Adaptador Dedicado
              </Badge>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Importação inteligente de relatórios exportados da TradePRO (Lojas, Fotos ou Ruptura).
            </p>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs">
        {['upload', 'mapping', 'result'].map((s, i) => {
          const idx = ['upload', 'mapping', 'importing', 'result'].indexOf(step)
          const active = idx >= ['upload', 'mapping', 'result'].indexOf(s)
          return (
            <React.Fragment key={s}>
              <span
                className={`px-3 py-1 rounded-full font-medium ${
                  active
                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                    : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                }`}
              >
                {i + 1}.{' '}
                {s === 'upload'
                  ? 'Upload do Arquivo'
                  : s === 'mapping'
                    ? 'Detecção & Mapeamento'
                    : 'Resultado'}
              </span>
              {i < 2 && <ArrowRight className="h-3 w-3 text-slate-300" />}
            </React.Fragment>
          )
        })}
      </div>

      {/* PASSO 1: UPLOAD */}
      {step === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 shadow-sm border-slate-200 dark:border-slate-800">
            <CardContent className="p-6 space-y-6">
              {/* Marca opcional/obrigatória dependendo do tipo */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    Marca vinculada
                  </Label>
                  <span className="text-xs text-slate-400">
                    Obrigatória para visitas/fotos e rupturas
                  </span>
                </div>
                <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                  <SelectTrigger className="bg-white dark:bg-slate-900">
                    <SelectValue placeholder="Selecione a marca (se aplicável)" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedBrand && (
                  <p className="text-xs text-slate-500">
                    {brandStores.length} lojas cadastradas · {skus.length} SKUs na carteira
                  </p>
                )}
              </div>

              {/* Upload Dropzone */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Arquivo Excel ou CSV da TradePRO *
                </Label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                    dragOver
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                      : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.csv,.xlsm"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <div className="h-12 w-12 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600">
                      <Upload className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      Clique para selecionar ou arraste a exportação TradePRO aqui
                    </p>
                    <p className="text-xs text-slate-400">
                      Suporta arquivos .xlsx e .csv de qualquer relatório da TradePRO
                    </p>
                  </div>
                </div>

                {file && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                    <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
                    <span className="text-sm font-medium text-slate-900 dark:text-white flex-1 truncate">
                      {file.name}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card explicativo dos 3 tipos de exportação suportados */}
          <Card className="shadow-sm border-slate-200 dark:border-slate-800">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-600" />
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Detecção Inteligente
                </h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                O adaptador analisa as colunas do seu arquivo e identifica automaticamente qual tipo
                de relatório TradePRO foi enviado:
              </p>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-indigo-900 dark:text-indigo-300">
                    <StoreIcon className="h-3.5 w-3.5 text-indigo-600" />
                    1. Lojas e Rotas
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                    Cadastra ou atualiza PDVs com endereço, bandeira e vincula os promotores
                    responsáveis pelo roteiro.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-900 dark:text-emerald-300">
                    <Camera className="h-3.5 w-3.5 text-emerald-600" />
                    2. Visitas e Fotos
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                    Cria uma auditoria completa compatível com a visão de Books, cruzando lojas
                    identificadas contra a carteira da marca.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-300">
                    <AlertOctagon className="h-3.5 w-3.5 text-amber-600" />
                    3. Ruptura de Estoque
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                    Aplica as regras de pontuação de ruptura total/parcial/zerado justificando
                    faltas em gôndola.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* PASSO 2: DETECÇÃO, TROCA MANUAL E MAPEAMENTO */}
      {(step === 'mapping' || step === 'importing') && parsed && (
        <div className="space-y-6">
          {/* Banner de detecção */}
          {detectedInfo && (
            <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/70 dark:bg-indigo-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase font-bold tracking-wider text-indigo-700 dark:text-indigo-300">
                      Formato Reconhecido
                    </span>
                    <Badge className="bg-indigo-600 text-white text-[10px]">
                      {Math.round(detectedInfo.confidence * 100)}% de confiança
                    </Badge>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {TRADEPRO_TYPE_LABELS[exportType]}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    {detectedInfo.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-slate-500">Mudar formato:</span>
                <Tabs
                  value={exportType}
                  onValueChange={(v) => handleTypeChange(v as TradeProExportType)}
                >
                  <TabsList className="bg-white dark:bg-slate-800 border">
                    <TabsTrigger value="stores_routes" className="text-xs">
                      Lojas
                    </TabsTrigger>
                    <TabsTrigger value="visits_photos" className="text-xs">
                      Visitas
                    </TabsTrigger>
                    <TabsTrigger value="rupture" className="text-xs">
                      Ruptura
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
          )}

          {/* Seleção de marca obrigatória para visitas/ruptura se ainda não selecionada */}
          {(exportType === 'visits_photos' || exportType === 'rupture') && (
            <Card className="border-amber-200 bg-amber-50/40 dark:bg-amber-950/10">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                      Marca requerida para este tipo de importação
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Selecione a marca cujas lojas e produtos correspondem a esta exportação
                      TradePRO.
                    </p>
                  </div>
                </div>

                <div className="w-full sm:w-64">
                  <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                    <SelectTrigger className="bg-white">
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
              </CardContent>
            </Card>
          )}

          {/* Card de Mapeamento de Colunas */}
          <Card className="shadow-sm border-slate-200 dark:border-slate-800">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    Mapeamento das Colunas da Planilha
                  </h3>
                  <p className="text-xs text-slate-500">
                    {parsed.rows.length} registros encontrados no arquivo &quot;{file?.name}&quot;
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const auto = autoMapTradeProHeaders(exportType, parsed.headers)
                    setMapping(auto)
                  }}
                  className="text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Redefinir Auto-mapeamento
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                {targetFields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300">
                      <span>
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </span>
                      {mapping[field.key] && (
                        <span className="text-[10px] text-emerald-600 font-semibold flex items-center">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-1" /> Mapeado
                        </span>
                      )}
                    </Label>
                    <Select
                      value={mapping[field.key] || '__none__'}
                      onValueChange={(v) =>
                        setMapping((prev) => ({
                          ...prev,
                          [field.key]: v === '__none__' ? '' : v,
                        }))
                      }
                    >
                      <SelectTrigger className="bg-white dark:bg-slate-900 text-xs">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Não mapear —</SelectItem>
                        {parsed.headers.map((h) => (
                          <SelectItem key={h} value={h} className="text-xs">
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pré-visualização dos dados */}
          <Card className="overflow-hidden p-0 shadow-sm border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                Pré-visualização da Exportação TradePRO (5 primeiras linhas)
              </h3>
              <span className="text-xs text-slate-400">Total: {parsed.rows.length} linhas</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700">
                  <tr>
                    <th className="text-left font-semibold px-3 py-2">#</th>
                    {parsed.headers.map((h) => (
                      <th key={h} className="text-left font-semibold px-3 py-2 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {previewRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                      {parsed.headers.map((h) => {
                        const idx = parsed.headers.indexOf(h)
                        return (
                          <td
                            key={h}
                            className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-xs truncate"
                          >
                            {r[idx] || '—'}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Botões de Ação */}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={reset}>
              Voltar / Trocar Arquivo
            </Button>
            <Button
              onClick={runImport}
              disabled={!canImport || importing}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm"
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando {parsed.rows.length}{' '}
                  registros...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" /> Importar {parsed.rows.length} registros
                  TradePRO
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* PASSO 3: RESULTADO DA IMPORTAÇÃO */}
      {step === 'result' && result && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20">
              <CardContent className="p-6 flex items-center gap-4">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                    {result.createdCount + result.updatedCount}
                  </p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    {exportType === 'stores_routes'
                      ? `${result.createdCount} novas / ${result.updatedCount} atualizadas`
                      : 'Processados com sucesso'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50/40 dark:bg-amber-950/20">
              <CardContent className="p-6 flex items-center gap-4">
                <XCircle className="h-10 w-10 text-amber-600 shrink-0" />
                <div>
                  <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                    {result.ignoredCount}
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-400">Linhas ignoradas</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800">
              <CardContent className="p-6 flex items-center gap-4">
                <FileSpreadsheet className="h-10 w-10 text-indigo-600 shrink-0" />
                <div>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {result.createdCount + result.updatedCount + result.ignoredCount}
                  </p>
                  <p className="text-sm text-slate-500">Total de linhas avaliadas</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detalhes extras se for Visitas / Fotos */}
          {result.details?.bookId && (
            <Card className="border-indigo-200 bg-indigo-50/40 dark:bg-indigo-950/20">
              <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-indigo-950 dark:text-indigo-200">
                    Auditoria TradePRO gerada: {result.details.bookTitle}
                  </h3>
                  <p className="text-xs text-indigo-800 dark:text-indigo-300 mt-0.5">
                    {result.details.identifiedCount} lojas identificadas com sucesso ·{' '}
                    {result.details.pendingCount} pendentes de confirmação ·{' '}
                    {result.details.missingStoresCount} ausentes na carteira da marca.
                  </p>
                </div>
                <Button
                  onClick={() => navigate(`/books/${result.details?.bookId}`)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                >
                  Abrir Detalhe do Book
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Tabela de erros/linhas ignoradas */}
          {result.errors.length > 0 && (
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    Registros ignorados ({result.errors.length})
                  </h3>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700">
                      <tr>
                        <th className="text-left font-semibold px-3 py-2">Linha</th>
                        <th className="text-left font-semibold px-3 py-2">Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {result.errors.map((e, i) => (
                        <tr key={i} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-300 font-mono">
                            {e.row}
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                            {e.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ações pós-importação */}
          <div className="flex flex-wrap gap-3">
            {exportType === 'stores_routes' && (
              <Button
                onClick={() => navigate('/lojas')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Ver Lista de Lojas
              </Button>
            )}
            {exportType === 'visits_photos' && (
              <Button
                onClick={() => navigate('/books')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Ver Lista de Books
              </Button>
            )}
            {exportType === 'rupture' && (
              <Button
                onClick={() => navigate('/ruptura')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Ver Relatórios de Ruptura
              </Button>
            )}
            <Button variant="outline" onClick={reset}>
              Importar Outro Arquivo TradePRO
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
