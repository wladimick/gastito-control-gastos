# Nueva Proyección · Beta

Fecha: 2026-09-07

## Objetivo

Crear una página paralela a **Proyección** para probar una experiencia más visual y orientada a decisiones, sin modificar ni eliminar la página actual.

## Preguntas que debe responder

- ¿Cómo se distribuyó mi gasto entre Banco Chile, Banco Falabella y otros medios?
- ¿Cómo cambia esa distribución durante los próximos seis meses?
- ¿Cuánto he gastado en Supermercado, Bencina, Farmacia u otra categoría a través del tiempo?
- ¿Cuánto de los próximos meses ya está comprometido en recurrentes y cuotas?
- ¿Qué pasa si hago una compra futura, incluso en cuotas?
- ¿Cuánto margen conservador tengo para gastar extra en un mes determinado sin deteriorar los meses posteriores?

## Horizonte

La página usa nueve barras:

- tres meses completos anteriores: gasto real por fecha de compra;
- mes actual + cinco meses siguientes: salida esperada desde el motor de Proyección.

## Gráfico por banco

Colores principales:

- Banco Chile: azul;
- Banco Falabella / CMR: verde;
- Otros: gris.

Filtros:

- Todos;
- Banco Chile;
- Banco Falabella;
- Otros.

Capas visuales que no duplican el total:

- Recurrentes: naranja;
- Cuotas: violeta;
- Simulaciones: rosado.

Las capas se muestran como líneas proporcionales bajo cada barra para evitar sumar dos veces conceptos que ya forman parte de la facturación o de otros egresos.

## Gráfico por categoría

Usa los mismos nueve meses. Las categorías con mayor actividad aparecen como filtros rápidos y conservan los colores del catálogo de Gastito.

El histórico utiliza gastos conciliados. Para el futuro se priorizan datos conocidos (facturación, recurrentes, cuotas y simulaciones) y el remanente se distribuye según el comportamiento histórico de los tres meses anteriores. Por esa razón el futuro debe interpretarse como estimación, no como estado de cuenta oficial.

## Capacidad de gasto

Para cada mes futuro se calcula un **margen conservador**. El cálculo no revisa solo ese mes: observa también todos los meses posteriores del horizonte.

Se conserva un colchón mínimo equivalente al mayor entre:

- $100.000 CLP;
- 10% de los ingresos previstos del mes.

El margen corresponde al gasto extraordinario máximo que podría agregarse sin que ninguno de los meses posteriores baje de ese colchón, según los datos disponibles en la proyección.

No es una recomendación crediticia ni una garantía de liquidez futura: es una ayuda de planificación basada en los registros actuales de Gastito.

## Simulador

Permite agregar una compra temporal con:

- descripción;
- monto total;
- fecha de inicio;
- número de cuotas;
- banco;
- categoría.

Las simulaciones se mantienen únicamente en el estado local de la página beta. No escriben en Supabase ni crean gastos reales.

## Integración

La nueva vista aparece como **Nueva Proyección · Beta** en el menú Flujo. La vista histórica **Proyección** permanece intacta para poder compararlas antes de decidir cuál conservar.

## Fuentes reutilizadas

- `buildProjectionPlan` para el flujo futuro;
- `billing_cycles` para facturación conocida;
- `billing_forecasts` para pisos informados en estados de cuenta;
- gastos conciliados para el histórico;
- recurrentes, ingresos, cuentas por pagar y cuotas existentes;
- saldo libre de Mercado Pago y liquidaciones de sueldo mediante las mismas capas de auditoría de la Proyección actual.

## QA antes de merge

- ejecutar `npm test`;
- ejecutar `npm run build`;
- revisar desktop;
- revisar iPhone con tamaño normal y A+;
- validar filtro Banco Chile;
- validar filtro Falabella;
- validar categoría Supermercado;
- activar/desactivar Recurrentes, Cuotas y Simulaciones;
- simular compra al contado y en 3/6 cuotas;
- verificar que ninguna simulación se escriba en Supabase;
- comparar octubre con Facturación para validar atribución CMR/Falabella.
