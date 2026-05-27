import React, { useState, useMemo } from 'react'
import { fmtCLP, fmtCLPshort, MES } from '../lib/helpers'
import { useBanks } from '../services/banksService'

const DASH_CC_KEY = 'gastito_cc_v1'
const loadCCStatements = () => { try { return JSON.parse(localStorage.getItem(DASH_CC_KEY) || '[]') } catch { return [] } }

function monthDiff(startStr, endStr) {
  const [sy, sm] = startStr.split('-').map(Number)
  const [ey, em] = endStr.split('-').map(Number)
  return (ey - sy) * 12 + (em - sm)
}

// ── Bank palette ───────────────────────────────────────────
const BANK_COLORS = {
  bchile:     { stroke: '#3b82f6', bg: '#e8f3fd' },
  bfalabella: { stroke: '#28c47a', bg: '#e8f9ef' },
  bsantander: { stroke: '#f43f5e', bg: '#fce8ec' },
  bestado:    { stroke: '#7c3aed', bg: '#f0ebfd' },
  bci:        { stroke: '#f59e0b', bg: '#fef3c7' },
  default:    { stroke: '#28c47a', bg: '#e8f9ef' },
}

// ── Charge badge configs ────────────────────────────────────
const CHARGE_BADGE = {
  cargo_internacional: { bg: '#fff7e6', color: '#b45309', dot: '#f59e0b', label: 'Internacional' },
  impuesto:            { bg: '#f5f0ff', color: '#6d28d9', dot: '#8b5cf6', label: 'Impuesto' },
  interes:             { bg: '#fff1f1', color: '#b91c1c', dot: '#ef4444', label: 'Interés' },
  comision:            { bg: '#f0f4f8', color: '#374151', dot: '#6b7280', label: 'Comisión' },
  otro:                { bg: '#f3f4f6', color: '#374151', dot: '#9ca3af', label: 'Cargo' },
}

const CHARGE_LABEL = {
  cargo_internacional: 'Cargo internacional',
  impuesto:            'Impuesto',
  interes:             'Interés',
  comision:            'Comisión',
  otro:                'Otro cargo',
}

function ChargeBadge({ tipo }) {
  const cfg = CHARGE_BADGE[tipo] ?? CHARGE_BADGE.otro
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-[7px] py-[2px] rounded-full shrink-0 whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.color }}>
      <span className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: cfg.dot }}/>
      {cfg.label}
    </span>
  )
}

function CardIcon({ stroke, bg }) {
  return (
    <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0" style={{ background: bg }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="5" width="20" height="14" rx="2.5" stroke={stroke} strokeWidth="1.8"/>
        <path d="M2 9h20" stroke={stroke} strokeWidth="1.8"/>
        <path d="M6 14h5" stroke={stroke} strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="17" cy="14" r="1.5" fill={stroke}/>
      </svg>
    </div>
  )
}

function ChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}

function SecHeader({ label, action, onAction }) {
  return (
    <div className="flex justify-between items-center px-5 pt-4 pb-2">
      <span className="text-[11px] font-bold tracking-[0.08em] uppercase" style={{ color: '#5d6888' }}>{label}</span>
      <button onClick={onAction} className="text-[12.5px] font-semibold flex items-center gap-0.5" style={{ color: '#28c47a' }}>
        {action} <ChevronRight/>
      </button>
    </div>
  )
}

function fmtCycle(start, end) {
  const m = MES.map(x => x.slice(0, 3).toLowerCase())
  return `${start.getDate()} ${m[start.getMonth()]} – ${end.getDate()} ${m[end.getMonth()]}`
}

function fmtShortDate(d) {
  return `${d.getDate()} ${MES[d.getMonth()].slice(0, 3)}`
}

// ── Main component ─────────────────────────────────────────
export default function Dashboard({
  expenses = [], setView, openChat, botStatus,
  installmentDebts = [], recurring = [], accounts = [], creditCards = [],
  income = [], receivables = [],
  userSettings = null,
}) {
  const banks   = useBanks()
  const today   = new Date()
  const ccStmts = useMemo(() => loadCCStatements(), [])

  // Accordion — open first card by default
  const [openBanks, setOpenBanks] = useState(() => {
    const first = creditCards.filter(c => c.isActive !== false)[0]
    return first ? new Set([first.id]) : new Set()
  })
  const toggleBank = id => setOpenBanks(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const [cicloOpen, setCicloOpen] = useState(false)

  // ── Installments ───────────────────────────────────────────
  const activeDebts        = installmentDebts.filter(d => d.status === 'active')
  const cuotasThisMonth    = activeDebts.reduce((s, d) => s + (d.monthlyAmount || 0), 0)
  const cuotasNextMonth    = activeDebts.filter(d => d.paid + 1 < d.installments).reduce((s, d) => s + (d.monthlyAmount || 0), 0)
  const totalRemainingDebt = activeDebts.reduce((s, d) => s + (d.monthlyAmount || 0) * (d.installments - d.paid), 0)

  // ── Cashflow ───────────────────────────────────────────────
  const activeAccounts      = accounts.filter(a => a.active)
  const totalAvailable      = activeAccounts.reduce((s, a) => s + (a.balance || 0), 0)
  const pendingPayableTotal = (recurring ?? []).filter(r => r.active && r.kind === 'payable' && r.status !== 'paid').reduce((s, r) => s + (r.amount || 0), 0)
  const usableBalance       = totalAvailable - pendingPayableTotal
  const recurringTotal      = (recurring ?? []).filter(r => r.active && r.kind === 'expense' && !r.comisionBancaria && r.type !== 'credito').reduce((s, r) => s + (r.amount || 0), 0)
  const recurringIncomeTotal = (income ?? []).filter(r => r.active !== false).reduce((s, r) => s + (r.amount || 0), 0)
  const punctualIncomeTotal = (receivables ?? []).filter(r => r.status !== 'paid').reduce((s, r) => s + (r.amount || 0), 0)
  const monthlyIncome       = recurringIncomeTotal + punctualIncomeTotal

  // ── Per-card next payment ──────────────────────────────────
  const cardNextPayments = creditCards.filter(c => c.isActive !== false).map(card => {
    const bd = Number(card.billingDay ?? 20)
    const pd = Number(card.paymentDueDay ?? 5)

    let npMonth = today.getMonth(); let npYear = today.getFullYear()
    if (today.getDate() >= pd) { npMonth++; if (npMonth > 11) { npMonth = 0; npYear++ } }
    const nextPayDate     = new Date(npYear, npMonth, pd)
    const nextPayMonthStr = `${npYear}-${String(npMonth + 1).padStart(2, '0')}`

    let bmMonth = npMonth - 1; let bmYear = npYear
    if (bmMonth < 0) { bmMonth = 11; bmYear-- }
    const cycleEnd = new Date(bmYear, bmMonth, bd)
    let csMonth = bmMonth - 1; let csYear = bmYear
    if (csMonth < 0) { csMonth = 11; csYear-- }
    const cycleStart = new Date(csYear, csMonth, bd + 1)

    const contadoAmount = expenses
      .filter(e => e.type === 'credito' && !(card.bank && e.bank !== card.bank) && (e.installments ?? 1) <= 1 && new Date(e.date) >= cycleStart && new Date(e.date) <= cycleEnd)
      .reduce((s, e) => s + (e.amount || 0), 0)

    const cardCuotas   = activeDebts.filter(d => !(card.bank && d.bank !== card.bank) && d.startMonth && (() => { const el = monthDiff(d.startMonth, nextPayMonthStr); return el >= 0 && el < d.installments })())
    const cuotasAmount = cardCuotas.reduce((s, d) => s + (d.monthlyAmount || 0), 0)
    const cuotasCount  = cardCuotas.length

    const cardStatements = ccStmts.filter(s => s.status !== 'paid' && s.bankId === card.bank && (s.month || s.dueDate?.slice(0, 7)) === nextPayMonthStr)
    const cardCharges    = cardStatements.flatMap(st =>
      (st.charges?.length > 0) ? st.charges
      : st.cargosComisiones > 0 ? [{ tipo: 'otro', descripcion: 'Cargos y comisiones', monto: st.cargosComisiones }]
      : []
    )
    const cargosTotal = cardCharges.reduce((s, c) => s + (Number(c.monto) || 0), 0)

    const comisionesRec         = (recurring ?? []).filter(r => r.comisionBancaria && r.active !== false && r.bank === card.bank)
    const comisionesRecurrentes = comisionesRec.reduce((s, r) => s + (r.amount || 0), 0)
    const totalAmount           = contadoAmount + cuotasAmount + cargosTotal

    return { card, nextPayDate, contadoAmount, cuotasAmount, cuotasCount, cardCharges, cargosTotal, comisionesRec, comisionesRecurrentes, totalAmount, cycleStart, cycleEnd }
  })

  const totalNextCardPayment       = cardNextPayments.reduce((s, c) => s + c.totalAmount, 0)
  const totalComisionesRecurrentes = cardNextPayments.reduce((s, c) => s + c.comisionesRecurrentes, 0)

  // ── Recurrentes stats ──────────────────────────────────────
  // Excluir comisionBancaria y type=credito (misma regla que proyección)
  const activeRecurring = (recurring ?? []).filter(r => r.active && r.kind === 'expense' && !r.comisionBancaria && r.type !== 'credito')
  const pausedRecurring = (recurring ?? []).filter(r => !r.active && r.kind === 'expense' && !r.comisionBancaria && r.type !== 'credito')
  const incomeRatio     = recurringIncomeTotal > 0 ? Math.min(recurringTotal / recurringIncomeTotal, 1) : 0

  // ── Próximo ciclo ──────────────────────────────────────────
  const _nextCycleDate     = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  const nextCycleLabel     = `${MES[_nextCycleDate.getMonth()]} ${_nextCycleDate.getFullYear()}`
  const nextCycleCardTotal = totalNextCardPayment + totalComisionesRecurrentes
  const nextCycleRecurring = recurringTotal
  const nextCycleOutflow   = nextCycleCardTotal + nextCycleRecurring
  const nextCycleBalance   = usableBalance + monthlyIncome - nextCycleOutflow
  const nextCycleRatio     = monthlyIncome > 0 ? nextCycleOutflow / monthlyIncome : 0

  // ── Ciclo en curso (21 → 20) ───────────────────────────────
  const cicloInicio = (() => {
    if (today.getDate() <= 20) {
      let m = today.getMonth() - 1, y = today.getFullYear()
      if (m < 0) { m = 11; y-- }
      return new Date(y, m, 21)
    }
    return new Date(today.getFullYear(), today.getMonth(), 21)
  })()
  const cicloFin         = new Date(cicloInicio.getFullYear(), cicloInicio.getMonth() + 1, 20)
  const cicloNextPayDate = new Date(cicloFin.getFullYear(), cicloFin.getMonth() + 1, 5)
  const cicloDaysTotal   = Math.round((cicloFin - cicloInicio) / 86400000) + 1
  const cicloDaysElapsed = Math.min(Math.round((today - cicloInicio) / 86400000) + 1, cicloDaysTotal)
  const cicloDaysLeft    = cicloDaysTotal - cicloDaysElapsed
  const cicloDayRatio    = cicloDaysElapsed / cicloDaysTotal
  const cicloInicioTs    = cicloInicio.getTime()
  const cicloFinTs       = new Date(cicloFin.getFullYear(), cicloFin.getMonth(), 20, 23, 59, 59).getTime()

  const cicloExpenses = useMemo(() =>
    expenses.filter(e => { const ts = new Date(e.date).getTime(); return ts >= cicloInicioTs && ts <= cicloFinTs }),
    [expenses, cicloInicioTs, cicloFinTs]
  )
  const cicloTotal = cicloExpenses.reduce((s, e) => s + (e.amount || 0), 0)

  const cicloByMedio = useMemo(() => {
    const g = { credito: 0, debito: 0, efectivo: 0 }
    cicloExpenses.forEach(e => {
      if (e.method === 'efectivo') g.efectivo += e.amount || 0
      else if (e.type === 'credito') g.credito += e.amount || 0
      else g.debito += e.amount || 0
    })
    return g
  }, [cicloExpenses])

  const cicloByBank = useMemo(() => {
    const g = {}
    cicloExpenses.forEach(e => { if (e.bank) g[e.bank] = (g[e.bank] || 0) + (e.amount || 0) })
    return g
  }, [cicloExpenses])

  return (
    <div className="-mx-4 md:-mx-7 -mt-5 md:-mt-7">

      {/* ── BLOQUE 1: HERO ────────────────────────────────── */}
      <div className="px-4 pt-4 pb-0">
        <div className="grid grid-cols-2 gap-2.5">

          {/* Disponible usable — dark navy */}
          <div className="rounded-2xl p-4 relative overflow-hidden" style={{ background: '#1e2535' }}>
            <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full pointer-events-none"
              style={{ background: 'radial-gradient(circle, rgba(61,214,140,0.25) 0%, transparent 70%)' }}/>
            <div className="text-[9.5px] font-bold tracking-[0.09em] uppercase mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Disponible usable
            </div>
            <div className="text-[22px] font-extrabold leading-none tabular-nums" style={{ color: '#3dd68c', letterSpacing: '-0.02em' }}>
              {fmtCLP(usableBalance)}
            </div>
            <div className="text-[10.5px] mt-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {activeAccounts.length} cuenta{activeAccounts.length !== 1 ? 's' : ''} activa{activeAccounts.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Próx. pago tarjetas — white */}
          <div className="rounded-2xl p-4 bg-white border border-[#e8e6df]" style={{ boxShadow: '0 1px 3px rgba(30,37,53,0.05)' }}>
            <div className="text-[9.5px] font-bold tracking-[0.09em] uppercase mb-2" style={{ color: '#5d6888' }}>
              Próx. pago tarjetas
            </div>
            <div className="font-extrabold leading-none tabular-nums" style={{ color: '#1e2535', letterSpacing: '-0.02em', fontSize: cardNextPayments.length > 0 ? '20px' : '22px' }}>
              {fmtCLP(totalComisionesRecurrentes > 0 ? totalNextCardPayment + totalComisionesRecurrentes : totalNextCardPayment)}
            </div>
            {totalComisionesRecurrentes > 0 && (
              <div className="text-[10px] mt-0.5 tabular-nums" style={{ color: '#9ba5c2' }}>base {fmtCLP(totalNextCardPayment)}</div>
            )}
            <div className="text-[10.5px] mt-1" style={{ color: '#5d6888' }}>
              {cardNextPayments.length} tarjeta{cardNextPayments.length !== 1 ? 's' : ''} · {totalComisionesRecurrentes > 0 ? 'est. incl. comisiones' : 'incl. cargos estado'}
            </div>
          </div>
        </div>

        {/* Barra resumen tarjetas */}
        {totalNextCardPayment > 0 && (
          <div className="mt-2.5 flex bg-white border border-[#e8e6df] rounded-[10px] overflow-hidden"
            style={{ boxShadow: '0 1px 3px rgba(30,37,53,0.04)' }}>
            {totalComisionesRecurrentes > 0 ? (
              <>
                <div className="flex-1 px-3.5 py-2.5">
                  <div className="text-[9.5px] font-bold tracking-[0.07em] uppercase mb-1" style={{ color: '#5d6888' }}>Estimado real a pagar</div>
                  <div className="text-[15px] font-extrabold tabular-nums" style={{ color: '#1e2535', letterSpacing: '-0.01em' }}>
                    {fmtCLP(totalNextCardPayment + totalComisionesRecurrentes)}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: '#5d6888' }}>
                    +<span style={{ color: '#fbbf24', fontWeight: 600 }}>{fmtCLP(totalComisionesRecurrentes)}</span> comisiones fijas
                  </div>
                </div>
                <div className="flex-1 px-3.5 py-2.5 border-l border-[#e8e6df]">
                  <div className="text-[9.5px] font-bold tracking-[0.07em] uppercase mb-1" style={{ color: '#9ba5c2' }}>Base s/ comisiones</div>
                  <div className="text-[14px] font-semibold tabular-nums" style={{ color: '#9ba5c2', letterSpacing: '-0.01em' }}>
                    {fmtCLP(totalNextCardPayment)}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: '#9ba5c2' }}>contado + cuotas + cargos</div>
                </div>
              </>
            ) : (
              <div className="flex-1 px-3.5 py-2.5">
                <div className="text-[9.5px] font-bold tracking-[0.07em] uppercase mb-1" style={{ color: '#5d6888' }}>Total tarjetas</div>
                <div className="text-[15px] font-extrabold tabular-nums" style={{ color: '#1e2535', letterSpacing: '-0.01em' }}>
                  {fmtCLP(totalNextCardPayment)}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: '#5d6888' }}>contado + cuotas + cargos</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── BLOQUE 1.5: CICLO EN CURSO ────────────────────── */}
      <div className="px-4 pt-3 pb-0">
        <div className="bg-white border border-[#e8e6df] rounded-2xl overflow-hidden"
          style={{ boxShadow: '0 1px 3px rgba(30,37,53,0.05)' }}>

          {/* Header row — tap to expand */}
          <button type="button" onClick={() => setCicloOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left active:bg-[#f0efe9] transition-colors"
            style={{ WebkitTapHighlightColor: 'transparent' }}>

            <div className="flex-1 min-w-0 pr-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[9.5px] font-bold tracking-[0.09em] uppercase" style={{ color: '#5d6888' }}>Ciclo en curso</span>
                <span className="text-[9.5px] font-semibold px-[7px] py-[2px] rounded-full"
                  style={{ background: '#e8f9ef', color: '#1a9e60' }}>
                  próx. pago {fmtShortDate(cicloNextPayDate)}
                </span>
              </div>
              <div className="text-[22px] font-extrabold tabular-nums leading-none mb-2"
                style={{ color: '#1e2535', letterSpacing: '-0.02em' }}>
                {fmtCLP(cicloTotal)}
              </div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-[11px]" style={{ color: '#5d6888' }}>
                  Día {cicloDaysElapsed} de {cicloDaysTotal}
                </span>
                <span style={{ color: '#c8c5bc', fontSize: '9px' }}>●</span>
                <span className="text-[11px]" style={{ color: '#9ba5c2' }}>
                  {cicloDaysLeft} día{cicloDaysLeft !== 1 ? 's' : ''} restante{cicloDaysLeft !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="h-[5px] rounded-full overflow-hidden" style={{ background: '#e8e6df' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${(cicloDayRatio * 100).toFixed(1)}%`, background: 'linear-gradient(90deg, #28c47a 0%, #3dd68c 100%)' }}/>
              </div>
            </div>

            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              style={{ transform: cicloOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.22s ease', flexShrink: 0 }}>
              <path d="M6 9l6 6 6-6" stroke="#9ba5c2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Expandable body */}
          <div style={{ maxHeight: cicloOpen ? '700px' : 0, overflow: 'hidden', transition: 'max-height 0.35s ease' }}>
            <div className="px-4 pb-4">
              <div className="h-px mb-3" style={{ background: '#e8e6df' }}/>

              {/* Por medio de pago */}
              <div className="text-[10px] font-bold tracking-[0.07em] uppercase mb-1.5" style={{ color: '#9ba5c2' }}>
                Por medio de pago
              </div>
              {[
                { key: 'credito',  label: 'Crédito' },
                { key: 'debito',   label: 'Débito' },
                { key: 'efectivo', label: 'Efectivo' },
              ].filter(m => cicloByMedio[m.key] > 0).map(m => (
                <div key={m.key} className="flex justify-between items-center py-[5px]">
                  <span className="text-[13.5px]" style={{ color: '#4a5370' }}>{m.label}</span>
                  <span className="text-[13.5px] font-semibold tabular-nums" style={{ color: '#1e2535' }}>
                    {fmtCLP(cicloByMedio[m.key])}
                  </span>
                </div>
              ))}
              {Object.values(cicloByMedio).every(v => v === 0) && (
                <div className="py-2 text-[12px]" style={{ color: '#9ba5c2' }}>Sin gastos registrados en el ciclo</div>
              )}

              {/* Por banco / tarjeta */}
              {Object.keys(cicloByBank).length > 0 && (
                <>
                  <div className="h-px my-3" style={{ background: '#e8e6df' }}/>
                  <div className="text-[10px] font-bold tracking-[0.07em] uppercase mb-1.5" style={{ color: '#9ba5c2' }}>
                    Por banco / tarjeta
                  </div>
                  {Object.entries(cicloByBank)
                    .sort((a, b) => b[1] - a[1])
                    .map(([bankId, amt]) => {
                      const bc        = BANK_COLORS[bankId] ?? BANK_COLORS.default
                      const bankLabel = banks.find(b => b.id === bankId)?.label ?? bankId
                      return (
                        <div key={bankId} className="flex items-center justify-between py-[5px] gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: bc.stroke }}/>
                            <span className="text-[13.5px]" style={{ color: '#4a5370' }}>{bankLabel}</span>
                          </div>
                          <span className="text-[13.5px] font-semibold tabular-nums" style={{ color: '#1e2535' }}>
                            {fmtCLP(amt)}
                          </span>
                        </div>
                      )
                    })}
                </>
              )}

              {/* Footer */}
              <div className="h-px mt-3 mb-1" style={{ background: '#e8e6df' }}/>
              <div className="flex justify-between items-center py-2">
                <div>
                  <div className="text-[12px] font-bold" style={{ color: '#1e2535' }}>Total gastado</div>
                  <div className="text-[11px] mt-[1px]" style={{ color: '#9ba5c2' }}>ciclo actual</div>
                </div>
                <div className="text-[17px] font-extrabold tabular-nums" style={{ color: '#1e2535', letterSpacing: '-0.01em' }}>
                  {fmtCLP(cicloTotal)}
                </div>
              </div>
              {cicloByMedio.credito > 0 && (
                <div className="flex justify-between items-center py-2">
                  <div>
                    <div className="text-[12px] font-semibold" style={{ color: '#5d6888' }}>Estimado próx. pago</div>
                    <div className="text-[11px] mt-[1px]" style={{ color: '#9ba5c2' }}>
                      solo crédito · vence {fmtShortDate(cicloNextPayDate)}
                    </div>
                  </div>
                  <div className="text-[15px] font-semibold tabular-nums" style={{ color: '#5d6888', letterSpacing: '-0.01em' }}>
                    {fmtCLP(cicloByMedio.credito)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── BLOQUE 2: DESGLOSE POR BANCO ──────────────────── */}
      {cardNextPayments.length > 0 && (
        <>
          <SecHeader label="Próximo pago tarjetas" action="Ver cuentas" onAction={() => setView('accounts')}/>

          <div className="px-4 flex flex-col gap-2.5 pb-2">
            {cardNextPayments.map(({ card, nextPayDate, contadoAmount, cuotasAmount, cuotasCount, cardCharges, cargosTotal, comisionesRec, comisionesRecurrentes, totalAmount, cycleStart, cycleEnd }) => {
              const isOpen     = openBanks.has(card.id)
              const bc         = BANK_COLORS[card.bank] ?? BANK_COLORS.default
              const bankLabel  = banks.find(b => b.id === card.bank)?.label ?? card.bank ?? ''
              const payDateStr = fmtShortDate(nextPayDate)
              const cycleStr   = fmtCycle(cycleStart, cycleEnd)

              return (
                <div key={card.id} className="bg-white border border-[#e8e6df] rounded-2xl overflow-hidden"
                  style={{ boxShadow: '0 1px 3px rgba(30,37,53,0.05)' }}>

                  {/* Header row — tap to expand */}
                  <button type="button" onClick={() => toggleBank(card.id)}
                    className="w-full flex items-center justify-between px-4 py-3.5 text-left active:bg-[#f0efe9] transition-colors"
                    style={{ WebkitTapHighlightColor: 'transparent' }}>
                    <div className="flex items-center gap-3">
                      <CardIcon stroke={bc.stroke} bg={bc.bg}/>
                      <div>
                        <div className="text-[15px] font-bold" style={{ color: '#1e2535' }}>{card.name}</div>
                        <div className="text-[11px] mt-[1px]" style={{ color: '#5d6888' }}>
                          {bankLabel} · Vence {payDateStr}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-[17px] font-extrabold tabular-nums" style={{ color: '#1e2535', letterSpacing: '-0.01em' }}>
                          {fmtCLP(comisionesRecurrentes > 0 ? totalAmount + comisionesRecurrentes : totalAmount)}
                        </div>
                        {comisionesRecurrentes > 0 && (
                          <div className="text-[10px] tabular-nums" style={{ color: '#9ba5c2' }}>base {fmtCLP(totalAmount)}</div>
                        )}
                        <div className="text-[10px] mt-[1px]" style={{ color: '#5d6888' }}>
                          {comisionesRecurrentes > 0 ? 'est. incl. comisión fija' : cargosTotal > 0 ? 'incl. cargos del estado' : 'Total a pagar'}
                        </div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.22s ease', flexShrink: 0 }}>
                        <path d="M6 9l6 6 6-6" stroke="#9ba5c2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </button>

                  {/* Expandable body */}
                  <div style={{ maxHeight: isOpen ? '900px' : 0, overflow: 'hidden', transition: 'max-height 0.35s ease' }}>
                    <div className="px-4 pb-4">
                      <div className="h-px mb-1" style={{ background: '#e8e6df' }}/>

                      {/* Compras contado */}
                      {contadoAmount > 0 && (
                        <div className="flex justify-between items-center py-[5px] gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-[13.5px]" style={{ color: '#4a5370' }}>Compras contado</div>
                            <div className="text-[11px] mt-[1px]" style={{ color: '#5d6888' }}>{cycleStr}</div>
                          </div>
                          <div className="text-[13.5px] font-semibold tabular-nums whitespace-nowrap" style={{ color: '#1e2535' }}>
                            {fmtCLP(contadoAmount)}
                          </div>
                        </div>
                      )}

                      {/* Cuotas */}
                      {cuotasAmount > 0 && (
                        <div className="flex justify-between items-center py-[5px] gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-[13.5px]" style={{ color: '#4a5370' }}>Cuotas del mes</div>
                            <div className="text-[11px] mt-[1px]" style={{ color: '#5d6888' }}>{cuotasCount} activa{cuotasCount !== 1 ? 's' : ''}</div>
                          </div>
                          <div className="text-[13.5px] font-semibold tabular-nums whitespace-nowrap" style={{ color: '#1e2535' }}>
                            {fmtCLP(cuotasAmount)}
                          </div>
                        </div>
                      )}

                      {/* Variable charges from bank statement */}
                      {cardCharges.length > 0 && (
                        <>
                          <div className="h-px my-2" style={{ background: '#e8e6df' }}/>
                          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.05em] uppercase px-2 py-[3px] rounded-[6px] mb-2" style={{ background: '#fff7e6', color: '#b45309' }}>
                            <span className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: '#f59e0b' }}/>
                            Cargos del estado de cuenta
                          </div>
                          {cardCharges.map((c, ci) => (
                            <div key={ci} className="flex justify-between items-center py-[5px] gap-2">
                              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <ChargeBadge tipo={c.tipo}/>
                                <span className="text-[13px] truncate" style={{ color: '#4a5370' }}>
                                  {c.descripcion || CHARGE_LABEL[c.tipo] || 'Cargo'}
                                </span>
                              </div>
                              <div className="text-[13.5px] font-semibold tabular-nums whitespace-nowrap" style={{ color: '#1e2535' }}>
                                {fmtCLP(c.monto)}
                              </div>
                            </div>
                          ))}
                        </>
                      )}

                      {/* Empty state */}
                      {contadoAmount === 0 && cuotasAmount === 0 && cardCharges.length === 0 && (
                        <div className="py-3 text-[12px]" style={{ color: '#5d6888' }}>Sin movimientos registrados en el ciclo</div>
                      )}

                      {/* Subtotal */}
                      <div className="h-px mt-2 mb-1" style={{ background: '#e8e6df' }}/>
                      <div className="flex justify-between items-center py-2">
                        <div>
                          <div className="text-[12px] font-bold" style={{ color: comisionesRec.length > 0 ? '#9ba5c2' : '#1e2535' }}>
                            {comisionesRec.length > 0 ? 'Subtotal s/ comisión' : 'Total a pagar tarjeta'}
                          </div>
                          <div className="text-[11px] mt-[1px]" style={{ color: '#9ba5c2' }}>Vence {payDateStr}</div>
                        </div>
                        <div className="text-[17px] font-extrabold tabular-nums" style={{ color: comisionesRec.length > 0 ? '#9ba5c2' : '#1e2535', letterSpacing: '-0.01em' }}>
                          {fmtCLP(totalAmount)}
                        </div>
                      </div>

                      {/* Comisión fija block */}
                      {comisionesRec.length > 0 && (
                        <div className="rounded-[10px] border border-[#e8e6df] p-3 mt-1" style={{ background: '#f0efe9' }}>
                          {comisionesRec.map((r, ri) => (
                            <div key={ri} className={`flex items-center justify-between gap-2 ${ri < comisionesRec.length - 1 ? 'mb-2' : ''}`}>
                              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                <span className="text-[12.5px]" style={{ color: '#5d6888' }}>{r.name}</span>
                                <span className="text-[9.5px] font-bold px-[6px] py-[1px] rounded-[8px]"
                                  style={{ background: '#dddbd3', color: '#5d6888' }}>gastos fijos</span>
                              </div>
                              <span className="text-[12.5px] tabular-nums whitespace-nowrap shrink-0" style={{ color: '#5d6888' }}>
                                +{fmtCLP(r.amount)}
                              </span>
                            </div>
                          ))}
                          <div className="flex justify-between items-center mt-2 pt-2 border-t border-[#dddbd3]">
                            <span className="text-[13px] font-bold" style={{ color: '#1e2535' }}>
                              Total a pagar tarjeta
                            </span>
                            <span className="text-[16px] font-extrabold tabular-nums" style={{ color: '#1e2535', letterSpacing: '-0.01em' }}>
                              {fmtCLP(totalAmount + comisionesRecurrentes)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── BLOQUE 3: RECURRENTES FIJOS ───────────────────── */}
      <SecHeader label="Recurrentes fijos" action="Ver todos" onAction={() => setView('recurring')}/>
      <div className="px-4 pb-2">
        <div className="bg-white border border-[#e8e6df] rounded-2xl p-4" style={{ boxShadow: '0 1px 3px rgba(30,37,53,0.05)' }}>
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[10px] font-bold tracking-[0.08em] uppercase mb-1" style={{ color: '#5d6888' }}>Gastos fijos activos</div>
              <div className="text-[28px] font-extrabold leading-none tabular-nums" style={{ color: '#1e2535', letterSpacing: '-0.02em' }}>
                {fmtCLP(recurringTotal)}
              </div>
              <div className="text-[12px] mt-1.5" style={{ color: '#5d6888' }}>
                {activeRecurring.length} activo{activeRecurring.length !== 1 ? 's' : ''}
                {pausedRecurring.length > 0 && ` · ${pausedRecurring.length} pausado${pausedRecurring.length !== 1 ? 's' : ''}`}
              </div>
            </div>
            {recurringIncomeTotal > 0 && (
              <div className="text-[11px] font-bold px-2.5 py-[5px] rounded-[8px] whitespace-nowrap ml-3 shrink-0"
                style={{ background: '#1e2535', color: '#3dd68c' }}>
                vs {fmtCLPshort(recurringIncomeTotal)}
              </div>
            )}
          </div>

          {recurringIncomeTotal > 0 && (
            <div className="mt-3.5">
              <div className="h-[5px] rounded-full overflow-hidden" style={{ background: '#e8e6df' }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${(incomeRatio * 100).toFixed(1)}%`, background: 'linear-gradient(90deg, #3dd68c 0%, #28c47a 100%)' }}/>
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[10px]" style={{ color: '#5d6888' }}>{(incomeRatio * 100).toFixed(0)}% de ingresos recurrentes</span>
                <span className="text-[10px]" style={{ color: '#5d6888' }}>{fmtCLPshort(recurringIncomeTotal)}</span>
              </div>
            </div>
          )}

          {pausedRecurring.length > 0 && (
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {pausedRecurring.slice(0, 5).map(r => (
                <span key={r.id} className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border border-[#e8e6df]"
                  style={{ background: '#f0efe9', color: '#5d6888' }}>
                  ⏸ {r.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── BLOQUE 4: CUOTAS ──────────────────────────────── */}
      {activeDebts.length > 0 && (
        <>
          <SecHeader label="Cuotas activas" action="Ver todas" onAction={() => setView('installments')}/>
          <div className="px-4 pb-2">
            <div className="grid grid-cols-3 rounded-2xl overflow-hidden border border-[#e8e6df]"
              style={{ boxShadow: '0 1px 3px rgba(30,37,53,0.05)', gap: '1px', background: '#e8e6df' }}>
              <div className="bg-white px-2.5 py-3.5 text-center">
                <div className="text-[9px] font-bold tracking-[0.08em] uppercase mb-1.5" style={{ color: '#5d6888' }}>Este mes</div>
                <div className="text-[16px] font-extrabold tabular-nums leading-tight" style={{ color: '#28c47a', letterSpacing: '-0.01em' }}>
                  {fmtCLP(cuotasThisMonth)}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: '#5d6888' }}>{activeDebts.length} cuota{activeDebts.length !== 1 ? 's' : ''}</div>
              </div>
              <div className="bg-white px-2.5 py-3.5 text-center">
                <div className="text-[9px] font-bold tracking-[0.08em] uppercase mb-1.5" style={{ color: '#5d6888' }}>Próximo mes</div>
                <div className="text-[16px] font-extrabold tabular-nums leading-tight" style={{ color: '#1e2535', letterSpacing: '-0.01em' }}>
                  {fmtCLP(cuotasNextMonth)}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: '#5d6888' }}>estimado</div>
              </div>
              <div className="bg-white px-2.5 py-3.5 text-center">
                <div className="text-[9px] font-bold tracking-[0.08em] uppercase mb-1.5" style={{ color: '#5d6888' }}>Deuda restante</div>
                <div className="text-[13px] font-extrabold tabular-nums leading-tight" style={{ color: '#1e2535', letterSpacing: '-0.01em' }}>
                  {fmtCLP(totalRemainingDebt)}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: '#5d6888' }}>acumulado</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── BLOQUE 5: PRÓXIMO CICLO ───────────────────────── */}
      <SecHeader label="Próximo ciclo de pago" action="Ver detalle" onAction={() => setView('projection')}/>
      <div className="px-4 pb-8">
        <div className="bg-white border border-[#e8e6df] rounded-2xl p-4" style={{ boxShadow: '0 1px 3px rgba(30,37,53,0.05)' }}>

          <div className="text-[11px] font-semibold mb-3" style={{ color: '#9ba5c2' }}>{nextCycleLabel}</div>

          {[
            { dot: '#c8c5bc', label: 'Saldo base actual',     amt: '+' + fmtCLP(usableBalance),      color: '#9ba5c2' },
            { dot: '#3dd68c', label: 'Ingresos esperados',    amt: '+' + fmtCLP(monthlyIncome),       color: '#1a9e60' },
            { dot: '#f87171', label: 'Pago real de tarjetas', amt: '−' + fmtCLP(nextCycleCardTotal),  color: '#dc2626' },
            { dot: '#fb923c', label: 'Recurrentes fijos',     amt: '−' + fmtCLP(nextCycleRecurring),  color: '#dc2626' },
          ].map((row, i) => (
            <div key={i} className="flex justify-between items-center py-[5px]">
              <span className="flex items-center gap-1.5 text-[13px]" style={{ color: '#4a5370' }}>
                <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: row.dot }}/>
                {row.label}
              </span>
              <span className="text-[13px] font-semibold tabular-nums" style={{ color: row.color }}>{row.amt}</span>
            </div>
          ))}

          {/* Progress bar */}
          <div className="relative h-1.5 rounded-full overflow-hidden mt-4 mb-1.5" style={{ background: '#e8e6df' }}>
            <div className="absolute inset-0 rounded-full" style={{ background: '#3dd68c', opacity: 0.85 }}/>
            {monthlyIncome > 0 && (
              <div className="absolute left-0 top-0 h-full rounded-full transition-all"
                style={{ width: `${Math.min(nextCycleRatio * 100, 200)}%`, background: '#f87171', opacity: 0.8 }}/>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-[10px]" style={{ color: '#5d6888' }}>Egresos estimados</span>
            <span className="text-[10px]" style={{ color: '#5d6888' }}>Ingresos {fmtCLPshort(monthlyIncome)}</span>
          </div>

          {/* Result block */}
          <div className="mt-3 p-3.5 rounded-[10px] flex justify-between items-center" style={{ background: '#1e2535' }}>
            <div>
              <div className="text-[12.5px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                Saldo esperado después de pagos
              </div>
              <div className="text-[10.5px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{nextCycleLabel} · aprox.</div>
            </div>
            <div className="text-[20px] font-extrabold tabular-nums" style={{ color: nextCycleBalance >= 0 ? '#3dd68c' : '#f87171', letterSpacing: '-0.02em' }}>
              {nextCycleBalance >= 0 ? '+' : ''}{fmtCLP(nextCycleBalance)}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
