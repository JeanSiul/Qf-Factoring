import React, { useState, useEffect } from 'react'
import { apiCall } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'

const ModalDestinatario = ({ dest, onClose, onSave }) => {
  const [form, setForm] = useState({
    id: dest?.id || '',
    nombre: dest?.nombre || '',
    email: dest?.email || '',
    whatsapp: dest?.whatsapp || '',
    telegram: dest?.telegram || '',
    activo: dest?.activo ?? 1,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!dest?.id
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.nombre) { setError('El nombre es requerido'); return }
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
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h3>{isEdit ? '✏️ Editar Destinatario' : '➕ Nuevo Destinatario'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Nombre completo *</label>
            <input className="form-control" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Juan Pérez" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-control" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="juan@empresa.com" />
            </div>
            <div className="form-group">
              <label className="form-label">WhatsApp</label>
              <input className="form-control" value={form.whatsapp} onChange={e => set('whatsapp', e.target.value)} placeholder="+51999999999" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <div className="form-group">
              <label className="form-label">Telegram</label>
              <input className="form-control" value={form.telegram} onChange={e => set('telegram', e.target.value)} placeholder="@usuario o chat_id" />
            </div>
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select className="form-control" value={form.activo} onChange={e => set('activo', parseInt(e.target.value))}>
                <option value={1}>Activo</option>
                <option value={0}>Inactivo</option>
              </select>
            </div>
          </div>
          {error && <div style={{ background: '#fce4e4', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>⚠️ {error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <><span className="spinner" />Guardando...</> : isEdit ? '💾 Actualizar' : '➕ Crear'}
          </button>
        </div>
      </div>
    </div>
  )
}

const AlertDestinatariosPage = () => {
  const [destinatarios, setDestinatarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [modal, setModal] = useState(null)
  const { toasts, show } = useToast()

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await apiCall('/webhook/destinatarios/listar')
      setDestinatarios(Array.isArray(res) ? res : [])
    } catch (e) {
      show('Error al cargar destinatarios: ' + e.message, 'error')
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const handleSave = async (form) => {
    const endpoint = form.id ? '/webhook/destinatarios/actualizar' : '/webhook/destinatarios/crear'
    await apiCall(endpoint, { method: 'POST', body: JSON.stringify(form) })
    show(form.id ? 'Destinatario actualizado' : 'Destinatario creado')
    cargar()
  }

  const handleToggle = async (dest) => {
    try {
      await apiCall('/webhook/destinatarios/actualizar', {
        method: 'POST',
        body: JSON.stringify({ ...dest, activo: dest.activo ? 0 : 1 })
      })
      show('Estado actualizado')
      cargar()
    } catch (e) { show(e.message, 'error') }
  }

  const initials = (nombre) => nombre?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'

  const filtrados = destinatarios.filter(d =>
    !filtro || d.nombre?.toLowerCase().includes(filtro.toLowerCase()) ||
    d.email?.toLowerCase().includes(filtro.toLowerCase()) ||
    d.whatsapp?.includes(filtro)
  )

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Montserrat', fontSize: 22, fontWeight: 700, color: 'var(--qf-navy)', marginBottom: 4 }}>👤 Destinatarios</h1>
        <p style={{ color: 'var(--qf-text-light)', fontSize: 13 }}>Personas que reciben las alertas</p>
      </div>
      <div className="page-card">
        <div className="page-card-header">
          <h2>Lista de Destinatarios</h2>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="filter-input" placeholder="🔍 Filtrar..." value={filtro} onChange={e => setFiltro(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'new' })}>➕ Nuevo Destinatario</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner dark" /></div>
          ) : filtrados.length === 0 ? (
            <div className="empty-state"><div className="icon">👤</div><p>No se encontraron destinatarios</p></div>
          ) : (
            <table className="qf-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>WhatsApp</th>
                  <th>Telegram</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(d => (
                  <tr key={d.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #2D6A9F, #4CAF50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                          {initials(d.nombre)}
                        </div>
                        <span style={{ fontWeight: 500 }}>{d.nombre}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--qf-text-light)' }}>{d.email || '—'}</td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{d.whatsapp || '—'}</td>
                    <td style={{ fontSize: 12 }}>{d.telegram || '—'}</td>
                    <td><span className={`badge ${d.activo ? 'active' : 'inactive'}`}>{d.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'edit', data: d })}>✏️</button>
                        <button className={`btn btn-sm ${d.activo ? 'btn-danger' : 'btn-secondary'}`} onClick={() => handleToggle(d)}>
                          {d.activo ? '⏸' : '▶️'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!loading && (
          <div style={{ padding: '12px 24px', borderTop: '1px solid var(--qf-border)', fontSize: 12, color: 'var(--qf-text-light)' }}>
            {filtrados.length} de {destinatarios.length} destinatarios
          </div>
        )}
      </div>
      {modal?.type === 'new' && <ModalDestinatario onClose={() => setModal(null)} onSave={handleSave} />}
      {modal?.type === 'edit' && <ModalDestinatario dest={modal.data} onClose={() => setModal(null)} onSave={handleSave} />}
    </div>
  )
}

export default AlertDestinatariosPage
