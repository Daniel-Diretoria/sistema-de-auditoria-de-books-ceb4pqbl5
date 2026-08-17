import React, { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Tag,
  Store,
  Package,
  Users,
  ClipboardList,
  UserCog,
  LogOut,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  AlertTriangle,
  Award,
  Scale,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Logo } from '@/components/Logo'
import { ROLE_BADGE_CLASSES, ROLE_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggleCollapse }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const handleLogout = () => {
    logout()
    navigate('/login')
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
    {
      label: 'Comparação',
      path: '/comparacao',
      icon: Scale,
      roles: ['administrator', 'analista_books', 'supervisor'],
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
    <aside
      className={cn(
        'hidden lg:flex flex-col border-r border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 transition-all duration-300 relative z-20 h-screen sticky top-0',
        collapsed ? 'w-[72px]' : 'w-[280px]',
      )}
    >
      {/* Header / Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-slate-100 dark:border-slate-800">
        <Logo collapsed={collapsed} size="sm" />
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          className="h-8 w-8 text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg shrink-0"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {allowedNavItems.map((item) => {
          const Icon = item.icon
          const navLink = (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative group',
                  isActive
                    ? 'bg-indigo-50 text-indigo-600 font-semibold dark:bg-indigo-950/60 dark:text-indigo-400'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      'h-5 w-5 shrink-0 transition-colors',
                      isActive
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-400 group-hover:text-slate-600',
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                  {isActive && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-indigo-600 rounded-r dark:bg-indigo-400" />
                  )}
                </>
              )}
            </NavLink>
          )

          if (collapsed) {
            return (
              <Tooltip key={item.path} delayDuration={100}>
                <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            )
          }

          return navLink
        })}
      </nav>

      {/* Footer / User Card */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <div className={cn('flex items-center gap-3', collapsed ? 'justify-center' : '')}>
          <div className="h-10 w-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate leading-tight">
                {user.name}
              </p>
              <div className="mt-0.5">
                <span
                  className={cn(
                    'inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full border',
                    ROLE_BADGE_CLASSES[user.role],
                  )}
                >
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
            </div>
          )}
          {collapsed ? (
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sair</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              title="Sair do sistema"
              className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  )
}
