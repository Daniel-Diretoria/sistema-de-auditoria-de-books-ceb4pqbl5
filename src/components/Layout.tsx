/* Layout Component - A component that wraps the main content of the app
   - Use this file to add a header, footer, or other elements that should be present on every page
   - This component is used in the App.tsx file to wrap the main content of the app */

import React, { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from '@/components/Sidebar'
import { MobileHeader } from '@/components/MobileHeader'
import { useAuth } from '@/context/AuthContext'
import { Eye } from 'lucide-react'

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const { user } = useAuth()
  const location = useLocation()

  // On login screen or unauthenticated, don't show Chrome
  if (location.pathname === '/login' || !user) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Outlet />
      </main>
    )
  }

  const currentYear = new Date().getFullYear()

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col lg:flex-row text-slate-900 dark:text-slate-100">
      <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
      <MobileHeader />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Gestor banner if read only */}
        {user.role === 'gestor' && (
          <div className="bg-amber-500 text-white text-xs font-semibold px-4 py-2 flex items-center justify-center gap-2 shadow-inner">
            <Eye className="h-4 w-4" />
            <span>
              Perfil Gestor: Acesso somente leitura ativado em todas as marcas e relatórios.
            </span>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          <Outlet />
        </main>

        <footer className="hidden lg:block border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 py-4 px-8 text-center text-xs text-slate-500 dark:text-slate-400">
          © {currentYear} Diretoria de Promoções — Sistema de Auditoria de Books e Execução de PDV
        </footer>
      </div>
    </div>
  )
}
