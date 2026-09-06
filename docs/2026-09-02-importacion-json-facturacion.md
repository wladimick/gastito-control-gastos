# Importación JSON de movimientos en Facturación

- **Fecha:** 2026-09-02
- **Rama:** `agent/facturacion-json-cmr-20260902`
- **Alcance:** carga manual de movimientos de tarjeta con previsualización y deduplicación.

## Objetivo

Permitir cargar movimientos que aparecen en aplicaciones bancarias —por ejemplo movimientos no facturados de CMR— sin tener que crear un gasto manual por cada compra.

Los datos se guardan en el modelo de Facturación (`billing_cycles` + `billing_transactions`) y no duplican registros en `expenses`.

## Flujo de usuario

1. Entrar a **Facturación**.
2. Presionar **Importar JSON**.
3. Seleccionar la tarjeta destino.
4. Pegar un JSON con los movimientos.
5. Presionar **Validar**.
6. Revisar la previsualización: listos, duplicados y errores.
7. Confirmar **Importar N movimientos**.
8. La vista de Facturación se recarga automáticamente.

La validación nunca escribe en la base de datos.

## Formato

```json
{
  "bank": "falabella",
  "card": "cmr",
  "source": "cmr_digital_manual_json",
  "transactions": [
    {
      "date": "2026-09-01",
      "description": "Comercio ejemplo",
      "amount": 12990,
      "installment_current": 1,
      "installment_total": 1
    }
  ]
}
```

Campos requeridos por movimiento:

- `date`: `YYYY-MM-DD`;
- `description`: comercio o descripción;
- `amount`: monto CLP entero mayor que cero.

Campos opcionales:

- `movement_type`: `purchase`, `installment`, `commission`, `tax`, `interest`, `payment`, `credit` u `other`;
- `installment_current` y `installment_total`;
- `original_amount` cuando se conoce el valor total original de una compra en cuotas.

El parser también acepta alias en español (`fecha`, `descripcion`, `monto`, `cuota_actual`, `cuotas_totales`) y montos CLP como `"$13.756"`.

## Clasificación automática

Cuando `movement_type` no viene informado:

- descripción que comienza con `Impuesto` → `tax`;
- más de una cuota → `installment`;
- resto → `purchase`.

## Duplicados

La RPC considera duplicado un movimiento cuando ya existe para el mismo usuario y tarjeta con:

- misma fecha;
- mismo monto;
- misma descripción normalizada (minúsculas, espacios consolidados y acentos ignorados).

Los duplicados se muestran en la previsualización y se omiten al confirmar. Volver a pegar el mismo JSON es idempotente respecto de esta regla.

## Ciclos

La función usa las mismas reglas de la sincronización de gastos manuales de crédito:

- `billing_start_day` / `billing_day` para ubicar el movimiento en el período;
- `payment_due_day` para calcular el ciclo `YYYY-MM`;
- crea un ciclo parcial si no existe;
- si el ciclo ya fue conciliado o tiene monto oficial final, preserva sus fechas oficiales.

El monto informado oficial del estado de cuenta nunca se reemplaza por una importación manual JSON.

## Seguridad

La función `public.import_billing_json(...)` es `SECURITY DEFINER`, pero:

- exige usuario autenticado mediante `auth.uid()`;
- valida que la tarjeta seleccionada pertenezca al usuario autenticado;
- no permite importar para otro usuario;
- solo concede ejecución al rol `authenticated`.

## Archivos

- `src/lib/billingJsonImport.js`: parser y normalización local.
- `src/services/billingJsonImportService.js`: llamada a preview/importación.
- `src/components/BillingJsonImport.jsx`: modal y previsualización.
- `src/components/Billing.jsx`: integración del acceso y recarga de la vista.
- `src/components/BillingBase.jsx`: vista de Facturación previa preservada sin cambios funcionales.
- `supabase/migrations/20260902173000_billing_json_import.sql`: RPC, seguridad, ciclos y deduplicación.
- `tests/billing-json-import.test.js`: pruebas unitarias del parser.

## QA requerido antes de merge

- `npm test`;
- `npm run build`;
- validar modal en desktop y móvil;
- probar JSON válido, JSON roto y filas inválidas;
- comprobar que una segunda importación del mismo JSON marca todos los registros como duplicados;
- comprobar compras de 1 cuota y cuotas `1/3`, `2/3`, etc.;
- verificar que Facturación se recarga después de importar;
- verificar que **Exportar CSV** sigue funcionando;
- revisar consola del navegador y errores de Supabase.

> La migración de Supabase debe estar aplicada en el ambiente donde se pruebe la importación. El PR no ejecuta cambios de base de datos por sí solo.
