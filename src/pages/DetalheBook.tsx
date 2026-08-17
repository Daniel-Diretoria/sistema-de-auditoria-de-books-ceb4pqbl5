import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  getBookById,
  getBookPhotos,
  updateBookPhoto,
  updateBook,
  deleteBook,
  getFileUrl,
  formatDate,
} from '@/services/api'
import {
  Book,
  BookPhoto,
  Store,
  BOOK_STATUS_LABELS,
  BOOK_STATUS_BADGE,
  REVIEW_STATUS_LABELS,
  FREQUENCY_LABELS,
} from '@/types'
import { normalizeText } from '@/lib/pptx'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Store as StoreIcon,
  Image as ImageIcon,
  Search,
  Trash2,
  FileSpreadsheet,
  ScanSearch,
  Award,
  FileDown,
} from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { ANALYSIS_STATUS_LABELS, ANALYSIS_STATUS_BADGE, AnalysisStatus } from '@/types'

export const DetalheBook: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [book, setBook] = useState<Book | null>(null)
  const [photos, setPhotos] = useState<BookPhoto[]>([])
  const [loading, setLoading] = useState(true)

  const [reviewPhoto, setReviewPhoto] = useState<BookPhoto | null>(null)
  const [reviewStoreSearch, setReviewStoreSearch] = useState('')
  const [reviewSelectedStore, setReviewSelectedStore] = useState<Store | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [reviewSaving, setReviewSaving] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const brandStores: Store[] = book?.expand?.brand?.expand?.stores || []
  // Fallback: we may not have stores expanded; we'll fetch via getBrands if needed.
  const [walletStores, setWalletStores] = useState<Store[]>([])

  const load = async () => {
    if (!id) return
    try {
      setLoading(true)
      const b = await getBookById(id)
      setBook(b)
      // Load brand wallet stores
      const { getBrandById } = await import('@/services/api')
      const fullBrand = await getBrandById(b.brand)
      setWalletStores(fullBrand.expand?.stores || [])
      const p = await getBookPhotos(id)
      setPhotos(p)
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

  const identifiedPhotos = photos.filter((p) => !p.needs_review)
  const pendingPhotos = photos.filter((p) => p.needs_review)

  const missingStores = useMemo(() => {
    const foundIds = new Set<string>()
    for (const p of identifiedPhotos) {
      const sid = p.corrected_store || p.identified_store
      if (sid) foundIds.add(sid)
    }
    return walletStores.filter((s) => !foundIds.has(s.id))
  }, [walletStores, identifiedPhotos])

  const groupedByStore = useMemo(() => {
    const map = new Map<string, { store: Store | undefined; items: BookPhoto[] }>()
    for (const p of identifiedPhotos) {
      const sid = p.corrected_store || p.identified_store
      const store =
        p.expand?.corrected_store ||
        p.expand?.identified_store ||
        walletStores.find((s) => s.id === sid)
      const key = sid || 'none'
      if (!map.has(key)) map.set(key, { store, items: [] })
      map.get(key)!.items.push(p)
    }
    return Array.from(map.values())
  }, [identifiedPhotos, walletStores])

  const openReview = (p: BookPhoto) => {
    setReviewPhoto(p)
    const current =
      p.expand?.corrected_store ||
      p.expand?.identified_store ||
      walletStores.find((s) => s.id === (p.corrected_store || p.identified_store)) ||
      null
    setReviewSelectedStore(current)
    setReviewNotes(p.review_notes || '')
    setReviewStoreSearch('')
  }

  const filteredStoreOptions = useMemo(() => {
    if (!reviewStoreSearch) return walletStores
    const s = normalizeText(reviewStoreSearch)
    return walletStores.filter(
      (st) => normalizeText(st.name).includes(s) || normalizeText(st.number).includes(s),
    )
  }, [walletStores, reviewStoreSearch])

  const photoUrl = (p: BookPhoto) => (p.image_data ? getFileUrl(p, p.image_data) : null)

  const saveReview = async () => {
    if (!reviewPhoto || !id) return
    setReviewSaving(true)
    try {
      const chosen = reviewSelectedStore
      const originalStoreId = reviewPhoto.identified_store
      const isCorrection = chosen && chosen.id !== originalStoreId
      const fd = new FormData()
      if (chosen) {
        fd.append('identified_store', chosen.id)
        if (isCorrection) {
          fd.append('corrected_store', chosen.id)
          fd.append('identified_store_name', `Revisão manual: ${chosen.name}`)
        }
      }
      fd.append('needs_review', 'false')
      fd.append('review_status', isCorrection ? 'corrected' : 'approved')
      fd.append('reviewed_by', user!.id)
      fd.append('review_notes', reviewNotes)
      await updateBookPhoto(reviewPhoto.id, fd)

      // Recarregar
      await load()
      // Atualizar contadores do book
      const pending = pendingPhotos.filter((p) => p.id !== reviewPhoto.id).length
      await updateBook(id, {
        pending_review: pending,
        status: pending === 0 ? 'reviewed' : 'pending_review',
      })
      if (book)
        setBook({
          ...book,
          pending_review: pending,
          status: pending === 0 ? 'reviewed' : 'pending_review',
        })

      toast({ title: 'Revisão salva', description: 'Foto associada à loja.' })
      setReviewPhoto(null)
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' })
    } finally {
      setReviewSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    try {
      setDeleting(true)
      await deleteBook(id)
      toast({ title: 'Book excluído' })
      navigate('/books')
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    } finally {
      setDeleting(false)
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

  const brand = book.expand?.brand
  const logoUrl = brand ? getFileUrl(brand, brand.logo) : null
  const isAdmin = user?.role === 'administrator'
  const canDelete = isAdmin || book.analyst === user?.id

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/books')}
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
              <h1 className="text-xl font-bold tracking-tight text-slate-900">{book.title}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge
                  variant="outline"
                  className={`text-[11px] ${BOOK_STATUS_BADGE[book.status]}`}
                >
                  {BOOK_STATUS_LABELS[book.status]}
                </Badge>
                {book.analysis_status && (
                  <Badge
                    variant="outline"
                    className={`text-[11px] ${ANALYSIS_STATUS_BADGE[book.analysis_status as AnalysisStatus]}`}
                  >
                    Análise: {ANALYSIS_STATUS_LABELS[book.analysis_status as AnalysisStatus]}
                  </Badge>
                )}
                <span className="text-xs text-slate-500">{brand?.name}</span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-500">
                  Auditoria: {formatDate(book.audit_date)}
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-500">{book.expand?.analyst?.name}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => navigate(`/books/${id}/analysis`)}
            className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200"
          >
            <ScanSearch className="mr-2 h-4 w-4" /> Análise de SKUs
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/books/${id}/notas`)}
            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
          >
            <Award className="mr-2 h-4 w-4" /> Notas
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/books/${id}/export`)}
            className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200"
          >
            <FileDown className="mr-2 h-4 w-4" /> Exportar PDF
          </Button>
          {canDelete && (
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(true)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Excluir
            </Button>
          )}
        </div>{' '}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard
          icon={<FileSpreadsheet className="h-5 w-5" />}
          label="Slides"
          value={book.total_slides || 0}
          color="indigo"
        />
        <SummaryCard
          icon={<ImageIcon className="h-5 w-5" />}
          label="Fotos"
          value={book.total_photos || 0}
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

      {/* Pendentes */}
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
              {pendingPhotos.map((p) => {
                const url = photoUrl(p)
                return (
                  <div
                    key={p.id}
                    className="rounded-lg border border-amber-200 bg-white overflow-hidden"
                  >
                    {url && (
                      <img
                        src={url}
                        alt={`Slide ${p.slide_number}`}
                        className="w-full aspect-square object-cover"
                      />
                    )}
                    <div className="p-2 space-y-1">
                      <p className="text-[10px] text-slate-500 truncate">Slide {p.slide_number}</p>
                      {p.expand?.identified_store && (
                        <p className="text-xs font-medium text-slate-700 truncate">
                          {p.expand.identified_store.number} — {p.expand.identified_store.name}
                        </p>
                      )}
                      <p className="text-[10px] text-amber-700">
                        {p.confidence
                          ? `${Math.round(p.confidence * 100)}% confiança`
                          : 'Sem sugestão'}
                      </p>
                      <Button
                        size="sm"
                        className="w-full h-7 text-xs bg-amber-600 hover:bg-amber-700"
                        onClick={() => openReview(p)}
                      >
                        Revisar
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Identificadas */}
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <StoreIcon className="h-4 w-4 text-slate-400" />
                    <span className="font-medium text-slate-800 text-sm">
                      {g.store ? `${g.store.number} — ${g.store.name}` : 'Sem loja'}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {g.items.length} foto{g.items.length > 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    {g.items.map((p) => {
                      const url = photoUrl(p)
                      return url ? (
                        <img
                          key={p.id}
                          src={url}
                          alt={`Slide ${p.slide_number}`}
                          className="w-full aspect-square object-cover rounded-lg border border-slate-200"
                        />
                      ) : null
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ausentes */}
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
              Lojas previstas na carteira da marca que não apareceram neste book.
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

      {/* Review Drawer */}
      <Sheet open={!!reviewPhoto} onOpenChange={(o) => !o && setReviewPhoto(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {reviewPhoto && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle>Revisar Foto</SheetTitle>
                <SheetDescription>
                  Slide {reviewPhoto.slide_number} · Foto {(reviewPhoto.photo_index || 0) + 1}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4">
                {photoUrl(reviewPhoto) && (
                  <img
                    src={photoUrl(reviewPhoto)!}
                    alt="Foto"
                    className="w-full rounded-lg border border-slate-200 object-contain max-h-72 bg-slate-50"
                  />
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">
                    Texto extraído
                  </Label>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {reviewPhoto.extracted_text || '(sem texto)'}
                  </div>
                </div>
                {reviewPhoto.expand?.identified_store && (
                  <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200">
                    <p className="text-xs font-semibold text-indigo-700 mb-1">
                      Sugestão do sistema
                    </p>
                    <p className="text-sm font-medium text-slate-900">
                      {reviewPhoto.expand.identified_store.number} —{' '}
                      {reviewPhoto.expand.identified_store.name}
                    </p>
                    <p className="text-xs text-indigo-600 mt-0.5">
                      {reviewPhoto.identified_store_name} ·{' '}
                      {reviewPhoto.confidence
                        ? `${Math.round(reviewPhoto.confidence * 100)}%`
                        : '—'}
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

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Book</DialogTitle>
            <DialogDescription>
              Excluir <strong>{book.title}</strong>? Todas as fotos serão removidas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

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
