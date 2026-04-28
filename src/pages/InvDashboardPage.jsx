import React, { useState, useEffect } from 'react'
import { apiCall } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'
import { useNavigate } from 'react-router-dom'

const InvDashboardPage = () => {
  const [items, setItems] = useState([])
  const [asignados, setAsignados] = useState([])
  const [grupos, setGrupos] = useState([])
  const [loading, setLoading] = useState(true)
  const { toasts, show } = useToast()
  const navigate = useNavigate()

  const cargar = async () => {
    setLoading(true)
    try {
      const [it, as, gr] = await Promise.all([
        apiCall('/qf/inv/items/listar'),
        apiCall('/qf/inv/asignaciones/listar'),
        apiCall('/qf/inv/grupos/listar'),
      ])
      setItems(Array.isArray(it) ? it : [])
      setAsignados(Array.isArray(as) ? as : [])
      setGrupos(Array.isArray(gr) ? gr : [])
    } catch (e) {
      show('Error al cargar dashboard: ' + e.message, 'error')
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  // Stats
  const total = items.length
  const disponibles = items.filter(i => i.estado === 'disponible').length
  const asignadosCount = items.filter(i => i.estado === 'asignado').length
  const reparacion = items.filter(i => i.estado === 'reparacion').length
  const baja = items.filter(i => i.estado === 'baja').length

  // Items por grupo
  const porGrupo = grupos.map(g => ({
    ...g,
    total: items.filter(i => i.grupo_id === g.id).length,
    disponibles: items.filter(i => i.grupo_id === g.id && i.estado === 'disponible').length,
    asignados: items.filter(i => i.grupo_id === g.id && i.estado === 'asignado').length,
  })).filter(g => g.total > 0)

  // Últimas asignaciones (5 más recientes)
  const ultimasAsignaciones = [...asignados]
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .slice(0, 5)

  const metrics = [
    { label: 'Total items', value: total, sub: 'en inventario', color: 'var(--qf-navy)', border: '#2196f3' },
    { label: 'Disponibles', value: disponibles, sub: 'sin asignar', color: '#2e7d32', border: '#4caf50' },
    { label: 'Asignados', value: asignadosCount, sub: 'en uso', color: '#e65100', border: '#ff9800' },
    { label: 'En reparación', value: reparacion, sub: 'fuera de servicio', color: '#c62828', border: '#f44336' },
  ]

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />

      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: 'Montserrat', fontSize: 22, fontWeight: 700, color: 'var(--qf-navy)', marginBottom: 4 }}>📦 Dashboard Inventario</h1>
          <p style={{ color: 'var(--qf-text-light)', fontSize: 13 }}>Resumen general del inventario</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={cargar} disabled={loading}>🔄 Actualizar</button>
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
        {metrics.map(m => (
          <div key={m.label} style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderTop: `3px solid ${m.border}` }}>
            <div style={{ fontSize: 11, color: 'var(--qf-text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: m.color, fontFamily: 'Montserrat', lineHeight: 1 }}>
              {loading ? '…' : m.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--qf-text-light)', marginTop: 4 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Grid principal */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>

        {/* Items por grupo */}
        <div className="page-card" style={{ margin: 0 }}>
          <div className="page-card-header">
            <h2>Items por Grupo</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/inventario/items')}>Ver todos</button>
          </div>
          {loading ? (
            <div style={{ padding: 30, textAlign: 'center' }}><span className="spinner dark" /></div>
          ) : porGrupo.length === 0 ? (
            <div className="empty-state"><p>Sin items registrados</p></div>
          ) : (
            <div style={{ padding: '0 0 8px' }}>
              {porGrupo.map(g => {
                const pct = g.total > 0 ? Math.round((g.asignados / g.total) * 100) : 0
                return (
                  <div key={g.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--qf-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--qf-navy)' }}>{g.nombre}</span>
                        <code style={{ marginLeft: 8, background: '#e8eef5', padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700 }}>{g.codigo}</code>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--qf-navy)' }}>{g.total} items</span>
                    </div>
                    {/* Barra de progreso */}
                    <div style={{ height: 6, background: '#e8eef5', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: pct > 80 ? '#f44336' : pct > 50 ? '#ff9800' : '#4caf50', borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: 'var(--qf-text-light)' }}>
                      <span>✅ {g.disponibles} disponibles</span>
                      <span>📤 {g.asignados} asignados ({pct}%)</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Últimas asignaciones */}
        <div className="page-card" style={{ margin: 0 }}>
          <div className="page-card-header">
            <h2>Últimas Asignaciones</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/inventario/asignaciones')}>Ver todas</button>
          </div>
          {loading ? (
            <div style={{ padding: 30, textAlign: 'center' }}><span className="spinner dark" /></div>
          ) : ultimasAsignaciones.length === 0 ? (
            <div className="empty-state"><p>Sin asignaciones</p></div>
          ) : (
            <table className="qf-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Asignado a</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {ultimasAsignaciones.map(a => (
                  <tr key={a.asignacion_id}>
                    <td>
                      <code style={{ background: '#e8eef5', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{a.codigo}</code>
                      <div style={{ fontSize: 11, color: 'var(--qf-text-light)', marginTop: 2 }}>{a.item_nombre}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #2D6A9F, #4CAF50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 9, flexShrink: 0 }}>
                          {a.usuario_nombre?.charAt(0) || '?'}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{a.usuario_nombre}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--qf-text-light)' }}>
                      {a.fecha ? new Date(a.fecha).toLocaleDateString('es-PE') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Items en reparación o baja */}
        {(reparacion > 0 || baja > 0) && (
          <div className="page-card" style={{ margin: 0 }}>
            <div className="page-card-header">
              <h2>⚠️ Requieren atención</h2>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="qf-table">
                <thead>
                  <tr><th>Código</th><th>Item</th><th>Grupo</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {items.filter(i => i.estado === 'reparacion' || i.estado === 'baja').map(i => (
                    <tr key={i.id}>
                      <td><code style={{ background: '#fce4e4', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{i.codigo}</code></td>
                      <td style={{ fontSize: 12 }}>{i.nombre}</td>
                      <td style={{ fontSize: 11, color: 'var(--qf-text-light)' }}>{i.grupo_nombre}</td>
                      <td>
                        <span className="badge inactive">
                          {i.estado === 'reparacion' ? '🔧 Reparación' : '❌ Baja'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default InvDashboardPage
