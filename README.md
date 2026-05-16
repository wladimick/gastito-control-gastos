# Gastito — Control de Gastos

Tracker de gastos personales integrado con un bot de Telegram. Construido con React 18 + Vite + Tailwind CSS 3.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite 5 |
| Estilos | Tailwind CSS 3 + CSS custom properties |
| Fuentes | Manrope (UI) + JetBrains Mono (valores) |
| Datos actuales | Mock en `src/data.js` (ver Roadmap) |
| Deploy | Vercel (configurado con `vercel.json`) |

## Vistas implementadas

- **Dashboard** — KPIs del mes, heatmap, cuotas próximas, recientes
- **Gastos** — tabla filtrable con búsqueda, 5 filtros, edición en panel lateral
- **Presupuestos** — héroe con indicador de ritmo, edición inline por categoría
- **Recurrentes** — 3 pestañas: gastos recurrentes, ingresos, por cobrar
- **Cuotas** — auto-pago el día 5, progreso de deudas, calendario 6 meses
- **Reportes** — barras mensuales, donut SVG, medios de pago, por banco
- **Comparación** — espejo mes actual vs anterior, barras duales por categoría
- **Sin interpretar** — mensajes del bot pendientes de completar manualmente
- **Telegram** — configuración del bot, prueba de conexión, comandos
- **Auditoría** — timeline agrupado por día con filtros por actor/acción

## Inicio rápido

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/
npm run preview    # preview del build
```

## Deploy en Vercel

1. Sube el repo a GitHub
2. En [vercel.com](https://vercel.com) → **Add New Project** → importa el repo
3. Framework preset: **Vite** (se detecta automáticamente)
4. Agrega las variables de entorno (ver siguiente sección)
5. **Deploy** — listo

El archivo `vercel.json` ya incluye la regla de rewrite para SPA routing.

## Variables de entorno

Copia `.env.example` a `.env.local` y completa los valores:

```bash
cp .env.example .env.local
```

| Variable | Requerida ahora | Para qué |
|---|---|---|
| `VITE_SUPABASE_URL` | No (usa mock) | Base de datos real |
| `VITE_SUPABASE_ANON_KEY` | No (usa mock) | Auth Supabase |
| `TELEGRAM_BOT_TOKEN` | No (solo backend) | Webhook del bot |
| `TELEGRAM_WEBHOOK_URL` | No (solo backend) | URL del endpoint |

## Roadmap: conectar Supabase

El proyecto usa datos mock en `src/data.js`. Para pasar a producción real:

### 1. Crear el cliente Supabase

```bash
npm install @supabase/supabase-js
```

```js
// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

### 2. Tablas necesarias en Supabase

```sql
-- expenses (gastos)
create table expenses (
  id text primary key,
  amount integer not null,
  description text,
  category text,
  bank text,
  method text,
  type text,
  installments integer default 1,
  status text default 'ok',
  date timestamptz,
  notes text,
  user_id uuid references auth.users
);

-- budgets (presupuestos por categoría)
create table budgets (
  user_id uuid references auth.users,
  category text,
  amount integer,
  primary key (user_id, category)
);

-- recurring (gastos recurrentes)
create table recurring (
  id text primary key,
  name text,
  amount integer,
  category text,
  bank text,
  method text,
  type text,
  day_of_month integer,
  active boolean default true,
  last_charged_month text,
  auto_register boolean default false,
  user_id uuid references auth.users
);
```

### 3. Reemplazar hooks de datos

En `src/App.jsx`, reemplazar los `useState(EXPENSES)` con `useEffect` que lean de Supabase:

```js
useEffect(() => {
  supabase.from('expenses').select('*').then(({ data }) => setExpenses(data))
}, [])
```

## Roadmap: Telegram Bot (backend)

El bot necesita un endpoint serverless que reciba los webhooks de Telegram y los inserte en Supabase.

### Opción A: Vercel Edge Function

Crea `api/telegram.js` en la raíz del proyecto:

```js
// api/telegram.js
export const config = { runtime: 'edge' }

export default async function handler(req) {
  const update = await req.json()
  const text = update.message?.text
  // parsear texto → insertar en Supabase
  // ...
  return new Response('ok')
}
```

Vercel lo despliega automáticamente como `/api/telegram`.

### Opción B: Bot separado (Node.js + node-telegram-bot-api)

Repositorio independiente que corre en Railway o Render, conectado a la misma base Supabase.

### Registrar el webhook

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://tu-dominio.vercel.app/api/telegram"
```

## Estructura del proyecto

```
src/
├── App.jsx                 # Estado global, routing, audit logger
├── main.jsx                # Entry point React
├── index.css               # CSS vars (tema) + Tailwind directives
├── data.js                 # Mock data (reemplazar con Supabase)
├── lib/
│   └── helpers.jsx         # fmtCLP, Icon, relDate, MES, etc.
└── components/
    ├── ui.jsx              # Card, Badge, IconBtn, BarRow, Select...
    ├── Layout.jsx          # Sidebar desktop + bottom nav mobile
    ├── Dashboard.jsx
    ├── ExpensesList.jsx
    ├── ExpenseModal.jsx
    ├── Budgets.jsx
    ├── Recurring.jsx
    ├── Installments.jsx
    ├── Reports.jsx
    ├── Comparison.jsx
    ├── UnparsedMessages.jsx
    ├── TelegramSettings.jsx
    ├── Audit.jsx
    └── BotChat.jsx
```
