import React, { useState, useEffect } from 'react'
import { apiCall } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'

const AlertDashboardPage = () => {
  const [stats, setStats] = useState(null)
  const [cola, setCola] = useState([])
  const [canales, setCanales] = useState([])
  const [loading, setLoading] = useState(true)
  const { toasts, show } = useToast()

  const cargar = async () => {
    setLoading(true)
    try {
      const [st, co, ca] = await Promise.all([
        apiCall('/dashboard/stats'),
        apiCall('/cola/listar'),
        apiCall('/canales/listar'),
      ])
      setStats(Array.isArray(st) ? st[0] : st)
      setCola(Array.isArray(co) ? co.slice(0, 5) : [])
      setCanales(Array.isArray(ca) ? ca : [])
    } catch (e) {
      show('Error al cargar dashboard: ' + e.message, 'error')
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const getEstadoCola = (item) => {
    if (item.enviado) return { label: 'Enviado', color: '#2e7d32', bg: '#e8f5e9' }
    if (item.intentos >= item.max_intentos) return { label: 'Error', color: '#c62828', bg: '#fce4e4' }
    return { label: 'Pendiente', color: '#e65100', bg: '#fff3e0' }
  }

  const metrics = [
    { label: 'Pendientes en cola', value: stats?.pendientes ?? '—', sub: 'esperando envío', color: '#e65100', border: '#ff9800' },
    { label: 'Enviadas hoy', value: stats?.enviadas_hoy ?? '—', sub: 'exitosas', color: '#2e7d32', border: '#4caf50' },
    { label: 'Con error', value: stats?.con_error ?? '—', sub: 'max intentos alcanzados', color: '#c62828', border: '#f44336' },
    { label: 'Procesos activos', value: stats?.procesos_activos ?? '—', sub: 'configurados', color: '#185FA5', border: '#2196f3' },
  ]

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />

      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: 'Montserrat', fontSize: 22, fontWeight: 700, color: 'var(--qf-navy)', marginBottom: 4 }}>🔔 Dashboard Alertas</h1>
          <p style={{ color: 'var(--qf-text-light)', fontSize: 13 }}>Resumen del sistema de alertas</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={cargar} disabled={loading}>
          🔄 Actualizar
        </button>
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
        {metrics.map(m => (
          <div key={m.label} style={{
            background: '#fff', borderRadius: 12, padding: '20px 24px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            borderTop: `3px solid ${m.border}`,
          }}>
            <div style={{ fontSize: 11, color: 'var(--qf-text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              {m.label}
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: m.color, fontFamily: 'Montserrat', lineHeight: 1 }}>
              {loading ? '…' : m.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--qf-text-light)', marginTop: 4 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Grid cola + canales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>

        {/* Cola reciente */}
        <div className="page-card" style={{ margin: 0 }}>
          <div className="page-card-header" style={{ paddingBottom: 12 }}>
            <h2>Cola reciente</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <div style={{ padding: 30, textAlign: 'center' }}><span className="spinner dark" /></div>
            ) : cola.length === 0 ? (
              <div className="empty-state" style={{ padding: 30 }}><p>Cola vacía</p></div>
            ) : (
              <table className="qf-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Proceso</th>
                    <th>Canal</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {cola.map(c => {
                    const est = getEstadoCola(c)
                    return (
                      <tr key={c.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--qf-text-light)' }}>#{c.id}</td>
                        <td>
                          <code style={{ background: '#e8eef5', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                            {c.proceso_codigo || '—'}
                          </code>
                        </td>
                        <td>
                          <code style={{ background: '#e8eef5', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                            {c.canal_codigo || '—'}
                          </code>
                        </td>
                        <td>
                          <span style={{
                            background: est.bg, color: est.color,
                            borderRadius: 20, padding: '2px 10px',
                            fontSize: 11, fontWeight: 600,
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: est.color, display: 'inline-block' }} />
                            {est.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Canales configurados */}
        <div className="page-card" style={{ margin: 0 }}>
          <div className="page-card-header" style={{ paddingBottom: 12 }}>
            <h2>Canales configurados</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <div style={{ padding: 30, textAlign: 'center' }}><span className="spinner dark" /></div>
            ) : canales.length === 0 ? (
              <div className="empty-state" style={{ padding: 30 }}><p>Sin canales</p></div>
            ) : (
              <table className="qf-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Código</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {canales.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>{c.nombre}</td>
                      <td>
                        <code style={{ background: '#e8eef5', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                          {c.codigo}
                        </code>
                      </td>
                      <td>
                        <span className={`badge ${c.activo ? 'active' : 'inactive'}`}>
                          {c.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

export default AlertDashboardPage
