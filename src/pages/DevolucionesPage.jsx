import React, { useEffect, useMemo, useRef, useState } from 'react'
import { apiCall, toArray } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'
import { useAuth } from '../context/AuthContext'
import { AgGridReact } from 'ag-grid-react'

const CLAIM = 'OPEDEV'
const DEBOUNCE_MS = 450
const GRID_VIEW_KEY = 'qf_devoluciones_grid_view_v1'
const SAVED_VIEWS_KEY = 'qf_devoluciones_saved_views_v1'

const safeJsonParse = (v, f) => {
  try { return v ? JSON.parse(v) : f } catch (_) { return f }
}

const csvEscape = value => {
  const s = String(value ?? '')
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
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



const exportExcel = rows => {
  const headers = ['Nro Operación','Fecha','Banco','Cuenta Cargo','Cuenta Abono','Importe Cargado','Importe Abonado','Comisión','Estado']
  const body = rows.map(r => `<tr><td>${r.numero_operacion || ''}</td><td>${formatDate(r.fecha_operacion)}</td><td>${r.banco_nombre || ''}</td><td>${r.cuenta_cargo || ''}</td><td>${r.cuenta_abono || ''}</td><td>${r.importe_cargado || 0}</td><td>${r.importe_abonado || 0}</td><td>${r.comision || 0}</td><td>${r.estado || ''}</td></tr>`).join('')
  const html = `<html><body><table border="1"><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>${body}</table></body></html>`
  downloadTextFile(`devoluciones_${new Date().toISOString().slice(0,10)}.xls`, html, 'application/vnd.ms-excel')
}

const exportPdf = rows => {
  const html = `<html><head><style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #ccc;padding:4px}th{background:#0f2742;color:#fff}</style></head><body><h2>Reporte Devoluciones</h2><table><tr><th>Nro Op</th><th>Banco</th><th>Cargado</th><th>Abonado</th><th>Estado</th></tr>${rows.map(r=>`<tr><td>${r.numero_operacion||''}</td><td>${r.banco_nombre||''}</td><td>${money(r.importe_cargado)}</td><td>${money(r.importe_abonado)}</td><td>${r.estado||''}</td></tr>`).join('')}</table><script>window.onload=()=>window.print()</script></body></html>`
  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close() }
}

const buildGroupSummary = (rows, field) => {
  const map = new Map()
  rows.forEach(r => {
    const key = r[field] || 'Sin dato'
    const curr = map.get(key) || { name: key, count: 0, cargado: 0, abonado: 0 }
    curr.count += 1
    curr.cargado += Number(r.importe_cargado || 0)
    curr.abonado += Number(r.importe_abonado || 0)
    map.set(key, curr)
  })
  return [...map.values()].sort((a,b)=>b.count-a.count)
}


const camposBusqueda = [
  { value: 'all', label: 'Todos' },
  { value: 'numero_operacion', label: 'Nro. Operación' },
  { value: 'archivo', label: 'Archivo' },
  { value: 'cuenta_cargo', label: 'Cuenta cargo' },
  { value: 'moneda_cargo', label: 'Mon. cargo' },
  { value: 'cuenta_abono', label: 'Cuenta abono' },
  { value: 'moneda_abono', label: 'Mon. abono' },
  { value: 'referencia', label: 'Referencia' },
  { value: 'estado', label: 'Estado' },
  { value: 'banco', label: 'Banco' },
]

const money = (value, currency = 'PEN') => {
  const cur = String(currency || '').toUpperCase() === 'USD' || String(currency || '').toLowerCase().includes('dol') ? 'USD' : 'PEN'
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(Number(value || 0))
}
const formatDate = value => { if (!value) return '-'; const d = new Date(value); if (Number.isNaN(d.getTime())) return String(value).slice(0, 10); return d.toLocaleDateString('es-PE') }
const toDateInput = value => { if (!value) return ''; const d = new Date(value); if (Number.isNaN(d.getTime())) return String(value).slice(0, 10); return d.toISOString().slice(0, 10) }
const badgeClass = status => { const s = String(status || '').toLowerCase(); if (s.includes('pendiente') || s.includes('proceso')) return 'warning'; if (s.includes('completado') || s.includes('exitoso') || s.includes('procesado')) return 'active'; if (s.includes('error') || s.includes('rechazado') || s.includes('fallido')) return 'inactive'; return 'warning' }

const getField = (obj, ...names) => { for (const n of names) { if (obj[n] !== undefined) return obj[n]; if (obj[n.toLowerCase()] !== undefined) return obj[n.toLowerCase()]; if (obj[n.toUpperCase()] !== undefined) return obj[n.toUpperCase()] } return undefined }
const getBancoNombre = (id, bancos) => { if (!id) return '-'; const b = bancos.find(x => String(getField(x, 'id', 'ID')) === String(id)); return b ? (getField(b, 'name', 'Name', 'NAME') || id) : id }
const getMonedaNombre = (id, monedas) => { if (!id) return '-'; const m = monedas.find(x => String(getField(x, 'ID', 'id')) === String(id)); if (!m) return id; return getField(m, 'VALORTEXTO1', 'valortexto1') || getField(m, 'VALORTEXTO', 'valortexto') || getField(m, 'CODIGO', 'codigo') || id }
const getMonedaCodigo = (id, monedas) => { if (!id) return 'PEN'; const m = monedas.find(x => String(getField(x, 'ID', 'id')) === String(id)); if (!m) return 'PEN'; return getField(m, 'VALORTEXTO', 'valortexto', 'ValorTexto') || 'PEN' }

const ModalDetalle = ({ item, bancos, monedas, onClose }) => (
  <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
    <div className="modal" style={{ maxWidth: 820 }}>
      <div className="modal-header"><h3>Detalle — {item.numero_operacion || item.id}</h3><button className="modal-close" onClick={onClose}>x</button></div>
      <div className="modal-body">
        <div style={S.detailGrid}>
          {[['Nro. Operación', item.numero_operacion || '-'],['Nro. Op. PDF', item.numero_operacion_pdf || '-'],['Archivo', item.archivo || '-'],['Fecha op.', formatDate(item.fecha_operacion)],['Banco', getBancoNombre(item.banco, bancos)],['Cuenta cargo', item.cuenta_cargo || '-'],['Cuenta abono', item.cuenta_abono || '-'],['Mon. cargo', getMonedaNombre(item.moneda_cargo, monedas)],['Mon. abono', getMonedaNombre(item.moneda_abono, monedas)],['Imp. cargado', money(item.importe_cargado, getMonedaCodigo(item.moneda_cargo, monedas))],['Imp. abonado', money(item.importe_abonado, getMonedaCodigo(item.moneda_abono, monedas))],['Comisión', money(item.comision, getMonedaCodigo(item.moneda_cargo, monedas))],['Referencia', item.referencia || '-'],['Estado', item.estado || '-'],['Mensaje', item.mensaje || '-'],['Fecha log', formatDate(item.fecha_log)],['Creado', formatDate(item.created_at)]].map(([k, v]) => (
            <div key={k} style={S.detailBox}><div style={S.detailLabel}>{k}</div><div style={S.detailValue}>{v}</div></div>
          ))}
        </div>
      </div>
      <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Cerrar</button></div>
    </div>
  </div>
)

const ModalDevolucion = ({ item, bancos, monedas, onClose, onSave }) => {
  const isEdit = !!item?.id
  const [form, setForm] = useState({ id: item?.id || '', archivo: item?.archivo || '', numero_operacion: item?.numero_operacion || '', numero_operacion_pdf: item?.numero_operacion_pdf || '', fecha_operacion: toDateInput(item?.fecha_operacion) || new Date().toISOString().slice(0, 10), importe_cargado: item?.importe_cargado || '', importe_abonado: item?.importe_abonado || '', comision: item?.comision || 0, cuenta_cargo: item?.cuenta_cargo || '', cuenta_abono: item?.cuenta_abono || '', banco: item?.banco || '', moneda_cargo: item?.moneda_cargo || '', moneda_abono: item?.moneda_abono || '', referencia: item?.referencia || '', estado: item?.estado || 'Pendiente', mensaje: item?.mensaje || '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const submit = async () => {
    if (!form.numero_operacion) return setError('Número de operación es requerido')
    if (!form.importe_cargado || Number(form.importe_cargado) <= 0) return setError('Importe cargado debe ser mayor a cero')
    if (!form.banco) return setError('Banco es requerido')
    setSaving(true); setError('')
    try { await onSave({ ...form, importe_cargado: Number(form.importe_cargado || 0), importe_abonado: Number(form.importe_abonado || 0), comision: Number(form.comision || 0) }); onClose() }
    catch (e) { setError(e.message || 'No se pudo guardar') } finally { setSaving(false) }
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 920, width: '94vw' }}>
        <div className="modal-header"><h3>{isEdit ? 'Editar Devolución' : 'Nueva Devolución'}</h3><button className="modal-close" onClick={onClose}>x</button></div>
        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          <div style={S.g3}><div className="form-group"><label className="form-label">Nro. Operación *</label><input className="form-control" value={form.numero_operacion} onChange={e => set('numero_operacion', e.target.value)} maxLength={10} /></div><div className="form-group"><label className="form-label">Nro. Op. PDF</label><input className="form-control" value={form.numero_operacion_pdf} onChange={e => set('numero_operacion_pdf', e.target.value)} maxLength={20} /></div><div className="form-group"><label className="form-label">Fecha operación</label><input className="form-control" type="date" value={form.fecha_operacion} onChange={e => set('fecha_operacion', e.target.value)} /></div></div>
          <div style={S.g3}><div className="form-group"><label className="form-label">Banco *</label><select className="form-control" value={form.banco} onChange={e => set('banco', e.target.value)}><option value="">-- Seleccionar --</option>{bancos.filter(b => b.status === 'Active').map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div><div className="form-group"><label className="form-label">Archivo</label><input className="form-control" value={form.archivo} onChange={e => set('archivo', e.target.value)} /></div><div className="form-group"><label className="form-label">Estado</label><select className="form-control" value={form.estado} onChange={e => set('estado', e.target.value)}><option value="Pendiente">Pendiente</option><option value="Procesado">Procesado</option><option value="En proceso">En proceso</option><option value="Completado">Completado</option><option value="Error">Error</option><option value="Rechazado">Rechazado</option></select></div></div>
          <div style={S.g4}><div className="form-group"><label className="form-label">Cuenta cargo</label><input className="form-control" value={form.cuenta_cargo} onChange={e => set('cuenta_cargo', e.target.value)} maxLength={30} /></div><div className="form-group"><label className="form-label">Moneda cargo</label><select className="form-control" value={form.moneda_cargo} onChange={e => set('moneda_cargo', e.target.value)}><option value="">-- Seleccionar --</option>{monedas.map(m => { const mId = getField(m, 'ID', 'id'); return <option key={mId} value={mId}>{getField(m, 'CODIGO', 'codigo', 'Codigo') || ''}</option> })}</select></div><div className="form-group"><label className="form-label">Cuenta abono</label><input className="form-control" value={form.cuenta_abono} onChange={e => set('cuenta_abono', e.target.value)} maxLength={30} /></div><div className="form-group"><label className="form-label">Moneda abono</label><select className="form-control" value={form.moneda_abono} onChange={e => set('moneda_abono', e.target.value)}><option value="">-- Seleccionar --</option>{monedas.map(m => { const mId = getField(m, 'ID', 'id'); return <option key={mId} value={mId}>{getField(m, 'CODIGO', 'codigo', 'Codigo') || ''}</option> })}</select></div></div>
          <div style={S.g3}><div className="form-group"><label className="form-label">Importe cargado *</label><input className="form-control" type="number" step="0.01" value={form.importe_cargado} onChange={e => set('importe_cargado', e.target.value)} /></div><div className="form-group"><label className="form-label">Importe abonado</label><input className="form-control" type="number" step="0.01" value={form.importe_abonado} onChange={e => set('importe_abonado', e.target.value)} /></div><div className="form-group"><label className="form-label">Comisión</label><input className="form-control" type="number" step="0.01" value={form.comision} onChange={e => set('comision', e.target.value)} /></div></div>
          <div className="form-group"><label className="form-label">Referencia</label><input className="form-control" value={form.referencia} onChange={e => set('referencia', e.target.value)} maxLength={100} /></div>
          <div className="form-group"><label className="form-label">Mensaje / Observaciones</label><textarea className="form-control" rows={2} value={form.mensaje} onChange={e => set('mensaje', e.target.value)} /></div>
          {error && <div style={S.errorBox}>⚠ {error}</div>}
        </div>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Guardando...' : isEdit ? 'Actualizar' : 'Registrar'}</button></div>
      </div>
    </div>
  )
}

const DevolucionesPage = () => {
  const { permisos } = useAuth()
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [campo, setCampo] = useState('all')
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [compactMode, setCompactMode] = useState(true)
  const [sortField, setSortField] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [gridApi, setGridApi] = useState(null)
  const gridColumnApiRef = useRef(null)
  const [quickText, setQuickText] = useState('')
  const [quickPreset, setQuickPreset] = useState('all')
  const [viewName, setViewName] = useState('')
  const [savedViews, setSavedViews] = useState(() => safeJsonParse(localStorage.getItem(SAVED_VIEWS_KEY), []))
  const [visibleCols, setVisibleCols] = useState({})
  const [displayedRows, setDisplayedRows] = useState([])
  const [showDashboard, setShowDashboard] = useState(true)
  const [showSidePanel, setShowSidePanel] = useState(false)
  const [groupBy, setGroupBy] = useState('estado')
  const { toasts, show } = useToast()
  const [bancos, setBancos] = useState([])
  const [monedas, setMonedas] = useState([])

  const cv = permisos?.[CLAIM] || '00000000000'
  const canList = cv[1] === '1', canView = cv[2] === '1', canEdit = cv[3] === '1', canCreate = cv[5] === '1', canDelete = cv[6] === '1'

  useEffect(() => { (async () => { try { const [bR, mR] = await Promise.all([apiCall('/qf/devoluciones/bancos'), apiCall('/qf/devoluciones/monedas')]); setBancos((Array.isArray(bR) ? bR : (bR?.data || [])).filter(x => x && (x.id || x.ID))); setMonedas((Array.isArray(mR) ? mR : (mR?.data || [])).filter(x => x && (x.ID || x.id))) } catch (e) { console.warn(e.message) } })() }, [])

  const cargar = async (opts = {}) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams(); qs.set('page', String(opts.page || page)); qs.set('pageSize', String(5000)); qs.set('field', opts.campo ?? campo); if ((opts.busqueda ?? busqueda).trim()) qs.set('q', (opts.busqueda ?? busqueda).trim())
      const res = await apiCall(`/qf/devoluciones/listar?${qs}`); const rows = Array.isArray(res) ? res : (res?.data || res?.items || []); setData(toArray(rows)); setTotal(Number(res?.total ?? rows.length))
    } catch (e) { show('Error: ' + e.message, 'error') } finally { setLoading(false) }
  }
  useEffect(() => { cargar() }, [page, pageSize])
  useEffect(() => { const t = setTimeout(() => { setPage(1); cargar({ page: 1 }) }, DEBOUNCE_MS); return () => clearTimeout(t) }, [busqueda, campo])
  const limpiar = () => { setCampo('all'); setBusqueda(''); setPage(1); cargar({ page: 1, campo: 'all', busqueda: '' }) }

  const handleSave = async p => { const res = await apiCall(p.id ? '/qf/devoluciones/actualizar' : '/qf/devoluciones/crear', { method: 'POST', body: JSON.stringify(p) }); if (!res?.success) throw new Error(res?.message || 'Error'); show(p.id ? 'Actualizada' : 'Registrada'); cargar() }
  const handleDelete = async item => { if (!confirm(`¿Eliminar ${item.numero_operacion || item.id}?`)) return; try { const res = await apiCall('/qf/devoluciones/eliminar', { method: 'POST', body: JSON.stringify({ id: item.id }) }); if (!res?.success) throw new Error(res?.message || 'Error'); show('Eliminada'); cargar() } catch (e) { show(e.message, 'error') } }

  const totalPages = Math.max(1, Math.ceil(total / pageSize)), from = total === 0 ? 0 : ((page - 1) * pageSize) + 1, to = Math.min(page * pageSize, total)
  const metrics = useMemo(() => ({ totalCargado: data.reduce((s, r) => s + Number(r.importe_cargado || 0), 0), totalAbonado: data.reduce((s, r) => s + Number(r.importe_abonado || 0), 0), totalComision: data.reduce((s, r) => s + Number(r.comision || 0), 0), pendientes: data.filter(r => String(r.estado || '').toLowerCase().includes('pendiente')).length }), [data])


  const agRows = useMemo(() => data.map(r => ({
    ...r,
    banco_nombre: getBancoNombre(r.banco, bancos),
    moneda_cargo_nombre: getMonedaNombre(r.moneda_cargo, monedas),
    moneda_abono_nombre: getMonedaNombre(r.moneda_abono, monedas),
  })), [data, bancos, monedas])

  useEffect(() => {
    setDisplayedRows(agRows)
  }, [agRows])

  const applyPreset = preset => {
    if (!gridApi) return
    const allCols = ['numero_operacion','fecha_operacion','banco_nombre','cuenta_cargo','moneda_cargo_nombre','cuenta_abono','moneda_abono_nombre','importe_cargado','importe_abonado','comision','referencia','estado','acciones']

    const presets = {
      gerencia: ['numero_operacion','fecha_operacion','banco_nombre','importe_cargado','importe_abonado','estado','acciones'],
      operaciones: ['numero_operacion','fecha_operacion','cuenta_cargo','cuenta_abono','importe_cargado','estado','acciones'],
      auditoria: ['numero_operacion','fecha_operacion','banco_nombre','comision','referencia','estado','acciones'],
      completo: allCols,
    }

    const visible = presets[preset] || allCols
    gridApi.setColumnsVisible(allCols, false)
    gridApi.setColumnsVisible(visible, true)
  }

  const exportCsv = () => {
    const rows = displayedRows.length ? displayedRows : agRows
    const headers = ['Nro Op','Fecha','Banco','Cuenta Cargo','Cuenta Abono','Cargado','Abonado','Comision','Estado']
    const body = rows.map(r => [
      r.numero_operacion,
      formatDate(r.fecha_operacion),
      r.banco_nombre,
      r.cuenta_cargo,
      r.cuenta_abono,
      r.importe_cargado,
      r.importe_abonado,
      r.comision,
      r.estado,
    ].map(csvEscape).join(';'))
    downloadTextFile(`devoluciones_${new Date().toISOString().slice(0,10)}.csv`, [headers.join(';'), ...body].join('\n'))
  }

  const agDefaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    floatingFilter: true,
    resizable: true,
    minWidth: 90,
    cellStyle: {
      fontSize: compactMode ? '10.5px' : '12px',
      color: 'var(--qf-navy)',
    },
  }), [compactMode])

  const agColumnDefs = useMemo(() => [
    { headerName: 'Nro.Op.', field: 'numero_operacion', width: 120, cellRenderer: p => <code style={S.opCode}>{p.value || '-'}</code> },
    { headerName: 'Fecha', field: 'fecha_operacion', width: 110, valueFormatter: p => formatDate(p.value) },
    { headerName: 'Banco', field: 'banco_nombre', width: 150, cellRenderer: p => <span style={S.bankPill}>{p.value || '-'}</span> },
    { headerName: 'Cta Cargo', field: 'cuenta_cargo', width: 160 },
    { headerName: 'M Cargo', field: 'moneda_cargo_nombre', width: 90 },
    { headerName: 'Cta Abono', field: 'cuenta_abono', width: 160 },
    { headerName: 'M Abono', field: 'moneda_abono_nombre', width: 90 },
    { headerName: 'Cargado', field: 'importe_cargado', width: 120, type: 'numericColumn', valueFormatter: p => money(p.value, getMonedaCodigo(p.data?.moneda_cargo, monedas)) },
    { headerName: 'Abonado', field: 'importe_abonado', width: 120, type: 'numericColumn', valueFormatter: p => money(p.value, getMonedaCodigo(p.data?.moneda_abono, monedas)) },
    { headerName: 'Comisión', field: 'comision', width: 110, type: 'numericColumn', valueFormatter: p => money(p.value, getMonedaCodigo(p.data?.moneda_cargo, monedas)) },
    { headerName: 'Referencia', field: 'referencia', flex: 1, minWidth: 160 },
    {
      headerName: 'Estado',
      field: 'estado',
      width: 110,
      cellRenderer: p => <span className={`badge ${badgeClass(p.value)}`} style={{ fontSize: 8 }}>{String(p.value || '-').toUpperCase()}</span>
    },
    {
      headerName: 'Acc.',
      field: 'acciones',
      width: 120,
      pinned: 'right',
      sortable: false,
      filter: false,
      cellRenderer: p => (
        <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          {canView && <button className="btn btn-secondary btn-sm" onClick={() => setModal({ type: 'detalle', data: p.data })} style={S.aBtn}>Ver</button>}
          {canEdit && <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'editar', data: p.data })} style={S.aBtn}>Edit</button>}
          {canDelete && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.data)} style={S.aBtn}>Del</button>}
        </div>
      )
    }
  ], [compactMode, monedas, canView, canEdit, canDelete])

  if (!canList) return <div className="fade-in" style={S.page}><div style={S.topHeader}><h1 style={S.title}>↩ Devoluciones</h1><p style={S.subtitle}>No tienes permisos para ver esta lista</p></div></div>

  return (
    <div className="fade-in" style={S.page}>
      <style>{`
        .qf-tareas-grid .ag-root-wrapper {
          border: 0;
          border-top: 1px solid var(--qf-border);
        }
        .qf-tareas-grid .ag-header {
          background: var(--qf-navy);
        }
        .qf-tareas-grid .ag-header-cell-text {
          color: #fff;
          font-size: 8.5px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .qf-tareas-grid .ag-floating-filter {
          background: #f8fafc;
        }
        .qf-tareas-grid .ag-input-field-input {
          font-size: 9px;
          min-height: 20px;
        }
        .qf-tareas-grid .ag-row-hover {
          background: #f8fafc;
        }
      `}</style>
      <ToastContainer toasts={toasts} />
      <div style={S.topHeader}><h1 style={S.title}>↩ Devoluciones</h1><p style={S.subtitle}>Gestión de devoluciones bancarias</p></div>
      <div style={S.actionBar}><button className="btn btn-secondary btn-sm" onClick={() => setCompactMode(v => !v)}>{compactMode ? 'Vista cómoda' : 'Vista compacta'}</button></div>
      <div style={S.kpiGrid}>{[{ l: 'Total registros', v: total, c: 'var(--qf-navy)', b: '#2196f3' },{ l: 'Mostradas', v: data.length, c: '#185FA5', b: '#03a9f4' },{ l: 'Total cargado', v: money(metrics.totalCargado), c: '#c62828', b: '#f44336' },{ l: 'Total abonado', v: money(metrics.totalAbonado), c: '#2e7d32', b: '#4caf50' },{ l: 'Comisiones', v: money(metrics.totalComision), c: '#e65100', b: '#ff9800' },{ l: 'Pendientes', v: metrics.pendientes, c: '#5e35b1', b: '#7e57c2' }].map(s => <div key={s.l} style={{ ...S.kpiCard, borderTop: `3px solid ${s.b}` }}><div style={S.kpiLabel}>{s.l}</div><div style={{ ...S.kpiValue, color: s.c }}>{s.v}</div></div>)}</div>

      <div className="page-card" style={S.card}>
        <div style={S.stickyTools}>
          <div style={S.cardTitleWrap}><h2 style={S.cardTitle}>Lista de Devoluciones</h2>{canCreate && <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'nuevo' })} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ color: '#4CAF50', fontWeight: 800, fontSize: 16 }}>+</span> Nuevo Registro</button>}</div>
          <div style={S.filtersRow}>
            <select className="filter-input" value={campo} onChange={e => setCampo(e.target.value)} style={S.fieldSelect}>{camposBusqueda.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}><span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#8a9bb5', pointerEvents: 'none' }}>🔍</span><input className="filter-input" placeholder={campo === 'all' ? 'Buscar...' : `Buscar por ${camposBusqueda.find(f => f.value === campo)?.label || ''}...`} value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ ...S.searchInput, paddingLeft: 32, width: '100%' }} /></div>
            <button className="btn btn-secondary btn-sm" onClick={limpiar}>Limpiar</button>
          </div>
          <div style={S.pagRow}>
            <span style={S.pill}>{from}-{to} de {total}</span>
            <select className="filter-input" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} style={{ width: 'auto', minWidth: 52, height: 28, fontSize: 11, padding: '0 4px' }}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option><option value={200}>200</option></select>
            <button className="btn btn-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setPage(1)}>«</button>
            <button className="btn btn-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setPage(p => Math.max(1, p - 1))}>‹</button>
            <span style={S.pageInfo}>{page}/{totalPages}</span>
            <button className="btn btn-secondary btn-sm" disabled={page >= totalPages || loading} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>›</button>
            <button className="btn btn-secondary btn-sm" disabled={page >= totalPages || loading} onClick={() => setPage(totalPages)}>»</button>
            {loading && <span style={S.loadMini}>...</span>}
          </div>
        </div>

        
        <div style={S.erpTools}>
          <div style={S.erpGroup}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowSidePanel(v => !v)}>Panel</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowDashboard(v => !v)}>{showDashboard ? 'Ocultar BI' : 'Ver BI'}</button>

            <select className="filter-input" value={groupBy} onChange={e => setGroupBy(e.target.value)} style={{ width: 150, height: 26, fontSize: 10 }}>
              <option value="estado">Agrupar Estado</option>
              <option value="banco_nombre">Agrupar Banco</option>
              <option value="moneda_cargo_nombre">Agrupar Moneda</option>
            </select>

            <div style={{ position: 'relative', minWidth: 280 }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#8a9bb5' }}>🔍</span>
              <input
                className="filter-input"
                placeholder="Búsqueda global..."
                value={quickText}
                onChange={e => setQuickText(e.target.value)}
                style={{ ...S.searchInput, width: '100%', paddingLeft: 30 }}
              />
            </div>

            <select className="filter-input" value={quickPreset} onChange={e => setQuickPreset(e.target.value)} style={S.fieldSelect}>
              <option value="all">Todos</option>
              <option value="pendientes">Pendientes</option>
              <option value="procesados">Procesados</option>
              <option value="errores">Errores</option>
            </select>

            <button className="btn btn-secondary btn-sm" onClick={exportCsv}>CSV</button>
            <button className="btn btn-secondary btn-sm" onClick={() => exportExcel(displayedRows.length ? displayedRows : agRows)}>Excel</button>
            <button className="btn btn-secondary btn-sm" onClick={() => exportPdf(displayedRows.length ? displayedRows : agRows)}>PDF</button>
          </div>

          <div style={S.erpGroup}>
            <input
              className="filter-input"
              placeholder="Guardar vista"
              value={viewName}
              onChange={e => setViewName(e.target.value)}
              style={{ width: 140, height: 26, fontSize: 10 }}
            />

            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                if (!gridApi || !viewName.trim()) return
                const view = {
                  id: Date.now(),
                  name: viewName.trim(),
                  filterModel: gridApi.getFilterModel(),
                  columnState: gridApi.getColumnState(),
                  quickText,
                }
                const next = [view, ...savedViews].slice(0, 10)
                setSavedViews(next)
                localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next))
                setViewName('')
              }}
            >
              Guardar vista
            </button>
          </div>
        </div>

        {savedViews.length > 0 && (
          <div style={S.savedViews}>
            {savedViews.map(v => (
              <button
                key={v.id}
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  if (!gridApi) return
                  gridApi.setFilterModel(v.filterModel || null)
                  if (v.columnState?.length) gridApi.applyColumnState({ state: v.columnState, applyOrder: true })
                  setQuickText(v.quickText || '')
                }}
              >
                {v.name}
              </button>
            ))}
          </div>
        )}


        {showSidePanel && (
          <div style={S.sidePanel}>
            <div style={S.sideSection}>
              <div style={S.sideTitle}>Presets ERP</div>
              <button className="btn btn-secondary btn-sm" onClick={() => applyPreset('gerencia')}>Gerencia</button>
              <button className="btn btn-secondary btn-sm" onClick={() => applyPreset('operaciones')}>Operaciones</button>
              <button className="btn btn-secondary btn-sm" onClick={() => applyPreset('auditoria')}>Auditoría</button>
              <button className="btn btn-secondary btn-sm" onClick={() => applyPreset('completo')}>Completo</button>
            </div>

            <div style={S.sideSection}>
              <div style={S.sideTitle}>Totales dinámicos</div>
              <div style={S.groupMini}><span>Filtrados</span><b>{displayedRows.length}</b></div>
              <div style={S.groupMini}><span>Cargado</span><b>{money(displayedRows.reduce((s,r)=>s+Number(r.importe_cargado||0),0))}</b></div>
              <div style={S.groupMini}><span>Abonado</span><b>{money(displayedRows.reduce((s,r)=>s+Number(r.importe_abonado||0),0))}</b></div>
            </div>
          </div>
        )}

        {showDashboard && (
          <div style={S.dashboard}>
            {buildGroupSummary(displayedRows.length ? displayedRows : agRows, groupBy).slice(0,6).map(g => (
              <div key={g.name} style={S.dashPanel}>
                <div style={S.sideTitle}>{g.name}</div>
                <div style={S.kpiValue}>{g.count}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>Cargado: {money(g.cargado)}</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>Abonado: {money(g.abonado)}</div>
              </div>
            ))}
          </div>
        )}


        <div
          className="ag-theme-quartz qf-tareas-grid"
          style={{
            width: '100%',
            height: compactMode ? 'calc(100vh - 320px)' : 'calc(100vh - 380px)',
            minHeight: 420,
            '--ag-font-size': compactMode ? '10.5px' : '12px',
            '--ag-row-height': compactMode ? '28px' : '34px',
          }}
        >
          <AgGridReact
            rowData={agRows.filter(r => {
              if (quickPreset === 'pendientes') return String(r.estado || '').toLowerCase().includes('pendiente')
              if (quickPreset === 'procesados') return String(r.estado || '').toLowerCase().includes('proces')
              if (quickPreset === 'errores') return String(r.estado || '').toLowerCase().includes('error')
              return true
            })}
            columnDefs={agColumnDefs}
            defaultColDef={agDefaultColDef}
            quickFilterText={quickText}
            pagination
            paginationPageSize={pageSize}
            animateRows
            suppressCellFocus
            onGridReady={params => {
              setGridApi(params.api)
              gridColumnApiRef.current = params.columnApi
            }}
            onFilterChanged={params => {
              const rows = []
              params.api.forEachNodeAfterFilterAndSort(node => node?.data && rows.push(node.data))
              setDisplayedRows(rows)
            }}
            onSortChanged={params => {
              const rows = []
              params.api.forEachNodeAfterFilterAndSort(node => node?.data && rows.push(node.data))
              setDisplayedRows(rows)
            }}
          />
        </div>
        {!loading && <div style={S.footerCount}>{data.length} de {total} devoluciones</div>}
      </div>

      {modal?.type === 'detalle' && <ModalDetalle item={modal.data} bancos={bancos} monedas={monedas} onClose={() => setModal(null)} />}
      {modal?.type === 'nuevo' && <ModalDevolucion bancos={bancos} monedas={monedas} onClose={() => setModal(null)} onSave={handleSave} />}
      {modal?.type === 'editar' && <ModalDevolucion item={modal.data} bancos={bancos} monedas={monedas} onClose={() => setModal(null)} onSave={handleSave} />}
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
  searchInput: { minWidth: 180, maxWidth: 340, height: 32, fontSize: 12 },
  pagRow: { display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', padding: '5px 14px 7px', background: '#f8fafc', borderTop: '1px solid var(--qf-border)' },
  pageInfo: { fontSize: 11, color: 'var(--qf-text-light)', fontWeight: 600 },
  loadMini: { fontSize: 11, color: '#185FA5', fontWeight: 700 },
  th0: { position: 'sticky', top: 0, zIndex: 10, whiteSpace: 'nowrap', fontSize: 9, padding: '5px 4px' },
  ths: { position: 'sticky', top: 0, zIndex: 10, whiteSpace: 'nowrap', fontSize: 9, padding: '5px 4px', cursor: 'pointer', userSelect: 'none' },
  si: { fontSize: 7, opacity: 0.45, marginLeft: 1 },
  td: { padding: '3px 4px', verticalAlign: 'middle', lineHeight: 1.15 },
  opCode: { background: '#e8eef5', padding: '1px 4px', borderRadius: 3, fontSize: 9.5, fontWeight: 800, color: 'var(--qf-navy)' },
  bankPill: { background: '#e8eef5', color: 'var(--qf-navy)', borderRadius: 3, padding: '1px 4px', fontSize: 9.5, fontWeight: 700, whiteSpace: 'nowrap' },
  aBtn: { fontSize: 9, padding: '1px 4px' },
  footerCount: { padding: '6px 14px', borderTop: '1px solid var(--qf-border)', fontSize: 10.5, color: 'var(--qf-text-light)', background: '#fff' },
  erpTools: { display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', padding: '6px 12px', borderTop: '1px solid var(--qf-border)', background: '#fff' },
  erpGroup: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' },
  savedViews: { display: 'flex', gap: 6, flexWrap: 'wrap', padding: '6px 12px', background: '#f8fafc', borderTop: '1px solid var(--qf-border)' },

  sidePanel: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, padding: '8px 12px', background: '#fff', borderTop: '1px solid var(--qf-border)' },
  sideSection: { background: '#f8fafc', border: '1px solid var(--qf-border)', borderRadius: 8, padding: 8, display: 'flex', flexWrap: 'wrap', gap: 6 },
  sideTitle: { width: '100%', fontSize: 9.5, fontWeight: 800, color: 'var(--qf-navy)', textTransform: 'uppercase' },
  dashboard: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, padding: '8px 12px', background: '#fff', borderTop: '1px solid var(--qf-border)' },
  dashPanel: { background: '#f8fafc', border: '1px solid var(--qf-border)', borderRadius: 8, padding: 10 },
  groupMini: { display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: 10, background: '#fff', padding: '4px 8px', borderRadius: 6, border: '1px solid #d9e2ec' },

  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 },
  detailBox: { background: '#f8fafc', border: '1px solid var(--qf-border)', borderRadius: 8, padding: 8 },
  detailLabel: { fontSize: 9, fontWeight: 700, color: 'var(--qf-text-light)', textTransform: 'uppercase' },
  detailValue: { fontSize: 12, fontWeight: 600, color: 'var(--qf-navy)' },
  g3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' },
  g4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' },
  errorBox: { background: '#fce4e4', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginTop: 8 },
}

export default DevolucionesPage