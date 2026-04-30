import React, { useState, useEffect } from 'react'
import { apiCall, toArray } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'
import { useAuth } from '../context/AuthContext'

// ── MODAL OPERACION ─────────────────────────────────────────────────────────
const ModalOperacion = ({ operacion, onClose, onSave }) => {
  const { user } = useAuth()
  const isEdit = !!operacion?.id

  const [form, setForm] = useState({
    id: operacion?.id || '',
    billing_id: operacion?.billing_id || '',
    amount: operacion?.amount || '',
    detraction: operacion?.detraction || 0,
    commission: operacion?.commission || 0,
    currency: operacion?.currency || 'Soles',
    date_emission: operacion?.date_emission ? String(operacion.date_emission).slice(0, 10) : new Date().toISOString().slice(0, 10),
    date_payment: operacion?.date_payment ? String(operacion.date_payment).slice(0, 10) : new Date().toISOString().slice(0, 10),
    partner: operacion?.partner || '',
    status: operacion?.status || 'Registrado',
    subestado: operacion?.subestado || 3,
    observaciones: operacion?.observaciones || '',
    payerId: operacion?.payerId || '',
    Cavali: operacion?.Cavali || '',
    Idbloque: operacion?.Idbloque || '',
    rate_financia: operacion?.rate_financia || 0,
    monthly_rate: operacion?.monthly_rate || 0,
    first_payment: operacion?.first_payment || 0,
    second_payment: operacion?.second_payment || 0,
    commercial: operacion?.commercial || 0,
    n_commercial_qipu: operacion?.n_commercial_qipu || 0,
    Other_dsctos: operacion?.Other_dsctos || 0,
    pdfLink: operacion?.pdfLink || '',
    xmlLink: operacion?.xmlLink || '',
    documentsustentLink: operacion?.documentsustentLink || '',
  })

  const [tab, setTab] = useState('principal')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const num = (v) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  const netAmount = () => {
    return Number((num(form.amount) - num(form.detraction) - num(form.commission) - num(form.Other_dsctos)).toFixed(2))
  }

  const daysBetween = () => {
    if (!form.date_emission || !form.date_payment) return 0
    const a = new Date(form.date_emission)
    const b = new Date(form.date_payment)
    const diff = Math.ceil((b - a) / (1000 * 60 * 60 * 24))
    return Number.isFinite(diff) ? Math.max(diff, 0) : 0
  }

  const validate = () => {
    if (!form.billing_id) return 'Billing ID es requerido'
    if (!form.amount || num(form.amount) <= 0) return 'Monto debe ser mayor a cero'
    if (!form.currency) return 'Moneda es requerida'
    if (!form.date_emission) return 'Fecha emisión es requerida'
    if (!form.date_payment) return 'Fecha pago es requerida'
    if (!form.partner) return 'Partner es requerido'
    return ''
  }

  const handleSubmit = async () => {
    const msg = validate()
    if (msg) { setError(msg); return }

    setLoading(true)
    setError('')
    try {
      const payload = {
        ...form,
        amount: num(form.amount),
        detraction: num(form.detraction),
        commission: num(form.commission),
        net_amount: netAmount(),
        n_days: daysBetween(),
        subestado: num(form.subestado),
        Idbloque: form.Idbloque === '' ? null : num(form.Idbloque),
        rate_financia: num(form.rate_financia),
        monthly_rate: num(form.monthly_rate),
        first_payment: num(form.first_payment),
        second_payment: num(form.second_payment),
        commercial: num(form.commercial),
        n_commercial_qipu: num(form.n_commercial_qipu),
        Other_dsctos: num(form.Other_dsctos),
        userId: user?.id || user?.userName || user?.username || '',
      }

      await onSave(payload)
      onClose()
    } catch (e) {
      setError(e.message || 'Error al guardar operación')
    } finally {
      setLoading(false)
    }
  }

  const money = (v) => new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num(v))

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 980, width: '94vw' }}>
        <div className="modal-header">
          <h3>{isEdit ? '✏️ Editar Operación' : '➕ Nueva Operación'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--qf-border)' }}>
            {[
              ['principal', '📌 Principal'],
              ['financiero', '💰 Financiero'],
              ['documentos', '📎 Documentos'],
            ].map(([key, label]) => (
              <button
                key={key}
                className={`btn btn-sm ${tab === key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTab(key)}
                type="button"
                style={{ marginBottom: 8 }}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'principal' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
                <div className="form-group">
                  <label className="form-label">Billing ID *</label>
                  <input className="form-control" value={form.billing_id} onChange={e => set('billing_id', e.target.value)} placeholder="131313" />
                </div>

                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <select className="form-control" value={form.status} onChange={e => set('status', e.target.value)}>
                    <option value="Registrado">Registrado</option>
                    <option value="En proceso">En proceso</option>
                    <option value="Pagado">Pagado</option>
                    <option value="Anulado">Anulado</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Subestado</label>
                  <input className="form-control" type="number" value={form.subestado} onChange={e => set('subestado', e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
                <div className="form-group">
                  <label className="form-label">Fecha emisión *</label>
                  <input className="form-control" type="date" value={form.date_emission} onChange={e => set('date_emission', e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Fecha pago *</label>
                  <input className="form-control" type="date" value={form.date_payment} onChange={e => set('date_payment', e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Días calculados</label>
                  <input className="form-control" value={daysBetween()} disabled />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <div className="form-group">
                  <label className="form-label">Partner *</label>
                  <input className="form-control" value={form.partner} onChange={e => set('partner', e.target.value)} placeholder="Latam" />
                </div>

                <div className="form-group">
                  <label className="form-label">Payer ID</label>
                  <input className="form-control" value={form.payerId} onChange={e => set('payerId', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Observaciones</label>
                <textarea className="form-control" value={form.observaciones} onChange={e => set('observaciones', e.target.value)} rows={3} />
              </div>
            </>
          )}

          {tab === 'financiero' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
                <div className="form-group">
                  <label className="form-label">Monto *</label>
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
                  <label className="form-label">Otros descuentos</label>
                  <input className="form-control" type="number" step="0.01" value={form.Other_dsctos} onChange={e => set('Other_dsctos', e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' }}>
                <div className="form-group">
                  <label className="form-label">Moneda</label>
                  <select className="form-control" value={form.currency} onChange={e => set('currency', e.target.value)}>
                    <option value="Soles">Soles</option>
                    <option value="Dólares">Dólares</option>
                    <option value="USD">USD</option>
                    <option value="PEN">PEN</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Rate financia</label>
                  <input className="form-control" type="number" step="0.01" value={form.rate_financia} onChange={e => set('rate_financia', e.target.value)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Monthly rate</label>
                  <input className="form-control" type="number" step="0.01" value={form.monthly_rate} onChange={e => set('monthly_rate', e.target.value)} />
                </div>
              </div>

              <div style={{
                background: '#f8fafc',
                border: '1px solid var(--qf-border)',
                borderRadius: 12,
                padding: 16,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
                marginBottom: 16
              }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--qf-text-light)', textTransform: 'uppercase' }}>Neto calculado</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--qf-navy)', fontFamily: 'Montserrat' }}>{money(netAmount())}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--qf-text-light)', textTransform: 'uppercase' }}>Días</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#185FA5', fontFamily: 'Montserrat' }}>{daysBetween()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--qf-text-light)', textTransform: 'uppercase' }}>Moneda</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#2e7d32', fontFamily: 'Montserrat' }}>{form.currency}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' }}>
                <div className="form-group">
                  <label className="form-label">Primer pago</label>
                  <input className="form-control" type="number" step="0.01" value={form.first_payment} onChange={e => set('first_payment', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Segundo pago</label>
                  <input className="form-control" type="number" step="0.01" value={form.second_payment} onChange={e => set('second_payment', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Commercial</label>
                  <input className="form-control" type="number" step="0.01" value={form.commercial} onChange={e => set('commercial', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">N Commercial Qipu</label>
                  <input className="form-control" type="number" step="0.01" value={form.n_commercial_qipu} onChange={e => set('n_commercial_qipu', e.target.value)} />
                </div>
              </div>
            </>
          )}

          {tab === 'documentos' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <div className="form-group">
                  <label className="form-label">PDF Link</label>
                  <input className="form-control" value={form.pdfLink} onChange={e => set('pdfLink', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">XML Link</label>
                  <input className="form-control" value={form.xmlLink} onChange={e => set('xmlLink', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Documento sustento</label>
                  <input className="form-control" value={form.documentsustentLink} onChange={e => set('documentsustentLink', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Cavali</label>
                  <input className="form-control" value={form.Cavali} onChange={e => set('Cavali', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">ID bloque</label>
                  <input className="form-control" type="number" value={form.Idbloque ?? ''} onChange={e => set('Idbloque', e.target.value)} />
                </div>
              </div>
            </>
          )}

          {error && <div style={{ background: '#fce4e4', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>⚠️ {error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <><span className="spinner" />Guardando...</> : isEdit ? '💾 Actualizar' : '➕ Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────
const OperacionesRegistrosPage = () => {
  const [operaciones, setOperaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroPartner, setFiltroPartner] = useState('todos')
  const [modal, setModal] = useState(null)
  const { toasts, show } = useToast()

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await apiCall('/qf/ops/billings/listar')
      setOperaciones(toArray(res))
    } catch (e) {
      show('Error al cargar operaciones: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const money = (v, c = 'Soles') => {
    const currency = String(c).toLowerCase().includes('dol') || String(c).toUpperCase() === 'USD' ? 'USD' : 'PEN'
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency }).format(Number(v || 0))
  }

  const handleSave = async (form) => {
    const endpoint = form.id ? '/qf/ops/billings/actualizar' : '/qf/ops/billings/crear'
    const res = await apiCall(endpoint, {
      method: 'POST',
      body: JSON.stringify(form)
    })

    if (!res?.success) throw new Error(res?.message || 'No se pudo guardar')
    show(form.id ? 'Operación actualizada' : 'Operación registrada')
    cargar()
  }

  const handleEliminar = async (op) => {
    if (!confirm(`¿Eliminar la operación ${op.billing_id}?`)) return
    try {
      const res = await apiCall('/qf/ops/billings/eliminar', {
        method: 'POST',
        body: JSON.stringify({ id: op.id })
      })
      if (!res?.success) throw new Error(res?.message || 'No se pudo eliminar')
      show('Operación eliminada')
      cargar()
    } catch (e) {
      show(e.message, 'error')
    }
  }

  const estadoStyle = {
    Registrado: { label: 'Registrado', cls: 'active' },
    'En proceso': { label: 'En proceso', cls: 'warning' },
    Pagado: { label: 'Pagado', cls: 'active' },
    Anulado: { label: 'Anulado', cls: 'inactive' },
  }

  const partners = Array.from(new Set(operaciones.map(o => o.partner).filter(Boolean))).sort()

  const filtrados = operaciones.filter(o => {
    const q = filtro.toLowerCase()
    const matchFiltro = !q ||
      String(o.billing_id || '').toLowerCase().includes(q) ||
      String(o.partner || '').toLowerCase().includes(q) ||
      String(o.status || '').toLowerCase().includes(q) ||
      String(o.observaciones || '').toLowerCase().includes(q)

    const matchEstado = filtroEstado === 'todos' || o.status === filtroEstado
    const matchPartner = filtroPartner === 'todos' || o.partner === filtroPartner

    return matchFiltro && matchEstado && matchPartner
  })

  const totalAmount = filtrados.reduce((s, o) => s + Number(o.amount || 0), 0)
  const totalNet = filtrados.reduce((s, o) => s + Number(o.net_amount || 0), 0)
  const totalCommission = filtrados.reduce((s, o) => s + Number(o.commission || 0), 0)
  const pendientes = filtrados.filter(o => o.status !== 'Pagado' && o.status !== 'Anulado').length

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Montserrat', fontSize: 22, fontWeight: 700, color: 'var(--qf-navy)', marginBottom: 4 }}>💼 Operaciones</h1>
        <p style={{ color: 'var(--qf-text-light)', fontSize: 13 }}>Registro y seguimiento de operaciones financieras</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Operaciones', value: filtrados.length, color: 'var(--qf-navy)', border: '#2196f3' },
          { label: 'Monto total', value: money(totalAmount), color: '#185FA5', border: '#03a9f4' },
          { label: 'Neto total', value: money(totalNet), color: '#2e7d32', border: '#4caf50' },
          { label: 'Comisiones', value: money(totalCommission), color: '#e65100', border: '#ff9800' },
          { label: 'Pendientes', value: pendientes, color: '#c62828', border: '#f44336' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderTop: `3px solid ${s.border}` }}>
            <div style={{ fontSize: 10, color: 'var(--qf-text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
            <div style={{ fontSize: typeof s.value === 'string' && s.value.length > 12 ? 18 : 28, fontWeight: 800, color: s.color, fontFamily: 'Montserrat', lineHeight: 1.2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="page-card">
        <div className="page-card-header">
          <h2>Registro de Operaciones</h2>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="filter-input" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ width: 'auto', minWidth: 140 }}>
              <option value="todos">Todos los estados</option>
              <option value="Registrado">Registrado</option>
              <option value="En proceso">En proceso</option>
              <option value="Pagado">Pagado</option>
              <option value="Anulado">Anulado</option>
            </select>

            <select className="filter-input" value={filtroPartner} onChange={e => setFiltroPartner(e.target.value)} style={{ width: 'auto', minWidth: 140 }}>
              <option value="todos">Todos los partners</option>
              {partners.map(p => <option key={p} value={p}>{p}</option>)}
            </select>

            <input className="filter-input" placeholder="🔍 Buscar..." value={filtro} onChange={e => setFiltro(e.target.value)} />

            <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'nuevo' })}>➕ Nueva Operación</button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner dark" /></div>
          ) : filtrados.length === 0 ? (
            <div className="empty-state"><div className="icon">💼</div><p>No se encontraron operaciones</p></div>
          ) : (
            <table className="qf-table">
              <thead>
                <tr>
                  <th>Billing</th>
                  <th>Partner</th>
                  <th>Monto</th>
                  <th>Detracción</th>
                  <th>Comisión</th>
                  <th>Neto</th>
                  <th>Moneda</th>
                  <th>Emisión</th>
                  <th>Pago</th>
                  <th>Días</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filtrados.map(o => {
                  const est = estadoStyle[o.status] || { label: o.status || '—', cls: 'inactive' }
                  return (
                    <tr key={o.id}>
                      <td><code style={{ background: '#e8eef5', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{o.billing_id}</code></td>
                      <td><span style={{ background: '#e8eef5', color: 'var(--qf-navy)', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{o.partner || '—'}</span></td>
                      <td style={{ fontWeight: 600 }}>{money(o.amount, o.currency)}</td>
                      <td>{money(o.detraction, o.currency)}</td>
                      <td>{money(o.commission, o.currency)}</td>
                      <td style={{ fontWeight: 700, color: '#2e7d32' }}>{money(o.net_amount, o.currency)}</td>
                      <td>{o.currency}</td>
                      <td style={{ fontSize: 12 }}>{o.date_emission ? String(o.date_emission).slice(0, 10) : '—'}</td>
                      <td style={{ fontSize: 12 }}>{o.date_payment ? String(o.date_payment).slice(0, 10) : '—'}</td>
                      <td>{o.n_days}</td>
                      <td><span className={`badge ${est.cls}`}>{est.label}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                          {o.pdfLink && <a className="btn btn-secondary btn-sm" href={o.pdfLink} target="_blank" rel="noreferrer" title="PDF">📄</a>}
                          <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'editar', data: o })} title="Editar">✏️</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleEliminar(o)} title="Eliminar">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && (
          <div style={{ padding: '12px 24px', borderTop: '1px solid var(--qf-border)', fontSize: 12, color: 'var(--qf-text-light)' }}>
            {filtrados.length} de {operaciones.length} operaciones
          </div>
        )}
      </div>

      {modal?.type === 'nuevo' && <ModalOperacion onClose={() => setModal(null)} onSave={handleSave} />}
      {modal?.type === 'editar' && <ModalOperacion operacion={modal.data} onClose={() => setModal(null)} onSave={handleSave} />}
    </div>
  )
}

export default OperacionesRegistrosPage
