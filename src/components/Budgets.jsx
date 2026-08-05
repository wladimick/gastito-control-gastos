import React, { useMemo, useState } from 'react'
import { financialHelpFor } from '../lib/financialHelp'
import { Badge, Card, InfoTip } from './ui'
import { Icon, fmtCLP, MES } from '../lib/helpers'
import { CATEGORIES } from '../data'

const EXCLUDED = new Set(['sueldo','ahorro','prestamo','deuda','por_cobrar','por_pagar'])
function keyFor(date) { const value = String(date || '').slice(0, 10); return value.slice(0, 7) }
function currentKey() { const parts = new Intl.DateTimeFormat('en-CA', { year:'numeric', month:'2-digit', timeZone:'America/Santiago' }).formatToParts(new Date()); return `${parts.find(p=>p.type==='year')?.value}-${parts.find(p=>p.type==='month')?.value}` }
function addMonths(key, offset) { const [y,m] = key.split('-').map(Number); const date = new Date(Date.UTC(y,m-1+offset,1)); return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}` }
function roundBudget(value) { if (!value) return 0; return Math.ceil(value / 5000) * 5000 }
function sumByCategory(expenses, month) { return expenses.filter(item => keyFor(item.date) === month).reduce((map,item) => { const id = item.category || 'otros'; map[id] = (map[id] || 0) + Number(item.amount || 0); return map }, {}) }

function Metric({label, value, detail, tone='default', info}) {
  const help = info || financialHelpFor(label) const cls = tone==='dark'?'bg-[var(--ink)] text-[var(--bg)] border-transparent':tone==='warning'?'bg-[var(--amber-soft)] text-[var(--amber-ink)] border-transparent':tone==='danger'?'bg-red-50 text-red-800 border-red-100':'bg-[var(--bg-elev)] border-[var(--line)]'; return <div className={`rounded-2xl border p-4 min-h-[112px] ${cls}`}><div className="flex items-center gap-1.5"><div className="text-[10px] uppercase tracking-[0.11em] font-bold opacity-60">{label}</div>{help && <InfoTip content={help}/>}</div><div className="font-mono text-[22px] font-bold mt-3">{value}</div><div className="text-[10px] opacity-65 mt-1.5">{detail}</div></div> }

export default function Budgets({ expenses = [], budgets = {}, setBudgets }) {
  const month = currentKey(); const [year,monthNumber] = month.split('-').map(Number)
  const today = new Date(); const daysInMonth = new Date(year, monthNumber, 0).getDate(); const day = today.getDate()
  const [editing, setEditing] = useState(null); const [draft, setDraft] = useState(''); const [showAll,setShowAll] = useState(false)
  const current = useMemo(() => sumByCategory(expenses, month), [expenses, month])
  const pastMonths = useMemo(() => [-1,-2,-3].map(offset => addMonths(month, offset)), [month])
  const past = useMemo(() => pastMonths.map(key => sumByCategory(expenses,key)), [expenses,pastMonths])

  const rows = useMemo(() => CATEGORIES.filter(cat => !EXCLUDED.has(cat.id)).map(cat => {
    const spent = Number(current[cat.id] || 0); const budget = Number(budgets[cat.id] || 0)
    const average = past.reduce((sum,map) => sum + Number(map[cat.id] || 0), 0) / past.length
    const suggestion = roundBudget(Math.max(average * .9, spent * 1.05))
    const pct = budget > 0 ? spent / budget * 100 : 0
    const state = budget <= 0 ? 'none' : pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok'
    return { ...cat, spent, budget, average, suggestion, pct, state }
  }).sort((a,b) => (b.spent + b.budget + b.average) - (a.spent + a.budget + a.average)), [current,budgets,past])

  const relevant = rows.filter(row => row.spent > 0 || row.budget > 0 || row.average > 0)
  const visible = showAll ? rows : relevant
  const totalSpent = rows.reduce((sum,row)=>sum+row.spent,0); const totalBudget = rows.reduce((sum,row)=>sum+row.budget,0)
  const historicalAverage = rows.reduce((sum,row)=>sum+row.average,0)
  const projected = day <= 7 ? Math.max(totalSpent, historicalAverage) : Math.round(totalSpent / Math.max(1,day) * daysInMonth)
  const remaining = totalBudget - totalSpent; const configured = rows.filter(row=>row.budget>0).length
  const warnings = rows.filter(row=>row.state==='warn').length; const over = rows.filter(row=>row.state==='over').length
  const suggestions = Object.fromEntries(rows.filter(row=>row.suggestion>0).map(row=>[row.id,row.suggestion]))

  const applySuggestions = () => setBudgets?.({ ...budgets, ...suggestions })
  const commit = () => { if (!editing) return; setBudgets?.({ ...budgets, [editing]: Number(draft || 0) }); setEditing(null) }

  return <div className="max-w-7xl mx-auto pb-20 flex flex-col gap-5">
    {totalBudget === 0 && <div className="rounded-2xl border border-[var(--amber-ink)]/20 bg-[var(--amber-soft)] p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"><div><div className="text-[12px] font-bold text-[var(--amber-ink)]">Todavía no tienes un plan de presupuesto</div><div className="text-[10.5px] text-[var(--amber-ink)]/75 mt-1">Gastito calculó límites sugeridos usando los últimos tres meses. Puedes aplicarlos y luego ajustar cada categoría.</div></div><button onClick={applySuggestions} className="h-10 px-4 rounded-xl bg-[var(--ink)] text-[var(--bg)] text-[11px] font-semibold">Crear plan sugerido · {fmtCLP(Object.values(suggestions).reduce((s,v)=>s+v,0))}</button></div>}

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      <Metric label={`Gastado · ${MES[monthNumber-1]}`} value={fmtCLP(totalSpent)} detail={`${expenses.filter(item=>keyFor(item.date)===month).length} movimientos`} tone="dark"/>
      <Metric label="Presupuesto definido" value={totalBudget ? fmtCLP(totalBudget) : 'Sin configurar'} detail={`${configured} categorías con límite`} tone={totalBudget ? 'default' : 'warning'}/>
      <Metric label="Proyección del mes" value={fmtCLP(projected)} detail={day <= 7 ? 'Basada en promedio histórico por ser inicio de mes' : `Ritmo de los primeros ${day} días`} tone={totalBudget && projected > totalBudget ? 'danger' : 'default'}/>
      <Metric label="Disponible del plan" value={totalBudget ? fmtCLP(remaining) : '—'} detail={totalBudget ? (remaining >= 0 ? 'Todavía disponible' : 'Sobre el límite total') : 'Define límites para calcularlo'} tone={remaining < 0 ? 'danger' : 'default'}/>
    </div>

    {totalBudget > 0 && <Card padding="p-4"><div className="flex items-center justify-between gap-3"><div><div className="text-[12px] font-bold">Ritmo del presupuesto</div><div className="text-[10px] text-[var(--muted)] mt-1">Día {day} de {daysInMonth} · {warnings} en alerta · {over} sobre límite</div></div><div className="font-mono text-[15px] font-bold">{Math.round(totalSpent / totalBudget * 100)}%</div></div><div className="mt-3 h-2 rounded-full bg-[var(--line)] overflow-hidden relative"><div className={`h-full rounded-full ${totalSpent > totalBudget ? 'bg-red-500' : projected > totalBudget ? 'bg-amber-500' : 'bg-[var(--accent)]'}`} style={{width:`${Math.min(100,totalSpent/totalBudget*100)}%`}}/><div className="absolute top-[-3px] bottom-[-3px] w-[2px] bg-[var(--ink)]/50" style={{left:`${Math.min(100,day/daysInMonth*100)}%`}}/></div></Card>}

    <Card padding="p-0"><div className="px-4 py-3.5 border-b border-[var(--line)] flex items-center justify-between gap-3"><div><div className="text-[13px] font-bold">Límites por categoría</div><div className="text-[10px] text-[var(--muted)] mt-1">Solo mostramos categorías con gasto, presupuesto o historial.</div></div><div className="flex gap-2"><button onClick={applySuggestions} className="h-8 px-3 rounded-xl border border-[var(--line)] text-[10px] font-semibold">Actualizar sugerencias</button><button onClick={()=>setShowAll(value=>!value)} className="h-8 px-3 rounded-xl border border-[var(--line)] text-[10px] font-semibold">{showAll?'Ocultar vacías':'Ver todas'}</button></div></div>
      {!visible.length ? <div className="p-10 text-center"><div className="text-[30px]">🎯</div><div className="text-[13px] font-bold mt-2">Sin historial suficiente</div><div className="text-[10.5px] text-[var(--muted)] mt-1">Cuando registres gastos aparecerán sugerencias automáticas.</div></div> : <div className="divide-y divide-[var(--line)]">{visible.map(row => { const state = row.state==='over'?{label:'Sobre límite',tone:'danger',bar:'bg-red-500'}:row.state==='warn'?{label:'Cerca del límite',tone:'warn',bar:'bg-amber-500'}:row.state==='ok'?{label:'En ruta',tone:'ok',bar:'bg-[var(--accent)]'}:{label:'Sin límite',tone:'muted',bar:'bg-[var(--line)]'}; return <div key={row.id} className="p-4"><div className="flex items-start gap-3"><div className="w-10 h-10 rounded-xl grid place-items-center text-[18px]" style={{background:`${row.color}20`}}>{row.icon}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="text-[12px] font-semibold">{row.label}</span><Badge tone={state.tone}>{state.label}</Badge></div><div className="font-mono text-[12px] flex items-center gap-1.5"><strong>{fmtCLP(row.spent)}</strong><span className="text-[var(--muted)]">/</span>{editing===row.id?<input autoFocus type="number" value={draft} onChange={event=>setDraft(event.target.value)} onBlur={commit} onKeyDown={event=>event.key==='Enter'&&commit()} className="w-24 h-7 rounded-lg border border-[var(--line)] px-2 text-right"/>:<button onClick={()=>{setEditing(row.id);setDraft(String(row.budget||row.suggestion||0))}} className="underline decoration-dotted underline-offset-4">{row.budget?fmtCLP(row.budget):'Definir'}</button>}</div></div><div className="mt-2 h-1.5 rounded-full bg-[var(--line)] overflow-hidden"><div className={`h-full rounded-full ${state.bar}`} style={{width:`${row.budget?Math.min(100,row.pct):0}%`}}/></div><div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[9.5px] text-[var(--muted)]"><span>Promedio 3 meses: {fmtCLP(Math.round(row.average))}</span><button onClick={()=>setBudgets?.({...budgets,[row.id]:row.suggestion})} className="font-semibold text-[var(--ink-2)]">Usar sugerencia {fmtCLP(row.suggestion)}</button></div></div></div></div>})}</div>}
    </Card>
  </div>
}
