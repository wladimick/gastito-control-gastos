import React, { useEffect, useMemo, useState } from 'react'
import { CATEGORIES } from '../data'
import { Icon, fmtCLP } from '../lib/helpers'
import { fetchBillingCycles } from '../services/billingCyclesService'
import { fetchBillingForecasts } from '../services/billingForecastsService'
import { fetchMercadoPagoStatus } from '../services/mercadoPagoService'
import { fetchSalarySlips } from '../services/salaryService'
import { buildProjectionPlan } from '../services/projectionPlanService'
import { monthKeyCL } from '../lib/financialDates'
import { withStatementForecastFloors } from '../lib/installmentAudit'
import {
  coverReservePayables,
  withMercadoPagoFreeBalance,
  withVariableSalary,
} from '../lib/financialModel'
import {
  PROJECTION_BANKS,
  PROJECTION_LAYERS,
  addMonthsKey,
  buildNewProjectionTimeline,
  categoryTotal,
  currentMonthKey,
  monthKey,
  monthLabel,
  projectionSegments,
  safeSpendingCapacity,
  visibleBankTotal,
} from '../lib/newProjectionModel'

const BANK_ORDER = ['bchile', 'falabella', 'otros']
const LAYER_ORDER = ['recurring', 'installments', 'simulations']

function PercentSegment({ amount, total, color, label }) {
  if (amount <= 0 || total <= 0) return null
  const pct = amount * 100 / total
  return (
    <div
      className="w-full relative flex items-center justify-center overflow-hidden"
      style={{ height: `${pct}%`, minHeight: pct > 0 ? 2 : 0, backgroundColor: color }}
      title={`${label}: ${fmtCLP(amount)} · ${Math.round(pct)}%`}
    >
      {pct >= 18 && <span className="text-[8.5px] font-bold text-white drop-shadow">{Math.round(pct)}%</span>}
    </div>
  )
}

function BankBar({ row, filter, maxVisible, selected, onSelect, onOpenDetail, layers }) {
  const segments = projectionSegments(row, filter, layers)
  const visibleTotal = segments.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  const height = visibleTotal > 0 ? Math.max(10, Math.round(178 * visibleTotal / Math.max(1, maxVisible))) : 4
  return (
    <button
      type="button"
      onClick={() => onSelect(row.key)}
      onDoubleClick={() => onOpenDetail(row.key)}
      title="Click: seleccionar · doble click: ver qué se consideró"
      className="w-[76px] sm:w-[86px] shrink-0 text-center group"
    >
      <div className={`font-mono text-[8.5px] sm:text-[9.5px] font-bold mb-2 whitespace-nowrap ${selected ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}>{fmtCLP(visibleTotal)}</div>
      <div className="h-[184px] flex items-end justify-center">
        <div
          className={`w-[46px] sm:w-[52px] rounded-t-[10px] overflow-hidden flex flex-col-reverse shadow-sm transition ${selected ? 'ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--bg-elev)]' : 'group-hover:ring-1 group-hover:ring-[var(--line)]'}`}
          style={{ height, backgroundColor: 'var(--soft)' }}
        >
          {segments.map(segment => (
            <PercentSegment
              key={segment.id}
              amount={segment.amount}
              total={Math.max(1, visibleTotal)}
              color={segment.color}
              label={segment.label}
            />
          ))}
        </div>
      </div>
      <div className="mt-2 text-[10px] font-bold">{row.shortLabel}</div>
      <div className={`mt-1 text-[8px] font-bold ${row.kind === 'actual' ? 'text-slate-500' : 'text-violet-600'}`}>{row.kind === 'actual' ? 'REAL' : 'PROY.'}</div>
    </button>
  )
}

function BankChart({ timeline, filter, setFilter, selectedKey, setSelectedKey, onOpenDetail, layerVisibility, setLayerVisibility }) {
  const maxVisible = Math.max(1, ...timeline.rows.map(row => visibleBankTotal(row, filter, layerVisibility)))
  return (
    <section className="rounded-3xl border border-[var(--line)] bg-[var(--bg-elev)] overflow-hidden shadow-sm">
      <div className="p-4 sm:p-5 border-b border-[var(--line)]">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
          <div>
            <div className="text-[9px] uppercase tracking-[0.13em] text-[var(--muted)] font-bold">Bancos y compromisos</div>
            <h2 className="text-[18px] sm:text-[20px] font-bold mt-1">3 meses reales + próximos 6 meses</h2>
            <p className="text-[10.5px] text-[var(--muted)] mt-1 max-w-2xl">En los meses futuros, azul y verde muestran únicamente lo informado por cada banco. Recurrentes, cuotas adicionales y simulaciones se apilan con su propio color. <strong>Doble click en un mes</strong> para auditar los valores.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[['all', 'Todos'], ...BANK_ORDER.map(id => [id, PROJECTION_BANKS[id].label])].map(([id, label]) => (
              <button key={id} type="button" onClick={() => setFilter(id)} className={`h-8 px-3 rounded-full border text-[10px] font-semibold ${filter === id ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]' : 'bg-[var(--bg)] border-[var(--line)] text-[var(--muted)]'}`}>{label}</button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-4 text-[9px] text-[var(--muted)]">
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PROJECTION_BANKS.bchile.color }}/>Banco Chile informado</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PROJECTION_BANKS.falabella.color }}/>Falabella informado</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PROJECTION_BANKS.otros.color }}/>Otros compromisos</span>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {LAYER_ORDER.map(layer => (
            <label key={layer} className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--bg)] px-3 h-8 text-[10px] font-semibold cursor-pointer">
              <input type="checkbox" checked={layerVisibility[layer]} onChange={event => setLayerVisibility(current => ({ ...current, [layer]: event.target.checked }))}/>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PROJECTION_LAYERS[layer].color }}/>
              {PROJECTION_LAYERS[layer].label}
            </label>
          ))}
        </div>
      </div>
      <div className="px-3 sm:px-5 py-4 overflow-x-auto">
        <div className="min-w-[760px] flex items-end gap-2">
          {timeline.rows.map((row, index) => (
            <div key={row.key} className={index === 3 ? 'ml-5 pl-5 border-l border-dashed border-[var(--line)]' : ''}>
              <BankBar row={row} filter={filter} maxVisible={maxVisible} selected={selectedKey === row.key} onSelect={setSelectedKey} onOpenDetail={onOpenDetail} layers={layerVisibility}/>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function topCategoryIds(rows, limit = 7) {
  const totals = new Map()
  rows.forEach(row => Object.entries(row.categorySegments || {}).forEach(([id, value]) => totals.set(id, (totals.get(id) || 0) + Number(value || 0))))
  return [...totals.entries()].filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id)
}

function categoryMeta(id) {
  return CATEGORIES.find(item => item.id === id) || CATEGORIES.find(item => item.id === 'otros') || { id: 'otros', label: 'Otros', color: '#888880', icon: '•' }
}

function CategoryBar({ row, filter, series, maxVisible, selected, onSelect, onOpenDetail }) {
  const visibleTotal = categoryTotal(row, filter)
  const height = visibleTotal > 0 ? Math.max(10, Math.round(178 * visibleTotal / Math.max(1, maxVisible))) : 4
  const shownTotal = filter === 'all' ? Math.max(1, row.total) : Math.max(1, visibleTotal)
  const represented = filter === 'all'
    ? series.reduce((sum, id) => sum + Number(row.categorySegments?.[id] || 0), 0)
    : visibleTotal
  const remainder = filter === 'all' ? Math.max(0, shownTotal - represented) : 0
  return (
    <button
      type="button"
      onClick={() => onSelect(row.key)}
      onDoubleClick={() => onOpenDetail(row.key)}
      title="Click: seleccionar · doble click: ver qué se consideró"
      className="w-[76px] sm:w-[86px] shrink-0 text-center group"
    >
      <div className={`font-mono text-[8.5px] sm:text-[9.5px] font-bold mb-2 whitespace-nowrap ${selected ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}>{fmtCLP(visibleTotal)}</div>
      <div className="h-[184px] flex items-end justify-center">
        <div className={`w-[46px] sm:w-[52px] rounded-t-[10px] overflow-hidden flex flex-col-reverse shadow-sm ${selected ? 'ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--bg-elev)]' : 'group-hover:ring-1 group-hover:ring-[var(--line)]'}`} style={{ height, backgroundColor: 'var(--soft)' }}>
          {filter === 'all'
            ? <>
                {series.map(id => {
                  const cat = categoryMeta(id)
                  return <PercentSegment key={id} amount={Number(row.categorySegments?.[id] || 0)} total={shownTotal} color={cat.color} label={cat.label}/>
                })}
                <PercentSegment amount={remainder} total={shownTotal} color="#B8BBC2" label="Resto de categorías"/>
              </>
            : <div className="w-full h-full" style={{ backgroundColor: categoryMeta(filter).color }}/>
          }
        </div>
      </div>
      <div className="mt-2 text-[10px] font-bold">{row.shortLabel}</div>
      <div className={`mt-1 text-[8px] font-bold ${row.kind === 'actual' ? 'text-slate-500' : 'text-violet-600'}`}>{row.kind === 'actual' ? 'REAL' : 'PROY.'}</div>
    </button>
  )
}

function CategoryChart({ timeline, filter, setFilter, selectedKey, setSelectedKey, onOpenDetail }) {
  const series = useMemo(() => topCategoryIds(timeline.rows), [timeline.rows])
  const maxVisible = Math.max(1, ...timeline.rows.map(row => categoryTotal(row, filter)))
  return (
    <section className="rounded-3xl border border-[var(--line)] bg-[var(--bg-elev)] overflow-hidden shadow-sm">
      <div className="p-4 sm:p-5 border-b border-[var(--line)]">
        <div className="text-[9px] uppercase tracking-[0.13em] text-[var(--muted)] font-bold">Categorías</div>
        <h2 className="text-[18px] sm:text-[20px] font-bold mt-1">¿En qué se va el dinero?</h2>
        <p className="text-[10.5px] text-[var(--muted)] mt-1 max-w-2xl">Selecciona Supermercado, Bencina, Farmacia u otra categoría para comparar cuánto gastaste y cuánto se estima hacia adelante. También puedes hacer doble click en una barra para ver el detalle que explica el total.</p>
        <div className="flex gap-1.5 mt-4 overflow-x-auto pb-1">
          <button type="button" onClick={() => setFilter('all')} className={`h-8 px-3 rounded-full border text-[10px] font-semibold whitespace-nowrap ${filter === 'all' ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]' : 'bg-[var(--bg)] border-[var(--line)]'}`}>Todas</button>
          {series.map(id => {
            const cat = categoryMeta(id)
            return (
              <button key={id} type="button" onClick={() => setFilter(id)} className={`h-8 px-3 rounded-full border text-[10px] font-semibold whitespace-nowrap inline-flex items-center gap-1.5 ${filter === id ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]' : 'bg-[var(--bg)] border-[var(--line)]'}`}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }}/>{cat.icon} {cat.label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="px-3 sm:px-5 py-4 overflow-x-auto">
        <div className="min-w-[760px] flex items-end gap-2">
          {timeline.rows.map((row, index) => (
            <div key={row.key} className={index === 3 ? 'ml-5 pl-5 border-l border-dashed border-[var(--line)]' : ''}>
              <CategoryBar row={row} filter={filter} series={series} maxVisible={maxVisible} selected={selectedKey === row.key} onSelect={setSelectedKey} onOpenDetail={onOpenDetail}/>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function validHistoricalExpense(expense) {
  if (!expense || Number(expense.amount || 0) <= 0) return false
  const status = String(expense.status || '').toLowerCase()
  if (['pendiente', 'revisar'].includes(status)) return false
  if (['payment', 'credit'].includes(expense.movementType)) return false
  return true
}

function bankName(value) {
  const text = String(value || '').toLowerCase()
  if (text === 'bchile' || text.includes('chile')) return 'Banco Chile'
  if (text === 'falabella' || text.includes('falabella') || text.includes('cmr')) return 'Banco Falabella'
  return value || 'Otros'
}

function addDetailGroup(groups, id, label, items, source) {
  const cleanItems = (items || []).filter(item => Number(item.amount || 0) !== 0)
  if (!cleanItems.length) return
  groups.push({
    id,
    label,
    source,
    items: cleanItems,
    subtotal: cleanItems.reduce((sum, item) => sum + Number(item.amount || 0), 0),
  })
}

function buildMonthDetail({ key, timeline, expenses }) {
  if (!key) return null
  const row = timeline.rows.find(item => item.key === key)
  if (!row) return null

  const groups = []
  if (row.kind === 'actual') {
    const items = (expenses || [])
      .filter(validHistoricalExpense)
      .filter(expense => monthKey(expense.date) === key)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .map(expense => {
        const category = categoryMeta(typeof expense.category === 'string' ? expense.category : expense.category?.id)
        return {
          id: expense.id,
          label: expense.description || 'Gasto',
          amount: Number(expense.amount || 0),
          meta: [String(expense.date || '').slice(0, 10), bankName(expense.bank || expense.bankId || expense.cardName), `${category.icon} ${category.label}`].filter(Boolean).join(' · '),
        }
      })
    addDetailGroup(groups, 'real', 'Movimientos reales conciliados', items, 'Real')
    return {
      key,
      label: row.label,
      kind: row.kind,
      total: Number(row.total || 0),
      groups,
      bankSegments: row.bankSegments,
      layers: row.layers,
      note: 'Este mes usa movimientos reales por fecha de compra. Pagos y abonos de tarjeta no se vuelven a contar como gasto.',
    }
  }

  const definitions = [
    ['billing', 'Facturación / vencimientos informados', 'Banco informado'],
    ['recurring', 'Recurrentes', 'Recurrente'],
    ['installments', 'Cuotas adicionales', 'Cuota'],
    ['simulations', 'Compras simuladas', 'Simulación'],
    ['other', 'Otros compromisos', 'Otro'],
  ]

  definitions.forEach(([id, label, source]) => {
    const items = (row.sourceDetails?.[id] || []).map(item => ({
      id: item.id,
      label: item.label,
      amount: Number(item.amount || 0),
      meta: [bankName(item.bank), item.meta].filter(Boolean).join(' · '),
    }))
    addDetailGroup(groups, id, label, items, source)
  })

  return {
    key,
    label: row.label,
    kind: row.kind,
    total: Number(row.total || 0),
    groups,
    bankSegments: row.bankSegments,
    layers: row.layers,
    note: 'Cada grupo corresponde a un color de la barra. Azul/verde es lo informado por el banco; recurrentes, cuotas adicionales y simulaciones se muestran aparte y la suma coincide con el total del mes.',
  }
}

function MonthDetailModal({ detail, onClose }) {
  if (!detail) return null
  const listedTotal = detail.groups.reduce((sum, group) => sum + Number(group.subtotal || 0), 0)
  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative w-full sm:max-w-[760px] max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[var(--bg-elev)] border border-[var(--line)] shadow-2xl">
        <div className="sticky top-0 z-10 bg-[var(--bg-elev)] border-b border-[var(--line)] p-4 sm:p-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`rounded-full px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.1em] ${detail.kind === 'actual' ? 'bg-slate-100 text-slate-700' : 'bg-violet-100 text-violet-700'}`}>{detail.kind === 'actual' ? 'Dato real' : 'Proyección'}</span>
              <span className="text-[9px] text-[var(--muted)]">Auditoría del mes</span>
            </div>
            <h3 className="text-[19px] sm:text-[22px] font-bold mt-2">Qué consideré en {detail.label}</h3>
            <div className="font-mono text-[25px] font-bold mt-2">{fmtCLP(detail.total)}</div>
          </div>
          <button type="button" onClick={onClose} className="w-10 h-10 shrink-0 rounded-full border border-[var(--line)] grid place-items-center"><Icon name="x" size={13}/></button>
        </div>

        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-2 mb-4">
            {BANK_ORDER.map(bank => (
              <div key={bank} className="rounded-xl border border-[var(--line)] bg-[var(--bg)] p-2.5">
                <div className="flex items-center gap-1.5 text-[8px] text-[var(--muted)]"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: PROJECTION_BANKS[bank].color }}/>{PROJECTION_BANKS[bank].label}</div>
                <div className="font-mono text-[11px] font-bold mt-1">{fmtCLP(detail.bankSegments?.[bank] || 0)}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-[10px] leading-relaxed text-amber-900 mb-4">{detail.note}</div>

          <div className="flex flex-col gap-3">
            {detail.groups.map(group => (
              <section key={group.id} className="rounded-2xl border border-[var(--line)] overflow-hidden">
                <div className="px-3 py-2.5 bg-[var(--soft)] flex items-center justify-between gap-3">
                  <div className="min-w-0"><div className="text-[10.5px] font-bold truncate">{group.label}</div><div className="text-[8.5px] text-[var(--muted)] mt-0.5">{group.source}</div></div>
                  <div className="font-mono text-[11px] font-bold shrink-0">{fmtCLP(group.subtotal)}</div>
                </div>
                <div className="divide-y divide-[var(--line)]">
                  {group.items.map((item, index) => (
                    <div key={`${group.id}-${item.id || index}`} className="px-3 py-2.5 flex items-start justify-between gap-3 bg-[var(--bg-elev)]">
                      <div className="min-w-0"><div className="text-[10.5px] font-medium break-words">{item.label}</div>{item.meta && <div className="text-[8.5px] text-[var(--muted)] mt-1 leading-relaxed">{item.meta}</div>}</div>
                      <div className={`font-mono text-[10.5px] font-bold shrink-0 ${Number(item.amount || 0) < 0 ? 'text-red-700' : ''}`}>{fmtCLP(item.amount)}</div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
            {!detail.groups.length && <div className="rounded-2xl border border-dashed border-[var(--line)] p-6 text-center text-[10px] text-[var(--muted)]">No hay movimientos individuales para mostrar en este mes.</div>}
          </div>

          <div className="mt-4 rounded-2xl bg-[var(--ink)] text-[var(--bg)] px-4 py-3 flex items-center justify-between gap-3">
            <div><div className="text-[8px] uppercase tracking-[0.1em] opacity-60">Suma del listado</div><div className="text-[9px] opacity-65 mt-0.5">Debe coincidir con el total considerado.</div></div>
            <div className="font-mono text-[16px] font-bold">{fmtCLP(listedTotal)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SimulationModal({ onClose, onSave }) {
  const current = currentMonthKey()
  const [form, setForm] = useState({
    name: '', amount: '', date: `${addMonthsKey(current, 1)}-01`, installments: 1,
    bank: 'falabella', category: 'otros', active: true,
  })
  const set = (key, value) => setForm(value0 => ({ ...value0, [key]: value }))
  const valid = form.name.trim() && Number(form.amount || 0) > 0 && Number(form.installments || 0) > 0 && form.date
  const monthly = valid ? Math.round(Number(form.amount) / Number(form.installments)) : 0
  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative w-full sm:max-w-[520px] max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[var(--bg-elev)] border border-[var(--line)] shadow-2xl">
        <div className="sticky top-0 bg-[var(--bg-elev)] border-b border-[var(--line)] p-4 flex items-start justify-between">
          <div><div className="text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] font-bold">Simulación</div><h3 className="text-[17px] font-bold mt-1">Probar una compra futura</h3></div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full border border-[var(--line)] grid place-items-center"><Icon name="x" size={13}/></button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <label className="col-span-2"><span className="text-[10px] text-[var(--muted)] font-semibold">Descripción</span><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ej: Notebook nuevo" className="mt-1 w-full h-10 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[12px]"/></label>
          <label><span className="text-[10px] text-[var(--muted)] font-semibold">Monto total</span><input type="number" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} className="mt-1 w-full h-10 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[12px] font-mono"/></label>
          <label><span className="text-[10px] text-[var(--muted)] font-semibold">Cuotas</span><input type="number" min="1" max="36" value={form.installments} onChange={e => set('installments', e.target.value)} className="mt-1 w-full h-10 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[12px] font-mono"/></label>
          <label><span className="text-[10px] text-[var(--muted)] font-semibold">Primera cuota / pago</span><input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="mt-1 w-full h-10 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[11px]"/></label>
          <label><span className="text-[10px] text-[var(--muted)] font-semibold">Banco</span><select value={form.bank} onChange={e => set('bank', e.target.value)} className="mt-1 w-full h-10 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[11px]"><option value="bchile">Banco Chile</option><option value="falabella">Banco Falabella</option><option value="otros">Otro / efectivo</option></select></label>
          <label className="col-span-2"><span className="text-[10px] text-[var(--muted)] font-semibold">Categoría</span><select value={form.category} onChange={e => set('category', e.target.value)} className="mt-1 w-full h-10 rounded-xl border border-[var(--line)] bg-[var(--bg)] px-3 text-[11px]">{CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>)}</select></label>
          {monthly > 0 && <div className="col-span-2 rounded-2xl bg-[var(--soft)] px-3 py-3 text-[11px]">Impacto aproximado por mes: <strong className="font-mono">{fmtCLP(monthly)}</strong> durante {form.installments} {Number(form.installments) === 1 ? 'mes' : 'meses'}.</div>}
        </div>
        <div className="p-4 border-t border-[var(--line)] flex justify-end gap-2"><button onClick={onClose} className="h-10 px-4 rounded-xl border border-[var(--line)] text-[11px] font-semibold">Cancelar</button><button disabled={!valid} onClick={() => onSave({ ...form, id: `sim-${Date.now()}`, amount: Number(form.amount), installments: Number(form.installments) })} className="h-10 px-4 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-[11px] font-semibold disabled:opacity-40">Agregar simulación</button></div>
      </div>
    </div>
  )
}

export default function NewProjection({
  accounts = [], recurringList = [], incomeList = [], receivables = [], payables = [],
  installmentDebts = [], expenses = [], creditCards = [],
}) {
  const [cycles, setCycles] = useState([])
  const [mpStatus, setMpStatus] = useState(null)
  const [salarySlips, setSalarySlips] = useState([])
  const [forecasts, setForecasts] = useState([])
  const [simulations, setSimulations] = useState([])
  const [showSimulation, setShowSimulation] = useState(false)
  const [detailKey, setDetailKey] = useState(null)
  const [bankFilter, setBankFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedKey, setSelectedKey] = useState(addMonthsKey(currentMonthKey(), 1))
  const [decisionKey, setDecisionKey] = useState(addMonthsKey(currentMonthKey(), 1))
  const [layers, setLayers] = useState({ recurring: true, installments: true, simulations: true })

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([fetchBillingCycles(), fetchMercadoPagoStatus(), fetchSalarySlips(), fetchBillingForecasts()]).then(results => {
      if (cancelled) return
      if (results[0].status === 'fulfilled') setCycles(results[0].value || [])
      if (results[1].status === 'fulfilled') setMpStatus(results[1].value || null)
      if (results[2].status === 'fulfilled') setSalarySlips(results[2].value || [])
      if (results[3].status === 'fulfilled') setForecasts(results[3].value || [])
    })
    return () => { cancelled = true }
  }, [])

  const modelAccounts = useMemo(() => withMercadoPagoFreeBalance(accounts, mpStatus), [accounts, mpStatus])
  const modelPayables = useMemo(() => coverReservePayables(payables, Number(mpStatus?.reserved_partition_balance || 0)), [payables, mpStatus])
  const modelIncome = useMemo(() => withVariableSalary(incomeList, salarySlips, monthKeyCL(), 12, 5), [incomeList, salarySlips])
  const modelInstallments = useMemo(() => withStatementForecastFloors(installmentDebts, forecasts), [installmentDebts, forecasts])

  const plan = useMemo(() => buildProjectionPlan({
    accounts: modelAccounts,
    recurringList,
    incomeList: modelIncome,
    receivables,
    payables: modelPayables,
    installmentDebts: modelInstallments,
    expenses,
    billingCycles: cycles,
    simulations,
    scenario: 'simulated',
    includeSavings: false,
    includeReceivables: false,
    includePayables: true,
    horizonMonths: 6,
  }), [modelAccounts, recurringList, modelIncome, receivables, modelPayables, modelInstallments, expenses, cycles, simulations])

  const timeline = useMemo(() => buildNewProjectionTimeline({
    expenses,
    planMonths: plan.months,
    creditCards,
    billingCycles: cycles,
    billingForecasts: forecasts,
    installmentDebts: modelInstallments,
    simulations,
  }), [expenses, plan.months, creditCards, cycles, forecasts, modelInstallments, simulations])

  useEffect(() => {
    if (!timeline.rows.some(row => row.key === selectedKey)) setSelectedKey(timeline.currentKey)
  }, [timeline, selectedKey])

  const selectedRow = timeline.rows.find(row => row.key === selectedKey)
  const capacity = safeSpendingCapacity(plan.months, decisionKey)
  const decisionMonth = plan.months.find(month => month.key === decisionKey)
  const lowest = plan.lowestMonth
  const nextMonth = plan.months[1] || plan.months[0]
  const nextCapacity = nextMonth ? safeSpendingCapacity(plan.months, nextMonth.key) : 0
  const detail = useMemo(() => buildMonthDetail({
    key: detailKey,
    timeline,
    expenses,
  }), [detailKey, timeline, expenses])
  const openDetail = key => {
    setSelectedKey(key)
    setDetailKey(key)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 md:py-7 flex flex-col gap-5">
      <section className="rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-emerald-50 p-5 md:p-6 overflow-hidden relative">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-violet-200/30 blur-3xl"/>
        <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div><div className="inline-flex items-center gap-2 rounded-full bg-violet-100 text-violet-800 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.12em]">Nueva Proyección · Beta</div><h1 className="text-[24px] md:text-[30px] font-bold tracking-tight mt-3">Decide antes de gastar</h1><p className="text-[11px] md:text-[12px] text-[var(--muted)] mt-2 max-w-2xl leading-relaxed">Compara lo que realmente gastaste, mira seis meses hacia adelante y prueba compras en cuotas sin modificar tus datos reales.</p></div>
          <button type="button" onClick={() => setShowSimulation(true)} className="h-11 px-4 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-[11px] font-semibold inline-flex items-center justify-center gap-2"><Icon name="plus" size={13}/> Simular gasto</button>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-[var(--ink)] text-[var(--bg)] p-4"><div className="text-[9px] uppercase tracking-[0.1em] opacity-60">Margen próximo mes</div><div className="font-mono text-[23px] font-bold mt-3">{fmtCLP(nextCapacity)}</div><div className="text-[10px] opacity-65 mt-1">Margen conservador sin bajar del colchón de seguridad.</div></div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-4"><div className="text-[9px] uppercase tracking-[0.1em] text-[var(--muted)]">Mes más exigente</div><div className="text-[17px] font-bold mt-3">{lowest?.label || '—'}</div><div className={`font-mono text-[13px] mt-1 ${Number(lowest?.closingBalance || 0) < 0 ? 'text-red-700' : 'text-[var(--muted)]'}`}>Saldo {fmtCLP(lowest?.closingBalance || 0)}</div></div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-4"><div className="text-[9px] uppercase tracking-[0.1em] text-[var(--muted)]">Saldo a 6 meses</div><div className="font-mono text-[23px] font-bold mt-3">{fmtCLP(plan.finalBalance)}</div><div className="text-[10px] text-[var(--muted)] mt-1">Después de facturación, cuotas y recurrentes conocidos.</div></div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-4"><div className="text-[9px] uppercase tracking-[0.1em] text-[var(--muted)]">Simulaciones activas</div><div className="font-mono text-[23px] font-bold mt-3">{simulations.length}</div><div className="text-[10px] text-[var(--muted)] mt-1">Solo viven en esta vista y no cambian Supabase.</div></div>
      </section>

      <BankChart timeline={timeline} filter={bankFilter} setFilter={setBankFilter} selectedKey={selectedKey} setSelectedKey={setSelectedKey} onOpenDetail={openDetail} layerVisibility={layers} setLayerVisibility={setLayers}/>

      {selectedRow && (
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div><div className="text-[9px] uppercase tracking-[0.1em] text-[var(--muted)]">Mes seleccionado</div><div className="text-[15px] font-bold mt-1">{selectedRow.label} · {selectedRow.kind === 'actual' ? 'gasto real' : 'salida comprometida'}</div></div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="grid grid-cols-3 gap-3 sm:text-right">{BANK_ORDER.map(bank => <div key={bank}><div className="text-[8px] text-[var(--muted)]">{PROJECTION_BANKS[bank].label}</div><div className="font-mono text-[11px] font-bold mt-0.5">{fmtCLP(selectedRow.bankSegments?.[bank] || 0)}</div></div>)}</div>
            <button type="button" onClick={() => openDetail(selectedRow.key)} className="h-9 px-3 rounded-xl border border-[var(--line)] bg-[var(--bg)] text-[10px] font-semibold whitespace-nowrap">Ver qué consideré</button>
          </div>
        </section>
      )}

      <CategoryChart timeline={timeline} filter={categoryFilter} setFilter={setCategoryFilter} selectedKey={selectedKey} setSelectedKey={setSelectedKey} onOpenDetail={openDetail}/>

      <section className="rounded-3xl border border-[var(--line)] bg-[var(--bg-elev)] p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div><div className="text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] font-bold">Capacidad de gasto</div><h2 className="text-[18px] font-bold mt-1">¿Cuánto podría gastar extra?</h2><p className="text-[10.5px] text-[var(--muted)] mt-1 max-w-xl">El margen revisa el mes elegido y todos los meses posteriores. Conserva como mínimo $100.000 o 10% de los ingresos mensuales, lo que sea mayor.</p></div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">{plan.months.map(month => <button key={month.key} type="button" onClick={() => setDecisionKey(month.key)} className={`h-8 px-3 rounded-full border text-[10px] font-semibold whitespace-nowrap ${decisionKey === month.key ? 'bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]' : 'border-[var(--line)] bg-[var(--bg)]'}`}>{monthLabel(month.key, true)}</button>)}</div>
        </div>
        <div className="mt-4 rounded-2xl bg-[var(--soft)] p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div><div className="text-[10px] text-[var(--muted)]">Margen conservador en {decisionMonth?.label || monthLabel(decisionKey)}</div><div className={`font-mono text-[28px] font-bold mt-1 ${capacity <= 0 ? 'text-red-700' : 'text-emerald-700'}`}>{fmtCLP(capacity)}</div><div className="text-[10px] text-[var(--muted)] mt-1">{capacity > 0 ? 'Puedes probar una compra hasta este rango y verificar cómo cambia el resto del horizonte.' : 'No hay margen conservador adicional con los compromisos actuales.'}</div></div>
          <button type="button" onClick={() => setShowSimulation(true)} className="h-10 px-4 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-[11px] font-semibold">Probar una compra</button>
        </div>
      </section>

      {simulations.length > 0 && (
        <section className="rounded-3xl border border-[var(--line)] bg-[var(--bg-elev)] p-4 sm:p-5">
          <div className="flex items-center justify-between"><div><div className="text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] font-bold">Escenario activo</div><h2 className="text-[16px] font-bold mt-1">Compras simuladas</h2></div><button type="button" onClick={() => setSimulations([])} className="text-[10px] underline text-[var(--muted)]">Limpiar</button></div>
          <div className="grid md:grid-cols-2 gap-2 mt-3">{simulations.map(item => <div key={item.id} className="rounded-2xl border border-[var(--line)] bg-[var(--bg)] p-3 flex items-center justify-between gap-3"><div className="min-w-0"><div className="text-[11px] font-semibold truncate">{item.name}</div><div className="text-[9.5px] text-[var(--muted)] mt-1">{fmtCLP(item.amount)} · {item.installments} cuota(s) · {PROJECTION_BANKS[item.bank]?.label || 'Otro'}</div></div><button type="button" onClick={() => setSimulations(current => current.filter(sim => sim.id !== item.id))} className="w-8 h-8 rounded-lg border border-[var(--line)] grid place-items-center"><Icon name="x" size={11}/></button></div>)}</div>
        </section>
      )}

      {detail && <MonthDetailModal detail={detail} onClose={() => setDetailKey(null)}/>} 
      {showSimulation && <SimulationModal onClose={() => setShowSimulation(false)} onSave={item => { setSimulations(current => [...current, item]); setShowSimulation(false); setDecisionKey(monthKey(item.date)) }}/>} 
    </div>
  )
}
