import React from 'react'
import { Card, Badge } from './ui'
import { Icon, fmtCLP, fmtCLPshort, MES } from '../lib/helpers'
import { CATEGORIES } from '../data'

function MonthCol({ label, total, sub, highlight, dim }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">{label}</div>
      <div className={`mt-2 font-mono tracking-tight leading-none
        ${highlight ? 'text-[32px] md:text-[40px]' : 'text-[26px] md:text-[32px]'}
        ${dim ? 'text-[var(--ink-2)]' : 'text-[var(--ink)]'}`}>
        {fmtCLP(total)}
      </div>
      <div className="mt-2 text-[12px] text-[var(--muted)]">{sub}</div>
    </div>
  )
}

function DualBar({ prev, cur, max, color }) {
  const curW  = max > 0 ? (cur  / max) * 100 : 0
  const prevW = max > 0 ? (prev / max) * 100 : 0
  return (
    <div className="flex flex-col gap-1 min-w-[120px]">
      <div className="h-2 rounded-full bg-[var(--line)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: curW  + '%', background: color }}/>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--line)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: prevW + '%', background: 'var(--ink-3)' }}/>
      </div>
    </div>
  )
}

export default function Comparison({ expenses }) {
  const today = new Date()
  const curM  = today.getMonth()
  const curY  = today.getFullYear()
  const prevDate = new Date(curY, curM - 1, 1)
  const prevM = prevDate.getMonth()
  const prevY = prevDate.getFullYear()

  const daysInCur  = new Date(curY,  curM  + 1, 0).getDate()
  const daysInPrev = new Date(prevY, prevM + 1, 0).getDate()
  const dayNow     = today.getDate()

  const curExp = expenses.filter(e => {
    const d = new Date(e.date)
    return d.getMonth() === curM && d.getFullYear() === curY
  })
  const prevExp = expenses.filter(e => {
    const d = new Date(e.date)
    return d.getMonth() === prevM && d.getFullYear() === prevY
  })

  const curTotal  = curExp.reduce((s, e) => s + e.amount, 0)
  const prevTotal = prevExp.reduce((s, e) => s + e.amount, 0)

  if (curTotal === 0 && prevTotal === 0) {
    return (
      <div className="flex flex-col gap-5">
        <Card padding="p-12" className="text-center">
          <div className="text-[32px] mb-3">📅</div>
          <div className="font-semibold text-[15px] tracking-tight">Sin datos para comparar</div>
          <div className="text-[13px] text-[var(--muted)] mt-1">
            Necesitas gastos en al menos uno de los dos últimos meses para ver esta comparación.
          </div>
        </Card>
      </div>
    )
  }

  const curByCat  = {}
  curExp.forEach(e  => { curByCat[e.category]  = (curByCat[e.category]  || 0) + e.amount })
  const prevByCat = {}
  prevExp.forEach(e => { prevByCat[e.category] = (prevByCat[e.category] || 0) + e.amount })

  const methodSplit = (list) => {
    const o = { credito: 0, debito: 0, efectivo: 0 }
    list.forEach(e => {
      if (e.method === 'efectivo') o.efectivo += e.amount
      else if (e.type === 'debito') o.debito += e.amount
      else o.credito += e.amount
    })
    return o
  }
  const curMeth  = methodSplit(curExp)
  const prevMeth = methodSplit(prevExp)

  const curByDay = Array.from({ length: daysInCur }).fill(0)
  curExp.forEach(e => {
    const d = new Date(e.date).getDate()
    curByDay[d - 1] = (curByDay[d - 1] || 0) + e.amount
  })
  const prevByDay = Array.from({ length: daysInPrev }).fill(0)
  prevExp.forEach(e => {
    const d = new Date(e.date).getDate()
    prevByDay[d - 1] = (prevByDay[d - 1] || 0) + e.amount
  })
  const maxDay = Math.max(1, ...curByDay, ...prevByDay)

  const delta       = curTotal - prevTotal
  const deltaPct    = prevTotal > 0 ? (delta / prevTotal) * 100 : (curTotal > 0 ? 100 : 0)
  const projectedCur = dayNow > 0 ? (curTotal / dayNow) * daysInCur : 0

  const catRows = CATEGORIES.map(c => {
    const cur  = curByCat[c.id]  || 0
    const prev = prevByCat[c.id] || 0
    return { ...c, cur, prev, delta: cur - prev, deltaPct: prev > 0 ? ((cur - prev) / prev) * 100 : (cur > 0 ? 100 : 0) }
  }).filter(c => c.cur > 0 || c.prev > 0).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))

  const catMax = Math.max(1, ...catRows.map(r => Math.max(r.cur, r.prev)))

  return (
    <div className="flex flex-col gap-5">
      <Card padding="p-5 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-5 md:gap-7 items-start">
          <MonthCol label={`${MES[prevM]} ${prevY}`} total={prevTotal} sub={`${daysInPrev} días · ${prevTotal > 0 ? 'con datos' : 'sin gastos'}`} dim/>
          <div className="flex md:flex-col items-center md:justify-center gap-2 md:py-4 md:border-l md:border-r md:border-[var(--line)] md:px-7">
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] font-medium
              ${delta <= 0 ? 'bg-[var(--accent-soft)] text-[var(--accent-ink)]' : 'bg-[var(--amber-soft)] text-[var(--amber-ink)]'}`}>
              <Icon name={delta <= 0 ? 'arrowdn' : 'arrowup'} size={13}/>
              <span className="font-mono">{(deltaPct > 0 ? '+' : '') + deltaPct.toFixed(0)}%</span>
            </div>
            <div className="text-[11px] text-[var(--muted)] text-center max-w-[140px]">
              {prevTotal === 0 ? 'Sin datos del mes anterior' : delta < 0 ? 'Estás gastando menos' : 'Vas más alto que el mes pasado'}
            </div>
            <div className="text-[12px] font-mono text-[var(--ink-2)]">
              {delta !== 0 && ((delta >= 0 ? '+' : '') + fmtCLP(delta))}
            </div>
          </div>
          <MonthCol label={`${MES[curM]} ${curY}`} total={curTotal}
                    sub={`día ${dayNow} de ${daysInCur} · proyección ${fmtCLPshort(projectedCur)}`} highlight/>
        </div>

        <div className="mt-7">
          <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] mb-3">Gasto diario</div>
          <div className="relative">
            <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${Math.max(daysInCur, daysInPrev)}, minmax(0, 1fr))` }}>
              {Array.from({ length: Math.max(daysInCur, daysInPrev) }).map((_, i) => {
                const cur  = curByDay[i]  || 0
                const prev = prevByDay[i] || 0
                return (
                  <div key={i} className="flex flex-col items-center gap-[2px]"
                       title={`Día ${i + 1} · este mes ${fmtCLP(cur)} · mes anterior ${fmtCLP(prev)}`}>
                    <div className="w-full bg-[var(--ink)] rounded-sm"
                         style={{ height: Math.max(2, (cur / maxDay) * 60) + 'px', opacity: cur ? 1 : 0.08 }}/>
                    <div className="w-full rounded-sm bg-[var(--ink-3)]"
                         style={{ height: Math.max(2, (prev / maxDay) * 60) + 'px', opacity: prev ? 0.7 : 0.05 }}/>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex items-center gap-4 text-[11px] text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[var(--ink)] rounded-sm"/> {MES[curM]} {curY}</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[var(--ink-3)] rounded-sm"/> {MES[prevM]} {prevY}</span>
            </div>
          </div>
        </div>
      </Card>

      {catRows.length > 0 && (
        <Card padding="p-0">
          <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between">
            <div className="font-semibold tracking-tight">Por categoría</div>
            <Badge tone="muted">Top {catRows.length}</Badge>
          </div>
          <ul className="divide-y divide-[var(--line)]">
            {catRows.map(c => (
              <li key={c.id} className="px-5 py-3.5 grid grid-cols-[auto_1fr_auto] gap-4 items-center">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-md grid place-items-center text-[13px]" style={{ background: (c.color ?? '#888') + '20' }}>{c.icon}</span>
                  <span className="text-[13.5px] font-medium">{c.label}</span>
                </div>
                <DualBar prev={c.prev} cur={c.cur} max={catMax} color={c.color ?? 'var(--ink)'}/>
                <div className="text-right">
                  <div className="font-mono text-[13px] tabular-nums">{fmtCLP(c.cur)}</div>
                  {(c.prev > 0 || c.cur > 0) && (
                    <div className={`text-[11px] font-mono ${c.delta <= 0 ? 'text-[var(--accent-ink)]' : 'text-[var(--amber-ink)]'}`}>
                      {(c.deltaPct >= 0 ? '+' : '') + c.deltaPct.toFixed(0)}%
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card padding="p-5">
        <div className="font-semibold tracking-tight">Medios de pago</div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { key: 'credito',  label: 'Crédito',  icon: 'card' },
            { key: 'debito',   label: 'Débito',   icon: 'card' },
            { key: 'efectivo', label: 'Efectivo', icon: 'cash' },
          ].map(m => {
            const cur  = curMeth[m.key]
            const prev = prevMeth[m.key]
            const dpct = prev > 0 ? ((cur - prev) / prev) * 100 : (cur > 0 ? 100 : 0)
            return (
              <div key={m.key} className="rounded-lg border border-[var(--line)] p-4">
                <div className="text-[12px] text-[var(--ink-2)] inline-flex items-center gap-1.5">
                  <Icon name={m.icon} size={13}/> {m.label}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.12em]">Actual</div>
                    <div className="font-mono text-[15px]">{fmtCLP(cur)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-[var(--muted)] uppercase tracking-[0.12em]">Anterior</div>
                    <div className="font-mono text-[15px] text-[var(--muted)]">{fmtCLP(prev)}</div>
                  </div>
                </div>
                {(cur > 0 || prev > 0) && (
                  <div className={`mt-2 text-[12px] font-mono ${dpct <= 0 ? 'text-[var(--accent-ink)]' : 'text-[var(--amber-ink)]'}`}>
                    {(dpct >= 0 ? '+' : '') + dpct.toFixed(0)}% vs mes anterior
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
