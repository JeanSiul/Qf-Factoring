import React from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const StatCard = ({ icon, label, value, color, onClick }) => (
  <div onClick={onClick} style={{
    background: 'white',
    borderRadius: 'var(--qf-radius-lg)',
    padding: '20px 24px',
    boxShadow: 'var(--qf-shadow)',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    cursor: onClick ? 'pointer' : 'default',
    transition: 'transform 0.2s, box-shadow 0.2s',
    borderLeft: `4px solid ${color}`,
  }}
  onMouseEnter={e => { if (onClick) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--qf-shadow-lg)' }}}
  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = 'var(--qf-shadow)' }}
  >
    <div style={{ fontSize: 32 }}>{icon}</div>
    <div>
      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'Montserrat', color: 'var(--qf-navy)' }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--qf-text-light)', marginTop: 2 }}>{label}</div>
    </div>
  </div>
)

const Dashboard = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Montserrat', fontSize: 24, fontWeight: 700, color: 'var(--qf-navy)', marginBottom: 4 }}>
          {greeting}, {user?.nombres?.split(' ')[0] || user?.username} 👋
        </h1>
        <p style={{ color: 'var(--qf-text-light)', fontSize: 14 }}>
          {new Date().toLocaleDateString('es-PE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard icon="👥" label="Usuarios del sistema" value="—" color="var(--qf-blue)" onClick={() => navigate('/usuarios')} />
        <StatCard icon="🏷️" label="Roles configurados" value="—" color="var(--qf-green)" onClick={() => navigate('/roles')} />
        <StatCard icon="🔔" label="AlertManager" value="—" color="var(--qf-yellow)" />
      </div>

      {/* Quick access */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <div className="page-card">
          <div className="page-card-header">
            <h2>⚡ Accesos rápidos</h2>
          </div>
          <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: '👥', label: 'Gestionar Usuarios', path: '/usuarios', color: 'var(--qf-blue)' },
              { icon: '🏷️', label: 'Gestionar Roles', path: '/roles', color: 'var(--qf-green)' },
            ].map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px',
                  background: 'var(--qf-gray)',
                  border: 'none', borderRadius: 'var(--qf-radius)',
                  cursor: 'pointer', transition: 'background 0.15s',
                  textAlign: 'left',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#e8eef5'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--qf-gray)'}
              >
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--qf-text)' }}>{item.label}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--qf-text-light)', fontSize: 12 }}>→</span>
              </button>
            ))}
          </div>
        </div>

        <div className="page-card">
          <div className="page-card-header">
            <h2>ℹ️ Información del sistema</h2>
          </div>
          <div style={{ padding: '16px 24px' }}>
            {[
              { label: 'Usuario', value: user?.username },
              { label: 'Nombre', value: `${user?.nombres || ''} ${user?.apellidos || ''}`.trim() },
              { label: 'Rol', value: user?.roles?.join(', ') || '—' },
              { label: 'Email', value: user?.email || '—' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--qf-border)', fontSize: 13 }}>
                <span style={{ color: 'var(--qf-text-light)', fontWeight: 500 }}>{row.label}</span>
                <span style={{ color: 'var(--qf-text)', fontWeight: 500 }}>{row.value || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
