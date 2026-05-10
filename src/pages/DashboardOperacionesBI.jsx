import React, { useMemo, useState } from 'react'

const MONTHS = [
  { value: 'all', label: 'Todo el año' },
  { value: '01', label: 'Enero' }, { value: '02', label: 'Febrero' }, { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' }, { value: '05', label: 'Mayo' }, { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' }, { value: '08', label: 'Agosto' }, { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' }, { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
]
const YEARS = ['2026', '2025', '2024']
const CURRENCIES = ['Todas', 'PEN', 'USD']
const STATES = ['Todos', 'Pagado', 'Pendiente', 'Vencido', 'En gestión']

const DATA = [
  ['F001','01','2026','Corporación Andina','PEN',188500,'Pagado',0,'Ana Rivera'],
  ['F002','01','2026','Grupo Lima Norte','USD',72500,'Pendiente',8,'Luis Terones'],
  ['F003','02','2026','Inversiones Pacífico','PEN',215300,'Pagado',0,'Carolina Chang'],
  ['F004','02','2026','Textiles Aurora','USD',48800,'Vencido',16,'Pedro Ramírez'],
  ['F005','03','2026','Servicios Delta','PEN',164700,'En gestión',4,'Ana Rivera'],
  ['F006','03','2026','Consorcio Real','USD',94300,'Pagado',0,'Luis Terones'],
  ['F007','04','2026','Agroexport Norte','PEN',266200,'Pendiente',6,'Carolina Chang'],
  ['F008','04','2026','Comercial Vega','USD',54000,'Pagado',0,'Pedro Ramírez'],
  ['F009','05','2026','Transportes Sol','PEN',304400,'Pagado',0,'Ana Rivera'],
  ['F010','05','2026','Metales del Sur','USD',112000,'En gestión',3,'Luis Terones'],
  ['F011','06','2026','Constructora Atlas','PEN',192100,'Vencido',22,'Carolina Chang'],
  ['F012','06','2026','Retail Oriente','USD',68700,'Pendiente',11,'Pedro Ramírez'],
  ['F013','07','2026','Distribuidora Prisma','PEN',245000,'Pagado',0,'Ana Rivera'],
  ['F014','07','2026','Minerales Perú','USD',126500,'Pagado',0,'Carolina Chang'],
  ['F015','08','2026','Holding Empresarial Q','PEN',331200,'Pendiente',7,'Luis Terones'],
  ['F016','08','2026','Alimentos Frescos','USD',80500,'En gestión',5,'Pedro Ramírez'],
  ['F017','09','2026','Innova Medical','PEN',176900,'Pagado',0,'Ana Rivera'],
  ['F018','09','2026','Energia & Redes','USD',142800,'Vencido',30,'Luis Terones'],
  ['F019','10','2026','Proyectos Urbanos','PEN',289600,'Pagado',0,'Carolina Chang'],
  ['F020','10','2026','Tecnología Norte','USD',96500,'Pendiente',9,'Pedro Ramírez'],
  ['F021','11','2026','Importadora Central','PEN',223800,'En gestión',2,'Ana Rivera'],
  ['F022','11','2026','Exportaciones Mar','USD',105300,'Pagado',0,'Carolina Chang'],
  ['F023','12','2026','Logística Premium','PEN',356000,'Pendiente',10,'Luis Terones'],
  ['F024','12','2026','Servicios Globales','USD',128000,'Pagado',0,'Pedro Ramírez'],
].map(([id, mes, year, cliente, moneda, monto, estado, dias, ejecutivo]) => ({ id, mes, year, cliente, moneda, monto, estado, dias, ejecutivo }))

const money = (v, c='PEN') => new Intl.NumberFormat('es-PE', { style:'currency', currency:c === 'USD' ? 'USD' : 'PEN', maximumFractionDigits:0 }).format(v || 0)
const compact = (v) => new Intl.NumberFormat('es-PE', { notation:'compact', maximumFractionDigits:1 }).format(v || 0)
const percent = (v, t) => t ? Math.round((v / t) * 100) : 0

export default function InicioDashboardPowerBI() {
  const [year, setYear] = useState('2026')
  const [month, setMonth] = useState('all')
  const [currency, setCurrency] = useState('Todas')
  const [state, setState] = useState('Todos')
  const [selectedMonth, setSelectedMonth] = useState('all')

  const activeMonth = selectedMonth !== 'all' ? selectedMonth : month
  const rows = useMemo(() => DATA.filter(r =>
    r.year === year &&
    (activeMonth === 'all' || r.mes === activeMonth) &&
    (currency === 'Todas' || r.moneda === currency) &&
    (state === 'Todos' || r.estado === state)
  ), [year, activeMonth, currency, state])

  const k = useMemo(() => {
    const total = rows.reduce((s,r)=>s+r.monto,0)
    const pen = rows.filter(r=>r.moneda==='PEN').reduce((s,r)=>s+r.monto,0)
    const usd = rows.filter(r=>r.moneda==='USD').reduce((s,r)=>s+r.monto,0)
    const paid = rows.filter(r=>r.estado==='Pagado').reduce((s,r)=>s+r.monto,0)
    const pending = rows.filter(r=>r.estado!=='Pagado').reduce((s,r)=>s+r.monto,0)
    const overdue = rows.filter(r=>r.estado==='Vencido').length
    const avgDays = Math.round(rows.reduce((s,r)=>s+r.dias,0) / Math.max(rows.length,1))
    return { total, pen, usd, paid, pending, overdue, avgDays, paidPct: percent(paid,total), count: rows.length }
  }, [rows])

  const monthly = useMemo(() => MONTHS.filter(m=>m.value!=='all').map(m => {
    const r = DATA.filter(x => x.year === year && x.mes === m.value && (currency === 'Todas' || x.moneda === currency) && (state === 'Todos' || x.estado === state))
    return { ...m, total: r.reduce((s,x)=>s+x.monto,0), count: r.length }
  }), [year, currency, state])

  const byState = useMemo(() => STATES.filter(x=>x!=='Todos').map(label => {
    const r = rows.filter(x => x.estado === label)
    return { label, count:r.length, total:r.reduce((s,x)=>s+x.monto,0) }
  }), [rows])

  const topClients = useMemo(() => {
    const map = {}
    rows.forEach(r => { map[r.cliente] = (map[r.cliente] || 0) + r.monto })
    return Object.entries(map).map(([cliente,total]) => ({cliente,total})).sort((a,b)=>b.total-a.total).slice(0,6)
  }, [rows])

  const executives = useMemo(() => {
    const map = {}
    rows.forEach(r => {
      if (!map[r.ejecutivo]) map[r.ejecutivo] = { ejecutivo:r.ejecutivo, total:0, count:0 }
      map[r.ejecutivo].total += r.monto
      map[r.ejecutivo].count += 1
    })
    return Object.values(map).sort((a,b)=>b.total-a.total)
  }, [rows])

  const maxMonthly = Math.max(...monthly.map(m=>m.total),1)
  const maxClient = Math.max(...topClients.map(c=>c.total),1)
  const period = MONTHS.find(m => m.value === activeMonth)?.label || 'Todo el año'

  const reset = () => { setYear('2026'); setMonth('all'); setCurrency('Todas'); setState('Todos'); setSelectedMonth('all') }

  return <div style={S.page}>
    <div style={S.hero}>
      <div>
        <div style={S.eyebrow}>QF Factoring · Centro ejecutivo</div>
        <h1 style={S.title}>Dashboard General</h1>
        <p style={S.subtitle}>Vista interactiva de facturación, cobranza, monedas, clientes y desempeño operativo.</p>
      </div>
      <div style={S.heroRight}><div style={S.live}><span/> En vivo</div><div style={S.period}>Periodo: {period}</div></div>
    </div>

    <div style={S.shell}>
      <aside style={S.sidebar}>
        <div style={S.brand}><div style={S.logo}>QF</div><div><b>Business Intelligence</b><small>Operaciones & Facturas</small></div></div>
        <Filter label="Año" value={year} onChange={setYear} options={YEARS}/>
        <Filter label="Mes" value={month} onChange={(v)=>{setMonth(v);setSelectedMonth('all')}} options={MONTHS}/>
        <Filter label="Moneda" value={currency} onChange={setCurrency} options={CURRENCIES}/>
        <Filter label="Estado" value={state} onChange={setState} options={STATES}/>
        <button style={S.reset} onClick={reset}>Limpiar filtros</button>
        <div style={S.tip}><b>Tip interactivo</b><span>Haz clic en una barra mensual para filtrar todo el panel.</span></div>
      </aside>

      <main style={S.main}>
        <div style={S.kpis}>
          <Kpi icon="📄" title="Facturas" value={k.count} hint="Registros filtrados" />
          <Kpi icon="S/" title="Total PEN" value={money(k.pen,'PEN')} hint="Monto facturado" />
          <Kpi icon="$" title="Total USD" value={money(k.usd,'USD')} hint="Monto facturado" />
          <Kpi icon="⏳" title="Por cobrar" value={compact(k.pending)} hint="Pendiente + vencido" danger={k.overdue>0}/>
        </div>

        <div style={S.gridTop}>
          <Card title="Cobranza efectiva" sub="Porcentaje pagado"><Gauge value={k.paidPct} label={`${k.paidPct}%`} sub="Pagado" /></Card>
          <Card title="Riesgo operativo" sub="Vencidas y atraso"><div style={S.two}><Gauge value={Math.min(k.overdue*25,100)} label={k.overdue} sub="Vencidas" small/><Gauge value={Math.min(k.avgDays*4,100)} label={`${k.avgDays}d`} sub="Promedio" small/></div></Card>
          <Card title="Facturación mensual" sub="Clic para filtrar"><Monthly data={monthly} max={maxMonthly} selected={activeMonth} onSelect={setSelectedMonth}/></Card>
        </div>

        <div style={S.gridMid}>
          <Card title="Distribución por estado" sub="Composición de cartera"><Donut data={byState}/></Card>
          <Card title="Top clientes" sub="Ranking por monto facturado"><Ranking data={topClients} max={maxClient}/></Card>
          <Card title="Equipo comercial" sub="Monto y operaciones"><Executives data={executives}/></Card>
        </div>

        <div style={S.gridBottom}>
          <Card title="Tendencia de facturación" sub="Evolución mensual"><Sparkline data={monthly.map(m=>m.total)} labels={monthly.map(m=>m.label.slice(0,3))}/></Card>
          <Card title="Detalle dinámico" sub="Tabla filtrada por el dashboard"><Detail rows={rows}/></Card>
        </div>
      </main>
    </div>
  </div>
}

function Filter({ label, value, onChange, options }) {
  return <label style={S.filter}><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)} style={S.filterInput}>
    {options.map(o => typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
  </select></label>
}
function Kpi({ icon, title, value, hint, danger }) { return <div style={{...S.kpi,borderColor:danger?'#ffb4a8':'#cfe4ff'}}><div style={S.kpiIcon}>{icon}</div><div><div style={S.kpiTitle}>{title}</div><div style={{...S.kpiValue,color:danger?'#c62828':'#1976d2'}}>{value}</div><div style={S.kpiHint}>{hint}</div></div></div> }
function Card({ title, sub, children }) { return <section style={S.card}><h3 style={S.cardTitle}>{title}</h3><p style={S.cardSub}>{sub}</p>{children}</section> }
function Gauge({ value, label, sub, small }) { const angle=-135+(Math.max(0,Math.min(100,value))/100)*270; return <div style={{...S.gauge,transform:small?'scale(.82)':'none'}}><svg width="170" height="118" viewBox="0 0 170 118"><path d="M30 92 A55 55 0 1 1 140 92" fill="none" stroke="#e6edf7" strokeWidth="18" strokeLinecap="round"/><path d="M30 92 A55 55 0 1 1 140 92" fill="none" stroke="#42a5f5" strokeWidth="18" strokeLinecap="round" strokeDasharray={`${value*1.72} 300`}/><line x1="85" y1="92" x2="85" y2="42" stroke="#09233f" strokeWidth="5" strokeLinecap="round" transform={`rotate(${angle} 85 92)`}/><circle cx="85" cy="92" r="7" fill="#09233f"/></svg><div style={S.gaugeValue}>{label}</div><div style={S.gaugeSub}>{sub}</div></div> }
function Monthly({ data, max, selected, onSelect }) { return <div style={S.months}>{data.map(m=>{const active=selected===m.value; const h=Math.max(8,(m.total/max)*100); return <button key={m.value} style={S.monthBtn} onClick={()=>onSelect(active?'all':m.value)}><div style={S.monthValue}>{compact(m.total)}</div><div style={S.barCol}><span style={{...S.monthBar,height:`${h}%`,background:active?'#0b2d4d':'#42a5f5'}}/></div><div style={{...S.monthLabel,fontWeight:active?950:750}}>{m.label.slice(0,3)}</div></button>})}</div> }
function Donut({ data }) { const total=data.reduce((s,d)=>s+d.total,0)||1; let acc=0; const colors=['#4caf50','#ffb300','#ef5350','#42a5f5']; return <div style={S.donut}><svg width="190" height="190" viewBox="0 0 42 42"><circle cx="21" cy="21" r="15.9" fill="transparent" stroke="#edf3fa" strokeWidth="7"/>{data.map((d,i)=>{const val=(d.total/total)*100; const out=<circle key={d.label} cx="21" cy="21" r="15.9" fill="transparent" stroke={colors[i]} strokeWidth="7" strokeDasharray={`${val} ${100-val}`} strokeDashoffset={25-acc} transform="rotate(-90 21 21)"/>; acc+=val; return out})}<text x="21" y="20" textAnchor="middle" fontSize="5" fontWeight="800" fill="#09233f">{data.reduce((s,d)=>s+d.count,0)}</text><text x="21" y="25" textAnchor="middle" fontSize="2.8" fill="#60758c">facturas</text></svg><div style={S.legend}>{data.map((d,i)=><div key={d.label} style={S.legendRow}><span style={{...S.dot,background:colors[i]}}/><span>{d.label}</span><b>{d.count}</b></div>)}</div></div> }
function Ranking({ data, max }) { return <div style={S.ranking}>{data.map((c,i)=><div key={c.cliente} style={S.rankRow}><div style={S.rankNum}>{i+1}</div><div style={S.rankMain}><div style={S.rankLabel}>{c.cliente}</div><div style={S.track}><div style={{...S.fill,width:`${Math.max(8,c.total/max*100)}%`}}/></div></div><div style={S.rankValue}>{compact(c.total)}</div></div>)}</div> }
function Executives({ data }) { return <div style={S.execGrid}>{data.map(e=><div key={e.ejecutivo} style={S.execCard}><div style={S.avatar}>{e.ejecutivo.split(' ').map(x=>x[0]).join('').slice(0,2)}</div><div><div style={S.execName}>{e.ejecutivo}</div><div style={S.execMeta}>{e.count} docs · {compact(e.total)}</div></div></div>)}</div> }
function Sparkline({ data, labels }) { const max=Math.max(...data,1), min=Math.min(...data,0), range=max-min||1; const points=data.map((v,i)=>`${20+i*(420/Math.max(data.length-1,1))},${150-((v-min)/range)*105}`).join(' '); return <svg width="100%" height="190" viewBox="0 0 470 190" preserveAspectRatio="none">{[0,1,2,3].map(i=><line key={i} x1="20" x2="450" y1={45+i*35} y2={45+i*35} stroke="#edf3fa"/>)}<polyline points={points} fill="none" stroke="#1976d2" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>{data.map((v,i)=>{const x=20+i*(420/Math.max(data.length-1,1)); const y=150-((v-min)/range)*105; return <circle key={i} cx={x} cy={y} r="5" fill="#fff" stroke="#1976d2" strokeWidth="3"/>})}{labels.map((l,i)=><text key={l+i} x={20+i*(420/Math.max(labels.length-1,1))} y="178" textAnchor="middle" fontSize="11" fill="#60758c">{l}</text>)}</svg> }
function Detail({ rows }) { return <div style={S.tableWrap}><table style={S.table}><thead><tr>{['Factura','Cliente','Mes','Moneda','Monto','Estado'].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead><tbody>{rows.slice(0,10).map(r=><tr key={r.id}><td style={S.td}><code style={S.code}>{r.id}</code></td><td style={S.td}>{r.cliente}</td><td style={S.td}>{MONTHS.find(m=>m.value===r.mes)?.label}</td><td style={S.td}>{r.moneda}</td><td style={S.td}>{money(r.monto,r.moneda)}</td><td style={S.td}><Badge value={r.estado}/></td></tr>)}{rows.length===0&&<tr><td colSpan={6} style={S.empty}>No hay información para los filtros seleccionados.</td></tr>}</tbody></table></div> }
function Badge({ value }) { const styles={Pagado:{background:'#e8f5e9',color:'#2e7d32'},Pendiente:{background:'#fff8e1',color:'#e65100'},Vencido:{background:'#ffebee',color:'#c62828'},'En gestión':{background:'#e3f2fd',color:'#1565c0'}}; return <span style={{...S.badge,...(styles[value]||{})}}>{value}</span> }

const S = {
  page:{minHeight:'100vh',background:'linear-gradient(135deg,#eef5ff 0%,#f7fbff 45%,#fff8f3 100%)',padding:16,color:'#09233f'},
  hero:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:16,marginBottom:14}, eyebrow:{fontSize:11,textTransform:'uppercase',letterSpacing:1.6,color:'#1976d2',fontWeight:900}, title:{margin:'2px 0',fontSize:28,fontWeight:950,fontFamily:'Montserrat,Arial'}, subtitle:{margin:0,color:'#60758c',fontSize:13}, heroRight:{display:'flex',flexDirection:'column',gap:8,alignItems:'flex-end'}, live:{display:'flex',gap:7,alignItems:'center',padding:'7px 11px',borderRadius:999,background:'#fff',boxShadow:'0 8px 24px rgba(17,57,94,.08)',fontSize:12,fontWeight:800,color:'#2e7d32'}, period:{fontSize:12,color:'#60758c',fontWeight:800},
  shell:{display:'grid',gridTemplateColumns:'220px 1fr',gap:14}, sidebar:{background:'#0b1d35',borderRadius:22,padding:14,color:'#fff',boxShadow:'0 16px 36px rgba(9,35,63,.18)',alignSelf:'start',position:'sticky',top:12}, brand:{display:'flex',gap:10,alignItems:'center',marginBottom:18}, logo:{width:46,height:46,borderRadius:14,background:'linear-gradient(135deg,#1e88e5,#64b5f6)',display:'grid',placeItems:'center',fontWeight:950,fontSize:18}, filter:{display:'flex',flexDirection:'column',gap:6,marginBottom:12,fontSize:11,fontWeight:900,textTransform:'uppercase',color:'#b5c7da'}, filterInput:{height:38,borderRadius:10,border:'1px solid rgba(255,255,255,.22)',background:'#122947',color:'#fff',padding:'0 10px',outline:'none'}, reset:{width:'100%',height:38,borderRadius:12,border:'none',background:'#42a5f5',color:'#fff',fontWeight:900,cursor:'pointer',marginTop:4}, tip:{marginTop:16,background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.12)',borderRadius:14,padding:12,display:'flex',flexDirection:'column',gap:5,fontSize:12,color:'#dcecff'},
  main:{minWidth:0}, kpis:{display:'grid',gridTemplateColumns:'repeat(4,minmax(170px,1fr))',gap:12,marginBottom:12}, kpi:{background:'rgba(255,255,255,.82)',backdropFilter:'blur(10px)',border:'1px solid #cfe4ff',borderRadius:18,padding:14,display:'flex',gap:12,alignItems:'center',boxShadow:'0 12px 30px rgba(17,57,94,.08)'}, kpiIcon:{minWidth:44,height:44,borderRadius:14,background:'#edf6ff',color:'#1976d2',display:'grid',placeItems:'center',fontWeight:950}, kpiTitle:{fontSize:11,textTransform:'uppercase',color:'#60758c',fontWeight:900}, kpiValue:{fontSize:24,fontWeight:950,lineHeight:1.05,marginTop:2}, kpiHint:{fontSize:11,color:'#8aa0b7',marginTop:2},
  gridTop:{display:'grid',gridTemplateColumns:'250px 250px 1fr',gap:12,marginBottom:12}, gridMid:{display:'grid',gridTemplateColumns:'300px 1fr 330px',gap:12,marginBottom:12}, gridBottom:{display:'grid',gridTemplateColumns:'1fr 1.4fr',gap:12}, card:{background:'rgba(255,255,255,.88)',border:'1px solid #d8e9fb',borderRadius:20,padding:14,boxShadow:'0 14px 34px rgba(17,57,94,.09)',minHeight:170,overflow:'hidden'}, cardTitle:{margin:0,fontSize:15,fontWeight:950,color:'#09233f',fontFamily:'Montserrat,Arial'}, cardSub:{margin:'2px 0 8px',fontSize:11,color:'#60758c'},
  gauge:{display:'grid',placeItems:'center',marginTop:2}, gaugeValue:{fontSize:28,fontWeight:950,color:'#1976d2',marginTop:-26}, gaugeSub:{fontSize:12,color:'#60758c',fontWeight:800}, two:{display:'flex',alignItems:'center',justifyContent:'center',gap:0,minHeight:130}, months:{display:'grid',gridTemplateColumns:'repeat(12,1fr)',gap:6,height:190,alignItems:'end'}, monthBtn:{border:'none',background:'transparent',cursor:'pointer',display:'grid',gap:4,alignItems:'end',minWidth:0}, monthValue:{fontSize:10,color:'#60758c',fontWeight:800,minHeight:14}, barCol:{height:118,background:'#edf3fa',borderRadius:999,display:'flex',alignItems:'end',overflow:'hidden'}, monthBar:{width:'100%',borderRadius:999,transition:'height .25s ease'}, monthLabel:{fontSize:10,color:'#09233f'},
  donut:{display:'flex',alignItems:'center',justifyContent:'center',gap:8}, legend:{display:'grid',gap:9,flex:1}, legendRow:{display:'grid',gridTemplateColumns:'12px 1fr auto',gap:7,alignItems:'center',fontSize:12}, dot:{width:10,height:10,borderRadius:999}, ranking:{display:'grid',gap:10,marginTop:4}, rankRow:{display:'grid',gridTemplateColumns:'28px 1fr 60px',alignItems:'center',gap:10}, rankNum:{width:24,height:24,borderRadius:8,background:'#edf6ff',display:'grid',placeItems:'center',color:'#1976d2',fontWeight:950,fontSize:11}, rankMain:{minWidth:0}, rankLabel:{fontSize:12,fontWeight:850,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}, track:{height:8,borderRadius:999,background:'#edf3fa',overflow:'hidden',marginTop:5}, fill:{height:'100%',borderRadius:999,background:'linear-gradient(90deg,#1976d2,#64b5f6)'}, rankValue:{fontSize:12,fontWeight:950,color:'#1976d2',textAlign:'right'},
  execGrid:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}, execCard:{display:'flex',alignItems:'center',gap:10,background:'#f6faff',border:'1px solid #e1effc',borderRadius:14,padding:10}, avatar:{width:36,height:36,borderRadius:12,background:'#0b2d4d',color:'#fff',display:'grid',placeItems:'center',fontSize:12,fontWeight:950}, execName:{fontSize:12,fontWeight:900}, execMeta:{fontSize:11,color:'#60758c',marginTop:2}, tableWrap:{maxHeight:230,overflow:'auto',borderRadius:14,border:'1px solid #e3eef9'}, table:{width:'100%',borderCollapse:'collapse',fontSize:12}, th:{position:'sticky',top:0,background:'#0b2d4d',color:'#fff',padding:'8px 9px',textAlign:'left',fontSize:10,textTransform:'uppercase'}, td:{padding:'8px 9px',borderBottom:'1px solid #edf3fa',color:'#09233f'}, code:{background:'#edf6ff',color:'#1976d2',padding:'2px 6px',borderRadius:6,fontWeight:900}, badge:{display:'inline-block',padding:'4px 8px',borderRadius:999,fontSize:10,fontWeight:950}, empty:{padding:18,textAlign:'center',color:'#60758c'}
}
