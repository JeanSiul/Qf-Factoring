import React, { useEffect, useMemo, useState } from 'react'
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


// ============================================================
// FACTURAS PAGE ENTERPRISE QF
// ------------------------------------------------------------
// Base preparada para:
// - AG Grid Enterprise
// - filtros flotantes
// - exportaciones
// - vistas guardadas
// - dashboard BI
// - presets
// - panel lateral
// - columnas configurables
// ============================================================

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
  const [sortField, setSortField] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const { toasts, show } = useToast()

  const cargar = async (opts = {}) => {
    const nextPage = opts.page || page
    const nextPageSize = opts.pageSize || pageSize
    const nextCampo = opts.campo ?? campo
    const nextBusqueda = opts.busqueda ?? busqueda
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('page', String(nextPage))
      qs.set('pageSize', String(nextPageSize))
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
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

  const handleSort = f => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(f); setSortDir('asc') }
  }

  const sortedFacturas = useMemo(() => {
    if (!sortField) return facturas
    return [...facturas].sort((a, b) => {
      let va = getSortValue(a, sortField)
      let vb = getSortValue(b, sortField)
      if (['net_amount', 'amount', 'date_payment', 'date_payout', 'Idbloque'].includes(sortField)) {
        return sortDir === 'asc' ? Number(va || 0) - Number(vb || 0) : Number(vb || 0) - Number(va || 0)
      }
      va = String(va || '').toLowerCase()
      vb = String(vb || '').toLowerCase()
      return va < vb ? (sortDir === 'asc' ? -1 : 1) : va > vb ? (sortDir === 'asc' ? 1 : -1) : 0
    })
  }, [facturas, sortField, sortDir])

  const si = f => sortField !== f ? ' ↕' : sortDir === 'asc' ? ' ▲' : ' ▼'

  return (
    <div className="fade-in" style={S.page}>
      <ToastContainer toasts={toasts} />
      <div style={S.topHeader}>
        <h1 style={S.title}>🧾 Facturas</h1>
        <p style={S.subtitle}>Gestión de facturas registradas en operaciones</p>
      </div>

      <div style={S.actionBar}>
        <button className="btn btn-secondary btn-sm" onClick={() => setCompactMode(v => !v)}>{compactMode ? 'Vista cómoda' : 'Vista compacta'}</button>
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
          <div style={S.cardTitleWrap}>
            <h2 style={S.cardTitle}>Lista de Facturas</h2>
            <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'nuevo' })} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: '#4CAF50', fontWeight: 800, fontSize: 16 }}>+</span> Nueva Factura
            </button>
          </div>

          <div style={S.filtersRow}>
            <select className="filter-input" value={campo} onChange={e => setCampo(e.target.value)} style={S.fieldSelect}>
              {camposBusqueda.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#8a9bb5', pointerEvents: 'none' }}>🔍</span>
              <input className="filter-input" placeholder={campo === 'all' ? 'Buscar...' : `Buscar por ${camposBusqueda.find(f => f.value === campo)?.label || ''}...`} value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ ...S.searchInput, paddingLeft: 32, width: '100%' }} />
            </div>
            <button className="btn btn-secondary btn-sm" onClick={limpiar}>Limpiar</button>
          </div>

          <div style={S.pagRow}>
            <span style={S.pill}>{from}-{to} de {total}</span>
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
          {loading && facturas.length === 0 ? <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner dark" /></div> : facturas.length === 0 ? <div className="empty-state"><div className="icon">🧾</div><p>No se encontraron facturas</p></div> : (
            <table className="qf-table" style={{ width: '100%', minWidth: 1280, tableLayout: 'auto', fontSize: compactMode ? 10.5 : 12 }}>
              <thead><tr>
                <th style={S.ths} onClick={() => handleSort('cliente')}>Cliente<span style={S.si}>{si('cliente')}</span></th>
                <th style={S.ths} onClick={() => handleSort('pagador')}>Pagador<span style={S.si}>{si('pagador')}</span></th>
                <th style={S.ths} onClick={() => handleSort('factura')}>Factura<span style={S.si}>{si('factura')}</span></th>
                <th style={S.ths} onClick={() => handleSort('currency')}>Moneda<span style={S.si}>{si('currency')}</span></th>
                <th style={{ ...S.ths, textAlign: 'right' }} onClick={() => handleSort('net_amount')}><Header2 a="Importe" b="neto" /><span style={S.si}>{si('net_amount')}</span></th>
                <th style={S.ths} onClick={() => handleSort('date_payment')}><Header2 a="Fecha" b="pago" /><span style={S.si}>{si('date_payment')}</span></th>
                <th style={S.ths} onClick={() => handleSort('date_payout')}><Header2 a="Fecha" b="desembolso" /><span style={S.si}>{si('date_payout')}</span></th>
                <th style={S.ths} onClick={() => handleSort('fondo')}>Fondo<span style={S.si}>{si('fondo')}</span></th>
                <th style={S.ths} onClick={() => handleSort('comercial')}>Comercial<span style={S.si}>{si('comercial')}</span></th>
                <th style={S.ths} onClick={() => handleSort('Idbloque')}>Bloque<span style={S.si}>{si('Idbloque')}</span></th>
                <th style={S.ths} onClick={() => handleSort('status')}><Header2 a="Estado" b="general" /><span style={S.si}>{si('status')}</span></th>
                <th style={S.ths} onClick={() => handleSort('estado_operativo')}><Header2 a="Estado" b="operativo" /><span style={S.si}>{si('estado_operativo')}</span></th>
                <th style={{ ...S.th0, textAlign: 'center' }}>Acc.</th>
              </tr></thead>
              <tbody>{sortedFacturas.map(f => {
                const general = f.status || '-'
                const operativo = estadoOperativo(f)
                const neto = Number(f.net_amount || 0)
                return (
                  <tr key={f.id} style={compactMode ? { height: 32 } : undefined}>
                    <td style={{ ...S.td, minWidth: 170, fontWeight: 700 }}>{cliente(f)}</td>
                    <td style={{ ...S.td, minWidth: 190 }}>{pagador(f)}</td>
                    <td style={{ ...S.td, minWidth: 82 }}><code style={S.opCode}>{factura(f)}</code></td>
                    <td style={{ ...S.td, minWidth: 58, fontSize: 10 }}>{f.currency || '-'}</td>
                    <td style={{ ...S.td, fontWeight: 800, color: '#2e7d32', whiteSpace: 'nowrap', textAlign: 'right', fontSize: 10.5 }}>{money(neto, f.currency)}</td>
                    <td style={{ ...S.td, minWidth: 78, fontSize: 10 }}>{formatDate(f.date_payment)}</td>
                    <td style={{ ...S.td, minWidth: 88, fontSize: 10 }}>{formatDate(f.date_payout || f.date_emission)}</td>
                    <td style={{ ...S.td, minWidth: 100 }}><span style={S.bankPill}>{fondo(f)}</span></td>
                    <td style={{ ...S.td, minWidth: 120 }}>{comercial(f)}</td>
                    <td style={{ ...S.td, minWidth: 60 }}>{f.Idbloque || '-'}</td>
                    <td style={{ ...S.td, minWidth: 104 }}><span className={`badge ${badgeClass(general)}`} style={{ fontSize: 8 }}>{String(general).toUpperCase()}</span></td>
                    <td style={{ ...S.td, minWidth: 108 }}><span className={`badge ${badgeClass(operativo)}`} style={{ fontSize: 8 }}>{String(operativo).toUpperCase()}</span></td>
                    <td style={{ ...S.td, textAlign: 'center', minWidth: 126 }}>
                      <div style={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setModal({ type: 'detalle', data: f })} style={S.aBtn}>Ver</button>
                        <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'editar', data: f })} style={S.aBtn}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(f)} style={S.aBtn}>Del</button>
                      </div>
                    </td>
                  </tr>
                )
              })}</tbody>
            </table>
          )}
        </div>
        {!loading && <div style={S.footerCount}>{facturas.length} de {total} facturas</div>}
      </div>

      {modal?.type === 'detalle' && <ModalDetalle item={modal.data} onClose={() => setModal(null)} />}
      {modal?.type === 'nuevo' && <ModalFactura onClose={() => setModal(null)} onSave={handleSave} />}
      {modal?.type === 'editar' && <ModalFactura item={modal.data} onClose={() => setModal(null)} onSave={handleSave} />}
    </div>
  )
}


// ============================================================
// ESTILOS VISUALES
// ------------------------------------------------------------
// Ajustes rápidos:
// - // KPIs superiores
  kpiGrid: KPIs
// - // Barra de paginación
  pagRow: paginación
// - // Cabeceras
  ths: cabeceras
// - // Celdas
  td: filas/celdas
// ============================================================

const S = {

  page: { paddingBottom: 12, maxWidth: '100%', overflowX: 'hidden' },
  topHeader: { marginBottom: 6 },
  title: { fontFamily: 'Montserrat', fontSize: 22, fontWeight: 800, color: 'var(--qf-navy)', marginBottom: 2 },
  subtitle: { color: 'var(--qf-text-light)', fontSize: 12 },
  actionBar: { display: 'flex', gap: 8, marginBottom: 8 },
  // KPIs superiores
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
  // Barra de paginación
  pagRow: { display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', padding: '5px 14px 7px', background: '#f8fafc', borderTop: '1px solid var(--qf-border)' },
  pageInfo: { fontSize: 11, color: 'var(--qf-text-light)', fontWeight: 600 },
  loadMini: { fontSize: 11, color: '#185FA5', fontWeight: 700 },
  th0: { position: 'sticky', top: 0, zIndex: 10, whiteSpace: 'nowrap', fontSize: 9, padding: '5px 4px' },
  // Cabeceras
  ths: { position: 'sticky', top: 0, zIndex: 10, whiteSpace: 'nowrap', fontSize: 9, padding: '5px 4px', cursor: 'pointer', userSelect: 'none' },
  si: { fontSize: 7, opacity: 0.45, marginLeft: 1 },
  // Celdas
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
