import React, { useEffect, useMemo, useState } from 'react'
import { apiCall, toArray } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'
import { useAuth } from '../context/AuthContext'

// ── Claim para este módulo ──────────────────────────────
const CLAIM = 'OPEDEV'

const PAGE_SIZE = 50
const DEBOUNCE_MS = 450

// Campos para el selector de filtro
const camposBusqueda = [
  { value: 'all', label: 'Todos los campos' },
  { value: 'numero_operacion', label: 'Nro. Operación' },
  { value: 'referencia', label: 'Referencia' },
  { value: 'estado', label: 'Estado' },
  { value: 'banco', label: 'Banco' },
  { value: 'cuenta_cargo', label: 'Cuenta cargo' },
  { value: 'cuenta_abono', label: 'Cuenta abono' },
  { value: 'moneda_cargo', label: 'Moneda cargo' },
  { value: 'moneda_abono', label: 'Moneda abono' },
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

// ── Lookup helpers ──────────────────────────────────────

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

// ── Ordenamiento ────────────────────────────────────────
const sortData = (data, sortBy, sortOrder) => {
  if (!sortBy) return data
  return [...data].sort((a, b) => {
    let valA = a[sortBy]
    let valB = b[sortBy]
    
    if (sortBy === 'fecha_operacion') {
      valA = new Date(valA || 0)
      valB = new Date(valB || 0)
    }
    if (['importe_cargado', 'importe_abonado', 'comision'].includes(sortBy)) {
      valA = Number(valA || 0)
      valB = Number(valB || 0)
    }
    if (typeof valA === 'string') valA = valA.toLowerCase()
    if (typeof valB === 'string') valB = valB.toLowerCase()
    
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1
    return 0
  })
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
  
  const [sortBy, setSortBy] = useState(null)
  const [sortOrder, setSortOrder] = useState('asc')
  
  const { toasts, show } = useToast()

  const [bancos, setBancos] = useState([])
  const [monedas, setMonedas] = useState([])

  // Permisos
  const claimValue = permisos?.[CLAIM] || '00000000000'
  const canList   = claimValue[1] === '1'
  const canView   = claimValue[2] === '1'
  const canEdit   = claimValue[3] === '1'
  const canCreate = claimValue[5] === '1'
  const canDelete = claimValue[6] === '1'

  // Cargar lookups
  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [bRes, mRes] = await Promise.all([
          apiCall('/qf/devoluciones/bancos'),
          apiCall('/qf/devoluciones/monedas'),
        ])
        const bArr = Array.isArray(bRes) ? bRes : (bRes?.data || bRes?.items || [bRes])
        setBancos(bArr.filter(x => x && (x.id || x.ID)))
        const mArr = Array.isArray(mRes) ? mRes : (mRes?.data || mRes?.items || [mRes])
        setMonedas(mArr.filter(x => x && (x.ID || x.id || x.Id)))
      } catch (e) {
        console.warn('Error cargando lookups:', e.message)
      }
    }
    loadLookups()
  }, [])

  // Cargar devoluciones
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
    setSortBy(null)
    setSortOrder('asc')
    cargar({ page: 1, campo: 'all', busqueda: '' })
  }

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  const sortedData = useMemo(() => {
    return sortData(data, sortBy, sortOrder)
  }, [data, sortBy, sortOrder])

  const handleSave = async payload => {
    const endpoint = payload.id ? '/qf/devoluciones/actualizar' : '/qf/devoluciones/crear'
    const res = await apiCall(endpoint, { method: 'POST', body: JSON.stringify(payload) })
    if (!res?.success) throw new Error(res?.message || 'No se pudo guardar')
    show(payload.id ? 'Devolución actualizada' : 'Devolución registrada')
    cargar()
  }

  const handleDelete = async item => {
    if (!confirm(`¿Eliminar la devolución ${item.numero_operacion || item.id}?`)) return
    try {
      const res = await apiCall('/qf/devoluciones/eliminar', { method: 'POST', body: JSON.stringify({ item }) })
      if (!res?.success) throw new Error(res?.message || 'No se pudo eliminar')
      show('Devolución eliminada')
      cargar()
    } catch (e) {
      show(e.message, 'error')
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : ((page - 1) * PAGE_SIZE) + 1
  const to = Math.min(page * PAGE_SIZE, total)

  const metrics = useMemo(() => {
    const totalCargado = sortedData.reduce((s, r) => s + Number(r.importe_cargado || 0), 0)
    const totalAbonado = sortedData.reduce((s, r) => s + Number(r.importe_abonado || 0), 0)
    const totalComision = sortedData.reduce((s, r) => s + Number(r.comision || 0), 0)
    const pendientes = sortedData.filter(r => String(r.estado || '').toLowerCase().includes('pendiente')).length
    return { totalCargado, totalAbonado, totalComision, pendientes }
  }, [sortedData])

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

  return (
    <div className="fade-in" style={styles.page}>
      <ToastContainer toasts={toasts} />

      <div style={styles.topHeader}>
        <h1 style={styles.title}>↩ Devoluciones</h1>
        <p style={styles.subtitle}>Gestión de devoluciones bancarias</p>
      </div>

      <div style={styles.actionBar}>
        <button className="btn btn-secondary btn-sm" onClick={() => setCompactMode(v => !v)}>
          {compactMode ? 'Vista cómoda' : 'Vista compacta'}
        </button>
        {canCreate && (
          <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'nuevo' })}>
            + Nuevo Registro
          </button>
        )}
      </div>

      {/* KPIs */}
      <div style={styles.kpiGrid}>
        {[
          { label: 'Total registros', value: total, color: 'var(--qf-navy)', border: '#2196f3' },
          { label: 'Mostradas', value: sortedData.length, color: '#185FA5', border: '#03a9f4' },
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

      {/* Tabla */}
      <div className="page-card" style={styles.card}>
        <div style={styles.stickyTools}>
          <div style={styles.cardTitleWrap}>
            <h2 style={styles.cardTitle}>Lista de Devoluciones</h2>
            <span style={styles.resultPill}>{from}-{to} de {total}</span>
          </div>
          
          {/* Filtros: selector + búsqueda con lupa + limpiar */}
          <div style={styles.filtersRow}>
            <select className="filter-input" value={campo} onChange={e => setCampo(e.target.value)} style={styles.fieldSelect}>
              {camposBusqueda.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#8a9bb5' }}>🔍</span>
              <input
                className="filter-input"
                placeholder="Buscar..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                style={{ width: 200, paddingLeft: 32, height: 36 }}
              />
            </div>
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

        <div style={{ ...styles.tableViewport, maxHeight: compactMode ? 'calc(100vh - 350px)' : 'calc(100vh - 410px)', overflowX: 'auto' }}>
          {loading && sortedData.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner dark" /></div>
          ) : sortedData.length === 0 ? (
            <div className="empty-state"><div className="icon">↩</div><p>No se encontraron devoluciones</p></div>
          ) : (
            <table className="qf-table" style={{ ...styles.table, fontSize: compactMode ? 10 : 11, minWidth: 1100 }}>
              <thead>
                <tr>
                  <th style={styles.th} onClick={() => handleSort('numero_operacion')}>
                    Nro. Op. {sortBy === 'numero_operacion' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={styles.th} onClick={() => handleSort('fecha_operacion')}>
                    Fecha Op. {sortBy === 'fecha_operacion' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={styles.th} onClick={() => handleSort('banco')}>
                    Banco {sortBy === 'banco' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={styles.th}>Cuenta cargo</th>
                  <th style={styles.th}>Cuenta abono</th>
                  <th style={{ ...styles.th, textAlign: 'right' }} onClick={() => handleSort('importe_cargado')}>
                    Imp. cargado {sortBy === 'importe_cargado' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={{ ...styles.th, textAlign: 'right' }} onClick={() => handleSort('importe_abonado')}>
                    Imp. abonado {sortBy === 'importe_abonado' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={{ ...styles.th, textAlign: 'right' }} onClick={() => handleSort('comision')}>
                    Comisión {sortBy === 'comision' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={styles.th} onClick={() => handleSort('referencia')}>
                    Referencia {sortBy === 'referencia' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th style={styles.th} onClick={() => handleSort('estado')}>
                    Estado {sortBy === 'estado' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
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
                      <td style={{ ...styles.td, minWidth: 70, whiteSpace: 'nowrap' }}>
                        <code style={styles.opCode}>{r.numero_operacion || '-'}</code>
                      </td>
                      <td style={{ ...styles.td, minWidth: 70, whiteSpace: 'nowrap' }}>{formatDate(r.fecha_operacion)}</td>
                      <td style={{ ...styles.td, minWidth: 80, whiteSpace: 'nowrap' }}>
                        <span style={styles.bankPill}>{getBancoNombre(r.banco, bancos)}</span>
                      </td>
                      <td style={{ ...styles.td, minWidth: 110, whiteSpace: 'nowrap', fontSize: compactMode ? 9.5 : 10.5 }}>{r.cuenta_cargo || '-'}</td>
                      <td style={{ ...styles.td, minWidth: 110, whiteSpace: 'nowrap', fontSize: compactMode ? 9.5 : 10.5 }}>{r.cuenta_abono || '-'}</td>
                      <td style={{ ...styles.td, fontWeight: 800, color: '#c62828', whiteSpace: 'nowrap', minWidth: 90, textAlign: 'right' }}>
                        {money(cargado, monCargoCode)}
                      </td>
                      <td style={{ ...styles.td, fontWeight: 800, color: '#2e7d32', whiteSpace: 'nowrap', minWidth: 90, textAlign: 'right' }}>
                        {money(r.importe_abonado, monAbonoCode)}
                      </td>
                      <td style={{ ...styles.td, whiteSpace: 'nowrap', minWidth: 65, textAlign: 'right' }}>
                        {money(r.comision, monCargoCode)}
                      </td>
                      <td style={{ ...styles.td, minWidth: 110, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.referencia || '-'}
                      </td>
                      <td style={{ ...styles.td, minWidth: 80, whiteSpace: 'nowrap' }}>
                        <span className={`badge ${badgeClass(r.estado)}`} style={{ fontSize: compactMode ? 9 : 10, padding: '2px 6px' }}>
                          {String(r.estado || 'Pendiente').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'center', minWidth: 105, whiteSpace: 'nowrap' }}>
                        <div style={styles.actionButtons}>
                          {canView && (
                            <button className="btn btn-secondary btn-sm" onClick={() => setModal({ type: 'detalle', data: r })} style={{ fontSize: compactMode ? 9 : 10 }}>Ver</button>
                          )}
                          {canEdit && (
                            <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'editar', data: r })} style={{ fontSize: compactMode ? 9 : 10 }}>Edit</button>
                          )}
                          {canDelete && (
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r)} style={{ fontSize: compactMode ? 9 : 10 }}>Del</button>
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

        {!loading && <div style={styles.footerCount}>{sortedData.length} de {total} devoluciones</div>}
      </div>

      {modal?.type === 'detalle' && <ModalDetalle item={modal.data} bancos={bancos} monedas={monedas} onClose={() => setModal(null)} />}
      {modal?.type === 'nuevo' && <ModalDevolucion bancos={bancos} monedas={monedas} onClose={() => setModal(null)} onSave={handleSave} />}
      {modal?.type === 'editar' && <ModalDevolucion item={modal.data} bancos={bancos} monedas={monedas} onClose={() => setModal(null)} onSave={handleSave} />}
    </div>
  )
}

// ── Estilos ─────────────────────────────────────────────
const styles = {
  page: { paddingBottom: 16, maxWidth: '100%', overflowX: 'hidden' },
  topHeader: { marginBottom: 8 },
  title: { fontFamily: 'Montserrat', fontSize: 22, fontWeight: 800, color: 'var(--qf-navy)', marginBottom: 3 },
  subtitle: { color: 'var(--qf-text-light)', fontSize: 12.5 },
  actionBar: { display: 'flex', justifyContent: 'flex-start', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 14 },
  kpiCard: { background: '#fff', borderRadius: 12, padding: '8px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', minHeight: 58 },
  kpiLabel: { fontSize: 9, color: 'var(--qf-text-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 3 },
  kpiValue: { fontWeight: 800, fontFamily: 'Montserrat', lineHeight: 1.1, fontSize: 18 },
  card: { overflow: 'hidden' },
  stickyTools: { background: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottom: '1px solid var(--qf-border)' },
  cardTitleWrap: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 16px 6px' },
  cardTitle: { margin: 0, fontSize: 16, fontFamily: 'Montserrat', color: 'var(--qf-navy)' },
  resultPill: { fontSize: 10, fontWeight: 700, color: 'var(--qf-navy)', background: '#e8eef5', borderRadius: 999, padding: '3px 8px' },
  filtersRow: { display: 'flex', gap: 8, alignItems: 'center', padding: '0 16px 8px' },
  fieldSelect: { width: 'auto', minWidth: 150, height: 34, fontSize: 12 },
  paginationRow: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '6px 16px 8px', background: '#f8fafc', borderTop: '1px solid var(--qf-border)' },
  pageInfo: { fontSize: 11.5, color: 'var(--qf-text-light)', padding: '0 4px' },
  loadingMini: { fontSize: 10, color: '#185FA5', fontWeight: 700 },
  tableViewport: { overflow: 'auto', width: '100%' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { position: 'sticky', top: 0, zIndex: 10, whiteSpace: 'nowrap', fontSize: 10, padding: '6px 5px', lineHeight: 1.1, background: '#fff', borderBottom: '1px solid var(--qf-border)', cursor: 'pointer', userSelect: 'none' },
  td: { padding: '4px 5px', verticalAlign: 'middle', lineHeight: 1.2, borderBottom: '1px solid #f0f2f5' },
  compactRow: { height: 34 },
  opCode: { background: '#e8eef5', padding: '1px 5px', borderRadius: 4, fontSize: 9.5, fontWeight: 800, color: 'var(--qf-navy)' },
  bankPill: { background: '#e8eef5', color: 'var(--qf-navy)', borderRadius: 4, padding: '1px 5px', fontSize: 9.5, fontWeight: 700, whiteSpace: 'nowrap' },
  actionButtons: { display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'nowrap' },
  footerCount: { padding: '8px 16px', borderTop: '1px solid var(--qf-border)', fontSize: 11, color: 'var(--qf-text-light)', background: '#fff' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 },
  detailBox: { background: '#f8fafc', border: '1px solid var(--qf-border)', borderRadius: 8, padding: 8 },
  detailLabel: { fontSize: 9, fontWeight: 700, color: 'var(--qf-text-light)', textTransform: 'uppercase' },
  detailValue: { fontSize: 12, fontWeight: 600, color: 'var(--qf-navy)' },
  modalGrid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' },
  modalGrid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px' },
  modalGrid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px' },
  errorBox: { background: '#fce4e4', color: '#c62828', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginTop: 6 },
}

// Agregar estilos para sortable
const styleSheet = document.createElement('style')
styleSheet.textContent = `
  .sortable:hover {
    background-color: #f0f2f5;
  }
`
document.head.appendChild(styleSheet)

export default DevolucionesPage
