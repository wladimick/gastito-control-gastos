import React, { useEffect, useMemo, useState } from 'react'
import { Card } from './ui'
import { fmtCLP } from '../lib/helpers'
import { fetchSalarySlips } from '../services/salaryService'
import { fetchAfcContributions, fetchPrevisionalAccounts } from '../services/previsionalService'
import { salaryPeriodKey } from '../lib/salaryModel'

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}T12:00:00Z`))
}

function monthLabel(key) {
  const [year, month] = String(key || '').split('-').map(Number)
  if (!year || !month) return '—'
  const text = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)))
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function tenure(start) {
  if (!start) return '—'
  const from = new Date(`${start}T12:00:00Z`)
  const now = new Date()
  let months = (now.getUTCFullYear() - from.getUTCFullYear()) * 12 + now.getUTCMonth() - from.getUTCMonth()
  months = Math.max(0, months)
  const years = Math.floor(months / 12)
  const rest = months % 12
  return `${years} años${rest ? ` · ${rest} meses` : ''}`
}

function Metric({ label, value, detail }) {
  return <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-3.5 min-h-[96px]">
    <div className="text-[9px] uppercase tracking-[.12em] font-bold text-[var(--muted)]">{label}</div>
    <div className="mt-2 font-mono text-[18px] md:text-[21px] font-bold">{value}</div>
    <div className="mt-1 text-[9px] leading-relaxed text-[var(--muted)]">{detail}</div>
  </div>
}

export default function EmploymentProfile() {
  const [slips, setSlips] = useState([])
  const [afcRows, setAfcRows] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchSalarySlips(), fetchAfcContributions(), fetchPrevisionalAccounts()])
      .then(([salary, afc, previsional]) => {
        setSlips(salary || [])
        setAfcRows(afc || [])
        setAccounts(previsional || [])
      })
      .finally(() => setLoading(false))
  }, [])

  const sorted = useMemo(() => [...slips].sort((a, b) => salaryPeriodKey(b).localeCompare(salaryPeriodKey(a))), [slips])
  const latest = sorted[0] || null
  const recent3 = sorted.slice(0, 3)
  const averageNet = recent3.length ? Math.round(recent3.reduce((sum, item) => sum + Number(item.netAmount || 0), 0) / recent3.length) : 0
  const averageGross = recent3.length ? Math.round(recent3.reduce((sum, item) => sum + Number(item.grossAmount || 0), 0) / recent3.length) : 0
  const latestAfc = [...afcRows].sort((a, b) => String(b.periodMonth).localeCompare(String(a.periodMonth)))[0]
  const afp = accounts.find(item => item.accountType === 'afp_mandatory')
  const afc = accounts.find(item => item.accountType === 'afc_cic')

  if (loading && !latest) return <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-8 text-center text-[10px] text-[var(--muted)]">Cargando perfil laboral…</div>

  return <div className="max-w-5xl mx-auto space-y-4 pb-20">
    <div>
      <div className="text-[9.5px] uppercase tracking-[.13em] text-[var(--muted)] font-bold">Trabajo</div>
      <h2 className="text-[21px] md:text-[24px] font-bold mt-1">Perfil laboral</h2>
      <p className="text-[10px] text-[var(--muted)] mt-1">Resumen del empleador, contrato, remuneración y protección previsional a partir de tus liquidaciones y certificados.</p>
    </div>

    <Card padding="p-4">
      <div className="grid md:grid-cols-[1.5fr_1fr] gap-4">
        <div>
          <div className="text-[9px] uppercase tracking-[.12em] text-[var(--muted)] font-bold">Empleador actual</div>
          <div className="text-[18px] md:text-[22px] font-bold mt-2 leading-tight">{latest?.employer || latestAfc?.employer || 'Sin empleador registrado'}</div>
          <div className="text-[10px] text-[var(--muted)] mt-1">RUT {latestAfc?.employerRut || '—'}</div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-[10px]">
            <div><div className="text-[8.5px] uppercase tracking-[.1em] text-[var(--muted)]">Cargo</div><div className="font-semibold mt-1">{latest?.positionTitle || '—'}</div></div>
            <div><div className="text-[8.5px] uppercase tracking-[.1em] text-[var(--muted)]">Contrato</div><div className="font-semibold mt-1">{latest?.contractType || '—'}</div></div>
            <div><div className="text-[8.5px] uppercase tracking-[.1em] text-[var(--muted)]">Inicio</div><div className="font-semibold mt-1">{formatDate(latest?.contractStartDate)}</div></div>
            <div><div className="text-[8.5px] uppercase tracking-[.1em] text-[var(--muted)]">Antigüedad</div><div className="font-semibold mt-1">{tenure(latest?.contractStartDate)}</div></div>
          </div>
        </div>
        <div className="rounded-2xl bg-slate-950 text-white p-4">
          <div className="text-[9px] uppercase tracking-[.12em] text-white/50 font-bold">Sueldo base contrato</div>
          <div className="font-mono text-[24px] font-bold mt-2">{fmtCLP(latest?.baseSalaryContract || 0)}</div>
          <div className="text-[9px] text-white/55 mt-2">Última liquidación: {monthLabel(salaryPeriodKey(latest))}</div>
          <div className="text-[9px] text-white/55">Líquido {fmtCLP(latest?.netAmount || 0)}</div>
        </div>
      </div>
    </Card>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Metric label="Promedio líquido · 3 meses" value={fmtCLP(averageNet)} detail="Promedio móvil usado para planificación"/>
      <Metric label="Promedio imponible · 3 meses" value={fmtCLP(averageGross)} detail="Base de haberes recientes"/>
      <Metric label="Última AFP descontada" value={fmtCLP(latest?.pensionAmount || 0)} detail={`${latest?.pensionProvider || 'AFP'} · ${latest?.pensionRatePercent || 0}%`}/>
      <Metric label="Última salud + AFC" value={fmtCLP((latest?.healthAmount || 0) + (latest?.unemploymentAmount || 0))} detail={`${latest?.healthProvider || 'Salud'} ${fmtCLP(latest?.healthAmount || 0)} · AFC ${fmtCLP(latest?.unemploymentAmount || 0)}`}/>
    </div>

    <Card padding="p-4">
      <div className="text-[9px] uppercase tracking-[.12em] text-[var(--muted)] font-bold">Protección acumulada</div>
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px]">
        <div><div className="text-[var(--muted)]">AFP UNO</div><div className="font-mono text-[16px] font-bold mt-1">{fmtCLP(afp?.balance || 0)}</div><div className="text-[8.5px] text-[var(--muted)]">Cuenta obligatoria</div></div>
        <div><div className="text-[var(--muted)]">Fondo AFP</div><div className="font-mono text-[16px] font-bold mt-1">{afp?.fundCode || '—'}</div><div className="text-[8.5px] text-[var(--muted)]">{afp?.fundAllocationPercent || 0}% asignado</div></div>
        <div><div className="text-[var(--muted)]">AFC · CIC</div><div className="font-mono text-[16px] font-bold mt-1">{fmtCLP(afc?.balance || 0)}</div><div className="text-[8.5px] text-[var(--muted)]">Saldo implícito por simulación</div></div>
        <div><div className="text-[var(--muted)]">Liquidaciones cargadas</div><div className="font-mono text-[16px] font-bold mt-1">{slips.length}</div><div className="text-[8.5px] text-[var(--muted)]">Historial estructurado</div></div>
      </div>
    </Card>
  </div>
}
