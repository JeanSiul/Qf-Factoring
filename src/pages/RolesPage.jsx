import React, { useState, useEffect } from 'react'
import { apiCall } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'

// ── MAPA COMPLETO DE PERMISOS ──────────────────────────────────────────────
const TABS_PERMISOS = [
  {
    key: "seguridad",
    label: "Seguridad",
    grupos: [
      { claim: "USRLIS", nombre: "Usuario", cols: ["Vista", "Lista", "Ver", "Modificar", "Total", "Password"] },
      { claim: "ROLLIS", nombre: "Rol", cols: ["Vista", "Lista", "Usuarios", "Ver", "Modificar", "Total"] },
    ],
  },
  {
    key: "parametros",
    label: "Parámetros",
    grupos: [
      { claim: "TABLIS", nombre: "Tablas", cols: ["Vista", "Lista", "Elementos", "Ver", "Modificar", "Total"] },
      { claim: "ECOLIS", nombre: "Estructura comercial", cols: ["Vista", "Lista", "Ver", "Modificar", "Total"] },
      { claim: "METLIS", nombre: "Metas", cols: ["Vista", "Lista", "Ver", "Modificar", "Total"] },
    ],
  },
  {
    key: "maestros",
    label: "Maestros",
    grupos: [
      {
        claim: "EMPLIS", nombre: "Empresarios", cols: ["Vista", "Lista", "Lista nuevos", "Ver", "Modificar", "Total"],
        subgrupos: [
          { claim: "EMPPER", nombre: "Datos personales", cols: ["Ver", "Modificar"] },
          { claim: "EMPDOM", nombre: "Domicilio", cols: ["Ver", "Modificar"] },
          { claim: "EMPEMP", nombre: "Datos empresa", cols: ["Ver", "Modificar"] },
          { claim: "EMPREP", nombre: "Representante legal", cols: ["Ver", "Modificar"] },
          { claim: "EMPDOC", nombre: "Documentos", cols: ["Ver", "Modificar"] },
          { claim: "EMPCTA", nombre: "Cuentas bancarias", cols: ["Ver", "Modificar"] },
          { claim: "EMPCON", nombre: "Contraseña", cols: ["Ver", "Modificar"] },
        ],
      },
      {
        claim: "PAGLIS", nombre: "Pagadores", cols: ["Vista", "Lista", "Lista nuevos", "Ver", "Modificar", "Total"],
        subgrupos: [
          { claim: "PAGPER", nombre: "Empresa", cols: ["Ver", "Modificar"] },
          { claim: "PAGCON", nombre: "Personas contacto", cols: ["Ver", "Modificar"] },
          { claim: "PAGHIS", nombre: "Historial y riesgo", cols: ["Ver", "Modificar"] },
        ],
      },
      {
        claim: "INVLIS", nombre: "Inversionistas", cols: ["Vista", "Lista", "Lista nuevos", "Ver", "Modificar", "Total"],
        subgrupos: [
          { claim: "INVPER", nombre: "Datos personales", cols: ["Ver", "Modificar"] },
          { claim: "INVDOM", nombre: "Domicilio", cols: ["Ver", "Modificar"] },
          { claim: "INVEMP", nombre: "Datos empresa", cols: ["Ver", "Modificar"] },
          { claim: "INVREP", nombre: "Representante legal", cols: ["Ver", "Modificar"] },
          { claim: "INVDOC", nombre: "Documentos", cols: ["Ver", "Modificar"] },
          { claim: "INVCTA", nombre: "Cuentas bancarias", cols: ["Ver", "Modificar"] },
          { claim: "INVCON", nombre: "Contraseña", cols: ["Ver", "Modificar"] },
        ],
      },
    ],
  },
  {
    key: "operaciones",
    label: "Operaciones",
    grupos: [
      {
        claim: "FACLIS", nombre: "Facturas", cols: ["Vista", "Lista", "Ver", "Modificar", "Total", "Cargar Excel"],
        subgrupos: [
          { claim: "FACDET", nombre: "Detalle factura", cols: ["Ver", "Modificar"] },
          { claim: "FACDOC", nombre: "Documentos", cols: ["Ver", "Modificar"] },
          { claim: "FACCON", nombre: "Condiciones", cols: ["Ver", "Modificar"] },
        ],
      },
      {
        claim: "OPELIS", nombre: "Operaciones", cols: ["Vista", "Lista", "Trabajar con", "Ver", "Modificar", "Total"],
        subgrupos: [
          { claim: "OPECOM", nombre: "Comercial", cols: ["Ver", "Modificar"] },
          { claim: "OPEOPE", nombre: "Operaciones", cols: ["Ver", "Modificar"] },
          { claim: "OPEFIN", nombre: "Finanzas", cols: ["Ver", "Modificar"] },
          { claim: "OPEADM", nombre: "Administración", cols: ["Ver", "Modificar"] },
          { claim: "OPESEG", nombre: "Seguimiento", cols: ["Ver", "Modificar"] },
        ],
      },
    ],
  },
  {
    key: "configuracion",
    label: "Configuración",
    grupos: [],
  },
]

const strToBits = (str, len) => {
  const bits = []
  for (let i = 0; i < len; i++) bits.push(str?.[i] === '1')
  return bits
}

const bitsToStr = (bits, totalLen = 11) => {
  return bits.map(b => b ? '1' : '0').join('').padEnd(totalLen, '0')
}

const CLAIMS_VACIOS = {
  USRLIS: '00000000000', ROLLIS: '00000000000',
  TABLIS: '00000000000', ECOLIS: '00000000000', METLIS: '00000000000',
  EMPLIS: '00000000000', EMPPER: '00000000000', EMPDOM: '00000000000',
  EMPEMP: '00000000000', EMPREP: '00000000000', EMPDOC: '00000000000',
  EMPCTA: '00000000000', EMPCON: '00000000000',
  PAGLIS: '00000000000', PAGPER: '00000000000', PAGCON: '00000000000', PAGHIS: '00000000000',
  INVLIS: '00000000000', INVPER: '00000000000', INVDOM: '00000000000',
  INVEMP: '00000000000', INVREP: '00000000000', INVDOC: '00000000000',
  INVCTA: '00000000000', INVCON: '00000000000',
  FACLIS: '00000000000', FACDET: '00000000000', FACDOC: '00000000000', FACCON: '00000000000',
  OPELIS: '00000000000', OPECOM: '00000000000', OPEOPE: '00000000000',
  OPEFIN: '00000000000', OPEADM: '00000000000', OPESEG: '00000000000',
}

// ── CHECK ROW ──────────────────────────────────────────────────────────────
const CheckRow = ({ grupo, permisos, onChange, isSubgrupo = false }) => {
  const bits = strToBits(permisos[grupo.claim] || '00000000000', grupo.cols.length)
  const MAX_COLS = 6
  const emptyCols = MAX_COLS - grupo.cols.length

  const toggle = (i) => {
    const newBits = [...bits]
    newBits[i] = !newBits[i]
    onChange(grupo.claim, bitsToStr(newBits))
  }

  return (
    <tr style={{
      borderTop: isSubgrupo ? 'none' : '2px solid #e8eef5',
    }}>
      <td style={{ padding: isSubgrupo ? '4px 10px' : '12px 10px 4px', width: 200 }}>
        {isSubgrupo && <span style={{ color: '#b0bdd0', marginRight: 6, fontSize: 11 }}>↳</span>}
        <span style={{ fontWeight: isSubgrupo ? 500 : 700, color: isSubgrupo ? '#4a5a7a' : '#0a2540', fontSize: isSubgrupo ? 12 : 13 }}>
          {grupo.nombre}
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

// ── MODAL PERMISOS ─────────────────────────────────────────────────────────
const ModalPermisos = ({ rol, onClose, onSave }) => {
  const [activeTab, setActiveTab] = useState('seguridad')
  const [permisos, setPermisos] = useState({ ...CLAIMS_VACIOS })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const cargar = async () => {
      setLoading(true)
      try {
        const res = await apiCall(`/qf/roles/permisos?rolId=${rol.id}`)
        // res debe ser array de {ClaimType, ClaimValue}
        const map = { ...CLAIMS_VACIOS }
        if (Array.isArray(res)) {
          res.forEach(c => { if (map[c.ClaimType] !== undefined) map[c.ClaimType] = c.ClaimValue })
        }
        setPermisos(map)
      } catch (e) {
        console.warn('No se pudieron cargar permisos, usando vacíos')
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

  const tab = TABS_PERMISOS.find(t => t.key === activeTab)

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
        width: '100%', maxWidth: 820, maxHeight: '90vh',
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
            <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>{rol.descripcion}</p>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none',
            color: '#fff', width: 32, height: 32, borderRadius: 8,
            cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid #e8eef5', background: '#f8fafc', flexShrink: 0, overflowX: 'auto' }}>
          {TABS_PERMISOS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              padding: '12px 22px', fontSize: 13, fontWeight: 600,
              color: activeTab === t.key ? '#185FA5' : '#6b7a9a',
              cursor: 'pointer', border: 'none', background: activeTab === t.key ? '#fff' : 'none',
              borderBottom: activeTab === t.key ? '2px solid #185FA5' : '2px solid transparent',
              marginBottom: -2, whiteSpace: 'nowrap', fontFamily: 'inherit',
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
          {loading ? (
            <div style={{ padding: 60, textAlign: 'center' }}><span className="spinner dark" /></div>
          ) : tab?.grupos.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#8a9bb5', fontSize: 13 }}>
              Sin permisos configurados para esta sección
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', color: '#8a9bb5', textTransform: 'uppercase', borderBottom: '1px solid #e8eef5' }}>Módulo</th>
                  {['Vista', 'Lista', 'Col 3', 'Ver', 'Modificar', 'Col 6'].map(c => (
                    <th key={c} style={{ textAlign: 'center', padding: '8px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', color: '#8a9bb5', textTransform: 'uppercase', borderBottom: '1px solid #e8eef5', width: 70 }}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tab?.grupos.map(grupo => (
                  <React.Fragment key={grupo.claim}>
                    <CheckRow grupo={grupo} permisos={permisos} onChange={handleChange} />
                    {grupo.subgrupos?.map(sub => (
                      <CheckRow key={sub.claim} grupo={sub} permisos={permisos} onChange={handleChange} isSubgrupo />
                    ))}
                    <tr><td colSpan={7} style={{ height: 8 }} /></tr>
                  </React.Fragment>
                ))}
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
    estado: rol?.estado ?? 1,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!rol?.id

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.name) { setError('El nombre del rol es requerido'); return }
    setLoading(true); setError('')
    try {
      await onSave(form)
      onClose()
    } catch (e) {
      setError(e.message || 'Error al guardar')
    } finally { setLoading(false) }
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
              <option value={1}>Activo</option>
              <option value={0}>Inactivo</option>
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
      setRoles(rs)
    } catch (e) {
      show('Error al cargar roles: ' + e.message, 'error')
    } finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const handleSave = async (form) => {
    const endpoint = form.id ? '/qf/roles/actualizar' : '/qf/roles/crear'
    const res = await apiCall(endpoint, { method: 'POST', body: JSON.stringify(form) })
    if (!res.success) throw new Error(res.message)
    show(form.id ? 'Rol actualizado correctamente' : 'Rol creado correctamente')
    cargar()
  }

  const handleSavePermisos = async (rolId, permisos) => {
    // Convierte el mapa a array de claims
    const claims = Object.entries(permisos).map(([ClaimType, ClaimValue]) => ({ ClaimType, ClaimValue }))
    const res = await apiCall('/qf/roles/permisos/guardar', {
      method: 'POST',
      body: JSON.stringify({ rolId, claims })
    })
    if (!res.success) throw new Error(res.message || 'Error al guardar permisos')
    show('Permisos guardados correctamente')
  }

  const handleDelete = async (id) => {
    try {
      const res = await apiCall('/qf/roles/eliminar', { method: 'POST', body: JSON.stringify({ id }) })
      if (!res.success) throw new Error(res.message)
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
                    <td><span className={`badge ${r.estado === 1 ? 'active' : 'inactive'}`}>{r.estado === 1 ? 'Activo' : 'Inactivo'}</span></td>
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
