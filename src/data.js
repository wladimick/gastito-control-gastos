export const CATEGORIES = [
  { id: "bencina",      label: "Bencina",       icon: "⛽", color: "#E07A5F" },
  { id: "supermercado", label: "Supermercado",  icon: "🛒", color: "#81B29A" },
  { id: "comida",       label: "Comida",        icon: "🍽",  color: "#F2CC8F" },
  { id: "farmacia",     label: "Farmacia",      icon: "💊", color: "#9B89B3" },
  { id: "transporte",   label: "Transporte",    icon: "🚇", color: "#6D9DC5" },
  { id: "suscripciones",label: "Suscripciones", icon: "📺", color: "#C77DFF" },
  { id: "hogar",        label: "Hogar",         icon: "🏠", color: "#B07156" },
  { id: "otros",        label: "Otros",         icon: "•",   color: "#888880" },
];

export const BANKS = [
  { id: "bchile",    label: "Banco Chile" },
  { id: "bestado",   label: "Banco Estado" },
  { id: "santander", label: "Santander" },
  { id: "bci",       label: "BCI" },
  { id: "itau",      label: "Itaú" },
  { id: "efectivo",  label: "Efectivo" },
];

export const PAYMENT_METHODS = [
  { id: "tarjeta",  label: "Tarjeta" },
  { id: "efectivo", label: "Efectivo" },
  { id: "transfer", label: "Transferencia" },
];

// Fechas referenciadas al "hoy" = 13 mayo 2026
export const TODAY = new Date("2026-05-13T20:15:00");
const d = (offset, h = 12, m = 0) => {
  const x = new Date(TODAY);
  x.setDate(x.getDate() + offset);
  x.setHours(h, m, 0, 0);
  return x.toISOString();
};

export const EXPENSES = [
  { id: "e01", amount: 12500, description: "Bencina Copec",     category: "bencina",      bank: "bchile",    method: "tarjeta", type: "credito", installments: 1, status: "ok",      date: d(0, 18, 30), notes: "Estanque casi lleno" },
  { id: "e02", amount: 12500, description: "Bencina Shell",     category: "bencina",      bank: "santander", method: "tarjeta", type: "debito",  installments: 3, status: "revisar", date: d(0, 9, 10),  notes: "" },
  { id: "e03", amount:  8990, description: "Jumbo",             category: "supermercado", bank: "bestado",   method: "tarjeta", type: "debito",  installments: 1, status: "ok",      date: d(-1, 19, 0), notes: "" },
  { id: "e04", amount: 45000, description: "Cena con Carolina", category: "comida",       bank: "bestado",   method: "tarjeta", type: "credito", installments: 1, status: "ok",      date: d(-3, 21, 45),notes: "Restorán italiano" },
  { id: "e05", amount: 19990, description: "Salcobrand",        category: "farmacia",     bank: "santander", method: "tarjeta", type: "debito",  installments: 1, status: "ok",      date: d(-1, 11, 20),notes: "Recetas" },
  { id: "e06", amount:  3200, description: "Metro BIP",         category: "transporte",   bank: "efectivo",  method: "efectivo",type: "debito",  installments: 1, status: "ok",      date: d(-2, 8, 0),  notes: "" },
  { id: "e07", amount:  9900, description: "Netflix",           category: "suscripciones",bank: "bci",       method: "tarjeta", type: "credito", installments: 1, status: "ok",      date: d(-5, 0, 5),  notes: "Plan estándar" },
  { id: "e08", amount: 23400, description: "Lider Express",     category: "supermercado", bank: "bchile",    method: "tarjeta", type: "credito", installments: 1, status: "ok",      date: d(-4, 13, 10),notes: "" },
  { id: "e09", amount: 14500, description: "Uber",              category: "transporte",   bank: "bci",       method: "tarjeta", type: "credito", installments: 1, status: "ok",      date: d(-6, 23, 30),notes: "Aeropuerto" },
  { id: "e10", amount: 89990, description: "Mantención auto",   category: "hogar",        bank: "santander", method: "tarjeta", type: "credito", installments: 6, status: "ok",      date: d(-7, 16, 0), notes: "Revisión 30.000km" },
  { id: "e11", amount: 12500, description: "Bencina",           category: "bencina",      bank: "bchile",    method: "tarjeta", type: "credito", installments: 1, status: "ok",      date: d(-8, 9, 0),  notes: "" },
  { id: "e12", amount: 67800, description: "Supermercado mes",  category: "supermercado", bank: "bestado",   method: "tarjeta", type: "debito",  installments: 1, status: "ok",      date: d(-9, 17, 0), notes: "" },
  { id: "e13", amount:  6500, description: "Café con Pablo",    category: "comida",       bank: "efectivo",  method: "efectivo",type: "debito",  installments: 1, status: "ok",      date: d(-10, 11, 0),notes: "" },
  { id: "e14", amount: 18990, description: "Cruz Verde",        category: "farmacia",     bank: "santander", method: "tarjeta", type: "debito",  installments: 1, status: "revisar", date: d(-11, 15, 30),notes: "Verificar receta" },
  { id: "e15", amount:  4990, description: "Spotify",           category: "suscripciones",bank: "bci",       method: "tarjeta", type: "credito", installments: 1, status: "ok",      date: d(-12, 0, 1), notes: "" },
  { id: "e16", amount: 39900, description: "Almuerzo trabajo",  category: "comida",       bank: "bchile",    method: "tarjeta", type: "credito", installments: 1, status: "ok",      date: d(-13, 13, 0),notes: "" },
  { id: "e17", amount: 25000, description: "Detergente y aseo", category: "hogar",        bank: "bestado",   method: "tarjeta", type: "debito",  installments: 1, status: "ok",      date: d(-15, 18, 20),notes: "" },
  { id: "e18", amount: 12500, description: "Bencina",           category: "bencina",      bank: "bchile",    method: "tarjeta", type: "credito", installments: 1, status: "ok",      date: d(-17, 9, 30),notes: "" },
  { id: "e19", amount:  7990, description: "Café tostado",      category: "comida",       bank: "santander", method: "tarjeta", type: "debito",  installments: 1, status: "ok",      date: d(-18, 10, 0),notes: "" },
  { id: "e20", amount: 32000, description: "Internet hogar",    category: "hogar",        bank: "bci",       method: "tarjeta", type: "credito", installments: 1, status: "ok",      date: d(-20, 12, 0),notes: "VTR" },
];

export const MONTHLY_HISTORY = [
  { month: "Dic 2025", total:  680000 },
  { month: "Ene 2026", total:  520000 },
  { month: "Feb 2026", total:  610000 },
  { month: "Mar 2026", total:  580000 },
  { month: "Abr 2026", total:  725000 },
  { month: "May 2026", total:  null },
];

export const UNPARSED = [
  { id: "u1", text: "pagué unas cosas",       received: d(0, 19, 12), guess: null },
  { id: "u2", text: "gasto banco",            received: d(0, 17, 4),  guess: null },
  { id: "u3", text: "12 lucas ayer",          received: d(-1, 22, 30),guess: { amount: 12000, date: d(-1, 12, 0) } },
  { id: "u4", text: "pagué la cuenta de luz", received: d(-2, 10, 0), guess: { category: "hogar" } },
  { id: "u5", text: "kiosko 1500",            received: d(-3, 16, 45),guess: { amount: 1500 } },
];

export const BOT_CHAT = [
  { from: "user", text: "Gasté 12.500 en bencina hoy con crédito Banco Chile", at: d(0, 18, 30) },
  { from: "bot",  text: "✓ Registrado: $12.500 — Bencina — Banco Chile (crédito)",at: d(0, 18, 30) },
  { from: "user", text: "Gasté 8.990 en supermercado ayer con débito",           at: d(-1, 19, 0) },
  { from: "bot",  text: "✓ Registrado: $8.990 — Supermercado (débito)",           at: d(-1, 19, 0) },
  { from: "user", text: "pagué unas cosas",                                       at: d(0, 19, 12) },
  { from: "bot",  text: "🤔 No entendí. ¿Me das el monto y la categoría?",        at: d(0, 19, 12) },
];

export const INCOME = [
  { id: "i1", source: "Sueldo Tibox",        type: "salary",    amount: 1850000, recurrent: true,  dayOfMonth: 5, lastReceived: d(-8, 9, 30), notes: "Líquido mensual" },
  { id: "i2", source: "Freelance landing",   type: "freelance", amount:  450000, recurrent: false, receivedAt: d(-1, 18, 0), notes: "Proyecto puntual" },
  { id: "i3", source: "Devolución impuestos",type: "otros",     amount:  120000, recurrent: false, receivedAt: d(-15, 12, 0), notes: "Operación Renta" },
];

export const RECEIVABLES = [
  { id: "r1", debtor: "Pablo",    amount:  80000, description: "Préstamo casual",           dueDate: d(12, 12, 0),  status: "pendiente", createdAt: d(-5, 0, 0) },
  { id: "r2", debtor: "Hermana",  amount:  35000, description: "Cuenta del restorán",       dueDate: d(7, 12, 0),   status: "pendiente", createdAt: d(-3, 0, 0) },
  { id: "r3", debtor: "Tibox",    amount: 120000, description: "Reembolso bencina cliente", dueDate: d(17, 12, 0),  status: "pendiente", createdAt: d(-2, 0, 0) },
  { id: "r4", debtor: "Diego",    amount:  18000, description: "Entradas cine",             dueDate: d(-2, 12, 0),  status: "vencido",   createdAt: d(-10, 0, 0) },
  { id: "r5", debtor: "Carolina", amount:  25000, description: "Café del jueves",           dueDate: d(-12, 12, 0), status: "cobrado",   createdAt: d(-20, 0, 0), paidAt: d(-10, 12, 0) },
];

export const BUDGETS = {
  bencina:        60000,
  supermercado:  150000,
  comida:        120000,
  farmacia:       25000,
  transporte:     30000,
  suscripciones:  20000,
  hogar:         200000,
  otros:          50000,
};

export const AUDIT_LOG = [
  { id: "a1",  at: d(0, 19, 12), actor: "bot",    action: "unparsed",         target: "msg",    summary: "Mensaje sin interpretar: \"pagué unas cosas\"" },
  { id: "a2",  at: d(0, 18, 30), actor: "bot",    action: "expense.created",  target: "e01",    summary: "Gasto registrado: Bencina Copec — $12.500" },
  { id: "a3",  at: d(0, 9, 30),  actor: "user",   action: "expense.flagged",  target: "e02",    summary: "Marcado para revisar: Bencina Shell" },
  { id: "a4",  at: d(-1, 19, 5), actor: "bot",    action: "expense.created",  target: "e03",    summary: "Gasto registrado: Jumbo — $8.990" },
  { id: "a5",  at: d(-1, 11, 0), actor: "user",   action: "budget.updated",   target: "comida", summary: "Presupuesto Comida: $100k → $120k" },
  { id: "a6",  at: d(-2, 22, 0), actor: "user",   action: "expense.edited",   target: "e07",    summary: "Editado: Netflix · cambió categoría → Suscripciones" },
  { id: "a7",  at: d(-3, 21, 50),actor: "bot",    action: "expense.created",  target: "e04",    summary: "Gasto registrado: Cena con Carolina — $45.000" },
  { id: "a8",  at: d(-4, 8, 0),  actor: "system", action: "recurring.charged",target: "rc2",    summary: "Cargo recurrente: Luz · Enel — $38.000" },
  { id: "a9",  at: d(-5, 9, 0),  actor: "user",   action: "expense.deleted",  target: "e-old",  summary: "Eliminado: Pago manual duplicado — $4.500" },
  { id: "a10", at: d(-6, 14, 0), actor: "system", action: "bot.connected",    target: "bot",    summary: "Bot conectado al webhook" },
  { id: "a11", at: d(-7, 12, 30),actor: "user",   action: "expense.edited",   target: "e10",    summary: "Editado: Mantención auto · cuotas 1 → 6" },
  { id: "a12", at: d(-8, 9, 30), actor: "system", action: "income.received",  target: "i1",     summary: "Ingreso recibido: Sueldo Tibox — $1.850.000" },
  { id: "a13", at: d(-10, 12, 0),actor: "user",   action: "receivable.paid",  target: "r5",     summary: "Cobrado: Carolina — $25.000" },
];

export const RECURRING = [
  { id: "rc1", name: "Arriendo",             category: "hogar",         amount: 480000, dayOfMonth: 5,  bank: "santander", method: "transfer", type: "debito",  autoRegister: true,  active: true,  lastChargedMonth: "2026-05" },
  { id: "rc2", name: "Luz · Enel",           category: "hogar",         amount:  38000, dayOfMonth: 15, bank: "bestado",   method: "tarjeta",  type: "debito",  autoRegister: true,  active: true,  lastChargedMonth: "2026-04" },
  { id: "rc3", name: "Agua · Aguas Andinas", category: "hogar",         amount:  22000, dayOfMonth: 18, bank: "bestado",   method: "tarjeta",  type: "debito",  autoRegister: true,  active: true,  lastChargedMonth: "2026-04" },
  { id: "rc4", name: "Internet · VTR",       category: "hogar",         amount:  32000, dayOfMonth: 20, bank: "bci",       method: "tarjeta",  type: "credito", autoRegister: true,  active: true,  lastChargedMonth: "2026-04" },
  { id: "rc5", name: "Gas · Lipigas",        category: "hogar",         amount:  28000, dayOfMonth: 22, bank: "bchile",    method: "tarjeta",  type: "debito",  autoRegister: false, active: true,  lastChargedMonth: null },
  { id: "rc6", name: "Netflix",              category: "suscripciones", amount:   9900, dayOfMonth: 8,  bank: "bci",       method: "tarjeta",  type: "credito", autoRegister: true,  active: true,  lastChargedMonth: "2026-05" },
  { id: "rc7", name: "Spotify",              category: "suscripciones", amount:   4990, dayOfMonth: 1,  bank: "bci",       method: "tarjeta",  type: "credito", autoRegister: true,  active: true,  lastChargedMonth: "2026-05" },
  { id: "rc8", name: "Gimnasio",             category: "otros",         amount:  35000, dayOfMonth: 10, bank: "bchile",    method: "tarjeta",  type: "debito",  autoRegister: false, active: false, lastChargedMonth: null },
];

export const INSTALLMENT_DEBTS = [
  { id: "ic1", description: "Mantención auto",      category: "hogar",      bank: "santander", method: "tarjeta", total:  540000, installments:  6, paid: 2, monthlyAmount:  90000, startMonth: "2026-04", dayOfMonth: 5, status: "active", autoPay: true, notes: "Revisión 30.000km" },
  { id: "ic2", description: "Notebook MacBook Air", category: "otros",      bank: "bchile",    method: "tarjeta", total: 1599000, installments: 12, paid: 3, monthlyAmount: 133250, startMonth: "2026-02", dayOfMonth: 5, status: "active", autoPay: true, notes: "Para trabajo freelance" },
  { id: "ic3", description: "Refrigerador Samsung", category: "hogar",      bank: "bestado",   method: "tarjeta", total:  689990, installments: 10, paid: 5, monthlyAmount:  68999, startMonth: "2025-12", dayOfMonth: 5, status: "active", autoPay: true, notes: "" },
  { id: "ic4", description: "Vuelos a Buenos Aires",category: "transporte", bank: "bci",       method: "tarjeta", total:  980000, installments:  9, paid: 1, monthlyAmount: 108889, startMonth: "2026-04", dayOfMonth: 5, status: "active", autoPay: true, notes: "Vacaciones agosto" },
  { id: "ic5", description: "Curso UX avanzado",    category: "otros",      bank: "santander", method: "tarjeta", total:  350000, installments:  3, paid: 2, monthlyAmount: 116667, startMonth: "2026-03", dayOfMonth: 5, status: "active", autoPay: true, notes: "" },
  { id: "ic6", description: "Bencina Shell",        category: "bencina",    bank: "santander", method: "tarjeta", total:   37500, installments:  3, paid: 0, monthlyAmount:  12500, startMonth: "2026-05", dayOfMonth: 5, status: "active", autoPay: true, notes: "Última carga" },
  { id: "ic7", description: "TV LG OLED",           category: "hogar",      bank: "bchile",    method: "tarjeta", total:  720000, installments:  6, paid: 6, monthlyAmount: 120000, startMonth: "2025-11", dayOfMonth: 5, status: "paid",   autoPay: true, notes: "Terminada" },
];
