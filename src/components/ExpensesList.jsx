import React, { useEffect, useMemo, useState } from 'react'
import { Icon, fmtCLP } from '../lib/helpers'
import { CATEGORIES, BANKS } from '../data'
import { fetchBillingCycles } from '../services/billingCyclesService'

const FALLBACK_CATEGORY = {
  id: 'otros',
  label: 'Otros',
  icon: '•',
  color: '#888880',
}

const SOURCE_META = {
  manual: { label: 'Manual', className: 'bg-slate-100 text-slate-700' },
  card: { label: 'Tarjeta', className: 'bg-blue-50 text-blue-700' },
  reconciled: { label: 'Conciliado', className: 'bg-emerald-50 text-emerald-700' },
}

function translucent(color, opacity = '18') {
  return /^#[0-9a-f]{6}$/i.test(String(color || ''))
    ? `${color}${opacity}`
    : `#888880${opacity}`
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function dateOnly(value) {
  if (!value) return ''
  return String(value).slice(0, 10)
}

function monthKey(value) {
  return dateOnly(value).slice(0, 7)
}

function monthLabel(key) {
  if (!key) return 'Sin mes'
  const [year, month] = key.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, 1))
  const label = new Intl.DateTimeFormat('es-CL', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function formatDate(value, compact = false) {
  const dateValue = dateOnly(value)
  if (!dateValue) return 'Sin fecha'
  const date = new Date(`${dateValue}T12:00:00Z`)
  return new Intl.DateTimeFormat('es-CL', compact
    ? { day: '2-digit', month: 'short', timeZone: 'UTC' }
    : { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }
  ).format(date)
}

function duplicateKey(row) {
  const day = dateOnly(row.date)
  if (!day) return ''
  return `${day}|${Number(row.amount || 0)}|${normalizeText(row.description)}`
}

function manualCategory(expense) {
  return CATEGORIES.find(category => category.id === expense.category) || FALLBACK_CATEGORY
}

function bankLabel(bankId) {
  return BANKS.find(bank => bank.id === bankId)?.label || bankId || 'Sin banco'
}

function mapManualExpense(expense) {
  return {
    id: `manual:${expense.id}`,
    rawId: expense.id,
    source: 'manual',
    editable: true,
    date: expense.date,
    effectiveDate: expense.date,
    description: expense.description,
    amount: Number(expense.amount || 0),
    category: manualCategory(expense),
    bankLabel: bankLabel(expense.bank),
    paymentLabel: expense.method === 'efectivo'
      ? 'Efectivo'
      : expense.type === 'credito'
        ? 'Crédito'
        : 'Débito',
    installments: Number(expense.installments || 1),
    installmentCurrent: null,
    installmentTotal: Number(expense.installments || 1),
    originalAmount: null,
    notes: expense.notes || '',
    status: expense.status || 'ok',
    isPending: false,
    reviewRequired: expense.status === 'revisar',
    affectsTotal: true,
    sharedWithNicol: false,
    cycleKey: '',
    dueDate: '',
  }
}

function mapBillingRows(cycles, creditCards) {
  const cardMap = new Map(creditCards.map(card => [card.id, card]))
  const rows = []

  cycles.forEach(cycle => {
    const card = cardMap.get(cycle.cardId)
    const cardName = card?.name || card?.nickname || card?.alias || 'Tarjeta'
    const lastFour = card?.lastFour || card?.last_four || ''
    const cardLabel = lastFour ? `${cardName} •••• ${lastFour}` : cardName

    cycle.transactions
      .filter(item => Number(item.amount || 0) > 0 && !['payment', 'credit'].includes(item.movementType))
      .forEach(item => {
        rows.push({
          id: `billing:${item.id}`,
          rawId: item.id,
          source: 'card',
          editable: false,
          date: item.date,
          effectiveDate: item.date || cycle.periodEnd || cycle.closingDate,
          description: item.description,
          amount: Number(item.amount || 0),
          category: item.category || FALLBACK_CATEGORY,
          bankLabel: cardLabel,
          paymentLabel: item.movementType === 'installment' ? 'Compra en cuotas' : 'Compra con tarjeta',
          installments: Number(item.installmentTotal || 1),
          installmentCurrent: item.installmentCurrent,
          installmentTotal: item.installmentTotal,
          originalAmount: item.originalAmount,
          notes: cycle.notes || '',
          status: item.reviewStatus === 'review_required' ? 'revisar' : 'ok',
          isPending: Boolean(item.isPending),
          reviewRequired: item.reviewStatus === 'review_required',
          affectsTotal: Boolean(item.affectsCycleTotal),
          sharedWithNicol: Boolean(item.sharedWithNicol),
          cycleKey: cycle.cycleKey,
          dueDate: cycle.dueDate,
        })
      })
  })

  return rows
}

function mergeRows(expenses, cycles, creditCards) {
  const billingRows = mapBillingRows(cycles, creditCards)
  const byKey = new Map()

  billingRows.forEach(row => {
    const key = duplicateKey(row)
    if (!key) return
    const list = byKey.get(key) || []
    list.push(row)
    byKey.set(key, list)
  })

  const consumed = new Set()
  let duplicatesUnified = 0

  const manualRows = expenses.map(mapManualExpense).map(row => {
    const key = duplicateKey(row)
    const match = key ? (byKey.get(key) || []).find(item => !consumed.has(item.id)) : null
    if (!match) return row

    consumed.add(match.id)
    duplicatesUnified += 1
    return {
      ...row,
      source: 'reconciled',
      bankLabel: match.bankLabel,
      paymentLabel: match.paymentLabel,
      installmentCurrent: match.installmentCurrent,
      installmentTotal: match.installmentTotal,
      originalAmount: match.originalAmount,
      isPending: match.isPending,
      reviewRequired: row.reviewRequired || match.reviewRequired,
      affectsTotal: match.affectsTotal,
      sharedWithNicol: match.sharedWithNicol,
      cycleKey: match.cycleKey,
      dueDate: match.dueDate,
      category: match.category?.id ? match.category : row.category,
    }
  })

  const remainingBilling = billingRows.filter(row => !consumed.has(row.id))
  const rows = [...manualRows, ...remainingBilling]
    .sort((a, b) => String(b.effectiveDate || '').localeCompare(String(a.effectiveDate || '')) || b.amount - a.amount)

  return { rows, duplicatesUnified }
}

function groupByCategory(rows) {
  const grouped = new Map()
  rows.filter(row => row.affectsTotal && !row.isPending).forEach(row => {
    const category = row.category || FALLBACK_CATEGORY
    const key = category.id || category.label
    const current = grouped.get(key) || { ...category, amount: 0, count: 0, shared: 0 }
    current.amount += row.amount
    current.count += 1
    if (row.sharedWithNicol) current.shared += row.amount
    grouped.set(key, current)
  })
  return [...grouped.values()].sort((a, b) => b.amount - a.amount)
}

function SummaryCard({ label, value, detail, tone = 'default' }) {
  const className = tone === 'dark'
    ? 'bg-[var(--ink)] text-[var(--bg)] border-transparent'
    : tone === 'violet'
      ? 'bg-violet-50 text-violet-950 border-violet-100'
      : tone === 'warning'
        ? 'bg-[var(--amber-soft)] text-[var(--amber-ink)] border-transparent'
        : 'bg-[var(--bg-elev)] text-[var(--ink)] border-[var(--line)]'

  return (
    <div className={`rounded-2xl border p-4 min-h-[105px] ${className}`}>
      <div className="text-[10px] uppercase tracking-[0.12em] font-bold opacity-60">{label}</div>
      <div className="font-mono text-[21px] font-bold mt-2">{value}</div>
      <div className="text-[10.5px] mt-1 opacity-70 leading-relaxed">{detail}</div>
    </div>
  )
}

function CategorySummary({ rows }) {
  const categories = useMemo(() => groupByCategory(rows), [rows])
  const total = categories.reduce((sum, category) => sum + category.amount, 0)
  if (!categories.length) return null

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] overflow-hidden">
      <div className="px-4 py-3.5 border-b border-[var(--line)] flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] font-bold">Distribución del mes</div>
          <h2 className="text-[15px] font-bold mt-1">¿En qué se fue el dinero?</h2>
        </div>
        <div className="font-mono text-[13px] font-bold">{fmtCLP(total)}</div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
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
                    {category.shared > 0 && <> · Nicol {fmtCLP(category.shared)}</>}
                  </div>
                  <div className="h-1.5 rounded-full bg-black/5 mt-2 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.max(3, percentage)}%`, backgroundColor: category.color || '#888880' }}
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

function StatusBadges({ row }) {
  const source = SOURCE_META[row.source] || SOURCE_META.manual
  const current = Number(row.installmentCurrent || 0)
  const total = Number(row.installmentTotal || 0)

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      <span className={`rounded-full px-2 py-1 text-[9.5px] font-bold ${source.className}`}>{source.label}</span>
      <span
        className="rounded-full px-2 py-1 text-[9.5px] font-bold border"
        style={{
          borderColor: translucent(row.category?.color, '55'),
          backgroundColor: translucent(row.category?.color, '18'),
          color: row.category?.color || '#666',
        }}
      >
        {row.category?.icon || '•'} {row.category?.label || 'Otros'}
      </span>
      {row.isPending && <span className="rounded-full bg-amber-100 text-amber-900 px-2 py-1 text-[9.5px] font-bold">Pendiente</span>}
      {row.reviewRequired && <span className="rounded-full bg-[var(--amber-soft)] text-[var(--amber-ink)] px-2 py-1 text-[9.5px] font-bold">Revisar</span>}
      {!row.affectsTotal && <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-1 text-[9.5px] font-bold">Fuera del total</span>}
      {row.sharedWithNicol && <span className="rounded-full bg-violet-50 text-violet-700 px-2 py-1 text-[9.5px] font-bold">Compartido con Nicol</span>}
      {current > 0 && total > 1 && (
        <span className="rounded-full bg-[var(--ink)] text-[var(--bg)] px-2 py-1 text-[9.5px] font-bold font-mono">
          Cuota {current}/{total}
        </span>
      )}
    </div>
  )
}

function MovementCard({ row, onEdit, onDelete, onToggleStatus, onOpenBilling }) {
  const category = row.category || FALLBACK_CATEGORY
  const current = Number(row.installmentCurrent || 0)
  const total = Number(row.installmentTotal || 0)
  const hasInstallment = current > 0 && total > 1

  return (
    <article className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] overflow-hidden">
      <div className="p-4 flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-2xl grid place-items-center text-[20px] shrink-0 border"
          style={{
            borderColor: translucent(category.color, '55'),
            backgroundColor: translucent(category.color, '20'),
          }}
        >
          {category.icon || '•'}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-[13.5px] font-semibold leading-snug break-words">{row.description}</h3>
              <div className="text-[10.5px] text-[var(--muted)] mt-1 leading-relaxed">
                {row.date ? formatDate(row.date, true) : 'Fecha estimada por ciclo'}
                {' · '}{row.bankLabel}
                {row.cycleKey && <> · Ciclo {monthLabel(row.cycleKey)}</>}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-[15px] font-bold">{fmtCLP(row.amount)}</div>
              <div className="text-[9.5px] text-[var(--muted)] mt-1">
                {hasInstallment ? 'valor de esta cuota' : row.isPending ? 'por confirmar' : 'monto del gasto'}
              </div>
            </div>
          </div>

          <StatusBadges row={row}/>

          {(row.notes || (hasInstallment && Number(row.originalAmount || 0) > row.amount)) && (
            <div className="mt-3 rounded-xl bg-[var(--soft)] px-3 py-2 text-[10.5px] text-[var(--muted)] leading-relaxed">
              {row.notes && <div>{row.notes}</div>}
              {hasInstallment && Number(row.originalAmount || 0) > row.amount && (
                <div className={row.notes ? 'mt-1' : ''}>
                  Compra total: <strong className="text-[var(--ink)]">{fmtCLP(row.originalAmount)}</strong>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-[var(--line)] px-4 py-2.5 flex items-center justify-between gap-2">
        <div className="text-[9.5px] text-[var(--muted)]">
          {row.source === 'manual' && 'Registro creado manualmente o por Telegram'}
          {row.source === 'card' && `Movimiento importado desde Facturación${row.dueDate ? ` · vence ${formatDate(row.dueDate, true)}` : ''}`}
          {row.source === 'reconciled' && 'Registro manual conciliado con el movimiento bancario'}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {row.editable ? (
            <>
              {row.reviewRequired && (
                <button type="button" onClick={() => onToggleStatus(row.rawId)}
                  className="h-8 px-2.5 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-semibold flex items-center gap-1">
                  <Icon name="check" size={12}/> Confirmar
                </button>
              )}
              <button type="button" onClick={() => onEdit({
                id: row.rawId,
                amount: row.amount,
                description: row.description,
                category: row.category?.id || 'otros',
                bank: BANKS.find(bank => bank.label === row.bankLabel)?.id || 'efectivo',
                method: row.paymentLabel === 'Efectivo' ? 'efectivo' : 'tarjeta',
                type: row.paymentLabel === 'Crédito' ? 'credito' : 'debito',
                installments: row.installments,
                status: row.status,
                date: row.date,
                notes: row.notes,
              })}
                className="w-8 h-8 rounded-lg bg-[var(--soft)] text-[var(--muted)] grid place-items-center" aria-label="Editar gasto">
                <Icon name="pencil" size={13}/>
              </button>
              <button type="button" onClick={() => onDelete(row.rawId)}
                className="w-8 h-8 rounded-lg bg-red-50 text-red-600 grid place-items-center" aria-label="Eliminar gasto">
                <Icon name="trash" size={13}/>
              </button>
            </>
          ) : (
            <button type="button" onClick={onOpenBilling}
              className="h-8 px-3 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-[10px] font-semibold">
              Ver facturación
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

export default function ExpensesList({
  expenses,
  creditCards = [],
  onEdit,
  onDelete,
  onToggleStatus,
  onNew,
  onRefresh,
  onOpenBilling,
  dataSource = 'demo',
}) {
  const [cycles, setCycles] = useState([])
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingError, setBillingError] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const loadBilling = async () => {
    if (dataSource === 'demo') return
    setBillingLoading(true)
    setBillingError('')
    try {
      setCycles(await fetchBillingCycles())
    } catch (error) {
      console.error('fetchBillingCycles from ExpensesList:', error)
      setBillingError(error.message || 'No fue posible cargar los movimientos de tarjetas.')
    } finally {
      setBillingLoading(false)
    }
  }

  useEffect(() => {
    if (dataSource === 'supabase') loadBilling()
  }, [dataSource])

  const unified = useMemo(() => mergeRows(expenses, cycles, creditCards), [expenses, cycles, creditCards])

  const months = useMemo(() => {
    const keys = [...new Set(unified.rows.map(row => monthKey(row.effectiveDate)).filter(Boolean))]
      .sort((a, b) => b.localeCompare(a))
    return keys
  }, [unified.rows])

  useEffect(() => {
    if (!months.length) return
    if (selectedMonth && months.includes(selectedMonth)) return
    const nowParts = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      timeZone: 'America/Santiago',
    }).formatToParts(new Date())
    const year = nowParts.find(part => part.type === 'year')?.value
    const month = nowParts.find(part => part.type === 'month')?.value
    const current = year && month ? `${year}-${month}` : ''
    setSelectedMonth(months.includes(current) ? current : months[0])
  }, [months, selectedMonth])

  const selectedRows = useMemo(() => unified.rows.filter(row => monthKey(row.effectiveDate) === selectedMonth), [unified.rows, selectedMonth])

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('es')
    return selectedRows.filter(row => {
      if (sourceFilter !== 'all' && row.source !== sourceFilter) return false
      if (categoryFilter && row.category?.id !== categoryFilter && row.category?.label !== categoryFilter) return false
      if (statusFilter === 'confirmed' && (row.isPending || row.reviewRequired || !row.affectsTotal)) return false
      if (statusFilter === 'pending' && !row.isPending) return false
      if (statusFilter === 'review' && !row.reviewRequired) return false
      if (statusFilter === 'shared' && !row.sharedWithNicol) return false
      if (normalizedSearch && !`${row.description} ${row.category?.label || ''} ${row.bankLabel}`.toLocaleLowerCase('es').includes(normalizedSearch)) return false
      return true
    })
  }, [selectedRows, sourceFilter, categoryFilter, statusFilter, search])

  const totals = useMemo(() => {
    const confirmed = selectedRows.filter(row => row.affectsTotal && !row.isPending).reduce((sum, row) => sum + row.amount, 0)
    const pending = selectedRows.filter(row => row.isPending || !row.affectsTotal).reduce((sum, row) => sum + row.amount, 0)
    const shared = selectedRows.filter(row => row.sharedWithNicol).reduce((sum, row) => sum + row.amount, 0)
    const manual = selectedRows.filter(row => row.source === 'manual' || row.source === 'reconciled').reduce((sum, row) => sum + row.amount, 0)
    const cards = selectedRows.filter(row => row.source === 'card' || row.source === 'reconciled').reduce((sum, row) => sum + row.amount, 0)
    const alerts = selectedRows.filter(row => row.isPending || row.reviewRequired).length
    return { confirmed, pending, shared, manual, cards, alerts }
  }, [selectedRows])

  const availableCategories = useMemo(() => {
    const map = new Map()
    selectedRows.forEach(row => {
      const category = row.category || FALLBACK_CATEGORY
      map.set(category.id || category.label, category)
    })
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'es'))
  }, [selectedRows])

  const groupedRows = useMemo(() => {
    const groups = new Map()
    filteredRows.forEach(row => {
      const key = dateOnly(row.date) || `cycle:${row.cycleKey || selectedMonth}`
      const current = groups.get(key) || {
        key,
        label: row.date ? formatDate(row.date) : 'Movimientos sin fecha confirmada',
        rows: [],
      }
      current.rows.push(row)
      groups.set(key, current)
    })
    return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key))
  }, [filteredRows, selectedMonth])

  const refresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([onRefresh?.(), loadBilling()])
    } finally {
      setRefreshing(false)
    }
  }

  const loading = dataSource === 'loading' || billingLoading
  const error = dataSource === 'error' || Boolean(billingError)

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto pb-24">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.13em] text-[var(--muted)] font-bold">Registro unificado</div>
          <h1 className="text-[22px] font-bold tracking-tight mt-1">Gastos</h1>
          <p className="text-[12px] text-[var(--muted)] mt-1 max-w-2xl">
            Compras de tarjetas y registros manuales en una sola vista, sin contar coincidencias exactas dos veces.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onOpenBilling}
            className="h-9 px-3 rounded-lg border border-[var(--line)] text-[11px] font-semibold hover:bg-[var(--hover)]">
            Ver facturación
          </button>
          <button type="button" onClick={refresh} disabled={refreshing}
            className="h-9 px-3 rounded-lg border border-[var(--line)] text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-50">
            <Icon name="refresh" size={13}/>{refreshing ? 'Actualizando…' : 'Actualizar'}
          </button>
          {onNew && (
            <button type="button" onClick={onNew}
              className="h-9 px-3 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-[11px] font-semibold flex items-center gap-1.5">
              <Icon name="plus" size={13}/> Nuevo gasto
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="mt-4 h-1 rounded-full bg-[var(--soft)] overflow-hidden">
          <div className="h-full w-1/2 bg-[var(--ink)] animate-pulse rounded-full"/>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] text-red-700">
          Algunos datos no pudieron actualizarse. Los registros cargados siguen disponibles.
          {billingError && <div className="mt-1 opacity-80">{billingError}</div>}
        </div>
      )}

      {months.length > 0 && (
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1 snap-x">
          {months.map(key => {
            const monthRows = unified.rows.filter(row => monthKey(row.effectiveDate) === key)
            const monthTotal = monthRows.filter(row => row.affectsTotal && !row.isPending).reduce((sum, row) => sum + row.amount, 0)
            const active = selectedMonth === key
            return (
              <button key={key} type="button" onClick={() => setSelectedMonth(key)}
                className={`snap-start shrink-0 min-w-[158px] rounded-2xl border p-3 text-left transition-colors ${active
                  ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]'
                  : 'bg-[var(--bg-elev)] border-[var(--line)] hover:bg-[var(--hover)]'}`}>
                <div className="text-[10px] font-semibold capitalize opacity-70">{monthLabel(key)}</div>
                <div className="font-mono text-[15px] font-bold mt-1">{fmtCLP(monthTotal)}</div>
                <div className="text-[9.5px] mt-1 opacity-60">{monthRows.length} movimientos</div>
              </button>
            )
          })}
        </div>
      )}

      {selectedRows.length > 0 ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            <SummaryCard label="Gasto confirmado" value={fmtCLP(totals.confirmed)} detail={`${selectedRows.length} movimientos en ${monthLabel(selectedMonth)}`} tone="dark"/>
            <SummaryCard label="Movimientos de tarjetas" value={fmtCLP(totals.cards)} detail="Compras importadas desde CMR y Banco de Chile"/>
            <SummaryCard label="Compartido con Nicol" value={fmtCLP(totals.shared)} detail="Monto base antes de aplicar su porcentaje" tone="violet"/>
            <SummaryCard label="Pendiente y alertas" value={totals.alerts ? String(totals.alerts) : fmtCLP(totals.pending)} detail={totals.alerts ? `${fmtCLP(totals.pending)} todavía por confirmar o revisar` : 'Sin movimientos pendientes'} tone={totals.alerts || totals.pending ? 'warning' : 'default'}/>
          </div>

          {unified.duplicatesUnified > 0 && (
            <div className="mt-3 rounded-xl bg-emerald-50 text-emerald-800 px-4 py-2.5 text-[10.5px]">
              Gastito unificó {unified.duplicatesUnified} {unified.duplicatesUnified === 1 ? 'coincidencia exacta' : 'coincidencias exactas'} entre registros manuales y movimientos bancarios.
            </div>
          )}

          <div className="mt-5"><CategorySummary rows={selectedRows}/></div>

          <section className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-3">
            <div className="grid lg:grid-cols-[1fr_auto_auto_auto] gap-2">
              <label className="relative block">
                <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"/>
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar comercio, categoría o banco…"
                  className="w-full h-10 rounded-xl border border-[var(--line)] bg-[var(--bg)] pl-9 pr-3 text-[11px] outline-none"/>
              </label>
              <select value={sourceFilter} onChange={event => setSourceFilter(event.target.value)}
                className="h-10 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[11px] outline-none">
                <option value="all">Todos los orígenes</option>
                <option value="card">Tarjetas</option>
                <option value="manual">Manuales</option>
                <option value="reconciled">Conciliados</option>
              </select>
              <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}
                className="h-10 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[11px] outline-none">
                <option value="">Todas las categorías</option>
                {availableCategories.map(category => (
                  <option key={category.id || category.label} value={category.id || category.label}>{category.icon || '•'} {category.label}</option>
                ))}
              </select>
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}
                className="h-10 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[11px] outline-none">
                <option value="all">Todos los estados</option>
                <option value="confirmed">Confirmados</option>
                <option value="pending">Pendientes</option>
                <option value="review">Por revisar</option>
                <option value="shared">Compartidos con Nicol</option>
              </select>
            </div>
            <div className="mt-2 text-[10px] text-[var(--muted)]">
              Mostrando <strong className="text-[var(--ink)]">{filteredRows.length}</strong> de {selectedRows.length} movimientos.
            </div>
          </section>

          <div className="mt-4 space-y-5">
            {groupedRows.map(group => (
              <section key={group.key}>
                <div className="flex items-center justify-between gap-3 px-1 mb-2">
                  <h2 className="text-[11px] font-bold text-[var(--muted)] capitalize">{group.label}</h2>
                  <div className="font-mono text-[10.5px] text-[var(--muted)]">
                    {fmtCLP(group.rows.reduce((sum, row) => sum + row.amount, 0))}
                  </div>
                </div>
                <div className="grid lg:grid-cols-2 gap-2.5">
                  {group.rows.map(row => (
                    <MovementCard
                      key={row.id}
                      row={row}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onToggleStatus={onToggleStatus}
                      onOpenBilling={onOpenBilling}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {filteredRows.length === 0 && (
            <div className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-10 text-center">
              <div className="text-[26px]">🔎</div>
              <div className="text-[13px] font-semibold mt-3">No hay movimientos con estos filtros</div>
              <button type="button" onClick={() => { setSourceFilter('all'); setCategoryFilter(''); setStatusFilter('all'); setSearch('') }}
                className="mt-3 text-[11px] font-semibold underline">Limpiar filtros</button>
            </div>
          )}
        </>
      ) : (
        <div className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-10 text-center">
          <div className="text-[30px]">📭</div>
          <h2 className="text-[14px] font-semibold mt-3">Todavía no hay gastos disponibles</h2>
          <p className="text-[11px] text-[var(--muted)] mt-1">Registra un gasto manual o carga movimientos desde Facturación.</p>
        </div>
      )}
    </div>
  )
}
