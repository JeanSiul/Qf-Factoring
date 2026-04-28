import React, { useState, useEffect } from 'react'
import { apiCall } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'
import { useAuth } from '../context/AuthContext'

// ── UTILIDAD GLOBAL ────────────────────────────────────────────────────────
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

// ── MODAL ATRIBUTO ─────────────────────────────────────────────────────────
const ModalAtributo = ({ atributo, grupoId, onClose, onSave }) => {
  const [form, setForm] = useState({
    id: atributo?.id || '',
    grupo_id: grupoId,
    nombre: atributo?.nombre || '',
    tipo: atributo?.tipo || 'texto',
    opciones: atributo?.opciones || '',
    requerido: atributo?.requerido ?? 0,
    orden: atributo?.orden ?? 0,
    activo: atributo?.activo ?? 1,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!atributo?.id
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.nombre) { setError('El nombre es requerido'); return }
    if (form.tipo === 'lista' && !form.opciones) { setError('Ingresa las opciones separadas por coma'); return }
    setLoading(true); setError('')
    try { await onSave(form); onClose() }
    catch (e) { setError(e.message || 'Error al guardar') }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h3>{isEdit ? '✏️ Editar Atributo' : '➕ Nuevo Atributo'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Nombre *</label>
            <input className="form-control" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Marca, Modelo, Procesador..." />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-control" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                <option value="texto">Texto</option>
                <option value="numero">Número</option>
                <option value="fecha">Fecha</option>
                <option value="lista">Lista desplegable</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Orden</label>
              <input className="form-control" type="number" value={form.orden} onChange={e => set('orden', parseInt(e.target.value) || 0)} min={0} />
            </div>
          </div>
          {form.tipo === 'lista' && (
            <div className="form-group">
              <label className="form-label">Opciones (separadas por coma) *</label>
              <input className="form-control" value={form.opciones} onChange={e => set('opciones', e.target.value)} placeholder="Opción 1,Opción 2,Opción 3" />
              <small style={{ color: 'var(--qf-text-light)', fontSize: 11 }}>Ejemplo: 8GB,16GB,32GB</small>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <div className="form-group">
              <label className="form-label">¿Requerido?</label>
              <select className="form-control" value={form.requerido} onChange={e => set('requerido', parseInt(e.target.value))}>
                <option value={0}>No</option>
                <option value={1}>Sí</option>
              </select>
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

// ── MODAL GRUPO ────────────────────────────────────────────────────────────
const ModalGrupo = ({ grupo, onClose, onSave }) => {
  const [form, setForm] = useState({
    id: grupo?.id || '',
    codigo: grupo?.codigo || '',
    nombre: grupo?.nombre || '',
    descripcion: grupo?.descripcion || '',
    activo: grupo?.activo ?? 1,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!grupo?.id
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.codigo || !form.nombre) { setError('Código y nombre son requeridos'); return }
    setLoading(true); setError('')
    try { await onSave(form); onClose() }
    catch (e) { setError(e.message || 'Error al guardar') }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-header">
          <h3>{isEdit ? '✏️ Editar Grupo' : '➕ Nuevo Grupo'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Código único *</label>
            <input className="form-control" value={form.codigo} onChange={e => set('codigo', e.target.value.toUpperCase())} placeholder="LAPTOPS, MOUSE, MALETINES..." disabled={isEdit} />
            <small style={{ color: 'var(--qf-text-light)', fontSize: 11 }}>Inmutable una vez creado</small>
          </div>
          <div className="form-group">
            <label className="form-label">Nombre *</label>
            <input className="form-control" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Laptops / Portátiles" />
          </div>
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <textarea className="form-control" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Descripción del grupo..." rows={2} style={{ resize: 'vertical' }} />
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

// ── MAIN PAGE ──────────────────────────────────────────────────────────────
const InvGruposPage = () => {
  const { user } = useAuth()
  const [grupos, setGrupos] = useState([])
  const [atributos, setAtributos] = useState([])
  const [loading, setLoading] = useState(true)
  const [grupoActivo, setGrupoActivo] = useState(null)
  const [modal, setModal] = useState(null)
  const { toasts, show } = useToast()

  const cargar = async () => {
    setLoading(true)
    try {
      const [gr, at] = await Promise.all([
        apiCall('/qf/inv/grupos/listar'),
        apiCall('/qf/inv/atributos/listar'),
      ])
      const grArr = toArray(gr)
      const atArr = toArray(at)
      setGrupos(grArr)
      setAtributos(atArr)
      if (grArr.length > 0 && !grupoActivo) setGrupoActivo(grArr[0].id)
    } catch (e) {
      show('Error al cargar datos: ' + e.message, 'error')
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const handleSaveGrupo = async (form) => {
    const endpoint = form.id ? '/qf/inv/grupos/actualizar' : '/qf/inv/grupos/crear'
    const res = await apiCall(endpoint, {
      method: 'POST',
      body: JSON.stringify({ ...form, usr_crea: user?.userName || user?.username })
    })
    if (!res.success) throw new Error(res.message)
    show(form.id ? 'Grupo actualizado' : 'Grupo creado')
    cargar()
  }

  const handleEliminarGrupo = async (id) => {
    if (!confirm('¿Eliminar este grupo?')) return
    try {
      const res = await apiCall('/qf/inv/grupos/eliminar', { method: 'POST', body: JSON.stringify({ id }) })
      if (!res.success) throw new Error(res.message)
      show('Grupo eliminado')
      if (grupoActivo === id) setGrupoActivo(null)
      cargar()
    } catch (e) { show(e.message, 'error') }
  }

  const handleSaveAtributo = async (form) => {
    const endpoint = form.id ? '/qf/inv/atributos/actualizar' : '/qf/inv/atributos/crear'
    const res = await apiCall(endpoint, { method: 'POST', body: JSON.stringify(form) })
    if (!res.success) throw new Error(res.message)
    show(form.id ? 'Atributo actualizado' : 'Atributo creado')
    cargar()
  }

  const handleEliminarAtributo = async (id) => {
    if (!confirm('¿Eliminar este atributo?')) return
    try {
      const res = await apiCall('/qf/inv/atributos/eliminar', { method: 'POST', body: JSON.stringify({ id }) })
      if (!res.success) throw new Error(res.message)
      show('Atributo eliminado')
      cargar()
    } catch (e) { show(e.message, 'error') }
  }

  const grupoSeleccionado = grupos.find(g => g.id === grupoActivo)
  const atributosGrupo = atributos.filter(a => a.grupo_id === grupoActivo)
  const tipoLabel = { texto: '🔤 Texto', numero: '🔢 Número', fecha: '📅 Fecha', lista: '📋 Lista' }

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Montserrat', fontSize: 22, fontWeight: 700, color: 'var(--qf-navy)', marginBottom: 4 }}>🗂️ Grupos y Atributos</h1>
        <p style={{ color: 'var(--qf-text-light)', fontSize: 13 }}>Define los tipos de items y sus características</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>
        {/* Panel izquierdo */}
        <div className="page-card" style={{ margin: 0 }}>
          <div className="page-card-header">
            <h2>Grupos</h2>
            <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'nuevo-grupo' })}>➕</button>
          </div>
          {loading ? (
            <div style={{ padding: 30, textAlign: 'center' }}><span className="spinner dark" /></div>
          ) : grupos.length === 0 ? (
            <div className="empty-state"><p>Sin grupos — crea el primero</p></div>
          ) : (
            grupos.map(g => (
              <div key={g.id} onClick={() => setGrupoActivo(g.id)} style={{
                padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--qf-border)',
                background: grupoActivo === g.id ? '#e8eef5' : '#fff',
                borderLeft: grupoActivo === g.id ? '3px solid var(--qf-navy)' : '3px solid transparent',
                transition: 'all 0.15s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--qf-navy)' }}>{g.nombre}</div>
                    <div style={{ fontSize: 11, color: 'var(--qf-text-light)', marginTop: 2 }}>
                      <code style={{ background: '#e8eef5', padding: '1px 5px', borderRadius: 3 }}>{g.codigo}</code>
                      <span style={{ marginLeft: 6 }}>{atributos.filter(a => a.grupo_id === g.id).length} atributo(s)</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-primary btn-sm" style={{ padding: '2px 6px', fontSize: 11 }}
                      onClick={e => { e.stopPropagation(); setModal({ type: 'editar-grupo', data: g }) }}>✏️</button>
                    <button className="btn btn-danger btn-sm" style={{ padding: '2px 6px', fontSize: 11 }}
                      onClick={e => { e.stopPropagation(); handleEliminarGrupo(g.id) }}>🗑️</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Panel derecho */}
        <div className="page-card" style={{ margin: 0 }}>
          <div className="page-card-header">
            <div>
              <h2>{grupoSeleccionado ? `Atributos — ${grupoSeleccionado.nombre}` : 'Atributos'}</h2>
              {grupoSeleccionado?.descripcion && <p style={{ fontSize: 12, color: 'var(--qf-text-light)', margin: 0 }}>{grupoSeleccionado.descripcion}</p>}
            </div>
            {grupoActivo && <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'nuevo-atributo' })}>➕ Nuevo Atributo</button>}
          </div>
          {!grupoActivo ? (
            <div className="empty-state"><div className="icon">👈</div><p>Selecciona un grupo</p></div>
          ) : loading ? (
            <div style={{ padding: 30, textAlign: 'center' }}><span className="spinner dark" /></div>
          ) : atributosGrupo.length === 0 ? (
            <div className="empty-state"><div className="icon">📋</div><p>Sin atributos — crea el primero</p></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="qf-table">
                <thead>
                  <tr>
                    <th>Orden</th><th>Nombre</th><th>Tipo</th><th>Opciones</th><th>Requerido</th><th>Estado</th><th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {atributosGrupo.sort((a, b) => a.orden - b.orden).map(a => (
                    <tr key={a.id}>
                      <td style={{ textAlign: 'center', color: 'var(--qf-text-light)', fontSize: 12 }}>{a.orden}</td>
                      <td style={{ fontWeight: 600 }}>{a.nombre}</td>
                      <td><span style={{ fontSize: 12 }}>{tipoLabel[a.tipo] || a.tipo}</span></td>
                      <td style={{ fontSize: 11, color: 'var(--qf-text-light)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.opciones || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        {a.requerido ? <span style={{ color: '#c62828', fontWeight: 700, fontSize: 12 }}>Sí</span> : <span style={{ color: 'var(--qf-text-light)', fontSize: 12 }}>No</span>}
                      </td>
                      <td><span className={`badge ${a.activo ? 'active' : 'inactive'}`}>{a.activo ? 'Activo' : 'Inactivo'}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                          <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'editar-atributo', data: a })}>✏️</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleEliminarAtributo(a.id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modal?.type === 'nuevo-grupo' && <ModalGrupo onClose={() => setModal(null)} onSave={handleSaveGrupo} />}
      {modal?.type === 'editar-grupo' && <ModalGrupo grupo={modal.data} onClose={() => setModal(null)} onSave={handleSaveGrupo} />}
      {modal?.type === 'nuevo-atributo' && <ModalAtributo grupoId={grupoActivo} onClose={() => setModal(null)} onSave={handleSaveAtributo} />}
      {modal?.type === 'editar-atributo' && <ModalAtributo atributo={modal.data} grupoId={grupoActivo} onClose={() => setModal(null)} onSave={handleSaveAtributo} />}
    </div>
  )
}

export default InvGruposPage
