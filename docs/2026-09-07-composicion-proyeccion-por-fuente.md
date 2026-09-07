# Nueva Proyección: composición por fuente

Fecha: 2026-09-07

## Decisión de producto

La barra futura no debe pintar todo con el color del banco.

El color azul/verde representa únicamente el monto informado por el banco para ese mes. Todo compromiso adicional conserva su propia identidad visual:

- Banco Chile informado: azul.
- Banco Falabella informado: verde.
- Recurrentes: naranja.
- Cuotas adicionales: morado.
- Simulaciones: rosado.
- Otros compromisos: gris.

Los filtros Todos / Banco Chile / Banco Falabella / Otros mantienen esta composición interna.

## Regla de reconciliación

Si existe un `billing_forecast` para una tarjeta y mes, ese valor es la base visual informada por el banco.

Si Gastito conoce un total superior:

1. mantiene intacto el monto bancario;
2. separa el excedente según su fuente cuando es posible;
3. si el excedente proviene de un ciclo conocido pero no se puede clasificar con más detalle, se muestra como `Otros compromisos` en gris;
4. nunca se aumenta artificialmente la parte verde/azul para hacerla coincidir con el total de Gastito.

## Caso de QA Falabella

Valores mostrados por la captura de Próximos vencimientos de Banco Falabella:

- 05-10-2026: $692.460
- 05-11-2026: $73.458
- 05-12-2026: $51.364
- 05-01-2027: $14.295
- 05-02-2027: $14.295

Ejemplo de octubre: si Gastito conoce $693.364, la barra debe mantener $692.460 en verde y mostrar los $904 adicionales con otro color/fuente. No debe pintar $693.364 completos como Falabella informado.

## Recurrentes

Los recurrentes configurados (por ejemplo Spotify, agua o telefonía móvil) se muestran en naranja cuando forman parte del total comprometido del mes. Si tienen banco configurado, siguen perteneciendo a ese banco para efectos del filtro, pero visualmente no toman el color del banco.

Ejemplo: al filtrar Banco Falabella, Spotify puede aparecer naranja dentro de la misma barra, junto al vencimiento Falabella verde.

## Checkboxes

Los controles Recurrentes / Cuotas adicionales / Simulaciones son filtros visuales reales: al desactivarlos, el segmento desaparece y el total visible de la barra se recalcula. El monto bancario informado no cambia.

## Auditoría

El doble click / botón `Ver qué consideré` usa la misma composición del gráfico. La suma de:

- facturación / vencimientos informados;
- recurrentes;
- cuotas adicionales;
- simulaciones;
- otros compromisos;

debe coincidir con el total del mes mostrado en la barra.
