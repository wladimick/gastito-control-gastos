# Corrección de fecha y hora al crear gastos

- **Fecha:** 2026-08-05
- **Autor:** ChatGPT · GPT-5.6 Thinking

## Problema

El formulario usaba `toISOString().slice(0, 16)` para alimentar un campo `datetime-local`. Ese valor está en UTC, pero el navegador lo interpretaba como hora local, desplazando la hora de Chile y pudiendo cambiar el día.

## Corrección

- El ISO guardado en Supabase se convierte primero a la hora local del dispositivo.
- Al guardar, la fecha y hora locales se convierten nuevamente a ISO con zona horaria.
- La selección se separó en campos de fecha y hora para evitar el selector combinado confuso del navegador.
- Se agregó el botón **Usar ahora**.
- Supabase mantiene `expense_date` como `timestamptz`; no se modifica el esquema ni los movimientos existentes.

## Validación esperada

- Al abrir un gasto nuevo, debe aparecer el día y la hora actuales del dispositivo.
- Editar un gasto existente no debe adelantar ni atrasar su hora.
- Guardar y volver a abrir debe conservar exactamente la fecha y hora seleccionadas.
