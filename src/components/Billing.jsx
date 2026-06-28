import React, { useState, useMemo } from 'react'
import { Icon, fmtCLP, fmtCLPshort, MES } from '../lib/helpers'
import { useBanks } from '../services/banksService'

// ── Constants ────────────────────────────────────────────────────────────────
const CC_KEY = 'gastito_cc_v1'
const loadCCStmts = () => { try { return JSON.parse(localStorage.getItem(CC_KEY) || '[]') } catch { return [] } }

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

const SOURCE_LABELS = { manual: 'Manual', csv: 'CSV', excel: 'Excel', pdf: 'PDF' }

// ── Cycle helpers ────────────────────────────────────────────────────────────

function monthDiff(startStr, endStr) {
  const [sy, sm] = startStr.split('-').map(Number)
  const [ey, em] = endStr.split('-').map(Number)
  return (ey - sy) * 12 + (em - sm)
}

// Per-card cycle. billingDay = close day, billingStartDay = first day (defaults to billingDay+1).
// offset: 0=en_curso, -1=cerrada, +1=próxima
function getCycleForCard(today, card, offset) {
  const endDay   = Number(card.billingDay   ?? 20)
  const startDay = Number(card.billingStartDay ?? (endDay + 1))
  const payDay   = Number(card.paymentDueDay ?? 5)

  // Determine base close-month: if today is still before or on endDay, cycle closes this month
  let bM = today.getMonth(), bY = today.getFullYear()
  if (today.getDate() <= endDay) { bM--; if (bM < 0) { bM = 11; bY-- } }

  // JS Date auto-wraps month overflow
  const start   = new Date(bY, bM + offset,     startDay)
  const end     = new Date(bY, bM + offset + 1, endDay)
  const payDate = new Date(bY, bM + offset + 2, payDay)
  const billingMonthStr = `${payDate.getFullYear()}-${String(payDate.getMonth() + 1).padStart(2, '0')}`

  return { start, end, payDate, billingMonthStr }
}

// Reference cycle for the tab header (uses first active card or global default)
function getReferenceCycle(today, cards, offset) {
  const ref = cards.find(c => c.isActive !== false) ?? { billingDay: 20, billingStartDay: 21, paymentDueDay: 5 }
  return getCycleForCard(today, ref, offset)
}

function fmtDate(d) { return `${d.getDate()} ${MES[d.getMonth()]} ${d.getFullYear()}` }
function fmtShort(d) { return `${d.getDate()} ${MES[d.getMonth()]}` }

// ── CSV export ───────────────────────────────────────────────────────────────
function exportCSV(cardsData, cycleKey) {
  const hdr = ['ciclo','tarjeta','tipo','fecha','descripcion','cuota','monto','origen','periodo_inicio','periodo_fin','fecha_pago']
  const rows = [hdr]
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`

  cardsData.forEach(({ card, bankName, cycle, expenses, installments, charges, billedStmt }) => {
    const name = card.name || bankName
    const pi   = cycle.start.toISOString().slice(0, 10)
    const pf   = cycle.end.toISOString().slice(0, 10)
    const fp   = cycle.payDate.toISOString().slice(0, 10)

    expenses.forEach(e => rows.push([
      cycleKey, name, 'Compra crédito', e.date?.slice(0,10) ?? '',
      e.description, '', e.amount, 'gasto', pi, pf, fp
    ]))
    installments.forEach(d => rows.push([
      cycleKey, name, 'Cuota', '',
      d.description, `${d.paid+1}/${d.installments}`, d.monthlyAmount, 'cuotas', pi, pf, fp
    ]))
    charges.forEach(c => rows.push([
      cycleKey, name, 'Cargo tarjeta', '',
      c.descripcion, c.tipo, Number(c.monto), 'cargo', pi, pf, fp
    ]))
    if (billedStmt?.realBilledAmount) rows.push([
      cycleKey, name, 'Facturado real', '',
      'Total estado de cuenta', billedStmt.source ?? 'manual', billedStmt.realBilledAmount, 'estado_cuenta', pi, pf, fp
    ])
  })

  const csv = rows.map(r => r.map(q).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `gastito_facturacion_${cycleKey}.csv`
  a.click(); URL.revokeObjectURL(url)
}

// ── Small UI helpers ─────────────────────────────────────────────────────────

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
      style={{ background: m.bg, color: m.color }}>{m.label}</span>
  )
}

function SL({ children }) {
  return <div className="text-[10px] uppercase tracking-[0.1em] font-bold text-[var(--muted)] mt-3 mb-1.5">{children}</div>
}

// ── Real-billed inline form ──────────────────────────────────────────────────
function RealBilledForm({ existing, estimatedAmount, onSave, onCancel, onDelete }) {
  const [amount, setAmount] = useState(existing?.realBilledAmount ? String(existing.realBilledAmount) : '')
  const [minPay, setMinPay] = useState(existing?.minimumPayment  ? String(existing.minimumPayment)  : '')
  const [source, setSource] = useState(existing?.source ?? 'manual')
  const [notes,  setNotes]  = useState(existing?.notes  ?? '')

  const inp = 'w-full text-[13px] bg-[var(--bg)] border border-[var(--line)] rounded-lg px-3 h-10 focus:outline-none focus:ring-1 focus:ring-[var(--accent)] font-mono'
  const valid = amount.trim() !== '' && !isNaN(Number(amount)) && Number(amount) > 0

  return (
    <div className="mt-3 border-t border-[var(--line)] pt-3 space-y-2.5">
      <div className="text-[11px] font-bold text-[var(--muted)] uppercase tracking-[0.1em]">
        {existing ? 'Editar facturado real' : 'Registrar facturado real'}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[11px] text-[var(--muted)] mb-1">Monto facturado *</div>
          <input type="number" className={inp} value={amount}
            onChange={e => setAmount(e.target.value)} placeholder="627460"/>
        </div>
        <div>
          <div className="text-[11px] text-[var(--muted)] mb-1">Pago mínimo</div>
          <input type="number" className={inp} value={minPay}
            onChange={e => setMinPay(e.target.value)} placeholder="Opcional"/>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[11px] text-[var(--muted)] mb-1">Fuente</div>
          <select className={inp} value={source} onChange={e => setSource(e.target.value)}>
            {Object.entries(SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <div className="text-[11px] text-[var(--muted)] mb-1">Nota</div>
          <input className={inp} value={notes}
            onChange={e => setNotes(e.target.value)} placeholder="Opcional"/>
        </div>
      </div>
      {estimatedAmount > 0 && (
        <div className="text-[11px] text-[var(--muted)]">
          Estimado: <span className="font-mono font-semibold">{fmtCLP(estimatedAmount)}</span>
          {amount && !isNaN(Number(amount)) && Number(amount) > 0 && (
            <>
              {' '}· Dif: <span className={`font-mono font-semibold ${estimatedAmount - Number(amount) >= 0 ? 'text-[var(--accent-ink)]' : 'text-red-500'}`}>
                {estimatedAmount - Number(amount) >= 0 ? '+' : ''}{fmtCLP(estimatedAmount - Number(amount))}
              </span>
            </>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 pt-1">
        <button onClick={() => valid && onSave({
          realBilledAmount: Number(amount),
          minimumPayment: minPay ? Number(minPay) : null,
          source, notes,
        })} disabled={!valid}
          className="flex-1 h-9 text-[13px] font-semibold rounded-lg bg-[var(--ink)] text-[var(--bg)] disabled:opacity-40">
          Guardar
        </button>
        <button onClick={onCancel}
          className="h-9 px-4 text-[13px] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)] rounded-lg">
          Cancelar
        </button>
        {existing && (
          <button onClick={onDelete} className="h-9 px-3 border border-red-200 text-red-500 rounded-lg hover:bg-red-50">
            <Icon name="trash" size={14}/>
          </button>
        )}
      </div>
    </div>
  )
}

// ── Card section ─────────────────────────────────────────────────────────────
function CardSection({ cardData, expanded, onToggle, showReal, onUpsertBilled, onDeleteBilled }) {
  const { card, bankName, cycle, expenses, installments, charges,
          totalCredito, totalCuotas, totalCargos, estimatedTotal, billedStmt } = cardData
  const [editingBilled, setEditingBilled] = useState(false)

  const realAmount = billedStmt?.realBilledAmount ?? null
  const diff = realAmount !== null ? estimatedTotal - realAmount : null
  const displayTotal = realAmount ?? estimatedTotal
  const hasBilled = realAmount !== null

  function handleSave(fields) {
    onUpsertBilled({
      cardId: card.id,
      cycleKey: cycle.billingMonthStr,
      periodStart: cycle.start.toISOString().slice(0, 10),
      periodEnd:   cycle.end.toISOString().slice(0, 10),
      dueDate:     cycle.payDate.toISOString().slice(0, 10),
      estimatedAmount: estimatedTotal,
      ...fields,
    })
    setEditingBilled(false)
  }

  function handleDelete() {
    onDeleteBilled(card.id, cycle.billingMonthStr)
    setEditingBilled(false)
  }

  return (
    <div className="bg-[var(--bg-elev)] border border-[var(--line)] rounded-xl overflow-hidden">
      {/* Header */}
      <button className="w-full flex items-center gap-3 p-4" onClick={onToggle}>
        <CardIcon bank={card.bank}/>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-[14px] font-semibold leading-tight">{card.name || bankName}</div>
          <div className="text-[11px] text-[var(--muted)] mt-0.5">
            {card.lastFour ? `···· ${card.lastFour}` : bankName}
            {' · '}{fmtShort(cycle.start)} – {fmtShort(cycle.end)}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className="font-mono text-[15px] font-bold">{fmtCLP(displayTotal)}</div>
            {showReal && hasBilled && (
              <div className={`text-[10px] font-mono ${diff >= 0 ? 'text-[var(--accent-ink)]' : 'text-red-500'}`}>
                {diff >= 0 ? '↑ est ' : '↓ real '}
                {diff >= 0 ? '+' : ''}{fmtCLPshort(diff)}
              </div>
            )}
          </div>
          <Icon name={expanded ? 'chevdown' : 'chevron'} size={14} className="text-[var(--muted)]"/>
        </div>
      </button>

      {/* Summary strip when collapsed */}
      {!expanded && estimatedTotal > 0 && (
        <div className="flex border-t border-[var(--line)] divide-x divide-[var(--line)]">
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
          {totalCargos > 0 && (
            <div className="flex-1 px-3 py-2 text-center">
              <div className="text-[9.5px] uppercase tracking-[0.1em] text-[var(--muted)]">Cargos</div>
              <div className="font-mono text-[12px] font-semibold mt-0.5">{fmtCLPshort(totalCargos)}</div>
            </div>
          )}
        </div>
      )}

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-[var(--line)] px-4 pb-4">
          {/* Comparison block (cerrada / historial) */}
          {showReal && (
            <div className="mt-3 rounded-xl border border-[var(--line)] overflow-hidden">
              <div className="px-3 py-2 bg-[var(--bg)] border-b border-[var(--line)] flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Comparación
                </span>
                {hasBilled && !editingBilled && (
                  <button onClick={() => setEditingBilled(true)}
                    className="text-[11px] text-[var(--muted)] hover:text-[var(--ink)] flex items-center gap-1">
                    <Icon name="pencil" size={11}/> Editar
                  </button>
                )}
              </div>
              <div className="px-3 py-2 space-y-1.5">
                <div className="flex justify-between text-[12px]">
                  <span className="text-[var(--muted)]">Estimado Gastito</span>
                  <span className="font-mono font-semibold">{fmtCLP(estimatedTotal)}</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-[var(--muted)]">Facturado real</span>
                  {hasBilled ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] bg-[var(--accent-soft)] text-[var(--accent-ink)] px-1.5 py-[2px] rounded font-bold uppercase">
                        {SOURCE_LABELS[billedStmt.source] ?? billedStmt.source}
                      </span>
                      <span className="font-mono font-semibold">{fmtCLP(realAmount)}</span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-[var(--muted)] italic">Sin registrar</span>
                  )}
                </div>
                {hasBilled && (
                  <div className="flex justify-between text-[12px] pt-1 border-t border-[var(--line)]">
                    <span className="text-[var(--muted)]">Diferencia</span>
                    <span className={`font-mono font-bold ${diff >= 0 ? 'text-[var(--accent-ink)]' : 'text-red-500'}`}>
                      {diff >= 0 ? '+' : ''}{fmtCLP(diff)}
                      <span className="text-[10px] font-normal ml-1">
                        {diff >= 0 ? '(sobreestimado)' : '(subestimado)'}
                      </span>
                    </span>
                  </div>
                )}
                {billedStmt?.minimumPayment && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[var(--muted)]">Pago mínimo</span>
                    <span className="font-mono">{fmtCLP(billedStmt.minimumPayment)}</span>
                  </div>
                )}
              </div>

              {!hasBilled && !editingBilled && (
                <div className="border-t border-[var(--line)] px-3 py-2">
                  <button onClick={() => setEditingBilled(true)}
                    className="w-full h-8 text-[12px] font-medium text-[var(--accent-ink)] bg-[var(--accent-soft)] rounded-lg hover:opacity-80 transition">
                    + Ingresar facturado real
                  </button>
                </div>
              )}
            </div>
          )}

          {editingBilled && (
            <RealBilledForm
              existing={billedStmt}
              estimatedAmount={estimatedTotal}
              onSave={handleSave}
              onCancel={() => setEditingBilled(false)}
              onDelete={handleDelete}
            />
          )}

          {/* Movements */}
          <SL>Compras crédito</SL>
          {expenses.length === 0
            ? <div className="text-[12px] text-[var(--muted)] italic py-1">Sin compras en este ciclo</div>
            : expenses.map(e => (
              <div key={e.id} className="flex justify-between gap-2 py-1.5 border-b border-[var(--line)] last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">{e.description}</div>
                  <div className="text-[11px] text-[var(--muted)]">{e.date?.slice(0,10)}</div>
                </div>
                <div className="font-mono text-[13px] font-semibold shrink-0">{fmtCLP(e.amount)}</div>
              </div>
            ))
          }

          <SL>Cuotas</SL>
          {installments.length === 0
            ? <div className="text-[12px] text-[var(--muted)] italic py-1">Sin cuotas en este período</div>
            : installments.map(d => (
              <div key={d.id} className="flex justify-between gap-2 py-1.5 border-b border-[var(--line)] last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">{d.description}</div>
                  <div className="text-[11px] text-[var(--muted)]">Cuota {d.paid+1}/{d.installments}</div>
                </div>
                <div className="font-mono text-[13px] font-semibold shrink-0">{fmtCLP(d.monthlyAmount)}</div>
              </div>
            ))
          }

          <SL>Cargos de tarjeta</SL>
          {charges.length === 0
            ? <div className="text-[12px] text-[var(--muted)] italic py-1">Sin cargos adicionales</div>
            : charges.map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-2 py-1.5 border-b border-[var(--line)] last:border-0">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <ChargeBadge tipo={c.tipo}/>
                  <div className="text-[13px] font-medium truncate">{c.descripcion}</div>
                </div>
                <div className="font-mono text-[13px] font-semibold shrink-0">{fmtCLP(Number(c.monto))}</div>
              </div>
            ))
          }

          <div className="mt-3 pt-3 border-t border-[var(--line)] flex justify-between">
            <span className="text-[12px] font-semibold text-[var(--muted)]">Subtotal estimado</span>
            <span className="font-mono text-[15px] font-bold">{fmtCLP(estimatedTotal)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Cycle view ────────────────────────────────────────────────────────────────
function CycleView({ data, tab, expandedCards, toggleCard, onUpsertBilled, onDeleteBilled, onBack }) {
  const { refCycle, cardsData, grandEstimated, grandReal, allHaveReal, someHaveReal } = data
  const today = new Date()
  const showReal = tab === 'cerrada' || tab === 'historial'
  const isPast   = refCycle.end < today
  const daysUntilPay = Math.ceil((refCycle.payDate - today) / 86400000)

  let tabBadge, badgeClass
  if (tab === 'en_curso') { tabBadge = 'En curso'; badgeClass = 'bg-[var(--accent-soft)] text-[var(--accent-ink)]' }
  else if (tab === 'proxima') { tabBadge = 'Próxima'; badgeClass = 'bg-[#e8f3fd] text-[#1e4e8a]' }
  else if (isPast && daysUntilPay > 0) { tabBadge = `Paga en ${daysUntilPay}d`; badgeClass = 'bg-[var(--amber-soft)] text-[var(--amber-ink)]' }
  else if (isPast) { tabBadge = 'Pagada'; badgeClass = 'bg-[var(--accent-soft)] text-[var(--accent-ink)]' }
  else { tabBadge = 'Cerrada'; badgeClass = 'bg-[var(--hover)] text-[var(--ink-2)]' }

  return (
    <div className="space-y-3">
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-1.5 text-[12px] text-[var(--muted)] hover:text-[var(--ink)] transition">
          <Icon name="chevron" size={13} className="rotate-180"/> Volver al historial
        </button>
      )}

      {/* Header card */}
      <div className="bg-[var(--bg-elev)] border border-[var(--line)] rounded-xl p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] font-semibold mb-1.5">
              Ciclo de facturación · {refCycle.billingMonthStr}
            </div>
            <div className="text-[16px] font-bold">
              {fmtShort(refCycle.start)} – {fmtShort(refCycle.end)} {refCycle.end.getFullYear()}
            </div>
          </div>
          <span className={`text-[11px] font-bold px-2.5 py-[5px] rounded-full whitespace-nowrap ${badgeClass}`}>{tabBadge}</span>
        </div>
        <div className="mt-3 pt-3 border-t border-[var(--line)] flex items-center gap-2 text-[12px]">
          <Icon name="calendar" size={12} className="text-[var(--muted)] shrink-0"/>
          <span className="text-[var(--muted)]">Fecha de pago:</span>
          <span className="font-semibold">{fmtDate(refCycle.payDate)}</span>
        </div>
      </div>

      {/* Progress bar (en_curso only) */}
      {tab === 'en_curso' && (() => {
        const cycleMs = refCycle.end - refCycle.start
        const elapsed = Math.max(0, Math.min(today - refCycle.start, cycleMs))
        const pct = cycleMs > 0 ? (elapsed / cycleMs) * 100 : 0
        const daysTotal   = Math.round(cycleMs / 86400000) + 1
        const daysElapsed = Math.round(elapsed / 86400000) + 1
        return (
          <div className="bg-[var(--bg-elev)] border border-[var(--line)] rounded-xl p-4">
            <div className="flex justify-between text-[12px] mb-2">
              <span className="text-[var(--muted)]">Progreso del ciclo</span>
              <span className="font-semibold">{daysTotal - daysElapsed} días restantes</span>
            </div>
            <div className="h-2 bg-[var(--line)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--accent)] rounded-full" style={{ width: `${Math.min(100, pct).toFixed(1)}%` }}/>
            </div>
            <div className="flex justify-between text-[10.5px] text-[var(--muted)] mt-1.5">
              <span>{fmtShort(refCycle.start)}</span>
              <span className="font-mono">{daysElapsed}/{daysTotal} días</span>
              <span>{fmtShort(refCycle.end)}</span>
            </div>
          </div>
        )
      })()}

      {/* Summary */}
      <div className="bg-[var(--bg-elev)] border border-[var(--line)] rounded-xl p-4">
        <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)] font-semibold mb-3">
          Resumen total
        </div>
        <div className="flex justify-between items-baseline mb-3">
          <span className="text-[12px] text-[var(--muted)]">
            {showReal && someHaveReal ? 'Total real (disponible)' : 'Total estimado'}
          </span>
          <span className="font-mono text-[22px] font-bold">
            {fmtCLP(showReal && someHaveReal ? grandReal : grandEstimated)}
          </span>
        </div>

        {showReal && someHaveReal && (
          <div className="pt-3 border-t border-[var(--line)] space-y-1.5">
            <div className="flex justify-between text-[12px]">
              <span className="text-[var(--muted)]">Estimado Gastito</span>
              <span className="font-mono">{fmtCLP(grandEstimated)}</span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span className="text-[var(--muted)]">
                Total real
                {!allHaveReal && <span className="ml-1 text-[10px] text-[var(--amber-ink)]">(parcial)</span>}
              </span>
              <span className="font-mono font-semibold">{fmtCLP(grandReal)}</span>
            </div>
            {allHaveReal && (
              <div className="flex justify-between text-[12px] pt-1 border-t border-[var(--line)]">
                <span className="text-[var(--muted)]">Diferencia total</span>
                <span className={`font-mono font-bold ${grandEstimated - grandReal >= 0 ? 'text-[var(--accent-ink)]' : 'text-red-500'}`}>
                  {grandEstimated - grandReal >= 0 ? '+' : ''}{fmtCLP(grandEstimated - grandReal)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Mini stat chips */}
        <div className="flex gap-2 mt-3">
          {[
            { label: 'Crédito', val: cardsData.reduce((s,c) => s+c.totalCredito,0) },
            { label: 'Cuotas',  val: cardsData.reduce((s,c) => s+c.totalCuotas, 0) },
            { label: 'Cargos',  val: cardsData.reduce((s,c) => s+c.totalCargos, 0) },
          ].filter(x => x.val > 0).map(x => (
            <div key={x.label} className="flex-1 bg-[var(--bg)] border border-[var(--line)] rounded-xl p-2.5 text-center">
              <div className="text-[9.5px] uppercase tracking-[0.1em] text-[var(--muted)]">{x.label}</div>
              <div className="font-mono text-[12px] font-bold mt-0.5">{fmtCLPshort(x.val)}</div>
            </div>
          ))}
        </div>

        {/* CSV export */}
        <button
          onClick={() => exportCSV(cardsData, refCycle.billingMonthStr)}
          className="mt-3 w-full h-8 text-[12px] font-medium text-[var(--muted)] border border-[var(--line)] rounded-lg hover:bg-[var(--hover)] flex items-center justify-center gap-1.5 transition">
          <Icon name="arrowdn" size={12}/> Exportar CSV
        </button>
      </div>

      {/* Cards */}
      {cardsData.length === 0 ? (
        <div className="bg-[var(--bg-elev)] border border-[var(--line)] rounded-xl p-6 text-center">
          <Icon name="card" size={26} className="text-[var(--muted)] mx-auto mb-2"/>
          <div className="text-[13px] text-[var(--muted)]">No hay tarjetas de crédito configuradas</div>
        </div>
      ) : (
        <>
          <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)] font-semibold px-1">
            Detalle por tarjeta
          </div>
          <div className="space-y-2">
            {cardsData.map(cd => (
              <CardSection
                key={cd.card.id}
                cardData={cd}
                expanded={expandedCards.has(cd.card.id)}
                onToggle={() => toggleCard(cd.card.id)}
                showReal={showReal}
                onUpsertBilled={onUpsertBilled}
                onDeleteBilled={onDeleteBilled}
              />
            ))}
          </div>
        </>
      )}

      {tab === 'proxima' && (
        <div className="flex items-start gap-2 bg-[var(--bg-elev)] border border-[var(--line)] rounded-xl p-3">
          <Icon name="info" size={14} className="text-[var(--muted)] shrink-0 mt-0.5"/>
          <p className="text-[12px] text-[var(--muted)] leading-relaxed">
            La próxima factura proyecta cuotas conocidas. Las compras de este ciclo aparecerán a medida que se registren.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Historial list ────────────────────────────────────────────────────────────
function HistorialList({ cycles, onSelect }) {
  const today = new Date()
  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)] font-semibold px-1">
        Últimos 12 ciclos
      </div>
      {cycles.map(({ offset, refCycle, grandEstimated, grandReal, someHaveReal, allHaveReal, cardsData }) => {
        const daysUntilPay = Math.ceil((refCycle.payDate - today) / 86400000)
        const isPaid = daysUntilPay < 0
        return (
          <button key={offset} onClick={() => onSelect(offset)}
            className="w-full bg-[var(--bg-elev)] border border-[var(--line)] rounded-xl p-4 text-left hover:bg-[var(--hover)] transition">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold">
                  {fmtShort(refCycle.start)} – {fmtShort(refCycle.end)} {refCycle.end.getFullYear()}
                </div>
                <div className="text-[11px] text-[var(--muted)] mt-0.5 flex items-center gap-1">
                  <Icon name="calendar" size={11}/>
                  Pago {fmtDate(refCycle.payDate)}
                  {isPaid
                    ? <span className="ml-1 text-[var(--accent-ink)] font-semibold">· Pagada</span>
                    : daysUntilPay > 0
                      ? <span className="ml-1 text-[var(--amber-ink)] font-semibold">· en {daysUntilPay}d</span>
                      : null
                  }
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-mono text-[15px] font-bold">
                  {fmtCLP(someHaveReal ? grandReal : grandEstimated)}
                </div>
                {someHaveReal && !allHaveReal && (
                  <div className="text-[10px] text-[var(--amber-ink)]">parcial</div>
                )}
                {allHaveReal && (
                  <div className={`text-[10px] font-mono ${grandEstimated - grandReal >= 0 ? 'text-[var(--accent-ink)]' : 'text-red-500'}`}>
                    {grandEstimated - grandReal >= 0 ? '+' : ''}{fmtCLPshort(grandEstimated - grandReal)}
                  </div>
                )}
              </div>
              <Icon name="chevron" size={14} className="text-[var(--muted)] shrink-0"/>
            </div>
            {cardsData.filter(c => c.estimatedTotal > 0).length > 1 && (
              <div className="flex flex-wrap gap-3 mt-2.5 pt-2.5 border-t border-[var(--line)]">
                {cardsData.filter(c => c.estimatedTotal > 0).map(cd => {
                  const col = BANK_COLORS[cd.card.bank] ?? BANK_COLORS.default
                  const val = cd.billedStmt?.realBilledAmount ?? cd.estimatedTotal
                  return (
                    <div key={cd.card.id} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: col.stroke }}/>
                      <span className="text-[11px] text-[var(--muted)]">{cd.card.name || cd.bankName}</span>
                      <span className="font-mono text-[11px] font-semibold">{fmtCLPshort(val)}</span>
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

// ── Main export ───────────────────────────────────────────────────────────────
export default function Billing({
  expenses = [], installmentDebts = [], creditCards = [], recurringList = [],
  billedStatements = [], onUpsertBilled, onDeleteBilled,
}) {
  const today       = useMemo(() => new Date(), [])
  const banks       = useBanks()
  const ccStmts     = useMemo(() => loadCCStmts(), [])
  const [tab, setTab] = useState('en_curso')
  const [expandedCards, setExpandedCards] = useState(new Set())
  const [historialDetail, setHistorialDetail] = useState(null)

  const activeCards = useMemo(() => creditCards.filter(c => c.isActive !== false), [creditCards])
  const activeDebts = useMemo(() => installmentDebts.filter(d => d.status === 'active'), [installmentDebts])

  const toggleCard = id => setExpandedCards(p => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  // Build cycle data for a given offset
  function computeCycleData(offset) {
    const refCycle = getReferenceCycle(today, activeCards, offset)

    const cardsData = activeCards.map(card => {
      const cycle = getCycleForCard(today, card, offset)
      const csTs  = cycle.start.getTime()
      const ceTs  = new Date(cycle.end.getFullYear(), cycle.end.getMonth(), cycle.end.getDate(), 23, 59, 59).getTime()

      const cardExpenses = expenses.filter(e =>
        e.type === 'credito' &&
        (!card.bank || e.bank === card.bank) &&
        (e.installments ?? 1) <= 1 &&
        (() => { const ts = new Date(e.date).getTime(); return ts >= csTs && ts <= ceTs })()
      )

      const cardInstallments = activeDebts.filter(d =>
        (!card.bank || d.bank === card.bank) &&
        d.startMonth &&
        (() => { const el = monthDiff(d.startMonth, cycle.billingMonthStr); return el >= 0 && el < d.installments })()
      )

      const stmts   = ccStmts.filter(s => s.bankId === card.bank && (s.month || s.dueDate?.slice(0,7)) === cycle.billingMonthStr)
      const charges = stmts.flatMap(st =>
        st.charges?.length > 0 ? st.charges
        : st.cargosComisiones > 0 ? [{ tipo: 'otro', descripcion: 'Cargos y comisiones', monto: st.cargosComisiones }]
        : []
      )

      const totalCredito  = cardExpenses.reduce((s, e) => s + (e.amount || 0), 0)
      const totalCuotas   = cardInstallments.reduce((s, d) => s + (d.monthlyAmount || 0), 0)
      const totalCargos   = charges.reduce((s, c) => s + (Number(c.monto) || 0), 0)
      const estimatedTotal = totalCredito + totalCuotas + totalCargos

      const billedStmt = billedStatements.find(s => s.cardId === card.id && s.cycleKey === cycle.billingMonthStr) ?? null
      const realTotal  = billedStmt?.realBilledAmount ?? estimatedTotal

      return {
        card, cycle,
        bankName: banks.find(b => b.id === card.bank)?.name ?? card.name ?? card.bank ?? '—',
        expenses: cardExpenses, installments: cardInstallments, charges,
        totalCredito, totalCuotas, totalCargos, estimatedTotal,
        billedStmt, realTotal,
      }
    })

    const grandEstimated = cardsData.reduce((s, c) => s + c.estimatedTotal, 0)
    const cardsWithReal  = cardsData.filter(c => c.billedStmt?.realBilledAmount != null)
    const grandReal      = cardsData.reduce((s, c) => s + c.realTotal, 0)
    const someHaveReal   = cardsWithReal.length > 0
    const allHaveReal    = cardsWithReal.length === cardsData.length && cardsData.length > 0

    return { refCycle, cardsData, grandEstimated, grandReal, someHaveReal, allHaveReal }
  }

  const tabOffset = tab === 'en_curso' ? 0 : tab === 'proxima' ? 1 : tab === 'cerrada' ? -1 : null

  const mainData = useMemo(
    () => tabOffset !== null ? computeCycleData(tabOffset) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tabOffset, expenses, installmentDebts, creditCards, billedStatements, banks.length, ccStmts]
  )

  const historialCycles = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ offset: -(i + 2), ...computeCycleData(-(i + 2)) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [expenses, installmentDebts, creditCards, billedStatements, banks.length, ccStmts]
  )

  const historialSelectedData = useMemo(
    () => historialDetail !== null ? computeCycleData(historialDetail) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [historialDetail, expenses, installmentDebts, creditCards, billedStatements, banks.length, ccStmts]
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
              ${tab === t.id ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab !== 'historial' && mainData && (
        <CycleView
          data={mainData}
          tab={tab}
          expandedCards={expandedCards}
          toggleCard={toggleCard}
          onUpsertBilled={onUpsertBilled}
          onDeleteBilled={onDeleteBilled}
        />
      )}

      {tab === 'historial' && (
        historialDetail !== null && historialSelectedData
          ? <CycleView
              data={historialSelectedData}
              tab="historial"
              expandedCards={expandedCards}
              toggleCard={toggleCard}
              onUpsertBilled={onUpsertBilled}
              onDeleteBilled={onDeleteBilled}
              onBack={() => setHistorialDetail(null)}
            />
          : <HistorialList cycles={historialCycles} onSelect={setHistorialDetail}/>
      )}
    </div>
  )
}
