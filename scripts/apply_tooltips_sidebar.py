from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, content):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


FINANCIAL_HELP = r'''const HELP_ITEMS = [
  {
    match: 'disponible operativo',
    text: 'Dinero que tienes hoy en cuentas activas de uso diario. No incluye cupos de tarjetas ni cuentas marcadas como ahorro.',
  },
  {
    match: 'proximo pago tarjetas',
    text: 'Suma de las tarjetas que vencen primero. Si el banco ya informó el total, usa ese monto; si el ciclo sigue abierto, usa la mejor estimación disponible.',
  },
  {
    match: 'fijos directos pendientes',
    text: 'Gastos recurrentes que todavía deberían salir directamente desde débito, transferencia o efectivo. No incluye cargos que llegarán dentro de una tarjeta.',
  },
  {
    match: 'libre tras compromisos',
    text: 'Disponible operativo menos el próximo pago de tarjetas y los gastos fijos directos pendientes. Si queda negativo, el saldo actual no alcanza para cubrir todo.',
  },
  {
    prefix: 'gastado',
    text: 'Total de compras y gastos conciliados del período. Puede incluir tarjeta de crédito, por lo que no significa necesariamente que todo el dinero ya salió de tus cuentas.',
  },
  {
    match: 'reserva / ahorro',
    text: 'Dinero separado del uso cotidiano. Gastito no lo considera disponible para cubrir gastos normales.',
  },
  {
    match: 'ingresos mensuales',
    text: 'Suma de los ingresos recurrentes activos. Los montos por cobrar se muestran aparte porque todavía no han ingresado.',
  },
  {
    match: 'compartido con nicol',
    text: 'Monto base marcado como compartido antes de aplicar el porcentaje de Nicol. No corresponde directamente a lo que ella debe transferirte.',
  },
  {
    match: 'saldo en cuentas',
    text: 'Suma de los saldos registrados en tus cuentas activas. Debe representar dinero real disponible, no el cupo de una tarjeta de crédito.',
  },
  {
    match: 'reserva comprometida',
    text: 'Dinero que está en tus cuentas, pero pertenece a una obligación pendiente, como el préstamo de tu papá. Se separa para no confundirlo con dinero libre.',
  },
  {
    match: 'dinero realmente libre',
    text: 'Saldo total en cuentas menos las reservas y préstamos pendientes. Es una referencia más realista de cuánto podrías usar hoy.',
  },
  {
    match: 'facturas proximas',
    text: 'Monto de las tarjetas que vencerán más pronto según los ciclos de Facturación. No incluye facturas ya pagadas.',
  },
  {
    match: 'presupuesto mensual',
    text: 'Límite total que decidiste asignar a las categorías del mes. Sirve como plan, no como gasto obligatorio.',
  },
  {
    match: 'presupuesto',
    text: 'Monto máximo que quieres gastar en una categoría durante el mes. Cuando no existe un límite, la categoría aparece como sin configurar.',
  },
  {
    match: 'disponible',
    text: 'Saldo registrado en cuentas activas. Revisa que los saldos estén actualizados antes de tomar decisiones.',
  },
  {
    match: 'en alerta',
    text: 'Categorías que están cerca de superar su presupuesto según el gasto acumulado y el avance del mes.',
  },
  {
    match: 'sobre limite',
    text: 'Categorías cuyo gasto ya superó el presupuesto que definiste.',
  },
  {
    match: 'ritmo esperado',
    text: 'Porcentaje aproximado del presupuesto que sería normal haber usado según los días transcurridos del mes.',
  },
  {
    match: 'ingresos',
    text: 'Dinero recurrente que esperas recibir durante el mes, como sueldo u otros ingresos configurados.',
  },
  {
    match: 'gastos fijos',
    text: 'Compromisos que se repiten regularmente. Los cargos hechos con crédito llegarán dentro de la factura de la tarjeta y no deben contarse dos veces.',
  },
  {
    match: 'por cobrar',
    text: 'Dinero que otras personas o entidades todavía te deben. No se considera disponible hasta que lo marques como cobrado.',
  },
  {
    match: 'por pagar',
    text: 'Deudas u obligaciones pendientes que deberás pagar en una fecha definida.',
  },
  {
    match: 'saldo disponible hoy',
    text: 'Punto de partida de la proyección. Usa los saldos registrados en Cuentas, descontando las reservas cuando corresponda.',
  },
  {
    match: 'saldo esperado',
    text: 'Estimación del dinero que quedaría al terminar el período después de sumar ingresos y descontar obligaciones proyectadas.',
  },
  {
    match: 'menor saldo',
    text: 'El punto más bajo que alcanzaría tu saldo dentro de la proyección. Ayuda a detectar meses en los que podrías quedar corto de dinero.',
  },
  {
    match: 'salidas proximas',
    text: 'Pagos y compromisos que deberían ocurrir pronto según facturas, recurrentes, cuotas y deudas registradas.',
  },
  {
    match: 'comprometido',
    text: 'Escenario conservador que considera solamente obligaciones conocidas, como facturas, cuotas, recurrentes y deudas.',
  },
  {
    match: 'realista',
    text: 'Escenario que agrega a las obligaciones conocidas un promedio de tu gasto variable reciente.',
  },
  {
    match: 'con simulaciones',
    text: 'Escenario que incorpora compras hipotéticas para mostrar cómo afectarían tu saldo futuro antes de realizarlas.',
  },
  {
    match: 'total facturado',
    text: 'Monto informado por el banco para el ciclo. En ciclos abiertos puede ser una estimación hasta que la tarjeta cierre.',
  },
  {
    match: 'detalle leido',
    text: 'Suma de los movimientos que Gastito pudo identificar dentro del estado de cuenta o de los registros conciliados.',
  },
  {
    match: 'diferencia',
    text: 'Distancia entre el total informado por el banco y la suma del detalle identificado. Una diferencia no siempre es un error: puede existir detalle parcial o movimientos pendientes.',
  },
  {
    match: 'requieren revision',
    text: 'Movimientos con información incompleta, pendiente o inconsistente que conviene verificar antes de confiar en el total.',
  },
  {
    match: 'consumo del mes',
    text: 'Compras y gastos realizados durante el mes seleccionado, independientemente de cuándo se pagará la tarjeta.',
  },
  {
    match: 'facturas del mes',
    text: 'Facturas de tarjetas cuyo vencimiento cae dentro del mes seleccionado.',
  },
  {
    match: 'flujo esperado',
    text: 'Resultado estimado de ingresos menos pagos y compromisos que vencen en el período seleccionado.',
  },
  {
    match: 'balance real',
    text: 'Resultado de los movimientos ya registrados para el período, sin agregar cobros o pagos que todavía están pendientes.',
  },
  {
    match: 'balance esperado',
    text: 'Resultado del período incluyendo ingresos, cobros y obligaciones pendientes que configuraste.',
  },
]

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[·:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function financialHelpFor(label) {
  const normalized = normalize(label)
  if (!normalized) return ''

  const exact = HELP_ITEMS.find(item => item.match && normalized === item.match)
  if (exact) return exact.text

  const prefix = HELP_ITEMS.find(item => item.prefix && normalized.startsWith(item.prefix))
  if (prefix) return prefix.text

  const contained = HELP_ITEMS.find(item => item.match && normalized.includes(item.match))
  return contained?.text || ''
}

export { HELP_ITEMS as FINANCIAL_HELP_ITEMS }
'''


INFO_TIP = r'''
export function InfoTip({ content, label = 'Explicar este dato' }) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 12, top: 12, above: false })
  const triggerRef = useRef(null)
  const tooltipRef = useRef(null)
  const tooltipId = useRef(`gastito-help-${Math.random().toString(36).slice(2)}`)

  const updatePosition = () => {
    const trigger = triggerRef.current
    if (!trigger || typeof window === 'undefined') return
    const rect = trigger.getBoundingClientRect()
    const width = Math.min(288, window.innerWidth - 24)
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2))
    const above = window.innerHeight - rect.bottom < 170 && rect.top > 180
    setPosition({
      left,
      top: above ? rect.top - 8 : rect.bottom + 8,
      above,
      width,
    })
  }

  useEffect(() => {
    if (!open) return undefined
    updatePosition()

    const closeOnOutside = event => {
      if (triggerRef.current?.contains(event.target) || tooltipRef.current?.contains(event.target)) return
      setOpen(false)
    }
    const closeOnEscape = event => {
      if (event.key === 'Escape') setOpen(false)
    }
    const reposition = () => updatePosition()

    document.addEventListener('pointerdown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [open])

  if (!content) return null

  const toggle = event => {
    event.preventDefault()
    event.stopPropagation()
    setOpen(value => !value)
  }

  const tooltip = open && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={tooltipRef}
          id={tooltipId.current}
          role="tooltip"
          className="fixed z-[140] rounded-xl border border-[#2A2A28] bg-[#151514] px-3.5 py-3 text-left text-white shadow-2xl"
          style={{
            left: position.left,
            top: position.top,
            width: position.width,
            transform: position.above ? 'translateY(-100%)' : 'none',
          }}
        >
          <div className="text-[9px] uppercase tracking-[0.12em] text-white/50 font-bold">¿Qué significa?</div>
          <div className="mt-1.5 text-[11px] leading-relaxed text-white/88 normal-case tracking-normal font-normal">{content}</div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? tooltipId.current : undefined}
        onClick={toggle}
        onPointerDown={event => event.stopPropagation()}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={event => {
          if (!tooltipRef.current?.contains(event.relatedTarget)) setOpen(false)
        }}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') toggle(event)
          if (event.key === 'Escape') setOpen(false)
        }}
        className="inline-grid w-[17px] h-[17px] shrink-0 place-items-center rounded-full border border-current/25 text-[10px] font-bold leading-none opacity-65 hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-current/20 cursor-help normal-case tracking-normal"
      >
        i
      </span>
      {tooltip}
    </>
  )
}
'''


def add_named_import(text, module, name):
    pattern = re.compile(rf"import\s*\{{(?P<items>[^}}]+)\}}\s*from\s*['\"]{re.escape(module)}['\"]")
    match = pattern.search(text)
    if match:
        items = [item.strip() for item in match.group('items').split(',') if item.strip()]
        if name not in items:
            items.append(name)
            replacement = f"import {{ {', '.join(items)} }} from '{module}'"
            text = text[:match.start()] + replacement + text[match.end():]
        return text

    react_import = re.search(r"import React[^\n]*\n", text)
    insertion = f"import {{ {name} }} from '{module}'\n"
    if react_import:
        return text[:react_import.end()] + insertion + text[react_import.end():]
    return insertion + text


def ensure_financial_help_import(text):
    if "from '../lib/financialHelp'" in text:
        return text
    react_import = re.search(r"import React[^\n]*\n", text)
    insertion = "import { financialHelpFor } from '../lib/financialHelp'\n"
    if react_import:
        return text[:react_import.end()] + insertion + text[react_import.end():]
    return insertion + text


def patch_metric_component(path):
    text = read(path)
    if 'function Metric(' not in text:
        return False

    text = add_named_import(text, './ui', 'InfoTip')
    text = ensure_financial_help_import(text)

    header_pattern = re.compile(r"function Metric\(\{(?P<props>[^}]*)\}\)\s*\{")
    match = header_pattern.search(text)
    if not match:
        return False

    props = match.group('props').strip()
    if re.search(r'(^|,)\s*info\s*(,|$)', props) is None:
        props = props.rstrip() + ', info'
    new_header = f"function Metric({{{props}}}) {{\n  const help = info || financialHelpFor(label)"
    text = text[:match.start()] + new_header + text[match.end():]

    start = text.find(new_header)
    next_function = text.find('\nfunction ', start + len(new_header))
    export_default = text.find('\nexport default', start + len(new_header))
    boundaries = [value for value in (next_function, export_default) if value != -1]
    end = min(boundaries) if boundaries else len(text)
    block = text[start:end]

    label_pattern = re.compile(r'(<div className=["\'][^"\']*(?:uppercase|tracking)[^"\']*["\']>\{label\}</div>)')
    if label_pattern.search(block):
        block = label_pattern.sub(
            r'<div className="flex items-center gap-1.5">\1{help && <InfoTip content={help}/>}</div>',
            block,
            count=1,
        )
    elif '>{label}</div>' in block:
        label_start = block.find('<div', 0, block.find('>{label}</div>'))
        label_end = block.find('</div>', block.find('>{label}</div>')) + len('</div>')
        original = block[label_start:label_end]
        block = block[:label_start] + f'<div className="flex items-center gap-1.5">{original}{{help && <InfoTip content={{help}}/>}}</div>' + block[label_end:]
    else:
        raise RuntimeError(f'No se encontró la etiqueta de Metric en {path}')

    text = text[:start] + block + text[end:]
    write(path, text)
    return True


write('src/lib/financialHelp.js', FINANCIAL_HELP)

ui_path = 'src/components/ui.jsx'
ui = read(ui_path)
ui = ui.replace("import React from 'react'", "import React, { useEffect, useRef, useState } from 'react'\nimport { createPortal } from 'react-dom'\nimport { financialHelpFor } from '../lib/financialHelp'")
if 'export function InfoTip(' not in ui:
    marker = 'export function Card('
    index = ui.index(marker)
    ui = ui[:index] + INFO_TIP + '\n' + ui[index:]
ui = ui.replace(
    "export function StatCard({ label, value, sub, accent, icon, tone = 'default' }) {",
    "export function StatCard({ label, value, sub, accent, icon, tone = 'default', info }) {\n  const help = info || financialHelpFor(label)",
)
ui = ui.replace(
    '<div className="text-[10px] uppercase tracking-[0.12em] font-bold opacity-60">{label}</div>\n        {icon &&',
    '<div className="flex items-center gap-1.5"><div className="text-[10px] uppercase tracking-[0.12em] font-bold opacity-60">{label}</div>{help && <InfoTip content={help}/>}</div>\n        {icon &&',
)
write(ui_path, ui)

metric_files = [
    'src/components/DashboardFinancial.jsx',
    'src/components/Accounts.jsx',
    'src/components/Budgets.jsx',
    'src/components/Recurring.jsx',
    'src/components/Reports.jsx',
    'src/components/ComparisonFinancial.jsx',
]
patched = []
for metric_file in metric_files:
    if patch_metric_component(metric_file):
        patched.append(metric_file)

layout_path = 'src/components/Layout.jsx'
layout = read(layout_path)
replacements = {
    '<div className="min-h-screen flex bg-[var(--bg)] text-[var(--ink)]">': '<div className="min-h-screen bg-[var(--bg)] text-[var(--ink)]">',
    '<aside className="hidden lg:flex flex-col w-64 border-r border-[#222220] sticky top-0 h-screen shrink-0 bg-[#0F0F0E]">': '<aside className="hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col w-64 border-r border-[#222220] h-dvh overflow-hidden bg-[#0F0F0E]">',
    '<div className="px-5 pt-6 pb-5 border-b border-[#222220]">': '<div className="px-5 pt-6 pb-5 border-b border-[#222220] shrink-0">',
    '<nav className="px-3 py-3 flex-1 overflow-y-auto flex flex-col gap-3">': '<nav className="px-3 py-3 min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] flex flex-col gap-3">',
    '<div className="px-3 pt-0 pb-2 border-t border-[#222220] mt-1">': '<div className="px-3 pt-0 pb-2 border-t border-[#222220] mt-1 shrink-0">',
    '<div className="px-3 pb-4">': '<div className="px-3 pb-4 shrink-0">',
    '<div className="flex-1 min-w-0 flex flex-col">': '<div className="min-h-screen min-w-0 flex flex-col lg:ml-64">',
}
for old, new in replacements.items():
    if old not in layout:
        raise RuntimeError(f'No se encontró patrón de Layout: {old}')
    layout = layout.replace(old, new, 1)
write(layout_path, layout)

write('docs/2026-08-05-tooltips-financieros-menu-lateral.md', '''# Tooltips financieros y menú lateral estable

**Fecha:** 2026-08-05  
**Actividad:** explicar indicadores financieros y corregir la navegación lateral en páginas extensas.

## Ayudas financieras

- Se agrega un componente accesible de información que funciona con mouse, teclado y toque.
- Los tooltips se muestran fuera de la card para evitar recortes por `overflow`.
- Dashboard, Cuentas, Presupuestos, Recurrentes, Reportes y Comparación reconocen automáticamente sus métricas principales.
- `StatCard` también puede mostrar ayuda mediante su etiqueta o una explicación personalizada.
- Los textos explican el dato en lenguaje cotidiano y aclaran qué incluye, qué excluye y cómo usarlo para decidir.

## Menú lateral

- El menú de escritorio queda fijo al viewport.
- La lista de secciones tiene desplazamiento independiente.
- Logo, usuario, salida y estado del bot permanecen accesibles.
- El contenido principal reserva el ancho del menú mediante margen lateral.
- Se usa `100dvh` para evitar cortes por cambios en el alto visible del navegador.

## Resultado esperado

Las páginas largas ya no desplazan ni bloquean el menú lateral, y las métricas más relevantes muestran un icono `i` con una explicación breve antes de que el usuario tome una decisión financiera.
''')

print('Archivos Metric actualizados:')
for item in patched:
    print('-', item)
