/* Mensajes — unparsed + recent log */

function MessagesView({ unparsed, setUnparsed, expenses, onCreateExpense }) {
  const [tab, setTab] = React.useState("unparsed"); // unparsed | history
  const [completing, setCompleting] = React.useState(null); // message id

  const dismiss = (id) => setUnparsed(unparsed.filter((m) => m.id !== id));

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="page-h">
        <div>
          <h1>Mensajes</h1>
          <p>Lo que el bot recibió desde Telegram. Revisa los que no pudo interpretar.</p>
        </div>
        <div className="right">
          <div className="seg">
            <button className={tab === "unparsed" ? "on" : ""} onClick={() => setTab("unparsed")}>
              No interpretados {unparsed.length > 0 ? <span style={{ marginLeft: 6 }} className="mono tiny">{unparsed.length}</span> : null}
            </button>
            <button className={tab === "history" ? "on" : ""} onClick={() => setTab("history")}>
              Historial
            </button>
          </div>
        </div>
      </div>

      {tab === "unparsed" ? (
        <>
          <div className="card" style={{
            background: "var(--warn-soft)",
            borderColor: "transparent",
            padding: 12,
          }}>
            <div className="row" style={{ gap: 10 }}>
              <Icon name="alert" size={14} />
              <div className="tiny" style={{ color: "var(--warn-ink)", fontWeight: 500 }}>
                Estos mensajes llegaron por Telegram pero el bot no logró extraer un gasto válido. Revísalos para completar los datos o descartarlos.
              </div>
            </div>
          </div>

          {unparsed.length === 0 ? (
            <div className="card">
              <div className="empty">
                <Icon name="check-circle" size={32} style={{ color: "var(--accent)", marginBottom: 8 }} />
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>Sin mensajes pendientes</div>
                <div className="tiny muted">Todo lo recibido fue interpretado correctamente.</div>
              </div>
            </div>
          ) : (
            <div className="col" style={{ gap: 10 }}>
              {unparsed.map((m) => (
                <UnparsedRow
                  key={m.id} m={m}
                  onDismiss={() => dismiss(m.id)}
                  onComplete={() => setCompleting(m)}
                />
              ))}
            </div>
          )}

          <div className="grid g-3">
            <div className="card" style={{ padding: 12 }}>
              <div className="tiny muted">Recibidos hoy</div>
              <div className="mono" style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>12</div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div className="tiny muted">Interpretados</div>
              <div className="mono" style={{ fontSize: 24, fontWeight: 600, marginTop: 4, color: "var(--accent-ink)" }}>10</div>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <div className="tiny muted">Por revisar</div>
              <div className="mono" style={{ fontSize: 24, fontWeight: 600, marginTop: 4, color: "var(--warn-ink)" }}>{unparsed.length}</div>
            </div>
          </div>
        </>
      ) : (
        <HistoryView expenses={expenses} unparsed={unparsed} />
      )}

      {completing ? (
        <CompleteMessageSheet
          message={completing}
          onClose={() => setCompleting(null)}
          onSave={(exp) => {
            onCreateExpense(exp);
            dismiss(completing.id);
            setCompleting(null);
          }}
        />
      ) : null}
    </div>
  );
}

function UnparsedRow({ m, onDismiss, onComplete }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
        <div className="avatar" style={{ width: 30, height: 30 }}>JR</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row between" style={{ marginBottom: 6 }}>
            <div className="tiny muted mono">{m.received}</div>
            <span className="badge warn"><Icon name="alert" size={10}/> No interpretado</span>
          </div>
          <div className="bubble" style={{
            display: "inline-block",
            maxWidth: "100%",
            background: "var(--bg-sunken)",
            padding: "10px 14px",
            fontSize: 14,
          }}>"{m.text}"</div>
          <div className="tiny muted" style={{ marginTop: 8 }}>
            <Icon name="info" size={11}/> {m.hint}
          </div>
        </div>
      </div>
      <div className="row" style={{ gap: 6, marginTop: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button className="btn" onClick={onDismiss}>
          <Icon name="trash" size={13}/> Descartar
        </button>
        <button className="btn" onClick={onComplete}>
          <Icon name="eye" size={13}/> Revisar
        </button>
        <button className="btn primary" onClick={onComplete}>
          <Icon name="edit" size={13}/> Completar manualmente
        </button>
      </div>
    </div>
  );
}

function HistoryView({ expenses, unparsed }) {
  // Build a unified log: parsed expenses + unparsed messages, sorted desc
  const items = [];
  BOT_ACTIVITY.forEach((b, i) => {
    items.push({ kind: "log", ts: b.ts, in: b.in, out: b.out, id: "b" + i });
  });
  return (
    <div className="card">
      <div className="card-h">
        <div className="title">Últimos mensajes recibidos</div>
        <div className="sub">Historial · Solo lectura · No es un canal de carga</div>
      </div>
      <div className="col" style={{ gap: 14 }}>
        {items.map((it) => (
          <div key={it.id} className="col" style={{ gap: 6 }}>
            <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
              <div className="avatar" style={{ width: 26, height: 26, fontSize: 10 }}>JR</div>
              <div>
                <div className="bubble" style={{ padding: "6px 10px", fontSize: 12.5 }}>{it.in}</div>
                <div className="tiny muted mono" style={{ marginTop: 2 }}>{it.ts}</div>
              </div>
            </div>
            <div className="row" style={{ gap: 8, alignItems: "flex-start", paddingLeft: 34 }}>
              <div className="avatar" style={{ width: 26, height: 26, fontSize: 10, background: "var(--ink)", color: "var(--bg)" }}>
                <Icon name="telegram" size={11}/>
              </div>
              <div>
                <div className="bubble" style={{
                  padding: "6px 10px", fontSize: 12.5,
                  background: it.out.startsWith("✓") ? "var(--accent-soft)" : "var(--warn-soft)",
                  color: it.out.startsWith("✓") ? "var(--accent-ink)" : "var(--warn-ink)",
                  borderRadius: "12px 12px 4px 12px",
                }}>{it.out}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="sep"></div>
      <div className="tiny muted" style={{ textAlign: "center" }}>
        Para registrar un gasto, escríbele al bot en Telegram.
      </div>
    </div>
  );
}

function CompleteMessageSheet({ message, onClose, onSave }) {
  const [form, setForm] = React.useState({
    desc: "",
    monto: 0,
    fecha: "2026-05-13",
    cat: "otros",
    medio: "Tarjeta",
    banco: "—",
    tipo: "debito",
    cuotas: 1,
    estado: "registrado",
    notas: "Completado manualmente desde mensaje: " + message.text,
    id: "g" + Math.floor(Math.random() * 90000 + 1000),
  });
  const set = (k, v) => setForm({ ...form, [k]: v });

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-h">
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "var(--warn-soft)", color: "var(--warn-ink)",
            display: "grid", placeItems: "center",
          }}>
            <Icon name="alert" size={16}/>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Completar mensaje</div>
            <div className="tiny muted">El bot no logró interpretarlo</div>
          </div>
          <button className="btn icon ghost" onClick={onClose} style={{ marginLeft: "auto" }}>
            <Icon name="x" size={16}/>
          </button>
        </div>
        <div className="sheet-body">
          <div className="card" style={{ background: "var(--bg-sunken)", padding: 12, marginBottom: 14 }}>
            <div className="tiny muted" style={{ marginBottom: 6 }}>Mensaje original</div>
            <div style={{ fontSize: 14, fontStyle: "italic" }}>"{message.text}"</div>
            <div className="tiny muted mono" style={{ marginTop: 6 }}>{message.received}</div>
          </div>

          <div className="grid g-2" style={{ gap: 12 }}>
            <div className="field" style={{ gridColumn: "span 2" }}>
              <label>Descripción</label>
              <input className="input" placeholder="¿En qué se gastó?" value={form.desc} onChange={(e) => set("desc", e.target.value)} />
            </div>
            <div className="field">
              <label>Monto (CLP)</label>
              <input className="input mono" type="number" placeholder="0" value={form.monto || ""} onChange={(e) => set("monto", parseInt(e.target.value || 0))} />
            </div>
            <div className="field">
              <label>Fecha</label>
              <input className="input mono" type="date" value={form.fecha} onChange={(e) => set("fecha", e.target.value)} />
            </div>
            <div className="field">
              <label>Categoría</label>
              <select className="select" value={form.cat} onChange={(e) => set("cat", e.target.value)}>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Medio de pago</label>
              <select className="select" value={form.medio} onChange={(e) => set("medio", e.target.value)}>
                {MEDIOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Banco / Tarjeta</label>
              <select className="select" value={form.banco} onChange={(e) => set("banco", e.target.value)}>
                <option value="—">Sin banco</option>
                {BANCOS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Tipo</label>
              <div className="seg" style={{ alignSelf: "flex-start" }}>
                <button className={form.tipo === "debito" ? "on" : ""} onClick={() => set("tipo", "debito")}>Débito</button>
                <button className={form.tipo === "credito" ? "on" : ""} onClick={() => set("tipo", "credito")}>Crédito</button>
              </div>
            </div>
          </div>
        </div>
        <div className="sheet-f">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={() => onSave(form)} disabled={!form.desc || !form.monto}>
            <Icon name="check" size={14}/> Crear gasto
          </button>
        </div>
      </div>
    </div>
  );
}

window.MessagesView = MessagesView;
