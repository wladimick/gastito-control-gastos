# Rendiciones de empresa · 5 de agosto de 2026

## Objetivo

Incorporar un seguimiento específico para gastos que el usuario paga personalmente y luego debe rendir a su empresa para recibir un reembolso.

## Flujo

1. **Por rendir:** gasto identificado, todavía no enviado.
2. **Rendido:** fue informado a la empresa y se espera transferencia.
3. **Aprobado:** la empresa lo validó.
4. **Reembolsado:** el dinero volvió a una cuenta personal.
5. **No rendir / Rechazado:** cierre sin reembolso.

## Alcance implementado

- nueva tabla `expense_reimbursements` con RLS por usuario;
- vinculación opcional con `expenses` y `billing_transactions`;
- módulo Rendiciones en la navegación principal;
- tarjetas de por rendir, esperando reembolso, vencidas y reembolsadas;
- sugerencias no automáticas para servicios frecuentes de trabajo;
- registro histórico manual;
- fechas límite y pago esperado;
- badge lateral con rendiciones abiertas;
- rendiciones enviadas/aprobadas incorporadas como dinero por cobrar en Dashboard, Reportes y Proyección.

## Seguridad y conciliación

Los índices únicos evitan asociar dos rendiciones al mismo gasto o movimiento bancario. Las sugerencias nunca crean registros por sí mismas.
