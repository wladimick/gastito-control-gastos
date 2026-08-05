# Rendiciones como saldo a favor · 5 de agosto de 2026

## Regla financiera

- **Por rendir:** no se considera dinero a favor porque todavía no fue enviado a la empresa.
- **Rendida o aprobada:** se considera una cuenta por cobrar y se incorpora automáticamente a Proyección.
- **Reembolsada:** deja de proyectarse como cuenta por cobrar porque la transferencia ya fue recibida.
- **Disponible operativo:** no aumenta hasta que el usuario reciba la transferencia y actualice el saldo de la cuenta receptora.

## Cambios

- nueva tarjeta explicativa en Dashboard con el total de rendiciones a favor;
- acceso directo desde Dashboard hacia Rendiciones;
- las rendiciones enviadas/aprobadas se incluyen en Proyección incluso cuando el supuesto general de otros cobros pendientes está desactivado;
- los otros cobros continúan dependiendo del interruptor de Supuestos;
- pruebas automáticas para evitar sumar rendiciones reembolsadas o cobros genéricos no habilitados.

## Criterio

Una rendición aprobada reduce el costo personal esperado, pero no representa efectivo disponible. Por ello se muestra como dinero por cobrar y no se suma al saldo actual.
