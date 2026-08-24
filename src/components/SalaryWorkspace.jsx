import React, { useEffect, useState } from 'react'
import SalarySlips from './SalarySlips'
import { fetchSalarySlips } from '../services/salaryService'
import { fetchAfcContributions, fetchAfcSimulations, fetchAfpContributions, fetchPrevisionalAccounts } from '../services/previsionalService'

export default function SalaryWorkspace() {
  const [salarySlips, setSalarySlips] = useState([])
  const [previsionalAccounts, setPrevisionalAccounts] = useState([])
  const [afpContributions, setAfpContributions] = useState([])
  const [afcContributions, setAfcContributions] = useState([])
  const [afcSimulations, setAfcSimulations] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const load = async () => {
    setLoading(true)
    setMessage('')
    try {
      const [slips, accounts, afpRows, afcRows, simulations] = await Promise.all([
        fetchSalarySlips(),
        fetchPrevisionalAccounts(),
        fetchAfpContributions(),
        fetchAfcContributions(),
        fetchAfcSimulations(),
      ])
      setSalarySlips(slips)
      setPrevisionalAccounts(accounts)
      setAfpContributions(afpRows)
      setAfcContributions(afcRows)
      setAfcSimulations(simulations)
    } catch (error) {
      setMessage(error?.message || 'No fue posible cargar sueldo y previsión.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading && !salarySlips.length) {
    return <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-elev)] p-8 text-center text-[10px] text-[var(--muted)]">Cargando liquidaciones…</div>
  }

  return <div className="space-y-3">
    <div className="flex justify-end">
      <button type="button" onClick={load} className="h-9 rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] px-3 text-[10px] font-semibold">
        {loading ? 'Actualizando…' : 'Actualizar'}
      </button>
    </div>
    {message && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] text-amber-900">{message}</div>}
    <SalarySlips
      salarySlips={salarySlips}
      previsionalAccounts={previsionalAccounts}
      afpContributions={afpContributions}
      afcContributions={afcContributions}
      afcSimulations={afcSimulations}
    />
  </div>
}
