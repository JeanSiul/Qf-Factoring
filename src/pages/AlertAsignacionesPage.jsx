import React, { useState, useEffect } from 'react'
import { apiCall } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'

const ModalAsignacion = ({ procesos, destinatarios, canales, onClose, onSave }) => {
  const [form, setForm] = useState({
    proceso_id: procesos[0]?.id || '',
    dest_id: destinatarios[0]?.id || '',
    canal_id: canales[0]?.id || '',
    activo: 1,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.proceso_id || !form.dest_id || !form.canal_id) { setError('Todos los campos son requeridos'); return }
    setLoading(true); setError('')
    try {
      await onSave(form)
      onClose()
    } catch (e) {
      setError(e.message || 'Error al guardar')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h3>🔗 Nueva Asignación</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Proceso *</label>
            <select className="form-control" value={form.proceso_id} onChange={e => set('proceso_id', e.target.value)}>
              {procesos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Destinatario *</label>
            <select className="form-control" value={form.dest_id} onChange={e => set('dest_id', e.target.value)}>
              {destinatarios.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Canal *</label>
            <select className="form-control" value={form.canal_id} onChange={e => set('canal_id', e.target.value)}>
              {canales.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          {error && <div style={{ background: '#fce4e4', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>⚠️ {error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <><span className="spinner" />Guardando...</> : '🔗 Crear Asignación'}
          </button>
        </div>
      </div>
    </div>
  )
}

const AlertAsignacionesPage = () => {
  const [asignaciones, setAsignaciones] = useState([])
  const [procesos, setProcesos] = useState([])
  const [destinatarios, setDestinatarios] = useState([])
  const [canales, setCanales] = useState([])
  const [loading, setLoading] = useState(true)
  const [tabActiva, setTabActiva] = useState(null)
  const [modal, setModal] = useState(null)
  const { toasts, show } = useToast()

  const cargar = async () => {
    setLoading(true)
    try {
      const [as, pr, de, ca] = await Promise.all([
        apiCall('/webhook/asignaciones/listar'),
        apiCall('/webhook/procesos/listar'),
        apiCall('/webhook/destinatarios/listar'),
        apiCall('/webhook/canales/listar'),
      ])
      const asArr = Array.isArray(as) ? as : []
      const prArr = Array.isArray(pr) ? pr : []
      setAsignaciones(asArr)
      setProcesos(prArr)
      setDestinatarios(Array.isArray(de) ? de : [])
      setCanales(Array.isArray(ca) ? ca : [])
      if (prArr.length > 0 && !tabActiva) setTabActiva(prArr[0].id)
    } catch (e) {
      show('Error al cargar datos: ' + e.message, 'error')
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const handleSave = async (form) => {
    await apiCall('/webhook/asignaciones/crear', { method: 'POST', body: JSON.stringify(form) })
    show('Asignación creada')
    cargar()
  }

  const handleToggle = async (asig) => {
    try {
      await apiCall('/webhook/asignaciones/actualizar', {
        method: 'POST',
        body: JSON.stringify({ ...asig, activo: asig.activo ? 0 : 1 })
      })
      show('Estado actualizado')
      cargar()
    } catch (e) { show(e.message, 'error') }
  }

  const getNombre = (arr, id, campo = 'nombre') => arr.find(x => x.id === id)?.[campo] || '—'

  const asigsFiltradas = asignaciones.filter(a => a.proceso_id === tabActiva)
  const procesoActivo = procesos.find(p => p.id === tabActiva)

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Montserrat', fontSize: 22, fontWeight: 700, color: 'var(--qf-navy)', marginBottom: 4 }}>🔗 Asignaciones</h1>
        <p style={{ color: 'var(--qf-text-light)', fontSize: 13 }}>Define qué destinatario recibe cada proceso y por qué canal</p>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center' }}><span className="spinner dark" /></div>
      ) : procesos.length === 0 ? (
        <div className="page-card">
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--qf-text-light)', fontSize: 13 }}>
            ⚠️ Primero debes crear al menos un proceso
          </div>
        </div>
      ) : (
        <div className="page-card">
          {/* Tabs por proceso */}
          <div style={{ display: 'flex', borderBottom: '2px solid var(--qf-border)', overflowX: 'auto', background: '#f8fafc' }}>
            {procesos.map(p => (
              <button key={p.id} onClick={() => setTabActiva(p.id)} style={{
                padding: '11px 18px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                border: 'none', background: tabActiva === p.id ? '#fff' : 'none',
                color: tabActiva === p.id ? 'var(--qf-navy)' : 'var(--qf-text-light)',
                borderBottom: tabActiva === p.id ? '2px solid var(--qf-navy)' : '2px solid transparent',
                marginBottom: -2, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {p.nombre}
              </button>
            ))}
          </div>

          <div className="page-card-header" style={{ borderTop: 'none' }}>
            <div>
              <h2>{procesoActivo?.nombre}</h2>
              {procesoActivo?.descripcion && <p style={{ fontSize: 12, color: 'var(--qf-text-light)', margin: 0 }}>{procesoActivo.descripcion}</p>}
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'new' })}>🔗 Nueva Asignación</button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            {asigsFiltradas.length === 0 ? (
              <div className="empty-state"><div className="icon">🔗</div><p>Sin asignaciones para este proceso</p></div>
            ) : (
              <table className="qf-table">
                <thead>
                  <tr>
                    <th>Destinatario</th>
                    <th>Canal</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {asigsFiltradas.map(a => {
                    const nombreDest = a.destinatario_nombre || getNombre(destinatarios, a.dest_id)
                    const codigoCanal = a.canal_codigo || canales.find(c => c.id === a.canal_id)?.codigo || '—'
                    return (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 500 }}>{nombreDest}</td>
                        <td>
                          <code style={{ background: '#e8eef5', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{codigoCanal}</code>
                        </td>
                        <td><span className={`badge ${a.activo ? 'active' : 'inactive'}`}>{a.activo ? 'Activo' : 'Inactivo'}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button className={`btn btn-sm ${a.activo ? 'btn-danger' : 'btn-secondary'}`} onClick={() => handleToggle(a)}>
                              {a.activo ? '⏸ Desactivar' : '▶️ Activar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
          {!loading && (
            <div style={{ padding: '12px 24px', borderTop: '1px solid var(--qf-border)', fontSize: 12, color: 'var(--qf-text-light)' }}>
              {asigsFiltradas.length} asignación(es) para este proceso
            </div>
          )}
        </div>
      )}

      {modal?.type === 'new' && (
        <ModalAsignacion
          procesos={procesos}
          destinatarios={destinatarios}
          canales={canales}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

export default AlertAsignacionesPage
