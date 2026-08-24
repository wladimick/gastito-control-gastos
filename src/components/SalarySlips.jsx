import React, { useMemo } from 'react'
import { Card, Badge } from './ui'
import { fmtCLP } from '../lib/helpers'
import { addSalaryMonths, salaryContributionStats, salaryForCashMonth, salaryPeriodKey, salaryStats } from '../lib/salaryModel'

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

export default function SalarySlips({ salarySlips = [], previsionalAccounts = [], afpContributions = [], afcContributions = [], afcSimulations = [] }) {
  const sorted = useMemo(() => [...salarySlips].sort((a, b) => salaryPeriodKey(b).localeCompare(salaryPeriodKey(a))), [salarySlips])
  const stats = useMemo(() => salaryStats(salarySlips), [salarySlips])
  const contributions = useMemo(() => salaryContributionStats(salarySlips), [salarySlips])
  const currentCash = currentMonthKey()
  const currentSalary = salaryForCashMonth(salarySlips, currentCash)
  const nextCash = addSalaryMonths(currentCash, 1)
  const nextSalary = salaryForCashMonth(salarySlips, nextCash)
  const missing = useMemo(() => missingPeriods(salarySlips), [salarySlips])
  const afp = previsionalAccounts.find(item => item.accountType === 'afp_mandatory')
  const afc = previsionalAccounts.find(item => item.accountType === 'afc_cic')
  const afpTotals = afpContributions.reduce((acc, item) => {
    acc.credited += Number(item.creditedAmount || 0)
    acc.units += Number(item.fundUnits || 0)
    acc.taxable += Number(item.taxableIncome || 0)
    return acc
  }, { credited: 0, units: 0, taxable: 0 })
  const afpRate = afpTotals.taxable > 0 ? (afpTotals.credited * 100 / afpTotals.taxable) : 0
  const afcTotals = afcContributions.reduce((acc, item) => {
    acc.worker += Number(item.workerContribution || 0)
    acc.employer += Number(item.employerPersonalContribution || 0)
    acc.total += Number(item.workerContribution || 0) + Number(item.employerPersonalContribution || 0)
    return acc
  }, { worker: 0, employer: 0, total: 0 })
  const cicSimulation = afcSimulations.find(item => item.fundingType === 'CIC')
  const fcsSimulation = afcSimulations.find(item => item.fundingType === 'FCS')

  return <div className="max-w-5xl mx-auto pb-20 flex flex-col gap-4">
    <div>
      <div className="text-[9.5px] uppercase tracking-[.13em] text-[var(--muted)] font-bold">Ingresos · Tibox</div>
      <h1 className="text-[21px] md:text-[22px] font-bold mt-1">Liquidaciones de sueldo</h1>
      <p className="text-[10px] text-[var(--muted)] mt-1 max-w-2xl">Aquí ves cuánto recibiste y cuándo llegó a tu cuenta. La proyección usa el promedio reciente solo si todavía no hay una liquidación real.</p>
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
      <details className="group">
        <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3">
          <div><div className="text-[9px] uppercase tracking-[.11em] text-[var(--muted)] font-bold">Patrimonio previsional</div><div className="text-[12px] font-semibold mt-0.5">Ver saldos y respaldo oficial</div></div>
          <span className="text-[13px] text-[var(--muted)] group-open:rotate-45 transition-transform">+</span>
        </summary>
        <div className="border-t border-[var(--line)] p-4">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <div className="text-[9px] uppercase tracking-[.11em] text-[var(--muted)] font-bold">Patrimonio previsional</div>
          <div className="text-[12px] font-semibold mt-0.5">Saldos y evidencia oficial</div>
        </div>
        <div className="text-[8.5px] text-[var(--muted)] text-right">AFP real · AFC por simulación</div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
        <Metric label="AFP UNO · obligatoria" value={fmtCLP(afp?.balance || 0)} detail={afp ? `Fondo ${afp.fundCode || '—'} ${afp.fundAllocationPercent || 0}% · ${afp.fundUnits || 0} cuotas` : 'Sin saldo registrado'} tone="blue"/>
        <Metric label="AFP acreditada · 12 meses" value={fmtCLP(afpTotals.credited)} detail={`${afpContributions.length} cotizaciones certificadas · ${afpTotals.units.toLocaleString('es-CL', { maximumFractionDigits: 2 })} cuotas · ${afpRate.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% de renta imponible`} tone="green"/>
        <Metric label="AFC · CIC implícita" value={fmtCLP(afc?.balance || 0)} detail="Derivada de simulación oficial · no cartola directa"/>
        <Metric label="AFC acreditado · 12 meses" value={fmtCLP(afcTotals.total)} detail={`Trabajador ${fmtCLP(afcTotals.worker)} · empleador CIC ${fmtCLP(afcTotals.employer)}`} tone="green"/>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[9px]">
        {afpContributions.length > 0 && <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] p-3">
          <div className="font-semibold">Certificado AFP UNO</div>
          <div className="text-[var(--muted)] mt-1">08/2025–07/2026 · Fondo B · {fmtCLP(afpTotals.credited)} acreditados.</div>
          <div className="text-[var(--muted)] mt-1">Gastito usa estos abonos certificados como fuente principal para aportes AFP del período.</div>
        </div>}
        {cicSimulation && <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] p-3">
          <div className="font-semibold">Simulación con CIC</div>
          <div className="text-[var(--muted)] mt-1">Beneficios {fmtCLP(cicSimulation.totalBenefit)} · aporte AFP asociado {fmtCLP(cicSimulation.totalAfpContribution)}.</div>
          <div className="text-[var(--muted)] mt-1">El último pago es residual; por eso Gastito usa el total como saldo CIC implícito, marcado como estimación.</div>
        </div>}
        {fcsSimulation && <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] p-3">
          <div className="font-semibold">Escenario Fondo Solidario</div>
          <div className="text-[var(--muted)] mt-1">Beneficios simulados {fmtCLP(fcsSimulation.totalBenefit)} · aporte AFP {fmtCLP(fcsSimulation.totalAfpContribution)}.</div>
          <div className="text-[var(--muted)] mt-1">Es cobertura condicional; no se contabiliza como patrimonio actual.</div>
        </div>}
      </div>
        </div>
      </details>
    </Card>

    <Card padding="p-0" className="overflow-hidden">
      <details className="group">
        <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3">
          <div><div className="text-[9px] uppercase tracking-[.11em] text-[var(--muted)] font-bold">Descuentos previsionales</div><div className="text-[12px] font-semibold mt-0.5">Ver cálculo desde liquidaciones</div></div>
          <span className="text-[13px] text-[var(--muted)] group-open:rotate-45 transition-transform">+</span>
        </summary>
        <div className="border-t border-[var(--line)] p-4">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <div className="text-[9px] uppercase tracking-[.11em] text-[var(--muted)] font-bold">Previsión desde liquidaciones</div>
          <div className="text-[12px] font-semibold mt-0.5">{contributions.months} liquidaciones con detalle previsional</div>
        </div>
        <div className="text-[8.5px] text-[var(--muted)] text-right">No reemplaza cartola AFP/AFC</div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
        <Metric label="Ahorro AFP trabajador" value={fmtCLP(contributions.afpWorkerSavings)} detail="10% estimado de base imponible · AFP UNO"/>
        <Metric label="Comisión AFP" value={fmtCLP(contributions.afpCommission)} detail="Diferencia hasta 10,46% descontado"/>
        <Metric label="Salud Fonasa" value={fmtCLP(contributions.health)} detail="Cotización salud acumulada"/>
        <Metric label="Cesantía descontada" value={fmtCLP(contributions.afcWorker)} detail="0,6% trabajador registrado en liquidaciones"/>
        <Metric label="CIC esperada documentada" value={fmtCLP(contributions.afcExpectedCic)} detail="0,6% trabajador + 1,6% empleador · sin rentabilidad"/>
        <Metric label="Fondo solidario" value={fmtCLP(contributions.afcEmployerFcs)} detail="0,8% empleador · no es saldo personal"/>
      </div>
        </div>
      </details>
    </Card>

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
            <div className="text-[9px] text-[var(--muted)] mt-1">{item.sourceFile || 'Liquidación'}{paymentEvidenceLabel(item)}</div>
            <details className="mt-2 text-[8.5px] text-[var(--muted)]"><summary className="cursor-pointer font-semibold underline">Ver desglose de haberes y descuentos</summary><div className="mt-2 leading-relaxed">Haberes {fmtCLP(item.grossAmount)} · descuentos {fmtCLP(item.legalDeductions)} · base pagada {fmtCLP(item.baseSalaryPaid)}<br/>{item.pensionProvider || 'AFP'} {item.pensionRatePercent ? `${item.pensionRatePercent}%` : ''} {fmtCLP(item.pensionAmount)} · {item.healthProvider || 'Salud'} {item.healthRatePercent ? `${item.healthRatePercent}%` : ''} {fmtCLP(item.healthAmount)} · AFC {fmtCLP(item.unemploymentAmount)}<br/>Base prev./salud {fmtCLP(item.pensionHealthBase || item.grossAmount)} · base cesantía {fmtCLP(item.unemploymentBase || item.grossAmount)}{item.ufValue ? ` · UF ${item.ufValue.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}</div></details>
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
