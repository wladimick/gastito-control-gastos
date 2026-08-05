# Tooltips financieros y menú lateral estable

**Fecha:** 2026-08-05  
**Actividad:** explicar indicadores financieros y corregir la navegación lateral en páginas extensas.

## Ayudas financieras

- Se agrega un componente accesible de información que funciona con mouse, teclado y toque.
- Los tooltips se muestran fuera de la card para evitar recortes por `overflow`.
- Dashboard, Cuentas, Presupuestos, Recurrentes, Reportes y Comparación reconocen automáticamente sus métricas principales.
- `StatCard` también puede mostrar ayuda mediante su etiqueta o una explicación personalizada.
- Los textos explican el dato en lenguaje cotidiano y aclaran qué incluye, qué excluye y cómo usarlo para decidir.

## Menú lateral

- El menú de escritorio queda fijo al viewport.
- La lista de secciones tiene desplazamiento independiente.
- Logo, usuario, salida y estado del bot permanecen accesibles.
- El contenido principal reserva el ancho del menú mediante margen lateral.
- Se usa `100dvh` para evitar cortes por cambios en el alto visible del navegador.

## Resultado esperado

Las páginas largas ya no desplazan ni bloquean el menú lateral, y las métricas más relevantes muestran un icono `i` con una explicación breve antes de que el usuario tome una decisión financiera.
