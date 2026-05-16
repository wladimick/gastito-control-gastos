// Cuotas: deudas en cuotas + calendario de próximos meses
const { useState: useStateIc, useMemo: useMemoIc, useEffect: useEffectIc } = React;

const AUTO_PAY_DAY = 5; // día en que el sueldo entra y se cobran todas las cuotas

// Helpers de fecha mensuales
function parseYM(s) { const [y,m] = s.split("-").map(Number); return { y, m: m-1 }; }
function addMonths(y, m, n) {
  const date = new Date(y, m + n, 1);
  return { y: date.getFullYear(), m: date.getMonth() };
}
function ymKey(y, m) { return `${y}-${String(m+1).padStart(2,"0")}`; }
function diffMonths(fromY, fromM, toY, toM) { return (toY - fromY)*12 + (toM - fromM); }

// Construye todas las cuotas de una deuda con su mes correspondiente
function expandSchedule(debt) {
  const { y, m } = parseYM(debt.startMonth);
  const out = [];
  for (let i = 0; i < debt.installments; i++) {
    const next = addMonths(y, m, i);
    out.push({
      debtId: debt.id,
      description: debt.description,
      n: i+1,
      total: debt.installments,
      monthKey: ymKey(next.y, next.m),
      y: next.y, m: next.m,
      day: debt.dayOfMonth,
      amount: debt.monthlyAmount,
      paid: i < debt.paid,
      bank: debt.bank,
      category: debt.category,
    });
  }
  return out;
}

// Cuántas cuotas de la deuda DEBEN haberse cobrado ya (auto-pago día 5)
function autoPaidCount(debt, today) {
  if (!debt.autoPay) return debt.paid;
  const { y, m } = parseYM(debt.startMonth);
  const monthsSinceStart = diffMonths(y, m, today.getFullYear(), today.getMonth());
  if (monthsSinceStart < 0) return 0;
  // El mes actual cuenta como cobrado si hoy >= día 5
  const includesCurrent = today.getDate() >= AUTO_PAY_DAY ? 1 : 0;
  return Math.min(debt.installments, monthsSinceStart + includesCurrent);
}

function Installments({ debts, setDebts }) {
  const { Card, Badge, IconBtn } = window.UI;
  const { Icon, fmtCLP, fmtCLPshort, MES } = window.Helpers;
  const today = window.MOCK.TODAY;
  const curY = today.getFullYear(), curM = today.getMonth();
  const curKey = ymKey(curY, curM);

  // Auto-pago: al montar, normaliza `paid` para que refleje las cuotas que ya pasaron del día 5
  useEffectIc(() => {
    let needsUpdate = false;
    const updated = debts.map(d => {
      const auto = autoPaidCount(d, today);
      if (auto > d.paid) {
        needsUpdate = true;
        const newPaid = auto;
        return {
          ...d,
          paid: newPaid,
          status: newPaid >= d.installments ? "paid" : d.status,
        };
      }
      return d;
    });
    if (needsUpdate) setDebts(updated);
  // eslint-disable-next-line
  }, []);

  // Todas las cuotas expandidas
  const allCuotas = useMemoIc(() => debts.flatMap(d => expandSchedule(d).map(c => ({...c, debt: d}))), [debts]);

  // KPIs
  const active = debts.filter(d => d.status === "active");
  const totalRemaining = active.reduce((s, d) => s + d.monthlyAmount * (d.installments - d.paid), 0);
  const totalCommitted = active.reduce((s, d) => s + d.total, 0);
  const monthlyNow = allCuotas.filter(c => c.monthKey === curKey && !c.paid).reduce((s,c) => s+c.amount, 0);
  const monthlyAvg6 = (() => {
    let total = 0;
    for (let i = 0; i < 6; i++) {
      const { y, m } = addMonths(curY, curM, i);
      const key = ymKey(y, m);
      total += allCuotas.filter(c => c.monthKey === key && !c.paid).reduce((s,c) => s+c.amount, 0);
    }
    return total / 6;
  })();
  const activeCuotasCount = allCuotas.filter(c => !c.paid && new Date(c.y, c.m, 1) >= new Date(curY, curM, 1)).length;

  // Recurrentes para sumar al calendario
  const recurring = window.MOCK.RECURRING.filter(r => r.active);

  // Próximos 6 meses (incluye el actual)
  const upcomingMonths = useMemoIc(() => {
    const months = [];
    for (let i = 0; i < 6; i++) {
      const { y, m } = addMonths(curY, curM, i);
      const key = ymKey(y, m);
      const cuotas = allCuotas.filter(c => c.monthKey === key && !c.paid)
                              .sort((a,b) => a.day - b.day);
      const recCharges = recurring.map(r => ({
        kind: "recurring",
        debtId: r.id,
        description: r.name,
        amount: r.amount,
        day: r.dayOfMonth,
        bank: r.bank,
        category: r.category,
      })).sort((a,b) => a.day - b.day);
      const cuotaTotal = cuotas.reduce((s,c)=>s+c.amount, 0);
      const recTotal   = recCharges.reduce((s,c)=>s+c.amount, 0);
      months.push({ y, m, key, cuotas, recCharges, cuotaTotal, recTotal, total: cuotaTotal + recTotal });
    }
    return months;
  }, [allCuotas]);

  const maxMonthTotal = Math.max(...upcomingMonths.map(m => m.total));

  const [expandedDebt, setExpandedDebt] = useStateIc(null);

  const markCuotaPaid = (debtId) => {
    setDebts(debts.map(d => d.id === debtId ? {
      ...d,
      paid: Math.min(d.installments, d.paid + 1),
      status: d.paid + 1 >= d.installments ? "paid" : "active",
    } : d));
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Banner auto-pago */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-ink)] border border-[var(--accent-soft)]">
        <div className="w-8 h-8 rounded-md bg-[var(--accent)] text-white grid place-items-center shrink-0">
          <Icon name="repeat" size={14}/>
        </div>
        <div className="flex-1 min-w-0 text-[12.5px] leading-snug">
          <span className="font-semibold">Auto-pago activo</span> · Todas las cuotas se cobran automáticamente el <span className="font-mono font-semibold">día {AUTO_PAY_DAY}</span> de cada mes, junto con la llegada del sueldo.
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KPI label="Deuda restante" value={fmtCLP(totalRemaining)} sub={`de ${fmtCLP(totalCommitted)} comprometidos`} icon="layers"/>
        <KPI label="Cuotas este mes" value={fmtCLP(monthlyNow)} sub={`${MES[curM]} ${curY}`} icon="calendar"/>
        <KPI label="Promedio próximos 6m" value={fmtCLP(monthlyAvg6)} sub="solo cuotas" icon="trend"/>
        <KPI label="Cuotas pendientes" value={activeCuotasCount} sub={`en ${active.length} deudas`} icon="card"/>
      </div>

      {/* Sección 1: Deudas activas */}
      <Card padding="p-0">
        <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between">
          <div>
            <div className="font-semibold tracking-tight">Deudas en cuotas</div>
            <div className="text-[12px] text-[var(--muted)] mt-0.5">{active.length} activas · {debts.filter(d=>d.status==="paid").length} pagadas</div>
          </div>
        </div>
        <ul className="divide-y divide-[var(--line)]">
          {debts.map(d => {
            const cat = window.MOCK.CATEGORIES.find(c => c.id === d.category);
            const bank = window.MOCK.BANKS.find(b => b.id === d.bank);
            const pct = (d.paid / d.installments) * 100;
            const remaining = d.monthlyAmount * (d.installments - d.paid);
            const isExpanded = expandedDebt === d.id;
            const schedule = expandSchedule(d);
            const nextPending = schedule.find(c => !c.paid);
            const isPaid = d.status === "paid";
            return (
              <li key={d.id} className={isPaid ? "opacity-60" : ""}>
                <div className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md grid place-items-center text-[15px] shrink-0" style={{ background: cat.color + "20" }}>{cat.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[14px]">{d.description}</span>
                        {isPaid && <Badge tone="ok">pagada</Badge>}
                        {!isPaid && nextPending?.monthKey === curKey && <Badge tone="warn">cae este mes</Badge>}
                      </div>
                      <div className="mt-1 text-[11.5px] text-[var(--muted)] flex items-center gap-1.5 flex-wrap">
                        <span>{bank?.label}</span>
                        <span>·</span>
                        <span>día {d.dayOfMonth} de cada mes</span>
                        {nextPending && <>
                          <span>·</span>
                          <span>próxima: {MES[nextPending.m]} {nextPending.y}</span>
                        </>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-[14px] tabular-nums">{fmtCLP(d.monthlyAmount)}</div>
                      <div className="text-[11px] text-[var(--muted)] font-mono">/cuota</div>
                    </div>
                  </div>

                  {/* Progreso de cuotas */}
                  <div className="mt-3 grid grid-cols-[1fr_auto] gap-3 items-center">
                    <div>
                      <div className="flex items-center gap-[3px] mb-1.5">
                        {Array.from({length: d.installments}).map((_, i) => (
                          <div key={i}
                               className="flex-1 h-1.5 rounded-sm"
                               style={{ background: i < d.paid ? "var(--ink)" : "var(--line)" }}
                               title={`Cuota ${i+1}`}/>
                        ))}
                      </div>
                      <div className="text-[11px] text-[var(--muted)] font-mono flex items-center gap-2">
                        <span>{d.paid}/{d.installments} cuotas</span>
                        <span>·</span>
                        <span>quedan {fmtCLP(remaining)} de {fmtCLP(d.total)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!isPaid && (
                        <button onClick={() => markCuotaPaid(d.id)}
                          className="text-[11px] px-2 h-7 rounded-md border border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--hover)] inline-flex items-center gap-1">
                          <Icon name="check" size={11}/> Marcar cuota pagada
                        </button>
                      )}
                      <button onClick={() => setExpandedDebt(isExpanded ? null : d.id)}
                              className="w-7 h-7 grid place-items-center rounded-md hover:bg-[var(--hover)] text-[var(--muted)]"
                              title="Ver detalle">
                        <Icon name={isExpanded ? "x" : "chevdown"} size={13}/>
                      </button>
                    </div>
                  </div>

                  {/* Detalle expandido: cronograma completo */}
                  {isExpanded && (
                    <div className="mt-4 pt-3 border-t border-[var(--line)] grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {schedule.map(c => (
                        <div key={c.n}
                             className={`rounded-md border px-2.5 py-2 text-[12px] flex flex-col gap-0.5
                               ${c.paid ? "bg-[var(--bg)] border-[var(--line)] text-[var(--muted)]"
                                 : c.monthKey === curKey ? "bg-[var(--amber-soft)] border-[var(--amber-soft)] text-[var(--amber-ink)]"
                                 : "bg-[var(--bg-elev)] border-[var(--line)] text-[var(--ink-2)]"}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px]">#{c.n}/{c.total}</span>
                            {c.paid && <Icon name="check" size={10}/>}
                          </div>
                          <div className="font-mono text-[12px] tabular-nums">{fmtCLP(c.amount)}</div>
                          <div className="text-[10.5px]">{MES[c.m]} {c.y}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Sección 2: Próximos meses (calendario) */}
      <Card padding="p-0">
        <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-semibold tracking-tight">Próximos meses</div>
            <div className="text-[12px] text-[var(--muted)] mt-0.5">Cuotas y cargos recurrentes que se vienen</div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-[var(--muted)]">
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[var(--ink)]"/> Cuotas</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[var(--accent)]"/> Recurrentes</span>
          </div>
        </div>

        {/* Tira horizontal de meses */}
        <div className="px-5 py-4">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5">
            {upcomingMonths.map((mo, i) => {
              const isCurrent = i === 0;
              const totalH = (mo.total / maxMonthTotal) * 100;
              const cuotaH = mo.total ? (mo.cuotaTotal / mo.total) * totalH : 0;
              const recH   = mo.total ? (mo.recTotal   / mo.total) * totalH : 0;
              return (
                <div key={mo.key} className={`rounded-lg border ${isCurrent ? "border-[var(--ink)] bg-[var(--bg)]" : "border-[var(--line)] bg-[var(--bg-elev)]"} p-3 flex flex-col gap-2`}>
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">{MES[mo.m]} {mo.y}</div>
                    {isCurrent && <Badge tone="dark" className="!text-[9px]">actual</Badge>}
                  </div>
                  <div className="font-mono text-[16px] tracking-tight">{fmtCLPshort(mo.total)}</div>
                  {/* Mini barra apilada */}
                  <div className="h-2 rounded-full bg-[var(--line)] overflow-hidden flex">
                    <div className="h-full bg-[var(--ink)]" style={{ width: cuotaH + "%" }}/>
                    <div className="h-full bg-[var(--accent)]" style={{ width: recH + "%" }}/>
                  </div>
                  <div className="text-[10.5px] text-[var(--muted)] font-mono flex items-center justify-between">
                    <span>{mo.cuotas.length} cuotas</span>
                    <span>{mo.recCharges.length} rec.</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detalle por mes */}
        <div className="border-t border-[var(--line)] divide-y divide-[var(--line)]">
          {upcomingMonths.map((mo, i) => (
            <details key={mo.key} className="group" open={i < 2}>
              <summary className="px-5 py-3 cursor-pointer flex items-center justify-between hover:bg-[var(--hover)]">
                <div className="flex items-center gap-3">
                  <Icon name="chevron" size={14} className="group-open:rotate-90 transition"/>
                  <span className="font-medium text-[13.5px]">{MES[mo.m]} {mo.y}</span>
                  {i === 0 && <Badge tone="dark" className="!text-[10px]">este mes</Badge>}
                  <span className="text-[12px] text-[var(--muted)]">{mo.cuotas.length + mo.recCharges.length} cargos</span>
                </div>
                <span className="font-mono text-[14px] tabular-nums">{fmtCLP(mo.total)}</span>
              </summary>

              {(mo.cuotas.length > 0 || mo.recCharges.length > 0) && (
                <div className="bg-[var(--bg)] px-5 py-1">
                  <ul className="divide-y divide-[var(--line)]">
                    {[
                      ...mo.cuotas.map(c => ({ ...c, kind: "cuota" })),
                      ...mo.recCharges.map(c => ({ ...c, kind: "rec" })),
                    ].sort((a,b) => a.day - b.day).map((it, idx) => {
                      const cat = window.MOCK.CATEGORIES.find(c => c.id === it.category);
                      const bank = window.MOCK.BANKS.find(b => b.id === it.bank);
                      return (
                        <li key={idx} className="py-2.5 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-md grid place-items-center text-[var(--muted)] font-mono text-[11px] shrink-0 bg-[var(--bg-elev)] border border-[var(--line)]">
                            {String(it.day).padStart(2,"0")}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[13px] font-medium">{it.description}</span>
                              {it.kind === "cuota" ? (
                                <Badge tone="muted" className="!text-[10px] font-mono">#{it.n}/{it.total}</Badge>
                              ) : (
                                <Badge tone="ok" className="!text-[10px]">recurrente</Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-[var(--muted)] mt-0.5 flex items-center gap-1.5">
                              <span>{cat?.label}</span>
                              <span>·</span>
                              <span>{bank?.label}</span>
                            </div>
                          </div>
                          <div className="font-mono text-[13px] tabular-nums shrink-0">{fmtCLP(it.amount)}</div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </details>
          ))}
        </div>
      </Card>
    </div>
  );
}

function KPI({ label, value, sub, icon }) {
  const { Icon } = window.Helpers;
  const { Card } = window.UI;
  return (
    <Card padding="p-4">
      <div className="flex items-start justify-between">
        <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">{label}</div>
        {icon && <span className="text-[var(--muted)]"><Icon name={icon} size={14}/></span>}
      </div>
      <div className="mt-2 font-mono text-[22px] md:text-[24px] tracking-tight leading-none">{value}</div>
      {sub && <div className="mt-1.5 text-[11.5px] text-[var(--muted)]">{sub}</div>}
    </Card>
  );
}

window.Installments = Installments;
