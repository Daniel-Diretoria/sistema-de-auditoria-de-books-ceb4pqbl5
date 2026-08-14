import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  getBrands,
  getBookById,
  getBookPhotos,
  createBookPhoto,
  updateBook,
  updateBookPhoto,
  deleteBookPhoto,
  getFileUrl,
  formatDate,
} from '@/services/api'
import {
  Brand,
  Store,
  Book,
  BookPhoto,
  AuditFrequency,
  FREQUENCY_LABELS,
  FREQUENCY_BADGE_CLASSES,
  FREQUENCY_TO_STORED,
  REVIEW_STATUS_LABELS,
} from '@/types'
import { parsePptx, identifyStore, isFrequencyDay, normalizeText } from '@/lib/pptx'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
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
  Upload,
  FileSpreadsheet,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Store as StoreIcon,
  Image as ImageIcon,
  XCircle,
  ClipboardCheck,
  Search,
} from 'lucide-react'

type Step = 'upload' | 'processing' | 'result'

interface PhotoItem {
  tempId: string
  slideNumber: number
  photoIndex: number
  dataUrl: string
  blob: Blob
  mimeType: string
  extension: string
  extractedText: string
  identifiedStore?: Store
  identifiedStoreName?: string
  confidence: number
  needsReview: boolean
  savedPhotoId?: string
  reviewStatus: 'pending' | 'approved' | 'corrected'
  reviewNotes?: string
  correctedStore?: Store
}

export const ImportBook: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('upload')
  const [brands, setBrands] = useState<Brand[]>([])
  const [loadingBrands, setLoadingBrands] = useState(true)

  const [selectedBrandId, setSelectedBrandId] = useState('')
  const [auditDate, setAuditDate] = useState(new Date().toISOString().slice(0, 10))
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Processing
  const [progressMsg, setProgressMsg] = useState('')
  const [progressPct, setProgressPct] = useState(0)

  // Result
  const [createdBookId, setCreatedBookId] = useState<string | null>(null)
  const [photos, setPhotos] = useState<PhotoItem[]>([])
  const [missingStores, setMissingStores] = useState<Store[]>([])

  // Review drawer
  const [reviewPhoto, setReviewPhoto] = useState<PhotoItem | null>(null)
  const [reviewStoreSearch, setReviewStoreSearch] = useState('')
  const [reviewSelectedStore, setReviewSelectedStore] = useState<Store | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [reviewSaving, setReviewSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isAdmin = user?.role === 'administrator'

  const selectedBrand = useMemo(
    () => brands.find((b) => b.id === selectedBrandId),
    [brands, selectedBrandId],
  )

  const brandStores = useMemo<Store[]>(() => selectedBrand?.expand?.stores || [], [selectedBrand])

  const dateWarn = useMemo(() => {
    if (!selectedBrand || !auditDate) return false
    const d = new Date(auditDate + 'T12:00:00')
    return !isFrequencyDay(selectedBrand.frequency, d)
  }, [selectedBrand, auditDate])

  // Last book for selected brand
  const [lastBook, setLastBook] = useState<Book | null>(null)
  useEffect(() => {
    if (!selectedBrandId) {
      setLastBook(null)
      return
    }
    getBrands().then(async (all) => {
      // not needed; fetch books filtered
    })
    // fetch latest book for brand
    ;(async () => {
      try {
        const { getBooks } = await import('@/services/api')
        const list = await getBooks(`brand = "${selectedBrandId}"`)
        setLastBook(list[0] || null)
      } catch {
        setLastBook(null)
      }
    })()
  }, [selectedBrandId])

  useEffect(() => {
    ;(async () => {
      try {
        setLoadingBrands(true)
        const b = await getBrands()
        setBrands(b)
      } catch (err: any) {
        toast({
          title: 'Erro ao carregar marcas',
          description: err.message,
          variant: 'destructive',
        })
      } finally {
        setLoadingBrands(false)
      }
    })()
  }, [])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) handleFile(f)
  }

  const handleFile = (f: File) => {
    if (!f.name.toLowerCase().endsWith('.pptx')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Selecione um arquivo PowerPoint (.pptx).',
        variant: 'destructive',
      })
      return
    }
    if (f.size > 100 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O limite é 100MB.',
        variant: 'destructive',
      })
      return
    }
    setFile(f)
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const startImport = async () => {
    if (!selectedBrand || !file) {
      toast({
        title: 'Atenção',
        description: 'Selecione a marca e o arquivo PPTX.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting(true)
    setStep('processing')
    setProgressPct(0)
    setProgressMsg('Iniciando...')

    let bookId: string | null = null
    try {
      // 1. Criar o book (status processing)
      setProgressMsg('Criando registro do book...')
      setProgressPct(2)
      const { createBook } = await import('@/services/api')
      const title = file.name.replace(/\.pptx$/i, '')
      const formData = new FormData()
      formData.append('title', title)
      formData.append('brand', selectedBrand.id)
      formData.append('analyst', user!.id)
      formData.append('file_name', file.name)
      formData.append('file_size', String(file.size))
      formData.append('audit_date', auditDate)
      formData.append('audit_frequency', FREQUENCY_TO_STORED[selectedBrand.frequency])
      formData.append('total_slides', '0')
      formData.append('total_photos', '0')
      formData.append('identified_stores', '0')
      formData.append('pending_review', '0')
      formData.append('missing_stores', '0')
      formData.append('status', 'processing')
      const book = await createBook(formData)
      bookId = book.id
      setCreatedBookId(bookId)

      // 2. Parsear PPTX
      setProgressMsg('Extraindo slides do PPTX...')
      setProgressPct(5)
      const parsed = await parsePptx(file, (msg, pct) => {
        setProgressMsg(msg)
        setProgressPct(pct)
      })

      if (parsed.totalPhotos === 0) {
        throw new Error('Nenhuma imagem foi encontrada nos slides do PPTX.')
      }

      // 3. Identificar lojas
      setProgressMsg('Identificando lojas...')
      setProgressPct(82)
      const items: PhotoItem[] = []
      let photoIdx = 0
      for (const slide of parsed.slides) {
        for (const photo of slide.photos) {
          const match = identifyStore([...slide.texts, ...slide.notes], brandStores)
          const confidence = match?.confidence || 0
          const identified = match && confidence >= 0.8
          const needsReview = !identified

          items.push({
            tempId: `${slide.slideNumber}-${photoIdx}`,
            slideNumber: slide.slideNumber,
            photoIndex: photoIdx,
            dataUrl: photo.dataUrl,
            blob: photo.blob,
            mimeType: photo.mimeType,
            extension: photo.extension,
            extractedText: [...slide.texts, ...slide.notes].join(' | '),
            identifiedStore: identified ? match!.store : match?.store,
            identifiedStoreName: match
              ? `${match.matchedText} (${Math.round(match.confidence * 100)}%)`
              : undefined,
            confidence,
            needsReview,
            reviewStatus: 'pending',
          })
          photoIdx++
        }
      }

      // 4. Salvar fotos no banco
      setProgressMsg('Salvando fotos extraídas...')
      setProgressPct(90)
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        const fd = new FormData()
        fd.append('book', bookId!)
        fd.append('slide_number', String(it.slideNumber))
        fd.append('photo_index', String(it.photoIndex))
        fd.append(
          'image_data',
          it.blob,
          `slide${it.slideNumber}_foto${it.photoIndex}.${it.extension}`,
        )
        fd.append('extracted_text', it.extractedText)
        if (it.identifiedStore && !it.needsReview) {
          fd.append('identified_store', it.identifiedStore.id)
          fd.append('identified_store_name', it.identifiedStoreName || '')
          fd.append('confidence', String(it.confidence))
          fd.append('needs_review', 'false')
          fd.append('review_status', 'approved')
        } else {
          if (it.identifiedStore) {
            fd.append('identified_store', it.identifiedStore.id)
            fd.append('identified_store_name', it.identifiedStoreName || '')
            fd.append('confidence', String(it.confidence))
          } else {
            fd.append('confidence', '0')
          }
          fd.append('needs_review', 'true')
          fd.append('review_status', 'pending')
        }
        try {
          const saved = await createBookPhoto(fd)
          it.savedPhotoId = saved.id
        } catch (err) {
          console.error('erro salvar foto', err)
        }
        if (i % 3 === 0) {
          setProgressPct(90 + Math.round((i / items.length) * 6))
        }
      }

      // 5. Comparar carteira - lojas ausentes
      setProgressMsg('Comparando carteira de lojas...')
      setProgressPct(97)
      const foundStoreIds = new Set<string>()
      for (const it of items) {
        if (it.identifiedStore && !it.needsReview) foundStoreIds.add(it.identifiedStore.id)
      }
      const missing = brandStores.filter((s) => !foundStoreIds.has(s.id))
      setMissingStores(missing)

      const identifiedCount = items.filter((i) => !i.needsReview).length
      const pendingCount = items.filter((i) => i.needsReview).length

      // 6. Atualizar book
      setProgressMsg('Finalizando...')
      setProgressPct(99)
      const updateData: Record<string, any> = {
        total_slides: parsed.totalSlides,
        total_photos: items.length,
        identified_stores: identifiedCount,
        pending_review: pendingCount,
        missing_stores: missing.length,
        status: pendingCount > 0 ? 'pending_review' : 'completed',
        missing_store_ids: missing.map((s) => s.id).join(','),
      }
      await updateBook(bookId!, updateData)

      setPhotos(items)
      setProgressPct(100)
      setProgressMsg('Concluído!')
      setStep('result')
      toast({
        title: 'Book importado!',
        description: `${items.length} fotos processadas. ${identifiedCount} lojas identificadas, ${pendingCount} pendentes, ${missing.length} ausentes.`,
      })
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'Erro ao importar book',
        description: err.message || 'Falha no processamento do PPTX.',
        variant: 'destructive',
      })
      // Limpar book parcial se criado
      if (bookId) {
        try {
          const { deleteBook } = await import('@/services/api')
          await deleteBook(bookId)
        } catch {
          /* intentionally ignored */
        }
      }
      setStep('upload')
    } finally {
      setSubmitting(false)
    }
  }

  // ----- Revisão manual ------
  const openReview = (p: PhotoItem) => {
    setReviewPhoto(p)
    setReviewSelectedStore(p.identifiedStore || null)
    setReviewNotes(p.reviewNotes || '')
    setReviewStoreSearch('')
  }

  const filteredStoreOptions = useMemo(() => {
    if (!reviewStoreSearch) return brandStores
    const s = normalizeText(reviewStoreSearch)
    return brandStores.filter(
      (st) => normalizeText(st.name).includes(s) || normalizeText(st.number).includes(s),
    )
  }, [brandStores, reviewStoreSearch])

  const saveReview = async () => {
    if (!reviewPhoto || !reviewPhoto.savedPhotoId) return
    setReviewSaving(true)
    try {
      const chosen = reviewSelectedStore
      const isCorrection = chosen && chosen.id !== reviewPhoto.identifiedStore?.id
      const fd = new FormData()
      if (chosen) {
        if (isCorrection) {
          fd.append('corrected_store', chosen.id)
          fd.append('identified_store', chosen.id)
          fd.append('identified_store_name', `Revisão manual: ${chosen.name}`)
        } else {
          fd.append('identified_store', chosen.id)
        }
      }
      fd.append('needs_review', 'false')
      fd.append('review_status', isCorrection ? 'corrected' : 'approved')
      fd.append('reviewed_by', user!.id)
      fd.append('review_notes', reviewNotes)
      await updateBookPhoto(reviewPhoto.savedPhotoId, fd)

      // Atualizar estado local
      setPhotos((prev) =>
        prev.map((p) =>
          p.tempId === reviewPhoto.tempId
            ? {
                ...p,
                needsReview: false,
                identifiedStore: chosen || p.identifiedStore,
                correctedStore: isCorrection ? chosen! : undefined,
                reviewStatus: isCorrection ? 'corrected' : 'approved',
                reviewNotes,
              }
            : p,
        ),
      )

      // Recalcular ausentes
      if (chosen) {
        setMissingStores((prev) => {
          const foundIds = new Set<string>()
          for (const p of photos) {
            const st = p.tempId === reviewPhoto.tempId ? chosen : p.identifiedStore
            if (st && (!p.needsReview || p.tempId === reviewPhoto.tempId)) foundIds.add(st.id)
          }
          return brandStores.filter((s) => !foundIds.has(s.id))
        })
      }

      // Atualizar contadores do book
      if (createdBookId) {
        const pending = photos.filter(
          (p) => p.tempId !== reviewPhoto.tempId && p.needsReview,
        ).length
        const identified = photos.filter(
          (p) => !p.needsReview || p.tempId === reviewPhoto.tempId,
        ).length
        await updateBook(createdBookId, {
          identified_stores: identified,
          pending_review: pending,
          status: pending === 0 ? 'reviewed' : 'pending_review',
        })
      }

      toast({ title: 'Revisão salva', description: 'A foto foi associada à loja.' })
      setReviewPhoto(null)
    } catch (err: any) {
      toast({ title: 'Erro ao salvar revisão', description: err.message, variant: 'destructive' })
    } finally {
      setReviewSaving(false)
    }
  }

  // ---- Result groupings ----
  const identifiedPhotos = photos.filter((p) => !p.needsReview)
  const pendingPhotos = photos.filter((p) => p.needsReview)

  const groupedByStore = useMemo(() => {
    const map = new Map<string, { store: Store | undefined; items: PhotoItem[] }>()
    for (const p of identifiedPhotos) {
      const key = p.correctedStore?.id || p.identifiedStore?.id || 'none'
      if (!map.has(key)) map.set(key, { store: p.correctedStore || p.identifiedStore, items: [] })
      map.get(key)!.items.push(p)
    }
    return Array.from(map.values())
  }, [identifiedPhotos])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/books')}
            className="text-slate-500"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Importar Book</h1>
            <p className="text-sm text-slate-500">
              Faça upload de um PPTX e o sistema identificará as lojas automaticamente.
            </p>
          </div>
        </div>
      </div>

      {/* STEP 1: UPLOAD */}
      {step === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardContent className="p-6 space-y-5">
              <div className="space-y-1.5">
                <Label>Marca *</Label>
                {loadingBrands ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando marcas...
                  </div>
                ) : (
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
                )}
              </div>

              {selectedBrand && (
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Carteira de lojas
                    </span>
                    <Badge
                      variant="outline"
                      className={FREQUENCY_BADGE_CLASSES[selectedBrand.frequency]}
                    >
                      {FREQUENCY_LABELS[selectedBrand.frequency]}
                    </Badge>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {brandStores.length}{' '}
                    <span className="text-sm font-medium text-slate-500">lojas previstas</span>
                  </p>
                  {lastBook && (
                    <p className="text-xs text-slate-500">
                      Último book: <strong>{lastBook.title}</strong> ·{' '}
                      {formatDate(lastBook.audit_date)}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="audit-date">Data da Auditoria *</Label>
                <Input
                  id="audit-date"
                  type="date"
                  value={auditDate}
                  onChange={(e) => setAuditDate(e.target.value)}
                  className="bg-white"
                />
                {dateWarn && selectedBrand && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      A data selecionada não corresponde à frequência{' '}
                      <strong>{FREQUENCY_LABELS[selectedBrand.frequency]}</strong>. O upload ainda
                      será permitido, mas verifique se a data está correta.
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Arquivo PPTX *</Label>
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
                    accept=".pptx"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                  />
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="h-12 w-12 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                        <FileSpreadsheet className="h-6 w-6" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-slate-900 text-sm">{file.name}</p>
                        <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-600"
                        onClick={(e) => {
                          e.stopPropagation()
                          setFile(null)
                        }}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-slate-500">
                      <Upload className="h-8 w-8 text-slate-400" />
                      <p className="text-sm font-medium text-slate-700">
                        Arraste o arquivo PPTX aqui ou clique para selecionar
                      </p>
                      <p className="text-xs text-slate-400">Apenas arquivos .pptx · até 100MB</p>
                    </div>
                  )}
                </div>
              </div>

              <Button
                onClick={startImport}
                disabled={submitting || !selectedBrand || !file || !auditDate}
                className="w-full bg-indigo-600 hover:bg-indigo-700 h-11"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" /> Importar Book
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-3">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-indigo-600" />
                Como funciona
              </h3>
              <ol className="space-y-3 text-sm text-slate-600">
                <li className="flex gap-2">
                  <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span>Selecione a marca e a data da auditoria.</span>
                </li>
                <li className="flex gap-2">
                  <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <span>Faça upload do PPTX com as fotos das lojas.</span>
                </li>
                <li className="flex gap-2">
                  <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <span>O sistema extrai slides e imagens e identifica lojas por texto.</span>
                </li>
                <li className="flex gap-2">
                  <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                    4
                  </span>
                  <span>Revise as fotos não identificadas e confirme as lojas.</span>
                </li>
                <li className="flex gap-2">
                  <span className="h-5 w-5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                    5
                  </span>
                  <span>Veja lojas sem foto (ausentes) na carteira da marca.</span>
                </li>
              </ol>
            </CardContent>
          </Card>
        </div>
      )}

      {/* STEP 2: PROCESSING */}
      {step === 'processing' && (
        <Card>
          <CardContent className="p-12 text-center space-y-6">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
              <h2 className="text-lg font-semibold text-slate-900">Processando Book...</h2>
              <p className="text-sm text-slate-500">{progressMsg}</p>
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <Progress value={progressPct} className="h-2" />
              <p className="text-xs text-slate-400 text-right">{progressPct}%</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: RESULT */}
      {step === 'result' && (
        <div className="space-y-6">
          {/* Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SummaryCard
              icon={<FileSpreadsheet className="h-5 w-5" />}
              label="Slides"
              value={photos.length > 0 ? Math.max(...photos.map((p) => p.slideNumber)) : 0}
              color="indigo"
            />
            <SummaryCard
              icon={<ImageIcon className="h-5 w-5" />}
              label="Fotos"
              value={photos.length}
              color="slate"
            />
            <SummaryCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="Identificadas"
              value={identifiedPhotos.length}
              color="emerald"
            />
            <SummaryCard
              icon={<AlertTriangle className="h-5 w-5" />}
              label="Pendentes"
              value={pendingPhotos.length}
              color="amber"
            />
            <SummaryCard
              icon={<XCircle className="h-5 w-5" />}
              label="Ausentes"
              value={missingStores.length}
              color="red"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate('/books')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para lista
            </Button>
            {createdBookId && (
              <Button onClick={() => navigate(`/books/${createdBookId}`)}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Ver detalhes do book
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate('/books/import')}>
              <Upload className="mr-2 h-4 w-4" /> Importar outro
            </Button>
          </div>

          {/* Pendentes de Revisão */}
          {pendingPhotos.length > 0 && (
            <Card className="border-amber-300 bg-amber-50/40">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  <h3 className="font-semibold text-amber-900">
                    Pendentes de Revisão ({pendingPhotos.length})
                  </h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {pendingPhotos.map((p) => (
                    <PhotoCard key={p.tempId} photo={p} onReview={() => openReview(p)} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Fotos identificadas por loja */}
          {groupedByStore.length > 0 && (
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-semibold text-slate-900">
                    Lojas Identificadas ({groupedByStore.length})
                  </h3>
                </div>
                <div className="space-y-4">
                  {groupedByStore.map((g) => (
                    <div key={g.store?.id || 'none'} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <StoreIcon className="h-4 w-4 text-slate-400" />
                        <span className="font-medium text-slate-800 text-sm">
                          {g.store ? `${g.store.number} — ${g.store.name}` : 'Sem loja'}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {g.items.length} foto{g.items.length > 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                        {g.items.map((p) => (
                          <img
                            key={p.tempId}
                            src={p.dataUrl}
                            alt={`Slide ${p.slideNumber}`}
                            className="w-full aspect-square object-cover rounded-lg border border-slate-200"
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lojas sem foto */}
          {missingStores.length > 0 && (
            <Card className="border-red-200 bg-red-50/40">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <h3 className="font-semibold text-red-900">
                    Lojas sem Foto ({missingStores.length})
                  </h3>
                </div>
                <p className="text-xs text-red-700">
                  Estas lojas fazem parte da carteira prevista da marca mas não foram encontradas
                  neste book.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {missingStores.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-white border border-red-100"
                    >
                      <span className="font-bold text-red-700 text-sm">{s.number}</span>
                      <span className="text-sm text-slate-700 truncate">{s.name}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* REVIEW DRAWER */}
      <Sheet open={!!reviewPhoto} onOpenChange={(o) => !o && setReviewPhoto(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {reviewPhoto && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle>Revisar Foto</SheetTitle>
                <SheetDescription>
                  Slide {reviewPhoto.slideNumber} · Foto {reviewPhoto.photoIndex + 1}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4">
                <img
                  src={reviewPhoto.dataUrl}
                  alt="Foto extraída"
                  className="w-full rounded-lg border border-slate-200 object-contain max-h-72 bg-slate-50"
                />

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">
                    Texto extraído do slide
                  </Label>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {reviewPhoto.extractedText || '(sem texto extraído)'}
                  </div>
                </div>

                {reviewPhoto.identifiedStore && (
                  <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200">
                    <p className="text-xs font-semibold text-indigo-700 mb-1">
                      Sugestão do sistema
                    </p>
                    <p className="text-sm font-medium text-slate-900">
                      {reviewPhoto.identifiedStore.number} — {reviewPhoto.identifiedStore.name}
                    </p>
                    <p className="text-xs text-indigo-600 mt-0.5">
                      {reviewPhoto.identifiedStoreName} · {Math.round(reviewPhoto.confidence * 100)}
                      % de confiança
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Buscar e selecionar loja</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Buscar por nome ou número..."
                      value={reviewStoreSearch}
                      onChange={(e) => setReviewStoreSearch(e.target.value)}
                      className="pl-9 bg-white"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
                    {filteredStoreOptions.length === 0 ? (
                      <p className="p-3 text-xs text-slate-400 text-center">
                        Nenhuma loja encontrada.
                      </p>
                    ) : (
                      filteredStoreOptions.slice(0, 60).map((st) => {
                        const selected = reviewSelectedStore?.id === st.id
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setReviewSelectedStore(st)}
                            className={`w-full flex items-center gap-2 p-2 text-left text-sm hover:bg-slate-50 transition-colors ${
                              selected ? 'bg-indigo-50' : ''
                            }`}
                          >
                            <span className="font-bold text-slate-800 text-xs w-12">
                              {st.number}
                            </span>
                            <span className="text-slate-700 truncate flex-1">{st.name}</span>
                            {selected && <CheckCircle2 className="h-4 w-4 text-indigo-600" />}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rn">Nota de revisão (opcional)</Label>
                  <textarea
                    id="rn"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-slate-200 bg-white p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex.: foto confirmada pelo promotor..."
                  />
                </div>
              </div>

              <SheetFooter className="pt-6">
                <Button variant="outline" onClick={() => setReviewPhoto(null)}>
                  Cancelar
                </Button>
                <Button
                  onClick={saveReview}
                  disabled={reviewSaving || !reviewSelectedStore}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {reviewSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmar Associação
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ---- subcomponents ----

const colorMap: Record<string, string> = {
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  red: 'bg-red-50 text-red-700 border-red-100',
}

const SummaryCard: React.FC<{
  icon: React.ReactNode
  label: string
  value: number
  color: string
}> = ({ icon, label, value, color }) => (
  <Card className={`border ${colorMap[color]}`}>
    <CardContent className="p-4 flex items-center gap-3">
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="text-xs font-medium mt-1 opacity-80">{label}</p>
      </div>
    </CardContent>
  </Card>
)

const PhotoCard: React.FC<{ photo: PhotoItem; onReview: () => void }> = ({ photo, onReview }) => (
  <div className="rounded-lg border border-amber-200 bg-white overflow-hidden">
    <img
      src={photo.dataUrl}
      alt={`Slide ${photo.slideNumber}`}
      className="w-full aspect-square object-cover"
    />
    <div className="p-2 space-y-1">
      <p className="text-[10px] text-slate-500 truncate">Slide {photo.slideNumber}</p>
      {photo.identifiedStore && (
        <p className="text-xs font-medium text-slate-700 truncate">
          {photo.identifiedStore.number} — {photo.identifiedStore.name}
        </p>
      )}
      <Button
        size="sm"
        className="w-full h-7 text-xs bg-amber-600 hover:bg-amber-700"
        onClick={onReview}
      >
        Revisar
      </Button>
    </div>
  </div>
)
