# Actualización integral del README

**Fecha:** 2026-08-05  
**Actividad:** reconstrucción de la documentación principal del repositorio.

## Objetivo

Reemplazar el README inicial —que todavía describía una aplicación basada principalmente en datos mock— por una guía alineada con el estado real de Gastito en producción.

## Contenido incorporado

- propósito y alcance de la aplicación;
- estado de producción;
- módulos actuales de la interfaz;
- arquitectura React, Supabase, Vercel y Telegram;
- lógica de conciliación entre gastos, facturación, cuotas y recurrentes;
- flujo de gastos compartidos mediante enlace público;
- rutas especiales;
- instalación local y modo demo;
- variables de entorno vigentes;
- estructura actual de las tablas y funciones PostgreSQL;
- migraciones, Edge Function y webhook de Telegram;
- tratamiento de fechas en `America/Santiago`;
- scripts, pruebas y estructura del repositorio;
- despliegue y flujo de Pull Requests;
- seguridad, privacidad y diagnóstico de problemas frecuentes.

## Corrección adicional

Se actualizó `.env.example` para utilizar `VITE_SUPABASE_PUBLISHABLE_KEY`, que es la variable leída actualmente por `src/lib/supabase.js`. También se aclaró la separación entre variables públicas de Vite y secretos de la Edge Function.

## Resultado esperado

El README pasa a ser la referencia principal para comprender, instalar, desarrollar, desplegar y operar Gastito sin depender de documentación histórica desactualizada.
