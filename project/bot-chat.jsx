// BotChat: panel flotante simulando una conversación con el bot de Telegram
const { useState: useStateBc, useEffect: useEffectBc, useRef: useRefBc } = React;
function BotChat({ open, onClose, onMessage }) {
  const { Icon, timeOnly, relDate } = window.Helpers;
  const [messages, setMessages] = useStateBc(window.MOCK.BOT_CHAT);
  const [input, setInput] = useStateBc("");
  const [typing, setTyping] = useStateBc(false);
  const scrollRef = useRefBc(null);

  useEffectBc(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const now = new Date().toISOString();
    setMessages(m => [...m, { from: "user", text, at: now }]);
    setInput("");
    setTyping(true);

    setTimeout(() => {
      // Parser muy simple para el prototipo
      const amountMatch = text.match(/(\d[\d\.,]*)/);
      const amount = amountMatch ? Number(amountMatch[1].replace(/\./g, "").replace(",", ".")) : null;
      const cat = window.MOCK.CATEGORIES.find(c => text.toLowerCase().includes(c.label.toLowerCase().split(" ")[0]));
      let reply;
      if (amount && cat) {
        reply = `✓ Registrado: $${amount.toLocaleString("es-CL")} — ${cat.label}`;
        onMessage && onMessage({ amount, description: cat.label, category: cat.id });
      } else if (amount) {
        reply = `Tengo el monto $${amount.toLocaleString("es-CL")}. ¿En qué categoría?`;
      } else {
        reply = "🤔 No entendí. ¿Me das el monto y la categoría?";
      }
      setMessages(m => [...m, { from: "bot", text: reply, at: new Date().toISOString() }]);
      setTyping(false);
    }, 800);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      <div className="absolute right-4 bottom-4 md:right-7 md:bottom-7 w-[min(380px,calc(100vw-2rem))] h-[min(560px,calc(100vh-7rem))] pointer-events-auto
                      bg-[var(--bg-elev)] border border-[var(--line)] rounded-2xl shadow-[0_18px_50px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--line)] flex items-center justify-between bg-[var(--bg-elev)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-[var(--accent)] text-white grid place-items-center">
              <Icon name="bot" size={15}/>
            </div>
            <div>
              <div className="text-[13.5px] font-semibold tracking-tight leading-none">@gastito_bot</div>
              <div className="text-[10.5px] text-[var(--muted)] mt-1 leading-none flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-[var(--accent)]"></span> en línea
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-md hover:bg-[var(--hover)]">
            <Icon name="x" size={15}/>
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2.5 bg-[oklch(0.97_0.005_85)]">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.from==="user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-3.5 py-2 text-[13px] leading-snug
                ${m.from==="user"
                  ? "bg-[var(--ink)] text-[var(--bg)] rounded-2xl rounded-br-md"
                  : "bg-white border border-[var(--line)] rounded-2xl rounded-bl-md text-[var(--ink)]"}`}>
                <div>{m.text}</div>
                <div className={`text-[10px] font-mono mt-1 ${m.from==="user" ? "text-white/55 text-right" : "text-[var(--muted)]"}`}>
                  {timeOnly(m.at)}
                </div>
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex justify-start">
              <div className="bg-white border border-[var(--line)] rounded-2xl rounded-bl-md px-3.5 py-2.5">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-bounce" style={{ animationDelay: "120ms" }}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)] animate-bounce" style={{ animationDelay: "240ms" }}></span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--line)] p-3 bg-[var(--bg-elev)]">
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {["Gasté 12.500 en bencina hoy", "8.990 supermercado ayer", "/mes"].map((s,i) => (
              <button key={i} onClick={() => setInput(s)}
                className="text-[11px] px-2 py-1 rounded-full border border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--hover)]">
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              placeholder="Escribe un mensaje al bot..."
              className="flex-1 h-10 px-3 bg-[var(--bg)] border border-[var(--line)] rounded-md text-[13px] focus:outline-none focus:border-[var(--ink)]"
            />
            <button onClick={send} className="w-10 h-10 grid place-items-center rounded-md bg-[var(--ink)] text-[var(--bg)]">
              <Icon name="send" size={15}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.BotChat = BotChat;
