// Auditoría: log de todas las acciones del sistema
const { useState: useStateAd, useMemo: useMemoAd } = React;
function Audit({ entries }) {
  const { Card, Badge } = window.UI;
  const { Icon, relDate, timeOnly } = window.Helpers;

  const [fActor, setFActor] = useStateAd("all");    // all | user | bot | system
  const [fAction, setFAction] = useStateAd("all");  // all | created | edited | deleted | flagged | unparsed | etc

  const actorTone = { bot: "info", user: "neutral", system: "muted" };
  const actorIcon = { bot: "bot", user: "pencil", system: "settings" };

  // Agrupar por día
  const groups = useMemoAd(() => {
    const out = {};
    const filtered = entries.filter(e => {
      if (fActor !== "all" && e.actor !== fActor) return false;
      if (fAction !== "all" && !e.action.startsWith(fAction)) return false;
      return true;
    });
    filtered.forEach(e => {
      const d = new Date(e.at);
      const key = d.toISOString().slice(0,10);
      if (!out[key]) out[key] = [];
      out[key].push(e);
    });
    return Object.entries(out).sort((a,b) => b[0].localeCompare(a[0]));
  }, [entries, fActor, fAction]);

  // Stats
  const today = window.MOCK.TODAY;
  const todayCount = entries.filter(e => {
    const d = new Date(e.at);
    return d.toDateString() === today.toDateString();
  }).length;
  const botCount = entries.filter(e => e.actor === "bot").length;
  const userCount = entries.filter(e => e.actor === "user").length;
  const sysCount = entries.filter(e => e.actor === "system").length;

  const actionLabel = (a) => {
    const map = {
      "expense.created":   "Gasto creado",
      "expense.edited":    "Gasto editado",
      "expense.deleted":   "Gasto eliminado",
      "expense.flagged":   "Marcado para revisar",
      "budget.updated":    "Presupuesto actualizado",
      "recurring.charged": "Cargo recurrente",
      "income.received":   "Ingreso recibido",
      "receivable.paid":   "Cobro recibido",
      "bot.connected":     "Bot conectado",
      "unparsed":          "Sin interpretar",
    };
    return map[a] || a;
  };

  const actionDot = (a) => {
    if (a.startsWith("expense.created")) return "var(--accent)";
    if (a.startsWith("expense.edited"))  return "#6D9DC5";
    if (a.startsWith("expense.deleted")) return "#A02828";
    if (a.startsWith("expense.flagged")) return "var(--amber-ink)";
    if (a.startsWith("budget"))          return "#C77DFF";
    if (a.startsWith("recurring"))       return "#B07156";
    if (a.startsWith("income") || a.startsWith("receivable")) return "var(--accent)";
    if (a.startsWith("unparsed"))        return "var(--amber-ink)";
    return "var(--ink-3)";
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Eventos hoy"   value={todayCount}/>
        <Stat label="Por bot"        value={botCount}    icon="bot"/>
        <Stat label="Por usuario"    value={userCount}   icon="pencil"/>
        <Stat label="Por sistema"    value={sysCount}    icon="settings"/>
      </div>

      <Card padding="p-0">
        <div className="px-5 py-3.5 border-b border-[var(--line)] flex items-center gap-2 flex-wrap">
          <div className="font-semibold tracking-tight mr-2">Eventos</div>
          <Pills value={fActor} onChange={setFActor}
                 options={[
                   { v: "all",   label: "Todos" },
                   { v: "bot",   label: "Bot" },
                   { v: "user",  label: "Usuario" },
                   { v: "system",label: "Sistema" },
                 ]}/>
          <span className="text-[var(--line)]">|</span>
          <Pills value={fAction} onChange={setFAction}
                 options={[
                   { v: "all",      label: "Todo" },
                   { v: "expense",  label: "Gastos" },
                   { v: "budget",   label: "Presup." },
                   { v: "recurring",label: "Recurr." },
                   { v: "income",   label: "Ingresos" },
                   { v: "unparsed", label: "Sin interpretar" },
                 ]}/>
        </div>

        <div className="px-5 py-4 flex flex-col gap-6">
          {groups.map(([day, items]) => {
            const dObj = new Date(day);
            return (
              <div key={day}>
                <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] mb-3 sticky top-0">
                  {relDate(dObj.toISOString())} · <span className="font-mono">{day}</span>
                </div>
                <ul className="border-l border-[var(--line)] ml-1 flex flex-col gap-3 pl-5 relative">
                  {items.map(e => (
                    <li key={e.id} className="relative">
                      <span className="absolute -left-[26px] top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-[var(--bg-elev)]"
                            style={{ background: actionDot(e.action) }}/>
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[12.5px] font-medium">{actionLabel(e.action)}</span>
                            <Badge tone={actorTone[e.actor]} className="!text-[10px]">
                              <Icon name={actorIcon[e.actor]} size={10}/> {e.actor}
                            </Badge>
                          </div>
                          <div className="mt-1 text-[12.5px] text-[var(--ink-2)] leading-snug">{e.summary}</div>
                          <div className="mt-1 text-[11px] text-[var(--muted)] font-mono flex items-center gap-1.5">
                            <span>{timeOnly(e.at)}</span>
                            <span>·</span>
                            <span>ref {e.target}</span>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {groups.length === 0 && (
            <div className="text-center text-[13px] text-[var(--muted)] py-10">Sin eventos con esos filtros.</div>
          )}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, icon }) {
  const { Icon } = window.Helpers;
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-elev)] p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">{label}</div>
        {icon && <span className="text-[var(--muted)]"><Icon name={icon} size={13}/></span>}
      </div>
      <div className="mt-2 font-mono text-[22px] tracking-tight">{value}</div>
    </div>
  );
}

function Pills({ value, onChange, options }) {
  return (
    <div className="flex items-center gap-1">
      {options.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={`h-7 px-2.5 rounded-md text-[12px] transition
            ${value === o.v ? "bg-[var(--ink)] text-[var(--bg)]" : "text-[var(--ink-2)] hover:bg-[var(--hover)]"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

window.Audit = Audit;
