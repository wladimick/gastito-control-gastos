import React, { useEffect, useState } from 'react'
import { Icon } from '../lib/helpers'
import { GastitoLogo } from './Brand'
import FinancialBrand from './FinancialBrand'

const BASE_NAV_GROUPS = [
  {
    label: null,
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: 'home', short: 'Inicio' },
    ],
  },
  {
    label: 'Caja',
    items: [
      { id: 'accounts', label: 'Cuentas', icon: 'wallet', short: 'Cuentas' },
      { id: 'mercadopago', label: 'Mercado Pago', brand: 'mercadopago', short: 'MP', href: '?mercadopago-admin=1' },
      { id: 'paypal', label: 'Shopify / PayPal', brand: 'paypal', short: 'PayPal', href: '?paypal-admin=1' },
    ],
  },
  {
    label: 'Patrimonio',
    items: [
      { id: 'previsional', label: 'Previsión', icon: 'savings', short: 'Previsión' },
      { id: 'savings', label: 'Ahorros', icon: 'savings', short: 'Ahorros' },
    ],
  },
  {
    label: 'Flujo',
    items: [
      { id: 'employment', label: 'Perfil laboral', icon: 'person', short: 'Trabajo' },
      { id: 'salary', label: 'Liquidaciones', icon: 'cash', short: 'Sueldo' },
      { id: 'expenses', label: 'Gastos', icon: 'list', short: 'Gastos' },
      { id: 'spending', label: 'Reporte de gastos', icon: 'chart', short: 'Reporte' },
      { id: 'billing', label: 'Facturación', icon: 'card', short: 'Factur.' },
      { id: 'installments', label: 'Cuotas', icon: 'layers', short: 'Cuotas' },
      { id: 'recurring', label: 'Recurrentes', icon: 'repeat', short: 'Recurr.' },
      { id: 'budgets', label: 'Presupuestos', icon: 'target', short: 'Presup.' },
      { id: 'receivables', label: 'Me deben', brand: 'receivables', short: 'Cobros', href: '?me-deben=1' },
      { id: 'reimbursements', label: 'Rendiciones', icon: 'cash', short: 'Rend.', badge: 0 },
      { id: 'projection', label: 'Proyección', icon: 'trend', short: 'Proyec.' },
      { id: 'nicol', label: 'Compartido con Nicol', icon: 'users', short: 'Nicol', href: '?nicol-admin=recurrentes' },
      { id: 'reports', label: 'Reportes financieros', icon: 'chart', short: 'Reportes' },
    ],
  },
  {
    label: 'Herramientas',
    items: [
      { id: 'unparsed', label: 'Bot · sin interpretar', icon: 'alert', badge: 5, short: 'Bot' },
      { id: 'telegram', label: 'Bot · configuración', icon: 'bot', short: 'Config' },
    ],
  },
]

const FINANCIAL_VIEWS = new Set([
  'dashboard', 'accounts', 'previsional', 'employment', 'salary', 'expenses',
  'spending', 'billing', 'installments', 'budgets', 'recurring', 'projection',
  'reports',
])

function buildNavGroups(isSuperAdmin, unparsedCount, reimbursementCount) {
  const groups = BASE_NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.map(item => {
      if (item.id === 'unparsed') return { ...item, badge: unparsedCount || 0 }
      if (item.id === 'reimbursements') return { ...item, badge: reimbursementCount || 0 }
      return item
    }),
  }))

  const systemItems = [
    { id: 'profile', label: 'Mi perfil', icon: 'person', short: 'Perfil' },
    { id: 'audit', label: 'Auditoría', icon: 'history', short: 'Audit.' },
  ]
  if (isSuperAdmin) systemItems.push({ id: 'admin', label: 'Administración', icon: 'users', short: 'Admin' })
  groups.push({ label: 'Sistema', items: systemItems })
  return groups
}

const MOBILE_PRIMARY = ['dashboard', 'accounts', 'expenses', 'spending']

const HEADER_TONES = {
  Caja: 'border-sky-100 bg-gradient-to-r from-sky-100 via-cyan-50 to-emerald-50',
  Patrimonio: 'border-emerald-100 bg-gradient-to-r from-emerald-100 via-teal-50 to-cyan-50',
  Flujo: 'border-violet-100 bg-gradient-to-r from-violet-100 via-fuchsia-50 to-rose-50',
  Herramientas: 'border-amber-100 bg-gradient-to-r from-amber-100 via-orange-50 to-rose-50',
  Sistema: 'border-indigo-100 bg-gradient-to-r from-indigo-100 via-blue-50 to-sky-50',
  Sección: 'border-slate-200 bg-gradient-to-r from-slate-100 via-white to-violet-50',
}

function NavIcon({ item, size = 16 }) {
  if (item.brand) return <FinancialBrand brand={item.brand} size="sm"/>
  return <span className="w-7 h-7 grid place-items-center shrink-0"><Icon name={item.icon} size={size}/></span>
}

function FontSizeControl({ value, onChange }) {
  const options = [
    { id: 'small', label: 'A−', title: 'Reducir tamaño de letra' },
    { id: 'normal', label: 'A', title: 'Tamaño de letra normal' },
    { id: 'large', label: 'A+', title: 'Aumentar tamaño de letra' },
  ]

  return (
    <div className="h-11 inline-flex items-center rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] p-0.5" aria-label="Tamaño de letra">
      {options.map(option => (
        <button
          key={option.id}
          type="button"
          title={option.title}
          aria-label={option.title}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={`h-10 min-w-10 px-2 rounded-[9px] type-caption font-semibold transition ${value === option.id ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}


export default function Layout({
  view,
  setView,
  botStatus,
  children,
  onOpenChat,
  onSignOut,
  userEmail,
  isSuperAdmin,
  unparsedCount,
  reimbursementCount,
}) {
  const [openMobile, setOpenMobile] = useState(false)
  const [fontSize, setFontSize] = useState(() => {
    try {
      const saved = window.localStorage.getItem('gastito-font-size')
      return ['small', 'normal', 'large'].includes(saved) ? saved : 'normal'
    } catch {
      return 'normal'
    }
  })

  useEffect(() => {
    document.documentElement.dataset.fontSize = fontSize
    try {
      window.localStorage.setItem('gastito-font-size', fontSize)
    } catch {
      // localStorage can be unavailable in private/restricted contexts.
    }
  }, [fontSize])

  useEffect(() => {
    if (!openMobile) return undefined
    const closeOnEscape = event => {
      if (event.key === 'Escape') setOpenMobile(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [openMobile])

  const navGroups = buildNavGroups(isSuperAdmin, unparsedCount, reimbursementCount)
  const allNav = navGroups.flatMap(group => group.items)
  const currentItem = allNav.find(item => item.id === view)
  const currentLabel = currentItem?.label || 'Control'
  const currentGroup = navGroups.find(group => group.items.some(item => item.id === view))
  const breadcrumb = currentGroup?.label
  const headerTone = HEADER_TONES[breadcrumb || 'Sección'] || HEADER_TONES.Sección

  const openNavItem = item => {
    if (item.href) {
      window.location.assign(`${window.location.pathname}${item.href}`)
      return
    }
    setView(item.id)
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <a href="#main-content" className="skip-link">Saltar al contenido principal</a>
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col w-64 border-r border-[#222220] h-dvh overflow-hidden bg-[#0F0F0E]">
        <div className="px-5 pt-6 pb-5 border-b border-[#222220] shrink-0">
          <GastitoLogo light size="sm"/>
          <div className="text-[10px] text-[#525250] mt-2 leading-none pl-0.5">Control financiero personal</div>
        </div>

        <nav aria-label="Navegación principal" className="px-3 py-3 min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] flex flex-col gap-3">
          {navGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="flex flex-col gap-0.5">
              {group.label && <div className="px-3 pt-1.5 pb-1 text-[9px] uppercase tracking-[0.14em] text-[#484846]">{group.label}</div>}
              {group.items.map(item => (
                <button key={item.id} type="button" onClick={() => openNavItem(item)} aria-current={view === item.id ? 'page' : undefined}
                  className={`group flex items-center justify-between min-h-10 px-2.5 py-1.5 rounded-xl type-small transition ${view === item.id
                    ? 'bg-white text-[#0F0F0E]'
                    : 'text-[#A0A09A] hover:bg-white/8 hover:text-white'}`}>
                  <span className="flex items-center gap-2 min-w-0"><NavIcon item={item}/><span className="truncate">{item.label}</span></span>
                  {item.badge > 0 && (
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${view === item.id ? 'bg-black/10 text-[#0F0F0E]' : 'bg-[#2A2A28] text-[#A0A09A]'}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {onSignOut && (
          <div className="px-3 pt-0 pb-2 border-t border-[#222220] mt-1 shrink-0">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-[10px] text-[#525250] truncate max-w-[140px]">{userEmail}</span>
              <button type="button" onClick={onSignOut} className="text-[10px] text-[#525250] hover:text-white flex items-center gap-1 transition shrink-0">
                <Icon name="x" size={10}/>Salir
              </button>
            </div>
          </div>
        )}

        <div className="px-3 pb-4 shrink-0">
          <button type="button" onClick={onOpenChat} className="w-full flex items-center gap-3 rounded-xl border border-[#222220] p-3 text-left hover:bg-white/5 transition">
            <div className={`w-8 h-8 rounded-lg grid place-items-center text-white ${botStatus === 'online' ? 'bg-[var(--accent)]' : 'bg-[#2A2A28]'}`}><Icon name="bot" size={16}/></div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-medium leading-none text-white">Bot @gastito</div>
              <div className="text-[10px] text-[#525250] mt-1 leading-none flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${botStatus === 'online' ? 'bg-[var(--accent)]' : 'bg-[#484846]'}`}/>
                {botStatus === 'online' ? 'Conectado' : 'Desconectado'}
              </div>
            </div>
          </button>
        </div>
      </aside>

      <div className="min-h-screen min-w-0 flex flex-col lg:ml-64">
        <header className={`sticky top-0 z-30 isolate border-b backdrop-blur-xl ${headerTone}`}>
          <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-white/45 blur-2xl" aria-hidden="true"/>
          <div className="relative px-4 md:px-7 py-3 flex items-center gap-3 max-w-[1600px] w-full mx-auto">
            <button type="button" onClick={() => setOpenMobile(true)} aria-label="Abrir menú" className="lg:hidden w-11 h-11 grid place-items-center rounded-xl border border-white/80 bg-white/75 shadow-sm shadow-slate-950/5">
              <Icon name="menu" size={18}/>
            </button>
            <div className="min-w-0">
              <div className="text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] leading-none">{breadcrumb || 'Sección'}</div>
              <div className="type-subtitle font-semibold tracking-tight leading-tight mt-1.5">{currentLabel}</div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {FINANCIAL_VIEWS.has(view) && (
                <div className="hidden sm:flex h-9 items-center gap-2 px-2.5 rounded-xl border border-white/80 bg-white/70">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"/>
                  <span className="text-[10px] font-medium text-[var(--ink-2)]">Datos conciliados</span>
                </div>
              )}
              <div className="hidden md:flex items-center gap-2 px-2.5 h-9 border border-white/80 rounded-xl bg-white/70">
                <span className={`w-1.5 h-1.5 rounded-full ${botStatus === 'online' ? 'bg-[var(--accent)]' : 'bg-[var(--muted)]'}`}/>
                <span className="text-[10px] text-[var(--ink-2)]">Bot {botStatus === 'online' ? 'activo' : 'off'}</span>
              </div>
              <FontSizeControl value={fontSize} onChange={setFontSize}/>
              <button type="button" onClick={onOpenChat} className="h-11 px-3 inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] text-[var(--bg)] type-small font-semibold hover:opacity-90">
                <Icon name="send" size={13}/><span className="hidden sm:inline">Probar bot</span>
              </button>
            </div>
          </div>
        </header>

        <main id="main-content" className="flex-1 px-4 md:px-7 py-5 md:py-7 pb-28 lg:pb-7">
          <div className="max-w-[1600px] w-full mx-auto">{children}</div>
        </main>

        <nav aria-label="Navegación móvil" className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[var(--bg-elev)]/96 backdrop-blur-xl border-t border-[var(--line)] px-2 pt-1.5 pb-[max(8px,env(safe-area-inset-bottom))]">
          <div className="grid grid-cols-5 gap-1">
            {MOBILE_PRIMARY.map(id => {
              const item = allNav.find(entry => entry.id === id)
              return (
                <button key={id} type="button" onClick={() => setView(id)} aria-current={view === id ? 'page' : undefined} className={`relative flex min-h-11 flex-col items-center justify-center gap-1 py-1.5 rounded-lg type-caption ${view === id ? 'text-[var(--ink)] bg-[var(--hover)]' : 'text-[var(--muted)]'}`}>
                  <Icon name={item.icon} size={19}/><span className="leading-none">{item.short}</span>
                  {item.badge > 0 && <span className="absolute top-0.5 right-1/4 w-1.5 h-1.5 rounded-full bg-[var(--amber-ink)]"/>}
                </button>
              )
            })}
            <button type="button" onClick={() => setOpenMobile(true)} aria-label="Abrir más secciones" className={`relative flex min-h-11 flex-col items-center justify-center gap-1 py-1.5 rounded-lg type-caption ${!MOBILE_PRIMARY.includes(view) ? 'text-[var(--ink)] bg-[var(--hover)]' : 'text-[var(--muted)]'}`}>
              <Icon name="more" size={19}/><span className="leading-none">Más</span>
              {allNav.some(item => item.badge > 0 && !MOBILE_PRIMARY.includes(item.id)) && <span className="absolute top-0.5 right-1/4 w-1.5 h-1.5 rounded-full bg-[var(--amber-ink)]"/>}
            </button>
          </div>
        </nav>
      </div>

      {openMobile && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpenMobile(false)}/>
          <div role="dialog" aria-modal="true" aria-label="Menú principal" className="absolute left-0 top-0 bottom-0 w-[300px] max-w-[88vw] bg-[#0F0F0E] border-r border-[#222220] p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <GastitoLogo light size="sm"/>
              <button type="button" onClick={() => setOpenMobile(false)} aria-label="Cerrar menú" className="w-11 h-11 grid place-items-center rounded-xl border border-[#222220] text-[#A0A09A]"><Icon name="x" size={16}/></button>
            </div>
            <nav aria-label="Todas las secciones" className="flex flex-col gap-3">
              {navGroups.map((group, groupIndex) => (
                <div key={groupIndex} className="flex flex-col gap-0.5">
                  {group.label && <div className="px-3 pt-1 pb-1 text-[9px] uppercase tracking-[0.14em] text-[#484846]">{group.label}</div>}
                  {group.items.map(item => (
                    <button key={item.id} type="button" onClick={() => { openNavItem(item); setOpenMobile(false) }} aria-current={view === item.id ? 'page' : undefined} className={`flex min-h-11 items-center justify-between px-2.5 py-2 rounded-xl type-small ${view === item.id ? 'bg-white text-[#0F0F0E]' : 'text-[#A0A09A] hover:bg-white/8 hover:text-white'}`}>
                      <span className="flex items-center gap-2.5 min-w-0"><NavIcon item={item} size={16}/><span className="truncate">{item.label}</span></span>
                      {item.badge > 0 && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#2A2A28] text-[#A0A09A]">{item.badge}</span>}
                    </button>
                  ))}
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}
    </div>
  )
}
