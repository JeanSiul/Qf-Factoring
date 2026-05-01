import React, { useEffect, useMemo, useState } from 'react'
import { apiCall, toArray } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'

const PAGE_SIZE = 50
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
const estadoOperativo = f => first(f, ['estado_operativo', 'status_operativo', 'status_f_label', 'status'], 'Registrado')

const badgeClass = status => {
  const s = String(status || '').toLowerCase()
  if (s.includes('confirm') || s.includes('observ')) return 'warning'
  if (s.includes('registr') || s.includes('valid') || s.includes('pag')) return 'active'
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

const MiniBar = ({ value, max }) => {
  const pct = max > 0 ? Math.min(100, Math.round((Number(value || 0) / max) * 100)) : 0
  return <div style={styles.miniBarTrack}><div style={{ ...styles.miniBarFill, width: `${pct}%` }} /></div>
}

const Header2 = ({ a, b }) => <span style={styles.twoLineHeader}><span>{a}</span><span>{b}</span></span>

const ModalDetalle = ({ item, onClose }) => (
  <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
    <div className="modal" style={{ maxWidth: 820 }}>
      <div className="modal-header">
        <h3>Detalles factura - {factura(item)}</h3>
        <button className="modal-close" onClick={onClose}>x</button>
      </div>
      <div className="modal-body">
        <div style={styles.detailGrid}>
          {[
            ['Cliente', cliente(item)], ['Pagador', pagador(item)], ['Numero', factura(item)], ['Moneda', item.currency || '-'],
            ['Importe', money(item.amount, item.currency)], ['Detraccion', money(item.detraction, item.currency)], ['Comision', money(item.commission, item.currency)], ['Importe neto', money(item.net_amount, item.currency)],
            ['Fecha pago', formatDate(item.date_payment)], ['Fecha desembolso', formatDate(item.date_payout || item.date_emission)], ['Fondo', fondo(item)], ['Comercial', comercial(item)],
            ['Bloque', item.Idbloque || '-'], ['Estado general', item.status || '-'], ['Estado operativo', estadoOperativo(item)],
          ].map(([k, v]) => (
            <div key={k} style={styles.detailBox}><div style={styles.detailLabel}>{k}</div><div style={styles.detailValue}>{v}</div></div>
          ))}
        </div>
      </div>
      <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Cerrar</button></div>
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
        <div className="modal-header"><h3>{isEdit ? 'Editar Factura' : 'Nueva Factura'}</h3><button className="modal-close" onClick={onClose}>x</button></div>
        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          <div style={styles.modalGrid3}>
            <div className="form-group"><label className="form-label">Numero factura *</label><input className="form-control" value={form.billing_id} onChange={e => set('billing_id', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Moneda</label><select className="form-control" value={form.currency} onChange={e => set('currency', e.target.value)}><option value="Soles">Soles</option><option value="Dolares">Dolares</option><option value="PEN">PEN</option><option value="USD">USD</option></select></div>
            <div className="form-group"><label className="form-label">Bloque</label><input className="form-control" type="number" value={form.Idbloque || ''} onChange={e => set('Idbloque', e.target.value)} /></div>
          </div>
          <div style={styles.modalGrid2}>
            <div className="form-group"><label className="form-label">Cliente</label><input className="form-control" value={form.cliente} onChange={e => set('cliente', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Pagador</label><input className="form-control" value={form.pagador} onChange={e => set('pagador', e.target.value)} /></div>
          </div>
          <div style={styles.modalGrid4}>
            <div className="form-group"><label className="form-label">Importe *</label><input className="form-control" type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Detraccion</label><input className="form-control" type="number" step="0.01" value={form.detraction} onChange={e => set('detraction', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Comision</label><input className="form-control" type="number" step="0.01" value={form.commission} onChange={e => set('commission', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Importe neto</label><input className="form-control" value={money(calcNet(form), form.currency)} disabled /></div>
          </div>
          <div style={styles.modalGrid4}>
            <div className="form-group"><label className="form-label">Fecha pago</label><input className="form-control" type="date" value={form.date_payment} onChange={e => set('date_payment', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Fecha desembolso</label><input className="form-control" type="date" value={form.date_payout} onChange={e => set('date_payout', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Fecha emision</label><input className="form-control" type="date" value={form.date_emission} onChange={e => set('date_emission', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Dias</label><input className="form-control" value={calcDays(form)} disabled /></div>
          </div>
          <div style={styles.modalGrid4}>
            <div className="form-group"><label className="form-label">Fondo *</label><input className="form-control" value={form.partner} onChange={e => set('partner', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Comercial</label><input className="form-control" value={form.commercial} onChange={e => set('commercial', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Estado general</label><select className="form-control" value={form.status} onChange={e => set('status', e.target.value)}><option value="Registrado">Registrado</option><option value="Confirmado">Confirmado</option><option value="En proceso">En proceso</option><option value="Pagado">Pagado</option><option value="Anulado">Anulado</option></select></div>
            <div className="form-group"><label className="form-label">Estado operativo</label><select className="form-control" value={form.estado_operativo} onChange={e => set('estado_operativo', e.target.value)}><option value="Registrado">Registrado</option><option value="Validado">Validado</option><option value="Observado">Observado</option><option value="Liquidado">Liquidado</option></select></div>
          </div>
          <div className="form-group"><label className="form-label">Observaciones</label><textarea className="form-control" rows={2} value={form.observaciones} onChange={e => set('observaciones', e.target.value)} /></div>
          {error && <div style={styles.errorBox}>Alerta: {error}</div>}
        </div>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? 'Guardando...' : isEdit ? 'Actualizar Factura' : 'Registrar Factura'}</button></div>
      </div>
    </div>
  )
}

const OperacionesFacturasPage = () => {
  const [facturas, setFacturas] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [campo, setCampo] = useState('all')
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [compactMode, setCompactMode] = useState(true)
  const { toasts, show } = useToast()

  const cargar = async (opts = {}) => {
    const nextPage = opts.page || page
    const nextCampo = opts.campo ?? campo
    const nextBusqueda = opts.busqueda ?? busqueda
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('page', String(nextPage))
      qs.set('pageSize', String(PAGE_SIZE))
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

  useEffect(() => { cargar() }, [page])

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
    if (!confirm(`Eliminar la factura ${factura(item)}?`)) return
    try {
      const res = await apiCall('/qf/ops/billings/eliminar', { method: 'POST', body: JSON.stringify({ id: item.id }) })
      if (!res?.success) throw new Error(res?.message || 'No se pudo eliminar')
      show('Factura eliminada')
      cargar()
    } catch (e) { show(e.message, 'error') }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : ((page - 1) * PAGE_SIZE) + 1
  const to = Math.min(page * PAGE_SIZE, total)
  const metrics = useMemo(() => {
    const totalNeto = facturas.reduce((s, f) => s + Number(f.net_amount || 0), 0)
    const totalMonto = facturas.reduce((s, f) => s + Number(f.amount || 0), 0)
    const registradas = facturas.filter(f => String(f.status || '').toLowerCase().includes('registr')).length
    const fondos = new Set(facturas.map(f => fondo(f)).filter(v => v && v !== '-')).size
    return { totalNeto, totalMonto, registradas, fondos }
  }, [facturas])
  const maxNeto = useMemo(() => Math.max(...facturas.map(f => Number(f.net_amount || 0)), 0), [facturas])

  return (
    <div className="fade-in" style={styles.page}>
      <ToastContainer toasts={toasts} />
      <div style={styles.topHeader}><h1 style={styles.title}>Facturas</h1><p style={styles.subtitle}>Gestion premium de facturas registradas en operaciones</p></div>
      <div style={styles.actionBar}>
        <button className="btn btn-secondary btn-sm" onClick={() => setCompactMode(v => !v)}>{compactMode ? 'Vista comoda' : 'Vista compacta'}</button>
        <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'nuevo' })}>Nueva Factura</button>
      </div>
      <div style={styles.kpiGrid}>{[
        { label: 'Total facturas', value: total, color: 'var(--qf-navy)', border: '#2196f3' },
        { label: 'Mostradas', value: facturas.length, color: '#185FA5', border: '#03a9f4' },
        { label: 'Neto pagina', value: money(metrics.totalNeto), color: '#2e7d32', border: '#4caf50' },
        { label: 'Monto pagina', value: money(metrics.totalMonto), color: '#e65100', border: '#ff9800' },
        { label: 'Registradas pag.', value: metrics.registradas, color: '#c62828', border: '#f44336' },
        { label: 'Fondos pag.', value: metrics.fondos, color: '#5e35b1', border: '#7e57c2' },
      ].map(s => <div key={s.label} style={{ ...styles.kpiCard, borderTop: `3px solid ${s.border}` }}><div style={styles.kpiLabel}>{s.label}</div><div style={{ ...styles.kpiValue, color: s.color }}>{s.value}</div></div>)}</div>
      <div className="page-card" style={styles.card}>
        <div style={styles.stickyTools}>
          <div style={styles.cardTitleWrap}><h2 style={styles.cardTitle}>Lista de Facturas</h2><span style={styles.resultPill}>{from}-{to} de {total}</span></div>
          <div style={styles.filtersRow}>
            <select className="filter-input" value={campo} onChange={e => setCampo(e.target.value)} style={styles.fieldSelect}>{camposBusqueda.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            <input className="filter-input" placeholder={campo === 'all' ? 'Buscar mientras escribes...' : `Buscar por ${camposBusqueda.find(f => f.value === campo)?.label || ''}...`} value={busqueda} onChange={e => setBusqueda(e.target.value)} style={styles.searchInput} />
            <button className="btn btn-secondary btn-sm" onClick={limpiar}>Limpiar</button>
          </div>
          <div style={styles.paginationRow}>
            <button className="btn btn-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setPage(1)}>Primera</button>
            <button className="btn btn-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</button>
            <span style={styles.pageInfo}>Pagina <strong>{page}</strong> de <strong>{totalPages}</strong></span>
            <button className="btn btn-secondary btn-sm" disabled={page >= totalPages || loading} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Siguiente</button>
            <button className="btn btn-secondary btn-sm" disabled={page >= totalPages || loading} onClick={() => setPage(totalPages)}>Ultima</button>
            {loading && <span style={styles.loadingMini}>Actualizando...</span>}
          </div>
        </div>
        <div style={{ ...styles.tableViewport, maxHeight: compactMode ? 'calc(100vh - 350px)' : 'calc(100vh - 410px)' }}>
          {loading && facturas.length === 0 ? <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner dark" /></div> : facturas.length === 0 ? <div className="empty-state"><div className="icon">DOC</div><p>No se encontraron facturas</p></div> : (
            <table className="qf-table" style={{ ...styles.table, fontSize: compactMode ? 11.5 : 12.5 }}><thead><tr>
              <th style={styles.th}>Cliente</th><th style={styles.th}>Pagador</th><th style={styles.th}>Numero</th><th style={styles.th}>Moneda</th><th style={styles.th}><Header2 a="Importe" b="neto" /></th><th style={styles.th}><Header2 a="Fecha" b="pago" /></th><th style={styles.th}><Header2 a="Fecha" b="desembolso" /></th><th style={styles.th}>Fondo</th><th style={styles.th}>Comercial</th><th style={styles.th}>Bloque</th><th style={styles.th}><Header2 a="Estado" b="general" /></th><th style={styles.th}><Header2 a="Estado" b="operativo" /></th><th style={styles.th}>Peso</th><th style={{ ...styles.th, textAlign: 'center' }}>Acciones</th>
            </tr></thead><tbody>{facturas.map(f => { const general = f.status || '-'; const operativo = estadoOperativo(f); const neto = Number(f.net_amount || 0); return (
              <tr key={f.id} style={compactMode ? styles.compactRow : undefined}>
                <td style={{ ...styles.td, minWidth: 170, fontWeight: 600 }}>{cliente(f)}</td><td style={{ ...styles.td, minWidth: 190 }}>{pagador(f)}</td><td style={{ ...styles.td, minWidth: 82 }}><code style={styles.invoiceCode}>{factura(f)}</code></td><td style={{ ...styles.td, minWidth: 58 }}>{f.currency || '-'}</td><td style={{ ...styles.td, fontWeight: 800, color: '#2e7d32', whiteSpace: 'nowrap', minWidth: 105 }}>{money(neto, f.currency)}</td><td style={{ ...styles.td, minWidth: 78 }}>{formatDate(f.date_payment)}</td><td style={{ ...styles.td, minWidth: 88 }}>{formatDate(f.date_payout || f.date_emission)}</td><td style={{ ...styles.td, minWidth: 100 }}><span style={styles.fundPill}>{fondo(f)}</span></td><td style={{ ...styles.td, minWidth: 120 }}>{comercial(f)}</td><td style={{ ...styles.td, minWidth: 60 }}>{f.Idbloque || '-'}</td><td style={{ ...styles.td, minWidth: 104 }}><span className={`badge ${badgeClass(general)}`}>{String(general).toUpperCase()}</span></td><td style={{ ...styles.td, minWidth: 108 }}><span className={`badge ${badgeClass(operativo)}`}>{String(operativo).toUpperCase()}</span></td><td style={{ ...styles.td, minWidth: 84 }}><MiniBar value={neto} max={maxNeto} /></td><td style={{ ...styles.td, textAlign: 'center', minWidth: 126 }}><div style={styles.actionButtons}><button className="btn btn-secondary btn-sm" onClick={() => setModal({ type: 'detalle', data: f })} title="Detalles">Ver</button><button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'editar', data: f })} title="Editar">Edit</button><button className="btn btn-danger btn-sm" onClick={() => handleDelete(f)} title="Eliminar">Del</button></div></td>
              </tr>)})}</tbody></table>
          )}
        </div>
        {!loading && <div style={styles.footerCount}>{facturas.length} de {total} facturas</div>}
      </div>
      {modal?.type === 'detalle' && <ModalDetalle item={modal.data} onClose={() => setModal(null)} />}
      {modal?.type === 'nuevo' && <ModalFactura onClose={() => setModal(null)} onSave={handleSave} />}
      {modal?.type === 'editar' && <ModalFactura item={modal.data} onClose={() => setModal(null)} onSave={handleSave} />}
    </div>
  )
}

const styles = {
  page: { paddingBottom: 16, maxWidth: '100%', overflowX: 'hidden' },
  topHeader: { marginBottom: 8 },
  title: { fontFamily: 'Montserrat', fontSize: 22, fontWeight: 800, color: 'var(--qf-navy)', marginBottom: 3 },
  subtitle: { color: 'var(--qf-text-light)', fontSize: 12.5 },
  actionBar: { display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 8, marginBottom: 10 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: 10, marginBottom: 14 },
  kpiCard: { background: '#fff', borderRadius: 12, padding: '9px 13px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', minHeight: 62 },
  kpiLabel: { fontSize: 9.2, color: 'var(--qf-text-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  kpiValue: { fontWeight: 850, fontFamily: 'Montserrat', lineHeight: 1.1, fontSize: 21 },
  card: { overflow: 'hidden' },
  stickyTools: { background: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottom: '1px solid var(--qf-border)' },
  cardTitleWrap: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 16px 8px' },
  cardTitle: { margin: 0, fontSize: 18, fontFamily: 'Montserrat', color: 'var(--qf-navy)' },
  resultPill: { fontSize: 11, fontWeight: 700, color: 'var(--qf-navy)', background: '#e8eef5', borderRadius: 999, padding: '4px 10px' },
  filtersRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '0 16px 8px' },
  fieldSelect: { width: 'auto', minWidth: 145, height: 36 },
  searchInput: { minWidth: 260, maxWidth: 420, height: 36 },
  paginationRow: { display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', padding: '8px 16px 10px', background: '#f8fafc', borderTop: '1px solid var(--qf-border)' },
  pageInfo: { fontSize: 12, color: 'var(--qf-text-light)', padding: '0 6px' },
  loadingMini: { fontSize: 11, color: '#185FA5', fontWeight: 700 },
  tableViewport: { overflow: 'auto', width: '100%' },
  table: { minWidth: 1280, tableLayout: 'auto' },
  th: { position: 'sticky', top: 0, zIndex: 10, whiteSpace: 'nowrap', fontSize: 10.3, padding: '8px 8px', lineHeight: 1.05 },
  td: { padding: '6px 8px', verticalAlign: 'middle', lineHeight: 1.15 },
  compactRow: { height: 38 },
  twoLineHeader: { display: 'inline-flex', flexDirection: 'column', lineHeight: 1.05 },
  invoiceCode: { background: '#e8eef5', padding: '2px 7px', borderRadius: 4, fontSize: 10.5, fontWeight: 800, color: 'var(--qf-navy)' },
  fundPill: { background: '#e8eef5', color: 'var(--qf-navy)', borderRadius: 4, padding: '2px 7px', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' },
  miniBarTrack: { height: 7, width: 70, background: '#e8eef5', borderRadius: 999, overflow: 'hidden' },
  miniBarFill: { height: '100%', background: '#2e7d32', borderRadius: 999 },
  actionButtons: { display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'nowrap' },
  footerCount: { padding: '10px 16px', borderTop: '1px solid var(--qf-border)', fontSize: 11.5, color: 'var(--qf-text-light)', background: '#fff' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 },
  detailBox: { background: '#f8fafc', border: '1px solid var(--qf-border)', borderRadius: 8, padding: 9 },
  detailLabel: { fontSize: 9.5, fontWeight: 700, color: 'var(--qf-text-light)', textTransform: 'uppercase' },
  detailValue: { fontSize: 12.5, fontWeight: 600, color: 'var(--qf-navy)' },
  modalGrid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' },
  modalGrid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' },
  modalGrid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' },
  errorBox: { background: '#fce4e4', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 13 },
}

export default OperacionesFacturasPage
