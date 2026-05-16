import React from 'react'
import { Card, Badge } from './ui'
import { Icon, fmtCLP, fmtCLPshort, MES } from '../lib/helpers'
import { CATEGORIES, MONTHLY_HISTORY, TODAY } from '../data'

function MonthCol({ label, total, sub, highlight, dim }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">{label}</div>
      <div className={`mt-2 font-mono tracking-tight leading-none
        ${highlight ? "text-[32px] md:text-[40px]" : "text-[26px] md:text-[32px]"}
        ${dim ? "text-[var(--ink-2)]" : "text-[var(--ink)]"}`}>
        {fmtCLP(total)}
      </div>
      <div className="mt-2 text-[12px] text-[var(--muted)]">{sub}</div>
    </div>
  );
}

function DualBar({ prev, cur, max, color }) {
  const curW  = max ? (cur  / max) * 100 : 0;
  const prevW = max ? (prev / max) * 100 : 0;
  return (
    <div className="flex flex-col gap-1 min-w-[120px]">
      <div className="h-2 rounded-full bg-[var(--line)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: curW  + "%", background: color }}/>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--line)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: prevW + "%", background: "var(--ink-3)" }}/>
      </div>
    </div>
  );
}

export default function Comparison({ expenses }) {
  const today = TODAY;
  const curM  = today.getMonth();
  const curY  = today.getFullYear();
  const prevDate = new Date(curY, curM - 1, 1);
  const prevM = prevDate.getMonth();
  const prevY = prevDate.getFullYear();

  const daysInCur  = new Date(curY,  curM  + 1, 0).getDate();
  const daysInPrev = new Date(prevY, prevM + 1, 0).getDate();
  const dayNow     = today.getDate();

  const curExp = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === curM && d.getFullYear() === curY;
  });

  const prevTotalFromHistory = MONTHLY_HISTORY.find(m => m.month === `${MES[prevM]} ${prevY}`)?.total ?? 725000;
  const curTotal = curExp.reduce((s, e) => s + e.amount, 0);
  const curByCat = {};
  curExp.forEach(e => { curByCat[e.category] = (curByCat[e.category] || 0) + e.amount; });

  const curByCatSum = Object.values(curByCat).reduce((a, b) => a + b, 0) || 1;
  const seed = (s) => {
    let x = 0; for (const c of s) x = (x * 31 + c.charCodeAt(0)) % 997; return (x % 40) / 100;
  };
  const prevByCat = {};
  CATEGORIES.forEach(c => {
    const curShare = (curByCat[c.id] || 0) / curByCatSum;
    const bias = 0.85 + seed(c.id);
    prevByCat[c.id] = Math.round((curShare * prevTotalFromHistory) * bias);
  });
  const prevTotal = Object.values(prevByCat).reduce((a, b) => a + b, 0);

  const methodSplit = (list) => {
    const o = { credito: 0, debito: 0, efectivo: 0 };
    list.forEach(e => {
      if (e.method === "efectivo") o.efectivo += e.amount;
      else if (e.type === "debito") o.debito += e.amount;
      else o.credito += e.amount;
    });
    return o;
  };
  const curMeth = methodSplit(curExp);
  const totalCurMeth = curMeth.credito + curMeth.debito + curMeth.efectivo || 1;
  const prevMeth = {
    credito:  Math.round(prevTotal * (curMeth.credito  / totalCurMeth) * 1.05),
    debito:   Math.round(prevTotal * (curMeth.debito   / totalCurMeth) * 0.98),
    efectivo: Math.round(prevTotal * (curMeth.efectivo / totalCurMeth) * 0.9),
  };

  const curByDay = Array.from({ length: daysInCur }).fill(0);
  curExp.forEach(e => {
    const d = new Date(e.date).getDate();
    curByDay[d - 1] = (curByDay[d - 1] || 0) + e.amount;
  });
  const prevByDay = Array.from({ length: daysInPrev }).map((_, i) => {
    const base   = prevTotal / daysInPrev;
    const jitter = (Math.sin(i * 1.7) + Math.cos(i * 0.6)) * 0.5 + 0.5;
    return Math.round(base * (0.4 + jitter * 1.6));
  });
  const maxDay = Math.max(...curByDay, ...prevByDay);

  const delta       = curTotal - prevTotal;
  const deltaPct    = prevTotal ? (delta / prevTotal) * 100 : 0;
  const projectedCur = (curTotal / dayNow) * daysInCur;

  const catRows = CATEGORIES.map(c => {
    const cur  = curByCat[c.id]  || 0;
    const prev = prevByCat[c.id] || 0;
    return { ...c, cur, prev, delta: cur - prev, deltaPct: prev ? ((cur - prev) / prev) * 100 : (cur ? 100 : 0) };
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return (
    <div className="flex flex-col gap-5">
      <Card padding="p-5 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-5 md:gap-7 items-start">
          <MonthCol label={`${MES[prevM]} ${prevY}`} total={prevTotal} sub={`${daysInPrev} días · cerrado`} dim/>
          <div className="flex md:flex-col items-center md:justify-center gap-2 md:py-4 md:border-l md:border-r md:border-[var(--line)] md:px-7">
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[13px] font-medium
              ${delta < 0 ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]" : "bg-[var(--amber-soft)] text-[var(--amber-ink)]"}`}>
              <Icon name={delta < 0 ? "arrowdn" : "arrowup"} size={13}/>
              <span className="font-mono">{(deltaPct > 0 ? "+" : "") + deltaPct.toFixed(0)}%</span>
            </div>
            <div className="text-[11px] text-[var(--muted)] text-center max-w-[140px]">
              {delta < 0 ? "Estás gastando menos" : "Vas más alto que el mes pasado"}
            </div>
            <div className="text-[12px] font-mono text-[var(--ink-2)]">
              {(delta >= 0 ? "+" : "")}{fmtCLP(delta)}
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
                const cur  = curByDay[i]  || 0;
                const prev = prevByDay[i] || 0;
                return (
                  <div key={i} className="flex flex-col items-center gap-[2px]"
                       title={`Día ${i + 1} · este mes ${fmtCLP(cur)} · mes anterior ${fmtCLP(prev)}`}>
                    <div className="w-full bg-[var(--ink)] rounded-sm"
                         style={{ height: Math.max(2, (cur / maxDay) * 60) + "px", opacity: cur ? 1 : 0.08 }}/>
                    <div className="w-full rounded-sm bg-[var(--ink-3)]"
                         style={{ height: Math.max(2, (prev / maxDay) * 60) + "px", opacity: prev ? 0.7 : 0.05 }}/>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-4 text-[11px] text-[var(--muted)]">
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[var(--ink)] rounded-sm"/> {MES[curM]} {curY}</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[var(--ink-3)] rounded-sm"/> {MES[prevM]} {prevY}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card padding="p-0">
        <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between">
          <div className="font-semibold tracking-tight">Por categoría</div>
          <Badge tone="muted">Top {catRows.length}</Badge>
        </div>
        <ul className="divide-y divide-[var(--line)]">
          {catRows.map(c => (
            <li key={c.id} className="px-5 py-3.5 grid grid-cols-[auto_1fr_auto] gap-4 items-center">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-md grid place-items-center text-[13px]" style={{ background: c.color + "20" }}>{c.icon}</span>
                <span className="text-[13.5px] font-medium">{c.label}</span>
              </div>
              <DualBar prev={c.prev} cur={c.cur} max={Math.max(...catRows.map(r => Math.max(r.cur, r.prev)))} color={c.color}/>
              <div className="text-right">
                <div className="font-mono text-[13px] tabular-nums">{fmtCLP(c.cur)}</div>
                <div className={`text-[11px] font-mono ${c.delta < 0 ? "text-[var(--accent-ink)]" : "text-[var(--amber-ink)]"}`}>
                  {(c.deltaPct >= 0 ? "+" : "")}{c.deltaPct.toFixed(0)}%
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card padding="p-5">
        <div className="font-semibold tracking-tight">Medios de pago</div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { key: "credito",  label: "Crédito",  icon: "card" },
            { key: "debito",   label: "Débito",   icon: "card" },
            { key: "efectivo", label: "Efectivo", icon: "cash" },
          ].map(m => {
            const cur  = curMeth[m.key];
            const prev = prevMeth[m.key];
            const dpct = prev ? ((cur - prev) / prev) * 100 : 0;
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
                <div className={`mt-2 text-[12px] font-mono ${dpct < 0 ? "text-[var(--accent-ink)]" : "text-[var(--amber-ink)]"}`}>
                  {(dpct >= 0 ? "+" : "")}{dpct.toFixed(0)}% vs mes anterior
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
