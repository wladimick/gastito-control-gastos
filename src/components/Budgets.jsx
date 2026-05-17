import React, { useState } from 'react'
import { Card, Badge } from './ui'
import { Icon, fmtCLP, MES } from '../lib/helpers'
import { CATEGORIES } from '../data'

function MiniStat({ label, value, tone }) {
  const colors = { over: "text-[#A02828]", warn: "text-[var(--amber-ink)]" }[tone] || "text-[var(--ink)]";
  return (
    <div className="rounded-lg border border-[var(--line)] p-3">
      <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">{label}</div>
      <div className={`mt-1.5 font-mono text-[22px] tracking-tight ${colors}`}>{value}</div>
    </div>
  );
}

export default function Budgets({ expenses, budgets, setBudgets }) {
  const today = new Date();

  const spentByCat = {};
  expenses.forEach(e => {
    const d = new Date(e.date);
    if (d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()) {
      spentByCat[e.category] = (spentByCat[e.category] || 0) + e.amount;
    }
  });

  const rows = CATEGORIES.map(c => {
    const spent  = spentByCat[c.id] || 0;
    const budget = budgets[c.id]    || 0;
    const pct    = budget ? (spent / budget) * 100 : 0;
    let state;
    if (budget === 0) state = "none";
    else if (pct >= 100) state = "over";
    else if (pct >= 80)  state = "warn";
    else                 state = "ok";
    return { ...c, spent, budget, pct, state };
  });

  const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
  const totalSpent  = rows.reduce((s, r) => s + r.spent, 0);
  const remaining   = totalBudget - totalSpent;
  const totalPct    = totalBudget ? (totalSpent / totalBudget) * 100 : 0;

  const daysIn   = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const dayNow   = today.getDate();
  const dayRatio = dayNow / daysIn;

  const overCount = rows.filter(r => r.state === "over").length;
  const warnCount = rows.filter(r => r.state === "warn").length;

  const [editingId, setEditingId] = useState(null);
  const [draft,     setDraft]     = useState("");

  const startEdit = (id, curr) => { setEditingId(id); setDraft(String(curr)); };
  const commit    = () => {
    if (editingId !== null) {
      setBudgets({ ...budgets, [editingId]: Number(draft) || 0 });
      setEditingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card padding="p-5 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-6">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Presupuesto · {MES[today.getMonth()]} {today.getFullYear()}</div>
            <div className="mt-3 flex items-baseline gap-2 flex-wrap">
              <div className="font-mono text-[34px] md:text-[42px] tracking-tight leading-none">{fmtCLP(totalSpent)}</div>
              <div className="text-[15px] text-[var(--muted)] font-mono">/ {fmtCLP(totalBudget)}</div>
            </div>
            <div className="mt-3 flex items-center gap-2 flex-wrap text-[12.5px]">
              <Badge tone={totalPct >= 100 || totalPct >= 80 ? "warn" : "ok"}>
                {totalPct.toFixed(0)}% usado
              </Badge>
              <span className="text-[var(--muted)]">·</span>
              <span className={remaining < 0 ? "text-[var(--amber-ink)]" : "text-[var(--ink-2)]"}>
                {remaining >= 0 ? "Quedan " : "Pasaste por "}
                <span className="font-mono">{fmtCLP(Math.abs(remaining))}</span>
              </span>
              <span className="text-[var(--muted)]">·</span>
              <span className="text-[var(--muted)]">Día {dayNow} de {daysIn}</span>
            </div>

            <div className="mt-5 h-2 rounded-full bg-[var(--line)] overflow-hidden relative">
              <div className="h-full" style={{
                width: Math.min(100, totalPct) + "%",
                background: totalPct > 100 ? "var(--amber-ink)" : (totalPct > dayRatio * 100 + 5 ? "var(--amber-ink)" : "var(--accent)")
              }}/>
              <div className="absolute top-[-4px] bottom-[-4px] w-[2px] bg-[var(--ink)]"
                   style={{ left: (dayRatio * 100) + "%" }}/>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10.5px] text-[var(--muted)] font-mono">
              <span>0%</span>
              <span>↑ ritmo esperado del mes ({(dayRatio * 100).toFixed(0)}%)</span>
              <span>100%</span>
            </div>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-1 gap-2">
            <MiniStat label="Categorías"   value={rows.filter(r => r.budget > 0).length}/>
            <MiniStat label="En alerta"    value={warnCount} tone="warn"/>
            <MiniStat label="Sobre límite" value={overCount} tone="over"/>
          </div>
        </div>
      </Card>

      <Card padding="p-0">
        <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--line)]">
          <div>
            <div className="font-semibold tracking-tight">Por categoría</div>
            <div className="text-[12px] text-[var(--muted)] mt-0.5">Toca el monto para editarlo</div>
          </div>
          <Badge tone="muted">{rows.length}</Badge>
        </div>
        <ul className="divide-y divide-[var(--line)]">
          {rows.map(r => {
            const stateColor = {
              ok:   { bar: "var(--accent)",    text: "text-[var(--accent-ink)]", label: "En ruta" },
              warn: { bar: "var(--amber-ink)", text: "text-[var(--amber-ink)]",  label: "Cerca del límite" },
              over: { bar: "#A02828",          text: "text-[#A02828]",           label: "Sobre el límite" },
              none: { bar: "var(--ink-3)",     text: "text-[var(--muted)]",      label: "Sin presupuesto" },
            }[r.state];
            const isEditing = editingId === r.id;
            return (
              <li key={r.id} className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-md grid place-items-center text-[16px] shrink-0" style={{ background: r.color + "20" }}>{r.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[14px]">{r.label}</span>
                        <span className={`text-[11px] ${stateColor.text}`}>{stateColor.label}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[13px]">
                        <span className={r.state === "over" ? "text-[#A02828]" : ""}>{fmtCLP(r.spent)}</span>
                        <span className="text-[var(--muted)]">/</span>
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1">
                            <span className="text-[var(--muted)]">$</span>
                            <input
                              type="number" autoFocus
                              value={draft}
                              onChange={e => setDraft(e.target.value)}
                              onBlur={commit}
                              onKeyDown={e => e.key === "Enter" && commit()}
                              className="w-24 bg-transparent border-b border-[var(--ink)] text-right focus:outline-none"/>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(r.id, r.budget)}
                                  className="text-[var(--ink-2)] hover:underline">
                            {fmtCLP(r.budget)}
                          </button>
                        )}
                        <span className="text-[var(--muted)] tabular-nums w-12 text-right">{r.budget ? r.pct.toFixed(0) + "%" : "—"}</span>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-[var(--line)] overflow-hidden relative">
                      <div className="h-full rounded-full transition-all"
                           style={{ width: Math.min(100, r.pct) + "%", background: stateColor.bar }}/>
                      {r.budget > 0 && (
                        <div className="absolute top-[-3px] bottom-[-3px] w-[1.5px] bg-[var(--ink)]/40"
                             style={{ left: (dayRatio * 100) + "%" }}/>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
