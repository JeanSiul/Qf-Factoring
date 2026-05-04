import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Cada item puede tener un 'claim' que controla su visibilidad
// Si no tiene claim, siempre se muestra
const menuItems = [
  { icon: '📊', label: 'Dashboard', path: '/dashboard' },
  {
    icon: '🔐', label: 'Seguridad', path: null,
    children: [
      { icon: '👥', label: 'Usuarios', path: '/usuarios', claim: 'USRLIS' },
      { icon: '🏷️', label: 'Roles', path: '/roles', claim: 'ROLLIS' },
    ]
  },
  {
    icon: '🔔', label: 'Alertas', path: null,
    children: [
      { icon: '📊', label: 'Dashboard', path: '/alertas/dashboard' },
      { icon: '📡', label: 'Canales', path: '/alertas/canales' },
      { icon: '👤', label: 'Destinatarios', path: '/alertas/destinatarios' },
      { icon: '⚙️', label: 'Procesos', path: '/alertas/procesos' },
      { icon: '🔗', label: 'Asignaciones', path: '/alertas/asignaciones' },
      { icon: '📬', label: 'Cola de envíos', path: '/alertas/cola' },
    ]
  },
  {
    icon: '📦', label: 'Inventario', path: null,
    children: [
      { icon: '📊', label: 'Dashboard', path: '/inventario/dashboard' },
      { icon: '🗂️', label: 'Grupos y Atributos', path: '/inventario/grupos' },
      { icon: '📦', label: 'Items', path: '/inventario/items' },
      { icon: '👤', label: 'Asignaciones', path: '/inventario/asignaciones' },
    ]
  },
  {
    icon: '💼', label: 'Operaciones', path: null,
    children: [
      { icon: '📊', label: 'Dashboard', path: '/operaciones/dashboard' },
      { icon: '🧾', label: 'Facturas', path: '/operaciones/facturas', claim: 'FACLIS' },
      { icon: '💰', label: 'Finanzas', path: '/operaciones/finanzas' },
      { icon: '📈', label: 'Reportes', path: '/operaciones/reportes' },
    ]
  },
]

const Sidebar = ({ mobileOpen, onClose }) => {
  const { user, permisos, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [expanded, setExpanded] = useState({ '🔐': true, '🔔': false, '📦': false, '💼': false })

  const handleNav = (path) => { navigate(path); if (onClose) onClose() }
  const toggleMenu = (icon) => setExpanded(prev => ({ ...prev, [icon]: !prev[icon] }))
  const isActive = (path) => location.pathname === path
  const isGroupActive = (children) => children?.some(c => location.pathname === c.path)

  // Verifica si un item del menú es visible según permisos
  const isVisible = (item) => {
    // Sin claim = siempre visible
    if (!item.claim) return true
    // Verificar bit 0 (Vista) del claim
    const value = permisos?.[item.claim] || '00000000000'
    return value[0] === '1'
  }

  // Filtra children visibles
  const getVisibleChildren = (children) => {
    if (!children) return []
    return children.filter(c => isVisible(c))
  }

  return (
    <>
      {mobileOpen && <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }} />}
      <aside style={{ ...styles.sidebar, transform: mobileOpen ? 'translateX(0)' : undefined }}>
        <div style={styles.logoArea}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={styles.logoIcon}><span style={{ fontFamily: 'Montserrat', fontWeight: 800, fontSize: 16, color: 'white' }}>QF</span></div>
            <div>
              <div style={styles.logoText}>QF-Factoring</div>
              <div style={styles.logoSub}>Sistema de Gestión</div>
            </div>
          </div>
        </div>
        <nav style={styles.nav}>
          {menuItems.map(item => {
            if (item.children) {
              const visibleChildren = getVisibleChildren(item.children)
              // Si no hay hijos visibles, ocultar el grupo completo
              if (visibleChildren.length === 0) return null
              return (
                <div key={item.icon}>
                  <button onClick={() => toggleMenu(item.icon)} style={{ ...styles.navItem, ...(expanded[item.icon] || isGroupActive(visibleChildren) ? styles.navItemExpanded : {}) }}>
                    <span style={styles.navIcon}>{item.icon}</span>
                    <span style={styles.navLabel}>{item.label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.7, transition: 'transform 0.2s', transform: expanded[item.icon] ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
                  </button>
                  {expanded[item.icon] && (
                    <div style={styles.subMenu}>
                      {visibleChildren.map(child => (
                        <button key={child.path} onClick={() => handleNav(child.path)} style={{ ...styles.navItem, ...styles.subItem, ...(isActive(child.path) ? styles.navItemActive : {}) }}>
                          <span style={styles.navIcon}>{child.icon}</span>
                          <span style={styles.navLabel}>{child.label}</span>
                          {isActive(child.path) && <span style={styles.activeDot} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            // Items sin children
            if (!isVisible(item)) return null
            return (
              <div key={item.icon}>
                <button onClick={() => handleNav(item.path)} style={{ ...styles.navItem, ...(isActive(item.path) ? styles.navItemActive : {}) }}>
                  <span style={styles.navIcon}>{item.icon}</span>
                  <span style={styles.navLabel}>{item.label}</span>
                  {isActive(item.path) && <span style={styles.activeDot} />}
                </button>
              </div>
            )
          })}
        </nav>
        <div style={styles.userArea}>
          <div style={styles.userAvatar}>{user?.nombres?.charAt(0) || user?.username?.charAt(0) || 'U'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.userName}>{user?.nombres || user?.username}</div>
            <div style={styles.userRole}>{user?.roles?.[0] || 'Usuario'}</div>
          </div>
          <button onClick={logout} style={styles.logoutBtn} title="Cerrar sesión">⏏</button>
        </div>
      </aside>
    </>
  )
}

const styles = {
  sidebar: { width: 'var(--sidebar-width)', background: 'var(--qf-navy)', display: 'flex', flexDirection: 'column', height: '100vh', position: 'fixed', left: 0, top: 0, zIndex: 100, boxShadow: '2px 0 12px rgba(0,0,0,0.15)' },
  logoArea: { padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  logoIcon: { width: 38, height: 38, background: 'rgba(255,255,255,0.15)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  logoText: { fontFamily: 'Montserrat', fontWeight: 700, fontSize: 14, color: 'white', lineHeight: 1.2 },
  logoSub: { fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 1 },
  nav: { flex: 1, padding: '12px 0', overflowY: 'auto' },
  navItem: { width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 13.5, fontFamily: 'Inter', fontWeight: 400, cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left', position: 'relative' },
  navItemActive: { background: 'rgba(255,255,255,0.12)', color: 'white', fontWeight: 600 },
  navItemExpanded: { color: 'white' },
  subMenu: { background: 'rgba(0,0,0,0.15)' },
  subItem: { paddingLeft: 36, fontSize: 13 },
  navIcon: { fontSize: 16, width: 20, textAlign: 'center', flexShrink: 0 },
  navLabel: { flex: 1 },
  activeDot: { width: 6, height: 6, borderRadius: '50%', background: '#4CAF50', flexShrink: 0 },
  userArea: { padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 10 },
  userAvatar: { width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, #2D6A9F, #4CAF50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14, fontFamily: 'Montserrat', flexShrink: 0, textTransform: 'uppercase' },
  userName: { fontSize: 12, color: 'white', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userRole: { fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.3 },
  logoutBtn: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 18, cursor: 'pointer', padding: 4, flexShrink: 0, transition: 'color 0.15s' },
}

export default Sidebar
