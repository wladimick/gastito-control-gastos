/* Layout: Sidebar (desktop) + Header + Mobile bottom nav */

const NAV = [
  { id: "dashboard", label: "Dashboard",  icon: "dashboard", group: "Panel" },
  { id: "expenses",  label: "Gastos",     icon: "list",      group: "Panel" },
  { id: "reports",   label: "Reportes",   icon: "chart",     group: "Panel" },
  { id: "messages",  label: "Mensajes",   icon: "inbox",     group: "Bot",   badgeKey: "unparsed" },
  { id: "settings",  label: "Bot Telegram", icon: "bot",     group: "Bot" },
];

function Sidebar({ route, setRoute, unparsedCount, botOn }) {
  const groups = ["Panel", "Bot"];
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">G</div>
        <div>
          <div className="brand-name">Control de Gastos</div>
          <div className="brand-sub mono">v0.1 · panel personal</div>
        </div>
      </div>

      {groups.map((g) => (
        <div key={g}>
          <div className="nav-section-label">{g}</div>
          {NAV.filter((n) => n.group === g).map((n) => (
            <div
              key={n.id}
              className={"nav-item " + (route === n.id ? "active" : "")}
              onClick={() => setRoute(n.id)}
            >
              <Icon name={n.icon} size={16} />
              <span>{n.label}</span>
              {n.badgeKey === "unparsed" && unparsedCount > 0 ? (
                <span className="nav-badge">{unparsedCount}</span>
              ) : null}
            </div>
          ))}
        </div>
      ))}

      <div className="bot-card">
        <div className="row" style={{ marginBottom: 8 }}>
          <Icon name="telegram" size={16} />
          <div style={{ fontWeight: 600, fontSize: 13 }}>Bot</div>
          <div className="row" style={{ marginLeft: "auto", gap: 6 }}>
            <span className={"dot " + (botOn ? "on" : "off")}></span>
            <span className="tiny muted">{botOn ? "Conectado" : "Desconectado"}</span>
          </div>
        </div>
        <div className="tiny muted" style={{ lineHeight: 1.5 }}>
          Los gastos se registran hablándole al bot en Telegram. Esta app solo los muestra y permite revisarlos.
        </div>
        <div className="sep" style={{ margin: "10px 0 8px" }}></div>
        <div className="tiny" style={{ display: "flex", justifyContent: "space-between", color: "var(--ink-3)" }}>
          <span>Última actividad</span>
          <span className="mono" style={{ color: "var(--ink-2)" }}>hoy, 18:42</span>
        </div>
      </div>
    </aside>
  );
}

function MobileNav({ route, setRoute, unparsedCount }) {
  const items = NAV.slice(0, 5);
  return (
    <nav className="mobile-nav">
      {items.map((n) => (
        <div
          key={n.id}
          className={"mobile-nav-item " + (route === n.id ? "active" : "")}
          onClick={() => setRoute(n.id)}
        >
          <div style={{ position: "relative" }}>
            <Icon name={n.icon} size={20} />
            {n.badgeKey === "unparsed" && unparsedCount > 0 ? (
              <span style={{
                position: "absolute", top: -3, right: -8,
                background: "var(--warn)", color: "white",
                fontSize: 9, fontWeight: 600,
                padding: "1px 4px", borderRadius: 999,
                fontFamily: "Geist Mono, monospace",
              }}>{unparsedCount}</span>
            ) : null}
          </div>
          <span>{n.label === "Bot Telegram" ? "Bot" : n.label}</span>
        </div>
      ))}
    </nav>
  );
}

function Header({ route, onMenu }) {
  const titles = {
    dashboard: { t: "Dashboard",    s: "Resumen de mayo de 2026" },
    expenses:  { t: "Gastos",       s: "Todos los gastos registrados por el bot" },
    reports:   { t: "Reportes",     s: "Tendencias y comparativos" },
    messages:  { t: "Mensajes",     s: "Historial y mensajes no interpretados" },
    settings:  { t: "Bot Telegram", s: "Configuración y conexión" },
  };
  const cur = titles[route];
  return (
    <header className="header">
      <div className="show-mobile">
        <button className="btn icon" onClick={onMenu} aria-label="Menú">
          <Icon name="menu" size={18} />
        </button>
      </div>
      <div>
        <div className="h-title">{cur.t}</div>
        <div className="h-sub">{cur.s}</div>
      </div>
      <div className="search">
        <Icon name="search" size={14} />
        <input placeholder="Buscar gasto, descripción, banco…" />
        <span className="mono tiny" style={{ background: "var(--bg-sunken)", padding: "1px 5px", borderRadius: 4, color: "var(--ink-3)" }}>⌘K</span>
      </div>
      <button className="btn ghost hide-mobile" aria-label="Notificaciones" title="Notificaciones">
        <Icon name="inbox" size={16} />
      </button>
      <div className="avatar hide-mobile" title="Mi cuenta">JR</div>
    </header>
  );
}

window.Sidebar = Sidebar;
window.MobileNav = MobileNav;
window.Header = Header;
window.NAV = NAV;
