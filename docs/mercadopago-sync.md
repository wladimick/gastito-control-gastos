# Sincronización automática de Mercado Pago

Gastito puede importar los movimientos de la cuenta Mercado Pago usando el **Reporte de Liberaciones** de la API oficial. El objetivo es mantener dos cosas separadas:

1. `mercadopago_movements`: libro de movimientos de la billetera (entradas, salidas, transferencias, devoluciones y costos).
2. `expenses`: solo se crea un gasto cuando el movimiento puede clasificarse razonablemente como consumo o costo financiero.

Esto evita tratar una transferencia entre cuentas propias como gasto.

## Estado de la implementación

- Edge Function: `mercadopago-sync`
- Ejecución programada: cada hora, minuto 23, mediante `pg_cron` + `pg_net`.
- Ventana de relectura: 4 días por defecto.
- Deduplicación: `movement_key` SHA-256 + unique `(user_id, movement_key)`.
- Saldo: cuando el reporte trae `BALANCE_AMOUNT`, se actualiza el saldo de la cuenta Gastito enlazada a Mercado Pago.
- Comercios ambiguos: quedan con `review_status = review_required` y, si generan un gasto, el gasto queda `revisar`.
- La sincronización se puede lanzar manualmente con `runMercadoPagoSync()` desde `src/services/mercadoPagoService.js`.

## Credencial pendiente

No existe ningún Access Token en el repositorio. Para activar la integración hay que agregar en los secretos de Supabase Edge Functions:

`MERCADOPAGO_ACCESS_TOKEN=<ACCESS_TOKEN_DE_PRODUCCION>`

Nunca debe ir en Vite, localStorage, tablas visibles al cliente ni GitHub.

En el primer sync con un token válido la función:

1. valida la cuenta con `GET /users/me`;
2. consulta o crea la configuración de `/v1/account/release_report/config`;
3. procesa el último reporte generado que esté `processed`;
4. solicita un nuevo reporte de los últimos días con `POST /v1/account/release_report`;
5. en la ejecución siguiente descarga el archivo ya procesado, importa movimientos y actualiza saldo.

## Clasificación

- débito `payment` -> `expense`;
- débito de fee/tax/interest -> `fee` y categoría Costos financieros;
- `withdrawal` / `payout` / `transfer` -> transferencia, no gasto;
- crédito -> ingreso/movimiento entrante, sin crear ingreso recurrente;
- refund/cancel -> devolución;
- cualquier caso incierto -> `other` + `review_required`.

Cuando existe `SOURCE_ID` para un payment se intenta consultar `/v1/payments/{id}` para enriquecer el nombre del comercio. Si no es accesible, se conserva la descripción contable del reporte y el movimiento puede quedar para revisión.

## Tablas

### `mercadopago_sync_config`
Configuración y estado de la conexión por usuario.

### `mercadopago_movements`
Movimiento contable importado. Puede enlazar a `expenses` cuando corresponde a un gasto real.

### `mercadopago_sync_runs`
Auditoría de cada ejecución automática/manual.

### `mercadopago_sync_auth`
Solo guarda el hash del token interno usado por el cron. El token real vive cifrado en Supabase Vault.

## Seguridad

- RLS activo en configuración, movimientos y ejecuciones.
- El usuario solo puede leer sus propios datos.
- El cron usa un secreto interno en Supabase Vault; el repositorio solo contiene el nombre del secreto.
- La Edge Function usa `SUPABASE_SERVICE_ROLE_KEY` únicamente en servidor.
- El Access Token de Mercado Pago será un secreto de servidor.

## Operación

Mientras `MERCADOPAGO_ACCESS_TOKEN` no exista, el cron continúa activo pero termina como `skipped` con `reason = missing_access_token`; no modifica saldo ni movimientos.
