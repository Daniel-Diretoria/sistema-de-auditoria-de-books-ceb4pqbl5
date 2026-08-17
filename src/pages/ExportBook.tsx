import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import {
  getBookById,
  getBrandById,
  getSKUs,
  getSkuClassifications,
  getBookPhotos,
  getFileUrl,
  formatDate,
} from '@/services/api'
import { exportBookPdf } from '@/lib/pdfExport'
import { Book, Brand, Store, SKU, SkuClassification, BookPhoto, BOOK_STATUS_LABELS } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Loader2,
  FileDown,
  FileSpreadsheet,
  Image as ImageIcon,
  Package,
} from 'lucide-react'

export const ExportBook: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [book, setBook] = useState<Book | null>(null)
  const [brand, setBrand] = useState<Brand | null>(null)
  const [stores, setStores] = useState<Store[]>([])
  const [skus, setSkus] = useState<SKU[]>([])
  const [classifications, setClassifications] = useState<SkuClassification[]>([])
  const [photos, setPhotos] = useState<BookPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState('')

  const load = async () => {
    if (!id) return
    try {
      setLoading(true)
      const b = await getBookById(id)
      setBook(b)
      const br = await getBrandById(b.brand)
      setBrand(br)
      setStores(br.expand?.stores || [])
      const [sk, cl, ph] = await Promise.all([
        getSKUs(`brand = "${b.brand}"`),
        getSkuClassifications(id),
        getBookPhotos(id),
      ])
      // attach brand to skus for expand lookups
      const skWithBrand = sk.map((s) => ({ ...s, expand: { ...s.expand, brand: br } }))
      setSkus(skWithBrand)
      // attach sku expand to classifications
      const skuMap = new Map<string, SKU>()
      for (const s of skWithBrand) skuMap.set(s.id, s)
      const clWithExpand = cl.map((c) => ({
        ...c,
        expand: { ...c.expand, sku: skuMap.get(c.sku) },
      }))
      setClassifications(clWithExpand)
      setPhotos(ph)
    } catch (err: any) {
      toast({ title: 'Erro ao carregar book', description: err.message, variant: 'destructive' })
      navigate('/books')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  const handleExport = async () => {
    if (!book || !brand) return
    setExporting(true)
    try {
      setProgress('Preparando dados do relatório...')
      await exportBookPdf({
        book,
        brand,
        classifications,
        photos,
        stores,
        skus,
      })
      toast({ title: 'PDF gerado', description: 'O relatório foi baixado com sucesso.' })
    } catch (err: any) {
      toast({ title: 'Erro ao gerar PDF', description: err.message, variant: 'destructive' })
    } finally {
      setExporting(false)
      setProgress('')
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-2" />
        <p className="text-sm text-slate-500">Carregando book...</p>
      </div>
    )
  }

  if (!book) return null

  const logoUrl = brand ? getFileUrl(brand, brand.logo) : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/books/${id}`)}
            className="text-slate-500"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={brand?.name}
                className="h-12 w-12 rounded-xl object-contain border border-slate-100 p-1 bg-white"
              />
            ) : (
              <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center">
                {brand?.name?.slice(0, 2).toUpperCase() || '?'}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Exportar Relatório PDF
              </h1>
              <p className="text-xs text-slate-500">
                {book.title} · {brand?.name} · {formatDate(book.audit_date)}
              </p>
            </div>
          </div>
        </div>
        <Button
          onClick={handleExport}
          disabled={exporting}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          {exporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="mr-2 h-4 w-4" />
          )}
          {exporting ? 'Gerando...' : 'Baixar PDF'}
        </Button>
      </div>

      {progress && (
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 text-sm rounded-lg p-3 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {progress}
        </div>
      )}

      {/* Preview summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Status</p>
              <p className="font-bold text-slate-900">{BOOK_STATUS_LABELS[book.status]}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">SKUs classificados</p>
              <p className="font-bold text-slate-900">{classifications.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Fotos do PDV</p>
              <p className="font-bold text-slate-900">{photos.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <FileDown className="h-5 w-5 text-indigo-600" /> Conteúdo do Relatório
          </h3>
          <p className="text-sm text-slate-600">
            O PDF conterá, para cada loja auditada: nome e código, nota, tabela de SKUs (categoria,
            preço, splash), fotos do PDV, ações recomendadas e resumo. Ao final, um resumo geral do
            book com nota média, totais e dados da auditoria.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-xs">
              {stores.length} lojas na carteira
            </Badge>
            <Badge variant="outline" className="text-xs">
              {classifications.length} classificações
            </Badge>
            <Badge variant="outline" className="text-xs">
              {photos.length} fotos
            </Badge>
            <Badge variant="outline" className="text-xs">
              {skus.length} SKUs no catálogo
            </Badge>
          </div>
          {classifications.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg p-3">
              Este book ainda não possui classificações de SKU. Execute a análise antes de exportar
              para um relatório completo.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
