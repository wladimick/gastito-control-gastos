# Sincronización de gastos de crédito con Facturación

**Fecha:** 2026-08-05  
**Actividad:** incorporar automáticamente a Facturación los gastos manuales registrados con tarjeta de crédito.

## Problema

Los gastos manuales aparecían en la página Gastos, pero no en Facturación aunque el usuario seleccionara tarjeta de crédito y un banco con una tarjeta activa.

## Solución

- Se agrega una relación entre `billing_transactions` y el gasto manual de origen mediante `manual_expense_id`.
- Un trigger sincroniza cada gasto manual cuyo medio sea `tarjeta` y tipo `credito`.
- El ciclo se determina con la fecha local de Chile y la configuración real de la tarjeta: inicio, cierre y vencimiento.
- Si el gasto es editado, se mueve o actualiza en el ciclo correspondiente.
- Si el gasto deja de ser de crédito, se elimina de Facturación.
- Si el gasto se elimina, su movimiento de Facturación se elimina por cascada.
- Las compras en cuotas registran el monto original y la primera cuota; las siguientes quedan disponibles para la proyección de cuotas.
- El monto estimado del ciclo se recalcula sin reemplazar un monto final informado por el banco.

## Resultado esperado

Un gasto registrado como crédito Banco Falabella, por ejemplo, aparece automáticamente en el ciclo CMR correspondiente y continúa mostrándose una sola vez en Gastos gracias a la conciliación existente.
