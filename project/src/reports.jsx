/* Reports — monthly trend, categories, medios, bancos */

function MonthlyChart({ expenses }) {
  const currentTotal = expenses.reduce((s, e) => s + e.monto, 0);
  const series = MONTHLY_SERIES.map((m) => m.total === null ? { ...m, total: currentTotal, current: true } : m);
  const max = Math.max(...series.map(s => s.total));
  const avg = series.reduce((s, m) => s + m.total, 0) / series.length;

  return (
    <div className="card">
      <div className="card-h">
        <div>
          <div className="title">Gasto mensual</div>
          <div className="sub">Últimos 7 meses · CLP</div>
        </div>
        <div className="right">
          <div className="row" style={{ gap: 14 }}>
            <div className="row" style={{ gap: 6 }}>
              <span className="lg-dot" style={{ background: "var(--ink)" }} />
              <span className="tiny muted">Mes</span>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <span className="lg-dot" style={{ background: "var(--accent)" }} />
              <span className="tiny muted">Mes actual</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <div className="bars-y" style={{ gridTemplateColumns: `repeat(${series.length}, 1fr)`, height: 220 }}>
          {series.map((s, i) => {
            const h = (s.total / max) * 100;
            return (
              <div key={i} className="col" style={{ background: "transparent", borderRadius: 0, alignItems: "stretch", justifyContent: "flex-end", height: "100%" }}>
                <div className="col" style={{ height: h + "%", justifyContent: "flex-end", position: "relative" }}>
                  <div style={{
                    background: s.current ? "var(--accent)" : "var(--ink)",
                    height: "100%",
                    borderRadius: "8px 8px 0 0",
                    position: "relative",
                  }}>
                    <span style={{
                      position: "absolute", top: -22, left: "50%", transform: "translateX(-50%)",
                      fontSize: 11, fontFamily: "Geist Mono, monospace", color: s.current ? "var(--accent-ink)" : "var(--ink-3)",
                      whiteSpace: "nowrap", fontWeight: 600,
                    }}>{fmtCLPshort(s.total)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{
          position: "absolute", left: 0, right: 0,
          bottom: ((avg / max) * 220) + "px",
          borderTop: "1px dashed var(--line)",
          pointerEvents: "none",
        }}>
          <span style={{
            position: "absolute", right: 0, top: -16,
            fontSize: 10, fontFamily: "Geist Mono, monospace",
            color: "var(--ink-4)", background: "var(--bg-elev)", padding: "0 4px",
          }}>promedio {fmtCLPshort(avg)}</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${series.length}, 1fr)`, gap: 6, marginTop: 8 }}>
        {series.map((s, i) => (
          <span key={i} className="tiny mono" style={{ textAlign: "center", color: "var(--ink-4)" }}>{s.m}</span>
        ))}
      </div>
    </div>
  );
}

function ReportTable({ title, rows, total }) {
  const max = rows[0]?.value || 1;
  return (
    <div className="card">
      <div className="card-h">
        <div className="title">{title}</div>
        <div className="sub">{rows.length} items</div>
      </div>
      <table className="tbl" style={{ borderRadius: 8, overflow: "hidden" }}>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={{ width: 24 }}>
                <span className="lg-dot" style={{ background: r.color || "var(--ink-3)" }} />
              </td>
              <td style={{ fontWeight: 500 }}>{r.label}</td>
              <td style={{ width: "40%" }}>
                <div className="bar thin" style={{ background: "var(--bg-sunken)" }}>
                  <i style={{ width: ((r.value / max) * 100) + "%", background: r.color || "var(--ink)" }} />
                </div>
              </td>
              <td className="mono tnum" style={{ textAlign: "right", width: 90 }}>
                {((r.value / total) * 100).toFixed(1)}%
              </td>
              <td className="mono tnum" style={{ textAlign: "right", width: 110, fontWeight: 500 }}>
                {fmtCLP(r.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Reports({ expenses }) {
  const total = expenses.reduce((s, e) => s + e.monto, 0);

  // Categories
  const byCat = {};
  expenses.forEach((e) => { byCat[e.cat] = (byCat[e.cat] || 0) + e.monto; });
  const catRows = CATEGORIES
    .map((c) => ({ label: c.label, value: byCat[c.id] || 0, color: c.color }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);

  // Medio
  const byMedio = {};
  expenses.forEach((e) => { byMedio[e.medio] = (byMedio[e.medio] || 0) + e.monto; });
  const medioColors = { "Tarjeta": "#0F100E", "Transferencia": "#5B8C5A", "Efectivo": "#C7A04A" };
  const medioRows = Object.entries(byMedio)
    .map(([k, v]) => ({ label: k, value: v, color: medioColors[k] }))
    .sort((a, b) => b.value - a.value);

  // Banco
  const byBanco = {};
  expenses.forEach((e) => {
    const k = e.banco === "—" ? "Sin banco" : e.banco;
    byBanco[k] = (byBanco[k] || 0) + e.monto;
  });
  const bancoRows = Object.entries(byBanco)
    .map(([k, v]) => ({ label: k, value: v, color: "var(--ink)" }))
    .sort((a, b) => b.value - a.value);

  // Tipo
  const byTipo = { debito: 0, credito: 0 };
  expenses.forEach((e) => { byTipo[e.tipo] += e.monto; });

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="page-h">
        <div>
          <h1>Reportes</h1>
          <p>Datos del mes en curso · {expenses.length} gastos · {fmtCLP(total)}</p>
        </div>
        <div className="right">
          <div className="seg hide-mobile">
            <button className="on">Mes</button>
            <button>Trimestre</button>
            <button>Año</button>
          </div>
          <button className="btn"><Icon name="download" size={14}/> PDF</button>
        </div>
      </div>

      <MonthlyChart expenses={expenses} />

      <div className="grid g-2">
        <ReportTable title="Por categoría" rows={catRows} total={total} />
        <ReportTable title="Por medio de pago" rows={medioRows} total={total} />
      </div>

      <div className="grid g-2">
        <ReportTable title="Por banco / tarjeta" rows={bancoRows} total={total} />

        <div className="card">
          <div className="card-h">
            <div className="title">Crédito vs Débito</div>
            <div className="sub">Mix del mes</div>
          </div>
          <div className="row" style={{ gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div className="tiny muted">Crédito</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 600, marginTop: 2 }}>{fmtCLP(byTipo.credito)}</div>
              <div className="tiny muted">{((byTipo.credito / total) * 100).toFixed(0)}% del total</div>
            </div>
            <div style={{ width: 1, background: "var(--line)", alignSelf: "stretch" }}></div>
            <div style={{ flex: 1 }}>
              <div className="tiny muted">Débito</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 600, marginTop: 2 }}>{fmtCLP(byTipo.debito)}</div>
              <div className="tiny muted">{((byTipo.debito / total) * 100).toFixed(0)}% del total</div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div className="bar" style={{ height: 12 }}>
              <i style={{ width: ((byTipo.credito / total) * 100) + "%", background: "var(--info)", display: "inline-block", height: "100%", float: "left" }} />
              <i style={{ width: ((byTipo.debito / total) * 100) + "%", background: "var(--ink)", display: "inline-block", height: "100%", float: "left" }} />
            </div>
            <div className="row between" style={{ marginTop: 6 }}>
              <span className="tiny muted"><span className="lg-dot" style={{ background: "var(--info)" }} /> Crédito</span>
              <span className="tiny muted"><span className="lg-dot" style={{ background: "var(--ink)" }} /> Débito</span>
            </div>
          </div>

          <div className="sep"></div>

          <div className="tiny muted" style={{ marginBottom: 8 }}>Cuotas activas</div>
          <div className="col" style={{ gap: 6 }}>
            {expenses.filter(e => e.cuotas > 1).slice(0, 4).map((e) => (
              <div key={e.id} className="row between" style={{ fontSize: 12.5 }}>
                <span>{e.desc}</span>
                <span className="mono">{e.cuotas}x · {fmtCLP(Math.round(e.monto / e.cuotas))}/mes</span>
              </div>
            ))}
            {expenses.filter(e => e.cuotas > 1).length === 0 ? <div className="tiny muted">Sin cuotas este mes</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

window.Reports = Reports;
