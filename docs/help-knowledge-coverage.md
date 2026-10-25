# Alcance verificable del conocimiento de ayuda

Fecha: 24 de octubre de 2026.

El catálogo consultable contiene 41 guías con una fuente existente en el repositorio. Esto verifica procedencia, no certifica que todos sus pasos hayan sido probados en producción ni que cubra cada pantalla y variante del sistema. No presentar esta lista como aprendizaje completo o conocimiento infalible.

La IA puede leer las guías completas; no recibe código fuente, secretos, registros de pacientes ni datos de otras clínicas. Las páginas comerciales generales de seguridad y características no se usan como prueba de comportamiento operativo. Una capacidad no documentada debe reconocerse como no verificada, sin afirmar que está implementada o que no existe.

| ID | Procedimiento | Fuente principal | Pasos |
|---|---|---|---|
| citas | Apartar una cita nueva | [fuente](../src/modules/agenda/components/AppointmentModal.jsx) | 6 |
| editar-cita | Modificar o cancelar una cita | [fuente](../src/modules/agenda/components/AppointmentModal.jsx) | 5 |
| whatsapp-cita | Enviar recordatorio por WhatsApp | [fuente](../src/modules/agenda/Agenda.jsx) | 4 |
| horarios | Configurar horarios y disponibilidad | [fuente](../src/modules/administracion/views/GestionAgenda.jsx) | 4 |
| pacientes | Crear o buscar un paciente | [fuente](../src/modules/pacientes/components/PatientList.jsx) | 5 |
| importar-pacientes | Importar pacientes (Excel) | [fuente](../src/modules/pacientes/components/ImportadorPacientes.jsx) | 4 |
| ficha-paciente | Ficha clínica y asignación de doctores | [fuente](../src/modules/pacientes/components/PatientDetails.jsx) | 4 |
| historia | Consultar documentos e historia clínica | [fuente](../src/modules/pacientes/components/HistoriaClinicaContainer.jsx) | 4 |
| odontograma | Odontograma digital, dientes y registro de hallazgos clínicos | [fuente](../src/modules/odontograma/Odontograma.jsx) | 5 |
| periodontograma | Consultar y registrar el periodontograma | [fuente](../src/modules/odontograma/Periodontograma.jsx) | 3 |
| evoluciones | Registrar evolución odontológica y diagnósticos CIE-10 | [fuente](../src/modules/pacientes/components/EvolucionesTab.jsx) | 7 |
| presupuestos | Crear presupuesto y planes de tratamiento | [fuente](../src/modules/pacientes/components/PlanList.jsx) | 6 |
| archivos | Radiografías, imágenes y documentos | [fuente](../src/modules/pacientes/components/PatientRxTab.jsx) | 3 |
| abrir-caja | Apertura de caja al inicio del turno | [fuente](../src/modules/caja/components/AbrirCajaModal.jsx) | 4 |
| pagos-paciente | Registrar pago o abono de un paciente | [fuente](../src/modules/pacientes/components/PagoTab.jsx) | 7 |
| cerrar-caja | Cerrar y cuadrar la caja (Arqueo diario) | [fuente](../src/modules/caja/components/CerrarCajaModal.jsx) | 7 |
| facturas | Factura de venta y facturación electrónica | [fuente](../src/modules/administracion/views/FacturacionHub.jsx) | 4 |
| recibos | Recibos de caja y saldos a favor | [fuente](../src/modules/administracion/views/FacturacionHub.jsx) | 3 |
| liquidaciones | Liquidación de comisiones y tratamientos | [fuente](../src/modules/administracion/views/FacturacionHub.jsx) | 3 |
| proveedores | Pagos a proveedores y facturas de compra | [fuente](../src/modules/administracion/views/FacturacionHub.jsx) | 4 |
| reportes | Encontrar reportes e indicadores | [fuente](../src/modules/reportes/Reportes.jsx) | 3 |
| rips | Generación y validación de RIPS JSON (Resolución 2275) | [fuente](../src/modules/rips/RipsGenerator.jsx) | 5 |
| terceros | Gestionar terceros y convenios | [fuente](../src/modules/administracion/AdministracionRouter.jsx) | 3 |
| esterilizacion | Registrar esterilización | [fuente](../src/modules/esterilizacion/Esterilizacion.jsx) | 3 |
| residuos | Consultar gestión de residuos | [fuente](../src/modules/administracion/AdministracionRouter.jsx) | 3 |
| sedes | Configurar sedes y espacios clínicos | [fuente](../src/modules/config/ConfigRouter.jsx) | 3 |
| usuarios | Usuarios, doctores y especialistas (Perfiles y permisos) | [fuente](../src/modules/config/EmpresaUsuarios.jsx) | 5 |
| especialidades | Especialidades médicas y odontológicas | [fuente](../src/modules/config/EmpresaEspecialidades.jsx) | 5 |
| empresa | Datos de la clínica y empresa (Configuración inicial) | [fuente](../src/modules/config/ConfigEmpresa.jsx) | 5 |
| precios | Listas de precios y planes | [fuente](../src/modules/config/ConfigRouter.jsx) | 3 |
| catalogos | Catálogos financieros y contables | [fuente](../src/modules/config/ConfigMenu.jsx) | 3 |
| formularios | Formularios y plantillas clínicas | [fuente](../src/modules/config/ConfigRouter.jsx) | 3 |
| suscripcion | Consultar la suscripción | [fuente](../src/modules/config/ConfigSuscripcion.jsx) | 3 |
| imprimir-agenda | Imprimir la agenda | [fuente](../src/modules/agenda/Agenda.jsx) | 3 |
| editor-web | Editar la página web de la clínica | [fuente](../src/modules/cms/WebsiteEditor.jsx) | 4 |
| portal | Portal del paciente y solicitudes de cita | [fuente](../src/modules/portal/PatientPortal.jsx) | 3 |
| logs | Consultar errores y registros de comunicación | [fuente](../src/modules/reportes/Reportes.jsx) | 3 |
| ayuda-ia | Qué puede hacer este asistente | [fuente](../src/components/OdontoHelpAssistantModal.jsx) | 3 |
| planes-suscripcion | Planes y Precios Oficiales de OdontoCloud | [fuente](../src/pages/landing/PricingPage.jsx) | 5 |
| prueba-gratis | Iniciar Prueba Gratuita de 30 Días | [fuente](../src/components/landing/TrialModal.jsx) | 4 |
| contacto-soporte | Contacto Comercial y Asesoría Humana por WhatsApp | [fuente](../src/pages/landing/FAQPage.jsx) | 4 |

## Límites que deben mantenerse visibles en el desarrollo

- Las pruebas simuladas validan selección, contexto, privacidad y transporte; no prueban la calidad de una respuesta real de Gemini.
- Probar IA reproduce una conversación realista sobre RIPS con el proveedor configurado; la respuesta debe revisarse por contenido, no solo por su etiqueta de proveedor.
- La existencia de un componente o un texto comercial no demuestra que esa función esté expuesta en el producto. Por ejemplo, CrmTab.jsx no tiene referencias activas encontradas en src; no es fundamento suficiente para prometer generación automática de leads.
- Revisar esta documentación cuando cambien rutas, permisos, estados, botones o flujos; conservar trazabilidad de fuentes y casos de conversación completos.
