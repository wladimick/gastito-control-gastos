import React, { useEffect, useMemo, useState } from 'react'
import { financialHelpFor } from '../lib/financialHelp'
import { Badge, Card, InfoTip } from './ui'
import { Icon, fmtCLP, MES } from '../lib/helpers'
import { CATEGORIES } from '../data'
import { useBanks } from '../services/banksService'
import { fetchBillingCycles } from '../services/billingCyclesService'

function keyFor(value) { return String(value || '').slice(0,7) }
function addMonths(key, offset) { const [y,m]=key.split('-').map(Number); const date=new Date(Date.UTC(y,m-1+offset,1)); return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}` }
function currentKey() { const parts=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',timeZone:'America/Santiago'}).formatToParts(new Date()); return `${parts.find(p=>p.type==='year')?.value}-${parts.find(p=>p.type==='month')?.value}` }
function cycleAmount(cycle) { return cycle.reportedAmountIsFinal ? Number(cycle.reportedAmount||0) : Math.max(Number(cycle.reportedAmount||0),Number(cycle.estimatedAmount||0),Number(cycle.calculatedAmount||0)) }
function labelMonth(key) { const [y,m]=key.split('-').map(Number); return `${MES[m-1]} ${y}` }
function short(value) { return new Intl.NumberFormat('es-CL',{notation:'compact',maximumFractionDigits:1}).format(Number(value||0)) }
function Metric({label,value,detail,tone='default', info}) {
  const help = info || financialHelpFor(label)const cls=tone==='dark'?'bg-[var(--ink)] text-[var(--bg)] border-transparent':tone==='danger'?'bg-red-50 text-red-800 border-red-100':tone==='warning'?'bg-[var(--amber-soft)] text-[var(--amber-ink)] border-transparent':'bg-[var(--bg-elev)] border-[var(--line)]';return <div className={`rounded-2xl border p-4 min-h-[112px] ${cls}`}><div className="flex items-center gap-1.5"><div className="text-[10px] uppercase tracking-[0.11em] font-bold opacity-60">{label}</div>{help && <InfoTip content={help}/>}</div><div className="font-mono text-[22px] font-bold mt-3">{value}</div><div className="text-[10px] opacity-65 mt-1.5">{detail}</div></div>}

export default function Reports({ expenses = [], recurringList = [], incomeList = [], accounts = [], receivables = [], payables = [] }) {
  const banks = useBanks(); const nowKey=currentKey(); const [selected,setSelected]=useState(nowKey); const [cycles,setCycles]=useState([]); const [loading,setLoading]=useState(true)
  useEffect(()=>{let cancelled=false;fetchBillingCycles().then(data=>{if(!cancelled)setCycles(data||[])}).catch(console.error).finally(()=>{if(!cancelled)setLoading(false)});return()=>{cancelled=true}},[])
  const monthOptions=useMemo(()=>{const keys=new Set([nowKey,...expenses.map(item=>keyFor(item.date)).filter(Boolean)]);return [...keys].sort().reverse().slice(0,12)},[expenses,nowKey])
  useEffect(()=>{if(!monthOptions.includes(selected)&&monthOptions.length)setSelected(monthOptions[0])},[monthOptions,selected])
  const movements=useMemo(()=>expenses.filter(item=>keyFor(item.date)===selected),[expenses,selected])
  const previousKey=addMonths(selected,-1); const previous=expenses.filter(item=>keyFor(item.date)===previousKey)
  const spent=movements.reduce((sum,item)=>sum+Number(item.amount||0),0); const previousSpent=previous.reduce((sum,item)=>sum+Number(item.amount||0),0)
  const delta=previousSpent?((spent-previousSpent)/previousSpent*100):null
  const incomeConfigured=incomeList.filter(item=>item.active).reduce((sum,item)=>sum+Number(item.amount||0),0)
  const directRecurring=recurringList.filter(item=>item.active&&item.type!=='credito')
  const pendingDirect=selected===nowKey?directRecurring.filter(item=>item.lastChargedMonth!==selected):[]
  const pendingDirectTotal=pendingDirect.reduce((sum,item)=>sum+Number(item.amount||0),0)
  const duePayables=payables.filter(item=>item.status!=='paid'&&keyFor(item.dueDate)===selected); const duePayablesTotal=duePayables.reduce((s,i)=>s+Number(i.amount||0),0)
  const dueReceivables=receivables.filter(item=>item.status!=='paid'&&keyFor(item.dueDate)===selected); const dueReceivablesTotal=dueReceivables.reduce((s,i)=>s+Number(i.amount||0),0)
  const dueCycles=cycles.filter(cycle=>keyFor(cycle.dueDate)===selected&&cycle.status!=='paid'); const invoiceTotal=dueCycles.reduce((s,c)=>s+cycleAmount(c),0)
  const expectedCash=incomeConfigured+dueReceivablesTotal-invoiceTotal-pendingDirectTotal-duePayablesTotal
  const shared=movements.filter(item=>item.sharedWithNicol).reduce((s,i)=>s+Number(i.amount||0),0)
  const reviewCount=movements.filter(item=>item.status==='revisar').length

  const byCategory=useMemo(()=>{const map={};movements.forEach(item=>{const id=item.category||'otros';map[id]=(map[id]||0)+Number(item.amount||0)});return Object.entries(map).map(([id,value])=>({...(CATEGORIES.find(c=>c.id===id)||CATEGORIES.find(c=>c.id==='otros')),value})).sort((a,b)=>b.value-a.value)},[movements])
  const byBank=useMemo(()=>{const map={};movements.forEach(item=>{const id=item.bank||'sin_banco';map[id]=(map[id]||0)+Number(item.amount||0)});return Object.entries(map).map(([id,value])=>({id,label:banks.find(b=>b.id===id)?.label||id,value})).sort((a,b)=>b.value-a.value)},[movements,banks])
  const bySource=useMemo(()=>{const map={manual:0,billing:0,reconciled:0};movements.forEach(item=>{map[item.source||'manual']=(map[item.source||'manual']||0)+Number(item.amount||0)});return map},[movements])
  const trendKeys=useMemo(()=>[-5,-4,-3,-2,-1,0].map(offset=>addMonths(selected,offset)),[selected]); const trend=trendKeys.map(key=>({key,value:expenses.filter(item=>keyFor(item.date)===key).reduce((s,i)=>s+Number(i.amount||0),0)})); const trendMax=Math.max(1,...trend.map(i=>i.value))
  const largest=movements.reduce((best,item)=>!best||Number(item.amount)>Number(best.amount)?item:best,null)
  const daysInMonth=(()=>{const[y,m]=selected.split('-').map(Number);return new Date(y,m,0).getDate()})(); const usedDays=new Set(movements.map(item=>String(item.date||'').slice(0,10))); const elapsed=selected===nowKey?new Date().getDate():daysInMonth; const noSpend=Math.max(0,elapsed-usedDays.size)

  return <div className="max-w-7xl mx-auto pb-20 flex flex-col gap-5">
    <Card padding="p-3"><div className="flex gap-2 overflow-x-auto">{monthOptions.map(key=><button key={key} onClick={()=>setSelected(key)} className={`h-9 px-3 rounded-xl text-[10px] font-semibold whitespace-nowrap ${selected===key?'bg-[var(--ink)] text-[var(--bg)]':'border border-[var(--line)] text-[var(--muted)]'}`}>{labelMonth(key)}</button>)}</div></Card>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      <Metric label="Consumo del mes" value={fmtCLP(spent)} detail={`${movements.length} movimientos conciliados`} tone="dark"/>
      <Metric label="Vs. mes anterior" value={delta==null?'Sin referencia':`${delta>=0?'+':''}${Math.round(delta)}%`} detail={`Anterior: ${fmtCLP(previousSpent)}`} tone={delta>15?'danger':delta>0?'warning':'default'}/>
      <Metric label="Facturas que vencen" value={loading?'Actualizando…':fmtCLP(invoiceTotal)} detail={`${dueCycles.length} ciclos bancarios en ${labelMonth(selected)}`}/>
      <Metric label="Flujo esperado" value={fmtCLP(expectedCash)} detail="Ingresos y cobros menos facturas, deudas y fijos pendientes" tone={expectedCash<0?'danger':'default'}/>
    </div>

    <div className="grid lg:grid-cols-[1.35fr_.65fr] gap-4">
      <Card padding="p-4 md:p-5"><div className="flex items-start justify-between"><div><div className="text-[13px] font-bold">Evolución del consumo</div><div className="text-[10px] text-[var(--muted)] mt-1">Cada barra usa exactamente los movimientos de ese mes.</div></div><div className="text-right"><div className="text-[9px] uppercase text-[var(--muted)]">Promedio 6 meses</div><div className="font-mono text-[13px] font-bold mt-1">{fmtCLP(Math.round(trend.reduce((s,i)=>s+i.value,0)/trend.length))}</div></div></div><div className="mt-5 flex items-end gap-3 h-52">{trend.map(item=><div key={item.key} className="flex-1 h-full flex flex-col justify-end items-center gap-2"><div className="text-[9px] font-mono text-[var(--muted)]">{short(item.value)}</div><div className={`w-full rounded-t-lg ${item.key===selected?'bg-[var(--ink)]':'bg-[var(--ink-3)]'}`} style={{height:`${Math.max(3,item.value/trendMax*150)}px`}}/><div className="text-[9px] text-[var(--muted)]">{labelMonth(item.key).split(' ')[0].slice(0,3)}</div></div>)}</div></Card>
      <Card padding="p-4 md:p-5"><div className="text-[13px] font-bold">Lectura del mes</div><div className="mt-4 space-y-3"><div className="rounded-xl bg-[var(--bg)] p-3"><div className="text-[9px] uppercase text-[var(--muted)]">Compartido con Nicol</div><div className="font-mono text-[17px] font-bold mt-1">{fmtCLP(shared)}</div><div className="text-[9.5px] text-[var(--muted)] mt-1">Monto marcado, antes de aplicar porcentaje.</div></div><div className="rounded-xl bg-[var(--bg)] p-3"><div className="text-[9px] uppercase text-[var(--muted)]">Días sin gasto</div><div className="font-mono text-[17px] font-bold mt-1">{noSpend}</div><div className="text-[9.5px] text-[var(--muted)] mt-1">De {elapsed} días transcurridos.</div></div><div className="rounded-xl bg-[var(--bg)] p-3"><div className="text-[9px] uppercase text-[var(--muted)]">Mayor movimiento</div><div className="font-mono text-[17px] font-bold mt-1">{largest?fmtCLP(largest.amount):'—'}</div><div className="text-[9.5px] text-[var(--muted)] mt-1 truncate">{largest?.description||'Sin movimientos'}</div></div>{reviewCount>0&&<div className="rounded-xl bg-[var(--amber-soft)] p-3 text-[var(--amber-ink)]"><div className="text-[11px] font-bold">{reviewCount} movimientos requieren revisión</div></div>}</div></Card>
    </div>

    <div className="grid lg:grid-cols-2 gap-4">
      <Card padding="p-4 md:p-5"><div className="flex items-center justify-between"><div><div className="text-[13px] font-bold">Por categoría</div><div className="text-[10px] text-[var(--muted)] mt-1">Solo {labelMonth(selected)}.</div></div><div className="font-mono text-[14px] font-bold">{fmtCLP(spent)}</div></div><div className="mt-4 space-y-3">{byCategory.slice(0,8).map(item=>{const pct=spent?item.value/spent*100:0;return <div key={item.id}><div className="flex items-center justify-between text-[10.5px]"><span>{item.icon} {item.label}</span><span className="font-mono">{fmtCLP(item.value)} · {Math.round(pct)}%</span></div><div className="mt-1.5 h-1.5 rounded-full bg-[var(--line)]"><div className="h-full rounded-full" style={{width:`${pct}%`,background:item.color}}/></div></div>})}{!byCategory.length&&<div className="py-8 text-center text-[10.5px] text-[var(--muted)]">Sin movimientos para este mes.</div>}</div></Card>

      <Card padding="p-4 md:p-5"><div className="text-[13px] font-bold">Origen y banco</div><div className="text-[10px] text-[var(--muted)] mt-1">Ayuda a distinguir registros manuales de movimientos bancarios.</div><div className="grid grid-cols-3 gap-2 mt-4">{[['billing','Tarjeta'],['manual','Manual'],['reconciled','Conciliado']].map(([id,label])=><div key={id} className="rounded-xl bg-[var(--bg)] p-3"><div className="text-[9px] text-[var(--muted)] uppercase">{label}</div><div className="font-mono text-[14px] font-bold mt-1">{fmtCLP(bySource[id]||0)}</div></div>)}</div><div className="mt-4 space-y-3">{byBank.map(item=>{const pct=spent?item.value/spent*100:0;return <div key={item.id}><div className="flex justify-between text-[10.5px]"><span>{item.label}</span><span className="font-mono">{fmtCLP(item.value)}</span></div><div className="mt-1.5 h-1.5 rounded-full bg-[var(--line)]"><div className="h-full rounded-full bg-[var(--ink)]" style={{width:`${pct}%`}}/></div></div>})}</div></Card>
    </div>

    <Card padding="p-4 md:p-5"><div className="flex items-start gap-3"><div className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] text-[var(--accent-ink)] grid place-items-center"><Icon name="calendar" size={15}/></div><div className="flex-1"><div className="text-[13px] font-bold">Compromisos de {labelMonth(selected)}</div><div className="text-[10px] text-[var(--muted)] mt-1">No se mezclan con el consumo: sirven para entender el flujo de caja del mes.</div><div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-4">{[['Ingreso configurado',incomeConfigured],['Facturas tarjetas',invoiceTotal],['Fijos directos pendientes',pendingDirectTotal],['Por pagar',duePayablesTotal],['Por cobrar',dueReceivablesTotal]].map(([label,value])=><div key={label} className="rounded-xl border border-[var(--line)] p-3"><div className="text-[8.5px] uppercase text-[var(--muted)]">{label}</div><div className="font-mono text-[13px] font-bold mt-1">{fmtCLP(value)}</div></div>)}</div></div></div></Card>
  </div>
}
