# 10. RUNBOOK DE DESPLIEGUE CONTROLADO EN PRODUCCIÓN (PREPARADO — NO EJECUTADO)

**Estado:** PREPARADO PARA AUTORIZACIÓN (NO EJECUTADO)  
**Entorno de Destino:** VPS OdontoCloud (`150.136.210.37` - Servicio 2 Coolify).  
**Restricción Crítica:** Aislamiento total respecto a Edunexus/Escolaria. Prohibido ejecutar sin autorización expresa.

---

## 1. Orden Secuencial de Migraciones SQL

Las migraciones fueron diseñadas de forma modular y aditiva, garantizando que ninguna tabla existente sufra eliminación de columnas ni bloqueos de datos:

| Orden | Archivo de Migración | Objeto Principal | Impacto / Riesgo |
|:---:|---|---|---|
| **1** | `20261012_ihce_microphase_1_safe_normalization.sql` | Columnas REPS, DIVIPOLA, CIE, CUPS con `DEFAULT NULL` y FKs `RESTRICT` | Nulo (aditivo, retrocompatible) |
| **2** | `20261012_clinical_data_least_privilege_v2.sql` | RLS Least Privilege, bloqueo de superadmin y tabla `clinical_break_glass_sessions` | Medio (refuerza permisos) |
| **3** | `20261012_ihce_transactional_outbox_queue.sql` | Tabla `ihce_outbox_queue`, índices y trigger de cierre | Nulo (tabla nueva) |
| **4** | `20261012_ihce_phase2_credentials_and_worker.sql` | Tabla `ihce_configurations`, reserva `SKIP LOCKED` y revocación | Nulo (tabla nueva) |
| **5** | `20261012_ihce_phase3_advanced_security_and_resilience.sql` | Vista segura write-only, firma verificada, doble control y conciliación | Nulo (vista y funciones RPC) |
| **6** | `20261012_ihce_final_minsalud_compliance.sql` | Cabecera Azure APIM (Ocp-Apim-Subscription-Key) y tabla `clinical_signature_attempts` contra fuerza bruta | Nulo (aditivo y securización) |

> [!WARNING]
> **Ventanas de Mantenimiento No Medidas:**  
> La duración exacta del bloqueo de esquemas durante el despliegue no debe estimarse como garantizada hasta ejecutar un simulacro cronometrado con un snapshot real del volumen de producción. Todas las migraciones son no-bloqueantes (`IF NOT EXISTS` / aditivas), pero se recomienda una ventana de baja concurrencia (ej. domingo 02:00 COT).

---

## 2. Protocolo de Respaldo Previo Obligatorio

Antes de aplicar cualquier cambio en el contenedor de base de datos de Coolify:
1. Tomar snapshot físico inmediato de la base de datos de OdontoCloud:
   ```bash
   docker exec -t odontocloud-supabase-db pg_dump -U postgres -d postgres --format=custom -f /backups/pre_ihce_deploy_$(date +%Y%m%d_%H%M%S).dump
   ```
2. Verificar la integridad y suma SHA-256 del respaldo local antes de continuar.
3. Asegurar que el respaldo remoto en Cloudflare R2 (`odontocloud-backups-prod`) se encuentre sincronizado.

---

## 3. Plan de Rollback Seguro

Si durante la ventana de mantenimiento se detecta cualquier anomalía:
1. Aplicar el script de reversión no destructivo:
   [`supabase/migrations/20261012_ihce_microphase_1_safe_downgrade.sql`](file:///e:/copia%20de%20seguridad/odontocloud-react/supabase/migrations/20261012_ihce_microphase_1_safe_downgrade.sql)
2. Este script relaja las restricciones sin eliminar columnas ni destruir datos clínicos capturados, y preserva la regla legal de `ON DELETE RESTRICT` para evitar borrados accidentales de expedientes.

---

## 4. Activación Progresiva por Feature Flags

El sistema implementa tres niveles de salvaguarda para garantizar que la funcionalidad permanezca inactiva hasta que cada clínica sea autorizada:

```
[Nivel 1: Código]     IHCE_LIVE_ENABLED = false (Hardcoded en conector)
[Nivel 2: Plataforma] Feature Flag global IHCE_MODULE_ACTIVE = false
[Nivel 3: Clínica]    ihce_configurations.is_active = false (Por defecto para cada prestador)
```

### Lista Blanca de Piloto Controlado:
Para el primer despliegue piloto:
- Se habilitará exclusivamente para 1 clínica de prueba seleccionada mediante su `tenant_id` en `ihce_configurations`.
- El ambiente estará configurado en `SANDBOX_MOCK` o `PRUEBAS_MINSALUD`.
- Las restantes clínicas en producción operarán con normalidad sin observar ningún cambio en su interfaz.
