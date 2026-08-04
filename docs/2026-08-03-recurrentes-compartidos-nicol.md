# Gastos recurrentes compartidos con Nicol

- **Fecha:** 2026-08-03
- **Rama:** `agent/nicol-recurrentes-20260803`
- **Autor:** ChatGPT · GPT-5.6 Thinking

## Objetivo

Permitir que gastos mensuales como luz, agua, internet o arriendo formen parte del monto que Nicol debe aportar.

## Funcionamiento

- Los recurrentes existentes permanecen privados por defecto.
- Se agregó `shared_with_nicol` a `recurring_expenses`.
- Solo se muestran recurrentes de tipo gasto, activos, con monto positivo y marcados para Nicol.
- El porcentaje corresponde al mismo porcentaje configurado para el enlace público de Nicol.
- El enlace público incluye una sección mensual llamada **Recurrentes** y suma esos conceptos al total compartido.

## Panel administrativo

Ruta: `?nicol-admin=recurrentes`

Permite:

- Crear un gasto recurrente nuevo.
- Definir nombre, monto y día de pago.
- Marcar o desmarcar cada gasto para Nicol.
- Actualizar monto y día de pago.
- Consultar el total recurrente compartido y el aporte calculado de Nicol.

## Seguridad

- La nueva columna parte en `false` para todos los registros existentes.
- La administración requiere una sesión autenticada.
- Las políticas RLS existentes continúan limitando el acceso al propietario.
- El RPC público solo devuelve nombre, monto y fecha de referencia; no expone bancos, notas, identificadores personales ni datos de acceso.
