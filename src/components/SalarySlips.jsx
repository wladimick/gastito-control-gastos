import React, { useMemo } from 'react'
import { Card, Badge } from './ui'
import { fmtCLP } from '../lib/helpers'
import { addSalaryMonths, salaryForCashMonth, salaryPeriodKey, salaryStats } from '../lib/salaryModel'

function currentMonthKey() {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'America/Santiago' })
    .format(new Date()).slice(0, 7)
}

function monthLabel(key) {
  const [year, month] = String(key || '').split('-').map(Number)
  if (!year || !month) return key || 'Sin mes'
  const text = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)))
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function missingPeriods(slips) {
  const keys = (slips || []).map(salaryPeriodKey).filter(Boolean).sort()
  if (keys.length < 2) return []
  const set = new Set(keys)
  const result = []
  let cursor = keys[0]
  while (cursor < keys[keys.length - 1]) {
    cursor = addSalaryMonths(cursor, 1)
    if (cursor < keys[keys.length - 1] && !set.has(cursor)) result.push(cursor)
  }
  return result
}

function formatDate(value) {
  if (!value) return ''
  const text = String(value)
  return `${text.slice(8, 10)}/${text.slice(5, 7)}/${text.slice(0, 4)}`
}

function paymentEvidenceLabel(item) {
  if (item?.actualPaymentDate) return ` · abono confirmado ${formatDate(item.actualPaymentDate)}`
  if (item?.scheduledPaymentDate) return ` · abono planificado ${formatDate(item.scheduledPaymentDate)}`
  return ''
}

function Metric({ label, value, detail, tone = 'default' }) {
  const cls = tone === 'green' ? 'bg-emerald-50 border-emerald-100 text-emerald-950'
    : tone === 'blue' ? 'bg-blue-50 border-blue-100 text-blue-950'
      : 'bg-[var(--bg-elev)] border-[var(--line)] text-[var(--ink)]'
  return <div className={`rounded-2xl border p-3.5 min-h-[96px] ${cls}`}>
    <div className="text-[9px] uppercase tracking-[.12em] font-bold opacity-60">{label}</div>
    <div className="font-mono text-[18px] md:text-[21px] font-bold mt-2">{value}</div>
    <div className="text-[9px] opacity-65 mt-1 leading-relaxed">{detail}</div>
  </div>
}

export default function SalarySlips({ salarySlips = [] }) {
  const sorted = useMemo(() => [...salarySlips].sort((a, b) => salaryPeriodKey(b).localeCompare(salaryPeriodKey(a))), [salarySlips])
  const stats = useMemo(() => salaryStats(salarySlips), [salarySlips])
  const currentCash = currentMonthKey()
  const currentSalary = salaryForCashMonth(salarySlips, currentCash)
  const nextCash = addSalaryMonths(currentCash, 1)
  const nextSalary = salaryForCashMonth(salarySlips, nextCash)
  const missing = useMemo(() => missingPeriods(salarySlips), [salarySlips])

  return <div className="max-w-5xl mx-auto pb-20 flex flex-col gap-4">
    <div>
      <div className="text-[9.5px] uppercase tracking-[.13em] text-[var(--muted)] font-bold">Ingresos · Tibox</div>
      <h1 className="text-[21px] md:text-[22px] font-bold mt-1">Liquidaciones de sueldo</h1>
      <p className="text-[10px] text-[var(--muted)] mt-1 max-w-2xl">Gastito separa el período de la liquidación de la fecha bancaria en que realmente recibiste el dinero. Si aún no existe liquidación, la proyección usa el promedio de las últimas 3 disponibles.</p>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Metric label={`Sueldo pagado · ${monthLabel(currentCash)}`} value={fmtCLP(currentSalary.amount)} detail={currentSalary.mode === 'actual' ? `Corresponde a liquidación ${monthLabel(currentSalary.periodKey)}` : currentSalary.mode === 'no_payment' ? 'Sin abono en este mes' : 'Estimación móvil'} tone="green"/>
      <Metric label={`Próximo · ${monthLabel(nextCash)}`} value={fmtCLP(nextSalary.amount)} detail={nextSalary.mode === 'actual' ? `Liquidación ${monthLabel(nextSalary.periodKey)}` : `Estimado con ${nextSalary.sourceCount} liquidaciones`} tone="blue"/>
      <Metric label="Promedio cargado" value={fmtCLP(stats.average)} detail={`${stats.count} liquidaciones reales`}/>
      <Metric label="Rango líquido" value={`${fmtCLP(stats.minimum)} – ${fmtCLP(stats.maximum)}`} detail="Mínimo y máximo del historial cargado"/>
    </div>

    {missing.length > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] text-amber-900">
      <strong>Falta documentación:</strong> {missing.map(monthLabel).join(', ')}. Ese período no se inventa; queda ausente del historial y no se usa como valor real de liquidación.
    </div>}

    <Card padding="p-0" className="overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--line)]">
        <div className="text-[9px] uppercase tracking-[.11em] text-[var(--muted)] font-bold">Historial real</div>
        <div className="text-[12px] font-semibold mt-0.5">Líquido por período de liquidación</div>
      </div>
      <div className="divide-y divide-[var(--line)]">
        {sorted.map(item => <div key={item.id} className="px-4 py-3 grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11.5px] font-semibold">{monthLabel(salaryPeriodKey(item))}</span>
              <Badge tone="ok" className="!text-[8px] !px-1.5 !py-0.5">Real</Badge>
              {item.actualPaymentDate && <Badge tone="info" className="!text-[8px] !px-1.5 !py-0.5">Abono verificado</Badge>}
              {item.overtimeAmount > 0 && <Badge tone="info" className="!text-[8px] !px-1.5 !py-0.5">Horas extra {fmtCLP(item.overtimeAmount)}</Badge>}
            </div>
            <div className="text-[9px] text-[var(--muted)] mt-1">Haberes {fmtCLP(item.grossAmount)} · descuentos {fmtCLP(item.legalDeductions)} · base pagada {fmtCLP(item.baseSalaryPaid)}</div>
            <div className="text-[8.5px] text-[var(--muted)] mt-1">{item.sourceFile || 'Liquidación'}{paymentEvidenceLabel(item)}</div>
          </div>
          <div className="font-mono text-[15px] font-bold whitespace-nowrap">{fmtCLP(item.netAmount)}</div>
        </div>)}
        {!sorted.length && <div className="px-5 py-10 text-center text-[10px] text-[var(--muted)]">Aún no hay liquidaciones cargadas.</div>}
      </div>
    </Card>

    <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] px-4 py-3 text-[9.5px] text-[var(--muted)] leading-relaxed">
      <strong className="text-[var(--ink)]">Regla de flujo:</strong> si existe comprobante bancario, la fecha efectiva de abono manda. Solo cuando todavía no tenemos evidencia Gastito usa la fecha programada para planificar el ingreso.
    </div>
  </div>
}
