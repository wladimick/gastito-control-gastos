# Alineación de Cuentas, Presupuestos, Recurrentes y Reportes

- **Fecha:** 2026-08-04
- **Autor:** ChatGPT · GPT-5.6 Thinking

## Problemas observados

- Cuentas reconstruía pagos de tarjetas desde gastos y cuotas manuales, aunque Facturación ya contiene ciclos reales.
- El préstamo de $400.000 se veía dentro del saldo total sin explicar claramente qué parte era reserva.
- Presupuestos interpretaba un presupuesto inexistente como si el usuario se hubiera excedido y mostraba categorías sin actividad.
- Recurrentes sumaba juntos cargos directos y cargos a crédito, facilitando el doble conteo conceptual.
- Reportes filtraba el resumen por mes, pero varios gráficos inferiores acumulaban movimientos de otros periodos.

## Cambios

### Cuentas y flujo

- Usa `billing_cycles` como fuente para próximos pagos.
- Separa saldo total, reservas comprometidas, dinero libre y facturas próximas.
- Muestra el déficit o cobertura real sin usar la reserva SOS.
- Los recurrentes de crédito no se descuentan nuevamente fuera de las facturas.
- Se renovaron las vistas de cuentas y tarjetas manteniendo su CRUD.

### Presupuestos

- Estado explícito `Sin configurar` cuando no existen límites.
- Sugerencias automáticas basadas en los últimos tres meses.
- Proyección mensual adaptada al inicio del mes.
- Oculta categorías sin gasto, presupuesto ni historial.
- Permite aplicar sugerencias globales o por categoría.

### Recurrentes

- Nuevo resumen de ingresos, gastos directos, cargos en tarjeta, por cobrar y por pagar.
- Explicación visible de la regla de no duplicación.
- Agenda de próximos movimientos.
- Los cargos manuales ahora se rotulan como `Registrar gasto`.
- Se conserva la administración completa anterior dentro de la nueva interfaz.

### Reportes

- Todos los cálculos respetan el mes seleccionado.
- Se separa consumo del mes de compromisos de caja.
- Las facturas se leen desde Facturación.
- Resumen por categoría, banco y origen usando solo el periodo activo.
- Comparación contra el mes anterior, tendencia de seis meses y observaciones útiles.
