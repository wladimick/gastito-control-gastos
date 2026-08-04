# Gastos, Cuotas y auditoría de coherencia

- **Fecha:** 2026-08-04
- **Rama:** `agent/gastos-cuotas-coherencia-20260804`
- **Autor:** ChatGPT · GPT-5.6 Thinking

## Gastos

La vista anterior mostraba todos los movimientos en tarjetas grandes de dos columnas, generando una página excesivamente larga.

### Cambios

- listado compacto como vista predeterminada;
- cards disponibles como alternativa;
- preferencia visual guardada en el navegador;
- paginación de 25 movimientos, con opciones de 50 o todos;
- distribución por categorías plegable;
- selector de meses más compacto;
- filtros y resúmenes conservados;
- carga interna de tarjetas y ciclos para no depender de props antiguas;
- movimientos manuales editables y bancarios administrados desde Facturación.

## Cuotas

La sección utilizaba exclusivamente la tabla manual `installments`, aunque Facturación ya contiene las cuotas reales de CMR y Banco de Chile. Esto podía duplicar proyecciones.

### Cambios

- cuotas bancarias como fuente principal;
- lectura de cuotas reales desde `billing_cycles` y `billing_transactions`;
- proyección automática desde la última cuota bancaria conocida;
- conciliación de seguimientos manuales por banco, cantidad de cuotas, valor mensual y similitud del comercio;
- exclusión de coincidencias manuales de los totales para evitar doble conteo;
- separación visual entre `Confirmada por banco`, `Proyección bancaria` y `Manual`;
- vista Calendario y vista Planes;
- selector mensual de ocho meses;
- filtro por fuente, banco y gastos compartidos con Nicol;
- edición manual conservada para compromisos que no provienen de los bancos;
- categorías de cuotas alineadas con los UUID reales de Supabase.

## Auditoría de coherencia de la aplicación

### Corregido en esta rama

1. **Gastos:** unifica `expenses` con movimientos de Facturación.
2. **Cuotas:** concilia `installments` con las cuotas de Facturación.
3. **Categorías de cuotas:** deja de mezclar identificadores locales con UUID de Supabase.

### Hallazgos pendientes

1. **Dashboard:** todavía recibe principalmente `expenses`; puede omitir movimientos bancarios recientes.
2. **Presupuestos:** calcula consumo desde gastos manuales y no desde la vista unificada.
3. **Reportes:** combina gastos manuales y cuotas manuales, pero no usa aún el mismo motor conciliado.
4. **Proyección:** puede sumar compromisos manuales que ya están representados por una tarjeta.
5. **Comparación:** usa solo `expenses`, por lo que los meses recientes pueden quedar incompletos.
6. **Cuentas y flujo:** recibe gastos manuales y puede mostrar saldos distintos de Facturación.
7. **Recurrentes:** al generar un gasto manual y luego importar el mismo cargo desde una tarjeta, otras páginas podrían contarlo dos veces.
8. **Estados de cuenta heredados:** aún existe almacenamiento local (`billedStatements`) junto a los ciclos persistidos en Supabase.

## Próxima etapa recomendada

Crear un servicio central `unifiedMovementsService` que entregue una sola fuente conciliada a Dashboard, Presupuestos, Reportes, Proyección, Comparación y Cuentas. La migración debe hacerse módulo por módulo, comparando totales antes de reemplazar cada cálculo.
