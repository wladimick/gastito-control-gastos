# Vigencia de saldos y punto de partida de Proyección

- **Fecha:** 2026-08-04
- **Rama:** `agent/saldos-proyeccion-20260804`
- **Autor:** ChatGPT · GPT-5.6 Thinking

## Hallazgo

La Proyección mostraba un saldo inicial de $145.612, pero la revisión de Supabase confirmó que:

- CMR Débito tenía saldo $0 y no se actualizaba desde mayo de 2026;
- Cuenta RUT tenía saldo $0 y no se actualizaba desde mayo de 2026;
- Mercado Pago tenía $145.612 y su última actualización era del 24 de mayo de 2026.

Por lo tanto, el monto no debía presentarse como un saldo actual confiable sin advertencia.

## Cambios

### Cuentas

- Se agregó un panel de actualización rápida para las cuentas activas.
- Permite escribir los saldos actuales y guardar únicamente las cuentas modificadas.
- Muestra total registrado, nuevo total y fecha relativa de actualización.
- Marca como `Revisar` una cuenta con más de siete días de antigüedad o sin fecha.
- Aclara que el saldo corresponde a dinero disponible y no al cupo de las tarjetas de crédito.

### Proyección

- Se agregó un bloque visible con el punto de partida del cálculo.
- Muestra cada cuenta operativa, saldo y antigüedad.
- Advierte cuando los saldos registrados están desactualizados.
- Permite usar un saldo temporal guardado únicamente en el navegador.
- El saldo temporal no modifica Cuentas ni Supabase y puede restablecerse en cualquier momento.

### Servicio de cuentas

- `accountsService` ahora entrega `createdAt` y `updatedAt`.
- Las actualizaciones de saldo registran explícitamente `updated_at`.

## Archivos

- `src/components/Accounts.jsx`: nuevo contenedor de actualización rápida.
- `src/components/AccountsLegacy.jsx`: implementación anterior conservada.
- `src/components/ProjectionWithBalanceStatus.jsx`: control del saldo inicial y override temporal.
- `src/components/Projection.jsx`: activa el nuevo contenedor.
- `src/services/accountsService.js`: fechas y actualización explícita.

## Validación

- Build Vite correcto.
- 125 módulos transformados.
- Preview Vercel `READY`.
- Respuesta HTTP 200.
- No se modificaron saldos ni registros existentes en Supabase.
