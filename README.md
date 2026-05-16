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

## Supabase

El schema completo (12 tablas, RLS, triggers, índices) está en `supabase/schema.sql`.
Los datos iniciales (categorías, bancos, métodos de pago) están en `supabase/seed.sql`.

Ver guía detallada en **[docs/supabase.md](docs/supabase.md)**.

### Tablas

| Tabla | Descripción |
|---|---|
| `profiles` | Perfil 1:1 con auth.users (auto-creado al registrarse) |
| `categories` | Categorías globales + custom por usuario |
| `payment_methods` | Tarjeta, efectivo, transferencia |
| `banks` | Bancos disponibles |
| `expenses` | Gastos; campo `source`: manual / telegram / recurring |
| `budgets` | Presupuesto por categoría y mes |
| `recurring_expenses` | Gastos recurrentes con cargo automático |
| `installments` | Deudas en cuotas con seguimiento mensual |
| `telegram_accounts` | Vincula telegram_user_id con user_id |
| `telegram_messages` | Mensajes del bot (escritura solo desde backend) |
| `audit_logs` | Historial de acciones (escritura solo desde backend) |
| `app_settings` | Configuración por usuario |

### Pasos rápidos

```bash
# 1. En Supabase SQL Editor, ejecutar en orden:
#    supabase/schema.sql → Run
#    supabase/seed.sql   → Run

# 2. Instalar cliente
npm install @supabase/supabase-js

# 3. Crear src/lib/supabase.js con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
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
