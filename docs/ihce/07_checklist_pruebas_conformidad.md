# 07. CHECKLIST DE PRUEBAS OFICIALES Y CONFORMIDAD MINSALUD

**Referencia:** Procedimiento de Evaluación de Conformidad Técnica de Sistemas de Información (MinSalud - Dirección de Epidemiología y Demografía).

---

## 1. Batería de Pruebas de Conformidad (MinSalud)

Cada clínica que tramite su habilitación de interoperabilidad ante el Ministerio de Salud debe superar satisfactoriamente los siguientes escenarios de prueba en el ambiente de pruebas del Ministerio (`PRUEBAS_MINSALUD`):

- [x] **CP-01: Autenticación Exitosa en Hércules OAuth2:**
  - Obtención de token `Bearer` con `client_credentials`.
  - Alcance (scopes) verificado: `ihce:write ihce:read`.
- [x] **CP-02: Generación de Bundle RDA Conforme a Perfil Oficial:**
  - Estructura `type = "document"`.
  - Recurso raíz `Composition` con código LOINC `11506-3`.
  - Recurso `Patient` con identificador válido y extensiones territoriales y étnicas.
  - Recurso `Encounter` con codificación de modalidad intramural/extramural.
  - Recursos `Condition` y `Procedure` con codificación estándar CIE-10 y CUPS.
- [x] **CP-03: Radicación Exitosa de Consulta Externa (HTTP 201):**
  - Envío de atención odontológica con radicado retornado e incorporado en trazabilidad local.
- [x] **CP-04: Prueba de Idempotencia y No-Duplicidad:**
  - Reenvío intencional del mismo documento.
  - El sistema receptor no duplica la atención y confirma el radicado original.
- [x] **CP-05: Manejo de Rechazo Semántico (HTTP 422):**
  - Intento de radicación con código incompatible.
  - Recepción de `OperationOutcome` y registro sin reintento infinito.
- [x] **CP-06: Consulta de RDA Externo (HTTP 200):**
  - Búsqueda de historial de paciente de prueba en la red ministerial.
  - Despliegue legible en el visor clínico.

---

## 2. Requisitos Previos para Agendar Pruebas Oficiales

1. Contar con código de habilitación REPS activo en la sede.
2. Contar con credenciales de prueba (`client_id` y `client_secret`) asignadas por la mesa de ayuda de MinSalud/SISPRO.
3. Haber completado las pruebas en el simulador local de OdontoCloud sin errores.
