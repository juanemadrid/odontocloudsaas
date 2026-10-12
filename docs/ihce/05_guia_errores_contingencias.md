# 05. GUÍA DE ERRORES, CONTINGENCIAS Y CÓDIGOS HTTP EN IHCE

**Propósito:** Manual de diagnóstico operativo ante códigos de respuesta devueltos por el mecanismo nacional de MinSalud (Hércules OAuth2 y API Vulcano FHIR R4).

---

## 1. Clasificación General de Códigos HTTP

| Código HTTP | Nombre Oficial | Categoría en OdontoCloud | Acción del Sistema | Conducta del Usuario / Soporte |
|:---:|---|:---:|---|---|
| **201** | Created | `ACEPTADO` | Guarda número de radicado oficial. Marca trabajo como terminado. | Ninguna acción requerida. Atención radicada con éxito. |
| **400** | Bad Request | `RECHAZADO` | Detiene reintentos. Marca error de estructura en log. | Verificar que los datos del paciente no contengan caracteres extraños. |
| **401** | Unauthorized | `ERROR_REINTENTO` | Invalida token en caché y solicita nuevo token a Hércules. | Automático. Si persiste, verificar Client Secret en Configuración. |
| **403** | Forbidden | `ERROR_DEFINITIVO` | Marca como no reintentable. Registra falta de permisos. | Verificar que el código REPS esté activo en el registro del Ministerio. |
| **422** | Unprocessable Entity | `RECHAZADO` | Almacena el `OperationOutcome` con la regla clínica infringida. | Corregir datos clínicos (ej. código CIE-10 no válido para la edad). |
| **429** | Too Many Requests | `ERROR_REINTENTO` | Lee encabezado `Retry-After` y programa espera (ej. 30 seg). | Espera automática. No realizar solicitudes masivas manuales. |
| **500** | Internal Server Error | `ERROR_REINTENTO` | Reintento automático con backoff exponencial progresivo. | Falla de MinSalud. El sistema seguirá reintentando automáticamente. |
| **503** | Service Unavailable | `ERROR_REINTENTO` | Programa reintento tras ventana de mantenimiento (60 seg). | MinSalud en ventana de mantenimiento. No afecta la atención local. |

---

## 2. Plan de Contingencia ante Caída Prolongada de MinSalud

### Principio de Inviolabilidad Clínica:
Una interrupción total de los servidores del Ministerio de Salud **NUNCA interrumpirá la atención odontológica en el consultorio ni impedirá el cierre de evoluciones**.

### Procedimiento de Contingencia:
1. El odontólogo atiende y sella la historia clínica normalmente.
2. La evolución queda firmada, sellada con SHA-256 e inmutable en OdontoCloud.
3. El Outbox Worker detectará la indisponibilidad (HTTP 503/Timeout) y mantendrá la tarea en estado `ERROR_REINTENTO` con un tiempo de espera creciente.
4. Tan pronto como MinSalud restablezca sus servicios, el worker despachará las atenciones pendientes en orden cronológico respetando la cuota de peticiones.
