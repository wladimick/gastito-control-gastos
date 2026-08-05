const HELP_ITEMS = [
  {
    match: 'disponible operativo',
    text: 'Dinero que tienes hoy en cuentas activas de uso diario. No incluye cupos de tarjetas ni cuentas marcadas como ahorro.',
  },
  {
    match: 'proximo pago tarjetas',
    text: 'Suma de las tarjetas que vencen primero. Si el banco ya informó el total, usa ese monto; si el ciclo sigue abierto, usa la mejor estimación disponible.',
  },
  {
    match: 'fijos directos pendientes',
    text: 'Gastos recurrentes que todavía deberían salir directamente desde débito, transferencia o efectivo. No incluye cargos que llegarán dentro de una tarjeta.',
  },
  {
    match: 'libre tras compromisos',
    text: 'Disponible operativo menos el próximo pago de tarjetas y los gastos fijos directos pendientes. Si queda negativo, el saldo actual no alcanza para cubrir todo.',
  },
  {
    prefix: 'gastado',
    text: 'Total de compras y gastos conciliados del período. Puede incluir tarjeta de crédito, por lo que no significa necesariamente que todo el dinero ya salió de tus cuentas.',
  },
  {
    match: 'reserva / ahorro',
    text: 'Dinero separado del uso cotidiano. Gastito no lo considera disponible para cubrir gastos normales.',
  },
  {
    match: 'ingresos mensuales',
    text: 'Suma de los ingresos recurrentes activos. Los montos por cobrar se muestran aparte porque todavía no han ingresado.',
  },
  {
    match: 'compartido con nicol',
    text: 'Monto base marcado como compartido antes de aplicar el porcentaje de Nicol. No corresponde directamente a lo que ella debe transferirte.',
  },
  {
    match: 'saldo en cuentas',
    text: 'Suma de los saldos registrados en tus cuentas activas. Debe representar dinero real disponible, no el cupo de una tarjeta de crédito.',
  },
  {
    match: 'reserva comprometida',
    text: 'Dinero que está en tus cuentas, pero pertenece a una obligación pendiente, como el préstamo de tu papá. Se separa para no confundirlo con dinero libre.',
  },
  {
    match: 'dinero realmente libre',
    text: 'Saldo total en cuentas menos las reservas y préstamos pendientes. Es una referencia más realista de cuánto podrías usar hoy.',
  },
  {
    match: 'facturas proximas',
    text: 'Monto de las tarjetas que vencerán más pronto según los ciclos de Facturación. No incluye facturas ya pagadas.',
  },
  {
    match: 'presupuesto mensual',
    text: 'Límite total que decidiste asignar a las categorías del mes. Sirve como plan, no como gasto obligatorio.',
  },
  {
    match: 'presupuesto',
    text: 'Monto máximo que quieres gastar en una categoría durante el mes. Cuando no existe un límite, la categoría aparece como sin configurar.',
  },
  {
    match: 'disponible',
    text: 'Saldo registrado en cuentas activas. Revisa que los saldos estén actualizados antes de tomar decisiones.',
  },
  {
    match: 'en alerta',
    text: 'Categorías que están cerca de superar su presupuesto según el gasto acumulado y el avance del mes.',
  },
  {
    match: 'sobre limite',
    text: 'Categorías cuyo gasto ya superó el presupuesto que definiste.',
  },
  {
    match: 'ritmo esperado',
    text: 'Porcentaje aproximado del presupuesto que sería normal haber usado según los días transcurridos del mes.',
  },
  {
    match: 'ingresos',
    text: 'Dinero recurrente que esperas recibir durante el mes, como sueldo u otros ingresos configurados.',
  },
  {
    match: 'gastos fijos',
    text: 'Compromisos que se repiten regularmente. Los cargos hechos con crédito llegarán dentro de la factura de la tarjeta y no deben contarse dos veces.',
  },
  {
    match: 'por cobrar',
    text: 'Dinero que otras personas o entidades todavía te deben. No se considera disponible hasta que lo marques como cobrado.',
  },
  {
    match: 'por pagar',
    text: 'Deudas u obligaciones pendientes que deberás pagar en una fecha definida.',
  },
  {
    match: 'saldo disponible hoy',
    text: 'Punto de partida de la proyección. Usa los saldos registrados en Cuentas, descontando las reservas cuando corresponda.',
  },
  {
    match: 'saldo esperado',
    text: 'Estimación del dinero que quedaría al terminar el período después de sumar ingresos y descontar obligaciones proyectadas.',
  },
  {
    match: 'menor saldo',
    text: 'El punto más bajo que alcanzaría tu saldo dentro de la proyección. Ayuda a detectar meses en los que podrías quedar corto de dinero.',
  },
  {
    match: 'salidas proximas',
    text: 'Pagos y compromisos que deberían ocurrir pronto según facturas, recurrentes, cuotas y deudas registradas.',
  },
  {
    match: 'comprometido',
    text: 'Escenario conservador que considera solamente obligaciones conocidas, como facturas, cuotas, recurrentes y deudas.',
  },
  {
    match: 'realista',
    text: 'Escenario que agrega a las obligaciones conocidas un promedio de tu gasto variable reciente.',
  },
  {
    match: 'con simulaciones',
    text: 'Escenario que incorpora compras hipotéticas para mostrar cómo afectarían tu saldo futuro antes de realizarlas.',
  },
  {
    match: 'total facturado',
    text: 'Monto informado por el banco para el ciclo. En ciclos abiertos puede ser una estimación hasta que la tarjeta cierre.',
  },
  {
    match: 'detalle leido',
    text: 'Suma de los movimientos que Gastito pudo identificar dentro del estado de cuenta o de los registros conciliados.',
  },
  {
    match: 'diferencia',
    text: 'Distancia entre el total informado por el banco y la suma del detalle identificado. Una diferencia no siempre es un error: puede existir detalle parcial o movimientos pendientes.',
  },
  {
    match: 'requieren revision',
    text: 'Movimientos con información incompleta, pendiente o inconsistente que conviene verificar antes de confiar en el total.',
  },
  {
    match: 'consumo del mes',
    text: 'Compras y gastos realizados durante el mes seleccionado, independientemente de cuándo se pagará la tarjeta.',
  },
  {
    match: 'facturas del mes',
    text: 'Facturas de tarjetas cuyo vencimiento cae dentro del mes seleccionado.',
  },
  {
    match: 'flujo esperado',
    text: 'Resultado estimado de ingresos menos pagos y compromisos que vencen en el período seleccionado.',
  },
  {
    match: 'balance real',
    text: 'Resultado de los movimientos ya registrados para el período, sin agregar cobros o pagos que todavía están pendientes.',
  },
  {
    match: 'balance esperado',
    text: 'Resultado del período incluyendo ingresos, cobros y obligaciones pendientes que configuraste.',
  },
]

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[·:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function financialHelpFor(label) {
  const normalized = normalize(label)
  if (!normalized) return ''

  const exact = HELP_ITEMS.find(item => item.match && normalized === item.match)
  if (exact) return exact.text

  const prefix = HELP_ITEMS.find(item => item.prefix && normalized.startsWith(item.prefix))
  if (prefix) return prefix.text

  const contained = HELP_ITEMS.find(item => item.match && normalized.includes(item.match))
  return contained?.text || ''
}

export { HELP_ITEMS as FINANCIAL_HELP_ITEMS }
