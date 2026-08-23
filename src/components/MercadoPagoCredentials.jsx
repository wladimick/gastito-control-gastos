import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-slate-500'

export default function MercadoPagoCredentials() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [form, setForm] = useState({ publicKey: '', accessToken: '', clientId: '', clientSecret: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session || null); setReady(true) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => subscription.unsubscribe()
  }, [])

  const set = (key, value) => setForm(current => ({ ...current, [key]: value }))
  const valid = Object.values(form).every(value => String(value).trim())

  const save = async () => {
    if (!valid) return
    setSaving(true)
    setMessage('')
    try {
      const { error } = await supabase.rpc('save_mercadopago_credentials', {
        p_public_key: form.publicKey.trim(),
        p_access_token: form.accessToken.trim(),
        p_client_id: form.clientId.trim(),
        p_client_secret: form.clientSecret.trim(),
      })
      if (error) throw error
      setForm({ publicKey: '', accessToken: '', clientId: '', clientSecret: '' })
      setMessage('Credenciales guardadas de forma segura. Ya puedes volver a la administración de Mercado Pago y sincronizar.')
    } catch (error) {
      setMessage(error?.message || 'No fue posible guardar las credenciales.')
    } finally {
      setSaving(false)
    }
  }

  if (!ready) return <div className="min-h-screen grid place-items-center text-sm text-slate-500">Cargando…</div>
  if (!session) return <div className="min-h-screen bg-[#f7f6f2] grid place-items-center p-6"><div className="max-w-md w-full rounded-3xl border border-slate-200 bg-white p-6"><h1 className="text-xl font-bold">Mercado Pago · Credenciales</h1><p className="mt-2 text-sm text-slate-500">Primero inicia sesión en Gastito.</p><a href="/" className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Ir a Gastito</a></div></div>

  return <div className="min-h-screen bg-[#f7f6f2] p-4 md:p-8 text-slate-900">
    <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-5 md:p-7 shadow-sm">
      <div className="text-[11px] uppercase tracking-[.16em] font-bold text-slate-400">Gastito · Configuración segura</div>
      <h1 className="mt-1 text-2xl font-bold">Credenciales Mercado Pago</h1>
      <p className="mt-2 text-sm text-slate-500">Estos valores se envían por HTTPS directamente a Supabase y se guardan cifrados en Vault. No se guardan en el navegador ni en GitHub.</p>

      {message && <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div>}

      <div className="mt-5 space-y-4">
        <label className="block"><span className="text-xs font-semibold text-slate-600">Public Key</span><input autoComplete="off" value={form.publicKey} onChange={e => set('publicKey', e.target.value)} className={`${INPUT} mt-1.5`} placeholder="APP_USR-…"/></label>
        <label className="block"><span className="text-xs font-semibold text-slate-600">Access Token de producción</span><input type="password" autoComplete="off" value={form.accessToken} onChange={e => set('accessToken', e.target.value)} className={`${INPUT} mt-1.5`} placeholder="APP_USR-…"/></label>
        <label className="block"><span className="text-xs font-semibold text-slate-600">Client ID</span><input autoComplete="off" value={form.clientId} onChange={e => set('clientId', e.target.value)} className={`${INPUT} mt-1.5`} placeholder="Client ID"/></label>
        <label className="block"><span className="text-xs font-semibold text-slate-600">Client Secret</span><input type="password" autoComplete="off" value={form.clientSecret} onChange={e => set('clientSecret', e.target.value)} className={`${INPUT} mt-1.5`} placeholder="Client Secret"/></label>
      </div>

      <div className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
        <a href="/?mercadopago-admin=1" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-center">Volver</a>
        <button disabled={!valid || saving} onClick={save} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{saving ? 'Guardando…' : 'Guardar en Vault'}</button>
      </div>
    </div>
  </div>
}
