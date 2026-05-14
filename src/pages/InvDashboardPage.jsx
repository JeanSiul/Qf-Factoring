import React, { useEffect, useMemo, useState } from 'react'
import { apiCall } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'
import { useNavigate } from 'react-router-dom'

const unwrapArray = res => {
  if (!res || typeof res === 'number' || typeof res === 'boolean') return []

  if (Array.isArray(res)) {
    return res.filter(x => x && typeof x === 'object')
  }

  if (typeof res === 'string') {
    try {
      return unwrapArray(JSON.parse(res))
    } catch {
      return []
    }
  }

  if (typeof res === 'object') {
    if (Array.isArray(res.data)) return res.data.filter(x => x && typeof x === 'object')
    if (Array.isArray(res.items)) return res.items.filter(x => x && typeof x === 'object')
    if (Array.isArray(res.rows)) return res.rows.filter(x => x && typeof x === 'object')
    if (Array.isArray(res.result)) return res.result.filter(x => x && typeof x === 'object')
    if (Array.isArray(res.results)) return res.results.filter(x => x && typeof x === 'object')
    return [res]
  }

  return []
}

const first = (obj, keys, fallback = '') => {
  for (const key of keys) {
    const value = obj?.[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return fallback
}

const norm = value => String(value ?? '').trim().toLowerCase()
const sameId = (a, b) => String(a ?? '').trim() !== '' && String(a ?? '').trim() === String(b ?? '').trim()

const formatDate = value => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10)
  return d.toLocaleDateString('es-PE')
}

const itemId = item => first(item, ['id', 'ID', 'item_id', 'itemId', 'codigo', 'Codigo', 'code'], '')
const itemCodigo = item => first(item, ['codigo', 'Codigo', 'code', 'serial', 'serie', 'id', 'ID'], '-')
const itemNombre = item => first(item, ['nombre', 'Nombre', 'name', 'item_nombre', 'descripcion', 'description'], 'Item')
const itemEstado = item => norm(first(item, ['estado', 'Estado', 'status', 'STATUS'], ''))
const itemGrupoId = item => first(item, ['grupo_id', 'grupoId', 'id_grupo', 'group_id', 'groupId', 'categoria_id', 'category_id'], '')
const itemGrupoNombre = item => first(item, ['grupo_nombre', 'grupo', 'group_name', 'categoria', 'category', 'tipo'], '')
const itemAsignadoA = item => first(item, ['usuario_nombre', 'asignado_a', 'assigned_to', 'responsable', 'usuario', 'user_name', 'colaborador', 'employee_name'], '')
const itemFechaAsignacion = item => first(item, ['fecha_asignacion', 'assigned_at', 'fecha', 'updated_at', 'fecha_modificacion', 'created_at'], '')

const grupoId = grupo => first(grupo, ['id', 'ID', 'grupo_id', 'group_id'], '')
const grupoCodigo = grupo => first(grupo, ['codigo', 'Codigo', 'code'], '')
const grupoNombre = grupo => first(grupo, ['nombre', 'Nombre', 'name', 'grupo', 'descripcion'], 'Sin grupo')

const asignacionId = row => first(row, ['asignacion_id', 'id', 'ID'], `${asignacionCodigo(row)}-${asignacionFecha(row)}`)
const asignacionCodigo = row => first(row, ['codigo', 'Codigo', 'item_codigo', 'code', 'serial'], '-')
const asignacionItemNombre = row => first(row, ['item_nombre', 'nombre', 'Nombre', 'item', 'descripcion'], 'Item asignado')
const asignacionUsuario = row => first(row, ['usuario_nombre', 'asignado_a', 'assigned_to', 'usuario', 'user_name', 'responsable', 'colaborador'], 'Asignado')
const asignacionFecha = row => first(row, ['fecha', 'fecha_asignacion', 'assigned_at', 'created_at', 'updated_at', 'date'], '')

const estadoDisponible = estado => ['disponible', 'available', 'libre'].includes(estado)
const estadoAsignado = estado => ['asignado', 'assigned', 'en uso', 'uso'].includes(estado)
const estadoReparacion = estado => ['reparacion', 'reparación', 'repair', 'mantenimiento'].includes(estado)
const estadoBaja = estado => ['baja', 'inactivo', 'retirado'].includes(estado)

const buildFallbackGroupsFromItems = items => {
  const map = new Map()

  items.forEach(item => {
    const gid = itemGrupoId(item)
    const gname = itemGrupoNombre(item) || (gid ? `Grupo ${gid}` : 'Sin grupo')
    const key = String(gid || gname)

    if (!map.has(key)) {
      map.set(key, {
        id: gid || key,
        codigo: gid || '',
        nombre: gname,
      })
    }
  })

  return [...map.values()]
}

const InvDashboardPage = () => {
  const [items, setItems] = useState([])
  const [asignaciones, setAsignaciones] = useState([])
  const [grupos, setGrupos] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastLoadInfo, setLastLoadInfo] = useState(null)
  const { toasts, show } = useToast()
  const navigate = useNavigate()

  const cargar = async () => {
    setLoading(true)
    try {
      const [itemsRes, asignacionesRes, gruposRes] = await Promise.all([
        apiCall('/qf/inv/items/listar'),
        apiCall('/qf/inv/asignaciones/listar'),
        apiCall('/qf/inv/grupos/listar'),
      ])

      const nextItems = unwrapArray(itemsRes)
      const nextAsignaciones = unwrapArray(asignacionesRes)
      const nextGruposRaw = unwrapArray(gruposRes)
      const nextGrupos = nextGruposRaw.length > 0 ? nextGruposRaw : buildFallbackGroupsFromItems(nextItems)

      setItems(nextItems)
      setAsignaciones(nextAsignaciones)
      setGrupos(nextGrupos)
      setLastLoadInfo({
        items: nextItems.length,
        asignaciones: nextAsignaciones.length,
        grupos: nextGrupos.length,
      })
    } catch (e) {
      show('Error al cargar dashboard: ' + (e.message || e), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const total = items.length
  const disponibles = items.filter(item => estadoDisponible(itemEstado(item))).length
  const asignadosCount = items.filter(item => estadoAsignado(itemEstado(item))).length
  const reparacion = items.filter(item => estadoReparacion(itemEstado(item))).length

  const porGrupo = useMemo(() => {
    const base = grupos.map(g => {
      const id = grupoId(g)
      const nombre = grupoNombre(g)
      const codigo = grupoCodigo(g)
      const relacionados = items.filter(item => {
        const igid = itemGrupoId(item)
        const igname = itemGrupoNombre(item)
        return sameId(igid, id) || (!!igname && norm(igname) === norm(nombre)) || (!!codigo && norm(igname) === norm(codigo))
      })

      return {
        id: id || codigo || nombre,
        codigo,
        nombre,
        totalAtributos: Number(first(g, ['totalAtributos', 'totalatributos', 'total_atributos'], 0) || 0),
        total: relacionados.length,
        disponibles: relacionados.filter(item => estadoDisponible(itemEstado(item))).length,
        asignados: relacionados.filter(item => estadoAsignado(itemEstado(item))).length,
      }
    })

    const gruposExistentes = new Set(base.map(g => String(g.id)))
    const sinCatalogo = buildFallbackGroupsFromItems(items)
      .filter(g => !gruposExistentes.has(String(g.id)))
      .map(g => {
        const relacionados = items.filter(item => sameId(itemGrupoId(item), g.id) || norm(itemGrupoNombre(item)) === norm(g.nombre))
        return {
          ...g,
          totalAtributos: 0,
          total: relacionados.length,
          disponibles: relacionados.filter(item => estadoDisponible(itemEstado(item))).length,
          asignados: relacionados.filter(item => estadoAsignado(itemEstado(item))).length,
        }
      })

    return [...base, ...sinCatalogo].sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre))
  }, [items, grupos])

  const ultimasAsignaciones = useMemo(() => {
    const rowsFromEndpoint = asignaciones.map(a => ({
      id: asignacionId(a),
      codigo: asignacionCodigo(a),
      item_nombre: asignacionItemNombre(a),
      usuario_nombre: asignacionUsuario(a),
      fecha: asignacionFecha(a),
    }))

    const rowsFromItems = items
      .filter(item => estadoAsignado(itemEstado(item)))
      .map(item => ({
        id: itemId(item),
        codigo: itemCodigo(item),
        item_nombre: itemNombre(item),
        usuario_nombre: itemAsignadoA(item) || 'Asignado',
        fecha: itemFechaAsignacion(item),
      }))

    const source = rowsFromEndpoint.length > 0 ? rowsFromEndpoint : rowsFromItems

    return [...source]
      .sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime())
      .slice(0, 8)
  }, [asignaciones, items])

  const requierenAtencion = useMemo(() => (
    items.filter(item => estadoReparacion(itemEstado(item)) || estadoBaja(itemEstado(item)))
  ), [items])

  const metrics = [
    { label: 'Total items', value: total, sub: 'en inventario', color: 'var(--qf-navy)', border: '#2196f3' },
    { label: 'Disponibles', value: disponibles, sub: 'sin asignar', color: '#2e7d32', border: '#4caf50' },
    { label: 'Asignados', value: asignadosCount, sub: 'en uso', color: '#e65100', border: '#ff9800' },
    { label: 'En reparación', value: reparacion, sub: 'fuera de servicio', color: '#c62828', border: '#f44336' },
  ]

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />

      <div style={S.header}>
        <div>
          <h1 style={S.title}>📦 Dashboard Inventario</h1>
          <p style={S.subtitle}>Resumen general del inventario</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={cargar} disabled={loading}>🔄 Actualizar</button>
      </div>

      <div style={S.kpiGrid}>
        {metrics.map(m => (
          <div key={m.label} style={{ ...S.kpiCard, borderTop: `3px solid ${m.border}` }}>
            <div style={S.kpiLabel}>{m.label}</div>
            <div style={{ ...S.kpiValue, color: m.color }}>{loading ? '…' : m.value}</div>
            <div style={S.kpiSub}>{m.sub}</div>
          </div>
        ))}
      </div>

      {lastLoadInfo && (
        <div style={S.loadInfo}>
          Cargado: {lastLoadInfo.items} items · {lastLoadInfo.grupos} grupos · {lastLoadInfo.asignaciones} asignaciones
        </div>
      )}

      <div style={S.grid}>
        <div className="page-card" style={S.card}>
          <div className="page-card-header">
            <h2>Items por Grupo</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/inventario/items')}>Ver todos</button>
          </div>

          {loading ? (
            <div style={S.loading}><span className="spinner dark" /></div>
          ) : porGrupo.length === 0 ? (
            <div className="empty-state"><p>Sin grupos registrados</p></div>
          ) : porGrupo.map(g => {
            const pct = g.total > 0 ? Math.round((g.asignados / g.total) * 100) : 0

            return (
              <div key={g.id || g.nombre} style={S.groupRow}>
                <div style={S.groupTop}>
                  <div>
                    <span style={S.groupName}>{g.nombre}</span>
                    {g.codigo && <code style={S.code}>{g.codigo}</code>}
                  </div>
                  <span style={S.groupTotal}>{g.total} items</span>
                </div>
                <div style={S.track}>
                  <div style={{ ...S.fill, width: `${pct}%`, background: pct > 80 ? '#f44336' : pct > 50 ? '#ff9800' : '#4caf50' }} />
                </div>
                <div style={S.groupMeta}>
                  <span>✅ {g.disponibles} disponibles</span>
                  <span>📤 {g.asignados} asignados ({pct}%)</span>
                  {Number(g.totalAtributos || 0) > 0 && <span>🧩 {g.totalAtributos} atributos</span>}
                </div>
              </div>
            )
          })}
        </div>

        <div className="page-card" style={S.card}>
          <div className="page-card-header">
            <h2>Últimas Asignaciones</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/inventario/asignaciones')}>Ver todas</button>
          </div>

          {loading ? (
            <div style={S.loading}><span className="spinner dark" /></div>
          ) : ultimasAsignaciones.length === 0 ? (
            <div className="empty-state"><p>Sin asignaciones</p></div>
          ) : (
            <table className="qf-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Asignado a</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {ultimasAsignaciones.map(a => (
                  <tr key={a.id || `${a.codigo}-${a.fecha}`}>
                    <td>
                      <code style={S.codeNoMargin}>{a.codigo}</code>
                      <div style={S.muted}>{a.item_nombre}</div>
                    </td>
                    <td>
                      <div style={S.userCell}>
                        <div style={S.avatar}>{String(a.usuario_nombre || '?').charAt(0).toUpperCase()}</div>
                        <span style={S.userName}>{a.usuario_nombre || 'Asignado'}</span>
                      </div>
                    </td>
                    <td style={S.muted}>{formatDate(a.fecha)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {requierenAtencion.length > 0 && (
          <div className="page-card" style={S.cardFull}>
            <div className="page-card-header"><h2>⚠️ Requieren atención</h2></div>
            <div style={{ overflowX: 'auto' }}>
              <table className="qf-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Item</th>
                    <th>Grupo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {requierenAtencion.map(item => {
                    const estado = itemEstado(item)
                    return (
                      <tr key={itemId(item)}>
                        <td><code style={{ ...S.codeNoMargin, background: '#fce4e4' }}>{itemCodigo(item)}</code></td>
                        <td style={{ fontSize: 12 }}>{itemNombre(item)}</td>
                        <td style={S.muted}>{itemGrupoNombre(item) || itemGrupoId(item) || '-'}</td>
                        <td><span className="badge inactive">{estadoBaja(estado) ? '❌ Baja' : '🔧 Reparación'}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const S = {
  header: { marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  title: { fontFamily: 'Montserrat', fontSize: 22, fontWeight: 700, color: 'var(--qf-navy)', marginBottom: 4 },
  subtitle: { color: 'var(--qf-text-light)', fontSize: 13 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 12 },
  kpiCard: { background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  kpiLabel: { fontSize: 11, color: 'var(--qf-text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  kpiValue: { fontSize: 36, fontWeight: 800, fontFamily: 'Montserrat', lineHeight: 1 },
  kpiSub: { fontSize: 11, color: 'var(--qf-text-light)', marginTop: 4 },
  loadInfo: { marginBottom: 12, background: '#e8eef5', border: '1px solid var(--qf-border)', borderRadius: 10, padding: '8px 12px', color: 'var(--qf-navy)', fontSize: 12, fontWeight: 700 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 },
  card: { margin: 0 },
  cardFull: { margin: 0, gridColumn: '1 / -1' },
  loading: { padding: 30, textAlign: 'center' },
  groupRow: { padding: '14px 20px', borderBottom: '1px solid var(--qf-border)' },
  groupTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 },
  groupName: { fontWeight: 700, fontSize: 13, color: 'var(--qf-navy)' },
  groupTotal: { fontSize: 12, fontWeight: 700, color: 'var(--qf-navy)' },
  code: { marginLeft: 8, background: '#e8eef5', padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700 },
  codeNoMargin: { background: '#e8eef5', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700 },
  track: { height: 6, background: '#e8eef5', borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, transition: 'width 0.3s' },
  groupMeta: { display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: 'var(--qf-text-light)', gap: 8, flexWrap: 'wrap' },
  muted: { fontSize: 11, color: 'var(--qf-text-light)', marginTop: 2 },
  userCell: { display: 'flex', alignItems: 'center', gap: 6 },
  avatar: { width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #2D6A9F, #4CAF50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 9, flexShrink: 0 },
  userName: { fontSize: 12, fontWeight: 500 },
}

export default InvDashboardPage
