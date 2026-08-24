import React from 'react'
import { Icon } from '../lib/helpers'

const GROUPS = [
  {
    label: null,
    items: [{ label: 'Dashboard', href: '', icon: 'home' }],
  },
  {
    label: 'Dinero conectado',
    items: [
      { label: 'Mercado Pago', href: '?mercadopago-admin=1', icon: 'wallet' },
      { label: 'Shopify / PayPal', href: '?paypal-admin=1', icon: 'cash' },
    ],
  },
  {
    label: 'Cobros y compartido',
    items: [
      { label: 'Me deben', href: '?me-deben=1', icon: 'cash' },
      { label: 'Recurrentes con Nicol', href: '?nicol-admin=recurrentes', icon: 'repeat' },
      { label: 'Gastos y cuotas con Nicol', href: '?nicol-admin=1', icon: 'users' },
    ],
  },
]

export default function ExternalMenu() {
  const path = window.location.pathname

  return (
    <details className="relative group shrink-0">
      <summary className="h-10 list-none cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-xl border border-violet-200 bg-white/90 px-3 text-[10px] font-semibold text-slate-800 shadow-sm shadow-violet-950/5 hover:bg-violet-50">
        <Icon name="menu" size={14}/><span>Menú</span>
      </summary>
      <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-2xl border border-violet-100 bg-white p-2 shadow-xl shadow-violet-950/15">
        {GROUPS.map((group, groupIndex) => (
          <div key={groupIndex} className="py-1.5 first:pt-0 last:pb-0">
            {group.label && <div className="px-2.5 pb-1 text-[9px] font-bold uppercase tracking-[.12em] text-slate-400">{group.label}</div>}
            {group.items.map(item => (
              <a key={item.href} href={`${path}${item.href}`} className="min-h-11 flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[11px] font-medium text-slate-700 hover:bg-violet-50">
                <span className="w-6 h-6 rounded-lg bg-violet-100 grid place-items-center text-violet-700"><Icon name={item.icon} size={13}/></span>{item.label}
              </a>
            ))}
          </div>
        ))}
      </div>
    </details>
  )
}
