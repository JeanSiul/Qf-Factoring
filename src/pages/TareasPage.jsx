import React, { useEffect, useMemo, useState } from 'react'
import { apiCall, toArray } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'
import { useAuth } from '../context/AuthContext'

const CLAIM = 'TAREAS'
const DEBOUNCE_MS = 450

const camposBusqueda = [
  { value: 'all', label: 'Todos' },
  { value: 'titulo', label: 'Título' },
  { value: 'descripcion', label: 'Descripción' },
  { value: 'tipo_tarea', label: 'Tipo' },
  { value: 'estado', label: 'Estado' },
  { value: 'prioridad', label: 'Prioridad' },
  { value: 'usuario_nombre', label: 'Usuario' },
]

const tipos = ['Soporte', 'Programación', 'Reunión', 'Análisis', 'Gestión', 'Documentación', 'Otro']
const estados = ['Pendiente', 'En proceso', 'Completado', 'Cancelado']
const prioridades = ['Baja', 'Media', 'Alta', 'Crítica']

const formatDate = value => {
  if (!value) return '-'
  const d = new Date(String(value).includes('T') ? value : `${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10)
  return d.toLocaleDateString('es-PE')
}

const toDateInput = value => {
  if (!value) return ''
  const d = new Date(String(value).includes('T') ? value : `${value}T00:00:00`)
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10)
  return d.toISOString().slice(0, 10)
}

const toTimeInput = value => String(value || '').slice(0, 5)

const today = () => new Date().toISOString().slice(0, 10)
const nowTime = () => new Date().toTimeString().slice(0, 5)

const minToTime = value => {
  const n = Number(value || 0)
  const h = Math.floor(n / 60)
  const m = n % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}

const calcMinutes = item => {
  if (item?.duracion_minutos !== undefined && item?.duracion_minutos !== null) return Number(item.duracion_minutos || 0)
  if (!item?.fecha_inicio || !item?.hora_inicio || !item?.fecha_fin || !item?.hora_fin) return 0
  const ini = new Date(`${item.fecha_inicio}T${toTimeInput(item.hora_inicio)}`)
  const fin = new Date(`${item.fecha_fin}T${toTimeInput(item.hora_fin)}`)
  if (Number.isNaN(ini.getTime()) || Number.isNaN(fin.getTime())) return 0
  return Math.max(0, Math.round((fin - ini) / 60000))
}

const badgeClass = status => {
  const s = String(status || '').toLowerCase()
  if (s.includes('pendiente') || s.includes('proceso')) return 'warning'
  if (s.includes('completado') || s.includes('finalizado')) return 'active'
  if (s.includes('cancelado') || s.includes('error')) return 'inactive'
  return 'warning'
}

const prioridadStyle = value => {
  const s = String(value || '').toLowerCase()
  if (s.includes('crítica') || s.includes('critica') || s.includes('alta')) return 'inactive'
  if (s.includes('media')) return 'warning'
  return 'active'
}

const norm = value => String(value ?? '').toLowerCase().trim()

const operadoresFiltro = [
  { value: 'contains', label: 'Contiene' },
  { value: 'not_contains', label: 'No contiene' },
  { value: 'equals', label: 'Igual' },
  { value: 'not_equals', label: 'Distinto' },
  { value: 'starts', label: 'Empieza con' },
  { value: 'ends', label: 'Termina con' },
  { value: 'blank', label: 'Vacío' },
  { value: 'not_blank', label: 'No vacío' },
]

const columnasFiltro = [
  { key: 'fecha_inicio', type: 'date' },
  { key: 'fecha_fin', type: 'date' },
  { key: 'tipo_tarea', type: 'select', options: tipos },
  { key: 'titulo', type: 'text' },
  { key: 'usuario_nombre', type: 'text' },
  { key: 'duracion_minutos', type: 'number' },
  { key: 'estado', type: 'select', options: estados },
  { key: 'prioridad', type: 'select', options: prioridades },
]

const initialColumnFilters = columnasFiltro.reduce((acc, col) => {
  acc[col.key] = { op: col.type === 'select' ? 'equals' : 'contains', value: '' }
  return acc
}, {})

const getFilterValue = (item, key) => {
  if (key === 'duracion_minutos') return String(calcMinutes(item))
  if (key === 'fecha_inicio' || key === 'fecha_fin') return toDateInput(item?.[key])
  return item?.[key] ?? ''
}

const matchColumnFilter = (rawValue, filter) => {
  const op = filter?.op || 'contains'
  const value = filter?.value ?? ''
  const left = norm(rawValue)
  const right = norm(value)

  if (op === 'blank') return left === ''
  if (op === 'not_blank') return left !== ''
  if (!right) return true

  if (op === 'not_contains') return !left.includes(right)
  if (op === 'equals') return left === right
  if (op === 'not_equals') return left !== right
  if (op === 'starts') return left.startsWith(right)
  if (op === 'ends') return left.endsWith(right)
  return left.includes(right)
}

const emptyTask = user => ({
  tipo_tarea: 'Soporte',
  titulo: '',
  descripcion: '',
  fecha_inicio: today(),
  hora_inicio: nowTime(),
  fecha_fin: today(),
  hora_fin: nowTime(),
  estado: 'Completado',
  prioridad: 'Media',
  observaciones: '',
  usuario_id: user?.id || user?.userId || user?.email || user?.username || '',
  usuario_nombre: user?.name || user?.nombre || user?.username || user?.email || 'Usuario',
  usuario_email: user?.email || '',
})

const ModalDetalle = ({ item, onClose }) => (
  <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
    <div className="modal" style={{ maxWidth: 820 }}>
      <div className="modal-header">
        <h3>Detalle — {item.titulo || item.id}</h3>
        <button className="modal-close" onClick={onClose}>x</button>
      </div>

      <div className="modal-body">
        <div style={S.detailGrid}>
          {[
            ['ID', item.id || '-'],
            ['Tipo', item.tipo_tarea || '-'],
            ['Título', item.titulo || '-'],
            ['Usuario', item.usuario_nombre || item.usuario_email || item.usuario_id || '-'],
            ['Email', item.usuario_email || '-'],
            ['Inicio', `${formatDate(item.fecha_inicio)} ${toTimeInput(item.hora_inicio)}`],
            ['Fin', `${formatDate(item.fecha_fin)} ${toTimeInput(item.hora_fin)}`],
            ['Duración', minToTime(calcMinutes(item))],
            ['Estado', item.estado || '-'],
            ['Prioridad', item.prioridad || '-'],
            ['Descripción', item.descripcion || '-'],
            ['Observaciones', item.observaciones || '-'],
            ['Creado', formatDate(item.created_at)],
            ['Actualizado', formatDate(item.updated_at)],
          ].map(([k, v]) => (
            <div key={k} style={S.detailBox}>
              <div style={S.detailLabel}>{k}</div>
              <div style={S.detailValue}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
      </div>
    </div>
  </div>
)

const ModalTarea = ({ item, user, onClose, onSave }) => {
  const isEdit = !!item?.id
  const [form, setForm] = useState({
    ...emptyTask(user),
    ...(item || {}),
    fecha_inicio: toDateInput(item?.fecha_inicio) || today(),
    fecha_fin: toDateInput(item?.fecha_fin) || today(),
    hora_inicio: toTimeInput(item?.hora_inicio) || nowTime(),
    hora_fin: toTimeInput(item?.hora_fin) || nowTime(),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.titulo?.trim()) return setError('El título es requerido')
    if (!form.fecha_inicio || !form.hora_inicio) return setError('Fecha y hora de inicio son requeridas')
    if (!form.fecha_fin || !form.hora_fin) return setError('Fecha y hora final son requeridas')

    const ini = new Date(`${form.fecha_inicio}T${form.hora_inicio}`)
    const fin = new Date(`${form.fecha_fin}T${form.hora_fin}`)
    if (fin < ini) return setError('La fecha/hora final no puede ser menor que la inicial')

    setSaving(true)
    setError('')
    try {
      await onSave({
        ...form,
        titulo: form.titulo.trim(),
        descripcion: form.descripcion || '',
        observaciones: form.observaciones || '',
      })
      onClose()
    } catch (e) {
      setError(e.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 920, width: '94vw' }}>
        <div className="modal-header">
          <h3>{isEdit ? 'Editar Tarea' : 'Nueva Tarea'}</h3>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>

        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          <div style={S.g3}>
            <div className="form-group">
              <label className="form-label">Tipo *</label>
              <select className="form-control" value={form.tipo_tarea} onChange={e => set('tipo_tarea', e.target.value)}>
                {tipos.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Estado *</label>
              <select className="form-control" value={form.estado} onChange={e => set('estado', e.target.value)}>
                {estados.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Prioridad *</label>
              <select className="form-control" value={form.prioridad} onChange={e => set('prioridad', e.target.value)}>
                {prioridades.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Título *</label>
            <input className="form-control" value={form.titulo} onChange={e => set('titulo', e.target.value)} maxLength={180} />
          </div>

          <div style={S.g4}>
            <div className="form-group">
              <label className="form-label">Fecha inicio *</label>
              <input className="form-control" type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Hora inicio *</label>
              <input className="form-control" type="time" value={form.hora_inicio} onChange={e => set('hora_inicio', e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Fecha fin *</label>
              <input className="form-control" type="date" value={form.fecha_fin} onChange={e => set('fecha_fin', e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">Hora fin *</label>
              <input className="form-control" type="time" value={form.hora_fin} onChange={e => set('hora_fin', e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Descripción</label>
            <textarea className="form-control" rows={4} value={form.descripcion || ''} onChange={e => set('descripcion', e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <textarea className="form-control" rows={3} value={form.observaciones || ''} onChange={e => set('observaciones', e.target.value)} />
          </div>

          {error && <div style={S.errorBox}>⚠ {error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Guardando...' : isEdit ? 'Actualizar' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

const TareasPage = () => {
  const { permisos, user } = useAuth()
  const { toasts, show } = useToast()

  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [campo, setCampo] = useState('all')
  const [busqueda, setBusqueda] = useState('')
  const [tipo, setTipo] = useState('all')
  const [estado, setEstado] = useState('all')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [compactMode, setCompactMode] = useState(true)
  const [sortField, setSortField] = useState('fecha_inicio')
  const [sortDir, setSortDir] = useState('desc')
  const [columnFilters, setColumnFilters] = useState(initialColumnFilters)
  const [openFilter, setOpenFilter] = useState(null)

  const cv = permisos?.[CLAIM] || '11111111111'
  const canList = cv[1] !== '0'
  const canView = cv[2] !== '0'
  const canEdit = cv[3] !== '0'
  const canCreate = cv[5] !== '0'
  const canDelete = cv[6] !== '0'

  const userId = user?.id || user?.userId || user?.email || user?.username || ''
  const userName = user?.name || user?.nombre || user?.username || user?.email || 'Usuario'
  const userEmail = user?.email || ''

  const cargar = async (opts = {}) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('page', String(opts.page || page))
      qs.set('pageSize', String(opts.pageSize || pageSize))
      qs.set('field', opts.campo ?? campo)
      if ((opts.busqueda ?? busqueda).trim()) qs.set('q', (opts.busqueda ?? busqueda).trim())
      if ((opts.tipo ?? tipo) !== 'all') qs.set('tipo_tarea', opts.tipo ?? tipo)
      if ((opts.estado ?? estado) !== 'all') qs.set('estado', opts.estado ?? estado)
      if (opts.desde ?? desde) qs.set('desde', opts.desde ?? desde)
      if (opts.hasta ?? hasta) qs.set('hasta', opts.hasta ?? hasta)
      if (userId) qs.set('usuario_id', userId)

      const res = await apiCall(`/qf/tareas/listar?${qs}`)
      const rows = Array.isArray(res) ? res : (res?.data || res?.items || [])
      setData(toArray(rows))
      setTotal(Number(res?.total ?? rows.length))
    } catch (e) {
      show('Error: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [page, pageSize])

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      cargar({ page: 1 })
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [busqueda, campo, tipo, estado, desde, hasta])

  const limpiar = () => {
    setCampo('all')
    setBusqueda('')
    setTipo('all')
    setEstado('all')
    setDesde('')
    setHasta('')
    setColumnFilters(initialColumnFilters)
    setOpenFilter(null)
    setPage(1)
    cargar({ page: 1, campo: 'all', busqueda: '', tipo: 'all', estado: 'all', desde: '', hasta: '' })
  }

  const setColumnFilter = (key, patch) => {
    setColumnFilters(prev => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }))
    setPage(1)
  }

  const clearColumnFilter = key => {
    setColumnFilters(prev => ({
      ...prev,
      [key]: { ...initialColumnFilters[key] },
    }))
    setOpenFilter(null)
    setPage(1)
  }

  const columnFiltersActive = useMemo(() => (
    Object.values(columnFilters).some(f => {
      const op = f?.op || 'contains'
      return ['blank', 'not_blank'].includes(op) || String(f?.value || '').trim()
    })
  ), [columnFilters])

  const handleSave = async payload => {
    const p = {
      ...payload,
      usuario_id: payload.usuario_id || userId,
      usuario_nombre: payload.usuario_nombre || userName,
      usuario_email: payload.usuario_email || userEmail,
    }

    const res = await apiCall(p.id ? '/qf/tareas/actualizar' : '/qf/tareas/crear', {
      method: p.id ? 'PUT' : 'POST',
      body: JSON.stringify(p),
    })

    if (res?.success === false) throw new Error(res?.message || 'Error')
    show(p.id ? 'Tarea actualizada' : 'Tarea registrada')
    cargar()
  }

  const handleDelete = async item => {
    if (!confirm(`¿Eliminar la tarea "${item.titulo || item.id}"?`)) return
    try {
      const res = await apiCall('/qf/tareas/eliminar', {
        method: 'DELETE',
        body: JSON.stringify({ id: item.id }),
      })
      if (res?.success === false) throw new Error(res?.message || 'Error')
      show('Tarea eliminada')
      cargar()
    } catch (e) {
      show(e.message, 'error')
    }
  }

  const filteredData = useMemo(() => (
    data.filter(row => columnasFiltro.every(col => matchColumnFilter(getFilterValue(row, col.key), columnFilters[col.key])))
  ), [data, columnFilters])

  const vistaTotal = filteredData.length
  const totalPages = Math.max(1, Math.ceil(vistaTotal / pageSize))
  const from = vistaTotal === 0 ? 0 : ((page - 1) * pageSize) + 1
  const to = Math.min(page * pageSize, vistaTotal)

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const metrics = useMemo(() => {
    const mins = filteredData.reduce((s, r) => s + calcMinutes(r), 0)
    return {
      horas: minToTime(mins),
      soporte: filteredData.filter(r => r.tipo_tarea === 'Soporte').length,
      programacion: filteredData.filter(r => r.tipo_tarea === 'Programación').length,
      completadas: filteredData.filter(r => r.estado === 'Completado').length,
      pendientes: filteredData.filter(r => ['Pendiente', 'En proceso'].includes(r.estado)).length,
    }
  }, [filteredData])

  const handleSort = f => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else {
      setSortField(f)
      setSortDir('asc')
    }
  }

  const sortedData = useMemo(() => {
    if (!sortField) return filteredData
    return [...filteredData].sort((a, b) => {
      let va = a[sortField]
      let vb = b[sortField]
      if (sortField === 'duracion_minutos') return sortDir === 'asc' ? calcMinutes(a) - calcMinutes(b) : calcMinutes(b) - calcMinutes(a)
      if (sortField === 'fecha_inicio') {
        va = `${a.fecha_inicio || ''} ${a.hora_inicio || ''}`
        vb = `${b.fecha_inicio || ''} ${b.hora_inicio || ''}`
      }
      va = String(va || '').toLowerCase()
      vb = String(vb || '').toLowerCase()
      return va < vb ? (sortDir === 'asc' ? -1 : 1) : va > vb ? (sortDir === 'asc' ? 1 : -1) : 0
    })
  }, [filteredData, sortField, sortDir]

  const si = f => sortField !== f ? ' ↕' : sortDir === 'asc' ? ' ▲' : ' ▼'
  const paginatedData = useMemo(() => sortedData.slice((page - 1) * pageSize, page * pageSize), [sortedData, page, pageSize])

  const FilterCell = ({ col, align = 'left' }) => {
    const filter = columnFilters[col.key] || initialColumnFilters[col.key]
    const active = ['blank', 'not_blank'].includes(filter.op) || String(filter.value || '').trim()
    const showInput = !['blank', 'not_blank'].includes(filter.op)

    return (
      <th style={{ ...S.filterTh, textAlign: align }}>
        <div style={{ ...S.colFilterWrap, justifyContent: align === 'center' ? 'center' : 'flex-start' }}>
          {col.type === 'select' ? (
            <select
              className="filter-input"
              value={filter.value}
              onChange={e => setColumnFilter(col.key, { value: e.target.value })}
              style={S.colSelect}
            >
              <option value="">Todos</option>
              {(col.options || []).map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          ) : showInput ? (
            <input
              className="filter-input"
              type={col.type === 'date' ? 'date' : col.type === 'number' ? 'number' : 'text'}
              value={filter.value}
              onChange={e => setColumnFilter(col.key, { value: e.target.value })}
              style={S.colInput}
            />
          ) : (
            <span style={S.blankFilterLabel}>{filter.op === 'blank' ? 'Vacío' : 'No vacío'}</span>
          )}

          <button
            type="button"
            onClick={() => setOpenFilter(openFilter === col.key ? null : col.key)}
            style={{ ...S.filterIconBtn, color: active ? '#185FA5' : 'var(--qf-text-light)' }}
            title="Opciones de filtro"
          >
            ≡
          </button>

          {openFilter === col.key && (
            <div style={S.filterMenu}>
              {operadoresFiltro.map(op => (
                <button
                  key={op.value}
                  type="button"
                  onClick={() => setColumnFilter(col.key, { op: op.value, value: ['blank', 'not_blank'].includes(op.value) ? '' : filter.value })}
                  style={{ ...S.filterOption, ...(filter.op === op.value ? S.filterOptionActive : {}) }}
                >
                  {op.label}
                </button>
              ))}
              <button type="button" onClick={() => clearColumnFilter(col.key)} style={S.filterClear}>Limpiar columna</button>
            </div>
          )}
        </div>
      </th>
    )
  }

  if (!canList) {
    return (
      <div className="fade-in" style={S.page}>
        <div style={S.topHeader}>
          <h1 style={S.title}>📝 Tareas</h1>
          <p style={S.subtitle}>No tienes permisos para ver esta lista</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in" style={S.page}>
      <ToastContainer toasts={toasts} />

      <div style={S.topHeader}>
        <h1 style={S.title}>📝 Tareas</h1>
        <p style={S.subtitle}>Bitácora de tareas realizadas por usuario, con fechas, horas y reporte filtrable.</p>
      </div>

      <div style={S.actionBar}>
        <button className="btn btn-secondary btn-sm" onClick={() => setCompactMode(v => !v)}>
          {compactMode ? 'Vista cómoda' : 'Vista compacta'}
        </button>
      </div>

      <div style={S.kpiGrid}>
        {[
          { l: 'Total registros', v: total, c: 'var(--qf-navy)', b: '#2196f3' },
          { l: 'Mostradas', v: vistaTotal, c: '#185FA5', b: '#03a9f4' },
          { l: 'Horas registradas', v: metrics.horas, c: '#2e7d32', b: '#4caf50' },
          { l: 'Soporte', v: metrics.soporte, c: '#e65100', b: '#ff9800' },
          { l: 'Programación', v: metrics.programacion, c: '#5e35b1', b: '#7e57c2' },
          { l: 'Pendientes', v: metrics.pendientes, c: '#c62828', b: '#f44336' },
        ].map(s => (
          <div key={s.l} style={{ ...S.kpiCard, borderTop: `3px solid ${s.b}` }}>
            <div style={S.kpiLabel}>{s.l}</div>
            <div style={{ ...S.kpiValue, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="page-card" style={S.card}>
        <div style={S.stickyTools}>
          <div style={S.cardTitleWrap}>
            <h2 style={S.cardTitle}>Lista de Tareas</h2>
            {canCreate && (
              <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'nuevo' })} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: '#4CAF50', fontWeight: 800, fontSize: 16 }}>+</span> Nueva Tarea
              </button>
            )}
          </div>

          <div style={S.filtersRow}>
            <select className="filter-input" value={campo} onChange={e => setCampo(e.target.value)} style={S.fieldSelect}>
              {camposBusqueda.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#8a9bb5', pointerEvents: 'none' }}>🔍</span>
              <input
                className="filter-input"
                placeholder={campo === 'all' ? 'Buscar...' : `Buscar por ${camposBusqueda.find(f => f.value === campo)?.label || ''}...`}
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                style={{ ...S.searchInput, paddingLeft: 32, width: '100%' }}
              />
            </div>

            <select className="filter-input" value={tipo} onChange={e => setTipo(e.target.value)} style={S.fieldSelect}>
              <option value="all">Tipo: Todos</option>
              {tipos.map(x => <option key={x} value={x}>{x}</option>)}
            </select>

            <select className="filter-input" value={estado} onChange={e => setEstado(e.target.value)} style={S.fieldSelect}>
              <option value="all">Estado: Todos</option>
              {estados.map(x => <option key={x} value={x}>{x}</option>)}
            </select>

            <input className="filter-input" type="date" value={desde} onChange={e => setDesde(e.target.value)} style={S.dateInput} />
            <input className="filter-input" type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={S.dateInput} />

            <button className="btn btn-secondary btn-sm" onClick={limpiar}>Limpiar</button>
          </div>

          <div style={S.pagRow}>
            <span style={S.pill}>{from}-{to} de {vistaTotal}</span>
            <select className="filter-input" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} style={{ width: 'auto', minWidth: 52, height: 28, fontSize: 11, padding: '0 4px' }}>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>

            <button className="btn btn-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setPage(1)}>«</button>
            <button className="btn btn-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setPage(p => Math.max(1, p - 1))}>‹</button>
            <span style={S.pageInfo}>{page}/{totalPages}</span>
            <button className="btn btn-secondary btn-sm" disabled={page >= totalPages || loading} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>›</button>
            <button className="btn btn-secondary btn-sm" disabled={page >= totalPages || loading} onClick={() => setPage(totalPages)}>»</button>
            {loading && <span style={S.loadMini}>...</span>}
          </div>
        </div>

        <div style={{ overflow: 'auto', width: '100%', maxHeight: compactMode ? 'calc(100vh - 340px)' : 'calc(100vh - 400px)' }}>
          {loading && data.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner dark" /></div>
          ) : filteredData.length === 0 ? (
            <div className="empty-state"><div className="icon">📝</div><p>No se encontraron tareas</p></div>
          ) : (
            <table className="qf-table" style={{ width: '100%', tableLayout: 'auto', fontSize: compactMode ? 10.5 : 12 }}>
              <thead>
                <tr>
                  <th style={S.ths} onClick={() => handleSort('fecha_inicio')}>Inicio<span style={S.si}>{si('fecha_inicio')}</span></th>
                  <th style={S.ths} onClick={() => handleSort('fecha_fin')}>Fin<span style={S.si}>{si('fecha_fin')}</span></th>
                  <th style={S.ths} onClick={() => handleSort('tipo_tarea')}>Tipo<span style={S.si}>{si('tipo_tarea')}</span></th>
                  <th style={S.ths} onClick={() => handleSort('titulo')}>Tarea<span style={S.si}>{si('titulo')}</span></th>
                  <th style={S.ths} onClick={() => handleSort('usuario_nombre')}>Usuario<span style={S.si}>{si('usuario_nombre')}</span></th>
                  <th style={S.ths} onClick={() => handleSort('duracion_minutos')}>Duración<span style={S.si}>{si('duracion_minutos')}</span></th>
                  <th style={S.ths} onClick={() => handleSort('estado')}>Estado<span style={S.si}>{si('estado')}</span></th>
                  <th style={S.ths} onClick={() => handleSort('prioridad')}>Prioridad<span style={S.si}>{si('prioridad')}</span></th>
                  <th style={{ ...S.th0, textAlign: 'center' }}>Acc.</th>
                </tr>
                <tr>
                  <FilterCell col={columnasFiltro[0]} />
                  <FilterCell col={columnasFiltro[1]} />
                  <FilterCell col={columnasFiltro[2]} />
                  <FilterCell col={columnasFiltro[3]} />
                  <FilterCell col={columnasFiltro[4]} />
                  <FilterCell col={columnasFiltro[5]} />
                  <FilterCell col={columnasFiltro[6]} />
                  <FilterCell col={columnasFiltro[7]} />
                  <th style={{ ...S.filterTh, textAlign: 'center' }}>
                    {columnFiltersActive && (
                      <button className="btn btn-secondary btn-sm" onClick={limpiar} style={S.aBtn}>Limpiar</button>
                    )}
                  </th>
                </tr>
              </thead>

              <tbody>
                {paginatedData.map(r => (
                  <tr key={r.id} style={compactMode ? { height: 32 } : undefined}>
                    <td style={S.td}>
                      <code style={S.opCode}>{formatDate(r.fecha_inicio)}</code>
                      <div style={S.timeMini}>{toTimeInput(r.hora_inicio)}</div>
                    </td>
                    <td style={S.td}>
                      <code style={S.opCode}>{formatDate(r.fecha_fin)}</code>
                      <div style={S.timeMini}>{toTimeInput(r.hora_fin)}</div>
                    </td>
                    <td style={S.td}><span style={S.typePill}>{r.tipo_tarea || '-'}</span></td>
                    <td style={{ ...S.td, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>{r.titulo || '-'}</td>
                    <td style={{ ...S.td, fontSize: 10 }}>{r.usuario_nombre || r.usuario_email || r.usuario_id || '-'}</td>
                    <td style={{ ...S.td, fontWeight: 800, color: '#2e7d32', whiteSpace: 'nowrap' }}>{minToTime(calcMinutes(r))}</td>
                    <td style={S.td}><span className={`badge ${badgeClass(r.estado)}`} style={{ fontSize: 8 }}>{String(r.estado || '-').toUpperCase()}</span></td>
                    <td style={S.td}><span className={`badge ${prioridadStyle(r.prioridad)}`} style={{ fontSize: 8 }}>{String(r.prioridad || '-').toUpperCase()}</span></td>
                    <td style={{ ...S.td, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                        {canView && <button className="btn btn-secondary btn-sm" onClick={() => setModal({ type: 'detalle', data: r })} style={S.aBtn}>Ver</button>}
                        {canEdit && <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'editar', data: r })} style={S.aBtn}>Edit</button>}
                        {canDelete && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r)} style={S.aBtn}>Del</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && <div style={S.footerCount}>{paginatedData.length} de {vistaTotal} tareas</div>}
      </div>

      {modal?.type === 'detalle' && <ModalDetalle item={modal.data} onClose={() => setModal(null)} />}
      {modal?.type === 'nuevo' && <ModalTarea user={user} onClose={() => setModal(null)} onSave={handleSave} />}
      {modal?.type === 'editar' && <ModalTarea item={modal.data} user={user} onClose={() => setModal(null)} onSave={handleSave} />}
    </div>
  )
}

const S = {
  page: { paddingBottom: 12, maxWidth: '100%', overflowX: 'hidden' },
  topHeader: { marginBottom: 6 },
  title: { fontFamily: 'Montserrat', fontSize: 22, fontWeight: 800, color: 'var(--qf-navy)', marginBottom: 2 },
  subtitle: { color: 'var(--qf-text-light)', fontSize: 12 },
  actionBar: { display: 'flex', gap: 8, marginBottom: 8 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 10 },
  kpiCard: { background: '#fff', borderRadius: 10, padding: '8px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', minHeight: 56 },
  kpiLabel: { fontSize: 8.5, color: 'var(--qf-text-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  kpiValue: { fontWeight: 850, fontFamily: 'Montserrat', lineHeight: 1.1, fontSize: 19 },
  card: { overflow: 'hidden' },
  stickyTools: { background: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottom: '1px solid var(--qf-border)' },
  cardTitleWrap: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px 6px' },
  cardTitle: { margin: 0, fontSize: 16, fontFamily: 'Montserrat', color: 'var(--qf-navy)' },
  pill: { fontSize: 10, fontWeight: 700, color: 'var(--qf-navy)', background: '#e8eef5', borderRadius: 999, padding: '3px 8px' },
  filtersRow: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '0 14px 6px' },
  fieldSelect: { width: 'auto', minWidth: 120, height: 32, fontSize: 12 },
  dateInput: { width: 130, height: 32, fontSize: 12 },
  searchInput: { minWidth: 180, maxWidth: 340, height: 32, fontSize: 12 },
  pagRow: { display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', padding: '5px 14px 7px', background: '#f8fafc', borderTop: '1px solid var(--qf-border)' },
  pageInfo: { fontSize: 11, color: 'var(--qf-text-light)', fontWeight: 600 },
  loadMini: { fontSize: 11, color: '#185FA5', fontWeight: 700 },
  th0: { position: 'sticky', top: 0, zIndex: 10, whiteSpace: 'nowrap', fontSize: 9, padding: '5px 4px' },
  ths: { position: 'sticky', top: 0, zIndex: 10, whiteSpace: 'nowrap', fontSize: 9, padding: '5px 4px', cursor: 'pointer', userSelect: 'none' },
  si: { fontSize: 7, opacity: 0.45, marginLeft: 1 },
  filterTh: { position: 'sticky', top: 24, zIndex: 9, background: '#fff', borderBottom: '1px solid var(--qf-border)', padding: '4px', whiteSpace: 'nowrap' },
  colFilterWrap: { display: 'flex', alignItems: 'center', gap: 4, position: 'relative' },
  colInput: { width: '100%', minWidth: 62, height: 24, fontSize: 10, padding: '2px 4px' },
  colSelect: { width: '100%', minWidth: 82, height: 24, fontSize: 10, padding: '2px 4px' },
  filterIconBtn: { border: '0', background: 'transparent', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '2px 3px', transform: 'rotate(90deg)' },
  filterMenu: { position: 'absolute', top: 26, right: 0, zIndex: 30, background: '#fff', border: '1px solid var(--qf-border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(15,23,42,0.16)', minWidth: 150, padding: 5 },
  filterOption: { display: 'block', width: '100%', border: 0, background: '#fff', textAlign: 'left', padding: '6px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: 'var(--qf-navy)' },
  filterOptionActive: { background: '#e8f2ff', fontWeight: 800 },
  filterClear: { display: 'block', width: '100%', border: 0, background: '#f8fafc', textAlign: 'left', padding: '6px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', color: '#c62828', marginTop: 4, fontWeight: 700 },
  blankFilterLabel: { height: 24, minWidth: 62, display: 'inline-flex', alignItems: 'center', padding: '0 6px', border: '1px solid var(--qf-border)', borderRadius: 6, fontSize: 10, color: 'var(--qf-text-light)', background: '#f8fafc' },
  td: { padding: '3px 4px', verticalAlign: 'middle', lineHeight: 1.15 },
  opCode: { background: '#e8eef5', padding: '1px 4px', borderRadius: 3, fontSize: 9.5, fontWeight: 800, color: 'var(--qf-navy)' },
  typePill: { background: '#e8eef5', color: 'var(--qf-navy)', borderRadius: 3, padding: '1px 4px', fontSize: 9.5, fontWeight: 700, whiteSpace: 'nowrap' },
  timeMini: { fontSize: 9, color: 'var(--qf-text-light)', marginTop: 2, fontWeight: 700 },
  aBtn: { fontSize: 9, padding: '1px 4px' },
  footerCount: { padding: '6px 14px', borderTop: '1px solid var(--qf-border)', fontSize: 10.5, color: 'var(--qf-text-light)', background: '#fff' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 },
  detailBox: { background: '#f8fafc', border: '1px solid var(--qf-border)', borderRadius: 8, padding: 8 },
  detailLabel: { fontSize: 9, fontWeight: 700, color: 'var(--qf-text-light)', textTransform: 'uppercase' },
  detailValue: { fontSize: 12, fontWeight: 600, color: 'var(--qf-navy)', wordBreak: 'break-word' },
  g3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' },
  g4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' },
  errorBox: { background: '#fce4e4', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginTop: 8 },
}

export default TareasPage