# Dashboard y fechas financieras consistentes

**Fecha:** 2026-08-05  
**Actividad:** reemplazar cálculos paralelos y centralizar el tratamiento de fechas.

## Cambios

- Dashboard obtiene los próximos pagos directamente desde `billing_cycles`.
- Se retiran los estados de cuenta históricos guardados en `localStorage`.
- Se agrega un estado visible cuando Facturación no puede cargarse y la vista contiene datos parciales.
- Se separan el saldo operativo y la reserva/ahorro.
- Los próximos vencimientos muestran monto final, monto en curso, movimientos por revisar y base compartida con Nicol.
- Comparación enfrenta el mes actual contra el mismo número de días del mes anterior.
- Se agrega una proyección al cierre y desglose por categoría y medio de pago.
- Las fechas bancarias `YYYY-MM-DD` se mantienen como fecha civil y los timestamps se convierten usando `America/Santiago`.
- Se agregan pruebas automáticas con `node:test`; el build las ejecuta antes de compilar.

## Resultado

Dashboard, Facturación y Comparación utilizan una interpretación coherente de ciclos, vencimientos y fechas de Chile, evitando que un movimiento cambie de día o mes por una conversión UTC incorrecta.
