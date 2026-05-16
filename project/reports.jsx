// Reports
function Reports({ expenses }) {
  const { Card, Badge, BarRow } = window.UI;
  const { Icon, fmtCLP, fmtCLPshort, MES } = window.Helpers;
  const today = window.MOCK.TODAY;

  // Total mes en curso
  const thisMonthTotal = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  }).reduce((s,e) => s+e.amount, 0);

  // Histórico mensual (los últimos 5 son históricos + el actual calculado)
  const monthly = window.MOCK.MONTHLY_HISTORY.map(m => ({
    ...m,
    total: m.total ?? thisMonthTotal,
  }));
  const monthlyMax = Math.max(...monthly.map(m => m.total));
  const avgMonthly = monthly.reduce((s,m) => s+m.total, 0) / monthly.length;

  // Por categoría (todos los meses cargados)
  const byCat = {};
  expenses.forEach(e => { byCat[e.category] = (byCat[e.category]||0) + e.amount; });
  const catArr = Object.entries(byCat).map(([id, v]) => {
    const c = window.MOCK.CATEGORIES.find(x => x.id === id);
    return { id, v, ...c };
  }).sort((a,b) => b.v - a.v);
  const catTotal = catArr.reduce((s,c) => s+c.v, 0);
  const catMax = catArr[0]?.v || 1;

  // Por medio
  const byMethod = { debito: 0, credito: 0, efectivo: 0 };
  expenses.forEach(e => {
    if (e.method === "efectivo") byMethod.efectivo += e.amount;
    else if (e.type === "debito") byMethod.debito += e.amount;
    else byMethod.credito += e.amount;
  });
  const methodTotal = byMethod.debito + byMethod.credito + byMethod.efectivo;

  // Por banco
  const byBank = {};
  expenses.forEach(e => { byBank[e.bank] = (byBank[e.bank]||0) + e.amount; });
  const bankArr = Object.entries(byBank).map(([id, v]) => ({ id, v, label: window.MOCK.BANKS.find(b => b.id === id)?.label || id }))
    .sort((a,b) => b.v - a.v);
  const bankMax = bankArr[0]?.v || 1;

  return (
    <div className="flex flex-col gap-5">
      {/* Gastos por mes - barras */}
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
            const h = (m.total / monthlyMax) * 100;
            const isCurrent = i === monthly.length - 1;
            return (
              <div key={m.month} className="flex flex-col items-center gap-2 group h-full">
                <div className="flex-1 w-full flex flex-col justify-end relative">
                  <div className="absolute -top-1 left-0 right-0 text-center font-mono text-[10.5px] text-[var(--muted)] opacity-0 group-hover:opacity-100 transition">
                    {fmtCLPshort(m.total)}
                  </div>
                  <div className="rounded-t-md transition-all"
                       style={{
                         height: h + "%",
                         background: isCurrent ? "var(--ink)" : "var(--ink-3)",
                         minHeight: "4px"
                       }}/>
                </div>
                <div className={`text-[11px] ${isCurrent ? "font-semibold text-[var(--ink)]" : "text-[var(--muted)]"}`}>{m.month}</div>
                <div className={`font-mono text-[11px] ${isCurrent ? "text-[var(--ink-2)]" : "text-[var(--muted)]"}`}>
                  {fmtCLPshort(m.total)}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Por categoría - donut + lista */}
        <Card padding="p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">Por categoría</div>
              <div className="mt-1 font-semibold tracking-tight">{fmtCLP(catTotal)}</div>
            </div>
            <Badge tone="muted">{catArr.length} cat</Badge>
          </div>

          <div className="mt-5 flex items-center gap-6 flex-wrap">
            <DonutChart data={catArr.map(c => ({ value: c.v, color: c.color, label: c.label }))} size={160} />
            <div className="flex-1 min-w-[180px] flex flex-col gap-2.5">
              {catArr.slice(0, 6).map(c => (
                <div key={c.id} className="flex items-center gap-2 text-[12.5px]">
                  <span className="w-2 h-2 rounded-full" style={{ background: c.color }}></span>
                  <span className="flex-1 truncate">{c.label}</span>
                  <span className="font-mono text-[12px] text-[var(--ink-2)] tabular-nums">{Math.round((c.v/catTotal)*100)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-[var(--line)] flex flex-col gap-3">
            {catArr.slice(0, 5).map(c => (
              <BarRow key={c.id} label={<span>{c.icon} {c.label}</span>} value={c.v} max={catMax} color={c.color}
                      right={Math.round((c.v/catTotal)*100)+"%"}/>
            ))}
          </div>
        </Card>

        {/* Por medio - tarjetas */}
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

          {/* Bancos */}
          <div className="mt-6 pt-5 border-t border-[var(--line)]">
            <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)] mb-3">Por banco / tarjeta</div>
            <div className="flex flex-col gap-3">
              {bankArr.map(b => (
                <BarRow key={b.id} label={b.label} value={b.v} max={bankMax} color="var(--ink-2)"
                        right={Math.round((b.v/methodTotal)*100)+"%"}/>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Insights */}
      <Card padding="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="info" size={15}/>
          <div className="font-semibold tracking-tight">Observaciones</div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Insight title="Tu mayor gasto del mes" value={fmtCLP(89990)} sub="Mantención auto · 6 cuotas"/>
          <Insight title="Días sin gasto" value="4" sub="Este mes vas mejor que abril"/>
          <Insight title="Crédito acumulado" value={fmtCLP(byMethod.credito)} sub={`${Math.round((byMethod.credito/methodTotal)*100)}% del total`}/>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">{label}</div>
      <div className={`mt-1 font-mono tabular-nums text-[14px] ${accent ? "text-[var(--ink)] font-semibold" : "text-[var(--ink-2)]"}`}>{value}</div>
    </div>
  );
}

function MethodCard({ label, value, total, icon, color }) {
  const { Icon, fmtCLP } = window.Helpers;
  const pct = Math.round((value/total)*100);
  return (
    <div className="rounded-lg border border-[var(--line)] p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-[var(--ink-2)] inline-flex items-center gap-1.5"><Icon name={icon} size={13}/> {label}</span>
        <span className="text-[10px] font-mono text-[var(--muted)]">{pct}%</span>
      </div>
      <div className="mt-2 font-mono text-[18px] tabular-nums tracking-tight">{fmtCLP(value)}</div>
      <div className="mt-2 h-1 rounded-full bg-[var(--line)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: pct+"%", background: color }}/>
      </div>
    </div>
  );
}

function Insight({ title, value, sub }) {
  return (
    <div className="rounded-lg border border-[var(--line)] p-4">
      <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">{title}</div>
      <div className="mt-2 font-mono text-[20px] tracking-tight">{value}</div>
      <div className="mt-1 text-[12px] text-[var(--muted)]">{sub}</div>
    </div>
  );
}

function DonutChart({ data, size = 140 }) {
  const total = data.reduce((s, d) => s+d.value, 0);
  const r = size/2 - 12;
  const c = 2*Math.PI*r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--line)" strokeWidth="14"/>
      {data.map((d, i) => {
        const frac = d.value / total;
        const dash = frac * c;
        const el = (
          <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
            stroke={d.color} strokeWidth="14"
            strokeDasharray={`${dash} ${c-dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size/2} ${size/2})`}
          />
        );
        offset += dash;
        return el;
      })}
      <text x={size/2} y={size/2 - 4} textAnchor="middle" className="fill-[var(--muted)]" fontSize="10" fontFamily="ui-monospace, monospace" letterSpacing="0.06em">TOTAL</text>
      <text x={size/2} y={size/2 + 14} textAnchor="middle" className="fill-[var(--ink)]" fontSize="14" fontFamily="ui-monospace, monospace">
        {window.Helpers.fmtCLPshort(total)}
      </text>
    </svg>
  );
}

window.Reports = Reports;
