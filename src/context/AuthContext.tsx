import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import { User } from '@/types'

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (email: string, pass: string) => Promise<User>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    return (pb.authStore.record as unknown as User) || null
  })
  const [token, setToken] = useState<string | null>(pb.authStore.token || null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    const unsub = pb.authStore.onChange((token, record) => {
      setToken(token)
      setUser((record as unknown as User) || null)
    }, true)

    setIsLoading(false)
    return () => unsub()
  }, [])

  const login = async (email: string, pass: string): Promise<User> => {
    const authData = await pb.collection('users').authWithPassword(email, pass)
    const loggedUser = authData.record as unknown as User
    if (!loggedUser.active) {
      pb.authStore.clear()
      throw new Error('Usuário inativo. Entre em contato com o administrador.')
    }
    setUser(loggedUser)
    setToken(authData.token)
    return loggedUser
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
    setToken(null)
  }

  const refreshUser = async () => {
    if (pb.authStore.isValid && pb.authStore.record) {
      const refreshed = await pb.collection('users').authRefresh()
      setUser(refreshed.record as unknown as User)
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider')
  }
  return context
}
