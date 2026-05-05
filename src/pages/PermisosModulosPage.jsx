import React, { useState, useEffect } from 'react'
import { apiCall, toArray } from '../utils/api'
import { useToast } from '../hooks/useToast'
import ToastContainer from '../components/ToastContainer'
import { useAuth } from '../context/AuthContext'

// ── MODAL MÓDULO ───────────────────────────────────────────────────────────
const ModalModulo = ({ modulo, grupos, padres, onClose, onSave }) => {
  const [form, setForm] = useState({
    id: modulo?.id || '',
    codigo: modulo?.codigo || '',
    nombre: modulo?.nombre || '',
    grupo: modulo?.grupo || grupos[0] || '',
    grupo_orden: modulo?.grupo_orden ?? 0,
    padre_codigo: modulo?.padre_codigo || '',
    ruta: modulo?.ruta || '',
    bits_config: '',
    orden: modulo?.orden ?? 0,
    activo: modulo?.activo ?? 1,
  })
  const [bitsArray, setBitsArray] = useState([])
  const [newBit, setNewBit] = useState('')
  const [nuevoGrupo, setNuevoGrupo] = useState('')
  const [usarNuevoGrupo, setUsarNuevoGrupo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const isEdit = !!modulo?.id

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    if (modulo?.bits_config) {
      try {
        const parsed = typeof modulo.bits_config === 'string' ? JSON.parse(modulo.bits_config) : modulo.bits_config
        setBitsArray(Array.isArray(parsed) ? parsed : [])
      } catch { setBitsArray([]) }
    }
  }, [modulo])

  const addBit = () => {
    if (!newBit.trim()) return
    if (bitsArray.includes(newBit.trim())) { setError('Esa acción ya existe'); return }
    setBitsArray(b => [...b, newBit.trim()])
    setNewBit('')
    setError('')
  }

  const removeBit = (idx) => setBitsArray(b => b.filter((_, i) => i !== idx))
  const moveBit = (idx, dir) => {
    const arr = [...bitsArray]
    const target = idx + dir
    if (target < 0 || target >= arr.length) return
    ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
    setBitsArray(arr)
  }

  const handleSubmit = async () => {
    const grupo = usarNuevoGrupo ? nuevoGrupo.trim() : form.grupo
    if (!form.codigo || !form.nombre || !grupo) { setError('Código, nombre y grupo son requeridos'); return }
    if (bitsArray.length === 0) { setError('Agrega al menos una acción (bit)'); return }
    setLoading(true); setError('')
    try {
      await onSave({
        ...form,
        grupo,
        bits_config: JSON.stringify(bitsArray),
        padre_codigo: form.padre_codigo || null,
        ruta: form.ruta || null,
      })
      onClose()
    } catch (e) { setError(e.message || 'Error al guardar') }
    finally { setLoading(false) }
  }

  const accionesComunes = ['Vista', 'Lista', 'Ver', 'Modificar', 'Total', 'Crear', 'Eliminar', 'Exportar', 'Importar', 'Asignar', 'Reasignar', 'Devolver', 'Password', 'Generar']

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h3>{isEdit ? '✏️ Editar Módulo' : '➕ Nuevo Módulo de Permisos'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Código y Nombre */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0 16px' }}>
            <div className="form-group">
              <label className="form-label">Código *</label>
              <input className="form-control" value={form.codigo} onChange={e => set('codigo', e.target.value.toUpperCase())} placeholder="USRLIS" disabled={isEdit} maxLength={20} />
              <small style={{ color: 'var(--qf-text-light)', fontSize: 10 }}>Inmutable una vez creado. Máx 20 chars.</small>
            </div>
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input className="form-control" value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Usuarios, Facturas, Items..." />
            </div>
          </div>

          {/* Grupo */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0 16px' }}>
            <div className="form-group">
              <label className="form-label">
                Grupo/Sección *
                <button onClick={() => setUsarNuevoGrupo(!usarNuevoGrupo)} style={{ marginLeft: 8, fontSize: 10, color: '#185FA5', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  {usarNuevoGrupo ? 'Usar existente' : '+ Nuevo grupo'}
                </button>
              </label>
              {usarNuevoGrupo ? (
                <input className="form-control" value={nuevoGrupo} onChange={e => setNuevoGrupo(e.target.value)} placeholder="Nombre del nuevo grupo..." />
              ) : (
                <select className="form-control" value={form.grupo} onChange={e => set('grupo', e.target.value)}>
                  {grupos.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Orden Grupo</label>
              <input className="form-control" type="number" value={form.grupo_orden} onChange={e => set('grupo_orden', parseInt(e.target.value) || 0)} min={0} />
            </div>
          </div>

          {/* Padre y Ruta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <div className="form-group">
              <label className="form-label">Módulo Padre (si es sub-módulo)</label>
              <select className="form-control" value={form.padre_codigo} onChange={e => set('padre_codigo', e.target.value)}>
                <option value="">— Ninguno (módulo principal) —</option>
                {padres.map(p => <option key={p.codigo} value={p.codigo}>{p.nombre} ({p.codigo})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Ruta Frontend</label>
              <input className="form-control" value={form.ruta} onChange={e => set('ruta', e.target.value)} placeholder="/inventario/items" />
              <small style={{ color: 'var(--qf-text-light)', fontSize: 10 }}>Solo módulos principales. Sub-módulos heredan del padre.</small>
            </div>
          </div>

          {/* Orden y Estado */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <div className="form-group">
              <label className="form-label">Orden (dentro del grupo)</label>
              <input className="form-control" type="number" value={form.orden} onChange={e => set('orden', parseInt(e.target.value) || 0)} min={0} />
            </div>
            <div className="form-group">
              <label className="form-label">Estado</label>
              <select className="form-control" value={form.activo} onChange={e => set('activo', parseInt(e.target.value))}>
                <option value={1}>Activo</option>
                <option value={0}>Inactivo</option>
              </select>
            </div>
          </div>

          {/* Bits/Acciones */}
          <div className="form-group">
            <label className="form-label">
              Acciones (bits de permisos) *
              <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--qf-text-light)' }}>Cada acción = 1 bit en el ClaimValue</span>
            </label>

            {/* Acciones actuales */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10, minHeight: 36, padding: '8px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid var(--qf-border)' }}>
              {bitsArray.length === 0 ? (
                <span style={{ color: 'var(--qf-text-light)', fontSize: 12 }}>Sin acciones — agrega al menos una</span>
              ) : (
                bitsArray.map((bit, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#185FA5', color: '#fff', borderRadius: 6, padding: '3px 4px 3px 10px', fontSize: 11, fontWeight: 600 }}>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginRight: 4 }}>#{idx}</span>
                    {bit}
                    <button onClick={() => moveBit(idx, -1)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: 3, padding: '0 3px', fontSize: 10 }} title="Mover izquierda">◀</button>
                    <button onClick={() => moveBit(idx, 1)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: 3, padding: '0 3px', fontSize: 10 }} title="Mover derecha">▶</button>
                    <button onClick={() => removeBit(idx)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', cursor: 'pointer', borderRadius: 3, padding: '0 4px', fontSize: 12, fontWeight: 700 }} title="Eliminar">×</button>
                  </div>
                ))
              )}
            </div>

            {/* Agregar acción */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
              <input className="form-control" value={newBit} onChange={e => setNewBit(e.target.value)} onKeyDown={e => e.key === 'Enter' && addBit()} placeholder="Nombre de la acción..." style={{ flex: 1 }} />
              <button className="btn btn-primary btn-sm" onClick={addBit}>➕ Agregar</button>
            </div>

            {/* Acciones rápidas */}
            <div style={{ fontSize: 10, color: 'var(--qf-text-light)', marginBottom: 6 }}>Acciones comunes (click para agregar):</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {accionesComunes.filter(a => !bitsArray.includes(a)).map(a => (
                <button key={a} onClick={() => setBitsArray(b => [...b, a])} style={{ background: '#e8eef5', color: 'var(--qf-navy)', border: '1px solid var(--qf-border)', borderRadius: 4, padding: '2px 8px', fontSize: 10, cursor: 'pointer', fontWeight: 500 }}>
                  + {a}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div style={{ background: '#f0f7ff', borderRadius: 8, padding: '10px 14px', border: '1px solid #c8ddf5', marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#185FA5', marginBottom: 4, textTransform: 'uppercase' }}>Preview del ClaimValue</div>
            <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#0a2540' }}>
              {bitsArray.map((_, i) => '0').join('').padEnd(11, '0') || '00000000000'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--qf-text-light)', marginTop: 2 }}>
              {bitsArray.map((b, i) => `${i}=${b}`).join(' | ')}
            </div>
          </div>

          {error && <div style={{ background: '#fce4e4', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>⚠️ {error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <><span className="spinner" />Guardando...</> : isEdit ? '💾 Actualizar' : '➕ Crear Módulo'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────
const PermisosModulosPage = () => {
  const { user } = useAuth()
  const [modulos, setModulos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [filtroGrupo, setFiltroGrupo] = useState('todos')
  const [modal, setModal] = useState(null)
  const { toasts, show } = useToast()

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await apiCall('/qf/permisos/modulos/listar')
      setModulos(toArray(res))
    } catch (e) { show('Error al cargar módulos: ' + e.message, 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { cargar() }, [])

  const handleSave = async (form) => {
    const endpoint = form.id ? '/qf/permisos/modulos/actualizar' : '/qf/permisos/modulos/crear'
    const res = await apiCall(endpoint, {
      method: 'POST',
      body: JSON.stringify({ ...form, usr_crea: user?.username || 'SISTEMA' })
    })
    // n8n puede devolver null, 1, o {success:true}
    if (res !== null && res?.success === false) throw new Error(res?.message || 'Error al guardar')
    show(form.id ? 'Módulo actualizado' : 'Módulo creado')
    cargar()
  }

  const handleEliminar = async (modulo) => {
    const hijos = modulos.filter(m => m.padre_codigo === modulo.codigo)
    if (hijos.length > 0) {
      show(`No se puede eliminar: tiene ${hijos.length} sub-módulo(s) asociado(s)`, 'error')
      return
    }
    if (!confirm(`¿Eliminar el módulo "${modulo.nombre}" (${modulo.codigo})?`)) return
    try {
      const res = await apiCall('/qf/permisos/modulos/eliminar', { method: 'POST', body: JSON.stringify({ id: modulo.id }) })
      if (res !== null && res?.success === false) throw new Error(res?.message || 'Error al eliminar')
      show('Módulo eliminado')
      cargar()
    } catch (e) { show(e.message, 'error') }
  }

  // Obtener grupos únicos
  const gruposUnicos = [...new Set(modulos.map(m => m.grupo))].sort((a, b) => {
    const oa = modulos.find(m => m.grupo === a)?.grupo_orden || 0
    const ob = modulos.find(m => m.grupo === b)?.grupo_orden || 0
    return oa - ob
  })

  // Padres posibles (módulos sin padre)
  const padres = modulos.filter(m => !m.padre_codigo)

  // Filtrar
  const filtrados = modulos.filter(m => {
    const matchGrupo = filtroGrupo === 'todos' || m.grupo === filtroGrupo
    const matchFiltro = !filtro || m.codigo?.toLowerCase().includes(filtro.toLowerCase()) || m.nombre?.toLowerCase().includes(filtro.toLowerCase()) || m.grupo?.toLowerCase().includes(filtro.toLowerCase())
    return matchGrupo && matchFiltro
  })

  // Agrupar para mostrar
  const gruposAgrupados = gruposUnicos.filter(g => filtroGrupo === 'todos' || g === filtroGrupo).map(g => ({
    nombre: g,
    orden: modulos.find(m => m.grupo === g)?.grupo_orden || 0,
    modulos: filtrados.filter(m => m.grupo === g).sort((a, b) => a.orden - b.orden)
  })).filter(g => g.modulos.length > 0)

  const parseBits = (bits_config) => {
    try {
      const parsed = typeof bits_config === 'string' ? JSON.parse(bits_config) : bits_config
      return Array.isArray(parsed) ? parsed : []
    } catch { return [] }
  }

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} />
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'Montserrat', fontSize: 22, fontWeight: 700, color: 'var(--qf-navy)', marginBottom: 4 }}>⚙️ Módulos de Permisos</h1>
        <p style={{ color: 'var(--qf-text-light)', fontSize: 13 }}>Define los módulos del sistema y las acciones que se pueden controlar por rol</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total módulos', value: modulos.length, color: 'var(--qf-navy)', border: '#2196f3' },
          { label: 'Grupos', value: gruposUnicos.length, color: '#5e35b1', border: '#7e57c2' },
          { label: 'Principales', value: modulos.filter(m => !m.padre_codigo).length, color: '#2e7d32', border: '#4caf50' },
          { label: 'Sub-módulos', value: modulos.filter(m => m.padre_codigo).length, color: '#e65100', border: '#ff9800' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderTop: `3px solid ${s.border}` }}>
            <div style={{ fontSize: 10, color: 'var(--qf-text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, fontFamily: 'Montserrat', lineHeight: 1.2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="page-card">
        <div className="page-card-header">
          <h2>Módulos del Sistema</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="filter-input" value={filtroGrupo} onChange={e => setFiltroGrupo(e.target.value)} style={{ width: 'auto', minWidth: 140 }}>
              <option value="todos">Todos los grupos</option>
              {gruposUnicos.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <input className="filter-input" placeholder="🔍 Filtrar..." value={filtro} onChange={e => setFiltro(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'nuevo' })}>➕ Nuevo Módulo</button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner dark" /></div>
          ) : gruposAgrupados.length === 0 ? (
            <div className="empty-state"><div className="icon">⚙️</div><p>No se encontraron módulos</p></div>
          ) : (
            gruposAgrupados.map(grupo => (
              <div key={grupo.nombre}>
                {/* Grupo header */}
                <div style={{ padding: '12px 20px', background: '#f0f4f8', borderBottom: '2px solid #e8eef5', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--qf-navy)', fontFamily: 'Montserrat' }}>{grupo.nombre}</span>
                  <span style={{ fontSize: 10, color: 'var(--qf-text-light)', background: '#e8eef5', borderRadius: 20, padding: '2px 8px', fontWeight: 600 }}>
                    Orden: {grupo.orden} · {grupo.modulos.length} módulo(s)
                  </span>
                </div>
                <table className="qf-table">
                  <thead>
                    <tr>
                      <th style={{ width: 30 }}></th>
                      <th>Código</th>
                      <th>Nombre</th>
                      <th>Ruta</th>
                      <th>Acciones (bits)</th>
                      <th>Orden</th>
                      <th>Estado</th>
                      <th style={{ textAlign: 'center' }}>Opciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.modulos.map(m => {
                      const bits = parseBits(m.bits_config)
                      const esPadre = !m.padre_codigo
                      return (
                        <tr key={m.id} style={{ background: esPadre ? '#fff' : '#fafbfd' }}>
                          <td style={{ width: 30, textAlign: 'center', color: '#b0bdd0', fontSize: 11 }}>
                            {!esPadre && '↳'}
                          </td>
                          <td>
                            <code style={{ background: esPadre ? '#e8eef5' : '#f0f4f8', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, color: 'var(--qf-navy)' }}>
                              {m.codigo}
                            </code>
                          </td>
                          <td style={{ fontWeight: esPadre ? 700 : 500, color: esPadre ? 'var(--qf-navy)' : '#4a5a7a', fontSize: esPadre ? 13 : 12 }}>
                            {m.nombre}
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--qf-text-light)', fontFamily: 'monospace' }}>
                            {m.ruta || '—'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                              {bits.map((b, i) => (
                                <span key={i} style={{ background: '#e8eef5', color: 'var(--qf-navy)', borderRadius: 3, padding: '1px 6px', fontSize: 9, fontWeight: 600 }}>
                                  {i}:{b}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', fontSize: 12, color: 'var(--qf-text-light)' }}>{m.orden}</td>
                          <td>
                            <span className={`badge ${m.activo ? 'active' : 'inactive'}`}>
                              {m.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                              <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'editar', data: m })} title="Editar">✏️</button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleEliminar(m)} title="Eliminar">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>

        {!loading && (
          <div style={{ padding: '12px 24px', borderTop: '1px solid var(--qf-border)', fontSize: 12, color: 'var(--qf-text-light)' }}>
            {filtrados.length} de {modulos.length} módulos
          </div>
        )}
      </div>

      {/* Modales */}
      {modal?.type === 'nuevo' && (
        <ModalModulo
          grupos={gruposUnicos}
          padres={padres}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
      {modal?.type === 'editar' && (
        <ModalModulo
          modulo={modal.data}
          grupos={gruposUnicos}
          padres={padres}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}

export default PermisosModulosPage
