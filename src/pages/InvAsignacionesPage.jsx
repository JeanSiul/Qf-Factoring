import React, { useState, useEffect } from 'react'
import { apiCall } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'
import { useAuth } from '../context/AuthContext'

const toArray = (res) => {
  if (!res || res === 1 || typeof res === 'number' || typeof res === 'boolean') return []
  if (Array.isArray(res)) return res.filter(i => i && typeof i === 'object' && i.id != null)
  if (typeof res === 'string') {
    try {
      const p = JSON.parse(res)
      if (Array.isArray(p)) return p.filter(i => i && typeof i === 'object' && i.id != null)
      if (p && typeof p === 'object' && p.id != null) return [p]
    } catch { return [] }
  }
  if (typeof res === 'object' && res.id != null) return [res]
  return []
}

const ModalAsignar = ({ item, usuarios, onClose, onSave, isReasignacion = false }) => {
  const [form, setForm] = useState({ usuario_id: '', usuario_nombre: '', observacion: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleUsuario = (e) => {
    const u = usuarios.find(u => u.id === e.target.value)
    setForm(f => ({ ...f, usuario_id: u?.id || '', usuario_nombre: u ? `${u.nombres} ${u.apellidos}`.trim() : '' }))
  }

  const handleSubmit = async () => {
    if (!form.usuario_id) { setError('Selecciona un usuario'); return }
    setLoading(true); setError('')
    try { await onSave({ ...form, item_id: item.item_id || item.id, accion: isReasignacion ? 'reasignacion' : 'asignacion' }); onClose() }
    catch (e) { setError(e.message || 'Error al guardar') }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h3>{isReasignacion ? '🔄 Reasignar Item' : '👤 Asignar Item'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ background: '#e8eef5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
            <strong>{item.codigo}</strong> — {item.item_nombre || item.nombre}
            {isReasignacion && item.usuario_nombre && <div style={{ fontSize: 11, color: 'var(--qf-text-light)', marginTop: 4 }}>Actualmente: <strong>{item.usuario_nombre}</strong></div>}
          </div>
          <div className="form-group">
            <label className="form-label">Asignar a *</label>
            <select className="form-control" value={form.usuario_id} onChange={handleUsuario}>
              <option value="">Seleccionar usuario...</option>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombres} {u.apellidos} ({u.userName})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Observación</label>
            <textarea className="form-control" value={form.observacion} onChange={e => setForm(f => ({ ...f, observacion: e.target.value }))} rows={2} style={{ resize: 'vertical' }} placeholder="Motivo de la asignación..." />
          </div>
          {error && <div style={{ background: '#fce4e4', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>⚠️ {error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <><span className="spinner" />Guardando...</> : isReasignacion ? '🔄 Reasignar' : '👤 Asignar'}
          </button>
        </div>
      </div>
    </div>
  )
}

const ModalDevolver = ({ item, onClose, onSave }) => {
  const [observacion, setObservacion] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    try { await onSave({ item_id: item.item_id, usuario_id: item.usuario_id, usuario_nombre: item.usuario_nombre, observacion }); onClose() }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h3>↩️ Registrar Devolución</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ background: '#e8eef5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
            <strong>{item.codigo}</strong> — {item.item_nombre}<br />
            <span style={{ fontSize: 11, color: 'var(--qf-text-light)' }}>Asignado a: <strong>{item.usuario_nombre}</strong></span>
          </div>
          <div className="form-group">
            <label className="form-label">Observación</label>
            <textarea className="form-control" value={observacion} onChange={e => setObservacion(e.target.value)} rows={2} style={{ resize: 'vertical' }} placeholder="Motivo de devolución..." />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-warning" onClick={handleSubmit} disabled={loading}>
            {loading ? <><span className="spinner" style={{ borderTopColor: '#333' }} />Guardando...</> : '↩️ Confirmar devolución'}
          </button>
        </div>
      </div>
    </div>
  )
}

const ModalHistorial = ({ item, onClose }) => {
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiCall(`/qf/inv/asignaciones/historial?itemId=${item.item_id}`)
      .then(res => {
        const arr = Array.isArray(res) ? res
          : (res?.data ? (Array.isArray(res.data) ? res.data : [res.data])
          : (res && res.id ? [res] : []))
        setHistorial(arr.filter(h => h && h.id))
      })
      .finally(() => setLoading(false))
  }, [item.item_id])

  const accionLabel = {
    asignacion: { label: 'Asignación', color: '#2e7d32', bg: '#e8f5e9' },
    reasignacion: { label: 'Reasignación', color: '#e65100', bg: '#fff3e0' },
    devolucion: { label: 'Devolución', color: '#185FA5', bg: '#e3f2fd' }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h3>📋 Historial — {item.codigo}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {loading ? <div style={{ padding: 30, textAlign: 'center' }}><span className="spinner dark" /></div>
            : historial.length === 0 ? <div className="empty-state"><p>Sin historial</p></div>
            : (
              <table className="qf-table">
                <thead><tr><th>Acción</th><th>Usuario</th><th>Realizado por</th><th>Fecha</th><th>Observación</th></tr></thead>
                <tbody>
                  {historial.map(h => {
                    const ac = accionLabel[h.accion] || { label: h.accion, color: '#666', bg: '#eee' }
                    return (
                      <tr key={h.id}>
                        <td><span style={{ background: ac.bg, color: ac.color, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>{ac.label}</span></td>
                        <td style={{ fontSize: 12, fontWeight: 500 }}>{h.usuario_nombre || '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--qf-text-light)' }}>{h.usr_realizo || '—'}</td>
                        <td style={{ fontSize: 11, color: 'var(--qf-text-light)' }}>{h.fecha ? new Date(h.fecha).toLocaleString('es-PE') : '—'}</td>
                        <td style={{ fontSize: 12, color: 'var(--qf-text-light)' }}>{h.observacion || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
        </div>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Cerrar</button></div>
      </div>
    </div>
  )
}

const InvAsignacionesPage = () => {
  const { user } = useAuth()
  const [asignados, setAsignados] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [modal, setModal] = useState(null)
  const { toasts, show } = useToast()

  const cargar = async () => {
    setLoading(true)
    try {
      const [as, us] = await Promise.all([
        apiCall('/qf/inv/asignaciones/listar'),
        apiCall('/qf/usuarios/listar'),
      ])
      // Asignaciones usan 'asignacion_id' no 'id' — no usar toArray
      const asArr = Array.isArray(as) ? as
        : (as?.data ? (Array.isArray(as.data) ? as.data : [as.data])
        : (as && as.asignacion_id ? [as] : []))
      setAsignados(asArr.filter(a => a && a.asignacion_id))
      setUsuarios(toArray(us).filter(u => u.estado === 0))
    } catch (e) { show('Error al cargar datos: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const handleAsignar = async (form) => {
    const res = await apiCall('/qf/inv/asignaciones/asignar', {
      method: 'POST',
      body: JSON.stringify({ ...form, usr_realizo_id: user?.id, usr_realizo: user?.nombres || user?.username })
    })
    if (!res.success) throw new Error(res.message)
    show('Item asignado correctamente'); cargar()
  }

  const handleDevolver = async (form) => {
    const res = await apiCall('/qf/inv/asignaciones/devolver', {
      method: 'POST',
      body: JSON.stringify({ ...form, usr_realizo_id: user?.id, usr_realizo: user?.nombres || user?.username })
    })
    if (!res.success) throw new Error(res.message)
    show('Devolución registrada'); cargar()
  }

  const filtrados = asignados.filter(a =>
    !filtro ||
    a.codigo?.toLowerCase().includes(filtro.toLowerCase()) ||
    a.item_nombre?.toLowerCase().includes(filtro.toLowerCase()) ||
    a.usuario_nombre?.toLowerCase().includes(filtro.toLowerCase()) ||
    a.grupo_nombre?.toLowerCase().includes(filtro.toLowerCase())
  )

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Montserrat', fontSize: 22, fontWeight: 700, color: 'var(--qf-navy)', marginBottom: 4 }}>👤 Asignaciones</h1>
        <p style={{ color: 'var(--qf-text-light)', fontSize: 13 }}>Items actualmente asignados a usuarios</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderTop: '3px solid #ff9800' }}>
          <div style={{ fontSize: 10, color: 'var(--qf-text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total asignados</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#e65100', fontFamily: 'Montserrat', lineHeight: 1.2 }}>{asignados.length}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderTop: '3px solid #4caf50' }}>
          <div style={{ fontSize: 10, color: 'var(--qf-text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Usuarios con items</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#2e7d32', fontFamily: 'Montserrat', lineHeight: 1.2 }}>{new Set(asignados.map(a => a.usuario_id)).size}</div>
        </div>
      </div>
      <div className="page-card">
        <div className="page-card-header">
          <h2>Items Asignados</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="filter-input" placeholder="🔍 Filtrar..." value={filtro} onChange={e => setFiltro(e.target.value)} />
            <button className="btn btn-secondary btn-sm" onClick={cargar}>🔄 Actualizar</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {loading ? <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner dark" /></div>
            : filtrados.length === 0 ? <div className="empty-state"><div className="icon">👤</div><p>No hay items asignados actualmente</p></div>
            : (
              <table className="qf-table">
                <thead>
                  <tr><th>Código</th><th>Item</th><th>Grupo</th><th>Asignado a</th><th>Fecha</th><th style={{ textAlign: 'center' }}>Acciones</th></tr>
                </thead>
                <tbody>
                  {filtrados.map(a => (
                    <tr key={a.asignacion_id}>
                      <td><code style={{ background: '#e8eef5', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{a.codigo}</code></td>
                      <td style={{ fontWeight: 500 }}>{a.item_nombre}</td>
                      <td><span style={{ background: '#e8eef5', color: 'var(--qf-navy)', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{a.grupo_nombre}</span></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #2D6A9F, #4CAF50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 10, flexShrink: 0 }}>
                            {a.usuario_nombre?.charAt(0) || '?'}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{a.usuario_nombre}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--qf-text-light)' }}>{a.fecha ? new Date(a.fecha).toLocaleString('es-PE') : '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setModal({ type: 'historial', data: a })} title="Historial">📋</button>
                          <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'reasignar', data: a })} title="Reasignar">🔄</button>
                          <button className="btn btn-warning btn-sm" onClick={() => setModal({ type: 'devolver', data: a })} title="Devolver">↩️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
        {!loading && <div style={{ padding: '12px 24px', borderTop: '1px solid var(--qf-border)', fontSize: 12, color: 'var(--qf-text-light)' }}>{filtrados.length} de {asignados.length} asignaciones</div>}
      </div>
      {modal?.type === 'reasignar' && <ModalAsignar item={modal.data} usuarios={usuarios} onClose={() => setModal(null)} onSave={handleAsignar} isReasignacion={true} />}
      {modal?.type === 'devolver' && <ModalDevolver item={modal.data} onClose={() => setModal(null)} onSave={handleDevolver} />}
      {modal?.type === 'historial' && <ModalHistorial item={modal.data} onClose={() => setModal(null)} />}
    </div>
  )
}

export default InvAsignacionesPage
