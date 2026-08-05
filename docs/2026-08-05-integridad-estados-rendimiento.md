# Integridad, estados de datos y rendimiento

**Fecha:** 2026-08-05  
**Actividad:** hacer visibles las fuentes incompletas, confirmar fallos de escritura y reforzar las cuotas bancarias.

## Cambios

- Se agrega un indicador global cuando Gastos, Cuotas, Recurrentes o Presupuestos no pueden cargar una fuente.
- Una vista parcial deja de parecer una carga completa: se informa qué origen no respondió.
- Los errores al crear, editar, eliminar o marcar registros se muestran sobre la aplicación y recomiendan recargar antes de asumir que el cambio quedó guardado.
- Gastos y Cuotas informan explícitamente cuando Facturación o las tarjetas no están disponibles.
- Recurrentes y Presupuestos informan errores de lectura y escritura.
- Las cuotas con `installment_current = 0` y más de una cuota quedan obligatoriamente marcadas como `review_required`.
- El movimiento `EL OTTO TASA INT 0,00%` queda para revisión, sin asumir automáticamente que corresponde a `1/3`.
- Vite separa React y Supabase del bundle principal para mejorar caché y carga inicial.

## Seguridad funcional

Los cambios de escritura continúan protegidos por las políticas RLS existentes. El indicador global no expone datos financieros; solamente informa el módulo y el error recibido.

## Resultado esperado

Gastito avisa cuando un total puede estar incompleto o cuando Supabase no confirmó una modificación, evitando decisiones financieras basadas en una pantalla aparentemente actualizada.
