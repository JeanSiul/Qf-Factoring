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

const first = (obj, keys, fallback = '—') => {
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
  if (s.includes('registr') || s.includes('valid') || s.includes('pag')) return 'active'
  if (s.includes('proceso') || s.includes('observ')) return 'warning'
  return 'inactive'
}

const money = (value, currency = 'Soles') => {
  const cur = String(currency || '').toLowerCase().includes('dol') || String(currency || '').toUpperCase() === 'USD' ? 'USD' : 'PEN'
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(Number(value || 0))
}

const formatDate = value => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10)
  return d.toLocaleDateString('es-PE')
}

const miniBar = (value, max) => {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div style={styles.miniBarTrack}>
      <div style={{ ...styles.miniBarFill, width: `${pct}%` }} />
    </div>
  )
}

const ModalDetalle = ({ item, onClose }) => (
  <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
    <div className="modal" style={{ maxWidth: 840 }}>
      <div className="modal-header">
        <h3>📋 Detalles factura — {factura(item)}</h3>
        <button className="modal-close" onClick={onClose}>×</button>
      </div>
      <div className="modal-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {[
            ['Cliente', cliente(item)],
            ['Pagador', pagador(item)],
            ['Número', factura(item)],
            ['Moneda', item.currency || '—'],
            ['Importe', money(item.amount, item.currency)],
            ['Detracción', money(item.detraction, item.currency)],
            ['Comisión', money(item.commission, item.currency)],
            ['Importe neto', money(item.net_amount, item.currency)],
            ['Fecha pago', formatDate(item.date_payment)],
            ['Fecha desembolso', formatDate(item.date_payout || item.date_emission)],
            ['Fondo', fondo(item)],
            ['Comercial', comercial(item)],
            ['Bloque', item.Idbloque || '—'],
            ['Estado general', item.status || '—'],
            ['Estado operativo', estadoOperativo(item)],
          ].map(([k, v]) => (
            <div key={k} style={styles.detailBox}>
              <div style={styles.detailLabel}>{k}</div>
              <div style={styles.detailValue}>{v}</div>
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

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      cargar({ page: 1 })
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, campo])

  const limpiar = () => {
    setCampo('all')
    setBusqueda('')
    setPage(1)
    cargar({ page: 1, campo: 'all', busqueda: '' })
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : ((page - 1) * PAGE_SIZE) + 1
  const to = Math.min(page * PAGE_SIZE, total)

  const metrics = useMemo(() => {
    const totalNeto = facturas.reduce((s, f) => s + Number(f.net_amount || 0), 0)
    const totalMonto = facturas.reduce((s, f) => s + Number(f.amount || 0), 0)
    const registradas = facturas.filter(f => String(f.status || '').toLowerCase().includes('registr')).length
    const fondos = new Set(facturas.map(f => fondo(f)).filter(v => v && v !== '—')).size
    return { totalNeto, totalMonto, registradas, fondos }
  }, [facturas])

  const maxNeto = useMemo(() => Math.max(...facturas.map(f => Number(f.net_amount || 0)), 0), [facturas])

  return (
    <div className="fade-in" style={styles.page}>
      <ToastContainer toasts={toasts} />

      <div style={styles.topHeader}>
        <div>
          <h1 style={styles.title}>🧾 Facturas</h1>
          <p style={styles.subtitle}>Gestión premium de facturas registradas en operaciones</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setCompactMode(v => !v)}>
          {compactMode ? 'Vista cómoda' : 'Vista compacta'}
        </button>
      </div>

      <div style={styles.kpiGrid}>
        {[
          { label: 'Total facturas', value: total, color: 'var(--qf-navy)', border: '#2196f3' },
          { label: 'Mostradas', value: facturas.length, color: '#185FA5', border: '#03a9f4' },
          { label: 'Neto página', value: money(metrics.totalNeto), color: '#2e7d32', border: '#4caf50' },
          { label: 'Monto página', value: money(metrics.totalMonto), color: '#e65100', border: '#ff9800' },
          { label: 'Registradas', value: metrics.registradas, color: '#c62828', border: '#f44336' },
          { label: 'Fondos pág.', value: metrics.fondos, color: '#5e35b1', border: '#7e57c2' },
        ].map(s => (
          <div key={s.label} style={{ ...styles.kpiCard, borderTop: `3px solid ${s.border}` }}>
            <div style={styles.kpiLabel}>{s.label}</div>
            <div style={{ ...styles.kpiValue, color: s.color, fontSize: typeof s.value === 'string' && s.value.length > 12 ? 17 : 24 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="page-card" style={styles.card}>
        <div style={styles.stickyTools}>
          <div style={styles.cardTitleWrap}>
            <h2 style={styles.cardTitle}>Lista de Facturas</h2>
            <span style={styles.resultPill}>{from}-{to} de {total}</span>
          </div>

          <div style={styles.filtersRow}>
            <select className="filter-input" value={campo} onChange={e => setCampo(e.target.value)} style={styles.fieldSelect}>
              {camposBusqueda.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <input
              className="filter-input"
              placeholder={campo === 'all' ? '🔍 Buscar mientras escribes...' : `🔍 Buscar por ${camposBusqueda.find(f => f.value === campo)?.label || ''}...`}
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={styles.searchInput}
            />

            <button className="btn btn-secondary btn-sm" onClick={limpiar}>Limpiar</button>
          </div>

          <div style={styles.paginationRow}>
            <button className="btn btn-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setPage(1)}>Primera</button>
            <button className="btn btn-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</button>
            <span style={styles.pageInfo}>Página <strong>{page}</strong> de <strong>{totalPages}</strong></span>
            <button className="btn btn-secondary btn-sm" disabled={page >= totalPages || loading} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Siguiente</button>
            <button className="btn btn-secondary btn-sm" disabled={page >= totalPages || loading} onClick={() => setPage(totalPages)}>Última</button>
            {loading && <span style={styles.loadingMini}>Actualizando...</span>}
          </div>
        </div>

        <div style={{ ...styles.tableViewport, maxHeight: compactMode ? 'calc(100vh - 330px)' : 'calc(100vh - 390px)' }}>
          {loading && facturas.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner dark" /></div>
          ) : facturas.length === 0 ? (
            <div className="empty-state"><div className="icon">🧾</div><p>No se encontraron facturas</p></div>
          ) : (
            <table className="qf-table" style={{ ...styles.table, fontSize: compactMode ? 11.5 : 12.5 }}>
              <thead>
                <tr>
                  <th style={styles.th}>Cliente</th>
                  <th style={styles.th}>Pagador</th>
                  <th style={styles.th}>Número</th>
                  <th style={styles.th}>Moneda</th>
                  <th style={styles.th}>Importe neto</th>
                  <th style={styles.th}>Peso</th>
                  <th style={styles.th}>Fecha pago</th>
                  <th style={styles.th}>Fecha desembolso</th>
                  <th style={styles.th}>Fondo</th>
                  <th style={styles.th}>Comercial</th>
                  <th style={styles.th}>Bloque</th>
                  <th style={styles.th}>Estado general</th>
                  <th style={styles.th}>Estado operativo</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {facturas.map(f => {
                  const general = f.status || '—'
                  const operativo = estadoOperativo(f)
                  const neto = Number(f.net_amount || 0)

                  return (
                    <tr key={f.id} style={compactMode ? styles.compactRow : undefined}>
                      <td style={{ ...styles.td, minWidth: 210, fontWeight: 600 }}>{cliente(f)}</td>
                      <td style={{ ...styles.td, minWidth: 230 }}>{pagador(f)}</td>
                      <td style={{ ...styles.td, minWidth: 95 }}>
                        <code style={styles.invoiceCode}>{factura(f)}</code>
                      </td>
                      <td style={styles.td}>{f.currency || '—'}</td>
                      <td style={{ ...styles.td, fontWeight: 800, color: '#2e7d32', whiteSpace: 'nowrap' }}>{money(neto, f.currency)}</td>
                      <td style={{ ...styles.td, minWidth: 95 }}>{miniBar(neto, maxNeto)}</td>
                      <td style={styles.td}>{formatDate(f.date_payment)}</td>
                      <td style={styles.td}>{formatDate(f.date_payout || f.date_emission)}</td>
                      <td style={styles.td}><span style={styles.fundPill}>{fondo(f)}</span></td>
                      <td style={{ ...styles.td, minWidth: 160 }}>{comercial(f)}</td>
                      <td style={styles.td}>{f.Idbloque || '—'}</td>
                      <td style={styles.td}><span className={`badge ${badgeClass(general)}`}>{String(general).toUpperCase()}</span></td>
                      <td style={styles.td}><span className={`badge ${badgeClass(operativo)}`}>{String(operativo).toUpperCase()}</span></td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setModal({ type: 'detalle', data: f })} title="Detalles">📋</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && <div style={styles.footerCount}>{facturas.length} de {total} facturas</div>}
      </div>

      {modal?.type === 'detalle' && <ModalDetalle item={modal.data} onClose={() => setModal(null)} />}
    </div>
  )
}

const styles = {
  page: {
    paddingBottom: 16,
  },
  topHeader: {
    marginBottom: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    fontFamily: 'Montserrat',
    fontSize: 22,
    fontWeight: 800,
    color: 'var(--qf-navy)',
    marginBottom: 3,
  },
  subtitle: {
    color: 'var(--qf-text-light)',
    fontSize: 12.5,
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
    gap: 10,
    marginBottom: 14,
  },
  kpiCard: {
    background: '#fff',
    borderRadius: 12,
    padding: '10px 14px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    minHeight: 68,
  },
  kpiLabel: {
    fontSize: 9.5,
    color: 'var(--qf-text-light)',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.45,
    marginBottom: 4,
  },
  kpiValue: {
    fontWeight: 850,
    fontFamily: 'Montserrat',
    lineHeight: 1.1,
  },
  card: {
    overflow: 'visible',
  },
  stickyTools: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    background: '#fff',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottom: '1px solid var(--qf-border)',
    boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
  },
  cardTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '13px 18px 8px',
  },
  cardTitle: {
    margin: 0,
    fontSize: 18,
    fontFamily: 'Montserrat',
    color: 'var(--qf-navy)',
  },
  resultPill: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--qf-navy)',
    background: '#e8eef5',
    borderRadius: 999,
    padding: '4px 10px',
  },
  filtersRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
    padding: '0 18px 8px',
  },
  fieldSelect: {
    width: 'auto',
    minWidth: 145,
    height: 36,
  },
  searchInput: {
    minWidth: 260,
    maxWidth: 420,
    height: 36,
  },
  paginationRow: {
    display: 'flex',
    gap: 7,
    alignItems: 'center',
    flexWrap: 'wrap',
    padding: '8px 18px 10px',
    background: '#f8fafc',
    borderTop: '1px solid var(--qf-border)',
  },
  pageInfo: {
    fontSize: 12,
    color: 'var(--qf-text-light)',
    padding: '0 6px',
  },
  loadingMini: {
    fontSize: 11,
    color: '#185FA5',
    fontWeight: 700,
  },
  tableViewport: {
    overflow: 'auto',
    width: '100%',
  },
  table: {
    minWidth: 1550,
    tableLayout: 'auto',
  },
  th: {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    whiteSpace: 'nowrap',
    fontSize: 11,
    padding: '10px 10px',
  },
  td: {
    padding: '8px 10px',
    verticalAlign: 'middle',
    lineHeight: 1.25,
  },
  compactRow: {
    height: 42,
  },
  invoiceCode: {
    background: '#e8eef5',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 800,
    color: 'var(--qf-navy)',
  },
  fundPill: {
    background: '#e8eef5',
    color: 'var(--qf-navy)',
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  miniBarTrack: {
    height: 7,
    width: 78,
    background: '#e8eef5',
    borderRadius: 999,
    overflow: 'hidden',
  },
  miniBarFill: {
    height: '100%',
    background: '#2e7d32',
    borderRadius: 999,
  },
  footerCount: {
    padding: '10px 18px',
    borderTop: '1px solid var(--qf-border)',
    fontSize: 11.5,
    color: 'var(--qf-text-light)',
    background: '#fff',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  detailBox: {
    background: '#f8fafc',
    border: '1px solid var(--qf-border)',
    borderRadius: 8,
    padding: 10,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--qf-text-light)',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--qf-navy)',
  },
}

export default OperacionesFacturasPage
