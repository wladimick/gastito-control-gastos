import React, { useState, useEffect } from 'react'
import { Card, Badge } from './ui'
import { Icon, relDate, timeOnly } from '../lib/helpers'
import { generateLinkingCode, getLinkedAccount, unlinkAccount } from '../services/telegramService'
import { isConfigured } from '../lib/supabase'

function Cmd({ cmd, desc }) {
  return (
    <li className="py-2 flex items-center gap-3">
      <code className="font-mono text-[12px] px-2 py-1 rounded bg-[var(--bg)] border border-[var(--line)]">{cmd}</code>
      <span className="text-[var(--ink-2)]">{desc}</span>
    </li>
  )
}

export default function TelegramSettings({ botStatus, setBotStatus, lastBotMessage }) {
  const [linkedAccount,  setLinkedAccount]  = useState(null)
  const [linkCode,       setLinkCode]       = useState(null)
  const [loadingLink,    setLoadingLink]    = useState(false)
  const [generatingCode, setGeneratingCode] = useState(false)

  useEffect(() => {
    if (!isConfigured) return
    setLoadingLink(true)
    getLinkedAccount().then(acc => { setLinkedAccount(acc); setLoadingLink(false) })
  }, [])

  const handleGenerateCode = async () => {
    setGeneratingCode(true)
    try { setLinkCode(await generateLinkingCode()) }
    catch (e) { console.error(e) }
    finally { setGeneratingCode(false) }
  }

  const handleUnlink = async (id) => {
    if (!window.confirm('¿Desvincular esta cuenta de Telegram?')) return
    await unlinkAccount(id)
    setLinkedAccount(null)
    setLinkCode(null)
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-5">
      <div className="flex flex-col gap-5">

        {/* ── Vinculación de cuenta ───────────────────────────── */}
        {isConfigured && (
          <Card padding="p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold tracking-tight text-[15px]">Cuenta Telegram</div>
                <div className="text-[12.5px] text-[var(--muted)] mt-0.5">Vincula para registrar gastos desde el bot</div>
              </div>
              {linkedAccount && <Badge tone="ok">Vinculada</Badge>}
            </div>

            {loadingLink ? (
              <div className="mt-4 text-[12px] text-[var(--muted)]">Verificando vinculación…</div>
            ) : linkedAccount ? (
              <div className="mt-4 flex items-center justify-between rounded-lg bg-[var(--bg)] border border-[var(--line)] p-3.5">
                <div>
                  <div className="text-[13px] font-medium font-mono">
                    {linkedAccount.telegram_username ? `@${linkedAccount.telegram_username}` : 'Cuenta vinculada'}
                  </div>
                  <div className="text-[11px] text-[var(--muted)] mt-0.5 font-mono">
                    chat_id: {linkedAccount.chat_id}
                  </div>
                </div>
                <button
                  onClick={() => handleUnlink(linkedAccount.id)}
                  className="text-[12px] text-[#A02828] hover:underline shrink-0">
                  Desvincular
                </button>
              </div>
            ) : (
              <div className="mt-4">
                {linkCode ? (
                  <div className="rounded-lg bg-[var(--bg)] border border-[var(--line)] p-4 text-center">
                    <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] mb-2">
                      Código de vinculación
                    </div>
                    <div className="font-mono text-[38px] tracking-[0.2em] font-bold text-[var(--ink)] leading-none">
                      {linkCode}
                    </div>
                    <div className="mt-3 text-[12px] text-[var(--muted)]">Escribe en Telegram:</div>
                    <div className="mt-1 font-mono text-[13px] bg-[var(--hover)] rounded-md px-3 py-1.5 inline-block">
                      /vincular {linkCode}
                    </div>
                    <div className="mt-2 text-[11px] text-[var(--muted)]">Válido por 15 minutos</div>
                    <button
                      onClick={handleGenerateCode}
                      className="mt-3 text-[11px] text-[var(--muted)] hover:text-[var(--ink)] underline">
                      Generar nuevo código
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleGenerateCode}
                    disabled={generatingCode}
                    className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[13px] font-medium disabled:opacity-50">
                    <Icon name="link" size={14}/>
                    {generatingCode ? 'Generando…' : 'Generar código de vinculación'}
                  </button>
                )}
              </div>
            )}
          </Card>
        )}

        {/* ── Estado del bot ──────────────────────────────────── */}
        <Card padding="p-5 md:p-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-lg grid place-items-center text-white ${botStatus === 'online' ? 'bg-[var(--accent)]' : 'bg-[var(--muted)]'}`}>
                <Icon name="bot" size={22}/>
              </div>
              <div>
                <div className="font-semibold tracking-tight text-[16px]">@gastito_bot</div>
                <div className="text-[12.5px] text-[var(--muted)] flex items-center gap-2 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${botStatus === 'online' ? 'bg-[var(--accent)]' : 'bg-[var(--muted)]'}`}/>
                  {botStatus === 'online' ? 'Conectado · webhook activo' : 'Desconectado'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={botStatus === 'online' ? 'ok' : 'warn'}>
                {botStatus === 'online' ? 'Activo' : 'Inactivo'}
              </Badge>
              <button
                onClick={() => setBotStatus(botStatus === 'online' ? 'offline' : 'online')}
                className={`h-9 px-4 rounded-md text-[13px] font-medium ${botStatus === 'online' ? 'border border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--hover)]' : 'bg-[var(--accent)] text-white hover:opacity-90'}`}>
                {botStatus === 'online' ? 'Desactivar bot' : 'Activar bot'}
              </button>
            </div>
          </div>
        </Card>

        {/* ── Configuración (Edge Functions) ──────────────────── */}
        <Card padding="p-5 md:p-6">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--hover)] grid place-items-center shrink-0 mt-0.5">
              <Icon name="info" size={17}/>
            </div>
            <div>
              <div className="font-semibold tracking-tight text-[15px]">Configuración del bot</div>
              <div className="mt-1.5 text-[13px] text-[var(--ink-2)] leading-relaxed">
                El token del bot y la URL del webhook se configuran directamente en <strong>Supabase Edge Functions</strong>, no en el frontend.
              </div>
              <div className="mt-3 flex flex-col gap-2 text-[12.5px] text-[var(--muted)]">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-[var(--accent-ink)]">✓</span>
                  <span>El secreto <code className="font-mono text-[11.5px] px-1.5 py-0.5 rounded bg-[var(--bg)] border border-[var(--line)]">TELEGRAM_BOT_TOKEN</code> vive en los secrets de Supabase, nunca en el cliente.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-[var(--accent-ink)]">✓</span>
                  <span>El webhook apunta a tu Edge Function de Supabase y se registra desde el backend.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-[var(--accent-ink)]">✓</span>
                  <span>Para cambiar el token o el webhook, usa el panel de Supabase o el CLI.</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* ── Última actividad ────────────────────────────────── */}
        <Card padding="p-5">
          <div className="font-semibold tracking-tight">Última actividad</div>
          <div className="mt-4">
            {lastBotMessage ? (
              <div className="rounded-lg bg-[var(--bg)] border border-[var(--line)] p-3.5">
                <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] inline-flex items-center gap-1.5">
                  <Icon name="message" size={12}/> Último mensaje recibido
                </div>
                <div className="mt-2 text-[13.5px] leading-snug">"{lastBotMessage.text}"</div>
                <div className="mt-2 text-[11px] text-[var(--muted)] font-mono">
                  {relDate(lastBotMessage.at)} · {timeOnly(lastBotMessage.at)}
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-[var(--bg)] border border-[var(--line)] p-4 text-center">
                <div className="text-[28px] mb-2">💬</div>
                <div className="text-[13px] font-medium">Sin actividad reciente</div>
                <div className="text-[12px] text-[var(--muted)] mt-1">
                  Los mensajes del bot aparecerán aquí cuando el bot empiece a recibir mensajes.
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-5">
        <Card padding="p-5">
          <div className="font-semibold tracking-tight">¿Cómo le hablo al bot?</div>
          <div className="text-[12.5px] text-[var(--muted)] mt-1">
            El bot entiende lenguaje natural. Estos formatos funcionan bien:
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {[
              'Gasté 12.500 en bencina hoy con crédito Banco Chile',
              'Gasté 8.990 en supermercado ayer con débito',
              '45.000 comida viernes crédito Banco Estado',
              '19.990 farmacia débito Santander',
            ].map((s, i) => (
              <div key={i} className="text-[12.5px] rounded-md bg-[var(--bg)] border border-[var(--line)] px-3 py-2 font-mono">
                {s}
              </div>
            ))}
          </div>
        </Card>

        <Card padding="p-5">
          <div className="flex items-center justify-between">
            <div className="font-semibold tracking-tight">Comandos</div>
            <Badge tone="muted">5</Badge>
          </div>
          <ul className="mt-3 flex flex-col text-[13px] divide-y divide-[var(--line)]">
            <Cmd cmd="/start"      desc="Iniciar el bot y vincular cuenta"/>
            <Cmd cmd="/hoy"        desc="Resumen del día"/>
            <Cmd cmd="/mes"        desc="Resumen del mes"/>
            <Cmd cmd="/categorias" desc="Listado de categorías"/>
            <Cmd cmd="/ayuda"      desc="Ver formatos aceptados"/>
          </ul>
        </Card>
      </div>
    </div>
  )
}
