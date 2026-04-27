import { useState } from "react"

// ── MAPA COMPLETO DE PERMISOS ──────────────────────────────────────────────
const TABS = [
  {
    key: "seguridad",
    label: "Seguridad",
    grupos: [
      {
        claim: "USRLIS",
        nombre: "Usuario",
        cols: ["Vista", "Lista", "Ver", "Modificar", "Total", "Password"],
      },
      {
        claim: "ROLLIS",
        nombre: "Rol",
        cols: ["Vista", "Lista", "Usuarios", "Ver", "Modificar", "Total"],
      },
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

// Convierte string "10110000000" → array de bools
const strToBits = (str, len) => {
  const bits = []
  for (let i = 0; i < len; i++) bits.push(str?.[i] === "1")
  return bits
}

// Convierte array de bools → string "10110000000"
const bitsToStr = (bits, totalLen = 11) => {
  const s = bits.map(b => (b ? "1" : "0")).join("")
  return s.padEnd(totalLen, "0")
}

// Mock data inicial
const MOCK_CLAIMS = {
  USRLIS: "00000000000",
  ROLLIS: "11111000000",
  TABLIS: "11111000000",
  ECOLIS: "11001000000",
  METLIS: "00000000000",
  EMPLIS: "11101100000",
  EMPPER: "11000000000",
  EMPDOM: "11000000000",
  EMPEMP: "11000000000",
  EMPREP: "11000000000",
  EMPDOC: "11000000000",
  EMPCTA: "11000000000",
  EMPCON: "00000000000",
  PAGLIS: "11101100000",
  PAGPER: "11000000000",
  PAGCON: "11000000000",
  PAGHIS: "11000000000",
  INVLIS: "00000000000",
  INVPER: "00000000000",
  INVDOM: "00000000000",
  INVEMP: "00000000000",
  INVREP: "00000000000",
  INVDOC: "00000000000",
  INVCTA: "00000000000",
  INVCON: "00000000000",
  FACLIS: "11101100000",
  FACDET: "11000000000",
  FACDOC: "11000000000",
  FACCON: "11000000000",
  OPELIS: "00000000000",
  OPECOM: "00000000000",
  OPEOPE: "00000000000",
  OPEFIN: "00000000000",
  OPEADM: "00000000000",
  OPESEG: "00000000000",
}

// ── CHECKBOX ROW ───────────────────────────────────────────────────────────
const CheckRow = ({ grupo, permisos, onChange, isSubgrupo = false }) => {
  const bits = strToBits(permisos[grupo.claim] || "00000000000", grupo.cols.length)

  const toggle = (i) => {
    const newBits = [...bits]
    newBits[i] = !newBits[i]
    onChange(grupo.claim, bitsToStr(newBits))
  }

  // Max cols para alinear
  const MAX_COLS = 6
  const emptyCols = MAX_COLS - grupo.cols.length

  return (
    <tr className={isSubgrupo ? "subrow" : "mainrow"}>
      <td className="nombre-cell">
        {isSubgrupo && <span className="subindent">↳</span>}
        <span className={isSubgrupo ? "sub-nombre" : "main-nombre"}>{grupo.nombre}</span>
      </td>
      {bits.map((checked, i) => (
        <td key={i} className="check-cell">
          <label className="check-wrap">
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(i)}
              className="custom-check"
            />
            <span className="checkmark" />
          </label>
        </td>
      ))}
      {Array.from({ length: emptyCols }).map((_, i) => (
        <td key={`empty-${i}`} className="check-cell empty-cell" />
      ))}
    </tr>
  )
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function RolPermisos({ rol = { name: "COMERCIAL", descripcion: "Comercial", estado: 1 }, onClose, onSave }) {
  const [activeTab, setActiveTab] = useState("seguridad")
  const [permisos, setPermisos] = useState({ ...MOCK_CLAIMS })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleChange = (claim, value) => {
    setPermisos(p => ({ ...p, [claim]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    await new Promise(r => setTimeout(r, 800))
    setSaving(false)
    setSaved(true)
    onSave?.(permisos)
    setTimeout(() => setSaved(false), 2000)
  }

  const tab = TABS.find(t => t.key === activeTab)

  // Header cols dinámicos según tab
  const allCols = ["Vista", "Lista", "Elementos/Lista nuevos/Trabajar con/Usuarios", "Ver", "Modificar", "Total/Password/Cargar Excel"]
  const headerCols = ["", "Vista", "Lista", "Col 3", "Ver", "Modificar", "Col 6"]

  return (
    <>
      <style>{`
        .rp-overlay {
          position: fixed; inset: 0;
          background: rgba(10,20,40,0.55);
          backdrop-filter: blur(4px);
          z-index: 1000;
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
        }
        .rp-modal {
          background: #fff;
          border-radius: 16px;
          width: 100%; max-width: 820px;
          max-height: 90vh;
          display: flex; flex-direction: column;
          box-shadow: 0 24px 80px rgba(0,0,0,0.18);
          overflow: hidden;
          font-family: 'Montserrat', sans-serif;
        }
        .rp-header {
          background: linear-gradient(135deg, #0a2540 0%, #185FA5 100%);
          padding: 20px 28px;
          display: flex; align-items: center; justify-content: space-between;
          flex-shrink: 0;
        }
        .rp-header-info h2 {
          margin: 0; color: #fff;
          font-size: 18px; font-weight: 700; letter-spacing: 0.5px;
        }
        .rp-header-info p {
          margin: 2px 0 0; color: rgba(255,255,255,0.65); font-size: 12px;
        }
        .rp-close {
          background: rgba(255,255,255,0.15); border: none;
          color: #fff; width: 32px; height: 32px; border-radius: 8px;
          cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center;
          transition: background 0.2s;
        }
        .rp-close:hover { background: rgba(255,255,255,0.25); }
        .rp-tabs {
          display: flex; border-bottom: 2px solid #e8eef5;
          background: #f8fafc; flex-shrink: 0; overflow-x: auto;
        }
        .rp-tab {
          padding: 12px 22px; font-size: 13px; font-weight: 600;
          color: #6b7a9a; cursor: pointer; border: none; background: none;
          border-bottom: 2px solid transparent; margin-bottom: -2px;
          white-space: nowrap; transition: all 0.2s;
        }
        .rp-tab:hover { color: #185FA5; }
        .rp-tab.active { color: #185FA5; border-bottom-color: #185FA5; background: #fff; }
        .rp-body {
          flex: 1; overflow-y: auto; padding: 0;
        }
        .rp-table-wrap { padding: 20px 28px; }
        .rp-table {
          width: 100%; border-collapse: collapse;
          font-size: 13px;
        }
        .rp-table thead tr th {
          padding: 8px 10px; text-align: center;
          font-size: 10px; font-weight: 700; letter-spacing: 0.8px;
          color: #8a9bb5; text-transform: uppercase;
          border-bottom: 1px solid #e8eef5;
        }
        .rp-table thead tr th:first-child { text-align: left; }
        .rp-table tr.mainrow { border-top: 2px solid #e8eef5; }
        .rp-table tr.mainrow:first-child { border-top: none; }
        .rp-table tr.mainrow td { padding: 12px 10px 4px; }
        .rp-table tr.subrow td { padding: 4px 10px; }
        .nombre-cell { width: 200px; }
        .main-nombre {
          font-weight: 700; color: #0a2540; font-size: 13px;
        }
        .sub-nombre {
          font-weight: 500; color: #4a5a7a; font-size: 12px;
        }
        .subindent { color: #b0bdd0; margin-right: 6px; font-size: 11px; }
        .check-cell { text-align: center; width: 70px; }
        .empty-cell { opacity: 0; pointer-events: none; }
        .check-wrap {
          display: inline-flex; align-items: center; justify-content: center;
          cursor: pointer; position: relative;
        }
        .custom-check { position: absolute; opacity: 0; width: 0; height: 0; }
        .checkmark {
          width: 18px; height: 18px; border-radius: 5px;
          border: 2px solid #c8d5e8; background: #fff;
          transition: all 0.15s; display: block;
        }
        .custom-check:checked + .checkmark {
          background: #185FA5; border-color: #185FA5;
        }
        .custom-check:checked + .checkmark::after {
          content: ''; position: absolute;
          left: 5px; top: 2px;
          width: 5px; height: 9px;
          border: 2px solid #fff; border-top: none; border-left: none;
          transform: rotate(45deg);
        }
        .check-wrap:hover .checkmark { border-color: #185FA5; }
        .empty-state {
          padding: 60px; text-align: center;
          color: #8a9bb5; font-size: 13px;
        }
        .rp-footer {
          padding: 16px 28px;
          border-top: 1px solid #e8eef5;
          display: flex; justify-content: flex-end; gap: 10px;
          background: #f8fafc; flex-shrink: 0;
        }
        .btn-cancel {
          padding: 9px 20px; border-radius: 8px;
          border: 1px solid #c8d5e8; background: #fff;
          color: #4a5a7a; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: inherit;
          transition: all 0.15s;
        }
        .btn-cancel:hover { background: #f0f4f8; }
        .btn-save {
          padding: 9px 24px; border-radius: 8px;
          border: none; background: #185FA5;
          color: #fff; font-size: 13px; font-weight: 700;
          cursor: pointer; font-family: inherit;
          transition: all 0.2s; display: flex; align-items: center; gap: 8px;
        }
        .btn-save:hover { background: #0f4a8a; }
        .btn-save.saved { background: #2e7d32; }
        .btn-save:disabled { opacity: 0.7; cursor: not-allowed; }
        .spinner-sm {
          width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff; border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .grupo-sep { height: 8px; }
      `}</style>

      <div className="rp-overlay" onClick={e => e.target === e.currentTarget && onClose?.()}>
        <div className="rp-modal">
          {/* Header */}
          <div className="rp-header">
            <div className="rp-header-info">
              <h2>🏷️ {rol.name}</h2>
              <p>{rol.descripcion} · Gestión de permisos</p>
            </div>
            <button className="rp-close" onClick={onClose}>×</button>
          </div>

          {/* Tabs */}
          <div className="rp-tabs">
            {TABS.map(t => (
              <button
                key={t.key}
                className={`rp-tab ${activeTab === t.key ? "active" : ""}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="rp-body">
            {tab?.grupos.length === 0 ? (
              <div className="empty-state">Sin permisos configurados para esta sección</div>
            ) : (
              <div className="rp-table-wrap">
                <table className="rp-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Módulo</th>
                      <th>Vista</th>
                      <th>Lista</th>
                      <th>Col 3</th>
                      <th>Ver</th>
                      <th>Modificar</th>
                      <th>Col 6</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tab?.grupos.map(grupo => (
                      <>
                        <CheckRow key={grupo.claim} grupo={grupo} permisos={permisos} onChange={handleChange} />
                        {grupo.subgrupos?.map(sub => (
                          <CheckRow key={sub.claim} grupo={sub} permisos={permisos} onChange={handleChange} isSubgrupo />
                        ))}
                        <tr className="grupo-sep"><td colSpan={7} /></tr>
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="rp-footer">
            <button className="btn-cancel" onClick={onClose}>Cancelar</button>
            <button
              className={`btn-save ${saved ? "saved" : ""}`}
              onClick={handleSave}
              disabled={saving}
            >
              {saving
                ? <><div className="spinner-sm" />Guardando...</>
                : saved
                  ? "✓ Guardado"
                  : "💾 Guardar permisos"
              }
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
