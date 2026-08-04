# Selector de ciclos y próximos meses para Nicol

- **Fecha:** 2026-08-04
- **Rama:** `agent/nicol-selector-proximos-20260804`
- **Autor:** ChatGPT · GPT-5.6 Thinking

## Objetivo

Permitir que Nicol seleccione un ciclo mensual desde su enlace público y pueda revisar meses actuales y próximos de forma similar a la vista de facturación del administrador.

## Comportamiento

- La vista pública muestra una barra horizontal de ciclos mensuales.
- El ciclo del mes actual se abre por defecto.
- Se puede avanzar o retroceder usando los botones anterior/siguiente.
- CMR y Banco de Chile se agrupan dentro del mismo mes.
- Cada ciclo presenta:
  - total compartido;
  - aporte de Nicol según el porcentaje configurado;
  - detalle de movimientos;
  - cuotas proyectadas;
  - gastos recurrentes compartidos.

## Proyección de cuotas

Cuando un movimiento en cuotas está marcado para Nicol, sus cuotas restantes se proyectan automáticamente en los ciclos siguientes.

Ejemplo:

- una compra compartida como cuota 1/3 aparece como 2/3 y 3/3 en los dos meses posteriores;
- una cuota ya terminada no genera movimientos futuros;
- las proyecciones se deduplican cuando existe un movimiento real equivalente en un ciclo posterior.

Las proyecciones no crean movimientos nuevos en `billing_transactions`; se calculan dinámicamente en el RPC público.

## Gastos recurrentes

Los recurrentes activos y marcados para Nicol se incluyen dentro del ciclo actual y de los próximos cinco meses. De esta forma, luz, agua, internet u otros conceptos forman parte del total mensual proyectado.

## Seguridad y privacidad

- Solo se usan transacciones con `shared_with_nicol = true`.
- Los movimientos no compartidos permanecen ocultos.
- No se exponen tarjetas, bancos, RUT, correo, archivos de origen ni identificadores personales.
- La vista continúa siendo de solo lectura.
- El token público existente sigue siendo válido.

## Interfaz

Se agregó `NicolPublicCycles.jsx`, que reemplaza la vista pública anterior sin modificar el panel administrativo.

Los ciclos futuros muestran una advertencia indicando que son estimaciones y pueden cambiar al cerrar los estados de cuenta.
