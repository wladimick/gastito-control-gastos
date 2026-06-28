import React, { useState, useMemo } from 'react'
import { Icon, fmtCLP, fmtCLPshort, MES } from '../lib/helpers'
import { useBanks } from '../services/banksService'

const CC_KEY = 'gastito_cc_v1'
const loadCCStmts = () => { try { return JSON.parse(localStorage.getItem(CC_KEY) || '[]') } catch { return [] } }

function monthDiff(startStr, endStr) {
  const [sy, sm] = startStr.split('-').map(Number)
  const [ey, em] = endStr.split('-').map(Number)
  return (ey - sy) * 12 + (em - sm)
}

// offset: 0=en_curso, -1=cerrada, +1=próxima, -2...=historial
function getCycle(today, offset, billingDay = 20, paymentDueDay = 5) {
  let bM = today.getMonth(), bY = today.getFullYear()
  if (today.getDate() <= billingDay) { bM--; if (bM < 0) { bM = 11; bY-- } }
  // JS Date auto-wraps month overflow
  const start   = new Date(bY, bM + offset, billingDay + 1)
  const end     = new Date(bY, bM + offset + 1, billingDay)
  const payDate = new Date(bY, bM + offset + 2, paymentDueDay)
  const billingMonthStr = `${payDate.getFullYear()}-${String(payDate.getMonth() + 1).padStart(2, '0')}`
  return { start, end, payDate, billingMonthStr }
}

function fmtDate(d) { return `${d.getDate()} ${MES[d.getMonth()]} ${d.getFullYear()}` }
function fmtShort(d) { return `${d.getDate()} ${MES[d.getMonth()]}` }
function fmtYM(d) { return `${MES[d.getMonth()]} ${d.getFullYear()}` }

const BANK_COLORS = {
  bchile:     { stroke: '#3b82f6', bg: '#dbeafe' },
  bfalabella: { stroke: '#16a34a', bg: '#dcfce7' },
  bsantander: { stroke: '#dc2626', bg: '#fee2e2' },
  bestado:    { stroke: '#7c3aed', bg: '#ede9fe' },
  bci:        { stroke: '#d97706', bg: '#fef3c7' },
  default:    { stroke: '#6b7280', bg: '#f1f5f9' },
}

const CHARGE_META = {
  cargo_internacional: { label: 'Internacional', bg: '#fff7e6', color: '#b45309' },
  impuesto:            { label: 'Impuesto',       bg: '#f5f0ff', color: '#6d28d9' },
  interes:             { label: 'Interés',         bg: '#fff1f1', color: '#b91c1c' },
  comision:            { label: 'Comisión',        bg: '#f0f4f8', color: '#374151' },
  otro:                { label: 'Cargo extra',     bg: '#f3f4f6', color: '#374151' },
}

function CardIcon({ bank }) {
  const c = BANK_COLORS[bank] ?? BANK_COLORS.default
  return (
    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: c.bg }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="5" width="20" height="14" rx="2.5" stroke={c.stroke} strokeWidth="1.8"/>
        <path d="M2 9h20" stroke={c.stroke} strokeWidth="1.8"/>
        <path d="M6 14h5" stroke={c.stroke} strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="17" cy="14" r="1.5" fill={c.stroke}/>
      </svg>
    </div>
  )
}

function ChargeBadge({ tipo }) {
  const m = CHARGE_META[tipo] ?? CHARGE_META.otro
  return (
    <span className="text-[10px] font-bold px-1.5 py-[2px] rounded whitespace-nowrap"
      style={{ background: m.bg, color: m.color }}>
      {m.label}
    </span>
  )
}

function StatChip({ label, value, muted }) {
  return (
    <div className="flex-1 min-w-0 bg-[var(--bg)] border border-[var(--line)] rounded-xl p-3">
      <div className={`text-[10px] uppercase tracking-[0.1em] font-semibold mb-1 ${muted ? 'text-[var(--muted)]' : 'text-[var(--muted)]'}`}>
        {label}
      </div>
      <div className="font-mono text-[14px] font-bold leading-none truncate">{value}</div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-[var(--muted)] px-1 mt-3 mb-1.5">
      {children}
    </div>
  )
}

function EmptyRow({ label }) {
  return (
    <div className="text-[12px] text-[var(--muted)] px-1 py-1.5 italic">{label}</div>
  )
}

function ExpenseRow({ e }) {
  const d = new Date(e.date)
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-[var(--line)] last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium leading-tight truncate">{e.description}</div>
        <div className="text-[11px] text-[var(--muted)] mt-0.5">{fmtShort(d)}</div>
      </div>
      <div className="font-mono text-[13px] font-semibold shrink-0">{fmtCLP(e.amount)}</div>
    </div>
  )
}

function InstallmentRow({ debt }) {
  const instN = debt.paid + 1
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-[var(--line)] last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium leading-tight truncate">{debt.description}</div>
        <div className="text-[11px] text-[var(--muted)] mt-0.5">
          Cuota {instN}/{debt.installments}
        </div>
      </div>
      <div className="font-mono text-[13px] font-semibold shrink-0">{fmtCLP(debt.monthlyAmount)}</div>
    </div>
  )
}

function ChargeRow({ charge }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-[var(--line)] last:border-0">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <ChargeBadge tipo={charge.tipo}/>
        <div className="text-[13px] font-medium leading-tight truncate">{charge.descripcion}</div>
      </div>
      <div className="font-mono text-[13px] font-semibold shrink-0">{fmtCLP(Number(charge.monto))}</div>
    </div>
  )
}

function CardSection({ cardData, expanded, onToggle, showCharges = true }) {
  const { card, bankName, expenses, installments, charges, totalCredito, totalCuotas, totalCargos, cardTotal } = cardData
  const c = BANK_COLORS[card.bank] ?? BANK_COLORS.default
  const hasContent = expenses.length > 0 || installments.length > 0 || (showCharges && charges.length > 0)

  return (
    <div className="bg-[var(--bg-elev)] border border-[var(--line)] rounded-xl overflow-hidden">
      {/* Card header */}
      <button className="w-full flex items-center gap-3 p-4" onClick={onToggle}>
        <CardIcon bank={card.bank}/>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[14px] font-semibold leading-tight">{card.name || bankName}</div>
          <div className="text-[11px] text-[var(--muted)] mt-0.5">
            {card.lastFour ? `···· ${card.lastFour}` : bankName}
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="font-mono text-[15px] font-bold">{fmtCLP(cardTotal)}</div>
          <Icon name={expanded ? 'chevdown' : 'chevron'} size={14} className="text-[var(--muted)]"/>
        </div>
      </button>

      {/* Summary strip when collapsed */}
      {!expanded && cardTotal > 0 && (
        <div className="flex gap-0 border-t border-[var(--line)] divide-x divide-[var(--line)]">
          {totalCredito > 0 && (
            <div className="flex-1 px-3 py-2 text-center">
              <div className="text-[9.5px] uppercase tracking-[0.1em] text-[var(--muted)]">Crédito</div>
              <div className="font-mono text-[12px] font-semibold mt-0.5">{fmtCLPshort(totalCredito)}</div>
            </div>
          )}
          {totalCuotas > 0 && (
            <div className="flex-1 px-3 py-2 text-center">
              <div className="text-[9.5px] uppercase tracking-[0.1em] text-[var(--muted)]">Cuotas</div>
              <div className="font-mono text-[12px] font-semibold mt-0.5">{fmtCLPshort(totalCuotas)}</div>
            </div>
          )}
          {showCharges && totalCargos > 0 && (
            <div className="flex-1 px-3 py-2 text-center">
              <div className="text-[9.5px] uppercase tracking-[0.1em] text-[var(--muted)]">Cargos</div>
              <div className="font-mono text-[12px] font-semibold mt-0.5">{fmtCLPshort(totalCargos)}</div>
            </div>
          )}
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-[var(--line)] px-4 pb-4">
          {/* Compras crédito */}
          <SectionLabel>Compras crédito</SectionLabel>
          {expenses.length === 0
            ? <EmptyRow label="Sin compras en este ciclo"/>
            : expenses.map(e => <ExpenseRow key={e.id} e={e}/>)
          }

          {/* Cuotas */}
          <SectionLabel>Cuotas</SectionLabel>
          {installments.length === 0
            ? <EmptyRow label="Sin cuotas en este período"/>
            : installments.map(d => <InstallmentRow key={d.id} debt={d}/>)
          }

          {/* Cargos */}
          {showCharges && (
            <>
              <SectionLabel>Cargos de tarjeta</SectionLabel>
              {charges.length === 0
                ? <EmptyRow label="Sin cargos adicionales"/>
                : charges.map((c, i) => <ChargeRow key={i} charge={c}/>)
              }
            </>
          )}

          {/* Card subtotal */}
          <div className="mt-3 pt-3 border-t border-[var(--line)] flex justify-between items-center">
            <span className="text-[12px] font-semibold text-[var(--muted)]">Subtotal tarjeta</span>
            <span className="font-mono text-[15px] font-bold">{fmtCLP(cardTotal)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function CycleHeader({ cycle, tab }) {
  const { start, end, payDate } = cycle
  const today = new Date()
  const isPast = end < today
  const isFuture = start > today
  const daysUntilPay = Math.ceil((payDate - today) / 86400000)

  let badge, badgeClass
  if (tab === 'en_curso') {
    badge = 'En curso'
    badgeClass = 'bg-[var(--accent-soft)] text-[var(--accent-ink)]'
  } else if (tab === 'proxima') {
    badge = 'Próxima'
    badgeClass = 'bg-[#e8f3fd] text-[#1e4e8a]'
  } else if (isPast && daysUntilPay > 0) {
    badge = `Paga en ${daysUntilPay}d`
    badgeClass = 'bg-[var(--amber-soft)] text-[var(--amber-ink)]'
  } else if (isPast && daysUntilPay <= 0) {
    badge = 'Pagada'
    badgeClass = 'bg-[var(--accent-soft)] text-[var(--accent-ink)]'
  } else {
    badge = 'Cerrada'
    badgeClass = 'bg-[var(--hover)] text-[var(--ink-2)]'
  }

  return (
    <div className="bg-[var(--bg-elev)] border border-[var(--line)] rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] font-semibold mb-1.5">
            Ciclo de facturación
          </div>
          <div className="text-[16px] font-bold leading-tight">
            {fmtShort(start)} – {fmtShort(end)} {end.getFullYear()}
          </div>
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-[5px] rounded-full whitespace-nowrap ${badgeClass}`}>
          {badge}
        </span>
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--line)] flex items-center gap-2 text-[13px]">
        <Icon name="calendar" size={13} className="text-[var(--muted)] shrink-0"/>
        <span className="text-[var(--muted)]">Fecha de pago estimada:</span>
        <span className="font-semibold">{fmtDate(payDate)}</span>
      </div>
    </div>
  )
}

function CycleProgress({ data }) {
  const { start, end } = data.cycle
  const { daysElapsed, daysTotal, daysLeft, progress } = data

  return (
    <div className="bg-[var(--bg-elev)] border border-[var(--line)] rounded-xl p-4">
      <div className="flex items-center justify-between text-[12px] mb-2">
        <span className="text-[var(--muted)]">Progreso del ciclo</span>
        <span className="font-semibold">{daysLeft} días restantes</span>
      </div>
      <div className="h-2 bg-[var(--line)] rounded-full overflow-hidden">
        <div className="h-full bg-[var(--accent)] rounded-full transition-all"
          style={{ width: `${Math.min(100, progress * 100).toFixed(1)}%` }}/>
      </div>
      <div className="flex justify-between text-[10.5px] text-[var(--muted)] mt-1.5">
        <span>{fmtShort(start)}</span>
        <span className="font-mono">{daysElapsed}/{daysTotal} días</span>
        <span>{fmtShort(end)}</span>
      </div>
    </div>
  )
}

function CycleView({ data, tab, expandedCards, toggleCard, onBack }) {
  const { cycle, cardsData, grandTotal, grandCredito, grandCuotas, grandCargos } = data
  const showCharges = tab !== 'proxima' // próxima: no charges yet

  return (
    <div className="space-y-3">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-[var(--muted)] hover:text-[var(--ink)] transition">
          <Icon name="chevron" size={13} className="rotate-180"/>
          Volver al historial
        </button>
      )}

      <CycleHeader cycle={cycle} tab={tab}/>

      {tab === 'en_curso' && <CycleProgress data={data}/>}

      {/* Global summary */}
      <div>
        <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)] font-semibold px-1 mb-2">
          Resumen total
        </div>
        <div className="bg-[var(--bg-elev)] border border-[var(--line)] rounded-xl p-4">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[12px] text-[var(--muted)]">Total estimado</span>
            <span className="font-mono text-[22px] font-bold">{fmtCLP(grandTotal)}</span>
          </div>
          <div className="flex gap-2">
            <StatChip label="Crédito" value={fmtCLPshort(grandCredito)}/>
            <StatChip label="Cuotas" value={fmtCLPshort(grandCuotas)}/>
            {showCharges && <StatChip label="Cargos" value={fmtCLPshort(grandCargos)}/>}
          </div>
        </div>
      </div>

      {/* Per-card sections */}
      {cardsData.length === 0 ? (
        <div className="bg-[var(--bg-elev)] border border-[var(--line)] rounded-xl p-6 text-center">
          <Icon name="card" size={28} className="text-[var(--muted)] mx-auto mb-2"/>
          <div className="text-[13px] text-[var(--muted)]">No hay tarjetas de crédito configuradas</div>
        </div>
      ) : (
        <>
          <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)] font-semibold px-1 mt-1">
            Detalle por tarjeta
          </div>
          <div className="space-y-2">
            {cardsData.map(cd => (
              <CardSection
                key={cd.card.id}
                cardData={cd}
                expanded={expandedCards.has(cd.card.id)}
                onToggle={() => toggleCard(cd.card.id)}
                showCharges={showCharges}
              />
            ))}
          </div>
        </>
      )}

      {tab === 'proxima' && (
        <div className="flex items-start gap-2 bg-[var(--bg-elev)] border border-[var(--line)] rounded-xl p-3">
          <Icon name="info" size={14} className="text-[var(--muted)] shrink-0 mt-0.5"/>
          <p className="text-[12px] text-[var(--muted)] leading-relaxed">
            La próxima factura muestra cuotas proyectadas. Las compras de este ciclo aparecerán a medida que se registren.
          </p>
        </div>
      )}
    </div>
  )
}

function HistorialList({ cycles, onSelect }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)] font-semibold px-1 mb-1">
        Últimos 12 ciclos
      </div>
      {cycles.map(({ offset, cycle, grandTotal, grandCredito, grandCuotas, grandCargos, cardsData }) => {
        const today = new Date()
        const daysUntilPay = Math.ceil((cycle.payDate - today) / 86400000)
        const isPaid = daysUntilPay <= -1
        return (
          <button key={offset}
            onClick={() => onSelect(offset)}
            className="w-full bg-[var(--bg-elev)] border border-[var(--line)] rounded-xl p-4 text-left hover:bg-[var(--hover)] transition">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[13px] font-semibold">
                  {fmtShort(cycle.start)} – {fmtShort(cycle.end)} {cycle.end.getFullYear()}
                </div>
                <div className="text-[11px] text-[var(--muted)] mt-0.5 flex items-center gap-1.5">
                  <Icon name="calendar" size={11}/>
                  Pago: {fmtDate(cycle.payDate)}
                  {isPaid
                    ? <span className="ml-1 text-[var(--accent-ink)] font-semibold">· Pagada</span>
                    : daysUntilPay > 0
                      ? <span className="ml-1 text-[var(--amber-ink)] font-semibold">· en {daysUntilPay}d</span>
                      : null
                  }
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <div className="text-right">
                  <div className="font-mono text-[15px] font-bold">{fmtCLP(grandTotal)}</div>
                  <div className="text-[10px] text-[var(--muted)] mt-0.5">
                    {grandCredito > 0 && `Cred ${fmtCLPshort(grandCredito)}`}
                    {grandCuotas > 0 && ` · Cuot ${fmtCLPshort(grandCuotas)}`}
                  </div>
                </div>
                <Icon name="chevron" size={14} className="text-[var(--muted)]"/>
              </div>
            </div>
            {/* Mini per-card dots */}
            {cardsData.filter(c => c.cardTotal > 0).length > 1 && (
              <div className="flex gap-3 mt-2.5 pt-2.5 border-t border-[var(--line)]">
                {cardsData.filter(c => c.cardTotal > 0).map(cd => {
                  const col = BANK_COLORS[cd.card.bank] ?? BANK_COLORS.default
                  return (
                    <div key={cd.card.id} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: col.stroke }}/>
                      <span className="text-[11px] text-[var(--muted)]">{cd.card.name || cd.bankName}</span>
                      <span className="font-mono text-[11px] font-semibold">{fmtCLPshort(cd.cardTotal)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Main export ──────────────────────────────────────────────────────────────
export default function Billing({ expenses = [], installmentDebts = [], creditCards = [], recurringList = [] }) {
  const today = useMemo(() => new Date(), [])
  const banks = useBanks()
  const ccStmts = useMemo(() => loadCCStmts(), [])
  const [tab, setTab] = useState('en_curso')
  const [expandedCards, setExpandedCards] = useState(new Set())
  const [historialDetail, setHistorialDetail] = useState(null)

  const activeCards = useMemo(() => creditCards.filter(c => c.isActive !== false), [creditCards])
  const activeDebts = useMemo(() => installmentDebts.filter(d => d.status === 'active'), [installmentDebts])

  const toggleCard = id => setExpandedCards(p => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const computeCycleData = (offset) => {
    const cycle = getCycle(today, offset)
    const { start, end } = cycle
    const startTs = start.getTime()
    const endTs   = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59).getTime()

    const cardsData = activeCards.map(card => {
      const bd = Number(card.billingDay ?? 20)
      const pd = Number(card.paymentDueDay ?? 5)
      const cc = (bd === 20 && pd === 5) ? cycle : getCycle(today, offset, bd, pd)
      const csTs = cc.start.getTime()
      const ceTs = new Date(cc.end.getFullYear(), cc.end.getMonth(), cc.end.getDate(), 23, 59, 59).getTime()

      const cardExpenses = expenses.filter(e =>
        e.type === 'credito' &&
        (!card.bank || e.bank === card.bank) &&
        (e.installments ?? 1) <= 1 &&
        (() => { const ts = new Date(e.date).getTime(); return ts >= csTs && ts <= ceTs })()
      )
      const cardInstallments = activeDebts.filter(d =>
        (!card.bank || d.bank === card.bank) &&
        d.startMonth &&
        (() => { const el = monthDiff(d.startMonth, cc.billingMonthStr); return el >= 0 && el < d.installments })()
      )
      const stmts = ccStmts.filter(s =>
        s.bankId === card.bank && (s.month || s.dueDate?.slice(0, 7)) === cc.billingMonthStr
      )
      const charges = stmts.flatMap(st =>
        st.charges?.length > 0 ? st.charges
        : st.cargosComisiones > 0 ? [{ tipo: 'otro', descripcion: 'Cargos y comisiones', monto: st.cargosComisiones }]
        : []
      )
      const totalCredito = cardExpenses.reduce((s, e) => s + (e.amount || 0), 0)
      const totalCuotas  = cardInstallments.reduce((s, d) => s + (d.monthlyAmount || 0), 0)
      const totalCargos  = charges.reduce((s, c) => s + (Number(c.monto) || 0), 0)

      return {
        card, bankName: banks.find(b => b.id === card.bank)?.name ?? card.name ?? card.bank ?? '—',
        cycle: cc, expenses: cardExpenses, installments: cardInstallments, charges,
        totalCredito, totalCuotas, totalCargos,
        cardTotal: totalCredito + totalCuotas + totalCargos,
      }
    })

    const grandTotal   = cardsData.reduce((s, c) => s + c.cardTotal, 0)
    const grandCredito = cardsData.reduce((s, c) => s + c.totalCredito, 0)
    const grandCuotas  = cardsData.reduce((s, c) => s + c.totalCuotas, 0)
    const grandCargos  = cardsData.reduce((s, c) => s + c.totalCargos, 0)

    const cycleMs     = end.getTime() - start.getTime()
    const elapsedMs   = Math.max(0, Math.min(today.getTime() - start.getTime(), cycleMs))
    const daysTotal   = Math.round(cycleMs / 86400000) + 1
    const daysElapsed = Math.min(Math.round(elapsedMs / 86400000) + 1, daysTotal)

    return {
      cycle, cardsData,
      grandTotal, grandCredito, grandCuotas, grandCargos,
      progress: cycleMs > 0 ? elapsedMs / cycleMs : 0,
      daysTotal, daysElapsed, daysLeft: daysTotal - daysElapsed,
      isPast: end < today, isFuture: start > today,
    }
  }

  const tabOffset = tab === 'en_curso' ? 0 : tab === 'proxima' ? 1 : tab === 'cerrada' ? -1 : null
  const mainData = useMemo(
    () => tabOffset !== null ? computeCycleData(tabOffset) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tabOffset, expenses, installmentDebts, creditCards, ccStmts, banks.length]
  )

  const historialCycles = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ offset: -(i + 2), ...computeCycleData(-(i + 2)) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expenses, installmentDebts, creditCards, ccStmts, banks.length]
  )

  const historialSelectedData = useMemo(
    () => historialDetail !== null ? computeCycleData(historialDetail) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [historialDetail, expenses, installmentDebts, creditCards, ccStmts, banks.length]
  )

  const TABS = [
    { id: 'en_curso',  label: 'En curso' },
    { id: 'cerrada',   label: 'Cerrada' },
    { id: 'proxima',   label: 'Próxima' },
    { id: 'historial', label: 'Historial' },
  ]

  return (
    <div className="space-y-4 max-w-xl">
      {/* Tab bar */}
      <div className="flex gap-1 bg-[var(--bg-elev)] border border-[var(--line)] rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.id}
            onClick={() => { setTab(t.id); setHistorialDetail(null) }}
            className={`flex-1 text-[12px] font-semibold py-2 rounded-lg transition
              ${tab === t.id
                ? 'bg-[var(--ink)] text-[var(--bg)]'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Cycle views */}
      {tab !== 'historial' && mainData && (
        <CycleView
          data={mainData}
          tab={tab}
          expandedCards={expandedCards}
          toggleCard={toggleCard}
        />
      )}

      {/* Historial */}
      {tab === 'historial' && (
        historialDetail !== null && historialSelectedData
          ? <CycleView
              data={historialSelectedData}
              tab="historial"
              expandedCards={expandedCards}
              toggleCard={toggleCard}
              onBack={() => setHistorialDetail(null)}
            />
          : <HistorialList cycles={historialCycles} onSelect={setHistorialDetail}/>
      )}
    </div>
  )
}
