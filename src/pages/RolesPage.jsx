import React, { useState, useEffect } from 'react'
import { apiCall } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'

const ModalRol = ({ rol, onClose, onSave }) => {
  const [form, setForm] = useState({
    id: rol?.id || '',
    name: rol?.name || '',
    descripcion: rol?.descripcion || '',
    estado: rol?.estado ?? 1,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!rol?.id

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.name) { setError('El nombre del rol es requerido'); return }
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
          <h3>{isEdit ? '✏️ Editar Rol' : '➕ Nuevo Rol'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Nombre del Rol *</label>
            <input className="form-control" value={form.name} onChange={e => set('name', e.target.value.toUpperCase())} placeholder="NOMBRE_ROL" disabled={isEdit} />
          </div>
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <input className="form-control" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Descripción del rol" />
          </div>
          <div className="form-group">
            <label className="form-label">Estado</label>
            <select className="form-control" value={form.estado} onChange={e => set('estado', parseInt(e.target.value))}>
              <option value={1}>Activo</option>
              <option value={0}>Inactivo</option>
            </select>
          </div>
          {error && <div style={{ background: '#fce4e4', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>⚠️ {error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <><span className="spinner"/>Guardando...</> : isEdit ? '💾 Actualizar' : '➕ Crear Rol'}
          </button>
        </div>
      </div>
    </div>
  )
}

const RolesPage = () => {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [modal, setModal] = useState(null)
  const { toasts, show } = useToast()

  const cargar = async () => {
    setLoading(true)
    try {
      const rs = await apiCall('/qf/roles/listar')
      setRoles(rs)
    } catch (e) {
      show('Error al cargar roles: ' + e.message, 'error')
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const handleSave = async (form) => {
    const endpoint = form.id ? '/qf/roles/actualizar' : '/qf/roles/crear'
    const res = await apiCall(endpoint, { method: 'POST', body: JSON.stringify(form) })
    if (!res.success) throw new Error(res.message)
    show(form.id ? 'Rol actualizado correctamente' : 'Rol creado correctamente')
    cargar()
  }

  const handleDelete = async (id) => {
    try {
      const res = await apiCall('/qf/roles/eliminar', { method: 'POST', body: JSON.stringify({ id }) })
      if (!res.success) throw new Error(res.message)
      show('Rol eliminado')
      cargar()
    } catch (e) { show(e.message, 'error') }
    setModal(null)
  }

  const filtrados = roles.filter(r =>
    !filtro || r.name?.toLowerCase().includes(filtro.toLowerCase()) ||
    r.descripcion?.toLowerCase().includes(filtro.toLowerCase())
  )

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Montserrat', fontSize: 22, fontWeight: 700, color: 'var(--qf-navy)', marginBottom: 4 }}>🏷️ Roles</h1>
        <p style={{ color: 'var(--qf-text-light)', fontSize: 13 }}>Gestión de roles y permisos del sistema</p>
      </div>

      <div className="page-card">
        <div className="page-card-header">
          <h2>Lista de Roles</h2>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="filter-input" placeholder="🔍 Filtrar..." value={filtro} onChange={e => setFiltro(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'new' })}>➕ Nuevo Rol</button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner dark"/></div>
          ) : filtrados.length === 0 ? (
            <div className="empty-state"><div className="icon">🏷️</div><p>No se encontraron roles</p></div>
          ) : (
            <table className="qf-table">
              <thead>
                <tr>
                  <th>Rol</th>
                  <th>Descripción</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'center' }}>Usuarios</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(r => (
                  <tr key={r.id}>
                    <td><strong style={{ color: 'var(--qf-navy)', fontFamily: 'Montserrat' }}>{r.name}</strong></td>
                    <td style={{ color: 'var(--qf-text-light)' }}>{r.descripcion || '—'}</td>
                    <td><span className={`badge ${r.estado === 1 ? 'active' : 'inactive'}`}>{r.estado === 1 ? 'Activo' : 'Inactivo'}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ background: '#e8eef5', color: 'var(--qf-navy)', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>
                        {r.totalUsuarios || 0}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'edit', data: r })} title="Editar">✏️</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setModal({ type: 'delete', data: r })} title="Eliminar">🗑️</button>
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
            {filtrados.length} de {roles.length} roles
          </div>
        )}
      </div>

      {modal?.type === 'new' && <ModalRol onClose={() => setModal(null)} onSave={handleSave} />}
      {modal?.type === 'edit' && <ModalRol rol={modal.data} onClose={() => setModal(null)} onSave={handleSave} />}
      {modal?.type === 'delete' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h3>🗑️ Confirmar eliminación</h3>
              <button className="modal-close" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14 }}>¿Está seguro que desea eliminar el rol <strong>{modal.data.name}</strong>?</p>
              {modal.data.totalUsuarios > 0 && (
                <p style={{ fontSize: 13, color: 'var(--qf-red)', marginTop: 8 }}>⚠️ Este rol tiene {modal.data.totalUsuarios} usuario(s) asignado(s).</p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => handleDelete(modal.data.id)}>🗑️ Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RolesPage
