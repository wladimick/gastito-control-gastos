# Sincronización automática de Mercado Pago

Gastito importa los movimientos de la cuenta Mercado Pago usando el **Reporte de Liberaciones** de la API oficial.

El diseño separa:

1. `mercadopago_movements`: libro completo de movimientos de la billetera (entradas, salidas, transferencias, devoluciones y costos).
2. `expenses`: solo se crea un gasto cuando el movimiento puede clasificarse razonablemente como consumo o costo financiero.

Esto evita tratar una transferencia entre cuentas propias como gasto.

## Estado de la implementación

- Edge Function: `mercadopago-sync`.
- Ejecución programada: cada hora, minuto 23, mediante `pg_cron` + `pg_net`.
- Ventana de relectura: 4 días por defecto.
- Deduplicación: `movement_key` SHA-256 + unique `(user_id, movement_key)`.
- Saldo: cuando el reporte trae `BALANCE_AMOUNT`, se actualiza el saldo de la cuenta Gastito enlazada a Mercado Pago.
- Comercios ambiguos: quedan con `review_status = review_required` y, si generan un gasto, el gasto queda `revisar`.
- Sincronización manual disponible con `runMercadoPagoSync()` desde `src/services/mercadoPagoService.js`.

## Credencial pendiente

El Access Token **no se guarda en GitHub, Vite ni localStorage**. Se almacena cifrado en Supabase Vault con el nombre:

`mercadopago_access_token`

Cuando tengamos la credencial de producción se puede cargar con:

```sql
select vault.create_secret(
  '<ACCESS_TOKEN_DE_PRODUCCION>',
  'mercadopago_access_token',
  'Mercado Pago production access token',
  null
);
```

La Edge Function también admite `MERCADOPAGO_ACCESS_TOKEN` como variable de entorno, pero Vault es el mecanismo preferido para Gastito.

En el primer sync con un token válido la función:

1. valida la cuenta con `GET /users/me`;
2. consulta o crea la configuración de `/v1/account/release_report/config`;
3. procesa el último reporte generado que esté `processed`;
4. solicita un nuevo reporte de los últimos días con `POST /v1/account/release_report`;
5. en la ejecución siguiente descarga el archivo procesado, importa movimientos y actualiza saldo.

## Clasificación

- débito `payment` → `expense`;
- débito de fee/tax/interest → `fee` y categoría de costos financieros;
- `withdrawal` / `payout` / `transfer` → transferencia, no gasto;
- crédito → ingreso/movimiento entrante, sin crear ingreso recurrente;
- refund/cancel → devolución;
- cualquier caso incierto → `other` + `review_required`.

Cuando existe `SOURCE_ID` para un payment se intenta consultar `/v1/payments/{id}` para enriquecer el comercio. Si no es accesible, se conserva la descripción contable y el movimiento puede quedar para revisión.

## Tablas

### `mercadopago_sync_config`
Configuración y estado de la conexión por usuario.

### `mercadopago_movements`
Movimiento contable importado. Puede enlazar a `expenses` cuando corresponde a un gasto real.

### `mercadopago_sync_runs`
Auditoría de cada ejecución automática/manual.

### `mercadopago_sync_auth`
Solo guarda el hash del token interno usado por el cron. El token real del cron vive cifrado en Supabase Vault.

## Seguridad

- RLS activo en configuración, movimientos y ejecuciones.
- El usuario solo puede leer sus propios datos.
- El cron usa un secreto interno de Vault que nunca se guarda en GitHub.
- La Edge Function usa `SUPABASE_SERVICE_ROLE_KEY` solo en servidor.
- `get_mercadopago_access_token()` solo puede ser ejecutada por `service_role`.
- El Access Token de Mercado Pago queda cifrado en Vault.

## Operación sin credencial

Mientras `mercadopago_access_token` no exista, el cron continúa activo pero termina como `skipped` con `reason = missing_access_token`; no modifica saldo ni movimientos.
