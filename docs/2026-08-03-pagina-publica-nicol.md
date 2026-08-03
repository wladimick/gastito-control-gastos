# Página de gastos compartidos con Nicol

Fecha: 2026-08-03
Rama: agent/nicol-public-share-20260803

## Implementación

- Panel autenticado: `?nicol-admin=1`.
- Vista de solo lectura: `?nicol=<token>`.
- Porcentaje inicial de Nicol: 33%.
- Los movimientos están desmarcados por defecto.
- Wladimick selecciona manualmente qué movimientos se comparten.
- El enlace se puede renovar o desactivar.

## Protección de datos

- La base almacena el hash del token, no el token original.
- La respuesta pública no incluye usuario, correo, RUT, banco, tarjeta ni archivos de importación.
- Pagos y abonos no se pueden compartir desde este flujo.
- La tabla administrativa usa RLS por propietario.

## Archivos

- src/main.jsx
- src/components/NicolShare.jsx
- src/services/nicolShareService.js
- supabase/migrations/20260803223000_nicol_public_share.sql
