import React, { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import 'echarts-gl'
import Select from 'react-select'
import DatePicker from 'react-datepicker'
import { AgGridReact } from 'ag-grid-react'
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts'
import { apiCall, toArray } from '../../utils/api'
import ToastContainer from '../../components/ToastContainer'
import 'react-datepicker/dist/react-datepicker.css'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import './GerenciaAvanzado.css'

export const COLORS = ['#185FA5','#42A5F5','#0B1D35','#2E7D32','#F57C00','#C62828','#7E57C2','#0097A7']
export const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
export const endpoints = {
  facturas: '/qf/ops/billings/listar',
  devoluciones: '/qf/devoluciones/listar',
  bancos: '/qf/devoluciones/bancos',
  monedas: '/qf/devoluciones/monedas'
}
export const getField = (obj,...names) => { for (const n of names) { if (obj?.[n] !== undefined) return obj[n]; if (obj?.[String(n).toLowerCase()] !== undefined) return obj[String(n).toLowerCase()]; if (obj?.[String(n).toUpperCase()] !== undefined) return obj[String(n).toUpperCase()] } return undefined }
export const n = v => Number(String(v ?? 0).replace(/,/g,'')) || 0
export const norm = v => String(v ?? '').trim().toLowerCase()
export const money = (v,c='PEN') => new Intl.NumberFormat('es-PE',{style:'currency',currency:String(c).toUpperCase().includes('USD')||String(c).toLowerCase().includes('dol')?'USD':'PEN',maximumFractionDigits:2}).format(n(v))
export const compact = v => new Intl.NumberFormat('es-PE',{notation:'compact',maximumFractionDigits:1}).format(n(v))
export const pct = (v,t) => t ? Math.round((n(v)/n(t))*100) : 0
export const toDate = v => { if(!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d }
export const fmtDate = v => { const d = toDate(v); return d ? d.toLocaleDateString('es-PE') : '-' }
export function buildQuery(endpoint, pageSize=2500){ return `${endpoint}${endpoint.includes('?')?'&':'?'}page=1&pageSize=${pageSize}` }
export async function loadRows(endpoint, pageSize=2500){ const res = await apiCall(buildQuery(endpoint,pageSize)); const rows = Array.isArray(res)?res:(res?.data||res?.items||res?.rows||[]); return { rows: toArray(rows), total: Number(res?.total ?? rows.length) } }

export function prepareFacturas(rows){
  return rows.map(r => ({
    ...r,
    _id: getField(r,'billing_id','numero','number','id') || r.id,
    _cliente: getField(r,'cliente','company_name','client','razon_social','userId') || 'Sin cliente',
    _pagador: getField(r,'pagador','name_debtor','payer','payerId') || 'Sin pagador',
    _fondo: getField(r,'fondo','fund','partner') || 'Sin fondo',
    _comercial: getField(r,'comercial','commercial_name','commercial') || 'Sin comercial',
    _estado: getField(r,'estado_operativo','status_operativo','status_f_label','status','estado') || 'Sin estado',
    _moneda: getField(r,'currency','moneda') || 'PEN',
    _monto: n(getField(r,'net_amount','amount','monto','importe')),
    _bruto: n(getField(r,'amount','monto','importe')),
    _comision: n(getField(r,'commission','comision')),
    _fecha: toDate(getField(r,'date_payment','date_payout','date_emission','created_at')),
    _fechaTxt: fmtDate(getField(r,'date_payment','date_payout','date_emission','created_at')),
    _dias: n(getField(r,'n_days','dias','dias_mora'))
  }))
}
export function prepareDevoluciones(rows,bancos=[],monedas=[]){
  const bancoNombre = id => { const b=bancos.find(x=>String(getField(x,'id','ID'))===String(id)); return b ? (getField(b,'name','Name','NAME')||id) : (id||'-') }
  const monedaCodigo = id => { const m=monedas.find(x=>String(getField(x,'ID','id'))===String(id)); return m ? (getField(m,'VALORTEXTO','valortexto','CODIGO','codigo')||'PEN') : (String(id||'').toUpperCase().includes('USD')?'USD':'PEN') }
  return rows.map(r => ({
    ...r,
    _id: getField(r,'numero_operacion','numero_operacion_pdf','id') || r.id,
    _cliente: getField(r,'referencia','archivo','cliente') || 'Sin referencia',
    _banco: bancoNombre(getField(r,'banco','id_banco')),
    _estado: getField(r,'estado','status') || 'Sin estado',
    _moneda: monedaCodigo(getField(r,'moneda_cargo','moneda')),
    _monto: n(getField(r,'importe_cargado','monto','total')),
    _abonado: n(getField(r,'importe_abonado','abonado')),
    _comision: n(getField(r,'comision')),
    _fecha: toDate(getField(r,'fecha_operacion','created_at','fecha_log')),
    _fechaTxt: fmtDate(getField(r,'fecha_operacion','created_at','fecha_log')),
    _dias: n(getField(r,'dias','dias_mora','atraso'))
  }))
}
export function groupBy(rows,key){
  const map={}
  rows.forEach(r=>{ const name=(typeof key==='function'?key(r):r[key])||'Sin dato'; if(!map[name]) map[name]={name,value:0,count:0,comision:0,abonado:0}; map[name].value+=n(r._monto); map[name].abonado+=n(r._abonado||r._monto); map[name].comision+=n(r._comision); map[name].count+=1 })
  return Object.values(map).sort((a,b)=>b.value-a.value)
}
export function monthly(rows){
  const map={}
  rows.forEach(r=>{ const d=r._fecha; const k=d?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`:'Sin fecha'; if(!map[k]) map[k]={periodo:k,mes:d?MONTHS[d.getMonth()]:'S/F',value:0,abonado:0,comision:0,count:0,errores:0}; map[k].value+=n(r._monto); map[k].abonado+=n(r._abonado||r._monto); map[k].comision+=n(r._comision); map[k].count+=1; if(norm(r._estado).includes('error')||norm(r._estado).includes('rechaz')||norm(r._estado).includes('anulad')) map[k].errores+=1 })
  return Object.values(map).sort((a,b)=>a.periodo.localeCompare(b.periodo))
}
export function useGlobalFilters(base){
  const [estado,setEstado]=useState({value:'Todos',label:'Todos'}), [moneda,setMoneda]=useState({value:'Todas',label:'Todas'}), [desde,setDesde]=useState(null), [hasta,setHasta]=useState(null), [search,setSearch]=useState(''), [selected,setSelected]=useState(null)
  const rows=useMemo(()=>{ const q=norm(search); return base.filter(r=>{ const okE=estado.value==='Todos'||norm(r._estado).includes(norm(estado.value)); const okM=moneda.value==='Todas'||String(r._moneda||'').toUpperCase().includes(moneda.value); const okD=!desde||(r._fecha&&r._fecha>=desde); const okH=!hasta||(r._fecha&&r._fecha<=hasta); const txt=`${r._id} ${r._cliente} ${r._pagador||''} ${r._fondo||''} ${r._comercial||''} ${r._estado}`.toLowerCase(); const okQ=!q||txt.includes(q); const okS=!selected||Object.entries(selected).every(([k,v])=>String(r[k]||'')===String(v)); return okE&&okM&&okD&&okH&&okQ&&okS }) },[base,estado,moneda,desde,hasta,search,selected])
  const limpiar=()=>{setEstado({value:'Todos',label:'Todos'});setMoneda({value:'Todas',label:'Todas'});setDesde(null);setHasta(null);setSearch('');setSelected(null)}
  return {rows,estado,setEstado,moneda,setMoneda,desde,setDesde,hasta,setHasta,search,setSearch,selected,setSelected,limpiar}
}
export function PageShell({title,subtitle,children,loading,error,toasts,actions}){ return <div className="qf-adv-page fade-in"><ToastContainer toasts={toasts||[]}/><header className="qf-adv-hero"><div><div className="qf-adv-eyebrow">QF Factoring · Gerencia</div><h1>{title}</h1><p>{subtitle}</p></div><div className="qf-adv-actions">{actions}</div></header>{error&&<div className="qf-adv-error">{error}</div>}{loading?<div className="qf-adv-loading"><span className="spinner dark"/> Cargando información real...</div>:children}</div> }
export function Filters({f,estados=[]}){ const estadoOptions=[{value:'Todos',label:'Todos'},...Array.from(new Set(estados.filter(Boolean))).map(x=>({value:x,label:x}))]; const monedaOptions=['Todas','PEN','USD','Soles','Dolares'].map(x=>({value:x,label:x})); return <section className="qf-adv-filters"><div><label>Estado</label><Select value={f.estado} onChange={f.setEstado} options={estadoOptions} classNamePrefix="qfselect"/></div><div><label>Moneda</label><Select value={f.moneda} onChange={f.setMoneda} options={monedaOptions} classNamePrefix="qfselect"/></div><div><label>Desde</label><DatePicker selected={f.desde} onChange={f.setDesde} dateFormat="dd/MM/yyyy" placeholderText="Fecha inicial" className="qf-date"/></div><div><label>Hasta</label><DatePicker selected={f.hasta} onChange={f.setHasta} dateFormat="dd/MM/yyyy" placeholderText="Fecha final" className="qf-date"/></div><div className="wide"><label>Búsqueda</label><input value={f.search} onChange={e=>f.setSearch(e.target.value)} placeholder="Buscar..."/></div><button className="btn btn-secondary btn-sm" onClick={f.limpiar}>Limpiar</button></section> }
export function KpiGrid({items}){ return <section className="qf-adv-kpis">{items.map((it,i)=><div key={it.label} className="qf-adv-kpi" style={{borderTopColor:it.color||COLORS[i%COLORS.length]}}><span>{it.label}</span><b style={{color:it.color||COLORS[i%COLORS.length]}}>{it.value}</b><small>{it.hint}</small></div>)}</section> }
export function Panel({title,sub,children,className=''}){ return <section className={`qf-adv-panel ${className}`}><div className="qf-adv-panel-head"><h3>{title}</h3><p>{sub}</p></div>{children}</section> }
export function TopList({data,onClick}){ return <div className="qf-adv-toplist">{data.length===0?<div className="qf-adv-empty">Sin información</div>:data.map((x,i)=><button key={`${x.name}-${i}`} onClick={()=>onClick?.(x)}><span>{i+1}</span><div><b>{x.name}</b><small>{x.count} registros</small></div><strong>{compact(x.value)}</strong></button>)}</div> }
export function ExportButtons({rows,filename='qf-bi'}){ const exportCsv=()=>{ const cols=Object.keys(rows[0]||{}).filter(k=>k.startsWith('_')).slice(0,20); const csv=[cols.join(','),...rows.map(r=>cols.map(c=>`"${String(r[c]??'').replace(/"/g,'""')}"`).join(','))].join('\n'); const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`${filename}.csv`; a.click(); URL.revokeObjectURL(a.href) }; return <div className="qf-adv-export"><button className="btn btn-secondary btn-sm" onClick={exportCsv}>Export Excel</button><button className="btn btn-secondary btn-sm" onClick={()=>window.print()}>Export PDF</button></div> }
export function ForecastLine({data}){ const forecast=useMemo(()=>{ const vals=data.map(d=>n(d.value)); const avg=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0; const last=vals.at(-1)||avg; return [...data,{mes:'+1',value:Math.round(last*.65+avg*.35)},{mes:'+2',value:Math.round(last*.55+avg*.45)}] },[data]); return <ResponsiveContainer width="100%" height={310}><LineChart data={forecast}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="mes"/><YAxis tickFormatter={compact}/><Tooltip formatter={v=>money(v)}/><Legend/><Line type="monotone" dataKey="value" name="Real + forecast" stroke="#185FA5" strokeWidth={3}/></LineChart></ResponsiveContainer> }
export { ReactECharts, AgGridReact, ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell }
