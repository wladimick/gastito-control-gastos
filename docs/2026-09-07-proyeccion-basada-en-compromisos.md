# Nueva Proyección basada en compromisos reales

Fecha: 2026-09-07

## Decisión funcional

La página **Nueva Proyección · Beta** deja de completar el futuro con estimaciones automáticas de gasto variable o cuentas por pagar genéricas.

La vista se limita a información que pueda justificarse:

- gastos reales de los 3 meses históricos;
- facturación conocida de Banco Chile y Banco Falabella/CMR;
- cuotas comprometidas todavía no cubiertas por una factura;
- gastos recurrentes configurados;
- simulaciones creadas explícitamente por el usuario.

## Mes actual

El mes actual debe explicar el mes completo, no solo lo que falta desde hoy. Por eso puede mostrar facturas que ya fueron pagadas durante el mismo mes y recurrentes de todo el mes.

Esto **no** significa descontarlos otra vez del saldo disponible. El motor mantiene dos conceptos:

- `outflow`: total explicativo del mes para el gráfico y el detalle auditable;
- `forwardOutflow`: solo lo que falta pagar desde hoy, utilizado para proyectar saldo y capacidad de gasto.

Así septiembre puede mostrar lo que realmente se pagó, mientras la simulación parte desde el saldo actual sin duplicar egresos ya ocurridos.

## Futuro

Para meses futuros se consideran únicamente compromisos conocidos. No se agrega gasto variable promedio automáticamente.

Cuando un monto conocido no puede atribuirse con certeza a un banco o categoría, se mantiene en **Otros** en vez de repartirlo usando proporciones históricas.

## Simulación

Las simulaciones se agregan sobre esta base conservadora y auditable. No modifican Supabase y permiten evaluar cuánto margen queda después de compromisos ya facturados o configurados.
