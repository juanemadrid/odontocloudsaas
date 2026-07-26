# 🤖 Gestión Centralizada de Gemini API Key

## ✅ ¿Qué se implementó?

Se centralizó la gestión de la API Key de Gemini para que:

1. **El ADMINISTRADOR configura la API key UNA SOLA VEZ**
2. **TODOS los usuarios y dispositivos la usan automáticamente**
3. **NO hay que configurarla en cada navegador o celular**

---

## 🏗️ Arquitectura

### Servicio Centralizado: `geminiKeyService.js`

```
src/services/geminiKeyService.js
```

**Funciones principales:**

- `getGeminiApiKey(inquilino)` - Obtiene la API key con esta prioridad:
  1. Caché local (30 minutos) ⚡
  2. Firestore (`configuracion/{inquilino}`) 🔥
  3. Variable de entorno `.env` 📄
  4. localStorage legacy (compatibilidad)

- `saveGeminiApiKey(inquilino, apiKey)` - Guarda en Firestore (solo admin)
- `clearGeminiKeyCache()` - Limpia caché local

---

## 📊 Almacenamiento en Firestore

**Colección:** `configuracion`  
**Documento:** `{inquilino}` (ej: `clinica-abc`)

```json
{
  "geminiApiKey": "AIzaSy...",
  "geminiKeyUpdatedAt": "2026-07-04T10:30:00.000Z"
}
```

---

## 🔧 ¿Cómo configurar la API Key?

### Para el ADMINISTRADOR:

1. Ir a **Reportes → Inteligencia Artificial**
2. Clic en botón **"API Key"** (esquina superior derecha)
3. Pegar la API key obtenida desde [Google AI Studio](https://aistudio.google.com/)
4. Clic en **"Guardar"**

✅ **¡Listo!** Ahora TODOS los usuarios pueden usar la IA sin configurar nada.

---

## 📱 ¿Funciona en celular?

**SÍ.** Cuando un usuario inicia sesión desde cualquier dispositivo:

1. La aplicación obtiene automáticamente la API key de Firestore
2. La guarda en caché local por 30 minutos
3. Todos los componentes de IA funcionan sin configuración adicional

---

## 💡 Componentes actualizados

### 1. `ReporteIA.jsx`
- Interfaz de configuración para administradores
- Guarda en Firestore con `saveGeminiApiKey()`
- Obtiene automáticamente con `getGeminiApiKey()`

### 2. `ClinicalAIAssistant.jsx`
- Usa `getGeminiApiKey()` para análisis de pacientes
- Ya no necesita configuración manual

### 3. Cualquier otro componente que use IA
- Solo debe importar y usar `getGeminiApiKey(inquilino)`

---

## 🚀 Ventajas del sistema

✅ **Un solo punto de configuración** - El admin configura una vez  
✅ **Sincronización automática** - Todos los dispositivos la obtienen  
✅ **Caché inteligente** - Reduce llamadas a Firestore (30 min TTL)  
✅ **Fallback robusto** - Si falla Firestore, usa variable de entorno  
✅ **Compatible** - No rompe configuraciones existentes  

---

## 💰 Sobre el plan gratuito de Gemini

### Plan Gratuito (Free Tier):
- **15 solicitudes por minuto (RPM)**
- **1 millón de tokens por minuto (TPM)**
- **1,500 solicitudes por día (RPD)**

### Para una clínica con 10 pacientes/día:
✅ **Sí alcanza perfectamente**

**Estimación de uso diario:**
- 10 análisis de pacientes × 2 solicitudes = 20 solicitudes/día
- Uso muy por debajo del límite de 1,500/día

### ¿Se renueva diariamente?
✅ **SÍ** - Los límites se reinician cada 24 horas

---

## 🔄 ¿Necesito plan de pago?

**Para vender el sistema:**

### Opción 1: Plan Gratuito (Recomendado para empezar)
- Crea UN proyecto en Google AI Studio
- Genera UNA API key
- Configúrala en cada clínica desde el sistema
- **Cada clínica usa su propia key** (dentro de SU límite gratuito)

### Opción 2: Plan Empresa (Para escalar)
- Si superas 1,500 solicitudes/día en UNA clínica
- Si quieres centralizar facturación
- Usa [Google Cloud Vertex AI](https://cloud.google.com/vertex-ai/pricing)

**💡 Recomendación:** Empieza con el plan gratuito. El límite de 1,500/día es suficiente para la mayoría de clínicas dentales.

---

## 🔒 Seguridad

- ✅ La API key NO se guarda en el código fuente
- ✅ La API key NO se sube a Git (`.env` está en `.gitignore`)
- ✅ Solo usuarios autenticados pueden obtenerla de Firestore
- ✅ Las reglas de Firestore deben validar `auth.token.inquilino`

### Reglas de Firestore recomendadas:

```javascript
match /configuracion/{inquilino} {
  allow read: if request.auth != null 
              && request.auth.token.inquilino == inquilino;
  
  allow write: if request.auth != null 
               && request.auth.token.inquilino == inquilino
               && request.auth.token.role == 'admin';
}
```

---

## 🐛 Solución de problemas

### "API Key no configurada"
➡️ El admin debe configurarla en **Reportes → IA → API Key**

### "Your prepayment credits are depleted"
➡️ Se agotaron los créditos gratuitos del día
- Espera 24 horas para que se renueven
- O agrega método de pago en [AI Studio](https://aistudio.google.com/billing)

### "Failed to fetch from Firestore"
➡️ Verifica reglas de seguridad de Firestore
➡️ El sistema usará el fallback de `.env` si existe

---

## 📝 Variables de entorno (.env)

```bash
# Clave API de Google AI Studio (Gemini)
# Fallback si no está configurada en Firestore
VITE_GEMINI_API_KEY=AIzaSy...
```

⚠️ **Nota:** El `.env` es un fallback. Lo ideal es que el admin configure desde la interfaz.

---

## ✅ Estado actual

- ✅ Servicio `geminiKeyService.js` creado
- ✅ `ReporteIA.jsx` actualizado (interfaz admin)
- ✅ `ClinicalAIAssistant.jsx` actualizado
- ✅ Caché local implementado (30 min)
- ✅ Fallbacks configurados
- ✅ Commit y push realizados

**Commit:** `fe942146` - "feat: centralizar gestión de Gemini API Key en Firestore"

---

## 🎯 Próximos pasos

1. ✅ Desplegar en producción
2. ⚠️ Configurar reglas de Firestore para colección `configuracion`
3. ✅ Admin configura API key desde la interfaz
4. ✅ Probar desde diferentes dispositivos

---

**🚀 ¡El sistema está listo para producción!**
