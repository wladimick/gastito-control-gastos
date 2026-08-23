import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchSalarySlips } from '../services/salaryService'
import SalarySlips from './SalarySlips'

export default function SalarySlipsPage() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [salarySlips, setSalarySlips] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session || null); setAuthReady(true) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    setLoading(true)
    fetchSalarySlips()
      .then(setSalarySlips)
      .catch(error => setMessage(error?.message || 'No fue posible cargar las liquidaciones.'))
      .finally(() => setLoading(false))
  }, [session])

  if (!authReady) return <div className="min-h-screen grid place-items-center text-[11px] text-slate-500">Cargando…</div>
  if (!session) return <div className="min-h-screen bg-[#f7f6f2] grid place-items-center p-5"><div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-5"><h1 className="text-[18px] font-bold">Liquidaciones de sueldo</h1><p className="mt-3 text-[11px] text-slate-500">Primero inicia sesión en Gastito.</p><a href="/" className="mt-4 inline-flex rounded-xl bg-slate-900 px-3 py-2 text-[10px] font-semibold text-white">Ir a Gastito</a></div></div>

  return <div className="min-h-screen bg-[#f7f6f2] text-slate-900">
    <div className="mx-auto max-w-5xl p-4 md:p-7 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <a href="/" className="h-9 inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-semibold">Volver a Gastito</a>
        <button onClick={() => { setLoading(true); fetchSalarySlips().then(setSalarySlips).catch(error => setMessage(error?.message || 'No fue posible actualizar.')).finally(() => setLoading(false)) }} className="h-9 rounded-xl bg-slate-900 px-3 text-[10px] font-semibold text-white">{loading ? 'Actualizando…' : 'Actualizar'}</button>
      </div>
      {message && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[10px] text-amber-900">{message}</div>}
      {loading && !salarySlips.length ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-[10px] text-slate-500">Cargando liquidaciones…</div> : <SalarySlips salarySlips={salarySlips}/>} 
    </div>
  </div>
}
