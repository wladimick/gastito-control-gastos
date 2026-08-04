# Rediseño visual de Facturación

- **Fecha:** 2026-08-04
- **Rama:** `agent/facturacion-visual-20260804`
- **Autor:** ChatGPT · GPT-5.6 Thinking

## Objetivo

Aplicar en la página de Facturación el mismo lenguaje visual usado en la pantalla pública de Nicol, facilitando la lectura de ciclos, categorías, cuotas, movimientos pendientes y gastos compartidos.

## Cambios principales

- selector de ciclos mediante tarjetas horizontales;
- resumen del ciclo con monto informado, detalle conocido, monto compartido con Nicol y alertas;
- monto estimado visible cuando difiere del monto informado por el banco;
- resumen agregado por categoría con icono, porcentaje, cantidad de movimientos y monto compartido;
- categoría visible en cada movimiento;
- estados visuales para pendiente, revisar, fuera del total y compartido con Nicol;
- cuotas destacadas con `Este ciclo paga`, `Cuota X/Y` y `Última cuota`;
- visualización del monto original de la compra cuando corresponde;
- tarjetas de CMR y Banco de Chile con avance del detalle conocido, diferencia, vencimiento y monto compartido;
- distribución por categoría dentro de cada tarjeta;
- búsqueda por comercio, categoría o tipo;
- exportación CSV ampliada con categoría, monto original y datos de cuotas.

## Persistencia

La página reutiliza `category_id` de `billing_transactions` y la tabla `categories`. No se modifican montos, ciclos, estados, cuotas ni selecciones compartidas con Nicol.

## Archivos

- `src/components/Billing.jsx`
- `src/services/billingCyclesService.js`
