import React, { useEffect, useMemo, useState } from 'react'
import { apiCall, toArray } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'
import { useAuth } from '../context/AuthContext'

// ── Claim para este módulo ──────────────────────────────
// OPEDEV → bit 0: Vista, 1: Lista, 2: Crear, 3: Ver, 4: Modificar, 5: Eliminar
const CLAIM = 'OPEDEV'

const PAGE_SIZE = 50
const DEBOUNCE_MS = 450

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

// ── Helpers ──────────────────────────────────────────────

const money = (value, currency = 'PEN') => {
  const cur = String(currency || '').toUpperCase() === 'USD' || String(currency || '').toLowerCase().includes('dol') ? 'USD' : 'PEN'
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

const badgeClass = status => {
  const s = String(status || '').toLowerCase()
  if (s.includes('pendiente') || s.includes('proceso')) return 'warning'
  if (s.includes('completado') || s.includes('exitoso') || s.includes('procesado')) return 'active'
  if (s.includes('error') || s.includes('rechazado') || s.includes('fallido')) return 'inactive'
  return 'warning'
}

const MiniBar = ({ value, max }) => {
  const pct = max > 0 ? Math.min(100, Math.round((Number(value || 0) / max) * 100)) : 0
  return <div style={styles.miniBarTrack}><div style={{ ...styles.miniBarFill, width: `${pct}%` }} /></div>
}

// ── Lookup helpers (bancos y monedas) ───────────────────
// n8n puede devolver campos en cualquier case, estas helpers normalizan

const getField = (obj, ...names) => {
  for (const n of names) {
    if (obj[n] !== undefined) return obj[n]
    if (obj[n.toLowerCase()] !== undefined) return obj[n.toLowerCase()]
    if (obj[n.toUpperCase()] !== undefined) return obj[n.toUpperCase()]
  }
  return undefined
}

const getBancoNombre = (bancoId, bancos) => {
  if (!bancoId) return '-'
  const b = bancos.find(x => String(getField(x, 'id', 'ID')) === String(bancoId))
  return b ? (getField(b, 'name', 'Name', 'NAME') || bancoId) : bancoId
}

const getMonedaNombre = (monedaId, monedas) => {
  if (!monedaId) return '-'
  const m = monedas.find(x => String(getField(x, 'ID', 'id')) === String(monedaId))
  if (!m) return monedaId
  return getField(m, 'CODIGO', 'codigo', 'Codigo') || getField(m, 'DESCRIPCION', 'descripcion') || monedaId
}

const getMonedaCodigo = (monedaId, monedas) => {
  if (!monedaId) return 'PEN'
  const m = monedas.find(x => String(getField(x, 'ID', 'id')) === String(monedaId))
  if (!m) return 'PEN'
  return getField(m, 'VALORTEXTO', 'valortexto', 'ValorTexto') || 'PEN'
}

// ── Modal Detalle ───────────────────────────────────────

const ModalDetalle = ({ item, bancos, monedas, onClose }) => (
  <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
    <div className="modal" style={{ maxWidth: 820 }}>
      <div className="modal-header">
        <h3>Detalle devolución — {item.numero_operacion || item.id}</h3>
        <button className="modal-close" onClick={onClose}>x</button>
      </div>
      <div className="modal-body">
        <div style={styles.detailGrid}>
          {[
            ['Nro. Operación', item.numero_operacion || '-'],
            ['Nro. Operación PDF', item.numero_operacion_pdf || '-'],
            ['Archivo', item.archivo || '-'],
            ['Fecha operación', formatDate(item.fecha_operacion)],
            ['Banco', getBancoNombre(item.banco, bancos)],
            ['Cuenta cargo', item.cuenta_cargo || '-'],
            ['Cuenta abono', item.cuenta_abono || '-'],
            ['Moneda cargo', getMonedaNombre(item.moneda_cargo, monedas)],
            ['Moneda abono', getMonedaNombre(item.moneda_abono, monedas)],
            ['Importe cargado', money(item.importe_cargado, getMonedaCodigo(item.moneda_cargo, monedas))],
            ['Importe abonado', money(item.importe_abonado, getMonedaCodigo(item.moneda_abono, monedas))],
            ['Comisión', money(item.comision, getMonedaCodigo(item.moneda_cargo, monedas))],
            ['Referencia', item.referencia || '-'],
            ['Estado', item.estado || '-'],
            ['Mensaje', item.mensaje || '-'],
            ['Fecha log', formatDate(item.fecha_log)],
            ['Creado', formatDate(item.created_at)],
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

// ── Modal Crear / Editar ────────────────────────────────

const ModalDevolucion = ({ item, bancos, monedas, onClose, onSave }) => {
  const isEdit = !!item?.id
  const [form, setForm] = useState({
    id: item?.id || '',
    archivo: item?.archivo || '',
    numero_operacion: item?.numero_operacion || '',
    numero_operacion_pdf: item?.numero_operacion_pdf || '',
    fecha_operacion: toDateInput(item?.fecha_operacion) || new Date().toISOString().slice(0, 10),
    importe_cargado: item?.importe_cargado || '',
    importe_abonado: item?.importe_abonado || '',
    comision: item?.comision || 0,
    cuenta_cargo: item?.cuenta_cargo || '',
    cuenta_abono: item?.cuenta_abono || '',
    banco: item?.banco || '',
    moneda_cargo: item?.moneda_cargo || '',
    moneda_abono: item?.moneda_abono || '',
    referencia: item?.referencia || '',
    estado: item?.estado || 'Pendiente',
    mensaje: item?.mensaje || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.numero_operacion) return setError('Número de operación es requerido')
    if (!form.importe_cargado || Number(form.importe_cargado) <= 0) return setError('Importe cargado debe ser mayor a cero')
    if (!form.banco) return setError('Banco es requerido')
    setSaving(true)
    setError('')
    try {
      await onSave({
        ...form,
        importe_cargado: Number(form.importe_cargado || 0),
        importe_abonado: Number(form.importe_abonado || 0),
        comision: Number(form.comision || 0),
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
          <h3>{isEdit ? 'Editar Devolución' : 'Nueva Devolución'}</h3>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          {/* Fila 1: Operación */}
          <div style={styles.modalGrid3}>
            <div className="form-group">
              <label className="form-label">Nro. Operación *</label>
              <input className="form-control" value={form.numero_operacion} onChange={e => set('numero_operacion', e.target.value)} maxLength={10} />
            </div>
            <div className="form-group">
              <label className="form-label">Nro. Operación PDF</label>
              <input className="form-control" value={form.numero_operacion_pdf} onChange={e => set('numero_operacion_pdf', e.target.value)} maxLength={20} />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha operación</label>
              <input className="form-control" type="date" value={form.fecha_operacion} onChange={e => set('fecha_operacion', e.target.value)} />
            </div>
          </div>

          {/* Fila 2: Banco y archivo */}
          <div style={styles.modalGrid3}>
            <div className="form-group">
              <label className="form-label">Banco *</label>
              <select className="form-control" value={form.banco} onChange={e => set('banco', e.target.value)}>
                <option value="">-- Seleccionar --</option>
                {bancos.filter(b => b.status === 'Active').map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Archivo</label>
              <input className="form-control" value={form.archivo} onChange={e => set('archivo', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select className="form-control" value={form.estado} onChange={e => set('estado', e.target.value)}>
                <option value="Pendiente">Pendiente</option>
                <option value="Procesado">Procesado</option>
                <option value="En proceso">En proceso</option>
                <option value="Completado">Completado</option>
                <option value="Error">Error</option>
                <option value="Rechazado">Rechazado</option>
              </select>
            </div>
          </div>

          {/* Fila 3: Cuentas y monedas */}
          <div style={styles.modalGrid4}>
            <div className="form-group">
              <label className="form-label">Cuenta cargo</label>
              <input className="form-control" value={form.cuenta_cargo} onChange={e => set('cuenta_cargo', e.target.value)} maxLength={30} />
            </div>
            <div className="form-group">
              <label className="form-label">Moneda cargo</label>
              <select className="form-control" value={form.moneda_cargo} onChange={e => set('moneda_cargo', e.target.value)}>
                <option value="">-- Seleccionar --</option>
                {monedas.map(m => {
                  const mId = getField(m, 'ID', 'id')
                  const mCodigo = getField(m, 'CODIGO', 'codigo', 'Codigo') || ''
                  return <option key={mId} value={mId}>{mCodigo}</option>
                })}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Cuenta abono</label>
              <input className="form-control" value={form.cuenta_abono} onChange={e => set('cuenta_abono', e.target.value)} maxLength={30} />
            </div>
            <div className="form-group">
              <label className="form-label">Moneda abono</label>
              <select className="form-control" value={form.moneda_abono} onChange={e => set('moneda_abono', e.target.value)}>
                <option value="">-- Seleccionar --</option>
                {monedas.map(m => {
                  const mId = getField(m, 'ID', 'id')
                  const mCodigo = getField(m, 'CODIGO', 'codigo', 'Codigo') || ''
                  return <option key={mId} value={mId}>{mCodigo}</option>
                })}
              </select>
            </div>
          </div>

          {/* Fila 4: Importes */}
          <div style={styles.modalGrid3}>
            <div className="form-group">
              <label className="form-label">Importe cargado *</label>
              <input className="form-control" type="number" step="0.01" value={form.importe_cargado} onChange={e => set('importe_cargado', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Importe abonado</label>
              <input className="form-control" type="number" step="0.01" value={form.importe_abonado} onChange={e => set('importe_abonado', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Comisión</label>
              <input className="form-control" type="number" step="0.01" value={form.comision} onChange={e => set('comision', e.target.value)} />
            </div>
          </div>

          {/* Fila 5: Referencia y mensaje */}
          <div className="form-group">
            <label className="form-label">Referencia</label>
            <input className="form-control" value={form.referencia} onChange={e => set('referencia', e.target.value)} maxLength={100} />
          </div>
          <div className="form-group">
            <label className="form-label">Mensaje / Observaciones</label>
            <textarea className="form-control" rows={2} value={form.mensaje} onChange={e => set('mensaje', e.target.value)} />
          </div>

          {error && <div style={styles.errorBox}>⚠ {error}</div>}
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

// ── Página principal ────────────────────────────────────

const DevolucionesPage = () => {
  const { permisos } = useAuth()
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [campo, setCampo] = useState('all')
  const [busqueda, setBusqueda] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [compactMode, setCompactMode] = useState(true)
  const [sortField, setSortField] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const { toasts, show } = useToast()

  // Lookups
  const [bancos, setBancos] = useState([])
  const [monedas, setMonedas] = useState([])

  // ── Permisos por bit ──────────────────────────────────
  // OPEDEV bits: 0:Vista, 1:Lista, 2:Ver, 3:Modificar, 4:Total, 5:Crear, 6:Eliminar
  const claimValue = permisos?.[CLAIM] || '00000000000'
  const canList   = claimValue[1] === '1'  // bit 1: Lista
  const canView   = claimValue[2] === '1'  // bit 2: Ver
  const canEdit   = claimValue[3] === '1'  // bit 3: Modificar
  const canCreate = claimValue[5] === '1'  // bit 5: Crear
  const canDelete = claimValue[6] === '1'  // bit 6: Eliminar

  // ── Cargar lookups al montar ──────────────────────────
  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [bRes, mRes] = await Promise.all([
          apiCall('/qf/devoluciones/bancos'),
          apiCall('/qf/devoluciones/monedas'),
        ])
        // Bancos: n8n devuelve array directo o envuelto
        const bArr = Array.isArray(bRes) ? bRes : (bRes?.data || bRes?.items || [bRes])
        setBancos(bArr.filter(x => x && (x.id || x.ID)))
        // Monedas: NO usar toArray porque campos son ID (mayúscula), toArray filtra por 'id' minúscula
        const mArr = Array.isArray(mRes) ? mRes : (mRes?.data || mRes?.items || [mRes])
        setMonedas(mArr.filter(x => x && (x.ID || x.id || x.Id)))
      } catch (e) {
        console.warn('Error cargando lookups:', e.message)
      }
    }
    loadLookups()
  }, [])

  // ── Cargar devoluciones ───────────────────────────────
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
      const res = await apiCall(`/qf/devoluciones/listar?${qs.toString()}`)
      const rows = Array.isArray(res) ? res : (res?.data || res?.items || res?.rows || [])
      setData(toArray(rows))
      setTotal(Number(res?.total ?? rows.length))
    } catch (e) {
      show('Error al cargar devoluciones: ' + e.message, 'error')
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

  // ── CRUD handlers ─────────────────────────────────────

  const handleSave = async payload => {
    const endpoint = payload.id
      ? '/qf/devoluciones/actualizar'
      : '/qf/devoluciones/crear'
    const res = await apiCall(endpoint, { method: 'POST', body: JSON.stringify(payload) })
    if (!res?.success) throw new Error(res?.message || 'No se pudo guardar')
    show(payload.id ? 'Devolución actualizada' : 'Devolución registrada')
    cargar()
  }

  const handleDelete = async item => {
    if (!confirm(`¿Eliminar la devolución ${item.numero_operacion || item.id}?`)) return
    try {
      const res = await apiCall('/qf/devoluciones/eliminar', {
        method: 'POST',
        body: JSON.stringify({ id: item.id }),
      })
      if (!res?.success) throw new Error(res?.message || 'No se pudo eliminar')
      show('Devolución eliminada')
      cargar()
    } catch (e) {
      show(e.message, 'error')
    }
  }

  // ── Cálculos de página ────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : ((page - 1) * PAGE_SIZE) + 1
  const to = Math.min(page * PAGE_SIZE, total)

  const metrics = useMemo(() => {
    const totalCargado = data.reduce((s, r) => s + Number(r.importe_cargado || 0), 0)
    const totalAbonado = data.reduce((s, r) => s + Number(r.importe_abonado || 0), 0)
    const totalComision = data.reduce((s, r) => s + Number(r.comision || 0), 0)
    const pendientes = data.filter(r => String(r.estado || '').toLowerCase().includes('pendiente')).length
    const bancosUnicos = new Set(data.map(r => r.banco).filter(Boolean)).size
    return { totalCargado, totalAbonado, totalComision, pendientes, bancosUnicos }
  }, [data])

  // ── Ordenamiento local ────────────────────────────────
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sortedData = useMemo(() => {
    if (!sortField) return data
    const sorted = [...data].sort((a, b) => {
      let va = a[sortField]
      let vb = b[sortField]
      // Para campos numéricos
      if (['importe_cargado', 'importe_abonado', 'comision'].includes(sortField)) {
        va = Number(va || 0)
        vb = Number(vb || 0)
        return sortDir === 'asc' ? va - vb : vb - va
      }
      // Para banco (resolver nombre)
      if (sortField === 'banco_nombre') {
        va = getBancoNombre(a.banco, bancos)
        vb = getBancoNombre(b.banco, bancos)
      }
      // Para monedas (resolver nombre)
      if (sortField === 'moneda_cargo_nombre') {
        va = getMonedaNombre(a.moneda_cargo, monedas)
        vb = getMonedaNombre(b.moneda_abono, monedas)
      }
      if (sortField === 'moneda_abono_nombre') {
        va = getMonedaNombre(a.moneda_abono, monedas)
        vb = getMonedaNombre(b.moneda_abono, monedas)
      }
      // String comparison
      va = String(va || '').toLowerCase()
      vb = String(vb || '').toLowerCase()
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [data, sortField, sortDir, bancos, monedas])

  const sortIcon = (field) => {
    if (sortField !== field) return ' ↕'
    return sortDir === 'asc' ? ' ▲' : ' ▼'
  }

  // ── Si no tiene permiso de lista ──────────────────────
  if (!canList) {
    return (
      <div className="fade-in" style={styles.page}>
        <div style={styles.topHeader}>
          <h1 style={styles.title}>↩ Devoluciones</h1>
          <p style={styles.subtitle}>No tienes permisos para ver esta lista</p>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────

  return (
    <div className="fade-in" style={styles.page}>
      <ToastContainer toasts={toasts} />

      {/* Header */}
      <div style={styles.topHeader}>
        <h1 style={styles.title}>↩ Devoluciones</h1>
        <p style={styles.subtitle}>Gestión de devoluciones bancarias</p>
      </div>

      {/* Action bar */}
      <div style={styles.actionBar}>
        <button className="btn btn-secondary btn-sm" onClick={() => setCompactMode(v => !v)}>
          {compactMode ? 'Vista cómoda' : 'Vista compacta'}
        </button>
      </div>

      {/* KPIs */}
      <div style={styles.kpiGrid}>
        {[
          { label: 'Total registros', value: total, color: 'var(--qf-navy)', border: '#2196f3' },
          { label: 'Mostradas', value: data.length, color: '#185FA5', border: '#03a9f4' },
          { label: 'Total cargado', value: money(metrics.totalCargado), color: '#c62828', border: '#f44336' },
          { label: 'Total abonado', value: money(metrics.totalAbonado), color: '#2e7d32', border: '#4caf50' },
          { label: 'Comisiones', value: money(metrics.totalComision), color: '#e65100', border: '#ff9800' },
          { label: 'Pendientes', value: metrics.pendientes, color: '#5e35b1', border: '#7e57c2' },
        ].map(s => (
          <div key={s.label} style={{ ...styles.kpiCard, borderTop: `3px solid ${s.border}` }}>
            <div style={styles.kpiLabel}>{s.label}</div>
            <div style={{ ...styles.kpiValue, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="page-card" style={styles.card}>
        {/* Sticky tools */}
        <div style={styles.stickyTools}>
          <div style={styles.cardTitleWrap}>
            <h2 style={styles.cardTitle}>Lista de Devoluciones</h2>
            {canCreate && (
              <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'nuevo' })} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: '#4CAF50', fontWeight: 800, fontSize: 16 }}>+</span> Nuevo Registro
              </button>
            )}
          </div>
          <div style={styles.filtersRow}>
            <select className="filter-input" value={campo} onChange={e => setCampo(e.target.value)} style={styles.fieldSelect}>
              {camposBusqueda.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#8a9bb5', pointerEvents: 'none' }}>🔍</span>
              <input
                className="filter-input"
                placeholder={campo === 'all' ? 'Buscar...' : `Buscar por ${camposBusqueda.find(f => f.value === campo)?.label || ''}...`}
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                style={{ ...styles.searchInput, paddingLeft: 32, width: '100%' }}
              />
            </div>
            <button className="btn btn-secondary btn-sm" onClick={limpiar}>Limpiar</button>
          </div>
          <div style={styles.paginationRow}>
            <span style={styles.resultPill}>{from}-{to} de {total}</span>
            <button className="btn btn-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setPage(1)}>Primera</button>
            <button className="btn btn-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</button>
            <span style={styles.pageInfo}>Página <strong>{page}</strong> de <strong>{totalPages}</strong></span>
            <button className="btn btn-secondary btn-sm" disabled={page >= totalPages || loading} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Siguiente</button>
            <button className="btn btn-secondary btn-sm" disabled={page >= totalPages || loading} onClick={() => setPage(totalPages)}>Última</button>
            {loading && <span style={styles.loadingMini}>Actualizando...</span>}
          </div>
        </div>

        {/* Table */}
        <div style={{ ...styles.tableViewport, maxHeight: compactMode ? 'calc(100vh - 350px)' : 'calc(100vh - 410px)' }}>
          {loading && data.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner dark" /></div>
          ) : data.length === 0 ? (
            <div className="empty-state"><div className="icon">↩</div><p>No se encontraron devoluciones</p></div>
          ) : (
            <table className="qf-table" style={{ ...styles.table, fontSize: compactMode ? 11 : 12 }}>
              <thead>
                <tr>
                  <th style={styles.thSort} onClick={() => handleSort('numero_operacion')}>Nro. Op.<span style={styles.sortIcon}>{sortIcon('numero_operacion')}</span></th>
                  <th style={styles.thSort} onClick={() => handleSort('fecha_operacion')}>Fecha<span style={styles.sortIcon}>{sortIcon('fecha_operacion')}</span></th>
                  <th style={styles.thSort} onClick={() => handleSort('banco_nombre')}>Banco<span style={styles.sortIcon}>{sortIcon('banco_nombre')}</span></th>
                  <th style={styles.thSort} onClick={() => handleSort('cuenta_cargo')}>Cta. cargo<span style={styles.sortIcon}>{sortIcon('cuenta_cargo')}</span></th>
                  <th style={styles.thSort} onClick={() => handleSort('moneda_cargo_nombre')}>Mon.<span style={styles.sortIcon}>{sortIcon('moneda_cargo_nombre')}</span></th>
                  <th style={styles.thSort} onClick={() => handleSort('cuenta_abono')}>Cta. abono<span style={styles.sortIcon}>{sortIcon('cuenta_abono')}</span></th>
                  <th style={styles.thSort} onClick={() => handleSort('moneda_abono_nombre')}>Mon.<span style={styles.sortIcon}>{sortIcon('moneda_abono_nombre')}</span></th>
                  <th style={{ ...styles.thSort, textAlign: 'right' }} onClick={() => handleSort('importe_cargado')}>Cargado<span style={styles.sortIcon}>{sortIcon('importe_cargado')}</span></th>
                  <th style={{ ...styles.thSort, textAlign: 'right' }} onClick={() => handleSort('importe_abonado')}>Abonado<span style={styles.sortIcon}>{sortIcon('importe_abonado')}</span></th>
                  <th style={{ ...styles.thSort, textAlign: 'right' }} onClick={() => handleSort('comision')}>Comisión<span style={styles.sortIcon}>{sortIcon('comision')}</span></th>
                  <th style={styles.thSort} onClick={() => handleSort('referencia')}>Referencia<span style={styles.sortIcon}>{sortIcon('referencia')}</span></th>
                  <th style={styles.thSort} onClick={() => handleSort('estado')}>Estado<span style={styles.sortIcon}>{sortIcon('estado')}</span></th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map(r => {
                  const cargado = Number(r.importe_cargado || 0)
                  const monCargoCode = getMonedaCodigo(r.moneda_cargo, monedas)
                  const monAbonoCode = getMonedaCodigo(r.moneda_abono, monedas)
                  return (
                    <tr key={r.id} style={compactMode ? styles.compactRow : undefined}>
                      <td style={{ ...styles.td, minWidth: 50 }}>
                        <code style={styles.opCode}>{r.numero_operacion || '-'}</code>
                      </td>
                      <td style={{ ...styles.td, minWidth: 60, fontSize: 10.5 }}>{formatDate(r.fecha_operacion)}</td>
                      <td style={{ ...styles.td, minWidth: 50 }}>
                        <span style={styles.bankPill}>{getBancoNombre(r.banco, bancos)}</span>
                      </td>
                      <td style={{ ...styles.td, minWidth: 165, fontSize: 10.5 }}>{r.cuenta_cargo || '-'}</td>
                      <td style={{ ...styles.td, minWidth: 45, fontSize: 10.5 }}>{getMonedaNombre(r.moneda_cargo, monedas)}</td>
                      <td style={{ ...styles.td, minWidth: 165, fontSize: 10.5 }}>{r.cuenta_abono || '-'}</td>
                      <td style={{ ...styles.td, minWidth: 45, fontSize: 10.5 }}>{getMonedaNombre(r.moneda_abono, monedas)}</td>
                      <td style={{ ...styles.td, fontWeight: 800, color: '#c62828', whiteSpace: 'nowrap', minWidth: 85, textAlign: 'right', fontSize: 11 }}>
                        {money(cargado, monCargoCode)}
                      </td>
                      <td style={{ ...styles.td, fontWeight: 800, color: '#2e7d32', whiteSpace: 'nowrap', minWidth: 85, textAlign: 'right', fontSize: 11 }}>
                        {money(r.importe_abonado, monAbonoCode)}
                      </td>
                      <td style={{ ...styles.td, whiteSpace: 'nowrap', minWidth: 40, textAlign: 'right', fontSize: 11 }}>
                        {money(r.comision, monCargoCode)}
                      </td>
                      <td style={{ ...styles.td, minWidth: 90, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10.5 }}>
                        {r.referencia || '-'}
                      </td>
                      <td style={{ ...styles.td, minWidth: 80 }}>
                        <span className={`badge ${badgeClass(r.estado)}`} style={{ fontSize: 8 }}>{String(r.estado || 'Pendiente').toUpperCase()}</span>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center', minWidth: 100 }}>
                        <div style={styles.actionButtons}>
                          {canView && (
                            <button className="btn btn-secondary btn-sm" onClick={() => setModal({ type: 'detalle', data: r })} title="Ver detalle" style={{ fontSize: 10, padding: '2px 6px' }}>Ver</button>
                          )}
                          {canEdit && (
                            <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'editar', data: r })} title="Editar" style={{ fontSize: 10, padding: '2px 6px' }}>Edit</button>
                          )}
                          {canDelete && (
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r)} title="Eliminar" style={{ fontSize: 10, padding: '2px 6px' }}>Del</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {!loading && <div style={styles.footerCount}>{data.length} de {total} devoluciones</div>}
      </div>

      {/* Modales */}
      {modal?.type === 'detalle' && (
        <ModalDetalle item={modal.data} bancos={bancos} monedas={monedas} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'nuevo' && (
        <ModalDevolucion bancos={bancos} monedas={monedas} onClose={() => setModal(null)} onSave={handleSave} />
      )}
      {modal?.type === 'editar' && (
        <ModalDevolucion item={modal.data} bancos={bancos} monedas={monedas} onClose={() => setModal(null)} onSave={handleSave} />
      )}
    </div>
  )
}

// ── Estilos (mismos de OperacionesFacturasPage) ─────────

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
  table: { minWidth: 1100, tableLayout: 'auto' },
  th: { position: 'sticky', top: 0, zIndex: 10, whiteSpace: 'nowrap', fontSize: 10.3, padding: '8px 8px', lineHeight: 1.05 },
  thSort: { position: 'sticky', top: 0, zIndex: 10, whiteSpace: 'nowrap', fontSize: 10.3, padding: '8px 8px', lineHeight: 1.05, cursor: 'pointer', userSelect: 'none', transition: 'background 0.15s' },
  sortIcon: { fontSize: 8, opacity: 0.5, marginLeft: 2 },
  td: { padding: '6px 8px', verticalAlign: 'middle', lineHeight: 1.15 },
  compactRow: { height: 38 },
  opCode: { background: '#e8eef5', padding: '2px 7px', borderRadius: 4, fontSize: 10.5, fontWeight: 800, color: 'var(--qf-navy)' },
  bankPill: { background: '#e8eef5', color: 'var(--qf-navy)', borderRadius: 4, padding: '2px 7px', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' },
  miniBarTrack: { height: 7, width: 70, background: '#e8eef5', borderRadius: 999, overflow: 'hidden' },
  miniBarFill: { height: '100%', background: '#c62828', borderRadius: 999 },
  actionButtons: { display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'nowrap' },
  footerCount: { padding: '10px 16px', borderTop: '1px solid var(--qf-border)', fontSize: 11.5, color: 'var(--qf-text-light)', background: '#fff' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 },
  detailBox: { background: '#f8fafc', border: '1px solid var(--qf-border)', borderRadius: 8, padding: 9 },
  detailLabel: { fontSize: 9.5, fontWeight: 700, color: 'var(--qf-text-light)', textTransform: 'uppercase' },
  detailValue: { fontSize: 12.5, fontWeight: 600, color: 'var(--qf-navy)' },
  modalGrid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' },
  modalGrid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' },
  modalGrid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' },
  errorBox: { background: '#fce4e4', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginTop: 8 },
}

export default DevolucionesPage
