import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { UserRole } from '@/types'
import { useToast } from '@/hooks/use-toast'

export const RequireAuth: React.FC = () => {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
          <span className="text-sm font-medium text-slate-600">Carregando sistema...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}

export const RequireRole: React.FC<{ allowedRoles: UserRole[] }> = ({ allowedRoles }) => {
  const { user } = useAuth()
  const { toast } = useToast()

  if (!user) return <Navigate to="/login" replace />

  if (!allowedRoles.includes(user.role)) {
    toast({
      title: 'Acesso negado',
      description: 'Você não possui permissão para acessar esta página.',
      variant: 'destructive',
    })
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
