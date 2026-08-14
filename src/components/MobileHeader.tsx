import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  Menu,
  X,
  LayoutDashboard,
  Tag,
  Store,
  Package,
  Users,
  ClipboardList,
  UserCog,
  LogOut,
  FileSpreadsheet,
  AlertTriangle,
  Award,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Logo } from '@/components/Logo'
import { ROLE_BADGE_CLASSES, ROLE_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export const MobileHeader: React.FC = () => {
  const [open, setOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const handleLogout = () => {
    logout()
    navigate('/login')
    setOpen(false)
  }

  const navItems = [
    {
      label: 'Início',
      path: '/',
      icon: LayoutDashboard,
      roles: ['administrator', 'analista_books', 'supervisor', 'gestor'],
    },
    {
      label: 'Marcas',
      path: '/marcas',
      icon: Tag,
      roles: ['administrator', 'analista_books', 'supervisor', 'gestor'],
    },
    {
      label: 'Lojas',
      path: '/lojas',
      icon: Store,
      roles: ['administrator', 'supervisor', 'gestor'],
    },
    {
      label: 'SKUs / Produtos',
      path: '/skus',
      icon: Package,
      roles: ['administrator', 'analista_books', 'supervisor', 'gestor'],
    },
    {
      label: 'Promotores',
      path: '/promotores',
      icon: Users,
      roles: ['administrator', 'analista_books', 'supervisor', 'gestor'],
    },
    {
      label: 'Regras de Auditoria',
      path: '/regras',
      icon: ClipboardList,
      roles: ['administrator', 'analista_books', 'supervisor', 'gestor'],
    },
    {
      label: 'Books',
      path: '/books',
      icon: FileSpreadsheet,
      roles: ['administrator', 'analista_books'],
    },
    {
      label: 'Ruptura',
      path: '/ruptura',
      icon: AlertTriangle,
      roles: ['administrator', 'analista_books', 'supervisor'],
    },
    {
      label: 'Ranking',
      path: '/ranking',
      icon: Award,
      roles: ['administrator', 'analista_books', 'supervisor', 'gestor'],
    },
    { label: 'Usuários', path: '/usuarios', icon: UserCog, roles: ['administrator'] },
  ]

  const allowedNavItems = navItems.filter((item) => item.roles.includes(user.role))

  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'DP'

  return (
    <>
      {/* Fixed Sticky Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:bg-slate-900/90 dark:border-slate-800">
        <Logo size="sm" />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOpen(true)}
          className="text-slate-600 hover:text-slate-900 focus:outline-none"
        >
          <Menu className="h-6 w-6" />
        </Button>
      </header>

      {/* Slide-over Mobile Drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity"
            onClick={() => setOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative flex w-full max-w-xs flex-col bg-white dark:bg-slate-900 shadow-2xl transition-transform duration-300">
            <div className="flex h-16 items-center justify-between px-4 border-b border-slate-100 dark:border-slate-800">
              <Logo size="sm" />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                className="text-slate-500"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {allowedNavItems.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-indigo-50 text-indigo-600 font-semibold dark:bg-indigo-950/60 dark:text-indigo-400'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
                      )
                    }
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </nav>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {user.name}
                  </p>
                  <span
                    className={cn(
                      'inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full border mt-0.5',
                      ROLE_BADGE_CLASSES[user.role],
                    )}
                  >
                    {ROLE_LABELS[user.role]}
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sair do sistema
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
