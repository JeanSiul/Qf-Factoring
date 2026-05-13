import React, { useEffect, useMemo, useRef, useState } from 'react'
import { apiCall, toArray } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'
import { useAuth } from '../context/AuthContext'
import { AgGridReact } from 'ag-grid-react'

const CLAIM = 'OPEDEV'
const DEBOUNCE_MS = 450
const GRID_VIEW_KEY = 'qf_devoluciones_grid_view_v2'
const SAVED_VIEWS_KEY = 'qf_devoluciones_saved_views_v2'
const DASHBOARD_KEY = 'qf_devoluciones_dashboard_v2'


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
const dateKey = value => {
  if (!value) return ''
  const raw = String(value).trim()

  // ISO / MySQL: 2026-05-13, 2026-05-13T10:00:00, 2026-05-13 10:00:00
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  // Formato peruano: 13/05/2026 o 13/5/2026
  const pe = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (pe) return `${pe[3]}-${String(pe[2]).padStart(2, '0')}-${String(pe[1]).padStart(2, '0')}`

  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const formatDate = value => {
  const k = dateKey(value)
  if (!k) return '-'
  const [y, m, d] = k.split('-')
  return `${d}/${m}/${y}`
}
const toDateInput = value => dateKey(value)
const badgeClass = status => { const s = String(status || '').toLowerCase(); if (s.includes('pendiente') || s.includes('proceso')) return 'warning'; if (s.includes('completado') || s.includes('exitoso') || s.includes('procesado')) return 'active'; if (s.includes('error') || s.includes('rechazado') || s.includes('fallido')) return 'inactive'; return 'warning' }

const getField = (obj, ...names) => { for (const n of names) { if (obj[n] !== undefined) return obj[n]; if (obj[n.toLowerCase()] !== undefined) return obj[n.toLowerCase()]; if (obj[n.toUpperCase()] !== undefined) return obj[n.toUpperCase()] } return undefined }
const getBancoNombre = (id, bancos) => { if (!id) return '-'; const b = bancos.find(x => String(getField(x, 'id', 'ID')) === String(id)); return b ? (getField(b, 'name', 'Name', 'NAME') || id) : id }
const getMonedaNombre = (id, monedas) => { if (!id) return '-'; const m = monedas.find(x => String(getField(x, 'ID', 'id')) === String(id)); if (!m) return id; return getField(m, 'VALORTEXTO1', 'valortexto1') || getField(m, 'VALORTEXTO', 'valortexto') || getField(m, 'CODIGO', 'codigo') || id }
const getMonedaCodigo = (id, monedas) => { if (!id) return 'PEN'; const m = monedas.find(x => String(getField(x, 'ID', 'id')) === String(id)); if (!m) return 'PEN'; return getField(m, 'VALORTEXTO', 'valortexto', 'ValorTexto') || 'PEN' }

const normalize = value => String(value ?? '').toLowerCase().trim()

const safeJsonParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback
  } catch (_) {
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

const pct = (value, total) => `${Math.round((Number(value || 0) / Math.max(Number(total || 0), 1)) * 100)}%`

const groupDevLabel = (row, groupBy) => {
  if (groupBy === 'estado') return row.estado || 'Sin estado'
  if (groupBy === 'banco') return row.banco_nombre || 'Sin banco'
  if (groupBy === 'moneda_cargo') return row.moneda_cargo_nombre || 'Sin moneda'
  if (groupBy === 'moneda_abono') return row.moneda_abono_nombre || 'Sin moneda'
  if (groupBy === 'fecha') return toDateInput(row.fecha_operacion) || 'Sin fecha'
  return 'General'
}

const buildDevGroupSummary = (rows, groupBy) => {
  const map = new Map()
  rows.forEach(row => {
    const key = groupDevLabel(row, groupBy)
    const current = map.get(key) || { name: key, count: 0, cargado: 0, abonado: 0, comision: 0, pendientes: 0, procesadas: 0, errores: 0 }
    current.count += 1
    current.cargado += Number(row.importe_cargado || 0)
    current.abonado += Number(row.importe_abonado || 0)
    current.comision += Number(row.comision || 0)
    const estado = normalize(row.estado)
    if (estado.includes('pend') || estado.includes('proceso')) current.pendientes += 1
    if (estado.includes('proces') || estado.includes('complet') || estado.includes('exitos')) current.procesadas += 1
    if (estado.includes('error') || estado.includes('rechaz') || estado.includes('fall')) current.errores += 1
    map.set(key, current)
  })
  return [...map.values()].sort((a, b) => b.count - a.count)
}

const exportDevHtmlTable = (filename, rows) => {
  const headers = ['Nro. Operación', 'Fecha', 'Banco', 'Cuenta Cargo', 'Moneda Cargo', 'Cuenta Abono', 'Moneda Abono', 'Importe Cargado', 'Importe Abonado', 'Comisión', 'Referencia', 'Estado']
  const htmlRows = rows.map(r => `<tr><td>${r.numero_operacion || ''}</td><td>${formatDate(r.fecha_operacion)}</td><td>${r.banco_nombre || ''}</td><td>${r.cuenta_cargo || ''}</td><td>${r.moneda_cargo_nombre || ''}</td><td>${r.cuenta_abono || ''}</td><td>${r.moneda_abono_nombre || ''}</td><td>${Number(r.importe_cargado || 0)}</td><td>${Number(r.importe_abonado || 0)}</td><td>${Number(r.comision || 0)}</td><td>${r.referencia || ''}</td><td>${r.estado || ''}</td></tr>`).join('')
  const content = `<html><head><meta charset="utf-8" /></head><body><table border="1"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${htmlRows}</tbody></table></body></html>`
  downloadTextFile(filename, content, 'application/vnd.ms-excel;charset=utf-8;')
}

const printDevPdfReport = (rows, title = 'Reporte de Devoluciones QF') => {
  const byEstado = buildDevGroupSummary(rows, 'estado')
  const html = `<html><head><title>${title}</title><style>body{font-family:Arial,sans-serif;color:#0f2742;padding:18px}h1{font-size:18px;margin:0 0 8px}.meta{color:#64748b;font-size:11px;margin-bottom:12px}table{width:100%;border-collapse:collapse;font-size:10px}th{background:#0f2742;color:#fff;text-align:left;padding:5px}td{border:1px solid #d9e2ec;padding:4px}.kpis{display:flex;gap:8px;margin:12px 0}.kpi{border:1px solid #d9e2ec;border-radius:8px;padding:8px;min-width:110px}.kpi b{display:block;font-size:16px;color:#185FA5}</style></head><body><h1>${title}</h1><div class="meta">Generado: ${new Date().toLocaleString('es-PE')} · Registros: ${rows.length}</div><div class="kpis"><div class="kpi"><span>Total</span><b>${rows.length}</b></div><div class="kpi"><span>Cargado</span><b>${money(rows.reduce((s,r)=>s+Number(r.importe_cargado||0),0))}</b></div><div class="kpi"><span>Abonado</span><b>${money(rows.reduce((s,r)=>s+Number(r.importe_abonado||0),0))}</b></div><div class="kpi"><span>Comisión</span><b>${money(rows.reduce((s,r)=>s+Number(r.comision||0),0))}</b></div></div><h2 style="font-size:14px">Resumen por estado</h2><table><thead><tr><th>Estado</th><th>Cantidad</th><th>Cargado</th><th>Abonado</th><th>Comisión</th></tr></thead><tbody>${byEstado.map(g => `<tr><td>${g.name}</td><td>${g.count}</td><td>${money(g.cargado)}</td><td>${money(g.abonado)}</td><td>${money(g.comision)}</td></tr>`).join('')}</tbody></table><h2 style="font-size:14px">Detalle</h2><table><thead><tr><th>Nro.</th><th>Fecha</th><th>Banco</th><th>Cargado</th><th>Abonado</th><th>Estado</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.numero_operacion || ''}</td><td>${formatDate(r.fecha_operacion)}</td><td>${r.banco_nombre || ''}</td><td>${money(r.importe_cargado, r.moneda_cargo_codigo)}</td><td>${money(r.importe_abonado, r.moneda_abono_codigo)}</td><td>${r.estado || ''}</td></tr>`).join('')}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`
  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close() }
}


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
  const [showColumnPanel, setShowColumnPanel] = useState(false)
  const [visibleCols, setVisibleCols] = useState({})
  const [displayedRows, setDisplayedRows] = useState([])
  const [showSidePanel, setShowSidePanel] = useState(false)
  const [showDashboard, setShowDashboard] = useState(() => safeJsonParse(localStorage.getItem(DASHBOARD_KEY), true))
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

  const quickFilteredData = useMemo(() => {
    const now = new Date()
    const todayIso = dateKey(now)

    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - 6)
    const weekIso = dateKey(weekStart)

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const monthIso = dateKey(monthStart)
    const nextMonthIso = dateKey(nextMonthStart)

    return data.filter(row => {
      const fecha = dateKey(row.fecha_operacion)
      const estado = normalize(row.estado)
      const bancoNombre = normalize(getBancoNombre(row.banco, bancos))
      const monedaCargo = normalize(getMonedaNombre(row.moneda_cargo, monedas))
      const monedaAbono = normalize(getMonedaNombre(row.moneda_abono, monedas))

      if (quickPreset === 'today') return fecha === todayIso
      if (quickPreset === 'week') return fecha >= weekIso && fecha <= todayIso
      if (quickPreset === 'month') return fecha >= monthIso && fecha < nextMonthIso
      if (quickPreset === 'pending') return estado.includes('pend') || estado.includes('proceso')
      if (quickPreset === 'processed') return estado.includes('proces') || estado.includes('complet') || estado.includes('exitos')
      if (quickPreset === 'errors') return estado.includes('error') || estado.includes('rechaz') || estado.includes('fall')
      if (quickPreset === 'withBank') return !!bancoNombre && bancoNombre !== '-'
      if (quickPreset === 'soles') return monedaCargo.includes('pen') || monedaCargo.includes('sol') || monedaAbono.includes('pen') || monedaAbono.includes('sol')
      if (quickPreset === 'dollars') return monedaCargo.includes('usd') || monedaCargo.includes('dol') || monedaAbono.includes('usd') || monedaAbono.includes('dol')
      if (quickPreset === 'gerencia') return estado.includes('pend') || estado.includes('error') || estado.includes('rechaz') || Number(row.importe_cargado || 0) !== Number(row.importe_abonado || 0)
      if (quickPreset === 'operaciones') return estado.includes('pend') || estado.includes('proceso')
      if (quickPreset === 'auditoria') return Number(row.comision || 0) > 0 || Number(row.importe_cargado || 0) !== Number(row.importe_abonado || 0)
      return true
    })
  }, [data, quickPreset, bancos, monedas])

  const agRows = useMemo(() => quickFilteredData.map(row => ({
    ...row,
    banco_nombre: getBancoNombre(row.banco, bancos),
    moneda_cargo_nombre: getMonedaNombre(row.moneda_cargo, monedas),
    moneda_abono_nombre: getMonedaNombre(row.moneda_abono, monedas),
    moneda_cargo_codigo: getMonedaCodigo(row.moneda_cargo, monedas),
    moneda_abono_codigo: getMonedaCodigo(row.moneda_abono, monedas),
  })), [quickFilteredData, bancos, monedas])

  useEffect(() => {
    setDisplayedRows(agRows)
  }, [agRows])

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
    noRowsToShow: 'No se encontraron devoluciones',
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

  const agDefaultColDef = useMemo(() => ({
    sortable: true,
    filter: true,
    floatingFilter: true,
    resizable: true,
    minWidth: 90,
    cellStyle: {
      fontSize: compactMode ? '10.5px' : '12px',
      color: 'var(--qf-navy)',
      lineHeight: compactMode ? '18px' : '22px',
    },
    headerClass: 'qf-tareas-ag-header',
    floatingFilterComponentParams: { suppressFilterButton: false },
  }), [compactMode])

  const getDisplayedRows = () => {
    if (!gridApi) return agRows
    const rows = []
    gridApi.forEachNodeAfterFilterAndSort(node => {
      if (node?.data) rows.push(node.data)
    })
    return rows
  }

  const refreshDisplayedRows = api => {
    if (!api) return
    const rows = []
    api.forEachNodeAfterFilterAndSort(node => {
      if (node?.data) rows.push(node.data)
    })
    setDisplayedRows(rows)
  }

  const limpiarFiltrosTabla = () => {
    if (!gridApi) return
    setQuickText('')
    gridApi.setFilterModel(null)
    gridApi.setGridOption?.('quickFilterText', '')
    gridApi.applyColumnState({
      defaultState: { sort: null },
      state: [{ colId: 'numero_operacion', sort: 'desc' }],
    })
    setTimeout(() => refreshDisplayedRows(gridApi), 60)
  }

  const saveCurrentView = name => {
    if (!gridApi || !name.trim()) return
    const view = {
      id: Date.now(),
      name: name.trim(),
      quickText,
      quickPreset,
      pageSize,
      groupBy,
      showDashboard,
      filterModel: gridApi.getFilterModel(),
      columnState: gridApi.getColumnState(),
      createdAt: new Date().toISOString(),
    }
    const next = [view, ...savedViews.filter(v => v.name !== view.name)].slice(0, 10)
    setSavedViews(next)
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next))
    localStorage.setItem(GRID_VIEW_KEY, JSON.stringify(view))
    setViewName('')
    show('Vista guardada')
  }

  const applyView = view => {
    if (!gridApi || !view) return
    setQuickText(view.quickText || '')
    setQuickPreset(view.quickPreset || 'all')
    setGroupBy(view.groupBy || 'estado')
    setShowDashboard(view.showDashboard ?? true)
    setPageSize(Number(view.pageSize || 50))
    setTimeout(() => {
      gridApi.setFilterModel(view.filterModel || null)
      if (view.columnState?.length) gridApi.applyColumnState({ state: view.columnState, applyOrder: true })
      gridApi.setGridOption?.('quickFilterText', view.quickText || '')
      refreshDisplayedRows(gridApi)
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
    setGroupBy('estado')
    setShowDashboard(true)
    setPageSize(50)
    gridApi.setFilterModel(null)
    gridApi.resetColumnState()
    gridApi.setGridOption?.('quickFilterText', '')
    localStorage.removeItem(GRID_VIEW_KEY)
    setTimeout(() => refreshDisplayedRows(gridApi), 60)
  }

  const exportCsv = () => {
    const rows = getDisplayedRows()
    const headers = ['Nro. Operación', 'Fecha', 'Banco', 'Cuenta Cargo', 'Moneda Cargo', 'Cuenta Abono', 'Moneda Abono', 'Importe Cargado', 'Importe Abonado', 'Comisión', 'Referencia', 'Estado']
    const body = rows.map(r => [
      r.numero_operacion,
      formatDate(r.fecha_operacion),
      r.banco_nombre,
      r.cuenta_cargo,
      r.moneda_cargo_nombre,
      r.cuenta_abono,
      r.moneda_abono_nombre,
      r.importe_cargado,
      r.importe_abonado,
      r.comision,
      r.referencia,
      r.estado,
    ].map(csvEscape).join(';'))
    downloadTextFile(`devoluciones_${new Date().toISOString().slice(0, 10)}.csv`, [headers.join(';'), ...body].join('\n'))
  }

  const exportExcel = () => {
    exportDevHtmlTable(`devoluciones_${new Date().toISOString().slice(0, 10)}.xls`, getDisplayedRows())
  }

  const exportPdf = () => {
    printDevPdfReport(getDisplayedRows(), 'Reporte de Devoluciones QF')
  }

  const applyColumnPreset = preset => {
    if (!gridApi) return
    const allCols = ['numero_operacion', 'fecha_operacion', 'numero_operacion_pdf', 'created_at', 'banco_nombre', 'cuenta_cargo', 'moneda_cargo_nombre', 'cuenta_abono', 'moneda_abono_nombre', 'importe_cargado', 'importe_abonado', 'comision', 'referencia', 'estado', 'acciones']
    const presets = {
      gerencia: ['numero_operacion', 'fecha_operacion', 'banco_nombre', 'importe_cargado', 'importe_abonado', 'estado', 'acciones'],
      operaciones: ['numero_operacion', 'fecha_operacion', 'banco_nombre', 'cuenta_cargo', 'cuenta_abono', 'importe_cargado', 'estado', 'acciones'],
      auditoria: ['numero_operacion', 'fecha_operacion', 'banco_nombre', 'importe_cargado', 'importe_abonado', 'comision', 'referencia', 'estado', 'acciones'],
      completo: allCols,
    }
    const visible = presets[preset] || allCols
    gridApi.setColumnsVisible(allCols, false)
    gridApi.setColumnsVisible(visible, true)
    setVisibleCols(Object.fromEntries(allCols.map(c => [c, visible.includes(c)])))
  }

  const toggleDashboard = () => {
    setShowDashboard(v => {
      localStorage.setItem(DASHBOARD_KEY, JSON.stringify(!v))
      return !v
    })
  }

  const toggleColumn = field => {
    if (!gridApi) return
    const current = visibleCols[field] !== false
    gridApi.setColumnsVisible([field], !current)
    setVisibleCols(prev => ({ ...prev, [field]: !current }))
  }

  const agColumnDefs = useMemo(() => [
    {
      headerName: 'Nro. Operación',
      field: 'numero_operacion',
      width: 120,
      sort: 'desc',
      cellRenderer: p => <code style={S.opCode}>{p.value || '-'}</code>,
      filter: 'agTextColumnFilter',
    },
    { headerName: 'Fecha', field: 'fecha_operacion', width: 150, valueFormatter: p => formatDate(p.value), filter: 'agDateColumnFilter', headerClass: 'qf-center-header' },
    { headerName: 'Nro. Op. PDF', field: 'numero_operacion_pdf', width: 140, filter: 'agTextColumnFilter', hide: true, headerClass: 'qf-center-header' },
    { headerName: 'Creado', field: 'created_at', width: 150, valueFormatter: p => formatDate(p.value), filter: 'agDateColumnFilter', hide: true, headerClass: 'qf-center-header' },
    { headerName: 'Banco', field: 'banco_nombre', width: 150, cellRenderer: p => <span style={S.bankPill}>{p.value || '-'}</span>, filter: 'agTextColumnFilter' },
    { headerName: 'Cta. Cargo', field: 'cuenta_cargo', width: 150, filter: 'agTextColumnFilter', headerClass: 'qf-center-header' },
    { headerName: 'Moneda', field: 'moneda_cargo_nombre', width: 90, filter: 'agTextColumnFilter' },
    { headerName: 'Cta. Abono', field: 'cuenta_abono', width: 150, filter: 'agTextColumnFilter', headerClass: 'qf-center-header' },
    { headerName: 'Moneda', field: 'moneda_abono_nombre', width: 90, filter: 'agTextColumnFilter' },
    {
      headerName: 'monto Cargado',
      field: 'importe_cargado',
      width: 125,
      type: 'numericColumn',
      cellStyle: { fontWeight: 800, color: '#c62828', textAlign: 'center' },
      cellClass: 'qf-right-cell',
      valueFormatter: p => money(p.value, p.data?.moneda_cargo_codigo),
      filter: 'agNumberColumnFilter',
    },
    {
      headerName: 'Importe Abonado',
      field: 'importe_abonado',
      width: 125,
      type: 'numericColumn',
      cellStyle: { fontWeight: 800, color: '#2e7d32', textAlign: 'center' },
      cellClass: 'qf-right-cell',
      valueFormatter: p => money(p.value, p.data?.moneda_abono_codigo),
      filter: 'agNumberColumnFilter',
    },
    {
      headerName: 'Comisión',
      field: 'comision',
      width: 105,
      type: 'numericColumn',
      cellStyle: { fontWeight: 800, color: '#2e7d32', textAlign: 'center' },
      cellClass: 'qf-right-cell',
      valueFormatter: p => money(p.value, p.data?.moneda_cargo_codigo),
      filter: 'agNumberColumnFilter',
    },
    { 
      headerName: 'Referencia', 
      field: 'referencia', 
      flex: 1, 
      cellStyle: { fontWeight: 800, color: '#2e7d32', textAlign: 'right' },
      minWidth: 160, 
      filter: 'agTextColumnFilter' },
    {
      headerName: 'Estado',
      field: 'estado',
      width: 120,
      cellRenderer: p => <span className={`badge ${badgeClass(p.value)}`} style={{ fontSize: 8 }}>{String(p.value || '-').toUpperCase()}</span>,
      filter: 'agTextColumnFilter',
    },
    {
      headerName: 'Acciones',
      field: 'acciones',
      width: 115,
      pinned: 'right',
      sortable: false,
      filter: false,
      cellRenderer: p => (
        <div style={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          {canView && <button className="btn btn-secondary btn-sm" onClick={() => setModal({ type: 'detalle', data: p.data })} style={S.aBtn}>Ver</button>}
          {canEdit && <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'editar', data: p.data })} style={S.aBtn}>Edit</button>}
          {canDelete && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.data)} style={S.aBtn}>Del</button>}
        </div>
      ),
    },
  ], [compactMode, canView, canEdit, canDelete])

  const liveRows = displayedRows.length ? displayedRows : agRows
  const groupSummary = useMemo(() => buildDevGroupSummary(liveRows, groupBy), [liveRows, groupBy])
  const estadoSummary = useMemo(() => buildDevGroupSummary(liveRows, 'estado'), [liveRows])
  const bancoSummary = useMemo(() => buildDevGroupSummary(liveRows, 'banco'), [liveRows])
  const monedaSummary = useMemo(() => buildDevGroupSummary(liveRows, 'moneda_cargo'), [liveRows])

  if (!canList) return <div className="fade-in" style={S.page}><div style={S.topHeader}><h1 style={S.title}>↩ Devoluciones</h1><p style={S.subtitle}>No tienes permisos para ver esta lista</p></div></div>

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
        .qf-tareas-grid .ag-icon,
        .qf-tareas-grid .ag-header-icon {
          color: #fff;
          font-size: 15px;
        }
        .qf-tareas-grid .ag-floating-filter {
          background: #f8fafc;
          border-bottom: 1px solid var(--qf-border);
          min-height: 10px;
        }
        .qf-tareas-grid .ag-floating-filter-body {
          width: 100%;
        }
        .qf-tareas-grid .ag-floating-filter-input,
        .qf-tareas-grid .ag-input-field-input {
          min-height: 2px;
          height: 6px;
          padding: 0 2px 0 18px !important;
          font-size: 8px;
          border-radius: 7px;
          border: 1px solid #9fb2c8 !important;
          background: #ffffff !important;
          color: var(--qf-navy);
          box-shadow: inset 0 0 0 1px rgba(24,95,165,.08);
        }
        .qf-tareas-grid .ag-floating-filter-body {
          position: relative;
        }
        .qf-tareas-grid .ag-floating-filter-body::before {
          content: '🔍';
          position: absolute;
          left: 5px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 11px;
          line-height: 1;
          z-index: 3;
          pointer-events: none;
          filter: saturate(1.45);
        }
        .qf-tareas-grid .ag-floating-filter-button {
          margin-left: 6px;
        }
        .qf-tareas-grid .ag-floating-filter-button-button {
          min-width: 22px;
          height: 22px;
          width: 22px;
          border-radius: 7px;
          border: 1px solid #9fb2c8;
          background: linear-gradient(135deg, #ffffff, #e8eef5);
          box-shadow: inset 0 0 0 1px rgba(24,95,165,.08);
        }
        .qf-tareas-grid .ag-floating-filter .ag-icon-search,
        .qf-tareas-grid .ag-floating-filter .ag-icon-filter,
        .qf-tareas-grid .ag-floating-filter .ag-icon {
          color: #185FA5 !important;
          font-size: 13px !important;
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
        .qf-tareas-grid .qf-right-cell {
          justify-content: flex-end !important;
          text-align: right !important;
          padding-right: 4px !important;
        }
        .qf-tareas-grid .ag-icon-filter,
        .qf-tareas-grid .ag-icon-search,
        .qf-tareas-grid .ag-icon-calendar {
          font-size: 14px;
        }
        .qf-tareas-grid .qf-center-header .ag-header-cell-label {
          justify-content: center;
        }
        .qf-tareas-grid .qf-right-header .ag-header-cell-label {
          justify-content: flex-end;
        }
      `}</style>
      <div style={S.topHeader}><h1 style={S.title}>↩ Devoluciones</h1><p style={S.subtitle}>Gestión de devoluciones bancarias</p></div>
      <div style={S.actionBar}><button className="btn btn-secondary btn-sm" onClick={() => setCompactMode(v => !v)}>{compactMode ? 'Vista cómoda' : 'Vista compacta'}</button></div>
      <div style={S.kpiGrid}>{[{ l: 'Total registros', v: total, c: 'var(--qf-navy)', b: '#2196f3' },{ l: 'Mostradas', v: data.length, c: '#185FA5', b: '#03a9f4' },{ l: 'Total cargado', v: money(metrics.totalCargado), c: '#c62828', b: '#f44336' },{ l: 'Total abonado', v: money(metrics.totalAbonado), c: '#2e7d32', b: '#4caf50' },{ l: 'Comisiones', v: money(metrics.totalComision), c: '#e65100', b: '#ff9800' },{ l: 'Pendientes', v: metrics.pendientes, c: '#5e35b1', b: '#7e57c2' }].map(s => <div key={s.l} style={{ ...S.kpiCard, borderTop: `3px solid ${s.b}` }}><div style={S.kpiLabel}>{s.l}</div><div style={{ ...S.kpiValue, color: s.c }}>{s.v}</div></div>)}</div>

      <div className="page-card" style={S.card}>
        <div style={S.stickyTools}>
          <div style={S.pagRow}>
            <span style={S.pill}>{from}-{to} de {total}</span>
            <button className="btn btn-secondary btn-sm" onClick={limpiarFiltrosTabla}>Limpiar filtros tabla</button>

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
              <option value="processed">Procesadas</option>
              <option value="errors">Errores / Rechazadas</option>
              <option value="withBank">Con banco</option>
              <option value="soles">Soles</option>
              <option value="dollars">Dólares</option>
              <option value="gerencia">Vista Gerencia</option>
              <option value="operaciones">Vista Operaciones</option>
              <option value="auditoria">Vista Auditoría</option>
            </select>

            <button className="btn btn-secondary btn-sm" onClick={exportCsv}>CSV</button>
            <button className="btn btn-secondary btn-sm" onClick={exportExcel}>Excel</button>
            <button className="btn btn-secondary btn-sm" onClick={exportPdf}>PDF</button>

            <select className="filter-input" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} style={{ width: 'auto', minWidth: 70, height: 28, fontSize: 11, padding: '0 4px' }}>
              <option value={25}>25 filas</option>
              <option value={50}>50 filas</option>
              <option value={100}>100 filas</option>
              <option value={200}>200 filas</option>
            </select>

            {canCreate && (
              <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'nuevo' })} style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                <span style={{ color: '#4CAF50', fontWeight: 800, fontSize: 16 }}>+</span> Nuevo Registro
              </button>
            )}

            {loading && <span style={S.loadMini}>...</span>}
          </div>

          <div style={S.erpTools}>
            <div style={S.erpGroup}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowSidePanel(v => !v)}>Panel</button>
              <button className="btn btn-secondary btn-sm" onClick={toggleDashboard}>{showDashboard ? 'Ocultar BI' : 'Ver BI'}</button>
              <select className="filter-input" value={groupBy} onChange={e => setGroupBy(e.target.value)} style={S.erpSelectSmall}>
                <option value="estado">Agrupar: Estado</option>
                <option value="banco">Agrupar: Banco</option>
                <option value="moneda_cargo">Agrupar: Moneda cargo</option>
                <option value="moneda_abono">Agrupar: Moneda abono</option>
                <option value="fecha">Agrupar: Fecha</option>
              </select>
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
                ['numero_operacion', 'Nro.Op.'],
                ['fecha_operacion', 'Fecha'],
                ['numero_operacion_pdf', 'Nro. Op. PDF'],
                ['created_at', 'Creado'],
                ['banco_nombre', 'Banco'],
                ['cuenta_cargo', 'Cta.cargo'],
                ['moneda_cargo_nombre', 'M Cargo'],
                ['cuenta_abono', 'Cta.abono'],
                ['moneda_abono_nombre', 'M Abono'],
                ['importe_cargado', 'Cargado'],
                ['importe_abonado', 'Abonado'],
                ['comision', 'Comisión'],
                ['referencia', 'Referencia'],
                ['estado', 'Estado'],
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
            <span><b>{liveRows.length}</b> filtradas</span>
            <span><b>{money(liveRows.reduce((s, r) => s + Number(r.importe_cargado || 0), 0))}</b> cargado</span>
            <span><b>{money(liveRows.reduce((s, r) => s + Number(r.importe_abonado || 0), 0))}</b> abonado</span>
            <span><b>{money(liveRows.reduce((s, r) => s + Number(r.comision || 0), 0))}</b> comisión</span>
            <span><b>{liveRows.filter(r => normalize(r.estado).includes('pend')).length}</b> pendientes</span>
            <span><b>{liveRows.filter(r => normalize(r.estado).includes('error') || normalize(r.estado).includes('rechaz')).length}</b> errores</span>
          </div>

          {showSidePanel && (
            <div style={S.sidePanel}>
              <div style={S.sideSection}>
                <div style={S.sideTitle}>Vistas rápidas</div>
                <button className="btn btn-secondary btn-sm" onClick={() => { setQuickPreset('gerencia'); applyColumnPreset('gerencia') }}>Gerencia</button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setQuickPreset('operaciones'); applyColumnPreset('operaciones') }}>Operaciones</button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setQuickPreset('auditoria'); applyColumnPreset('auditoria') }}>Auditoría</button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setQuickPreset('all'); applyColumnPreset('completo') }}>Completo</button>
              </div>
              <div style={S.sideSection}>
                <div style={S.sideTitle}>Exportación</div>
                <button className="btn btn-secondary btn-sm" onClick={exportCsv}>CSV filtrado</button>
                <button className="btn btn-secondary btn-sm" onClick={exportExcel}>Excel filtrado</button>
                <button className="btn btn-secondary btn-sm" onClick={exportPdf}>PDF / imprimir</button>
              </div>
              <div style={S.sideSection}>
                <div style={S.sideTitle}>Agrupación actual</div>
                {groupSummary.slice(0, 6).map(g => (
                  <div key={g.name} style={S.groupMini}><span>{g.name}</span><b>{g.count}</b></div>
                ))}
              </div>
            </div>
          )}

          {showDashboard && (
            <div style={S.dashboard}>
              <div style={S.dashPanel}>
                <div style={S.sideTitle}>Dashboard por estado</div>
                {estadoSummary.slice(0, 5).map(g => (
                  <div key={g.name} style={S.barRow}><span style={S.barLabel}>{g.name}</span><div style={S.barTrack}><div style={{ ...S.barFill, width: pct(g.count, liveRows.length) }} /></div><b style={S.barValue}>{g.count}</b></div>
                ))}
              </div>
              <div style={S.dashPanel}>
                <div style={S.sideTitle}>Dashboard por banco</div>
                {bancoSummary.slice(0, 5).map(g => (
                  <div key={g.name} style={S.barRow}><span style={S.barLabel}>{g.name}</span><div style={S.barTrack}><div style={{ ...S.barFill, width: pct(g.count, liveRows.length) }} /></div><b style={S.barValue}>{g.count}</b></div>
                ))}
              </div>
              <div style={S.dashPanel}>
                <div style={S.sideTitle}>Moneda cargo</div>
                {monedaSummary.slice(0, 5).map(g => (
                  <div key={g.name} style={S.barRow}><span style={S.barLabel}>{g.name}</span><div style={S.barTrack}><div style={{ ...S.barFill, width: pct(g.count, liveRows.length) }} /></div><b style={S.barValue}>{g.count}</b></div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div
          className="ag-theme-quartz qf-tareas-grid"
          style={{
            width: '100%',
            height: compactMode ? 'calc(100vh - 285px)' : 'calc(100vh - 345px)',
            minHeight: 310,
            '--ag-font-size': compactMode ? '10.5px' : '12px',
            '--ag-header-height': compactMode ? '35px' : '35px',
            '--ag-row-height': compactMode ? '25px' : '32px',
            '--ag-list-item-height': '22px',
            '--ag-header-column-resize-handle-height': '60%',
            '--ag-wrapper-border-radius': '0px',
          }}
        >
          {loading && data.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner dark" /></div>
          ) : (
            <AgGridReact
              rowData={agRows}
              columnDefs={agColumnDefs}
              headerHeight={35}
              floatingFiltersHeight={30}
              rowHeight={compactMode ? 25 : 32}
              defaultColDef={agDefaultColDef}
              pagination
              paginationPageSize={pageSize}
              paginationPageSizeSelector={[25, 50, 100, 200]}
              localeText={agLocaleText}
              onGridReady={params => {
                setGridApi(params.api)
                gridColumnApiRef.current = params.columnApi
                params.api.setColumnsVisible(['numero_operacion_pdf', 'created_at'], false)
                setVisibleCols(Object.fromEntries(params.api.getColumns().map(c => [c.getColId(), c.isVisible()])))
                const lastView = safeJsonParse(localStorage.getItem(GRID_VIEW_KEY), null)
                setTimeout(() => {
                  if (lastView) {
                    setQuickText(lastView.quickText || '')
                    setQuickPreset(lastView.quickPreset || 'all')
                    setGroupBy(lastView.groupBy || 'estado')
                    setShowDashboard(lastView.showDashboard ?? true)
                    setPageSize(Number(lastView.pageSize || 50))
                    params.api.setFilterModel(lastView.filterModel || null)
                    if (lastView.columnState?.length) params.api.applyColumnState({ state: lastView.columnState, applyOrder: true })
                    params.api.setGridOption?.('quickFilterText', lastView.quickText || '')
                  }
                  refreshDisplayedRows(params.api)
                }, 80)
              }}
              quickFilterText={quickText}
              animateRows
              suppressCellFocus
              onFilterChanged={params => refreshDisplayedRows(params.api)}
              onSortChanged={params => refreshDisplayedRows(params.api)}
              onColumnVisible={params => setVisibleCols(Object.fromEntries(params.api.getColumns().map(c => [c.getColId(), c.isVisible()])))}
              overlayNoRowsTemplate="<span style='padding:10px;color:#64748b;font-size:12px;'>No se encontraron devoluciones</span>"
            />
          )}
        </div>
        {!loading && <div style={S.footerCount}>{data.length} de {total} devoluciones cargadas</div>}
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

  erpTools: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap', padding: '2px 10px', background: '#fff', borderTop: '1px solid var(--qf-border)' },
  erpGroup: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  erpSearchWrap: { position: 'relative', width: 210, flexShrink: 0 },
  erpSearchIcon: { position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#8a9bb5', pointerEvents: 'none', zIndex: 1 },
  erpSearch: { width: '100%', height: 24, fontSize: 10, paddingLeft: 30 },
  erpSelect: { minWidth: 150, height: 24, fontSize: 9.5, padding: '0 22px 0 8px' },
  erpSelectSmall: { minWidth: 130, height: 24, fontSize: 9.5, padding: '0 20px 0 7px' },
  viewInput: { width: 140, height: 24, fontSize: 10 },
  columnPanel: { display: 'flex', gap: 8, flexWrap: 'wrap', padding: '6px 14px', background: '#f8fafc', borderTop: '1px solid var(--qf-border)' },
  columnCheck: { fontSize: 10.5, color: 'var(--qf-navy)', display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff', border: '1px solid var(--qf-border)', borderRadius: 999, padding: '3px 8px' },
  savedViews: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '5px 14px', background: '#fff', borderTop: '1px solid var(--qf-border)' },
  savedTitle: { fontSize: 10, color: 'var(--qf-text-light)', fontWeight: 700 },
  savedChip: { display: 'inline-flex', alignItems: 'center', border: '1px solid #9fb2c8', borderRadius: 999, overflow: 'hidden', background: '#e8eef5' },
  savedBtn: { border: 0, background: 'transparent', padding: '3px 7px', cursor: 'pointer', fontSize: 10.5, color: 'var(--qf-navy)', fontWeight: 700 },
  savedDel: { border: 0, background: '#dbe7f3', padding: '3px 6px', cursor: 'pointer', fontSize: 11, color: '#c62828', fontWeight: 900 },
  smartTotals: { display: 'flex', gap: 8, flexWrap: 'wrap', padding: '3px 10px', background: '#f8fafc', borderTop: '1px solid var(--qf-border)', color: 'var(--qf-text-light)', fontSize: 10.5 },
  sidePanel: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8, padding: '8px 10px', background: '#fff', borderTop: '1px solid var(--qf-border)' },
  sideSection: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', background: '#f8fafc', border: '1px solid var(--qf-border)', borderRadius: 8, padding: 8 },
  sideTitle: { width: '100%', fontSize: 9.5, fontWeight: 800, color: 'var(--qf-navy)', textTransform: 'uppercase', letterSpacing: 0.3 },
  groupMini: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, minWidth: 120, background: '#fff', border: '1px solid var(--qf-border)', borderRadius: 999, padding: '2px 8px', fontSize: 10, color: 'var(--qf-navy)' },
  dashboard: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, padding: '8px 10px', background: '#fff', borderTop: '1px solid var(--qf-border)' },
  dashPanel: { background: '#f8fafc', border: '1px solid var(--qf-border)', borderRadius: 8, padding: 8 },
  barRow: { display: 'grid', gridTemplateColumns: '80px 1fr 28px', alignItems: 'center', gap: 6, marginTop: 5 },
  barLabel: { fontSize: 9.5, color: 'var(--qf-text-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  barTrack: { height: 6, background: '#e8eef5', borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', background: '#185FA5', borderRadius: 999 },
  barValue: { fontSize: 10, color: 'var(--qf-navy)', textAlign: 'right' },

  filtersRow: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '0 14px 6px' },
  fieldSelect: { width: 'auto', minWidth: 120, height: 32, fontSize: 12 },
  searchInput: { minWidth: 180, maxWidth: 340, height: 32, fontSize: 12 },
  pagRow: { display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', padding: '4px 10px', background: '#f8fafc', borderTop: '1px solid var(--qf-border)' },
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
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 },
  detailBox: { background: '#f8fafc', border: '1px solid var(--qf-border)', borderRadius: 8, padding: 8 },
  detailLabel: { fontSize: 9, fontWeight: 700, color: 'var(--qf-text-light)', textTransform: 'uppercase' },
  detailValue: { fontSize: 12, fontWeight: 600, color: 'var(--qf-navy)' },
  g3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' },
  g4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' },
  errorBox: { background: '#fce4e4', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginTop: 8 },
}

export default DevolucionesPage