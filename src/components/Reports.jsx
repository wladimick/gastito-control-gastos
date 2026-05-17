import React from 'react'
import { Card, Badge, BarRow } from './ui'
import { Icon, fmtCLP, fmtCLPshort, MES } from '../lib/helpers'
import { CATEGORIES, BANKS } from '../data'

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

export default function Reports({ expenses }) {
  const today = new Date()

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <Card padding="p-12" className="text-center">
          <div className="text-[32px] mb-3">📊</div>
          <div className="font-semibold text-[15px] tracking-tight">Aún no hay gastos suficientes para reportar</div>
          <div className="text-[13px] text-[var(--muted)] mt-1">Registra algunos gastos para ver aquí tus reportes y estadísticas.</div>
        </Card>
      </div>
    )
  }

  // Build 6-month history from real expenses
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
    .map(([id, v]) => ({ id, v, label: BANKS.find(b => b.id === id)?.label || id }))
    .sort((a, b) => b.v - a.v)
  const bankMax = bankArr[0]?.v || 1

  // Insights from real data
  const thisMonthExpenses = expenses.filter(e => {
    const d = new Date(e.date)
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
  })
  const maxExpense = thisMonthExpenses.reduce((max, e) => e.amount > max.amount ? e : max, thisMonthExpenses[0] ?? { amount: 0, description: '—' })
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const daysWithExpenses = new Set(thisMonthExpenses.map(e => new Date(e.date).getDate())).size
  const daysWithoutExpenses = today.getDate() - daysWithExpenses

  return (
    <div className="flex flex-col gap-5">
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
                <BarRow key={b.id} label={b.label} value={b.v} max={bankMax} color="var(--ink-2)"
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
    </div>
  )
}
