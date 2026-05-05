import React, { useState, useEffect } from 'react'
import { apiCall, toArray } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'

// ── UTILIDADES DE BITS ─────────────────────────────────────────────────────
const strToBits = (str, len) => {
  const bits = []
  for (let i = 0; i < len; i++) bits.push(str?.[i] === '1')
  return bits
}

const bitsToStr = (bits, totalLen = 11) => {
  return bits.map(b => b ? '1' : '0').join('').padEnd(totalLen, '0')
}

const parseBits = (bits_config) => {
  try {
    const parsed = typeof bits_config === 'string' ? JSON.parse(bits_config) : bits_config
    return Array.isArray(parsed) ? parsed : []
  } catch { return [] }
}

// ── CHECK ROW ──────────────────────────────────────────────────────────────
const CheckRow = ({ modulo, permisos, onChange, isSubgrupo = false }) => {
  const cols = parseBits(modulo.bits_config)
  const bits = strToBits(permisos[modulo.codigo] || '00000000000', cols.length)
  const MAX_COLS = 6
  const emptyCols = Math.max(0, MAX_COLS - cols.length)

  const toggle = (i) => {
    const newBits = [...bits]
    newBits[i] = !newBits[i]
    onChange(modulo.codigo, bitsToStr(newBits))
  }

  return (
    <tr style={{ borderTop: isSubgrupo ? 'none' : '2px solid #e8eef5' }}>
      <td style={{ padding: isSubgrupo ? '4px 10px' : '12px 10px 4px', width: 200 }}>
        {isSubgrupo && <span style={{ color: '#b0bdd0', marginRight: 6, fontSize: 11 }}>↳</span>}
        <span style={{ fontWeight: isSubgrupo ? 500 : 700, color: isSubgrupo ? '#4a5a7a' : '#0a2540', fontSize: isSubgrupo ? 12 : 13 }}>
          {modulo.nombre}
        </span>
      </td>
      {bits.map((checked, i) => (
        <td key={i} style={{ textAlign: 'center', width: 70, padding: isSubgrupo ? '4px 10px' : '12px 10px 4px' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
            <input type="checkbox" checked={checked} onChange={() => toggle(i)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
            <span style={{
              width: 18, height: 18, borderRadius: 5, display: 'block',
              border: checked ? '2px solid #185FA5' : '2px solid #c8d5e8',
              background: checked ? '#185FA5' : '#fff',
              transition: 'all 0.15s', position: 'relative'
            }}>
              {checked && (
                <span style={{
                  position: 'absolute', left: 4, top: 1,
                  width: 5, height: 9,
                  border: '2px solid #fff', borderTop: 'none', borderLeft: 'none',
                  transform: 'rotate(45deg)', display: 'block'
                }} />
              )}
            </span>
          </label>
        </td>
      ))}
      {Array.from({ length: emptyCols }).map((_, i) => (
        <td key={`e-${i}`} style={{ width: 70 }} />
      ))}
    </tr>
  )
}

// ── MODAL PERMISOS DINÁMICO ────────────────────────────────────────────────
const ModalPermisos = ({ rol, onClose, onSave }) => {
  const [modulos, setModulos] = useState([])
  const [activeTab, setActiveTab] = useState('')
  const [permisos, setPermisos] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const cargar = async () => {
      setLoading(true)
      try {
        // Cargar módulos dinámicos y claims del rol en paralelo
        const [modsRes, claimsRes] = await Promise.all([
          apiCall('/qf/permisos/modulos/listar'),
          apiCall(`/qf/roles/permisos?rolId=${rol.id}`)
        ])

        const mods = toArray(modsRes).filter(m => m.activo === 1)
        setModulos(mods)

        // Inicializar permisos vacíos para todos los módulos
        const map = {}
        mods.forEach(m => { map[m.codigo] = '00000000000' })

        // Llenar con claims existentes del rol
        const claims = Array.isArray(claimsRes) ? claimsRes : toArray(claimsRes)
        claims.forEach(c => {
          if (c.ClaimType && map[c.ClaimType] !== undefined) {
            map[c.ClaimType] = c.ClaimValue || '00000000000'
          }
        })

        setPermisos(map)

        // Seleccionar primer tab
        const grupos = [...new Set(mods.map(m => m.grupo))]
        if (grupos.length > 0) setActiveTab(grupos[0])
      } catch (e) {
        console.warn('No se pudieron cargar datos:', e.message)
      } finally {
        setLoading(false)
      }
    }
    cargar()
  }, [rol.id])

  const handleChange = (claim, value) => {
    setPermisos(p => ({ ...p, [claim]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(rol.id, permisos)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  // Agrupar módulos por grupo, ordenados
  const gruposOrdenados = [...new Set(modulos.map(m => m.grupo))].sort((a, b) => {
    const oa = modulos.find(m => m.grupo === a)?.grupo_orden || 0
    const ob = modulos.find(m => m.grupo === b)?.grupo_orden || 0
    return oa - ob
  })

  // Módulos del tab activo (principales + sub)
  const modulosTab = modulos.filter(m => m.grupo === activeTab).sort((a, b) => a.orden - b.orden)
  const principales = modulosTab.filter(m => !m.padre_codigo)

  // Header cols — tomar el máximo de bits del tab activo
  const maxCols = Math.min(6, Math.max(...modulosTab.map(m => parseBits(m.bits_config).length), 0))
  // Para los headers usamos los bits del primer módulo principal como referencia
  const headerBits = principales.length > 0 ? parseBits(principales[0].bits_config) : []
  const headerCols = []
  for (let i = 0; i < Math.max(maxCols, headerBits.length); i++) {
    headerCols.push(headerBits[i] || `Col ${i + 1}`)
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(10,20,40,0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: '#fff', borderRadius: 16,
        width: '100%', maxWidth: 860, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.18)',
        overflow: 'hidden', fontFamily: 'Montserrat, sans-serif',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #0a2540 0%, #185FA5 100%)',
          padding: '20px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ margin: 0, color: '#fff', fontSize: 18, fontWeight: 700 }}>🔐 Permisos — {rol.name}</h2>
            <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>{rol.descripcion || 'Gestión de permisos del rol'}</p>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none',
            color: '#fff', width: 32, height: 32, borderRadius: 8,
            cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        {/* Tabs dinámicos */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e8eef5', background: '#f8fafc', flexShrink: 0, overflowX: 'auto' }}>
          {gruposOrdenados.map(g => (
            <button key={g} onClick={() => setActiveTab(g)} style={{
              padding: '12px 22px', fontSize: 13, fontWeight: 600,
              color: activeTab === g ? '#185FA5' : '#6b7a9a',
              cursor: 'pointer', border: 'none', background: activeTab === g ? '#fff' : 'none',
              borderBottom: activeTab === g ? '2px solid #185FA5' : '2px solid transparent',
              marginBottom: -2, whiteSpace: 'nowrap', fontFamily: 'inherit',
            }}>
              {g}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center' }}><span className="spinner dark" /></div>
          ) : principales.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#8a9bb5', fontSize: 13 }}>
              Sin módulos configurados para esta sección
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', color: '#8a9bb5', textTransform: 'uppercase', borderBottom: '1px solid #e8eef5' }}>
                    Módulo
                  </th>
                  {headerCols.slice(0, 6).map((c, i) => (
                    <th key={i} style={{ textAlign: 'center', padding: '8px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', color: '#8a9bb5', textTransform: 'uppercase', borderBottom: '1px solid #e8eef5', width: 70 }}>
                      {c}
                    </th>
                  ))}
                  {headerCols.length < 6 && Array.from({ length: 6 - headerCols.length }).map((_, i) => (
                    <th key={`empty-${i}`} style={{ width: 70, borderBottom: '1px solid #e8eef5' }} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {principales.map(mod => {
                  const hijos = modulosTab.filter(m => m.padre_codigo === mod.codigo).sort((a, b) => a.orden - b.orden)
                  return (
                    <React.Fragment key={mod.codigo}>
                      <CheckRow modulo={mod} permisos={permisos} onChange={handleChange} />
                      {hijos.map(sub => (
                        <CheckRow key={sub.codigo} modulo={sub} permisos={permisos} onChange={handleChange} isSubgrupo />
                      ))}
                      <tr><td colSpan={7} style={{ height: 8 }} /></tr>
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 28px', borderTop: '1px solid #e8eef5',
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          background: '#f8fafc', flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            padding: '9px 20px', borderRadius: 8,
            border: '1px solid #c8d5e8', background: '#fff',
            color: '#4a5a7a', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{
            padding: '9px 24px', borderRadius: 8, border: 'none',
            background: saved ? '#2e7d32' : '#185FA5',
            color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8,
            opacity: saving ? 0.8 : 1, transition: 'background 0.2s',
          }}>
            {saving ? '⏳ Guardando...' : saved ? '✓ Guardado' : '💾 Guardar permisos'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MODAL ROL ──────────────────────────────────────────────────────────────
const ModalRol = ({ rol, onClose, onSave }) => {
  const [form, setForm] = useState({
    id: rol?.id || '',
    name: rol?.name || '',
    descripcion: rol?.descripcion || '',
    estado: rol?.estado ?? 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!rol?.id
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.name) { setError('El nombre del rol es requerido'); return }
    setLoading(true); setError('')
    try { await onSave(form); onClose() }
    catch (e) { setError(e.message || 'Error al guardar') }
    finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h3>{isEdit ? '✏️ Editar Rol' : '➕ Nuevo Rol'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Nombre del Rol *</label>
            <input className="form-control" value={form.name} onChange={e => set('name', e.target.value.toUpperCase())} placeholder="NOMBRE_ROL" disabled={isEdit} />
          </div>
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <input className="form-control" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Descripción del rol" />
          </div>
          <div className="form-group">
            <label className="form-label">Estado</label>
            <select className="form-control" value={form.estado} onChange={e => set('estado', parseInt(e.target.value))}>
              <option value={0}>Activo</option>
              <option value={1}>Inactivo</option>
            </select>
          </div>
          {error && <div style={{ background: '#fce4e4', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>⚠️ {error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <><span className="spinner" />Guardando...</> : isEdit ? '💾 Actualizar' : '➕ Crear Rol'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ROLES PAGE ─────────────────────────────────────────────────────────────
const RolesPage = () => {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [modal, setModal] = useState(null)
  const { toasts, show } = useToast()

  const cargar = async () => {
    setLoading(true)
    try {
      const rs = await apiCall('/qf/roles/listar')
      setRoles(Array.isArray(rs) ? rs : toArray(rs))
    } catch (e) {
      show('Error al cargar roles: ' + e.message, 'error')
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const handleSave = async (form) => {
    const endpoint = form.id ? '/qf/roles/actualizar' : '/qf/roles/crear'
    const res = await apiCall(endpoint, { method: 'POST', body: JSON.stringify(form) })
    if (res !== null && res?.success === false) throw new Error(res.message)
    show(form.id ? 'Rol actualizado correctamente' : 'Rol creado correctamente')
    cargar()
  }

  const handleSavePermisos = async (rolId, permisos) => {
    const claims = Object.entries(permisos).map(([ClaimType, ClaimValue]) => ({ ClaimType, ClaimValue }))
    const res = await apiCall('/qf/roles/permisos/guardar', {
      method: 'POST',
      body: JSON.stringify({ rolId, claims })
    })
    if (res !== null && res?.success === false) throw new Error(res.message || 'Error al guardar permisos')
    show('Permisos guardados correctamente')
  }

  const handleDelete = async (id) => {
    try {
      const res = await apiCall('/qf/roles/eliminar', { method: 'POST', body: JSON.stringify({ id }) })
      if (res !== null && res?.success === false) throw new Error(res.message)
      show('Rol eliminado')
      cargar()
    } catch (e) { show(e.message, 'error') }
    setModal(null)
  }

  const filtrados = roles.filter(r =>
    !filtro || r.name?.toLowerCase().includes(filtro.toLowerCase()) ||
    r.descripcion?.toLowerCase().includes(filtro.toLowerCase())
  )

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Montserrat', fontSize: 22, fontWeight: 700, color: 'var(--qf-navy)', marginBottom: 4 }}>🏷️ Roles</h1>
        <p style={{ color: 'var(--qf-text-light)', fontSize: 13 }}>Gestión de roles y permisos del sistema</p>
      </div>

      <div className="page-card">
        <div className="page-card-header">
          <h2>Lista de Roles</h2>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="filter-input" placeholder="🔍 Filtrar..." value={filtro} onChange={e => setFiltro(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'new' })}>➕ Nuevo Rol</button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner dark" /></div>
          ) : filtrados.length === 0 ? (
            <div className="empty-state"><div className="icon">🏷️</div><p>No se encontraron roles</p></div>
          ) : (
            <table className="qf-table">
              <thead>
                <tr>
                  <th>Rol</th>
                  <th>Descripción</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'center' }}>Usuarios</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(r => (
                  <tr key={r.id}>
                    <td><strong style={{ color: 'var(--qf-navy)', fontFamily: 'Montserrat' }}>{r.name}</strong></td>
                    <td style={{ color: 'var(--qf-text-light)' }}>{r.descripcion || '—'}</td>
                    <td><span className={`badge ${r.estado === 0 ? 'active' : 'inactive'}`}>{r.estado === 0 ? 'Activo' : 'Inactivo'}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ background: '#e8eef5', color: 'var(--qf-navy)', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>
                        {r.totalUsuarios || 0}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setModal({ type: 'permisos', data: r })} title="Permisos">🔐</button>
                        <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'edit', data: r })} title="Editar">✏️</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setModal({ type: 'delete', data: r })} title="Eliminar">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && (
          <div style={{ padding: '12px 24px', borderTop: '1px solid var(--qf-border)', fontSize: 12, color: 'var(--qf-text-light)' }}>
            {filtrados.length} de {roles.length} roles
          </div>
        )}
      </div>

      {/* Modales */}
      {modal?.type === 'new' && <ModalRol onClose={() => setModal(null)} onSave={handleSave} />}
      {modal?.type === 'edit' && <ModalRol rol={modal.data} onClose={() => setModal(null)} onSave={handleSave} />}
      {modal?.type === 'permisos' && (
        <ModalPermisos
          rol={modal.data}
          onClose={() => setModal(null)}
          onSave={handleSavePermisos}
        />
      )}
      {modal?.type === 'delete' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-header">
              <h3>🗑️ Confirmar eliminación</h3>
              <button className="modal-close" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14 }}>¿Está seguro que desea eliminar el rol <strong>{modal.data.name}</strong>?</p>
              {modal.data.totalUsuarios > 0 && (
                <p style={{ fontSize: 13, color: 'var(--qf-red)', marginTop: 8 }}>⚠️ Este rol tiene {modal.data.totalUsuarios} usuario(s) asignado(s).</p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => handleDelete(modal.data.id)}>🗑️ Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RolesPage
