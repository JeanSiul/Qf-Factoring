import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import UsuariosPage from './pages/UsuariosPage'
import RolesPage from './pages/RolesPage'
import AlertDashboardPage from './pages/AlertDashboardPage'
import AlertCanalesPage from './pages/AlertCanalesPage'
import AlertDestinatariosPage from './pages/AlertDestinatariosPage'
import AlertProcesosPage from './pages/AlertProcesosPage'
import AlertAsignacionesPage from './pages/AlertAsignacionesPage'
import AlertColaPage from './pages/AlertColaPage'
import InvDashboardPage from './pages/InvDashboardPage'
import InvGruposPage from './pages/InvGruposPage'
import InvItemsPage from './pages/InvItemsPage'
import InvAsignacionesPage from './pages/InvAsignacionesPage'
import Layout from './components/Layout'
import OperacionesFacturasPage from './pages/OperacionesFacturasPage'
import PermisosModulosPage from './pages/PermisosModulosPage'
import DevolucionesPage from './pages/DevolucionesPage'
import ControlInversionistas from './pages/ControlInversionistas'
import DashboardOperacionesBI from './pages/DashboardOperacionesBI'
import GerenciaBI from './pages/GerenciaBI'

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--qf-navy)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 28, color: 'white', marginBottom: 16 }}>QF-Factoring</div>
        <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/dashboard" replace /> : children
}

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="usuarios" element={<UsuariosPage />} />
          <Route path="roles" element={<RolesPage />} />
          {/* Alertas */}
          <Route path="alertas/dashboard" element={<AlertDashboardPage />} />
          <Route path="alertas/canales" element={<AlertCanalesPage />} />
          <Route path="alertas/destinatarios" element={<AlertDestinatariosPage />} />
          <Route path="alertas/procesos" element={<AlertProcesosPage />} />
          <Route path="alertas/asignaciones" element={<AlertAsignacionesPage />} />
          <Route path="alertas/cola" element={<AlertColaPage />} />
          {/* Inventario */}
          <Route path="inventario/dashboard" element={<InvDashboardPage />} />
          <Route path="inventario/grupos" element={<InvGruposPage />} />
          <Route path="inventario/items" element={<InvItemsPage />} />
          <Route path="inventario/asignaciones" element={<InvAsignacionesPage />} />
          <Route path="/operaciones/facturas" element={<OperacionesFacturasPage />} />
          <Route path="/seguridad/modulos-permisos" element={<PermisosModulosPage />} />
          <Route path="/operaciones/devoluciones" element={<DevolucionesPage />} />
          <Route path="/operaciones/inversionistas" element={<ControlInversionistas />} />
          <Route path="/operaciones/dashboard-bi" element={<DashboardOperacionesBI />} />
          <Route path="/gerencia-bi" element={<GerenciaBI />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
)

export default App
