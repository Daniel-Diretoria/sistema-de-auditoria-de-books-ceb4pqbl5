import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import {
  getBrands,
  getSKUs,
  createPriceTable,
  updatePriceTable,
  deletePriceTable,
  getPriceTables,
} from '@/services/api'
import { parseSpreadsheet } from '@/lib/spreadsheet'
import { normalizeText } from '@/lib/pptx'
import { Brand, SKU, PriceTable } from '@/types'
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
import {
  ArrowLeft,
  Loader2,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Trash2,
  RefreshCw,
} from 'lucide-react'

type Step = 'upload' | 'mapping' | 'result'

const PRICE_FIELDS = [
  { key: 'sku', label: 'Produto (código ou nome)', required: true },
  { key: 'rede', label: 'Rede / Bandeira', required: true },
  { key: 'secao', label: 'Seção (opcional)', required: false },
  { key: 'preco', label: 'Preço', required: true },
] as const

export const ImportPrecos: React.FC = () => {
  const { toast } = useToast()
  const navigate = useNavigate()

  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [skus, setSkus] = useState<SKU[]>([])
  const [existing, setExisting] = useState<PriceTable[]>([])

  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [parsed, setParsed] = useState<{ headers: string[]; rows: string[][] } | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})

  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{
    created: string[]
    updated: string[]
    ignored: { row: number; reason: string }[]
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const b = await getBrands()
        setBrands(b)
      } catch (err: any) {
        toast({
          title: 'Erro ao carregar marcas',
          description: err.message,
          variant: 'destructive',
        })
      }
    })()
  }, [])

  useEffect(() => {
    if (!selectedBrandId) {
      setSkus([])
      setExisting([])
      return
    }
    ;(async () => {
      try {
        const [skuList, priceList] = await Promise.all([
          getSKUs(`brand = "${selectedBrandId}"`),
          getPriceTables(`brand = "${selectedBrandId}"`),
        ])
        setSkus(skuList)
        setExisting(priceList)
      } catch {
        setSkus([])
        setExisting([])
      }
    })()
  }, [selectedBrandId])

  const selectedBrand = useMemo(
    () => brands.find((b) => b.id === selectedBrandId),
    [brands, selectedBrandId],
  )

  // Mapa SKU: código normalizado + nome normalizado → SKU
  const skuByCode = useMemo(() => {
    const m = new Map<string, SKU>()
    for (const s of skus) {
      m.set(normalizeText(s.code), s)
      m.set(normalizeText(s.name), s)
    }
    return m
  }, [skus])

  const handleFile = async (f: File) => {
    const name = f.name.toLowerCase()
    if (!name.endsWith('.xlsx') && !name.endsWith('.csv') && !name.endsWith('.xlsm')) {
      toast({
        title: 'Formato inválido',
        description: 'Envie um arquivo .xlsx ou .csv com a tabela de preços.',
        variant: 'destructive',
      })
      return
    }
    setFile(f)
    try {
      const p = await parseSpreadsheet(f)
      if (!p.headers.length || !p.rows.length) {
        toast({
          title: 'Arquivo sem registros',
          description: 'Nenhuma linha de dados encontrada.',
          variant: 'destructive',
        })
        setFile(null)
        return
      }
      setParsed(p)
      setMapping(autoMapPriceHeaders(p.headers))
      setStep('mapping')
      toast({
        title: 'Planilha lida',
        description: `${p.rows.length} linhas encontradas. Confira o mapeamento.`,
      })
    } catch (err: any) {
      toast({ title: 'Erro ao ler planilha', description: err.message, variant: 'destructive' })
      setFile(null)
    }
  }

  function autoMapPriceHeaders(headers: string[]): Record<string, string> {
    const lower = headers.map((h) => normalizeText(h))
    const mapping: Record<string, string> = {}
    const mapField = (field: string, keys: string[]) => {
      const idx = lower.findIndex((h) => keys.some((k) => h.includes(k)))
      if (idx >= 0) mapping[field] = headers[idx]
    }
    mapField('sku', ['sku', 'codigo', 'ean', 'produto', 'barras'])
    mapField('rede', ['rede', 'bandeira', 'cliente', 'loja'])
    mapField('secao', ['secao', 'categoria', 'setor', 'departamento'])
    mapField('preco', ['preco', 'preço', 'valor', 'r$', 'venda'])
    return mapping
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  const canImport = useMemo(() => {
    if (!parsed || !selectedBrandId) return false
    return PRICE_FIELDS.filter((f) => f.required).every((f) => !!mapping[f.key])
  }, [parsed, selectedBrandId, mapping])

  const runImport = async () => {
    if (!parsed || !selectedBrand) return
    setImporting(true)
    try {
      const created: string[] = []
      const updated: string[] = []
      const ignored: { row: number; reason: string }[] = []

      const getVal = (r: string[], key: string): string => {
        const col = mapping[key]
        if (!col) return ''
        const idx = parsed.headers.indexOf(col)
        return idx >= 0 ? (r[idx] || '').trim() : ''
      }

      for (let i = 0; i < parsed.rows.length; i++) {
        const r = parsed.rows[i]
        const rowNum = i + 2
        const skuRef = getVal(r, 'sku')
        const rede = getVal(r, 'rede')
        const secao = getVal(r, 'secao')
        const precoRaw = getVal(r, 'preco')

        if (!skuRef || !rede || !precoRaw) {
          ignored.push({ row: rowNum, reason: 'Linha sem produto, rede ou preço.' })
          continue
        }

        const sku = skuByCode.get(normalizeText(skuRef))
        if (!sku) {
          ignored.push({ row: rowNum, reason: `Produto não encontrado no cadastro: "${skuRef}"` })
          continue
        }

        const preco = parseFloat(precoRaw.replace(/[R$\s.]/g, '').replace(',', '.'))
        if (isNaN(preco) || preco <= 0) {
          ignored.push({ row: rowNum, reason: `Preço inválido: "${precoRaw}"` })
          continue
        }

        // Busca existente (brand+sku+rede+secao) para atualizar em vez de duplicar
        const key = `${selectedBrand.id}|${sku.id}|${normalizeText(rede)}|${normalizeText(secao)}`
        const prev = existing.find(
          (e) =>
            e.brand === selectedBrand.id &&
            e.sku === sku.id &&
            normalizeText(e.rede) === normalizeText(rede) &&
            normalizeText(e.secao || '') === normalizeText(secao || ''),
        )
        try {
          if (prev) {
            await updatePriceTable(prev.id, {
              preco,
              rede,
              secao: secao || '',
            })
            updated.push(`${sku.code} @ ${rede}`)
          } else {
            await createPriceTable({
              brand: selectedBrand.id,
              sku: sku.id,
              rede,
              secao: secao || '',
              preco,
            })
            created.push(`${sku.code} @ ${rede}`)
          }
        } catch (err: any) {
          ignored.push({ row: rowNum, reason: `Erro ao salvar: ${err.message}` })
        }
      }

      setResult({ created, updated, ignored })
      setStep('result')
      toast({
        title: 'Importação concluída',
        description: `${created.length} criados · ${updated.length} atualizados · ${ignored.length} ignorados.`,
      })
      // recarrega existentes
      try {
        setExisting(await getPriceTables(`brand = "${selectedBrandId}"`))
      } catch {}
    } catch (err: any) {
      toast({ title: 'Erro durante importação', description: err.message, variant: 'destructive' })
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
      {/* Header */}
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
                Tabela de Preços — Importar
              </h1>
              <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">Price Check</Badge>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Envie a planilha de preços por rede/seção para a IA comparar com as etiquetas nas
              fotos.
            </p>
          </div>
        </div>
      </div>

      {/* Marca + dados atuais */}
      <Card className="shadow-sm border-slate-200 dark:border-slate-800">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Marca
              </Label>
              <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                <SelectTrigger className="bg-white dark:bg-slate-900">
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
              <Label className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Preços cadastrados
              </Label>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 flex items-center justify-between">
                <span>
                  {selectedBrand
                    ? `${existing.length} registros · ${skus.length} SKUs`
                    : 'Selecione uma marca'}
                </span>
                {selectedBrand && existing.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() =>
                      Promise.all(existing.map((e) => deletePriceTable(e.id)))
                        .then(() => setExisting([]))
                        .then(() =>
                          toast({
                            title: 'Tabela limpa',
                            description: 'Registros de preço removidos.',
                          }),
                        )
                        .catch((err: any) =>
                          toast({
                            title: 'Erro ao limpar',
                            description: err.message,
                            variant: 'destructive',
                          }),
                        )
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Limpar
                  </Button>
                )}
              </div>
            </div>
          </div>
          {!selectedBrand && (
            <p className="text-xs text-amber-600">Selecione a marca antes de importar.</p>
          )}
        </CardContent>
      </Card>

      {/* PASSO 1: UPLOAD */}
      {step === 'upload' && (
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardContent className="p-6 space-y-4">
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
                  Clique para selecionar ou arraste a planilha de preços
                </p>
                <p className="text-xs text-slate-400">Suporta .xlsx, .xlsm e .csv</p>
              </div>
            </div>

            {/* Modelo de colunas esperadas */}
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                Colunas reconhecidas automaticamente
              </div>
              <p className="text-[11px]">
                <strong>Produto</strong> (SKU / código / EAN / nome) · <strong>Rede</strong>{' '}
                (bandeira) · <strong>Seção</strong> (opcional) · <strong>Preço</strong> (valor,
                aceita "R$ 12,90")
              </p>
              <p className="text-[11px] text-slate-400">
                O sistema identifica a coluna de cada campo sozinho. Você pode ajustar no passo
                seguinte.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PASSO 2: MAPEAMENTO */}
      {(step === 'mapping' || step === 'importing') && parsed && (
        <div className="space-y-6">
          <Card className="shadow-sm border-slate-200 dark:border-slate-800">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    Mapeamento das colunas
                  </h3>
                  <p className="text-xs text-slate-500">
                    {parsed.rows.length} registros em &quot;{file?.name}&quot;
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMapping(autoMapPriceHeaders(parsed.headers))}
                  className="text-xs"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Re-mapear
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {PRICE_FIELDS.map((field) => (
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
                        setMapping((prev) => ({ ...prev, [field.key]: v === '__none__' ? '' : v }))
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

          {/* Pré-visualização */}
          <Card className="overflow-hidden p-0 shadow-sm border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
                Pré-visualização (5 primeiras linhas)
              </h3>
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
                  {parsed.rows.slice(0, 5).map((r, i) => (
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

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={reset}>
              Trocar arquivo
            </Button>
            <Button
              onClick={runImport}
              disabled={!canImport || importing}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando {parsed.rows.length}{' '}
                  linhas...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" /> Importar preços
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* PASSO 3: RESULTADO */}
      {step === 'result' && result && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20">
              <CardContent className="p-6 flex items-center gap-4">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 shrink-0" />
                <div>
                  <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
                    {result.created.length}
                  </p>
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">Criados</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-sky-200 bg-sky-50/40 dark:bg-sky-950/20">
              <CardContent className="p-6 flex items-center gap-4">
                <RefreshCw className="h-10 w-10 text-sky-600 shrink-0" />
                <div>
                  <p className="text-3xl font-bold text-sky-700 dark:text-sky-300">
                    {result.updated.length}
                  </p>
                  <p className="text-sm text-sky-700 dark:text-sky-400">Atualizados</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50/40 dark:bg-amber-950/20">
              <CardContent className="p-6 flex items-center gap-4">
                <AlertTriangle className="h-10 w-10 text-amber-600 shrink-0" />
                <div>
                  <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                    {result.ignored.length}
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-400">Ignorados</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {result.ignored.length > 0 && (
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    Linhas ignoradas ({result.ignored.length})
                  </h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700">
                      <tr>
                        <th className="text-left font-semibold px-3 py-2">Linha</th>
                        <th className="text-left font-semibold px-3 py-2">Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {result.ignored.map((e, i) => (
                        <tr key={i}>
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

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={reset}>
              Importar outra planilha
            </Button>
            <Button
              onClick={() => navigate('/integracoes')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Voltar para Integrações
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
