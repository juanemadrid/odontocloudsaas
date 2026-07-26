# 🤖 CÓMO CONFIGURAR GEMINI AI (GRATIS)

## ⏱️ Tiempo estimado: 2 minutos

La inteligencia artificial YA ESTÁ implementada en el código. Solo necesitas obtener una API Key gratuita de Google.

---

## 📋 PASOS PARA ACTIVAR LA IA

### 1. Obtener la API Key (GRATIS)

1. **Ve a Google AI Studio:**
   - URL: https://aistudio.google.com/
   
2. **Inicia sesión** con tu cuenta de Google

3. **Haz clic en "Get API Key"** (botón arriba a la derecha)

4. **Crear nueva key:**
   - Click en "Create API Key"
   - Selecciona un proyecto de Google Cloud (o crea uno nuevo)
   - Copia la key generada

![Ejemplo: AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXX]

---

### 2. Agregar la Key al Sistema

**Opción A: Desde la interfaz (Recomendado)**
1. Abre OdontoCloud
2. Ve a cualquier paciente
3. Click en tab "IA Insights" o "Nova Insights"
4. Click en botón "Ajustes API Key"
5. Pega tu key y guarda

**Opción B: En archivo .env**
1. Abre el archivo `.env` en la raíz del proyecto
2. Agrega la línea:
   ```bash
   VITE_GEMINI_API_KEY=TU_KEY_AQUI
   ```
3. Guarda el archivo
4. Reinicia el servidor (`npm run dev`)

---

## ✅ FUNCIONES QUE SE ACTIVAN

Con la API Key configurada, tendrás acceso a **9 funciones de IA**:

### En Pacientes → Tab "IA Insights":
1. ✅ **Resumen Clínico Automático**
   - Analiza expediente, anamnesis y evoluciones
   - Genera alertas clínicas críticas
   - Sugerencias de próximos pasos

2. ✅ **Receta y Recomendaciones Post-Operatorias**
   - Medicamentos sugeridos con dosis
   - Cuidados en casa
   - Signos de alarma

3. ✅ **Sugerencias CIE-10 Inteligentes**
   - Escribe síntomas en lenguaje natural
   - Obtén 3 códigos CIE-10 relevantes
   - Copia al expediente

4. ✅ **Plan de Tratamiento desde Odontograma**
   - Analiza odontograma + anamnesis
   - Genera plan priorizado (Alta/Media/Baja)
   - Consideraciones especiales por alergias/medicamentos

5. ✅ **Predicción de Ausentismo**
   - Calcula probabilidad de inasistencia
   - Basado en historial del paciente
   - Recomendaciones de seguimiento

### En Reportes → Tab "IA":
6. ✅ **Diagnóstico Gerencial IA**
   - Análisis de KPIs de la clínica
   - Hallazgos clave
   - Recomendaciones prioritarias

7. ✅ **Pacientes en Riesgo de Abandono**
   - Detecta pacientes sin visita en 60+ días
   - Con tratamientos activos pendientes
   - Links de WhatsApp para contacto

8. ✅ **Alertas de Stock Bajo**
   - Productos bajo mínimo
   - Priorizados por criticidad

9. ✅ **Análisis de Productividad por Doctor**
   - Citas, asistencia, facturación
   - Comparativa entre doctores
   - Sugerencias de gestión

---

## 💰 LÍMITES GRATUITOS

Gemini 2.5-flash es **COMPLETAMENTE GRATIS** con límites generosos:

- **15 requests por minuto**
- **1,500 requests por día**
- **1 millón de tokens gratis por mes**

Para una clínica promedio:
- ✅ Suficiente para 100-150 análisis de IA por día
- ✅ No requiere tarjeta de crédito
- ✅ Sin vencimiento

---

## 🔐 SEGURIDAD

- ✅ Tu API Key se guarda **solo en tu navegador** (localStorage)
- ✅ No se comparte con nadie
- ✅ Puedes regenerarla cuando quieras en Google AI Studio
- ✅ Los datos del paciente se envían directamente a Google (encriptados HTTPS)

**Nota legal:** Google procesa los datos bajo sus términos de servicio. Para cumplimiento estricto de HABEAS DATA, considera usar un modelo local o servicio con DPA (Data Processing Agreement).

---

## ❓ PREGUNTAS FRECUENTES

### ¿La IA funciona sin internet?
❌ No, requiere conexión a internet para consultar a Gemini.

### ¿Puedo usar mi propia clave?
✅ Sí, cada usuario puede usar su propia key.

### ¿Qué pasa si se acaba la cuota?
⚠️ Las funciones de IA mostrarán error. Puedes:
- Esperar 24 horas (se renueva diariamente)
- Crear otra cuenta de Google con nueva key
- Contratar plan empresarial de Google AI

### ¿Es obligatorio configurarla?
❌ No, el sistema funciona perfectamente sin IA.
Las funciones de IA son **opcionales y complementarias**.

### ¿Los diagnósticos de la IA son válidos médicamente?
⚠️ **NO**. La IA es una **herramienta de apoyo** para el profesional.
El diagnóstico final y tratamiento siempre deben ser responsabilidad del odontólogo titulado.

---

## 🚀 PRUEBA RÁPIDA

Después de configurar, prueba esto:

1. Ve a cualquier paciente
2. Tab "IA Insights"
3. Click en "Analizar y Generar Resumen"
4. Espera 3-5 segundos
5. ¡Listo! Deberías ver el análisis clínico

Si NO funciona:
- Verifica que copiaste la key completa
- Revisa la consola del navegador (F12) por errores
- Intenta regenerar la key en Google AI Studio

---

## 📞 SOPORTE

**Si tienes problemas:**
1. Verifica que la key sea válida en: https://aistudio.google.com/
2. Revisa que no hayas excedido los límites
3. Comprueba la consola del navegador (F12)

**Error común:**
```
Error: API Key missing
```
**Solución:** La key no está configurada o está mal escrita.

---

## ✨ RESUMEN

```
1. Ir a: https://aistudio.google.com/
2. Crear API Key
3. Copiar la key
4. Pegar en OdontoCloud → Paciente → IA Insights → Ajustes
5. ¡Disfrutar de 9 funciones de IA gratis!
```

**Tiempo total:** ⏱️ 2 minutos
**Costo:** 💰 $0 (Gratis)
**Funciones:** 🤖 9 herramientas de IA
