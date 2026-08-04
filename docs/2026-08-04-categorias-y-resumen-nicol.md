# Categorías y resumen visual para Nicol

- **Fecha:** 2026-08-04
- **Rama:** `agent/nicol-categorias-resumen-20260804`
- **Autor:** ChatGPT · GPT-5.6 Thinking

## Objetivo

Dar contexto visual a los gastos compartidos para que Nicol pueda entender rápidamente a qué corresponde cada movimiento y cómo se calcula su aporte.

## Vista pública

La pantalla pública ahora incorpora:

- icono y etiqueta de categoría en cada gasto;
- resumen del ciclo agrupado por categoría;
- total compartido y aporte de Nicol por categoría;
- fórmula visible: `total compartido × porcentaje = aporte de Nicol`;
- aporte de Nicol calculado para cada concepto;
- estados diferenciados para movimientos confirmados, cuotas futuras y recurrentes;
- monto total de la compra cuando el movimiento corresponde a una cuota.

## Categorías automáticas

La base de datos clasifica automáticamente nombres conocidos, entre otros:

- Lider, Alvi, Tottus y Mayorista → Supermercado;
- Shell, Copec y otras estaciones → Bencina;
- veterinarias y tiendas de mascotas → Mascota;
- CGE → Luz;
- Nuevo Sur → Agua;
- Telsur → Internet;
- Sodimac y Easy → Hogar;
- centros deportivos y gimnasios → Deporte;
- Cloudways, Donweb y servicios digitales → Tecnología.

Los movimientos sin coincidencia quedan en `Otros` hasta que el administrador los corrija.

## Edición administrativa

### Tarjetas

En `?nicol-admin=1`, cada movimiento incluye un selector de categoría. El administrador puede:

- mantener la categoría detectada;
- seleccionar otra categoría manualmente;
- pedir que Gastito vuelva a detectar la categoría automáticamente.

### Recurrentes

En `?nicol-admin=recurrentes`, la categoría puede definirse al crear el gasto y modificarse posteriormente junto con el monto y el día de pago.

## Persistencia

- Se agregó `category_id` a `billing_transactions`.
- `recurring_expenses` reutiliza su campo `category_id` existente.
- Se agregaron funciones y triggers para clasificar nuevos movimientos automáticamente.
- Las cuotas proyectadas heredan la categoría de la compra original.
- El RPC público entrega categoría, icono, color y monto original sin exponer información bancaria o personal.

## Datos existentes

Los movimientos ya registrados fueron clasificados sin alterar sus montos, ciclos, cuotas ni selección para Nicol. Los recurrentes compartidos quedaron diferenciados como Luz, Agua e Internet.
