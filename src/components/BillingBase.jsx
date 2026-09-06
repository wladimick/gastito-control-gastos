import React, { useEffect, useMemo, useState } from 'react'
import { InfoTip } from './ui'
import { financialHelpFor } from '../lib/financialHelp'
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
  installment: 'Compra en cuotas',
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

const FALLBACK_CATEGORY = {
  id: null,
  label: 'Otros',
  icon: '•',
  color: '#888880',
}

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
  const label = new Intl.DateTimeFormat('es-CL', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function translucent(color, opacity = '18') {
  return /^#[0-9a-f]{6}$/i.test(String(color || ''))
    ? `${color}${opacity}`
    : `#888880${opacity}`
}

function categoryFor(item) {
  return item.category || FALLBACK_CATEGORY
}

function isExpense(item) {
  return item.affectsCycleTotal
    && item.amount > 0
    && !['payment', 'credit'].includes(item.movementType)
}

function matchesFilter(item, filter) {
  if (filter === 'all') return true
  if (filter === 'review') return item.reviewStatus === 'review_required' || item.isPending
  if (filter === 'charges') return ['commission', 'tax', 'interest', 'other'].includes(item.movementType)
  if (filter === 'payments') return ['payment', 'credit'].includes(item.movementType)
  return item.movementType === filter
}

function groupByCategory(transactions) {
  const grouped = new Map()

  transactions.filter(isExpense).forEach(item => {
    const category = categoryFor(item)
    const key = category.id || category.label
    const current = grouped.get(key) || {
      ...category,
      amount: 0,
      sharedAmount: 0,
      count: 0,
    }

    current.amount += Number(item.amount || 0)
    current.count += 1
    if (item.sharedWithNicol) current.sharedAmount += Number(item.amount || 0)
    grouped.set(key, current)
  })

  return [...grouped.values()].sort((a, b) => b.amount - a.amount)
}

function downloadCSV(cycles, cards) {
  const cardMap = new Map(cards.map(card => [card.id, card]))
  const rows = [[
    'ciclo', 'tarjeta', 'periodo_inicio', 'periodo_fin', 'vencimiento',
    'estado_ciclo', 'conciliacion', 'fecha', 'descripcion', 'categoria',
    'tipo', 'monto', 'monto_original', 'cuota_actual', 'cuotas_totales',
    'afecta_total', 'revision', 'compartido_nicol', 'origen',
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
        categoryFor(item).label,
        TYPE_LABELS[item.movementType] || item.movementType,
        item.amount,
        item.originalAmount,
        item.installmentCurrent,
        item.installmentTotal,
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

function SummaryCard({ label, value, detail, tone = 'default', badge = '', info }) {
  const help = info || financialHelpFor(label)
  const toneClass = tone === 'dark'
    ? 'bg-[var(--ink)] text-[var(--bg)] border-transparent'
    : tone === 'warning'
      ? 'bg-[var(--amber-soft)] text-[var(--amber-ink)] border-transparent'
      : tone === 'violet'
        ? 'bg-violet-50 text-violet-950 border-violet-100'
        : 'bg-[var(--bg-elev)] text-[var(--ink)] border-[var(--line)]'

  return (
    <div className={`rounded-2xl border p-4 min-h-[112px] ${toneClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5"><div className="text-[10px] uppercase tracking-[0.12em] font-bold opacity-60">{label}</div>{help && <InfoTip content={help}/>}</div>
        {badge && (
          <span className="rounded-full border border-current/15 px-2 py-0.5 text-[9px] font-semibold opacity-70">
            {badge}
          </span>
        )}
      </div>
      <div className="font-mono text-[22px] font-bold mt-2">{value}</div>
      {detail && <div className="text-[11px] mt-1 opacity-70 leading-relaxed">{detail}</div>}
    </div>
  )
}

function CategorySummary({ transactions }) {
  const categories = useMemo(() => groupByCategory(transactions), [transactions])
  const total = categories.reduce((sum, item) => sum + item.amount, 0)

  if (!categories.length) return null

  return (
    <section className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] overflow-hidden">
      <div className="px-4 py-3.5 border-b border-[var(--line)] flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] font-bold">¿En qué se fue el dinero?</div>
          <h2 className="text-[15px] font-bold mt-1">Resumen por categoría</h2>
        </div>
        <div className="font-mono text-[13px] font-bold">{fmtCLP(total)}</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
        {categories.map(category => {
          const percentage = total > 0 ? Math.round(category.amount * 100 / total) : 0
          return (
            <div
              key={category.id || category.label}
              className="rounded-xl border p-3"
              style={{
                borderColor: translucent(category.color, '55'),
                backgroundColor: translucent(category.color, '12'),
              }}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl grid place-items-center text-[17px] shrink-0 border"
                  style={{
                    borderColor: translucent(category.color, '55'),
                    backgroundColor: translucent(category.color, '22'),
                  }}
                  aria-hidden="true"
                >
                  {category.icon || '•'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[12px] font-semibold truncate">{category.label}</div>
                    <div className="text-[10px] text-[var(--muted)]">{percentage}%</div>
                  </div>
                  <div className="font-mono text-[14px] font-bold mt-0.5">{fmtCLP(category.amount)}</div>
                  <div className="text-[9.5px] text-[var(--muted)] mt-1">
                    {category.count} {category.count === 1 ? 'movimiento' : 'movimientos'}
                    {category.sharedAmount > 0 && <> · Nicol {fmtCLP(category.sharedAmount)}</>}
                  </div>
                  <div className="h-1.5 rounded-full bg-black/5 mt-2 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(3, percentage)}%`,
                        backgroundColor: category.color || '#888880',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function InstallmentBadges({ item }) {
  const current = Number(item.installmentCurrent || 0)
  const total = Number(item.installmentTotal || 0)
  if (item.movementType !== 'installment' || current < 1 || total < 2) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-900 px-2.5 py-1 text-[10px] font-bold">
        Este ciclo paga
      </span>
      <span className="inline-flex items-center rounded-full bg-[var(--ink)] text-[var(--bg)] px-2.5 py-1 text-[10.5px] font-bold font-mono">
        Cuota {current}/{total}
      </span>
      {current === total && (
        <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-1 text-[10px] font-bold">
          Última cuota
        </span>
      )}
    </div>
  )
}

function TransactionRow({ item }) {
  const category = categoryFor(item)
  const isCredit = ['payment', 'credit'].includes(item.movementType) || item.amount < 0
  const isInstallment = item.movementType === 'installment'
    && Number(item.installmentCurrent || 0) > 0
    && Number(item.installmentTotal || 0) > 1
  const originalAmount = Number(item.originalAmount || 0)
  const amount = Number(item.amount || 0)

  return (
    <article className="px-4 py-4 border-t border-[var(--line)] first:border-t-0 hover:bg-[var(--hover)] transition-colors">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl grid place-items-center text-[18px] shrink-0 border"
          style={{
            borderColor: translucent(category.color, '55'),
            backgroundColor: translucent(category.color, '20'),
          }}
          aria-hidden="true"
        >
          {category.icon || '•'}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold leading-snug break-words">{item.description}</div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-semibold border"
                  style={{
                    borderColor: translucent(category.color, '55'),
                    backgroundColor: translucent(category.color, '18'),
                  }}
                >
                  {category.icon || '•'} {category.label}
                </span>
                {item.isPending && (
                  <span className="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-[9.5px] font-semibold">Pendiente</span>
                )}
                {item.reviewStatus === 'review_required' && (
                  <span className="rounded-full bg-[var(--amber-soft)] text-[var(--amber-ink)] px-2 py-0.5 text-[9.5px] font-semibold">Revisar</span>
                )}
                {!item.affectsCycleTotal && (
                  <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[9.5px] font-semibold">Fuera del total</span>
                )}
                {item.sharedWithNicol && (
                  <span className="rounded-full bg-violet-50 text-violet-700 px-2 py-0.5 text-[9.5px] font-semibold">Compartido con Nicol</span>
                )}
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className={`font-mono text-[14px] font-bold whitespace-nowrap ${isCredit ? 'text-emerald-700' : ''}`}>
                {isCredit && amount > 0 ? '−' : amount < 0 ? '−' : ''}{fmtCLP(Math.abs(amount))}
              </div>
              <div className="text-[9.5px] text-[var(--muted)] mt-1">
                {isInstallment ? 'valor de esta cuota' : TYPE_LABELS[item.movementType] || 'movimiento'}
              </div>
            </div>
          </div>

          <InstallmentBadges item={item} />

          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10.5px] text-[var(--muted)] mt-2">
            <span>{item.date ? formatDate(item.date) : item.isPending ? 'Fecha pendiente' : 'Sin fecha'}</span>
            <span>· {TYPE_LABELS[item.movementType] || 'Movimiento'}</span>
            {isInstallment && originalAmount > Math.abs(amount) && (
              <span>· Compra total {fmtCLP(originalAmount)}</span>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

function CycleCategoryStrip({ cycle }) {
  const categories = useMemo(() => groupByCategory(cycle.transactions), [cycle.transactions])
  if (!categories.length) return null

  return (
    <div className="px-4 pt-4">
      <div className="text-[9.5px] uppercase tracking-[0.1em] text-[var(--muted)] font-bold mb-2">Distribución de esta tarjeta</div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {categories.map(category => (
          <div
            key={category.id || category.label}
            className="shrink-0 rounded-xl border px-3 py-2 min-w-[132px]"
            style={{
              borderColor: translucent(category.color, '55'),
              backgroundColor: translucent(category.color, '12'),
            }}
          >
            <div className="text-[10px] font-semibold truncate">{category.icon || '•'} {category.label}</div>
            <div className="font-mono text-[12px] font-bold mt-1">{fmtCLP(category.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function CycleCard({ cycle, card, expanded, onToggle, filter, search }) {
  const status = STATUS[cycle.status] || STATUS.closed
  const reconciliation = RECONCILIATION[cycle.reconciliationStatus] || RECONCILIATION.unreconciled
  const cardName = card?.name || card?.nickname || card?.alias || 'Tarjeta'
  const bankName = card?.bankName || card?.bank_name || card?.bank || ''
  const lastFour = card?.lastFour || card?.last_four || ''
  const normalizedSearch = search.trim().toLocaleLowerCase('es')

  const visibleTransactions = cycle.transactions.filter(item => {
    if (!matchesFilter(item, filter)) return false
    if (!normalizedSearch) return true
    const category = categoryFor(item)
    return `${item.description} ${category.label} ${TYPE_LABELS[item.movementType] || ''}`
      .toLocaleLowerCase('es')
      .includes(normalizedSearch)
  })

  const hasDifference = Math.abs(cycle.difference) >= 1
  const estimatedDiffers = cycle.estimatedAmount > 0 && cycle.estimatedAmount !== cycle.reportedAmount
  const baseAmount = Math.max(
    Math.abs(cycle.reportedAmount),
    Math.abs(cycle.estimatedAmount),
    Math.abs(cycle.calculatedAmount),
    1,
  )
  const detailProgress = Math.min(100, Math.max(0, Math.round(Math.abs(cycle.calculatedAmount) * 100 / baseAmount)))

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] overflow-hidden shadow-sm">
      <button type="button" onClick={onToggle} className="w-full text-left p-4 hover:bg-[var(--hover)] transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-[var(--ink)] text-[var(--bg)] grid place-items-center shrink-0">
              <Icon name="card" size={18}/>
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-[15px] truncate">
                {cardName}{lastFour ? ` •••• ${lastFour}` : ''}
              </div>
              <div className="text-[10.5px] text-[var(--muted)] mt-0.5">
                {bankName ? `${bankName} · ` : ''}{formatDate(cycle.periodStart, true)} – {formatDate(cycle.periodEnd, true)}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${status.className}`}>{status.label}</span>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${reconciliation.className}`}>{reconciliation.label}</span>
                {cycle.pendingCount > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                    {cycle.pendingCount} pendientes
                  </span>
                )}
                {cycle.reviewCount > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-[var(--amber-soft)] text-[var(--amber-ink)]">
                    {cycle.reviewCount} por revisar
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-[9.5px] uppercase tracking-[0.08em] text-[var(--muted)]">Informado</div>
            <div className="font-mono text-[18px] font-bold mt-0.5">{fmtCLP(cycle.reportedAmount)}</div>
            {estimatedDiffers && (
              <div className="text-[10px] text-blue-700 font-semibold mt-1">
                Estimado {fmtCLP(cycle.estimatedAmount)}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 text-[9.5px] text-[var(--muted)]">
            <span>Detalle conocido</span>
            <span>{detailProgress}% del monto de referencia</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--soft)] mt-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full ${hasDifference ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${detailProgress}%` }}
            />
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
          <div className="rounded-xl bg-violet-50 px-3 py-2">
            <div className="text-[9px] uppercase tracking-wide text-violet-600">Compartido</div>
            <div className="font-mono text-[12px] font-semibold text-violet-950 mt-0.5">{fmtCLP(cycle.sharedAmount)}</div>
            <div className="text-[9px] text-violet-600 mt-0.5">{cycle.sharedCount} con Nicol</div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-3 text-[10px] text-[var(--muted)]">
          <span>{expanded ? 'Ocultar movimientos' : 'Ver movimientos'}</span>
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={15}/>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[var(--line)]">
          {cycle.notes && (
            <div className="mx-4 mt-4 rounded-xl bg-[var(--soft)] px-3 py-2 text-[11px] text-[var(--muted)] leading-relaxed">
              {cycle.notes}
            </div>
          )}

          <CycleCategoryStrip cycle={cycle}/>

          <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)] font-bold">Movimientos</div>
              <div className="text-[11px] text-[var(--muted)] mt-0.5">
                {visibleTransactions.length} de {cycle.transactions.length} visibles
              </div>
            </div>
          </div>

          {visibleTransactions.length > 0 ? (
            <div>
              {visibleTransactions.map(item => <TransactionRow key={item.id} item={item}/>)}
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

  const cycleKeys = useMemo(
    () => [...new Set(cycles.map(item => item.cycleKey))].sort((a, b) => b.localeCompare(a)),
    [cycles],
  )
  const selectedCycles = useMemo(
    () => cycles.filter(item => item.cycleKey === selectedKey),
    [cycles, selectedKey],
  )
  const selectedTransactions = useMemo(
    () => selectedCycles.flatMap(item => item.transactions),
    [selectedCycles],
  )
  const cardMap = useMemo(
    () => new Map(creditCards.map(card => [card.id, card])),
    [creditCards],
  )

  const totals = useMemo(() => {
    const reported = selectedCycles.reduce((sum, item) => sum + item.reportedAmount, 0)
    const estimated = selectedCycles.reduce(
      (sum, item) => sum + (item.estimatedAmount > 0 ? item.estimatedAmount : item.reportedAmount),
      0,
    )
    const calculated = selectedCycles.reduce((sum, item) => sum + item.calculatedAmount, 0)
    const movements = selectedCycles.reduce((sum, item) => sum + item.transactions.length, 0)
    const review = selectedCycles.reduce((sum, item) => sum + item.reviewCount, 0)
    const pending = selectedCycles.reduce((sum, item) => sum + item.pendingCount, 0)
    const shared = selectedCycles.reduce((sum, item) => sum + item.sharedAmount, 0)
    return {
      reported,
      estimated,
      calculated,
      difference: reported - calculated,
      movements,
      review,
      pending,
      shared,
    }
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
          {[0, 1, 2, 3].map(item => <div key={item} className="h-28 rounded-2xl bg-[var(--soft)] animate-pulse"/>)}
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
          <p className="text-[12px] text-[var(--muted)] mt-1 max-w-xl">
            Revisa cuánto debes pagar, en qué categorías estás gastando y qué parte del ciclo está compartida con Nicol.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.location.assign(`${window.location.pathname}?nicol-admin=1`)}
            className="h-9 px-3 rounded-lg border border-[var(--line)] text-[11px] font-semibold hover:bg-[var(--hover)]"
          >
            Gastos de Nicol
          </button>
          <button
            type="button"
            disabled={!selectedCycles.length}
            onClick={() => downloadCSV(selectedCycles, creditCards)}
            className="h-9 px-3 rounded-lg border border-[var(--line)] text-[11px] font-semibold hover:bg-[var(--hover)] disabled:opacity-40"
          >
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={load}
            className="h-9 px-3 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-[11px] font-semibold flex items-center gap-1.5"
          >
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
        <section className="mt-5">
          <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] font-bold mb-2">Selecciona el ciclo</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {cycleKeys.map(key => {
              const cycleCount = cycles.filter(item => item.cycleKey === key).length
              const selected = selectedKey === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  className={`snap-start shrink-0 min-w-[150px] rounded-2xl border px-3.5 py-3 text-left transition-colors ${selected
                    ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]'
                    : 'bg-[var(--bg-elev)] text-[var(--ink)] border-[var(--line)] hover:bg-[var(--hover)]'}`}
                >
                  <div className="text-[11.5px] font-semibold">{cycleLabel(key)}</div>
                  <div className={`text-[9.5px] mt-1 ${selected ? 'opacity-60' : 'text-[var(--muted)]'}`}>
                    {cycleCount} {cycleCount === 1 ? 'tarjeta' : 'tarjetas'}
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {selectedCycles.length > 0 ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            <SummaryCard
              label="Monto informado"
              value={fmtCLP(totals.reported)}
              detail={totals.estimated !== totals.reported
                ? `Estimación actual de Gastito: ${fmtCLP(totals.estimated)}`
                : `${selectedCycles.length} ${selectedCycles.length === 1 ? 'tarjeta' : 'tarjetas'}`}
              tone="dark"
              badge={cycleLabel(selectedKey)}
            />
            <SummaryCard
              label="Detalle conocido"
              value={fmtCLP(totals.calculated)}
              detail={`${totals.movements} movimientos cargados`}
            />
            <SummaryCard
              label="Compartido con Nicol"
              value={fmtCLP(totals.shared)}
              detail="Monto total antes de aplicar su porcentaje"
              tone="violet"
            />
            <SummaryCard
              label="Atención"
              value={String(totals.review + totals.pending)}
              detail={`${totals.review} por revisar · ${totals.pending} pendientes`}
              tone={totals.review + totals.pending ? 'warning' : 'default'}
            />
          </div>

          <CategorySummary transactions={selectedTransactions}/>

          <div className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-3 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div className="flex gap-1.5 overflow-x-auto">
              {FILTERS.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`shrink-0 h-8 px-3 rounded-lg text-[10.5px] font-semibold ${filter === value
                    ? 'bg-[var(--ink)] text-[var(--bg)]'
                    : 'bg-[var(--soft)] text-[var(--muted)] hover:text-[var(--ink)]'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <label className="relative block lg:w-72">
              <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"/>
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Buscar comercio, categoría o tipo…"
                className="w-full h-9 rounded-lg border border-[var(--line)] bg-[var(--bg)] pl-9 pr-3 text-[11px] outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </label>
          </div>

          <div className="space-y-3 mt-3">
            {selectedCycles.map(cycle => (
              <CycleCard
                key={cycle.id}
                cycle={cycle}
                card={cardMap.get(cycle.cardId)}
                expanded={expanded.has(cycle.id)}
                onToggle={() => toggle(cycle.id)}
                filter={filter}
                search={search}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-10 text-center">
          <div className="w-11 h-11 rounded-full bg-[var(--soft)] grid place-items-center mx-auto">
            <Icon name="card" size={20}/>
          </div>
          <h2 className="text-[15px] font-semibold mt-4">No hay ciclos facturados</h2>
          <p className="text-[12px] text-[var(--muted)] mt-1">Cuando se importen estados de cuenta aparecerán aquí.</p>
        </div>
      )}
    </div>
  )
}
