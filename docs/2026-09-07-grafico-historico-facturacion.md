# Gráfico histórico de Facturación por banco

- **Fecha:** 2026-09-07
- **Rama:** `agent/reconcile-20260907`
- **Módulo:** Facturación

## Objetivo

Incorporar en Gastito un resumen visual de seis meses similar al mockup aprobado: cada barra representa la facturación total del ciclo y se divide proporcionalmente por banco.

## Decisiones funcionales

- Banco de Chile usa azul `#2563EB`.
- Banco Falabella usa verde `#2EAE45`.
- El gráfico termina en el ciclo más reciente disponible en Supabase y muestra los cinco meses anteriores.
- Los meses sin datos se conservan en la línea temporal con total cero.
- Cada barra es apilada: el tamaño de cada color representa el porcentaje que aporta el banco al total mensual.
- El último ciclo disponible se destaca como la facturación actual.
- Al tocar o hacer clic en un mes, el panel inferior cambia para mostrar el detalle de ese ciclo por banco.
- En móvil el gráfico permite desplazamiento horizontal para mantener seis barras legibles.

## Fuente de verdad del monto

Para cada tarjeta/ciclo se usa esta prioridad:

1. Si el ciclo está conciliado o el monto informado es final, se usa `reported_amount`.
2. Si el ciclo sigue abierto, se usa `estimated_amount` cuando existe.
3. Si no existe estimación, se usa el detalle conocido (`calculated_amount`).
4. Como último fallback se usa el monto informado parcial.

Esto permite que un ciclo cerrado muestre el valor oficial y que un ciclo abierto evolucione con los movimientos confirmados.

### Ejemplo actual validado

- Septiembre 2026:
  - Banco Chile: $148.353 → 14%.
  - Banco Falabella: $883.550 → 86%.
  - Total: $1.031.903.
- Octubre 2026:
  - Banco Chile: $0 → 0%.
  - Banco Falabella: $692.384 estimados → 100%.
  - Total: $692.384.

## Archivos

- `src/lib/billingHistoryChart.js`: modelo, agregación mensual, reglas de monto y porcentajes.
- `src/components/BillingHistoryChart.jsx`: visualización responsive e interacción por mes.
- `src/components/Billing.jsx`: integración dentro del módulo Facturación.
- `tests/billing-history-chart.test.js`: pruebas unitarias de seis meses, porcentajes y prioridad de montos.

## QA requerido antes de merge

- `npm test`.
- `npm run build`.
- Revisar que septiembre muestre $1.031.903 con proporción 14% / 86%.
- Revisar que octubre muestre $692.384 con 0% / 100%.
- Validar scroll y legibilidad en iPhone con A, A- y A+.
- Validar desktop y tablet.
- Confirmar que al seleccionar un mes cambia el panel inferior.
- Confirmar que una importación JSON refresca el gráfico.
- Confirmar que no se realizan escrituras nuevas en Supabase: el componente es solo lectura.

## Alcance de base de datos

No requiere migraciones ni nuevas tablas. Consume los ciclos existentes mediante `fetchBillingCycles()`.
