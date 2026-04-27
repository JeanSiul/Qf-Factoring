import React, { useState, useEffect } from 'react'
import { apiCall } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'

const ModalCanal = ({ canal, onClose, onSave }) => {
  const [form, setForm] = useState({
    id: canal?.id || '',
    codigo: canal?.codigo || '',
    nombre: canal?.nombre || '',
    activo: canal?.activo ?? 1,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!canal?.id
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.codigo || !form.nombre) { setError('Código y nombre son requeridos'); return }
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
          <h3>{isEdit ? '✏️ Editar Canal' : '➕ Nuevo Canal'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Código único *</label>
            <input className="form-control" value={form.codigo} onChange={e => set('codigo', e.target.value.toUpperCase())} placeholder="EMAIL, WHATSAPP..." disabled={isEdit} />
            <small style={{ color: 'var(--qf-text-light)', fontSize: 11 }}>Inmutable una vez creado</small>
          </div>
          <div className="form-group">
            <label className="form-label">Nombre descriptivo *</label>
            <input className="form-control" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="WhatsApp Business" />
          </div>
          <div className="form-group">
            <label className="form-label">Estado</label>
            <select className="form-control" value={form.activo} onChange={e => set('activo', parseInt(e.target.value))}>
              <option value={1}>Activo</option>
              <option value={0}>Inactivo</option>
            </select>
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

const AlertCanalesPage = () => {
  const [canales, setCanales] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [modal, setModal] = useState(null)
  const { toasts, show } = useToast()

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await apiCall('/webhook/canales/listar')
      setCanales(Array.isArray(res) ? res : [])
    } catch (e) {
      show('Error al cargar canales: ' + e.message, 'error')
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const handleSave = async (form) => {
    const endpoint = form.id ? '/webhook/canales/actualizar' : '/webhook/canales/crear'
    await apiCall(endpoint, { method: 'POST', body: JSON.stringify(form) })
    show(form.id ? 'Canal actualizado' : 'Canal creado')
    cargar()
  }

  const handleToggle = async (canal) => {
    try {
      await apiCall('/webhook/canales/actualizar', {
        method: 'POST',
        body: JSON.stringify({ ...canal, activo: canal.activo ? 0 : 1 })
      })
      show('Estado actualizado')
      cargar()
    } catch (e) { show(e.message, 'error') }
  }

  const filtrados = canales.filter(c =>
    !filtro || c.codigo?.toLowerCase().includes(filtro.toLowerCase()) ||
    c.nombre?.toLowerCase().includes(filtro.toLowerCase())
  )

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Montserrat', fontSize: 22, fontWeight: 700, color: 'var(--qf-navy)', marginBottom: 4 }}>📡 Canales</h1>
        <p style={{ color: 'var(--qf-text-light)', fontSize: 13 }}>Canales de envío de alertas</p>
      </div>
      <div className="page-card">
        <div className="page-card-header">
          <h2>Lista de Canales</h2>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="filter-input" placeholder="🔍 Filtrar..." value={filtro} onChange={e => setFiltro(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'new' })}>➕ Nuevo Canal</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner dark" /></div>
          ) : filtrados.length === 0 ? (
            <div className="empty-state"><div className="icon">📡</div><p>No se encontraron canales</p></div>
          ) : (
            <table className="qf-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(c => (
                  <tr key={c.id}>
                    <td><code style={{ background: '#e8eef5', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{c.codigo}</code></td>
                    <td>{c.nombre}</td>
                    <td><span className={`badge ${c.activo ? 'active' : 'inactive'}`}>{c.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'edit', data: c })}>✏️</button>
                        <button className={`btn btn-sm ${c.activo ? 'btn-danger' : 'btn-secondary'}`} onClick={() => handleToggle(c)}>
                          {c.activo ? '⏸' : '▶️'}
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
            {filtrados.length} de {canales.length} canales
          </div>
        )}
      </div>
      {modal?.type === 'new' && <ModalCanal onClose={() => setModal(null)} onSave={handleSave} />}
      {modal?.type === 'edit' && <ModalCanal canal={modal.data} onClose={() => setModal(null)} onSave={handleSave} />}
    </div>
  )
}

export default AlertCanalesPage
