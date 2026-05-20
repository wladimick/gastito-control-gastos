import React, { useState } from 'react'
import { Icon } from '../lib/helpers'
import { GastitoLogo } from './Brand'

const BASE_NAV_GROUPS = [
  {
    label: null,
    items: [
      { id: "dashboard",    label: "Dashboard",       icon: "home",    short: "Inicio" },
      { id: "expenses",     label: "Gastos",           icon: "list",    short: "Gastos" },
    ],
  },
  {
    label: "Planificación",
    items: [
      { id: "accounts",     label: "Cuentas y flujo",  icon: "wallet",  short: "Cuentas" },
      { id: "budgets",      label: "Presupuestos",     icon: "target",  short: "Presup." },
      { id: "savings",      label: "Ahorros",          icon: "savings", short: "Ahorros" },
      { id: "recurring",    label: "Recurrentes",      icon: "repeat",  short: "Recurr." },
      { id: "installments", label: "Cuotas",           icon: "layers",  short: "Cuotas" },
    ],
  },
  {
    label: "Análisis",
    items: [
      { id: "reports",      label: "Reportes",         icon: "chart",   short: "Reportes" },
      { id: "comparison",   label: "Comparación",      icon: "scale",   short: "Compar." },
    ],
  },
  {
    label: "Bot Telegram",
    items: [
      { id: "unparsed",     label: "Sin interpretar",  icon: "alert",   badge: 5, short: "Bot" },
      { id: "telegram",     label: "Configuración",    icon: "bot",     short: "Config" },
    ],
  },
];

function buildNavGroups(isSuperAdmin, unparsedCount) {
  const groups = BASE_NAV_GROUPS.map(g => ({
    ...g,
    items: g.items.map(item =>
      item.id === 'unparsed' ? { ...item, badge: unparsedCount || 0 } : item
    ),
  }))

  const sistemaItems = [
    { id: "profile", label: "Mi perfil",       icon: "person",  short: "Perfil" },
    { id: "audit",   label: "Auditoría",        icon: "history", short: "Audit." },
  ]
  if (isSuperAdmin) {
    sistemaItems.push({ id: "admin", label: "Administración", icon: "users", short: "Admin" })
  }
  groups.push({ label: "Sistema", items: sistemaItems })
  return groups
}

const MOBILE_PRIMARY = ["dashboard", "expenses", "budgets", "reports"];

export default function Layout({ view, setView, botStatus, children, onOpenChat, onSignOut, userEmail, isSuperAdmin, unparsedCount }) {
  const [openMobile, setOpenMobile] = useState(false);

  const NAV_GROUPS = buildNavGroups(isSuperAdmin, unparsedCount)
  const ALL_NAV = NAV_GROUPS.flatMap(g => g.items)

  const currentItem = ALL_NAV.find(n => n.id === view);
  const currentLabel = currentItem?.label || "Control";
  const currentGroup = NAV_GROUPS.find(g => g.items.some(i => i.id === view));
  const breadcrumb = currentGroup?.label;

  return (
    <div className="min-h-screen flex bg-[var(--bg)] text-[var(--ink)]">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-[#222220] sticky top-0 h-screen shrink-0 bg-[#0F0F0E]">
        <div className="px-5 pt-6 pb-5 border-b border-[#222220]">
          <GastitoLogo light={true} size="sm"/>
          <div className="text-[11px] text-[#525250] mt-2 leading-none pl-0.5">Control vía Telegram</div>
        </div>

        <nav className="px-3 py-3 flex-1 overflow-y-auto flex flex-col gap-3">
          {NAV_GROUPS.map((g, gi) => (
            <div key={gi} className="flex flex-col gap-0.5">
              {g.label && (
                <div className="px-3 pt-1.5 pb-1 text-[10px] uppercase tracking-[0.14em] text-[#484846]">{g.label}</div>
              )}
              {g.items.map(n => (
                <button
                  key={n.id}
                  onClick={() => setView(n.id)}
                  className={`group flex items-center justify-between px-3 py-2 rounded-md text-[13px] transition
                    ${view === n.id ? "bg-white text-[#0F0F0E]" : "text-[#A0A09A] hover:bg-white/8 hover:text-white"}`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon name={n.icon} size={16}/>
                    <span>{n.label}</span>
                  </span>
                  {n.badge > 0 && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded
                      ${view === n.id ? "bg-black/10 text-[#0F0F0E]" : "bg-[#2A2A28] text-[#A0A09A]"}`}>
                      {n.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {onSignOut && (
          <div className="px-3 pt-0 pb-2 border-t border-[#222220] mt-1">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-[11px] text-[#525250] truncate max-w-[140px]">{userEmail}</span>
              <button
                onClick={onSignOut}
                className="text-[11px] text-[#525250] hover:text-white flex items-center gap-1 transition shrink-0">
                <Icon name="x" size={11}/> Salir
              </button>
            </div>
          </div>
        )}

        <div className="px-3 pb-4">
          <button
            onClick={onOpenChat}
            className="w-full flex items-center gap-3 rounded-lg border border-[#222220] p-3 text-left hover:bg-white/5 transition"
          >
            <div className={`w-8 h-8 rounded-md grid place-items-center text-white ${botStatus === "online" ? "bg-[var(--accent)]" : "bg-[#2A2A28]"}`}>
              <Icon name="bot" size={16}/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium leading-none text-white">Bot @gastito</div>
              <div className="text-[11px] text-[#525250] mt-1 leading-none flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${botStatus === "online" ? "bg-[var(--accent)]" : "bg-[#484846]"}`}></span>
                {botStatus === "online" ? "Conectado" : "Desconectado"}
              </div>
            </div>
          </button>
        </div>
      </aside>


      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-[var(--bg)]/85 backdrop-blur border-b border-[var(--line)]">
          <div className="px-4 md:px-7 py-3.5 flex items-center gap-3">
            <button
              onClick={() => setOpenMobile(true)}
              className="lg:hidden w-9 h-9 grid place-items-center rounded-md border border-[var(--line)]"
            >
              <Icon name="menu" size={18}/>
            </button>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)] leading-none">
                {breadcrumb || "Sección"}
              </div>
              <h1 className="text-[18px] md:text-[22px] font-semibold tracking-tight leading-tight mt-1.5">{currentLabel}</h1>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="hidden md:flex items-center gap-2 px-2.5 h-9 border border-[var(--line)] rounded-md bg-[var(--bg-elev)]">
                <span className={`w-1.5 h-1.5 rounded-full ${botStatus === "online" ? "bg-[var(--accent)]" : "bg-[var(--muted)]"}`}></span>
                <span className="text-[12px] text-[var(--ink-2)]">Bot {botStatus === "online" ? "activo" : "off"}</span>
              </div>
              <button
                onClick={onOpenChat}
                className="h-9 px-3 inline-flex items-center gap-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[13px] font-medium hover:opacity-90"
              >
                <Icon name="send" size={14}/>
                <span className="hidden sm:inline">Probar bot</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 md:px-7 py-5 md:py-7 pb-24 lg:pb-7">{children}</main>

        {/* Bottom nav móvil */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[var(--bg-elev)] border-t border-[var(--line)] px-2 pt-1.5 pb-[max(8px,env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-5 gap-1">
            {MOBILE_PRIMARY.map(id => {
              const n = ALL_NAV.find(x => x.id === id);
              return (
                <button
                  key={id}
                  onClick={() => setView(id)}
                  className={`relative flex flex-col items-center gap-1 py-1.5 rounded-md text-[10px]
                    ${view === id ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}
                >
                  <Icon name={n.icon} size={20}/>
                  <span className="leading-none">{n.short}</span>
                  {n.badge && <span className="absolute top-0.5 right-1/4 w-1.5 h-1.5 rounded-full bg-[var(--amber-ink)]"></span>}
                </button>
              );
            })}
            <button
              onClick={() => setOpenMobile(true)}
              className={`relative flex flex-col items-center gap-1 py-1.5 rounded-md text-[10px]
                ${!MOBILE_PRIMARY.includes(view) ? "text-[var(--ink)]" : "text-[var(--muted)]"}`}
            >
              <Icon name="more" size={20}/>
              <span className="leading-none">Más</span>
              {ALL_NAV.some(n => n.badge && !MOBILE_PRIMARY.includes(n.id)) && (
                <span className="absolute top-0.5 right-1/4 w-1.5 h-1.5 rounded-full bg-[var(--amber-ink)]"></span>
              )}
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile drawer — dark */}
      {openMobile && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpenMobile(false)}></div>
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-[#0F0F0E] border-r border-[#222220] p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <GastitoLogo light={true} size="sm"/>
              <button onClick={() => setOpenMobile(false)} className="w-8 h-8 grid place-items-center rounded-md border border-[#222220] text-[#A0A09A]">
                <Icon name="x" size={16}/>
              </button>
            </div>
            <nav className="flex flex-col gap-3">
              {NAV_GROUPS.map((g, gi) => (
                <div key={gi} className="flex flex-col gap-0.5">
                  {g.label && <div className="px-3 pt-1 pb-1 text-[10px] uppercase tracking-[0.14em] text-[#484846]">{g.label}</div>}
                  {g.items.map(n => (
                    <button
                      key={n.id}
                      onClick={() => { setView(n.id); setOpenMobile(false); }}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-md text-sm
                        ${view === n.id ? "bg-white text-[#0F0F0E]" : "text-[#A0A09A] hover:bg-white/8 hover:text-white"}`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon name={n.icon} size={17}/>
                        <span>{n.label}</span>
                      </span>
                      {n.badge > 0 && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#2A2A28] text-[#A0A09A]">{n.badge}</span>}
                    </button>
                  ))}
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
