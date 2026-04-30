import React, { useState, useEffect } from 'react'
import { apiCall, toArray } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'
import { useAuth } from '../context/AuthContext'

// ── HELPERS ────────────────────────────────────────────────────────────────
const PAGE_SIZE_OPTIONS = [25, 50, 100]

const fieldOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'billing_id', label: 'Factura' },
  { value: 'payer', label: 'Pagador' },
  { value: 'client', label: 'Cliente' },
  { value: 'Idbloque', label: 'Bloque' },
  { value: 'partner', label: 'Fondo' },
  { value: 'commercial_name', label: 'Comercial' },
  { value: 'status', label: 'Estado general' },
  { value: 'status_operativo', label: 'Estado operativo' },
]

const statusStyle = {
  Registrado: { label: 'Registrado', cls: 'active' },
  'En proceso': { label: 'En proceso', cls: 'warning' },
  Pagado: { label: 'Pagado', cls: 'active' },
  Anulado: { label: 'Anulado', cls: 'inactive' },
}

const money = (value, currency = 'Soles') => {
  const cur = String(currency || '').toLowerCase().includes('dol') || String(currency || '').toUpperCase() === 'USD'
    ? 'USD'
    : 'PEN'

  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: cur,
    minimumFractionDigits: 2,
  }).format(Number(value || 0))
}

const formatDate = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10)
  return d.toLocaleDateString('es-PE')
}

const getBillingNumber = (f) => f.billing_id || f.numero || f.number || '—'
const getClient = (f) => f.client || f.cliente || f.client_name || f.customer || f.razon_social || '—'
const getPayer = (f) => f.payer || f.pagador || f.payer_name || f.debtor || f.empresa_pagadora || '—'
const getCommercial = (f) => f.commercial_name || f.comercial || f.commercial_text || f.commercial || '—'
const getFund = (f) => f.fondo || f.fund || f.partner || '—'
const getEstadoOperativo = (f) => f.status_operativo || f.estado_operativo || f.status_f_label || f.status || '—'

// ── MODAL FACTURA ──────────────────────────────────────────────────────────
const ModalFactura = ({ factura, onClose, onSave }) => {
  const { user } = useAuth()
  const isEdit = !!factura?.id

  const [form, setForm] = useState({
    id: factura?.id || '',
    billing_id: factura?.billing_id || '',
    client: getClient(factura || {}) === '—' ? '' : getClient(factura || {}),
    payer: getPayer(factura || {}) === '—' ? '' : getPayer(factura || {}),
    amount: factura?.amount || '',
    detraction: factura?.detraction || 0,
    commission: factura?.commission || 0,
    currency: factura?.currency || 'Soles',
    date_emission: factura?.date_emission ? String(factura.date_emission).slice(0, 10) : new Date().toISOString().slice(0, 10),
    date_payment: factura?.date_payment ? String(factura.date_payment).slice(0, 10) : new Date().toISOString().slice(0, 10),
    date_payout: factura?.date_payout ? String(factura.date_payout).slice(0, 10) : '',
    partner: factura?.partner || '',
    commercial_name: getCommercial(factura || {}) === '—' ? '' : getCommercial(factura || {}),
    status: factura?.status || 'Registrado',
    status_operativo: getEstadoOperativo(factura || {}) === '—' ? 'Registrado' : getEstadoOperativo(factura || {}),
    Idbloque: factura?.Idbloque || '',
    observaciones: factura?.observaciones || '',
    pdfLink: factura?.pdfLink || '',
    xmlLink: factura?.xmlLink || '',
    documentsustentLink: factura?.documentsustentLink || '',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const num = (v) => Number.isFinite(Number(v)) ? Number(v) : 0

  const netAmount = () => Number((num(form.amount) - num(form.detraction) - num(form.commission)).toFixed(2))

  const nDays = () => {
    if (!form.date_emission || !form.date_payment) return 0
    const a = new Date(form.date_emission)
    const b = new Date(form.date_payment)
    const diff = Math.ceil((b - a) / (1000 * 60 * 60 * 24))
    return Number.isFinite(diff) ? Math.max(diff, 0) : 0
  }

  const validate = () => {
    if (!form.billing_id) return 'Número de factura es requerido'
    if (!form.client) return 'Cliente es requerido'
    if (!form.payer) return 'Pagador es requerido'
    if (!form.amount || num(form.amount) <= 0) return 'Importe debe ser mayor a cero'
    if (!form.partner) return 'Fondo es requerido'
    return ''
  }

  const handleSubmit = async () => {
    const msg = validate()
    if (msg) { setError(msg); return }

    setLoading(true)
    setError('')

    try {
      await onSave({
        ...form,
        amount: num(form.amount),
        detraction: num(form.detraction),
        commission: num(form.commission),
        net_amount: netAmount(),
        n_days: nDays(),
        Idbloque: form.Idbloque === '' ? null : num(form.Idbloque),
        userId: user?.id || user?.userName || user?.username || '',
      })
      onClose()
    } catch (e) {
      setError(e.message || 'Error al guardar factura')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 920, width: '94vw' }}>
        <div className="modal-header">
          <h3>{isEdit ? '✏️ Editar Factura' : '➕ Nueva Factura'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
            <div className="form-group">
              <label className="form-label">Número factura *</label>
              <input className="form-control" value={form.billing_id} onChange={e => set('billing_id', e.target.value)} placeholder="F001-000185" />
            </div>
            <div className="form-group">
              <label className="form-label">Moneda</label>
              <select className="form-control" value={form.currency} onChange={e => set('currency', e.target.value)}>
                <option value="Soles">Soles</option>
                <option value="Dólares">Dólares</option>
                <option value="PEN">PEN</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Bloque</label>
              <input className="form-control" type="number" value={form.Idbloque || ''} onChange={e => set('Idbloque', e.target.value)} placeholder="3279" />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <div className="form-group">
              <label className="form-label">Cliente *</label>
              <input className="form-control" value={form.client} onChange={e => set('client', e.target.value)} placeholder="CORPORACION..." />
            </div>
            <div className="form-group">
              <label className="form-label">Pagador *</label>
              <input className="form-control" value={form.payer} onChange={e => set('payer', e.target.value)} placeholder="COMPAÑÍA..." />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
            <div className="form-group">
              <label className="form-label">Importe *</label>
              <input className="form-control" type="number" step="0.01" value={form.amount} onChange={e => set('amount', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Detracción</label>
              <input className="form-control" type="number" step="0.01" value={form.detraction} onChange={e => set('detraction', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Comisión</label>
              <input className="form-control" type="number" step="0.01" value={form.commission} onChange={e => set('commission', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Importe neto</label>
              <input className="form-control" value={money(netAmount(), form.currency)} disabled />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
            <div className="form-group">
              <label className="form-label">Fecha pago</label>
              <input className="form-control" type="date" value={form.date_payment} onChange={e => set('date_payment', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha desembolso</label>
              <input className="form-control" type="date" value={form.date_payout} onChange={e => set('date_payout', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha emisión</label>
              <input className="form-control" type="date" value={form.date_emission} onChange={e => set('date_emission', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Días</label>
              <input className="form-control" value={nDays()} disabled />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0 16px' }}>
            <div className="form-group">
              <label className="form-label">Fondo *</label>
              <input className="form-control" value={form.partner} onChange={e => set('partner', e.target.value)} placeholder="Latam" />
            </div>
            <div className="form-group">
              <label className="form-label">Comercial</label>
              <input className="form-control" value={form.commercial_name} onChange={e => set('commercial_name', e.target.value)} placeholder="Nombre comercial" />
            </div>
            <div className="form-group">
              <label className="form-label">Estado general</label>
              <select className="form-control" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="Registrado">Registrado</option>
                <option value="En proceso">En proceso</option>
                <option value="Pagado">Pagado</option>
                <option value="Anulado">Anulado</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Estado operativo</label>
              <select className="form-control" value={form.status_operativo} onChange={e => set('status_operativo', e.target.value)}>
                <option value="Registrado">Registrado</option>
                <option value="Validado">Validado</option>
                <option value="Observado">Observado</option>
                <option value="Liquidado">Liquidado</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Observaciones</label>
            <textarea className="form-control" rows={2} value={form.observaciones} onChange={e => set('observaciones', e.target.value)} />
          </div>

          {error && <div style={{ background: '#fce4e4', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>⚠️ {error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <><span className="spinner" />Guardando...</> : isEdit ? '💾 Actualizar Factura' : '➕ Registrar Factura'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────
const OperacionesFacturasPage = () => {
  const [facturas, setFacturas] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [campo, setCampo] = useState('all')
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
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

      if (Array.isArray(res)) {
        setFacturas(res)
        setTotal(res.length)
      } else {
        const data = res?.data || res?.items || res?.rows || []
        setFacturas(toArray(data))
        setTotal(Number(res?.total ?? data.length))
      }
    } catch (e) {
      show('Error al cargar facturas: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize])

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

  const handleSave = async (form) => {
    const endpoint = form.id ? '/qf/ops/billings/actualizar' : '/qf/ops/billings/crear'
    const res = await apiCall(endpoint, { method: 'POST', body: JSON.stringify(form) })
    if (!res?.success) throw new Error(res?.message || 'No se pudo guardar la factura')
    show(form.id ? 'Factura actualizada' : 'Factura registrada')
    cargar()
  }

  const handleEliminar = async (factura) => {
    if (!confirm(`¿Eliminar la factura ${getBillingNumber(factura)}?`)) return

    try {
      const res = await apiCall('/qf/ops/billings/eliminar', {
        method: 'POST',
        body: JSON.stringify({ id: factura.id })
      })
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

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Montserrat', fontSize: 22, fontWeight: 700, color: 'var(--qf-navy)', marginBottom: 4 }}>🧾 Facturas</h1>
        <p style={{ color: 'var(--qf-text-light)', fontSize: 13 }}>Gestión de facturas registradas en operaciones</p>
      </div>

      <div className="page-card" style={{ marginBottom: 16 }}>
        <div style={{
          background: '#e5e5e5',
          borderBottom: '1px solid var(--qf-border)',
          padding: 12,
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <label style={{ fontStyle: 'italic', fontWeight: 600, color: '#fff', background: '#7d8790', padding: '6px 8px', borderRadius: 4 }}>
            Seleccionar
          </label>

          <select className="form-control" value={campo} onChange={e => setCampo(e.target.value)} style={{ width: 170 }}>
            {fieldOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <input
            className="form-control"
            placeholder={campo === 'all' ? 'Buscar por cualquier campo' : `Buscar por ${fieldOptions.find(f => f.value === campo)?.label || ''}`}
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buscar()}
            style={{ width: 260 }}
          />

          <button className="btn btn-secondary btn-sm" onClick={buscar}>Filtros</button>
          <button className="btn btn-secondary btn-sm" onClick={limpiar}>Limpiar</button>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <select className="form-control" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} style={{ width: 90 }}>
              {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>

            <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'nuevo' })}>
              ➕ Nueva Factura
            </button>
          </div>
        </div>

        <div style={{ padding: '10px 12px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(1)}>1</button>
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</button>
          <span style={{ fontSize: 12, color: 'var(--qf-text-light)', padding: '0 8px' }}>
            Página <strong>{page}</strong> de <strong>{totalPages}</strong> · {from}-{to} de {total}
          </span>
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
                  const estGeneral = statusStyle[f.status] || { label: f.status || '—', cls: 'inactive' }
                  const estOp = statusStyle[getEstadoOperativo(f)] || { label: getEstadoOperativo(f), cls: 'inactive' }

                  return (
                    <tr key={f.id}>
                      <td style={{ minWidth: 240, fontWeight: 500 }}>{getClient(f)}</td>
                      <td style={{ minWidth: 260 }}>{getPayer(f)}</td>
                      <td style={{ minWidth: 90 }}>
                        <div style={{ fontWeight: 700 }}>{getBillingNumber(f)}</div>
                      </td>
                      <td>{f.currency || '—'}</td>
                      <td style={{ fontWeight: 700 }}>{money(f.net_amount, f.currency)}</td>
                      <td>{formatDate(f.date_payment)}</td>
                      <td>{formatDate(f.date_payout || f.date_emission)}</td>
                      <td>{getFund(f)}</td>
                      <td style={{ minWidth: 180 }}>{getCommercial(f)}</td>
                      <td>{f.Idbloque || '—'}</td>
                      <td><span className={`badge ${estGeneral.cls}`}>{estGeneral.label}</span></td>
                      <td><span className={`badge ${estOp.cls}`}>{estOp.label}</span></td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setModal({ type: 'detalle', data: f })}>Detalles</button>
                          <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'editar', data: f })}>Editar</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleEliminar(f)}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal?.type === 'nuevo' && <ModalFactura onClose={() => setModal(null)} onSave={handleSave} />}
      {modal?.type === 'editar' && <ModalFactura factura={modal.data} onClose={() => setModal(null)} onSave={handleSave} />}
      {modal?.type === 'detalle' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <h3>Detalles factura — {getBillingNumber(modal.data)}</h3>
              <button className="modal-close" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <pre style={{ background: '#f8fafc', border: '1px solid var(--qf-border)', borderRadius: 8, padding: 12, overflowX: 'auto', fontSize: 12 }}>
                {JSON.stringify(modal.data, null, 2)}
              </pre>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OperacionesFacturasPage
