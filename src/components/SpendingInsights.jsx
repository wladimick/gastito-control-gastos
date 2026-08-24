import React, { useMemo } from 'react'
import { Card } from './ui'
import { CATEGORIES } from '../data'
import { fmtCLP } from '../lib/helpers'

function currentMonthKey() {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'America/Santiago' })
    .format(new Date()).slice(0, 7)
}

function addMonth(key, offset) {
  const [year, month] = key.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + offset, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key) {
  const [year, month] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('es-CL', { month: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1))).replace('.', '')
}

function categoryMeta(id) {
  return CATEGORIES.find(item => item.id === id) || CATEGORIES.find(item => item.id === 'otros') || { label: 'Otros', icon: '•' }
}

function sourceLabel(row) {
  if (row.bank === 'mercadopago' || row.originSource === 'mercadopago') return 'Mercado Pago'
  if (row.type === 'credito') {
    if (row.bank === 'falabella') return 'CMR Falabella'
    if (row.bank === 'bchile') return 'Banco de Chile'
    return 'Tarjeta de crédito'
  }
  return 'Otros'
}

function Bar({ label, amount, max, detail }) {
  const pct = max > 0 ? Math.max(3, Math.round(amount * 100 / max)) : 0
  return <div>
    <div className="flex items-center justify-between gap-3 text-[10px]">
      <div className="font-medium truncate">{label}</div>
      <div className="font-mono font-semibold whitespace-nowrap">{fmtCLP(amount)}</div>
    </div>
    <div className="h-2 rounded-full bg-[var(--hover)] mt-1.5 overflow-hidden">
      <div className="h-full rounded-full bg-[var(--ink)]" style={{ width: `${pct}%` }}/>
    </div>
    {detail && <div className="text-[8.5px] text-[var(--muted)] mt-1">{detail}</div>}
  </div>
}

function Metric({ label, value, detail }) {
  return <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-3.5 min-h-[96px]">
    <div className="text-[9px] uppercase tracking-[.12em] font-bold text-[var(--muted)]">{label}</div>
    <div className="font-mono text-[18px] md:text-[21px] font-bold mt-2">{value}</div>
    <div className="text-[9px] text-[var(--muted)] mt-1 leading-relaxed">{detail}</div>
  </div>
}

export default function SpendingInsights({ expenses = [], setView }) {
  const key = currentMonthKey()
  const confirmed = useMemo(() => (expenses || [])
    .filter(row => Number(row.amount || 0) > 0)
    .filter(row => row.status !== 'revisar'), [expenses])

  const current = useMemo(() => confirmed.filter(row => String(row.date || '').slice(0, 7) === key), [confirmed, key])
  const total = current.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const day = Math.max(1, new Date().getDate())
  const daily = Math.round(total / day)
  const biggest = [...current].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0]

  const categoryRows = useMemo(() => {
    const map = new Map()
    current.forEach(row => {
      const id = row.category || 'otros'
      map.set(id, (map.get(id) || 0) + Number(row.amount || 0))
    })
    return [...map.entries()]
      .map(([id, amount]) => ({ id, amount, meta: categoryMeta(id) }))
      .sort((a, b) => b.amount - a.amount)
  }, [current])

  const sourceRows = useMemo(() => {
    const map = new Map()
    current.forEach(row => {
      const label = sourceLabel(row)
      map.set(label, (map.get(label) || 0) + Number(row.amount || 0))
    })
    return [...map.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount)
  }, [current])

  const merchantRows = useMemo(() => {
    const map = new Map()
    current.forEach(row => {
      const label = String(row.description || 'Sin comercio').trim()
      map.set(label, (map.get(label) || 0) + Number(row.amount || 0))
    })
    return [...map.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount).slice(0, 6)
  }, [current])

  const monthRows = useMemo(() => {
    return Array.from({ length: 6 }, (_, index) => addMonth(key, index - 5)).map(monthKey => ({
      monthKey,
      amount: confirmed
        .filter(row => String(row.date || '').slice(0, 7) === monthKey)
        .reduce((sum, row) => sum + Number(row.amount || 0), 0),
    }))
  }, [confirmed, key])

  const last3 = monthRows.slice(-3).filter(row => row.amount > 0)
  const avg3 = last3.length ? Math.round(last3.reduce((sum, row) => sum + row.amount, 0) / last3.length) : 0
  const maxCategory = categoryRows[0]?.amount || 0
  const maxSource = sourceRows[0]?.amount || 0
  const maxMerchant = merchantRows[0]?.amount || 0
  const maxMonth = Math.max(...monthRows.map(row => row.amount), 1)

  return <div className="max-w-6xl mx-auto space-y-4 pb-20">
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-[9.5px] uppercase tracking-[.13em] text-[var(--muted)] font-bold">Flujo · Consumo</div>
        <h2 className="text-[21px] md:text-[24px] font-bold mt-1">Métricas de gasto</h2>
        <p className="text-[10px] text-[var(--muted)] mt-1 max-w-2xl">Combina compras reales de Mercado Pago y movimientos conciliados de tarjetas. Transferencias y pagos de tarjeta no cuentan como consumo.</p>
      </div>
      <button type="button" onClick={() => setView?.('expenses')} className="h-9 rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] px-3 text-[10px] font-semibold whitespace-nowrap">Ver movimientos</button>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Metric label="Gasto este mes" value={fmtCLP(total)} detail={`${current.length} movimientos confirmados`}/>
      <Metric label="Promedio 3 meses" value={fmtCLP(avg3)} detail="Consumo mensual conciliado"/>
      <Metric label="Promedio diario" value={fmtCLP(daily)} detail={`Sobre ${day} días transcurridos`}/>
      <Metric label="Mayor movimiento" value={fmtCLP(biggest?.amount || 0)} detail={biggest?.description || 'Sin movimientos'}/>
    </div>

    <div className="grid lg:grid-cols-2 gap-3">
      <Card padding="p-4">
        <div className="text-[9px] uppercase tracking-[.12em] text-[var(--muted)] font-bold">En qué gastas más</div>
        <div className="text-[12px] font-semibold mt-1">Categorías · mes actual</div>
        <div className="mt-4 space-y-3">
          {categoryRows.slice(0, 7).map(row => <Bar key={row.id} label={`${row.meta.icon || '•'} ${row.meta.label}`} amount={row.amount} max={maxCategory} detail={total ? `${Math.round(row.amount * 100 / total)}% del gasto del mes` : ''}/>)}
          {!categoryRows.length && <div className="text-[10px] text-[var(--muted)]">Sin consumo confirmado este mes.</div>}
        </div>
      </Card>

      <Card padding="p-4">
        <div className="text-[9px] uppercase tracking-[.12em] text-[var(--muted)] font-bold">Cómo pagas</div>
        <div className="text-[12px] font-semibold mt-1">Mercado Pago + tarjetas</div>
        <div className="mt-4 space-y-3">
          {sourceRows.map(row => <Bar key={row.label} label={row.label} amount={row.amount} max={maxSource} detail={total ? `${Math.round(row.amount * 100 / total)}% del consumo` : ''}/>)}
          {!sourceRows.length && <div className="text-[10px] text-[var(--muted)]">Sin movimientos para comparar.</div>}
        </div>
      </Card>
    </div>

    <div className="grid lg:grid-cols-2 gap-3">
      <Card padding="p-4">
        <div className="text-[9px] uppercase tracking-[.12em] text-[var(--muted)] font-bold">Comercios</div>
        <div className="text-[12px] font-semibold mt-1">Dónde se concentra el gasto</div>
        <div className="mt-4 space-y-3">
          {merchantRows.map(row => <Bar key={row.label} label={row.label} amount={row.amount} max={maxMerchant}/>)}
        </div>
      </Card>

      <Card padding="p-4">
        <div className="text-[9px] uppercase tracking-[.12em] text-[var(--muted)] font-bold">Tendencia</div>
        <div className="text-[12px] font-semibold mt-1">Últimos 6 meses</div>
        <div className="mt-5 grid grid-cols-6 gap-2 items-end h-44">
          {monthRows.map(row => {
            const height = row.amount > 0 ? Math.max(8, Math.round(row.amount * 100 / maxMonth)) : 3
            return <div key={row.monthKey} className="h-full flex flex-col items-center justify-end gap-2">
              <div className="text-[8px] font-mono text-[var(--muted)]">{row.amount > 0 ? `$${Math.round(row.amount / 1000)}k` : '—'}</div>
              <div className="w-full max-w-9 rounded-t-lg bg-[var(--ink)]" style={{ height: `${height}%` }}/>
              <div className="text-[8.5px] text-[var(--muted)] capitalize">{monthLabel(row.monthKey)}</div>
            </div>
          })}
        </div>
      </Card>
    </div>

    <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] px-4 py-3 text-[9px] text-[var(--muted)]">
      Métrica de consumo: usa la fecha del movimiento y el monto efectivamente cargado. Las compras en cuotas aparecen por el cargo conciliado disponible; las transferencias entre tus cuentas no se consideran gasto.
    </div>
  </div>
}
