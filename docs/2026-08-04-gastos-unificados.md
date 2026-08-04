# Actualización de la página Gastos

- **Fecha:** 2026-08-04
- **Rama:** `agent/gastos-unificados-20260804`
- **Autor:** ChatGPT · GPT-5.6 Thinking

## Problema detectado

La página Gastos utilizaba únicamente la tabla histórica `expenses`. Los 77 registros manuales disponibles terminaban el 27 de junio de 2026, mientras que Facturación contenía 100 movimientos de tarjetas hasta el 2 de agosto de 2026. Por eso la sección se veía desactualizada aunque CMR y Banco de Chile ya tuvieran información reciente.

## Solución

Gastos pasa a ser una vista unificada de:

- registros manuales y creados desde Telegram;
- movimientos reales importados desde Facturación;
- coincidencias exactas conciliadas, sin contarlas dos veces.

## Mejoras visuales

- selector horizontal de meses;
- apertura automática del mes actual o del último disponible;
- resumen de gasto confirmado, movimientos de tarjetas, compartido con Nicol y pendientes;
- distribución por categorías con iconos, porcentajes y barras;
- tarjetas visuales agrupadas por fecha;
- badges de origen: Manual, Tarjeta y Conciliado;
- estados de pendiente, revisar, fuera del total y compartido con Nicol;
- cuotas con número de cuota, valor mensual y monto original;
- filtros por origen, categoría, estado y búsqueda;
- acceso directo desde cada movimiento bancario hacia Facturación.

## Reglas de edición

- Los registros manuales mantienen editar, confirmar y eliminar.
- Los movimientos bancarios son de solo lectura y se administran desde Facturación.
- Una coincidencia exacta usa fecha, monto y descripción normalizada para evitar duplicados.

## Persistencia

No se modificaron tablas, montos ni movimientos. La vista consulta `expenses`, `billing_cycles`, `billing_transactions` y `categories` existentes.