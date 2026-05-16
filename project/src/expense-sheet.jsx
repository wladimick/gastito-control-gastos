/* Expense edit sheet (side panel) */

function ExpenseSheet({ expense, onClose, onSave, onDelete }) {
  const [form, setForm] = React.useState(expense);
  React.useEffect(() => setForm(expense), [expense?.id]);
  if (!expense || !form) return null;
  const set = (k, v) => setForm({ ...form, [k]: v });
  const cat = CATEGORIES.find((c) => c.id === form.cat);

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-h">
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: cat.color + "22", color: cat.color,
            display: "grid", placeItems: "center",
          }}>
            <Icon name={iconForCat(form.cat)} size={16} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>Editar gasto</div>
            <div className="tiny muted mono">{form.id}</div>
          </div>
          <div style={{ marginLeft: "auto" }}>
            <button className="btn icon ghost" onClick={onClose} aria-label="Cerrar">
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>

        <div className="sheet-body">
          {form.estado === "revisar" ? (
            <div className="card" style={{ background: "var(--warn-soft)", borderColor: "transparent", padding: 12, marginBottom: 14 }}>
              <div className="row" style={{ gap: 8 }}>
                <Icon name="alert" size={14} />
                <div style={{ fontSize: 12.5, color: "var(--warn-ink)" }}>
                  El bot no pudo interpretar este gasto completamente. Revisa los campos y guarda.
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid g-2" style={{ gap: 12 }}>
            <div className="field" style={{ gridColumn: "span 2" }}>
              <label>Descripción</label>
              <input className="input" value={form.desc} onChange={(e) => set("desc", e.target.value)} />
            </div>

            <div className="field">
              <label>Monto (CLP)</label>
              <input className="input mono" type="number" value={form.monto}
                onChange={(e) => set("monto", parseInt(e.target.value || 0))} />
            </div>
            <div className="field">
              <label>Fecha</label>
              <input className="input mono" type="date" value={form.fecha}
                onChange={(e) => set("fecha", e.target.value)} />
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
              <label>Tipo de pago</label>
              <div className="seg" style={{ alignSelf: "flex-start" }}>
                <button className={form.tipo === "debito" ? "on" : ""} onClick={() => set("tipo", "debito")}>Débito</button>
                <button className={form.tipo === "credito" ? "on" : ""} onClick={() => set("tipo", "credito")}>Crédito</button>
              </div>
            </div>

            <div className="field" style={{ gridColumn: "span 2" }}>
              <label>Cuotas {form.tipo === "credito" ? "" : <span className="muted">(solo crédito)</span>}</label>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                {[1, 3, 6, 12, 24].map((n) => (
                  <button key={n}
                    className={"chip-select " + (form.cuotas === n ? "active" : "")}
                    disabled={form.tipo !== "credito" && n !== 1}
                    onClick={() => set("cuotas", n)}
                    style={{ opacity: (form.tipo !== "credito" && n !== 1) ? 0.4 : 1 }}
                  >
                    {n === 1 ? "Sin cuotas" : `${n} cuotas`}
                  </button>
                ))}
              </div>
            </div>

            <div className="field" style={{ gridColumn: "span 2" }}>
              <label>Notas</label>
              <textarea className="textarea" placeholder="Notas internas, contexto, recordatorios…"
                value={form.notas} onChange={(e) => set("notas", e.target.value)} />
            </div>

            <div className="field" style={{ gridColumn: "span 2" }}>
              <label>Estado</label>
              <div className="row" style={{ gap: 8 }}>
                <button
                  className={"chip-select " + (form.estado === "registrado" ? "active" : "")}
                  onClick={() => set("estado", "registrado")}
                >
                  <Icon name="check" size={12} /> Registrado
                </button>
                <button
                  className={"chip-select " + (form.estado === "revisar" ? "active" : "")}
                  onClick={() => set("estado", "revisar")}
                >
                  <Icon name="alert" size={12} /> Por revisar
                </button>
              </div>
            </div>
          </div>

          <div className="sep"></div>

          <div className="tiny muted" style={{ marginBottom: 6 }}>Origen</div>
          <div className="msg" style={{ padding: 10 }}>
            <div className="avatar" style={{ width: 26, height: 26, fontSize: 10 }}>
              <Icon name="telegram" size={12} />
            </div>
            <div>
              <div className="bubble" style={{ padding: "6px 10px", fontSize: 12.5 }}>
                Gasté {form.monto.toLocaleString("es-CL").replaceAll(",", ".")} en {form.desc.toLowerCase()} con {form.tipo} {form.banco !== "—" ? form.banco : ""}
              </div>
              <div className="tiny muted mono" style={{ marginTop: 4 }}>vía Telegram bot · {form.fecha}</div>
            </div>
          </div>
        </div>

        <div className="sheet-f">
          <button className="btn danger ghost" onClick={() => { onDelete(form.id); onClose(); }}>
            <Icon name="trash" size={14} /> Eliminar
          </button>
          <div style={{ marginLeft: "auto" }}>
            <button className="btn" onClick={onClose}>Cancelar</button>
          </div>
          <button className="btn primary" onClick={() => { onSave(form); onClose(); }}>
            <Icon name="check" size={14} /> Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}

window.ExpenseSheet = ExpenseSheet;
