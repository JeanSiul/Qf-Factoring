import React, { useEffect, useState } from 'react'
import { apiCall, toArray } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'

const PAGE_SIZE = 50

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

const ModalDetalle = ({ item, onClose }) => (
  <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
    <div className="modal" style={{ maxWidth: 760 }}>
      <div className="modal-header">
        <h3>📋 Detalles factura — {factura(item)}</h3>
        <button className="modal-close" onClick={onClose}>×</button>
      </div>
      <div className="modal-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
            <div key={k} style={{ background: '#f8fafc', border: '1px solid var(--qf-border)', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--qf-text-light)', textTransform: 'uppercase' }}>{k}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--qf-navy)' }}>{v}</div>
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

  const buscar = () => {
    setPage(1)
    cargar({ page: 1 })
  }

  const limpiar = () => {
    setCampo('all')
    setBusqueda('')
    setPage(1)
    cargar({ page: 1, campo: 'all', busqueda: '' })
  }


  const handleEliminar = async (item) => {
    if (!confirm(`¿Eliminar la factura ${factura(item)}?`)) return
    try {
      const res = await apiCall('/qf/ops/billings/eliminar', {
        method: 'POST',
        body: JSON.stringify({ id: item.id })
      })
      if (!res?.success) throw new Error(res?.message || 'No se pudo eliminar')
      show('Factura eliminada')
      cargar()
    } catch (e) {
      show(e.message, 'error')
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : ((page - 1) * PAGE_SIZE) + 1
  const to = Math.min(page * PAGE_SIZE, total)

  const totalNeto = facturas.reduce((s, f) => s + Number(f.net_amount || 0), 0)
  const totalMonto = facturas.reduce((s, f) => s + Number(f.amount || 0), 0)
  const totalRegistradas = facturas.filter(f => String(f.status || '').toLowerCase().includes('registr')).length

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Montserrat', fontSize: 22, fontWeight: 700, color: 'var(--qf-navy)', marginBottom: 4 }}>🧾 Facturas</h1>
        <p style={{ color: 'var(--qf-text-light)', fontSize: 13 }}>Gestión de facturas registradas en operaciones</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Facturas', value: total, color: 'var(--qf-navy)', border: '#2196f3' },
          { label: 'Mostradas', value: facturas.length, color: '#185FA5', border: '#03a9f4' },
          { label: 'Neto pág.', value: money(totalNeto), color: '#2e7d32', border: '#4caf50' },
          { label: 'Monto pág.', value: money(totalMonto), color: '#e65100', border: '#ff9800' },
          { label: 'Registradas pág.', value: totalRegistradas, color: '#c62828', border: '#f44336' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderTop: `3px solid ${s.border}` }}>
            <div style={{ fontSize: 10, color: 'var(--qf-text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
            <div style={{ fontSize: typeof s.value === 'string' && s.value.length > 12 ? 18 : 28, fontWeight: 800, color: s.color, fontFamily: 'Montserrat', lineHeight: 1.2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="page-card">
        <div className="page-card-header">
          <h2>Lista de Facturas</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="filter-input" value={campo} onChange={e => setCampo(e.target.value)} style={{ width: 'auto', minWidth: 145 }}>
              {camposBusqueda.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <input
              className="filter-input"
              placeholder={campo === 'all' ? '🔍 Buscar...' : `🔍 ${camposBusqueda.find(f => f.value === campo)?.label || ''}...`}
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && buscar()}
              style={{ minWidth: 220 }}
            />

            <button className="btn btn-secondary btn-sm" onClick={buscar}>Filtros</button>
            <button className="btn btn-secondary btn-sm" onClick={limpiar}>Limpiar</button>
            <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'nuevo' })}>➕ Nueva Factura</button>
          </div>
        </div>

        <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--qf-border)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: 'var(--qf-text-light)' }}>
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</button>
          <span>Página <strong>{page}</strong> de <strong>{totalPages}</strong> · {from}-{to} de {total}</span>
          <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Siguiente</button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner dark" /></div>
          ) : facturas.length === 0 ? (
            <div className="empty-state"><div className="icon">🧾</div><p>No se encontraron facturas</p></div>
          ) : (
            <table className="qf-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Pagador</th>
                  <th>Número</th>
                  <th>Moneda</th>
                  <th>Importe neto</th>
                  <th>Fecha pago</th>
                  <th>Fecha desembolso</th>
                  <th>Fondo</th>
                  <th>Comercial</th>
                  <th>Bloque</th>
                  <th>Estado general</th>
                  <th>Estado operativo</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {facturas.map(f => {
                  const general = f.status || '—'
                  const operativo = estadoOperativo(f)
                  return (
                    <tr key={f.id}>
                      <td style={{ minWidth: 240, fontWeight: 500 }}>{cliente(f)}</td>
                      <td style={{ minWidth: 260 }}>{pagador(f)}</td>
                      <td style={{ minWidth: 90 }}><code style={{ background: '#e8eef5', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{factura(f)}</code></td>
                      <td>{f.currency || '—'}</td>
                      <td style={{ fontWeight: 700, color: '#2e7d32' }}>{money(f.net_amount, f.currency)}</td>
                      <td>{formatDate(f.date_payment)}</td>
                      <td>{formatDate(f.date_payout || f.date_emission)}</td>
                      <td><span style={{ background: '#e8eef5', color: 'var(--qf-navy)', borderRadius: 4, padding: '2px 8px', fontSize: 10.5, fontWeight: 600 }}>{fondo(f)}</span></td>
                      <td style={{ minWidth: 180 }}>{comercial(f)}</td>
                      <td>{f.Idbloque || '—'}</td>
                      <td><span className={`badge ${badgeClass(general)}`}>{String(general).toUpperCase()}</span></td>
                      <td><span className={`badge ${badgeClass(operativo)}`}>{String(operativo).toUpperCase()}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setModal({ type: 'detalle', data: f })} title="Detalles">📋</button>
                          <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'editar', data: f })} title="Editar">✏️</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleEliminar?.(f)} title="Eliminar">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && <div style={{ padding: '12px 24px', borderTop: '1px solid var(--qf-border)', fontSize: 12, color: 'var(--qf-text-light)' }}>{facturas.length} de {total} facturas</div>}
      </div>

      {modal?.type === 'detalle' && <ModalDetalle item={modal.data} onClose={() => setModal(null)} />}
    </div>
  )
}

export default OperacionesFacturasPage
