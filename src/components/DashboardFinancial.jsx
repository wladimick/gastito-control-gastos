import React, { useEffect, useMemo, useState } from 'react'
import { financialHelpFor } from '../lib/financialHelp'
import { Badge, Card, InfoTip } from './ui'
import { Icon, fmtCLP } from '../lib/helpers'
import { CATEGORIES } from '../data'
import { fetchBillingCycles } from '../services/billingCyclesService'
import { fetchMercadoPagoStatus } from '../services/mercadoPagoService'
import { fetchExternalIncomeSources } from '../services/externalIncomeService'
import {
  billingCycleAmount,
  dateOnlyCL,
  dayOfMonthCL,
  formatDateCL,
  isCyclePending,
  monthKeyCL,
  monthLabelCL,
  todayDateOnlyCL,
} from '../lib/financialDates'

const FALLBACK_CATEGORY = CATEGORIES.find(category => category.id === 'otros') || {
  id: 'otros', label: 'Otros', icon: '•', color: '#888880',
}

function categoryFor(row) {
  return row.categoryMeta || CATEGORIES.find(category => category.id === row.category) || FALLBACK_CATEGORY
}

function Metric({ label, value, detail, tone = 'default', onClick, info }) {
  const help = info || financialHelpFor(label)
  const toneClass = tone === 'dark'
    ? 'bg-[var(--ink)] text-[var(--bg)] border-transparent'
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
      className={`rounded-2xl border p-4 min-h-[112px] text-left w-full ${toneClass} ${onClick ? 'hover:-translate-y-0.5 transition-transform cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--ink)]/15' : ''}`}
    >
      <div className="flex items-center gap-1.5">
        <div className="text-[9.5px] uppercase tracking-[0.12em] font-bold opacity-60">{label}</div>
        {help && <InfoTip content={help}/>} 
      </div>
      <div className="font-mono text-[21px] md:text-[24px] font-bold mt-2 tracking-tight">{value}</div>
      <div className="text-[10px] opacity-65 mt-1 leading-relaxed">{detail}</div>
    </div>
  )
}

function CycleRow({ cycle, card }) {
  const amount = billingCycleAmount(cycle)
  const attention = Number(cycle.reviewCount || 0) + Number(cycle.pendingCount || 0)
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center px-4 py-3.5 border-b border-[var(--line)] last:border-b-0">
      <div className="w-10 h-10 rounded-xl bg-[var(--soft)] grid place-items-center"><Icon name="card" size={17}/></div>
      <div className="min-w-0">
        <div className="text-[12px] font-semibold truncate">{card?.name || 'Tarjeta'}{card?.lastFour ? ` ···· ${card.lastFour}` : ''}</div>
        <div className="text-[9.5px] text-[var(--muted)] mt-0.5">Vence {formatDateCL(cycle.dueDate)} · {monthLabelCL(cycle.cycleKey, true)}</div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          <Badge tone={cycle.reportedAmountIsFinal ? 'ok' : 'info'} className="!text-[8.5px] !px-1.5 !py-0.5">{cycle.reportedAmountIsFinal ? 'Monto final' : 'En curso'}</Badge>
          {attention > 0 && <Badge tone="warn" className="!text-[8.5px] !px-1.5 !py-0.5">{attention} por revisar</Badge>}
          {cycle.sharedAmount > 0 && <span className="rounded px-1.5 py-0.5 text-[8.5px] font-semibold bg-violet-50 text-violet-700">Nicol {fmtCLP(cycle.sharedAmount)} base</span>}
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-[14px] font-bold">{fmtCLP(amount)}</div>
        <div className="text-[8.5px] text-[var(--muted)] mt-0.5">{cycle.transactions?.length || 0} movimientos</div>
      </div>
    </div>
  )
}

function SyncRow({ icon, title, value, detail, status, onClick }) {
  return (
    <button type="button" onClick={onClick} className="w-full grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center p-3.5 text-left rounded-xl hover:bg-[var(--hover)] transition">
      <div className="w-9 h-9 rounded-xl bg-[var(--soft)] grid place-items-center"><Icon name={icon} size={16}/></div>
      <div className="min-w-0">
        <div className="flex items-center gap-2"><div className="text-[11.5px] font-semibold truncate">{title}</div><span className={`w-1.5 h-1.5 rounded-full ${status === 'ok' ? 'bg-emerald-500' : status === 'manual' ? 'bg-blue-500' : 'bg-amber-400'}`}/></div>
        <div className="text-[9px] text-[var(--muted)] mt-0.5 truncate">{detail}</div>
      </div>
      <div className="font-mono text-[11px] font-bold whitespace-nowrap">{value}</div>
    </button>
  )
}

function usd(amount) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(amount || 0))
}

export default function DashboardFinancial({
  expenses = [],
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
  const [syncLoading, setSyncLoading] = useState(true)

  const loadDashboard = async () => {
    setLoadingCycles(true)
    setSyncLoading(true)
    setCycleError('')
    const [cycleResult, mpResult, externalResult] = await Promise.allSettled([
      fetchBillingCycles(),
      fetchMercadoPagoStatus(),
      fetchExternalIncomeSources(),
    ])
    if (cycleResult.status === 'fulfilled') setCycles(cycleResult.value || [])
    else setCycleError(cycleResult.reason?.message || 'No fue posible cargar Facturación.')
    if (mpResult.status === 'fulfilled') setMpStatus(mpResult.value)
    if (externalResult.status === 'fulfilled') setExternalSources(externalResult.value || [])
    setLoadingCycles(false)
    setSyncLoading(false)
  }

  useEffect(() => { loadDashboard() }, [])

  const today = todayDateOnlyCL()
  const currentMonth = monthKeyCL()
  const todayDay = dayOfMonthCL()
  const cardMap = useMemo(() => new Map(creditCards.map(card => [card.id, card])), [creditCards])

  const activeAccounts = accounts.filter(account => account.active !== false)
  const totalAccountBalance = activeAccounts.reduce((sum, account) => sum + Number(account.balance || 0), 0)
  const pendingPayables = payables.filter(item => item.status !== 'paid')
  const reservedCommitments = pendingPayables.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const freeBalance = totalAccountBalance - reservedCommitments

  const reserveAccounts = activeAccounts
    .filter(account => account.type === 'ahorro')
    .reduce((sum, account) => sum + Number(account.balance || 0), 0)

  const upcomingCycles = useMemo(() => cycles
    .filter(isCyclePending)
    .filter(cycle => !cycle.dueDate || dateOnlyCL(cycle.dueDate) >= today)
    .sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || ''))), [cycles, today])

  const nextDueDate = upcomingCycles[0]?.dueDate || ''
  const nextCycles = upcomingCycles.filter(cycle => cycle.dueDate === nextDueDate)
  const nextCardPayment = nextCycles.reduce((sum, cycle) => sum + billingCycleAmount(cycle), 0)
  const nextSharedBase = nextCycles.reduce((sum, cycle) => sum + Number(cycle.sharedAmount || 0), 0)

  const directRecurringPending = recurring
    .filter(item => item.active !== false && item.kind === 'expense')
    .filter(item => item.type !== 'credito' && !item.comisionBancaria)
    .filter(item => Number(item.dayOfMonth || 1) >= todayDay)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0)

  const recurringIncome = income.filter(item => item.active !== false).reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const receivablePending = receivables.filter(item => item.status !== 'paid').reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const freeAfterCommitments = freeBalance - nextCardPayment - directRecurringPending

  const monthExpenses = expenses.filter(expense => monthKeyCL(expense.date) === currentMonth)
  const monthSpend = monthExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  const monthShared = monthExpenses.filter(expense => expense.sharedWithNicol).reduce((sum, expense) => sum + Number(expense.amount || 0), 0)
  const recentExpenses = [...expenses].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 7)
  const totalAttention = cycles.reduce((sum, cycle) => sum + Number(cycle.reviewCount || 0) + Number(cycle.pendingCount || 0), 0)

  const shopify = externalSources.find(item => item.provider === 'shopify_partners') || null
  const mpAvailable = Number(mpStatus?.last_balance || 0)
  const mpReserved = Number(mpStatus?.reserved_partition_balance || 0)
  const mpDetail = mpStatus?.status === 'ok'
    ? `${mpReserved ? `${fmtCLP(mpReserved)} en reserva · ` : ''}${mpStatus?.reviewCount || 0} por revisar`
    : 'Sincronización pendiente'

  const openExternal = query => window.location.assign(`${window.location.pathname}${query}`)

  return (
    <div className="flex flex-col gap-5 pb-20">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.13em] text-[var(--muted)] font-bold">Tu posición hoy</div>
          <h1 className="text-[23px] font-bold tracking-tight mt-1">Dashboard</h1>
          <p className="text-[11px] text-[var(--muted)] mt-1 max-w-2xl">Saldo, reservas, cobros, tarjetas y fuentes sincronizadas en una sola vista. Los ingresos externos en USD se mantienen separados hasta que realmente los retires.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={loadDashboard} className="h-9 px-3 rounded-lg border border-[var(--line)] text-[10.5px] font-semibold hover:bg-[var(--hover)]"><Icon name="refresh" size={13}/> Actualizar todo</button>
          <button type="button" onClick={() => setView?.('billing')} className="h-9 px-3 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-[10.5px] font-semibold">Ver Facturación</button>
        </div>
      </div>

      {cycleError && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] text-amber-800"><strong>Datos parciales:</strong> {cycleError}</div>}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[9.5px] text-[var(--muted)]">
        <span className="inline-flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${loadingCycles ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`}/>{loadingCycles ? 'Actualizando tarjetas…' : 'Facturación conciliada'}</span>
        <span className="inline-flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${syncLoading ? 'bg-amber-400 animate-pulse' : mpStatus?.status === 'ok' ? 'bg-emerald-500' : 'bg-amber-400'}`}/>Mercado Pago {mpStatus?.status === 'ok' ? 'sincronizado' : 'por revisar'}</span>
        <span className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"/>Shopify / PayPal registrado</span>
        {totalAttention > 0 && <span>· {totalAttention} movimientos de tarjeta requieren revisión</span>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Saldo en cuentas" value={fmtCLP(totalAccountBalance)} detail={`${activeAccounts.length} cuentas activas · incluye reservas`} onClick={() => setView?.('accounts')}/>
        <Metric label="Reserva comprometida" value={fmtCLP(reservedCommitments)} detail={pendingPayables.length ? pendingPayables.map(item => item.personName || item.name).join(', ') : 'Sin reservas comprometidas'} tone={reservedCommitments ? 'violet' : 'default'} onClick={() => setView?.('accounts')}/>
        <Metric label="Dinero realmente libre" value={fmtCLP(freeBalance)} detail="Saldo total menos dinero reservado para obligaciones" tone="dark" onClick={() => setView?.('accounts')}/>
        <Metric label="Libre tras próximos pagos" value={fmtCLP(freeAfterCommitments)} detail="Libre menos próxima tarjeta y fijos directos pendientes" tone={freeAfterCommitments < 0 ? 'danger' : 'green'} onClick={() => setView?.('projection')}/>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Próximo pago tarjetas" value={loadingCycles ? '…' : fmtCLP(nextCardPayment)} detail={nextDueDate ? `Vence ${formatDateCL(nextDueDate)}` : 'Sin vencimientos próximos'} onClick={() => setView?.('billing')}/>
        <Metric label={`Gastado · ${monthLabelCL(currentMonth, true)}`} value={fmtCLP(monthSpend)} detail={`${monthExpenses.length} movimientos registrados`} onClick={() => setView?.('expenses')}/>
        <Metric label="Por cobrar" value={fmtCLP(receivablePending)} detail="Préstamos, cuentas compartidas y otros cobros" onClick={() => openExternal('?me-deben=1')}/>
        <Metric label="Ingresos mensuales" value={fmtCLP(recurringIncome)} detail="No incluye Shopify/PayPal ni cobros pendientes" onClick={() => setView?.('recurring')}/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
        <Card padding="p-0" className="overflow-hidden">
          <div className="px-4 py-3.5 border-b border-[var(--line)]">
            <div className="text-[9.5px] uppercase tracking-[.11em] text-[var(--muted)] font-bold">Dinero conectado</div>
            <div className="text-[13px] font-semibold mt-0.5">Sincronizaciones y fuentes externas</div>
          </div>
          <div className="p-1.5">
            <SyncRow icon="cash" title="Mercado Pago" value={syncLoading ? '…' : fmtCLP(mpAvailable)} detail={mpDetail} status={mpStatus?.status === 'ok' ? 'ok' : 'pending'} onClick={() => openExternal('?mercadopago-admin=1')}/>
            <SyncRow icon="cash" title="Shopify Partners · PayPal" value={shopify ? usd(shopify.current_balance) : '—'} detail={shopify?.next_expected_date ? `Próximo estimado ${formatDateCL(shopify.next_expected_date)} · trimestral` : 'Ingreso externo trimestral'} status="manual" onClick={() => openExternal('?paypal-admin=1')}/>
            <SyncRow icon="users" title="Me deben" value={fmtCLP(receivablePending)} detail="Boris, Diever, Nicol y otros cobros pendientes" status={receivablePending > 0 ? 'pending' : 'ok'} onClick={() => openExternal('?me-deben=1')}/>
            <SyncRow icon="wallet" title="Cuentas y reservas" value={fmtCLP(freeBalance)} detail={`${fmtCLP(reservedCommitments)} comprometidos · ${fmtCLP(reserveAccounts)} en cuentas de ahorro`} status="ok" onClick={() => setView?.('accounts')}/>
          </div>
        </Card>

        <Card padding="p-0" className="overflow-hidden">
          <div className="px-4 py-3.5 border-b border-[var(--line)] flex items-center justify-between gap-3">
            <div><div className="text-[9.5px] uppercase tracking-[.11em] text-[var(--muted)] font-bold">Tarjetas</div><div className="text-[13px] font-semibold mt-0.5">Próximos vencimientos reales</div></div>
            <button type="button" onClick={() => setView?.('billing')} className="text-[10px] font-semibold underline">Ver todos</button>
          </div>
          {loadingCycles ? <div className="p-5 space-y-3">{[0, 1].map(item => <div key={item} className="h-14 rounded-xl bg-[var(--soft)] animate-pulse"/>)}</div> : upcomingCycles.length ? <div>{upcomingCycles.slice(0, 4).map(cycle => <CycleRow key={cycle.id} cycle={cycle} card={cardMap.get(cycle.cardId)}/>)}</div> : <div className="px-5 py-10 text-center text-[11px] text-[var(--muted)]">No hay ciclos pendientes con monto.</div>}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_.9fr] gap-4">
        <Card padding="p-0" className="overflow-hidden">
          <div className="px-4 py-3.5 border-b border-[var(--line)] flex items-center justify-between gap-3">
            <div><div className="text-[9.5px] uppercase tracking-[.11em] text-[var(--muted)] font-bold">Actividad</div><div className="text-[13px] font-semibold mt-0.5">Últimos movimientos</div></div>
            <button type="button" onClick={() => setView?.('expenses')} className="text-[10px] font-semibold underline">Ver Gastos</button>
          </div>
          {recentExpenses.length ? recentExpenses.map(expense => {
            const category = categoryFor(expense)
            return <div key={expense.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center px-4 py-3 border-b border-[var(--line)] last:border-b-0">
              <div className="w-8 h-8 rounded-lg grid place-items-center text-[14px]" style={{ backgroundColor: `${category.color || '#888880'}18` }}>{category.icon}</div>
              <div className="min-w-0"><div className="text-[11px] font-semibold truncate">{expense.description}</div><div className="text-[8.5px] text-[var(--muted)] mt-0.5">{formatDateCL(expense.date)} · {category.label}</div></div>
              <div className="font-mono text-[11.5px] font-bold">{fmtCLP(expense.amount)}</div>
            </div>
          }) : <div className="px-5 py-10 text-center text-[11px] text-[var(--muted)]">Aún no hay movimientos.</div>}
        </Card>

        <div className="flex flex-col gap-3">
          <Metric label="Fijos directos pendientes" value={fmtCLP(directRecurringPending)} detail="No incluye cargos que llegarán dentro de una tarjeta" onClick={() => setView?.('recurring')}/>
          <Metric label="Compartido con Nicol" value={fmtCLP(nextSharedBase || monthShared)} detail={nextSharedBase ? 'Base compartida del próximo vencimiento' : 'Base compartida del mes'} tone="violet" onClick={() => setView?.('billing')}/>
          <Card padding="p-4" className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3"><div className={`w-9 h-9 rounded-xl grid place-items-center ${botStatus === 'online' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}><Icon name="bot" size={16}/></div><div><div className="text-[12px] font-semibold">Bot de Gastito {botStatus === 'online' ? 'conectado' : 'requiere revisión'}</div><div className="text-[9.5px] text-[var(--muted)] mt-0.5">Registro rápido para movimientos que todavía no llegan por una integración.</div></div></div>
            <button type="button" onClick={openChat} className="h-9 px-3 rounded-lg border border-[var(--line)] text-[10px] font-semibold hover:bg-[var(--hover)] shrink-0">Abrir</button>
          </Card>
        </div>
      </div>
    </div>
  )
}
