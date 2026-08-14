/* Main App Component - Handles routing (using react-router-dom), query client and other providers - use this file to add all routes */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/context/AuthContext'
import { RequireAuth, RequireRole } from '@/components/Guards'
import Layout from './components/Layout'

import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Marcas } from './pages/Marcas'
import { DetalheMarca } from './pages/DetalheMarca'
import { Lojas } from './pages/Lojas'
import { SKUs } from './pages/SKUs'
import { Promotores } from './pages/Promotores'
import { Regras } from './pages/Regras'
import { Usuarios } from './pages/Usuarios'
import { Books } from './pages/Books'
import { ImportBook } from './pages/ImportBook'
import { DetalheBook } from './pages/DetalheBook'
import { AnaliseBook } from './pages/AnaliseBook'
import { Ruptura } from './pages/Ruptura'
import { ImportRuptura } from './pages/ImportRuptura'
import { NotasBook } from './pages/NotasBook'
import { Ranking } from './pages/Ranking'
import NotFound from './pages/NotFound'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/marcas" element={<Marcas />} />
              <Route path="/marcas/:id" element={<DetalheMarca />} />
              <Route path="/lojas" element={<Lojas />} />
              <Route path="/skus" element={<SKUs />} />
              <Route path="/promotores" element={<Promotores />} />
              <Route path="/regras" element={<Regras />} />

              <Route element={<RequireRole allowedRoles={['administrator', 'analista_books']} />}>
                <Route path="/books" element={<Books />} />
                <Route path="/books/import" element={<ImportBook />} />
                <Route path="/books/:id" element={<DetalheBook />} />
                <Route path="/books/:id/analysis" element={<AnaliseBook />} />
                <Route path="/books/:id/notas" element={<NotasBook />} />
              </Route>

              <Route
                element={
                  <RequireRole allowedRoles={['administrator', 'analista_books', 'supervisor']} />
                }
              >
                <Route path="/ruptura" element={<Ruptura />} />
                <Route path="/ruptura/import" element={<ImportRuptura />} />
              </Route>

              <Route element={<RequireRole allowedRoles={['administrator']} />}>
                <Route path="/usuarios" element={<Usuarios />} />
              </Route>

              <Route path="/ranking" element={<Ranking />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
