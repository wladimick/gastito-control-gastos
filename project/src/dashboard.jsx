/* Dashboard */

function KPI({ label, value, sub, icon, accent }) {
  return (
    <div className="card kpi">
      <div className="row between">
        <div className="label">{label}</div>
        <div style={{ color: "var(--ink-3)" }}>
          <Icon name={icon} size={14} />
        </div>
      </div>
      <div className="value">{value}</div>
      <div className="meta">{sub}</div>
    </div>
  );
}

function FlowDiagram() {
  const steps = [
    { icon: "telegram", label: "Telegram",          sub: "App oficial", },
    { icon: "bot",      label: "Bot",               sub: "Recibe el mensaje" },
    { icon: "flow",     label: "Interpretación",    sub: "Extrae monto, categoría…" },
    { icon: "wallet",   label: "Base de datos",     sub: "Gasto guardado" },
    { icon: "dashboard",label: "Este panel",        sub: "Revisar / corregir" },
  ];
  return (
    <div className="card">
      <div className="card-h">
        <div>
          <div className="title">¿Cómo se cargan los gastos?</div>
          <div className="sub">Esta app es solo para revisar y reportar. La carga se hace en Telegram.</div>
        </div>
        <div className="right">
          <span className="badge ghost"><Icon name="info" size={12}/> Solo lectura</span>
        </div>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: 8,
        alignItems: "stretch"
      }} className="flow-grid">
        {steps.map((s, i) => (
          <React.Fragment key={i}>
            <div style={{
              border: "1px solid var(--line)",
              borderRadius: 10,
              padding: "12px 10px",
              background: i === 4 ? "var(--accent-soft)" : "var(--bg)",
              display: "flex", flexDirection: "column", gap: 6,
              minHeight: 84,
            }}>
              <div className="row" style={{ gap: 6 }}>
                <Icon name={s.icon} size={14} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: i === 4 ? "var(--accent-ink)" : "var(--ink)" }}>
                  {s.label}
                </span>
              </div>
              <div className="tiny muted" style={{ color: i === 4 ? "var(--accent-ink)" : "var(--ink-3)" }}>{s.sub}</div>
              <div className="tiny mono" style={{ color: "var(--ink-4)", marginTop: "auto" }}>0{i+1}</div>
            </div>
          </React.Fragment>
        ))}
      </div>
      <style>{`
        @media (max-width: 800px) {
          .flow-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

function CategorySummary({ expenses }) {
  const totals = {};
  let total = 0;
  expenses.forEach((e) => {
    totals[e.cat] = (totals[e.cat] || 0) + e.monto;
    total += e.monto;
  });
  const rows = CATEGORIES
    .map((c) => ({ ...c, monto: totals[c.id] || 0 }))
    .filter((c) => c.monto > 0)
    .sort((a, b) => b.monto - a.monto);
  const max = rows[0]?.monto || 1;
  return (
    <div className="card">
      <div className="card-h">
        <div className="title">Por categoría</div>
        <div className="sub">{rows.length} categorías</div>
      </div>
      <div className="col" style={{ gap: 12 }}>
        {rows.slice(0, 7).map((r) => {
          const pct = (r.monto / total) * 100;
          return (
            <div key={r.id}>
              <div className="row between" style={{ marginBottom: 4 }}>
                <div className="row">
                  <span className="lg-dot" style={{ background: r.color }} />
                  <span style={{ fontSize: 13 }}>{r.label}</span>
                </div>
                <div className="row" style={{ gap: 10 }}>
                  <span className="tiny mono muted">{pct.toFixed(0)}%</span>
                  <span className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>{fmtCLP(r.monto)}</span>
                </div>
              </div>
              <div className="bar thin">
                <i style={{ width: ((r.monto / max) * 100) + "%", background: r.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PaymentSummary({ expenses }) {
  const byMedio = {};
  const byBanco = {};
  let total = 0;
  expenses.forEach((e) => {
    byMedio[e.medio] = (byMedio[e.medio] || 0) + e.monto;
    byBanco[e.banco] = (byBanco[e.banco] || 0) + e.monto;
    total += e.monto;
  });

  // Donut for medios
  const medios = Object.entries(byMedio).map(([k, v]) => ({ k, v }));
  const colors = ["#0F100E", "#5B8C5A", "#C7A04A", "#9A9B94"];
  let cum = 0;
  const stops = medios.map((m, i) => {
    const a = cum;
    cum += (m.v / total) * 360;
    return `${colors[i % colors.length]} ${a}deg ${cum}deg`;
  });

  return (
    <div className="card">
      <div className="card-h">
        <div className="title">Por medio de pago</div>
        <div className="sub">Distribución del mes</div>
      </div>
      <div className="donut-wrap">
        <div className="donut" style={{ background: `conic-gradient(${stops.join(",")})` }}>
          <div className="ctr">
            <div className="n">{medios.length}</div>
            <div className="l">medios</div>
          </div>
        </div>
        <div className="col" style={{ flex: 1, gap: 8 }}>
          {medios.map((m, i) => (
            <div key={m.k} className="row between">
              <div className="row">
                <span className="lg-dot" style={{ background: colors[i % colors.length] }} />
                <span style={{ fontSize: 13 }}>{m.k}</span>
              </div>
              <div className="row" style={{ gap: 10 }}>
                <span className="tiny mono muted">{((m.v / total) * 100).toFixed(0)}%</span>
                <span className="mono" style={{ fontSize: 12.5, fontWeight: 500 }}>{fmtCLP(m.v)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sep"></div>
      <div className="tiny muted" style={{ marginBottom: 8, fontWeight: 500 }}>Top bancos / tarjetas</div>
      <div className="col" style={{ gap: 8 }}>
        {Object.entries(byBanco)
          .filter(([b]) => b !== "—")
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([b, v]) => (
            <div key={b} className="row between">
              <div className="row">
                <Icon name="card" size={14} />
                <span style={{ fontSize: 13 }}>{b}</span>
              </div>
              <span className="mono" style={{ fontSize: 12.5 }}>{fmtCLP(v)}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

function RecentExpenses({ expenses, onOpen, onGoToList }) {
  const recent = [...expenses]
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 6);
  return (
    <div className="card">
      <div className="card-h">
        <div className="title">Últimos gastos</div>
        <div className="sub">Capturados por el bot</div>
        <div className="right">
          <button className="btn ghost sm" onClick={onGoToList}>
            Ver todos <Icon name="arrow-right" size={12} />
          </button>
        </div>
      </div>
      <div className="col" style={{ gap: 2 }}>
        {recent.map((e) => {
          const cat = CATEGORIES.find((c) => c.id === e.cat);
          return (
            <div key={e.id} className="row between" style={{
              padding: "10px 4px",
              borderBottom: "1px solid var(--line-2)",
              cursor: "pointer"
            }} onClick={() => onOpen(e)}>
              <div className="row">
                <div style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: cat.color + "22", color: cat.color,
                  display: "grid", placeItems: "center", flexShrink: 0,
                }}>
                  <Icon name={iconForCat(e.cat)} size={14} />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500 }}>{e.desc}</div>
                  <div className="tiny muted">
                    {fmtDate(e.fecha)} · {cat.label} · {e.banco !== "—" ? e.banco : e.medio}
                  </div>
                </div>
              </div>
              <div className="row" style={{ gap: 10 }}>
                {e.estado === "revisar" ? (
                  <span className="badge warn">Revisar</span>
                ) : null}
                <span className="mono" style={{ fontWeight: 500 }}>{fmtCLP(e.monto)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BotStatus({ botOn, lastActivity }) {
  return (
    <div className="card">
      <div className="card-h">
        <div className="title">Estado del bot</div>
        <div className="right">
          <span className={"badge " + (botOn ? "success" : "danger")}>
            <span className={"dot " + (botOn ? "on" : "off")}></span>
            {botOn ? "Conectado" : "Desconectado"}
          </span>
        </div>
      </div>
      <div className="col" style={{ gap: 10 }}>
        <div className="row between">
          <span className="tiny muted">Última actividad</span>
          <span className="mono tiny">hoy, 18:42</span>
        </div>
        <div className="row between">
          <span className="tiny muted">Mensajes hoy</span>
          <span className="mono tiny">12</span>
        </div>
        <div className="row between">
          <span className="tiny muted">Interpretados correctamente</span>
          <span className="mono tiny">10 / 12</span>
        </div>
        <div className="bar accent" style={{ marginTop: 2 }}>
          <i style={{ width: "83%" }} />
        </div>
      </div>
      <div className="sep"></div>
      <div className="tiny muted" style={{ marginBottom: 6 }}>Último mensaje</div>
      <div className="msg" style={{ padding: 10 }}>
        <div className="avatar" style={{ width: 26, height: 26, fontSize: 10 }}>JR</div>
        <div>
          <div className="bubble" style={{ padding: "6px 10px", fontSize: 12.5 }}>
            Gasté 12.500 en bencina hoy con crédito Banco Chile
          </div>
          <div className="tiny muted mono" style={{ marginTop: 4 }}>hoy, 18:42</div>
        </div>
      </div>
    </div>
  );
}

function iconForCat(id) {
  return ({
    bencina: "card",
    supermercado: "store",
    comida: "store",
    farmacia: "tag",
    transporte: "card",
    servicios: "globe",
    entretencion: "play",
    salud: "tag",
    otros: "tag",
  })[id] || "tag";
}

function fmtDate(s) {
  const d = new Date(s + "T00:00:00");
  const today = new Date("2026-05-13T00:00:00");
  const diff = Math.round((today - d) / 86400000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  if (diff < 7) return ["dom","lun","mar","mié","jue","vie","sáb"][d.getDay()];
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
}

function Dashboard({ expenses, setRoute, openExpense, botOn, showFlow = true }) {
  const total = expenses.reduce((s, e) => s + e.monto, 0);
  const count = expenses.length;
  const promedio = total / Math.max(1, count);

  // Most used medio
  const medioCount = {};
  expenses.forEach((e) => {
    const key = e.banco !== "—" ? `${e.banco} ${e.tipo === "credito" ? "crédito" : "débito"}` : e.medio;
    medioCount[key] = (medioCount[key] || 0) + 1;
  });
  const topMedio = Object.entries(medioCount).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="page-h">
        <div>
          <h1>Mayo 2026</h1>
          <p>Resumen del mes en curso · CLP</p>
        </div>
        <div className="right">
          <div className="seg hide-mobile">
            <button className="on">Este mes</button>
            <button>Mes anterior</button>
            <button>Año</button>
          </div>
          <button className="btn"><Icon name="download" size={14}/> Exportar</button>
        </div>
      </div>

      <div className="grid g-4">
        <KPI label="Total gastado" value={fmtCLP(total)} icon="wallet"
             sub={<><span className="delta-down">▼ 9%</span><span>vs. abril</span></>} />
        <KPI label="Gastos registrados" value={count} icon="list"
             sub={<><span className="muted">{expenses.filter(e=>e.estado==="revisar").length} por revisar</span></>} />
        <KPI label="Gasto promedio" value={fmtCLP(promedio)} icon="chart"
             sub={<><span className="muted">por transacción</span></>} />
        <KPI label="Medio de pago top" value={topMedio[0].split(" ")[0]} icon="card"
             sub={<><span className="muted">{topMedio[1]} usos · {topMedio[0]}</span></>} />
      </div>

      {showFlow ? <FlowDiagram /> : null}

      <div className="grid g-3">
        <div style={{ gridColumn: "span 2" }}>
          <RecentExpenses expenses={expenses} onOpen={openExpense} onGoToList={() => setRoute("expenses")} />
        </div>
        <BotStatus botOn={botOn} />
      </div>

      <div className="grid g-2">
        <CategorySummary expenses={expenses} />
        <PaymentSummary expenses={expenses} />
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;
window.iconForCat = iconForCat;
window.fmtDate = fmtDate;
