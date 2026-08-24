import React, { useMemo, useState } from 'react'
import { Card } from './ui'
import { CATEGORIES } from '../data'
import { fmtCLP } from '../lib/helpers'

const SOURCE_META = {
  'Mercado Pago': { color: '#FFE600' },
  'CMR Falabella': { color: '#39A845' },
  'Banco de Chile': { color: '#2455B6' },
  'Tarjeta de crédito': { color: '#5C6470' },
  'Otros': { color: '#9A9A92' },
}

function chileDate() {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Santiago',
  }).format(new Date())
}

function firstDayMonthsAgo(monthsAgo) {
  const [year, month] = chileDate().split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 - monthsAgo, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : ''
}

function monthKey(value) {
  const day = dateOnly(value)
  return day ? day.slice(0, 7) : ''
}

function monthLabel(key, long = false) {
  if (!key) return '—'
  const [year, month] = key.split('-').map(Number)
  const label = new Intl.DateTimeFormat('es-CL', {
    month: long ? 'long' : 'short',
    year: long ? 'numeric' : undefined,
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1))).replace('.', '')
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function monthsBetween(from, to) {
  if (!from || !to) return []
  const [fy, fm] = from.slice(0, 7).split('-').map(Number)
  const [ty, tm] = to.slice(0, 7).split('-').map(Number)
  const out = []
  let cursor = new Date(Date.UTC(fy, fm - 1, 1))
  const end = new Date(Date.UTC(ty, tm - 1, 1))
  let guard = 0
  while (cursor <= end && guard < 60) {
    out.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`)
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
    guard++
  }
  return out
}

function categoryMeta(id) {
  return CATEGORIES.find(item => item.id === id)
    || CATEGORIES.find(item => item.id === 'otros')
    || { id: 'otros', label: 'Otros', icon: '•', color: '#888880' }
}

function rowCategory(row) {
  return row.categoryMeta?.id ? row.categoryMeta : categoryMeta(row.category || 'otros')
}

function sourceLabel(row) {
  if (row.bank === 'mercadopago' || row.originSource === 'mercadopago') return 'Mercado Pago'
  if (row.type === 'credito') {
    if (row.bank === 'falabella') return 'CMR Falabella'
    if (row.bank === 'bchile') return 'Banco de Chile'
    return 'Tarjeta de crédito'
  }
  return 'Otros'
}

function summarize(rows, keyFn) {
  const map = new Map()
  rows.forEach(row => {
    const key = keyFn(row)
    if (!key) return
    const current = map.get(key) || { key, amount: 0, count: 0 }
    current.amount += Number(row.amount || 0)
    current.count += 1
    map.set(key, current)
  })
  return [...map.values()].sort((a, b) => b.amount - a.amount)
}

function Metric({ label, value, detail, tone = 'default' }) {
  const cls = tone === 'dark'
    ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]'
    : 'bg-[var(--bg-elev)] text-[var(--ink)] border-[var(--line)]'
  return <div className={`rounded-2xl border p-3.5 min-h-[100px] ${cls}`}>
    <div className="text-[9px] uppercase tracking-[.12em] font-bold opacity-55">{label}</div>
    <div className="font-mono text-[18px] md:text-[21px] font-bold mt-2 leading-tight">{value}</div>
    <div className="text-[9px] opacity-65 mt-1 leading-relaxed">{detail}</div>
  </div>
}

function HorizontalBar({ label, amount, max, detail, color = 'var(--ink)', active = false, onClick }) {
  const pct = max > 0 ? Math.max(2, Math.round(amount * 100 / max)) : 0
  const Component = onClick ? 'button' : 'div'
  return <Component
    type={onClick ? 'button' : undefined}
    onClick={onClick}
    className={`w-full text-left rounded-xl p-1.5 -m-1.5 transition ${onClick ? 'hover:bg-[var(--hover)]' : ''} ${active ? 'bg-[var(--hover)]' : ''}`}
  >
    <div className="flex items-center justify-between gap-3 text-[10px]">
      <div className="font-medium truncate">{label}</div>
      <div className="font-mono font-semibold whitespace-nowrap">{fmtCLP(amount)}</div>
    </div>
    <div className="h-2 rounded-full bg-[var(--hover)] mt-1.5 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }}/>
    </div>
    {detail && <div className="text-[8.5px] text-[var(--muted)] mt-1">{detail}</div>}
  </Component>
}

function Donut({ rows, total, selected, onSelect }) {
  const slices = rows.slice(0, 6)
  const visibleTotal = slices.reduce((sum, row) => sum + row.amount, 0)
  const otherAmount = Math.max(0, total - visibleTotal)
  const parts = [...slices]
  if (otherAmount > 0) parts.push({
    key: 'otros-donut',
    amount: otherAmount,
    meta: { label: 'Resto', icon: '•', color: '#B8B8B0' },
  })

  let cursor = 0
  const gradient = parts.length
    ? parts.map(part => {
      const start = cursor
      const end = cursor + (part.amount * 100 / Math.max(total, 1))
      cursor = end
      return `${part.meta.color || '#888880'} ${start}% ${end}%`
    }).join(', ')
    : '#EAEAE6 0% 100%'

  return <div className="grid sm:grid-cols-[180px_1fr] gap-5 items-center mt-4">
    <div className="mx-auto relative w-40 h-40 rounded-full" style={{ background: `conic-gradient(${gradient})` }}>
      <div className="absolute inset-[28px] rounded-full bg-[var(--bg-elev)] grid place-items-center text-center px-2">
        <div>
          <div className="text-[8px] uppercase tracking-[.1em] text-[var(--muted)]">Total</div>
          <div className="font-mono text-[14px] font-bold mt-1">{fmtCLP(total)}</div>
        </div>
      </div>
    </div>
    <div className="space-y-2">
      {parts.map(part => (
        <button
          key={part.key}
          type="button"
          disabled={part.key === 'otros-donut'}
          onClick={() => part.key !== 'otros-donut' && onSelect?.(selected === part.key ? 'all' : part.key)}
          className={`w-full flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left ${part.key !== 'otros-donut' ? 'hover:bg-[var(--hover)]' : ''} ${selected === part.key ? 'bg-[var(--hover)]' : ''}`}
        >
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: part.meta.color || '#888880' }}/>
            <span className="text-[9.5px] truncate">{part.meta.icon} {part.meta.label}</span>
          </span>
          <span className="text-[9px] font-mono whitespace-nowrap">{total ? Math.round(part.amount * 100 / total) : 0}%</span>
        </button>
      ))}
    </div>
  </div>
}

function downloadCSV(rows) {
  const columns = [
    ['fecha', row => dateOnly(row.date)],
    ['comercio', row => row.description || ''],
    ['categoria', row => rowCategory(row).label],
    ['fuente', row => sourceLabel(row)],
    ['monto', row => Number(row.amount || 0)],
    ['banco', row => row.bank || ''],
    ['cuotas', row => row.installments || 1],
  ]
  const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`
  const csv = [
    columns.map(([label]) => label).map(quote).join(','),
    ...rows.map(row => columns.map(([, getter]) => quote(getter(row))).join(',')),
  ].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `gastito_reporte_gastos_${chileDate()}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function SpendingInsights({ expenses = [], setView }) {
  const today = chileDate()
  const [dateFrom, setDateFrom] = useState(() => firstDayMonthsAgo(5))
  const [dateTo, setDateTo] = useState(() => chileDate())
  const [source, setSource] = useState('all')
  const [category, setCategory] = useState('all')
  const [merchant, setMerchant] = useState('all')

  const confirmed = useMemo(() => (expenses || [])
    .filter(row => Number(row.amount || 0) > 0)
    .filter(row => row.status !== 'revisar')
    .filter(row => dateOnly(row.date)), [expenses])

  const sourceOptions = useMemo(() => [...new Set(confirmed.map(sourceLabel))].sort(), [confirmed])
  const categoryOptions = useMemo(() => {
    const map = new Map()
    confirmed.forEach(row => {
      const meta = rowCategory(row)
      map.set(meta.id, meta)
    })
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'es'))
  }, [confirmed])
  const merchantOptions = useMemo(() => [...new Set(confirmed.map(row => String(row.description || 'Sin comercio').trim()))].sort((a, b) => a.localeCompare(b, 'es')), [confirmed])

  const filtered = useMemo(() => confirmed.filter(row => {
    const day = dateOnly(row.date)
    if (dateFrom && day < dateFrom) return false
    if (dateTo && day > dateTo) return false
    if (source !== 'all' && sourceLabel(row) !== source) return false
    if (category !== 'all' && rowCategory(row).id !== category) return false
    if (merchant !== 'all' && String(row.description || 'Sin comercio').trim() !== merchant) return false
    return true
  }), [confirmed, dateFrom, dateTo, source, category, merchant])

  const total = filtered.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const ticket = filtered.length ? Math.round(total / filtered.length) : 0
  const biggest = [...filtered].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0]

  const categoryRows = useMemo(() => summarize(filtered, row => rowCategory(row).id)
    .map(row => ({ ...row, meta: categoryMeta(row.key) })), [filtered])

  const sourceRows = useMemo(() => summarize(filtered, sourceLabel)
    .map(row => ({ ...row, meta: SOURCE_META[row.key] || SOURCE_META.Otros })), [filtered])

  const merchantRows = useMemo(() => summarize(filtered, row => String(row.description || 'Sin comercio').trim()).slice(0, 12), [filtered])

  const months = useMemo(() => {
    const firstKnown = confirmed.map(row => dateOnly(row.date)).filter(Boolean).sort()[0] || today
    return monthsBetween(dateFrom || firstKnown, dateTo || today).map(key => {
      const rows = filtered.filter(row => monthKey(row.date) === key)
      return {
        key,
        amount: rows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
        count: rows.length,
      }
    })
  }, [filtered, dateFrom, dateTo, confirmed, today])

  const monthRanking = useMemo(() => [...months].filter(row => row.amount > 0).sort((a, b) => b.amount - a.amount), [months])
  const topMonth = monthRanking[0]
  const maxMonth = Math.max(...months.map(row => row.amount), 1)
  const maxCategory = categoryRows[0]?.amount || 1
  const maxSource = sourceRows[0]?.amount || 1
  const maxMerchant = merchantRows[0]?.amount || 1
  const activeFilters = [source !== 'all', category !== 'all', merchant !== 'all'].filter(Boolean).length

  const applyRange = range => {
    if (range === 'month') setDateFrom(today.slice(0, 7) + '-01')
    if (range === '3m') setDateFrom(firstDayMonthsAgo(2))
    if (range === '6m') setDateFrom(firstDayMonthsAgo(5))
    if (range === 'year') setDateFrom(today.slice(0, 4) + '-01-01')
    if (range === 'all') {
      const first = [...confirmed].map(row => dateOnly(row.date)).filter(Boolean).sort()[0]
      setDateFrom(first || today)
    }
    setDateTo(today)
  }

  const clearFilters = () => {
    setDateFrom(firstDayMonthsAgo(5))
    setDateTo(today)
    setSource('all')
    setCategory('all')
    setMerchant('all')
  }

  return <div className="max-w-7xl mx-auto space-y-4 pb-20">
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div>
        <div className="text-[9.5px] uppercase tracking-[.13em] text-[var(--muted)] font-bold">Flujo · Inteligencia de gasto</div>
        <h2 className="text-[21px] md:text-[25px] font-bold mt-1">Reporte de gastos</h2>
        <p className="text-[10px] text-[var(--muted)] mt-1 max-w-2xl">Vista interactiva sobre consumo conciliado de Mercado Pago y tarjetas. Todos los gráficos comparten los mismos filtros.</p>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => downloadCSV(filtered)} disabled={!filtered.length} className="h-9 rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] px-3 text-[10px] font-semibold disabled:opacity-40">Exportar CSV</button>
        <button type="button" onClick={() => setView?.('expenses')} className="h-9 rounded-xl bg-[var(--ink)] text-[var(--bg)] px-3 text-[10px] font-semibold">Ver movimientos</button>
      </div>
    </div>

    <Card padding="p-3.5">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="text-[9px] uppercase tracking-[.12em] text-[var(--muted)] font-bold mr-1">Periodo</div>
        {[['month','Mes'],['3m','3 meses'],['6m','6 meses'],['year','Año'],['all','Todo']].map(([value, label]) => (
          <button key={value} type="button" onClick={() => applyRange(value)} className="h-7 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 text-[9px] font-semibold hover:bg-[var(--hover)]">{label}</button>
        ))}
        {activeFilters > 0 && <button type="button" onClick={clearFilters} className="h-7 rounded-lg bg-[var(--amber-soft)] text-[var(--amber-ink)] px-2.5 text-[9px] font-semibold">Limpiar · {activeFilters}</button>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
        <label className="text-[8.5px] text-[var(--muted)]">Desde
          <input type="date" value={dateFrom} max={dateTo || today} onChange={e => setDateFrom(e.target.value)} className="mt-1 w-full h-9 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-2 text-[10px] text-[var(--ink)]"/>
        </label>
        <label className="text-[8.5px] text-[var(--muted)]">Hasta
          <input type="date" value={dateTo} min={dateFrom} max={today} onChange={e => setDateTo(e.target.value)} className="mt-1 w-full h-9 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-2 text-[10px] text-[var(--ink)]"/>
        </label>
        <label className="text-[8.5px] text-[var(--muted)]">Fuente
          <select value={source} onChange={e => setSource(e.target.value)} className="mt-1 w-full h-9 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-2 text-[10px]">
            <option value="all">Todas</option>
            {sourceOptions.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="text-[8.5px] text-[var(--muted)]">Categoría
          <select value={category} onChange={e => setCategory(e.target.value)} className="mt-1 w-full h-9 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-2 text-[10px]">
            <option value="all">Todas</option>
            {categoryOptions.map(value => <option key={value.id} value={value.id}>{value.icon} {value.label}</option>)}
          </select>
        </label>
        <label className="text-[8.5px] text-[var(--muted)] col-span-2 lg:col-span-1">Comercio
          <select value={merchant} onChange={e => setMerchant(e.target.value)} className="mt-1 w-full h-9 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-2 text-[10px]">
            <option value="all">Todos</option>
            {merchantOptions.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>
    </Card>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Metric label="Gasto filtrado" value={fmtCLP(total)} detail={`${filtered.length} movimientos conciliados`} tone="dark"/>
      <Metric label="Ticket promedio" value={fmtCLP(ticket)} detail="Promedio por compra"/>
      <Metric label="Mayor compra" value={fmtCLP(biggest?.amount || 0)} detail={biggest?.description || 'Sin movimientos'}/>
      <Metric label="Mes con más gasto" value={topMonth ? fmtCLP(topMonth.amount) : '$0'} detail={topMonth ? monthLabel(topMonth.key, true) : 'Sin movimientos'}/>
    </div>

    <div className="grid lg:grid-cols-[1.1fr_.9fr] gap-3">
      <Card padding="p-4">
        <div className="text-[9px] uppercase tracking-[.12em] text-[var(--muted)] font-bold">Tendencia mensual</div>
        <div className="text-[12px] font-semibold mt-1">Evolución del gasto</div>
        <div className="mt-5 h-52 flex items-end gap-2 overflow-x-auto pb-1">
          {months.map(row => {
            const height = row.amount > 0 ? Math.max(5, Math.round(row.amount * 100 / maxMonth)) : 2
            return <div key={row.key} className="min-w-[44px] flex-1 h-full flex flex-col items-center justify-end gap-2">
              <div className="text-[7.5px] font-mono text-[var(--muted)] whitespace-nowrap">{row.amount ? `$${Math.round(row.amount / 1000)}k` : '—'}</div>
              <div className="w-full max-w-12 rounded-t-lg bg-[var(--ink)] transition-all" style={{ height: `${height}%` }}/>
              <div className="text-[8px] text-[var(--muted)] capitalize">{monthLabel(row.key)}</div>
            </div>
          })}
        </div>
      </Card>

      <Card padding="p-4">
        <div className="text-[9px] uppercase tracking-[.12em] text-[var(--muted)] font-bold">Composición</div>
        <div className="text-[12px] font-semibold mt-1">Participación por categoría</div>
        <Donut rows={categoryRows} total={total} selected={category} onSelect={setCategory}/>
      </Card>
    </div>

    <div className="grid lg:grid-cols-3 gap-3">
      <Card padding="p-4">
        <div className="text-[9px] uppercase tracking-[.12em] text-[var(--muted)] font-bold">Categorías</div>
        <div className="text-[12px] font-semibold mt-1">Dónde se va el dinero</div>
        <div className="mt-4 space-y-3">
          {categoryRows.slice(0, 10).map(row => <HorizontalBar
            key={row.key}
            label={`${row.meta.icon} ${row.meta.label}`}
            amount={row.amount}
            max={maxCategory}
            color={row.meta.color}
            active={category === row.key}
            onClick={() => setCategory(category === row.key ? 'all' : row.key)}
            detail={total ? `${Math.round(row.amount * 100 / total)}% · ${row.count} movimientos` : ''}
          />)}
          {!categoryRows.length && <div className="text-[10px] text-[var(--muted)]">Sin datos para este filtro.</div>}
        </div>
      </Card>

      <Card padding="p-4">
        <div className="text-[9px] uppercase tracking-[.12em] text-[var(--muted)] font-bold">Fuentes</div>
        <div className="text-[12px] font-semibold mt-1">Cómo estás pagando</div>
        <div className="mt-4 space-y-3">
          {sourceRows.map(row => <HorizontalBar
            key={row.key}
            label={row.key}
            amount={row.amount}
            max={maxSource}
            color={row.meta.color}
            active={source === row.key}
            onClick={() => setSource(source === row.key ? 'all' : row.key)}
            detail={total ? `${Math.round(row.amount * 100 / total)}% · ${row.count} movimientos` : ''}
          />)}
        </div>
      </Card>

      <Card padding="p-4">
        <div className="text-[9px] uppercase tracking-[.12em] text-[var(--muted)] font-bold">Comercios</div>
        <div className="text-[12px] font-semibold mt-1">Top por monto gastado</div>
        <div className="mt-4 space-y-3">
          {merchantRows.slice(0, 10).map(row => <HorizontalBar
            key={row.key}
            label={row.key}
            amount={row.amount}
            max={maxMerchant}
            active={merchant === row.key}
            onClick={() => setMerchant(merchant === row.key ? 'all' : row.key)}
            detail={`${row.count} ${row.count === 1 ? 'compra' : 'compras'}`}
          />)}
        </div>
      </Card>
    </div>

    <div className="grid lg:grid-cols-[.8fr_1.2fr] gap-3">
      <Card padding="p-4">
        <div className="text-[9px] uppercase tracking-[.12em] text-[var(--muted)] font-bold">Ranking mensual</div>
        <div className="text-[12px] font-semibold mt-1">Meses con más gasto</div>
        <div className="mt-4 space-y-2.5">
          {monthRanking.slice(0, 8).map((row, index) => (
            <div key={row.key} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-lg bg-[var(--hover)] grid place-items-center text-[9px] font-mono font-bold">{index + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-medium">{monthLabel(row.key, true)}</div>
                <div className="text-[8.5px] text-[var(--muted)]">{row.count} movimientos</div>
              </div>
              <div className="font-mono text-[10px] font-semibold">{fmtCLP(row.amount)}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card padding="p-0" className="overflow-hidden">
        <div className="p-4 border-b border-[var(--line)]">
          <div className="text-[9px] uppercase tracking-[.12em] text-[var(--muted)] font-bold">Detalle</div>
          <div className="text-[12px] font-semibold mt-1">Movimientos del filtro actual</div>
        </div>
        <div className="max-h-[390px] overflow-y-auto divide-y divide-[var(--line)]">
          {[...filtered].sort((a,b) => dateOnly(b.date).localeCompare(dateOnly(a.date))).slice(0, 50).map(row => {
            const meta = rowCategory(row)
            return <div key={row.id} className="px-4 py-3 grid grid-cols-[1fr_auto] gap-3">
              <div className="min-w-0">
                <div className="text-[10.5px] font-semibold truncate">{row.description}</div>
                <div className="text-[8.5px] text-[var(--muted)] mt-1">{dateOnly(row.date)} · {meta.icon} {meta.label} · {sourceLabel(row)}</div>
              </div>
              <div className="font-mono text-[10.5px] font-bold">{fmtCLP(row.amount)}</div>
            </div>
          })}
          {!filtered.length && <div className="p-8 text-center text-[10px] text-[var(--muted)]">No hay movimientos con estos filtros.</div>}
        </div>
      </Card>
    </div>

    <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] px-4 py-3 text-[9px] text-[var(--muted)]">
      El reporte usa la capa conciliada de Gastito: una compra aparece una sola vez aunque exista en Facturación y en un registro manual vinculado. Transferencias entre cuentas y pagos de tarjetas no se consideran consumo.
    </div>
  </div>
}
