import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { parseSpreadsheet } from '@/lib/spreadsheet'
import { getAllStores, getPromoters, getBrands, createVisitSchedule } from '@/services/api'
import { Store, Promoter, Brand, VisitScheduleStatus } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Upload, ArrowLeft, Loader2, CheckCircle2, AlertTriangle, CalendarDays } from 'lucide-react'

export const ImportAgenda: React.FC = () => {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [stores, setStores] = useState<Store[]>([])
  const [promoters, setPromoters] = useState<Promoter[]>([])
  const [brands, setBrands] = useState<Brand[]>([])

  const [file, setFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ created: number; errors: string[] } | null>(null)

  useEffect(() => {
    async function load() {
      const [sts, prs, brs] = await Promise.all([getAllStores(), getPromoters(), getBrands()])
      setStores(sts)
      setPromoters(prs)
      setBrands(brs)
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
        description: `${sheet.rows.length} agendamentos encontrados.`,
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
    if (parsedRows.length === 0) return
    setImporting(true)

    let created = 0
    const errors: string[] = []

    const storeMap = new Map<string, Store>()
    for (const s of stores) {
      storeMap.set(s.number.trim().toLowerCase(), s)
      storeMap.set(s.name.trim().toLowerCase(), s)
      if (s.api_identifier) storeMap.set(s.api_identifier.trim().toLowerCase(), s)
    }

    const promoterMap = new Map<string, Promoter>()
    for (const p of promoters) {
      promoterMap.set(p.name.trim().toLowerCase(), p)
    }

    const hLower = headers.map((h) => h.trim().toLowerCase())
    const storeIdx = hLower.findIndex(
      (h) =>
        h.includes('loja') || h.includes('pdv') || h.includes('numero') || h.includes('codigo'),
    )
    const dateIdx = hLower.findIndex(
      (h) => h.includes('data') || h.includes('dia') || h.includes('periodo'),
    )
    const promoterIdx = hLower.findIndex(
      (h) =>
        h.includes('promotor') ||
        h.includes('usuario') ||
        h.includes('consultor') ||
        h.includes('rota'),
    )
    const statusIdx = hLower.findIndex(
      (h) => h.includes('status') || h.includes('situacao') || h.includes('conclusao'),
    )
    const shiftIdx = hLower.findIndex((h) => h.includes('turno') || h.includes('periodo'))
    const inIdx = hLower.findIndex((h) => h.includes('checkin') || h.includes('entrada'))
    const outIdx = hLower.findIndex((h) => h.includes('checkout') || h.includes('saida'))
    const notesIdx = hLower.findIndex((h) => h.includes('obs') || h.includes('nota'))

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i]
      const rowNum = i + 2

      const storeRaw = storeIdx >= 0 ? (row[storeIdx] || '').trim() : ''
      const dateRaw = dateIdx >= 0 ? (row[dateIdx] || '').trim() : ''
      const promoterRaw = promoterIdx >= 0 ? (row[promoterIdx] || '').trim() : ''
      const statusRaw = statusIdx >= 0 ? (row[statusIdx] || '').trim().toLowerCase() : ''
      const shiftRaw = shiftIdx >= 0 ? (row[shiftIdx] || '').trim().toLowerCase() : ''
      const checkinRaw = inIdx >= 0 ? (row[inIdx] || '').trim() : ''
      const checkoutRaw = outIdx >= 0 ? (row[outIdx] || '').trim() : ''
      const notesRaw = notesIdx >= 0 ? (row[notesIdx] || '').trim() : ''

      if (!storeRaw) {
        errors.push(`Linha ${rowNum}: Loja não especificada.`)
        continue
      }

      const matchedStore = storeMap.get(storeRaw.toLowerCase())
      if (!matchedStore) {
        errors.push(`Linha ${rowNum}: Loja "${storeRaw}" não encontrada.`)
        continue
      }

      let visitDate = dateRaw
      if (!visitDate) {
        visitDate = new Date().toISOString().slice(0, 10)
      } else {
        // Normalizar DD/MM/AAAA para AAAA-MM-DD se necessário
        const dmy = visitDate.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
        if (dmy) {
          visitDate = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
        }
      }

      const matchedPromoter = promoterRaw ? promoterMap.get(promoterRaw.toLowerCase()) : null

      let status: VisitScheduleStatus = 'visita_agendada_nao_confirmada'
      if (
        statusRaw.includes('concl') ||
        statusRaw.includes('realiz') ||
        statusRaw.includes('evid')
      ) {
        status = 'visita_confirmada_evidencias'
      } else if (statusRaw.includes('foto') || statusRaw.includes('pend')) {
        status = 'visita_confirmada_fotos_pendentes'
      } else if (statusRaw.includes('sem') || statusRaw.includes('nao agen')) {
        status = 'sem_visita_agendada'
      }

      let shift: 'manha' | 'tarde' | 'integral' = 'integral'
      if (shiftRaw.includes('manh')) shift = 'manha'
      else if (shiftRaw.includes('tard')) shift = 'tarde'

      try {
        await createVisitSchedule({
          store: matchedStore.id,
          visit_date: visitDate,
          promoter: matchedPromoter ? matchedPromoter.id : null,
          status,
          shift,
          checkin_time: checkinRaw,
          checkout_time: checkoutRaw,
          origin: 'import_planilha',
          notes: notesRaw || 'Importado via planilha de roteiro',
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
      description: `${created} visitas agendadas com sucesso.`,
    })
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/agenda')}>
          <ArrowLeft className="h-5 w-5 text-slate-500" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Importar Agenda de Visitas
          </h1>
          <p className="text-sm text-slate-500">
            Carregue planilhas com o roteiro de visitas por Loja, Data e Promotor.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Arquivo de Roteiro / Agenda</CardTitle>
          <CardDescription>
            Envie a planilha com as colunas (Loja, Data, Promotor, Turno, Status, Check-in,
            Check-out).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                Pré-visualização do Arquivo ({parsedRows.length} agendamentos)
              </p>
              <p className="text-xs text-slate-500">Colunas detectadas: {headers.join(', ')}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => navigate('/agenda')}>
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
                  <CalendarDays className="mr-2 h-4 w-4" />
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
              Resultado: {result.created} agendamentos importados com sucesso!
            </div>
            {result.errors.length > 0 && (
              <div className="mt-3 text-xs text-amber-800 space-y-1">
                <p className="font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-amber-600" /> Linhas ignoradas (
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
