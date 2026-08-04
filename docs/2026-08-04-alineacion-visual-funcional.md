# Alineación visual y funcional de Gastito

- **Fecha:** 2026-08-04
- **Rama:** `agent/alineacion-visual-funcional-20260804`
- **Autor:** ChatGPT · GPT-5.6 Thinking

## Objetivo

Dejar la aplicación alineada visual y funcionalmente, evitando que cada módulo calcule los gastos y las cuotas desde fuentes distintas.

## Fuente central de movimientos

Se creó `financialAlignmentService.js` como motor común para:

- combinar gastos manuales con movimientos confirmados de Facturación;
- descartar pagos, abonos y movimientos pendientes del gasto efectivo;
- conciliar coincidencias conservadoras por fecha, monto y comercio;
- mantener categorías, bancos, cuotas y marcas de gastos compartidos con Nicol;
- entregar una estructura compatible con Dashboard, Presupuestos, Reportes, Proyección, Comparación y Cuentas.

`fetchExpenses()` ahora devuelve directamente esta lista conciliada. De esta manera los módulos existentes reciben los mismos movimientos sin que cada uno tenga que consultar Facturación de forma independiente.

## Fuente central de cuotas

`fetchInstallments()` ahora entrega una lista de planes conciliados:

- las cuotas importadas desde el banco son la fuente principal;
- las cuotas futuras se proyectan desde la última cuota bancaria conocida;
- los seguimientos manuales se asocian por banco, número de cuotas, valor mensual y comercio;
- las coincidencias se representan una sola vez;
- los compromisos no encontrados en Facturación permanecen como `Solo manual`.

La estructura conserva los campos antiguos usados por Dashboard, Reportes, Proyección y Cuentas, y añade las ocurrencias mensuales necesarias para la vista Cuotas.

## Gastos

- consume la lista global ya conciliada;
- deja de consultar y volver a combinar Facturación localmente;
- lista compacta predeterminada y cards opcionales;
- filtros por fuente, categoría y estado;
- distribución por categorías plegable;
- paginación de 25, 50 o todos;
- edición solo para registros que tienen respaldo manual;
- movimientos exclusivamente bancarios se administran desde Facturación.

## Cuotas

- consume los planes globales conciliados;
- vistas `Calendario` y `Planes`;
- estados diferenciados: confirmada por banco, pendiente, proyectada y solo manual;
- filtros por fuente, banco y Nicol;
- edición de la parte manual cuando existe una conciliación;
- proyección de ocho meses con una sola suma por compromiso.

## Sistema visual

- tarjetas y paneles con radio, borde y sombra consistentes;
- métricas, badges, campos y botones con una jerarquía común;
- nuevo token `--soft` para superficies secundarias;
- estados de foco visibles y coherentes;
- navegación reorganizada por Movimientos, Planificación y Análisis;
- Facturación se incorpora a la navegación principal móvil;
- indicador `Datos conciliados` en las secciones financieras;
- ancho máximo y espaciado globales normalizados.

## Validación

- build Vite correcto en Vercel;
- 121 módulos transformados;
- preview HTTP 200;
- no se aplicaron migraciones ni se modificaron datos de Supabase;
- auditoría de datos: 77 gastos manuales, 92 movimientos bancarios confirmados, 26 seguimientos manuales y 24 planes bancarios conservadores;
- para el ciclo actual, Facturación contiene $977.272 de movimientos confirmados que anteriormente podían quedar fuera de Dashboard, Presupuestos y Reportes.

## Regla funcional final

1. Facturación representa el detalle bancario real.
2. Gastos representa la lista conciliada de movimientos reales y manuales.
3. Cuotas representa compromisos reales y proyecciones, sin duplicar seguimientos manuales.
4. Dashboard, Presupuestos, Reportes, Proyección, Comparación y Cuentas consumen esas mismas fuentes globales.
