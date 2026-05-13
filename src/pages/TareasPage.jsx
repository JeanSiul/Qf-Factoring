import React, { useEffect, useMemo, useRef, useState } from 'react'
import { apiCall, toArray } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'
import { useAuth } from '../context/AuthContext'
import { AgGridReact } from 'ag-grid-react'

const CLAIM = 'TAREAS'
const DEBOUNCE_MS = 450
const STORAGE_KEY = 'qf_tareas_grid_view_v6'
const SAVED_VIEWS_KEY = 'qf_tareas_saved_views_v6'

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

const toDateFilterValue = value => {
  const iso = toDateInput(value)
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

const dateComparator = (filterDate, cellValue) => {
  const cellDate = cellValue instanceof Date ? cellValue : toDateFilterValue(cellValue)
  if (!cellDate) return -1
  const f = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate())
  const c = new Date(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate())
  if (c < f) return -1
  if (c > f) return 1
  return 0
}

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

const safeJsonParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

const downloadTextFile = (filename, content, mime = 'text/csv;charset=utf-8;') => {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const csvEscape = value => {
  const s = String(value ?? '')
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
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
  const [gridApi, setGridApi] = useState(null)
  const gridColumnApiRef = useRef(null)
  const [quickText, setQuickText] = useState('')
  const [quickPreset, setQuickPreset] = useState('all')
  const [viewName, setViewName] = useState('')
  const [savedViews, setSavedViews] = useState(() => safeJsonParse(localStorage.getItem(SAVED_VIEWS_KEY), []))
  const [showColumnPanel, setShowColumnPanel] = useState(false)
  const [visibleCols, setVisibleCols] = useState({})
  const [filteredStats, setFilteredStats] = useState({ rows: 0, minutos: 0, pendientes: 0, completadas: 0, soporte: 0, programacion: 0 })

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
      qs.set('pageSize', String(5000))
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
    setPage(1)
    cargar({ page: 1, campo: 'all', busqueda: '', tipo: 'all', estado: 'all', desde: '', hasta: '' })
  }

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

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : 1
  const to = Math.min(data.length, total)

  const metrics = useMemo(() => {
    const mins = data.reduce((s, r) => s + calcMinutes(r), 0)
    return {
      horas: minToTime(mins),
      soporte: data.filter(r => r.tipo_tarea === 'Soporte').length,
      programacion: data.filter(r => r.tipo_tarea === 'Programación').length,
      completadas: data.filter(r => r.estado === 'Completado').length,
      pendientes: data.filter(r => ['Pendiente', 'En proceso'].includes(r.estado)).length,
    }
  }, [data])

  const quickFilteredData = useMemo(() => {
    const now = new Date()
    const todayIso = today()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - 6)
    const weekIso = weekStart.toISOString().slice(0, 10)
    const monthIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)

    return data.filter(r => {
      const fecha = toDateInput(r.fecha_inicio)
      const estadoNorm = norm(r.estado)
      const tipoNorm = norm(r.tipo_tarea)

      if (quickPreset === 'today') return fecha === todayIso
      if (quickPreset === 'week') return fecha >= weekIso && fecha <= todayIso
      if (quickPreset === 'month') return fecha >= monthIso && fecha <= todayIso
      if (quickPreset === 'pending') return estadoNorm.includes('pend') || estadoNorm.includes('proceso')
      if (quickPreset === 'done') return estadoNorm.includes('complet')
      if (quickPreset === 'support') return tipoNorm.includes('soporte')
      if (quickPreset === 'programming') return tipoNorm.includes('program')
      if (quickPreset === 'high') return norm(r.prioridad).includes('alta') || norm(r.prioridad).includes('crítica') || norm(r.prioridad).includes('critica')
      return true
    })
  }, [data, quickPreset])

  const agRows = useMemo(() => quickFilteredData.map(r => ({
    ...r,
    _inicio_sort: toDateFilterValue(r.fecha_inicio),
    _fin_sort: toDateFilterValue(r.fecha_fin),
    _inicio_text: `${formatDate(r.fecha_inicio)} ${toTimeInput(r.hora_inicio)}`,
    _fin_text: `${formatDate(r.fecha_fin)} ${toTimeInput(r.hora_fin)}`,
    _duracion: calcMinutes(r),
  })), [quickFilteredData])

  const agDefaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    floatingFilter: true,
    resizable: true,
    minWidth: 90,
    cellStyle: {
      fontSize: compactMode ? '10.5px' : '12px',
      color: 'var(--qf-navy)',
      lineHeight: compactMode ? '7px' : '9px',
    },
    headerClass: 'qf-tareas-ag-header',
    floatingFilterComponentParams: { suppressFilterButton: false },
  }), [compactMode])

  const agLocaleText = useMemo(() => ({
    contains: 'Contiene',
    notContains: 'No contiene',
    equals: 'Igual',
    notEqual: 'Distinto',
    startsWith: 'Empieza con',
    endsWith: 'Termina con',
    blank: 'Vacío',
    notBlank: 'No vacío',
    before: 'Antes de',
    after: 'Después de',
    inRange: 'Entre',
    inRangeStart: 'Desde',
    inRangeEnd: 'Hasta',
    lessThan: 'Menor que',
    greaterThan: 'Mayor que',
    filterOoo: 'Filtrar...',
    applyFilter: 'Aplicar',
    resetFilter: 'Restablecer',
    clearFilter: 'Limpiar',
    cancelFilter: 'Cancelar',
    noRowsToShow: 'No se encontraron tareas',
    loadingOoo: 'Cargando...',
    selectAll: 'Seleccionar todo',
    searchOoo: 'Buscar...',
    blanks: 'Vacíos',
    page: 'Página',
    more: 'Más',
    to: 'a',
    of: 'de',
    next: 'Siguiente',
    last: 'Última',
    first: 'Primera',
    previous: 'Anterior',
    pageSizeSelectorLabel: 'Filas',
    ariaFilterInput: 'Entrada de filtro',
  }), [])

  const limpiarFiltrosTabla = () => {
    if (!gridApi) return
    setQuickText('')
    gridApi.setFilterModel(null)
    gridApi.setGridOption?.('quickFilterText', '')
    gridApi.applyColumnState({
      defaultState: { sort: null },
      state: [{ colId: '_inicio_sort', sort: 'desc' }],
    })
    setTimeout(() => refreshFilteredStats(gridApi), 60)
  }

  const getDisplayedRows = () => {
    if (!gridApi) return agRows
    const rows = []
    gridApi.forEachNodeAfterFilterAndSort(node => {
      if (node?.data) rows.push(node.data)
    })
    return rows
  }

  const refreshFilteredStats = api => {
    if (!api) return
    const rows = []
    api.forEachNodeAfterFilterAndSort(node => {
      if (node?.data) rows.push(node.data)
    })

    setFilteredStats({
      rows: rows.length,
      minutos: rows.reduce((s, r) => s + calcMinutes(r), 0),
      pendientes: rows.filter(r => ['Pendiente', 'En proceso'].includes(r.estado)).length,
      completadas: rows.filter(r => r.estado === 'Completado').length,
      soporte: rows.filter(r => r.tipo_tarea === 'Soporte').length,
      programacion: rows.filter(r => r.tipo_tarea === 'Programación').length,
    })
  }

  const saveCurrentView = name => {
    if (!gridApi || !name.trim()) return
    const view = {
      id: Date.now(),
      name: name.trim(),
      quickText,
      quickPreset,
      pageSize,
      filterModel: gridApi.getFilterModel(),
      columnState: gridApi.getColumnState(),
      createdAt: new Date().toISOString(),
    }
    const next = [view, ...savedViews.filter(v => v.name !== view.name)].slice(0, 10)
    setSavedViews(next)
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next))
    localStorage.setItem(STORAGE_KEY, JSON.stringify(view))
    setViewName('')
    show('Vista guardada')
  }

  const applyView = view => {
    if (!gridApi || !view) return
    setQuickText(view.quickText || '')
    setQuickPreset(view.quickPreset || 'all')
    setPageSize(Number(view.pageSize || 50))
    setTimeout(() => {
      gridApi.setFilterModel(view.filterModel || null)
      if (view.columnState?.length) gridApi.applyColumnState({ state: view.columnState, applyOrder: true })
      gridApi.setGridOption?.('quickFilterText', view.quickText || '')
      refreshFilteredStats(gridApi)
    }, 60)
  }

  const deleteView = id => {
    const next = savedViews.filter(v => v.id !== id)
    setSavedViews(next)
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next))
  }

  const resetGridView = () => {
    if (!gridApi) return
    setQuickText('')
    setQuickPreset('all')
    setPageSize(50)
    gridApi.setFilterModel(null)
    gridApi.resetColumnState()
    gridApi.setGridOption?.('quickFilterText', '')
    localStorage.removeItem(STORAGE_KEY)
    setTimeout(() => refreshFilteredStats(gridApi), 60)
  }

  const exportCsv = () => {
    const rows = getDisplayedRows()
    const headers = ['Inicio', 'Hora inicio', 'Fin', 'Hora fin', 'Tipo', 'Tarea', 'Usuario', 'Duración minutos', 'Duración', 'Estado', 'Prioridad', 'Descripción', 'Observaciones']
    const body = rows.map(r => [
      toDateInput(r.fecha_inicio),
      toTimeInput(r.hora_inicio),
      toDateInput(r.fecha_fin),
      toTimeInput(r.hora_fin),
      r.tipo_tarea,
      r.titulo,
      r.usuario_nombre || r.usuario_email || r.usuario_id,
      calcMinutes(r),
      minToTime(calcMinutes(r)),
      r.estado,
      r.prioridad,
      r.descripcion,
      r.observaciones,
    ].map(csvEscape).join(';'))

    downloadTextFile(`tareas_${today()}.csv`, [headers.join(';'), ...body].join('\n'))
  }

  const toggleColumn = field => {
    if (!gridApi) return
    const current = visibleCols[field] !== false
    gridApi.setColumnsVisible([field], !current)
    setVisibleCols(prev => ({ ...prev, [field]: !current }))
  }

  const agColumnDefs = useMemo(() => [
    {
      headerName: 'Inicio',
      field: '_inicio_sort',
      width: 150,
      minWidth: 150,
      sort: 'desc',
      comparator: (a, b) => (a?.getTime?.() || 0) - (b?.getTime?.() || 0),
      filterParams: {
        comparator: dateComparator,
        browserDatePicker: true,
        inRangeInclusive: true,
      },
      cellRenderer: p => (
        <div>
          <span style={S.dateTimeInline}><code style={S.opCode}>{formatDate(p.data?.fecha_inicio)}</code><span style={S.timeMiniInline}>{toTimeInput(p.data?.hora_inicio)}</span></span>
        </div>
      ),
      filter: 'agDateColumnFilter',
    },
    {
      headerName: 'Fin',
      field: '_fin_sort',
      width: 150,
      minWidth: 150,
      comparator: (a, b) => (a?.getTime?.() || 0) - (b?.getTime?.() || 0),
      filterParams: {
        comparator: dateComparator,
        browserDatePicker: true,
        inRangeInclusive: true,
      },
      cellRenderer: p => (
        <div>
          <span style={S.dateTimeInline}><code style={S.opCode}>{formatDate(p.data?.fecha_fin)}</code><span style={S.timeMiniInline}>{toTimeInput(p.data?.hora_fin)}</span></span>
        </div>
      ),
      filter: 'agDateColumnFilter',
    },
    {
      headerName: 'Tipo',
      field: 'tipo_tarea',
      width: 130,
      cellRenderer: p => <span style={S.typePill}>{p.value || '-'}</span>,
      filter: 'agTextColumnFilter',
    },
    {
      headerName: 'Tarea',
      field: 'titulo',
      flex: 1,
      minWidth: 240,
      cellStyle: {
        fontSize: compactMode ? '10.5px' : '12px',
        color: 'var(--qf-navy)',
        fontWeight: 700,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      filter: 'agTextColumnFilter',
    },
    {
      headerName: 'Usuario',
      field: 'usuario_nombre',
      width: 145,
      valueGetter: p => p.data?.usuario_nombre || p.data?.usuario_email || p.data?.usuario_id || '-',
      filter: 'agTextColumnFilter',
    },
    {
      headerName: 'Duración',
      field: '_duracion',
      width: 78,
      cellRenderer: p => <span style={{ fontWeight: 800, color: '#2e7d32' }}>{minToTime(p.value)}</span>,
      filter: 'agNumberColumnFilter',
    },
    {
      headerName: 'Estado',
      field: 'estado',
      width: 130,
      cellRenderer: p => <span className={`badge ${badgeClass(p.value)}`} style={{ fontSize: 6, padding: '1px 5px', lineHeight: 1.1 }}>{String(p.value || '-').toUpperCase()}</span>,
      filter: 'agTextColumnFilter',
    },
    {
      headerName: 'Prioridad',
      field: 'prioridad',
      width: 125,
      cellRenderer: p => <span className={`badge ${prioridadStyle(p.value)}`} style={{ fontSize: 6, padding: '1px 5px', lineHeight: 1.1 }}>{String(p.value || '-').toUpperCase()}</span>,
      filter: 'agTextColumnFilter',
    },
    {
      headerName: 'Acc.',
      field: 'acciones',
      width: 115,
      pinned: 'right',
      sortable: false,
      filter: false,
      cellRenderer: p => (
        <div style={{ display: 'flex', gap: 1, justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          {canView && <button className="btn btn-secondary btn-sm" onClick={() => setModal({ type: 'detalle', data: p.data })} style={{ ...S.aBtn, padding:'0 4px', minHeight:16, fontSize:9 }}>Ver</button>}
          {canEdit && <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'editar', data: p.data })} style={{ ...S.aBtn, padding:'0 4px', minHeight:16, fontSize:9 }}>Edit</button>}
          {canDelete && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.data)} style={{ ...S.aBtn, padding:'0 4px', minHeight:16, fontSize:9 }}>Del</button>}
        </div>
      ),
    },
  ], [compactMode, canView, canEdit, canDelete])

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

      <style>{`
        .qf-tareas-grid .ag-root-wrapper {
          border: 0;
          border-top: 1px solid var(--qf-border);
          font-family: Montserrat, Arial, sans-serif;
        }
        .qf-tareas-grid .ag-header {
          background: var(--qf-navy);
          color: #fff;
          border-bottom: 0;
        }
        .qf-tareas-grid .ag-header-cell,
        .qf-tareas-grid .ag-header-group-cell {
          background: var(--qf-navy);
          color: #fff;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: .2px;
          border-right: 0;
        }
        .qf-tareas-grid .ag-header-cell-text {
          color: #fff;
          font-size: 8.5px;
        }
        .qf-tareas-grid .ag-header-cell {
          padding-left: 2px;
          padding-right: 2px;
          line-height: 1;
        }
        .qf-tareas-grid .ag-floating-filter .ag-cell-label-container,
        .qf-tareas-grid .ag-floating-filter-body {
          min-height: 11px;
          line-height: 11px;
        }
        .qf-tareas-grid .ag-icon,
        .qf-tareas-grid .ag-header-icon {
          color: #fff;
        }
        .qf-tareas-grid .ag-floating-filter {
          background: #f8fafc;
          border-bottom: 1px solid var(--qf-border);
          min-height: 12px;
        }
        .qf-tareas-grid .ag-floating-filter-body {
          min-height: 11px;
          line-height: 11px;
        }
        .qf-tareas-grid .ag-floating-filter-input,
        .qf-tareas-grid .ag-input-field-input {
          min-height: 11px;
          height: 11px;
          font-size: 8px;
          border-radius: 7px;
          border: 1px solid #9fb2c8 !important;
          background: #ffffff !important;
          color: var(--qf-navy);
          box-shadow: inset 0 0 0 1px rgba(24,95,165,.08);
        }
        .qf-tareas-grid .ag-floating-filter-input:focus,
        .qf-tareas-grid .ag-input-field-input:focus {
          border-color: #185FA5 !important;
          box-shadow: 0 0 0 2px rgba(24,95,165,.14);
        }
        .qf-tareas-grid .ag-floating-filter-button {
          margin-left: 3px;
        }
        .qf-tareas-grid .ag-floating-filter-button-button {
          min-width: 15px;
          height: 11px;
          border-radius: 6px;
          border: 1px solid #9fb2c8;
          background: #e8eef5;
        }
        .qf-tareas-grid .ag-row {
          border-bottom: 1px solid var(--qf-border);
        }
        .qf-tareas-grid .ag-row-hover {
          background: #f8fafc;
        }
        .qf-tareas-grid .ag-paging-panel {
          min-height: 24px;
          font-size: 8px;
          color: var(--qf-text-light);
          border-top: 1px solid var(--qf-border);
        }
        .qf-tareas-grid .ag-cell {
          display: flex;
          align-items: center;
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          line-height: 1 !important;
        }
        .qf-tareas-grid .ag-cell[col-id="_inicio_sort"],
        .qf-tareas-grid .ag-cell[col-id="_fin_sort"] {
          white-space: nowrap;
          overflow: visible;
        }
      `}</style>

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
          { l: 'Mostradas', v: data.length, c: '#185FA5', b: '#03a9f4' },
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
          <div style={S.pagRow}>
            <span style={S.pill}>{from}-{to} de {total}</span>
            <span style={S.pageInfo}>Filtra, ordena y pagina desde la tabla</span>
            <button className="btn btn-secondary btn-sm" onClick={limpiarFiltrosTabla}>Limpiar filtros tabla</button>
            <select className="filter-input" value={pageSize} onChange={e => setPageSize(Number(e.target.value))} style={{ width: 'auto', minWidth: 70, height: 28, fontSize: 11, padding: '0 4px' }}>
              <option value={25}>25 filas</option>
              <option value={50}>50 filas</option>
              <option value={100}>100 filas</option>
              <option value={200}>200 filas</option>
            </select>
            {loading && <span style={S.loadMini}>...</span>}
          </div>

          <div style={S.erpTools}>
            <div style={S.erpGroup}>
              <div style={S.erpSearchWrap}>
                <span style={S.erpSearchIcon}>🔍</span>
                <input
                  className="filter-input"
                  value={quickText}
                  onChange={e => setQuickText(e.target.value)}
                  placeholder="Búsqueda global..."
                  style={S.erpSearch}
                />
              </div>
              <select className="filter-input" value={quickPreset} onChange={e => setQuickPreset(e.target.value)} style={S.erpSelect}>
                <option value="all">Vista: Todos</option>
                <option value="today">Hoy</option>
                <option value="week">Últimos 7 días</option>
                <option value="month">Este mes</option>
                <option value="pending">Pendientes / En proceso</option>
                <option value="done">Completadas</option>
                <option value="support">Soporte</option>
                <option value="programming">Programación</option>
                <option value="high">Alta prioridad</option>
              </select>
              <button className="btn btn-secondary btn-sm" onClick={exportCsv}>Exportar CSV</button>
            </div>

            <div style={S.erpGroup}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowColumnPanel(v => !v)}>Columnas</button>
              <input
                className="filter-input"
                value={viewName}
                onChange={e => setViewName(e.target.value)}
                placeholder="Nombre de vista"
                style={S.viewInput}
              />
              <button className="btn btn-primary btn-sm" onClick={() => saveCurrentView(viewName)}>Guardar vista</button>
              <button className="btn btn-secondary btn-sm" onClick={resetGridView}>Reset</button>
            </div>
          </div>

          {showColumnPanel && (
            <div style={S.columnPanel}>
              {[
                ['_inicio_sort', 'Inicio'],
                ['_fin_sort', 'Fin'],
                ['tipo_tarea', 'Tipo'],
                ['titulo', 'Tarea'],
                ['usuario_nombre', 'Usuario'],
                ['_duracion', 'Duración'],
                ['estado', 'Estado'],
                ['prioridad', 'Prioridad'],
                ['acciones', 'Acciones'],
              ].map(([field, label]) => (
                <label key={field} style={S.columnCheck}>
                  <input type="checkbox" checked={visibleCols[field] !== false} onChange={() => toggleColumn(field)} />
                  {label}
                </label>
              ))}
            </div>
          )}

          {savedViews.length > 0 && (
            <div style={S.savedViews}>
              <span style={S.savedTitle}>Vistas guardadas:</span>
              {savedViews.map(v => (
                <span key={v.id} style={S.savedChip}>
                  <button type="button" onClick={() => applyView(v)} style={S.savedBtn}>{v.name}</button>
                  <button type="button" onClick={() => deleteView(v.id)} style={S.savedDel}>×</button>
                </span>
              ))}
            </div>
          )}

          <div style={S.smartTotals}>
            <span><b>{filteredStats.rows || agRows.length}</b> filtradas</span>
            <span><b>{minToTime(filteredStats.minutos || agRows.reduce((s, r) => s + calcMinutes(r), 0))}</b> horas</span>
            <span><b>{filteredStats.pendientes}</b> pendientes</span>
            <span><b>{filteredStats.completadas}</b> completadas</span>
            <span><b>{filteredStats.soporte}</b> soporte</span>
            <span><b>{filteredStats.programacion}</b> programación</span>
          </div>
        </div>

        <div
          className="ag-theme-quartz qf-tareas-grid"
          style={{
            width: '100%',
            height: compactMode ? 'calc(100vh - 330px)' : 'calc(100vh - 390px)',
            minHeight: 310,
            '--ag-font-size': compactMode ? '10.5px' : '12px',
            '--ag-header-height': compactMode ? '9px' : '16px',
            '--ag-row-height': compactMode ? '2px' : '24px',
            '--ag-list-item-height': '1px',
            '--ag-header-column-resize-handle-height': '60%',
            '--ag-wrapper-border-radius': '0px',
            '--ag-grid-size': '4px',
            '--ag-cell-horizontal-padding': '4px',
            '--ag-header-column-separator-display': 'block',
            '--ag-row-border-color': '#e5e7eb'
          }}
        >
          {loading && data.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner dark" /></div>
          ) : (
            <AgGridReact
              rowData={agRows}
              columnDefs={agColumnDefs}
              defaultColDef={agDefaultColDef}
              pagination
              paginationPageSize={pageSize}
              paginationPageSizeSelector={[25, 50, 100, 200]}
              localeText={agLocaleText}
              onGridReady={params => {
                setGridApi(params.api)
                gridColumnApiRef.current = params.columnApi
                setVisibleCols(Object.fromEntries(params.api.getColumns().map(c => [c.getColId(), c.isVisible()])))
                const lastView = safeJsonParse(localStorage.getItem(STORAGE_KEY), null)
                setTimeout(() => {
                  if (lastView) {
                    setQuickText(lastView.quickText || '')
                    setQuickPreset(lastView.quickPreset || 'all')
                    setPageSize(Number(lastView.pageSize || 50))
                    params.api.setFilterModel(lastView.filterModel || null)
                    if (lastView.columnState?.length) params.api.applyColumnState({ state: lastView.columnState, applyOrder: true })
                    params.api.setGridOption?.('quickFilterText', lastView.quickText || '')
                  }
                  refreshFilteredStats(params.api)
                }, 80)
              }}
              quickFilterText={quickText}
              animateRows
              suppressCellFocus
              onFilterChanged={params => refreshFilteredStats(params.api)}
              onSortChanged={params => refreshFilteredStats(params.api)}
              onColumnVisible={params => setVisibleCols(Object.fromEntries(params.api.getColumns().map(c => [c.getColId(), c.isVisible()])))}
              overlayNoRowsTemplate="<span style='padding:10px;color:#64748b;font-size:12px;'>No se encontraron tareas con los filtros aplicados</span>"
            />
          )}
        </div>

        {!loading && <div style={S.footerCount}>{data.length} de {total} tareas cargadas</div>}
      </div>

      {modal?.type === 'detalle' && <ModalDetalle item={modal.data} onClose={() => setModal(null)} />}
      {modal?.type === 'nuevo' && <ModalTarea user={user} onClose={() => setModal(null)} onSave={handleSave} />}
      {modal?.type === 'editar' && <ModalTarea item={modal.data} user={user} onClose={() => setModal(null)} onSave={handleSave} />}
    </div>
  )
}

const S = {
  erpTools: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap', padding: '3px 10px', background: '#fff', borderTop: '1px solid var(--qf-border)' },
  erpGroup: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  erpSearchWrap: { position: 'relative', width: 210 },
  erpSearchIcon: { position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#8a9bb5', pointerEvents: 'none', zIndex: 1 },
  erpSearch: { width: '100%', height: 24, fontSize: 10, paddingLeft: 30 },
  erpSelect: { minWidth: 150, height: 24, fontSize: 9.5, padding: '0 22px 0 8px' },
  viewInput: { width: 140, height: 24, fontSize: 10 },
  columnPanel: { display: 'flex', gap: 8, flexWrap: 'wrap', padding: '6px 14px', background: '#f8fafc', borderTop: '1px solid var(--qf-border)' },
  columnCheck: { fontSize: 10.5, color: 'var(--qf-navy)', display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff', border: '1px solid var(--qf-border)', borderRadius: 999, padding: '3px 8px' },
  savedViews: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '5px 14px', background: '#fff', borderTop: '1px solid var(--qf-border)' },
  savedTitle: { fontSize: 10, color: 'var(--qf-text-light)', fontWeight: 700 },
  savedChip: { display: 'inline-flex', alignItems: 'center', border: '1px solid #9fb2c8', borderRadius: 999, overflow: 'hidden', background: '#e8eef5' },
  savedBtn: { border: 0, background: 'transparent', padding: '3px 7px', cursor: 'pointer', fontSize: 10.5, color: 'var(--qf-navy)', fontWeight: 700 },
  savedDel: { border: 0, background: '#dbe7f3', padding: '3px 6px', cursor: 'pointer', fontSize: 11, color: '#c62828', fontWeight: 900 },
  smartTotals: { display: 'flex', gap: 8, flexWrap: 'wrap', padding: '3px 10px', background: '#f8fafc', borderTop: '1px solid var(--qf-border)', color: 'var(--qf-text-light)', fontSize: 10.5 },
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
  pagRow: { display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', padding: '3px 10px', background: '#f8fafc', borderTop: '1px solid var(--qf-border)' },
  pageInfo: { fontSize: 11, color: 'var(--qf-text-light)', fontWeight: 600 },
  loadMini: { fontSize: 11, color: '#185FA5', fontWeight: 700 },
  th0: { position: 'sticky', top: 0, zIndex: 10, whiteSpace: 'nowrap', fontSize: 6.5, padding: '5px 4px' },
  ths: { position: 'sticky', top: 0, zIndex: 10, whiteSpace: 'nowrap', fontSize: 6.5, padding: '5px 4px', cursor: 'pointer', userSelect: 'none' },
  si: { fontSize: 7, opacity: 0.45, marginLeft: 1 },
  td: { padding: '3px 4px', verticalAlign: 'middle', lineHeight: 1.15 },
  opCode: { background: '#e8eef5', padding: '1px 4px', borderRadius: 3, fontSize: 9.5, fontWeight: 800, color: 'var(--qf-navy)' },
  typePill: { background: '#e8eef5', color: 'var(--qf-navy)', borderRadius: 3, padding: '1px 4px', fontSize: 9.5, fontWeight: 700, whiteSpace: 'nowrap' },
  timeMini: { fontSize: 8, color: 'var(--qf-text-light)', marginTop: 2, fontWeight: 700 },
  dateTimeInline: { display: 'inline-flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' },
  timeMiniInline: { fontSize: 8, color: 'var(--qf-text-light)', fontWeight: 700, whiteSpace: 'nowrap' },
  aBtn: { fontSize: 8, padding: '1px 4px' },
  footerCount: { padding: '6px 14px', borderTop: '1px solid var(--qf-border)', fontSize: 10.5, color: 'var(--qf-text-light)', background: '#fff' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 },
  detailBox: { background: '#f8fafc', border: '1px solid var(--qf-border)', borderRadius: 8, padding: 8 },
  detailLabel: { fontSize: 8, fontWeight: 700, color: 'var(--qf-text-light)', textTransform: 'uppercase' },
  detailValue: { fontSize: 12, fontWeight: 600, color: 'var(--qf-navy)', wordBreak: 'break-word' },
  g3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' },
  g4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' },
  errorBox: { background: '#fce4e4', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginTop: 8 },
}

export default TareasPage
