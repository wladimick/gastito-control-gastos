// UnparsedMessages
const { useState: useStateUp } = React;
function UnparsedMessages({ unparsed, onResolve, onDiscard }) {
  const { Card, Badge, IconBtn, Select } = window.UI;
  const { Icon, fmtCLP, relDate, timeOnly } = window.Helpers;

  const [editing, setEditing] = useStateUp(null); // id of message being completed
  const [draft, setDraft] = useStateUp({});

  const startEdit = (msg) => {
    setEditing(msg.id);
    setDraft({
      amount: msg.guess?.amount || "",
      description: msg.text,
      category: msg.guess?.category || "otros",
      bank: "bchile",
      method: "tarjeta",
      type: "debito",
      installments: 1,
      date: msg.guess?.date || msg.received,
      notes: `Originado desde mensaje: "${msg.text}"`,
    });
  };

  const cancelEdit = () => { setEditing(null); setDraft({}); };

  const save = (msgId) => {
    onResolve(msgId, { ...draft, status: "ok" });
    setEditing(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <Card padding="p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-md bg-[var(--amber-soft)] text-[var(--amber-ink)] grid place-items-center shrink-0">
            <Icon name="alert" size={18}/>
          </div>
          <div className="flex-1">
            <div className="font-semibold tracking-tight">{unparsed.length} mensaje{unparsed.length===1?"":"s"} sin interpretar</div>
            <div className="text-[13px] text-[var(--muted)] mt-1">
              Mensajes que el bot recibió pero no logró convertir en un gasto. Revísalos y complétalos manualmente, o descártalos si no eran gastos.
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        {unparsed.map(m => {
          const isEditing = editing === m.id;
          return (
            <Card key={m.id} padding="p-0">
              <div className="p-5 flex items-start gap-3">
                {/* Bubble */}
                <div className="w-8 h-8 rounded-full bg-[var(--ink)] text-[var(--bg)] grid place-items-center text-[12px] shrink-0">
                  <Icon name="message" size={14}/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="inline-block max-w-full px-4 py-2.5 rounded-2xl rounded-tl-md bg-[var(--bg)] border border-[var(--line)]">
                    <div className="text-[14px]">"{m.text}"</div>
                  </div>
                  <div className="mt-1.5 text-[11px] text-[var(--muted)] font-mono flex items-center gap-2">
                    <span>{relDate(m.received)} · {timeOnly(m.received)}</span>
                    {m.guess && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 text-[var(--ink-2)]">
                          <Icon name="info" size={11}/> Detecté algo:
                          {m.guess.amount && <span className="font-mono">{fmtCLP(m.guess.amount)}</span>}
                          {m.guess.category && <span>{window.MOCK.CATEGORIES.find(c=>c.id===m.guess.category)?.label}</span>}
                          {m.guess.date && <span>{relDate(m.guess.date)}</span>}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {!isEditing && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => startEdit(m)}
                      className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md bg-[var(--ink)] text-[var(--bg)] text-[12px] font-medium">
                      <Icon name="pencil" size={12}/> Completar
                    </button>
                    <IconBtn name="trash" label="Descartar" tone="danger" onClick={() => onDiscard(m.id)}/>
                  </div>
                )}
              </div>

              {isEditing && (
                <div className="border-t border-[var(--line)] bg-[var(--bg)] p-5 animate-[fadeIn_.18s_ease-out]">
                  <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] mb-3">Completar gasto</div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <Field label="Monto">
                      <input type="number" value={draft.amount}
                        onChange={e => setDraft({...draft, amount: Number(e.target.value)})}
                        className="w-full h-9 px-3 bg-[var(--bg-elev)] border border-[var(--line)] rounded-md text-[13px] font-mono focus:outline-none focus:border-[var(--ink)]"/>
                    </Field>
                    <Field label="Descripción">
                      <input value={draft.description}
                        onChange={e => setDraft({...draft, description: e.target.value})}
                        className="w-full h-9 px-3 bg-[var(--bg-elev)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"/>
                    </Field>
                    <Field label="Categoría">
                      <Select value={draft.category} onChange={v => setDraft({...draft, category: v})}
                        options={window.MOCK.CATEGORIES.map(c => ({ value: c.id, label: c.label }))}/>
                    </Field>
                    <Field label="Medio">
                      <Select value={draft.method} onChange={v => setDraft({...draft, method: v})}
                        options={window.MOCK.PAYMENT_METHODS.map(m => ({ value: m.id, label: m.label }))}/>
                    </Field>
                    <Field label="Banco">
                      <Select value={draft.bank} onChange={v => setDraft({...draft, bank: v})}
                        options={window.MOCK.BANKS.map(b => ({ value: b.id, label: b.label }))}/>
                    </Field>
                    <Field label="Tipo">
                      <Select value={draft.type} onChange={v => setDraft({...draft, type: v})}
                        options={[{value:"debito",label:"Débito"},{value:"credito",label:"Crédito"}]}/>
                    </Field>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button onClick={cancelEdit} className="text-[12.5px] text-[var(--muted)] hover:text-[var(--ink)] underline">Cancelar</button>
                    <button onClick={() => save(m.id)}
                      className="h-9 px-4 inline-flex items-center gap-2 rounded-md bg-[var(--accent)] text-white text-[13px] font-medium">
                      <Icon name="check" size={13}/> Registrar gasto
                    </button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}

        {unparsed.length === 0 && (
          <Card padding="p-12" className="text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--accent-soft)] text-[var(--accent-ink)] mx-auto grid place-items-center">
              <Icon name="check" size={20}/>
            </div>
            <div className="mt-3 font-semibold tracking-tight">¡Todo al día!</div>
            <div className="text-[13px] text-[var(--muted)] mt-1">No hay mensajes pendientes de revisión.</div>
          </Card>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)] block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

window.UnparsedMessages = UnparsedMessages;
