import React, { useState, useEffect } from 'react'
import { apiCall, toArray } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'
import { useAuth } from '../context/AuthContext'

// ── MODAL ITEM ─────────────────────────────────────────────────────────────
const ModalItem = ({ item, grupos, onClose, onSave }) => {
  const [form, setForm] = useState({
    id: item?.id || '',
    codigo: item?.codigo || '',
    grupo_id: item?.grupo_id || grupos[0]?.id || '',
    nombre: item?.nombre || '',
    observacion: item?.observacion || '',
    activo: item?.activo ?? 1,
    valores: [],
  })
  const [atributos, setAtributos] = useState([])
  const [loadingAtrs, setLoadingAtrs] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!item?.id
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!form.grupo_id) return
    setLoadingAtrs(true)
    apiCall(`/qf/inv/atributos/listar?grupoId=${form.grupo_id}`)
      .then(res => {
        // Filtrar atributos solo del grupo seleccionado
        const todos = toArray(res)
        const atrs = todos.filter(a => a.grupo_id === form.grupo_id || String(a.grupo_id) === String(form.grupo_id))
        setAtributos(atrs)
        if (isEdit) {
          apiCall(`/qf/inv/items/detalle?itemId=${item.id}`)
            .then(vals => {
              // No usar toArray aquí — los valores no tienen campo 'id'
              let valArr = []
              if (Array.isArray(vals)) valArr = vals
              else if (vals && typeof vals === 'object' && vals.data) valArr = Array.isArray(vals.data) ? vals.data : []
              else if (vals && typeof vals === 'object' && vals.atributo_id) valArr = [vals]
              const valMap = {}
              valArr.forEach(v => { if (v.atributo_id) valMap[v.atributo_id] = v.valor })
              setForm(f => ({ ...f, valores: atrs.map(a => ({ atributo_id: a.id, valor: valMap[a.id] || '' })) }))
            })
        } else {
          setForm(f => ({ ...f, valores: atrs.map(a => ({ atributo_id: a.id, valor: '' })) }))
        }
      })
      .finally(() => setLoadingAtrs(false))
  }, [form.grupo_id])

  const setValor = (atributoId, valor) => {
    setForm(f => ({ ...f, valores: f.valores.map(v => v.atributo_id === atributoId ? { ...v, valor } : v) }))
  }

  const handleSubmit = async () => {
    if (!form.codigo || !form.nombre || !form.grupo_id) { setError('Código, nombre y grupo son requeridos'); return }
    const requeridos = atributos.filter(a => a.requerido)
    for (const atr of requeridos) {
      const val = form.valores.find(v => v.atributo_id === atr.id)
      if (!val?.valor) { setError(`El atributo "${atr.nombre}" es requerido`); return }
    }
    setLoading(true); setError('')
    try { await onSave(form); onClose() }
    catch (e) { setError(e.message || 'Error al guardar') }
    finally { setLoading(false) }
  }

  const renderInput = (atr) => {
    const val = form.valores.find(v => v.atributo_id === atr.id)?.valor || ''
    const baseProps = { className: 'form-control', value: val, onChange: e => setValor(atr.id, e.target.value) }
    if (atr.tipo === 'lista') {
      const opts = (atr.opciones || '').split(',').map(o => o.trim()).filter(Boolean)
      return <select {...baseProps}><option value="">Seleccionar...</option>{opts.map(o => <option key={o} value={o}>{o}</option>)}</select>
    }
    if (atr.tipo === 'numero') return <input {...baseProps} type="number" />
    if (atr.tipo === 'fecha') return <input {...baseProps} type="date" />
    return <input {...baseProps} type="text" placeholder={`Ingresa ${atr.nombre}`} />
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <h3>{isEdit ? '✏️ Editar Item' : '➕ Nuevo Item'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <div className="form-group">
              <label className="form-label">Código *</label>
              <input className="form-control" value={form.codigo} onChange={e => set('codigo', e.target.value.toUpperCase())} placeholder="LAP-001" disabled={isEdit} />
              <small style={{ color: 'var(--qf-text-light)', fontSize: 11 }}>Inmutable una vez creado</small>
            </div>
            <div className="form-group">
              <label className="form-label">Grupo *</label>
              <select className="form-control" value={form.grupo_id} onChange={e => set('grupo_id', parseInt(e.target.value))} disabled={isEdit}>
                {grupos.length === 0 && <option value="">Sin grupos disponibles</option>}
                {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Nombre descriptivo *</label>
            <input className="form-control" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="HP EliteBook 840 G8" />
          </div>
          {loadingAtrs ? (
            <div style={{ padding: 20, textAlign: 'center' }}><span className="spinner dark" /></div>
          ) : atributos.length > 0 ? (
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16, marginBottom: 12, border: '1px solid var(--qf-border)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--qf-navy)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Características</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                {atributos.sort((a, b) => a.orden - b.orden).map(atr => (
                  <div key={atr.id} className="form-group">
                    <label className="form-label">{atr.nombre}{atr.requerido ? <span style={{ color: '#c62828' }}> *</span> : ''}</label>
                    {renderInput(atr)}
                  </div>
                ))}
              </div>
            </div>
          ) : form.grupo_id && (
            <div style={{ background: '#fff8e1', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 12, color: '#7c6f00' }}>
              ⚠️ Este grupo no tiene atributos definidos
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <textarea className="form-control" value={form.observacion} onChange={e => set('observacion', e.target.value)} rows={2} style={{ resize: 'vertical' }} placeholder="Notas adicionales..." />
          </div>
          {isEdit && (
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select className="form-control" value={form.activo} onChange={e => set('activo', parseInt(e.target.value))}>
                <option value={1}>Activo</option>
                <option value={0}>Inactivo</option>
              </select>
            </div>
          )}
          {error && <div style={{ background: '#fce4e4', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>⚠️ {error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <><span className="spinner" />Guardando...</> : isEdit ? '💾 Actualizar' : '➕ Crear Item'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL HISTORIAL ────────────────────────────────────────────────────────
const ModalHistorial = ({ item, onClose }) => {
  const [historial, setHistorial] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiCall(`/qf/inv/asignaciones/historial?itemId=${item.id}`)
      .then(res => setHistorial(toArray(res)))
      .finally(() => setLoading(false))
  }, [item.id])

  const accionLabel = {
    asignacion: { label: 'Asignación', color: '#2e7d32', bg: '#e8f5e9' },
    reasignacion: { label: 'Reasignación', color: '#e65100', bg: '#fff3e0' },
    devolucion: { label: 'Devolución', color: '#185FA5', bg: '#e3f2fd' }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <h3>📋 Historial — {item.codigo}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {loading ? <div style={{ padding: 30, textAlign: 'center' }}><span className="spinner dark" /></div>
            : historial.length === 0 ? <div className="empty-state"><p>Sin historial de asignaciones</p></div>
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

// ── MODAL ASIGNAR ──────────────────────────────────────────────────────────
const ModalAsignar = ({ item, usuarios, onClose, onSave }) => {
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
    try { await onSave({ ...form, item_id: item.id, accion: 'asignacion' }); onClose() }
    catch (e) { setError(e.message || 'Error al asignar') }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h3>👤 Asignar Item</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ background: '#e8eef5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
            <strong>{item.codigo}</strong> — {item.nombre}
            <div style={{ fontSize: 11, color: 'var(--qf-text-light)', marginTop: 2 }}>{item.grupo_nombre}</div>
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
            {loading ? <><span className="spinner" />Asignando...</> : '👤 Asignar'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ── MODAL REPORTE ──────────────────────────────────────────────────────────
const ModalReporte = ({ grupos, filtroGrupoActual, onClose }) => {
  // En producción, configura VITE_N8N_INVENTARIO_REPORT_URL en Vercel.
  // El fallback ngrok puede cambiar si reinicias ngrok.
  const REPORT_BASE_URL =
    import.meta.env.VITE_N8N_INVENTARIO_REPORT_URL ||
    'https://lissa-unfloatable-seditiously.ngrok-free.dev/webhook/qf/reportes/inventario'

  const [params, setParams] = useState({
    grupo_id: filtroGrupoActual !== 'todos' ? String(filtroGrupoActual) : '0',
    email: '',
    enviar_email: false,
  })

  const [urlReporte, setUrlReporte] = useState('')
  const [loadingPreview, setLoadingPreview] = useState(false)

  const set = (k, v) => setParams(p => ({ ...p, [k]: v }))

  const generarReporte = () => {
    const qs = new URLSearchParams()
    qs.set('grupo_id', params.grupo_id || '0')
    qs.set('inline', '1')

    // Fuerza una ejecución nueva en n8n/Carbone y evita cache del iframe/navegador.
    qs.set('_ts', Date.now().toString())

    if (params.enviar_email) {
      const email = params.email.trim()

      if (!email || !email.includes('@')) {
        alert('Ingresa un correo válido para enviar el reporte.')
        return
      }

      qs.set('email', email)
      qs.set('send', '1')
    }

    const url = `${REPORT_BASE_URL}?${qs.toString()}`

    // Limpia el iframe anterior para permitir generar/enviar varias veces desde el mismo modal.
    setUrlReporte('')

    window.setTimeout(() => {
      setLoadingPreview(true)
      setUrlReporte(url)
    }, 100)
  }

  const descargarUrl = () => {
    if (!urlReporte) return '#'
    const u = new URL(urlReporte)
    u.searchParams.set('download', '1')
    u.searchParams.delete('inline')
    return u.toString()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 1100, width: '94vw' }}>
        <div className="modal-header">
          <h3>📊 Reporte de Inventario</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body" style={{ maxHeight: '82vh', overflowY: 'auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(180px, 1fr) minmax(220px, 1fr) auto auto',
            gap: 12,
            alignItems: 'end',
            marginBottom: 16,
            background: '#f8fafc',
            border: '1px solid var(--qf-border)',
            borderRadius: 12,
            padding: 14
          }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Grupo</label>
              <select
                className="form-control"
                value={params.grupo_id}
                onChange={e => set('grupo_id', e.target.value)}
              >
                <option value="0">Todos los grupos</option>
                {grupos.map(g => (
                  <option key={g.id} value={g.id}>{g.nombre}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Correo opcional</label>
              <input
                className="form-control"
                placeholder="correo@qf-factoring.com"
                value={params.email}
                onChange={e => set('email', e.target.value)}
              />
            </div>

            <label style={{
              display: 'flex',
              gap: 6,
              alignItems: 'center',
              height: 38,
              fontSize: 13,
              color: 'var(--qf-navy)',
              fontWeight: 600
            }}>
              <input
                type="checkbox"
                checked={params.enviar_email}
                onChange={e => set('enviar_email', e.target.checked)}
              />
              Enviar correo
            </label>

            <button className="btn btn-primary" onClick={generarReporte}>
              📄 Generar
            </button>
          </div>

          {!urlReporte ? (
            <div className="empty-state">
              <div className="icon">📊</div>
              <p>Selecciona los parámetros y presiona “Generar”.</p>
            </div>
          ) : (
            <div style={{
              border: '1px solid var(--qf-border)',
              borderRadius: 12,
              overflow: 'hidden',
              background: '#fff'
            }}>
              {loadingPreview && (
                <div style={{
                  padding: 10,
                  fontSize: 12,
                  color: 'var(--qf-text-light)',
                  borderBottom: '1px solid var(--qf-border)'
                }}>
                  Cargando reporte...
                </div>
              )}
              <iframe
                src={urlReporte}
                title="Reporte de Inventario"
                style={{ width: '100%', height: '72vh', border: 0, display: 'block' }}
                onLoad={() => setLoadingPreview(false)}
              />
            </div>
          )}
        </div>

        <div className="modal-footer">
          {urlReporte && (
            <>
              <a className="btn btn-secondary" href={urlReporte} target="_blank" rel="noreferrer">
                🔎 Abrir en pestaña
              </a>
              <a className="btn btn-primary" href={descargarUrl()} target="_blank" rel="noreferrer">
                ⬇️ Descargar PDF
              </a>
            </>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────
const InvItemsPage = () => {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [grupos, setGrupos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [filtroGrupo, setFiltroGrupo] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [modal, setModal] = useState(null)
  const { toasts, show } = useToast()

  const cargar = async () => {
    setLoading(true)
    try {
      const [it, gr, us] = await Promise.all([
        apiCall('/qf/inv/items/listar'),
        apiCall('/qf/inv/grupos/listar'),
        apiCall('/qf/usuarios/listar'),
      ])
      setItems(toArray(it))
      setGrupos(toArray(gr))
      setUsuarios(toArray(us).filter(u => u.estado === 0))
    } catch (e) { show('Error al cargar items: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const handleAsignar = async (form) => {
    const res = await apiCall('/qf/inv/asignaciones/asignar', {
      method: 'POST',
      body: JSON.stringify({ ...form, usr_realizo_id: user?.id, usr_realizo: user?.username || user?.userName })
    })
    if (!res?.success) throw new Error(res?.message || 'Error al asignar')
    show('Item asignado correctamente')
    cargar()
  }

  const handleSave = async (form) => {
    const endpoint = form.id ? '/qf/inv/items/actualizar' : '/qf/inv/items/crear'
    const res = await apiCall(endpoint, { method: 'POST', body: JSON.stringify({ ...form, usr_crea: user?.userName || user?.username }) })
    if (!res.success) throw new Error(res.message)
    show(form.id ? 'Item actualizado' : 'Item creado')
    cargar()
  }

  const handleEliminar = async (item) => {
    if (item.estado !== 'disponible') { show('Solo se pueden eliminar items disponibles', 'error'); return }
    if (!confirm(`¿Eliminar ${item.codigo}?`)) return
    try {
      const res = await apiCall('/qf/inv/items/eliminar', { method: 'POST', body: JSON.stringify({ id: item.id }) })
      if (!res.success) throw new Error(res.message)
      show('Item eliminado'); cargar()
    } catch (e) { show(e.message, 'error') }
  }

  const estadoStyle = {
    disponible: { label: 'Disponible', cls: 'active' },
    asignado: { label: 'Asignado', cls: 'warning' },
    reparacion: { label: 'En reparación', cls: 'inactive' },
    baja: { label: 'Baja', cls: 'inactive' },
  }

  const filtrados = items.filter(i => {
    const matchFiltro = !filtro || i.codigo?.toLowerCase().includes(filtro.toLowerCase()) || i.nombre?.toLowerCase().includes(filtro.toLowerCase()) || i.asignado_a?.toLowerCase().includes(filtro.toLowerCase())
    const matchGrupo = filtroGrupo === 'todos' || String(i.grupo_id) === String(filtroGrupo)
    const matchEstado = filtroEstado === 'todos' || i.estado === filtroEstado
    return matchFiltro && matchGrupo && matchEstado
  })

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Montserrat', fontSize: 22, fontWeight: 700, color: 'var(--qf-navy)', marginBottom: 4 }}>📦 Items</h1>
        <p style={{ color: 'var(--qf-text-light)', fontSize: 13 }}>Inventario de equipos y materiales</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total', value: items.length, color: 'var(--qf-navy)', border: '#2196f3' },
          { label: 'Disponibles', value: items.filter(i => i.estado === 'disponible').length, color: '#2e7d32', border: '#4caf50' },
          { label: 'Asignados', value: items.filter(i => i.estado === 'asignado').length, color: '#e65100', border: '#ff9800' },
          { label: 'En reparación', value: items.filter(i => i.estado === 'reparacion').length, color: '#c62828', border: '#f44336' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderTop: `3px solid ${s.border}` }}>
            <div style={{ fontSize: 10, color: 'var(--qf-text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: 'Montserrat', lineHeight: 1.2 }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div className="page-card">
        <div className="page-card-header">
          <h2>Lista de Items</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="filter-input" value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)} style={{ width: 'auto', minWidth: 140 }}>
              <option value="todos">Todos los grupos</option>
              {grupos.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
            </select>
            <select className="filter-input" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ width: 'auto', minWidth: 140 }}>
              <option value="todos">Todos los estados</option>
              <option value="disponible">Disponible</option>
              <option value="asignado">Asignado</option>
              <option value="reparacion">En reparación</option>
              <option value="baja">Baja</option>
            </select>
            <input className="filter-input" placeholder="🔍 Filtrar..." value={filtro} onChange={e => setFiltro(e.target.value)} />
            <button className="btn btn-secondary btn-sm" onClick={() => setModal({ type: 'reporte' })} disabled={grupos.length === 0}>📊 Reporte</button>
            <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'nuevo' })} disabled={grupos.length === 0}>➕ Nuevo Item</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner dark" /></div>
          ) : grupos.length === 0 ? (
            <div className="empty-state"><div className="icon">⚠️</div><p>Primero crea grupos en "Grupos y Atributos"</p></div>
          ) : filtrados.length === 0 ? (
            <div className="empty-state"><div className="icon">📦</div><p>No se encontraron items</p></div>
          ) : (
            <table className="qf-table">
              <thead>
                <tr><th>Código</th><th>Nombre</th><th>Grupo</th><th>Estado</th><th>Asignado a</th><th style={{ textAlign: 'center' }}>Acciones</th></tr>
              </thead>
              <tbody>
                {filtrados.map(i => {
                  const est = estadoStyle[i.estado] || { label: i.estado, cls: 'inactive' }
                  return (
                    <tr key={i.id}>
                      <td><code style={{ background: '#e8eef5', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{i.codigo}</code></td>
                      <td style={{ fontWeight: 500 }}>{i.nombre}</td>
                      <td><span style={{ background: '#e8eef5', color: 'var(--qf-navy)', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{i.grupo_nombre}</span></td>
                      <td><span className={`badge ${est.cls}`}>{est.label}</span></td>
                      <td style={{ fontSize: 12, color: i.asignado_a ? 'var(--qf-navy)' : 'var(--qf-text-light)', fontWeight: i.asignado_a ? 500 : 400 }}>{i.asignado_a || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setModal({ type: 'historial', data: i })} title="Historial">📋</button>
                          {i.estado === 'disponible' && (
                            <button className="btn btn-success btn-sm" onClick={() => setModal({ type: 'asignar', data: i })} title="Asignar">👤</button>
                          )}
                          <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'editar', data: i })} title="Editar">✏️</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleEliminar(i)} title="Eliminar" disabled={i.estado !== 'disponible'}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        {!loading && <div style={{ padding: '12px 24px', borderTop: '1px solid var(--qf-border)', fontSize: 12, color: 'var(--qf-text-light)' }}>{filtrados.length} de {items.length} items</div>}
      </div>
      {modal?.type === 'nuevo' && <ModalItem grupos={grupos} onClose={() => setModal(null)} onSave={handleSave} />}
      {modal?.type === 'editar' && <ModalItem item={modal.data} grupos={grupos} onClose={() => setModal(null)} onSave={handleSave} />}
      {modal?.type === 'historial' && <ModalHistorial item={modal.data} onClose={() => setModal(null)} />}
      {modal?.type === 'asignar' && <ModalAsignar item={modal.data} usuarios={usuarios} onClose={() => setModal(null)} onSave={handleAsignar} />}
      {modal?.type === 'reporte' && (
        <ModalReporte
          grupos={grupos}
          filtroGrupoActual={filtroGrupo}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

export default InvItemsPage