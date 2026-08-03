# Visualización de movimientos facturados

- **Fecha:** 2026-08-03
- **Rama:** `agent/facturacion-movimientos-20260803`
- **Autor:** ChatGPT · GPT-5.6 Thinking

## Objetivo

Conectar la pantalla **Facturación** con los ciclos y movimientos que ya estaban persistidos en Supabase. No se ejecutó una nueva importación ni se duplicaron registros.

## Estado de los datos

- 4 ciclos facturados.
- 92 movimientos persistidos.
- Agosto de 2026: total combinado informado de **$977.058**.
- CMR agosto: **$793.246**.
- Banco de Chile agosto: **$183.812**.
- Próximo ciclo conocido: **$647.264**.
- 3 movimientos CMR permanecen marcados para revisión.
- 0 grupos de hash duplicados.
- La cantidad compartida con Nicol es dinámica y depende de las selecciones realizadas desde su panel administrativo.

## Implementación

- Nueva lectura de `billing_cycles` y `billing_transactions` desde Supabase.
- Agrupación por ciclo y tarjeta.
- Totales informado, leído y diferencia.
- Clasificación de compras, cuotas, cargos, pagos y abonos.
- Filtro de movimientos que requieren revisión.
- Búsqueda por descripción.
- Exportación CSV del ciclo seleccionado.
- Indicador de movimientos compartidos con Nicol y acceso a su panel administrativo.

## Archivos

- `src/services/billingCyclesService.js`
- `src/components/Billing.jsx`

## Seguridad

La consulta requiere una sesión autenticada y filtra explícitamente por el usuario actual. Las políticas RLS existentes continúan siendo la barrera principal de acceso.
