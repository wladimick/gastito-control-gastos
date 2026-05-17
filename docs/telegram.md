# Gastito — Integración Telegram Bot

## Arquitectura

```
Usuario en Telegram → Telegram API → Supabase Edge Function
                                              ↓
                                    Parsea el mensaje
                                              ↓
                            telegram_messages + expenses (Supabase)
                                              ↓
                                    Responde al usuario
```

## Requisitos previos

1. Schema y seed de Supabase ejecutados (`supabase/schema.sql`, `supabase/seed.sql`)
2. `supabase/telegram-linking.sql` ejecutado (tabla `linking_codes`)
3. Bot creado en [@BotFather](https://t.me/BotFather) → obtienes el token
4. [Supabase CLI](https://supabase.com/docs/guides/cli) instalado

## Variables de entorno (secrets en Supabase Edge Functions)

| Secret | Descripción | Cómo obtener |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Token del bot | @BotFather → /newbot |
| `TELEGRAM_WEBHOOK_SECRET` | String aleatorio para validar requests | `openssl rand -hex 20` |

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` están disponibles automáticamente.

## Pasos de despliegue

### 1. Ejecutar SQL adicional

En **Supabase SQL Editor**, ejecutar `supabase/telegram-linking.sql`.

### 2. Configurar secrets en Supabase

```bash
supabase secrets set TELEGRAM_BOT_TOKEN=1234567890:AAF...
supabase secrets set TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 20)
```

### 3. Vincular proyecto Supabase (primera vez)

```bash
supabase login
supabase link --project-ref <tu-project-ref>
```

El `project-ref` está en Supabase → Project Settings → General.

### 4. Desplegar la Edge Function

```bash
supabase functions deploy telegram-webhook --no-verify-jwt
```

La URL resultante será:
```
https://<project-ref>.supabase.co/functions/v1/telegram-webhook
```

### 5. Registrar el webhook con Telegram

```bash
# Primero obtén el TELEGRAM_WEBHOOK_SECRET que usaste:
supabase secrets list

# Registrar webhook:
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<project-ref>.supabase.co/functions/v1/telegram-webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

Verificar registro:
```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

## Flujo de vinculación

```
App (usuario logueado) → genera código 6 chars → guarda en linking_codes
         ↓
Usuario en Telegram → /vincular CÓDIGO
         ↓
Edge Function → verifica código → inserta telegram_accounts
         ↓
✅ "Cuenta vinculada"
```

1. Usuario abre la app → vista **Telegram** → "Generar código de vinculación"
2. Aparece el código (ej. `A3X7KQ`) válido 15 minutos
3. Usuario escribe en Telegram: `/vincular A3X7KQ`
4. El bot confirma y el código se elimina

## Mensajes soportados

| Formato | Ejemplo |
|---|---|
| Gasto básico | `Gasté 12.500 en bencina` |
| Con banco | `12.500 bencina crédito Banco Chile` |
| Con fecha | `8.990 supermercado ayer débito` |
| Solo monto + categoría | `45000 comida` |

### Comandos

| Comando | Descripción |
|---|---|
| `/start` | Instrucciones de vinculación |
| `/vincular CÓDIGO` | Vincula la cuenta |
| `/hoy` | Resumen del día |
| `/mes` | Resumen del mes |
| `/ayuda` | Formatos aceptados |

## Categorías detectadas

| Palabras clave | Categoría |
|---|---|
| bencina, copec, shell, combustible | Bencina |
| supermercado, lider, jumbo, tottus | Supermercado |
| comida, almuerzo, cena, restaurant, rappi | Comida |
| farmacia, remedios, salcobrand, ahumada | Farmacia |
| metro, uber, taxi, bus, bip | Transporte |
| netflix, spotify, amazon, disney | Suscripciones |
| arriendo, luz, agua, gas, internet | Hogar |

## Logs y debugging

```bash
# Ver logs de la Edge Function en tiempo real
supabase functions logs telegram-webhook --tail

# Verificar mensajes guardados en Supabase
# Table Editor → telegram_messages → filtrar parsed=false para ver errores
```

## Datos que guarda

**Siempre** (todo mensaje con cuenta vinculada):
- Fila en `telegram_messages` con el texto crudo, `received_at`, `parsed`, `parse_error`

**Si parseado correctamente**:
- Fila en `expenses` con `source='telegram'`, `telegram_message_id` referenciando el mensaje
- `telegram_messages.parsed = true`, `expense_id` apuntando al gasto

**Si no parseable**:
- `telegram_messages.parsed = false`, `parse_error` con la razón
- Aparece en la vista **Sin interpretar** de la app para completar manualmente
