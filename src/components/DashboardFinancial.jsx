import React, { useEffect, useMemo, useState } from 'react'
import { financialHelpFor } from '../lib/financialHelp'
import { Badge, Card, InfoTip } from './ui'
import { Icon, fmtCLP } from '../lib/helpers'
import { CATEGORIES } from '../data'
import { fetchBillingCycles } from '../services/billingCyclesService'
import { fetchMercadoPagoStatus } from '../services/mercadoPagoService'
import { fetchExternalIncomeSources } from '../services/externalIncomeService'
import { fetchPayables } from '../services/recurringService'
import FinancialBrand, { brandForCard, brandMeta } from './FinancialBrand'
import {
  billingCycleAmount,
  dateOnlyCL,
  formatDateCL,
  isCyclePending,
  monthKeyCL,
  monthLabelCL,
  todayDateOnlyCL,
} from '../lib/financialDates'

const FALLBACK_CATEGORY = CATEGORIES.find(category => category.id === 'otros') || {
  id: 'otros', label: 'Otros', icon: '•', color: '#888880',
}
const HEADER_BTN = 'h-9 inline-flex items-center justify-center gap-1.5 px-3 rounded-xl text-[10px] font-semibold transition'

function categoryFor(row) {
  return row.categoryMeta || CATEGORIES.find(category => category.id === row.category) || FALLBACK_CATEGORY
}

function Metric({ label, value, detail, tone = 'default', onClick, info }) {
  const help = info || financialHelpFor(label)
  const toneClass = tone === 'dark'
    ? 'bg-slate-100 text-slate-950 border-slate-200'
    : tone === 'danger'
      ? 'bg-red-50 text-red-800 border-red-100'
      : tone === 'violet'
        ? 'bg-violet-50 text-violet-950 border-violet-100'
        : tone === 'green'
          ? 'bg-emerald-50 text-emerald-950 border-emerald-100'
          : 'bg-[var(--bg-elev)] text-[var(--ink)] border-[var(--line)]'

  const interactiveProps = onClick ? {
    role: 'button',
    tabIndex: 0,
    onClick,
    onKeyDown: event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onClick()
      }
    },
  } : {}

  return (
    <div
      {...interactiveProps}
      className={`rounded-2xl border p-3.5 min-h-[100px] text-left w-full ${toneClass} ${onClick ? 'hover:-translate-y-0.5 transition-transform cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--ink)]/15' : ''}`}
    >
      <div className="flex items-center gap-1.5">
        <div className="text-[9px] uppercase tracking-[0.12em] font-bold opacity-60">{label}</div>
        {help && <InfoTip content={help}/>} 
      </div>
      <div className="font-mono text-[18px] md:text-[21px] font-bold mt-2 tracking-tight leading-tight">{value}</div>
      <div className="text-[9px] opacity-65 mt-1 leading-relaxed">{detail}</div>
    </div>
  )
}

function CashFlowSummary({ available, cards, bills, remaining, onClick }) {
  const commitments = Math.max(0, cards) + Math.max(0, bills)
  const base = Math.max(commitments, 1)
  const cardWidth = Math.round((Math.max(0, cards) / base) * 100)
  const billWidth = Math.max(0, 100 - cardWidth)

  return (
    <button type="button" onClick={onClick} className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-4 text-left w-full hover:bg-[var(--hover)] transition focus:outline-none focus:ring-2 focus:ring-[var(--ink)]/15">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[9px] uppercase tracking-[.12em] text-[var(--muted)] font-bold">Próximos pagos</div>
          <div className="text-[12px] font-semibold mt-0.5">Así se mueve tu dinero disponible</div>
        </div>
        <Icon name="trend" size={16}/>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4 text-[9px]">
        <div><div className="text-[var(--muted)]">Hoy</div><div className="font-mono text-[13px] font-bold mt-1">{fmtCLP(available)}</div></div>
        <div><div className="text-[var(--muted)]">Por pagar</div><div className="font-mono text-[13px] font-bold mt-1">−{fmtCLP(commitments)}</div></div>
        <div><div className="text-[var(--muted)]">Después</div><div className={`font-mono text-[13px] font-bold mt-1 ${remaining < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{fmtCLP(remaining)}</div></div>
      </div>
      {commitments > 0 && <div className="mt-3">
        <div className="h-2 rounded-full overflow-hidden bg-[var(--soft)] flex" aria-label={`Próximos pagos: ${fmtCLP(cards)} en tarjetas y ${fmtCLP(bills)} en cuentas`}>
          {cards > 0 && <span className="bg-violet-400" style={{ width: `${cardWidth}%` }}/>}
          {bills > 0 && <span className="bg-amber-400" style={{ width: `${billWidth}%` }}/>}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[8.5px] text-[var(--muted)]"><span>● Tarjetas {fmtCLP(cards)}</span><span>● Cuentas {fmtCLP(bills)}</span></div>
      </div>}
      <div className="text-[9px] font-semibold mt-3 underline">Abrir proyección</div>
    </button>
  )
}

function CycleRow({ cycle, card }) {
  const amount = billingCycleAmount(cycle)
  const attention = Number(cycle.reviewCount || 0) + Number(cycle.pendingCount || 0)
  const brand = brandForCard(card)
  const meta = brandMeta(brand)

  return (
    <div className="relative grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center px-4 py-3 border-b border-[var(--line)] last:border-b-0 overflow-hidden">
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: meta.accent || meta.bg }}/>
      <FinancialBrand brand={brand} size="md"/>
      <div className="min-w-0">
        <div className="text-[11.5px] font-semibold truncate">{card?.name || meta.label}{card?.lastFour ? ` ···· ${card.lastFour}` : ''}</div>
        <div className="text-[9px] text-[var(--muted)] mt-0.5">Vence {formatDateCL(cycle.dueDate)} · {monthLabelCL(cycle.cycleKey, true)}</div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          <Badge tone={cycle.reportedAmountIsFinal ? 'ok' : 'info'} className="!text-[8px] !px-1.5 !py-0.5">{cycle.reportedAmountIsFinal ? 'Monto final' : 'En curso'}</Badge>
          {attention > 0 && <Badge tone="warn" className="!text-[8px] !px-1.5 !py-0.5">{attention} por revisar</Badge>}
          {cycle.sharedAmount > 0 && <span className="rounded px-1.5 py-0.5 text-[8px] font-semibold bg-violet-50 text-violet-700">Nicol {fmtCLP(cycle.sharedAmount)}</span>}
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-[13px] font-bold">{fmtCLP(amount)}</div>
        <div className="text-[8px] text-[var(--muted)] mt-0.5">{cycle.transactions?.length || 0} movimientos</div>
      </div>
    </div>
  )
}

function SyncRow({ brand, icon, title, value, detail, status, onClick }) {
  const meta = brand ? brandMeta(brand) : null
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center p-3 text-left rounded-xl hover:bg-[var(--hover)] transition"
      style={meta ? { background: `linear-gradient(90deg, ${(meta.accent || meta.bg)}20, transparent 42%)` } : undefined}
    >
      {brand ? <FinancialBrand brand={brand} size="md"/> : <div className="w-9 h-9 rounded-xl bg-[var(--soft)] grid place-items-center"><Icon name={icon} size={16}/></div>}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-semibold truncate">{title}</div>
          <span className={`w-1.5 h-1.5 rounded-full ${status === 'ok' ? 'bg-emerald-500' : status === 'manual' ? 'bg-blue-500' : 'bg-amber-400'}`}/>
        </div>
        <div className="text-[8.5px] text-[var(--muted)] mt-0.5 truncate">{detail}</div>
      </div>
      <div className="font-mono text-[10.5px] font-bold whitespace-nowrap">{value}</div>
    </button>
  )
}

function usd(amount) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(amount || 0))
}

function isReservedPayable(item) {
  const text = `${item?.name || ''} ${item?.personName || item?.person_name || ''} ${item?.notes || ''}`.toLowerCase()
  return text.includes('reserva') || text.includes('papá') || text.includes('papa')
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
  botStatus,
  openChat,
}) {
  const [cycles, setCycles] = useState([])
  const [loadingCycles, setLoadingCycles] = useState(true)
  const [cycleError, setCycleError] = useState('')
  const [mpStatus, setMpStatus] = useState(null)
  const [externalSources, setExternalSources] = useState([])
  const [loadedPayables, setLoadedPayables] = useState([])
  const [syncLoading, setSyncLoading] = useState(true)

  const loadDashboard = async () => {
    setLoadingCycles(true)
    setSyncLoading(true)
    setCycleError('')
    const [cycleResult, mpResult, externalResult, payableResult] = await Promise.allSettled([
      fetchBillingCycles(),
      fetchMercadoPagoStatus(),
      fetchExternalIncomeSources(),
      fetchPayables(),
    ])
    if (cycleResult.status === 'fulfilled') setCycles(cycleResult.value || [])
    else setCycleError(cycleResult.reason?.message || 'No fue posible cargar Facturación.')
    if (mpResult.status === 'fulfilled') setMpStatus(mpResult.value)
    if (externalResult.status === 'fulfilled') setExternalSources(externalResult.value || [])
    if (payableResult.status === 'fulfilled') setLoadedPayables(payableResult.value || [])
    setLoadingCycles(false)
    setSyncLoading(false)
  }

  useEffect(() => { loadDashboard() }, [])

  const today = todayDateOnlyCL()
  const currentMonth = monthKeyCL()
  const cardMap = useMemo(() => new Map(creditCards.map(card => [card.id, card])), [creditCards])

  const activeAccounts = accounts.filter(account => account.active !== false)
  const totalAccountBalance = activeAccounts.reduce((sum, account) => sum + Number(account.balance || 0), 0)
  const payablesData = payables.length ? payables : loadedPayables
  const pendingPayables = payablesData.filter(item => item.status !== 'paid')
  const reservedPayables = pendingPayables.filter(isReservedPayable)
  const upcomingBills = pendingPayables.filter(item => !isReservedPayable(item))
  const reservedCommitments = reservedPayables.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const upcomingBillsTotal = upcomingBills.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const freeBalance = totalAccountBalance - reservedCommitments

  const reserveAccounts = activeAccounts
    .filter(account => account.type === 'ahorro')
    .reduce((sum, account) => sum + Number(account.balance || 0), 0)

  const upcomingCycles = useMemo(() => cycles
    .filter(isCyclePending)
    .filter(cycle => !cycle.dueDate || dateOnlyCL(cycle.dueDate) >= today)
    .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || ''))), [cycles, today])

  const nextCycleMonth = upcomingCycles[0]?.dueDate ? dateOnlyCL(upcomingCycles[0].dueDate).slice(0, 7) : ''
  const nextCycles = upcomingCycles.filter(cycle => cycle.dueDate && dateOnlyCL(cycle.dueDate).slice(0, 7) === nextCycleMonth)
  const nextCardPayment = nextCycles.reduce((sum, cycle) => sum + billingCycleAmount(cycle), 0)
  const nextSharedBase = nextCycles.reduce((sum, cycle) => sum + Number(cycle.sharedAmount || 0), 0)
  const nextDueDetail = nextCycles.length
    ? nextCycles.map(cycle => formatDateCL(cycle.dueDate)).join(' · ')
    : 'Sin vencimientos próximos'

  const directRecurringBase = recurring
    .filter(item => item.active !== false && item.kind === 'expense')
    .filter(item => item.type !== 'credito' && !item.comisionBancaria)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)

  const recurringIncome = income.filter(item => item.active !== false).reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const receivablePending = receivables.filter(item => item.status !== 'paid').reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const freeAfterNearTerm = freeBalance - nextCardPayment - upcomingBillsTotal

  const monthExpenses = expenses.filter(expense => monthKeyCL(expense.date) === currentMonth)
  const monthSpend = monthExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  const monthShared = monthExpenses.filter(expense => expense.sharedWithNicol).reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  const recentExpenses = [...expenses].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 7)
  const totalAttention = cycles.reduce((sum, cycle) => sum + Number(cycle.reviewCount || 0) + Number(cycle.pendingCount || 0), 0)

  const shopify = externalSources.find(item => item.provider === 'shopify_partners') || null
  const mpAvailable = Number(mpStatus?.last_balance || 0)
  const mpReserved = Number(mpStatus?.reserved_partition_balance || 0)
  const mpDetail = mpStatus?.status === 'ok'
    ? `${mpReserved ? `${fmtCLP(mpReserved)} en reservas · ` : ''}${mpStatus?.reviewCount || 0} por revisar`
    : 'Sincronización pendiente'

  const openExternal = query => window.location.assign(`${window.location.pathname}${query}`)

  if (dataState === 'loading') {
    return (
      <div className="flex flex-col gap-4 pb-20" aria-busy="true" aria-label="Cargando posición financiera">
        <div className="space-y-2"><div className="h-3 w-28 rounded bg-[var(--soft)] animate-pulse"/><div className="h-7 w-52 rounded bg-[var(--soft)] animate-pulse"/><div className="h-3 w-full max-w-xl rounded bg-[var(--soft)] animate-pulse"/></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3, 4, 5, 6, 7].map(item => <div key={item} className="h-[100px] rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] animate-pulse"/>)}</div>
        <div className="grid lg:grid-cols-2 gap-4">{[0, 1].map(item => <div key={item} className="h-48 rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] animate-pulse"/>)}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-20">
      {dataState === 'partial' && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] text-amber-800">Algunos datos no pudieron actualizarse. Conservamos lo disponible y evitamos presentar ceros como resultado final.</div>}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <div className="text-[9.5px] uppercase tracking-[0.13em] text-[var(--muted)] font-bold">Tu posición hoy</div>
          <h1 className="text-[21px] md:text-[22px] font-bold tracking-tight mt-1">Dashboard</h1>
          <p className="text-[10px] text-[var(--muted)] mt-1 max-w-2xl">Primero: cuánto puedes usar hoy y qué pagos ya vienen. Los USD de PayPal se mantienen separados hasta retirarlos.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button type="button" onClick={loadDashboard} className={`${HEADER_BTN} min-w-[112px] border border-[var(--line)] bg-[var(--bg-elev)] hover:bg-[var(--hover)]`}><Icon name="refresh" size={12}/>Actualizar</button>
          <button type="button" onClick={() => setView?.('billing')} className={`${HEADER_BTN} min-w-[112px] bg-[var(--ink)] text-[var(--bg)]`}>Facturación</button>
        </div>
      </div>

      {cycleError && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] text-amber-800"><strong>Datos parciales:</strong> {cycleError}</div>}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[9px] text-[var(--muted)]">
        <span className="inline-flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full ${loadingCycles ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`}/>{loadingCycles ? 'Actualizando tarjetas…' : 'Facturación conciliada'}</span>
        <span className="inline-flex items-center gap-2"><span className={`w-1.5 h-1.5 rounded-full ${syncLoading ? 'bg-amber-400 animate-pulse' : mpStatus?.status === 'ok' ? 'bg-emerald-500' : 'bg-amber-400'}`}/>Mercado Pago {mpStatus?.status === 'ok' ? 'sincronizado' : 'por revisar'}</span>
        <span className="inline-flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"/>Shopify / PayPal manual</span>
        {totalAttention > 0 && <span>· {totalAttention} movimientos de tarjeta por revisar</span>}
      </div>

      <div className="grid md:grid-cols-[.8fr_1.2fr] gap-3">
        <Metric label="Dinero disponible hoy" value={fmtCLP(freeBalance)} detail="Saldo total menos reservas comprometidas" tone="dark" onClick={() => setView?.('accounts')}/>
        <CashFlowSummary available={freeBalance} cards={nextCardPayment} bills={upcomingBillsTotal} remaining={freeAfterNearTerm} onClick={() => setView?.('projection')}/>
      </div>

      <details className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] group">
        <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 text-[11px] font-semibold">
          <span>Ver saldos, reservas y compromisos</span>
          <span className="text-[9px] text-[var(--muted)] group-open:hidden">{fmtCLP(totalAccountBalance)} en cuentas</span>
          <span className="text-[13px] text-[var(--muted)] group-open:rotate-45 transition-transform">+</span>
        </summary>
        <div className="border-t border-[var(--line)] p-3 grid grid-cols-2 lg:grid-cols-3 gap-3">
          <Metric label="Saldo total" value={fmtCLP(totalAccountBalance)} detail={`${activeAccounts.length} cuentas · incluye dinero reservado`} onClick={() => setView?.('accounts')}/>
          <Metric label="Reserva real" value={fmtCLP(reservedCommitments)} detail={reservedPayables.length ? reservedPayables.map(item => item.personName || item.person_name || item.name).join(', ') : 'Sin dinero reservado'} tone={reservedCommitments ? 'violet' : 'default'} onClick={() => setView?.('accounts')}/>
          <Metric label="Después de próximos pagos" value={fmtCLP(freeAfterNearTerm)} detail="Tarjetas y cuentas por pagar ya conocidas" tone={freeAfterNearTerm < 0 ? 'danger' : 'green'} onClick={() => setView?.('projection')}/>
          <Metric label="Tarjetas próximas" value={loadingCycles ? '…' : fmtCLP(nextCardPayment)} detail={nextDueDetail} onClick={() => setView?.('billing')}/>
          <Metric label="Cuentas próximas" value={fmtCLP(upcomingBillsTotal)} detail={upcomingBills.length ? upcomingBills.map(item => item.name).join(' · ') : 'Sin cuentas pendientes'} onClick={() => setView?.('recurring')}/>
          <Metric label="Por cobrar" value={fmtCLP(receivablePending)} detail="Préstamos, cuentas compartidas y otros cobros" onClick={() => openExternal('?me-deben=1')}/>
          <Metric label="Ingresos mensuales" value={fmtCLP(recurringIncome)} detail="No incluye Shopify/PayPal ni cobros pendientes" onClick={() => setView?.('recurring')}/>
        </div>
      </details>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
        <Card padding="p-0" className="overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--line)]">
            <div className="text-[9px] uppercase tracking-[.11em] text-[var(--muted)] font-bold">Dinero conectado</div>
            <div className="text-[12px] font-semibold mt-0.5">Sincronizaciones y fuentes externas</div>
          </div>
          <div className="p-1.5">
            <SyncRow brand="mercadopago" title="Mercado Pago" value={syncLoading ? '…' : fmtCLP(mpAvailable)} detail={mpDetail} status={mpStatus?.status === 'ok' ? 'ok' : 'pending'} onClick={() => openExternal('?mercadopago-admin=1')}/>
            <SyncRow brand="paypal" title="Shopify Partners · PayPal" value={shopify ? usd(shopify.current_balance) : '—'} detail={shopify?.next_expected_date ? `Próximo estimado ${formatDateCL(shopify.next_expected_date)} · trimestral` : 'Ingreso externo trimestral'} status="manual" onClick={() => openExternal('?paypal-admin=1')}/>
            <SyncRow brand="receivables" title="Me deben" value={fmtCLP(receivablePending)} detail="Préstamos, cuentas compartidas y cobros pendientes" status={receivablePending > 0 ? 'pending' : 'ok'} onClick={() => openExternal('?me-deben=1')}/>
            <SyncRow brand="accounts" title="Cuentas y reservas" value={fmtCLP(freeBalance)} detail={`${fmtCLP(reservedCommitments)} reservados · ${fmtCLP(reserveAccounts)} en ahorro`} status="ok" onClick={() => setView?.('accounts')}/>
          </div>
        </Card>

        <Card padding="p-0" className="overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--line)] flex items-center justify-between gap-3">
            <div><div className="text-[9px] uppercase tracking-[.11em] text-[var(--muted)] font-bold">Tarjetas</div><div className="text-[12px] font-semibold mt-0.5">Próximos vencimientos</div></div>
            <button type="button" onClick={() => setView?.('billing')} className="text-[9.5px] font-semibold underline">Ver todos</button>
          </div>
          {loadingCycles ? <div className="p-5 space-y-3">{[0, 1].map(item => <div key={item} className="h-14 rounded-xl bg-[var(--soft)] animate-pulse"/>)}</div> : upcomingCycles.length ? <div>{upcomingCycles.slice(0, 4).map(cycle => <CycleRow key={cycle.id} cycle={cycle} card={cardMap.get(cycle.cardId)}/>)}</div> : <div className="px-5 py-9 text-center text-[10px] text-[var(--muted)]">No hay ciclos pendientes con monto.</div>}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_.9fr] gap-4">
        <Card padding="p-0" className="overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--line)] flex items-center justify-between gap-3">
            <div><div className="text-[9px] uppercase tracking-[.11em] text-[var(--muted)] font-bold">Actividad</div><div className="text-[12px] font-semibold mt-0.5">Últimos movimientos</div></div>
            <button type="button" onClick={() => setView?.('expenses')} className="text-[9.5px] font-semibold underline">Ver gastos</button>
          </div>
          {recentExpenses.length ? recentExpenses.map(expense => {
            const category = categoryFor(expense)
            return <div key={expense.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center px-4 py-2.5 border-b border-[var(--line)] last:border-b-0">
              <div className="w-8 h-8 rounded-lg grid place-items-center text-[13px]" style={{ backgroundColor: `${category.color || '#888880'}18` }}>{category.icon}</div>
              <div className="min-w-0"><div className="text-[10.5px] font-semibold truncate">{expense.description}</div><div className="text-[8px] text-[var(--muted)] mt-0.5">{formatDateCL(expense.date)} · {category.label}</div></div>
              <div className="font-mono text-[11px] font-bold">{fmtCLP(expense.amount)}</div>
            </div>
          }) : <div className="px-5 py-9 text-center text-[10px] text-[var(--muted)]">Aún no hay movimientos.</div>}
        </Card>

        <div className="flex flex-col gap-3">
          <Metric label={`Gastado · ${monthLabelCL(currentMonth, true)}`} value={fmtCLP(monthSpend)} detail={`${monthExpenses.length} movimientos registrados`} onClick={() => setView?.('expenses')}/>
          <Metric label="Fijos directos mensuales" value={fmtCLP(directRecurringBase)} detail="Base fuera de tarjetas; agua y luz se muestran como cuentas variables" onClick={() => setView?.('recurring')}/>
          <Metric label="Compartido con Nicol" value={fmtCLP(nextSharedBase || monthShared)} detail={nextSharedBase ? 'Base compartida del próximo vencimiento' : 'Base compartida del mes'} tone="violet" onClick={() => setView?.('billing')}/>
          <Card padding="p-3.5" className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0"><div className={`w-8 h-8 rounded-xl grid place-items-center shrink-0 ${botStatus === 'online' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}><Icon name="bot" size={15}/></div><div className="min-w-0"><div className="text-[11px] font-semibold truncate">Bot de Gastito {botStatus === 'online' ? 'conectado' : 'requiere revisión'}</div><div className="text-[8.5px] text-[var(--muted)] mt-0.5 truncate">Registro rápido para lo que aún no llega por integración.</div></div></div>
            <button type="button" onClick={openChat} className={`${HEADER_BTN} min-w-[76px] border border-[var(--line)] bg-[var(--bg-elev)] hover:bg-[var(--hover)] shrink-0`}>Abrir</button>
          </Card>
        </div>
      </div>
    </div>
  )
}
