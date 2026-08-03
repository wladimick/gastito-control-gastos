import React, { useEffect, useMemo, useState } from 'react'
import { Icon, fmtCLP } from '../lib/helpers'
import { fetchBillingCycles } from '../services/billingCyclesService'

const STATUS = {
  in_progress: { label: 'En curso', className: 'bg-blue-50 text-blue-700' },
  closed: { label: 'Cerrado', className: 'bg-amber-50 text-amber-700' },
  paid: { label: 'Pagado', className: 'bg-emerald-50 text-emerald-700' },
  partial: { label: 'Parcial', className: 'bg-amber-50 text-amber-700' },
}

const RECONCILIATION = {
  reconciled: { label: 'Conciliado', className: 'text-emerald-700 bg-emerald-50' },
  partial: { label: 'Detalle parcial', className: 'text-amber-700 bg-amber-50' },
  unreconciled: { label: 'Sin conciliar', className: 'text-slate-600 bg-slate-100' },
}

const TYPE_LABELS = {
  purchase: 'Compra',
  installment: 'Cuota',
  commission: 'Comisión',
  tax: 'Impuesto',
  interest: 'Interés',
  payment: 'Pago',
  credit: 'Abono',
  other: 'Otro cargo',
}

const FILTERS = [
  ['all', 'Todos'],
  ['purchase', 'Compras'],
  ['installment', 'Cuotas'],
  ['charges', 'Cargos'],
  ['payments', 'Pagos y abonos'],
  ['review', 'Revisar'],
]

function formatDate(value, compact = false) {
  if (!value) return '—'
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00Z`)
  return new Intl.DateTimeFormat('es-CL', compact
    ? { day: '2-digit', month: 'short', timeZone: 'UTC' }
    : { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }
  ).format(date)
}

function cycleLabel(key) {
  if (!key) return 'Sin ciclo'
  const [year, month] = key.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, 1))
  return new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function matchesFilter(item, filter) {
  if (filter === 'all') return true
  if (filter === 'review') return item.reviewStatus === 'review_required'
  if (filter === 'charges') return ['commission', 'tax', 'interest', 'other'].includes(item.movementType)
  if (filter === 'payments') return ['payment', 'credit'].includes(item.movementType)
  return item.movementType === filter
}

function downloadCSV(cycles, cards) {
  const cardMap = new Map(cards.map(card => [card.id, card]))
  const rows = [[
    'ciclo', 'tarjeta', 'periodo_inicio', 'periodo_fin', 'vencimiento',
    'estado_ciclo', 'conciliacion', 'fecha', 'descripcion', 'tipo',
    'monto', 'afecta_total', 'revision', 'compartido_nicol', 'origen',
  ]]

  for (const cycle of cycles) {
    const card = cardMap.get(cycle.cardId)
    const cardName = card?.name || card?.nickname || card?.alias || 'Tarjeta'
    for (const item of cycle.transactions) {
      rows.push([
        cycle.cycleKey,
        cardName,
        cycle.periodStart,
        cycle.periodEnd,
        cycle.dueDate,
        cycle.status,
        cycle.reconciliationStatus,
        item.date,
        item.description,
        TYPE_LABELS[item.movementType] || item.movementType,
        item.amount,
        item.affectsCycleTotal ? 'sí' : 'no',
        item.reviewStatus,
        item.sharedWithNicol ? 'sí' : 'no',
        item.sourceFile || item.sourceKind || '',
      ])
    }
  }

  const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`
  const csv = rows.map(row => row.map(quote).join(',')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `gastito_facturacion_${cycles[0]?.cycleKey || 'ciclos'}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function SummaryCard({ label, value, detail, tone = 'default' }) {
  const toneClass = tone === 'dark'
    ? 'bg-[var(--ink)] text-[var(--bg)] border-transparent'
    : tone === 'warning'
      ? 'bg-[var(--amber-soft)] text-[var(--amber-ink)] border-transparent'
      : 'bg-[var(--bg-elev)] text-[var(--ink)] border-[var(--line)]'

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-[0.12em] font-bold opacity-60">{label}</div>
      <div className="font-mono text-[22px] font-bold mt-1">{value}</div>
      {detail && <div className="text-[11px] mt-1 opacity-70">{detail}</div>}
    </div>
  )
}

function TransactionRow({ item }) {
  const installment = item.installmentCurrent != null && item.installmentTotal != null
    ? `${item.installmentCurrent}/${item.installmentTotal}`
    : null
  const isCredit = ['payment', 'credit'].includes(item.movementType) || item.amount < 0

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 border-t border-[var(--line)] first:border-t-0">
      <div className="min-w-0">
        <div className="text-[13px] font-medium leading-snug break-words">{item.description}</div>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10.5px] text-[var(--muted)] mt-1">
          <span>{item.date ? formatDate(item.date, true) : item.isPending ? 'Pendiente' : 'Sin fecha'}</span>
          <span>· {TYPE_LABELS[item.movementType] || 'Movimiento'}</span>
          {installment && <span>· Cuota {installment}</span>}
          {!item.affectsCycleTotal && <span className="font-semibold text-[var(--amber-ink)]">· No afecta total</span>}
          {item.reviewStatus === 'review_required' && (
            <span className="px-1.5 py-0.5 rounded bg-[var(--amber-soft)] text-[var(--amber-ink)] font-semibold">Revisar</span>
          )}
          {item.sharedWithNicol && (
            <span className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 font-semibold">Nicol</span>
          )}
        </div>
      </div>
      <div className={`font-mono text-[13px] font-semibold whitespace-nowrap ${isCredit ? 'text-emerald-700' : ''}`}>
        {isCredit && item.amount > 0 ? '−' : item.amount < 0 ? '−' : ''}{fmtCLP(Math.abs(item.amount))}
      </div>
    </div>
  )
}

function CycleCard({ cycle, card, expanded, onToggle, filter, search }) {
  const status = STATUS[cycle.status] || STATUS.closed
  const reconciliation = RECONCILIATION[cycle.reconciliationStatus] || RECONCILIATION.unreconciled
  const cardName = card?.name || card?.nickname || card?.alias || 'Tarjeta'
  const bankName = card?.bankName || card?.bank_name || card?.bank || ''
  const normalizedSearch = search.trim().toLocaleLowerCase('es')

  const visibleTransactions = cycle.transactions.filter(item => {
    if (!matchesFilter(item, filter)) return false
    if (!normalizedSearch) return true
    return `${item.description} ${TYPE_LABELS[item.movementType] || ''}`.toLocaleLowerCase('es').includes(normalizedSearch)
  })

  const hasDifference = Math.abs(cycle.difference) >= 1

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full text-left p-4 hover:bg-[var(--hover)] transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--soft)] grid place-items-center shrink-0">
              <Icon name="card" size={17}/>
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-[14px] truncate">{cardName}</div>
              <div className="text-[10.5px] text-[var(--muted)] mt-0.5">
                {bankName ? `${bankName} · ` : ''}{formatDate(cycle.periodStart, true)} – {formatDate(cycle.periodEnd, true)}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${status.className}`}>{status.label}</span>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${reconciliation.className}`}>{reconciliation.label}</span>
                {cycle.reviewCount > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-[var(--amber-soft)] text-[var(--amber-ink)]">
                    {cycle.reviewCount} por revisar
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono text-[17px] font-bold">{fmtCLP(cycle.reportedAmount)}</div>
            <div className="text-[10px] text-[var(--muted)] mt-0.5">{cycle.transactions.length} movimientos</div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          <div className="rounded-xl bg-[var(--bg)] px-3 py-2">
            <div className="text-[9px] uppercase tracking-wide text-[var(--muted)]">Detalle leído</div>
            <div className="font-mono text-[12px] font-semibold mt-0.5">{fmtCLP(cycle.calculatedAmount)}</div>
          </div>
          <div className="rounded-xl bg-[var(--bg)] px-3 py-2">
            <div className="text-[9px] uppercase tracking-wide text-[var(--muted)]">Diferencia</div>
            <div className={`font-mono text-[12px] font-semibold mt-0.5 ${hasDifference ? 'text-[var(--amber-ink)]' : 'text-emerald-700'}`}>
              {cycle.difference > 0 ? '+' : ''}{fmtCLP(cycle.difference)}
            </div>
          </div>
          <div className="rounded-xl bg-[var(--bg)] px-3 py-2">
            <div className="text-[9px] uppercase tracking-wide text-[var(--muted)]">Vencimiento</div>
            <div className="text-[11px] font-semibold mt-0.5">{formatDate(cycle.dueDate, true)}</div>
          </div>
          <div className="rounded-xl bg-[var(--bg)] px-3 py-2">
            <div className="text-[9px] uppercase tracking-wide text-[var(--muted)]">Compartidos</div>
            <div className="text-[11px] font-semibold mt-0.5">{cycle.sharedCount} con Nicol</div>
          </div>
        </div>

        <div className="flex justify-center mt-3 text-[var(--muted)]">
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={16}/>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[var(--line)]">
          {cycle.notes && (
            <div className="mx-4 mt-3 rounded-xl bg-[var(--soft)] px-3 py-2 text-[11px] text-[var(--muted)] leading-relaxed">
              {cycle.notes}
            </div>
          )}
          {visibleTransactions.length > 0 ? (
            <div className="mt-1">
              {visibleTransactions.map(item => <TransactionRow key={item.id} item={item}/>) }
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-[12px] text-[var(--muted)]">
              No hay movimientos que coincidan con el filtro.
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default function Billing({ creditCards = [] }) {
  const [cycles, setCycles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedKey, setSelectedKey] = useState('')
  const [expanded, setExpanded] = useState(new Set())
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchBillingCycles()
      setCycles(data)
      setSelectedKey(current => current && data.some(item => item.cycleKey === current)
        ? current
        : data[0]?.cycleKey || '')
      setExpanded(new Set(data.slice(0, 2).map(item => item.id)))
    } catch (loadError) {
      console.error('fetchBillingCycles:', loadError)
      setError(loadError.message || 'No fue posible cargar la facturación.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const cycleKeys = useMemo(() => [...new Set(cycles.map(item => item.cycleKey))].sort((a, b) => b.localeCompare(a)), [cycles])
  const selectedCycles = useMemo(() => cycles.filter(item => item.cycleKey === selectedKey), [cycles, selectedKey])
  const cardMap = useMemo(() => new Map(creditCards.map(card => [card.id, card])), [creditCards])

  const totals = useMemo(() => {
    const reported = selectedCycles.reduce((sum, item) => sum + item.reportedAmount, 0)
    const calculated = selectedCycles.reduce((sum, item) => sum + item.calculatedAmount, 0)
    const movements = selectedCycles.reduce((sum, item) => sum + item.transactions.length, 0)
    const review = selectedCycles.reduce((sum, item) => sum + item.reviewCount, 0)
    return { reported, calculated, difference: reported - calculated, movements, review }
  }, [selectedCycles])

  const toggle = id => setExpanded(current => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  if (loading) {
    return (
      <div className="p-4 lg:p-6 max-w-6xl mx-auto">
        <div className="h-6 w-48 rounded bg-[var(--soft)] animate-pulse"/>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          {[0, 1, 2, 3].map(item => <div key={item} className="h-24 rounded-2xl bg-[var(--soft)] animate-pulse"/>)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto pb-24">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.13em] text-[var(--muted)] font-bold">Tarjetas y estados de cuenta</div>
          <h1 className="text-[22px] font-bold tracking-tight mt-1">Facturación por ciclo</h1>
          <p className="text-[12px] text-[var(--muted)] mt-1">Datos persistidos en Supabase, separados de pagos y abonos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => window.location.assign(`${window.location.pathname}?nicol-admin=1`)}
            className="h-9 px-3 rounded-lg border border-[var(--line)] text-[11px] font-semibold hover:bg-[var(--hover)]">
            Gastos de Nicol
          </button>
          <button type="button" disabled={!selectedCycles.length} onClick={() => downloadCSV(selectedCycles, creditCards)}
            className="h-9 px-3 rounded-lg border border-[var(--line)] text-[11px] font-semibold hover:bg-[var(--hover)] disabled:opacity-40">
            Exportar CSV
          </button>
          <button type="button" onClick={load}
            className="h-9 px-3 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-[11px] font-semibold flex items-center gap-1.5">
            <Icon name="refresh" size={14}/> Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={load} className="font-semibold underline">Reintentar</button>
        </div>
      )}

      {cycleKeys.length > 0 && (
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {cycleKeys.map(key => (
            <button key={key} type="button" onClick={() => setSelectedKey(key)}
              className={`shrink-0 rounded-full px-4 h-9 text-[11px] font-semibold capitalize border transition-colors ${selectedKey === key
                ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]'
                : 'bg-[var(--bg-elev)] text-[var(--muted)] border-[var(--line)] hover:text-[var(--ink)]'}`}>
              {cycleLabel(key)}
            </button>
          ))}
        </div>
      )}

      {selectedCycles.length > 0 ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            <SummaryCard label="Total facturado" value={fmtCLP(totals.reported)} detail={`${selectedCycles.length} tarjetas`} tone="dark"/>
            <SummaryCard label="Detalle leído" value={fmtCLP(totals.calculated)} detail={`${totals.movements} movimientos`}/>
            <SummaryCard label="Diferencia" value={`${totals.difference > 0 ? '+' : ''}${fmtCLP(totals.difference)}`}
              detail={Math.abs(totals.difference) < 1 ? 'Ciclo conciliado' : 'Puede corresponder a detalle parcial'}
              tone={Math.abs(totals.difference) >= 1 ? 'warning' : 'default'}/>
            <SummaryCard label="Requieren revisión" value={String(totals.review)} detail="Movimientos marcados" tone={totals.review ? 'warning' : 'default'}/>
          </div>

          <div className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-3 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div className="flex gap-1.5 overflow-x-auto">
              {FILTERS.map(([value, label]) => (
                <button key={value} type="button" onClick={() => setFilter(value)}
                  className={`shrink-0 h-8 px-3 rounded-lg text-[10.5px] font-semibold ${filter === value
                    ? 'bg-[var(--ink)] text-[var(--bg)]'
                    : 'bg-[var(--soft)] text-[var(--muted)] hover:text-[var(--ink)]'}`}>
                  {label}
                </button>
              ))}
            </div>
            <label className="relative block lg:w-64">
              <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"/>
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar movimiento…"
                className="w-full h-9 rounded-lg border border-[var(--line)] bg-[var(--bg)] pl-9 pr-3 text-[11px] outline-none focus:ring-1 focus:ring-[var(--accent)]"/>
            </label>
          </div>

          <div className="space-y-3 mt-3">
            {selectedCycles.map(cycle => (
              <CycleCard key={cycle.id} cycle={cycle} card={cardMap.get(cycle.cardId)}
                expanded={expanded.has(cycle.id)} onToggle={() => toggle(cycle.id)} filter={filter} search={search}/>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-10 text-center">
          <div className="w-11 h-11 rounded-full bg-[var(--soft)] grid place-items-center mx-auto"><Icon name="card" size={20}/></div>
          <h2 className="text-[15px] font-semibold mt-4">No hay ciclos facturados</h2>
          <p className="text-[12px] text-[var(--muted)] mt-1">Cuando se importen estados de cuenta aparecerán aquí.</p>
        </div>
      )}
    </div>
  )
}
