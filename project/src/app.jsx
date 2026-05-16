/* App entry */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "sage",
  "density": "comfortable",
  "showFlow": true,
  "botOn": true
}/*EDITMODE-END*/;

const ACCENTS = {
  sage:   { accent: "oklch(0.58 0.09 155)", soft: "oklch(0.94 0.04 155)", ink: "oklch(0.35 0.08 155)" },
  navy:   { accent: "oklch(0.45 0.10 250)", soft: "oklch(0.94 0.04 250)", ink: "oklch(0.32 0.10 250)" },
  rust:   { accent: "oklch(0.58 0.13 40)",  soft: "oklch(0.94 0.05 40)",  ink: "oklch(0.40 0.13 40)" },
  ink:    { accent: "oklch(0.20 0 0)",       soft: "oklch(0.94 0 0)",      ink: "oklch(0.30 0 0)" },
};

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = React.useState("dashboard");
  const [expenses, setExpenses] = React.useState(EXPENSES);
  const [unparsed, setUnparsed] = React.useState(UNPARSED);
  const [editingExpense, setEditingExpense] = React.useState(null);
  const [botOn, setBotOn] = React.useState(t.botOn);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // sync tweak -> state
  React.useEffect(() => { setBotOn(t.botOn); }, [t.botOn]);

  // Apply accent color to CSS vars
  React.useEffect(() => {
    const a = ACCENTS[t.accent] || ACCENTS.sage;
    const root = document.documentElement;
    root.style.setProperty("--accent", a.accent);
    root.style.setProperty("--accent-soft", a.soft);
    root.style.setProperty("--accent-ink", a.ink);
  }, [t.accent]);

  // Density
  React.useEffect(() => {
    document.documentElement.style.setProperty("--row-pad", t.density === "compact" ? "8px 12px" : "12px 14px");
  }, [t.density]);

  const openExpense = (e) => setEditingExpense(e);
  const saveExpense = (e) => {
    setExpenses((prev) => prev.map((p) => p.id === e.id ? e : p));
  };
  const deleteExpense = (id) => setExpenses((prev) => prev.filter((p) => p.id !== id));
  const createExpense = (e) => setExpenses((prev) => [{ ...e }, ...prev]);

  // Sync editingExpense when expenses change (for live updates)
  React.useEffect(() => {
    if (editingExpense) {
      const fresh = expenses.find((e) => e.id === editingExpense.id);
      if (fresh && fresh !== editingExpense) setEditingExpense(fresh);
    }
  }, [expenses]);

  return (
    <div className="app-shell">
      <Sidebar route={route} setRoute={(r) => { setRoute(r); setMobileNavOpen(false); }}
        unparsedCount={unparsed.length} botOn={botOn} />

      <div className="main">
        <Header route={route} onMenu={() => setMobileNavOpen(true)} />
        <main className="content">
          {route === "dashboard" && (
            <Dashboard expenses={expenses} setRoute={setRoute}
              openExpense={openExpense} botOn={botOn} showFlow={t.showFlow} />
          )}
          {route === "expenses" && (
            <ExpensesList expenses={expenses} setExpenses={setExpenses}
              openExpense={openExpense} />
          )}
          {route === "reports" && (
            <Reports expenses={expenses} />
          )}
          {route === "messages" && (
            <MessagesView unparsed={unparsed} setUnparsed={setUnparsed}
              expenses={expenses} onCreateExpense={createExpense} />
          )}
          {route === "settings" && (
            <TelegramSettings botOn={botOn} setBotOn={(v) => { setBotOn(v); setTweak("botOn", v); }} />
          )}
        </main>
      </div>

      <MobileNav route={route} setRoute={(r) => setRoute(r)} unparsedCount={unparsed.length} />

      {/* Mobile drawer (full sidebar) */}
      {mobileNavOpen ? (
        <div className="scrim" onClick={() => setMobileNavOpen(false)} style={{ justifyContent: "flex-start" }}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ borderLeft: "none", borderRight: "1px solid var(--line)", animation: "sheet-in-l 220ms cubic-bezier(0.2, 0.8, 0.2, 1)", width: 280 }}>
            <div className="sheet-h">
              <div className="brand-mark">G</div>
              <div>
                <div style={{ fontWeight: 600 }}>Control de Gastos</div>
                <div className="tiny muted">Menú</div>
              </div>
              <button className="btn icon ghost" onClick={() => setMobileNavOpen(false)} style={{ marginLeft: "auto" }}>
                <Icon name="x" size={16}/>
              </button>
            </div>
            <div style={{ padding: "12px 10px" }}>
              {NAV.map((n) => (
                <div key={n.id}
                  className={"nav-item " + (route === n.id ? "active" : "")}
                  onClick={() => { setRoute(n.id); setMobileNavOpen(false); }}
                >
                  <Icon name={n.icon} size={16}/>
                  <span>{n.label}</span>
                  {n.badgeKey === "unparsed" && unparsed.length > 0 ? (
                    <span className="nav-badge">{unparsed.length}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {editingExpense ? (
        <ExpenseSheet expense={editingExpense}
          onClose={() => setEditingExpense(null)}
          onSave={saveExpense}
          onDelete={deleteExpense}
        />
      ) : null}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Apariencia">
          <TweakRadio label="Acento" value={t.accent}
            options={["sage", "navy", "rust", "ink"]}
            onChange={(v) => setTweak("accent", v)} />
          <TweakRadio label="Densidad" value={t.density}
            options={["comfortable", "compact"]}
            onChange={(v) => setTweak("density", v)} />
        </TweakSection>
        <TweakSection label="Dashboard">
          <TweakToggle label="Diagrama de flujo" value={t.showFlow}
            onChange={(v) => setTweak("showFlow", v)} />
        </TweakSection>
        <TweakSection label="Bot">
          <TweakToggle label="Bot conectado" value={t.botOn}
            onChange={(v) => setTweak("botOn", v)} />
        </TweakSection>
      </TweaksPanel>

      <style>{`
        @keyframes sheet-in-l { from { transform: translateX(-20px); opacity: 0; } to { transform: none; opacity: 1; } }
      `}</style>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
