import React, { useEffect, useMemo, useState } from 'react'
import { apiCall, toArray } from '../utils/api'
import ToastContainer from '../components/ToastContainer'
import { useToast } from '../hooks/useToast'
import { useAuth } from '../context/AuthContext'

const ENDPOINTS = {
  listar: '/qf/tareas/listar',
  crear: '/qf/tareas/crear',
  actualizar: '/qf/tareas/actualizar',
  eliminar: '/qf/tareas/eliminar',
}

const emptyForm = {
  id: null,
  tipo_tarea: 'Soporte',
  titulo: '',
  descripcion: '',
  fecha_inicio: '',
  hora_inicio: '',
  fecha_fin: '',
  hora_fin: '',
  estado: 'Completado',
  prioridad: 'Media',
  observaciones: '',
}

const tipos = ['Soporte', 'Programación', 'Reunión', 'Análisis', 'Gestión', 'Documentación', 'Otro']
const estados = ['Pendiente', 'En proceso', 'Completado', 'Cancelado']
const prioridades = ['Baja', 'Media', 'Alta', 'Crítica']

const norm = v => String(v ?? '').toLowerCase().trim()
const fmtDate = v => v ? new Date(`${v}T00:00:00`).toLocaleDateString('es-PE') : '-'
const minToTime = min => {
  const n = Number(min || 0)
  const h = Math.floor(n / 60)
  const m = n % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}
const today = () => new Date().toISOString().slice(0, 10)
const nowTime = () => new Date().toTimeString().slice(0, 5)

export default function TareasPage() {
  const { user } = useAuth()
  const { toasts, show } = useToast()

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const [q, setQ] = useState('')
  const [tipo, setTipo] = useState('')
  const [estado, setEstado] = useState('')
  const [usuario, setUsuario] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [sort, setSort] = useState({ key: 'fecha_inicio', dir: 'desc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const userId = user?.id || user?.userId || user?.email || user?.username || ''
  const userName = user?.name || user?.nombre || user?.username || user?.email || 'Usuario'
  const userEmail = user?.email || ''
  const isAdmin = Boolean(user?.isAdmin || user?.role === 'admin' || user?.claims?.TAREAS_ADMIN || user?.permissions?.TAREAS_ADMIN)

  const cargar = async () => {
    setLoading(true)
    try {
      const endpoint = `${ENDPOINTS.listar}?page=1&pageSize=5000${!isAdmin && userId ? `&usuario_id=${encodeURIComponent(userId)}` : ''}`
      const res = await apiCall(endpoint)
      const data = Array.isArray(res) ? res : (res?.data || res?.items || res?.rows || [])
      setRows(toArray(data))
    } catch (e) {
      show('No se pudo cargar tareas: ' + (e.message || ''), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const usuarios = useMemo(() => {
    const set = new Set(rows.map(r => r.usuario_nombre || r.usuario_email || r.usuario_id).filter(Boolean))
    return [...set].sort()
  }, [rows])

  const filtered = useMemo(() => {
    const term = norm(q)
    return rows
      .filter(r => {
        const txt = `${r.titulo} ${r.descripcion} ${r.tipo_tarea} ${r.estado} ${r.prioridad} ${r.usuario_nombre} ${r.usuario_email} ${r.observaciones}`
        const okQ = !term || norm(txt).includes(term)
        const okTipo = !tipo || r.tipo_tarea === tipo
        const okEstado = !estado || r.estado === estado
        const okUser = !usuario || (r.usuario_nombre === usuario || r.usuario_email === usuario || r.usuario_id === usuario)
        const okDesde = !desde || String(r.fecha_inicio || '') >= desde
        const okHasta = !hasta || String(r.fecha_inicio || '') <= hasta
        return okQ && okTipo && okEstado && okUser && okDesde && okHasta
      })
      .sort((a, b) => {
        const av = a[sort.key] ?? ''
        const bv = b[sort.key] ?? ''
        const mult = sort.dir === 'asc' ? 1 : -1
        if (sort.key === 'duracion_minutos') return (Number(av) - Number(bv)) * mult
        return String(av).localeCompare(String(bv)) * mult
      })
  }, [rows, q, tipo, estado, usuario, desde, hasta, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)

  const kpis = useMemo(() => {
    const totalMin = filtered.reduce((s, r) => s + Number(r.duracion_minutos || 0), 0)
    return {
      total: filtered.length,
      horas: minToTime(totalMin),
      soporte: filtered.filter(r => r.tipo_tarea === 'Soporte').length,
      programacion: filtered.filter(r => r.tipo_tarea === 'Programación').length,
      completadas: filtered.filter(r => r.estado === 'Completado').length,
      pendientes: filtered.filter(r => r.estado !== 'Completado' && r.estado !== 'Cancelado').length,
    }
  }, [filtered])

  const resetFilters = () => {
    setQ('')
    setTipo('')
    setEstado('')
    setUsuario('')
    setDesde('')
    setHasta('')
    setPage(1)
  }

  const openCreate = () => {
    const d = today()
    const h = nowTime()
    setForm({ ...emptyForm, fecha_inicio: d, fecha_fin: d, hora_inicio: h, hora_fin: h })
    setModal('create')
  }

  const openEdit = r => {
    setForm({
      id: r.id,
      tipo_tarea: r.tipo_tarea || 'Otro',
      titulo: r.titulo || '',
      descripcion: r.descripcion || '',
      fecha_inicio: r.fecha_inicio || '',
      hora_inicio: String(r.hora_inicio || '').slice(0, 5),
      fecha_fin: r.fecha_fin || '',
      hora_fin: String(r.hora_fin || '').slice(0, 5),
      estado: r.estado || 'Completado',
      prioridad: r.prioridad || 'Media',
      observaciones: r.observaciones || '',
    })
    setModal('edit')
  }

  const openView = r => {
    setForm({ ...r, hora_inicio: String(r.hora_inicio || '').slice(0, 5), hora_fin: String(r.hora_fin || '').slice(0, 5) })
    setModal('view')
  }

  const validar = () => {
    if (!form.titulo.trim()) return 'Ingrese título de tarea'
    if (!form.fecha_inicio || !form.hora_inicio) return 'Ingrese fecha/hora de inicio'
    if (!form.fecha_fin || !form.hora_fin) return 'Ingrese fecha/hora final'
    const ini = new Date(`${form.fecha_inicio}T${form.hora_inicio}`)
    const fin = new Date(`${form.fecha_fin}T${form.hora_fin}`)
    if (fin < ini) return 'La fecha/hora final no puede ser menor que la inicial'
    return ''
  }

  const guardar = async () => {
    const error = validar()
    if (error) return show(error, 'warning')

    const payload = { ...form, usuario_id: userId, usuario_nombre: userName, usuario_email: userEmail }

    try {
      if (modal === 'edit') {
        await apiCall(ENDPOINTS.actualizar, { method: 'PUT', body: payload })
        show('Tarea actualizada correctamente', 'success')
      } else {
        await apiCall(ENDPOINTS.crear, { method: 'POST', body: payload })
        show('Tarea creada correctamente', 'success')
      }
      setModal(null)
      cargar()
    } catch (e) {
      show('No se pudo guardar: ' + (e.message || ''), 'error')
    }
  }

  const eliminar = async r => {
    if (!window.confirm(`¿Eliminar la tarea "${r.titulo}"?`)) return
    try {
      await apiCall(ENDPOINTS.eliminar, { method: 'DELETE', body: { id: r.id } })
      show('Tarea eliminada', 'success')
      cargar()
    } catch (e) {
      show('No se pudo eliminar: ' + (e.message || ''), 'error')
    }
  }

  const th = (key, label) => (
    <th onClick={() => setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }))}>
      {label} {sort.key === key ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
    </th>
  )

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />

      <div className="page-header compact">
        <div>
          <h1>📝 Tareas</h1>
          <p>Bitácora de tareas realizadas por usuario, con fechas, horas y reporte filtrable.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary btn-sm" onClick={openCreate}>+ Nueva tarea</button>
          <button className="btn btn-secondary btn-sm" onClick={cargar}>Actualizar</button>
        </div>
      </div>

      <section className="metrics-grid compact">
        <Metric label="Tareas" value={kpis.total} color="#185FA5" />
        <Metric label="Horas" value={kpis.horas} color="#2E7D32" />
        <Metric label="Soporte" value={kpis.soporte} color="#F57C00" />
        <Metric label="Programación" value={kpis.programacion} color="#7E57C2" />
        <Metric label="Completadas" value={kpis.completadas} color="#0097A7" />
        <Metric label="Pendientes" value={kpis.pendientes} color="#C62828" />
      </section>

      <section className="page-card compact">
        <div className="filters-row">
          <div className="filter-group wide">
            <label>Buscar</label>
            <input className="filter-input" value={q} onChange={e => { setQ(e.target.value); setPage(1) }} placeholder="Título, descripción, usuario..." />
          </div>

          <div className="filter-group">
            <label>Tipo</label>
            <select className="filter-input" value={tipo} onChange={e => { setTipo(e.target.value); setPage(1) }}>
              <option value="">Todos</option>
              {tipos.map(x => <option key={x}>{x}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label>Estado</label>
            <select className="filter-input" value={estado} onChange={e => { setEstado(e.target.value); setPage(1) }}>
              <option value="">Todos</option>
              {estados.map(x => <option key={x}>{x}</option>)}
            </select>
          </div>

          {isAdmin && (
            <div className="filter-group">
              <label>Usuario</label>
              <select className="filter-input" value={usuario} onChange={e => { setUsuario(e.target.value); setPage(1) }}>
                <option value="">Todos</option>
                {usuarios.map(x => <option key={x}>{x}</option>)}
              </select>
            </div>
          )}

          <div className="filter-group">
            <label>Desde</label>
            <input className="filter-input" type="date" value={desde} onChange={e => { setDesde(e.target.value); setPage(1) }} />
          </div>

          <div className="filter-group">
            <label>Hasta</label>
            <input className="filter-input" type="date" value={hasta} onChange={e => { setHasta(e.target.value); setPage(1) }} />
          </div>

          <button className="btn btn-secondary btn-sm" onClick={resetFilters}>Limpiar</button>
        </div>

        <div className="table-toolbar">
          <span>{filtered.length} registros</span>
          <select className="filter-input small" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}>
            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        <div className="table-scroll">
          <table className="data-table compact clickable-head">
            <thead>
              <tr>
                {th('fecha_inicio', 'Inicio')}
                {th('hora_inicio', 'Hora')}
                {th('fecha_fin', 'Fin')}
                {th('tipo_tarea', 'Tipo')}
                {th('titulo', 'Tarea')}
                {th('usuario_nombre', 'Usuario')}
                {th('duracion_minutos', 'Duración')}
                {th('estado', 'Estado')}
                {th('prioridad', 'Prioridad')}
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="10" className="empty-cell">Cargando...</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan="10" className="empty-cell">Sin registros</td></tr>
              ) : pageRows.map(r => (
                <tr key={r.id}>
                  <td>{fmtDate(r.fecha_inicio)}</td>
                  <td>{String(r.hora_inicio || '').slice(0, 5)}</td>
                  <td>{fmtDate(r.fecha_fin)}</td>
                  <td><Badge text={r.tipo_tarea} type="info" /></td>
                  <td className="strong">{r.titulo}</td>
                  <td>{r.usuario_nombre || r.usuario_email || r.usuario_id}</td>
                  <td>{minToTime(r.duracion_minutos)}</td>
                  <td><Badge text={r.estado} type={r.estado === 'Completado' ? 'success' : r.estado === 'Cancelado' ? 'danger' : 'warning'} /></td>
                  <td><Badge text={r.prioridad} type={r.prioridad === 'Crítica' || r.prioridad === 'Alta' ? 'danger' : r.prioridad === 'Media' ? 'warning' : 'success'} /></td>
                  <td className="actions-cell">
                    <button className="icon-btn" onClick={() => openView(r)} title="Ver">👁️</button>
                    <button className="icon-btn" onClick={() => openEdit(r)} title="Editar">✏️</button>
                    <button className="icon-btn danger" onClick={() => eliminar(r)} title="Eliminar">🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination-row">
          <button className="btn btn-secondary btn-xs" onClick={() => setPage(1)} disabled={page === 1}>«</button>
          <button className="btn btn-secondary btn-xs" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
          <span>{page} / {totalPages}</span>
          <button className="btn btn-secondary btn-xs" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
          <button className="btn btn-secondary btn-xs" onClick={() => setPage(totalPages)} disabled={page === totalPages}>»</button>
        </div>
      </section>

      {modal && <TaskModal mode={modal} form={form} setForm={setForm} onClose={() => setModal(null)} onSave={guardar} />}
    </div>
  )
}

function Metric({ label, value, color }) {
  return <div className="metric-card compact" style={{ borderTopColor: color }}><span>{label}</span><strong style={{ color }}>{value}</strong></div>
}

function Badge({ text, type }) {
  return <span className={`status-badge ${type || 'info'}`}>{text || '-'}</span>
}

function TaskModal({ mode, form, setForm, onClose, onSave }) {
  const readOnly = mode === 'view'
  const title = mode === 'create' ? 'Nueva tarea' : mode === 'edit' ? 'Editar tarea' : 'Detalle de tarea'
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay">
      <div className="modal-card large">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body grid">
          <div className="form-group">
            <label>Tipo</label>
            <select disabled={readOnly} value={form.tipo_tarea} onChange={e => set('tipo_tarea', e.target.value)}>
              {tipos.map(x => <option key={x}>{x}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Estado</label>
            <select disabled={readOnly} value={form.estado} onChange={e => set('estado', e.target.value)}>
              {estados.map(x => <option key={x}>{x}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label>Prioridad</label>
            <select disabled={readOnly} value={form.prioridad} onChange={e => set('prioridad', e.target.value)}>
              {prioridades.map(x => <option key={x}>{x}</option>)}
            </select>
          </div>

          <div className="form-group span-3">
            <label>Título</label>
            <input disabled={readOnly} value={form.titulo} onChange={e => set('titulo', e.target.value)} maxLength={180} />
          </div>

          <div className="form-group">
            <label>Fecha inicio</label>
            <input disabled={readOnly} type="date" value={form.fecha_inicio || ''} onChange={e => set('fecha_inicio', e.target.value)} />
          </div>

          <div className="form-group">
            <label>Hora inicio</label>
            <input disabled={readOnly} type="time" value={form.hora_inicio || ''} onChange={e => set('hora_inicio', e.target.value)} />
          </div>

          <div className="form-group">
            <label>Fecha fin</label>
            <input disabled={readOnly} type="date" value={form.fecha_fin || ''} onChange={e => set('fecha_fin', e.target.value)} />
          </div>

          <div className="form-group">
            <label>Hora fin</label>
            <input disabled={readOnly} type="time" value={form.hora_fin || ''} onChange={e => set('hora_fin', e.target.value)} />
          </div>

          <div className="form-group span-3">
            <label>Descripción</label>
            <textarea disabled={readOnly} value={form.descripcion || ''} onChange={e => set('descripcion', e.target.value)} rows={4} />
          </div>

          <div className="form-group span-3">
            <label>Observaciones</label>
            <textarea disabled={readOnly} value={form.observaciones || ''} onChange={e => set('observaciones', e.target.value)} rows={3} />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
          {!readOnly && <button className="btn btn-primary" onClick={onSave}>Guardar</button>}
        </div>
      </div>
    </div>
  )
}
