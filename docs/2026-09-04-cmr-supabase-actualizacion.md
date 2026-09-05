# Actualización CMR Digital y Supabase

- **Fecha:** 2026-09-04
- **Rama:** `agent/facturacion-json-cmr-20260902`
- **Proyecto Supabase:** `control gastos`
- **Tarjeta:** CMR Falabella •••• 3867

## Fuente validada

Captura de CMR Digital del 04/09/2026 con:

- próxima facturación: **19/09/2026**;
- gastos del período: **$593.338**;
- utilizado: **$1.705.203**;
- disponible: **$2.084.797**;
- límite configurado: **$3.790.000**;
- pendiente de confirmación Mayorista DyL: **$50.926**.

La suma `utilizado + disponible` coincide exactamente con el límite configurado de la tarjeta.

## Cambios aplicados en Supabase

Se aplicaron las migraciones:

1. `billing_json_import`
   - RPC `public.import_billing_json(...)`;
   - previsualización sin escritura;
   - deduplicación;
   - asignación automática al ciclo;
   - soporte de cuotas;
   - soporte de movimientos pendientes y movimientos visibles fuera del total.

2. `harden_billing_json_import`
   - se revocó ejecución al rol `anon`;
   - se mantuvo ejecución solo para `authenticated`;
   - se fijó `search_path` de la función normalizadora.

## Datos CMR incorporados

Se incorporaron los movimientos conocidos entre el 24 y el 31 de agosto que faltaban en el ciclo vigente, además de:

- **Tommy Beans:** $18.780, 31/08;
- **Jumbo:** $18.640, 31/08;
- **Mayorista DyL:** $50.926 como pendiente, sin fecha confirmada y fuera del total;
- **Impuesto compra cuotas:** $76 registrado como movimiento visible, pero fuera del total informado por CMR a esta fecha.

No se reinsertaron los movimientos del 21/08 ni las cuotas de julio que ya existían en el ciclo.

## Cuadratura final

Ciclo CMR vigente:

- período: **20/08/2026–19/09/2026**;
- vencimiento: **05/10/2026**;
- estado: `in_progress`;
- informado: **$593.338**;
- estimado: **$593.338**;
- detalle que afecta total: **$593.338**;
- movimientos totales en el ciclo: **34**;
- pendientes: **1** por **$50.926**.

La cuadratura entre CMR Digital y Gastito queda en **$0 de diferencia** para los gastos del período.

## Regla de pendientes

Un movimiento con `is_pending: true` puede no tener fecha confirmada. Se asigna al ciclo vigente para visualización, conserva `transaction_date = null` y por defecto queda con `affects_cycle_total = false` hasta que sea confirmado.

## Regla de total informado

El importador admite `affects_cycle_total: false` para casos donde el banco muestra un movimiento en pantalla, pero todavía no lo incorpora al total del período. Esto permitió reflejar exactamente el snapshot de CMR del 04/09/2026.

## Seguridad revisada

Se verificó después del despliegue:

- `anon` **no** puede ejecutar `import_billing_json`;
- `authenticated` **sí** puede ejecutarla;
- la función valida que la tarjeta pertenezca al usuario autenticado.

Quedan hallazgos globales de seguridad previos en el proyecto Supabase que no forman parte de esta implementación y deben tratarse en una tarea separada.
