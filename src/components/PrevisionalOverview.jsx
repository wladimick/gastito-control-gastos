import React, { useEffect, useMemo, useState } from 'react'
import { Card } from './ui'
import { fmtCLP } from '../lib/helpers'
import { fetchAfcContributions, fetchAfcSimulations, fetchAfpContributions, fetchPrevisionalAccounts } from '../services/previsionalService'

function Metric({ label, value, detail, tone = 'default' }) {
  const cls = tone === 'blue' ? 'bg-blue-50 border-blue-100 text-blue-950'
    : tone === 'green' ? 'bg-emerald-50 border-emerald-100 text-emerald-950'
      : 'bg-[var(--bg-elev)] border-[var(--line)]'
  return <div className={`rounded-2xl border p-3.5 min-h-[98px] ${cls}`}>
    <div className="text-[9px] uppercase tracking-[.12em] font-bold opacity-60">{label}</div>
    <div className="font-mono text-[18px] md:text-[21px] font-bold mt-2">{value}</div>
    <div className="text-[9px] opacity-65 mt-1 leading-relaxed">{detail}</div>
  </div>
}

export default function PrevisionalOverview({ setView }) {
  const [accounts, setAccounts] = useState([])
  const [afpRows, setAfpRows] = useState([])
  const [afcRows, setAfcRows] = useState([])
  const [simulations, setSimulations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchPrevisionalAccounts(), fetchAfpContributions(), fetchAfcContributions(), fetchAfcSimulations()])
      .then(([a, p, c, s]) => { setAccounts(a || []); setAfpRows(p || []); setAfcRows(c || []); setSimulations(s || []) })
      .finally(() => setLoading(false))
  }, [])

  const afp = accounts.find(item => item.accountType === 'afp_mandatory')
  const afc = accounts.find(item => item.accountType === 'afc_cic')
  const total = Number(afp?.balance || 0) + Number(afc?.balance || 0)
  const afp12 = useMemo(() => afpRows.reduce((sum, row) => sum + Number(row.creditedAmount || 0), 0), [afpRows])
  const afc12 = useMemo(() => afcRows.reduce((sum, row) => sum + Number(row.workerContribution || 0) + Number(row.employerPersonalContribution || 0), 0), [afcRows])
  const latestAfp = afpRows[afpRows.length - 1]
  const cic = simulations.find(item => item.fundingType === 'CIC')

  if (loading && !accounts.length) return <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-8 text-center text-[10px] text-[var(--muted)]">Cargando patrimonio previsional…</div>

  return <div className="max-w-5xl mx-auto space-y-4 pb-20">
    <div>
      <div className="text-[9.5px] uppercase tracking-[.13em] text-[var(--muted)] font-bold">Patrimonio</div>
      <h2 className="text-[21px] md:text-[24px] font-bold mt-1">Previsión</h2>
      <p className="text-[10px] text-[var(--muted)] mt-1">Este patrimonio no está disponible para pagar gastos hoy. AFP es saldo real; AFC queda marcada como estimación cuando proviene de simulación.</p>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      <Metric label="Patrimonio previsional" value={fmtCLP(total)} detail="AFP real + CIC implícita"/>
      <Metric label="AFP UNO" value={fmtCLP(afp?.balance || 0)} detail={`Fondo ${afp?.fundCode || '—'} · ${afp?.fundUnits || 0} cuotas`} tone="blue"/>
      <Metric label="AFC · CIC" value={fmtCLP(afc?.balance || 0)} detail="Implícita por simulación oficial"/>
    </div>

    <div className="grid md:grid-cols-2 gap-3">
      <Card padding="p-4">
        <div className="text-[9px] uppercase tracking-[.12em] text-[var(--muted)] font-bold">AFP UNO · Cuenta obligatoria</div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <div className="font-mono text-[22px] font-bold">{fmtCLP(afp?.balance || 0)}</div>
            <div className="text-[9px] text-[var(--muted)] mt-1">Saldo real al {afp?.asOfDate || '—'}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold">Fondo {afp?.fundCode || '—'} · {afp?.fundAllocationPercent || 0}%</div>
            <div className="text-[9px] text-[var(--muted)] mt-1">{afp?.fundUnits || 0} cuotas acumuladas</div>
          </div>
        </div>
      </Card>

      <Card padding="p-4">
        <div className="text-[9px] uppercase tracking-[.12em] text-[var(--muted)] font-bold">Seguro de Cesantía</div>
        <div className="mt-3 font-mono text-[22px] font-bold">{fmtCLP(afc?.balance || 0)}</div>
        <div className="text-[9px] text-[var(--muted)] mt-1">Saldo CIC implícito; no es cartola directa.</div>
      </Card>
    </div>

    <details className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] group">
      <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-3 text-[11px] font-semibold"><span>Ver aportes y respaldo</span><span className="text-[13px] text-[var(--muted)] group-open:rotate-45 transition-transform">+</span></summary>
      <div className="border-t border-[var(--line)] p-3 grid grid-cols-2 gap-3">
        <Metric label="Aportes 12 meses" value={fmtCLP(afp12 + afc12)} detail={`AFP ${fmtCLP(afp12)} · AFC ${fmtCLP(afc12)}`} tone="green"/>
        <Metric label="Simulación CIC" value={fmtCLP(cic?.totalBenefit || 0)} detail="Referencia oficial; no es una cartola directa"/>
        {latestAfp && <div className="col-span-2 rounded-xl bg-[var(--hover)] p-3 text-[9px] text-[var(--muted)]">Último aporte certificado: {fmtCLP(latestAfp.creditedAmount)} · {latestAfp.fundUnits} cuotas · valor cuota {fmtCLP(latestAfp.unitValue)}.</div>}
      </div>
    </details>

    <div className="flex justify-end">
      <button type="button" onClick={() => setView?.('salary')} className="h-9 rounded-xl bg-[var(--ink)] text-[var(--bg)] px-3 text-[10px] font-semibold">Ver liquidaciones y detalle</button>
    </div>
  </div>
}
