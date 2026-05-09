import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiCall, toArray } from '../utils/api'

const CLAIM = 'INVCTL'
const API_BASE = '/qf/inversionistas'

const EMPTY_FORM = {
  id: null,
  codigo: '',
  tipo_documento: 'DNI',
  numero_documento: '',
  naturaleza: 'PN',
  razon_social: '',
  nombre: '',
  apellido: '',
  email: '',
  banco: '',
  moneda: '',
  cuenta: '',
  cci: '',
  direccion: '',
  estado: 'Activo',
  condicion: '',
  ubigeo: '',
  via_tipo: '',
  via_nombre: '',
  zona_codigo: '',
  zona_tipo: '',
  numero_direccion: '',
  interior: '',
  lote: '',
  dpto: '',
  manzana: '',
  kilometro: '',
  distrito: '',
  provincia: '',
  departamento: '',
  es_agente_retencion: false,
  es_buen_contribuyente: false,
  locales_anexos: '',
}

const SEARCH_FIELDS = [
  { value: 'all', label: 'Todos' },
  { value: 'codigo', label: 'Código' },
  { value: 'numero_documento', label: 'DNI/RUC' },
  { value: 'razon_social', label: 'Razón social' },
  { value: 'nombre', label: 'Nombre' },
  { value: 'apellido', label: 'Apellido' },
  { value: 'email', label: 'Email' },
  { value: 'banco', label: 'Banco' },
  { value: 'moneda', label: 'Moneda' },
  { value: 'estado', label: 'Estado' },
]

// Helper para mapear tipo_documento a texto completo
const getTipoDocumentoLabel = (value) => {
  const map = {
    '1': 'DNI',
    '2': 'RUC',
    'DNI': 'DNI',
    'RUC': 'RUC',
  }
  return map[value] || value || '-'
}

// Helper para obtener el valor correcto del tipo documento desde el backend
const normalizeTipoDocumento = (value) => {
  if (!value) return 'DNI'
  if (value === '1' || value === 'DNI') return 'DNI'
  if (value === '2' || value === 'RUC') return 'RUC'
  return 'DNI'
}

const getBit = (value, index) => String(value || '00000000000')[index] === '1'

const getField = (obj, ...keys) => {
  if (!obj) return ''
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key]
    const lower = key.toLowerCase()
    const upper = key.toUpperCase()
    if (obj[lower] !== undefined && obj[lower] !== null) return obj[lower]
    if (obj[upper] !== undefined && obj[upper] !== null) return obj[upper]
  }
  return ''
}

const parseMaybeJson = (value) => {
  if (typeof value !== 'string') return value
  const text = value.trim()
  if (!text) return value
  if (!text.startsWith('{') && !text.startsWith('[')) return value
  try {
    return JSON.parse(text)
  } catch (_) {
    return value
  }
}

const unwrapPayload = (res) => parseMaybeJson(res?.json ?? res?.data ?? res ?? {})

const unwrapDocumentPayload = (res) => {
  let payload = unwrapPayload(res)

  // Soporta respuestas directas, arrays de Decolecta: [{...}], y envolturas tipo
  // { json }, { data }, { result }, { results }, { body }, { response }.
  for (let i = 0; i < 8; i += 1) {
    if (Array.isArray(payload)) {
      payload = payload[0] || {}
      continue
    }

    if (!payload || typeof payload !== 'object') break

    const next = payload.json ?? payload.data ?? payload.result ?? payload.results ?? payload.body ?? payload.response
    if (!next || next === payload) break

    payload = next
  }

  return Array.isArray(payload) ? (payload[0] || {}) : (payload || {})
}

const firstNonEmpty = (...values) => values.find(v => String(v ?? '').trim() !== '') || ''

const joinNames = (...values) => values
  .map(v => String(v ?? '').trim())
  .filter(Boolean)
  .join(' ')

const normalizeBoolean = (value) => {
  if (value === true || value === 1) return true
  const v = normalize(value)
  return ['true', '1', 'si', 'sí', 'yes'].includes(v)
}

const formatBoolean = (value) => normalizeBoolean(value) ? 'Sí' : 'No'

const safeDisplay = (value) => {
  if (value === true || value === false) return formatBoolean(value)
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

const safeJsonText = (value) => {
  if (!value) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch (_) {
    return String(value)
  }
}

const safeApiValue = (value) => {
  const v = String(value ?? '').trim()
  return v === '-' ? '' : v
}

const findFieldDeep = (source, keys, maxDepth = 8) => {
  const wanted = keys.map(k => String(k).toLowerCase())
  const seen = new Set()

  const walk = (value, depth) => {
    if (value === null || value === undefined || depth > maxDepth) return ''

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = walk(item, depth + 1)
        if (found !== '') return found
      }
      return ''
    }

    if (typeof value !== 'object') return ''
    if (seen.has(value)) return ''
    seen.add(value)

    for (const [key, val] of Object.entries(value)) {
      if (wanted.includes(String(key).toLowerCase()) && val !== undefined && val !== null && String(val).trim() !== '') {
        return val
      }
    }

    for (const val of Object.values(value)) {
      const found = walk(val, depth + 1)
      if (found !== '') return found
    }

    return ''
  }

  return walk(source, 0)
}

const pickDocumentField = (payload, rawResponse, ...keys) => {
  const direct = getField(payload, ...keys)
  if (direct !== undefined && direct !== null && String(direct).trim() !== '') return direct
  return findFieldDeep(rawResponse, keys)
}

const safeDocumentValue = (payload, rawResponse, ...keys) => safeApiValue(pickDocumentField(payload, rawResponse, ...keys))

const safeArray = (res) => {
  let payload = unwrapPayload(res)

  // Soporta respuestas de n8n/Vercel como:
  // [...], "[...]", { json: [...] }, { data: [...] }, { body: "[...]" }, etc.
  for (let i = 0; i < 8; i += 1) {
    payload = parseMaybeJson(payload)

    if (Array.isArray(payload)) return payload

    if (!payload || typeof payload !== 'object') break

    const candidates = [
      payload.json,
      payload.data,
      payload.rows,
      payload.items,
      payload.result,
      payload.results,
      payload.bancos,
      payload.monedas,
      payload.body,
      payload.response,
    ]

    const arr = candidates.find(v => Array.isArray(parseMaybeJson(v)))
    if (arr) return parseMaybeJson(arr)

    const next = candidates.find(v => v !== undefined && v !== null && v !== payload)
    if (!next) break
    payload = next
  }

  payload = parseMaybeJson(payload)
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') return [payload]

  return toArray ? toArray(payload) : []
}

const getBancoId = (b) => getField(b, 'id', 'ID', 'banco_id', 'BANCO_ID', 'codigo', 'CODIGO', 'value', 'Value')
const getBancoLabel = (b) => getField(b, 'name', 'nombre', 'Name', 'NOMBRE', 'descripcion', 'DESCRIPCION', 'label', 'Label', 'VALORTEXTO', 'valortexto')
const getMonedaId = (m) => getField(m, 'ID', 'id', 'moneda_id', 'MONEDA_ID', 'codigo', 'CODIGO', 'value', 'Value')
const getMonedaLabel = (m) => getField(m, 'CODIGO', 'codigo', 'VALORTEXTO1', 'valortexto1', 'simbolo', 'SIMBOLO', 'DESCRIPCION', 'descripcion', 'nombre', 'NOMBRE', 'VALORTEXTO', 'valortexto', 'label', 'Label')

const getBancoNombre = (bancoId, bancos) => {
  const item = bancos.find(b => String(getBancoId(b)) === String(bancoId))
  return item ? getBancoLabel(item) : ''
}

const getMonedaNombre = (monedaId, monedas) => {
  const item = monedas.find(m => String(getMonedaId(m)) === String(monedaId))
  return item ? getMonedaLabel(item) : ''
}

const inferDocumentInfo = (value) => {
  const numero = String(value || '').replace(/\D/g, '').slice(0, 11)
  const tipo_documento = numero.length === 11 ? 'RUC' : 'DNI'
  const naturaleza = tipo_documento === 'RUC' && numero.startsWith('20') ? 'PJ' : 'PN'
  return { numero, tipo_documento, naturaleza }
}

const getNaturalezaLabel = (value) => value === 'PJ' ? 'Persona Jurídica' : 'Persona Natural'

const normalize = (v) => String(v ?? '').toLowerCase().trim()

const ControlInversionistas = () => {
  const { permisos } = useAuth()
  const claimValue = permisos?.[CLAIM] || '00000000000'

  const canList = getBit(claimValue, 1)
  const canView = getBit(claimValue, 2)
  const canEdit = getBit(claimValue, 3)
  const canCreate = getBit(claimValue, 5)
  const canDelete = getBit(claimValue, 6)

  const [comfortable, setComfortable] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)

  const [bancos, setBancos] = useState([])
  const [monedas, setMonedas] = useState([])

  const [field, setField] = useState('all')
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const [sortField, setSortField] = useState('id')
  const [sortDir, setSortDir] = useState('desc')

  const [detail, setDetail] = useState(null)
  const [modal, setModal] = useState({ open: false, mode: 'create', form: EMPTY_FORM })

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : ((page - 1) * pageSize) + 1
  const to = Math.min(page * pageSize, total)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q)
      setPage(1)
    }, 450)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    if (!canList) return
    loadLookups()
  }, [canList])

  useEffect(() => {
    if (!canList) return
    loadData()
  }, [canList, page, pageSize, field, debouncedQ])

  const loadLookups = async () => {
    try {
      const [banksRes, monedasRes] = await Promise.all([
        apiCall(`${API_BASE}/bancos`),
        apiCall(`${API_BASE}/monedas`),
      ])

      const banks = safeArray(banksRes).filter(b => getBancoId(b) && getBancoLabel(b))
      const mons = safeArray(monedasRes).filter(m => getMonedaId(m) && getMonedaLabel(m))

      setBancos(banks)
      setMonedas(mons)
    } catch (err) {
      setError(err?.message || 'No se pudieron cargar los catálogos.')
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        field,
        q: debouncedQ,
      })

      const res = await apiCall(`${API_BASE}/listar?${params.toString()}`)

      const payload = res?.json || res
      const rows = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.rows)
          ? payload.rows
          : Array.isArray(payload)
            ? payload
            : safeArray(payload)

      setData(rows)
      setTotal(Number(payload?.total ?? payload?.count ?? rows.length ?? 0))
    } catch (err) {
      setError(err?.message || 'No se pudo cargar la lista de inversionistas.')
    } finally {
      setLoading(false)
    }
  }

  const metrics = useMemo(() => {
    const esJuridico = (r) => {
      const nat = normalize(r.naturaleza)
      const tipoDoc = normalize(r.tipo_documento)
      const tipoRuc = normalize(r.tipo_ruc)
      return nat === 'pj'
        || nat.includes('jur')
        || tipoDoc === 'ruc'
        || tipoDoc === '2'
        || tipoRuc === 'pj'
        || tipoRuc.includes('jur')
    }

    const esNatural = (r) => {
      const nat = normalize(r.naturaleza)
      const tipoDoc = normalize(r.tipo_documento)
      const tipoRuc = normalize(r.tipo_ruc)
      return nat === 'pn'
        || nat.includes('natural')
        || tipoDoc === 'dni'
        || tipoDoc === '1'
        || tipoRuc === 'pn'
        || tipoRuc.includes('natural')
    }

    const naturales = data.filter(esNatural).length
    const juridicos = data.filter(esJuridico).length
    const activos = data.filter(r => !r.estado || normalize(r.estado) === 'activo').length
    const inactivos = data.filter(r => r.estado && normalize(r.estado) !== 'activo').length

    return [
      { label: 'Total registros', value: total, color: 'var(--qf-navy)', border: '#2196f3' },
      { label: 'Mostradas', value: data.length, color: '#185FA5', border: '#03a9f4' },
      { label: 'Persona natural', value: naturales, color: '#2e7d32', border: '#4caf50' },
      { label: 'Persona jurídica', value: juridicos, color: '#5e35b1', border: '#7e57c2' },
      { label: 'Activos', value: activos, color: '#2e7d32', border: '#4caf50' },
      { label: 'Inactivos', value: inactivos, color: '#c62828', border: '#f44336' },
    ]
  }, [data, total])

  const sortedData = useMemo(() => {
    const rows = [...data]

    rows.sort((a, b) => {
      let av = a?.[sortField]
      let bv = b?.[sortField]

      if (sortField === 'banco_nombre') {
        av = a.banco_nombre || getBancoNombre(a.banco, bancos)
        bv = b.banco_nombre || getBancoNombre(b.banco, bancos)
      }

      if (sortField === 'moneda_nombre') {
        av = a.moneda_codigo || getMonedaNombre(a.moneda, monedas)
        bv = b.moneda_codigo || getMonedaNombre(b.moneda, monedas)
      }

      if (sortField === 'naturaleza') {
        const getTipoPersona = (r) => {
          const nat = normalize(r.naturaleza)
          const tipoDoc = normalize(r.tipo_documento)
          const tipoRuc = normalize(r.tipo_ruc)

          if (
            nat === 'pj' ||
            nat.includes('jur') ||
            tipoDoc === 'ruc' ||
            tipoDoc === '2' ||
            tipoRuc === 'pj' ||
            tipoRuc.includes('jur')
          ) {
            return 'persona juridica'
          }

          return 'persona natural'
        }

        av = getTipoPersona(a)
        bv = getTipoPersona(b)
      }

      const an = Number(av)
      const bn = Number(bv)
      let cmp = 0

      if (!Number.isNaN(an) && !Number.isNaN(bn) && String(av).trim() !== '' && String(bv).trim() !== '') {
        cmp = an - bn
      } else {
        cmp = normalize(av).localeCompare(normalize(bv))
      }

      return sortDir === 'asc' ? cmp : -cmp
    })

    return rows
  }, [data, sortField, sortDir, bancos, monedas])

  const sortBy = (key) => {
    if (sortField === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    else {
      setSortField(key)
      setSortDir('asc')
    }
  }

  const sortIcon = (key) => sortField === key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'

  const openCreate = async () => {
    setError('')
    let nextCode = ''

    try {
      const res = await apiCall(`${API_BASE}/siguiente-codigo?naturaleza=PN`)
      nextCode = res?.codigo || ''
    } catch (_) {}

    setModal({ open: true, mode: 'create', form: { ...EMPTY_FORM, codigo: nextCode } })
  }

  const openEdit = (row) => {
    setError('')
    setModal({
      open: true,
      mode: 'edit',
      form: {
        id: row.id,
        codigo: row.codigo || '',
        tipo_documento: normalizeTipoDocumento(row.tipo_documento),
        numero_documento: row.numero_documento || '',
        naturaleza: row.naturaleza || row.tipo_ruc || (normalizeTipoDocumento(row.tipo_documento) === 'RUC' ? 'PJ' : 'PN'),
        razon_social: row.razon_social || '',
        nombre: row.nombre || '',
        apellido: row.apellido || '',
        email: row.email || '',
        banco: row.banco || '',
        moneda: row.moneda || '',
        cuenta: row.cuenta || '',
        cci: row.cci || '',
        direccion: row.direccion || '',
        estado: row.estado || 'Activo',
        condicion: row.condicion || '',
        ubigeo: row.ubigeo || '',
        via_tipo: row.via_tipo || '',
        via_nombre: row.via_nombre || '',
        zona_codigo: row.zona_codigo || '',
        zona_tipo: row.zona_tipo || '',
        numero_direccion: row.numero_direccion || row.numero || '',
        interior: row.interior || '',
        lote: row.lote || '',
        dpto: row.dpto || '',
        manzana: row.manzana || '',
        kilometro: row.kilometro || '',
        distrito: row.distrito || '',
        provincia: row.provincia || '',
        departamento: row.departamento || '',
        es_agente_retencion: normalizeBoolean(row.es_agente_retencion),
        es_buen_contribuyente: normalizeBoolean(row.es_buen_contribuyente),
        locales_anexos: safeJsonText(row.locales_anexos),
      }
    })
  }

  const validateDocument = async () => {
    const { numero, tipo_documento, naturaleza } = inferDocumentInfo(modal.form.numero_documento)

    if (!numero) {
      setError('Ingrese un DNI/RUC para validar.')
      return
    }

    if (tipo_documento === 'DNI' && numero.length !== 8) {
      setError('El DNI debe tener 8 dígitos.')
      return
    }

    if (tipo_documento === 'RUC' && numero.length !== 11) {
      setError('El RUC debe tener 11 dígitos.')
      return
    }

    try {
      setSaving(true)
      setError('')

      const params = new URLSearchParams({
        tipo_documento,
        nro_documento: numero,
        numero_documento: numero,
      })

      const res = await apiCall(`${API_BASE}/validar-documento?${params.toString()}`)
      const payload = unwrapDocumentPayload(res)

      const apiMessage = getField(payload, 'message', 'mensaje', 'error', 'errors')
      const success = getField(payload, 'success', 'ok')

      if (success === false || success === 'false') {
        throw new Error(apiMessage || 'El API no encontró información para el documento.')
      }

      const razonSocial = firstNonEmpty(
        getField(payload, 'razon_social', 'razonSocial', 'nombre_o_razon_social', 'nombreORazonSocial', 'nombre_razon_social'),
        tipo_documento === 'RUC' ? getField(payload, 'nombre') : ''
      )

      const nombres = firstNonEmpty(
        getField(payload, 'nombres', 'preNombres', 'first_name'),
        tipo_documento === 'DNI' ? getField(payload, 'nombre', 'full_name') : ''
      )

      const apellidoPaterno = getField(payload, 'apellido_paterno', 'apellidoPaterno', 'apePaterno', 'first_last_name')
      const apellidoMaterno = getField(payload, 'apellido_materno', 'apellidoMaterno', 'apeMaterno', 'second_last_name')
      const apellidos = firstNonEmpty(
        joinNames(apellidoPaterno, apellidoMaterno),
        getField(payload, 'apellidos', 'apellido')
      )

      const direccion = firstNonEmpty(
        getField(payload, 'direccion', 'domicilio', 'direccion_completa', 'direccionCompleta'),
        joinNames(
          getField(payload, 'tipoVia'),
          getField(payload, 'nombreVia'),
          getField(payload, 'numero'),
          getField(payload, 'distrito'),
          getField(payload, 'provincia'),
          getField(payload, 'departamento')
        )
      )

      const estadoApi = firstNonEmpty(getField(payload, 'estado', 'estado_contribuyente', 'status'))
      const condicionApi = firstNonEmpty(getField(payload, 'condicion', 'condicion_contribuyente'))
      const estado = estadoApi || condicionApi || 'Activo'

      const sunatFields = {
        condicion: safeDocumentValue(payload, res, 'condicion', 'condicion_contribuyente'),
        ubigeo: safeDocumentValue(payload, res, 'ubigeo'),
        via_tipo: safeDocumentValue(payload, res, 'via_tipo', 'tipoVia'),
        via_nombre: safeDocumentValue(payload, res, 'via_nombre', 'nombreVia'),
        zona_codigo: safeDocumentValue(payload, res, 'zona_codigo'),
        zona_tipo: safeDocumentValue(payload, res, 'zona_tipo'),
        numero_direccion: safeDocumentValue(payload, res, 'numero_direccion', 'numero'),
        interior: safeDocumentValue(payload, res, 'interior'),
        lote: safeDocumentValue(payload, res, 'lote'),
        dpto: safeDocumentValue(payload, res, 'dpto'),
        manzana: safeDocumentValue(payload, res, 'manzana'),
        kilometro: safeDocumentValue(payload, res, 'kilometro'),
        distrito: safeDocumentValue(payload, res, 'distrito'),
        provincia: safeDocumentValue(payload, res, 'provincia'),
        departamento: safeDocumentValue(payload, res, 'departamento'),
        es_agente_retencion: normalizeBoolean(pickDocumentField(payload, res, 'es_agente_retencion')),
        es_buen_contribuyente: normalizeBoolean(pickDocumentField(payload, res, 'es_buen_contribuyente')),
        locales_anexos: safeJsonText(pickDocumentField(payload, res, 'locales_anexos')),
      }

      setModal(prev => ({
        ...prev,
        form: {
          ...prev.form,
          numero_documento: numero,
          tipo_documento,
          naturaleza,
          razon_social: naturaleza === 'PJ' || tipo_documento === 'RUC'
            ? (razonSocial || prev.form.razon_social)
            : prev.form.razon_social,
          nombre: naturaleza === 'PN'
            ? (nombres || (tipo_documento === 'RUC' ? razonSocial : '') || prev.form.nombre)
            : '',
          apellido: naturaleza === 'PN'
            ? (apellidos || prev.form.apellido)
            : '',
          direccion: direccion || prev.form.direccion,
          estado,
          condicion: sunatFields.condicion || prev.form.condicion,
          ubigeo: sunatFields.ubigeo || prev.form.ubigeo,
          via_tipo: sunatFields.via_tipo || prev.form.via_tipo,
          via_nombre: sunatFields.via_nombre || prev.form.via_nombre,
          zona_codigo: sunatFields.zona_codigo || prev.form.zona_codigo,
          zona_tipo: sunatFields.zona_tipo || prev.form.zona_tipo,
          numero_direccion: sunatFields.numero_direccion || prev.form.numero_direccion,
          interior: sunatFields.interior || prev.form.interior,
          lote: sunatFields.lote || prev.form.lote,
          dpto: sunatFields.dpto || prev.form.dpto,
          manzana: sunatFields.manzana || prev.form.manzana,
          kilometro: sunatFields.kilometro || prev.form.kilometro,
          distrito: sunatFields.distrito || prev.form.distrito,
          provincia: sunatFields.provincia || prev.form.provincia,
          departamento: sunatFields.departamento || prev.form.departamento,
          es_agente_retencion: sunatFields.es_agente_retencion,
          es_buen_contribuyente: sunatFields.es_buen_contribuyente,
          locales_anexos: sunatFields.locales_anexos || prev.form.locales_anexos,
        }
      }))

      if (modal.mode === 'create') {
        const codeRes = await apiCall(`${API_BASE}/siguiente-codigo?naturaleza=${naturaleza}`)
        setModal(prev => ({
          ...prev,
          form: {
            ...prev.form,
            codigo: codeRes?.codigo || codeRes?.data?.codigo || prev.form.codigo,
          }
        }))
      }
    } catch (err) {
      setError(err?.message || 'No se pudo validar el documento contra el API.')
    } finally {
      setSaving(false)
    }
  }

  const handleFormChange = async (name, value) => {
    if (name === 'numero_documento') {
      const info = inferDocumentInfo(value)
      setModal(prev => ({
        ...prev,
        form: {
          ...prev.form,
          numero_documento: info.numero,
          tipo_documento: info.tipo_documento,
          naturaleza: info.naturaleza,
        }
      }))

      if (modal.mode === 'create' && info.numero.length >= 8) {
        try {
          const res = await apiCall(`${API_BASE}/siguiente-codigo?naturaleza=${info.naturaleza}`)
          setModal(prev => ({ ...prev, form: { ...prev.form, codigo: res?.codigo || res?.data?.codigo || prev.form.codigo } }))
        } catch (_) {}
      }
      return
    }

    setModal(prev => ({ ...prev, form: { ...prev.form, [name]: value } }))
  }

  const validateForm = (form) => {
    if (!form.codigo) return 'El código es obligatorio.'
    if (!form.tipo_documento) return 'El tipo de documento es obligatorio.'
    if (!form.numero_documento) return 'El número de documento es obligatorio.'
    if (form.tipo_documento === 'DNI' && String(form.numero_documento).length !== 8) return 'El DNI debe tener 8 dígitos.'
    if (form.tipo_documento === 'RUC' && String(form.numero_documento).length !== 11) return 'El RUC debe tener 11 dígitos.'
    if (!form.razon_social && !form.nombre) return 'Ingrese razón social o nombre.'
    if (!form.banco) return 'Seleccione un banco.'
    if (!form.moneda) return 'Seleccione una moneda.'
    return ''
  }

  const saveForm = async () => {
    const form = modal.form
    const validation = validateForm(form)

    if (validation) {
      setError(validation)
      return
    }

    try {
      setSaving(true)
      setError('')

      const endpoint = modal.mode === 'edit' ? 'actualizar' : 'crear'

	const res = await apiCall(`${API_BASE}/${endpoint}`, {
	  method: 'POST',
	  headers: { 'Content-Type': 'application/json' },
	  body: JSON.stringify(form),
	})

	// Detectar duplicado
	const text = JSON.stringify(res || {})

	if (
	  text.includes('Duplicate entry') ||
	  text.includes('uq_inversionistas_numero_documento')
	) {
	  throw new Error('El número de documento ya existe')
	}

	setModal({ open: false, mode: 'create', form: EMPTY_FORM })
	await loadData()
    } catch (err) {
      setError(err?.message || 'No se pudo guardar el inversionista.')
    } finally {
      setSaving(false)
    }
  }

  const deleteRow = async (row) => {
    if (!window.confirm(`¿Eliminar inversionista ${row.codigo || row.id}?`)) return

    try {
      setLoading(true)
      setError('')

      // ✅ Corrección: Enviar JSON válido
      await apiCall(`${API_BASE}/eliminar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id }),
      })

      await loadData()
    } catch (err) {
      setError(err?.message || 'No se pudo eliminar el registro.')
    } finally {
      setLoading(false)
    }
  }

  if (!canList) {
    return (
      <div className="fade-in" style={S.page}>
        <PageHeader />
        <div style={S.noPerm}>No tienes permisos para listar este módulo.</div>
      </div>
    )
  }

  return (
    <div style={S.page}>
      <PageHeader />

      <div style={S.actionBar}>
        <button className="btn btn-secondary btn-sm" onClick={() => setComfortable(v => !v)}>
          {comfortable ? 'Vista compacta' : 'Vista cómoda'}
        </button>
      </div>

      <div style={S.kpiGrid}>
        {metrics.map(k => (
          <div key={k.label} style={{ ...S.kpiCard, borderTop: `3px solid ${k.border}` }}>
            <div style={S.kpiLabel}>{k.label}</div>
            <div style={{ ...S.kpiValue, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="page-card" style={S.card}>
        <div style={S.stickyTools}>
          <div style={S.cardTitleWrap}>
            <h2 style={S.cardTitle}>Base de Datos Inversionistas</h2>
            {canCreate && (
              <button className="btn btn-primary btn-sm" onClick={openCreate} style={S.newBtn}>
                <span style={{ color: '#4CAF50', fontWeight: 800, fontSize: 16 }}>+</span> Nuevo Registro
              </button>
            )}
          </div>

          <div style={S.filters}>
          <select
            className="filter-input"
            value={field}
            onChange={e => {
              setField(e.target.value)
              setPage(1)
            }}
            style={S.select}
          >
            {SEARCH_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>

          <div style={S.searchWrap}>
            <span style={S.searchIcon}>🔍</span>
            <input
              className="filter-input"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar inversionista..."
              style={S.searchInput}
            />
          </div>

          <button
            className="btn btn-secondary btn-sm"
            style={S.clearBtn}
            onClick={() => {
              setField('all')
              setQ('')
              setDebouncedQ('')
              setPage(1)
            }}
          >
            Limpiar
          </button>
        </div>

        <div style={S.pagination}>
          <span style={S.resultPill}>{from}-{to} de {total}</span>

          <select
            className="filter-input"
            value={pageSize}
            onChange={e => {
              setPageSize(Number(e.target.value))
              setPage(1)
            }}
            style={S.pageSize}
          >
            {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
          </select>

          <button className="btn btn-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setPage(1)}>«</button>
          <button className="btn btn-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setPage(p => Math.max(1, p - 1))}>‹</button>
          <span style={S.pageIndicator}>{page}/{totalPages}</span>
          <button className="btn btn-secondary btn-sm" disabled={page >= totalPages || loading} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>›</button>
          <button className="btn btn-secondary btn-sm" disabled={page >= totalPages || loading} onClick={() => setPage(totalPages)}>»</button>
        </div>
        </div>

        {error && <div style={S.error}>{error}</div>}

        <div style={S.tableWrap}>
          <table className="qf-table" style={{ ...S.table, fontSize: comfortable ? 12 : 10.5 }}>
            <thead>
              <tr>
                <Th onClick={() => sortBy('codigo')}>Código {sortIcon('codigo')}</Th>
                <Th onClick={() => sortBy('tipo_documento')}>Doc. {sortIcon('tipo_documento')}</Th>
                <Th onClick={() => sortBy('numero_documento')}>Número {sortIcon('numero_documento')}</Th>
                <Th onClick={() => sortBy('naturaleza')}>Tipo Persona {sortIcon('naturaleza')}</Th>
                <Th onClick={() => sortBy('razon_social')}>Razón Social {sortIcon('razon_social')}</Th>
                <Th onClick={() => sortBy('nombre')}>Nombre {sortIcon('nombre')}</Th>
                <Th onClick={() => sortBy('email')}>Email {sortIcon('email')}</Th>
                <Th onClick={() => sortBy('banco_nombre')}>Banco {sortIcon('banco_nombre')}</Th>
                <Th onClick={() => sortBy('moneda_nombre')}>M {sortIcon('moneda_nombre')}</Th>
                <Th onClick={() => sortBy('cuenta')}>Cuenta {sortIcon('cuenta')}</Th>
                <Th onClick={() => sortBy('estado')}>Estado {sortIcon('estado')}</Th>
                <th style={S.th}>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr><td colSpan={12} style={S.empty}>Cargando...</td></tr>
              )}

              {!loading && sortedData.length === 0 && (
                <tr><td colSpan={12} style={S.empty}>No hay registros para mostrar.</td></tr>
              )}

              {!loading && sortedData.map(row => (
                <tr key={row.id || row.codigo} style={S.tr}>
                  <td style={S.td}><code style={S.code}>{row.codigo}</code></td>
                  <td style={S.td}>{getTipoDocumentoLabel(row.tipo_documento)}</td>
                  <td style={S.td}>{row.numero_documento}</td>
                  <td style={S.td}>{row.naturaleza === 'PN' ? 'Persona Natural' : row.naturaleza === 'PJ' ? 'Persona Jurídica' : (String(row.numero_documento || '').startsWith('20') ? 'Persona Jurídica' : getTipoDocumentoLabel(row.tipo_documento) === 'DNI' || getTipoDocumentoLabel(row.tipo_documento) === 'RUC' ? 'Persona Natural' : row.naturaleza)}</td>
                  <td style={S.td}>{row.razon_social}</td>
                  <td style={S.td}>{[row.nombre, row.apellido].filter(Boolean).join(' ')}</td>
                  <td style={S.td}>{row.email}</td>
                  <td style={S.td}>
                    <span style={S.pill}>{row.banco_nombre || getBancoNombre(row.banco, bancos)}</span>
                  </td>
                  <td style={S.td}>{row.moneda_codigo || getMonedaNombre(row.moneda, monedas)}</td>
                  <td style={{ ...S.td, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.cuenta}</td>
                  <td style={S.td}><EstadoBadge value={row.estado || 'Activo'} /></td>
                  <td style={S.td}>
                    <div style={S.actions}>
                      {canView && <button className="btn btn-secondary btn-sm" style={S.actionBtn} onClick={() => setDetail(row)}>Ver</button>}
                      {canEdit && <button className="btn btn-primary btn-sm" style={S.actionBtn} onClick={() => openEdit(row)}>Edit</button>}
                      {canDelete && <button className="btn btn-danger btn-sm" style={S.dangerBtn} onClick={() => deleteRow(row)}>Del</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={S.footer}>Registros cargados en página: {data.length}</div>
      </div>

      {detail && (
        <DetailModal
          row={detail}
          bancos={bancos}
          monedas={monedas}
          onClose={() => setDetail(null)}
        />
      )}

      {modal.open && (
        <FormModal
          mode={modal.mode}
          form={modal.form}
          bancos={bancos}
          monedas={monedas}
          saving={saving}
          error={error}
          onClose={() => setModal({ open: false, mode: 'create', form: EMPTY_FORM })}
          onChange={handleFormChange}
          onValidate={validateDocument}
          onSave={saveForm}
        />
      )}
    </div>
  )
}

const PageHeader = () => (
  <div style={S.topHeader}>
    <h1 style={S.title}>👥 Control de Inversionistas</h1>
    <p style={S.subtitle}>Registro, mantenimiento y consulta de inversionistas integrados con validación DNI/RUC.</p>
  </div>
)

const Th = ({ children, onClick }) => (
  <th style={S.th} onClick={onClick}>{children}</th>
)

const EstadoBadge = ({ value }) => {
  const v = normalize(value)
  const type = v.includes('activo') || v.includes('validado') ? 'active' : v.includes('pend') ? 'warning' : 'inactive'
  const style = type === 'active' ? S.badgeActive : type === 'warning' ? S.badgeWarning : S.badgeInactive

  return <span className={`badge ${type}`} style={{ ...S.badge, ...style }}>{value || 'N/D'}</span>
}

const DetailModal = ({ row, bancos, monedas, onClose }) => {
  const fields = [
    ['ID', row.id],
    ['Código', row.codigo],
    ['Tipo Documento', getTipoDocumentoLabel(row.tipo_documento)],
    ['Documento', row.numero_documento],
    ['Naturaleza', row.naturaleza === 'PN' ? 'Persona Natural' : row.naturaleza === 'PJ' ? 'Persona Jurídica' : row.naturaleza],
    ['Razón Social', row.razon_social],
    ['Nombre', row.nombre],
    ['Apellido', row.apellido],
    ['Email', row.email],
    ['Banco', row.banco_nombre || getBancoNombre(row.banco, bancos)],
    ['Moneda', row.moneda_codigo || getMonedaNombre(row.moneda, monedas)],
    ['Cuenta Bancaria', row.cuenta],
    ['CCI', row.cci],
    ['Dirección', row.direccion],
    ['Estado', row.estado || 'Activo'],
    ['Condición SUNAT', row.condicion],
    ['Ubigeo', row.ubigeo],
    ['Departamento', row.departamento],
    ['Provincia', row.provincia],
    ['Distrito', row.distrito],
    ['Tipo vía', row.via_tipo],
    ['Nombre vía', row.via_nombre],
    ['Número dirección', row.numero_direccion || row.numero],
    ['Zona código', row.zona_codigo],
    ['Zona tipo', row.zona_tipo],
    ['Interior', row.interior],
    ['Lote', row.lote],
    ['Dpto.', row.dpto],
    ['Manzana', row.manzana],
    ['Kilómetro', row.kilometro],
    ['Agente retención', formatBoolean(row.es_agente_retencion)],
    ['Buen contribuyente', formatBoolean(row.es_buen_contribuyente)],
    ['Locales anexos', safeJsonText(row.locales_anexos)],
    ['Creado', row.created_at],
    ['Actualizado', row.updated_at],
  ]

  return (
    <div className="modal-overlay" style={S.modalOverlay}>
      <div className="modal" style={{ ...S.modal, overflowY: 'auto' }}>
        <div style={S.modalHeader}>
          <h2 style={S.modalTitle}>Detalle de Inversionista</h2>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>

        <div style={S.detailGrid}>
          {fields.map(([label, value]) => (
            <div key={label} style={S.detailBox}>
              <div style={S.detailLabel}>{label}</div>
              <div style={S.detailValue}>{safeDisplay(value)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const FormModal = ({ mode, form, bancos, monedas, saving, error, onClose, onChange, onValidate, onSave }) => {
  const isEdit = mode === 'edit'
  const activeBanks = bancos.filter(b => normalize(getField(b, 'status', 'estado')) !== 'inactive')

  return (
    <div className="modal-overlay" style={S.modalOverlay}>
      <div className="modal" style={{ ...S.modal, maxWidth: 980, overflowY: 'auto' }}>
        <div style={S.modalHeader}>
          <h2 style={S.modalTitle}>{isEdit ? 'Modificar Inversionista' : 'Crear Inversionista'}</h2>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>

        {error && <div style={S.error}>{error}</div>}

        <div style={S.formGrid4}>
          <Field label="Código">
            <input className="form-control" value={form.codigo || ''} readOnly style={S.input} />
          </Field>

          <Field label="Tipo documento">
            <input
              className="form-control"
              value={form.tipo_documento || 'DNI'}
              readOnly
              style={{ ...S.input, background: '#f8fafc', fontWeight: 800 }}
            />
          </Field>

          <Field label="Número">
            <input
              className="form-control"
              value={form.numero_documento || ''}
              onChange={e => onChange('numero_documento', e.target.value.replace(/\D/g, ''))}
              style={S.input}
            />
          </Field>

          <Field label="Validación">
            <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={onValidate}>
              {saving ? 'Validando...' : 'Validar DNI/RUC'}
            </button>
          </Field>
        </div>

        <div style={S.formGrid3}>
          <Field label="Naturaleza">
            <input
              className="form-control"
              value={getNaturalezaLabel(form.naturaleza)}
              readOnly
              style={{ ...S.input, background: '#f8fafc', fontWeight: 800 }}
            />
          </Field>

          <Field label="Razón social">
            <input className="form-control" value={form.razon_social || ''} onChange={e => onChange('razon_social', e.target.value)} style={S.input} />
          </Field>

          <Field label="Estado">
            <select className="form-control" value={form.estado || 'Activo'} onChange={e => onChange('estado', e.target.value)} style={S.input}>
              <option value="Activo">Activo</option>
              <option value="ACTIVO">ACTIVO</option>
              <option value="Inactivo">Inactivo</option>
              <option value="INACTIVO">INACTIVO</option>
              <option value="Pendiente">Pendiente</option>
            </select>
          </Field>
        </div>

        <div style={S.formGrid3}>
          <Field label="Nombre">
            <input className="form-control" value={form.nombre || ''} onChange={e => onChange('nombre', e.target.value)} style={S.input} />
          </Field>

          <Field label="Apellido">
            <input className="form-control" value={form.apellido || ''} onChange={e => onChange('apellido', e.target.value)} style={S.input} />
          </Field>

          <Field label="Email">
            <input className="form-control" type="email" value={form.email || ''} onChange={e => onChange('email', e.target.value)} style={S.input} />
          </Field>
        </div>

        <div style={S.formGrid4}>
          <Field label="Banco">
            <select 
              className="form-control" 
              value={form.banco || ''} 
              onChange={e => onChange('banco', e.target.value)} 
              style={{ ...S.input, minWidth: 180 }}
            >
              <option value="">Seleccione...</option>
              {activeBanks.map(b => {
                const bankId = getBancoId(b)
                const bankName = getBancoLabel(b)
                return (
                  <option key={bankId} value={bankId} title={bankName}>
                    {bankName}
                  </option>
                )
              })}
            </select>
          </Field>

          <Field label="Moneda">
            <select 
              className="form-control" 
              value={form.moneda || ''} 
              onChange={e => onChange('moneda', e.target.value)} 
              style={{ ...S.input, minWidth: 120 }}
            >
              <option value="">Seleccione...</option>
              {monedas.map(m => {
                const monId = getMonedaId(m)
                const monName = getMonedaLabel(m)
                return (
                  <option key={monId} value={monId} title={monName}>
                    {monName}
                  </option>
                )
              })}
            </select>
          </Field>

          <Field label="Cuenta bancaria">
            <input className="form-control" value={form.cuenta || ''} onChange={e => onChange('cuenta', e.target.value)} style={S.input} />
          </Field>

          <Field label="CCI">
            <input className="form-control" value={form.cci || ''} onChange={e => onChange('cci', e.target.value)} style={S.input} />
          </Field>
        </div>

        <div style={S.singleFieldWrap}>
          <Field label="Dirección">
            <input className="form-control" value={form.direccion || ''} onChange={e => onChange('direccion', e.target.value)} style={S.input} />
          </Field>
        </div>

        <SectionTitle>Datos SUNAT / ubicación fiscal</SectionTitle>

        <div style={S.formGrid4}>
          <Field label="Condición SUNAT">
            <input className="form-control" value={form.condicion || ''} onChange={e => onChange('condicion', e.target.value)} style={S.input} />
          </Field>

          <Field label="Ubigeo">
            <input className="form-control" value={form.ubigeo || ''} onChange={e => onChange('ubigeo', e.target.value)} style={S.input} />
          </Field>

          <Field label="Departamento">
            <input className="form-control" value={form.departamento || ''} onChange={e => onChange('departamento', e.target.value)} style={S.input} />
          </Field>

          <Field label="Provincia">
            <input className="form-control" value={form.provincia || ''} onChange={e => onChange('provincia', e.target.value)} style={S.input} />
          </Field>
        </div>

        <div style={S.formGrid4}>
          <Field label="Distrito">
            <input className="form-control" value={form.distrito || ''} onChange={e => onChange('distrito', e.target.value)} style={S.input} />
          </Field>

          <Field label="Tipo vía">
            <input className="form-control" value={form.via_tipo || ''} onChange={e => onChange('via_tipo', e.target.value)} style={S.input} />
          </Field>

          <Field label="Nombre vía">
            <input className="form-control" value={form.via_nombre || ''} onChange={e => onChange('via_nombre', e.target.value)} style={S.input} />
          </Field>

          <Field label="Número dirección">
            <input className="form-control" value={form.numero_direccion || ''} onChange={e => onChange('numero_direccion', e.target.value)} style={S.input} />
          </Field>
        </div>

        <div style={S.formGrid4}>
          <Field label="Zona código">
            <input className="form-control" value={form.zona_codigo || ''} onChange={e => onChange('zona_codigo', e.target.value)} style={S.input} />
          </Field>

          <Field label="Zona tipo">
            <input className="form-control" value={form.zona_tipo || ''} onChange={e => onChange('zona_tipo', e.target.value)} style={S.input} />
          </Field>

          <Field label="Interior">
            <input className="form-control" value={form.interior || ''} onChange={e => onChange('interior', e.target.value)} style={S.input} />
          </Field>

          <Field label="Lote">
            <input className="form-control" value={form.lote || ''} onChange={e => onChange('lote', e.target.value)} style={S.input} />
          </Field>
        </div>

        <div style={S.formGrid4}>
          <Field label="Dpto.">
            <input className="form-control" value={form.dpto || ''} onChange={e => onChange('dpto', e.target.value)} style={S.input} />
          </Field>

          <Field label="Manzana">
            <input className="form-control" value={form.manzana || ''} onChange={e => onChange('manzana', e.target.value)} style={S.input} />
          </Field>

          <Field label="Kilómetro">
            <input className="form-control" value={form.kilometro || ''} onChange={e => onChange('kilometro', e.target.value)} style={S.input} />
          </Field>

          <Field label="Agente retención">
            <select className="form-control" value={form.es_agente_retencion ? '1' : '0'} onChange={e => onChange('es_agente_retencion', e.target.value === '1')} style={S.input}>
              <option value="0">No</option>
              <option value="1">Sí</option>
            </select>
          </Field>
        </div>

        <div style={S.formGrid4}>
          <Field label="Buen contribuyente">
            <select className="form-control" value={form.es_buen_contribuyente ? '1' : '0'} onChange={e => onChange('es_buen_contribuyente', e.target.value === '1')} style={S.input}>
              <option value="0">No</option>
              <option value="1">Sí</option>
            </select>
          </Field>
        </div>

        <div style={S.singleFieldWrap}>
          <Field label="Locales anexos">
            <textarea className="form-control" value={form.locales_anexos || ''} onChange={e => onChange('locales_anexos', e.target.value)} style={S.textarea} />
          </Field>
        </div>

        <div style={S.modalActions}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={saving} onClick={onSave}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

const SectionTitle = ({ children }) => (
  <div style={S.sectionTitle}>{children}</div>
)

const Field = ({ label, children }) => (
  <label style={S.field}>
    <span style={S.fieldLabel}>{label}</span>
    {children}
  </label>
)

const S = {
  page: { paddingBottom: 12, maxWidth: '100%', overflowX: 'hidden' },
  topHeader: { marginBottom: 6 },
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 },
  headerIcon: { display: 'none' },
  title: { fontFamily: 'Montserrat', fontSize: 22, fontWeight: 800, color: 'var(--qf-navy)', margin: 0, marginBottom: 2 },
  subtitle: { color: 'var(--qf-text-light)', fontSize: 12, margin: 0 },
  actionBar: { display: 'flex', gap: 8, marginBottom: 8 },

  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 10 },
  kpiCard: { background: '#fff', borderRadius: 10, padding: '8px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', minHeight: 56 },
  kpiLabel: { fontSize: 8.5, color: 'var(--qf-text-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  kpiValue: { fontWeight: 850, fontFamily: 'Montserrat', lineHeight: 1.1, fontSize: 19, marginTop: 0 },

  card: { overflow: 'hidden', padding: 0 },
  stickyTools: { background: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottom: '1px solid var(--qf-border)' },
  cardHeader: { display: 'none' },
  cardTitleWrap: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px 6px' },
  cardTitle: { margin: 0, fontSize: 16, fontFamily: 'Montserrat', color: 'var(--qf-navy)' },
  cardSub: { display: 'none' },
  newBtn: { display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' },

  filters: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '0 14px 6px', margin: 0 },
  select: { width: 'auto', minWidth: 170, height: 32, fontSize: 12, padding: '0 28px 0 10px' },
  searchWrap: { position: 'relative', flex: 1, maxWidth: 360, minWidth: 220 },
  searchIcon: { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#8a9bb5', pointerEvents: 'none', opacity: 1 },
  searchInput: { minWidth: 180, maxWidth: 360, height: 32, fontSize: 12, paddingLeft: 32, width: '100%' },
  clearBtn: { fontSize: 11 },

  pagination: { display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap', padding: '5px 14px 7px', background: '#f8fafc', borderTop: '1px solid var(--qf-border)', margin: 0 },
  resultPill: { fontSize: 10, fontWeight: 700, color: 'var(--qf-navy)', background: '#e8eef5', borderRadius: 999, padding: '3px 8px', whiteSpace: 'nowrap', border: 'none' },
  pageSize: { width: 'auto', minWidth: 52, height: 28, fontSize: 11, padding: '0 4px' },
  pageIndicator: { fontSize: 11, color: 'var(--qf-text-light)', fontWeight: 600 },

  tableWrap: { maxHeight: 'calc(100vh - 340px)', minHeight: 260, overflow: 'auto', width: '100%' },
  table: { width: '100%', tableLayout: 'auto', borderCollapse: 'collapse' },
  th: { position: 'sticky', top: 0, zIndex: 10, whiteSpace: 'nowrap', fontSize: 9, padding: '5px 4px', cursor: 'pointer', userSelect: 'none', background: 'var(--qf-navy)', color: '#fff', borderBottom: '1px solid var(--qf-navy)', textTransform: 'uppercase', fontWeight: 800, textAlign: 'left', lineHeight: 1.1 },
  tr: { height: 32 },
  td: { padding: '3px 4px', verticalAlign: 'middle', lineHeight: 1.15, borderBottom: '1px solid #eef2f6', fontSize: 10.5 },
  code: { background: '#e8eef5', padding: '1px 4px', borderRadius: 3, fontSize: 9.5, fontWeight: 800, color: 'var(--qf-navy)' },
  pill: { display: 'inline-block', background: '#e8eef5', color: 'var(--qf-navy)', borderRadius: 3, padding: '1px 4px', fontSize: 9.5, fontWeight: 700, whiteSpace: 'nowrap' },

  badge: { borderRadius: 999, padding: '2px 6px', fontSize: 8, fontWeight: 900, textTransform: 'uppercase' },
  badgeActive: { background: '#e8f5e9', color: '#2e7d32' },
  badgeWarning: { background: '#fff8e1', color: '#e65100' },
  badgeInactive: { background: '#ffebee', color: '#c62828' },

  actions: { display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'nowrap' },
  actionBtn: { fontSize: 9, padding: '1px 4px' },
  dangerBtn: { fontSize: 9, padding: '1px 4px' },

  footer: { padding: '6px 14px', borderTop: '1px solid var(--qf-border)', fontSize: 10.5, color: 'var(--qf-text-light)', background: '#fff', margin: 0 },
  empty: { textAlign: 'center', padding: 40, color: 'var(--qf-text-light)' },

  primaryBtn: { background: 'var(--qf-navy)', color: 'white', border: 'none', borderRadius: 8, padding: '7px 12px', fontWeight: 800 },
  secondaryBtn: { background: '#f8fafc', color: 'var(--qf-navy)', border: '1px solid var(--qf-border)', borderRadius: 8, padding: '7px 12px', fontWeight: 800 },
  error: { background: '#fce4e4', color: '#c62828', borderRadius: 8, padding: '10px 14px', fontSize: 13, margin: '8px 14px' },
  noPerm: { background: 'white', border: '1px solid var(--qf-border)', borderRadius: 12, padding: 18, color: '#c62828', fontWeight: 800 },

  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 16 },
  modal: { background: 'white', borderRadius: 14, padding: 0, width: '94vw', maxWidth: 980, maxHeight: '92vh', overflow: 'hidden', boxShadow: '0 18px 50px rgba(0,0,0,0.25)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--qf-border)' },
  modalTitle: { margin: 0, fontFamily: 'Montserrat', color: 'var(--qf-navy)', fontSize: 18 },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, padding: 16 },
  detailBox: { background: '#f8fafc', border: '1px solid var(--qf-border)', borderRadius: 8, padding: 8 },
  detailLabel: { fontSize: 9, textTransform: 'uppercase', color: 'var(--qf-text-light)', fontWeight: 700 },
  detailValue: { fontSize: 12, fontWeight: 600, color: 'var(--qf-navy)', wordBreak: 'break-word' },

  formGrid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0 16px', padding: '0 18px' },
  formGrid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 16px', padding: '0 18px' },
  field: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 },
  singleFieldWrap: { padding: '0 18px' },
  fieldLabel: { fontSize: 9, textTransform: 'uppercase', color: 'var(--qf-text-light)', fontWeight: 700 },
  sectionTitle: { margin: '8px 18px 10px', paddingTop: 10, borderTop: '1px solid var(--qf-border)', fontFamily: 'Montserrat', fontSize: 13, fontWeight: 800, color: 'var(--qf-navy)' },
  input: { height: 34, fontSize: 12, borderRadius: 6, border: '1px solid var(--qf-border)', padding: '0 8px', width: '100%' },
  textarea: { minHeight: 58, fontSize: 12, borderRadius: 6, border: '1px solid var(--qf-border)', padding: '8px', width: '100%', resize: 'vertical' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12, padding: '12px 18px', borderTop: '1px solid var(--qf-border)' },
}

export default ControlInversionistas
