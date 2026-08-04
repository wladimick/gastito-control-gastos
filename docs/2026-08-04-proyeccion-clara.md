# Rediseño funcional de la página Proyección

- **Fecha:** 2026-08-04
- **Rama:** `agent/proyeccion-clara-20260804`
- **Autor:** ChatGPT · GPT-5.6 Thinking

## Problemas detectados

La página anterior mantenía una lógica paralela al resto de Gastito:

- facturaciones manuales almacenadas en `localStorage`;
- un monto fijo de `Contado CMR` de $370.000;
- un monto fijo de `Débito MP` de $50.000;
- cobros y pagos pendientes repetidos en todos los meses;
- cálculo exclusivo para Falabella en compras de una cuota;
- riesgo de duplicar factura completa, cuotas y movimientos de tarjeta;
- demasiados controles técnicos antes de explicar el resultado.

## Nueva lógica

Se creó `projectionPlanService.js` para construir una proyección de seis meses desde las fuentes actuales:

- saldos de cuentas activas;
- ingresos recurrentes;
- gastos recurrentes;
- facturas reales de CMR y Banco de Chile;
- cuotas conciliadas;
- por cobrar y por pagar según vencimiento;
- promedio de gastos variables reales;
- compras hipotéticas del usuario.

## Escenarios

### Comprometido

Incluye únicamente obligaciones conocidas:

- facturas existentes;
- cuotas futuras;
- gastos recurrentes;
- deudas por pagar;
- ingresos recurrentes.

### Realista

Agrega un promedio mensual de gastos variables obtenido desde movimientos reales no recurrentes.

### Con simulaciones

Agrega las compras futuras creadas por el usuario, permitiendo definir monto, fecha, categoría y número de cuotas.

## Reglas para evitar duplicados

1. Cuando existe una factura para un mes, su monto reemplaza la estimación de tarjeta y las cuotas individuales de ese mismo mes.
2. Cuando no existe una factura, se proyectan las cuotas conciliadas, recurrentes de crédito y gasto variable promedio.
3. Los recurrentes pagados directamente se muestran separados de los cargos asociados a tarjetas.
4. Los por cobrar y por pagar se agregan una sola vez según su fecha de vencimiento.
5. Los cobros atrasados quedan excluidos por defecto, porque no existe certeza de la fecha de pago.
6. El mes actual considera solo los ingresos y recurrentes cuyo día aún no ha pasado.

## Nueva interfaz

- selector visible entre `Comprometido`, `Realista` y `Con simulaciones`;
- saldo disponible hoy;
- saldo esperado al terminar el periodo actual;
- menor saldo de los próximos seis meses;
- salidas próximas;
- tarjetas mensuales con nivel de riesgo;
- etiquetas `Factura confirmada`, `Factura en curso` y `Monto proyectado`;
- detalle desplegable de entradas y salidas;
- panel de supuestos opcional;
- control para incluir ahorros, deudas y cobros pendientes;
- gasto variable automático o ajustable manualmente;
- módulo simple de simulaciones.

## Datos revisados al momento del cambio

- saldo operativo activo: $145.612;
- ingresos recurrentes activos: $1.252.000 mensuales;
- recurrentes activos totales: $242.358;
- facturas conocidas de agosto: $977.272;
- facturas de septiembre en curso: $768.841 usando el mayor monto disponible entre informado, estimado y detalle leído;
- deuda por pagar: $400.000 con vencimiento en diciembre de 2026;
- por cobrar atrasado y pendiente: $101.780, excluido por defecto;
- 26 seguimientos manuales de cuotas conciliados con los planes bancarios disponibles.

## Archivos

- `src/components/Projection.jsx`: redirección hacia la nueva implementación.
- `src/components/ProjectionV2.jsx`: nueva interfaz.
- `src/services/projectionPlanService.js`: motor de cálculo.

## Validación

- build Vite correcto;
- 123 módulos transformados;
- preview Vercel `READY`;
- respuesta HTTP 200;
- no se modificaron tablas ni registros de Supabase.
