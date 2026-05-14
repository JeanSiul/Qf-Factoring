import React, { useEffect, useMemo, useState } from 'react'
import { apiCall } from '../../../utils/api'
import { useToast } from '../../../hooks/useToast'
import ToastContainer from '../../../components/ToastContainer'
import { AgGridReact } from 'ag-grid-react'

const money = (value, currency = 'PEN') => {
  const cur = String(currency || '').toLowerCase().includes('dol') || String(currency || '').toUpperCase() === 'USD' ? 'USD' : 'PEN'
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(Number(value || 0))
}

const formatDate = value => {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10)
  return d.toLocaleDateString('es-PE')
}

const normalize = value => String(value ?? '').toLowerCase().trim()

const badgeClass = status => {
  const s = normalize(status)
  if (s.includes('vencid')) return 'inactive'
  if (s.includes('pendiente') || s.includes('adelanto') || s.includes('excepci')) return 'warning'
  if (s.includes('desembol') || s.includes('liquid') || s.includes('facturad')) return 'active'
  return 'active'
}

const csvEscape = v => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

const downloadTextFile = (filename, content, mime = 'text/csv;charset=utf-8;') => {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
}

const safeJsonParse = (value, fallback) => { try { return value ? JSON.parse(value) : fallback } catch (_) { return fallback } }

const pctBar = (value, total) => `${Math.round((Number(value || 0) / Math.max(Number(total || 0), 1)) * 100)}%`

const GRID_VIEW_KEY = 'qf_cobconsulta_grid_view_v1'
const SAVED_VIEWS_KEY = 'qf_cobconsulta_saved_views_v1'
const DASHBOARD_KEY = 'qf_cobconsulta_dashboard_v1'

const ALL_FIELDS = ['Producto', 'Ruc', 'Cliente', 'Pagador', 'RUC Pagador', 'Moneda de la Operacion', 'Numero de Factura', 'Importe Neto', 'Fecha de Pago', 'Partner / Fondeo', 'Responsable Comercial', 'Status de Operaciones', 'Nro Operacion', 'Origen']

const MONEY_FIELDS = new Set(['Importe Neto'])
const DATE_FIELDS = new Set(['Fecha de Pago'])

const buildColDef = (field) => {
  const base = { headerName: field, field, minWidth: 80, filter: true, floatingFilter: true, sortable: true, resizable: true }

  if (field === 'Cliente' || field === 'Pagador') return { ...base, width: 220, filter: 'agTextColumnFilter', cellStyle: { fontWeight: 700, color: 'var(--qf-navy)' } }
  if (field === 'Numero de Factura' || field === 'Nro Operacion') return { ...base, width: 140, filter: 'agTextColumnFilter', cellRenderer: p => <code style={S.opCode}>{p.value || '-'}</code>, headerClass: 'qf-center-header' }
  if (field === 'Ruc' || field === 'RUC Pagador') return { ...base, width: 125, filter: 'agTextColumnFilter', headerClass: 'qf-center-header' }
  if (field === 'Moneda de la Operacion') return { ...base, width: 90, headerName: 'Moneda', filter: 'agTextColumnFilter', headerClass: 'qf-center-header' }
  if (MONEY_FIELDS.has(field)) return { ...base, width: 140, type: 'numericColumn', filter: 'agNumberColumnFilter', cellStyle: { fontWeight: 800, color: '#2e7d32', textAlign: 'right' }, cellClass: 'qf-right-cell', valueFormatter: p => p.value != null ? money(p.value, p.data?.['Moneda de la Operacion']) : '-' }
  if (DATE_FIELDS.has(field)) return { ...base, width: 120, filter: 'agDateColumnFilter', valueFormatter: p => formatDate(p.value), headerClass: 'qf-center-header' }
  if (field === 'Partner / Fondeo') return { ...base, width: 140, headerName: 'Fondo', filter: 'agTextColumnFilter', cellRenderer: p => <span style={S.bankPill}>{p.value || '-'}</span> }
  if (field === 'Responsable Comercial') return { ...base, width: 200, filter: 'agTextColumnFilter' }
  if (field === 'Status de Operaciones') return { ...base, width: 175, headerName: 'Estado', filter: 'agTextColumnFilter', cellRenderer: p => <span className={`badge ${badgeClass(p.value)}`} style={{ fontSize: 8 }}>{String(p.value || '-').toUpperCase()}</span> }
  if (field === 'Producto') return { ...base, width: 120, filter: 'agTextColumnFilter' }
  if (field === 'Origen') return { ...base, width: 110, filter: 'agTextColumnFilter' }
  return { ...base, width: 130, filter: 'agTextColumnFilter' }
}

const ModalDetalle = ({ item, onClose }) => (
  <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
    <div className="modal" style={{ maxWidth: 820 }}>
      <div className="modal-header">
        <h3>Detalle — {item['Numero de Factura'] || item['Nro Operacion'] || '-'}</h3>
        <button className="modal-close" onClick={onClose}>x</button>
      </div>
      <div className="modal-body">
        <div style={S.detailGrid}>
          {ALL_FIELDS.map(field => (
            <div key={field} style={S.detailBox}>
              <div style={S.detailLabel}>{field}</div>
              <div style={S.detailValue}>
                {MONEY_FIELDS.has(field) ? money(item[field], item['Moneda de la Operacion'])
                  : DATE_FIELDS.has(field) ? formatDate(item[field])
                  : String(item[field] ?? '-')}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Cerrar</button></div>
    </div>
  </div>
)

const CobranzasConsultaPage = () => {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [compactMode, setCompactMode] = useState(true)
  const [gridApi, setGridApi] = useState(null)
  const [quickText, setQuickText] = useState('')
  const [quickPreset, setQuickPreset] = useState('all')
  const [viewName, setViewName] = useState('')
  const [savedViews, setSavedViews] = useState(() => safeJsonParse(localStorage.getItem(SAVED_VIEWS_KEY), []))
  const [visibleCols, setVisibleCols] = useState({})
  const [displayedRows, setDisplayedRows] = useState([])
  const [showDashboard, setShowDashboard] = useState(() => safeJsonParse(localStorage.getItem(DASHBOARD_KEY), false))
  const [groupBy, setGroupBy] = useState('Status de Operaciones')
  const [gridPageInfo, setGridPageInfo] = useState({ current: 1, total: 1 })
  const [pageSize, setPageSize] = useState(50)
  const [showSidePanel, setShowSidePanel] = useState(false)
  const { toasts, show } = useToast()

  const cargar = async () => {
    setLoading(true)
    try {
      const res = await apiCall('/qf/adm/cobranzas/listar')
      let rows = []
      if (res && res.data && Array.isArray(res.data)) rows = res.data
      else if (Array.isArray(res)) rows = res
      else if (res && typeof res === 'object') { const v = Object.values(res).find(v => Array.isArray(v)); if (v) rows = v }
      setData(rows)
      setTotal(Number(res?.total ?? rows.length))
    } catch (e) {
      show('Error al cargar datos: ' + e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const quickFilteredData = useMemo(() => {
    return data.filter(row => {
      const status = normalize(row['Status de Operaciones'])
      const moneda = normalize(row['Moneda de la Operacion'])
      const producto = normalize(row['Producto'])
      const origen = normalize(row['Origen'])
      if (quickPreset === 'soles') return moneda.includes('sol') || moneda.includes('pen')
      if (quickPreset === 'dollars') return moneda.includes('dol') || moneda.includes('usd')
      if (quickPreset === 'desembolsado') return status.includes('desembol')
      if (quickPreset === 'vencida') return status.includes('vencid')
      if (quickPreset === 'liquidada') return status.includes('liquid')
      if (quickPreset === 'pendiente') return status.includes('pendiente')
      if (quickPreset === 'factoring') return producto.includes('factoring') || origen.includes('factoring')
      if (quickPreset === 'confirming') return producto.includes('confirming') || origen.includes('confirming')
      return true
    })
  }, [data, quickPreset])

  const metrics = useMemo(() => {
    const r = quickFilteredData
    return {
      netoTotal: r.reduce((s, x) => s + Number(x['Importe Neto'] || 0), 0),
      vencidas: r.filter(x => normalize(x['Status de Operaciones']).includes('vencid')).length,
      desembolsadas: r.filter(x => normalize(x['Status de Operaciones']).includes('desembol')).length,
      liquidadas: r.filter(x => normalize(x['Status de Operaciones']).includes('liquid')).length,
      fondos: new Set(r.map(x => x['Partner / Fondeo']).filter(Boolean)).size,
      clientes: new Set(r.map(x => x['Cliente']).filter(Boolean)).size,
    }
  }, [quickFilteredData])

  const refreshPaginationInfo = api => { if (!api) return; const t = Math.max(api.paginationGetTotalPages?.() || 1, 1); setGridPageInfo({ current: Math.min((api.paginationGetCurrentPage?.() || 0) + 1, t), total: t }) }
  const refreshDisplayedRows = api => { if (!api) return; const rows = []; api.forEachNodeAfterFilterAndSort(node => { if (node?.data) rows.push(node.data) }); setDisplayedRows(rows); refreshPaginationInfo(api) }

  const goGridPage = action => {
    if (!gridApi) return
    if (action === 'first') gridApi.paginationGoToFirstPage()
    if (action === 'prev') gridApi.paginationGoToPreviousPage()
    if (action === 'next') gridApi.paginationGoToNextPage()
    if (action === 'last') gridApi.paginationGoToLastPage()
    setTimeout(() => refreshPaginationInfo(gridApi), 0)
  }

  const limpiarFiltrosTabla = () => {
    if (!gridApi) return
    setQuickText(''); setQuickPreset('all')
    gridApi.setFilterModel(null); gridApi.setGridOption?.('quickFilterText', '')
    gridApi.applyColumnState({ defaultState: { sort: null } })
    setTimeout(() => refreshDisplayedRows(gridApi), 60)
  }

  const saveCurrentView = name => {
    if (!gridApi || !name.trim()) return
    const view = { id: Date.now(), name: name.trim(), quickText, quickPreset, pageSize, groupBy, showDashboard, filterModel: gridApi.getFilterModel(), columnState: gridApi.getColumnState(), createdAt: new Date().toISOString() }
    const next = [view, ...savedViews.filter(v => v.name !== view.name)].slice(0, 10)
    setSavedViews(next); localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next)); localStorage.setItem(GRID_VIEW_KEY, JSON.stringify(view)); setViewName(''); show('Vista guardada')
  }

  const applyView = view => {
    if (!gridApi || !view) return
    setQuickText(view.quickText || ''); setQuickPreset(view.quickPreset || 'all'); setGroupBy(view.groupBy || 'Status de Operaciones'); setShowDashboard(view.showDashboard ?? false); setPageSize(Number(view.pageSize || 50))
    setTimeout(() => { gridApi.setFilterModel(view.filterModel || null); if (view.columnState?.length) gridApi.applyColumnState({ state: view.columnState, applyOrder: true }); gridApi.setGridOption?.('quickFilterText', view.quickText || ''); refreshDisplayedRows(gridApi) }, 60)
  }

  const deleteView = id => { const next = savedViews.filter(v => v.id !== id); setSavedViews(next); localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(next)) }

  const resetGridView = () => {
    if (!gridApi) return
    setQuickText(''); setQuickPreset('all'); setGroupBy('Status de Operaciones'); setShowDashboard(false); setShowSidePanel(false); setPageSize(50)
    gridApi.setFilterModel(null); gridApi.resetColumnState(); gridApi.setGridOption?.('quickFilterText', ''); localStorage.removeItem(GRID_VIEW_KEY)
    setTimeout(() => { setVisibleCols(Object.fromEntries(gridApi.getColumns().map(c => [c.getColId(), c.isVisible()]))); refreshDisplayedRows(gridApi) }, 60)
  }

  const getDisplayedRows = () => { if (!gridApi) return quickFilteredData; const rows = []; gridApi.forEachNodeAfterFilterAndSort(node => { if (node?.data) rows.push(node.data) }); return rows }

  const exportCsv = () => {
    const rows = getDisplayedRows()
    downloadTextFile(`cobranzas_${new Date().toISOString().slice(0, 10)}.csv`, [ALL_FIELDS.join(';'), ...rows.map(r => ALL_FIELDS.map(f => csvEscape(r[f] ?? '')).join(';'))].join('\n'))
  }

  const exportExcel = () => {
    const rows = getDisplayedRows()
    const content = `<html><head><meta charset="utf-8" /></head><body><table border="1"><thead><tr>${ALL_FIELDS.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${ALL_FIELDS.map(f => `<td>${r[f] ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`
    downloadTextFile(`cobranzas_${new Date().toISOString().slice(0, 10)}.xls`, content, 'application/vnd.ms-excel;charset=utf-8;')
  }

  const exportPdf = () => {
    const rows = getDisplayedRows()
    const html = `<html><head><title>Cobranzas</title><style>body{font-family:Arial;color:#0f2742;padding:18px}h1{font-size:18px}table{width:100%;border-collapse:collapse;font-size:9px}th{background:#0f2742;color:#fff;padding:4px}td{border:1px solid #d9e2ec;padding:3px}.kpis{display:flex;gap:8px;margin:12px 0}.kpi{border:1px solid #d9e2ec;border-radius:8px;padding:8px;min-width:100px}.kpi b{display:block;font-size:14px;color:#185FA5}</style></head><body><h1>Consulta de Cobranzas</h1><div style="color:#64748b;font-size:11px;margin-bottom:12px">Generado: ${new Date().toLocaleString('es-PE')} · Registros: ${rows.length}</div><div class="kpis"><div class="kpi"><span>Registros</span><b>${rows.length}</b></div><div class="kpi"><span>Importe Neto</span><b>${money(rows.reduce((s, r) => s + Number(r['Importe Neto'] || 0), 0))}</b></div><div class="kpi"><span>Vencidas</span><b>${rows.filter(r => normalize(r['Status de Operaciones']).includes('vencid')).length}</b></div></div><table><thead><tr>${ALL_FIELDS.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${ALL_FIELDS.map(f => `<td>${MONEY_FIELDS.has(f) ? money(r[f], r['Moneda de la Operacion']) : DATE_FIELDS.has(f) ? formatDate(r[f]) : (r[f] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table><script>window.onload=()=>window.print()<\/script></body></html>`
    const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close() }
  }

  const buildGroupSummary = (rows, field) => {
    const map = new Map()
    rows.forEach(row => { const key = String(row[field] || 'Sin valor'); const c = map.get(key) || { name: key, count: 0, neto: 0 }; c.count += 1; c.neto += Number(row['Importe Neto'] || 0); map.set(key, c) })
    return [...map.values()].sort((a, b) => b.count - a.count)
  }

  const liveRows = displayedRows.length ? displayedRows : quickFilteredData
  const groupSummary = useMemo(() => buildGroupSummary(liveRows, groupBy), [liveRows, groupBy])
  const statusSummary = useMemo(() => buildGroupSummary(liveRows, 'Status de Operaciones'), [liveRows])
  const partnerSummary = useMemo(() => buildGroupSummary(liveRows, 'Partner / Fondeo'), [liveRows])
  const productoSummary = useMemo(() => buildGroupSummary(liveRows, 'Producto'), [liveRows])

  const from = quickFilteredData.length === 0 ? 0 : ((gridPageInfo.current - 1) * pageSize) + 1
  const to = Math.min(gridPageInfo.current * pageSize, quickFilteredData.length)

  const agColumnDefs = useMemo(() => {
    const cols = ALL_FIELDS.map(field => buildColDef(field))
    cols.push({
      headerName: 'Acciones', field: 'acciones', width: 115, pinned: 'right', sortable: false, filter: 'agTextColumnFilter', suppressMenu: true, floatingFilter: true, headerClass: 'qf-center-header',
      floatingFilterComponent: () => (<button className="btn btn-secondary btn-sm" style={S.floatActionBtn} onClick={() => setCompactMode(v => !v)}>{compactMode ? 'Vista cómoda' : 'Vista compacta'}</button>),
      floatingFilterComponentParams: { suppressFilterButton: true },
      cellRenderer: p => (<div style={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'center', height: '100%' }}><button className="btn btn-secondary btn-sm" onClick={() => setModal({ type: 'detalle', data: p.data })} style={S.aBtn}>Ver</button></div>),
    })
    return cols
  }, [compactMode])

  const agDefaultColDef = useMemo(() => ({
    sortable: true, filter: true, floatingFilter: true, resizable: true, minWidth: 80,
    cellStyle: { fontSize: compactMode ? '10.5px' : '12px', color: 'var(--qf-navy)', lineHeight: compactMode ? '18px' : '22px' },
    headerClass: 'qf-tareas-ag-header', floatingFilterComponentParams: { suppressFilterButton: false },
  }), [compactMode])

  const agLocaleText = useMemo(() => ({
    contains: 'Contiene', notContains: 'No contiene', equals: 'Igual', notEqual: 'Distinto', startsWith: 'Empieza con', endsWith: 'Termina con', blank: 'Vacío', notBlank: 'No vacío',
    filterOoo: 'Filtrar...', applyFilter: 'Aplicar', resetFilter: 'Restablecer', noRowsToShow: 'No se encontraron registros', loadingOoo: 'Cargando...',
    page: 'Página', to: 'a', of: 'de', next: 'Siguiente', previous: 'Anterior',
  }), [])

  return (
    <div className="fade-in" style={S.page}>
      <ToastContainer toasts={toasts} />
      <style>{`
        .qf-cob-grid .ag-root-wrapper{border:0;border-top:1px solid var(--qf-border);font-family:Montserrat,Arial,sans-serif}
        .qf-cob-grid .ag-header{background:var(--qf-navy);color:#fff;border-bottom:0}
        .qf-cob-grid .ag-header-cell,.qf-cob-grid .ag-header-group-cell{background:var(--qf-navy);color:#fff;font-weight:800;text-transform:uppercase;letter-spacing:.2px;border-right:0}
        .qf-cob-grid .ag-header-cell-text{color:#fff;font-size:8.5px}
        .qf-cob-grid .ag-header-cell{padding-left:2px;padding-right:2px;line-height:1}
        .qf-cob-grid .ag-icon,.qf-cob-grid .ag-header-icon{color:#fff;font-size:15px}
        .qf-cob-grid .ag-floating-filter{background:#f8fafc;border-bottom:1px solid var(--qf-border);min-height:10px}
        .qf-cob-grid .ag-floating-filter-input,.qf-cob-grid .ag-input-field-input{min-height:2px;height:6px;padding:0 2px 0 17px!important;font-size:8px;border-radius:7px;border:1px solid #9fb2c8!important;background-color:#fff!important;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23185FA5' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cline x1='16.5' y1='16.5' x2='21' y2='21'/%3E%3C/svg%3E")!important;background-repeat:no-repeat!important;background-position:4px calc(100% - 3px)!important;background-size:10px 10px!important;color:var(--qf-navy)}
        .qf-cob-grid .ag-floating-filter-button-button{min-width:22px;height:22px;width:22px;border-radius:7px;border:1px solid #9fb2c8;background:linear-gradient(135deg,#fff,#e8eef5)}
        .qf-cob-grid .ag-floating-filter .ag-icon{color:#185FA5!important;font-size:13px!important}
        .qf-cob-grid .ag-row{border-bottom:1px solid var(--qf-border)}.qf-cob-grid .ag-row-hover{background:#f8fafc}
        .qf-cob-grid .ag-cell{display:flex;align-items:center;padding-top:0!important;padding-bottom:0!important;line-height:1!important}
        .qf-cob-grid .qf-right-cell{justify-content:flex-end!important;text-align:right!important;padding-right:4px!important}
        .qf-cob-grid .qf-center-header .ag-header-cell-label{justify-content:center}
      `}</style>

      <div style={S.topHeader}>
        <h1 style={S.title}>💳 Consulta de Cobranzas</h1>
        <p style={S.subtitle}>Administración · Cobranzas · Consulta consolidada de operaciones</p>
      </div>

      <div style={S.kpiGrid}>
        {[
          { l: 'Total Registros', v: total, c: 'var(--qf-navy)', b: '#2196f3' },
          { l: 'Mostradas', v: quickFilteredData.length, c: '#185FA5', b: '#03a9f4' },
          { l: 'Importe Neto', v: money(metrics.netoTotal), c: '#2e7d32', b: '#4caf50' },
          { l: 'Desembolsadas', v: metrics.desembolsadas, c: '#e65100', b: '#ff9800' },
          { l: 'Vencidas', v: metrics.vencidas, c: '#c62828', b: '#f44336' },
          { l: 'Liquidadas', v: metrics.liquidadas, c: '#5e35b1', b: '#7e57c2' },
          { l: 'Clientes', v: metrics.clientes, c: '#37474f', b: '#607d8b' },
        ].map(s => <div key={s.l} style={{ ...S.kpiCard, borderTop: `3px solid ${s.b}` }}><div style={S.kpiLabel}>{s.l}</div><div style={{ ...S.kpiValue, color: s.c }}>{s.v}</div></div>)}
      </div>

      <div className="page-card" style={S.card}>
        <div style={S.stickyTools}>
          <div style={S.pagRow}>
            <select className="filter-input" value={pageSize} onChange={e => setPageSize(Number(e.target.value))} style={{ width: 'auto', minWidth: 70, height: 28, fontSize: 11, padding: '0 4px' }}>
              <option value={25}>25 filas</option><option value={50}>50 filas</option><option value={100}>100 filas</option><option value={200}>200 filas</option><option value={500}>500 filas</option>
            </select>
            <div style={S.topPagination}>
              <button className="btn btn-secondary btn-sm" style={S.pageNavBtn} disabled={gridPageInfo.current <= 1} onClick={() => goGridPage('first')}>«</button>
              <button className="btn btn-secondary btn-sm" style={S.pageNavBtn} disabled={gridPageInfo.current <= 1} onClick={() => goGridPage('prev')}>‹</button>
              <span style={S.pageMini}>Pág. {gridPageInfo.current} de {gridPageInfo.total}</span>
              <button className="btn btn-secondary btn-sm" style={S.pageNavBtn} disabled={gridPageInfo.current >= gridPageInfo.total} onClick={() => goGridPage('next')}>›</button>
              <button className="btn btn-secondary btn-sm" style={S.pageNavBtn} disabled={gridPageInfo.current >= gridPageInfo.total} onClick={() => goGridPage('last')}>»</button>
            </div>
            <span style={S.pill}>{from}-{to} de {quickFilteredData.length}</span>
            <div style={S.erpSearchWrap}>
              <span style={S.erpSearchIcon}>🔎</span>
              <input className="filter-input" value={quickText} onChange={e => { setQuickText(e.target.value); gridApi?.setGridOption?.('quickFilterText', e.target.value) }} placeholder="Búsqueda global..." style={S.erpSearch} />
            </div>
            <select className="filter-input" value={quickPreset} onChange={e => setQuickPreset(e.target.value)} style={S.erpSelect}>
              <option value="all">Vista: Todos</option><option value="soles">Solo Soles</option><option value="dollars">Solo Dólares</option><option value="desembolsado">Desembolsadas</option><option value="vencida">Vencidas</option><option value="liquidada">Liquidadas</option><option value="pendiente">Pendientes</option><option value="factoring">Factoring</option><option value="confirming">Confirming</option>
            </select>
            <button className="btn btn-secondary btn-sm" onClick={limpiarFiltrosTabla}>Limpiar filtros tabla</button>
            <button className="btn btn-secondary btn-sm" onClick={resetGridView} style={S.resetInlineBtn}>RESET</button>
            <button className="btn btn-secondary btn-sm" onClick={() => cargar()} title="Recargar">🔄</button>
            {loading && <span style={S.loadMini}>...</span>}
          </div>

          <div style={S.erpTools}>
            <div style={S.erpGroup}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowSidePanel(v => !v)}>Panel</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowDashboard(v => { localStorage.setItem(DASHBOARD_KEY, JSON.stringify(!v)); return !v })}>{showDashboard ? 'Ocultar BI' : 'Ver BI'}</button>
              <select className="filter-input" value={groupBy} onChange={e => setGroupBy(e.target.value)} style={S.erpSelectSmall}>
                <option value="Status de Operaciones">Agrupar: Estado</option><option value="Partner / Fondeo">Agrupar: Fondo</option><option value="Responsable Comercial">Agrupar: Comercial</option><option value="Producto">Agrupar: Producto</option><option value="Origen">Agrupar: Origen</option><option value="Moneda de la Operacion">Agrupar: Moneda</option>
              </select>
              <input className="filter-input" value={viewName} onChange={e => setViewName(e.target.value)} placeholder="Nombre de vista" style={S.viewInput} />
              <button className="btn btn-primary btn-sm" onClick={() => saveCurrentView(viewName)}>Guardar vista</button>
              {savedViews.length > 0 && (
                <>
                  <span style={S.savedTitle}>Vistas guardadas:</span>
                  <div style={S.savedViewsInline}>
                    {savedViews.map(v => (<span key={v.id} style={S.savedChip}><button type="button" onClick={() => applyView(v)} style={S.savedBtn}>{v.name}</button><button type="button" onClick={() => deleteView(v.id)} style={S.savedDel}>×</button></span>))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={S.smartTotals}>
            <span><b>{liveRows.length}</b> filtradas</span>
            <span><b>{money(liveRows.reduce((s, r) => s + Number(r['Importe Neto'] || 0), 0))}</b> neto</span>
            <span><b>{liveRows.filter(r => normalize(r['Status de Operaciones']).includes('vencid')).length}</b> vencidas</span>
            <span><b>{liveRows.filter(r => normalize(r['Status de Operaciones']).includes('desembol')).length}</b> desembolsadas</span>
            <span><b>{new Set(liveRows.map(r => r['Cliente']).filter(Boolean)).size}</b> clientes</span>
            <div style={S.exportTotalsGroup}>
              <button className="btn btn-secondary btn-sm" style={S.exportBtn} onClick={exportCsv}>CSV</button>
              <button className="btn btn-secondary btn-sm" style={S.exportBtn} onClick={exportExcel}>Excel</button>
              <button className="btn btn-secondary btn-sm" style={S.exportBtn} onClick={exportPdf}>PDF</button>
            </div>
          </div>

          {showSidePanel && (
            <div style={S.sidePanel}>
              <div style={S.sideSection}>
                <div style={S.sideTitle}>Filtros rápidos</div>
                <button className="btn btn-secondary btn-sm" onClick={() => setQuickPreset('vencida')}>Vencidas</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setQuickPreset('desembolsado')}>Desembolsadas</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setQuickPreset('factoring')}>Factoring</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setQuickPreset('confirming')}>Confirming</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setQuickPreset('all')}>Ver todo</button>
              </div>
              <div style={S.sideSection}>
                <div style={S.sideTitle}>Exportación</div>
                <button className="btn btn-secondary btn-sm" onClick={exportCsv}>CSV filtrado</button>
                <button className="btn btn-secondary btn-sm" onClick={exportExcel}>Excel filtrado</button>
                <button className="btn btn-secondary btn-sm" onClick={exportPdf}>PDF / imprimir</button>
              </div>
              <div style={S.sideSection}>
                <div style={S.sideTitle}>Agrupación actual</div>
                {groupSummary.slice(0, 6).map(g => (<div key={g.name} style={S.groupMini}><span>{g.name}</span><b>{g.count}</b></div>))}
              </div>
            </div>
          )}

          {showDashboard && (
            <div style={S.dashboard}>
              <div style={S.dashPanel}>
                <div style={S.sideTitle}>Por Estado</div>
                {statusSummary.slice(0, 8).map(g => (<div key={g.name} style={S.barRow}><span style={S.barLabel}>{g.name}</span><div style={S.barTrack}><div style={{ ...S.barFill, width: pctBar(g.count, liveRows.length) }} /></div><b style={S.barValue}>{g.count}</b></div>))}
              </div>
              <div style={S.dashPanel}>
                <div style={S.sideTitle}>Por Fondo</div>
                {partnerSummary.slice(0, 8).map(g => (<div key={g.name} style={S.barRow}><span style={S.barLabel}>{g.name}</span><div style={S.barTrack}><div style={{ ...S.barFill, width: pctBar(g.count, liveRows.length), background: '#5e35b1' }} /></div><b style={S.barValue}>{g.count}</b></div>))}
              </div>
              <div style={S.dashPanel}>
                <div style={S.sideTitle}>Por Producto</div>
                {productoSummary.slice(0, 8).map(g => (<div key={g.name} style={S.barRow}><span style={S.barLabel}>{g.name}</span><div style={S.barTrack}><div style={{ ...S.barFill, width: pctBar(g.count, liveRows.length), background: '#00695c' }} /></div><b style={S.barValue}>{g.count}</b></div>))}
              </div>
            </div>
          )}
        </div>

        <div className="ag-theme-quartz qf-cob-grid" style={{ width: '100%', height: compactMode ? 'calc(100vh - 300px)' : 'calc(100vh - 355px)', minHeight: 310, '--ag-font-size': compactMode ? '10.5px' : '12px', '--ag-header-height': '35px', '--ag-row-height': compactMode ? '25px' : '32px', '--ag-wrapper-border-radius': '0px', position: 'relative' }}>
          {loading && data.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner dark" /></div>
          ) : (
            <AgGridReact
              rowData={quickFilteredData}
              columnDefs={agColumnDefs}
              headerHeight={32}
              floatingFiltersHeight={26}
              rowHeight={compactMode ? 23 : 28}
              defaultColDef={agDefaultColDef}
              pagination suppressPaginationPanel
              paginationPageSize={pageSize}
              paginationPageSizeSelector={[25, 50, 100, 200, 500]}
              localeText={agLocaleText}
              onGridReady={params => {
                setGridApi(params.api)
                setVisibleCols(Object.fromEntries(params.api.getColumns().map(c => [c.getColId(), c.isVisible()])))
                const lastView = safeJsonParse(localStorage.getItem(GRID_VIEW_KEY), null)
                setTimeout(() => { if (lastView) applyView(lastView); refreshDisplayedRows(params.api) }, 80)
              }}
              quickFilterText={quickText} animateRows suppressCellFocus
              onFilterChanged={params => refreshDisplayedRows(params.api)}
              onSortChanged={params => refreshDisplayedRows(params.api)}
              onPaginationChanged={params => refreshPaginationInfo(params.api)}
              onColumnVisible={params => setVisibleCols(Object.fromEntries(params.api.getColumns().map(c => [c.getColId(), c.isVisible()])))}
              overlayNoRowsTemplate="<span style='padding:10px;color:#64748b;font-size:12px;'>No se encontraron registros</span>"
            />
          )}
        </div>
      </div>

      {modal?.type === 'detalle' && <ModalDetalle item={modal.data} onClose={() => setModal(null)} />}
    </div>
  )
}

const S = {
  page: { paddingBottom: 12, maxWidth: '100%', overflowX: 'hidden' },
  topHeader: { marginBottom: 6 },
  title: { fontFamily: 'Montserrat', fontSize: 22, fontWeight: 800, color: 'var(--qf-navy)', marginBottom: 2 },
  subtitle: { color: 'var(--qf-text-light)', fontSize: 12 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 10 },
  kpiCard: { background: '#fff', borderRadius: 10, padding: '8px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', minHeight: 56 },
  kpiLabel: { fontSize: 8.5, color: 'var(--qf-text-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  kpiValue: { fontWeight: 850, fontFamily: 'Montserrat', lineHeight: 1.1, fontSize: 19 },
  card: { overflow: 'hidden' },
  stickyTools: { background: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottom: '1px solid var(--qf-border)' },
  pill: { fontSize: 10, fontWeight: 700, color: 'var(--qf-navy)', background: '#e8eef5', borderRadius: 999, padding: '3px 8px' },
  topPagination: { display: 'flex', alignItems: 'center', gap: 3, background: '#e8eef5', borderRadius: 999, padding: '2px 5px', border: '1px solid #c9d7e6' },
  pageMini: { fontSize: 10, fontWeight: 800, color: 'var(--qf-navy)', minWidth: 72, textAlign: 'center' },
  pageNavBtn: { minWidth: 22, height: 22, padding: '0 6px', borderRadius: 999, fontWeight: 900 },
  resetInlineBtn: { minWidth: 54, height: 24, padding: '0 8px', textTransform: 'uppercase', fontSize: 10, fontWeight: 800 },
  floatActionBtn: { height: 21, padding: '0 4px', fontSize: 8, borderRadius: 6, whiteSpace: 'nowrap', minWidth: 70, display: 'block', margin: '0 auto', textAlign: 'center' },
  exportTotalsGroup: { marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, flexShrink: 0 },
  exportBtn: { height: 24, padding: '0 10px', fontSize: 10, borderRadius: 8, fontWeight: 700 },
  erpTools: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap', padding: '2px 10px', background: '#fff', borderTop: '1px solid var(--qf-border)', width: '100%' },
  erpGroup: { display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', minWidth: 0 },
  erpSearchWrap: { position: 'relative', width: 210, flexShrink: 0 },
  erpSearchIcon: { position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#8a9bb5', pointerEvents: 'none', zIndex: 1 },
  erpSearch: { width: '100%', height: 24, fontSize: 10, paddingLeft: 30 },
  erpSelect: { minWidth: 150, height: 24, fontSize: 9.5, padding: '0 22px 0 8px' },
  erpSelectSmall: { minWidth: 130, height: 24, fontSize: 9.5, padding: '0 20px 0 7px' },
  viewInput: { width: 140, height: 24, fontSize: 10 },
  savedViewsInline: { display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' },
  savedTitle: { fontSize: 10, color: 'var(--qf-text-light)', fontWeight: 800, whiteSpace: 'nowrap' },
  savedChip: { display: 'inline-flex', alignItems: 'center', border: '1px solid #9fb2c8', borderRadius: 999, overflow: 'hidden', background: '#e8eef5' },
  savedBtn: { border: 0, background: 'transparent', padding: '3px 7px', cursor: 'pointer', fontSize: 10.5, color: 'var(--qf-navy)', fontWeight: 700 },
  savedDel: { border: 0, background: '#dbe7f3', padding: '3px 6px', cursor: 'pointer', fontSize: 11, color: '#c62828', fontWeight: 900 },
  smartTotals: { display: 'flex', gap: 8, flexWrap: 'nowrap', alignItems: 'center', padding: '3px 10px', background: '#f8fafc', borderTop: '1px solid var(--qf-border)', color: 'var(--qf-text-light)', fontSize: 10.5, width: '100%' },
  pagRow: { display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'nowrap', padding: '3px 10px', background: '#f8fafc', borderTop: '1px solid var(--qf-border)', width: '100%' },
  loadMini: { fontSize: 11, color: '#185FA5', fontWeight: 700 },
  opCode: { background: '#e8eef5', padding: '1px 4px', borderRadius: 3, fontSize: 9.5, fontWeight: 800, color: 'var(--qf-navy)' },
  bankPill: { background: '#e8eef5', color: 'var(--qf-navy)', borderRadius: 3, padding: '1px 4px', fontSize: 9.5, fontWeight: 700, whiteSpace: 'nowrap' },
  aBtn: { fontSize: 9, padding: '1px 6px' },
  sidePanel: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8, padding: '8px 10px', background: '#fff', borderTop: '1px solid var(--qf-border)' },
  sideSection: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', background: '#f8fafc', border: '1px solid var(--qf-border)', borderRadius: 8, padding: 8 },
  sideTitle: { width: '100%', fontSize: 9.5, fontWeight: 800, color: 'var(--qf-navy)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 },
  groupMini: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, minWidth: 120, background: '#fff', border: '1px solid var(--qf-border)', borderRadius: 999, padding: '2px 8px', fontSize: 10, color: 'var(--qf-navy)' },
  dashboard: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, padding: '8px 10px', background: '#fff', borderTop: '1px solid var(--qf-border)' },
  dashPanel: { background: '#f8fafc', border: '1px solid var(--qf-border)', borderRadius: 8, padding: 8 },
  barRow: { display: 'grid', gridTemplateColumns: '110px 1fr 32px', alignItems: 'center', gap: 6, marginTop: 4 },
  barLabel: { fontSize: 9, color: 'var(--qf-text-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  barTrack: { height: 6, background: '#e8eef5', borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', background: '#185FA5', borderRadius: 999 },
  barValue: { fontSize: 10, color: 'var(--qf-navy)', textAlign: 'right' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 },
  detailBox: { background: '#f8fafc', border: '1px solid var(--qf-border)', borderRadius: 8, padding: 8 },
  detailLabel: { fontSize: 9, fontWeight: 700, color: 'var(--qf-text-light)', textTransform: 'uppercase' },
  detailValue: { fontSize: 12, fontWeight: 600, color: 'var(--qf-navy)' },
}

export default CobranzasConsultaPage
