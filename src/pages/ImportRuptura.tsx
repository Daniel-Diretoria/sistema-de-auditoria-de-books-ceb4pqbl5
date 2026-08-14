import React, { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import { getBrands, getAllStores, getSKUs } from '@/services/api'
import { batchImportRuptures, RuptureImportRow, RuptureImportResult } from '@/services/scoringApi'
import { parseSpreadsheet } from '@/lib/spreadsheet'
import { Brand, Store, SKU } from '@/types'
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
  ArrowLeft,
  Loader2,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
} from 'lucide-react'

type Step = 'upload' | 'mapping' | 'importing' | 'result'

const TARGET_FIELDS = [
  { key: 'storeRef', label: 'Loja (número ou nome)', required: true },
  { key: 'skuRef', label: 'SKU / Código do produto', required: true },
  { key: 'motive', label: 'Motivo da ruptura', required: true },
  { key: 'date', label: 'Data', required: true },
  { key: 'observation', label: 'Observação', required: false },
] as const

export const ImportRuptura: React.FC = () => {
  const { toast } = useToast()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('upload')
  const [brands, setBrands] = useState<Brand[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [skus, setSkus] = useState<SKU[]>([])

  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [parsed, setParsed] = useState<{ headers: string[]; rows: string[][] } | null>(null)

  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<RuptureImportResult | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const [b, s] = await Promise.all([getBrands(), getAllStores()])
        setBrands(b)
        setStores(s)
      } catch (err: any) {
        toast({ title: 'Erro ao carregar dados', description: err.message, variant: 'destructive' })
      }
    })()
  }, [])

  // Load SKUs when brand changes
  useEffect(() => {
    if (!selectedBrandId) {
      setSkus([])
      return
    }
    ;(async () => {
      try {
        const s = await getSKUs(`brand = "${selectedBrandId}"`)
        setSkus(s)
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

  const handleFile = async (f: File) => {
    const name = f.name.toLowerCase()
    if (!name.endsWith('.xlsx') && !name.endsWith('.csv') && !name.endsWith('.xlsm')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Selecione um arquivo .xlsx ou .csv.',
        variant: 'destructive',
      })
      return
    }
    setFile(f)
    try {
      const p = await parseSpreadsheet(f)
      if (p.headers.length === 0 || p.rows.length === 0) {
        toast({
          title: 'Arquivo vazio',
          description: 'Nenhuma linha de dados encontrada.',
          variant: 'destructive',
        })
        setFile(null)
        return
      }
      setParsed(p)
      // Auto-map by header name similarity
      const auto: Record<string, string> = {}
      const lowerHeaders = p.headers.map((h) => h.toLowerCase())
      for (const field of TARGET_FIELDS) {
        const match = lowerHeaders.findIndex((h) => {
          if (field.key === 'storeRef')
            return h.includes('loja') || h.includes('store') || h.includes('numero')
          if (field.key === 'skuRef')
            return (
              h.includes('sku') ||
              h.includes('codigo') ||
              h.includes('produto') ||
              h.includes('code')
            )
          if (field.key === 'motive')
            return h.includes('motiv') || h.includes('tipo') || h.includes('ruptura')
          if (field.key === 'date') return h.includes('data') || h.includes('date')
          if (field.key === 'observation')
            return h.includes('obs') || h.includes('nota') || h.includes('coment')
          return false
        })
        if (match >= 0) auto[field.key] = p.headers[match]
      }
      setMapping(auto)
      setStep('mapping')
    } catch (err: any) {
      toast({ title: 'Erro ao ler arquivo', description: err.message, variant: 'destructive' })
      setFile(null)
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
    return (
      !!selectedBrandId && TARGET_FIELDS.filter((f) => f.required).every((f) => !!mapping[f.key])
    )
  }, [selectedBrandId, mapping])

  const runImport = async () => {
    if (!parsed || !selectedBrandId) return
    setImporting(true)
    setStep('importing')
    try {
      const rows: RuptureImportRow[] = parsed.rows.map((r) => {
        const getVal = (key: string) => {
          const header = mapping[key]
          if (!header) return ''
          const idx = parsed.headers.indexOf(header)
          return idx >= 0 ? (r[idx] || '').trim() : ''
        }
        return {
          storeRef: getVal('storeRef'),
          skuRef: getVal('skuRef'),
          motive: getVal('motive'),
          date: getVal('date'),
          observation: getVal('observation'),
        }
      })
      const res = await batchImportRuptures(selectedBrandId, rows, brandStores, skus)
      setResult(res)
      setStep('result')
      toast({
        title: 'Importação concluída',
        description: `${res.created} registros importados, ${res.ignored} ignorados.`,
      })
    } catch (err: any) {
      toast({ title: 'Erro na importação', description: err.message, variant: 'destructive' })
      setStep('mapping')
    } finally {
      setImporting(false)
    }
  }

  const reset = () => {
    setFile(null)
    setParsed(null)
    setMapping({})
    setResult(null)
    setStep('upload')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/ruptura')}
            className="text-slate-500"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Importar Ruptura</h1>
            <p className="text-sm text-slate-500">
              Faça upload de um arquivo Excel/CSV com os relatórios de ruptura.
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
                className={`px-2 py-1 rounded-full ${
                  active ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {i + 1}. {s === 'upload' ? 'Upload' : s === 'mapping' ? 'Mapeamento' : 'Resultado'}
              </span>
              {i < 2 && <ArrowRight className="h-3 w-3 text-slate-300" />}
            </React.Fragment>
          )
        })}
      </div>

      {/* STEP 1: UPLOAD */}
      {step === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardContent className="p-6 space-y-5">
              <div className="space-y-1.5">
                <Label>Marca *</Label>
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
                {selectedBrand && (
                  <p className="text-xs text-slate-500">
                    {brandStores.length} lojas · {skus.length} SKUs na carteira
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Arquivo Excel/CSV *</Label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    dragOver
                      ? 'border-indigo-500 bg-indigo-50/50'
                      : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
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
                    <Upload className="h-8 w-8 text-slate-400" />
                    <p className="text-sm font-medium text-slate-700">
                      Arraste o arquivo aqui ou clique para selecionar
                    </p>
                    <p className="text-xs text-slate-400">Formatos: .xlsx, .csv</p>
                  </div>
                </div>
                {file && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
                    <span className="text-sm font-medium text-slate-900 flex-1 truncate">
                      {file.name}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-3">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Como funciona
              </h3>
              <ol className="space-y-3 text-sm text-slate-600">
                <li className="flex gap-2">
                  <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span>Selecione a marca e faça upload do arquivo.</span>
                </li>
                <li className="flex gap-2">
                  <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span>Mapieie as colunas do arquivo aos campos do sistema.</span>
                </li>
                <li className="flex gap-2">
                  <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span>O sistema valida loja e SKU e importa os registros.</span>
                </li>
                <li className="flex gap-2">
                  <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                    4
                  </span>
                  <span>Veja o resumo: importados, ignorados e erros.</span>
                </li>
              </ol>
              <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs font-semibold text-slate-600 mb-1">Colunas esperadas</p>
                <p className="text-xs text-slate-500">
                  Loja (número/nome), SKU (código), Motivo, Data, Observação
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* STEP 2: MAPPING */}
      {(step === 'mapping' || step === 'importing') && parsed && (
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
                <div>
                  <h3 className="font-semibold text-slate-900">{file?.name}</h3>
                  <p className="text-xs text-slate-500">
                    {parsed.rows.length} linhas · {parsed.headers.length} colunas
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TARGET_FIELDS.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      {field.label}
                      {field.required && <span className="text-red-500">*</span>}
                    </Label>
                    <Select
                      value={mapping[field.key] || '__none__'}
                      onValueChange={(v) =>
                        setMapping((prev) => ({ ...prev, [field.key]: v === '__none__' ? '' : v }))
                      }
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder="Selecione a coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Não mapear —</SelectItem>
                        {parsed.headers.map((h) => (
                          <SelectItem key={h} value={h}>
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

          {/* Preview */}
          <Card className="overflow-hidden p-0">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">
                Pré-visualização (5 primeiras linhas)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="text-left font-semibold px-3 py-2">#</th>
                    {parsed.headers.map((h) => (
                      <th key={h} className="text-left font-semibold px-3 py-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                      {parsed.headers.map((h) => {
                        const idx = parsed.headers.indexOf(h)
                        return (
                          <td key={h} className="px-3 py-2 text-slate-700 max-w-xs truncate">
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

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={reset}>
              Cancelar
            </Button>
            <Button
              onClick={runImport}
              disabled={!canImport || importing}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" /> Importar {parsed.rows.length} registros
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: RESULT */}
      {step === 'result' && result && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-emerald-200 bg-emerald-50/40">
              <CardContent className="p-6 flex items-center gap-4">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                <div>
                  <p className="text-3xl font-bold text-emerald-700">{result.created}</p>
                  <p className="text-sm text-emerald-700">Importados com sucesso</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50/40">
              <CardContent className="p-6 flex items-center gap-4">
                <XCircle className="h-10 w-10 text-amber-600" />
                <div>
                  <p className="text-3xl font-bold text-amber-700">{result.ignored}</p>
                  <p className="text-sm text-amber-700">Ignorados</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6 flex items-center gap-4">
                <FileSpreadsheet className="h-10 w-10 text-indigo-600" />
                <div>
                  <p className="text-3xl font-bold text-slate-900">
                    {result.created + result.ignored}
                  </p>
                  <p className="text-sm text-slate-500">Total de linhas</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {result.errors.length > 0 && (
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <h3 className="font-semibold text-slate-900">
                    Linhas ignoradas ({result.errors.length})
                  </h3>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="text-left font-semibold px-3 py-2">Linha</th>
                        <th className="text-left font-semibold px-3 py-2">Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.errors.map((e, i) => (
                        <tr key={i} className="hover:bg-slate-50/70">
                          <td className="px-3 py-2 text-slate-700">{e.row}</td>
                          <td className="px-3 py-2 text-slate-600">{e.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => navigate('/ruptura')}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Ver lista de rupturas
            </Button>
            <Button variant="outline" onClick={reset}>
              Importar outro arquivo
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
