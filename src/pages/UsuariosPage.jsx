import React, { useState, useEffect } from 'react'
import { apiCall, toArray } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'

const ModalUsuario = ({ usuario, roles, onClose, onSave }) => {
  const rolesIniciales = usuario?.roleIdsStr
    ? usuario.roleIdsStr.split(',').map(r => r.trim()).filter(Boolean)
    : (usuario?.roles || [])

  const [form, setForm] = useState({
    id: usuario?.id || '',
    nombres: usuario?.nombres || '',
    apellidos: usuario?.apellidos || '',
    userName: usuario?.userName || '',
    email: usuario?.email || '',
    estado: usuario?.estado ?? 1,
    password: '',
    confirmarPassword: '',
    roles: rolesIniciales,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!usuario?.id

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleRole = (roleId) => {
    setForm(f => ({
      ...f,
      roles: f.roles.includes(roleId) ? f.roles.filter(r => r !== roleId) : [...f.roles, roleId]
    }))
  }

  const handleSubmit = async () => {
    if (!form.nombres || !form.apellidos || !form.userName) { setError('Nombres, apellidos y usuario son requeridos'); return }
    if (!isEdit && !form.password) { setError('La contraseña es requerida'); return }
    if (form.password && form.password !== form.confirmarPassword) { setError('Las contraseñas no coinciden'); return }
    if (form.password && form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
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
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3>{isEdit ? '✏️ Editar Usuario' : '➕ Nuevo Usuario'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <div className="form-group">
              <label className="form-label">Nombres *</label>
              <input className="form-control" value={form.nombres} onChange={e => set('nombres', e.target.value)} placeholder="Nombres" />
            </div>
            <div className="form-group">
              <label className="form-label">Apellidos *</label>
              <input className="form-control" value={form.apellidos} onChange={e => set('apellidos', e.target.value)} placeholder="Apellidos" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <div className="form-group">
              <label className="form-label">Usuario *</label>
              <input className="form-control" value={form.userName} onChange={e => set('userName', e.target.value.toUpperCase())} placeholder="USUARIO" disabled={isEdit} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-control" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="correo@empresa.com" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <div className="form-group">
              <label className="form-label">{isEdit ? 'Nueva Contraseña' : 'Contraseña *'}</label>
              <input className="form-control" type="password" value={form.password} onChange={e => set('password', e.target.value)} placeholder={isEdit ? 'Dejar vacío para no cambiar' : 'Contraseña'} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirmar Contraseña</label>
              <input className="form-control" type="password" value={form.confirmarPassword} onChange={e => set('confirmarPassword', e.target.value)} placeholder="Repetir contraseña" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Estado</label>
            <select className="form-control" value={form.estado} onChange={e => set('estado', parseInt(e.target.value))}>
              <option value={1}>Activo</option>
              <option value={0}>Inactivo</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">
              Roles
              {form.roles.length > 0 && (
                <span style={{ marginLeft: 8, background: 'var(--qf-navy)', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
                  {form.roles.length} seleccionado{form.roles.length > 1 ? 's' : ''}
                </span>
              )}
            </label>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px',
              background: 'var(--qf-gray)', borderRadius: 'var(--qf-radius)',
              border: '1.5px solid var(--qf-border)', maxHeight: 160, overflowY: 'auto'
            }}>
              {roles.map(r => {
                const selected = form.roles.includes(r.id)
                return (
                  <label key={r.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                    padding: '4px 10px', borderRadius: 20,
                    background: selected ? 'var(--qf-navy)' : 'white',
                    color: selected ? 'white' : 'var(--qf-text)',
                    border: '1.5px solid', borderColor: selected ? 'var(--qf-navy)' : 'var(--qf-border)',
                    fontSize: 12, fontWeight: 500, transition: 'all 0.15s', userSelect: 'none',
                  }}>
                    <input type="checkbox" checked={selected} onChange={() => toggleRole(r.id)} style={{ display: 'none' }} />
                    {selected ? '✓ ' : ''}{r.name}
                  </label>
                )
              })}
              {roles.length === 0 && <span style={{ fontSize: 12, color: 'var(--qf-text-light)' }}>Cargando roles...</span>}
            </div>
          </div>
          {error && <div style={{ background: '#fce4e4', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 8 }}>⚠️ {error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <><span className="spinner" />Guardando...</> : isEdit ? '💾 Actualizar' : '➕ Crear Usuario'}
          </button>
        </div>
      </div>
    </div>
  )
}

const ModalPassword = ({ usuario, onClose, onSave }) => {
  const [form, setForm] = useState({ password: '', confirmar: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!form.password) { setError('Ingrese la nueva contraseña'); return }
    if (form.password.length < 6) { setError('Mínimo 6 caracteres'); return }
    if (form.password !== form.confirmar) { setError('Las contraseñas no coinciden'); return }
    setLoading(true); setError('')
    try {
      await onSave({ id: usuario.id, password: form.password })
      onClose()
    } catch (e) {
      setError(e.message || 'Error al cambiar contraseña')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h3>🔑 Cambiar Contraseña</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: 'var(--qf-text-light)', marginBottom: 16 }}>Usuario: <strong>{usuario.userName}</strong></p>
          <div className="form-group">
            <label className="form-label">Nueva Contraseña</label>
            <input className="form-control" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Mínimo 6 caracteres" />
          </div>
          <div className="form-group">
            <label className="form-label">Confirmar Contraseña</label>
            <input className="form-control" type="password" value={form.confirmar} onChange={e => setForm(f => ({ ...f, confirmar: e.target.value }))} placeholder="Repetir contraseña" />
          </div>
          {error && <div style={{ background: '#fce4e4', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>⚠️ {error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-warning" onClick={handleSubmit} disabled={loading}>
            {loading ? <><span className="spinner" style={{ borderTopColor: '#333' }} />Guardando...</> : '🔑 Cambiar'}
          </button>
        </div>
      </div>
    </div>
  )
}

const UsuariosPage = () => {
  const [usuarios, setUsuarios] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [modal, setModal] = useState(null)
  const { toasts, show } = useToast()

  const cargar = async () => {
    setLoading(true)
    try {
      const [us, rs] = await Promise.all([
        apiCall('/qf/usuarios/listar'),
        apiCall('/qf/roles/listar')
      ])
      setUsuarios(toArray(us))
      setRoles(toArray(rs))
    } catch (e) {
      show('Error al cargar datos: ' + e.message, 'error')
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  // Maneja respuesta null/undefined del API
  const handleResponse = (res, defaultMsg) => {
    if (res === null || res === undefined) return // null = OK silencioso
    if (res?.success === false) throw new Error(res.message || defaultMsg)
    if (res?.success === true) return
    // Si no tiene success, asumimos éxito (n8n no devolvió formato esperado)
  }

  const handleSave = async (form) => {
    const endpoint = form.id ? '/qf/usuarios/actualizar' : '/qf/usuarios/crear'
    const res = await apiCall(endpoint, { method: 'POST', body: JSON.stringify(form) })
    handleResponse(res, 'Error al guardar')
    show(form.id ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente')
    cargar()
  }

  const handlePassword = async (data) => {
    const res = await apiCall('/qf/usuarios/cambiar-password', { method: 'POST', body: JSON.stringify(data) })
    handleResponse(res, 'Error al cambiar contraseña')
    show('Contraseña actualizada correctamente')
  }

  const handleDelete = async (id) => {
    try {
      const res = await apiCall('/qf/usuarios/eliminar', { method: 'POST', body: JSON.stringify({ id }) })
      handleResponse(res, 'Error al eliminar')
      show('Usuario eliminado')
      cargar()
    } catch (e) { show(e.message, 'error') }
    setModal(null)
  }

  const filtrados = usuarios.filter(u =>
    !filtro || u.userName?.toLowerCase().includes(filtro.toLowerCase()) ||
    u.nombres?.toLowerCase().includes(filtro.toLowerCase()) ||
    u.apellidos?.toLowerCase().includes(filtro.toLowerCase())
  )

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Montserrat', fontSize: 22, fontWeight: 700, color: 'var(--qf-navy)', marginBottom: 4 }}>👥 Usuarios</h1>
        <p style={{ color: 'var(--qf-text-light)', fontSize: 13 }}>Gestión de usuarios del sistema</p>
      </div>
      <div className="page-card">
        <div className="page-card-header">
          <h2>Lista de Usuarios</h2>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="filter-input" placeholder="🔍 Filtrar..." value={filtro} onChange={e => setFiltro(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'new' })}>➕ Nuevo Usuario</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner dark" /></div>
          ) : filtrados.length === 0 ? (
            <div className="empty-state"><div className="icon">👤</div><p>No se encontraron usuarios</p></div>
          ) : (
            <table className="qf-table">
              <thead>
                <tr><th>Usuario</th><th>Nombres</th><th>Apellidos</th><th>Email</th><th>Estado</th><th>Roles</th><th style={{ textAlign: 'center' }}>Acciones</th></tr>
              </thead>
              <tbody>
                {filtrados.map(u => {
                  const rolesArr = u.rolesStr ? u.rolesStr.split(',').map(r => r.trim()).filter(Boolean) : []
                  return (
                    <tr key={u.id}>
                      <td><strong style={{ color: 'var(--qf-navy)' }}>{u.userName}</strong></td>
                      <td>{u.nombres}</td>
                      <td>{u.apellidos}</td>
                      <td style={{ color: 'var(--qf-text-light)', fontSize: 12 }}>{u.email || '—'}</td>
                      <td><span className={`badge ${u.estado === 1 ? 'active' : 'inactive'}`}>{u.estado === 1 ? 'Activo' : 'Inactivo'}</span></td>
                      <td style={{ fontSize: 12 }}>
                        {rolesArr.length > 0 ? rolesArr.map(r => (
                          <span key={r} style={{ display: 'inline-block', background: '#e8eef5', color: 'var(--qf-navy)', borderRadius: 4, padding: '2px 7px', marginRight: 4, marginBottom: 2, fontSize: 11, fontWeight: 600 }}>{r}</span>
                        )) : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'edit', data: u })} title="Editar">✏️</button>
                          <button className="btn btn-warning btn-sm" onClick={() => setModal({ type: 'password', data: u })} title="Cambiar contraseña">🔑</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setModal({ type: 'delete', data: u })} title="Eliminar">🗑️</button>
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
            {filtrados.length} de {usuarios.length} usuarios
          </div>
        )}
      </div>
      {modal?.type === 'new' && <ModalUsuario roles={roles} onClose={() => setModal(null)} onSave={handleSave} />}
      {modal?.type === 'edit' && <ModalUsuario usuario={modal.data} roles={roles} onClose={() => setModal(null)} onSave={handleSave} />}
      {modal?.type === 'password' && <ModalPassword usuario={modal.data} onClose={() => setModal(null)} onSave={handlePassword} />}
      {modal?.type === 'delete' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h3>🗑️ Confirmar eliminación</h3>
              <button className="modal-close" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14 }}>¿Está seguro que desea eliminar al usuario <strong>{modal.data.userName}</strong>?</p>
              <p style={{ fontSize: 13, color: 'var(--qf-text-light)', marginTop: 8 }}>Esta acción no se puede deshacer.</p>
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

export default UsuariosPage
