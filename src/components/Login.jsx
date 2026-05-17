import React, { useState } from 'react'
import { Icon } from '../lib/helpers'
import {
  signInWithPassword, signUp,
  sendPasswordReset, updatePassword, signInWithMagicLink,
} from '../services/authService'

function humanizeError(err) {
  const msg = err?.message ?? ''
  if (msg.includes('Invalid login credentials'))       return 'Email o contraseña incorrectos.'
  if (msg.includes('Email not confirmed'))             return 'Debes confirmar tu correo antes de ingresar. Revisa tu bandeja de entrada.'
  if (msg.includes('User already registered'))         return 'Ya existe una cuenta con este correo. Inicia sesión.'
  if (msg.includes('Password should be at least'))     return 'La contraseña debe tener al menos 6 caracteres.'
  if (msg.includes('Unable to validate email'))        return 'El formato del correo no es válido.'
  if (msg.includes('Signups not allowed'))             return 'El registro de nuevas cuentas no está habilitado.'
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Demasiados intentos. Espera unos minutos.'
  return msg || 'Error desconocido. Intenta de nuevo.'
}

function Logo() {
  return (
    <div className="mb-8 text-center">
      <div className="w-12 h-12 rounded-xl bg-[var(--ink)] text-[var(--bg)] grid place-items-center mx-auto">
        <Icon name="wallet" size={22}/>
      </div>
      <div className="mt-4 font-semibold text-[20px] tracking-tight">Gastito</div>
      <div className="mt-1 text-[13px] text-[var(--muted)]">Control de gastos</div>
    </div>
  )
}

// ── Pantalla: confirmar cuenta por correo ────────────────────────
function ConfirmScreen({ email, detail, onBack }) {
  return (
    <div className="text-center rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] p-6">
      <div className="w-10 h-10 rounded-full bg-[var(--accent-soft)] text-[var(--accent-ink)] grid place-items-center mx-auto">
        <Icon name="send" size={18}/>
      </div>
      <div className="mt-3 font-semibold tracking-tight">Revisa tu correo</div>
      <div className="mt-1.5 text-[13px] text-[var(--muted)] leading-snug">
        Enviamos un enlace a <span className="font-medium text-[var(--ink)]">{email}</span>.{' '}
        {detail}
      </div>
      <button onClick={onBack}
        className="mt-4 text-[12px] text-[var(--muted)] hover:text-[var(--ink)] underline transition">
        Volver al inicio de sesión
      </button>
    </div>
  )
}

// ── Componente exportado: formulario para elegir nueva contraseña ─
// Se muestra cuando App.jsx detecta evento PASSWORD_RECOVERY
export function NewPasswordForm({ onComplete }) {
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [done,     setDone]     = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    setLoading(true)
    setError(null)
    try {
      await updatePassword(password)
      setDone(true)
      setTimeout(onComplete, 1800)
    } catch (err) {
      setError(humanizeError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Logo/>
        {done ? (
          <div className="text-center rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] p-6">
            <div className="text-[28px] mb-2">✓</div>
            <div className="font-semibold tracking-tight">Contraseña guardada</div>
            <div className="text-[13px] text-[var(--muted)] mt-1.5">Ingresando a la app…</div>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <div className="font-semibold text-[15px] tracking-tight">Elige tu nueva contraseña</div>
              <div className="text-[13px] text-[var(--muted)] mt-1">
                Crea una contraseña segura para tu cuenta.
              </div>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">
                  Nueva contraseña
                </label>
                <input type="password" required autoFocus
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full h-11 px-3 bg-[var(--bg-elev)] border border-[var(--line)] rounded-lg text-[14px] focus:outline-none focus:border-[var(--ink)]"/>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">
                  Confirmar contraseña
                </label>
                <input type="password" required
                  value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-3 bg-[var(--bg-elev)] border border-[var(--line)] rounded-lg text-[14px] focus:outline-none focus:border-[var(--ink)]"/>
              </div>
              {error && (
                <div className="text-[12px] text-[#A02828] bg-[#FDECEC] rounded-md px-3 py-2.5">{error}</div>
              )}
              <button type="submit" disabled={loading || !password || !confirm}
                className="h-11 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-[14px] font-medium disabled:opacity-50 flex items-center justify-center gap-2 transition mt-1">
                {loading
                  ? <><Icon name="refresh" size={14}/> Guardando…</>
                  : 'Guardar contraseña'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────
export default function Login() {
  // mode: 'login' | 'register' | 'reset'
  const [mode,     setMode]     = useState('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const [sent,     setSent]     = useState(false)   // confirmación enviada (register o reset)
  const [sentType, setSentType] = useState(null)    // 'confirm' | 'reset' | 'magic'

  const switchMode = (m) => { setMode(m); setError(null); setConfirm(''); setSent(false) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (mode === 'register') {
      if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
      if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        await signInWithPassword(email, password)
        // onAuthStateChange en App.jsx toma el control
      } else if (mode === 'register') {
        const { session } = await signUp(email, password)
        if (!session) { setSentType('confirm'); setSent(true) }
      } else if (mode === 'reset') {
        await sendPasswordReset(email)
        setSentType('reset'); setSent(true)
      }
    } catch (err) {
      setError(humanizeError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleMagicLink = async () => {
    if (!email) { setError('Ingresa tu correo primero.'); return }
    setLoading(true)
    setError(null)
    try {
      await signInWithMagicLink(email)
      setSentType('magic'); setSent(true)
    } catch (err) {
      setError(humanizeError(err))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    const msgs = {
      confirm: 'Haz clic en el enlace para activar tu cuenta.',
      reset:   'Haz clic en el enlace para crear o cambiar tu contraseña.',
      magic:   'Haz clic en el enlace para ingresar sin contraseña.',
    }
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <Logo/>
          <ConfirmScreen
            email={email}
            detail={msgs[sentType]}
            onBack={() => { setSent(false); switchMode('login') }}
          />
        </div>
      </div>
    )
  }

  const isReset    = mode === 'reset'
  const isRegister = mode === 'register'
  const isLogin    = mode === 'login'

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <Logo/>

        {/* ── Modo reset: pantalla separada ── */}
        {isReset ? (
          <>
            <div className="mb-5">
              <div className="font-semibold text-[15px] tracking-tight">Restablecer contraseña</div>
              <div className="text-[13px] text-[var(--muted)] mt-1 leading-snug">
                Si entrabas con enlace mágico, usa esto para crear tu contraseña.
                Te enviaremos un enlace a tu correo.
              </div>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">
                  Correo electrónico
                </label>
                <input type="email" required autoFocus
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full h-11 px-3 bg-[var(--bg-elev)] border border-[var(--line)] rounded-lg text-[14px] focus:outline-none focus:border-[var(--ink)]"/>
              </div>
              {error && (
                <div className="text-[12px] text-[#A02828] bg-[#FDECEC] rounded-md px-3 py-2.5">{error}</div>
              )}
              <button type="submit" disabled={loading || !email}
                className="h-11 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-[14px] font-medium disabled:opacity-50 flex items-center justify-center gap-2 transition mt-1">
                {loading
                  ? <><Icon name="refresh" size={14}/> Enviando…</>
                  : 'Enviar enlace de restablecimiento'}
              </button>
            </form>
            <button onClick={() => switchMode('login')}
              className="mt-4 w-full text-center text-[12px] text-[var(--muted)] hover:text-[var(--ink)] transition">
              ← Volver al inicio de sesión
            </button>
          </>
        ) : (
          <>
            {/* ── Tabs login / register ── */}
            <div className="flex rounded-lg border border-[var(--line)] p-1 mb-5 bg-[var(--bg-elev)]">
              {[['login', 'Iniciar sesión'], ['register', 'Crear cuenta']].map(([m, label]) => (
                <button key={m} type="button" onClick={() => switchMode(m)}
                  className={`flex-1 h-8 rounded-md text-[13px] font-medium transition
                    ${mode === m ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">
                  Correo electrónico
                </label>
                <input type="email" required autoFocus
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="w-full h-11 px-3 bg-[var(--bg-elev)] border border-[var(--line)] rounded-lg text-[14px] focus:outline-none focus:border-[var(--ink)]"/>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">
                  Contraseña
                </label>
                <input type="password" required
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={isRegister ? 'Mínimo 6 caracteres' : '••••••••'}
                  className="w-full h-11 px-3 bg-[var(--bg-elev)] border border-[var(--line)] rounded-lg text-[14px] focus:outline-none focus:border-[var(--ink)]"/>
              </div>

              {isRegister && (
                <div>
                  <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">
                    Confirmar contraseña
                  </label>
                  <input type="password" required
                    value={confirm} onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 px-3 bg-[var(--bg-elev)] border border-[var(--line)] rounded-lg text-[14px] focus:outline-none focus:border-[var(--ink)]"/>
                </div>
              )}

              {error && (
                <div className="text-[12px] text-[#A02828] bg-[#FDECEC] rounded-md px-3 py-2.5 leading-snug">
                  {error}
                </div>
              )}

              <button type="submit"
                disabled={loading || !email || !password || (isRegister && !confirm)}
                className="h-11 rounded-lg bg-[var(--ink)] text-[var(--bg)] text-[14px] font-medium disabled:opacity-50 flex items-center justify-center gap-2 transition mt-1">
                {loading
                  ? <><Icon name="refresh" size={14}/> {isLogin ? 'Ingresando…' : 'Registrando…'}</>
                  : isLogin ? 'Ingresar' : 'Crear cuenta'}
              </button>
            </form>

            {/* ── Acciones secundarias (solo en modo login) ── */}
            {isLogin && (
              <div className="mt-5 flex flex-col gap-2 border-t border-[var(--line)] pt-4">
                <button onClick={() => switchMode('reset')}
                  className="text-[12px] text-[var(--muted)] hover:text-[var(--ink)] transition text-left">
                  ¿Olvidaste tu contraseña o nunca la creaste?{' '}
                  <span className="underline">Crear / restablecer contraseña</span>
                </button>
                <button onClick={handleMagicLink} disabled={loading}
                  className="text-[12px] text-[var(--muted)] hover:text-[var(--ink)] transition text-left disabled:opacity-50">
                  <span className="underline">Ingresar sin contraseña</span>
                  {' '}(enlace al correo)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
