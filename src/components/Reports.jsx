import React, { useState, useMemo } from 'react'
import { Card, Badge, BarRow } from './ui'
import { Icon, fmtCLP, fmtCLPshort, MES } from '../lib/helpers'
import { CATEGORIES } from '../data'
import { useBanks } from '../services/banksService'
import { buildMonthlyProjection } from '../services/projectionService'

// ─── Shared sub-components ────────────────────────────────────────

function Stat({ label, value, accent }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">{label}</div>
      <div className={`mt-1 font-mono tabular-nums text-[14px] ${accent ? 'text-[var(--ink)] font-semibold' : 'text-[var(--ink-2)]'}`}>{value}</div>
    </div>
  )
}

function MethodCard({ label, value, total, icon, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="rounded-lg border border-[var(--line)] p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-[var(--ink-2)] inline-flex items-center gap-1.5">
          <Icon name={icon} size={13}/> {label}
        </span>
        <span className="text-[10px] font-mono text-[var(--muted)]">{pct}%</span>
      </div>
      <div className="mt-2 font-mono text-[18px] tabular-nums tracking-tight">{fmtCLP(value)}</div>
      <div className="mt-2 h-1 rounded-full bg-[var(--line)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: pct + '%', background: color }}/>
      </div>
    </div>
  )
}

function Insight({ title, value, sub }) {
  return (
    <div className="rounded-lg border border-[var(--line)] p-4">
      <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">{title}</div>
      <div className="mt-2 font-mono text-[20px] tracking-tight">{value}</div>
      <div className="mt-1 text-[12px] text-[var(--muted)]">{sub}</div>
    </div>
  )
}

function DonutChart({ data, size = 140 }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const r = size / 2 - 12
  const c = 2 * Math.PI * r
  let offset = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth="14"/>
      {data.map((d, i) => {
        const frac = total > 0 ? d.value / total : 0
        const dash = frac * c
        const el = (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={d.color} strokeWidth="14"
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}/>
        )
        offset += dash
        return el
      })}
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fill="var(--muted)" fontSize="10" fontFamily="ui-monospace, monospace" letterSpacing="0.06em">TOTAL</text>
      <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fill="var(--ink)" fontSize="14" fontFamily="ui-monospace, monospace">
        {fmtCLPshort(total)}
      </text>
    </svg>
  )
}

// ─── Projection sub-components ───────────────────────────────────

function ProjKPI({ label, value, sub, color = 'text-[var(--ink-2)]', dim }) {
  return (
    <Card padding="p-4">
      <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] leading-snug">{label}</div>
      <div className={`mt-2 font-mono text-[20px] tracking-tight leading-none tabular-nums ${dim ? 'text-[var(--muted)]' : color}`}>{value}</div>
      {sub && <div className="mt-1.5 text-[11px] text-[var(--muted)]">{sub}</div>}
    </Card>
  )
}

const RECURRING_COLOR = 'oklch(0.55 0.15 210 / 0.75)'
const CREDIT_COLOR    = '#C9A227'
const INCOME_COLOR    = 'oklch(0.62 0.13 165 / 0.85)'
const VARIABLE_COLOR  = '#9CA3AF'
const BALANCE_COLOR   = 'oklch(0.45 0.12 250)'

function ProjChart({ months, banksInProj }) {
  const BAR_H  = 160
  const hasVar = months.some(mo => mo.varExpenses > 0)
  const maxVal = Math.max(1, ...months.flatMap(mo => [mo.income, mo.totalOut]))

  return (
    <div>
      {/* Legend */}
      <div className="flex items-center gap-x-4 gap-y-1.5 mb-4 flex-wrap text-[11px] text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: INCOME_COLOR }}/>
          Ingresos
        </span>
        {banksInProj.map(b => (
          <span key={b.id} className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: b.color }}/>
            {b.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: RECURRING_COLOR }}/>
          Recurrentes
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ background: CREDIT_COLOR }}/>
          Pago tarjetas
        </span>
        {hasVar && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: VARIABLE_COLOR }}/>
            Gastos variables
          </span>
        )}
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-2 md:gap-3" style={{ height: (BAR_H + 48) + 'px' }}>
        {months.map(mo => {
          const incH = Math.max(Math.round((mo.income   / maxVal) * BAR_H), mo.income   > 0 ? 4 : 0)
          const outH = Math.max(Math.round((mo.totalOut / maxVal) * BAR_H), mo.totalOut > 0 ? 4 : 0)
          const isNeg = mo.net < 0

          let stackBottom = 0
          const bankSegs = banksInProj.map(b => {
            const amt = mo.byBank[b.id] || 0
            const pct = mo.totalOut > 0 ? (amt / mo.totalOut * 100) : 0
            const seg = { id: b.id, color: b.color, pct, bottom: stackBottom }
            stackBottom += pct
            return seg
          })
          const recPct    = mo.totalOut > 0 ? (mo.recurring     / mo.totalOut * 100) : 0
          const recBottom = stackBottom
          stackBottom += recPct
          const credPct    = mo.totalOut > 0 ? (mo.creditContado / mo.totalOut * 100) : 0
          const credBottom = stackBottom
          stackBottom += credPct
          const varPct    = mo.totalOut > 0 ? (mo.varExpenses   / mo.totalOut * 100) : 0
          const varBottom = stackBottom

          return (
            <div key={mo.key} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <div className={`text-[9px] font-mono tabular-nums text-center leading-tight ${isNeg ? 'text-[#A02828]' : 'text-[var(--accent-ink)]'}`}>
                {mo.net >= 0 ? '+' : ''}{fmtCLPshort(mo.net)}
              </div>

              <div className="w-full flex gap-0.5 items-end" style={{ height: BAR_H + 'px' }}>
                <div className="flex-1 rounded-t-[3px] transition-all"
                  style={{ height: incH + 'px', background: INCOME_COLOR }}/>

                <div className="flex-1 rounded-t-[3px] overflow-hidden relative transition-all"
                  style={{ height: outH + 'px' }}>
                  {bankSegs.map(seg => seg.pct > 0 ? (
                    <div key={seg.id} className="absolute left-0 right-0" style={{
                      bottom: seg.bottom + '%', height: seg.pct + '%', background: seg.color,
                    }}/>
                  ) : null)}
                  {mo.recurring > 0 && (
                    <div className="absolute left-0 right-0" style={{
                      bottom: recBottom + '%', height: recPct + '%', background: RECURRING_COLOR,
                    }}/>
                  )}
                  {mo.creditContado > 0 && (
                    <div className="absolute left-0 right-0" style={{
                      bottom: credBottom + '%', height: credPct + '%', background: CREDIT_COLOR,
                    }}/>
                  )}
                  {mo.varExpenses > 0 && (
                    <div className="absolute left-0 right-0" style={{
                      bottom: varBottom + '%', height: varPct + '%', background: VARIABLE_COLOR,
                    }}/>
                  )}
                </div>
              </div>

              <div className="text-[10px] text-[var(--muted)] leading-tight">{MES[mo.m].slice(0, 3)}</div>
              <div className="text-[9px] text-[var(--muted)] font-mono leading-tight">{mo.y}</div>
            </div>
          )
        })}
      </div>

      {/* Accumulated balance row */}
      <div className="mt-3 pt-3 border-t border-[var(--line)] flex gap-2 md:gap-3">
        {months.map(mo => (
          <div key={mo.key} className="flex-1 text-center">
            {mo.varExpenses > 0 && (
              <div className="text-[9px] text-[var(--muted)] mb-0.5 leading-tight">sin var.</div>
            )}
            {mo.varExpenses > 0 && (
              <div className={`text-[9px] font-mono tabular-nums ${mo.balanceEndCommitted < 0 ? 'text-[#A02828]' : 'text-[var(--muted)]'}`}>
                {fmtCLPshort(mo.balanceEndCommitted)}
              </div>
            )}
            <div className="text-[9px] text-[var(--muted)] mb-0.5 leading-tight mt-0.5">
              {mo.varExpenses > 0 ? 'realista' : 'saldo'}
            </div>
            <div className={`text-[10px] font-mono tabular-nums font-semibold ${mo.balanceEnd < 0 ? 'text-[#A02828]' : ''}`}
              style={{ color: mo.balanceEnd >= 0 ? BALANCE_COLOR : undefined }}>
              {fmtCLPshort(mo.balanceEnd)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ToggleGroup({ options, value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--line)] overflow-hidden">
      {options.map(o => (
        <button key={String(o.value)} onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-[12px] transition ${value === o.value
            ? 'bg-[var(--ink)] text-[var(--bg)] font-medium'
            : 'bg-[var(--bg)] text-[var(--muted)] hover:bg-[var(--hover)]'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ─── Plan futuro tab ─────────────────────────────────────────────

function BalanceLine({ months, minBalance }) {
  if (!months.length) return null
  const W = 560, H = 110, padT = 10, padB = 28, padX = 8
  const vals = months.map(mo => mo.balanceEnd)
  const maxV = Math.max(0, ...vals)
  const minV = Math.min(0, ...vals)
  const range = maxV - minV || 1
  const iW = W - padX * 2
  const iH = H - padT - padB
  const toX = i => padX + (months.length > 1 ? (i / (months.length - 1)) * iW : iW / 2)
  const toY = v => padT + (1 - (v - minV) / range) * iH
  const pts = months.map((mo, i) => `${toX(i).toFixed(1)},${toY(mo.balanceEnd).toFixed(1)}`).join(' ')
  const areaBase = toY(Math.max(minV, 0))
  const areaPts = [`${toX(0)},${areaBase}`, ...months.map((mo, i) => `${toX(i).toFixed(1)},${toY(mo.balanceEnd).toFixed(1)}`), `${toX(months.length - 1)},${areaBase}`].join(' ')
  const zeroY = toY(0)
  const minBalY = minBalance > 0 && minBalance >= minV && minBalance <= maxV ? toY(minBalance) : null
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: '110px' }}>
      <polyline points={areaPts} fill="oklch(0.62 0.13 165 / 0.07)" stroke="none"/>
      {zeroY > padT && zeroY < padT + iH && (
        <line x1={padX} y1={zeroY} x2={W - padX} y2={zeroY} stroke="var(--line)" strokeWidth="1" strokeDasharray="3 3"/>
      )}
      {minBalY && (
        <line x1={padX} y1={minBalY} x2={W - padX} y2={minBalY} stroke="#C9A227" strokeWidth="1.5" strokeDasharray="5 3" opacity="0.7"/>
      )}
      <polyline points={pts} fill="none" stroke={INCOME_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      {months.map((mo, i) => {
        const neg = mo.balanceEnd < 0
        const adj = !neg && minBalance > 0 && mo.balanceEnd < minBalance
        return <circle key={i} cx={toX(i)} cy={toY(mo.balanceEnd)} r="3.5" fill={neg ? '#A02828' : adj ? '#C9A227' : INCOME_COLOR}/>
      })}
      {months.map((mo, i) => (
        <text key={i} x={toX(i)} y={H - 5} textAnchor="middle" fill="var(--muted)" fontSize="9" fontFamily="ui-monospace,monospace">
          {MES[mo.m].slice(0, 3)}
        </text>
      ))}
    </svg>
  )
}

function FlowBars({ months }) {
  if (!months.length) return null
  const BAR_H = 90
  const maxVal = Math.max(1, ...months.flatMap(mo => [mo.income, mo.totalOut]))
  return (
    <div className="flex items-end gap-1" style={{ height: (BAR_H + 24) + 'px' }}>
      {months.map(mo => {
        const cuotas = Object.values(mo.byBank).reduce((s, v) => s + v, 0)
        const incH = Math.max(mo.income > 0 ? 3 : 0, Math.round((mo.income / maxVal) * BAR_H))
        const outH = Math.max(mo.totalOut > 0 ? 3 : 0, Math.round((mo.totalOut / maxVal) * BAR_H))
        const cuotaPct = mo.totalOut > 0 ? (cuotas / mo.totalOut) * 100 : 0
        const recPct   = mo.totalOut > 0 ? (mo.recurring / mo.totalOut) * 100 : 0
        const varPct   = mo.totalOut > 0 ? (mo.varExpenses / mo.totalOut) * 100 : 0
        return (
          <div key={mo.key} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
            <div className="w-full flex gap-[2px] items-end" style={{ height: BAR_H + 'px' }}>
              <div className="flex-1 rounded-t-sm" style={{ height: incH + 'px', background: INCOME_COLOR }}/>
              <div className="flex-1 rounded-t-sm overflow-hidden relative" style={{ height: outH + 'px', background: 'var(--line)' }}>
                {cuotaPct > 0 && <div className="absolute inset-x-0 bottom-0" style={{ height: cuotaPct + '%', background: CREDIT_COLOR }}/>}
                {recPct > 0 && <div className="absolute inset-x-0" style={{ bottom: cuotaPct + '%', height: recPct + '%', background: RECURRING_COLOR }}/>}
                {varPct > 0 && <div className="absolute inset-x-0" style={{ bottom: (cuotaPct + recPct) + '%', height: varPct + '%', background: VARIABLE_COLOR }}/>}
              </div>
            </div>
            <div className="text-[8px] text-[var(--muted)] leading-tight">{MES[mo.m].slice(0, 3)}</div>
          </div>
        )
      })}
    </div>
  )
}

function MonthStrip({ months, minBalance }) {
  if (!months.length) return null
  return (
    <div className="flex gap-1.5 flex-wrap">
      {months.map(mo => {
        const st = mo.balanceEnd < 0 ? 'r' : minBalance > 0 && mo.balanceEnd < minBalance ? 'a' : 'c'
        const bg = st === 'r' ? 'bg-[#A02828]/15' : st === 'a' ? 'bg-[var(--amber-soft)]' : 'bg-[var(--accent-soft)]'
        const txt = st === 'r' ? 'text-[#A02828]' : st === 'a' ? 'text-[var(--amber-ink)]' : 'text-[var(--accent-ink)]'
        return (
          <div key={mo.key} title={`${MES[mo.m]} ${mo.y}: ${fmtCLP(mo.balanceEnd)}`}
            className={`flex flex-col items-center gap-1 cursor-default`}>
            <div className={`w-7 h-7 rounded-md ${bg} flex items-center justify-center`}>
              <span className={`text-[9px] font-bold ${txt}`}>
                {st === 'r' ? '!' : st === 'a' ? '~' : '✓'}
              </span>
            </div>
            <span className="text-[8px] text-[var(--muted)]">{MES[mo.m].slice(0, 3)}</span>
          </div>
        )
      })}
    </div>
  )
}

function SimPaymentRow({ label, installments, monthlyAdd, balAfter, verdict, isSelected }) {
  const c = verdict === 'recomendado' ? 'text-[var(--accent-ink)]' : verdict === 'ajustado' ? 'text-[var(--amber-ink)]' : 'text-[#A02828]'
  const bg = isSelected ? 'bg-[var(--hover)]' : ''
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-md text-[12.5px] ${bg}`}>
      <span className="w-20 text-[var(--muted)] shrink-0">{label}</span>
      <span className="w-24 font-mono text-[var(--ink-2)] shrink-0">
        {installments > 1 ? `${fmtCLPshort(monthlyAdd)}/mes` : fmtCLPshort(monthlyAdd)}
      </span>
      <span className={`flex-1 font-mono font-semibold tabular-nums ${c}`}>{fmtCLP(balAfter)}</span>
      <span className={`text-[11px] font-medium shrink-0 ${c}`}>
        {verdict === 'recomendado' ? 'OK' : verdict === 'ajustado' ? 'Ajust.' : 'No'}
      </span>
    </div>
  )
}

function PlanFuturo({ accounts, installmentDebts, recurringList, incomeList, expenses }) {
  const [planVarInput, setPlanVarInput] = useState(
    () => localStorage.getItem('g_plan_var') ?? ''
  )
  const [planMinBal, setPlanMinBal] = useState(
    () => localStorage.getItem('g_plan_minbal') ?? ''
  )
  const [sim, setSim_] = useState(() => {
    try { return JSON.parse(localStorage.getItem('g_plan_sim') ?? '{}') } catch { return {} }
  })

  const setSim = (key, val) => {
    setSim_(prev => {
      const next = { ...prev, [key]: val }
      localStorage.setItem('g_plan_sim', JSON.stringify(next))
      return next
    })
  }

  const varAmount  = Math.round(Number(planVarInput) || 0)
  const minBalance = Math.round(Number(planMinBal)  || 0)

  const plan = useMemo(() => buildMonthlyProjection({
    accounts, installmentDebts, recurringList, incomeList, expenses,
    horizonMonths: 12,
    varExpensesAmount: varAmount,
  }), [accounts, installmentDebts, recurringList, incomeList, expenses, varAmount])

  const months = plan.months

  const lightest     = months.length > 0 ? months.reduce((a, b) => b.net > a.net ? b : a, months[0]) : null
  const firstOver1M  = months.find(mo => mo.balanceEnd >= 1_000_000)
  const firstOver15M = months.find(mo => mo.balanceEnd >= 1_500_000)

  const readingText = useMemo(() => {
    if (!months.length || !plan.monthlyIncome) return null
    const intro = varAmount > 0
      ? `Con un gasto variable de ${fmtCLPshort(varAmount)}/mes`
      : 'Proyectando solo compromisos'
    const heavy = plan.heaviestMonth?.key
      ? `, tu mes más pesado es ${MES[plan.heaviestMonth.m]} ${plan.heaviestMonth.y}`
      : ''
    const light = lightest
      ? `. El mes más cómodo es ${MES[lightest.m]} ${lightest.y} (${fmtCLPshort(lightest.balanceEnd)} al final)`
      : ''
    const milestone = firstOver15M
      ? `. Superás $1.500.000 en ${MES[firstOver15M.m]} ${firstOver15M.y}`
      : firstOver1M
        ? `. Superás $1.000.000 en ${MES[firstOver1M.m]} ${firstOver1M.y}`
        : '. No alcanzás $1.000.000 disponibles en los próximos 12 meses'
    return intro + heavy + light + milestone + '.'
  }, [months, plan.monthlyIncome, plan.heaviestMonth, varAmount, lightest, firstOver1M, firstOver15M])

  const simInstallments = sim.payment === 'contado' ? 1 : Number(sim.payment) || 1
  const simAmount       = Math.round(Number(sim.amount) || 0)
  const simMonthlyAdd   = simAmount > 0 ? Math.round(simAmount / simInstallments) : 0
  const simMonthOptions = months.map(mo => ({ value: mo.key, label: `${MES[mo.m]} ${mo.y}` }))

  const _calcBalAfter = (targetIdx, installments, monthlyPmt) => {
    let bal = plan.initialBalance
    let balAfter = plan.initialBalance
    months.forEach((mo, i) => {
      const extra = (i >= targetIdx && i < targetIdx + installments) ? monthlyPmt : 0
      bal += mo.net - extra
      if (i === targetIdx + installments - 1) balAfter = bal
      if (installments === 1 && i === targetIdx) balAfter = bal
    })
    return balAfter
  }

  const simResult = useMemo(() => {
    if (!simAmount || !sim.month) return null
    const targetIdx = months.findIndex(mo => mo.key === sim.month)
    if (targetIdx < 0) return null
    const threshold = minBalance > 0 ? minBalance : 0
    const balAfter = _calcBalAfter(targetIdx, simInstallments, simMonthlyAdd)
    let verdict = balAfter < 0 ? 'no_recomendado' : minBalance > 0 && balAfter < minBalance ? 'ajustado' : 'recomendado'

    let bestMonth = null
    if (verdict !== 'recomendado') {
      for (let i = 0; i < months.length; i++) {
        if (i + simInstallments > months.length) break
        let testBal = plan.initialBalance, ok = true
        months.forEach((mo, j) => {
          const extra = (j >= i && j < i + simInstallments) ? simMonthlyAdd : 0
          testBal += mo.net - extra
          if (j >= i && j < i + simInstallments && testBal < threshold) ok = false
        })
        if (ok) { bestMonth = months[i]; break }
      }
    }
    const targetMo = months.find(mo => mo.key === sim.month)
    return { verdict, balAfter, bestMonth, targetMo }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.month, sim.payment, simAmount, simInstallments, simMonthlyAdd, months, plan.initialBalance, minBalance])

  const simComparisons = useMemo(() => {
    if (!simAmount || !sim.month) return []
    const targetIdx = months.findIndex(mo => mo.key === sim.month)
    if (targetIdx < 0) return []
    const threshold = minBalance > 0 ? minBalance : 0
    return [
      { label: 'Contado', installments: 1, payment: 'contado' },
      { label: '3 cuotas', installments: 3, payment: '3' },
      { label: '6 cuotas', installments: 6, payment: '6' },
      { label: '12 cuotas', installments: 12, payment: '12' },
    ].map(opt => {
      const monthlyAdd = Math.round(simAmount / opt.installments)
      const balAfter = _calcBalAfter(targetIdx, opt.installments, monthlyAdd)
      const verdict = balAfter < 0 ? 'no_recomendado' : threshold > 0 && balAfter < threshold ? 'ajustado' : 'recomendado'
      return { ...opt, monthlyAdd, balAfter, verdict }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simAmount, sim.month, months, plan.initialBalance, minBalance])

  const inp = 'w-full h-9 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]'
  const hasVar = varAmount > 0

  return (
    <div className="flex flex-col gap-5">

      {/* ── Parámetros ── */}
      <Card padding="p-4 md:p-5">
        <div className="font-semibold tracking-tight mb-3">Parámetros del plan</div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <div className="text-[10.5px] uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5">Gasto variable mensual</div>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[var(--muted)] pointer-events-none">$</span>
              <input type="number" min="0" placeholder="ej. 550000"
                value={planVarInput}
                onChange={e => setPlanVarInput(e.target.value)}
                onBlur={() => localStorage.setItem('g_plan_var', planVarInput)}
                className="h-8 pl-6 pr-3 w-36 bg-[var(--bg-elev)] border border-[var(--line)] rounded-lg text-[12px] font-mono focus:outline-none focus:border-[var(--ink)]"/>
            </div>
            {varAmount > 0 && <div className="text-[10.5px] text-[var(--muted)] mt-1">{fmtCLPshort(varAmount)}/mes</div>}
          </label>
          <label className="block">
            <div className="text-[10.5px] uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5">Saldo mínimo de seguridad</div>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[var(--muted)] pointer-events-none">$</span>
              <input type="number" min="0" placeholder="ej. 200000"
                value={planMinBal}
                onChange={e => setPlanMinBal(e.target.value)}
                onBlur={() => localStorage.setItem('g_plan_minbal', planMinBal)}
                className="h-8 pl-6 pr-3 w-36 bg-[var(--bg-elev)] border border-[var(--line)] rounded-lg text-[12px] font-mono focus:outline-none focus:border-[var(--ink)]"/>
            </div>
            {minBalance > 0 && <div className="text-[10.5px] text-[var(--muted)] mt-1">{fmtCLPshort(minBalance)} mínimo</div>}
          </label>
          <div className="text-[11px] text-[var(--muted)] max-w-[220px] leading-relaxed">
            Guardados automáticamente en el navegador.
          </div>
        </div>
      </Card>

      {/* ── KPIs ── */}
      {months.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              label: 'Próximo mes',
              value: fmtCLP(months[0].balanceEnd),
              sub: `${MES[months[0].m]} ${months[0].y}`,
              color: months[0].balanceEnd < 0 ? 'text-[#A02828]' : 'text-[var(--accent-ink)]',
            },
            {
              label: 'Mes más pesado',
              value: plan.heaviestMonth?.key ? `${MES[plan.heaviestMonth.m]} ${plan.heaviestMonth.y}` : '—',
              sub: plan.heaviestMonth?.totalOut ? `${fmtCLPshort(plan.heaviestMonth.totalOut)} egresos` : '',
              color: 'text-[var(--amber-ink)]',
            },
            {
              label: 'Mes más cómodo',
              value: lightest ? `${MES[lightest.m]} ${lightest.y}` : '—',
              sub: lightest ? `${fmtCLPshort(lightest.balanceEnd)} al final` : '',
              color: 'text-[var(--accent-ink)]',
            },
            {
              label: 'Primer mes ≥ $1.000.000',
              value: firstOver1M ? `${MES[firstOver1M.m]} ${firstOver1M.y}` : 'No alcanza',
              sub: firstOver1M ? fmtCLPshort(firstOver1M.balanceEnd) : 'en 12 meses',
              color: firstOver1M ? 'text-[var(--accent-ink)]' : 'text-[var(--muted)]',
            },
            {
              label: 'Primer mes ≥ $1.500.000',
              value: firstOver15M ? `${MES[firstOver15M.m]} ${firstOver15M.y}` : 'No alcanza',
              sub: firstOver15M ? fmtCLPshort(firstOver15M.balanceEnd) : 'en 12 meses',
              color: firstOver15M ? 'text-[var(--accent-ink)]' : 'text-[var(--muted)]',
            },
            {
              label: 'Saldo final (12 meses)',
              value: fmtCLP(plan.finalBalance),
              sub: `desde ${fmtCLPshort(plan.initialBalance)} inicial`,
              color: plan.finalBalance < 0 ? 'text-[#A02828]' : 'text-[var(--accent-ink)]',
            },
          ].map((k, i) => (
            <Card key={i} padding="p-4">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">{k.label}</div>
              <div className={`mt-2 font-mono text-[20px] tracking-tight leading-none tabular-nums ${k.color}`}>{k.value}</div>
              {k.sub && <div className="mt-1.5 text-[11px] text-[var(--muted)]">{k.sub}</div>}
            </Card>
          ))}
        </div>
      )}

      {/* ── Gráficos ── */}
      {months.length > 0 && (
        <Card padding="p-5">
          <div className="font-semibold tracking-tight mb-1">Evolución del saldo</div>
          <div className="text-[11px] text-[var(--muted)] mb-4">
            Saldo proyectado mes a mes
            {minBalance > 0 && <> · <span style={{ color: '#C9A227' }}>— línea mínimo</span></>}
          </div>
          <BalanceLine months={months} minBalance={minBalance}/>

          <div className="mt-6 pt-5 border-t border-[var(--line)]">
            <div className="font-semibold tracking-tight mb-1">Ingresos vs egresos</div>
            <div className="flex items-center gap-3 mb-4 flex-wrap text-[10.5px] text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: INCOME_COLOR }}/>Ingresos
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CREDIT_COLOR }}/>Cuotas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: RECURRING_COLOR }}/>Recurrentes
              </span>
              {hasVar && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: VARIABLE_COLOR }}/>Variables
                </span>
              )}
            </div>
            <FlowBars months={months}/>
          </div>

          <div className="mt-5 pt-4 border-t border-[var(--line)]">
            <div className="text-[10.5px] uppercase tracking-[0.1em] text-[var(--muted)] mb-3">Estado por mes</div>
            <MonthStrip months={months} minBalance={minBalance}/>
            <div className="flex items-center gap-4 mt-3 text-[10.5px] text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-sm bg-[var(--accent-soft)] flex items-center justify-center text-[8px] font-bold text-[var(--accent-ink)]">✓</span> Cómodo
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-sm bg-[var(--amber-soft)] flex items-center justify-center text-[8px] font-bold text-[var(--amber-ink)]">~</span> Ajustado
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-sm bg-[#A02828]/15 flex items-center justify-center text-[8px] font-bold text-[#A02828]">!</span> Riesgo
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* ── Lectura automática ── */}
      {readingText && (
        <Card padding="p-4 md:p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-md bg-[var(--bg-elev)] border border-[var(--line)] grid place-items-center shrink-0 mt-0.5">
              <Icon name="info" size={14}/>
            </div>
            <div>
              <div className="text-[10.5px] uppercase tracking-[0.1em] text-[var(--muted)] mb-1">Lectura automática</div>
              <p className="text-[13.5px] leading-relaxed">{readingText}</p>
            </div>
          </div>
        </Card>
      )}

      {/* ── Tabla mes a mes ── */}
      <Card padding="p-0">
        <div className="px-5 py-4 border-b border-[var(--line)]">
          <div className="font-semibold tracking-tight">Saldo realista mes a mes</div>
          <div className="text-[12px] text-[var(--muted)] mt-0.5">
            12 meses · {varAmount > 0 ? `${fmtCLPshort(varAmount)}/mes en variables` : 'solo compromisos'}
            {minBalance > 0 ? ` · mínimo ${fmtCLPshort(minBalance)}` : ''}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-[var(--line)]">
                {['Mes', 'Saldo inicial', 'Ingresos', 'Cuotas', 'Recurrentes', 'Variables', 'Saldo final', 'Estado'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-[var(--muted)] uppercase tracking-[0.08em] text-[10px] whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {months.map(mo => {
                const cuotas = Object.values(mo.byBank).reduce((s, v) => s + v, 0)
                const st = mo.balanceEnd < 0 ? 'riesgo'
                  : minBalance > 0 && mo.balanceEnd < minBalance ? 'ajustado'
                  : 'comodo'
                return (
                  <tr key={mo.key} className="hover:bg-[var(--hover)]">
                    <td className="px-4 py-2.5 font-medium whitespace-nowrap">{MES[mo.m]} {mo.y}</td>
                    <td className="px-4 py-2.5 font-mono tabular-nums text-[var(--ink-2)]">{fmtCLPshort(mo.balanceStart)}</td>
                    <td className="px-4 py-2.5 font-mono tabular-nums text-[var(--accent-ink)]">{mo.income > 0 ? fmtCLPshort(mo.income) : '—'}</td>
                    <td className="px-4 py-2.5 font-mono tabular-nums">{cuotas > 0 ? fmtCLPshort(cuotas) : '—'}</td>
                    <td className="px-4 py-2.5 font-mono tabular-nums">{mo.recurring > 0 ? fmtCLPshort(mo.recurring) : '—'}</td>
                    <td className="px-4 py-2.5 font-mono tabular-nums" style={{ color: mo.varExpenses > 0 ? VARIABLE_COLOR : undefined }}>
                      {mo.varExpenses > 0 ? fmtCLPshort(mo.varExpenses) : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-mono tabular-nums font-semibold"
                      style={{ color: mo.balanceEnd < 0 ? '#A02828' : BALANCE_COLOR }}>
                      {fmtCLPshort(mo.balanceEnd)}
                    </td>
                    <td className="px-4 py-2.5">
                      {st === 'riesgo'
                        ? <span className="px-2 py-0.5 rounded-md bg-[#A02828]/10 text-[#A02828] text-[10.5px] font-medium">Riesgo</span>
                        : st === 'ajustado'
                        ? <span className="px-2 py-0.5 rounded-md bg-[var(--amber-soft)] text-[var(--amber-ink)] text-[10.5px] font-medium">Ajustado</span>
                        : <span className="px-2 py-0.5 rounded-md bg-[var(--accent-soft)] text-[var(--accent-ink)] text-[10.5px] font-medium">Cómodo</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {months.length === 0 && (
            <div className="px-5 py-8 text-center text-[13px] text-[var(--muted)]">
              Sin datos suficientes. Configura cuentas e ingresos en Recurrentes.
            </div>
          )}
        </div>
      </Card>

      {/* ── Simulador ── */}
      <Card padding="p-5">
        <div className="font-semibold tracking-tight mb-4">Simulador de proyecto futuro</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-[10.5px] uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5">Nombre del proyecto</div>
            <input type="text" placeholder="ej. Notebook, Viaje, Moto…"
              value={sim.name || ''}
              onChange={e => setSim('name', e.target.value)}
              className={inp}/>
          </label>
          <label className="block">
            <div className="text-[10.5px] uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5">Monto total</div>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[var(--muted)] pointer-events-none">$</span>
              <input type="number" min="0" placeholder="ej. 1200000"
                value={sim.amount || ''}
                onChange={e => setSim('amount', e.target.value)}
                className="w-full h-9 pl-6 pr-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] font-mono focus:outline-none focus:border-[var(--ink)]"/>
            </div>
          </label>
          <label className="block">
            <div className="text-[10.5px] uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5">Mes objetivo</div>
            <select value={sim.month || ''} onChange={e => setSim('month', e.target.value)} className={inp}>
              <option value="">Seleccionar mes…</option>
              {simMonthOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="block">
            <div className="text-[10.5px] uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5">Forma de pago</div>
            <ToggleGroup
              options={[
                { value: 'contado', label: 'Contado' },
                { value: '3',  label: '3c' },
                { value: '6',  label: '6c' },
                { value: '12', label: '12c' },
              ]}
              value={sim.payment || 'contado'}
              onChange={v => setSim('payment', v)}
            />
            {simAmount > 0 && simInstallments > 1 && (
              <div className="text-[10.5px] text-[var(--muted)] mt-1.5">
                {simInstallments} cuotas de {fmtCLP(simMonthlyAdd)}/mes
              </div>
            )}
          </label>
        </div>

        {/* Resultado del simulador */}
        {simResult && (
          <div className="mt-5 flex flex-col gap-3">
            {/* Veredicto principal */}
            <div className={`p-4 rounded-xl border-2 ${
              simResult.verdict === 'recomendado' ? 'bg-[var(--accent-soft)] border-[var(--accent-soft)]'
              : simResult.verdict === 'ajustado'  ? 'bg-[var(--amber-soft)] border-[var(--amber-soft)]'
              : 'bg-[#A02828]/8 border-[#A02828]/20'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-lg grid place-items-center text-[18px] shrink-0 ${
                  simResult.verdict === 'recomendado' ? 'bg-[var(--accent-ink)]/15'
                  : simResult.verdict === 'ajustado'  ? 'bg-[var(--amber-ink)]/15'
                  : 'bg-[#A02828]/15'
                }`}>
                  {simResult.verdict === 'recomendado' ? '✓' : simResult.verdict === 'ajustado' ? '~' : '✗'}
                </div>
                <div>
                  <div className={`font-bold text-[16px] tracking-tight ${
                    simResult.verdict === 'recomendado' ? 'text-[var(--accent-ink)]'
                    : simResult.verdict === 'ajustado'  ? 'text-[var(--amber-ink)]'
                    : 'text-[#A02828]'
                  }`}>
                    {simResult.verdict === 'recomendado' ? 'Recomendado'
                     : simResult.verdict === 'ajustado'  ? 'Ajustado — bajo mínimo'
                     : 'No recomendado'}
                  </div>
                  <div className="text-[12px] text-[var(--muted)] mt-0.5">
                    {sim.name ? `"${sim.name}" · ` : ''}{fmtCLP(simAmount)}
                    {simInstallments > 1 ? ` en ${simInstallments} cuotas de ${fmtCLP(simMonthlyAdd)}/mes` : ' contado'}
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">Saldo después del proyecto</div>
                  <div className={`mt-1 font-mono text-[18px] font-semibold tabular-nums ${
                    simResult.balAfter < 0 ? 'text-[#A02828]'
                    : simResult.verdict === 'ajustado' ? 'text-[var(--amber-ink)]'
                    : 'text-[var(--accent-ink)]'
                  }`}>{fmtCLP(simResult.balAfter)}</div>
                </div>
                {simResult.bestMonth && simResult.verdict !== 'recomendado' && (
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">Mejor mes sugerido</div>
                    <div className="mt-1 font-semibold text-[15px]">{MES[simResult.bestMonth.m]} {simResult.bestMonth.y}</div>
                  </div>
                )}
                {!simResult.bestMonth && simResult.verdict !== 'recomendado' && (
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">Mejor mes sugerido</div>
                    <div className="mt-1 text-[13px] text-[var(--muted)]">No hay mes viable en 12 meses</div>
                  </div>
                )}
              </div>
            </div>

            {/* Comparación de opciones de pago */}
            {simComparisons.length > 0 && (
              <div className="rounded-lg border border-[var(--line)] overflow-hidden">
                <div className="px-3 py-2.5 border-b border-[var(--line)] bg-[var(--bg-elev)]">
                  <div className="text-[10.5px] uppercase tracking-[0.1em] text-[var(--muted)] font-medium">
                    Comparación de formas de pago en {simResult.targetMo ? `${MES[simResult.targetMo.m]} ${simResult.targetMo.y}` : sim.month}
                  </div>
                </div>
                <div className="divide-y divide-[var(--line)]">
                  {simComparisons.map(opt => (
                    <SimPaymentRow
                      key={opt.payment}
                      label={opt.label}
                      installments={opt.installments}
                      monthlyAdd={opt.monthlyAdd}
                      balAfter={opt.balAfter}
                      verdict={opt.verdict}
                      isSelected={opt.payment === (sim.payment || 'contado')}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!simResult && (simAmount > 0 || sim.month) && (
          <div className="mt-4 text-[12px] text-[var(--muted)]">
            Completa el monto y el mes objetivo para ver el resultado.
          </div>
        )}
      </Card>

    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────

export default function Reports({
  expenses         = [],
  installmentDebts = [],
  recurringList    = [],
  incomeList       = [],
  accounts         = [],
  userSettings     = null,
}) {
  const banks = useBanks()
  const today = new Date()

  const [tab,             setTab]             = useState('historico')
  const [horizon,         setHorizon]         = useState(6)
  const [scenario,        setScenario]        = useState('solo_compromisos')
  const [varExpensesInput, setVarExpensesInput] = useState('')
  const [includeSavings,  setIncludeSavings]  = useState(false)

  // ── Histórico ─────────────────────────────────────────────────
  const monthly = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1)
    const y = d.getFullYear(), m = d.getMonth()
    const monthTotal = expenses.filter(e => {
      const ed = new Date(e.date)
      return ed.getMonth() === m && ed.getFullYear() === y
    }).reduce((s, e) => s + e.amount, 0)
    return { month: `${MES[m]} ${y}`, total: monthTotal }
  })

  const thisMonthTotal = monthly[5]?.total ?? 0
  const monthlyMax     = Math.max(1, ...monthly.map(m => m.total))
  const avgMonthly     = monthly.reduce((s, m) => s + m.total, 0) / monthly.length

  const byCat = {}
  expenses.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + e.amount })
  const catArr = Object.entries(byCat).map(([id, v]) => {
    const c = CATEGORIES.find(x => x.id === id) ?? CATEGORIES.find(x => x.id === 'otros') ?? CATEGORIES[0]
    return { id, v, ...c }
  }).sort((a, b) => b.v - a.v)
  const catTotal = catArr.reduce((s, c) => s + c.v, 0)
  const catMax   = catArr[0]?.v || 1

  const byMethod = { debito: 0, credito: 0, efectivo: 0 }
  expenses.forEach(e => {
    if (e.method === 'efectivo') byMethod.efectivo += e.amount
    else if (e.type === 'debito') byMethod.debito += e.amount
    else byMethod.credito += e.amount
  })
  const methodTotal = byMethod.debito + byMethod.credito + byMethod.efectivo

  const byBank = {}
  expenses.forEach(e => { byBank[e.bank] = (byBank[e.bank] || 0) + e.amount })
  const bankArr = Object.entries(byBank)
    .map(([id, v]) => {
      const b = banks.find(x => x.id === id)
      return { id, v, label: b?.label || id, color: b?.color || null }
    })
    .sort((a, b) => b.v - a.v)
  const bankMax = bankArr[0]?.v || 1

  const thisMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date)
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  })
  const maxExpense = thisMonthExpenses.reduce(
    (max, e) => e.amount > max.amount ? e : max,
    thisMonthExpenses[0] ?? { amount: 0, description: '—' }
  )
  const daysWithExpenses    = new Set(thisMonthExpenses.map(e => new Date(e.date).getDate())).size
  const daysWithoutExpenses = today.getDate() - daysWithExpenses

  // ── Proyección ────────────────────────────────────────────────

  const banksInProj = useMemo(() => {
    const active = installmentDebts.filter(d => d.status === 'active')
    const ids = [...new Set(active.map(d => d.bank || '__otros__'))]
    return ids.map(id => {
      const b = banks.find(x => x.id === id)
      return { id, label: b?.label || (id === '__otros__' ? 'Otros' : id), color: b?.color || '#888888' }
    })
  }, [installmentDebts, banks])

  // Scenario → service params
  const scenarioServiceParams = useMemo(() => ({
    solo_compromisos:   { varExpensesAmount: 0,                           useHistoricalVar: false },
    realista:           { varExpensesAmount: Number(varExpensesInput) || 0, useHistoricalVar: false },
    promedio_historico: { varExpensesAmount: 0,                           useHistoricalVar: true  },
  }[scenario] ?? {}), [scenario, varExpensesInput])

  const projBase = {
    accounts, installmentDebts, recurringList, incomeList, expenses,
    horizonMonths: horizon,
    withHistoricalAvg: false,
    ...scenarioServiceParams,
  }

  const proj = useMemo(
    () => buildMonthlyProjection({ ...projBase, includeSavingsBalance: false }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accounts, installmentDebts, recurringList, incomeList, expenses, horizon, scenario, varExpensesInput]
  )

  const projWithSavings = useMemo(
    () => buildMonthlyProjection({ ...projBase, includeSavingsBalance: true }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accounts, installmentDebts, recurringList, incomeList, expenses, horizon, scenario, varExpensesInput]
  )

  const hasSavingsAccounts = accounts.some(a => a.active && a.type === 'ahorro')
  const activeProjData     = includeSavings && hasSavingsAccounts ? projWithSavings : proj
  const hasVar             = activeProjData.monthlyVarExpenses > 0

  const noIncome   = proj.monthlyIncome === 0
  const noAccounts = accounts.filter(a => a.active).length === 0

  const activeBanksInProj = useMemo(() => {
    return banksInProj.filter(b =>
      activeProjData.months.some(mo => (mo.byBank[b.id] || 0) > 0)
    )
  }, [banksInProj, activeProjData.months])

  // KPI colors
  const committedColor = activeProjData.finalBalanceCommitted < 0 ? 'text-[#A02828]' : 'text-[var(--ink-2)]'
  const realistColor   = activeProjData.finalBalance < 0           ? 'text-[#A02828]' : 'text-[var(--accent-ink)]'

  const SCENARIO_DESC = {
    solo_compromisos:   'Considera solo cuotas, tarjetas y gastos fijos comprometidos. Optimista por diseño — no incluye ningún gasto variable.',
    realista:           'Agrega un gasto variable mensual estimado (supermercado, bencina, salidas, farmacia, etc.) para ver un escenario más real.',
    promedio_historico: 'Usa el promedio real de tus gastos de los últimos 3 meses (excluye compras en cuotas). La proyección más cercana a tu comportamiento habitual.',
  }

  if (expenses.length === 0 && tab === 'historico') {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex border-b border-[var(--line)]">
          {[['historico', 'Histórico'], ['proyeccion', 'Proyección'], ['planfuturo', 'Plan futuro']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition
                ${tab === id ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink-2)]'}`}>
              {label}
            </button>
          ))}
        </div>
        <Card padding="p-12" className="text-center">
          <div className="text-[32px] mb-3">📊</div>
          <div className="font-semibold text-[15px] tracking-tight">Aún no hay gastos suficientes para reportar</div>
          <div className="text-[13px] text-[var(--muted)] mt-1 mb-4">Registra algunos gastos para ver reportes y estadísticas.</div>
          <button onClick={() => setTab('proyeccion')}
            className="h-8 px-4 inline-flex items-center gap-1.5 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[12px] font-medium">
            Ver proyección <Icon name="chevron" size={12}/>
          </button>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">

      {/* ── Tab navigation ────────────────────────────────────── */}
      <div className="flex border-b border-[var(--line)]">
        {[['historico', 'Histórico'], ['proyeccion', 'Proyección'], ['planfuturo', 'Plan futuro']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition
              ${tab === id ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink-2)]'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Histórico tab ─────────────────────────────────────── */}
      {tab === 'historico' && (
        <>
          <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--muted)]">
            <Icon name="info" size={13}/>
            <span>Este reporte muestra movimientos del periodo seleccionado. No reemplaza tu saldo actual.</span>
          </div>
          <Card padding="p-5 md:p-6">
            <div className="flex items-end justify-between flex-wrap gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Gastos por mes</div>
                <div className="mt-1.5 font-semibold tracking-tight text-[18px]">Últimos 6 meses</div>
              </div>
              <div className="flex items-center gap-4">
                <Stat label="Promedio" value={fmtCLP(avgMonthly)}/>
                <Stat label="Máximo"   value={fmtCLP(monthlyMax)}/>
                <Stat label="Este mes" value={fmtCLP(thisMonthTotal)} accent/>
              </div>
            </div>
            <div className="mt-7 grid grid-cols-6 gap-3 md:gap-5 h-[240px] items-end">
              {monthly.map((m, i) => {
                const h = monthlyMax > 0 ? (m.total / monthlyMax) * 100 : 0
                const isCurrent = i === monthly.length - 1
                return (
                  <div key={m.month} className="flex flex-col items-center gap-2 group h-full">
                    <div className="flex-1 w-full flex flex-col justify-end relative">
                      {m.total > 0 && (
                        <div className="absolute -top-1 left-0 right-0 text-center font-mono text-[10.5px] text-[var(--muted)] opacity-0 group-hover:opacity-100 transition">
                          {fmtCLPshort(m.total)}
                        </div>
                      )}
                      <div className="rounded-t-md transition-all"
                        style={{ height: Math.max(h, m.total > 0 ? 2 : 0) + '%', background: isCurrent ? 'var(--ink)' : 'var(--ink-3)', minHeight: m.total > 0 ? '4px' : '0' }}/>
                    </div>
                    <div className={`text-[11px] ${isCurrent ? 'font-semibold text-[var(--ink)]' : 'text-[var(--muted)]'}`}>{m.month}</div>
                    <div className={`font-mono text-[11px] ${isCurrent ? 'text-[var(--ink-2)]' : 'text-[var(--muted)]'}`}>
                      {m.total > 0 ? fmtCLPshort(m.total) : '—'}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card padding="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Por categoría</div>
                  <div className="mt-1 font-semibold tracking-tight">{fmtCLP(catTotal)}</div>
                </div>
                <Badge tone="muted">{catArr.length} cat</Badge>
              </div>
              {catArr.length > 0 ? (
                <>
                  <div className="mt-5 flex items-center gap-6 flex-wrap">
                    <DonutChart data={catArr.map(c => ({ value: c.v, color: c.color, label: c.label }))} size={160}/>
                    <div className="flex-1 min-w-[180px] flex flex-col gap-2.5">
                      {catArr.slice(0, 6).map(c => (
                        <div key={c.id} className="flex items-center gap-2 text-[12.5px]">
                          <span className="w-2 h-2 rounded-full" style={{ background: c.color }}></span>
                          <span className="flex-1 truncate">{c.label}</span>
                          <span className="font-mono text-[12px] text-[var(--ink-2)] tabular-nums">{catTotal > 0 ? Math.round((c.v / catTotal) * 100) : 0}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-5 pt-5 border-t border-[var(--line)] flex flex-col gap-3">
                    {catArr.slice(0, 5).map(c => (
                      <BarRow key={c.id} label={<span>{c.icon} {c.label}</span>} value={c.v} max={catMax} color={c.color}
                              right={catTotal > 0 ? Math.round((c.v / catTotal) * 100) + '%' : '0%'}/>
                    ))}
                  </div>
                </>
              ) : (
                <div className="mt-8 text-center text-[13px] text-[var(--muted)]">Sin gastos registrados</div>
              )}
            </Card>

            <Card padding="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Por medio de pago</div>
                  <div className="mt-1 font-semibold tracking-tight">{fmtCLP(methodTotal)}</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2.5">
                <MethodCard label="Crédito"  value={byMethod.credito}  total={methodTotal} icon="card" color="var(--ink)"/>
                <MethodCard label="Débito"   value={byMethod.debito}   total={methodTotal} icon="card" color="var(--accent)"/>
                <MethodCard label="Efectivo" value={byMethod.efectivo} total={methodTotal} icon="cash" color="#C9A227"/>
              </div>
              <div className="mt-6 pt-5 border-t border-[var(--line)]">
                <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)] mb-3">Por banco / tarjeta</div>
                <div className="flex flex-col gap-3">
                  {bankArr.map(b => (
                    <BarRow key={b.id} label={b.label} value={b.v} max={bankMax}
                            color={b.color || 'var(--ink-2)'}
                            right={methodTotal > 0 ? Math.round((b.v / methodTotal) * 100) + '%' : '0%'}/>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          <Card padding="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="info" size={15}/>
              <div className="font-semibold tracking-tight">Observaciones</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Insight
                title="Mayor gasto del mes"
                value={fmtCLP(maxExpense.amount)}
                sub={maxExpense.description !== '—' ? maxExpense.description : 'Sin gastos este mes'}
              />
              <Insight
                title="Días sin gasto (este mes)"
                value={Math.max(0, daysWithoutExpenses)}
                sub={`de ${today.getDate()} días transcurridos`}
              />
              <Insight
                title="Crédito acumulado"
                value={fmtCLP(byMethod.credito)}
                sub={methodTotal > 0 ? `${Math.round((byMethod.credito / methodTotal) * 100)}% del total` : 'sin datos'}
              />
            </div>
          </Card>
        </>
      )}

      {/* ── Plan futuro tab ───────────────────────────────────── */}
      {tab === 'planfuturo' && (
        <PlanFuturo
          accounts={accounts}
          installmentDebts={installmentDebts}
          recurringList={recurringList}
          incomeList={incomeList}
          expenses={expenses}
        />
      )}

      {/* ── Proyección tab ────────────────────────────────────── */}
      {tab === 'proyeccion' && (
        <>
          {/* Filters */}
          <Card padding="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[var(--muted)]">Horizonte:</span>
                <ToggleGroup
                  options={[{ value: 6, label: '6 meses' }, { value: 12, label: '12 meses' }]}
                  value={horizon}
                  onChange={setHorizon}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[var(--muted)]">Escenario:</span>
                <ToggleGroup
                  options={[
                    { value: 'solo_compromisos',   label: 'Solo compromisos' },
                    { value: 'realista',            label: 'Realista' },
                    { value: 'promedio_historico',  label: 'Promedio histórico' },
                  ]}
                  value={scenario}
                  onChange={setScenario}
                />
              </div>
              {scenario === 'realista' && (
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-[var(--muted)]">Gasto variable/mes:</span>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-[var(--muted)] pointer-events-none">$</span>
                    <input
                      type="number" min="0" placeholder="ej. 600000"
                      value={varExpensesInput}
                      onChange={e => setVarExpensesInput(e.target.value)}
                      className="h-8 pl-6 pr-3 w-36 bg-[var(--bg-elev)] border border-[var(--line)] rounded-lg text-[12px] font-mono focus:outline-none focus:border-[var(--ink)]"
                    />
                  </div>
                  {varExpensesInput && Number(varExpensesInput) > 0 && (
                    <span className="text-[11px] text-[var(--muted)]">{fmtCLPshort(Number(varExpensesInput))}/mes</span>
                  )}
                </div>
              )}
              {hasSavingsAccounts && (
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-[var(--muted)]">Ahorro:</span>
                  <ToggleGroup
                    options={[
                      { value: false, label: 'Sin ahorro' },
                      { value: true,  label: 'Incluir ahorro' },
                    ]}
                    value={includeSavings}
                    onChange={v => setIncludeSavings(v === true || v === 'true')}
                  />
                </div>
              )}
            </div>
            {/* Scenario description */}
            <div className="mt-2.5 flex items-start gap-2 text-[11px] text-[var(--muted)]">
              <Icon name="info" size={12} className="mt-0.5 shrink-0"/>
              <span>{SCENARIO_DESC[scenario]}</span>
            </div>
          </Card>

          {/* Warnings */}
          {noIncome && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-[var(--amber-soft)] border border-[var(--amber-soft)] text-[12.5px] text-[var(--amber-ink)]">
              <Icon name="alert" size={14} className="mt-0.5 shrink-0"/>
              <div>
                <span className="font-semibold">Sin ingresos configurados.</span>
                {' '}Agrega un ingreso recurrente en <span className="font-medium">Recurrentes → Ingresos</span> para ver la proyección completa.
              </div>
            </div>
          )}
          {!hasSavingsAccounts && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-[var(--line)] text-[12.5px] text-[var(--muted)]">
              <Icon name="savings" size={14} className="mt-0.5 shrink-0"/>
              <div>
                <span className="font-medium text-[var(--ink-2)]">Sin cuentas de ahorro configuradas.</span>
                {' '}Agrega una cuenta de tipo <span className="font-medium">Ahorro</span> en Cuentas para incluirla en la proyección.
              </div>
            </div>
          )}
          {scenario === 'realista' && !varExpensesInput && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-[var(--line)] text-[12.5px] text-[var(--muted)]">
              <Icon name="alert" size={14} className="mt-0.5 shrink-0"/>
              <span>Ingresa un gasto variable mensual estimado (supermercado, bencina, comida, salidas…) para ver el escenario realista.</span>
            </div>
          )}

          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <ProjKPI
              label="Sin gastos variables"
              value={fmtCLP(activeProjData.finalBalanceCommitted)}
              sub={noAccounts ? 'sin cuentas configuradas' : `desde ${fmtCLPshort(activeProjData.initialBalance)} · solo compromisos`}
              color={committedColor}
            />
            <ProjKPI
              label="Saldo realista"
              value={hasVar ? fmtCLP(activeProjData.finalBalance) : '—'}
              sub={hasVar
                ? `−${fmtCLPshort(activeProjData.monthlyVarExpenses)}/mes en variables`
                : scenario === 'realista'
                  ? 'Ingresa un monto variable arriba'
                  : 'Usa escenario Realista o Promedio histórico'}
              color={realistColor}
              dim={!hasVar}
            />
            <ProjKPI
              label="Compromisos conocidos"
              value={fmtCLP(activeProjData.totalCommitted)}
              sub={`${horizon} meses de cuotas + fijos`}
            />
            <ProjKPI
              label="Libre antes de gastos variables"
              value={proj.monthlyIncome > 0
                ? fmtCLP(proj.monthlyIncome - proj.monthlyRecurring - (activeProjData.months[0]?.installments ?? 0))
                : '—'}
              sub={proj.monthlyIncome > 0
                ? `${fmtCLPshort(proj.monthlyIncome)} ing. − fijos − cuotas`
                : 'configura tus ingresos'}
              color={proj.monthlyIncome > 0 &&
                (proj.monthlyIncome - proj.monthlyRecurring - (activeProjData.months[0]?.installments ?? 0)) < 0
                  ? 'text-[#A02828]' : 'text-[var(--ink-2)]'}
            />
          </div>

          {/* Savings comparison */}
          {hasSavingsAccounts && proj.savingsBalance > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <ProjKPI
                label="Ahorro actual"
                value={fmtCLP(proj.savingsBalance)}
                sub="saldo en cuentas ahorro"
                color="text-[var(--accent-ink)]"
              />
              <ProjKPI
                label={`Sin ahorro (${horizon}m)`}
                value={fmtCLP(hasVar ? proj.finalBalance : proj.finalBalanceCommitted)}
                sub="solo cuentas operativas"
                color={(hasVar ? proj.finalBalance : proj.finalBalanceCommitted) < 0 ? 'text-[#A02828]' : 'text-[var(--ink-2)]'}
              />
              <ProjKPI
                label={`Con ahorro (${horizon}m)`}
                value={fmtCLP(hasVar ? projWithSavings.finalBalance : projWithSavings.finalBalanceCommitted)}
                sub="operativas + ahorro actual"
                color={(hasVar ? projWithSavings.finalBalance : projWithSavings.finalBalanceCommitted) < 0 ? 'text-[#A02828]' : 'text-[var(--accent-ink)]'}
              />
            </div>
          )}

          {/* Heaviest month callout — only when var expenses change the picture */}
          {hasVar && activeProjData.heaviestMonth?.key && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] text-[12.5px]">
              <Icon name="alert" size={14} className="text-[var(--muted)] shrink-0"/>
              <span className="text-[var(--muted)]">Mes más pesado:</span>
              <span className="font-medium">{MES[activeProjData.heaviestMonth.m]} {activeProjData.heaviestMonth.y}</span>
              <span className="font-mono tabular-nums text-[var(--ink-2)]">{fmtCLP(activeProjData.heaviestMonth.totalOut)}</span>
              <span className="text-[var(--muted)]">en egresos</span>
            </div>
          )}

          {/* Chart */}
          <Card padding="p-5 md:p-6">
            <div className="flex items-end justify-between flex-wrap gap-3 mb-2">
              <div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Flujo proyectado</div>
                <div className="mt-1 font-semibold tracking-tight">Próximos {horizon} meses</div>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[var(--muted)]">
                <span>Saldo inicial: <span className="font-mono text-[var(--ink-2)]">{fmtCLPshort(activeProjData.initialBalance)}</span></span>
                {proj.savingsBalance > 0 && (
                  <span>Ahorro: <span className="font-mono text-[var(--accent-ink)]">{fmtCLPshort(proj.savingsBalance)}</span></span>
                )}
                {hasVar && (
                  <span className="inline-flex items-center gap-1" style={{ color: VARIABLE_COLOR }}>
                    <span className="w-2 h-2 rounded-sm inline-block" style={{ background: VARIABLE_COLOR }}/>
                    Variables: {fmtCLPshort(activeProjData.monthlyVarExpenses)}/mes
                  </span>
                )}
              </div>
            </div>
            {activeProjData.months.length > 0 ? (
              <ProjChart months={activeProjData.months} banksInProj={activeBanksInProj}/>
            ) : (
              <div className="h-40 flex items-center justify-center text-[13px] text-[var(--muted)]">
                Sin datos para proyectar
              </div>
            )}
          </Card>

          {/* Monthly detail table */}
          <Card padding="p-0">
            <div className="px-5 py-4 border-b border-[var(--line)]">
              <div className="font-semibold tracking-tight">Detalle mensual</div>
              <div className="text-[12px] text-[var(--muted)] mt-0.5">Flujo proyectado mes a mes</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-[var(--line)]">
                    {[
                      'Mes', 'Saldo inicio', 'Ingresos',
                      ...activeBanksInProj.map(b => b.label),
                      'Recurrentes',
                      hasVar ? 'Gastos var.' : null,
                      'Total egresos',
                      hasVar ? 'Saldo sin var.' : null,
                      hasVar ? 'Saldo realista' : 'Saldo final',
                    ].filter(Boolean).map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-medium text-[var(--muted)] uppercase tracking-[0.08em] text-[10px] whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {activeProjData.months.map(mo => (
                    <tr key={mo.key} className="hover:bg-[var(--hover)]">
                      <td className="px-4 py-2.5 font-medium whitespace-nowrap">{MES[mo.m]} {mo.y}</td>
                      <td className="px-4 py-2.5 font-mono tabular-nums text-[var(--ink-2)]">{fmtCLPshort(mo.balanceStart)}</td>
                      <td className="px-4 py-2.5 font-mono tabular-nums text-[var(--accent-ink)]">{mo.income > 0 ? fmtCLPshort(mo.income) : '—'}</td>
                      {activeBanksInProj.map(b => {
                        const amt = mo.byBank[b.id] || 0
                        return (
                          <td key={b.id} className="px-4 py-2.5 font-mono tabular-nums"
                            style={{ color: amt > 0 ? b.color : undefined }}>
                            {amt > 0 ? fmtCLPshort(amt) : '—'}
                          </td>
                        )
                      })}
                      <td className="px-4 py-2.5 font-mono tabular-nums">{mo.recurring > 0 ? fmtCLPshort(mo.recurring) : '—'}</td>
                      {hasVar && (
                        <td className="px-4 py-2.5 font-mono tabular-nums" style={{ color: VARIABLE_COLOR }}>
                          {fmtCLPshort(mo.varExpenses)}
                        </td>
                      )}
                      <td className="px-4 py-2.5 font-mono tabular-nums">{fmtCLPshort(mo.totalOut)}</td>
                      {hasVar && (
                        <td className={`px-4 py-2.5 font-mono tabular-nums ${mo.balanceEndCommitted < 0 ? 'text-[#A02828]' : 'text-[var(--muted)]'}`}>
                          {fmtCLPshort(mo.balanceEndCommitted)}
                        </td>
                      )}
                      <td className={`px-4 py-2.5 font-mono tabular-nums font-semibold ${mo.balanceEnd < 0 ? 'text-[#A02828]' : ''}`}
                        style={{ color: mo.balanceEnd >= 0 ? BALANCE_COLOR : undefined }}>
                        {fmtCLPshort(mo.balanceEnd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {activeProjData.months.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-[var(--line)] bg-[var(--bg-elev)]">
                      <td className="px-4 py-2.5 font-semibold">Total</td>
                      <td className="px-4 py-2.5"/>
                      <td className="px-4 py-2.5 font-mono font-semibold tabular-nums text-[var(--accent-ink)]">
                        {fmtCLPshort(activeProjData.months.reduce((s, m) => s + m.income, 0))}
                      </td>
                      {activeBanksInProj.map(b => {
                        const total = activeProjData.months.reduce((s, m) => s + (m.byBank[b.id] || 0), 0)
                        return (
                          <td key={b.id} className="px-4 py-2.5 font-mono font-semibold tabular-nums" style={{ color: b.color }}>
                            {fmtCLPshort(total)}
                          </td>
                        )
                      })}
                      <td className="px-4 py-2.5 font-mono font-semibold tabular-nums">
                        {fmtCLPshort(activeProjData.months.reduce((s, m) => s + m.recurring, 0))}
                      </td>
                      {hasVar && (
                        <td className="px-4 py-2.5 font-mono font-semibold tabular-nums" style={{ color: VARIABLE_COLOR }}>
                          {fmtCLPshort(activeProjData.months.reduce((s, m) => s + m.varExpenses, 0))}
                        </td>
                      )}
                      <td className="px-4 py-2.5 font-mono font-semibold tabular-nums">
                        {fmtCLPshort(activeProjData.months.reduce((s, m) => s + m.totalOut, 0))}
                      </td>
                      {hasVar && (
                        <td className={`px-4 py-2.5 font-mono font-semibold tabular-nums ${activeProjData.finalBalanceCommitted < 0 ? 'text-[#A02828]' : 'text-[var(--muted)]'}`}>
                          {fmtCLPshort(activeProjData.finalBalanceCommitted)}
                        </td>
                      )}
                      <td className={`px-4 py-2.5 font-mono font-semibold tabular-nums ${activeProjData.finalBalance < 0 ? 'text-[#A02828]' : ''}`}
                        style={{ color: activeProjData.finalBalance >= 0 ? BALANCE_COLOR : undefined }}>
                        {fmtCLPshort(activeProjData.finalBalance)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>

          {/* ── Recurrentes / cuotas incluidas ── */}
          {(recurringList.filter(r => r.kind === 'expense' && r.active !== false).length > 0 ||
            installmentDebts.filter(d => d.status === 'active').length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recurringList.filter(r => r.kind === 'expense' && r.active !== false).length > 0 && (
                <Card padding="p-5">
                  <div className="font-semibold tracking-tight mb-3">Recurrentes incluidos</div>
                  <div className="flex flex-col gap-2">
                    {recurringList.filter(r => r.kind === 'expense' && r.active !== false).map(r => (
                      <div key={r.id} className="flex items-center justify-between text-[12.5px]">
                        <span className="text-[var(--ink-2)]">{r.name}</span>
                        <span className="font-mono tabular-nums">{fmtCLP(r.amount)}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between text-[12.5px] font-semibold">
                      <span>Total mensual</span>
                      <span className="font-mono tabular-nums">{fmtCLP(proj.monthlyRecurring)}</span>
                    </div>
                  </div>
                </Card>
              )}
              {installmentDebts.filter(d => d.status === 'active').length > 0 && (
                <Card padding="p-5">
                  <div className="font-semibold tracking-tight mb-3">
                    Cuotas activas ({installmentDebts.filter(d => d.status === 'active').length})
                  </div>
                  <div className="flex flex-col gap-2">
                    {installmentDebts.filter(d => d.status === 'active').slice(0, 6).map(d => {
                      const b = banks.find(x => x.id === d.bank)
                      const rem = d.installments - d.paid
                      return (
                        <div key={d.id} className="flex items-center gap-2 text-[12.5px]">
                          {b?.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: b.color }}/>}
                          <span className="text-[var(--ink-2)] truncate flex-1">{d.description}</span>
                          <span className="text-[var(--muted)] text-[11px] shrink-0">{rem}c rem.</span>
                          <span className="font-mono tabular-nums shrink-0">{fmtCLP(d.monthlyAmount)}</span>
                        </div>
                      )
                    })}
                    {installmentDebts.filter(d => d.status === 'active').length > 6 && (
                      <div className="text-[11px] text-[var(--muted)]">
                        + {installmentDebts.filter(d => d.status === 'active').length - 6} más
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
