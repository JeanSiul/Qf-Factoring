import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  AreaChart,
  Area,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import ReactECharts from 'echarts-for-react'
import { apiCall, toArray } from '../../utils/api'
import ToastContainer from '../../components/ToastContainer'
import { useToast } from '../../hooks/useToast'
import './GerenciaPowerBI.css'

// Endpoint recomendado para replicar el PBIX desde MySQL.
// Debe devolver columnas equivalentes a las detectadas en el PBIX:
// Valor Nominal, Ingreso Qipu Nominal, Meta, Meta Ingresos, Fecha de Desembolso,
// Responsable Comercial, Partner / Fondeo, Pagador, Cliente, Sector Pagador, etc.
const PRIMARY_ENDPOINT = '/qf/gerencia/comercial/listar'

// Fallback para que la página cargue con datos reales ya existentes si aún no creaste el endpoint gerencial.
const FALLBACK_ENDPOINT = '/qf/ops/billings/listar'

const COLORS = ['#38bdf8', '#7c3aed', '#22c55e', '#f59e0b', '#ef4444', '#14b8a6', '#6366f1', '#ec4899']
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const get = (obj, keys, fallback = '') => {
  for (const k of keys) {
    if (obj?.[k] !== undefined && obj?.[k] !== null && String(obj[k]).trim() !== '') return obj[k]
    const low = String(k).toLowerCase()
    const up = String(k).toUpperCase()
    if (obj?.[low] !== undefined && obj?.[low] !== null && String(obj[low]).trim() !== '') return obj[low]
    if (obj?.[up] !== undefined && obj?.[up] !== null && String(obj[up]).trim() !== '') return obj[up]
  }
  return fallback
}

const num = v => Number(String(v ?? 0).replace(/,/g, '')) || 0
const money = v => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 0 }).format(num(v))
const compact = v => new Intl.NumberFormat('es-PE', { notation: 'compact', maximumFractionDigits: 1 }).format(num(v))
const pct = (v, t) => t ? Math.round((num(v) / num(t)) * 1000) / 10 : 0
const norm = v => String(v ?? '').trim().toLowerCase()

const parseDate = value => {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function normalizeRow(r) {
  const fecha = parseDate(get(r, ['Fecha de Desembolso', 'fecha_desembolso', 'date_payout', 'date_payment', 'date_emission', 'created_at']))
  const valorNominal = num(get(r, ['Valor Nominal', 'valor_nominal', 'net_amount', 'amount', 'monto', 'importe']))
  const ingresoQipu = num(get(r, ['Ingreso Qipu Nominal', 'ingreso_qipu_nominal', 'commission', 'comision']))
  const meta = num(get(r, ['Meta', 'meta_colocacion', 'meta']))
  const metaIngresos = num(get(r, ['Meta Ingresos', 'meta_ingresos']))
  return {
    ...r,
    _id: get(r, ['id', 'billing_id', 'numero_operacion']),
    _fecha: fecha,
    _year: fecha ? String(fecha.getFullYear()) : String(get(r, ['Año', 'anio', 'year'], 'Sin año')),
    _month: fecha ? MONTHS[fecha.getMonth()] : String(get(r, ['Mes', 'mes', 'month'], 'Sin mes')),
    _monthIndex: fecha ? fecha.getMonth() : 99,
    _lider: get(r, ['Responsable Comercial', 'responsable_comercial', 'commercial_name', 'commercial', 'comercial'], 'Sin líder'),
    _origen: get(r, ['Origen', 'origen'], 'Sin origen'),
    _fondo: get(r, ['Partner / Fondeo', 'partner_fondeo', 'partner', 'fund', 'fondo'], 'Sin fondo'),
    _cliente: get(r, ['Cliente', 'cliente', 'company_name', 'client', 'userId'], 'Sin cliente'),
    _pagador: get(r, ['Pagador', 'pagador', 'name_debtor', 'payer', 'payerId'], 'Sin pagador'),
    _sectorPagador: get(r, ['Sector Pagador', 'sector_pagador', 'sector'], 'Sin sector'),
    _clienteNuevo: get(r, ['Cliente Nuevo', 'cliente_nuevo'], ''),
    _facturas: num(get(r, ['Número facturas', 'numero_facturas', 'cantidad_facturas'], 1)) || 1,
    _plazo: num(get(r, ['Nro de Dias (Plazo)', 'nro_dias_plazo', 'n_days', 'dias'])),
    _valorNominal: valorNominal,
    _ingresoQipu: ingresoQipu,
    _meta: meta,
    _metaIngresos: metaIngresos,
    _tasaPond: num(get(r, ['Tasa pond 1', 'tasa_pond_1', 'Tasa Total', 'tasa_total'])),
    _temQipu: num(get(r, ['TEM Qipu ponde 1', 'tem_qipu_ponde_1'])),
    _temFondo: num(get(r, ['TEM fondo pond 1', 'tem_fondo_pond_1'])),
    _comisionPond: num(get(r, ['Comision pond 1', 'comision_pond_1'])),
    _ade: num(get(r, ['% Ade', 'ade'])),
  }
}

function groupBy(rows, key) {
  const map = {}
  rows.forEach(r => {
    const name = typeof key === 'function' ? key(r) : r[key]
    const k = name || 'Sin dato'
    if (!map[k]) map[k] = { name: k, valor: 0, ingreso: 0, meta: 0, metaIngresos: 0, count: 0, tasa: 0, temQipu: 0, temFondo: 0, comisionPond: 0 }
    map[k].valor += r._valorNominal
    map[k].ingreso += r._ingresoQipu
    map[k].meta += r._meta
    map[k].metaIngresos += r._metaIngresos
    map[k].count += 1
    map[k].tasa += r._tasaPond
    map[k].temQipu += r._temQipu
    map[k].temFondo += r._temFondo
    map[k].comisionPond += r._comisionPond
  })
  return Object.values(map).map(x => ({
    ...x,
    tasa: x.count ? x.tasa / x.count : 0,
    temQipu: x.count ? x.temQipu / x.count : 0,
    temFondo: x.count ? x.temFondo / x.count : 0,
    comisionPond: x.count ? x.comisionPond / x.count : 0,
  })).sort((a, b) => b.valor - a.valor)
}

export default function GerenciaPowerBIReplica() {
  const { toasts, show } = useToast()
  const [rawRows, setRawRows] = useState([])
  const [source, setSource] = useState(PRIMARY_ENDPOINT)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('indicadores')
  const [year, setYear] = useState('Todos')
  const [month, setMonth] = useState('Todos')
  const [leader, setLeader] = useState('Todos')
  const [fondo, setFondo] = useState('Todos')
  const [cross, setCross] = useState(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let res
      let used = PRIMARY_ENDPOINT
      try {
        res = await apiCall(`${PRIMARY_ENDPOINT}?page=1&pageSize=5000`)
      } catch (_) {
        used = FALLBACK_ENDPOINT
        res = await apiCall(`${FALLBACK_ENDPOINT}?page=1&pageSize=5000`)
      }
      const arr = Array.isArray(res) ? res : (res?.data || res?.items || res?.rows || [])
      setRawRows(toArray(arr).map(normalizeRow))
      setSource(used)
    } catch (e) {
      setError(e.message || 'No se pudo cargar información')
      show('Error cargando réplica Power BI: ' + (e.message || ''), 'error')
    } finally {
      setLoading(false)
    }
  }, [show])

  useEffect(() => { cargar() }, [cargar])

  const years = useMemo(() => ['Todos', ...Array.from(new Set(rawRows.map(r => r._year).filter(Boolean))).sort().reverse()], [rawRows])
  const leaders = useMemo(() => ['Todos', ...Array.from(new Set(rawRows.map(r => r._lider).filter(Boolean))).sort()], [rawRows])
  const fondos = useMemo(() => ['Todos', ...Array.from(new Set(rawRows.map(r => r._fondo).filter(Boolean))).sort()], [rawRows])

  const rows = useMemo(() => rawRows.filter(r => {
    const okYear = year === 'Todos' || r._year === year
    const okMonth = month === 'Todos' || r._month === month
    const okLeader = leader === 'Todos' || r._lider === leader
    const okFondo = fondo === 'Todos' || r._fondo === fondo
    const okCross = !cross || Object.entries(cross).every(([k, v]) => String(r[k]) === String(v))
    return okYear && okMonth && okLeader && okFondo && okCross
  }), [rawRows, year, month, leader, fondo, cross])

  const resumen = useMemo(() => {
    const valor = rows.reduce((s, r) => s + r._valorNominal, 0)
    const ingreso = rows.reduce((s, r) => s + r._ingresoQipu, 0)
    const meta = rows.reduce((s, r) => s + r._meta, 0)
    const metaIngresos = rows.reduce((s, r) => s + r._metaIngresos, 0)
    const facturas = rows.reduce((s, r) => s + r._facturas, 0)
    const clientes = new Set(rows.map(r => r._cliente).filter(Boolean)).size
    const pagadores = new Set(rows.map(r => r._pagador).filter(Boolean)).size
    const plazo = rows.length ? Math.round(rows.reduce((s, r) => s + r._plazo, 0) / rows.length) : 0
    const tasa = rows.length ? rows.reduce((s, r) => s + r._tasaPond, 0) / rows.length : 0
    const temQipu = rows.length ? rows.reduce((s, r) => s + r._temQipu, 0) / rows.length : 0
    const temFondo = rows.length ? rows.reduce((s, r) => s + r._temFondo, 0) / rows.length : 0
    const comision = rows.length ? rows.reduce((s, r) => s + r._comisionPond, 0) / rows.length : 0
    return { valor, ingreso, meta, metaIngresos, facturas, clientes, pagadores, plazo, tasa, temQipu, temFondo, comision }
  }, [rows])

  const mensual = useMemo(() => {
    const arr = groupBy(rows, r => `${String(r._monthIndex).padStart(2, '0')}-${r._month}`)
    return arr.sort((a, b) => a.name.localeCompare(b.name)).map(x => ({ ...x, mes: x.name.split('-').slice(1).join('-') }))
  }, [rows])

  const byFondo = useMemo(() => groupBy(rows, '_fondo'), [rows])
  const byPagador = useMemo(() => groupBy(rows, '_pagador').slice(0, 12), [rows])
  const byCliente = useMemo(() => groupBy(rows, '_cliente').slice(0, 12), [rows])
  const bySector = useMemo(() => groupBy(rows, '_sectorPagador'), [rows])

  const limpiar = () => {
    setYear('Todos')
    setMonth('Todos')
    setLeader('Todos')
    setFondo('Todos')
    setCross(null)
  }

  return (
    <div className="qf-pbi-page qf-pbi-dark fade-in">
      <ToastContainer toasts={toasts} />

      <header className="qf-pbi-hero dark">
        <div>
          <div className="qf-pbi-eyebrow">QF Factoring · Réplica React</div>
          <h1>Resumen Comercial</h1>
          <p>Réplica React de las pestañas detectadas en el PBIX: Indicadores, Fondos y Clientes/Pagadores.</p>
        </div>

        <div className="qf-pbi-actions">
          <button className="btn btn-secondary btn-sm" onClick={cargar} disabled={loading}>{loading ? 'Cargando...' : 'Actualizar'}</button>
          <button className="btn btn-secondary btn-sm" onClick={limpiar}>Limpiar</button>
        </div>
      </header>

      <section className="qf-pbi-filterbar">
        <Filter label="Año" value={year} onChange={setYear} options={years} />
        <Filter label="Mes" value={month} onChange={setMonth} options={['Todos', ...MONTHS]} />
        <Filter label="Líder" value={leader} onChange={setLeader} options={leaders} />
        <Filter label="Fondo" value={fondo} onChange={setFondo} options={fondos} />
        <div className="qf-pbi-source">Fuente: <b>{source}</b></div>
      </section>

      {error && <div className="qf-pbi-error">{error}</div>}
      {cross && <div className="qf-pbi-note dark"><button onClick={() => setCross(null)}>x</button>Filtro cruzado activo: <b>{Object.values(cross)[0]}</b></div>}

      <nav className="qf-pbi-tabs">
        <button className={tab === 'indicadores' ? 'active' : ''} onClick={() => setTab('indicadores')}>Indicadores</button>
        <button className={tab === 'fondos' ? 'active' : ''} onClick={() => setTab('fondos')}>Fondos</button>
        <button className={tab === 'clientes' ? 'active' : ''} onClick={() => setTab('clientes')}>Clientes/Pagadores</button>
      </nav>

      {loading ? <div className="qf-pbi-loading">Cargando datos MySQL...</div> : (
        <>
          {tab === 'indicadores' && <Indicadores resumen={resumen} mensual={mensual} rows={rows} />}
          {tab === 'fondos' && <Fondos byFondo={byFondo} mensual={mensual} setCross={setCross} />}
          {tab === 'clientes' && <Clientes byPagador={byPagador} byCliente={byCliente} bySector={bySector} rows={rows} />}
        </>
      )}
    </div>
  )
}

function Indicadores({ resumen, mensual, rows }) {
  return (
    <div className="qf-pbi-grid indicadores">
      <MetricCard title="Colocación" meta={resumen.meta} value={resumen.valor} avance={pct(resumen.valor, resumen.meta)} color="#38bdf8" />
      <MetricCard title="Ingresos" meta={resumen.metaIngresos} value={resumen.ingreso} avance={pct(resumen.ingreso, resumen.metaIngresos)} color="#f59e0b" />

      <Panel title="Colocación mensual vs meta">
        <ResponsiveContainer width="100%" height={285}>
          <ComposedChart data={mensual}>
            <CartesianGrid strokeDasharray="3 3" stroke="#17324a" />
            <XAxis dataKey="mes" stroke="#8fb3cc" />
            <YAxis tickFormatter={compact} stroke="#8fb3cc" />
            <Tooltip formatter={v => money(v)} />
            <Legend />
            <Bar dataKey="valor" name="Valor nominal" fill="#38bdf8" radius={[8, 8, 0, 0]} />
            <Line dataKey="ingreso" name="Ingreso Qipu" stroke="#f59e0b" strokeWidth={3} />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Resumen">
        <div className="qf-pbi-summary">
          <div><span>Facturas</span><b>{resumen.facturas}</b></div>
          <div><span>Clientes</span><b>{resumen.clientes}</b></div>
          <div><span>Pagadores</span><b>{resumen.pagadores}</b></div>
          <div><span>Plazo prom.</span><b>{resumen.plazo} días</b></div>
        </div>
      </Panel>

      <Panel title="Condiciones">
        <div className="qf-pbi-summary">
          <div><span>Tasa pond.</span><b>{resumen.tasa.toFixed(2)}%</b></div>
          <div><span>TEM Qipu</span><b>{resumen.temQipu.toFixed(2)}%</b></div>
          <div><span>TEM Fondo</span><b>{resumen.temFondo.toFixed(2)}%</b></div>
          <div><span>Comisión</span><b>{resumen.comision.toFixed(2)}%</b></div>
        </div>
      </Panel>

      <Panel title="Histórico de colocación" full>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={mensual}>
            <CartesianGrid strokeDasharray="3 3" stroke="#17324a" />
            <XAxis dataKey="mes" stroke="#8fb3cc" />
            <YAxis tickFormatter={compact} stroke="#8fb3cc" />
            <Tooltip formatter={v => money(v)} />
            <Area type="monotone" dataKey="valor" stroke="#38bdf8" fill="#0ea5e9" fillOpacity={0.28} />
          </AreaChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  )
}

function Fondos({ byFondo, mensual, setCross }) {
  const pieData = byFondo.slice(0, 8)
  return (
    <div className="qf-pbi-grid fondos">
      <Panel title="Participación por fondo">
        <ResponsiveContainer width="100%" height={330}>
          <PieChart>
            <Pie data={pieData} dataKey="valor" nameKey="name" innerRadius={70} outerRadius={110} onClick={d => setCross({ _fondo: d.name })}>
              {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={v => money(v)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Ingreso por fondo">
        <ResponsiveContainer width="100%" height={330}>
          <BarChart data={byFondo.slice(0, 10)} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#17324a" />
            <XAxis type="number" tickFormatter={compact} stroke="#8fb3cc" />
            <YAxis type="category" dataKey="name" width={130} stroke="#8fb3cc" />
            <Tooltip formatter={v => money(v)} />
            <Bar dataKey="ingreso" fill="#f59e0b" radius={[0, 8, 8, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Comparación TEM Fondo y TEM Qipu" full>
        <ResponsiveContainer width="100%" height={270}>
          <ComposedChart data={mensual}>
            <CartesianGrid strokeDasharray="3 3" stroke="#17324a" />
            <XAxis dataKey="mes" stroke="#8fb3cc" />
            <YAxis stroke="#8fb3cc" />
            <Tooltip />
            <Legend />
            <Line dataKey="temQipu" name="TEM Qipu" stroke="#38bdf8" strokeWidth={3} />
            <Line dataKey="temFondo" name="TEM Fondo" stroke="#22c55e" strokeWidth={3} />
            <Line dataKey="tasa" name="Tasa" stroke="#f59e0b" strokeWidth={3} />
          </ComposedChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  )
}

function Clientes({ byPagador, byCliente, bySector, rows }) {
  const tableRows = rows.slice(0, 20)
  return (
    <div className="qf-pbi-grid clientes">
      <Panel title="Top pagadores">
        <ResponsiveContainer width="100%" height={330}>
          <BarChart data={byPagador} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#17324a" />
            <XAxis type="number" tickFormatter={compact} stroke="#8fb3cc" />
            <YAxis type="category" dataKey="name" width={140} stroke="#8fb3cc" />
            <Tooltip formatter={v => money(v)} />
            <Bar dataKey="valor" fill="#38bdf8" />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Sector pagador">
        <ResponsiveContainer width="100%" height={330}>
          <PieChart>
            <Pie data={bySector.slice(0, 8)} dataKey="valor" nameKey="name" innerRadius={75} outerRadius={110}>
              {bySector.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={v => money(v)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Clientes por tasa total" full>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={byCliente}>
            <CartesianGrid strokeDasharray="3 3" stroke="#17324a" />
            <XAxis dataKey="name" hide />
            <YAxis stroke="#8fb3cc" />
            <Tooltip />
            <Bar dataKey="tasa" fill="#7c3aed" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Detalle de clientes" full>
        <div className="qf-pbi-table-wrap">
          <table className="qf-pbi-table">
            <thead>
              <tr><th>Cliente</th><th>Valor nominal</th><th>Ingreso Qipu</th><th>Cliente nuevo</th></tr>
            </thead>
            <tbody>
              {tableRows.map((r, i) => (
                <tr key={`${r._id}-${i}`}>
                  <td>{r._cliente}</td>
                  <td>{money(r._valorNominal)}</td>
                  <td>{money(r._ingresoQipu)}</td>
                  <td>{r._clienteNuevo || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  )
}

function Filter({ label, value, onChange, options }) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

function MetricCard({ title, meta, value, avance, color }) {
  return (
    <section className="qf-pbi-metric">
      <div className="qf-pbi-metric-title"><i style={{ background: color }} /> {title}</div>
      <div className="qf-pbi-metric-body">
        <div><span>Meta</span><b>{money(meta)}</b></div>
        <div><span>Colocado</span><b>{money(value)}</b></div>
      </div>
      <div className="qf-pbi-progress">
        <div style={{ width: `${Math.min(100, avance)}%`, background: color }} />
      </div>
      <strong style={{ color }}>{avance}%</strong>
    </section>
  )
}

function Panel({ title, children, full }) {
  return (
    <section className={`qf-pbi-panel ${full ? 'full' : ''}`}>
      <h3>{title}</h3>
      {children}
    </section>
  )
}
