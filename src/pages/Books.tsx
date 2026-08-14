import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { getBooks, deleteBook, getBrands, getUsers, getFileUrl, formatDate } from '@/services/api'
import { Book, Brand, User, BOOK_STATUS_LABELS, BOOK_STATUS_BADGE } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  FileSpreadsheet,
  Upload,
  Search,
  Loader2,
  Eye,
  Trash2,
  ClipboardCheck,
  Inbox,
  ScanSearch,
} from 'lucide-react'
import { ANALYSIS_STATUS_LABELS, ANALYSIS_STATUS_BADGE, AnalysisStatus } from '@/types'

function summaryText(raw?: string): string {
  if (!raw) return ''
  try {
    const s = JSON.parse(raw) as Record<string, number>
    const presentes = s.presente_pdv || 0
    const ausentes = s.ausente_cobrar || 0
    if (presentes === 0 && ausentes === 0) return ''
    return `${presentes} presentes, ${ausentes} ausentes`
  } catch {
    return ''
  }
}

export const Books: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [books, setBooks] = useState<Book[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('ALL')
  const [analystFilter, setAnalystFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [dateFilter, setDateFilter] = useState('')

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null)
  const [deleting, setDeleting] = useState(false)

  const isAdmin = user?.role === 'administrator'

  const load = async () => {
    try {
      setLoading(true)
      const [b, br] = await Promise.all([getBooks(), getBrands()])
      setBooks(b)
      setBrands(br)
      if (isAdmin) {
        const u = await getUsers()
        setUsers(u)
      }
    } catch (err: any) {
      toast({ title: 'Erro ao carregar books', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    return books.filter((b) => {
      const brandName = b.expand?.brand?.name || ''
      const analystName = b.expand?.analyst?.name || ''
      const matchSearch =
        !search ||
        b.title.toLowerCase().includes(search.toLowerCase()) ||
        b.file_name.toLowerCase().includes(search.toLowerCase()) ||
        brandName.toLowerCase().includes(search.toLowerCase())
      const matchBrand = brandFilter === 'ALL' || b.brand === brandFilter
      const matchAnalyst = analystFilter === 'ALL' || b.analyst === analystFilter
      const matchStatus = statusFilter === 'ALL' || b.status === statusFilter
      const matchDate = !dateFilter || b.audit_date === dateFilter
      return matchSearch && matchBrand && matchAnalyst && matchStatus && matchDate
    })
  }, [books, search, brandFilter, analystFilter, statusFilter, dateFilter])

  const handleDelete = async () => {
    if (!bookToDelete) return
    try {
      setDeleting(true)
      await deleteBook(bookToDelete.id)
      toast({ title: 'Book excluído', description: 'O book e suas fotos foram removidos.' })
      setDeleteOpen(false)
      setBookToDelete(null)
      load()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Books</h1>
          <p className="text-sm text-slate-500">
            Importação e auditoria de books de fotos das lojas (PPTX).
          </p>
        </div>
        <Button
          onClick={() => navigate('/books/import')}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Upload className="mr-2 h-4 w-4" />
          Importar Book
        </Button>
      </div>

      {/* Toolbar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por título, arquivo ou marca..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 bg-white"
            />
          </div>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Marca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas as marcas</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin ? (
            <Select value={analystFilter} onValueChange={setAnalystFilter}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Analista" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os analistas</SelectItem>
                {users
                  .filter((u) => u.role === 'analista_books')
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          ) : (
            <div />
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os status</SelectItem>
              <SelectItem value="processing">Processando</SelectItem>
              <SelectItem value="pending_review">Revisão Pendente</SelectItem>
              <SelectItem value="reviewed">Revisado</SelectItem>
              <SelectItem value="completed">Concluído</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="bg-white"
          />
        </div>
      </Card>

      {/* List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-2" />
          <p className="text-sm text-slate-500">Carregando books...</p>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Inbox className="h-12 w-12 text-slate-300" />
            <div>
              <p className="font-medium text-slate-700">Nenhum book encontrado</p>
              <p className="text-sm">Importe o primeiro book de fotos para começar.</p>
            </div>
            <Button
              onClick={() => navigate('/books/import')}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Upload className="mr-2 h-4 w-4" />
              Importar Book
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Marca</th>
                  {isAdmin && <th className="text-left font-semibold px-4 py-3">Analista</th>}
                  <th className="text-left font-semibold px-4 py-3">Data Auditoria</th>
                  <th className="text-center font-semibold px-4 py-3">Slides</th>
                  <th className="text-center font-semibold px-4 py-3">Fotos</th>
                  <th className="text-center font-semibold px-4 py-3 text-emerald-700">Identif.</th>
                  <th className="text-center font-semibold px-4 py-3 text-amber-700">Pend.</th>
                  <th className="text-center font-semibold px-4 py-3 text-red-700">Ausentes</th>
                  <th className="text-left font-semibold px-4 py-3">Status</th>
                  <th className="text-left font-semibold px-4 py-3">Análise</th>
                  <th className="text-left font-semibold px-4 py-3">Upload</th>
                  <th className="text-right font-semibold px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((b) => {
                  const brand = b.expand?.brand
                  const logoUrl = brand ? getFileUrl(brand, brand.logo) : null
                  return (
                    <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt={brand?.name}
                              className="h-7 w-7 rounded object-contain border border-slate-100 p-0.5 bg-white shrink-0"
                            />
                          ) : (
                            <div className="h-7 w-7 rounded bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-[10px] shrink-0">
                              {brand?.name?.slice(0, 2).toUpperCase() || '?'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">
                              {brand?.name || '—'}
                            </p>
                            <p className="text-xs text-slate-400 truncate max-w-[160px]">
                              {b.title}
                            </p>
                          </div>
                        </div>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-slate-600">
                          {b.expand?.analyst?.name || '—'}
                        </td>
                      )}
                      <td className="px-4 py-3 text-slate-600">{formatDate(b.audit_date)}</td>
                      <td className="px-4 py-3 text-center text-slate-600">
                        {b.total_slides ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">
                        {b.total_photos ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-emerald-700">
                        {b.identified_stores ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-amber-700">
                        {b.pending_review ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold text-red-700">
                        {b.missing_stores ?? 0}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={`text-[11px] ${BOOK_STATUS_BADGE[b.status]}`}
                        >
                          {BOOK_STATUS_LABELS[b.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/books/${b.id}/analysis`)}
                          className="flex flex-col items-start gap-1 text-left hover:opacity-80"
                          title="Abrir análise de SKUs"
                        >
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              ANALYSIS_STATUS_BADGE[
                                (b.analysis_status as AnalysisStatus) || 'pending'
                              ]
                            }`}
                          >
                            {
                              ANALYSIS_STATUS_LABELS[
                                (b.analysis_status as AnalysisStatus) || 'pending'
                              ]
                            }
                          </Badge>
                          {b.analysis_summary && (
                            <span className="text-[10px] text-slate-500">
                              {summaryText(b.analysis_summary)}
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDate(b.created)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                            onClick={() => navigate(`/books/${b.id}`)}
                            title="Ver detalhes"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                            onClick={() => navigate(`/books/${b.id}/analysis`)}
                            title="Análise de SKUs"
                          >
                            <ScanSearch className="h-4 w-4" />
                          </Button>
                          {b.status === 'pending_review' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-amber-600"
                              onClick={() => navigate(`/books/${b.id}`)}
                              title="Continuar revisão"
                            >
                              <ClipboardCheck className="h-4 w-4" />
                            </Button>
                          )}
                          {(isAdmin || b.analyst === user?.id) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-red-600"
                              onClick={() => {
                                setBookToDelete(b)
                                setDeleteOpen(true)
                              }}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Empty hint icon helper */}
      <div className="hidden">
        <FileSpreadsheet />
      </div>

      {/* Delete Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Book</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o book <strong>{bookToDelete?.title}</strong>? Todas as
              fotos e dados associados serão removidos permanentemente.
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
