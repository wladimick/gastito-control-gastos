# Cuotas visuales y ciclos identificados por tarjeta

- **Fecha:** 2026-08-04
- **Rama:** `agent/nicol-cuotas-ciclos-visuales-20260804`
- **Autor:** ChatGPT · GPT-5.6 Thinking

## Objetivo

Evitar que los ciclos de CMR y Banco de Chile parezcan duplicados y hacer evidente qué cuota corresponde pagar en cada ciclo compartido con Nicol.

## Selector administrativo

El selector de `?nicol-admin=1` ahora identifica cada ciclo usando:

- nombre de la tarjeta;
- últimos cuatro dígitos;
- mes del ciclo;
- período de facturación.

Ejemplos:

- `CMR •••• 3867 · Septiembre 2026`;
- `Banco Chile •••• 5463 · Septiembre 2026`.

Se agregó una explicación indicando que un mismo mes puede aparecer dos veces porque cada tarjeta tiene un período diferente. No se eliminaron ciclos ni movimientos.

## Movimientos en cuotas

En el panel administrativo, cada compra en cuotas muestra de forma destacada:

- `Este ciclo paga`;
- `Cuota X/Y`;
- `Última cuota`, cuando corresponde;
- valor de la cuota;
- monto total original, cuando está disponible.

## Pantalla pública de Nicol

La vista pública utiliza los mismos criterios visuales:

- movimientos reales: `Este ciclo paga · Cuota X/Y`;
- movimientos proyectados: `Este ciclo pagará · Cuota X/Y`;
- última cuota identificada explícitamente;
- monto rotulado como `valor de esta cuota`.

Los ciclos futuros continúan marcados como estimados y no se exponen movimientos privados.

## Archivos

- `src/components/NicolCardAdmin.jsx`
- `src/components/NicolPublicCyclesVisual.jsx`
- `src/services/nicolShareService.js`
- `src/main.jsx`
