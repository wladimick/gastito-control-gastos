from pathlib import Path

root = Path(__file__).resolve().parents[1]


def load(path):
    return (root / path).read_text(encoding='utf-8')


def save(path, text):
    (root / path).write_text(text, encoding='utf-8')


# Dashboard: evitar contenido interactivo dentro de un button.
path = 'src/components/DashboardFinancial.jsx'
text = load(path)
old = '''  const Element = onClick ? 'button' : 'div'
  return (
    <Element
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-2xl border p-4 min-h-[112px] text-left w-full ${toneClass} ${onClick ? 'hover:-translate-y-0.5 transition-transform' : ''}`}
    >'''
new = '''  const interactiveProps = onClick ? {
    role: 'button',
    tabIndex: 0,
    onClick,
    onKeyDown: event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onClick()
      }
    },
  } : {}
  return (
    <div
      {...interactiveProps}
      className={`rounded-2xl border p-4 min-h-[112px] text-left w-full ${toneClass} ${onClick ? 'hover:-translate-y-0.5 transition-transform cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--ink)]/15' : ''}`}
    >'''
if old not in text:
    raise RuntimeError('No se encontró el bloque interactivo de Dashboard.')
text = text.replace(old, new, 1).replace('    </Element>\n  )\n}', '    </div>\n  )\n}', 1)
save(path, text)


# Facturación: agregar ayuda a SummaryCard.
path = 'src/components/Billing.jsx'
text = load(path)
text = text.replace(
    "import React, { useEffect, useMemo, useState } from 'react'\n",
    "import React, { useEffect, useMemo, useState } from 'react'\nimport { InfoTip } from './ui'\nimport { financialHelpFor } from '../lib/financialHelp'\n",
    1,
)
text = text.replace(
    "function SummaryCard({ label, value, detail, tone = 'default', badge = '' }) {\n",
    "function SummaryCard({ label, value, detail, tone = 'default', badge = '', info }) {\n  const help = info || financialHelpFor(label)\n",
    1,
)
text = text.replace(
    '<div className="text-[10px] uppercase tracking-[0.12em] font-bold opacity-60">{label}</div>\n        {badge && (',
    '<div className="flex items-center gap-1.5"><div className="text-[10px] uppercase tracking-[0.12em] font-bold opacity-60">{label}</div>{help && <InfoTip content={help}/>}</div>\n        {badge && (',
    1,
)
save(path, text)


# Proyección principal: agregar ayuda a MetricCard.
path = 'src/components/ProjectionV2.jsx'
text = load(path)
text = text.replace(
    "import { Badge, Card } from './ui'",
    "import { Badge, Card, InfoTip } from './ui'",
    1,
)
if "from '../lib/financialHelp'" not in text:
    text = text.replace(
        "import { Icon, fmtCLP } from '../lib/helpers'\n",
        "import { Icon, fmtCLP } from '../lib/helpers'\nimport { financialHelpFor } from '../lib/financialHelp'\n",
        1,
    )
text = text.replace(
    "function MetricCard({ label, value, detail, tone = 'default', icon }) {\n",
    "function MetricCard({ label, value, detail, tone = 'default', icon, info }) {\n  const help = info || financialHelpFor(label)\n",
    1,
)
text = text.replace(
    '<div className="text-[10px] uppercase tracking-[0.12em] font-bold opacity-60">{label}</div>\n        {icon &&',
    '<div className="flex items-center gap-1.5"><div className="text-[10px] uppercase tracking-[0.12em] font-bold opacity-60">{label}</div>{help && <InfoTip content={help}/>}</div>\n        {icon &&',
    1,
)
save(path, text)


# Punto de partida de Proyección.
path = 'src/components/ProjectionWithBalanceStatus.jsx'
text = load(path)
text = text.replace(
    "import { Badge, Card } from './ui'",
    "import { Badge, Card, InfoTip } from './ui'",
    1,
)
text = text.replace(
    '<div className="text-[13px] font-bold">Punto de partida de la proyección</div>',
    '<div className="flex items-center gap-1.5"><div className="text-[13px] font-bold">Punto de partida de la proyección</div><InfoTip content="Es el saldo desde el que comienza el cálculo futuro. Incluye cuentas operativas activas, pero no cupos de tarjetas ni cuentas marcadas como ahorro."/></div>',
    1,
)
save(path, text)


# Actualizar documentación.
path = 'docs/2026-08-05-tooltips-financieros-menu-lateral.md'
text = load(path)
text = text.replace(
    '- Dashboard, Cuentas, Presupuestos, Recurrentes, Reportes y Comparación reconocen automáticamente sus métricas principales.',
    '- Dashboard, Cuentas, Presupuestos, Recurrentes, Facturación, Proyección, Reportes y Comparación reconocen automáticamente sus métricas principales.',
)
text += '\n- Las cards clicables del Dashboard usan navegación accesible sin anidar controles interactivos.\n'
save(path, text)
