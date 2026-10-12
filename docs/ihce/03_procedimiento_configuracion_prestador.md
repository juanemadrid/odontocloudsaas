# 03. PROCEDIMIENTO DE CONFIGURACIÓN POR PRESTADOR (CLÍNICA)

**Objetivo:** Guía paso a paso para dar de alta e interconectar una clínica prestadora de servicios de salud odontológicos en el mecanismo IHCE a través de OdontoCloud SaaS.

---

## 1. Requisitos Previos Indispensables

Antes de iniciar la configuración, la clínica debe tener a la mano:
1. **Código de Habilitación REPS:** Número oficial de 12 dígitos asignado por la Secretaría de Salud departamental o distrital.
2. **Código de Sede REPS:** Número de 2 dígitos asignado a la sede física donde se atiende (ej. `01`).
3. **Credenciales Hércules OAuth2:**
   - `Client ID`
   - `Client Secret`
   - Obtenidas a través del trámite oficial de registro de sistemas de información ante MinSalud/SISPRO.
4. **Registro de Profesionales en RETHUS:** Cada odontólogo debe estar registrado con su cédula y código RETHUS correspondiente.

---

## 2. Pasos de Configuración en OdontoCloud

### Paso 1: Acceso al Panel de Interoperabilidad
1. Inicie sesión en OdontoCloud con una cuenta que tenga el rol de **Administrador de Clínica**.
2. En el menú lateral de navegación, seleccione **"Interoperabilidad IHCE"** (o navegue a `/interoperabilidad-ihce`).
3. Haga clic en la pestaña **"Configuración del Prestador"**.

### Paso 2: Diligenciamiento de Datos del Prestador
1. **Código Habilitación REPS:** Ingrese los 12 dígitos continuos (sin guiones ni espacios).
2. **Código de Sede:** Ingrese los 2 dígitos (ej. `01`).
3. **Razón Social:** Ingrese el nombre legal de la clínica según el RUT.
4. **NIT:** Ingrese el número de identificación tributaria.

### Paso 3: Configuración de Credenciales de Seguridad
1. **Ambiente:**
   - Seleccione **"Simulador Local Aislado"** durante el periodo de capacitación del personal.
   - Seleccione **"Ambiente Oficial de Pruebas (MinSalud)"** para ejecutar la batería de pruebas de conformidad requeridas por el Ministerio.
2. **Client ID y Client Secret:** Pegue las credenciales suministradas por MinSalud.
3. active la casilla **"Activar Interoperabilidad IHCE para esta clínica"**.
4. Active la casilla **"Despacho asíncrono automático al cerrar evolución"**.
5. Haga clic en **"Guardar Configuración"**.

---

## 3. Verificación de Conectividad Inicial

Una vez guardada la configuración:
1. Revise el indicador de estado en la parte superior del panel. Debe indicar **"Conexión Activa"**.
2. Realice una atención de prueba con un paciente sintético de demostración.
3. Cierre y firme la evolución.
4. Verifique en la pestaña **"Bandeja de Envíos RDA"** que la atención aparezca en estado **Aceptado** con su respectivo código de radicado.
