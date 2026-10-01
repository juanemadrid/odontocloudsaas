# OdontoCloud - Manual Operativo y Guiones Oficiales para Videos Tutoriales

Este documento contiene el paso a paso **100% verificado contra el código fuente y la arquitectura real de OdontoCloud en producción**. Está redactado en lenguaje claro, clínico y administrativo (sin tecnicismos de programación ni menciones a bases de datos), para que cualquier usuario (asistente, recepcionista, odontólogo o administrador de clínica) pueda dominar el sistema de forma intuitiva y sin errores.

Cada módulo incluye además su **Guion de Grabación (Screen + Locución)** optimizado para grabar videos tutoriales en Loom, YouTube o WhatsApp en 2 a 3 minutos.

---

## 🧭 Mapa de Navegación Principal del Sistema

En la barra lateral izquierda de OdontoCloud encontrarás los **6 módulos operativos principales**:
1. **[INICIO]:** Métricas del día, resumen de citas, pacientes atendidos y accesos rápidos.
2. **[AGENDA]:** Calendario interactivo por sedes, sillones y doctores, con recordatorios por WhatsApp.
3. **[PACIENTES]:** Directorio general, creación de pacientes y acceso a la **Ficha Clínica Integral (17 pestañas)**.
4. **[CAJA]:** Apertura de turno, control de cajas abiertas/cerradas, bancos y arqueo de cierre diario.
5. **[ADMINISTRACIÓN]:** Centro operativo que agrupa:
   - **Facturación:** Facturación de venta DIAN (según plan), Recibos de caja, Pagos, Liquidaciones, Notas de crédito, Notas débito y Traslados.
   - **Convenios:** Descuentos y acuerdos institucionales.
   - **Gestión Agenda:** Horarios y turnos de especialistas.
   - **Terceros:** Directorio de clientes y proveedores.
   - **Residuos Hosp.:** Registro ambiental y biológico.
   - **RIPS JSON:** Generación oficial bajo Resolución 2275 de 2023.
   - **Esterilización:** Bitácora y trazabilidad de cargas en autoclaves.
6. **[REPORTES]:** Indicadores financieros, morbilidad, cartera, citas y logs de auditoría.

*(Nota de configuración: En la barra superior y pie del sistema se accede a **[Configuración]** para gestionar sedes, tarifas, usuarios, firmas digitales y plantillas clínicas).*

---

## 📑 Índice de Módulos Operativos
1. [Módulo 1: Agenda & Citas (Crear, Modificar, Cancelar y WhatsApp)](#módulo-1-agenda--citas)
2. [Módulo 2: Pacientes & Ficha Clínica (Directorio, Nuevo Paciente y las 17 Pestañas)](#módulo-2-pacientes--ficha-clínica)
3. [Módulo 3: Odontograma Digital Interactivo](#módulo-3-odontograma-digital-interactivo)
4. [Módulo 4: Evoluciones Clínicas, Remisiones & Copiloto IA](#módulo-4-evoluciones-clínicas-remisiones--copiloto-ia)
5. [Módulo 5: Presupuestos & Planes de Tratamiento](#módulo-5-presupuestos--planes-de-tratamiento)
6. [Módulo 6: Caja, Cobros & Arqueo Diario](#módulo-6-caja-cobros--arqueo-diario)
7. [Módulo 7: Administración & Facturación](#módulo-7-administración--facturación)

---

## Módulo 1: Agenda & Citas

### 1.1 Cómo apartar una Cita Nueva
* **Objetivo:** Reservar un turno en el calendario asignando paciente, doctor, espacio clínico (sillón) y horario.
* **Dónde se hace:** Menú lateral izquierdo -> **[AGENDA]**.

#### Paso a paso exacto en pantalla:
1. En el calendario de **Agenda**, haz clic sobre el recuadro de la hora y consultorio donde deseas agendar. Se abrirá la ventana **"Agendar Cita"**.
2. En la sección **Identidad del Paciente**:
   - **Si el paciente ya existe:** Escribe su nombre o número de documento en el buscador y selecciónalo de la lista desplegable.
   - **Si el paciente es nuevo:** Haz clic en la opción de crear nuevo paciente y completa los campos requeridos: *Nombres*, *Apellidos*, *Tipo de documento*, *Número de documento*, *Celular*, *Fecha de nacimiento* y *Sexo*.
3. En la sección **Detalles de la Cita**:
   - Confirma la **Sede**.
   - Selecciona el **Profesional** (odontólogo o especialista) que atenderá la cita.
   - Selecciona el **Espacio Clínico** (sillón o consultorio asignado).
   - Define la **Fecha de Cita**, **Hora** y la **Duración Estimada** en minutos (por defecto 30 minutos).
   - Opcional: Selecciona la *Especialidad*, la *Entidad / Convenio* y si la cita corresponde a **Valoración** o **Control**.
4. Añade un **Comentario** o motivo de consulta si es necesario.
5. Verifica que el **Estado de la Cita** esté en **Sin Confirmar** (o el estado inicial que desees).
6. Haz clic en el botón verde inferior **[CONFIRMAR REGISTRO]**.
   - El sistema validará que el profesional y el sillón no tengan cruces de horario.
   - La cita quedará guardada y aparecerá coloreada en el calendario.

> ⚠️ **Alertas y Validaciones Reales:**
> - Si intentas cerrar la ventana habiendo hecho cambios sin guardar, el sistema te mostrará la alerta: *«¿Descartar Cambios?»* con los botones **[Descartar y Cerrar]** o **[Seguir Editando]**.
> - Si la cita tiene más de 30 días de antigüedad, el sistema la bloquea por seguridad y el botón mostrará **`CITA CERRADA (+1 MES)`**.

---

### 1.2 Cómo Reprogramar, Cambiar Estado o Cancelar una Cita
* **Objetivo:** Modificar la hora, cambiar el estado del paciente o liberar el turno.
* **Dónde se hace:** Menú lateral izquierdo -> **[AGENDA]**.

#### Paso a paso exacto en pantalla:
1. Localiza la cita en el calendario y haz un clic sobre ella para abrir sus detalles.
2. **Para reprogramar:** Cambia la *Fecha*, *Hora*, *Duración* o el *Profesional tratante*. Luego haz clic en **[CONFIRMAR REGISTRO]**.
3. **Para cambiar de estado:** En el selector **Estado de la Cita**, elige la opción correspondiente:
   - `Sin Confirmar` (cita pendiente).
   - `Confirmada` (el paciente confirmó asistencia).
   - `En espera` (el paciente ya llegó a la sala de espera de la clínica).
   - `Atendido` (el doctor ya atendió al paciente).
   - `Cancelado` (el paciente no asistirá y se libera el espacio).
   - `No asiste`, `Urgencia` o `Sin Cont. WEB`.
4. Haz clic en el botón verde **[CONFIRMAR REGISTRO]** para actualizar el color y estado en la agenda.
5. **Para eliminar definitivamente una cita:**
   - Haz clic en el botón rojo **[ELIMINAR CITA]** (solo disponible si tu usuario tiene permisos de eliminación).
   - Aparecerá un cuadro de advertencia: *«¿Está seguro que quiere eliminar esta cita? Esta acción es permanente»*.
   - Confirma haciendo clic en **[Sí, Eliminar]** (o cancela con **[No, Cancelar]**).

---

### 1.3 Cómo enviar Recordatorio de Cita por WhatsApp
* **Objetivo:** Enviar al paciente el mensaje de confirmación con fecha, hora y sede con un solo clic.
* **Dónde se hace:** Directamente sobre la tarjeta de la cita en **[AGENDA]**.

#### Paso a paso exacto en pantalla:
1. Ubica la cita del paciente en el calendario.
2. Haz clic en el icono verde de **WhatsApp** ubicado en la tarjeta de la cita.
3. El sistema generará automáticamente el texto con el nombre del paciente, fecha, hora, doctor y nombre comercial de la clínica, abriendo WhatsApp Web o la aplicación de WhatsApp.
4. Revisa el texto y pulsa enviar.

---

### 🎬 Guion de Video 1: "Cómo agendar y gestionar citas en OdontoCloud" (Duración: 2 min)

* **[0:00 - 0:15] Introducción:**  
  *Voz:* "¡Hola! En este tutorial aprenderás a agendar citas de forma rápida y sin errores en OdontoCloud. Veamos cómo hacerlo paso a paso."  
  *Acción en pantalla:* Mostrar la pantalla principal y entrar al módulo **AGENDA**.
* **[0:15 - 0:45] Agendar cita:**  
  *Voz:* "Hacemos clic en el horario deseado. En la sección 'Identidad del Paciente', buscamos al paciente por su cédula o nombre. Si es nuevo, lo creamos en segundos con sus datos básicos. En 'Detalles de la Cita', elegimos la sede, el doctor tratante y el sillón o consultorio. Ajustamos la duración, por ejemplo 30 o 45 minutos, y dejamos el estado en 'Sin Confirmar'. Para finalizar, pulsamos el botón verde 'CONFIRMAR REGISTRO'."  
  *Acción en pantalla:* Realizar el proceso en vivo y pulsar el botón verde.
* **[0:45 - 1:15] Estados y Recordatorio de WhatsApp:**  
  *Voz:* "La cita ya aparece en la agenda. Cuando el paciente confirme o llegue a la clínica, simplemente abrimos la cita y cambiamos su estado a 'Confirmada' o 'En espera'. Además, haciendo clic en el icono de WhatsApp, el sistema redacta el recordatorio automático para enviárselo directamente al celular del paciente."  
  *Acción en pantalla:* Mostrar cambio de estado y clic en el icono de WhatsApp.
* **[1:15 - 1:30] Cierre:**  
  *Voz:* "Así de fácil y seguro es gestionar la agenda de tu clínica con OdontoCloud. ¡Nos vemos en el próximo video!"

---

## Módulo 2: Pacientes & Ficha Clínica

### 2.1 Cómo registrar un Paciente y acceder a su Expediente
* **Objetivo:** Crear el historial del paciente y consultar su expediente clínico integral.
* **Dónde se hace:** Menú lateral izquierdo -> **[PACIENTES]**.

#### Paso a paso exacto en pantalla:
1. Entra a **[PACIENTES]**. Verás el **Directorio de Pacientes**.
2. En la barra superior, usa el buscador para comprobar si el paciente ya existe (puedes buscar por documento, nombres o celular).
3. Si no existe, haz clic en el botón verde superior **[+ Nuevo Paciente]**.
4. Completa los datos en la ventana de registro:
   - **Obligatorios:** Tipo de documento, Número de documento, Nombres, Apellidos, Celular, Fecha de nacimiento y Sexo.
   - Opcionales: Correo electrónico, Dirección, EPS y Ocupación.
5. Haz clic en **[Guardar]**. El paciente quedará registrado inmediatamente.
6. Para abrir su expediente completo, haz clic sobre el nombre del paciente en la lista. Se abrirá la **Ficha Integral del Paciente**, que contiene en su barra lateral izquierda las **17 pestañas clínicas y administrativas**:

#### Estructura real de las 17 pestañas del Paciente:
* **Bloque 1: Información General**
  1. `Datos personales`: Información de contacto, fotografía y datos sociodemográficos.
  2. `Marketing`: Origen del paciente (referido, redes sociales, etc.).
  3. `EPS`: Régimen de salud y entidad aseguradora.
  4. `Beneficiarios convenio`: Vínculo familiar o empresarial con tarifas preferenciales.
  5. `Rx / Imágenes / Doc`: Radiografías panorámicas, periapicales, fotos clínicas y archivos PDF adjuntos.
  6. `Profesionales`: **Asignación obligatoria de doctores tratantes** (clave para habilitar evoluciones).
  7. `Citas`: Historial cronológico de citas pasadas, canceladas y próximas.
* **Bloque 2: Historia Clínica**
  8. `Doc. Clínicos`: Formularios de anamnesis, historia médica general y consentimientos informados con firma digital.
  9. `Odontogramas`: Odontograma digital interactivo con historial de versiones y sincronización automática.
  10. `Periodontogramas`: Registro gráfico y numérico de profundidades de sondaje, margen gingival y sangrado.
  11. `Presupuestos & planes`: Cotizaciones, planes de tratamiento activos y procedimientos pendientes.
  12. `Evoluciones & Remis`: Registro legal de atenciones clínicas y remisiones médicas interconsulta.
* **Bloque 3: Inteligencia Artificial**
  13. `Copiloto IA Insights`: Resumen clínico inteligente, análisis de antecedentes y sugerencias de tratamiento generadas por IA.
* **Bloque 4: Facturación & Pagos**
  14. `Saldo a favor`: Control de anticipos no consumidos y devoluciones al paciente.
  15. `Realizar pago`: Módulo de recaudo para abonar o cancelar planes de tratamiento.
  16. `Histórico de pagos`: Registro cronológico de todos los recibos y abonos recibidos.
  17. `Facturación`: Historial de facturas electrónicas de venta emitidas ante la DIAN *(pestaña visible únicamente si la clínica tiene contratado un plan con Facturación Electrónica DIAN)*.

> 🔴 **Regla de Oro Clínica (Muy importante):**  
> Para que un odontólogo pueda registrar una evolución o remisión clínica, **debe estar vinculado al paciente en la pestaña [Profesionales]**. Si el doctor no está asignado, el sistema protegerá la historia clínica mostrando la advertencia: *«Modo de solo consulta: No estás vinculado como profesional tratante a este paciente»*.

---

### 🎬 Guion de Video 2: "Creación de Pacientes y Expediente Clínico" (Duración: 2 min)

* **[0:00 - 0:20] Introducción:**  
  *Voz:* "Bienvenido. En este video aprenderás a crear un paciente en OdontoCloud y a navegar por su ficha clínica digital integral."  
  *Acción en pantalla:* Clic en **PACIENTES**.
* **[0:20 - 0:50] Crear paciente:**  
  *Voz:* "En el directorio pulsamos el botón verde '+ Nuevo Paciente'. Llenamos los datos obligatorios: tipo y número de documento, nombres completos, celular y fecha de nacimiento. Pulsamos 'Guardar' y el paciente queda registrado de inmediato."  
  *Acción en pantalla:* Llenar el formulario de paciente y guardar.
* **[0:50 - 1:30] Ficha Clínica y Asignación de Doctor:**  
  *Voz:* "Al hacer clic sobre el paciente, entramos a su ficha integral. En el menú lateral encontramos todo su expediente: datos personales, radiografías, odontograma, presupuestos y evoluciones. Recuerda un paso clave: en la pestaña 'Profesionales' vinculamos al odontólogo tratante para habilitar el registro de notas clínicas y evoluciones."  
  *Acción en pantalla:* Recorrer las pestañas y mostrar la asignación en la pestaña **Profesionales**.

---

## Módulo 3: Odontograma Digital Interactivo

### 3.1 Cómo registrar Hallazgos y Sincronizar con el Presupuesto
* **Objetivo:** Registrar el estado dental del paciente cara por cara y transferir los tratamientos requeridos directamente a cotización.
* **Dónde se hace:** Ficha del paciente -> Pestaña **[Odontogramas]**.

#### Paso a paso exacto en pantalla:
1. Abre la ficha del paciente y haz clic en la pestaña **[Odontogramas]**.
2. Estarás en el **Modo Lista**. Podrás ver los odontogramas previos con su fecha, doctor y estado (*Abierto* o *Finalizado*), además de opciones para **Imprimir**, **Exportar imagen** o registrar la **Firma de Paciente**.
3. Para iniciar una nueva valoración, haz clic en el botón superior **[+ Nuevo Odontograma]**. Se abrirá el **Editor Interactivo**.
4. Configura la vista de trabajo:
   - **Tipo de Dentición:** Elige entre `Completo` (adulto e infantil), `Permanente` (adulto) o `Temporal` (niños).
   - **Filtro de Superficies:** Visualiza todas las caras o filtra por *Vestibular*, *Palatina/Lingual*, *Mesial*, *Distal* u *Oclusal/Incisal*.
5. Selecciona la herramienta en la barra superior:
   - Opciones: `Caries` (rojo), `Obturación` (azul), `Corona`, `Endodoncia`, `Extracción`, `Implante`, `Prótesis` o `Borrador`.
6. Haz clic sobre el diente o sobre la cara específica (centro, borde superior, inferior, lateral).
   - El sistema coloreará la superficie seleccionada con la convención gráfica oficial.
   - En la tabla derecha de **Plan de Tratamiento / Hallazgos**, se creará automáticamente la fila con el número de diente, cara y tratamiento planificado.
7. Añade notas clínicas en el cuadro inferior de **Observaciones**.
8. **Opciones de Guardado:**
   - **Botón `[Guardar]`:** Guarda los cambios manteniendo el odontograma en estado *Abierto* para continuar editándolo en futuras citas.
   - **Botón `[Finalizar]`:** Cierra el odontograma definitivamente y **sincroniza en automático todos los tratamientos con el Plan de Tratamiento del paciente**, dejándolos listos para cotizar en Presupuestos.

---

### 🎬 Guion de Video 3: "Uso del Odontograma Digital y Sincronización" (Duración: 2:30 min)

* **[0:00 - 0:25] Introducción:**  
  *Voz:* "En este video te enseñaremos a utilizar el odontograma digital interactivo de OdontoCloud y cómo sincroniza automáticamente los tratamientos con el presupuesto del paciente."  
  *Acción en pantalla:* Entrar a la ficha del paciente y abrir la pestaña **Odontogramas**.
* **[0:25 - 1:10] Registro de Hallazgos:**  
  *Voz:* "Pulsamos '+ Nuevo Odontograma'. Podemos elegir dentición de adulto, infantil o completa. En la barra de herramientas seleccionamos el hallazgo clínico, por ejemplo Caries, y hacemos clic directamente sobre la cara del diente que queremos registrar. Si el tratamiento aplica a toda la pieza, como una corona o implante, el sistema lo marca completo. A la derecha vemos cómo se genera la lista de tratamientos en tiempo real."  
  *Acción en pantalla:* Seleccionar 'Caries' y marcar caras; luego seleccionar 'Corona' y marcar una pieza completa.
* **[1:10 - 1:50] Guardar vs Finalizar:**  
  *Voz:* "Podemos usar el botón 'Guardar' si la consulta continúa abierta. Cuando la valoración esté lista, pulsamos 'Finalizar'. Esto no solo protege el registro clínico, sino que transfiere de inmediato todos los procedimientos a la sección de Presupuestos para que secretaría pueda cotizarle al paciente."  
  *Acción en pantalla:* Mostrar el botón 'Finalizar' y la confirmación en pantalla.

---

## Módulo 4: Evoluciones Clínicas, Remisiones & Copiloto IA

### 4.1 Cómo registrar una Evolución Odontológica Legal
* **Objetivo:** Cumplir con la norma de historia clínica registrando el procedimiento realizado, insumos, diagnósticos CIE-10 y notas asistidas por IA.
* **Dónde se hace:** Ficha del paciente -> Pestaña **[Evoluciones & Remis]**.

#### Paso a paso exacto en pantalla:
1. Abre la ficha del paciente y entra a **[Evoluciones & Remis]**.
2. En la barra superior encontrarás los botones de acción:
   - **Botón verde `[Evolución]`:** Para registrar una nueva atención clínica.
   - **Botón verde `[Remitir]`:** Para generar una remisión médica o interconsulta a otro especialista.
   - **Botón `[Imprimir]`:** Para generar el documento PDF consolidado de toda la historia de evoluciones.
3. Haz clic en **`[Evolución]`**. Se abrirá la ventana de registro:
   - **Fecha y Hora:** El sistema carga la hora actual de manera automática.
   - **Procedimiento Realizado:** Selecciona el procedimiento ejecutado o impórtalo desde el plan de tratamiento activo.
   - **Diagnóstico CIE-10:** Escribe en el buscador el código o nombre de la patología (ej. *K029 - Caries dental* o *K051 - Gingivitis crónica*). El sistema sugiere automáticamente la finalidad y causa según el procedimiento.
   - **Descripción y Nota de Evolución:** Redacta el detalle clínico del tratamiento realizado.  
     *(Opcional: puedes activar el **Copiloto IA** para ayudarte a estructurar la nota con formato clínico profesional).*
   - **Anestesia e Insumos:** Si aplicaste anestesia, selecciona el producto (ej. *Lidocaína al 2%*, *Mepivacaína*) y la vía de administración (*Infiltrativa*, *Troncular*).
4. Haz clic en **[Guardar Evolución]**. La evolución quedará sellada con el nombre del doctor, fecha, hora y firma digital.
5. **Para notas posteriores:** Si necesitas realizar una aclaración, utiliza la pestaña **[Nota Aclaratoria]**, que mantiene la trazabilidad e inmutabilidad legal sin alterar la nota original.

---

## Módulo 5: Presupuestos & Planes de Tratamiento

### 5.1 Cómo crear y gestionar un Presupuesto o Plan
* **Objetivo:** Presentar al paciente el costo de sus tratamientos, convertir cotizaciones en planes activos y pasar tratamientos a evolución con un solo clic.
* **Dónde se hace:** Ficha del paciente -> Pestaña **[Presupuestos & planes]**.

#### Paso a paso exacto en pantalla:
1. Entra a la pestaña **[Presupuestos & planes]** y pulsa el botón **[+ Nuevo Plan]**.
2. **Cargar procedimientos:**
   - **Desde Odontograma:** Pulsa el botón verde **`[Odonto. Actual]`** para cargar los tratamientos diagnosticados en el odontograma del paciente.
   - **Desde Tarifario:** Pulsa el botón verde **`[Agregar items]`** para buscar procedimientos por nombre o código en la lista de precios de la clínica.
3. Para cada ítem en la tabla:
   - Ajusta la cantidad, el profesional asignado, el valor unitario y posibles descuentos.
   - Si la clínica maneja convenio o copago con EPS, selecciona la cobertura aplicable.
4. **Acciones clave en la tabla de procedimientos:**
   - **Columna `✓` (Realizar):** Marca la casilla de los procedimientos realizados en la cita y pulsa el botón azul superior **`[Realizar]`**. El sistema abrirá la ventana de evolución clínica con los datos prellenados, marcando el procedimiento como ejecutado.
   - **Columna `?` (Semáforo de estado):** Un punto visual indica si el procedimiento está *Sin realizar* (gris), *Realizado con deuda* (rojo), *Con abono parcial* (amarillo) o *Totalmente pagado* (verde).
   - **Botón `[Convertir a Plan]`:** Permite transformar una cotización informativa en un plan de tratamiento formal en curso.
   - **Icono de Impresora:** Genera el presupuesto formal en PDF con el membrete y logo de la clínica para entrega al paciente.

---

## Módulo 6: Caja, Cobros & Arqueo Diario

### 6.1 Cómo abrir la Caja al inicio del turno
* **Objetivo:** Iniciar la jornada registrando la base de efectivo disponible en recepción.
* **Dónde se hace:** Menú lateral izquierdo -> **[CAJA]**.

#### Paso a paso exacto en pantalla:
1. Entra al módulo **[CAJA]** y haz clic en el botón superior **[Abrir Caja]** (o la pestaña `Abrir caja`).
2. En la ventana emergente:
   - Confirma el nombre del punto de venta (por defecto *Caja Principal*).
   - En el campo obligatorio **Ajustar Base Inicial ($)**, digita la cantidad de dinero en efectivo con la que inicia el cajero (ej. $100.000).
   - En *Observaciones*, escribe cualquier novedad (ej. *Turno mañana - Recepción sede norte*).
3. Haz clic en el botón verde **[Abrir Caja]**.
4. La caja quedará activa y lista para recibir cobros y registrar egresos.  
   *(Nota de control: El sistema no permite abrir una segunda caja si el usuario ya tiene una activa sin cerrar).*

---

### 6.2 Cómo registrar el Pago de un Paciente
* **Objetivo:** Recibir abonos o cancelaciones totales de tratamientos y emitir comprobante de pago.
* **Dónde se hace:** Ficha del paciente -> Pestaña **[Realizar pago]**.

#### Paso a paso exacto en pantalla:
1. Abre la ficha del paciente y selecciona la pestaña **[Realizar pago]**.
2. Verás la lista de planes de tratamiento del paciente con su saldo pendiente:
   - Para aplicar un anticipo libre, pulsa el botón azul superior **`[Adicionar saldo a favor]`**.
   - Para pagar un tratamiento específico, pulsa el botón verde **`[Pagar / Abonar]`** del plan correspondiente.
3. Se abrirá la pantalla de **Prestaciones (Checkout)**:
   - Selecciona los procedimientos que se van a cancelar o abonar.
   - Ingresa el **Monto del Abono** en pesos (COP).
   - Elige el **Método de Pago:** *Efectivo*, *Tarjeta*, *Transferencia*, *Nequi*, *Daviplata* o *PSE*.
   - ⚠️ **Validación Obligatoria:** Si seleccionas *Transferencia*, *Nequi*, *Daviplata* o *PSE*, el campo **Número de Referencia / Aprobación** es obligatorio para garantizar el cuadre bancario.
   - Selecciona el **Profesional** al que se acredita el recaudo (para liquidación médica).
4. Pulsa el botón **[Registrar Pago]**.
   - El sistema actualizará el saldo pendiente del paciente.
   - El ingreso entrará automáticamente en la caja abierta del turno.
   - Podrás imprimir el recibo de caja en formato ticket o media carta.

---

### 6.3 Cómo realizar el Cierre de Caja y Arqueo Diario
* **Objetivo:** Cuadrar el dinero real contra el sistema al finalizar el turno o día de trabajo.
* **Dónde se hace:** Menú lateral izquierdo -> **[CAJA]** -> Pestaña **[Mi caja]** o **[Cajas abiertas]**.

#### Paso a paso exacto en pantalla:
1. En el módulo **[CAJA]**, localiza la caja abierta y pulsa el botón **[Cerrar Caja]**.
2. Se abrirá la ventana de arqueo, donde el sistema te muestra el resumen financiero teórico:
   - *Base Inicial* + *Total Ingresos* - *Total Egresos* = **Saldo Teórico**.
3. En la sección de **Conteo Físico Real**:
   - En **Efectivo Contado ($)**, digita la suma de todos los billetes y monedas que hay físicamente en la gaveta.
   - En **Otros Medios ($)**, digita el total de vouchers de datáfono y comprobantes de transferencias.
4. El sistema calculará la **Diferencia**:
   - Si coincide, mostrará `$0` de descuadre.
   - Si falta o sobra dinero, indicará claramente el valor.
5. Escribe observaciones o justificaciones si hubo alguna novedad.
6. Marca obligatoriamente la casilla de verificación juramentada:
   - ☑ *«Declaro que he realizado el conteo físico detallado y los valores son correctos.»*
7. Haz clic en el botón rojo **[Cerrar Caja Definitivamente]**. La caja quedará cerrada, bloqueada y se emitirá el resumen de cierre.

---

### 🎬 Guion de Video 4: "Manejo Diario de Caja, Cobros y Arqueo" (Duración: 2:30 min)

* **[0:00 - 0:25] Apertura de Caja:**  
  *Voz:* "En este video veremos cómo abrir caja, cobrar tratamientos y hacer el arqueo diario en OdontoCloud. Al iniciar el turno, entramos a Caja y pulsamos 'Abrir Caja'. Digitamos la base inicial en efectivo, por ejemplo cincuenta mil pesos, y pulsamos el botón verde 'Abrir Caja'."  
  *Acción en pantalla:* Mostrar apertura de caja y confirmación.
* **[0:25 - 1:15] Registrar cobro:**  
  *Voz:* "Cuando un paciente paga en recepción, abrimos su ficha y entramos a 'Realizar pago'. En la lista de planes pulsamos 'Pagar / Abonar'. Seleccionamos el procedimiento, escribimos el monto y elegimos el método de pago: efectivo, tarjeta o transferencia. Si es transferencia o Nequi, escribimos el número de comprobante. Pulsamos 'Registrar Pago' y el recibo queda emitido con el saldo actualizado."  
  *Acción en pantalla:* Realizar un pago de ejemplo y mostrar recibo.
* **[1:15 - 2:00] Cierre y arqueo:**  
  *Voz:* "Al final de la jornada, volvemos a Caja y pulsamos 'Cerrar Caja'. Contamos el efectivo en la gaveta y lo escribimos en 'Efectivo Contado'. Hacemos lo mismo con los vouchers. El sistema compara el conteo con el saldo teórico y nos muestra si el cuadre es exacto. Marcamos la casilla de declaración y pulsamos 'Cerrar Caja Definitivamente'."  
  *Acción en pantalla:* Digitar conteo, marcar checkbox y pulsar 'Cerrar Caja Definitivamente'.

---

## Módulo 7: Administración & Facturación

### 7.1 Dónde se gestiona la Facturación y los procesos administrativos
* **Objetivo:** Emitir facturación electrónica oficial DIAN (según el plan), gestionar recibos de caja, RIPS 2275, esterilización y convenios.
* **Dónde se hace:** Menú lateral izquierdo -> **[ADMINISTRACIÓN]**.

#### Submódulos disponibles dentro de Administración:
1. **Facturación:**
   - **Factura de Venta:** Módulo oficial de facturación electrónica DIAN (habilitado para planes con Facturación Electrónica; en planes sin FE se emiten Recibos de Caja).
   - **Recibo de Caja:** Comprobantes de ingreso y recaudo independientes.
   - **Pagos:** Registro de egresos y pagos a proveedores.
   - **Notas Crédito y Débito:** Ajustes contables oficiales.
   - **Liquidaciones:** Liquidación de comisiones a odontólogos y especialistas.
   - **Traslados:** Movimientos entre cajas y cuentas bancarias.
2. **Convenios:** Creación de listas de precios y acuerdos con empresas o entidades.
3. **Gestión Agenda:** Configuración de turnos, jornadas y horarios de disponibilidad de los profesionales.
4. **Terceros:** Directorio unificado de proveedores, aseguradoras y clientes corporativos.
5. **Residuos Hosp.:** Registro ambiental obligatorio de residuos biológicos y biosanitarios.
6. **RIPS JSON:** Generador y validador oficial de archivos JSON bajo Resolución 2275 de 2023 de Minsalud.
7. **Esterilización:** Bitácora digital de cargas de autoclaves, paquetes procesados y firmas de bioseguridad.
