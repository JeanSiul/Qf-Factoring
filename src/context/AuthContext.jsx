import React, { createContext, useContext, useState, useEffect } from 'react'
import { apiCall } from '../utils/api'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

// Mapa de permisos: ClaimType → ruta del Sidebar
// El bit 0 (Vista) controla si se ve el menú
const PERMISOS_MENU = {
  // Seguridad
  USRLIS: '/usuarios',
  ROLLIS: '/roles',
  CFGPER: '/seguridad/modulos-permisos',
  // Parámetros
  TABLIS: '/parametros/tablas',
  ECOLIS: '/parametros/estructura',
  METLIS: '/parametros/metas',
  // Maestros
  EMPLIS: '/maestros/empresarios',
  PAGLIS: '/maestros/pagadores',
  INVLIS: '/maestros/inversionistas',
  // Operaciones
  FACLIS: '/operaciones/facturas',
  OPELIS: '/operaciones/operaciones',
  // Alertas
  ALTDSH: '/alertas/dashboard',
  ALTCAN: '/alertas/canales',
  ALTDES: '/alertas/destinatarios',
  ALTPRO: '/alertas/procesos',
  ALTASI: '/alertas/asignaciones',
  ALTCOL: '/alertas/cola',
  // Inventario
  IVNDSH: '/inventario/dashboard',
  IVNGRP: '/inventario/grupos',
  IVNITM: '/inventario/items',
  IVNASI: '/inventario/asignaciones',
  // Reportes
  RPTINV: '/reportes/inventario',
  RPTFAC: '/reportes/facturas',
  RPTOPE: '/operaciones/reportes',
  // Configuración
  CFGGEN: '/configuracion/general',
}

// Verifica si un bit específico está activo en un ClaimValue
export const hasBit = (permisos, claim, bitIndex) => {
  const value = permisos?.[claim] || '00000000000'
  return value[bitIndex] === '1'
}

// Verifica si tiene Vista (bit 0) para un claim
export const hasVista = (permisos, claim) => hasBit(permisos, claim, 0)

// Verifica si tiene Lista (bit 1) para un claim
export const hasLista = (permisos, claim) => hasBit(permisos, claim, 1)

// Verifica si tiene Ver (bit 3) para un claim
export const hasVer = (permisos, claim) => hasBit(permisos, claim, 3)

// Verifica si tiene Modificar (bit 4) para un claim
export const hasModificar = (permisos, claim) => hasBit(permisos, claim, 4)

// Verifica si tiene Total (bit 5) para un claim
export const hasTotal = (permisos, claim) => hasBit(permisos, claim, 5)

// Verifica si puede ver una ruta específica
export const canAccessRoute = (permisos, path) => {
  // Solo el dashboard principal es libre (siempre accesible)
  if (path === '/dashboard') return true

  // Buscar si algún claim permite esta ruta
  for (const [claim, ruta] of Object.entries(PERMISOS_MENU)) {
    if (path === ruta || path.startsWith(ruta + '/')) {
      return hasVista(permisos, claim)
    }
  }

  // Si no hay regla definida, denegar por defecto (más seguro)
  return false
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [permisos, setPermisos] = useState({})
  const [loading, setLoading] = useState(true)

  // Cargar permisos del usuario
  const cargarPermisos = async (userId) => {
    try {
      const res = await apiCall(`/qf/usuarios/permisos?userId=${userId}`)
      const p = res?.permisos || {}
      setPermisos(p)
      localStorage.setItem('qf_permisos', JSON.stringify(p))
      return p
    } catch (e) {
      console.warn('No se pudieron cargar permisos:', e.message)
      return {}
    }
  }

  useEffect(() => {
    const stored = localStorage.getItem('qf_user')
    const storedPermisos = localStorage.getItem('qf_permisos')
    if (stored) {
      try {
        const u = JSON.parse(stored)
        setUser(u)
        // Cargar permisos del localStorage primero (inmediato)
        if (storedPermisos) {
          try { setPermisos(JSON.parse(storedPermisos)) } catch {}
        }
        // Luego refrescar desde el servidor
        if (u.id) cargarPermisos(u.id)
      } catch {}
    }
    setLoading(false)
  }, [])

  const login = async (userData) => {
    setUser(userData)
    localStorage.setItem('qf_user', JSON.stringify(userData))
    // Cargar permisos inmediatamente después del login
    if (userData.id) {
      await cargarPermisos(userData.id)
    }
  }

  const logout = () => {
    setUser(null)
    setPermisos({})
    localStorage.removeItem('qf_user')
    localStorage.removeItem('qf_permisos')
  }

  return (
    <AuthContext.Provider value={{ user, permisos, login, logout, loading, hasVista, hasLista, hasVer, hasModificar, hasTotal, canAccessRoute }}>
      {children}
    </AuthContext.Provider>
  )
}
