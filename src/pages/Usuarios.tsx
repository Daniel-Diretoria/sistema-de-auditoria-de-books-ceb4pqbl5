import React, { useEffect, useState } from 'react'
import { getUsers, createUser, updateUser, deleteUser, getBrands } from '@/services/api'
import { User, Brand, ROLE_LABELS, ROLE_BADGE_CLASSES, UserRole } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { useToast } from '@/hooks/use-toast'
import {
  UserPlus,
  Search,
  Edit2,
  Trash2,
  ShieldCheck,
  UserCheck,
  UserX,
  Loader2,
} from 'lucide-react'

export const Usuarios: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form states
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('analista_books')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [active, setActive] = useState(true)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)

  const { toast } = useToast()
  const { user: currentUser } = useAuth()

  const loadData = async () => {
    try {
      setLoading(true)
      const [uList, bList] = await Promise.all([getUsers(), getBrands()])
      setUsers(uList)
      setBrands(bList)
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar usuários',
        description: err.message,
        variant: 'destructive',
      })
    }
    {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenDrawer = (u?: User) => {
    if (u) {
      setEditingUser(u)
      setName(u.name)
      setEmail(u.email)
      setRole(u.role)
      setActive(u.active !== false)
      setPassword('')
      setConfirmPassword('')
    } else {
      setEditingUser(null)
      setName('')
      setEmail('')
      setRole('analista_books')
      setActive(true)
      setPassword('')
      setConfirmPassword('')
    }
    setDrawerOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !role) {
      toast({
        title: 'Atenção',
        description: 'Preencha os campos obrigatórios.',
        variant: 'destructive',
      })
      return
    }

    if (!editingUser) {
      if (!password || password.length < 8) {
        toast({
          title: 'Senha inválida',
          description: 'A senha deve ter no mínimo 8 caracteres.',
          variant: 'destructive',
        })
        return
      }
      if (password !== confirmPassword) {
        toast({
          title: 'Senhas não conferem',
          description: 'A confirmação de senha é diferente.',
          variant: 'destructive',
        })
        return
      }
    } else if (password) {
      if (password.length < 8) {
        toast({
          title: 'Senha inválida',
          description: 'A senha deve ter no mínimo 8 caracteres.',
          variant: 'destructive',
        })
        return
      }
      if (password !== confirmPassword) {
        toast({
          title: 'Senhas não conferem',
          description: 'A confirmação de senha é diferente.',
          variant: 'destructive',
        })
        return
      }
    }

    try {
      setSubmitting(true)
      if (editingUser) {
        const payload: Record<string, any> = {
          name,
          email,
          role,
          active,
        }
        if (password) {
          payload.password = password
          payload.passwordConfirm = password
        }
        await updateUser(editingUser.id, payload)
        toast({ title: 'Sucesso', description: 'Usuário atualizado com sucesso.' })
      } else {
        const payload: Record<string, any> = {
          name,
          email,
          role,
          active,
          password,
          passwordConfirm: password,
        }
        await createUser(payload)
        toast({ title: 'Sucesso', description: 'Usuário criado com sucesso.' })
      }
      setDrawerOpen(false)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err.message || 'Verifique se o e-mail já não está em uso.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!userToDelete) return

    // Check if it's the last admin
    if (userToDelete.role === 'administrator') {
      const activeAdmins = users.filter((u) => u.role === 'administrator' && u.active)
      if (activeAdmins.length <= 1) {
        toast({
          title: 'Operação não permitida',
          description: 'Não é possível excluir o único administrador ativo do sistema.',
          variant: 'destructive',
        })
        setDeleteDialogOpen(false)
        return
      }
    }

    try {
      await deleteUser(userToDelete.id)
      toast({ title: 'Sucesso', description: 'Usuário excluído com sucesso.' })
      setDeleteDialogOpen(false)
      setUserToDelete(null)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Gestão de Usuários</h1>
          <p className="text-sm text-slate-500">
            Gerencie os acessos, permissões e perfis dos colaboradores no sistema.
          </p>
        </div>
        <Button onClick={() => handleOpenDrawer()} className="bg-indigo-600 hover:bg-indigo-700">
          <UserPlus className="mr-2 h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      {/* Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-4 rounded-xl text-white flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-indigo-400 shrink-0" />
        <p className="text-xs sm:text-sm text-slate-200">
          Apenas Administradores podem visualizar, criar e editar contas de usuários no sistema.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 bg-white"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th className="p-4">Usuário</th>
                <th className="p-4">E-mail</th>
                <th className="p-4">Perfil</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Carregando usuários...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-medium text-slate-900">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="block font-semibold">{u.name}</span>
                          {currentUser?.id === u.id && (
                            <span className="text-[10px] text-indigo-600 font-semibold">
                              (Você)
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-slate-600">{u.email}</td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${ROLE_BADGE_CLASSES[u.role]}`}
                      >
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="p-4">
                      {u.active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <UserCheck className="h-3 w-3" /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                          <UserX className="h-3 w-3" /> Inativo
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDrawer(u)}
                        className="h-8 w-8 text-slate-500 hover:text-indigo-600"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setUserToDelete(u)
                          setDeleteDialogOpen(true)
                        }}
                        disabled={currentUser?.id === u.id}
                        className="h-8 w-8 text-slate-500 hover:text-red-600 disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Slide-over Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</SheetTitle>
            <SheetDescription>
              {editingUser
                ? 'Atualize as permissões do colaborador.'
                : 'Cadastre um novo colaborador no sistema.'}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="u-name">Nome Completo *</Label>
              <Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-email">E-mail *</Label>
              <Input
                id="u-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-role">Perfil de Acesso *</Label>
              <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o perfil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="administrator">Administrador</SelectItem>
                  <SelectItem value="analista_books">Analista de Books</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 pt-2">
              <Label htmlFor="u-pass">
                {editingUser ? 'Nova Senha (opcional)' : 'Senha (mínimo 8 caracteres) *'}
              </Label>
              <Input
                id="u-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!editingUser}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="u-cpass">Confirmar Senha</Label>
              <Input
                id="u-cpass"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required={!editingUser || password.length > 0}
              />
            </div>

            {editingUser && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <Label htmlFor="u-active" className="cursor-pointer">
                  Usuário Ativo
                </Label>
                <Switch id="u-active" checked={active} onCheckedChange={setActive} />
              </div>
            )}

            <SheetFooter className="pt-6">
              <Button type="button" variant="outline" onClick={() => setDrawerOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingUser ? 'Atualizar Usuário' : 'Criar Usuário'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Usuário</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover o usuário <strong>{userToDelete?.name}</strong>? Esta
              ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
