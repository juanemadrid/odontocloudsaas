# 02. MANUAL DE USO DEL MÓDULO IHCE PARA CLÍNICAS Y ODONTÓLOGOS

**Dirigido a:** Directores Médicos, Administradores de Clínica y Odontólogos Tratantes.  
**Plataforma:** OdontoCloud SaaS.

---

## 1. Introducción al Módulo de Interoperabilidad (IHCE)

La interoperabilidad de la Historia Clínica Electrónica es una obligación legal en Colombia (Ley 2015 de 2020) que busca que los antecedentes clínicos de los pacientes puedan consultarse de forma segura y unificada entre diferentes IPS del país.

En OdontoCloud, el proceso está completamente automatizado para no alterar su rutina diaria de atención.

---

## 2. Flujo de Trabajo para el Odontólogo en Consulta

### 2.1. Registro de la Atención
1. Diligencie normalmente la historia clínica, odontograma y evolución del paciente.
2. Asegúrese de seleccionar los códigos oficiales requeridos:
   - **Diagnóstico CIE-10:** (Ej. `K021` - Caries de la dentina).
   - **Procedimiento CUPS:** (Ej. `230101` - Restauración dental con resina).
   - **Modalidad de Atención:** Intramural (consultorio), Domiciliaria, etc.

### 2.2. Firma y Cierre Electrónico de la Evolución
1. Al terminar la consulta, haga clic en el botón **"Firmar y Sellar Evolución"**.
2. Aparecerá el diálogo de **Reautenticación Segura**:
   - Ingrese su contraseña personal o PIN de firma.
   - Revise el resumen del diagnóstico y procedimiento.
   - Haga clic en **"Confirmar Firma"**.
3. El sistema sellará criptográficamente la evolución con un hash SHA-256. A partir de ese momento, el registro queda inmutable.
4. **Despacho Automático:** El sistema se encargará de generar el documento RDA y radicarlo ante el Ministerio de Salud en segundo plano.

---

## 3. Consulta de Antecedentes Externos del Paciente

1. Diríjase a la pestaña **"Visor de RDA Externos"** dentro del panel IHCE.
2. Ingrese el número de documento de identidad del paciente.
3. El sistema le mostrará un historial claro y ordenado de las atenciones recibidas por el paciente en otras IPS de Colombia:
   - Institución emisora y fecha de atención.
   - Diagnósticos previos.
   - Procedimientos realizados.
   - Alertas clínicas o alergias reportadas por otros médicos u odontólogos.

---

## 4. Gestión para el Administrador de la Clínica

### 4.1. Bandeja de Envíos RDA
- Permite visualizar en tiempo real el estado de radicación de cada atención:
  - **Aceptado:** Documento recibido a satisfacción por MinSalud con su número de **Radicado Oficial**.
  - **Pendiente / Procesando:** En cola de transmisión automática.
  - **En Reintento:** Error temporal de conexión con MinSalud (el sistema reintenta automáticamente con esperas progresivas).
  - **Rechazado:** Inconsistencia reportada por MinSalud. Puede consultar el detalle haciendo clic en **"Ver Detalle"**.

### 4.2. Control de Acceso Excepcional (Break-Glass)
- Si un usuario de soporte técnico requiere acceder al expediente de un paciente por orden judicial o falla grave, deberá solicitar una sesión justificada.
- Usted como Administrador de la Clínica podrá visualizar todas las sesiones abiertas en la pestaña **"Auditoría Break-Glass"** y tiene la potestad de presionar **"Revocar Acceso"** en cualquier momento para cancelar la sesión de inmediato.
