import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Select from 'react-select'
import DatePicker from 'react-datepicker'
import ReactECharts from 'echarts-for-react'
import 'echarts-gl'
import { AgGridReact } from 'ag-grid-react'
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, RadialBarChart, RadialBar } from 'recharts'
import { apiCall, toArray } from '../../utils/api'
import { useToast } from '../../hooks/useToast'
import ToastContainer from '../../components/ToastContainer'
import 'react-datepicker/dist/react-datepicker.css'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import './GerenciaBI.css'

const ENDPOINTS = {
  devoluciones: '/qf/devoluciones/listar',
  bancos: '/qf/devoluciones/bancos',
  monedas: '/qf/devoluciones/monedas',
  operaciones: '/qf/operaciones/listar',
  facturas: '/qf/facturas/listar',
  cobranzas: '/qf/cobranzas/listar',
}

const TABS = [
  { id: 'resumen', label: 'Resumen Ejecutivo' },
  { id: 'recharts', label: 'Recharts' },
  { id: 'echarts', label: 'ECharts Avanzado' },
  { id: 'grid', label: 'AG Grid / Tabla Dinámica' },
  { id: 'tresd', label: '3D Experimental' },
  { id: 'riesgo', label: 'Riesgo & Gerencia' },
]

const ESTADOS = ['Todos', 'Pendiente', 'Procesado', 'En proceso', 'Completado', 'Error', 'Rechazado', 'Vencido', 'Pagado', 'En gestión']
const MONEDAS_BASE = ['Todas', 'PEN', 'USD']
const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const palette = ['#185FA5', '#42A5F5', '#0B1D35', '#2E7D32', '#F57C00', '#C62828', '#7E57C2', '#0097A7']

const getField = (obj, ...names) => {
  for (const n of names) {
    if (obj?.[n] !== undefined) return obj[n]
    if (obj?.[n?.toLowerCase?.()] !== undefined) return obj[n.toLowerCase()]
    if (obj?.[n?.toUpperCase?.()] !== undefined) return obj[n.toUpperCase()]
  }
  return undefined
}
const num = v => Number(String(v ?? 0).replace(/,/g, '')) || 0
const dateValue = row => getField(row, 'fecha_operacion', 'fecha', 'created_at', 'fecha_log', 'FechaOperacion', 'FECHA')
const toDate = v => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d }
const formatDate = v => { const d = toDate(v); return d ? d.toLocaleDateString('es-PE') : '-' }
const ymd = d => d ? d.toISOString().slice(0, 10) : ''
const money = (value, currency = 'PEN') => new Intl.NumberFormat('es-PE', { style: 'currency', currency: String(currency).toUpperCase().includes('USD') || String(currency).toLowerCase().includes('dol') ? 'USD' : 'PEN', maximumFractionDigits: 2 }).format(num(value))
const compact = v => new Intl.NumberFormat('es-PE', { notation: 'compact', maximumFractionDigits: 1 }).format(num(v))
const pct = (v, t) => t ? Math.round((num(v) / num(t)) * 100) : 0
const norm = v => String(v ?? '').trim().toLowerCase()

const getBancoNombre = (id, bancos) => {
  if (!id) return '-'
  const b = bancos.find(x => String(getField(x, 'id', 'ID')) === String(id))
  return b ? (getField(b, 'name', 'Name', 'NAME') || id) : id
}
const getMonedaCodigo = (id, monedas) => {
  if (!id) return 'PEN'
  const m = monedas.find(x => String(getField(x, 'ID', 'id')) === String(id))
  if (!m) return String(id).toUpperCase().includes('USD') ? 'USD' : 'PEN'
  return getField(m, 'VALORTEXTO', 'valortexto', 'ValorTexto', 'CODIGO', 'codigo') || 'PEN'
}
const getMonto = row => num(getField(row, 'importe_cargado', 'monto', 'total', 'importe', 'monto_factura', 'ImporteCargado'))
const getAbonado = row => num(getField(row, 'importe_abonado', 'abonado', 'pagado', 'ImporteAbonado'))
const getComision = row => num(getField(row, 'comision', 'Comision'))
const getEstado = row => String(getField(row, 'estado', 'status', 'Estado') || 'Sin estado')
const getCliente = row => getField(row, 'cliente', 'razon_social', 'nombre_cliente', 'referencia', 'archivo', 'Cliente') || 'Sin cliente'
const getMonedaRow = (row, monedas) => getMonedaCodigo(getField(row, 'moneda_cargo', 'moneda', 'currency', 'Moneda'), monedas)
const getBancoRow = (row, bancos) => getBancoNombre(getField(row, 'banco', 'id_banco', 'Banco'), bancos)

function buildQuery(endpoint, pageSize = 500) {
  const glue = endpoint.includes('?') ? '&' : '?'
  return `${endpoint}${glue}page=1&pageSize=${pageSize}`
}

export default function GerenciaBI() {
  const { toasts, show } = useToast()
  const [tab, setTab] = useState('resumen')
  const [rows, setRows] = useState([])
  const [bancos, setBancos] = useState([])
  const [monedas, setMonedas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [estado, setEstado] = useState({ value: 'Todos', label: 'Todos' })
  const [moneda, setMoneda] = useState({ value: 'Todas', label: 'Todas' })
  const [banco, setBanco] = useState({ value: 'Todos', label: 'Todos' })
  const [fechaDesde, setFechaDesde] = useState(null)
  const [fechaHasta, setFechaHasta] = useState(null)
  const [search, setSearch] = useState('')

  const cargarCatalogos = useCallback(async () => {
    try {
      const [bR, mR] = await Promise.all([apiCall(ENDPOINTS.bancos), apiCall(ENDPOINTS.monedas)])
      setBancos((Array.isArray(bR) ? bR : (bR?.data || [])).filter(x => x && (x.id || x.ID)))
      setMonedas((Array.isArray(mR) ? mR : (mR?.data || [])).filter(x => x && (x.ID || x.id)))
    } catch (e) {
      console.warn('Catalogos BI:', e.message)
    }
  }, [])

  const cargarData = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await apiCall(buildQuery(ENDPOINTS.devoluciones, 2000))
      const raw = Array.isArray(res) ? res : (res?.data || res?.items || [])
      setRows(toArray(raw))
    } catch (e) {
      setError(e.message || 'No se pudo cargar información gerencial')
      show('Error cargando BI: ' + (e.message || ''), 'error')
    } finally { setLoading(false) }
  }, [show])

  useEffect(() => { cargarCatalogos(); cargarData() }, [cargarCatalogos, cargarData])

  const bancoOptions = useMemo(() => [{ value: 'Todos', label: 'Todos' }, ...bancos.map(b => ({ value: String(getField(b, 'id', 'ID')), label: getField(b, 'name', 'Name', 'NAME') || String(getField(b, 'id', 'ID')) }))], [bancos])
  const estadoOptions = useMemo(() => ESTADOS.map(x => ({ value: x, label: x })), [])
  const monedaOptions = useMemo(() => MONEDAS_BASE.map(x => ({ value: x, label: x })), [])

  const data = useMemo(() => rows.map(r => ({
    ...r,
    _fecha: toDate(dateValue(r)),
    _fechaTxt: formatDate(dateValue(r)),
    _monto: getMonto(r),
    _abonado: getAbonado(r),
    _comision: getComision(r),
    _estado: getEstado(r),
    _cliente: getCliente(r),
    _moneda: getMonedaRow(r, monedas),
    _banco: getBancoRow(r, bancos),
    _operacion: getField(r, 'numero_operacion', 'numero_operacion_pdf', 'id') || r.id,
    _dias: num(getField(r, 'dias', 'dias_mora', 'atraso')),
  })), [rows, bancos, monedas])

  const filtered = useMemo(() => {
    const q = norm(search)
    return data.filter(r => {
      const okEstado = estado.value === 'Todos' || norm(r._estado).includes(norm(estado.value))
      const okMoneda = moneda.value === 'Todas' || String(r._moneda).toUpperCase().includes(moneda.value)
      const okBanco = banco.value === 'Todos' || String(getField(r, 'banco', 'id_banco', 'Banco')) === String(banco.value)
      const okDesde = !fechaDesde || (r._fecha && r._fecha >= fechaDesde)
      const okHasta = !fechaHasta || (r._fecha && r._fecha <= fechaHasta)
      const txt = `${r._operacion} ${r._cliente} ${r._estado} ${r._banco} ${getField(r, 'referencia', 'archivo', 'mensaje') || ''}`.toLowerCase()
      const okSearch = !q || txt.includes(q)
      return okEstado && okMoneda && okBanco && okDesde && okHasta && okSearch
    })
  }, [data, estado, moneda, banco, fechaDesde, fechaHasta, search])

  const analytics = useMemo(() => buildAnalytics(filtered), [filtered])

  const limpiar = () => { setEstado({ value: 'Todos', label: 'Todos' }); setMoneda({ value: 'Todas', label: 'Todas' }); setBanco({ value: 'Todos', label: 'Todos' }); setFechaDesde(null); setFechaHasta(null); setSearch('') }

  return <div className="qf-bi-page fade-in">
    <ToastContainer toasts={toasts} />
    <header className="qf-bi-hero">
      <div>
        <div className="qf-bi-eyebrow">QF Factoring · Gerencia BI</div>
        <h1>Centro Gerencial Interactivo</h1>
        <p>Dashboards reales consumiendo la API actual. Base inicial: devoluciones bancarias; preparado para sumar operaciones, facturas y cobranzas.</p>
      </div>
      <div className="qf-bi-hero-actions">
        <button className="btn btn-secondary btn-sm" onClick={cargarData} disabled={loading}>{loading ? 'Actualizando...' : 'Actualizar'}</button>
        <span className="qf-bi-live"><i /> API real</span>
      </div>
    </header>

    <section className="qf-bi-filters">
      <div className="qf-bi-filter"><label>Estado</label><Select value={estado} onChange={setEstado} options={estadoOptions} classNamePrefix="qfselect" /></div>
      <div className="qf-bi-filter"><label>Moneda</label><Select value={moneda} onChange={setMoneda} options={monedaOptions} classNamePrefix="qfselect" /></div>
      <div className="qf-bi-filter"><label>Banco</label><Select value={banco} onChange={setBanco} options={bancoOptions} classNamePrefix="qfselect" /></div>
      <div className="qf-bi-filter"><label>Desde</label><DatePicker selected={fechaDesde} onChange={setFechaDesde} dateFormat="dd/MM/yyyy" placeholderText="Fecha inicial" className="qf-date" /></div>
      <div className="qf-bi-filter"><label>Hasta</label><DatePicker selected={fechaHasta} onChange={setFechaHasta} dateFormat="dd/MM/yyyy" placeholderText="Fecha final" className="qf-date" /></div>
      <div className="qf-bi-search"><label>Búsqueda</label><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Operación, cliente, referencia..." /></div>
      <button className="btn btn-secondary btn-sm" onClick={limpiar}>Limpiar</button>
    </section>

    {error && <div className="qf-bi-error">{error}</div>}
    <Kpis analytics={analytics} />
    <nav className="qf-bi-tabs">{TABS.map(t => <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>{t.label}</button>)}</nav>
    {loading && filtered.length === 0 ? <div className="qf-bi-loading"><span className="spinner dark" /> Cargando información real...</div> : <>
      {tab === 'resumen' && <Resumen analytics={analytics} />}
      {tab === 'recharts' && <RechartsView analytics={analytics} />}
      {tab === 'echarts' && <EChartsView analytics={analytics} />}
      {tab === 'grid' && <GridView rows={filtered} />}
      {tab === 'tresd' && <ThreeDView analytics={analytics} />}
      {tab === 'riesgo' && <RiesgoView analytics={analytics} rows={filtered} />}
    </>}
  </div>
}

function buildAnalytics(rows) {
  const total = rows.reduce((s, r) => s + r._monto, 0)
  const abonado = rows.reduce((s, r) => s + r._abonado, 0)
  const comision = rows.reduce((s, r) => s + r._comision, 0)
  const pendientes = rows.filter(r => norm(r._estado).includes('pendiente') || norm(r._estado).includes('proceso')).length
  const errores = rows.filter(r => norm(r._estado).includes('error') || norm(r._estado).includes('rechaz') || norm(r._estado).includes('fall')).length
  const completados = rows.filter(r => norm(r._estado).includes('complet') || norm(r._estado).includes('procesado') || norm(r._estado).includes('exitoso') || norm(r._estado).includes('pagado')).length
  const byMonthMap = {}, byStateMap = {}, byBankMap = {}, byCurrencyMap = {}, byClientMap = {}
  rows.forEach(r => {
    const m = r._fecha ? `${r._fecha.getFullYear()}-${String(r._fecha.getMonth() + 1).padStart(2, '0')}` : 'Sin fecha'
    byMonthMap[m] ||= { periodo: m, mes: r._fecha ? meses[r._fecha.getMonth()] : 'S/F', monto: 0, abonado: 0, comision: 0, count: 0, errores: 0 }
    byMonthMap[m].monto += r._monto; byMonthMap[m].abonado += r._abonado; byMonthMap[m].comision += r._comision; byMonthMap[m].count += 1
    if (norm(r._estado).includes('error') || norm(r._estado).includes('rechaz')) byMonthMap[m].errores += 1
    byStateMap[r._estado] ||= { name: r._estado, value: 0, count: 0 }; byStateMap[r._estado].value += r._monto; byStateMap[r._estado].count += 1
    byBankMap[r._banco] ||= { name: r._banco, value: 0, count: 0 }; byBankMap[r._banco].value += r._monto; byBankMap[r._banco].count += 1
    byCurrencyMap[r._moneda] ||= { name: r._moneda, value: 0, count: 0 }; byCurrencyMap[r._moneda].value += r._monto; byCurrencyMap[r._moneda].count += 1
    byClientMap[r._cliente] ||= { name: r._cliente, value: 0, count: 0 }; byClientMap[r._cliente].value += r._monto; byClientMap[r._cliente].count += 1
  })
  const byMonth = Object.values(byMonthMap).sort((a, b) => a.periodo.localeCompare(b.periodo))
  const byState = Object.values(byStateMap).sort((a, b) => b.value - a.value)
  const byBank = Object.values(byBankMap).sort((a, b) => b.value - a.value).slice(0, 12)
  const byCurrency = Object.values(byCurrencyMap).sort((a, b) => b.value - a.value)
  const topClients = Object.values(byClientMap).sort((a, b) => b.value - a.value).slice(0, 10)
  const efectividad = pct(abonado, total)
  const calidad = rows.length ? Math.max(0, 100 - Math.round((errores / rows.length) * 100)) : 0
  return { rows, count: rows.length, total, abonado, comision, pendientes, errores, completados, efectividad, calidad, byMonth, byState, byBank, byCurrency, topClients }
}

function Kpis({ analytics }) {
  const cards = [
    ['Registros', analytics.count, 'Total filtrado', '#185FA5'],
    ['Importe cargado', money(analytics.total), 'Volumen operativo', '#C62828'],
    ['Importe abonado', money(analytics.abonado), 'Recuperado / abonado', '#2E7D32'],
    ['Comisiones', money(analytics.comision), 'Ingresos por comisión', '#F57C00'],
    ['Pendientes', analytics.pendientes, 'Requieren seguimiento', '#7E57C2'],
    ['Efectividad', `${analytics.efectividad}%`, 'Abonado / cargado', '#0097A7'],
  ]
  return <section className="qf-bi-kpis">{cards.map(([l, v, h, c]) => <div key={l} className="qf-bi-kpi" style={{ borderTopColor: c }}><span>{l}</span><b style={{ color: c }}>{v}</b><small>{h}</small></div>)}</section>
}
function Panel({ title, sub, children, className = '' }) { return <section className={`qf-bi-panel ${className}`}><div className="qf-bi-panel-head"><h3>{title}</h3><p>{sub}</p></div>{children}</section> }
function Resumen({ analytics }) { return <div className="qf-bi-layout resumen">
  <Panel title="Evolución mensual" sub="Volumen cargado, abonado y comisiones"><ResponsiveContainer width="100%" height={290}><AreaChart data={analytics.byMonth}><defs><linearGradient id="gMonto" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#185FA5" stopOpacity={0.35}/><stop offset="95%" stopColor="#185FA5" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="mes"/><YAxis tickFormatter={compact}/><Tooltip formatter={(v) => money(v)}/><Legend/><Area type="monotone" dataKey="monto" name="Cargado" stroke="#185FA5" fill="url(#gMonto)"/><Line type="monotone" dataKey="abonado" name="Abonado" stroke="#2E7D32" strokeWidth={3}/></AreaChart></ResponsiveContainer></Panel>
  <Panel title="Estados" sub="Distribución operativa"><ResponsiveContainer width="100%" height={290}><PieChart><Pie data={analytics.byState} dataKey="value" nameKey="name" innerRadius={65} outerRadius={105} label>{analytics.byState.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}</Pie><Tooltip formatter={(v) => money(v)}/><Legend/></PieChart></ResponsiveContainer></Panel>
  <Panel title="Top bancos" sub="Ranking por volumen"><TopList data={analytics.byBank}/></Panel>
  <Panel title="Top clientes / referencias" sub="Mayores importes detectados"><TopList data={analytics.topClients}/></Panel>
</div> }
function RechartsView({ analytics }) { return <div className="qf-bi-layout two">
  <Panel title="Barras comparativas" sub="Monto vs abonado por periodo"><ResponsiveContainer width="100%" height={340}><BarChart data={analytics.byMonth}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="mes"/><YAxis tickFormatter={compact}/><Tooltip formatter={(v) => money(v)}/><Legend/><Bar dataKey="monto" name="Cargado" fill="#185FA5" radius={[8,8,0,0]}/><Bar dataKey="abonado" name="Abonado" fill="#2E7D32" radius={[8,8,0,0]}/></BarChart></ResponsiveContainer></Panel>
  <Panel title="Radial ejecutivo" sub="Efectividad y calidad"><ResponsiveContainer width="100%" height={340}><RadialBarChart innerRadius="35%" outerRadius="95%" data={[{name:'Efectividad', value:analytics.efectividad, fill:'#185FA5'}, {name:'Calidad', value:analytics.calidad, fill:'#2E7D32'}]} startAngle={180} endAngle={-180}><RadialBar dataKey="value" cornerRadius={12}/><Tooltip/><Legend/></RadialBarChart></ResponsiveContainer></Panel>
</div> }
function EChartsView({ analytics }) {
  const option = { tooltip:{ trigger:'axis' }, legend:{ top:0 }, grid:{ left:50, right:25, bottom:35, top:50 }, xAxis:{ type:'category', data:analytics.byMonth.map(x=>x.mes) }, yAxis:{ type:'value' }, series:[{ name:'Cargado', type:'line', smooth:true, areaStyle:{}, data:analytics.byMonth.map(x=>x.monto) }, { name:'Abonado', type:'bar', data:analytics.byMonth.map(x=>x.abonado) }, { name:'Errores', type:'line', yAxisIndex:0, data:analytics.byMonth.map(x=>x.errores) }] }
  const radar = { tooltip:{}, radar:{ indicator:[{name:'Efectividad',max:100},{name:'Calidad',max:100},{name:'Comisiones',max:Math.max(analytics.comision,1)},{name:'Abonado',max:Math.max(analytics.total,1)},{name:'Volumen',max:Math.max(analytics.total,1)}] }, series:[{ type:'radar', data:[{ value:[analytics.efectividad,analytics.calidad,analytics.comision,analytics.abonado,analytics.total], name:'Score BI' }] }] }
  return <div className="qf-bi-layout two"><Panel title="ECharts mixto" sub="Línea + barras + área"><ReactECharts option={option} style={{height:360}} /></Panel><Panel title="Radar gerencial" sub="Lectura rápida de desempeño"><ReactECharts option={radar} style={{height:360}} /></Panel></div>
}
function GridView({ rows }) {
  const colDefs = useMemo(() => [
    { field:'_operacion', headerName:'Operación', filter:true, pinned:'left', width:130 },
    { field:'_fechaTxt', headerName:'Fecha', filter:true, width:120 },
    { field:'_banco', headerName:'Banco', filter:true, rowGroup:false, width:170 },
    { field:'_cliente', headerName:'Cliente / referencia', filter:true, flex:1, minWidth:180 },
    { field:'_moneda', headerName:'Moneda', filter:true, width:100 },
    { field:'_monto', headerName:'Cargado', filter:'agNumberColumnFilter', aggFunc:'sum', valueFormatter:p=>money(p.value), width:145 },
    { field:'_abonado', headerName:'Abonado', filter:'agNumberColumnFilter', aggFunc:'sum', valueFormatter:p=>money(p.value), width:145 },
    { field:'_comision', headerName:'Comisión', filter:'agNumberColumnFilter', aggFunc:'sum', valueFormatter:p=>money(p.value), width:130 },
    { field:'_estado', headerName:'Estado', filter:true, width:140 },
  ], [])
  return <Panel title="Tabla dinámica AG Grid" sub="Filtros, ordenamiento, agrupación y exportación desde la grilla" className="full"><div className="ag-theme-quartz qf-bi-grid"><AgGridReact rowData={rows} columnDefs={colDefs} pagination paginationPageSize={25} animateRows enableCellTextSelection sideBar defaultColDef={{ sortable:true, resizable:true, filter:true, floatingFilter:true }} /></div></Panel>
}
function ThreeDView({ analytics }) {
  const banks = analytics.byBank.slice(0, 8)
  const months = analytics.byMonth.slice(-8)
  const data = []
  banks.forEach((b, x) => months.forEach((m, y) => data.push([x, y, Math.round((b.value / Math.max(b.count,1)) * (m.count / Math.max(analytics.count,1)))])))
  const option = { tooltip:{}, visualMap:{ max: Math.max(...data.map(d=>d[2]), 1), inRange:{ color:['#d7efff','#42a5f5','#185fa5','#0b1d35'] } }, xAxis3D:{ type:'category', data:banks.map(b=>b.name) }, yAxis3D:{ type:'category', data:months.map(m=>m.mes) }, zAxis3D:{ type:'value' }, grid3D:{ boxWidth:160, boxDepth:90, viewControl:{ projection:'perspective', autoRotate:false } }, series:[{ type:'bar3D', data, shading:'lambert', label:{ show:false }, emphasis:{ label:{ show:true } } }] }
  return <Panel title="Vista 3D experimental" sub="Volumen estimado por banco y periodo para demostración gerencial" className="full"><ReactECharts option={option} style={{height:520}} /></Panel>
}
function RiesgoView({ analytics, rows }) {
  const riesgo = useMemo(() => {
    return rows
      .map(r => ({
        ...r,
        score: Math.min(
          100,
          (norm(r._estado).includes('error') ? 40 : 0) +
          (norm(r._estado).includes('pendiente') ? 25 : 0) +
          Math.min(35, r._dias * 2) +
          (
            r._monto > analytics.total / Math.max(analytics.count, 1)
              ? 10
              : 0
          )
        )
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
  }, [rows, analytics])

  return (
    <div className="qf-bi-layout two">
      <Panel
        title="Matriz de riesgo"
        sub="Score calculado en frontend con estado, días e importe"
      >
        <div className="qf-risk-list">
          {riesgo.map(r => (
            <div key={r.id} className="qf-risk-row">
              <b>{r._operacion}</b>
              <span>{r._cliente}</span>
              <i>{r._estado}</i>
              <strong>{r.score}</strong>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Recomendación ejecutiva"
        sub="Indicadores para decisión"
      >
        <div className="qf-bi-advice">
          <h4>
            {analytics.errores > 0
              ? 'Atención requerida'
              : 'Operación estable'}
          </h4>

          <p>
            Hay <b>{analytics.pendientes}</b> registros pendientes y{' '}
            <b>{analytics.errores}</b> con posible incidencia.
            La efectividad actual es{' '}
            <b>{analytics.efectividad}%</b>.
          </p>

          <p>
            Usar esta pestaña para priorizar seguimiento,
            conciliación bancaria y revisión por bancos
            con mayor volumen.
          </p>
        </div>
      </Panel>
    </div>
  )
}
function TopList({ data }) { return <div className="qf-top-list">{data.length === 0 ? <div className="qf-empty">Sin información</div> : data.map((x,i) => <div className="qf-top-row" key={x.name}><span>{i+1}</span><div><b>{x.name}</b><small>{x.count} registros</small></div><strong>{compact(x.value)}</strong></div>)}</div> }
