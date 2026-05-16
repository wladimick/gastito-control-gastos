import React, { useState } from 'react'
import { Card, Badge } from './ui'
import { Icon, relDate, timeOnly } from '../lib/helpers'

function CfgField({ label, hint, children, colSpan }) {
  return (
    <div className={colSpan ? "md:col-span-2" : ""}>
      <label className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">{label}</label>
      {children}
      {hint && <div className="text-[11px] text-[var(--muted)] mt-1.5">{hint}</div>}
    </div>
  );
}

function Cmd({ cmd, desc }) {
  return (
    <li className="py-2 flex items-center gap-3">
      <code className="font-mono text-[12px] px-2 py-1 rounded bg-[var(--bg)] border border-[var(--line)]">{cmd}</code>
      <span className="text-[var(--ink-2)]">{desc}</span>
    </li>
  );
}

export default function TelegramSettings({ botStatus, setBotStatus, lastBotMessage }) {
  const [cfg, setCfg] = useState({
    token: "8123456789:AAFkj-_x9Y2hLqWzpQmnVtKxBpRsTuVwXyz",
    webhook: "https://api.gastito.app/telegram/webhook",
    chatId: "284516732",
    timezone: "America/Santiago",
    currency: "CLP",
  });
  const [showToken, setShowToken] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saved, setSaved] = useState(false);

  const testConnection = () => {
    setTestingConn(true);
    setTestResult(null);
    setTimeout(() => {
      setTestingConn(false);
      setTestResult({ ok: true, latency: 187, username: "@gastito_bot" });
    }, 1200);
  };

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-5">
      <div className="flex flex-col gap-5">
        <Card padding="p-5 md:p-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-lg grid place-items-center text-white ${botStatus === "online" ? "bg-[var(--accent)]" : "bg-[var(--muted)]"}`}>
                <Icon name="bot" size={22}/>
              </div>
              <div>
                <div className="font-semibold tracking-tight text-[16px]">@gastito_bot</div>
                <div className="text-[12.5px] text-[var(--muted)] flex items-center gap-2 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${botStatus === "online" ? "bg-[var(--accent)]" : "bg-[var(--muted)]"}`}></span>
                  {botStatus === "online" ? "Conectado · webhook activo" : "Desconectado"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={botStatus === "online" ? "ok" : "warn"}>
                {botStatus === "online" ? "Activo" : "Inactivo"}
              </Badge>
              <button
                onClick={() => setBotStatus(botStatus === "online" ? "offline" : "online")}
                className={`h-9 px-4 rounded-md text-[13px] font-medium ${botStatus === "online" ? "border border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--hover)]" : "bg-[var(--accent)] text-white hover:opacity-90"}`}>
                {botStatus === "online" ? "Desactivar bot" : "Activar bot"}
              </button>
            </div>
          </div>
        </Card>

        <Card padding="p-5 md:p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="font-semibold tracking-tight text-[15px]">Configuración</div>
              <div className="text-[12.5px] text-[var(--muted)] mt-0.5">Credenciales y endpoints del bot</div>
            </div>
            {saved && <Badge tone="ok">✓ Guardado</Badge>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
            <CfgField label="Token del bot" hint="Generado en @BotFather">
              <div className="flex gap-1.5">
                <input type={showToken ? "text" : "password"} value={cfg.token}
                  onChange={e => setCfg({ ...cfg, token: e.target.value })}
                  className="flex-1 h-10 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] font-mono focus:outline-none focus:border-[var(--ink)]"/>
                <button onClick={() => setShowToken(s => !s)}
                  className="h-10 px-3 border border-[var(--line)] rounded-md text-[12px] text-[var(--muted)] hover:bg-[var(--hover)]">
                  {showToken ? "Ocultar" : "Ver"}
                </button>
              </div>
            </CfgField>

            <CfgField label="ID de Telegram autorizado" hint="Solo este chat puede registrar gastos">
              <input value={cfg.chatId} onChange={e => setCfg({ ...cfg, chatId: e.target.value })}
                className="w-full h-10 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] font-mono focus:outline-none focus:border-[var(--ink)]"/>
            </CfgField>

            <CfgField label="Webhook URL" hint="POST de los mensajes" colSpan>
              <div className="flex gap-1.5">
                <input value={cfg.webhook} onChange={e => setCfg({ ...cfg, webhook: e.target.value })}
                  className="flex-1 h-10 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] font-mono focus:outline-none focus:border-[var(--ink)]"/>
                <button className="h-10 px-3 inline-flex items-center gap-1.5 border border-[var(--line)] rounded-md text-[12px] text-[var(--ink-2)] hover:bg-[var(--hover)]">
                  <Icon name="refresh" size={13}/> Actualizar
                </button>
              </div>
            </CfgField>

            <CfgField label="Zona horaria">
              <select value={cfg.timezone} onChange={e => setCfg({ ...cfg, timezone: e.target.value })}
                className="w-full h-10 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]">
                <option>America/Santiago</option>
                <option>America/Buenos_Aires</option>
                <option>America/Lima</option>
                <option>America/Mexico_City</option>
              </select>
            </CfgField>

            <CfgField label="Moneda">
              <select value={cfg.currency} onChange={e => setCfg({ ...cfg, currency: e.target.value })}
                className="w-full h-10 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]">
                <option value="CLP">CLP — Peso chileno</option>
                <option value="ARS">ARS — Peso argentino</option>
                <option value="USD">USD — Dólar</option>
                <option value="MXN">MXN — Peso mexicano</option>
              </select>
            </CfgField>
          </div>

          <div className="mt-6 pt-5 border-t border-[var(--line)] flex items-center justify-between flex-wrap gap-3">
            <button
              onClick={testConnection}
              disabled={testingConn}
              className="h-10 px-4 inline-flex items-center gap-2 border border-[var(--line)] rounded-md text-[13px] text-[var(--ink-2)] hover:bg-[var(--hover)] disabled:opacity-60">
              <Icon name={testingConn ? "refresh" : "link"} size={14}/>
              {testingConn ? "Probando..." : "Probar conexión"}
            </button>
            {testResult && (
              <div className="text-[12px] text-[var(--accent-ink)] inline-flex items-center gap-1.5">
                <Icon name="check" size={13}/> Conectado a {testResult.username} · {testResult.latency}ms
              </div>
            )}
            <button onClick={save} className="h-10 px-5 ml-auto bg-[var(--ink)] text-[var(--bg)] rounded-md text-[13px] font-medium inline-flex items-center gap-2">
              <Icon name="check" size={14}/> Guardar configuración
            </button>
          </div>
        </Card>

        <Card padding="p-5">
          <div className="font-semibold tracking-tight">Última actividad</div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg bg-[var(--bg)] border border-[var(--line)] p-3.5">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] inline-flex items-center gap-1.5">
                <Icon name="message" size={12}/> Último mensaje recibido
              </div>
              <div className="mt-2 text-[13.5px] leading-snug">"{lastBotMessage?.text}"</div>
              <div className="mt-2 text-[11px] text-[var(--muted)] font-mono">
                {lastBotMessage ? `${relDate(lastBotMessage.at)} · ${timeOnly(lastBotMessage.at)}` : "—"}
              </div>
            </div>
            <div className="rounded-lg bg-[var(--bg)] border border-[var(--line)] p-3.5">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] inline-flex items-center gap-1.5">
                <Icon name="send" size={12}/> Última respuesta enviada
              </div>
              <div className="mt-2 text-[13.5px] leading-snug">"🤔 No entendí. ¿Me das el monto y la categoría?"</div>
              <div className="mt-2 text-[11px] text-[var(--muted)] font-mono">Hoy · 19:12</div>
            </div>
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
              "Gasté 12.500 en bencina hoy con crédito Banco Chile",
              "Gasté 8.990 en supermercado ayer con débito",
              "45.000 comida viernes crédito Banco Estado",
              "19.990 farmacia débito Santander",
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
  );
}
