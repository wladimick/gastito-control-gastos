# Acceso rápido de Nicol y cuadratura CMR

- **Fecha:** 2026-08-03
- **Rama:** `agent/nicol-menu-cmr-20260803`
- **Autor:** ChatGPT · GPT-5.6 Thinking

## Acceso rápido

Se agregó el grupo **Compartidos** al menú lateral principal y dentro de él el acceso **Gastos con Nicol**.

El acceso abre el panel autenticado `?nicol-admin=recurrentes`, desde donde se administran los gastos mensuales compartidos y se puede ingresar al panel de movimientos de tarjetas.

El botón está disponible tanto en el menú lateral de escritorio como en el menú desplegable móvil.

## Fuente CMR

Se utilizaron cinco capturas de la aplicación CMR Falabella entregadas por Wladimick el 3 de agosto de 2026.

Datos confirmados:

- Tarjeta terminada en `3867`.
- Cupo total: **$3.790.000**.
- Utilizado: **$1.761.084**.
- Disponible: **$2.028.916**.
- Ciclo facturado 20/06/2026–19/07/2026: **$793.460**.
- Vencimiento del ciclo facturado: **05/08/2026**.
- Ciclo abierto con cierre 19/08/2026: **$570.604**.

## Ajustes realizados en Supabase

### Ciclo agosto de 2026

- `reported_amount`: $793.246 → **$793.460**.
- Se agregó un ajuste de conciliación por **$214** llamado `AJUSTE TOTAL CMR POR IDENTIFICAR`.
- El ajuste permanece marcado como `review_required`, porque la captura confirma el total pero no identifica el movimiento exacto.
- El detalle calculado y el total informado quedan ambos en **$793.460**.

### Ciclo septiembre de 2026

- `reported_amount`: $546.632 → **$570.604**.
- MercadoPago por **$7.570** quedó confirmado con fecha 01/08/2026.
- Empresas HN por **$16.402** quedó confirmado con fecha 01/08/2026.
- Se agregaron como pendientes de confirmación:
  - Centro de Deporte Cinart: **$44.000**.
  - Supermercados El 9: **$9.966**.
  - Compra existente: **$6.500**.
- Los tres pendientes no afectan el detalle confirmado mientras CMR no los procese.

## Resultado

- Agosto: 53 movimientos, total informado y calculado **$793.460**, 1 ajuste por revisar.
- Septiembre: 22 movimientos, total informado **$570.604**, detalle confirmado parcial **$371.754**, pendientes visibles **$60.466** y 3 elementos por revisar.

No se inventaron comercios para completar la diferencia del ciclo abierto; la información no visible en las capturas permanece como detalle parcial.