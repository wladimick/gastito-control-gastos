/* Mock data + helpers — Control de Gastos */

const fmtCLP = (n) => "$" + Math.round(n).toLocaleString("es-CL").replaceAll(",", ".");
const fmtCLPshort = (n) => {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1).replace(".", ",") + "M";
  if (n >= 1_000) return "$" + Math.round(n / 1_000) + "K";
  return "$" + n;
};

const CATEGORIES = [
  { id: "bencina",       label: "Bencina",       color: "#D97757" },
  { id: "supermercado",  label: "Supermercado",  color: "#5B8C5A" },
  { id: "comida",        label: "Comida",        color: "#C7A04A" },
  { id: "farmacia",      label: "Farmacia",      color: "#6B89B5" },
  { id: "transporte",    label: "Transporte",    color: "#8E6FB5" },
  { id: "servicios",     label: "Servicios",     color: "#4A8A95" },
  { id: "entretencion",  label: "Entretención",  color: "#B5677A" },
  { id: "salud",         label: "Salud",         color: "#7A9E6F" },
  { id: "otros",         label: "Otros",         color: "#9A9B94" },
];

const BANCOS = [
  "Banco de Chile",
  "Banco Estado",
  "Santander",
  "BCI",
  "Itaú",
  "Falabella",
  "Scotiabank",
];

const MEDIOS = ["Tarjeta", "Transferencia", "Efectivo"];

// Generate ~28 mock expenses across recent dates of "May 2026"
function makeExpenses() {
  const base = [
    // Explicit examples from the brief
    { desc: "Bencina",                cat: "bencina",       monto: 12500, medio: "Tarjeta",        banco: "Banco de Chile", tipo: "credito", cuotas: 1, estado: "registrado", fecha: "2026-05-13" },
    { desc: "Bencina",                cat: "bencina",       monto: 12500, medio: "Tarjeta",        banco: "Santander",       tipo: "debito",  cuotas: 3, estado: "registrado", fecha: "2026-05-13" },
    { desc: "Supermercado Jumbo",     cat: "supermercado",  monto: 8990,  medio: "Tarjeta",        banco: "Banco de Chile", tipo: "debito",  cuotas: 1, estado: "registrado", fecha: "2026-05-12" },
    { desc: "Comida Niu Sushi",       cat: "comida",        monto: 45000, medio: "Tarjeta",        banco: "Banco Estado",    tipo: "credito", cuotas: 1, estado: "registrado", fecha: "2026-05-09" },
    { desc: "Farmacia Cruz Verde",    cat: "farmacia",      monto: 19990, medio: "Tarjeta",        banco: "Santander",       tipo: "debito",  cuotas: 1, estado: "registrado", fecha: "2026-05-11" },
    // Synthetic
    { desc: "Almuerzo oficina",       cat: "comida",        monto: 7990,  medio: "Tarjeta",        banco: "BCI",             tipo: "debito",  cuotas: 1, estado: "registrado", fecha: "2026-05-13" },
    { desc: "Uber al aeropuerto",     cat: "transporte",    monto: 18500, medio: "Tarjeta",        banco: "Itaú",            tipo: "credito", cuotas: 1, estado: "registrado", fecha: "2026-05-10" },
    { desc: "Netflix mensual",        cat: "entretencion",  monto: 12990, medio: "Tarjeta",        banco: "Santander",       tipo: "credito", cuotas: 1, estado: "registrado", fecha: "2026-05-08" },
    { desc: "Cuenta de luz",          cat: "servicios",     monto: 38450, medio: "Transferencia", banco: "Banco Estado",    tipo: "debito",  cuotas: 1, estado: "registrado", fecha: "2026-05-07" },
    { desc: "Cuenta de gas",          cat: "servicios",     monto: 22100, medio: "Transferencia", banco: "Banco Estado",    tipo: "debito",  cuotas: 1, estado: "registrado", fecha: "2026-05-07" },
    { desc: "Internet hogar",         cat: "servicios",     monto: 24990, medio: "Tarjeta",        banco: "Falabella",       tipo: "credito", cuotas: 1, estado: "registrado", fecha: "2026-05-05" },
    { desc: "Supermercado Lider",     cat: "supermercado",  monto: 64320, medio: "Tarjeta",        banco: "Banco de Chile", tipo: "credito", cuotas: 3, estado: "registrado", fecha: "2026-05-04" },
    { desc: "Café Starbucks",         cat: "comida",        monto: 4490,  medio: "Tarjeta",        banco: "BCI",             tipo: "debito",  cuotas: 1, estado: "registrado", fecha: "2026-05-13" },
    { desc: "Bencina Copec",          cat: "bencina",       monto: 23000, medio: "Tarjeta",        banco: "Banco de Chile", tipo: "credito", cuotas: 1, estado: "revisar",    fecha: "2026-05-03" },
    { desc: "Cine + cabritas",        cat: "entretencion",  monto: 14800, medio: "Tarjeta",        banco: "Itaú",            tipo: "debito",  cuotas: 1, estado: "registrado", fecha: "2026-05-02" },
    { desc: "Consulta dental",        cat: "salud",         monto: 38000, medio: "Tarjeta",        banco: "Santander",       tipo: "credito", cuotas: 6, estado: "registrado", fecha: "2026-05-02" },
    { desc: "Estacionamiento",        cat: "transporte",    monto: 3500,  medio: "Efectivo",       banco: "—",               tipo: "debito",  cuotas: 1, estado: "registrado", fecha: "2026-05-11" },
    { desc: "Verdulería barrio",      cat: "supermercado",  monto: 8700,  medio: "Efectivo",       banco: "—",               tipo: "debito",  cuotas: 1, estado: "registrado", fecha: "2026-05-10" },
    { desc: "Spotify familiar",       cat: "entretencion",  monto: 7990,  medio: "Tarjeta",        banco: "Santander",       tipo: "credito", cuotas: 1, estado: "registrado", fecha: "2026-05-06" },
    { desc: "Farmacia Salcobrand",    cat: "farmacia",      monto: 7250,  medio: "Tarjeta",        banco: "Falabella",       tipo: "debito",  cuotas: 1, estado: "registrado", fecha: "2026-05-06" },
    { desc: "Pizza viernes",          cat: "comida",        monto: 21490, medio: "Tarjeta",        banco: "Banco Estado",    tipo: "credito", cuotas: 1, estado: "registrado", fecha: "2026-05-01" },
    { desc: "Metro mensual",          cat: "transporte",    monto: 38000, medio: "Tarjeta",        banco: "Banco de Chile", tipo: "debito",  cuotas: 1, estado: "registrado", fecha: "2026-05-01" },
    { desc: "Regalo cumpleaños",      cat: "otros",         monto: 32000, medio: "Tarjeta",        banco: "Itaú",            tipo: "credito", cuotas: 3, estado: "revisar",    fecha: "2026-05-09" },
    { desc: "Plan celular",           cat: "servicios",     monto: 16900, medio: "Tarjeta",        banco: "BCI",             tipo: "credito", cuotas: 1, estado: "registrado", fecha: "2026-05-05" },
    { desc: "Café con amigos",        cat: "comida",        monto: 11200, medio: "Tarjeta",        banco: "Banco de Chile", tipo: "debito",  cuotas: 1, estado: "registrado", fecha: "2026-05-12" },
    { desc: "Suplementos",            cat: "salud",         monto: 28990, medio: "Tarjeta",        banco: "Scotiabank",      tipo: "credito", cuotas: 3, estado: "registrado", fecha: "2026-04-30" },
    { desc: "Taxi nocturno",          cat: "transporte",    monto: 9800,  medio: "Tarjeta",        banco: "Itaú",            tipo: "debito",  cuotas: 1, estado: "registrado", fecha: "2026-05-11" },
    { desc: "Almuerzo familiar",      cat: "comida",        monto: 56400, medio: "Tarjeta",        banco: "Banco de Chile", tipo: "credito", cuotas: 1, estado: "registrado", fecha: "2026-05-04" },
  ];
  return base.map((e, i) => ({ id: "g" + (1000 + i), notas: "", ...e }));
}

const EXPENSES = makeExpenses();

const UNPARSED = [
  { id: "u1", text: "pagué unas cosas",            received: "2026-05-13 18:22", hint: "Falta monto y categoría" },
  { id: "u2", text: "gasto banco",                 received: "2026-05-13 09:14", hint: "Falta monto, descripción y fecha" },
  { id: "u3", text: "12 lucas ayer",               received: "2026-05-12 22:01", hint: "Falta categoría y medio de pago" },
  { id: "u4", text: "compré pan y queso",          received: "2026-05-12 20:40", hint: "Falta monto" },
  { id: "u5", text: "transferencia 30 a la jose",  received: "2026-05-11 19:11", hint: "Categoría no detectada" },
];

const BOT_ACTIVITY = [
  { ts: "13/05/2026 18:42", in: "Gasté 12.500 en bencina hoy con crédito Banco Chile",      out: "✓ Registrado: Bencina · $12.500 · Crédito · Banco de Chile" },
  { ts: "13/05/2026 13:05", in: "Almuerzo 7990 BCI débito",                                   out: "✓ Registrado: Comida · $7.990 · Débito · BCI" },
  { ts: "13/05/2026 09:14", in: "gasto banco",                                                 out: "⚠ No entendí. Lo marqué para revisar." },
  { ts: "12/05/2026 22:01", in: "12 lucas ayer",                                               out: "⚠ Necesito más contexto: ¿categoría?" },
];

// Mock month series (Nov 2025 → May 2026)
const MONTHLY_SERIES = [
  { m: "Nov", total:  680000 },
  { m: "Dic", total:  920000 },
  { m: "Ene", total:  840000 },
  { m: "Feb", total:  710000 },
  { m: "Mar", total:  890000 },
  { m: "Abr", total:  780000 },
  { m: "May", total:  null   }, // current — derived from EXPENSES
];

Object.assign(window, {
  fmtCLP, fmtCLPshort,
  CATEGORIES, BANCOS, MEDIOS,
  EXPENSES, UNPARSED, BOT_ACTIVITY, MONTHLY_SERIES,
});
