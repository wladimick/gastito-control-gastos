import React, { useEffect, useMemo, useState } from 'react'
import { Icon, fmtCLP } from '../lib/helpers'
import { CATEGORIES, BANKS } from '../data'
import { Badge, Card } from './ui'

const PAGE_SIZE_KEY = 'gastito_expenses_page_size_v1'
const FALLBACK_CATEGORY = CATEGORIES.find(category => category.id === 'otros') || {
  id: 'otros', label: 'Otros', icon: '•', color: '#888880',
}

const SOURCE = {
  manual: { label: 'Manual', tone: 'muted' },
  reconciled: { label: 'Conciliado', tone: 'ok' },
  billing: { label: 'Facturación', tone: 'info' },
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : ''
}

function monthKey(value) {
  return dateOnly(value).slice(0, 7)
}

function monthLabel(key, short = false) {
  if (!key) return 'Sin mes'
  const [year, month] = key.split('-').map(Number)
  const label = new Intl.DateTimeFormat('es-CL', {
    month: short ? 'short' : 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function formatDate(value) {
  const day = dateOnly(value)
  if (!day) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-CL', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`))
}

function categoryFor(row) {
  if (row.categoryMeta?.label) return row.categoryMeta
  return CATEGORIES.find(category => category.id === row.category) || FALLBACK_CATEGORY
}

function bankLabel(id) {
  return BANKS.find(bank => bank.id === id)?.label || id || 'Sin banco'
}

function sourceFor(row) {
  return SOURCE[row.source] || SOURCE.manual
}

function methodLabel(row) {
  if (row.method === 'efectivo') return 'Efectivo'
  if (row.type === 'credito') return 'Tarjeta de crédito'
  if (row.method === 'transfer') return 'Transferencia'
  return 'Débito'
}

function RowBadges({ row }) {
  const source = sourceFor(row)
  const current = Number(row.installmentCurrent || 0)
  const total = Number(row.installmentTotal || row.installments || 0)
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1.5">
      <Badge tone={source.tone} className="!text-[8.5px] !px-1.5 !py-0.5">{source.label}</Badge>
      {current > 0 && total > 1 && <Badge tone="dark" className="!text-[8.5px] !px-1.5 !py-0.5">Cuota {current}/{total}</Badge>}
      {row.sharedWithNicol && <span className="inline-flex rounded-full px-1.5 py-0.5 text-[8.5px] font-semibold bg-violet-50 text-violet-700">Nicol</span>}
      {row.status === 'revisar' && <Badge tone="warn" className="!text-[8.5px] !px-1.5 !py-0.5">Revisar</Badge>}
    </div>
  )
}

function ExpenseActions({ row, onEdit, onDelete, onToggleStatus, onOpenBilling }) {
  if (row.editable === false || row.source === 'billing') {
    return (
      <button type="button" onClick={onOpenBilling}
        className="h-9 px-3 rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] text-[9.5px] font-semibold">
        Ver facturación
      </button>
    )
  }
  return (
    <div className="flex items-center gap-2">
      {row.status === 'revisar' && (
        <button type="button" onClick={() => onToggleStatus(row.id)}
          className="h-9 px-3 rounded-xl bg-emerald-50 text-emerald-700 text-[9.5px] font-semibold">
          Confirmar
        </button>
      )}
      <button type="button" onClick={() => onEdit(row)} aria-label="Editar gasto"
        className="w-9 h-9 rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] grid place-items-center">
        <Icon name="pencil" size={13}/>
      </button>
      <button type="button" onClick={() => onDelete(row.id)} aria-label="Eliminar gasto"
        className="w-9 h-9 rounded-xl bg-red-50 text-red-600 grid place-items-center">
        <Icon name="trash" size={13}/>
      </button>
    </div>
  )
}

function ExpenseRow(props) {
  const { row } = props
  const [open, setOpen] = useState(false)
  const category = categoryFor(row)

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] overflow-hidden">
      <button type="button" onClick={() => setOpen(value => !value)}
        className="w-full grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-start px-3.5 py-3.5 text-left active:bg-[var(--hover)]">
        <div className="w-10 h-10 rounded-2xl grid place-items-center text-[17px] border shrink-0"
          style={{ backgroundColor: `${category.color}14`, borderColor: `${category.color}38` }}>
          {category.icon}
        </div>
        <div className="min-w-0">
          <div className="text-[12.5px] md:text-[13px] font-semibold leading-snug truncate">{row.description}</div>
          <div className="text-[9.5px] text-[var(--muted)] mt-1 truncate">
            {formatDate(row.date)} · {bankLabel(row.bank)}
          </div>
          <RowBadges row={row}/>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-[14px] md:text-[15px] font-bold whitespace-nowrap">{fmtCLP(row.amount)}</div>
          <div className="text-[11px] text-[var(--muted)] mt-2">{open ? '−' : '+'}</div>
        </div>
      </button>

      {open && (
        <div className="border-t border-[var(--line)] bg-[var(--soft)]/45 px-3.5 py-3">
          <div className="grid grid-cols-2 gap-2 text-[9px]">
            <div>
              <div className="text-[var(--muted)]">Categoría</div>
              <div className="font-semibold mt-0.5">{category.icon} {category.label}</div>
            </div>
            <div>
              <div className="text-[var(--muted)]">Medio de pago</div>
              <div className="font-semibold mt-0.5">{methodLabel(row)}</div>
            </div>
            {row.cycleKey && (
              <div>
                <div className="text-[var(--muted)]">Ciclo</div>
                <div className="font-semibold mt-0.5">{monthLabel(row.cycleKey, true)}</div>
              </div>
            )}
            {Number(row.originalAmount || 0) > Number(row.amount || 0) && (
              <div>
                <div className="text-[var(--muted)]">Compra original</div>
                <div className="font-mono font-semibold mt-0.5">{fmtCLP(row.originalAmount)}</div>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center justify-end">
            <ExpenseActions {...props}/>
          </div>
        </div>
      )}
    </div>
  )
}

function CategoryBreakdown({ rows }) {
  const grouped = useMemo(() => {
    const map = new Map()
    rows.forEach(row => {
      const category = categoryFor(row)
      const current = map.get(category.id) || { ...category, amount: 0, count: 0 }
      current.amount += Number(row.amount || 0)
      current.count += 1
      map.set(category.id, current)
    })
    return [...map.values()].sort((a, b) => b.amount - a.amount)
  }, [rows])
  const total = grouped.reduce((sum, category) => sum + category.amount, 0)

  return (
    <Card padding="p-0" className="overflow-hidden rounded-3xl">
      <div className="px-4 py-3 border-b border-[var(--line)] flex items-center justify-between">
        <div>
          <div className="text-[9px] uppercase tracking-[.12em] font-bold text-[var(--muted)]">Distribución</div>
          <div className="text-[12px] font-semibold mt-0.5">Por categoría</div>
        </div>
        <div className="font-mono text-[12px] font-bold">{fmtCLP(total)}</div>
      </div>
      <div className="grid sm:grid-cols-2 gap-2 p-3">
        {grouped.map(category => {
          const percentage = total ? Math.round(category.amount * 100 / total) : 0
          return (
            <div key={category.id} className="rounded-2xl border border-[var(--line)] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[15px]">{category.icon}</span>
                  <span className="text-[10.5px] font-semibold truncate">{category.label}</span>
                </div>
                <span className="text-[8.5px] text-[var(--muted)]">{percentage}%</span>
              </div>
              <div className="font-mono text-[12px] font-bold mt-2">{fmtCLP(category.amount)}</div>
              <div className="h-1.5 rounded-full bg-[var(--line)] mt-2 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.max(2, percentage)}%`, backgroundColor: category.color }}/>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export default function ExpensesList({
  expenses = [],
  onEdit,
  onDelete,
  onToggleStatus,
  onNew,
  onRefresh,
  onOpenBilling,
  dataSource = 'demo',
}) {
  const [selectedMonth, setSelectedMonth] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(() => Number(localStorage.getItem(PAGE_SIZE_KEY) || 25))
  const [refreshing, setRefreshing] = useState(false)

  const months = useMemo(() => [...new Set(expenses.map(row => monthKey(row.date)).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a)), [expenses])

  useEffect(() => {
    if (!months.length) return
    if (selectedMonth && months.includes(selectedMonth)) return
    const current = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', timeZone: 'America/Santiago',
    }).format(new Date()).slice(0, 7)
    setSelectedMonth(months.includes(current) ? current : months[0])
  }, [months, selectedMonth])

  useEffect(() => { setPage(1) }, [selectedMonth, sourceFilter, categoryFilter, statusFilter, search])

  const selectedRows = useMemo(() => expenses.filter(row => monthKey(row.date) === selectedMonth), [expenses, selectedMonth])
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return selectedRows.filter(row => {
      if (sourceFilter !== 'all' && row.source !== sourceFilter) return false
      if (categoryFilter !== 'all' && row.category !== categoryFilter) return false
      if (statusFilter === 'review' && row.status !== 'revisar') return false
      if (statusFilter === 'shared' && !row.sharedWithNicol) return false
      if (statusFilter === 'confirmed' && row.status === 'revisar') return false
      if (query && !`${row.description} ${bankLabel(row.bank)} ${categoryFor(row).label}`.toLowerCase().includes(query)) return false
      return true
    }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
  }, [selectedRows, sourceFilter, categoryFilter, statusFilter, search])

  const total = selectedRows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const shared = selectedRows.filter(row => row.sharedWithNicol).reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const categories = useMemo(() => [...new Set(selectedRows.map(row => row.category))]
    .map(id => CATEGORIES.find(category => category.id === id) || FALLBACK_CATEGORY)
    .sort((a, b) => a.label.localeCompare(b.label, 'es')), [selectedRows])

  const pageCount = pageSize >= 9999 ? 1 : Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const pagedRows = pageSize >= 9999 ? filteredRows : filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize)

  const setSize = value => {
    const number = Number(value)
    setPageSize(number)
    localStorage.setItem(PAGE_SIZE_KEY, String(number))
    setPage(1)
  }

  const refresh = async () => {
    setRefreshing(true)
    try {
      if (onRefresh) await onRefresh()
      else window.location.reload()
    } finally {
      setRefreshing(false)
    }
  }

  const openBilling = () => onOpenBilling?.()

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <header className="rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 via-fuchsia-50/50 to-rose-50 p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[9px] uppercase tracking-[.14em] font-bold text-violet-500">Gastito</div>
            <h1 className="text-[22px] md:text-[24px] font-bold tracking-tight mt-1">Gastos</h1>
            <p className="text-[10px] text-[var(--muted)] mt-1">Tus movimientos, del más reciente al más antiguo.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={refresh} disabled={refreshing}
              className="w-9 h-9 rounded-2xl border border-white/80 bg-white/75 grid place-items-center disabled:opacity-50">
              <Icon name="refresh" size={13}/>
            </button>
            {onNew && (
              <button type="button" onClick={onNew}
                className="h-9 px-3 rounded-2xl bg-[var(--ink)] text-[var(--bg)] text-[9.5px] font-semibold flex items-center gap-1.5">
                <Icon name="plus" size={11}/>Nuevo
              </button>
            )}
          </div>
        </div>
      </header>

      {dataSource === 'loading' && <div className="mt-3 h-1 rounded-full bg-[var(--line)] overflow-hidden"><div className="h-full w-1/2 bg-[var(--ink)] animate-pulse"/></div>}
      {dataSource === 'error' && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] text-red-700">No fue posible actualizar todos los movimientos.</div>}

      {months.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {months.map(key => {
            const rows = expenses.filter(row => monthKey(row.date) === key)
            const monthTotal = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
            const active = selectedMonth === key
            return (
              <button key={key} type="button" onClick={() => setSelectedMonth(key)}
                className={`shrink-0 min-w-[128px] rounded-2xl border px-3 py-2.5 text-left ${active
                  ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]'
                  : 'bg-[var(--bg-elev)] border-[var(--line)]'}`}>
                <div className="text-[8.5px] font-semibold opacity-65">{monthLabel(key, true)}</div>
                <div className="font-mono text-[12.5px] font-bold mt-0.5">{fmtCLP(monthTotal)}</div>
                <div className="text-[8px] opacity-55 mt-0.5">{rows.length} movimientos</div>
              </button>
            )
          })}
        </div>
      )}

      {selectedRows.length > 0 ? (
        <>
          <Card padding="p-4" className="mt-4 rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[9px] uppercase tracking-[.13em] text-[var(--muted)] font-bold">Gasto del mes</div>
                <div className="font-mono text-[22px] md:text-[24px] font-bold mt-1.5">{fmtCLP(total)}</div>
                <div className="text-[9.5px] text-[var(--muted)] mt-1">{selectedRows.length} movimientos · {monthLabel(selectedMonth)}</div>
              </div>
              {shared > 0 && (
                <div className="rounded-2xl bg-violet-50 px-3 py-2 text-right">
                  <div className="text-[8px] uppercase tracking-wider text-violet-500 font-bold">Nicol</div>
                  <div className="font-mono text-[11px] text-violet-800 font-bold mt-1">{fmtCLP(shared)}</div>
                </div>
              )}
            </div>
            <button type="button" onClick={() => setShowBreakdown(value => !value)}
              className="mt-3 text-[9.5px] font-semibold underline">
              {showBreakdown ? 'Ocultar distribución' : 'Ver distribución por categoría'}
            </button>
          </Card>

          {showBreakdown && <div className="mt-3"><CategoryBreakdown rows={selectedRows}/></div>}

          <Card padding="p-3" className="mt-3 rounded-3xl">
            <label className="relative block">
              <Icon name="search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"/>
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar comercio, categoría o banco…"
                className="w-full h-10 rounded-xl border border-[var(--line)] bg-[var(--bg)] pl-9 pr-3 text-[10.5px] outline-none"/>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
              <select value={sourceFilter} onChange={event => setSourceFilter(event.target.value)}
                className="h-9 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-2.5 text-[9.5px]">
                <option value="all">Todas las fuentes</option>
                <option value="manual">Solo manuales</option>
                <option value="reconciled">Conciliados</option>
                <option value="billing">Facturación</option>
              </select>
              <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}
                className="h-9 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-2.5 text-[9.5px]">
                <option value="all">Todas las categorías</option>
                {categories.map(category => <option key={category.id} value={category.id}>{category.icon} {category.label}</option>)}
              </select>
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}
                className="h-9 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-2.5 text-[9.5px]">
                <option value="all">Todos los estados</option>
                <option value="confirmed">Confirmados</option>
                <option value="review">Por revisar</option>
                <option value="shared">Compartidos con Nicol</option>
              </select>
            </div>
            <div className="mt-2 text-[9px] text-[var(--muted)]">
              Mostrando <strong className="text-[var(--ink)]">{filteredRows.length}</strong> de {selectedRows.length} movimientos.
            </div>
          </Card>

          <div className="mt-3 space-y-2">
            {pagedRows.map(row => (
              <ExpenseRow key={row.id} row={row} onEdit={onEdit} onDelete={onDelete} onToggleStatus={onToggleStatus} onOpenBilling={openBilling}/>
            ))}
            {!pagedRows.length && <Card className="text-center text-[10.5px] text-[var(--muted)]" padding="p-10">No hay movimientos con estos filtros.</Card>}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <select value={pageSize} onChange={event => setSize(event.target.value)}
              className="h-8 rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] px-2 text-[9px]">
              <option value={25}>25 por página</option>
              <option value={50}>50 por página</option>
              <option value={9999}>Mostrar todos</option>
            </select>
            {pageCount > 1 && (
              <div className="flex items-center gap-2">
                <button type="button" disabled={safePage <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}
                  className="h-8 px-2.5 rounded-xl border border-[var(--line)] text-[9px] disabled:opacity-40">Anterior</button>
                <span className="text-[9px] text-[var(--muted)]">{safePage} / {pageCount}</span>
                <button type="button" disabled={safePage >= pageCount} onClick={() => setPage(value => Math.min(pageCount, value + 1))}
                  className="h-8 px-2.5 rounded-xl border border-[var(--line)] text-[9px] disabled:opacity-40">Siguiente</button>
              </div>
            )}
          </div>
        </>
      ) : (
        dataSource === 'loading' ? (
          <Card className="mt-6 text-center rounded-3xl" padding="p-10" aria-busy="true">
            <div className="mx-auto h-7 w-7 rounded-full border-2 border-[var(--line)] border-t-[var(--ink)] animate-spin"/>
            <div className="text-[12px] font-semibold mt-3">Cargando movimientos…</div>
          </Card>
        ) : (
          <Card className="mt-6 text-center rounded-3xl" padding="p-10">
            <div className="text-[24px]">📭</div>
            <div className="text-[12px] font-semibold mt-3">Todavía no hay movimientos</div>
            <div className="text-[10px] text-[var(--muted)] mt-1">Registra un gasto manual o importa una cartola en Facturación.</div>
          </Card>
        )
      )}

      <div className="mt-4 text-center">
        <button type="button" onClick={openBilling} className="text-[9.5px] font-semibold underline">Abrir Facturación</button>
      </div>
    </div>
  )
}
