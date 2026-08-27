import React, { useEffect, useMemo, useState } from 'react'
import { Card } from './ui'
import { Icon, fmtCLP } from '../lib/helpers'
import { CATEGORIES } from '../data'
import { fetchBillingCycles } from '../services/billingCyclesService'
import { fetchMercadoPagoStatus } from '../services/mercadoPagoService'
import { fetchPayables } from '../services/recurringService'
import {
  billingCycleAmount,
  dateOnlyCL,
  formatDateCL,
  monthKeyCL,
  monthLabelCL,
  todayDateOnlyCL,
} from '../lib/financialDates'

const FALLBACK_CATEGORY = CATEGORIES.find(category => category.id === 'otros') || {
  id: 'otros', label: 'Otros', icon: '•', color: '#888880',
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    hour12: false,
    timeZone: 'America/Santiago',
  }).format(new Date()).split(':')[0])
  if (hour < 12) return 'Buenos días'
  if (hour < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function daysBetween(from, to) {
  const a = new Date(`${from}T12:00:00Z`).getTime()
  const b = new Date(`${to}T12:00:00Z`).getTime()
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

function dateParts(value) {
  const date = dateOnlyCL(value)
  if (!date) return { day: '—', month: 'S/F' }
  const parsed = new Date(`${date}T12:00:00Z`)
  return {
    day: new Intl.DateTimeFormat('es-CL', { day: '2-digit', timeZone: 'UTC' }).format(parsed),
    month: new Intl.DateTimeFormat('es-CL', { month: 'short', timeZone: 'UTC' })
      .format(parsed).replace('.', '').toUpperCase(),
  }
}

function MoneyCard({ label, value, detail, tone = 'violet', onClick }) {
  const tones = {
    violet: 'bg-gradient-to-br from-violet-700 to-violet-600 text-white border-violet-600',
    amber: 'bg-gradient-to-br from-amber-700 to-amber-600 text-white border-amber-600',
    green: 'bg-emerald-50 text-emerald-900 border-emerald-100',
    red: 'bg-red-50 text-red-900 border-red-100',
    neutral: 'bg-[var(--bg-elev)] text-[var(--ink)] border-[var(--line)]',
  }
  const Element = onClick ? 'button' : 'div'
  return (
    <Element
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-3xl border p-4 md:p-5 min-h-[132px] text-left w-full ${tones[tone]} ${onClick ? 'active:scale-[.99] transition' : ''}`}
    >
      <div className="text-[9.5px] uppercase tracking-[.18em] font-bold opacity-70">{label}</div>
      <div className="font-mono text-[23px] md:text-[28px] font-bold mt-3 tracking-tight leading-none">{value}</div>
      <div className="text-[9.5px] md:text-[10px] opacity-75 mt-3 leading-relaxed">{detail}</div>
    </Element>
  )
}

function DateBadge({ date, overdue, today }) {
  const parts = dateParts(date)
  const tone = overdue
    ? 'bg-red-100 text-red-700'
    : today
      ? 'bg-amber-100 text-amber-800'
      : 'bg-[var(--soft)] text-[var(--ink)]'
  return (
    <div className={`w-12 h-12 rounded-2xl grid place-items-center shrink-0 ${tone}`}>
      <div className="text-center leading-none">
        <div className="font-mono text-[16px] font-bold">{parts.day}</div>
        <div className="text-[8px] font-bold tracking-[.08em] mt-1">{parts.month}</div>
      </div>
    </div>
  )
}

function TimelineRow({ event, today }) {
  const overdue = Boolean(event.date && event.date < today)
  const isToday = event.date === today
  const lateDays = overdue ? daysBetween(event.date, today) : 0
  const statusText = overdue
    ? `${lateDays} día${lateDays === 1 ? '' : 's'} de atraso`
    : isToday
      ? 'Vence hoy'
      : event.date
        ? `Vence ${formatDateCL(event.date)}`
        : 'Sin fecha acordada'
  const directionClass = event.direction === 'in' ? 'text-emerald-700' : 'text-red-700'
  const railClass = event.direction === 'in' ? 'bg-emerald-500' : 'bg-red-500'

  return (
    <button
      type="button"
      onClick={event.onClick}
      className="relative w-full grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center px-1 py-3 text-left border-b border-[var(--line)] last:border-b-0 active:bg-[var(--hover)] rounded-xl"
    >
      <span className={`absolute left-0 top-4 bottom-4 w-[3px] rounded-full ${railClass}`}/>
      <div className="pl-2"><DateBadge date={event.date} overdue={overdue} today={isToday}/></div>
      <div className="min-w-0">
        <div className="text-[12.5px] font-bold truncate">{event.title}</div>
        <div className={`text-[9.5px] mt-0.5 truncate ${overdue ? 'text-red-700 font-semibold' : 'text-[var(--muted)]'}`}>
          {statusText}{event.detail ? ` · ${event.detail}` : ''}
        </div>
      </div>
      <div className={`font-mono text-[13px] md:text-[14px] font-bold whitespace-nowrap ${directionClass}`}>
        {event.direction === 'in' ? '+' : '−'}{fmtCLP(event.amount)}
      </div>
    </button>
  )
}

function TimelineSection({ title, events, today }) {
  if (!events.length) return null
  const incoming = events.filter(event => event.direction === 'in').reduce((sum, event) => sum + Number(event.amount || 0), 0)
  const outgoing = events.filter(event => event.direction === 'out').reduce((sum, event) => sum + Number(event.amount || 0), 0)
  return (
    <section>
      <div className="flex items-center justify-between gap-3 py-2 border-b border-[var(--line)]">
        <div className={`text-[10px] uppercase tracking-[.14em] font-bold ${title === 'Atrasado' ? 'text-red-700' : 'text-[var(--muted)]'}`}>{title}</div>
        <div className="flex items-center gap-3 font-mono text-[10.5px] font-bold">
          {incoming > 0 && <span className="text-emerald-700">+{fmtCLP(incoming)}</span>}
          {outgoing > 0 && <span className="text-red-700">−{fmtCLP(outgoing)}</span>}
        </div>
      </div>
      <div>{events.map(event => <TimelineRow key={event.key} event={event} today={today}/>)}</div>
    </section>
  )
}

function ExpenseMiniRow({ expense }) {
  const category = expense.categoryMeta || CATEGORIES.find(item => item.id === expense.category) || FALLBACK_CATEGORY
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center py-2.5 border-b border-[var(--line)] last:border-b-0">
      <div className="w-8 h-8 rounded-xl grid place-items-center text-[14px]" style={{ backgroundColor: `${category.color || '#888880'}18` }}>
        {category.icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10.5px] font-semibold truncate">{expense.description}</div>
        <div className="text-[8.5px] text-[var(--muted)] mt-0.5">{formatDateCL(expense.date)} · {category.label}</div>
      </div>
      <div className="font-mono text-[11px] font-bold">{fmtCLP(expense.amount)}</div>
    </div>
  )
}

export default function DashboardFinancial({
  expenses = [],
  dataState = 'ready',
  setView,
  recurring = [],
  income = [],
  receivables = [],
  payables = [],
  accounts = [],
  creditCards = [],
}) {
  const [cycles, setCycles] = useState([])
  const [loadedPayables, setLoadedPayables] = useState([])
  const [mpStatus, setMpStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const loadDashboard = async () => {
    setLoading(true)
    setLoadError('')
    const [cycleResult, payableResult, mpResult] = await Promise.allSettled([
      fetchBillingCycles(),
      fetchPayables(),
      fetchMercadoPagoStatus(),
    ])
    if (cycleResult.status === 'fulfilled') setCycles(cycleResult.value || [])
    else setLoadError(cycleResult.reason?.message || 'No fue posible actualizar Facturación.')
    if (payableResult.status === 'fulfilled') setLoadedPayables(payableResult.value || [])
    if (mpResult.status === 'fulfilled') setMpStatus(mpResult.value || null)
    setLoading(false)
  }

  useEffect(() => { loadDashboard() }, [])

  const today = todayDateOnlyCL()
  const currentMonth = monthKeyCL()
  const payablesData = payables.length ? payables : loadedPayables
  const pendingReceivables = receivables.filter(item => item.status !== 'paid')
  const pendingPayables = payablesData.filter(item => item.status !== 'paid')
  const receivableTotal = pendingReceivables.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const payableTotal = pendingPayables.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const netPosition = receivableTotal - payableTotal
  const overdueReceivables = pendingReceivables.filter(item => item.dueDate && dateOnlyCL(item.dueDate) < today)
  const overduePayables = pendingPayables.filter(item => item.dueDate && dateOnlyCL(item.dueDate) < today)
  const overdueReceivableTotal = overdueReceivables.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const overduePayableTotal = overduePayables.reduce((sum, item) => sum + Number(item.amount || 0), 0)

  const activeAccounts = accounts.filter(account => account.active !== false)
  const totalAccountBalance = activeAccounts.reduce((sum, account) => sum + Number(account.balance || 0), 0)
  const monthExpenses = expenses.filter(expense => monthKeyCL(expense.date) === currentMonth)
  const monthSpend = monthExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  const recurringIncome = income.filter(item => item.active !== false).reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const recurringExpense = recurring
    .filter(item => item.active !== false && item.kind === 'expense')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const recentExpenses = [...expenses]
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
    .slice(0, 5)

  const cardMap = useMemo(() => new Map(creditCards.map(card => [card.id, card])), [creditCards])
  const pendingCycles = cycles
    .filter(cycle => Number(billingCycleAmount(cycle)) > 0)
    .filter(cycle => !cycle.dueDate || dateOnlyCL(cycle.dueDate) >= today)
    .sort((a, b) => String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999')))
  const nextCardTotal = pendingCycles.slice(0, 3).reduce((sum, cycle) => sum + Number(billingCycleAmount(cycle) || 0), 0)

  const openExternal = query => window.location.assign(`${window.location.pathname}${query}`)

  const timeline = useMemo(() => {
    const receivableEvents = pendingReceivables.map(item => ({
      key: `r-${item.id}`,
      direction: 'in',
      date: dateOnlyCL(item.dueDate),
      amount: Number(item.amount || 0),
      title: item.personName || item.name || 'Por cobrar',
      detail: item.personName && item.name && item.personName !== item.name ? item.name : 'Me deben',
      onClick: () => openExternal('?me-deben=1'),
    }))
    const payableEvents = pendingPayables.map(item => ({
      key: `p-${item.id}`,
      direction: 'out',
      date: dateOnlyCL(item.dueDate),
      amount: Number(item.amount || 0),
      title: item.personName || item.name || 'Por pagar',
      detail: item.personName && item.name && item.personName !== item.name ? item.name : 'Yo debo',
      onClick: () => setView?.('recurring'),
    }))
    const cycleEvents = pendingCycles.slice(0, 4).map(cycle => {
      const card = cardMap.get(cycle.cardId)
      return {
        key: `c-${cycle.id}`,
        direction: 'out',
        date: dateOnlyCL(cycle.dueDate),
        amount: Number(billingCycleAmount(cycle) || 0),
        title: card?.name || 'Tarjeta de crédito',
        detail: 'Facturación',
        onClick: () => setView?.('billing'),
      }
    })
    return [...receivableEvents, ...payableEvents, ...cycleEvents]
      .sort((a, b) => {
        if (!a.date && !b.date) return a.title.localeCompare(b.title, 'es')
        if (!a.date) return 1
        if (!b.date) return -1
        return a.date.localeCompare(b.date)
      })
  }, [pendingReceivables, pendingPayables, pendingCycles, cardMap, setView])

  const sections = {
    overdue: timeline.filter(event => event.date && event.date < today),
    today: timeline.filter(event => event.date === today),
    upcoming: timeline.filter(event => event.date && event.date > today).slice(0, 12),
    undated: timeline.filter(event => !event.date),
  }

  if (dataState === 'loading') {
    return (
      <div className="flex flex-col gap-4 pb-20" aria-busy="true">
        <div className="h-24 rounded-3xl bg-[var(--soft)] animate-pulse"/>
        <div className="grid grid-cols-2 gap-3"><div className="h-32 rounded-3xl bg-[var(--soft)] animate-pulse"/><div className="h-32 rounded-3xl bg-[var(--soft)] animate-pulse"/></div>
        <div className="h-24 rounded-3xl bg-[var(--soft)] animate-pulse"/>
        <div className="h-80 rounded-3xl bg-[var(--soft)] animate-pulse"/>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-5 pb-20">
      <header className="rounded-3xl border border-violet-100 bg-gradient-to-br from-violet-50 via-fuchsia-50/60 to-rose-50 p-5 md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[9.5px] uppercase tracking-[.15em] font-bold text-violet-500">Gastito</div>
            <h1 className="text-[25px] md:text-[28px] font-bold tracking-tight mt-1">{greeting()}</h1>
            <p className="text-[10.5px] text-[var(--muted)] mt-1">Lo que te deben, lo que debes y qué se mueve primero.</p>
          </div>
          <button type="button" onClick={loadDashboard} disabled={loading}
            className="w-10 h-10 rounded-2xl border border-white/80 bg-white/70 grid place-items-center disabled:opacity-50">
            <Icon name="refresh" size={14}/>
          </button>
        </div>
      </header>

      {(dataState === 'partial' || loadError) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] text-amber-800">
          Algunos datos pueden estar parciales. {loadError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <MoneyCard
          label="Me deben"
          value={fmtCLP(receivableTotal)}
          detail={`${pendingReceivables.length} deuda${pendingReceivables.length === 1 ? '' : 's'}${overdueReceivableTotal ? ` · ${fmtCLP(overdueReceivableTotal)} atrasado` : ''}`}
          tone="violet"
          onClick={() => openExternal('?me-deben=1')}
        />
        <MoneyCard
          label="Yo debo"
          value={fmtCLP(payableTotal)}
          detail={`${pendingPayables.length} deuda${pendingPayables.length === 1 ? '' : 's'}${overduePayableTotal ? ` · ${fmtCLP(overduePayableTotal)} atrasado` : ''}`}
          tone="amber"
          onClick={() => setView?.('recurring')}
        />
      </div>

      <MoneyCard
        label={netPosition >= 0 ? 'A tu favor' : 'Por cubrir'}
        value={fmtCLP(Math.abs(netPosition))}
        detail={netPosition >= 0 ? 'Es lo que queda si todos pagan y tú pagas todo.' : 'Es lo que faltaría si hoy se saldara todo.'}
        tone={netPosition >= 0 ? 'green' : 'red'}
      />

      <Card padding="p-4 md:p-5" className="rounded-3xl">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            <div className="text-[10px] uppercase tracking-[.14em] text-[var(--muted)] font-bold">Agenda de plata</div>
            <h2 className="text-[18px] md:text-[20px] font-bold mt-1">Qué se mueve y cuándo</h2>
          </div>
          <button type="button" onClick={() => setView?.('projection')} className="text-[9.5px] font-semibold underline">Proyección</button>
        </div>

        {timeline.length ? (
          <div className="space-y-3">
            <TimelineSection title="Atrasado" events={sections.overdue} today={today}/>
            <TimelineSection title="Hoy" events={sections.today} today={today}/>
            <TimelineSection title="Próximos" events={sections.upcoming} today={today}/>
            <TimelineSection title="Sin fecha" events={sections.undated} today={today}/>
          </div>
        ) : (
          <div className="py-10 text-center text-[10.5px] text-[var(--muted)]">No hay cobros ni pagos pendientes.</div>
        )}
      </Card>

      <details className="rounded-3xl border border-[var(--line)] bg-[var(--bg-elev)] group">
        <summary className="list-none cursor-pointer px-4 py-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11.5px] font-bold">Más detalle</div>
            <div className="text-[9px] text-[var(--muted)] mt-0.5">Saldos, tarjetas y actividad del mes</div>
          </div>
          <span className="text-[18px] text-[var(--muted)] group-open:rotate-45 transition-transform">+</span>
        </summary>
        <div className="border-t border-[var(--line)] p-3 md:p-4">
          <div className="grid grid-cols-2 gap-2.5">
            <button type="button" onClick={() => setView?.('accounts')} className="rounded-2xl bg-[var(--soft)] p-3 text-left">
              <div className="text-[8.5px] uppercase tracking-wider text-[var(--muted)] font-bold">En cuentas</div>
              <div className="font-mono text-[14px] font-bold mt-1.5">{fmtCLP(totalAccountBalance)}</div>
            </button>
            <button type="button" onClick={() => setView?.('billing')} className="rounded-2xl bg-[var(--soft)] p-3 text-left">
              <div className="text-[8.5px] uppercase tracking-wider text-[var(--muted)] font-bold">Tarjetas próximas</div>
              <div className="font-mono text-[14px] font-bold mt-1.5">{loading ? '…' : fmtCLP(nextCardTotal)}</div>
            </button>
            <button type="button" onClick={() => setView?.('expenses')} className="rounded-2xl bg-[var(--soft)] p-3 text-left">
              <div className="text-[8.5px] uppercase tracking-wider text-[var(--muted)] font-bold">Gastado · {monthLabelCL(currentMonth, true)}</div>
              <div className="font-mono text-[14px] font-bold mt-1.5">{fmtCLP(monthSpend)}</div>
            </button>
            <button type="button" onClick={() => setView?.('recurring')} className="rounded-2xl bg-[var(--soft)] p-3 text-left">
              <div className="text-[8.5px] uppercase tracking-wider text-[var(--muted)] font-bold">Fijos mensuales</div>
              <div className="font-mono text-[14px] font-bold mt-1.5">{fmtCLP(recurringExpense)}</div>
            </button>
          </div>

          <div className="mt-3 rounded-2xl border border-[var(--line)] px-3.5">
            <div className="flex items-center justify-between py-3 border-b border-[var(--line)]">
              <span className="text-[10px] text-[var(--muted)]">Ingresos recurrentes</span>
              <span className="font-mono text-[11px] font-bold">{fmtCLP(recurringIncome)}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-[10px] text-[var(--muted)]">Mercado Pago</span>
              <span className="font-mono text-[11px] font-bold">{mpStatus?.status === 'ok' ? fmtCLP(mpStatus?.last_balance || 0) : 'Por revisar'}</span>
            </div>
          </div>

          {recentExpenses.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between gap-3 mb-1">
                <div className="text-[10px] uppercase tracking-[.12em] text-[var(--muted)] font-bold">Últimos gastos</div>
                <button type="button" onClick={() => setView?.('expenses')} className="text-[9px] font-semibold underline">Ver todos</button>
              </div>
              {recentExpenses.map(expense => <ExpenseMiniRow key={expense.id} expense={expense}/>)}
            </div>
          )}
        </div>
      </details>
    </div>
  )
}
