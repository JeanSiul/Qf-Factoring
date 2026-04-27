import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--qf-gray)' }}>
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <main style={{
        marginLeft: 'var(--sidebar-width)',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}>
        {/* Mobile topbar */}
        <div style={styles.mobileTopbar}>
          <button onClick={() => setMobileOpen(true)} style={styles.menuBtn}>☰</button>
          <span style={styles.mobileTitle}>QF-Factoring</span>
        </div>

        <div style={{ padding: '24px', flex: 1 }}>
          <Outlet />
        </div>
      </main>

      <style>{`
        @media (max-width: 768px) {
          main { margin-left: 0 !important; }
          .mobile-topbar { display: flex !important; }
          aside { transform: translateX(-100%); transition: transform 0.3s ease; }
          aside.open { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}

const styles = {
  mobileTopbar: {
    display: 'none',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    background: 'var(--qf-navy)',
    color: 'white',
  },
  menuBtn: {
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: 22,
    cursor: 'pointer',
    padding: 0,
  },
  mobileTitle: {
    fontFamily: 'Montserrat',
    fontWeight: 700,
    fontSize: 16,
  },
}

export default Layout
