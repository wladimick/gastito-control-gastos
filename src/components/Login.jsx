import React, { useState } from 'react'
import { Icon } from '../lib/helpers'
import { signInWithMagicLink } from '../services/authService'

export default function Login() {
  const [email, setEmail]     = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await signInWithMagicLink(email)
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        <div className="mb-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-[var(--ink)] text-[var(--bg)] grid place-items-center mx-auto">
            <Icon name="wallet" size={22}/>
          </div>
          <div className="mt-4 font-semibold text-[20px] tracking-tight">Gastito</div>
          <div className="mt-1 text-[13px] text-[var(--muted)]">Control de gastos</div>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">
                Correo electrónico
              </label>
              <input
                type="email" required autoFocus
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="w-full h-11 px-3 bg-[var(--bg-elev)] border border-[var(--line)] rounded-lg text-[14px] focus:outline-none focus:border-[var(--ink)]"
              />
            </div>

            {error && (
              <div className="text-[12px] text-[#A02828] bg-[#FDECEC] rounded-md px-3 py-2">{error}</div>
            )}

            <button
              type="submit" disabled={loading || !email}
              className="h-11 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-[14px] font-medium disabled:opacity-50 flex items-center justify-center gap-2 transition">
              {loading
                ? <><Icon name="refresh" size={14}/> Enviando...</>
                : "Enviar enlace de acceso"}
            </button>

            <p className="text-center text-[12px] text-[var(--muted)]">
              Te enviamos un enlace mágico. Sin contraseña.
            </p>
          </form>
        ) : (
          <div className="text-center rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] p-6">
            <div className="w-10 h-10 rounded-full bg-[var(--accent-soft)] text-[var(--accent-ink)] grid place-items-center mx-auto">
              <Icon name="send" size={18}/>
            </div>
            <div className="mt-3 font-semibold tracking-tight">Revisa tu correo</div>
            <div className="mt-1.5 text-[13px] text-[var(--muted)] leading-snug">
              Enviamos un enlace a{" "}
              <span className="font-medium text-[var(--ink)]">{email}</span>.
              Haz clic en él para ingresar.
            </div>
            <button
              onClick={() => { setSent(false); setEmail("") }}
              className="mt-4 text-[12px] text-[var(--muted)] hover:text-[var(--ink)] underline transition">
              Usar otro correo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
