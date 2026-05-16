# Gastito — Guía Supabase

## Tablas

| Tabla | Tipo | RLS | Descripción |
|---|---|---|---|
| `payment_methods` | Global | Lectura pública | Tarjeta, efectivo, transferencia |
| `banks` | Global | Lectura pública | Banco Chile, Estado, Santander, BCI, Itaú |
| `profiles` | Usuario | Sí | 1:1 con auth.users, se crea automáticamente al registrarse |
| `categories` | Global + usuario | Sí | user_id null = global; user_id set = custom del usuario |
| `expenses` | Usuario | Sí | Gastos; campo `source` indica si viene de UI, bot o recurrente |
| `budgets` | Usuario | Sí | Presupuesto por categoría y mes (YYYY-MM) |
| `recurring_expenses` | Usuario | Sí | Gastos recurrentes con cargo manual o auto |
| `installments` | Usuario | Sí | Deudas en cuotas con seguimiento de pago mensual |
| `telegram_accounts` | Usuario | Sí | Vincula telegram_user_id con user_id de Supabase |
| `telegram_messages` | Usuario | Solo lectura | Mensajes crudos del bot; escritura solo desde backend |
| `audit_logs` | Usuario | Solo lectura | Historial de acciones; escritura solo desde backend |
| `app_settings` | Usuario | Sí | Configuración por usuario (moneda, zona horaria, bot) |

## Configuración en Supabase

### 1. Crear proyecto

1. Ir a [supabase.com](https://supabase.com) → **New project**
2. Elegir región más cercana (South America si está disponible, si no US East)
3. Guardar la contraseña de base de datos

### 2. Ejecutar el schema

En **SQL Editor** → **New query**:

```
1. Pegar supabase/schema.sql completo → Run
2. Pegar supabase/seed.sql completo   → Run
```

Verificar en **Table Editor** que aparecen las 12 tablas y los datos de seed.

### 3. Obtener credenciales

**Project Settings → API:**
- `Project URL` → va a `VITE_SUPABASE_URL`
- `anon public key` → va a `VITE_SUPABASE_ANON_KEY`
- `service_role key` → solo para el backend del bot (NUNCA en el frontend)

### 4. Variables de entorno

```bash
# .env.local (frontend)
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Variables del backend (Vercel o servidor del bot)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
TELEGRAM_BOT_TOKEN=1234567890:AAF...
TELEGRAM_WEBHOOK_URL=https://tu-dominio.vercel.app/api/telegram
```

## Decisiones de diseño

### RLS (Row Level Security)
Todas las tablas de usuario tienen RLS activo. Las policies garantizan que `auth.uid() = user_id` en cada operación. El cliente nunca puede ver datos de otro usuario aunque conozca el ID.

### Tablas de solo lectura para el cliente
- `telegram_messages` — el bot escribe con `service_role` desde el backend
- `audit_logs` — el backend o triggers de Postgres escriben; el cliente solo lee

### categories con user_id nullable
Las categorías con `user_id = null` son globales y se cargan vía seed. Un usuario puede crear categorías propias (con su `user_id`) sin afectar a otros usuarios. La policy de SELECT permite ver ambas.

### expenses.source
El campo `source` permite saber el origen del gasto:
- `'manual'` — creado desde la UI
- `'telegram'` — creado por el bot; tiene `telegram_message_id` asociado
- `'recurring'` — generado automáticamente desde un gasto recurrente

### Trigger handle_new_user
Al crear un usuario en `auth.users`, el trigger inserta automáticamente una fila en `profiles` y en `app_settings` con los valores por defecto. No requiere acción del frontend.

## Instalar el cliente

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

## Consultas típicas

```js
// Gastos del mes actual
const { data } = await supabase
  .from('expenses')
  .select('*, categories(label, icon, color), banks(label)')
  .gte('expense_date', '2026-05-01')
  .lt('expense_date', '2026-06-01')
  .order('expense_date', { ascending: false })

// Presupuestos del mes
const { data } = await supabase
  .from('budgets')
  .select('*, categories(label, icon, color)')
  .eq('month', '2026-05')

// Guardar un gasto
const { data, error } = await supabase
  .from('expenses')
  .insert({
    user_id: session.user.id,
    amount: 12500,
    description: 'Bencina Copec',
    expense_date: new Date().toISOString(),
    source: 'manual',
  })
  .select()
  .single()
```

## Telegram Bot — flujo de datos

```
Telegram → POST /api/telegram (Vercel Edge Function)
  ↓
Parsear texto con NLP simple
  ↓
INSERT en telegram_messages (service_role)
  ↓
Si parseado OK → INSERT en expenses (service_role)
  ↓
Responder al chat de Telegram con confirmación
```

El endpoint necesita la `SUPABASE_SERVICE_ROLE_KEY` para saltar RLS y escribir en nombre del usuario identificado por `telegram_accounts.telegram_user_id`.
