import React, { useState, useEffect } from 'react'
import { apiCall } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'

const ModalProceso = ({ proceso, onClose, onSave }) => {
  const [form, setForm] = useState({
    id: proceso?.id || '',
    codigo: proceso?.codigo || '',
    nombre: proceso?.nombre || '',
    descripcion: proceso?.descripcion || '',
    activo: proceso?.activo ?? 1,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!proceso?.id
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
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3>{isEdit ? '✏️ Editar Proceso' : '➕ Nuevo Proceso'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Código único *</label>
            <input className="form-control" value={form.codigo} onChange={e => set('codigo', e.target.value.toUpperCase())} placeholder="FACTORING_VENCIMIENTO" disabled={isEdit} style={{ textTransform: 'uppercase' }} />
            <small style={{ color: 'var(--qf-text-light)', fontSize: 11 }}>Este código se usa en n8n para identificar el proceso</small>
          </div>
          <div className="form-group">
            <label className="form-label">Nombre descriptivo *</label>
            <input className="form-control" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Alertas de vencimiento de factoring" />
          </div>
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <textarea className="form-control" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Describe cuándo y por qué se genera esta alerta..." rows={3} style={{ resize: 'vertical' }} />
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

const AlertProcesosPage = () => {
  const [procesos, setProcesos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [modal, setModal] = useState(null)
  const { toasts, show } = useToast()

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await apiCall('/procesos/listar')
      setProcesos(Array.isArray(res) ? res : [])
    } catch (e) {
      show('Error al cargar procesos: ' + e.message, 'error')
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const handleSave = async (form) => {
    const endpoint = form.id ? '/webhook/procesos/actualizar' : '/webhook/procesos/crear'
    await apiCall(endpoint, { method: 'POST', body: JSON.stringify(form) })
    show(form.id ? 'Proceso actualizado' : 'Proceso creado')
    cargar()
  }

  const handleToggle = async (proceso) => {
    try {
      await apiCall('/webhook/procesos/actualizar', {
        method: 'POST',
        body: JSON.stringify({ ...proceso, activo: proceso.activo ? 0 : 1 })
      })
      show('Estado actualizado')
      cargar()
    } catch (e) { show(e.message, 'error') }
  }

  const filtrados = procesos.filter(p =>
    !filtro || p.codigo?.toLowerCase().includes(filtro.toLowerCase()) ||
    p.nombre?.toLowerCase().includes(filtro.toLowerCase())
  )

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Montserrat', fontSize: 22, fontWeight: 700, color: 'var(--qf-navy)', marginBottom: 4 }}>⚙️ Procesos</h1>
        <p style={{ color: 'var(--qf-text-light)', fontSize: 13 }}>Procesos que generan alertas automáticas</p>
      </div>
      <div className="page-card">
        <div className="page-card-header">
          <h2>Lista de Procesos</h2>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="filter-input" placeholder="🔍 Filtrar..." value={filtro} onChange={e => setFiltro(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'new' })}>➕ Nuevo Proceso</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner dark" /></div>
          ) : filtrados.length === 0 ? (
            <div className="empty-state"><div className="icon">⚙️</div><p>No se encontraron procesos</p></div>
          ) : (
            <table className="qf-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(p => (
                  <tr key={p.id}>
                    <td><code style={{ background: '#e8eef5', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{p.codigo}</code></td>
                    <td style={{ fontWeight: 500 }}>{p.nombre}</td>
                    <td style={{ fontSize: 12, color: 'var(--qf-text-light)' }}>{p.descripcion || '—'}</td>
                    <td><span className={`badge ${p.activo ? 'active' : 'inactive'}`}>{p.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'edit', data: p })}>✏️</button>
                        <button className={`btn btn-sm ${p.activo ? 'btn-danger' : 'btn-secondary'}`} onClick={() => handleToggle(p)}>
                          {p.activo ? '⏸' : '▶️'}
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
            {filtrados.length} de {procesos.length} procesos
          </div>
        )}
      </div>
      {modal?.type === 'new' && <ModalProceso onClose={() => setModal(null)} onSave={handleSave} />}
      {modal?.type === 'edit' && <ModalProceso proceso={modal.data} onClose={() => setModal(null)} onSave={handleSave} />}
    </div>
  )
}

export default AlertProcesosPage
