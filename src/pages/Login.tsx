import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Logo } from '@/components/Logo'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { AlertCircle, Lock, Mail, Loader2, Info } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export const Login: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [forgotOpen, setForgotOpen] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setErrorMsg('Preencha todos os campos.')
      return
    }

    setLoading(true)
    setErrorMsg('')

    try {
      const user = await login(email, password)
      toast({
        title: `Bem-vindo, ${user.name}!`,
        description: 'Autenticado com sucesso.',
      })

      // Redirect by role
      if (user.role === 'analista_books') {
        navigate('/marcas')
      } else {
        const from = (location.state as any)?.from?.pathname || '/'
        navigate(from)
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setErrorMsg(err.message || 'Credenciais inválidas ou falha ao autenticar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-gradient-to-br from-slate-100 via-indigo-50/30 to-emerald-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
      <div className="w-full max-w-md space-y-6">
        <Card className="shadow-xl border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur">
          <CardHeader className="text-center pb-2 pt-8">
            <div className="flex justify-center mb-4">
              <Logo size="lg" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
              Acesse o Sistema
            </CardTitle>
            <CardDescription className="text-slate-500 text-sm">
              Sistema de Auditoria de Books e Execução de PDV
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 px-6 pb-8">
            <form onSubmit={handleLogin} className="space-y-4">
              {errorMsg && (
                <div className="p-3 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-center gap-2 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label
                  htmlFor="email"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  E-mail
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu.email@diretoriapromocoes.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="password"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Senha
                  </Label>
                  <button
                    type="button"
                    onClick={() => setForgotOpen(!forgotOpen)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium dark:text-indigo-400"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 h-10"
                    required
                  />
                </div>
              </div>

              {forgotOpen && (
                <div className="p-3 text-xs bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-lg flex items-start gap-2 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-900">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Para redefinir sua senha, entre em contato com o administrador do sistema
                    através do e-mail <strong>suporte@diretoriapromocoes.com.br</strong>.
                  </span>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md shadow-indigo-600/20 transition-all mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar no Sistema'
                )}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center text-[11px] text-slate-400">
              Acesso restrito a colaboradores da Diretoria de Promoções
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
