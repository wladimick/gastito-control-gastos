/* Expenses List with filters + table/cards + actions */

function FilterChip({ label, value, options, onChange, icon }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  const cur = options.find((o) => o.value === value);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className={"chip-select " + (value !== "all" ? "active" : "")}
        onClick={() => setOpen((v) => !v)}
      >
        {icon ? <Icon name={icon} size={12} /> : null}
        <span>{label}:</span>
        <span className="v">{cur ? cur.label : "Todos"}</span>
        <Icon name="chevron-down" size={12} />
      </button>
      {open ? (
        <div style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          left: 0,
          minWidth: 180,
          background: "var(--bg-elev)",
          border: "1px solid var(--line)",
          borderRadius: 10,
          boxShadow: "var(--shadow-lg)",
          padding: 4,
          zIndex: 10,
          maxHeight: 280,
          overflowY: "auto",
        }}>
          {options.map((o) => (
            <div key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              style={{
                padding: "7px 10px",
                fontSize: 13,
                borderRadius: 6,
                cursor: "pointer",
                background: o.value === value ? "var(--bg-sunken)" : "transparent",
                display: "flex", alignItems: "center", gap: 8,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-sunken)"}
              onMouseLeave={(e) => e.currentTarget.style.background = o.value === value ? "var(--bg-sunken)" : "transparent"}
            >
              {o.dot ? <span className="lg-dot" style={{ background: o.dot }} /> : null}
              <span>{o.label}</span>
              {o.value === value ? <Icon name="check" size={12} style={{ marginLeft: "auto" }} /> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ExpensesList({ expenses, setExpenses, openExpense }) {
  const [filters, setFilters] = React.useState({
    mes: "2026-05",
    cat: "all",
    banco: "all",
    medio: "all",
    tipo: "all",
    estado: "all",
  });
  const [selected, setSelected] = React.useState(new Set());

  const filtered = expenses.filter((e) => {
    if (filters.mes !== "all" && !e.fecha.startsWith(filters.mes)) return false;
    if (filters.cat !== "all" && e.cat !== filters.cat) return false;
    if (filters.banco !== "all" && e.banco !== filters.banco) return false;
    if (filters.medio !== "all" && e.medio !== filters.medio) return false;
    if (filters.tipo !== "all" && e.tipo !== filters.tipo) return false;
    if (filters.estado !== "all" && e.estado !== filters.estado) return false;
    return true;
  }).sort((a, b) => b.fecha.localeCompare(a.fecha));

  const total = filtered.reduce((s, e) => s + e.monto, 0);

  const toggleSel = (id) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((e) => e.id)));
  };

  const markReviewed = (id) => {
    setExpenses(expenses.map((e) => e.id === id ? { ...e, estado: "registrado" } : e));
  };
  const remove = (id) => {
    setExpenses(expenses.filter((e) => e.id !== id));
    const s = new Set(selected); s.delete(id); setSelected(s);
  };

  const reset = () => setFilters({ mes: "2026-05", cat: "all", banco: "all", medio: "all", tipo: "all", estado: "all" });

  const hasActiveFilter = Object.entries(filters).some(([k, v]) =>
    !(k === "mes" && v === "2026-05") && v !== "all"
  );

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="page-h">
        <div>
          <h1>Gastos</h1>
          <p>{filtered.length} resultados · Total {fmtCLP(total)}</p>
        </div>
        <div className="right">
          <button className="btn"><Icon name="download" size={14}/> Exportar CSV</button>
        </div>
      </div>

      <div className="filters">
        <FilterChip label="Mes" value={filters.mes} icon="calendar"
          options={[
            { value: "all", label: "Todos" },
            { value: "2026-05", label: "Mayo 2026" },
            { value: "2026-04", label: "Abril 2026" },
            { value: "2026-03", label: "Marzo 2026" },
          ]}
          onChange={(v) => setFilters({ ...filters, mes: v })}
        />
        <FilterChip label="Categoría" value={filters.cat} icon="tag"
          options={[{ value: "all", label: "Todas" }, ...CATEGORIES.map(c => ({ value: c.id, label: c.label, dot: c.color }))]}
          onChange={(v) => setFilters({ ...filters, cat: v })}
        />
        <FilterChip label="Banco" value={filters.banco} icon="card"
          options={[{ value: "all", label: "Todos" }, ...BANCOS.map(b => ({ value: b, label: b })), { value: "—", label: "Sin banco" }]}
          onChange={(v) => setFilters({ ...filters, banco: v })}
        />
        <FilterChip label="Medio" value={filters.medio} icon="wallet"
          options={[{ value: "all", label: "Todos" }, ...MEDIOS.map(m => ({ value: m, label: m }))]}
          onChange={(v) => setFilters({ ...filters, medio: v })}
        />
        <FilterChip label="Tipo" value={filters.tipo}
          options={[
            { value: "all", label: "Todos" },
            { value: "credito", label: "Crédito" },
            { value: "debito",  label: "Débito" },
          ]}
          onChange={(v) => setFilters({ ...filters, tipo: v })}
        />
        <FilterChip label="Estado" value={filters.estado}
          options={[
            { value: "all", label: "Todos" },
            { value: "registrado", label: "Registrado" },
            { value: "revisar",    label: "Por revisar" },
          ]}
          onChange={(v) => setFilters({ ...filters, estado: v })}
        />
        {hasActiveFilter ? (
          <button className="btn ghost sm" onClick={reset}>
            <Icon name="x" size={12} /> Limpiar filtros
          </button>
        ) : null}
      </div>

      {selected.size > 0 ? (
        <div className="row between" style={{
          background: "var(--ink)", color: "var(--bg)",
          padding: "8px 14px", borderRadius: 10, fontSize: 13,
        }}>
          <span>{selected.size} seleccionados</span>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm" style={{ background: "transparent", color: "var(--bg)", borderColor: "rgba(255,255,255,0.2)" }}>
              <Icon name="check" size={12} /> Marcar revisados
            </button>
            <button className="btn sm" style={{ background: "transparent", color: "var(--bg)", borderColor: "rgba(255,255,255,0.2)" }}>
              <Icon name="trash" size={12} /> Eliminar
            </button>
          </div>
        </div>
      ) : null}

      {/* Desktop table */}
      <div className="hide-mobile">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox"
                    checked={filtered.length > 0 && selected.size === filtered.length}
                    onChange={toggleAll}
                  />
                </th>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Categoría</th>
                <th>Banco / Medio</th>
                <th>Tipo</th>
                <th>Cuotas</th>
                <th>Estado</th>
                <th style={{ textAlign: "right" }}>Monto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const cat = CATEGORIES.find((c) => c.id === e.cat);
                return (
                  <tr key={e.id} style={{ cursor: "pointer" }}>
                    <td onClick={(ev) => ev.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleSel(e.id)} />
                    </td>
                    <td onClick={() => openExpense(e)} className="mono tnum" style={{ color: "var(--ink-2)", whiteSpace: "nowrap" }}>{fmtDate(e.fecha)}</td>
                    <td onClick={() => openExpense(e)} style={{ fontWeight: 500 }}>{e.desc}</td>
                    <td onClick={() => openExpense(e)}>
                      <span className="badge ghost">
                        <span className="lg-dot" style={{ background: cat.color }} />
                        {cat.label}
                      </span>
                    </td>
                    <td onClick={() => openExpense(e)}>
                      <div style={{ fontSize: 13 }}>{e.banco !== "—" ? e.banco : <span className="muted">{e.medio}</span>}</div>
                      <div className="tiny muted">{e.medio}</div>
                    </td>
                    <td onClick={() => openExpense(e)}>
                      <span className={"badge " + (e.tipo === "credito" ? "info" : "ghost")}>
                        {e.tipo === "credito" ? "Crédito" : "Débito"}
                      </span>
                    </td>
                    <td onClick={() => openExpense(e)} className="mono tnum">{e.cuotas > 1 ? e.cuotas + "x" : "—"}</td>
                    <td onClick={() => openExpense(e)}>
                      {e.estado === "revisar"
                        ? <span className="badge warn"><Icon name="alert" size={10} /> Revisar</span>
                        : <span className="badge success"><Icon name="check" size={10} /> Registrado</span>}
                    </td>
                    <td className="amount" onClick={() => openExpense(e)} style={{ textAlign: "right" }}>{fmtCLP(e.monto)}</td>
                    <td className="actions" onClick={(ev) => ev.stopPropagation()}>
                      <button className="btn icon ghost" title="Editar" onClick={() => openExpense(e)}>
                        <Icon name="edit" size={13} />
                      </button>
                      {e.estado === "revisar" ? (
                        <button className="btn icon ghost" title="Marcar como revisado" onClick={() => markReviewed(e.id)}>
                          <Icon name="check" size={13} />
                        </button>
                      ) : null}
                      <button className="btn icon ghost danger" title="Eliminar" onClick={() => remove(e.id)}>
                        <Icon name="trash" size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr><td colSpan={10}><div className="empty">No hay gastos con estos filtros.</div></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="show-mobile">
        <div className="list">
          {filtered.map((e) => {
            const cat = CATEGORIES.find((c) => c.id === e.cat);
            return (
              <div key={e.id} className="list-item" onClick={() => openExpense(e)}>
                <div className="row between" style={{ marginBottom: 6 }}>
                  <div className="row">
                    <span className="lg-dot" style={{ background: cat.color }} />
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{e.desc}</span>
                  </div>
                  <span className="mono" style={{ fontWeight: 500 }}>{fmtCLP(e.monto)}</span>
                </div>
                <div className="row between tiny muted">
                  <span>{fmtDate(e.fecha)} · {cat.label}</span>
                  <span>{e.banco !== "—" ? e.banco : e.medio} · {e.tipo === "credito" ? "Crédito" : "Débito"}{e.cuotas > 1 ? ` ${e.cuotas}x` : ""}</span>
                </div>
                {e.estado === "revisar" ? (
                  <div style={{ marginTop: 8 }}>
                    <span className="badge warn"><Icon name="alert" size={10} /> Por revisar</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

window.ExpensesList = ExpensesList;
window.FilterChip = FilterChip;
