import React, { useEffect, useMemo, useState } from 'react'
import { Icon, fmtCLP } from '../lib/helpers'
import { CATEGORIES, BANKS } from '../data'
import { fetchBillingCycles } from '../services/billingCyclesService'
import { fetchMyCards } from '../services/creditCardsService'

const FALLBACK_CATEGORY = { id: 'otros', label: 'Otros', icon: '•', color: '#888880' }
const SOURCE_META = {
  manual: { label: 'Manual', className: 'bg-slate-100 text-slate-700' },
  card: { label: 'Tarjeta', className: 'bg-blue-50 text-blue-700' },
  reconciled: { label: 'Conciliado', className: 'bg-emerald-50 text-emerald-700' },
}

function translucent(color, opacity = '18') {
  return /^#[0-9a-f]{6}$/i.test(String(color || '')) ? `${color}${opacity}` : `#888880${opacity}`
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : ''
}

function monthKey(value) {
  return dateOnly(value).slice(0, 7)
}

function monthLabel(key) {
  if (!key) return 'Sin mes'
  const [year, month] = key.split('-').map(Number)
  const label = new Intl.DateTimeFormat('es-CL', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function formatDate(value, compact = false) {
  const day = dateOnly(value)
  if (!day) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-CL', compact
    ? { day: '2-digit', month: 'short', timeZone: 'UTC' }
    : { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }
  ).format(new Date(`${day}T12:00:00Z`))
}

function duplicateKey(row) {
  const day = dateOnly(row.date)
  return day ? `${day}|${Number(row.amount || 0)}|${normalizeText(row.description)}` : ''
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
    paymentLabel: expense.method === 'efectivo' ? 'Efectivo' : expense.type === 'credito' ? 'Crédito' : 'Débito',
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
    const cardName = card?.name || 'Tarjeta'
    const cardLabel = card?.lastFour ? `${cardName} •••• ${card.lastFour}` : cardName

    cycle.transactions
      .filter(item => Number(item.amount || 0) > 0 && !['payment', 'credit'].includes(item.movementType))
      .forEach(item => rows.push({
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
      }))
  })

  return rows
}

function mergeRows(expenses, cycles, creditCards) {
  const billingRows = mapBillingRows(cycles, creditCards)
  const byKey = new Map()
  billingRows.forEach(row => {
    const key = duplicateKey(row)
    if (!key) return
    byKey.set(key, [...(byKey.get(key) || []), row])
  })

  const consumed = new Set()
  let duplicatesUnified = 0
  const manualRows = expenses.map(mapManualExpense).map(row => {
    const match = (byKey.get(duplicateKey(row)) || []).find(item => !consumed.has(item.id))
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

  return {
    rows: [...manualRows, ...billingRows.filter(row => !consumed.has(row.id))]
      .sort((a, b) => String(b.effectiveDate || '').localeCompare(String(a.effectiveDate || '')) || b.amount - a.amount),
    duplicatesUnified,
  }
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
    <div className={`rounded-2xl border p-3.5 min-h-[96px] ${className}`}>
      <div className="text-[9.5px] uppercase tracking-[0.11em] font-bold opacity-60">{label}</div>
      <div className="font-mono text-[19px] font-bold mt-2">{value}</div>
      <div className="text-[9.5px] mt-1 opacity-70 leading-relaxed">{detail}</div>
    </div>
  )
}

function CategorySummary({ rows }) {
  const categories = useMemo(() => groupByCategory(rows), [rows])
  const total = categories.reduce((sum, item) => sum + item.amount, 0)
  if (!categories.length) return null
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
      {categories.map(category => {
        const percentage = total > 0 ? Math.round(category.amount * 100 / total) : 0
        return (
          <div key={category.id || category.label} className="rounded-xl border p-3"
            style={{ borderColor: translucent(category.color, '55'), backgroundColor: translucent(category.color, '12') }}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl grid place-items-center text-[17px] border shrink-0"
                style={{ borderColor: translucent(category.color, '55'), backgroundColor: translucent(category.color, '22') }}>
                {category.icon || '•'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2 text-[11px] font-semibold">
                  <span className="truncate">{category.label}</span><span className="text-[var(--muted)]">{percentage}%</span>
                </div>
                <div className="font-mono text-[13px] font-bold mt-0.5">{fmtCLP(category.amount)}</div>
                <div className="h-1.5 rounded-full bg-black/5 mt-2 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(3, percentage)}%`, backgroundColor: category.color || '#888880' }}/>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatusBadges({ row, compact = false }) {
  const source = SOURCE_META[row.source] || SOURCE_META.manual
  const current = Number(row.installmentCurrent || 0)
  const total = Number(row.installmentTotal || 0)
  const size = compact ? 'px-1.5 py-0.5 text-[8.5px]' : 'px-2 py-1 text-[9.5px]'
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={`rounded-full font-bold ${size} ${source.className}`}>{source.label}</span>
      <span className={`rounded-full font-bold border ${size}`}
        style={{ borderColor: translucent(row.category?.color, '55'), backgroundColor: translucent(row.category?.color, '18'), color: row.category?.color || '#666' }}>
        {row.category?.icon || '•'} {row.category?.label || 'Otros'}
      </span>
      {row.isPending && <span className={`rounded-full bg-amber-100 text-amber-900 font-bold ${size}`}>Pendiente</span>}
      {row.reviewRequired && <span className={`rounded-full bg-[var(--amber-soft)] text-[var(--amber-ink)] font-bold ${size}`}>Revisar</span>}
      {!row.affectsTotal && <span className={`rounded-full bg-slate-100 text-slate-600 font-bold ${size}`}>Fuera del total</span>}
      {row.sharedWithNicol && <span className={`rounded-full bg-violet-50 text-violet-700 font-bold ${size}`}>Nicol</span>}
      {current > 0 && total > 1 && <span className={`rounded-full bg-[var(--ink)] text-[var(--bg)] font-bold font-mono ${size}`}>Cuota {current}/{total}</span>}
    </div>
  )
}

function editPayload(row) {
  return {
    id: row.rawId,
    amount: row.amount,
    description: row.description,
    category: row.category?.id || 'otros',
    bank: BANKS.find(bank => bank.label === row.bankLabel)?.id || 'efectivo',
    method: row.paymentLabel === 'Efectivo' ? 'efectivo' : 'tarjeta',
    type: row.installmentTotal > 1 || row.paymentLabel === 'Crédito' ? 'credito' : 'debito',
    installments: row.installments,
    status: row.status,
    date: row.date,
    notes: row.notes,
  }
}

function RowActions({ row, onEdit, onDelete, onToggleStatus, onOpenBilling, compact = false }) {
  if (!row.editable) {
    return (
      <button type="button" onClick={onOpenBilling}
        className={`${compact ? 'h-7 px-2 text-[9px]' : 'h-8 px-3 text-[10px]'} rounded-lg bg-[var(--ink)] text-[var(--bg)] font-semibold whitespace-nowrap`}>
        Facturación
      </button>
    )
  }
  return (
    <div className="flex items-center gap-1.5">
      {row.reviewRequired && (
        <button type="button" onClick={() => onToggleStatus(row.rawId)}
          className="h-8 px-2.5 rounded-lg bg-emerald-50 text-emerald-700 text-[9.5px] font-semibold">Confirmar</button>
      )}
      <button type="button" onClick={() => onEdit(editPayload(row))}
        className="w-8 h-8 rounded-lg bg-[var(--soft)] text-[var(--muted)] grid place-items-center" aria-label="Editar gasto">
        <Icon name="pencil" size={13}/>
      </button>
      <button type="button" onClick={() => onDelete(row.rawId)}
        className="w-8 h-8 rounded-lg bg-red-50 text-red-600 grid place-items-center" aria-label="Eliminar gasto">
        <Icon name="trash" size={13}/>
      </button>
    </div>
  )
}

function MovementListRow(props) {
  const { row, onEdit, onDelete, onToggleStatus, onOpenBilling } = props
  const category = row.category || FALLBACK_CATEGORY
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] lg:grid-cols-[auto_minmax(220px,1.5fr)_minmax(170px,.8fr)_minmax(150px,.7fr)_auto_auto] items-center gap-3 px-3.5 py-3 border-b border-[var(--line)] last:border-b-0 hover:bg-[var(--hover)]">
      <div className="w-9 h-9 rounded-xl grid place-items-center text-[17px] border"
        style={{ borderColor: translucent(category.color, '55'), backgroundColor: translucent(category.color, '20') }}>{category.icon || '•'}</div>
      <div className="min-w-0">
        <div className="text-[12.5px] font-semibold truncate">{row.description}</div>
        <div className="text-[9.5px] text-[var(--muted)] mt-0.5 truncate">{formatDate(row.date, true)} · {row.bankLabel}</div>
        <div className="lg:hidden mt-1.5"><StatusBadges row={row} compact/></div>
      </div>
      <div className="hidden lg:block"><StatusBadges row={row} compact/></div>
      <div className="hidden lg:block text-[10px] text-[var(--muted)] leading-relaxed">
        {row.installmentCurrent && row.installmentTotal > 1 ? `Cuota ${row.installmentCurrent}/${row.installmentTotal}` : row.paymentLabel}
        {row.cycleKey && <div>Ciclo {monthLabel(row.cycleKey)}</div>}
      </div>
      <div className="text-right">
        <div className="font-mono text-[13px] font-bold whitespace-nowrap">{fmtCLP(row.amount)}</div>
        <div className="text-[8.5px] text-[var(--muted)] mt-0.5">{row.isPending ? 'por confirmar' : 'gasto'}</div>
      </div>
      <div className="hidden lg:block"><RowActions {...props} compact/></div>
      <div className="col-span-3 lg:hidden flex justify-end"><RowActions {...props} compact/></div>
    </div>
  )
}

function MovementCard(props) {
  const { row } = props
  const category = row.category || FALLBACK_CATEGORY
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] overflow-hidden">
      <div className="p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl grid place-items-center text-[18px] border shrink-0"
          style={{ borderColor: translucent(category.color, '55'), backgroundColor: translucent(category.color, '20') }}>{category.icon || '•'}</div>
        <div className="min-w-0 flex-1">
          <div className="flex justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold leading-snug">{row.description}</div>
              <div className="text-[9.5px] text-[var(--muted)] mt-1">{formatDate(row.date, true)} · {row.bankLabel}</div>
            </div>
            <div className="font-mono text-[14px] font-bold whitespace-nowrap">{fmtCLP(row.amount)}</div>
          </div>
          <div className="mt-2"><StatusBadges row={row} compact/></div>
          {Number(row.originalAmount || 0) > row.amount && (
            <div className="mt-2 text-[9.5px] text-[var(--muted)]">Compra total: {fmtCLP(row.originalAmount)}</div>
          )}
        </div>
      </div>
      <div className="border-t border-[var(--line)] px-3.5 py-2 flex justify-end"><RowActions {...props}/></div>
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
  const [loadedCards, setLoadedCards] = useState([])
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingError, setBillingError] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [showCategories, setShowCategories] = useState(false)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('gastito-expenses-view') || 'list')
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(1)

  const loadBilling = async () => {
    if (dataSource === 'demo') return
    setBillingLoading(true)
    setBillingError('')
    try {
      const [nextCycles, nextCards] = await Promise.all([fetchBillingCycles(), fetchMyCards()])
      setCycles(nextCycles)
      setLoadedCards(nextCards || [])
    }
    catch (error) {
      console.error('fetchBillingCycles from ExpensesList:', error)
      setBillingError(error.message || 'No fue posible cargar los movimientos de tarjetas.')
    } finally { setBillingLoading(false) }
  }

  useEffect(() => { if (dataSource === 'supabase') loadBilling() }, [dataSource])
  useEffect(() => { localStorage.setItem('gastito-expenses-view', viewMode) }, [viewMode])

  const effectiveCards = creditCards.length ? creditCards : loadedCards
  const unified = useMemo(() => mergeRows(expenses, cycles, effectiveCards), [expenses, cycles, effectiveCards])
  const months = useMemo(() => [...new Set(unified.rows.map(row => monthKey(row.effectiveDate)).filter(Boolean))].sort((a, b) => b.localeCompare(a)), [unified.rows])

  useEffect(() => {
    if (!months.length || (selectedMonth && months.includes(selectedMonth))) return
    const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'America/Santiago' }).formatToParts(new Date())
    const current = `${parts.find(p => p.type === 'year')?.value || ''}-${parts.find(p => p.type === 'month')?.value || ''}`
    setSelectedMonth(months.includes(current) ? current : months[0])
  }, [months, selectedMonth])

  const selectedRows = useMemo(() => unified.rows.filter(row => monthKey(row.effectiveDate) === selectedMonth), [unified.rows, selectedMonth])
  const filteredRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es')
    return selectedRows.filter(row => {
      if (sourceFilter !== 'all' && row.source !== sourceFilter) return false
      if (categoryFilter && row.category?.id !== categoryFilter && row.category?.label !== categoryFilter) return false
      if (statusFilter === 'confirmed' && (row.isPending || row.reviewRequired || !row.affectsTotal)) return false
      if (statusFilter === 'pending' && !row.isPending) return false
      if (statusFilter === 'review' && !row.reviewRequired) return false
      if (statusFilter === 'shared' && !row.sharedWithNicol) return false
      return !term || `${row.description} ${row.category?.label || ''} ${row.bankLabel}`.toLocaleLowerCase('es').includes(term)
    })
  }, [selectedRows, sourceFilter, categoryFilter, statusFilter, search])

  useEffect(() => { setPage(1) }, [selectedMonth, sourceFilter, categoryFilter, statusFilter, search, pageSize])

  const totals = useMemo(() => {
    const confirmed = selectedRows.filter(row => row.affectsTotal && !row.isPending).reduce((s, row) => s + row.amount, 0)
    const pending = selectedRows.filter(row => row.isPending || !row.affectsTotal).reduce((s, row) => s + row.amount, 0)
    const shared = selectedRows.filter(row => row.sharedWithNicol).reduce((s, row) => s + row.amount, 0)
    const cards = selectedRows.filter(row => ['card', 'reconciled'].includes(row.source)).reduce((s, row) => s + row.amount, 0)
    const alerts = selectedRows.filter(row => row.isPending || row.reviewRequired).length
    return { confirmed, pending, shared, cards, alerts }
  }, [selectedRows])

  const categories = useMemo(() => {
    const map = new Map()
    selectedRows.forEach(row => { const c = row.category || FALLBACK_CATEGORY; map.set(c.id || c.label, c) })
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'es'))
  }, [selectedRows])

  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const visibleRows = pageSize === 0 ? filteredRows : filteredRows.slice((page - 1) * pageSize, page * pageSize)
  const groupedRows = useMemo(() => {
    const groups = new Map()
    visibleRows.forEach(row => {
      const key = dateOnly(row.date) || `cycle:${row.cycleKey || selectedMonth}`
      const group = groups.get(key) || { key, label: row.date ? formatDate(row.date) : 'Sin fecha confirmada', rows: [] }
      group.rows.push(row)
      groups.set(key, group)
    })
    return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key))
  }, [visibleRows, selectedMonth])

  const refresh = async () => {
    setRefreshing(true)
    try { await Promise.all([onRefresh?.(), loadBilling()]) } finally { setRefreshing(false) }
  }

  const loading = dataSource === 'loading' || billingLoading
  const error = dataSource === 'error' || Boolean(billingError)
  const openBilling = onOpenBilling || (() => {
    const target = Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Facturación')
    target?.click()
  })
  const commonActions = { onEdit, onDelete, onToggleStatus, onOpenBilling: openBilling }

  return (
    <div className="max-w-7xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.13em] text-[var(--muted)] font-bold">Registro unificado</div>
          <p className="text-[11px] text-[var(--muted)] mt-1">Tarjetas y gastos manuales, conciliados en una sola lista.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] p-1">
            <button onClick={() => setViewMode('list')} className={`h-7 px-2.5 rounded-md text-[10px] font-semibold ${viewMode === 'list' ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--muted)]'}`}>▤ Lista</button>
            <button onClick={() => setViewMode('cards')} className={`h-7 px-2.5 rounded-md text-[10px] font-semibold ${viewMode === 'cards' ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--muted)]'}`}>▦ Cards</button>
          </div>
          <button onClick={openBilling} className="h-9 px-3 rounded-lg border border-[var(--line)] text-[10px] font-semibold">Facturación</button>
          <button onClick={refresh} disabled={refreshing} className="h-9 px-3 rounded-lg border border-[var(--line)] text-[10px] font-semibold flex items-center gap-1.5 disabled:opacity-50"><Icon name="refresh" size={12}/>{refreshing ? 'Actualizando…' : 'Actualizar'}</button>
          {onNew && <button onClick={onNew} className="h-9 px-3 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-[10px] font-semibold flex items-center gap-1.5"><Icon name="plus" size={12}/> Nuevo gasto</button>}
        </div>
      </div>

      {loading && <div className="mt-3 h-1 rounded-full bg-[var(--soft)] overflow-hidden"><div className="h-full w-1/2 bg-[var(--ink)] animate-pulse rounded-full"/></div>}
      {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10.5px] text-red-700">Algunos datos no pudieron actualizarse. {billingError}</div>}

      {months.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {months.map(key => {
            const rows = unified.rows.filter(row => monthKey(row.effectiveDate) === key)
            const total = rows.filter(row => row.affectsTotal && !row.isPending).reduce((s, row) => s + row.amount, 0)
            const active = selectedMonth === key
            return <button key={key} onClick={() => setSelectedMonth(key)} className={`shrink-0 rounded-xl border px-3 py-2 text-left ${active ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]' : 'bg-[var(--bg-elev)] border-[var(--line)]'}`}>
              <div className="text-[9.5px] font-semibold capitalize opacity-70">{monthLabel(key)}</div>
              <div className="font-mono text-[13px] font-bold mt-0.5">{fmtCLP(total)}</div>
              <div className="text-[8.5px] mt-0.5 opacity-60">{rows.length} movimientos</div>
            </button>
          })}
        </div>
      )}

      {selectedRows.length > 0 ? <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-4">
          <SummaryCard label="Gasto confirmado" value={fmtCLP(totals.confirmed)} detail={`${selectedRows.length} movimientos`} tone="dark"/>
          <SummaryCard label="Desde tarjetas" value={fmtCLP(totals.cards)} detail="CMR y Banco de Chile"/>
          <SummaryCard label="Compartido con Nicol" value={fmtCLP(totals.shared)} detail="Base antes del porcentaje" tone="violet"/>
          <SummaryCard label="Alertas" value={String(totals.alerts)} detail={totals.alerts ? `${fmtCLP(totals.pending)} pendiente` : 'Sin pendientes'} tone={totals.alerts ? 'warning' : 'default'}/>
        </div>

        {unified.duplicatesUnified > 0 && <div className="mt-2.5 rounded-xl bg-emerald-50 text-emerald-800 px-3.5 py-2 text-[9.5px]">{unified.duplicatesUnified} coincidencias manuales fueron conciliadas y no se cuentan dos veces.</div>}

        <div className="mt-3 flex justify-end">
          <button onClick={() => setShowCategories(value => !value)} className="text-[10px] font-semibold text-[var(--muted)] underline underline-offset-2">{showCategories ? 'Ocultar categorías' : 'Ver distribución por categorías'}</button>
        </div>
        {showCategories && <div className="mt-2"><CategorySummary rows={selectedRows}/></div>}

        <section className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] p-2.5">
          <div className="grid md:grid-cols-[minmax(220px,1fr)_auto_auto_auto_auto] gap-2">
            <label className="relative block"><Icon name="search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar comercio, categoría o banco…" className="w-full h-9 rounded-lg border border-[var(--line)] bg-[var(--bg)] pl-9 pr-3 text-[10px] outline-none"/></label>
            <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className="h-9 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 text-[10px]"><option value="all">Todos los orígenes</option><option value="card">Tarjetas</option><option value="manual">Manuales</option><option value="reconciled">Conciliados</option></select>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="h-9 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 text-[10px]"><option value="">Todas las categorías</option>{categories.map(c => <option key={c.id || c.label} value={c.id || c.label}>{c.icon} {c.label}</option>)}</select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 text-[10px]"><option value="all">Todos los estados</option><option value="confirmed">Confirmados</option><option value="pending">Pendientes</option><option value="review">Por revisar</option><option value="shared">Nicol</option></select>
            <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className="h-9 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-2.5 text-[10px]"><option value={25}>25 por página</option><option value={50}>50 por página</option><option value={0}>Ver todos</option></select>
          </div>
          <div className="mt-1.5 text-[9px] text-[var(--muted)]">Mostrando <strong className="text-[var(--ink)]">{visibleRows.length}</strong> de {filteredRows.length} movimientos.</div>
        </section>

        <div className="mt-3 space-y-4">
          {groupedRows.map(group => <section key={group.key}>
            <div className="flex items-center justify-between px-1 mb-1.5"><h2 className="text-[10px] font-bold text-[var(--muted)] capitalize">{group.label}</h2><div className="font-mono text-[9.5px] text-[var(--muted)]">{fmtCLP(group.rows.reduce((s, row) => s + row.amount, 0))}</div></div>
            {viewMode === 'list'
              ? <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] overflow-hidden">{group.rows.map(row => <MovementListRow key={row.id} row={row} {...commonActions}/>)}</div>
              : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2.5">{group.rows.map(row => <MovementCard key={row.id} row={row} {...commonActions}/>)}</div>}
          </section>)}
        </div>

        {totalPages > 1 && <div className="mt-4 flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] px-3 py-2">
          <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="h-8 px-3 rounded-lg border border-[var(--line)] text-[10px] font-semibold disabled:opacity-30">Anterior</button>
          <div className="text-[9.5px] text-[var(--muted)]">Página <strong className="text-[var(--ink)]">{page}</strong> de {totalPages}</div>
          <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="h-8 px-3 rounded-lg border border-[var(--line)] text-[10px] font-semibold disabled:opacity-30">Siguiente</button>
        </div>}

        {filteredRows.length === 0 && <div className="mt-5 rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-8 text-center text-[11px]">No hay movimientos con estos filtros.</div>}
      </> : <div className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-10 text-center"><div className="text-[30px]">📭</div><h2 className="text-[14px] font-semibold mt-3">Todavía no hay gastos disponibles</h2></div>}
    </div>
  )
}
