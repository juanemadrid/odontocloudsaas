# REGLAS CRÍTICAS DE INFRAESTRUCTURA — ODONTOCLOUD

## 1. NUNCA USAR NI ASUMIR SUPABASE.COM (CLOUD)
- OdontoCloud **NO utiliza la nube de Supabase (supabase.com)**.
- El proyecto antiguo en `supabase.com` fue descartado, está pausado y no debe usarse.
- **NUNCA** pedirle al usuario que inicie sesión en `supabase.com/dashboard` ni usar comandos de la nube de Supabase.

## 2. INFRAESTRUCTURA REAL (VPS PROPIO + COOLIFY)
- **Servidor:** VPS propio (IP `150.136.210.37`).
- **Orquestador:** Coolify (panel web y terminal de Coolify).
- **Backend:** Supabase Self-Hosted (PostgreSQL + GoTrue Auth + PostgREST + Kong) corriendo en Docker bajo Coolify.
- **Identificador de Servicio en Coolify:** Servicio 2 (OdontoCloud).
- **URL Base de la API (Kong):** `https://supabasekong-ueh7xuehxl9thmhre7fpk4xx.150.136.210.37.sslip.io`
- **Configuración de Variables y Secretos:** Se realiza en Coolify, dentro de las *Environment Variables* del servicio OdontoCloud.

## 3. ADVERTENCIA MULTI-SISTEMA (AISLAMIENTO ABSOLUTO CON EDUNEXUS)
- El VPS aloja **dos sistemas independientes**: **OdontoCloud** y **Edunexus**.
- **PROHIBIDO tocar, alterar, reiniciar o modificar cualquier contenedor, base de datos, servicio o variable perteneciente a Edunexus.**
- Todas las acciones, scripts y configuraciones deben limitarse estricta y milimétricamente al servicio de OdontoCloud.

## 4. ENVÍO DE CORREOS (RESEND)
- Proveedor de correo verificado: **Resend**.
- Dominio verificado: `odontocloudcolombia.com`.
- Remitente principal: `OdontoCloud <bienvenido@odontocloudcolombia.com>`.
- Configuración en Coolify (SMTP):
  - Host: `smtp.resend.com`
  - Puerto: `587`
  - Usuario: `resend`
  - Password: `RESEND_API_KEY` (`re_...`)
