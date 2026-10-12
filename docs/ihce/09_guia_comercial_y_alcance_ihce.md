# 09. GUÍA COMERCIAL Y ESTADO DE ALCANCE IHCE — ODONTOCLOUD SAAS

**Fecha de Publicación:** Octubre 2026  
**Audiencia:** Equipo Comercial, Gerencia, Clínicas Clientes y Auditores de Salud.  
**Propósito:** Establecer de forma transparente, ética y precisa el estado funcional real del módulo de Interoperabilidad de la Historia Clínica Electrónica (IHCE) de OdontoCloud, diferenciando lo que está desarrollado y verificado de lo que requiere el trámite de conformidad oficial ante el Ministerio de Salud.

---

## 1. Declaración Ética y Normativa

> [!IMPORTANT]
> **COMPROMISO DE TRANSPARENCIA:**  
> OdontoCloud SaaS **NO declara haber obtenido la certificación oficial ministerial ni autorización de producción nacional**, ya que dicha conformidad requiere por mandato legal un proceso formal de evaluación técnica con el Ministerio de Salud y Protección Social sobre el ambiente oficial `PRUEBAS_MINSALUD`.  
> OdontoCloud se declara **TÉCNICAMENTE PREPARADO Y APTO** para someterse de inmediato a dicho proceso de evaluación con el 100% de los requisitos arquitectónicos y clínicos implementados.

---

## 2. Matriz de Estado Funcional

| Módulo / Funcionalidad | Estado de Desarrollo | Verificación Técnica Real | Disponibilidad para Clínicas |
|---|:---:|:---:|---|
| **Estructuración FHIR R4 de Consulta Externa** | **100% Completo** | Validado con perfiles oficiales MinSalud | Disponible (datos sintéticos y locales) |
| **Normalización Clínica (REPS, DIVIPOLA, CIE, CUPS)** | **100% Completo** | 100% probado en PostgreSQL 17.6 | Activo en el formulario de atención |
| **Sellado Inmutable de Evoluciones (SHA-256)** | **100% Completo** | Verificado con trigger inmutable | Activo para todos los odontólogos |
| **Firma Electrónica Confiable con Reautenticación** | **100% Completo** | Probado en RPC `verify_and_close_evolution` | Activo en modal de firma clínica |
| **Cola Asíncrona Transaccional (Outbox)** | **100% Completo** | Probado con concurrencia `SKIP LOCKED` | Operativo en segundo plano |
| **Write-Only Security para Credenciales** | **100% Completo** | Secretos enmascarados `••••••••` | Activo en panel de configuración |
| **Protocolo Break-Glass con Doble Control** | **100% Completo** | Aprobación/Revocación por Admin probada | Operativo en panel administrativo |
| **Visor de Resúmenes Clínicos Externos (RDA)** | **100% Completo** | Probado con repositorio sintético | Disponible en pestaña del panel IHCE |
| **Conexión Real con Producción MinSalud** | **Preparado y Bloqueado** | `IHCE_LIVE_ENABLED = false` | Sujeto a certificación oficial |

---

## 3. Beneficios Comerciales para las Clínicas Odontológicas

1. **Cumplimiento Normativo Anticipado:** La clínica asegura el cumplimiento de la Ley 2015 de 2020 y Resoluciones 866/2021, 1888/2025 y 1799/2026 sin traumatismos en su operación diaria.
2. **Cero Retrasos en Consulta:** La atención odontológica local nunca se ralentiza ni se cae si los servidores del Ministerio presentan lentitud o mantenimiento.
3. **Máxima Seguridad Jurídica:** El sellado criptográfico SHA-256 garantiza la inviolabilidad de la historia clínica ante demandas o requerimientos de auditoría médica.
4. **Independencia de Datos:** Cada clínica gestiona sus propias credenciales en un entorno totalmente aislado de otros prestadores.
