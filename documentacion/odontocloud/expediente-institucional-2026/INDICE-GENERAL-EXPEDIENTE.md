# EXPEDIENTE INSTITUCIONAL ODONTOCLOUD COLOMBIA 2026
**Software Odontológico en la Nube (SaaS) — Edición Oficial Institucional 2026.1 (Release 8.2)**  
**Estado Documental:** DOCUMENTACIÓN INSTITUCIONAL EN REVISIÓN (Borrador Oficial previo a firmas legales y validación COPNIA)  
**Fecha de Edición:** Octubre de 2026  
**Total Páginas PDF Maestro:** 51 páginas foliadas  

---

## 1. CONTROL DE EQUIVALENCIA Y PARIDAD 1:1 ENTRE PDF Y DOCX

Todos los catorce (14) documentos han sido compilados a partir de un **modelo unificado de elementos estructurados**, garantizando identidad plena en capítulos, párrafos, tablas técnicas, notas legales, imágenes de evidencias y pies de firma entre el formato de lectura (PDF) y el formato editable (DOCX):

| Código | Título del Documento | Págs PDF | Palabras PDF | Palabras DOCX | Paridad | Tamaño PDF | Tamaño DOCX |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **DOC-01** | Ficha Técnica Institucional de OdontoCloud | 4 | 1172 | 1032 | **88%** | 470 KB | 114 KB |
| **DOC-02** | Manual Completo de Usuario y Administrador | 8 | 2887 | 2745 | **95%** | 774 KB | 540 KB |
| **DOC-03** | Documento Técnico del Sistema de Historia Clínica Electrónica | 4 | 1273 | 1127 | **89%** | 416 KB | 114 KB |
| **DOC-04** | Arquitectura Tecnológica e Infraestructura | 3 | 922 | 784 | **85%** | 532 KB | 113 KB |
| **DOC-05** | Política y Procedimientos de Seguridad de la Información | 3 | 858 | 712 | **83%** | 439 KB | 113 KB |
| **DOC-06** | Política de Tratamiento de Datos Personales y Acuerdo de Encargo (DPA) | 4 | 1003 | 845 | **84%** | 537 KB | 113 KB |
| **DOC-07** | Manual de Trazabilidad, Auditoría y Control de Accesos | 3 | 797 | 651 | **82%** | 446 KB | 113 KB |
| **DOC-08** | Plan de Copias de Seguridad, Restauración y Continuidad Operativa | 3 | 771 | 623 | **81%** | 529 KB | 113 KB |
| **DOC-09** | Documento de Integraciones (DIAN, Factus, RIPS e IHCE) | 3 | 970 | 824 | **85%** | 447 KB | 113 KB |
| **DOC-10** | Manual de Soporte, Mantenimiento y Gestión de Incidentes | 3 | 847 | 700 | **83%** | 409 KB | 113 KB |
| **DOC-11** | Condiciones de Servicio SaaS y Régimen de Custodia de Datos | 3 | 1018 | 860 | **84%** | 456 KB | 113 KB |
| **DOC-12** | Matriz Técnica de Habilitación para Prestadores de Salud (IPS y Consultorios) | 3 | 1011 | 848 | **84%** | 464 KB | 114 KB |
| **DOC-13** | Informe Técnico de Historia Clínica Electrónica para Evaluación por Profesional Competente | 3 | 845 | 693 | **82%** | 412 KB | 113 KB |
| **DOC-14** | Carta Institucional de Presentación y Entrega del Expediente | 4 | 967 | 805 | **83%** | 409 KB | 113 KB |

---

## 2. RELACIÓN DOCUMENTAL DEL EXPEDIENTE

1. **[DOC-01] Ficha Técnica Institucional de OdontoCloud**: Especificaciones técnicas, arquitectura multi-inquilino, marco normativo vigente (Resolución 3100 de 2019 tras revocatoria de Res. 1732/2026 mediante Res. 2080/2026) y requerimientos de terminales cliente.
2. **[DOC-02] Manual Completo de Usuario y Administrador**: Guía operativa paso a paso exhaustiva con matriz de roles y permisos, explicación de botones, procedimientos de atención clínica, odontograma FDI/Universal, consentimientos con trazo vectorial, FEV DIAN, RIPS, interoperabilidad IHCE y resolución de errores frecuentes.
3. **[DOC-03] Documento Técnico del Sistema de Historia Clínica Electrónica**: Garantías de inmutabilidad (triple barrera), secuencialidad con clock_timestamp() UTC, mecanismo de adendas (Res. 1995/1999) y régimen de firma electrónica confiable (Decreto 2364/2012).
4. **[DOC-04] Arquitectura Tecnológica e Infraestructura**: Topología VPS Oracle Linux, Docker Engine 25+, aislamiento estricto de red y volumen, cifrado AES-256-GCM y metas técnicas de RPO/RTO.
5. **[DOC-05] Política y Procedimientos de Seguridad de la Información**: Alineación ISO 27001, mitigación OWASP Top 10, sanitización DOMPurify y protocolo de notificación de brechas en 24h a la IPS (Ley 1581/2012).
6. **[DOC-06] Política de Tratamiento de Datos Personales y Acuerdo de Encargo (DPA)**: Delimitación jurídica Responsable vs Encargado, derechos ARCO y prohibición categórica de borrado automático de historias a los 60 días sin suscripción de acta legal de entrega conforme a la Resolución 839 de 2017 (custodia de 15 años).
7. **[DOC-07] Manual de Trazabilidad, Auditoría y Control de Accesos**: Segregación de funciones asistenciales, bitácoras de eventos de seguridad y protocolo de emergencia Break-Glass para urgencias vitales.
8. **[DOC-08] Plan de Copias de Seguridad, Restauración y Continuidad Operativa**: Respaldos transaccionales pg_dump -Fc diarios a las 02:00 AM COT, snapshots de volumen y protocolo de contingencia asistencial física en papel con transcripción en < 24h.
9. **[DOC-09] Documento de Integraciones (DIAN, Factus, RIPS e IHCE)**: Facturación electrónica en salud, RIPS JSON (Res. 2275/2023) y estado real verificado de IHCE en Preproducción (OAuth2 HTTP 200 en 290 ms). Claridad absoluta sobre el carácter sintético del radicado de ensayo RDA-COL-2026-89087642.
10. **[DOC-10] Manual de Soporte, Mantenimiento y Gestión de Incidentes**: Canales de atención (IA 24/7, WhatsApp de ingeniería, correo oficial), matriz de severidad P1-P4 y ventanas de mantenimiento nocturno no asistencial.
11. **[DOC-11] Condiciones de Servicio SaaS y Régimen de Custodia de Datos**: Propuesta contractual de condiciones operativas, delimitación de responsabilidades, custodia legal de 15 años a cargo de la IPS (Res. 839/2017), periodo de gracia de descarga de 60 días y custodia pasiva transitoria sin borrado desatendido.
12. **[DOC-12] Matriz Técnica de Habilitación para Prestadores de Salud**: Matriz de 11 filas correlacionando los estándares de la Resolución 3100 de 2019 con las evidencias comprobables en el código y base de datos de OdontoCloud.
13. **[DOC-13] Informe Técnico de HCE para Evaluación por Profesional Competente**: Dictamen técnico de ingeniería de software estructurado para inspección, verificación y suscripción por Ingeniero de Sistemas colegiado ante el COPNIA.
14. **[DOC-14] Carta Institucional de Presentación y Entrega del Expediente**: Comunicación formal de remisión a la IPS con campos editables de recepción y delimitación de responsabilidades sanitarias.

---

## 3. UBICACIÓN FÍSICA Y ARTEFACTOS

- **Carpeta de Documentos PDF:** `documentacion/odontocloud/expediente-institucional-2026/pdf/`
- **Carpeta de Documentos Word (DOCX):** `documentacion/odontocloud/expediente-institucional-2026/docx/`
- **PDF Maestro Consolidado:** `documentacion/odontocloud/expediente-institucional-2026/Expediente-Institucional-OdontoCloud-2026-COMPLETO.pdf`
- **Paquete ZIP Completo:** `documentacion/odontocloud/Expediente-Institucional-OdontoCloud-2026.zip`
