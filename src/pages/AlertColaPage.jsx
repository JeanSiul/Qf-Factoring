import React, { useState, useEffect } from 'react'
import { apiCall } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'

const AlertColaPage = () => {
  const [cola, setCola] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const { toasts, show } = useToast()

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await apiCall('/webhook/cola/listar')
      setCola(Array.isArray(res) ? res : [])
    } catch (e) {
      show('Error al cargar cola: ' + e.message, 'error')
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const getEstado = (item) => {
    if (item.enviado) return { label: 'Enviado', cls: 'active' }
    if (item.intentos >= item.max_intentos) return { label: 'Error', cls: 'inactive' }
    return { label: 'Pendiente', cls: 'warning' }
  }

  const filtrados = cola.filter(c => {
    const matchFiltro = !filtro ||
      c.proceso_codigo?.toLowerCase().includes(filtro.toLowerCase()) ||
      String(c.id).includes(filtro)
    const estado = getEstado(c)
    const matchEstado = filtroEstado === 'todos' ||
      (filtroEstado === 'enviado' && c.enviado) ||
      (filtroEstado === 'error' && !c.enviado && c.intentos >= c.max_intentos) ||
      (filtroEstado === 'pendiente' && !c.enviado && c.intentos < c.max_intentos)
    return matchFiltro && matchEstado
  })

  const stats = {
    total: cola.length,
    enviados: cola.filter(c => c.enviado).length,
    errores: cola.filter(c => !c.enviado && c.intentos >= c.max_intentos).length,
    pendientes: cola.filter(c => !c.enviado && c.intentos < c.max_intentos).length,
  }

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Montserrat', fontSize: 22, fontWeight: 700, color: 'var(--qf-navy)', marginBottom: 4 }}>📬 Cola de Envíos</h1>
        <p style={{ color: 'var(--qf-text-light)', fontSize: 13 }}>Historial y estado de alertas enviadas</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: stats.total, color: 'var(--qf-navy)' },
          { label: 'Enviados', value: stats.enviados, color: '#2e7d32' },
          { label: 'Pendientes', value: stats.pendientes, color: '#e65100' },
          { label: 'Con error', value: stats.errores, color: '#c62828' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: `4px solid ${s.color}` }}>
            <div style={{ fontSize: 11, color: 'var(--qf-text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: 'Montserrat', lineHeight: 1.2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="page-card">
        <div className="page-card-header">
          <h2>Registros</h2>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="filter-input" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ width: 'auto', minWidth: 130 }}>
              <option value="todos">Todos</option>
              <option value="enviado">Enviados</option>
              <option value="pendiente">Pendientes</option>
              <option value="error">Con error</option>
            </select>
            <input className="filter-input" placeholder="🔍 Filtrar..." value={filtro} onChange={e => setFiltro(e.target.value)} />
            <button className="btn btn-secondary btn-sm" onClick={cargar}>🔄 Actualizar</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner dark" /></div>
          ) : filtrados.length === 0 ? (
            <div className="empty-state"><div className="icon">📬</div><p>Cola vacía</p></div>
          ) : (
            <table className="qf-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Proceso</th>
                  <th>Canal</th>
                  <th style={{ textAlign: 'center' }}>Intentos</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(c => {
                  const estado = getEstado(c)
                  return (
                    <tr key={c.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--qf-text-light)' }}>#{c.id}</td>
                      <td><code style={{ background: '#e8eef5', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{c.proceso_codigo || '—'}</code></td>
                      <td style={{ fontSize: 12 }}>{c.canal_codigo || '—'}</td>
                      <td style={{ textAlign: 'center', fontSize: 13 }}>
                        <span style={{ fontWeight: 600, color: c.intentos >= c.max_intentos ? '#c62828' : 'var(--qf-navy)' }}>
                          {c.intentos}/{c.max_intentos}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${estado.cls}`}>{estado.label}</span>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--qf-text-light)' }}>{c.fecha_creacion || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        {!loading && (
          <div style={{ padding: '12px 24px', borderTop: '1px solid var(--qf-border)', fontSize: 12, color: 'var(--qf-text-light)' }}>
            {filtrados.length} de {cola.length} registros
          </div>
        )}
      </div>
    </div>
  )
}

export default AlertColaPage
