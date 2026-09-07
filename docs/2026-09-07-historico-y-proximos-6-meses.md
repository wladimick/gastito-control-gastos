# Proyección · gasto real y próximos 6 meses

- **Fecha:** 2026-09-07
- **Rama:** `agent/proyeccion-historico-futuro-20260907`
- **Motivo:** separar la lectura histórica de Facturación y llevar la comparación histórico/futuro a Proyección.

## Decisión de producto

El gráfico de barras que se incorporó inicialmente en **Facturación** se mueve a **Proyección**.

Facturación queda enfocada en la fuente de verdad de tarjetas:

- ciclos;
- estados de cuenta;
- montos informados;
- movimientos;
- conciliación;
- pagos.

Proyección pasa a responder una pregunta distinta:

> ¿Cuánto gasté realmente y cuánto dinero podría salir durante los próximos meses?

## Ventana temporal

El nuevo gráfico utiliza 9 meses:

- **3 meses completos anteriores:** gasto real registrado;
- **6 meses desde el mes actual:** salida futura esperada.

Ejemplo al estar en septiembre de 2026:

- histórico: junio, julio y agosto;
- proyección: septiembre, octubre, noviembre, diciembre, enero y febrero.

## Colores

- Banco Chile: azul `#1E5EFF`;
- Banco Falabella / CMR: verde `#2FAA30`;
- Otros gastos: gris `#8B8F97`.

"Otros gastos" es necesario porque la vista representa el gasto total, no únicamente tarjetas. Incluye débito, transferencias, efectivo, gastos fijos directos, pagos por hacer y componentes futuros que no pueden atribuirse de forma segura a una tarjeta específica.

## Histórico

La fuente es la lista unificada de Gastos que ya concilia:

- registros manuales;
- movimientos de tarjeta;
- duplicados manual/tarjeta.

Se agrupa por **fecha real de compra** y se excluyen:

- pendientes;
- movimientos por revisar;
- pagos de tarjeta;
- abonos.

Esto evita que pagar una factura vuelva a contarse como un gasto nuevo.

## Futuro

El gráfico reutiliza `buildProjectionPlan` con escenario `realistic` y horizonte de seis meses.

Por tanto, la salida esperada puede contener:

- facturas de tarjeta confirmadas;
- ciclos en curso;
- cuotas futuras;
- pisos de vencimientos informados por estados de cuenta (`billing_forecasts`);
- recurrentes directos;
- gasto variable estimado a partir del historial;
- cuentas por pagar incluidas en el modelo.

Cuando una factura o cuota futura tiene `cardId`, se atribuye al banco correspondiente. Un monto sin banco seguro se mantiene en "Otros gastos" en vez de adivinar su origen.

## Por qué los meses antiguos de Facturación parecían vacíos

El gráfico anterior solo podía representar lo existente en `billing_cycles`. En producción, mayo, junio y julio de 2026 contienen ciclos parciales o movimientos aislados, no estados de cuenta completos. Agosto y septiembre sí tienen montos históricos mucho más completos.

Esto no es un fallo de renderizado: refleja que el historial de estados de cuenta no fue cargado retrospectivamente de forma completa.

Para una comparación de gasto histórico resulta más representativo usar la vista unificada de movimientos, que es la fuente utilizada ahora en Proyección.

## Interacción

- las nueve barras son seleccionables;
- el panel inferior muestra total y distribución por Banco Chile, Banco Falabella y Otros;
- cada barra se identifica como **Real** o **Proyección**;
- existe una separación visual entre histórico y futuro;
- en móvil el gráfico mantiene las nueve barras mediante desplazamiento horizontal.

## Archivos

- `src/lib/projectionSpendingTimeline.js`
- `src/components/ProjectionSpendingTimeline.jsx`
- `src/components/ProjectionWithBalanceStatus.jsx`
- `src/components/Billing.jsx`
- `tests/projection-spending-timeline.test.js`

## QA

Antes de merge:

1. ejecutar `npm test`;
2. ejecutar `npm run build`;
3. revisar Proyección en móvil y escritorio;
4. validar que aparecen exactamente 3 meses reales + 6 proyectados;
5. confirmar Banco Chile azul y Falabella verde;
6. comprobar que pagos de tarjeta no se duplican como gasto histórico;
7. comprobar que los pisos de `billing_forecasts` participan del futuro;
8. confirmar que Facturación ya no muestra este gráfico y mantiene sus ciclos sin regresiones.
