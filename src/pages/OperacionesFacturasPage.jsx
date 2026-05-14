import React, { useEffect, useMemo, useRef, useState } from 'react'
import { apiCall, toArray } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'
import { AgGridReact } from 'ag-grid-react'

const DEBOUNCE_MS = 450

const camposBusqueda = [
  { value: 'all', label: 'Todos' },
  { value: 'billing_id', label: 'Factura' },
  { value: 'cliente', label: 'Cliente' },
  { value: 'pagador', label: 'Pagador' },
  { value: 'Idbloque', label: 'Bloque' },
  { value: 'partner', label: 'Fondo' },
  { value: 'commercial', label: 'Comercial' },
  { value: 'status', label: 'Estado general' },
  { value: 'status_f', label: 'Estado operativo' },
]

const first = (obj, keys, fallback = '-') => {
  for (const k of keys) {
    const v = obj?.[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return v
  }
  return fallback
}

const cliente = f => first(f, ['cliente', 'company_name', 'client', 'userId', 'operationId'])
const pagador = f => first(f, ['pagador', 'name_debtor', 'payer', 'payerId'])
const comercial = f => first(f, ['comercial', 'commercial_name', 'commercial'])
const factura = f => first(f, ['billing_id', 'numero', 'number'])
const fondo = f => first(f, ['fondo', 'fund', 'partner'])
const estadoOperativo = f => first(f, ['estado_operativo', 'status_operativo', 'status_f_label', 'status_f', 'status'], 'Registrado')

const badgeClass = status => {
  const s = String(status || '').toLowerCase()
  if (s.includes('confirm') || s.includes('observ') || s.includes('proceso') || s.includes('pendiente')) return 'warning'
  if (s.includes('registr') || s.includes('valid') || s.includes('pag') || s.includes('liquid') || s.includes('aprob')) return 'active'
  return 'inactive'
}

const money = (value, currency = 'Soles') => {
  const cur = String(currency || '').toLowerCase().includes('dol') || String(currency || '').toUpperCase() === 'USD' ? 'USD' : 'PEN'
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(Number(value || 0))
}

const formatDate = value => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10)
  return d.toLocaleDateString('es-PE')
}

const toDateInput = value => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10)
  return d.toISOString().slice(0, 10)
}

const calcNet = form => {
  const amount = Number(form.amount || 0)
  const detraction = Number(form.detraction || 0)
  const commission = Number(form.commission || 0)
  const other = Number(form.Other_dsctos || 0)
  return Number((amount - detraction - commission - other).toFixed(2))
}

const calcDays = form => {
  if (!form.date_emission || !form.date_payment) return 0
  const a = new Date(form.date_emission)
  const b = new Date(form.date_payment)
  const diff = Math.ceil((b - a) / (1000 * 60 * 60 * 24))
  return Number.isFinite(diff) ? Math.max(diff, 0) : 0
}

const getSortValue = (row, field) => {
  switch (field) {
    case 'cliente': return cliente(row)
    case 'pagador': return pagador(row)
    case 'factura': return factura(row)
    case 'fondo': return fondo(row)
    case 'comercial': return comercial(row)
    case 'estado_operativo': return estadoOperativo(row)
    case 'net_amount': return Number(row.net_amount || 0)
    case 'amount': return Number(row.amount || 0)
    case 'date_payment': return new Date(row.date_payment || 0).getTime() || 0
    case 'date_payout': return new Date(row.date_payout || row.date_emission || 0).getTime() || 0
    case 'Idbloque': return Number(row.Idbloque || 0)
    default: return row?.[field]
  }
}

const Header2 = ({ a, b }) => <span style={S.twoLineHeader}><span>{a}</span><span>{b}</span></span>

const normalize = value => String(value ?? '').toLowerCase().trim()

const dateKey = value => {
  if (!value) return ''
  const raw = String(value).trim()
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const pe = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (pe) return `${pe[3]}-${String(pe[2]).padStart(2, '0')}-${String(pe[1]).padStart(2, '0')}`
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

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

const facturaId = row => factura(row)
const facturaCliente = row => cliente(row)
const facturaPagador = row => pagador(row)
const facturaFondo = row => fondo(row)
const facturaComercial = row => comercial(row)
const facturaOperativo = row => estadoOperativo(row)

const groupFacturaLabel = (row, groupBy) => {
  if (groupBy === 'status') return row.status || 'Sin estado'
  if (groupBy === 'estado_operativo') return row.estado_operativo || 'Sin estado operativo'
  if (groupBy === 'partner') return row.partner || 'Sin fondo'
  if (groupBy === 'commercial') return row.commercial || 'Sin comercial'
  if (groupBy === 'currency') return row.currency || 'Sin moneda'
  if (groupBy === 'fecha_pago') return dateKey(row.date_payment) || 'Sin fecha'
  return 'General'
}

const buildFacturaGroupSummary = (rows, groupBy) => {
  const map = new Map()
  rows.forEach(row => {
    const key = groupFacturaLabel(row, groupBy)
    const current = map.get(key) || { name: key, count: 0, neto: 0, monto: 0, registradas: 0, observadas: 0, pagadas: 0 }
    current.count += 1
    current.neto += Number(row.net_amount || 0)
    current.monto += Number(row.amount || 0)
    const general = normalize(row.status)
    const operativo = normalize(row.estado_operativo)
    if (general.includes('registr')) current.registradas += 1
    if (operativo.includes('observ') || general.includes('observ')) current.observadas += 1
    if (general.includes('pag') || operativo.includes('liquid')) current.pagadas += 1
    map.set(key, current)
  })
  return [...map.values()].sort((a, b) => b.count - a.count)
}

const exportFacturasHtmlTable = (filename, rows) => {
  const headers = ['Cliente', 'Pagador', 'Factura', 'Moneda', 'Importe', 'Importe Neto', 'Fecha Pago', 'Fecha Desembolso', 'Fondo', 'Comercial', 'Bloque', 'Estado General', 'Estado Operativo']
  const htmlRows = rows.map(r => `<tr><td>${r.cliente || ''}</td><td>${r.pagador || ''}</td><td>${r.billing_id || ''}</td><td>${r.currency || ''}</td><td>${Number(r.amount || 0)}</td><td>${Number(r.net_amount || 0)}</td><td>${formatDate(r.date_payment)}</td><td>${formatDate(r.date_payout || r.date_emission)}</td><td>${r.partner || ''}</td><td>${r.commercial || ''}</td><td>${r.Idbloque || ''}</td><td>${r.status || ''}</td><td>${r.estado_operativo || ''}</td></tr>`).join('')
  const content = `<html><head><meta charset="utf-8" /></head><body><table border="1"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${htmlRows}</tbody></table></body></html>`
  downloadTextFile(filename, content, 'application/vnd.ms-excel;charset=utf-8;')
}

const printFacturaPdfReport = (rows, title = 'Reporte de Facturas QF') => {
  const byEstado = buildFacturaGroupSummary(rows, 'status')
  const html = `<html><head><title>${title}</title><style>body{font-family:Arial,sans-serif;color:#0f2742;padding:18px}h1{font-size:18px;margin:0 0 8px}.meta{color:#64748b;font-size:11px;margin-bottom:12px}table{width:100%;border-collapse:collapse;font-size:10px}th{background:#0f2742;color:#fff;text-align:left;padding:5px}td{border:1px solid #d9e2ec;padding:4px}.kpis{display:flex;gap:8px;margin:12px 0}.kpi{border:1px solid #d9e2ec;border-radius:8px;padding:8px;min-width:110px}.kpi b{display:block;font-size:16px;color:#185FA5}</style></head><body><h1>${title}</h1><div class="meta">Generado: ${new Date().toLocaleString('es-PE')} · Registros: ${rows.length}</div><div class="kpis"><div class="kpi"><span>Total</span><b>${rows.length}</b></div><div class="kpi"><span>Neto</span><b>${money(rows.reduce((s,r)=>s+Number(r.net_amount||0),0))}</b></div><div class="kpi"><span>Monto</span><b>${money(rows.reduce((s,r)=>s+Number(r.amount||0),0))}</b></div></div><h2 style="font-size:14px">Resumen por estado</h2><table><thead><tr><th>Estado</th><th>Cantidad</th><th>Neto</th><th>Monto</th></tr></thead><tbody>${byEstado.map(g => `<tr><td>${g.name}</td><td>${g.count}</td><td>${money(g.neto)}</td><td>${money(g.monto)}</td></tr>`).join('')}</tbody></table><h2 style="font-size:14px">Detalle</h2><table><thead><tr><th>Factura</th><th>Cliente</th><th>Pagador</th><th>Neto</th><th>Fecha pago</th><th>Estado</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.billing_id || ''}</td><td>${r.cliente || ''}</td><td>${r.pagador || ''}</td><td>${money(r.net_amount, r.currency)}</td><td>${formatDate(r.date_payment)}</td><td>${r.status || ''}</td></tr>`).join('')}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`
  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close() }
}


const ModalDetalle = ({ item, onClose }) => (
  <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
    <div className="modal" style={{ maxWidth: 820 }}>
      <div className="modal-header">
        <h3>Detalle — {factura(item)}</h3>
        <button className="modal-close" onClick={onClose}>x</button>
      </div>
      <div className="modal-body">
        <div style={S.detailGrid}>
          {[
            ['Cliente', cliente(item)],
            ['Pagador', pagador(item)],
            ['Factura', factura(item)],
            ['Moneda', item.currency || '-'],
            ['Importe', money(item.amount, item.currency)],
            ['Detraccion', money(item.detraction, item.currency)],
            ['Comision', money(item.commission, item.currency)],
            ['Importe neto', money(item.net_amount, item.currency)],
            ['Fecha pago', formatDate(item.date_payment)],
            ['Fecha desembolso', formatDate(item.date_payout || item.date_emission)],
            ['Fondo', fondo(item)],
            ['Comercial', comercial(item)],
            ['Bloque', item.Idbloque || '-'],
            ['Estado general', item.status || '-'],
            ['Estado operativo', estadoOperativo(item)],
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

const ModalFactura = ({ item, onClose, onSave }) => {
  const isEdit = !!item?.id
  const [form, setForm] = useState({
    id: item?.id || '',
    billing_id: item?.billing_id || '',
    cliente: cliente(item || {}) === '-' ? '' : cliente(item || {}),
    pagador: pagador(item || {}) === '-' ? '' : pagador(item || {}),
    amount: item?.amount || '',
    detraction: item?.detraction || 0,
    commission: item?.commission || 0,
    Other_dsctos: item?.Other_dsctos || 0,
    currency: item?.currency || 'Soles',
    date_emission: toDateInput(item?.date_emission) || new Date().toISOString().slice(0, 10),
    date_payment: toDateInput(item?.date_payment) || new Date().toISOString().slice(0, 10),
    date_payout: toDateInput(item?.date_payout),
    partner: item?.partner || (fondo(item || {}) === '-' ? '' : fondo(item || {})),
    commercial: item?.commercial || (comercial(item || {}) === '-' ? '' : comercial(item || {})),
    status: item?.status || 'Registrado',
    estado_operativo: estadoOperativo(item || {}),
    Idbloque: item?.Idbloque || '',
    observaciones: item?.observaciones || '',
    payerId: item?.payerId || '',
    userId: item?.userId || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.billing_id) return setError('Numero de factura es requerido')
    if (!form.amount || Number(form.amount) <= 0) return setError('Importe debe ser mayor a cero')
    if (!form.partner) return setError('Fondo es requerido')
    setSaving(true)
    setError('')
    try {
      await onSave({
        ...form,
        client: form.cliente,
        payer: form.pagador,
        amount: Number(form.amount || 0),
        detraction: Number(form.detraction || 0),
        commission: Number(form.commission || 0),
        Other_dsctos: Number(form.Other_dsctos || 0),
        net_amount: calcNet(form),
        n_days: calcDays(form),
        Idbloque: form.Idbloque === '' ? null : Number(form.Idbloque),
      })
      onClose()
    } catch (e) {
      setError(e.message || 'No se pudo guardar la factura')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 920, width: '94vw' }}>
        <div className="modal-header">
          <h3>{isEdit ? 'Editar Factura' : 'Nueva Factura'}</h3>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          <div style={S.g3}>
            <div className="form-group"><label className="form-label">Numero factura *</label><input className="form-control" value={form.billing_id} onChange={e => set('billing_id', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Moneda</label><select className="form-control" value={form.currency} onChange={e => set('currency', e.target.value)}><option value="Soles">Soles</option><option value="Dolares">Dolares</option><option value="PEN">PEN</option><option value="USD">USD</option></select></div>
            <div className="form-group"><label className="form-label">Bloque</label><input className="form-control" type="number" value={form.Idbloque || ''} onChange={e => set('Idbloque', e.target.value)} /></div>
          </div>
          <div style={S.g2}>
            <div className="form-group"><label className="form-label">Cliente</label><input className="form-control" value={form.cliente} onChange={e => set('cliente', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Pagador</label><input className="form-control" value={form.pagador} onChange={e => set('pagador', e.target.value)} /></div>
          </div>
          <div style={S.g4}>
            <div className="form-group"><label className="form-label">Importe *</label><input className="form-control" type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Detraccion</label><input className="form-control" type="number" step="0.01" value={form.detraction} onChange={e => set('detraction', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Comision</label><input className="form-control" type="number" step="0.01" value={form.commission} onChange={e => set('commission', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Importe neto</label><input className="form-control" value={money(calcNet(form), form.currency)} disabled /></div>
          </div>
          <div style={S.g4}>
            <div className="form-group"><label className="form-label">Fecha pago</label><input className="form-control" type="date" value={form.date_payment} onChange={e => set('date_payment', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Fecha desembolso</label><input className="form-control" type="date" value={form.date_payout} onChange={e => set('date_payout', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Fecha emision</label><input className="form-control" type="date" value={form.date_emission} onChange={e => set('date_emission', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Dias</label><input className="form-control" value={calcDays(form)} disabled /></div>
          </div>
          <div style={S.g4}>
            <div className="form-group"><label className="form-label">Fondo *</label><input className="form-control" value={form.partner} onChange={e => set('partner', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Comercial</label><input className="form-control" value={form.commercial} onChange={e => set('commercial', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Estado general</label><select className="form-control" value={form.status} onChange={e => set('status', e.target.value)}><option value="Registrado">Registrado</option><option value="Confirmado">Confirmado</option><option value="En proceso">En proceso</option><option value="Pagado">Pagado</option><option value="Anulado">Anulado</option></select></div>
            <div className="form-group"><label className="form-label">Estado operativo</label><select className="form-control" value={form.estado_operativo} onChange={e => set('estado_operativo', e.target.value)}><option value="Registrado">Registrado</option><option value="Validado">Validado</option><option value="Observado">Observado</option><option value="Liquidado">Liquidado</option></select></div>
          </div>
          <div className="form-group"><label className="form-label">Observaciones</label><textarea className="form-control" rows={2} value={form.observaciones} onChange={e => set('observaciones', e.target.value)} /></div>
          {error && <div style={S.errorBox}>⚠ {error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Guardando...' : isEdit ? 'Actualizar' : 'Registrar'}</button>
        </div>
      </div>
    </div>
  )
}

const GRID_VIEW_KEY = 'qf_facturas_grid_view_v2'
const SAVED_VIEWS_KEY = 'qf_facturas_saved_views_v2'
const DASHBOARD_KEY = 'qf_facturas_dashboard_v2'

const OperacionesFacturasPage = () => {
  const [facturas, setFacturas] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [campo, setCampo] = useState('all')
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [compactMode, setCompactMode] = useState(true)
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
  const [groupBy, setGroupBy] = useState('status')
  const [gridPageInfo, setGridPageInfo] = useState({ current: 1, total: 1 })
  const { toasts, show } = useToast()

  const cargar = async (opts = {}) => {
    const nextPage = opts.page || page
    const nextCampo = opts.campo ?? campo
    const nextBusqueda = opts.busqueda ?? busqueda
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('page', String(nextPage))
      qs.set('pageSize', String(5000))
      qs.set('field', nextCampo)
      if (nextBusqueda.trim()) qs.set('q', nextBusqueda.trim())
      const res = await apiCall(`/qf/ops/billings/listar?${qs.toString()}`)
      const data = Array.isArray(res) ? res : (res?.data || res?.items || res?.rows || [])
      setFacturas(toArray(data))
      setTotal(Number(res?.total ?? data.length))
    } catch (e) {
      show('Error al cargar facturas: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [page, pageSize])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      cargar({ page: 1 })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [busqueda, campo])

  const limpiar = () => {
    setCampo('all')
    setBusqueda('')
    setPage(1)
    cargar({ page: 1, campo: 'all', busqueda: '' })
  }

  const handleSave = async payload => {
    const endpoint = payload.id ? '/qf/ops/billings/actualizar' : '/qf/ops/billings/crear'
    const res = await apiCall(endpoint, { method: 'POST', body: JSON.stringify(payload) })
    if (!res?.success) throw new Error(res?.message || 'No se pudo guardar la factura')
    show(payload.id ? 'Factura actualizada' : 'Factura registrada')
    cargar()
  }

  const handleDelete = async item => {
    if (!confirm(`¿Eliminar ${factura(item)}?`)) return
    try {
      const res = await apiCall('/qf/ops/billings/eliminar', { method: 'POST', body: JSON.stringify({ id: item.id }) })
      if (!res?.success) throw new Error(res?.message || 'No se pudo eliminar')
      show('Factura eliminada')
      cargar()
    } catch (e) {
      show(e.message, 'error')
    }
  }

  const from = total === 0 ? 0 : ((page - 1) * pageSize) + 1
  const to = Math.min(page * pageSize, total)

  const metrics = useMemo(() => {
    const totalNeto = facturas.reduce((s, f) => s + Number(f.net_amount || 0), 0)
    const totalMonto = facturas.reduce((s, f) => s + Number(f.amount || 0), 0)
    const registradas = facturas.filter(f => String(f.status || '').toLowerCase().includes('registr')).length
    const observadas = facturas.filter(f => String(estadoOperativo(f) || '').toLowerCase().includes('observ')).length
    const fondos = new Set(facturas.map(f => fondo(f)).filter(v => v && v !== '-')).size
    return { totalNeto, totalMonto, registradas, observadas, fondos }
  }, [facturas])

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

    return facturas.filter(row => {
      const fechaPago = dateKey(row.date_payment)
      const general = normalize(row.status)
      const operativo = normalize(estadoOperativo(row))
      const moneda = normalize(row.currency)
      if (quickPreset === 'today') return fechaPago === todayIso
      if (quickPreset === 'week') return fechaPago >= weekIso && fechaPago <= todayIso
      if (quickPreset === 'month') return fechaPago >= monthIso && fechaPago < nextMonthIso
      if (quickPreset === 'registered') return general.includes('registr')
      if (quickPreset === 'confirmed') return general.includes('confirm')
      if (quickPreset === 'paid') return general.includes('pag') || operativo.includes('liquid')
      if (quickPreset === 'observed') return operativo.includes('observ') || general.includes('observ')
      if (quickPreset === 'soles') return moneda.includes('pen') || moneda.includes('sol')
      if (quickPreset === 'dollars') return moneda.includes('usd') || moneda.includes('dol')
      if (quickPreset === 'gerencia') return operativo.includes('observ') || general.includes('pend') || Number(row.net_amount || 0) >= 50000
      if (quickPreset === 'operaciones') return general.includes('registr') || general.includes('proceso') || general.includes('confirm')
      if (quickPreset === 'auditoria') return Number(row.detraction || 0) > 0 || Number(row.commission || 0) > 0 || Number(row.Other_dsctos || 0) > 0
      return true
    })
  }, [facturas, quickPreset])

  const agRows = useMemo(() => quickFilteredData.map(row => ({
    ...row,
    cliente_nombre: facturaCliente(row),
    pagador_nombre: facturaPagador(row),
    factura_numero: facturaId(row),
    fondo_nombre: facturaFondo(row),
    comercial_nombre: facturaComercial(row),
    estado_operativo: facturaOperativo(row),
  })), [quickFilteredData])

  useEffect(() => { setDisplayedRows(agRows) }, [agRows])

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
    noRowsToShow: 'No se encontraron facturas',
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

  const refreshPaginationInfo = api => {
    if (!api) return
    const totalPages = Math.max(api.paginationGetTotalPages?.() || 1, 1)
    const current = Math.min((api.paginationGetCurrentPage?.() || 0) + 1, totalPages)
    setGridPageInfo({ current, total: totalPages })
  }

  const refreshDisplayedRows = api => {
    if (!api) return
    const rows = []
    api.forEachNodeAfterFilterAndSort(node => {
      if (node?.data) rows.push(node.data)
    })
    setDisplayedRows(rows)
    refreshPaginationInfo(api)
  }

  const goGridPage = action => {
    if (!gridApi) return
    if (action === 'first') gridApi.paginationGoToFirstPage()
    if (action === 'prev') gridApi.paginationGoToPreviousPage()
    if (action === 'next') gridApi.paginationGoToNextPage()
    if (action === 'last') gridApi.paginationGoToLastPage()
    setTimeout(() => refreshPaginationInfo(gridApi), 0)
  }

  const limpiarFiltrosTabla = () => {
    if (!gridApi) return
    setQuickText('')
    gridApi.setFilterModel(null)
    gridApi.setGridOption?.('quickFilterText', '')
    gridApi.applyColumnState({
      defaultState: { sort: null },
      state: [{ colId: 'date_payment', sort: 'desc' }],
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
    setGroupBy(view.groupBy || 'status')
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
    setGroupBy('status')
    setShowDashboard(false)
    setShowSidePanel(false)
    setShowColumnPanel(false)
    setPageSize(50)
    gridApi.setFilterModel(null)
    gridApi.resetColumnState()
    gridApi.setColumnsVisible(['amount', 'detraction', 'commission', 'date_emission', 'observaciones'], false)
    gridApi.setGridOption?.('quickFilterText', '')
    localStorage.removeItem(GRID_VIEW_KEY)
    setTimeout(() => {
      setVisibleCols(Object.fromEntries(gridApi.getColumns().map(c => [c.getColId(), c.isVisible()])))
      refreshDisplayedRows(gridApi)
    }, 60)
  }

  const exportCsv = () => {
    const rows = getDisplayedRows()
    const headers = ['Cliente', 'Pagador', 'Factura', 'Moneda', 'Importe', 'Importe Neto', 'Fecha Pago', 'Fecha Desembolso', 'Fondo', 'Comercial', 'Bloque', 'Estado General', 'Estado Operativo']
    const body = rows.map(r => [
      r.cliente_nombre,
      r.pagador_nombre,
      r.factura_numero,
      r.currency,
      r.amount,
      r.net_amount,
      formatDate(r.date_payment),
      formatDate(r.date_payout || r.date_emission),
      r.fondo_nombre,
      r.comercial_nombre,
      r.Idbloque,
      r.status,
      r.estado_operativo,
    ].map(csvEscape).join(';'))
    downloadTextFile(`facturas_${new Date().toISOString().slice(0, 10)}.csv`, [headers.join(';'), ...body].join('\n'))
  }

  const exportExcel = () => {
    exportFacturasHtmlTable(`facturas_${new Date().toISOString().slice(0, 10)}.xls`, getDisplayedRows())
  }

  const exportPdf = () => {
    printFacturaPdfReport(getDisplayedRows(), 'Reporte de Facturas QF')
  }

  const applyColumnPreset = preset => {
    if (!gridApi) return
    const allCols = ['cliente_nombre', 'pagador_nombre', 'factura_numero', 'currency', 'amount', 'net_amount', 'date_payment', 'date_payout', 'date_emission', 'fondo_nombre', 'comercial_nombre', 'Idbloque', 'status', 'estado_operativo', 'detraction', 'commission', 'observaciones', 'acciones']
    const presets = {
      gerencia: ['cliente_nombre', 'factura_numero', 'net_amount', 'date_payment', 'fondo_nombre', 'status', 'estado_operativo', 'acciones'],
      operaciones: ['cliente_nombre', 'pagador_nombre', 'factura_numero', 'currency', 'net_amount', 'date_payment', 'fondo_nombre', 'status', 'acciones'],
      auditoria: ['cliente_nombre', 'factura_numero', 'amount', 'net_amount', 'detraction', 'commission', 'date_payment', 'status', 'estado_operativo', 'acciones'],
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
    { headerName: 'Cliente', field: 'cliente_nombre', width: 180, filter: 'agTextColumnFilter', cellStyle: { fontWeight: 700, color: 'var(--qf-navy)' } },
    { headerName: 'Pagador', field: 'pagador_nombre', width: 190, filter: 'agTextColumnFilter' },
    { headerName: 'Factura', field: 'factura_numero', width: 110, sort: 'desc', cellRenderer: p => <code style={S.opCode}>{p.value || '-'}</code>, filter: 'agTextColumnFilter', headerClass: 'qf-center-header' },
    { headerName: 'Moneda', field: 'currency', width: 85, filter: 'agTextColumnFilter', headerClass: 'qf-center-header' },
    { headerName: 'Importe', field: 'amount', width: 120, type: 'numericColumn', hide: true, cellStyle: { fontWeight: 800, color: '#e65100', textAlign: 'center' }, cellClass: 'qf-right-cell', valueFormatter: p => money(p.value, p.data?.currency), filter: 'agNumberColumnFilter' },
    { headerName: 'Importe Neto', field: 'net_amount', width: 125, type: 'numericColumn', cellStyle: { fontWeight: 800, color: '#2e7d32', textAlign: 'center' }, cellClass: 'qf-right-cell', valueFormatter: p => money(p.value, p.data?.currency), filter: 'agNumberColumnFilter' },
    { headerName: 'Fecha Pago', field: 'date_payment', width: 120, valueFormatter: p => formatDate(p.value), filter: 'agDateColumnFilter', headerClass: 'qf-center-header' },
    { headerName: 'Fecha Desembolso', field: 'date_payout', width: 145, valueFormatter: p => formatDate(p.value || p.data?.date_emission), filter: 'agDateColumnFilter', headerClass: 'qf-center-header' },
    { headerName: 'Fecha Emisión', field: 'date_emission', width: 130, valueFormatter: p => formatDate(p.value), filter: 'agDateColumnFilter', hide: true, headerClass: 'qf-center-header' },
    { headerName: 'Fondo', field: 'fondo_nombre', width: 130, cellRenderer: p => <span style={S.bankPill}>{p.value || '-'}</span>, filter: 'agTextColumnFilter' },
    { headerName: 'Comercial', field: 'comercial_nombre', width: 135, filter: 'agTextColumnFilter' },
    { headerName: 'Bloque', field: 'Idbloque', width: 80, filter: 'agNumberColumnFilter', headerClass: 'qf-center-header' },
    { headerName: 'Estado General', field: 'status', width: 125, cellRenderer: p => <span className={`badge ${badgeClass(p.value)}`} style={{ fontSize: 8 }}>{String(p.value || '-').toUpperCase()}</span>, filter: 'agTextColumnFilter' },
    { headerName: 'Estado Operativo', field: 'estado_operativo', width: 135, cellRenderer: p => <span className={`badge ${badgeClass(p.value)}`} style={{ fontSize: 8 }}>{String(p.value || '-').toUpperCase()}</span>, filter: 'agTextColumnFilter' },
    { headerName: 'Detracción', field: 'detraction', width: 110, type: 'numericColumn', hide: true, cellStyle: { fontWeight: 800, color: '#c62828', textAlign: 'center' }, cellClass: 'qf-right-cell', valueFormatter: p => money(p.value, p.data?.currency), filter: 'agNumberColumnFilter' },
    { headerName: 'Comisión', field: 'commission', width: 105, type: 'numericColumn', hide: true, cellStyle: { fontWeight: 800, color: '#c62828', textAlign: 'center' }, cellClass: 'qf-right-cell', valueFormatter: p => money(p.value, p.data?.currency), filter: 'agNumberColumnFilter' },
    { headerName: 'Observaciones', field: 'observaciones', minWidth: 160, flex: 1, hide: true, filter: 'agTextColumnFilter' },
    {
      headerName: 'Acciones',
      field: 'acciones',
      width: 115,
      headerClass: 'qf-center-header',
      pinned: 'right',
      sortable: false,
      filter: 'agTextColumnFilter',
      suppressMenu: true,
      floatingFilter: true,
      floatingFilterComponent: () => (
        <button className="btn btn-secondary btn-sm" style={S.floatActionBtn} onClick={() => setCompactMode(v => !v)}>
          {compactMode ? 'Vista cómoda' : 'Vista compacta'}
        </button>
      ),
      floatingFilterComponentParams: { suppressFilterButton: true },
      cellRenderer: p => (
        <div style={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setModal({ type: 'detalle', data: p.data })} style={S.aBtn}>Ver</button>
          <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'editar', data: p.data })} style={S.aBtn}>Edit</button>
          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.data)} style={S.aBtn}>Del</button>
        </div>
      ),
    },
  ], [compactMode])

  const liveRows = displayedRows.length ? displayedRows : agRows
  const groupSummary = useMemo(() => buildFacturaGroupSummary(liveRows, groupBy), [liveRows, groupBy])
  const estadoSummary = useMemo(() => buildFacturaGroupSummary(liveRows, 'status'), [liveRows])
  const fondoSummary = useMemo(() => buildFacturaGroupSummary(liveRows, 'partner'), [liveRows])
  const comercialSummary = useMemo(() => buildFacturaGroupSummary(liveRows, 'commercial'), [liveRows])

  return (
    <div className="fade-in" style={S.page}>
      <ToastContainer toasts={toasts} />
      <style>{`
        .qf-facturas-grid .ag-root-wrapper { border: 0; border-top: 1px solid var(--qf-border); font-family: Montserrat, Arial, sans-serif; }
        .qf-facturas-grid .ag-header { background: var(--qf-navy); color: #fff; border-bottom: 0; }
        .qf-facturas-grid .ag-header-cell, .qf-facturas-grid .ag-header-group-cell { background: var(--qf-navy); color: #fff; font-weight: 800; text-transform: uppercase; letter-spacing: .2px; border-right: 0; }
        .qf-facturas-grid .ag-header-cell-text { color: #fff; font-size: 8.5px; }
        .qf-facturas-grid .ag-header-cell { padding-left: 2px; padding-right: 2px; line-height: 1; }
        .qf-facturas-grid .ag-icon, .qf-facturas-grid .ag-header-icon { color: #fff; font-size: 15px; }
        .qf-facturas-grid .ag-floating-filter { background: #f8fafc; border-bottom: 1px solid var(--qf-border); min-height: 10px; }
        .qf-facturas-grid .ag-floating-filter-body { width: 100%; position: relative; }
        .qf-facturas-grid .ag-floating-filter-input, .qf-facturas-grid .ag-input-field-input { min-height: 2px; height: 6px; padding: 0 2px 0 17px !important; font-size: 8px; border-radius: 7px; border: 1px solid #9fb2c8 !important; background-color: #ffffff !important; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23185FA5' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cline x1='16.5' y1='16.5' x2='21' y2='21'/%3E%3C/svg%3E") !important; background-repeat: no-repeat !important; background-position: 4px calc(100% - 3px) !important; background-size: 10px 10px !important; color: var(--qf-navy); box-shadow: inset 0 0 0 1px rgba(24,95,165,.08); }
        .qf-facturas-grid .ag-floating-filter-button { margin-left: 6px; }
        .qf-facturas-grid .ag-floating-filter-button-button { min-width: 22px; height: 22px; width: 22px; border-radius: 7px; border: 1px solid #9fb2c8; background: linear-gradient(135deg, #ffffff, #e8eef5); box-shadow: inset 0 0 0 1px rgba(24,95,165,.08); }
        .qf-facturas-grid .ag-floating-filter .ag-icon-search, .qf-facturas-grid .ag-floating-filter .ag-icon-filter, .qf-facturas-grid .ag-floating-filter .ag-icon { color: #185FA5 !important; font-size: 13px !important; }
        .qf-facturas-grid .ag-row { border-bottom: 1px solid var(--qf-border); }
        .qf-facturas-grid .ag-row-hover { background: #f8fafc; }
        .qf-facturas-grid .ag-paging-panel { min-height: 24px; font-size: 8px; color: var(--qf-text-light); border-top: 1px solid var(--qf-border); }
        .qf-facturas-grid .ag-cell { display: flex; align-items: center; padding-top: 0 !important; padding-bottom: 0 !important; line-height: 1 !important; }
        .qf-facturas-grid .qf-right-cell { justify-content: flex-end !important; text-align: right !important; padding-right: 4px !important; }
        .qf-facturas-grid .ag-icon-filter, .qf-facturas-grid .ag-icon-search, .qf-facturas-grid .ag-icon-calendar { font-size: 14px; }
        .qf-facturas-grid .qf-center-header .ag-header-cell-label { justify-content: center; }
        .qf-facturas-grid .qf-right-header .ag-header-cell-label { justify-content: flex-end; }
        .qf-facturas-grid .ag-header-cell[col-id="date_payment"] .ag-input-field-input, .qf-facturas-grid .ag-floating-filter[col-id="date_payment"] .ag-input-field-input, .qf-facturas-grid .ag-header-cell[col-id="date_payout"] .ag-input-field-input, .qf-facturas-grid .ag-floating-filter[col-id="date_payout"] .ag-input-field-input, .qf-facturas-grid .ag-header-cell[col-id="date_emission"] .ag-input-field-input, .qf-facturas-grid .ag-floating-filter[col-id="date_emission"] .ag-input-field-input { background-image: none !important; background: #ffffff !important; padding-left: 4px !important; }
      `}</style>

      <div style={S.topHeader}>
        <h1 style={S.title}>🧾 Facturas</h1>
        <p style={S.subtitle}>Gestión de facturas registradas en operaciones</p>
      </div>

      <div style={S.kpiGrid}>
        {[
          { l: 'Total facturas', v: total, c: 'var(--qf-navy)', b: '#2196f3' },
          { l: 'Mostradas', v: facturas.length, c: '#185FA5', b: '#03a9f4' },
          { l: 'Neto página', v: money(metrics.totalNeto), c: '#2e7d32', b: '#4caf50' },
          { l: 'Monto página', v: money(metrics.totalMonto), c: '#e65100', b: '#ff9800' },
          { l: 'Registradas', v: metrics.registradas, c: '#c62828', b: '#f44336' },
          { l: 'Fondos', v: metrics.fondos, c: '#5e35b1', b: '#7e57c2' },
        ].map(s => <div key={s.l} style={{ ...S.kpiCard, borderTop: `3px solid ${s.b}` }}><div style={S.kpiLabel}>{s.l}</div><div style={{ ...S.kpiValue, color: s.c }}>{s.v}</div></div>)}
      </div>

      <div className="page-card" style={S.card}>
        <div style={S.stickyTools}>
          <div style={S.pagRow}>
            <select className="filter-input" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} style={{ width: 'auto', minWidth: 70, height: 28, fontSize: 11, padding: '0 4px' }}>
              <option value={25}>25 filas</option>
              <option value={50}>50 filas</option>
              <option value={100}>100 filas</option>
              <option value={200}>200 filas</option>
            </select>

            <div style={S.topPagination}>
              <button className="btn btn-secondary btn-sm" style={S.pageNavBtn} disabled={!gridApi || gridPageInfo.current <= 1} onClick={() => goGridPage('first')}>«</button>
              <button className="btn btn-secondary btn-sm" style={S.pageNavBtn} disabled={!gridApi || gridPageInfo.current <= 1} onClick={() => goGridPage('prev')}>‹</button>
              <span style={S.pageMini}>Pág. {gridPageInfo.current} de {gridPageInfo.total}</span>
              <button className="btn btn-secondary btn-sm" style={S.pageNavBtn} disabled={!gridApi || gridPageInfo.current >= gridPageInfo.total} onClick={() => goGridPage('next')}>›</button>
              <button className="btn btn-secondary btn-sm" style={S.pageNavBtn} disabled={!gridApi || gridPageInfo.current >= gridPageInfo.total} onClick={() => goGridPage('last')}>»</button>
            </div>

            <span style={S.pill}>{from}-{to} de {total}</span>

            <select className="filter-input" value={campo} onChange={e => setCampo(e.target.value)} style={S.erpSelectSmall}>
              {camposBusqueda.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <div style={S.erpSearchWrap}>
              <span style={S.erpSearchIcon}>🔍</span>
              <input className="filter-input" placeholder={campo === 'all' ? 'Buscar...' : `Buscar por ${camposBusqueda.find(f => f.value === campo)?.label || ''}...`} value={busqueda} onChange={e => setBusqueda(e.target.value)} style={S.erpSearch} />
            </div>

            <div style={S.erpSearchWrap}>
              <span style={S.erpSearchIcon}>🔎</span>
              <input className="filter-input" value={quickText} onChange={e => setQuickText(e.target.value)} placeholder="Búsqueda global..." style={S.erpSearch} />
            </div>

            <select className="filter-input" value={quickPreset} onChange={e => setQuickPreset(e.target.value)} style={S.erpSelect}>
              <option value="all">Vista: Todos</option>
              <option value="today">Hoy</option>
              <option value="week">Últimos 7 días</option>
              <option value="month">Este mes</option>
              <option value="registered">Registradas</option>
              <option value="confirmed">Confirmadas</option>
              <option value="paid">Pagadas / Liquidadas</option>
              <option value="observed">Observadas</option>
              <option value="soles">Soles</option>
              <option value="dollars">Dólares</option>
              <option value="gerencia">Vista Gerencia</option>
              <option value="operaciones">Vista Operaciones</option>
              <option value="auditoria">Vista Auditoría</option>
            </select>

            <button className="btn btn-secondary btn-sm" onClick={limpiar}>Limpiar</button>
            <button className="btn btn-secondary btn-sm" onClick={limpiarFiltrosTabla}>Limpiar tabla</button>
            <button className="btn btn-secondary btn-sm" onClick={resetGridView} style={S.resetInlineBtn}>Reset</button>

            <div style={S.newRecordWrap}>
              <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'nuevo' })} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: '#4CAF50', fontWeight: 800, fontSize: 16 }}>+</span> Nueva Factura
              </button>
            </div>
            {loading && <span style={S.loadMini}>...</span>}
          </div>

          <div style={S.erpTools}>
            <div style={S.erpGroup}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowSidePanel(v => !v)}>Panel</button>
              <button className="btn btn-secondary btn-sm" onClick={toggleDashboard}>{showDashboard ? 'Ocultar BI' : 'Ver BI'}</button>
              <select className="filter-input" value={groupBy} onChange={e => setGroupBy(e.target.value)} style={S.erpSelectSmall}>
                <option value="status">Agrupar: Estado general</option>
                <option value="estado_operativo">Agrupar: Estado operativo</option>
                <option value="partner">Agrupar: Fondo</option>
                <option value="commercial">Agrupar: Comercial</option>
                <option value="currency">Agrupar: Moneda</option>
                <option value="fecha_pago">Agrupar: Fecha pago</option>
              </select>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowColumnPanel(v => !v)}>Columnas</button>
              <input className="filter-input" value={viewName} onChange={e => setViewName(e.target.value)} placeholder="Nombre de vista" style={S.viewInput} />
              <button className="btn btn-primary btn-sm" onClick={() => saveCurrentView(viewName)}>Guardar vista</button>
              {savedViews.length > 0 && (
                <>
                  <span style={S.savedTitle}>Vistas guardadas:</span>
                  <div style={S.savedViewsInline}>
                    {savedViews.map(v => (
                      <span key={v.id} style={S.savedChip}>
                        <button type="button" onClick={() => applyView(v)} style={S.savedBtn}>{v.name}</button>
                        <button type="button" onClick={() => deleteView(v.id)} style={S.savedDel}>×</button>
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {showColumnPanel && (
            <div style={S.columnPanel}>
              {[
                ['cliente_nombre', 'Cliente'],
                ['pagador_nombre', 'Pagador'],
                ['factura_numero', 'Factura'],
                ['currency', 'Moneda'],
                ['amount', 'Importe'],
                ['net_amount', 'Neto'],
                ['date_payment', 'F. Pago'],
                ['date_payout', 'F. Desembolso'],
                ['date_emission', 'F. Emisión'],
                ['fondo_nombre', 'Fondo'],
                ['comercial_nombre', 'Comercial'],
                ['Idbloque', 'Bloque'],
                ['status', 'Estado'],
                ['estado_operativo', 'Estado Op.'],
                ['detraction', 'Detracción'],
                ['commission', 'Comisión'],
                ['observaciones', 'Obs.'],
                ['acciones', 'Acciones'],
              ].map(([field, label]) => (
                <label key={field} style={S.columnCheck}>
                  <input type="checkbox" checked={visibleCols[field] !== false} onChange={() => toggleColumn(field)} />
                  {label}
                </label>
              ))}
            </div>
          )}

          <div style={S.smartTotals}>
            <span><b>{liveRows.length}</b> filtradas</span>
            <span><b>{money(liveRows.reduce((s, r) => s + Number(r.net_amount || 0), 0))}</b> neto</span>
            <span><b>{money(liveRows.reduce((s, r) => s + Number(r.amount || 0), 0))}</b> monto</span>
            <span><b>{liveRows.filter(r => normalize(r.status).includes('registr')).length}</b> registradas</span>
            <span><b>{liveRows.filter(r => normalize(r.estado_operativo).includes('observ')).length}</b> observadas</span>
            <span><b>{new Set(liveRows.map(r => r.fondo_nombre).filter(v => v && v !== '-')).size}</b> fondos</span>
            <div style={S.exportTotalsGroup}>
              <button className="btn btn-secondary btn-sm" style={S.exportBtn} onClick={exportCsv}>CSV</button>
              <button className="btn btn-secondary btn-sm" style={S.exportBtn} onClick={exportExcel}>Excel</button>
              <button className="btn btn-secondary btn-sm" style={S.exportBtn} onClick={exportPdf}>PDF</button>
            </div>
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
                <div style={S.sideTitle}>Dashboard por fondo</div>
                {fondoSummary.slice(0, 5).map(g => (
                  <div key={g.name} style={S.barRow}><span style={S.barLabel}>{g.name}</span><div style={S.barTrack}><div style={{ ...S.barFill, width: pct(g.count, liveRows.length) }} /></div><b style={S.barValue}>{g.count}</b></div>
                ))}
              </div>
              <div style={S.dashPanel}>
                <div style={S.sideTitle}>Dashboard por comercial</div>
                {comercialSummary.slice(0, 5).map(g => (
                  <div key={g.name} style={S.barRow}><span style={S.barLabel}>{g.name}</span><div style={S.barTrack}><div style={{ ...S.barFill, width: pct(g.count, liveRows.length) }} /></div><b style={S.barValue}>{g.count}</b></div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div
          className="ag-theme-quartz qf-facturas-grid"
          style={{
            width: '100%',
            height: compactMode ? 'calc(100vh - 300px)' : 'calc(100vh - 355px)',
            minHeight: 310,
            '--ag-font-size': compactMode ? '10.5px' : '12px',
            '--ag-header-height': compactMode ? '35px' : '35px',
            '--ag-row-height': compactMode ? '25px' : '32px',
            '--ag-list-item-height': '22px',
            '--ag-header-column-resize-handle-height': '60%',
            '--ag-wrapper-border-radius': '0px',
            position: 'relative',
          }}
        >
          {loading && facturas.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner dark" /></div>
          ) : (
            <AgGridReact
              rowData={agRows}
              columnDefs={agColumnDefs}
              headerHeight={32}
              floatingFiltersHeight={26}
              rowHeight={compactMode ? 23 : 28}
              defaultColDef={agDefaultColDef}
              pagination
              suppressPaginationPanel={true}
              paginationPageSize={pageSize}
              paginationPageSizeSelector={[25, 50, 100, 200]}
              localeText={agLocaleText}
              onGridReady={params => {
                setGridApi(params.api)
                gridColumnApiRef.current = params.columnApi
                params.api.setColumnsVisible(['amount', 'detraction', 'commission', 'date_emission', 'observaciones'], false)
                setVisibleCols(Object.fromEntries(params.api.getColumns().map(c => [c.getColId(), c.isVisible()])))
                const lastView = safeJsonParse(localStorage.getItem(GRID_VIEW_KEY), null)
                setTimeout(() => {
                  if (lastView) {
                    setQuickText(lastView.quickText || '')
                    setQuickPreset(lastView.quickPreset || 'all')
                    setGroupBy(lastView.groupBy || 'status')
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
              onPaginationChanged={params => refreshPaginationInfo(params.api)}
              onColumnVisible={params => setVisibleCols(Object.fromEntries(params.api.getColumns().map(c => [c.getColId(), c.isVisible()]))) }
              overlayNoRowsTemplate="<span style='padding:10px;color:#64748b;font-size:12px;'>No se encontraron facturas</span>"
            />
          )}
        </div>
      </div>

      {modal?.type === 'detalle' && <ModalDetalle item={modal.data} onClose={() => setModal(null)} />}
      {modal?.type === 'nuevo' && <ModalFactura onClose={() => setModal(null)} onSave={handleSave} />}
      {modal?.type === 'editar' && <ModalFactura item={modal.data} onClose={() => setModal(null)} onSave={handleSave} />}
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
  topPagination: { display: 'flex', alignItems: 'center', gap: 3, background: '#e8eef5', borderRadius: 999, padding: '2px 5px', border: '1px solid #c9d7e6' },
  pageMini: { fontSize: 10, fontWeight: 800, color: 'var(--qf-navy)', minWidth: 72, textAlign: 'center' },
  pageNavBtn: { minWidth: 22, height: 22, padding: '0 6px', borderRadius: 999, fontWeight: 900 },
  resetInlineBtn: { minWidth: 54, height: 24, padding: '0 8px', textTransform: 'uppercase', fontSize: 10, fontWeight: 800 },
  newRecordWrap: { marginLeft: 'auto', display: 'flex', justifyContent: 'flex-end', flexShrink: 0, minWidth: 150 },
  floatActionBtn: { height: 21, padding: '0 4px', fontSize: 8, borderRadius: 6, whiteSpace: 'nowrap', minWidth: 70, display: 'block', margin: '0 auto', textAlign: 'center' },
  exportTotalsGroup: { marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexShrink: 0 },
  exportBtn: { height: 24, padding: '0 10px', fontSize: 10, borderRadius: 8, fontWeight: 700 },
  erpTools: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'nowrap', padding: '2px 10px', background: '#fff', borderTop: '1px solid var(--qf-border)', width: '100%' },
  erpGroup: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 },
  erpSearchWrap: { position: 'relative', width: 210, flexShrink: 0 },
  erpSearchIcon: { position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#8a9bb5', pointerEvents: 'none', zIndex: 1 },
  erpSearch: { width: '100%', height: 24, fontSize: 10, paddingLeft: 30 },
  erpSelect: { minWidth: 170, height: 24, fontSize: 9.5, padding: '0 22px 0 8px' },
  erpSelectSmall: { minWidth: 130, height: 24, fontSize: 9.5, padding: '0 20px 0 7px' },
  viewInput: { width: 140, height: 24, fontSize: 10 },
  columnPanel: { display: 'flex', gap: 8, flexWrap: 'wrap', padding: '6px 14px', background: '#f8fafc', borderTop: '1px solid var(--qf-border)' },
  columnCheck: { fontSize: 10.5, color: 'var(--qf-navy)', display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff', border: '1px solid var(--qf-border)', borderRadius: 999, padding: '3px 8px' },
  savedViews: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '5px 14px', background: '#fff', borderTop: '1px solid var(--qf-border)' },
  savedViewsInline: { display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' },
  savedTitle: { fontSize: 10, color: 'var(--qf-text-light)', fontWeight: 800, whiteSpace: 'nowrap' },
  savedChip: { display: 'inline-flex', alignItems: 'center', border: '1px solid #9fb2c8', borderRadius: 999, overflow: 'hidden', background: '#e8eef5' },
  savedBtn: { border: 0, background: 'transparent', padding: '3px 7px', cursor: 'pointer', fontSize: 10.5, color: 'var(--qf-navy)', fontWeight: 700 },
  savedDel: { border: 0, background: '#dbe7f3', padding: '3px 6px', cursor: 'pointer', fontSize: 11, color: '#c62828', fontWeight: 900 },
  smartTotals: { display: 'flex', gap: 8, flexWrap: 'nowrap', alignItems: 'center', padding: '3px 10px', background: '#f8fafc', borderTop: '1px solid var(--qf-border)', color: 'var(--qf-text-light)', fontSize: 10.5, width: '100%' },
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
  pagRow: { display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'nowrap', padding: '3px 10px', background: '#f8fafc', borderTop: '1px solid var(--qf-border)', width: '100%' },
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
  g2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' },
  g3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' },
  g4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' },
  errorBox: { background: '#fce4e4', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginTop: 8 },
  twoLineHeader: { display: 'inline-flex', flexDirection: 'column', lineHeight: 1.05 },
}

export default OperacionesFacturasPage
