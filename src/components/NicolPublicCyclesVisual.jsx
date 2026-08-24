import React, { useEffect, useMemo, useState } from 'react'
import { fmtCLP } from '../lib/helpers'
import { isConfigured, supabase } from '../lib/supabase'

const TYPE_LABELS = {
  purchase: 'Compra',
  installment: 'Compra en cuotas',
  commission: 'Comisión',
  tax: 'Impuesto',
  interest: 'Interés',
  other: 'Gasto mensual',
}

const FALLBACK_CATEGORY = {
  id: 'other',
  label: 'Otros',
  icon: '•',
  color: '#888880',
}

function formatDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${String(value).slice(0, 10)}T12:00:00Z`))
}

function formatCycleLabel(key) {
  if (!key || !/^\d{4}-\d{2}$/.test(key)) return key || 'Ciclo'
  const [year, month] = key.split('-').map(Number)
  const label = new Intl.DateTimeFormat('es-CL', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function categoryFor(item) {
  return {
    ...FALLBACK_CATEGORY,
    ...(item?.category || {}),
  }
}

function translucent(color, opacity = '18') {
  return /^#[0-9a-f]{6}$/i.test(String(color || '')) ? `${color}${opacity}` : `#888880${opacity}`
}

function buildCategorySummary(items, percentage) {
  const grouped = new Map()
  for (const item of items || []) {
    const category = categoryFor(item)
    const key = category.id || category.label
    const current = grouped.get(key) || { category, total: 0, count: 0 }
    current.total += Number(item.amount || 0)
    current.count += 1
    grouped.set(key, current)
  }

  return [...grouped.values()]
    .map(row => ({
      ...row,
      nicolAmount: Math.round(row.total * Number(percentage || 0) / 100),
    }))
    .sort((a, b) => b.total - a.total || a.category.label.localeCompare(b.category.label, 'es'))
}

function Header() {
  return (
    <header className="relative overflow-hidden border-b border-violet-100 bg-gradient-to-r from-violet-100 via-fuchsia-50 to-rose-50">
      <div className="pointer-events-none absolute -left-8 -top-12 h-32 w-32 rounded-full bg-violet-300/30 blur-2xl" aria-hidden="true" />
      <div className="relative max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[18px] font-bold tracking-tight">Gastito</div>
          <div className="text-[11px] text-slate-600 mt-0.5">Gastos compartidos con Nicol</div>
        </div>
        <div className="shrink-0 text-[10px] uppercase tracking-[0.12em] font-bold text-violet-800 border border-white/80 bg-white/70 rounded-full px-2.5 py-1">
          Solo lectura
        </div>
      </div>
    </header>
  )
}

function Message({ title, text, loading = false }) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Header />
      <main className="max-w-lg mx-auto px-4 py-20 text-center">
        {loading && <div className="w-8 h-8 rounded-full border-2 border-[var(--line)] border-t-[var(--ink)] animate-spin mx-auto mb-5" />}
        <h1 className="text-[19px] font-bold">{title}</h1>
        <p className="text-[13px] text-[var(--muted)] mt-2 leading-relaxed">{text}</p>
      </main>
    </div>
  )
}

function CycleSelector({ cycles, selectedKey, onSelect }) {
  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.13em] text-[var(--muted)] font-bold">Ciclo mensual</div>
          <div className="text-[12px] text-[var(--muted)] mt-0.5">Selecciona el mes que quieres revisar</div>
        </div>
        <div className="text-[10.5px] text-[var(--muted)] whitespace-nowrap">{cycles.length} meses</div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 snap-x">
        {cycles.map(cycle => {
          const selected = cycle.cycleKey === selectedKey
          return (
            <button
              key={cycle.cycleKey}
              type="button"
              onClick={() => onSelect(cycle.cycleKey)}
              className={`snap-start shrink-0 min-w-[150px] rounded-2xl border px-3.5 py-3 text-left transition-colors ${selected
                ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]'
                : 'bg-[var(--bg-elev)] text-[var(--ink)] border-[var(--line)] hover:bg-[var(--hover)]'}`}
            >
              <div className="text-[11.5px] font-semibold">{formatCycleLabel(cycle.cycleKey)}</div>
              <div className="font-mono text-[15px] font-bold mt-1">{fmtCLP(cycle.nicolAmount || 0)}</div>
              <div className={`text-[9.5px] mt-1 ${selected ? 'opacity-60' : 'text-[var(--muted)]'}`}>
                {cycle.isCurrent ? 'Mes actual' : cycle.isUpcoming ? 'Próximo mes' : 'Mes anterior'}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function CycleSummary({ cycle, percentage, index, total, onMove }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-violet-950 to-fuchsia-900 text-[var(--bg)] rounded-2xl p-4 sm:p-5 shadow-sm shadow-violet-950/25">
      <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-fuchsia-400/20 blur-3xl" aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] opacity-60 font-bold">
            {cycle.isUpcoming ? 'Monto estimado del ciclo' : 'Total compartido del ciclo'}
          </div>
          <div className="text-[17px] font-semibold mt-1">{formatCycleLabel(cycle.cycleKey)}</div>
        </div>
        <div className="flex gap-1.5">
          <button type="button" disabled={index <= 0} onClick={() => onMove(-1)} aria-label="Ciclo anterior"
            className="w-9 h-9 rounded-full border border-white/15 grid place-items-center disabled:opacity-25 hover:bg-white/10">
            <span aria-hidden="true">‹</span>
          </button>
          <button type="button" disabled={index >= total - 1} onClick={() => onMove(1)} aria-label="Ciclo siguiente"
            className="w-9 h-9 rounded-full border border-white/15 grid place-items-center disabled:opacity-25 hover:bg-white/10">
            <span aria-hidden="true">›</span>
          </button>
        </div>
      </div>

      <div className="relative font-mono text-[30px] font-bold mt-4">{fmtCLP(cycle.sharedTotal || 0)}</div>
      <div className="relative mt-4 pt-4 border-t border-white/15 flex items-end justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] opacity-60 font-bold">Aporte de Nicol</div>
          <div className="font-mono text-[23px] font-bold mt-1">{fmtCLP(cycle.nicolAmount || 0)}</div>
        </div>
        <div className="text-[13px] font-semibold bg-white/10 rounded-full px-3 py-1.5">{percentage}%</div>
      </div>

      <div className="relative mt-4 rounded-xl bg-white/10 px-3.5 py-3 flex flex-wrap items-center justify-center gap-2 text-[11px]">
        <span className="font-mono font-semibold">{fmtCLP(cycle.sharedTotal || 0)}</span>
        <span className="opacity-55">×</span>
        <span className="font-semibold">{percentage}%</span>
        <span className="opacity-55">=</span>
        <span className="font-mono font-bold">{fmtCLP(cycle.nicolAmount || 0)}</span>
      </div>

      <div className="relative flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] opacity-65 mt-4">
        {cycle.dueDate && <span>Vencimiento desde {formatDate(cycle.dueDate)}</span>}
        {cycle.projectedCount > 0 && <span>{cycle.projectedCount} cuotas proyectadas</span>}
        {cycle.recurringCount > 0 && <span>{cycle.recurringCount} recurrentes</span>}
      </div>
    </section>
  )
}

function CategorySummary({ rows }) {
  if (!rows.length) return null

  return (
    <section>
      <div className="mb-2">
        <div className="text-[10px] uppercase tracking-[0.13em] text-[var(--muted)] font-bold">Resumen por categoría</div>
        <div className="text-[12px] text-[var(--muted)] mt-0.5">Así se distribuyen los gastos de este ciclo</div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
        {rows.map(row => (
          <div
            key={row.category.id || row.category.label}
            className="rounded-2xl border p-3.5"
            style={{
              borderColor: translucent(row.category.color, '55'),
              backgroundColor: translucent(row.category.color, '12'),
            }}
          >
            <div className="flex items-start gap-2.5">
              <div
                className="w-9 h-9 rounded-xl grid place-items-center text-[18px] shrink-0 border"
                style={{
                  borderColor: translucent(row.category.color, '55'),
                  backgroundColor: translucent(row.category.color, '24'),
                }}
                aria-hidden="true"
              >
                {row.category.icon || '•'}
              </div>
              <div className="min-w-0">
                <div className="text-[11.5px] font-bold truncate">{row.category.label}</div>
                <div className="font-mono text-[14px] font-bold mt-0.5">{fmtCLP(row.total)}</div>
                <div className="text-[9.5px] text-[var(--muted)] mt-0.5">
                  Nicol {fmtCLP(row.nicolAmount)} · {row.count} {row.count === 1 ? 'gasto' : 'gastos'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function TransactionFilters({ categories, categoryFilter, onCategoryChange, sortBy, onSortChange }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 mt-3 border-t border-[var(--line)]">
      <label>
        <span className="block text-[10px] uppercase tracking-[0.1em] font-bold text-[var(--muted)] mb-1">Categoría</span>
        <select value={categoryFilter} onChange={event => onCategoryChange(event.target.value)}
          className="w-full h-10 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[11px] outline-none focus:border-violet-400">
          <option value="">Todas las categorías</option>
          {categories.map(category => <option key={category.id} value={category.id}>{category.icon || '•'} {category.label}</option>)}
        </select>
      </label>
      <label>
        <span className="block text-[10px] uppercase tracking-[0.1em] font-bold text-[var(--muted)] mb-1">Ordenar por</span>
        <select value={sortBy} onChange={event => onSortChange(event.target.value)}
          className="w-full h-10 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[11px] outline-none focus:border-violet-400">
          <option value="date-desc">Fecha: más reciente</option>
          <option value="date-asc">Fecha: más antigua</option>
          <option value="amount-desc">Monto: mayor a menor</option>
          <option value="amount-asc">Monto: menor a mayor</option>
        </select>
      </label>
    </div>
  )
}

function InstallmentBadges({ item }) {
  const current = Number(item.installmentCurrent || 0)
  const total = Number(item.installmentTotal || 0)
  if (item.movementType !== 'installment' || current < 1 || total < 2) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ${item.isProjected
        ? 'bg-blue-100 text-blue-800'
        : 'bg-amber-100 text-amber-900'}`}>
        {item.isProjected ? 'Este ciclo pagará' : 'Este ciclo paga'}
      </span>
      <span className="inline-flex items-center rounded-full bg-[var(--ink)] text-[var(--bg)] px-2.5 py-1 text-[11px] font-bold font-mono">
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

function TransactionRow({ item, percentage }) {
  const category = categoryFor(item)
  const isInstallment = item.movementType === 'installment'
    && Number(item.installmentCurrent || 0) > 0
    && Number(item.installmentTotal || 0) > 1
  const originalAmount = Number(item.originalAmount || 0)
  const amount = Number(item.amount || 0)
  const nicolAmount = Math.round(amount * Number(percentage || 0) / 100)

  const stateLabel = item.isRecurring
    ? item.isProjected ? 'Recurrente estimado' : 'Recurrente mensual'
    : item.isProjected ? 'Próximo ciclo' : 'Confirmado'

  return (
    <div className="px-4 py-3 flex items-start gap-3">
      <div
        className="w-10 h-10 rounded-xl grid place-items-center text-[19px] shrink-0 border"
        style={{
          borderColor: translucent(category.color, '55'),
          backgroundColor: translucent(category.color, '20'),
        }}
        aria-hidden="true"
      >
        {category.icon || '•'}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold break-words leading-snug">{item.description}</div>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          <span
            className="inline-flex max-w-[9.5rem] items-center rounded-full border px-2 py-0.5 text-[9.5px] font-bold truncate"
            title={category.label}
            style={{
              borderColor: translucent(category.color, '66'),
              backgroundColor: translucent(category.color, '18'),
            }}
          >
            {category.label}
          </span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-semibold ${item.isProjected
            ? 'bg-blue-50 text-blue-700'
            : item.isRecurring
              ? 'bg-violet-50 text-violet-700'
              : 'bg-emerald-50 text-emerald-700'}`}>
            {stateLabel}
          </span>
        </div>
        <InstallmentBadges item={item} />

        <div className="text-[10.5px] text-[var(--muted)] mt-1.5 leading-relaxed">
          {item.isRecurring ? 'Gasto mensual' : item.isProjected ? 'Monto proyectado' : formatDate(item.date) || TYPE_LABELS[item.movementType] || 'Movimiento'}
          {!item.isRecurring && !isInstallment && <> · {TYPE_LABELS[item.movementType] || 'Movimiento'}</>}
          {isInstallment && originalAmount > amount && <> · Compra total {fmtCLP(originalAmount)}</>}
        </div>
      </div>

      <div className="text-right shrink-0">
        <div className="font-mono text-[13px] font-bold">{fmtCLP(amount)}</div>
        <div className="text-[9.5px] text-[var(--muted)] mt-1">
          {isInstallment ? 'valor de esta cuota' : item.isRecurring ? 'monto mensual' : 'monto compartido'}
        </div>
        <div className="text-[10px] font-semibold mt-2">Nicol {fmtCLP(nicolAmount)}</div>
      </div>
    </div>
  )
}

export default function NicolPublicCyclesVisual({ token }) {
  const [state, setState] = useState({ loading: true, data: null, error: '' })
  const [selectedKey, setSelectedKey] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sortBy, setSortBy] = useState('date-desc')

  useEffect(() => {
    if (!supabase) {
      setState({ loading: false, data: null, error: 'Supabase no está configurado.' })
      return undefined
    }

    let cancelled = false
    const cleanToken = String(token || '').trim()
    supabase.rpc('get_nicol_share_cycles', { p_token: cleanToken })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) throw error
        if (!data?.ok) throw new Error(data?.message || 'El enlace no existe o fue desactivado.')
        setState({ loading: false, data, error: '' })
      })
      .catch(error => {
        if (!cancelled) setState({ loading: false, data: null, error: error.message })
      })

    return () => { cancelled = true }
  }, [token])

  const cycles = state.data?.cycles || []

  useEffect(() => {
    if (!cycles.length) return
    if (selectedKey && cycles.some(cycle => cycle.cycleKey === selectedKey)) return
    const current = cycles.find(cycle => cycle.cycleKey === state.data?.currentCycleKey)
    const next = cycles.find(cycle => cycle.cycleKey > (state.data?.currentCycleKey || ''))
    setSelectedKey((current || next || cycles[cycles.length - 1]).cycleKey)
  }, [cycles, selectedKey, state.data?.currentCycleKey])

  const selectedIndex = useMemo(
    () => Math.max(0, cycles.findIndex(cycle => cycle.cycleKey === selectedKey)),
    [cycles, selectedKey],
  )
  const cycle = cycles[selectedIndex] || null
  const percentage = Number(state.data?.percentage || 0)
  const categories = useMemo(() => {
    const unique = new Map()
    for (const item of cycle?.transactions || []) {
      const category = categoryFor(item)
      unique.set(category.id || category.label, category)
    }
    return [...unique.values()].sort((a, b) => a.label.localeCompare(b.label, 'es'))
  }, [cycle])
  const filteredTransactions = useMemo(() => {
    const items = (cycle?.transactions || []).filter(item => !categoryFilter || categoryFor(item).id === categoryFilter)
    return [...items].sort((left, right) => {
      if (sortBy === 'amount-desc') return Number(right.amount || 0) - Number(left.amount || 0)
      if (sortBy === 'amount-asc') return Number(left.amount || 0) - Number(right.amount || 0)
      const leftDate = String(left.date || '')
      const rightDate = String(right.date || '')
      return sortBy === 'date-asc' ? leftDate.localeCompare(rightDate) : rightDate.localeCompare(leftDate)
    })
  }, [categoryFilter, cycle, sortBy])
  const categorySummary = useMemo(
    () => buildCategorySummary(filteredTransactions, percentage),
    [filteredTransactions, percentage],
  )

  const move = direction => {
    const nextIndex = selectedIndex + direction
    if (nextIndex >= 0 && nextIndex < cycles.length) setSelectedKey(cycles[nextIndex].cycleKey)
  }

  if (!isConfigured) return <Message title="Configuración incompleta" text="Esta vista todavía no tiene conexión a Supabase." />
  if (state.loading) return <Message loading title="Cargando gastos compartidos" text="Consultando ciclos, categorías y próximas cuotas…" />
  if (state.error || !state.data) return <Message title="Enlace no disponible" text={state.error || 'El enlace no existe o fue desactivado.'} />

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-5 pb-16">
        {cycles.length > 0 ? (
          <>
            <CycleSelector cycles={cycles} selectedKey={selectedKey} onSelect={setSelectedKey} />
            {cycle && (
              <>
                <CycleSummary
                  cycle={cycle}
                  percentage={percentage}
                  index={selectedIndex}
                  total={cycles.length}
                  onMove={move}
                />

                <CategorySummary rows={categorySummary} />

                <section className="bg-[var(--bg-elev)] border border-[var(--line)] rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--line)] flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] font-bold">Detalle del ciclo</div>
                      <div className="text-[12px] text-[var(--muted)] mt-0.5">
                        {filteredTransactions.length} de {(cycle.transactions || []).length} conceptos compartidos
                      </div>
                    </div>
                    {cycle.isUpcoming && (
                      <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-blue-50 text-blue-700">Estimado</span>
                    )}
                  </div>

                  <TransactionFilters
                    categories={categories}
                    categoryFilter={categoryFilter}
                    onCategoryChange={setCategoryFilter}
                    sortBy={sortBy}
                    onSortChange={setSortBy}
                  />

                  {filteredTransactions.length > 0 ? (
                    <div className="divide-y divide-[var(--line)]">
                      {filteredTransactions.map(item => (
                        <TransactionRow key={item.id} item={item} percentage={percentage} />
                      ))}
                    </div>
                  ) : (
                    <div className="px-5 py-10 text-center">
                      <div className="text-[14px] font-semibold">Sin resultados con este filtro</div>
                      <p className="text-[11.5px] text-[var(--muted)] mt-1">Prueba otra categoría para ver los movimientos compartidos.</p>
                    </div>
                  )}
                </section>

                {cycle.isUpcoming && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-[11px] text-blue-800 leading-relaxed">
                    Las cuotas indicadas con “Este ciclo pagará” y los recurrentes estimados son una proyección. El monto puede cambiar cuando cierre el estado de cuenta.
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <section className="bg-[var(--bg-elev)] border border-[var(--line)] rounded-2xl p-8 text-center">
            <div className="text-[15px] font-semibold">Todavía no hay movimientos compartidos</div>
            <p className="text-[12px] text-[var(--muted)] mt-2">El detalle aparecerá cuando Wladimick marque gastos o recurrentes para Nicol.</p>
          </section>
        )}

        <p className="text-[10.5px] text-[var(--muted)] text-center leading-relaxed px-4">
          Esta página es informativa y de solo lectura. No muestra tarjetas, bancos, identificadores personales ni datos de acceso.
        </p>
      </main>
    </div>
  )
}
