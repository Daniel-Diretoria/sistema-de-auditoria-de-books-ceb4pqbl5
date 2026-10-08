import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseSpreadsheet } from '@/lib/spreadsheet'
import { getBrands, getAllStores, getSKUs, createAssortmentItem } from '@/services/api'
import { Brand, Store, SKU, AssortmentStatus } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Upload, ArrowLeft, Loader2, CheckCircle2, AlertTriangle, Layers } from 'lucide-react'

export const ImportSortimento: React.FC = () => {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [brands, setBrands] = useState<Brand[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [skus, setSkus] = useState<SKU[]>([])
  const [selectedBrand, setSelectedBrand] = useState('')

  const [file, setFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null)

  useEffect(() => {
    async function load() {
      const [brs, sts, sk] = await Promise.all([getBrands(), getAllStores(), getSKUs()])
      setBrands(brs)
      setStores(sts)
      setSkus(sk)
      if (brs.length > 0) setSelectedBrand(brs[0].id)
    }
    load()
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setResult(null)
    try {
      const sheet = await parseSpreadsheet(f)
      setHeaders(sheet.headers)
      setParsedRows(sheet.rows)
      toast({
        title: 'Planilha carregada',
        description: `${sheet.rows.length} linhas encontradas.`,
      })
    } catch (err: any) {
      toast({
        title: 'Erro ao ler arquivo',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const handleImport = async () => {
    if (!selectedBrand || parsedRows.length === 0) return
    setImporting(true)

    let created = 0
    const errors: string[] = []

    const storeMap = new Map<string, Store>()
    for (const s of stores) {
      storeMap.set(s.number.trim().toLowerCase(), s)
      storeMap.set(s.name.trim().toLowerCase(), s)
    }

    const skuMap = new Map<string, SKU>()
    for (const sk of skus) {
      skuMap.set(sk.code.trim().toLowerCase(), sk)
      skuMap.set(sk.name.trim().toLowerCase(), sk)
    }

    // Identificar índices de cabeçalho
    const hLower = headers.map((h) => h.trim().toLowerCase())
    const skuIdx = hLower.findIndex(
      (h) => h.includes('sku') || h.includes('produto') || h.includes('codigo'),
    )
    const storeIdx = hLower.findIndex(
      (h) => h.includes('loja') || h.includes('pdv') || h.includes('numero'),
    )
    const netIdx = hLower.findIndex((h) => h.includes('rede') || h.includes('bandeira'))
    const statusIdx = hLower.findIndex(
      (h) => h.includes('status') || h.includes('sortimento') || h.includes('tipo'),
    )
    const startIdx = hLower.findIndex((h) => h.includes('inicio') || h.includes('vigencia'))
    const notesIdx = hLower.findIndex(
      (h) => h.includes('obs') || h.includes('nota') || h.includes('justificativa'),
    )

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i]
      const rowNum = i + 2

      const skuRaw = skuIdx >= 0 ? (row[skuIdx] || '').trim() : ''
      const storeRaw = storeIdx >= 0 ? (row[storeIdx] || '').trim() : ''
      const netRaw = netIdx >= 0 ? (row[netIdx] || '').trim() : ''
      const statusRaw = statusIdx >= 0 ? (row[statusIdx] || '').trim().toLowerCase() : ''
      const startRaw = startIdx >= 0 ? (row[startIdx] || '').trim() : ''
      const notesRaw = notesIdx >= 0 ? (row[notesIdx] || '').trim() : ''

      if (!skuRaw) {
        errors.push(`Linha ${rowNum}: SKU não informado.`)
        continue
      }

      const matchedSku = skuMap.get(skuRaw.toLowerCase())
      if (!matchedSku) {
        errors.push(`Linha ${rowNum}: SKU "${skuRaw}" não encontrado no cadastro.`)
        continue
      }

      let matchedStoreId: string | null = null
      if (storeRaw) {
        const found = storeMap.get(storeRaw.toLowerCase())
        if (found) matchedStoreId = found.id
      }

      let status: AssortmentStatus = 'obrigatorio'
      if (statusRaw.includes('opcional')) status = 'opcional'
      else if (
        statusRaw.includes('nao') ||
        statusRaw.includes('fora') ||
        statusRaw.includes('excluido')
      )
        status = 'nao_trabalhado'
      else if (statusRaw.includes('aguard') || statusRaw.includes('pendente'))
        status = 'aguardando_confirmacao'

      try {
        await createAssortmentItem({
          brand: selectedBrand,
          sku: matchedSku.id,
          store: matchedStoreId,
          network: !matchedStoreId && netRaw ? netRaw : '',
          status,
          start_date: startRaw || new Date().toISOString().slice(0, 10),
          notes: notesRaw || 'Importado via planilha de sortimento',
        })
        created++
      } catch (err: any) {
        errors.push(`Linha ${rowNum}: ${err.message}`)
      }
    }

    setImporting(false)
    setResult({ created, errors })
    toast({
      title: 'Importação concluída',
      description: `${created} regras de sortimento importadas com sucesso.`,
    })
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/sortimento')}>
          <ArrowLeft className="h-5 w-5 text-slate-500" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Importar Matriz de Sortimento
          </h1>
          <p className="text-sm text-slate-500">
            Carregue planilhas Excel (.xlsx) ou CSV para definir o sortimento obrigatório por loja e
            rede.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configurações da Importação</CardTitle>
          <CardDescription>
            Selecione a marca e anexe o arquivo com as colunas (SKU, Loja, Rede, Status, Vigência).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Marca para a Matriz *</Label>
            <Select value={selectedBrand} onValueChange={setSelectedBrand}>
              <SelectTrigger className="mt-1">
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

          <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-indigo-400 transition-colors">
            <Upload className="h-10 w-10 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700">
              {file ? file.name : 'Clique para selecionar a planilha (.xlsx, .csv)'}
            </p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="mt-2 text-sm text-slate-500"
            />
          </div>

          {parsedRows.length > 0 && (
            <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 space-y-2">
              <p className="text-sm font-semibold text-slate-800">
                Pré-visualização do Arquivo ({parsedRows.length} linhas)
              </p>
              <p className="text-xs text-slate-500">Colunas detectadas: {headers.join(', ')}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => navigate('/sortimento')}>
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={importing || parsedRows.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {importing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Layers className="mr-2 h-4 w-4" />
                  Processar Importação
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center gap-2 text-emerald-800 font-semibold">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Resultado: {result.created} regras importadas com sucesso!
            </div>
            {result.errors.length > 0 && (
              <div className="mt-3 text-xs text-amber-800 space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-amber-600" /> Avisos / Linhas ignoradas (
                  {result.errors.length}):
                </p>
                <ul className="list-disc pl-5 max-h-40 overflow-y-auto">
                  {result.errors.slice(0, 20).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
