/* Telegram Bot settings */

function TelegramSettings({ botOn, setBotOn }) {
  const [reveal, setReveal] = React.useState(false);
  const [config, setConfig] = React.useState({
    token: "78231****:AAH-mQ_xR8jL2nWp9YkCv3FbN6sT1uVxYzA",
    webhook: "https://control-gastos.app/webhook/telegram",
    chatId: "284716392",
    tz: "America/Santiago",
    currency: "CLP",
    autoCategorize: true,
    allowManual: false,
  });
  const [testing, setTesting] = React.useState("idle");

  const testConnection = () => {
    setTesting("loading");
    setTimeout(() => setTesting("ok"), 900);
    setTimeout(() => setTesting("idle"), 3000);
  };

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="page-h">
        <div>
          <h1>Bot de Telegram</h1>
          <p>Configura la conexión, webhook y comportamiento del bot</p>
        </div>
        <div className="right">
          <span className={"badge " + (botOn ? "success" : "danger")}>
            <span className={"dot " + (botOn ? "on" : "off")}></span>
            {botOn ? "Conectado" : "Desconectado"}
          </span>
          <button className={"btn " + (botOn ? "" : "primary")} onClick={() => setBotOn(!botOn)}>
            <Icon name="power" size={14}/> {botOn ? "Desactivar" : "Activar bot"}
          </button>
        </div>
      </div>

      <div className="grid g-3">
        <div style={{ gridColumn: "span 2" }} className="col">
          <div className="card">
            <div className="card-h">
              <div>
                <div className="title">Credenciales</div>
                <div className="sub">Token del bot y webhook de recepción</div>
              </div>
            </div>
            <div className="col" style={{ gap: 14 }}>
              <div className="field">
                <label>Token del bot</label>
                <div className="row" style={{ gap: 6 }}>
                  <input className="input mono"
                    type={reveal ? "text" : "password"}
                    value={config.token}
                    onChange={(e) => setConfig({ ...config, token: e.target.value })}
                  />
                  <button className="btn icon" onClick={() => setReveal((v) => !v)} title={reveal ? "Ocultar" : "Mostrar"}>
                    <Icon name={reveal ? "eye-off" : "eye"} size={14}/>
                  </button>
                  <button className="btn icon" title="Copiar">
                    <Icon name="copy" size={14}/>
                  </button>
                </div>
                <div className="tiny muted">Lo obtienes desde @BotFather al crear el bot</div>
              </div>

              <div className="field">
                <label>Webhook URL</label>
                <div className="row" style={{ gap: 6 }}>
                  <input className="input mono" value={config.webhook}
                    onChange={(e) => setConfig({ ...config, webhook: e.target.value })}
                  />
                  <button className="btn" title="Actualizar webhook">
                    <Icon name="refresh" size={14}/> Actualizar
                  </button>
                </div>
                <div className="tiny muted">Endpoint público al que Telegram envía cada mensaje</div>
              </div>

              <div className="field">
                <label>ID de Telegram autorizado</label>
                <input className="input mono" value={config.chatId}
                  onChange={(e) => setConfig({ ...config, chatId: e.target.value })}
                />
                <div className="tiny muted">Solo este ID puede registrar gastos. Cualquier otro será ignorado.</div>
              </div>

              <div className="row" style={{ gap: 8, paddingTop: 4 }}>
                <button className="btn primary" onClick={testConnection}>
                  {testing === "loading" ? <><Icon name="refresh" size={14}/> Probando…</> :
                   testing === "ok" ? <><Icon name="check" size={14}/> Conexión exitosa</> :
                   <><Icon name="play" size={14}/> Probar conexión</>}
                </button>
                <button className="btn">
                  <Icon name="check" size={14}/> Guardar configuración
                </button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <div>
                <div className="title">Comportamiento</div>
                <div className="sub">Cómo procesa los mensajes el bot</div>
              </div>
            </div>
            <div className="col" style={{ gap: 6 }}>
              <SettingRow
                label="Categorización automática"
                desc="El bot intenta deducir la categoría según las palabras del mensaje"
                checked={config.autoCategorize}
                onChange={(v) => setConfig({ ...config, autoCategorize: v })}
              />
              <SettingRow
                label="Permitir entrada manual desde la app"
                desc="Por defecto los gastos solo se cargan desde Telegram. Esto agrega un botón para crearlos aquí también."
                checked={config.allowManual}
                onChange={(v) => setConfig({ ...config, allowManual: v })}
              />
              <SettingRow
                label="Confirmar gastos por revisar"
                desc="Antes de guardar, el bot responderá con un resumen y pedirá confirmación"
                checked={true}
                onChange={() => {}}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <div>
                <div className="title">Actividad reciente</div>
                <div className="sub">Últimos mensajes procesados</div>
              </div>
              <div className="right">
                <span className="tiny mono muted">Solo lectura</span>
              </div>
            </div>
            <div className="col" style={{ gap: 10 }}>
              {BOT_ACTIVITY.map((m, i) => (
                <div key={i} className="col" style={{ gap: 6 }}>
                  <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
                    <div className="avatar" style={{ width: 24, height: 24, fontSize: 10 }}>JR</div>
                    <div>
                      <div className="bubble" style={{ padding: "6px 10px", fontSize: 12.5, maxWidth: 380 }}>{m.in}</div>
                      <div className="tiny muted mono" style={{ marginTop: 2 }}>{m.ts}</div>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 8, alignItems: "flex-start", paddingLeft: 32 }}>
                    <div className="avatar" style={{ width: 24, height: 24, fontSize: 10, background: "var(--ink)", color: "var(--bg)" }}>
                      <Icon name="telegram" size={11}/>
                    </div>
                    <div>
                      <div className="bubble" style={{
                        padding: "6px 10px", fontSize: 12.5, maxWidth: 380,
                        background: m.out.startsWith("✓") ? "var(--accent-soft)" : "var(--warn-soft)",
                        color: m.out.startsWith("✓") ? "var(--accent-ink)" : "var(--warn-ink)",
                        borderRadius: "12px 12px 4px 12px",
                      }}>{m.out}</div>
                    </div>
                  </div>
                  {i < BOT_ACTIVITY.length - 1 ? <div style={{ height: 1, background: "var(--line-2)", margin: "6px 0" }}></div> : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col">
          <div className="card">
            <div className="card-h">
              <div className="title">Estado en vivo</div>
            </div>
            <div className="col" style={{ gap: 10 }}>
              <StatusRow label="Conexión" value={botOn ? "Activa" : "Inactiva"} ok={botOn} />
              <StatusRow label="Webhook" value="Verificado" ok />
              <StatusRow label="Latencia" value="142 ms" mono />
              <StatusRow label="Última actividad" value="hace 12 min" mono />
              <StatusRow label="Mensajes hoy" value="12" mono />
              <StatusRow label="Errores 24h" value="0" mono />
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <div className="title">Regional</div>
            </div>
            <div className="col" style={{ gap: 12 }}>
              <div className="field">
                <label>Zona horaria</label>
                <select className="select" value={config.tz}
                  onChange={(e) => setConfig({ ...config, tz: e.target.value })}>
                  <option value="America/Santiago">America/Santiago (GMT-4)</option>
                  <option value="America/Buenos_Aires">America/Buenos_Aires</option>
                  <option value="America/Lima">America/Lima</option>
                  <option value="America/Bogota">America/Bogota</option>
                  <option value="America/Mexico_City">America/Mexico_City</option>
                </select>
              </div>
              <div className="field">
                <label>Moneda</label>
                <select className="select" value={config.currency}
                  onChange={(e) => setConfig({ ...config, currency: e.target.value })}>
                  <option value="CLP">CLP — Peso chileno</option>
                  <option value="ARS">ARS — Peso argentino</option>
                  <option value="USD">USD — Dólar</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <div className="title">Acerca del bot</div>
            </div>
            <div className="col" style={{ gap: 8 }}>
              <KV k="Usuario bot" v="@control_gastos_bot" />
              <KV k="Versión" v="1.4.2" />
              <KV k="Modo parsing" v="GPT-4 + reglas" />
              <KV k="Idiomas" v="Español (CL)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, desc, checked, onChange }) {
  return (
    <div className="row between" style={{ padding: "8px 0", borderBottom: "1px solid var(--line-2)" }}>
      <div style={{ paddingRight: 14 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500 }}>{label}</div>
        <div className="tiny muted">{desc}</div>
      </div>
      <div className={"switch " + (checked ? "on" : "")} onClick={() => onChange(!checked)} />
    </div>
  );
}

function StatusRow({ label, value, ok, mono }) {
  return (
    <div className="row between">
      <span className="tiny muted">{label}</span>
      <span className={mono ? "mono" : ""} style={{ fontSize: 12.5, fontWeight: 500 }}>
        {typeof ok !== "undefined" ? (
          <span className="row" style={{ gap: 6 }}>
            <span className={"dot " + (ok ? "on" : "off")}></span> {value}
          </span>
        ) : value}
      </span>
    </div>
  );
}

function KV({ k, v }) {
  return (
    <div className="row between">
      <span className="tiny muted">{k}</span>
      <span className="mono" style={{ fontSize: 12 }}>{v}</span>
    </div>
  );
}

window.TelegramSettings = TelegramSettings;
