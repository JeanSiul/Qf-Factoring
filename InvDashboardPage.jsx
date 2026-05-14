import React, { useState, useEffect, useMemo } from 'react'
import { apiCall } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'
import { useNavigate } from 'react-router-dom'

const getField = (obj, ...keys) => {
  for (const key of keys) {
    if (obj?.[key] !== undefined && obj?.[key] !== null && String(obj[key]).trim() !== '') return obj[key]
    const lower = String(key).toLowerCase()
    const upper = String(key).toUpperCase()
    if (obj?.[lower] !== undefined && obj?.[lower] !== null && String(obj[lower]).trim() !== '') return obj[lower]
    if (obj?.[upper] !== undefined && obj?.[upper] !== null && String(obj[upper]).trim() !== '') return obj[upper]
  }
  return undefined
}

const normalize = value => String(value ?? '').trim().toLowerCase()

const toArray = res => {
  if (!res || res === 1 || typeof res === 'number' || typeof res === 'boolean') return []

  if (Array.isArray(res)) return res.filter(i => i && typeof i === 'object')

  if (typeof res === 'string') {
    try {
      return toArray(JSON.parse(res))
    } catch {
      return []
    }
  }

  if (typeof res === 'object') {
    const possible = res.data || res.items || res.rows || res.result || res.results || res.asignaciones || res.grupos
    if (possible) return toArray(possible)
    return [res]
  }

  return []
}

const itemId = item => getField(item, 'id', 'ID', 'item_id', 'itemId')
const groupId = item => getField(item, 'grupo_id', 'grupoId', 'group_id', 'groupId', 'id_grupo', 'IdGrupo')
const groupName = group => getField(group, 'nombre', 'name', 'grupo_nombre', 'grupo', 'descripcion') || 'Sin grupo'
const groupCode = group => getField(group, 'codigo', 'code', 'cod') || ''
const itemStatus = item => normalize(getField(item, 'estado', 'status', 'Estado', 'STATUS'))

const isStatus = (item, ...states) => {
  const estado = itemStatus(item)
  return states.some(s => estado === normalize(s) || estado.includes(normalize(s)))
}

const asDate = value => {
  if (!value) return 0
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? 0 : d.getTime()
}

const formatDate = value => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10)
  return d.toLocaleDateString('es-PE')
}

const InvDashboardPage = () => {
  const [items, setItems] = useState([])
  const [asignados, setAsignados] = useState([])
  const [grupos, setGrupos] = useState([])
  const [loading, setLoading] = useState(true)
  const { toasts, show } = useToast()
  const navigate = useNavigate()

  const cargar = async () => {
    setLoading(true)
    try {
      const [it, as, gr] = await Promise.all([
        apiCall('/qf/inv/items/listar'),
        apiCall('/qf/inv/asignaciones/listar'),
        apiCall('/qf/inv/grupos/listar'),
      ])

      setItems(toArray(it))
      setAsignados(toArray(as))
      setGrupos(toArray(gr))
    } catch (e) {
      show('Error al cargar dashboard: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const total = items.length
  const disponibles = items.filter(i => isStatus(i, 'disponible')).length
  const asignadosCount = items.filter(i => isStatus(i, 'asignado')).length
  const reparacion = items.filter(i => isStatus(i, 'reparacion', 'reparación')).length
  const baja = items.filter(i => isStatus(i, 'baja')).length

  const porGrupo = useMemo(() => {
    const gruposBase = grupos.length > 0 ? grupos : []

    if (gruposBase.length > 0) {
      return gruposBase.map(g => {
        const gid = itemId(g)
        const rows = items.filter(i => String(groupId(i)) === String(gid))
        return {
          id: gid || groupName(g),
          nombre: groupName(g),
          codigo: groupCode(g),
          total: rows.length,
          disponibles: rows.filter(i => isStatus(i, 'disponible')).length,
          asignados: rows.filter(i => isStatus(i, 'asignado')).length,
        }
      }).filter(g => g.total > 0)
    }

    const map = new Map()
    items.forEach(i => {
      const key = getField(i, 'grupo_nombre', 'grupo', 'group_name', 'categoria', 'grupo_id') || 'Sin grupo'
      const current = map.get(key) || { id: key, nombre: key, codigo: '', total: 0, disponibles: 0, asignados: 0 }
      current.total += 1
      if (isStatus(i, 'disponible')) current.disponibles += 1
      if (isStatus(i, 'asignado')) current.asignados += 1
      map.set(key, current)
    })
    return [...map.values()].filter(g => g.total > 0)
  }, [items, grupos])

  const ultimasAsignaciones = useMemo(() => {
    return [...asignados]
      .sort((a, b) => asDate(getField(b, 'fecha', 'created_at', 'fecha_asignacion')) - asDate(getField(a, 'fecha', 'created_at', 'fecha_asignacion')))
      .slice(0, 5)
  }, [asignados])

  const requierenAtencion = useMemo(() => {
    return items.filter(i => isStatus(i, 'reparacion', 'reparación', 'baja'))
  }, [items])

  const metrics = [
    { label: 'Total items', value: total, sub: 'en inventario', color: 'var(--qf-navy)', border: '#2196f3' },
    { label: 'Disponibles', value: disponibles, sub: 'sin asignar', color: '#2e7d32', border: '#4caf50' },
    { label: 'Asignados', value: asignadosCount, sub: 'en uso', color: '#e65100', border: '#ff9800' },
    { label: 'En reparación', value: reparacion, sub: 'fuera de servicio', color: '#c62828', border: '#f44336' },
    { label: 'De baja', value: baja, sub: 'retirados', color: '#5e35b1', border: '#7e57c2' },
  ]

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: 'Montserrat', fontSize: 22, fontWeight: 700, color: 'var(--qf-navy)', marginBottom: 4 }}>📦 Dashboard Inventario</h1>
          <p style={{ color: 'var(--qf-text-light)', fontSize: 13 }}>Resumen general del inventario</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={cargar} disabled={loading}>🔄 Actualizar</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
        {metrics.map(m => (
          <div key={m.label} style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderTop: `3px solid ${m.border}` }}>
            <div style={{ fontSize: 11, color: 'var(--qf-text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: m.color, fontFamily: 'Montserrat', lineHeight: 1 }}>{loading ? '…' : m.value}</div>
            <div style={{ fontSize: 11, color: 'var(--qf-text-light)', marginTop: 4 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        <div className="page-card" style={{ margin: 0 }}>
          <div className="page-card-header">
            <h2>Items por Grupo</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/inventario/items')}>Ver todos</button>
          </div>
          {loading ? <div style={{ padding: 30, textAlign: 'center' }}><span className="spinner dark" /></div>
            : porGrupo.length === 0 ? <div className="empty-state"><p>Sin items registrados</p></div>
            : porGrupo.map(g => {
              const pct = g.total > 0 ? Math.round((g.asignados / g.total) * 100) : 0
              return (
                <div key={g.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--qf-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--qf-navy)' }}>{g.nombre}</span>
                      {g.codigo && <code style={{ marginLeft: 8, background: '#e8eef5', padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 700 }}>{g.codigo}</code>}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--qf-navy)' }}>{g.total} items</span>
                  </div>
                  <div style={{ height: 6, background: '#e8eef5', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pct > 80 ? '#f44336' : pct > 50 ? '#ff9800' : '#4caf50', borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: 'var(--qf-text-light)' }}>
                    <span>✅ {g.disponibles} disponibles</span>
                    <span>📤 {g.asignados} asignados ({pct}%)</span>
                  </div>
                </div>
              )
            })}
        </div>

        <div className="page-card" style={{ margin: 0 }}>
          <div className="page-card-header">
            <h2>Últimas Asignaciones</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/inventario/asignaciones')}>Ver todas</button>
          </div>
          {loading ? <div style={{ padding: 30, textAlign: 'center' }}><span className="spinner dark" /></div>
            : ultimasAsignaciones.length === 0 ? <div className="empty-state"><p>Sin asignaciones</p></div>
            : (
              <table className="qf-table">
                <thead><tr><th>Item</th><th>Asignado a</th><th>Fecha</th></tr></thead>
                <tbody>
                  {ultimasAsignaciones.map((a, idx) => {
                    const codigo = getField(a, 'codigo', 'item_codigo', 'code') || '-'
                    const itemNombre = getField(a, 'item_nombre', 'item', 'nombre_item', 'nombre') || '-'
                    const usuario = getField(a, 'usuario_nombre', 'usuario', 'asignado_a', 'assigned_to', 'nombre_usuario') || '-'
                    const fecha = getField(a, 'fecha', 'fecha_asignacion', 'created_at')
                    return (
                      <tr key={getField(a, 'asignacion_id', 'id', 'ID') || `${codigo}-${idx}`}>
                        <td>
                          <code style={{ background: '#e8eef5', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{codigo}</code>
                          <div style={{ fontSize: 11, color: 'var(--qf-text-light)', marginTop: 2 }}>{itemNombre}</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #2D6A9F, #4CAF50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 9, flexShrink: 0 }}>
                              {String(usuario).charAt(0) || '?'}
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 500 }}>{usuario}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--qf-text-light)' }}>{formatDate(fecha)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
        </div>

        {requierenAtencion.length > 0 && (
          <div className="page-card" style={{ margin: 0 }}>
            <div className="page-card-header"><h2>⚠️ Requieren atención</h2></div>
            <div style={{ overflowX: 'auto' }}>
              <table className="qf-table">
                <thead><tr><th>Código</th><th>Item</th><th>Grupo</th><th>Estado</th></tr></thead>
                <tbody>
                  {requierenAtencion.map((i, idx) => {
                    const estado = itemStatus(i)
                    return (
                      <tr key={itemId(i) || `${getField(i, 'codigo', 'code') || 'item'}-${idx}`}>
                        <td><code style={{ background: '#fce4e4', padding: '2px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{getField(i, 'codigo', 'code') || '-'}</code></td>
                        <td style={{ fontSize: 12 }}>{getField(i, 'nombre', 'name', 'item_nombre') || '-'}</td>
                        <td style={{ fontSize: 11, color: 'var(--qf-text-light)' }}>{getField(i, 'grupo_nombre', 'grupo', 'group_name') || '-'}</td>
                        <td><span className="badge inactive">{estado.includes('repar') ? '🔧 Reparación' : '❌ Baja'}</span></td>
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

export default InvDashboardPage
