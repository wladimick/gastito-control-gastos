import React, { useMemo } from 'react'
import { Card, StatCard, Badge, BarRow } from './ui'
import { Icon, fmtCLP, fmtCLPshort, relDate, timeOnly, MES } from '../lib/helpers'
import { CATEGORIES } from '../data'
import { useBanks } from '../services/banksService'

const DASH_CC_KEY = 'gastito_cc_v1'
const loadCCStatements = () => { try { return JSON.parse(localStorage.getItem(DASH_CC_KEY) || '[]') } catch { return [] } }

function nextOccurrence(day, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), day)
  if (d <= from) return new Date(from.getFullYear(), from.getMonth() + 1, day)
  return d
}

function daysUntil(target, from = new Date()) {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  return Math.round((b - a) / 86400000)
}

function monthDiff(startStr, endStr) {
  const [sy, sm] = startStr.split('-').map(Number)
  const [ey, em] = endStr.split('-').map(Number)
  return (ey - sy) * 12 + (em - sm)
}

function payLabel(e) {
  if (e.method === 'efectivo') return 'Efectivo'
  if (e.type === 'credito') return 'Crédito'
  if (e.method === 'transfer') return 'Transferencia'
  return 'Débito'
}

function SectionHeader({ title, sub, action, onAction }) {
  return (
    <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between gap-3 flex-wrap">
      <div>
        <div className="font-semibold tracking-tight">{title}</div>
        {sub && <div className="text-[12px] text-[var(--muted)] mt-0.5">{sub}</div>}
      </div>
      {action && (
        <button onClick={onAction} className="text-[12px] text-[var(--ink-2)] hover:underline inline-flex items-center gap-1">
          {action} <Icon name="chevron" size={12}/>
        </button>
      )}
    </div>
  )
}

export default function Dashboard({
  expenses = [], setView, openChat, botStatus, lastBotMessage,
  installmentDebts = [], recurring = [], accounts = [], creditCards = [],
  income = [], receivables = [],
  userSettings = null,
}) {
  const banks = useBanks()
  const today = new Date()
  const AUTO_PAY_DAY = 5
  const ccStatements = useMemo(() => loadCCStatements(), [])

  // ── Monthly ──────────────────────────────────────────────────────────────
  const thisMonth = expenses.filter(e => {
    const d = new Date(e.date)
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  })
  const total = thisMonth.reduce((s, e) => s + (e.amount || 0), 0)
  const avg   = thisMonth.length ? total / thisMonth.length : 0

  const prevM = today.getMonth() === 0 ? 11 : today.getMonth() - 1
  const prevY = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear()
  const lastMonthTotal = expenses.filter(e => {
    const d = new Date(e.date)
    return d.getMonth() === prevM && d.getFullYear() === prevY
  }).reduce((s, e) => s + (e.amount || 0), 0)
  const delta    = lastMonthTotal ? ((total - lastMonthTotal) / lastMonthTotal) * 100 : 0
  const deltaStr = lastMonthTotal ? (delta > 0 ? '+' : '') + delta.toFixed(0) + '%' : null

  // ── Installments ─────────────────────────────────────────────────────────
  const activeDebts        = installmentDebts.filter(d => d.status === 'active')
  const cuotasThisMonth    = activeDebts.reduce((s, d) => s + (d.monthlyAmount || 0), 0)
  const cuotasNextMonth    = activeDebts.filter(d => d.paid + 1 < d.installments).reduce((s, d) => s + (d.monthlyAmount || 0), 0)
  const totalRemainingDebt = activeDebts.reduce((s, d) => s + (d.monthlyAmount || 0) * (d.installments - d.paid), 0)
  const alreadyCharged     = today.getDate() >= AUTO_PAY_DAY
  const nextChargeDate     = alreadyCharged
    ? new Date(today.getFullYear(), today.getMonth() + 1, AUTO_PAY_DAY)
    : new Date(today.getFullYear(), today.getMonth(), AUTO_PAY_DAY)
  const daysToCharge = Math.round((nextChargeDate - new Date(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000)

  // ── Cashflow ──────────────────────────────────────────────────────────────
  const activeAccounts = accounts.filter(a => a.active)
  const totalAvailable = activeAccounts.reduce((s, a) => s + (a.balance || 0), 0)
  const pendingPayables = (recurring ?? []).filter(r => r.active && r.kind === 'payable' && r.status !== 'paid')
  const pendingPayableTotal = pendingPayables.reduce((s, r) => s + (r.amount || 0), 0)
  const usableBalance = totalAvailable - pendingPayableTotal
  const recurringTotal = (recurring ?? []).filter(r => r.active && r.kind === 'expense')
    .reduce((s, r) => s + (r.amount || 0), 0)
  const recurringIncomeItems = (income ?? []).filter(r => r.active !== false)
  const recurringIncomeTotal = recurringIncomeItems.reduce((s, r) => s + (r.amount || 0), 0)
  const punctualIncomeItems = (receivables ?? []).filter(r => r.status !== 'paid')
  const punctualIncomeTotal = punctualIncomeItems.reduce((s, r) => s + (r.amount || 0), 0)
  const monthlyIncome = recurringIncomeTotal + punctualIncomeTotal

  // ── Per-card next payment ─────────────────────────────────────────────────
  const cardNextPayments = creditCards.filter(c => c.isActive !== false).map(card => {
    const bd = Number(card.billingDay ?? 20)
    const pd = Number(card.paymentDueDay ?? 5)

    // Next payment date
    let npMonth = today.getMonth()
    let npYear  = today.getFullYear()
    if (today.getDate() >= pd) {
      npMonth++
      if (npMonth > 11) { npMonth = 0; npYear++ }
    }
    const nextPayDate     = new Date(npYear, npMonth, pd)
    const nextPayMonthStr = `${npYear}-${String(npMonth + 1).padStart(2, '0')}`

    // Billing cycle for that payment (month before the pay month)
    let bmMonth = npMonth - 1; let bmYear = npYear
    if (bmMonth < 0) { bmMonth = 11; bmYear-- }
    const cycleEnd = new Date(bmYear, bmMonth, bd)
    let csMonth = bmMonth - 1; let csYear = bmYear
    if (csMonth < 0) { csMonth = 11; csYear-- }
    const cycleStart = new Date(csYear, csMonth, bd + 1)

    // Contado expenses in the billing cycle (not installment purchases)
    const contadoAmount = expenses
      .filter(e => {
        if (e.type !== 'credito') return false
        if (card.bank && e.bank !== card.bank) return false
        if ((e.installments ?? 1) > 1) return false
        const d = new Date(e.date)
        return d >= cycleStart && d <= cycleEnd
      })
      .reduce((s, e) => s + (e.amount || 0), 0)

    // Installment monthly amounts due in next payment month for this card
    const cardCuotas = activeDebts.filter(d => {
      if (card.bank && d.bank !== card.bank) return false
      if (!d.startMonth) return false
      const elapsed = monthDiff(d.startMonth, nextPayMonthStr)
      return elapsed >= 0 && elapsed < d.installments
    })
    const cuotasAmount = cardCuotas.reduce((s, d) => s + (d.monthlyAmount || 0), 0)
    const cuotasCount  = cardCuotas.length

    // Cargos variables from CC statements (facturaciones tarjeta)
    const cardStatements = ccStatements.filter(s =>
      s.status !== 'paid' &&
      (s.bankId === card.bank) &&
      ((s.month || s.dueDate?.slice(0, 7)) === nextPayMonthStr)
    )
    const cargosComisiones = cardStatements.reduce((s, st) => s + (st.cargosComisiones || 0), 0)

    // Comisiones recurrentes asociadas a esta tarjeta (informativo — ya están en recurringTotal)
    const comisionesRec = recurring.filter(r =>
      r.comisionBancaria && r.active !== false &&
      r.bank === card.bank &&
      (r.medio === 'tc_credito' || !r.medio)
    )
    const comisionesRecurrentes = comisionesRec.reduce((s, r) => s + (r.amount || 0), 0)

    const totalAmount = contadoAmount + cuotasAmount + cargosComisiones

    console.log('[cardTotals]', {
      bank:                 card.bank,
      tarjeta:              card.name,
      contado:              contadoAmount,
      cuotasMes:            cuotasAmount,
      cargosVariables:      cargosComisiones,
      comisionesRecurrentes,
      totalParaSaldo:       totalAmount,
      totalVisual:          totalAmount + comisionesRecurrentes,
    })
    comisionesRec.forEach(r => console.log('[recurringCommission]', { id: r.id, name: r.name, bank: r.bank, medio: r.medio, amount: r.amount }))

    return { card, nextPayDate, contadoAmount, cuotasAmount, cuotasCount, cargosComisiones, comisionesRecurrentes, cardStatements, totalAmount, cycleStart, cycleEnd }
  })

  const totalNextCardPayment = cardNextPayments.reduce((s, c) => s + c.totalAmount, 0)
  const freeBalance = usableBalance - totalNextCardPayment - recurringTotal
  const afterExpectedIncome = usableBalance + monthlyIncome - totalNextCardPayment - recurringTotal
  const afterSalary = afterExpectedIncome

  // ── Salary day ───────────────────────────────────────────────────────────
  const salaryDay     = userSettings?.salary_payment_day ? Number(userSettings.salary_payment_day) : null
  const nextSalary    = salaryDay ? nextOccurrence(salaryDay) : null
  const daysToSalary  = nextSalary ? daysUntil(nextSalary) : null
  const salaryLabel   = nextSalary
    ? `${nextSalary.getDate()} de ${MES[nextSalary.getMonth()]} ${nextSalary.getFullYear()}`
    : null
  const cardsAtSalary  = cardNextPayments.filter(cp => salaryDay && Number(cp.card.paymentDueDay) === salaryDay)
  const creditAtSalary = cardsAtSalary.reduce((s, cp) => s + cp.totalAmount, 0)
  const totalAtSalary  = recurringTotal + creditAtSalary

  // ── Display helpers ───────────────────────────────────────────────────────
  const byCat = {}
  thisMonth.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + (e.amount || 0) })
  const catsArr = Object.entries(byCat).map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v)
  const maxCat  = catsArr[0]?.v || 1

  const byMethod = { debito: 0, credito: 0, efectivo: 0 }
  thisMonth.forEach(e => {
    if (e.method === 'efectivo') byMethod.efectivo += (e.amount || 0)
    else if (e.type === 'debito') byMethod.debito += (e.amount || 0)
    else byMethod.credito += (e.amount || 0)
  })
  const topMethod   = Object.entries(byMethod).sort((a, b) => b[1] - a[1])[0]
  const methodLabel = thisMonth.length === 0 ? '—' : { debito: 'Débito', credito: 'Crédito', efectivo: 'Efectivo' }[topMethod[0]]

  const byBank = {}
  thisMonth.forEach(e => { byBank[e.bank] = (byBank[e.bank] || 0) + (e.amount || 0) })

  const recent     = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5)
  const daysIn     = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const dayNow     = today.getDate()
  const proj       = dayNow > 0 ? (total / dayNow) * daysIn : 0
  const monthLabel = `${MES[today.getMonth()]} ${today.getFullYear()}`
  const topCat     = CATEGORIES.find(c => c.id === catsArr[0]?.id)

  const byDay = {}
  thisMonth.forEach(e => { const d = new Date(e.date).getDate(); byDay[d] = (byDay[d] || 0) + (e.amount || 0) })
  const maxDay = Math.max(1, ...Object.values(byDay))

  // ── Balance color ─────────────────────────────────────────────────────────
  const hasCashflow  = accounts.length > 0
  const freeRatio    = totalAvailable > 0 ? freeBalance / totalAvailable : 0
  const balanceColor = freeBalance < 0 ? 'text-[#A02828]' : freeRatio < 0.2 ? 'text-[var(--amber-ink)]' : 'text-[var(--accent-ink)]'
  const balanceBg    = freeBalance < 0 ? 'bg-[#A02828]/8 border-[#A02828]/20' : freeRatio < 0.2 ? 'bg-[var(--amber-soft)] border-[var(--amber-soft)]' : 'bg-[var(--accent-soft)] border-[var(--accent-soft)]'

  // ── After-salary helpers ──────────────────────────────────────────────────
  const afterSalaryColor = afterSalary >= 0 ? 'text-[var(--accent-ink)]' : 'text-[#A02828]'
  const afterSalaryBg    = freeBalance < 0 && afterSalary >= 0
    ? 'bg-[var(--accent-soft)]'
    : afterSalary < 0
    ? 'bg-[#A02828]/5'
    : 'bg-[var(--bg-elev)]'
  const afterSalaryBadgeBg = freeBalance < 0 && afterSalary >= 0
    ? 'bg-[var(--accent-soft)] border-[var(--accent-soft)]'
    : afterSalary < 0
    ? 'bg-[#A02828]/8 border-[#A02828]/20'
    : 'bg-[var(--accent-soft)] border-[var(--accent-soft)]'
  const daysLabel = daysToSalary === 0 ? 'Hoy' : daysToSalary === 1 ? 'Mañana' : daysToSalary !== null ? `En ${daysToSalary} días` : null

  // Cashflow grid: border per cell (2-col mobile, 4-col desktop)
  const cfBorders = [
    'border-b border-r md:border-b-0 md:border-r',
    'border-b md:border-b-0 md:border-r',
    'border-r md:border-r',
    '',
  ]
  const cfItems = [
    { label: 'Disponible usable', value: fmtCLP(usableBalance), sub: pendingPayableTotal > 0 ? `${fmtCLPshort(totalAvailable)} en cuentas · ${fmtCLPshort(pendingPayableTotal)} comprometido` : `${activeAccounts.length} cuenta${activeAccounts.length !== 1 ? 's' : ''} activa${activeAccounts.length !== 1 ? 's' : ''}`, color: 'text-[var(--accent-ink)]' },
    { label: 'Próximo pago tarjetas', value: fmtCLP(totalNextCardPayment), sub: cardNextPayments.length ? `${cardNextPayments.length} tarjeta${cardNextPayments.length !== 1 ? 's' : ''} · contado + cuotas` : 'sin tarjetas de crédito', color: '' },
    { label: 'Recurrentes fijos', value: fmtCLP(recurringTotal), sub: recurringTotal > 0 ? 'gastos recurrentes activos' : 'sin gastos fijos', color: '' },
    { label: 'Saldo libre est.', value: fmtCLP(freeBalance), sub: pendingPayableTotal > 0 ? `Sin contar ${fmtCLPshort(pendingPayableTotal)} por pagar` : null, color: balanceColor },
  ]

  return (
    <div className="flex flex-col gap-5 md:gap-6">

      {/* ── 1. Tu situación financiera ─────────────────────────────────────── */}
      {hasCashflow && (
        <Card padding="p-0" className="overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="font-semibold tracking-tight text-[15px]">Tu situación financiera</div>
              <div className="text-[12px] text-[var(--muted)] mt-0.5">Cuentas activas · actualizado hoy</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--bg-elev)] border border-[var(--line)] text-[11px] text-[var(--muted)]">
                <span className={`w-1.5 h-1.5 rounded-full ${botStatus === 'online' ? 'bg-[var(--accent)]' : 'bg-[var(--muted)]'}`}/>
                Bot {botStatus === 'online' ? 'activo' : 'off'}
                {lastBotMessage && <span className="ml-1">· {relDate(lastBotMessage.at)} {timeOnly(lastBotMessage.at)}</span>}
              </div>
              <button onClick={() => setView('accounts')} className="text-[12px] text-[var(--ink-2)] hover:underline inline-flex items-center gap-1">
                Ver detalle <Icon name="chevron" size={12}/>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4">
            {cfItems.map((item, i) => (
              <div key={i} className={`px-5 py-4 border-[var(--line)] ${cfBorders[i]}`}>
                <div className="text-[10.5px] uppercase tracking-[0.12em] text-[var(--muted)]">{item.label}</div>
                <div className={`mt-2 font-mono text-[20px] md:text-[24px] tracking-tight leading-none ${item.color}`}>{item.value}</div>
                {item.sub && <div className="mt-1.5 text-[11px] text-[var(--muted)]">{item.sub}</div>}
                {i === 3 && (
                  <div className={`mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10.5px] font-medium ${balanceBg} ${balanceColor}`}>
                    {freeBalance < 0
                      ? <><Icon name="alert" size={11}/> Déficit</>
                      : freeRatio < 0.2
                      ? <><Icon name="alert" size={11}/> Saldo bajo</>
                      : <><Icon name="check" size={11}/> Positivo</>}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Después de ingresos esperados ──────────────────────────────── */}
          {monthlyIncome > 0 ? (
            <div className={`border-t border-[var(--line)] px-5 py-4 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 ${afterSalaryBg}`}>
              <div>
                <div className="text-[10.5px] uppercase tracking-[0.12em] text-[var(--muted)]">Después de ingresos esperados</div>
                <div className={`mt-2 font-mono text-[20px] md:text-[24px] tracking-tight leading-none tabular-nums ${afterSalaryColor}`}>
                  {fmtCLP(afterSalary)}
                </div>
                <div className={`mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10.5px] font-medium ${afterSalaryBadgeBg} ${afterSalaryColor}`}>
                  {afterSalary < 0
                    ? <><Icon name="alert" size={11}/> Faltante después de ingresos</>
                    : freeBalance < 0
                    ? <><Icon name="check" size={11}/> Se regulariza con ingresos</>
                    : <><Icon name="check" size={11}/> Positivo tras ingresos</>}
                </div>
              </div>
              <div className="flex flex-col gap-2.5 text-[12px]">
                <div className="flex items-center gap-6">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">Ingresos esperados</div>
                    <div className="font-mono font-semibold text-[14px] mt-0.5 text-[var(--accent-ink)]">{fmtCLP(monthlyIncome)}</div>
                    {punctualIncomeTotal > 0 && (
                      <div className="text-[10.5px] text-[var(--muted)] mt-0.5">incluye {fmtCLPshort(punctualIncomeTotal)} puntuales</div>
                    )}
                  </div>
                  {salaryDay && daysLabel && (
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">Día {salaryDay}</div>
                      <div className="font-mono text-[14px] mt-0.5 text-[var(--ink-2)]">{daysLabel}</div>
                    </div>
                  )}
                  {!salaryDay && (
                    <div className="text-[11px] text-[var(--muted)]">
                      Configura tu día de sueldo en{' '}
                      <button className="underline text-[var(--ink-2)]" onClick={() => setView('profile')}>Mi perfil</button>
                    </div>
                  )}
                </div>
                {pendingPayableTotal > 0 && (
                  <div className="flex items-center justify-between gap-4 text-[11.5px] border-t border-[var(--line)] pt-2">
                    <span className="text-[var(--muted)]">Por pagar comprometido</span>
                    <span className="font-mono text-[var(--amber-ink)]">−{fmtCLP(pendingPayableTotal)}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="border-t border-[var(--line)] px-5 py-3.5 flex items-center gap-2.5 text-[12px] text-[var(--muted)]">
              <Icon name="income" size={14} className="shrink-0"/>
              <span>
                Sin ingresos configurados.{' '}
                Agrega tu sueldo en{' '}
                <button className="underline text-[var(--ink-2)]" onClick={() => setView('recurring')}>Recurrentes</button>
                {' '}para ver el saldo estimado después de cobrar.
              </span>
            </div>
          )}
        </Card>
      )}

      {/* ── 2. Hero: gasto mensual + próximo pago ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        {/* Gasto mensual */}
        <Card padding="p-5 md:p-6" className="relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
              <Icon name="calendar" size={13}/> {monthLabel}
            </div>
            {!hasCashflow && (
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                <span className={`w-1.5 h-1.5 rounded-full ${botStatus === 'online' ? 'bg-[var(--accent)]' : 'bg-[var(--muted)]'}`}/>
                Bot {botStatus === 'online' ? 'activo' : 'off'}
              </div>
            )}
          </div>
          <div className="mt-3 flex items-end gap-3 flex-wrap">
            <div className="font-mono text-[40px] md:text-[52px] tracking-tight leading-none">{fmtCLP(total)}</div>
            {deltaStr && (
              <div className={`mb-1.5 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-medium
                ${delta < 0 ? 'bg-[var(--accent-soft)] text-[var(--accent-ink)]' : 'bg-[var(--amber-soft)] text-[var(--amber-ink)]'}`}>
                <Icon name="trend" size={12}/> {deltaStr} vs {MES[prevM]}
              </div>
            )}
          </div>
          <div className="mt-2 text-[13px] text-[var(--muted)]">
            Proyección fin de mes ≈ <span className="font-mono text-[var(--ink-2)]">{fmtCLP(proj)}</span> · {thisMonth.length} gastos
          </div>
          <div className="mt-5 grid grid-cols-[repeat(31,minmax(0,1fr))] gap-[3px]">
            {Array.from({ length: daysIn }).map((_, i) => {
              const day = i + 1; const v = byDay[day] || 0
              const intensity = v / maxDay; const isToday = day === dayNow
              return (
                <div key={i}
                  className={`h-7 rounded-[3px] ${isToday ? 'outline outline-1 outline-[var(--ink)]' : ''}`}
                  style={{ background: v ? `oklch(0.62 0.13 165 / ${0.18 + intensity * 0.72})` : 'var(--line)' }}
                  title={`Día ${day}: ${fmtCLP(v)}`}/>
              )
            })}
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--muted)] font-mono">
            <span>1</span><span>15</span><span>{daysIn}</span>
          </div>
        </Card>

        {/* Próximo día de pago */}
        <Card padding="p-5">
          {salaryDay ? (
            <>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
                <Icon name="calendar" size={13}/> Próximo día de pago
              </div>
              <div className="mt-2">
                <div className="font-semibold text-[22px] tracking-tight">{salaryLabel}</div>
                <div className="mt-0.5 text-[13px] text-[var(--muted)]">
                  Faltan {daysToSalary} día{daysToSalary !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2.5">
                {cardsAtSalary.length > 0 && (
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-[var(--muted)] flex items-center gap-1.5">
                      <Icon name="card" size={13}/> Tarjetas + cuotas (día {salaryDay})
                    </span>
                    <span className="font-mono">{fmtCLP(creditAtSalary)}</span>
                  </div>
                )}
                {recurringTotal > 0 && (
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-[var(--muted)] flex items-center gap-1.5">
                      <Icon name="repeat" size={13}/> Gastos recurrentes
                    </span>
                    <span className="font-mono">{fmtCLP(recurringTotal)}</span>
                  </div>
                )}
                {(cardsAtSalary.length > 0 || cuotasThisMonth > 0 || recurringTotal > 0) && (
                  <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between text-[13px] font-semibold">
                    <span>Total estimado</span>
                    <span className="font-mono">{fmtCLP(totalAtSalary)}</span>
                  </div>
                )}
              </div>
              {hasCashflow && (
                <div className={`mt-4 p-3 rounded-lg border ${balanceBg}`}>
                  <div className={`text-[12px] font-medium ${balanceColor}`}>
                    {freeBalance >= 0
                      ? `Saldo libre: ${fmtCLP(freeBalance)}`
                      : `Déficit estimado: ${fmtCLP(Math.abs(freeBalance))}`}
                  </div>
                  <div className="text-[11px] text-[var(--muted)] mt-0.5">después de compromisos</div>
                </div>
              )}
              <button onClick={() => setView('accounts')}
                className="mt-4 w-full h-8 inline-flex items-center justify-center gap-1.5 rounded-md border border-[var(--line)] text-[12.5px] text-[var(--ink-2)] hover:bg-[var(--hover)]">
                <Icon name="wallet" size={13}/> Ver flujo completo
              </button>
            </>
          ) : (
            <>
              <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)] flex items-center gap-2">
                <Icon name="layers" size={13}/> Cuotas activas
              </div>
              <div className="mt-3">
                <div className="font-mono text-[32px] tracking-tight leading-none">{fmtCLP(cuotasThisMonth)}</div>
                <div className="mt-1.5 text-[13px] text-[var(--muted)]">este mes · {activeDebts.length} cuota{activeDebts.length !== 1 ? 's' : ''}</div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <div className="flex justify-between text-[13px]">
                  <span className="text-[var(--muted)]">Próximo mes</span>
                  <span className="font-mono">{fmtCLP(cuotasNextMonth)}</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span className="text-[var(--muted)]">Deuda restante</span>
                  <span className="font-mono">{fmtCLP(totalRemainingDebt)}</span>
                </div>
              </div>
              <div className="mt-5 text-[12px] text-[var(--muted)]">
                Configura tu día de sueldo en{' '}
                <button className="underline text-[var(--ink-2)]" onClick={() => setView('profile')}>Mi perfil</button>
                {' '}para ver compromisos al día de pago.
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ── 3. KPIs ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Gastos del mes"  value={thisMonth.length}      sub={`promedio diario: ${fmtCLPshort(dayNow > 0 ? total / dayNow : 0)}`} icon="list"/>
        <StatCard label="Gasto promedio"  value={fmtCLP(avg)}           sub="por transacción"                                                     icon="wallet"/>
        <StatCard label="Medio más usado" value={methodLabel}           sub={thisMonth.length ? `${fmtCLP(topMethod[1])} este mes` : 'sin datos'} icon="card"/>
        <StatCard label="Categoría top"   value={topCat?.label ?? '—'} sub={topCat ? `${fmtCLP(catsArr[0]?.v ?? 0)} acumulado` : 'sin gastos'}  icon="tag"/>
      </div>

      {/* ── 4. Próximo pago de tarjetas ────────────────────────────────────── */}
      {cardNextPayments.length > 0 && (
        <Card padding="p-0">
          <SectionHeader
            title="Próximo pago de tarjetas"
            sub={`${cardNextPayments.length} activa${cardNextPayments.length !== 1 ? 's' : ''} · contado + cuotas del mes`}
            action="Ver cuentas"
            onAction={() => setView('accounts')}
          />
          <ul className="divide-y divide-[var(--line)]">
            {cardNextPayments.map(({ card, nextPayDate, contadoAmount, cuotasAmount, cuotasCount, cargosComisiones, comisionesRecurrentes, cardStatements, totalAmount, cycleStart, cycleEnd }) => {
              const lim       = card.creditLimit ? Number(card.creditLimit) : null
              const util      = lim && lim > 0 ? (totalAmount / lim) * 100 : null
              const utilColor = util === null ? 'var(--accent)' : util > 80 ? '#A02828' : util > 60 ? 'var(--amber-ink)' : 'var(--accent)'
              const payLabel  = `${nextPayDate.getDate()} ${MES[nextPayDate.getMonth()]}`
              const cycleLabel = `${cycleStart.getDate()} ${MES[cycleStart.getMonth()].slice(0, 3).toLowerCase()} – ${cycleEnd.getDate()} ${MES[cycleEnd.getMonth()].slice(0, 3).toLowerCase()}`
              const bankLabel = banks.find(b => b.id === card.bank)?.label || card.bank || ''
              return (
                <li key={card.id} className="px-5 py-3.5">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-md bg-[var(--bg-elev)] border border-[var(--line)] grid place-items-center text-[var(--muted)] shrink-0 mt-0.5">
                      <Icon name="card" size={14}/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[13.5px]">{card.name}</span>
                        {card.lastFour && <span className="text-[var(--muted)] font-mono text-[11px]">···{card.lastFour}</span>}
                      </div>
                      <div className="mt-1.5 flex flex-col gap-1">
                        {contadoAmount > 0 && (
                          <div className="flex items-center justify-between text-[11.5px]">
                            <span className="text-[var(--muted)]">Compras contado · {cycleLabel}</span>
                            <span className="font-mono tabular-nums">{fmtCLP(contadoAmount)}</span>
                          </div>
                        )}
                        {cuotasAmount > 0 && (
                          <div className="flex items-center justify-between text-[11.5px]">
                            <span className="text-[var(--muted)]">Cuotas del mes · {cuotasCount} activa{cuotasCount !== 1 ? 's' : ''}</span>
                            <span className="font-mono tabular-nums">{fmtCLP(cuotasAmount)}</span>
                          </div>
                        )}
                        {cargosComisiones > 0 && (
                          <div className="flex items-center justify-between text-[11.5px]">
                            <span className="text-[var(--amber-ink)]">Cargos variables del estado de cuenta</span>
                            <span className="font-mono tabular-nums text-[var(--amber-ink)]">{fmtCLP(cargosComisiones)}</span>
                          </div>
                        )}
                        {comisionesRecurrentes > 0 && (
                          <div className="flex items-center justify-between text-[11.5px]">
                            <span className="text-[var(--muted)]">Comisiones fijas · <span className="italic">en gastos fijos</span></span>
                            <span className="font-mono tabular-nums text-[var(--muted)]">{fmtCLP(comisionesRecurrentes)}</span>
                          </div>
                        )}
                        {contadoAmount === 0 && cuotasAmount === 0 && cargosComisiones === 0 && comisionesRecurrentes === 0 && (
                          <div className="text-[11.5px] text-[var(--muted)]">Sin movimientos en el ciclo</div>
                        )}
                        <div className="flex flex-col gap-0.5 pt-0.5 border-t border-[var(--line)] mt-0.5">
                          <div className="flex items-center justify-between text-[12px] font-semibold text-[var(--ink-2)]">
                            <span>Pagar el {payLabel}</span>
                            <span className="font-mono tabular-nums">{fmtCLP(totalAmount)}</span>
                          </div>
                          {comisionesRecurrentes > 0 && (
                            <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
                              <span>Total estimado (incl. comisiones)</span>
                              <span className="font-mono tabular-nums">{fmtCLP(totalAmount + comisionesRecurrentes)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  {util !== null && (
                    <div className="mt-2.5 h-1.5 rounded-full bg-[var(--line)] overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: Math.min(100, util) + '%', background: utilColor }}/>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          {cardNextPayments.length > 1 && (
            <div className="px-5 py-3 border-t border-[var(--line)] flex items-center justify-between">
              <span className="text-[12.5px] text-[var(--muted)] font-medium">Total tarjetas</span>
              <span className="font-mono text-[15px] font-semibold tabular-nums">{fmtCLP(totalNextCardPayment)}</span>
            </div>
          )}
        </Card>
      )}

      {/* ── 5. Cuotas activas (3 max) ─────────────────────────────────────── */}
      {activeDebts.length > 0 && (
        <Card padding="p-0">
          <SectionHeader
            title="Cuotas activas"
            sub={`${fmtCLP(cuotasThisMonth)} este mes · próximo cobro en ${daysToCharge} día${daysToCharge !== 1 ? 's' : ''}`}
            action="Ver todas"
            onAction={() => setView('installments')}
          />
          <div className="grid grid-cols-3 divide-x divide-[var(--line)] border-b border-[var(--line)]">
            {[
              { label: 'Este mes',       value: fmtCLP(cuotasThisMonth) },
              { label: 'Próximo mes',    value: fmtCLP(cuotasNextMonth) },
              { label: 'Deuda restante', value: fmtCLP(totalRemainingDebt) },
            ].map((item, i) => (
              <div key={i} className="px-4 py-3 text-center">
                <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">{item.label}</div>
                <div className="mt-1 font-mono text-[16px] tracking-tight">{item.value}</div>
              </div>
            ))}
          </div>
          <ul className="divide-y divide-[var(--line)]">
            {activeDebts.slice(0, 3).map(d => {
              const cat = CATEGORIES.find(c => c.id === d.category) ?? CATEGORIES.find(c => c.id === 'otros') ?? CATEGORIES[0]
              const rem = d.installments - d.paid
              return (
                <li key={d.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-7 h-7 rounded-md grid place-items-center text-[12px] shrink-0" style={{ background: (cat.color ?? '#888') + '20' }}>{cat.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium truncate">{d.description}</span>
                      <span className="text-[10.5px] font-mono px-1.5 py-[2px] rounded bg-[var(--hover)] text-[var(--ink-2)]">{d.paid}/{d.installments}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-[3px]">
                      {Array.from({ length: Math.min(d.installments, 24) }).map((_, i) => (
                        <div key={i} className="flex-1 h-1 rounded-sm" style={{ background: i < d.paid ? 'var(--ink)' : 'var(--line)' }}/>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-[13px] tabular-nums">{fmtCLP(d.monthlyAmount)}</div>
                    <div className="text-[10.5px] text-[var(--muted)]">{rem} restante{rem !== 1 ? 's' : ''}</div>
                  </div>
                </li>
              )
            })}
          </ul>
          {activeDebts.length > 3 && (
            <div className="px-5 py-2.5 border-t border-[var(--line)] text-center">
              <button onClick={() => setView('installments')} className="text-[12px] text-[var(--ink-2)] hover:underline inline-flex items-center gap-1">
                Ver {activeDebts.length - 3} cuota{activeDebts.length - 3 !== 1 ? 's' : ''} más <Icon name="chevron" size={12}/>
              </button>
            </div>
          )}
        </Card>
      )}

      {/* ── 6. Últimos gastos + Categorías + Medios ───────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr_1fr] gap-4">
        <Card padding="p-0">
          <SectionHeader
            title="Últimos gastos"
            sub="Registrados desde Telegram y manual"
            action="Ver todos"
            onAction={() => setView('expenses')}
          />
          {recent.length > 0 ? (
            <ul className="divide-y divide-[var(--line)]">
              {recent.map(e => {
                const cat      = CATEGORIES.find(c => c.id === e.category) ?? CATEGORIES.find(c => c.id === 'otros') ?? CATEGORIES[0]
                const bankName = banks.find(b => b.id === e.bank)?.label
                const pt       = payLabel(e)
                return (
                  <li key={e.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md grid place-items-center text-[14px] shrink-0" style={{ background: (cat.color ?? '#888') + '20' }}>
                      {cat.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13.5px] font-medium truncate">{e.description}</span>
                        {e.status === 'revisar' && <Badge tone="warn">revisar</Badge>}
                        {(e.installments || 0) > 1 && <Badge tone="muted">{e.installments} cuotas</Badge>}
                      </div>
                      <div className="text-[11.5px] text-[var(--muted)] mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>{relDate(e.date)} · {timeOnly(e.date)}</span>
                        {bankName && <><span>·</span><span>{bankName}</span></>}
                        <span>·</span><span>{pt}</span>
                      </div>
                    </div>
                    <div className="font-mono text-[14px] tabular-nums shrink-0">{fmtCLP(e.amount)}</div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="px-5 py-8 text-center text-[13px] text-[var(--muted)]">
              Sin gastos registrados.{' '}
              <button onClick={() => setView('expenses')} className="underline text-[var(--ink-2)]">Registrar uno</button>
            </div>
          )}
        </Card>

        <Card padding="p-5">
          <div className="flex items-center justify-between">
            <div className="font-semibold tracking-tight">Por categoría</div>
            <Badge tone="muted">{catsArr.length}</Badge>
          </div>
          {catsArr.length > 0 ? (
            <div className="mt-4 flex flex-col gap-3.5">
              {catsArr.slice(0, 6).map(c => {
                const cat = CATEGORIES.find(x => x.id === c.id) ?? CATEGORIES[0]
                return (
                  <BarRow key={c.id}
                    label={<span className="inline-flex items-center gap-2"><span>{cat.icon}</span>{cat.label}</span>}
                    value={c.v} max={maxCat} color={cat.color}
                    right={total > 0 ? Math.round((c.v / total) * 100) + '%' : '0%'}
                  />
                )
              })}
            </div>
          ) : (
            <div className="mt-8 text-center text-[13px] text-[var(--muted)]">Sin gastos este mes</div>
          )}
        </Card>

        <Card padding="p-5">
          <div className="flex items-center justify-between">
            <div className="font-semibold tracking-tight">Medios de pago</div>
            <Badge tone="muted">{thisMonth.length} ops</Badge>
          </div>
          {thisMonth.length > 0 ? (
            <>
              <div className="mt-4 flex flex-col gap-3.5">
                {[
                  { key: 'credito', label: 'Crédito',  icon: 'card' },
                  { key: 'debito',  label: 'Débito',   icon: 'card' },
                  { key: 'efectivo',label: 'Efectivo', icon: 'cash' },
                ].map(m => (
                  <BarRow key={m.key}
                    label={<span className="inline-flex items-center gap-2"><Icon name={m.icon} size={13}/> {m.label}</span>}
                    value={byMethod[m.key]}
                    max={Math.max(1, ...Object.values(byMethod))}
                    color={m.key === 'credito' ? 'var(--ink)' : m.key === 'debito' ? 'var(--accent)' : '#C9A227'}
                    right={total > 0 ? Math.round((byMethod[m.key] / total) * 100) + '%' : '0%'}
                  />
                ))}
              </div>
              <div className="mt-5 pt-5 border-t border-[var(--line)]">
                <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Por banco</div>
                <div className="mt-3 flex flex-col gap-2.5">
                  {Object.entries(byBank).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, v]) => {
                    const b = banks.find(x => x.id === id)
                    return (
                      <div key={id} className="flex items-center justify-between text-[13px]">
                        <span className="inline-flex items-center gap-2 text-[var(--ink-2)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--ink-2)]"/>
                          {b?.label ?? id}
                        </span>
                        <span className="font-mono tabular-nums">{fmtCLP(v)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="mt-8 text-center text-[13px] text-[var(--muted)]">Sin operaciones este mes</div>
          )}
        </Card>
      </div>
    </div>
  )
}
