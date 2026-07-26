# 🔐 Configurar Reglas de Firestore

## ⚠️ IMPORTANTE: Debes aplicar estas reglas en Firebase Console

Las reglas de Firestore son necesarias para:
- ✅ Proteger la API key de Gemini
- ✅ Permitir que solo el admin la modifique
- ✅ Permitir que todos los usuarios la lean

---

## 📋 Pasos para Configurar

### 1. Ir a Firebase Console
🔗 https://console.firebase.google.com/

### 2. Seleccionar tu proyecto
Ejemplo: "odontocloud-react"

### 3. Ir a Firestore Database
- Menú lateral → **Firestore Database**
- Pestaña → **Reglas** (Rules)

### 4. Copiar las Reglas
Abrir el archivo: `firestore.rules.example`

### 5. Pegar en Firebase Console
Reemplazar TODO el contenido actual con las nuevas reglas

### 6. Publicar
Clic en **"Publicar"** (Publish)

---

## 🎯 Regla Principal para API Key

```javascript
match /configuracion/{inquilino} {
  // ✅ Lectura: cualquier usuario del inquilino
  allow read: if request.auth != null 
              && request.auth.token.inquilino == inquilino;
  
  // 🔒 Escritura: SOLO administradores
  allow write: if request.auth != null 
               && request.auth.token.inquilino == inquilino
               && request.auth.token.role == 'admin';
}
```

---

## 🧪 Probar las Reglas

### En Firebase Console:

1. Ir a **Reglas** → Pestaña **"Simulador"**
2. Probar lectura:
   ```
   Operación: get
   Ubicación: /configuracion/clinica-abc
   Auth: Simulated user (con token inquilino: clinica-abc)
   ```
   ✅ Debe permitir

3. Probar escritura como doctor:
   ```
   Operación: set
   Ubicación: /configuracion/clinica-abc
   Auth: Simulated user (role: doctor)
   ```
   ❌ Debe denegar

4. Probar escritura como admin:
   ```
   Operación: set
   Ubicación: /configuracion/clinica-abc
   Auth: Simulated user (role: admin)
   ```
   ✅ Debe permitir

---

## 🔍 Verificar en Producción

### 1. Como Usuario Normal (doctor/secretaria):
- Iniciar sesión
- Ir a Reportes → IA
- La IA debe funcionar (puede leer la key)
- NO debe ver el botón "API Key" o debe dar error al intentar guardar

### 2. Como Administrador:
- Iniciar sesión como admin
- Ir a Reportes → IA
- Clic en "API Key"
- Modificar y guardar
- ✅ Debe guardarse correctamente

---

## ⚠️ Custom Claims (Roles)

Para que las reglas funcionen, los usuarios deben tener custom claims:

```javascript
{
  "inquilino": "clinica-abc",
  "role": "admin"  // o "doctor" o "secretaria"
}
```

### ¿Cómo se asignan?

**Opción 1: Al crear usuario (Recomendado)**
Usar Cloud Functions al registrar:

```javascript
await admin.auth().setCustomUserClaims(uid, {
  inquilino: "clinica-abc",
  role: "doctor"
});
```

**Opción 2: Manualmente desde Cloud Functions**
Crear una función admin para actualizar claims.

**Opción 3: Firebase Console**
No se puede hacer directamente. Necesitas código.

---

## 📝 Script para Configurar Claims (Ejemplo)

Crear archivo: `scripts/set-claims.js`

```javascript
const admin = require('firebase-admin');
admin.initializeApp();

async function setUserClaims(email, inquilino, role) {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, {
    inquilino,
    role
  });
  console.log(`✅ Claims actualizados para ${email}`);
}

// Ejemplo de uso
setUserClaims('admin@clinica-abc.com', 'clinica-abc', 'admin')
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
```

Ejecutar:
```bash
node scripts/set-claims.js
```

---

## 🚨 Errores Comunes

### "Missing or insufficient permissions"
➡️ Las reglas no están aplicadas o el usuario no tiene el custom claim correcto

### "auth.token.inquilino is undefined"
➡️ El usuario no tiene el custom claim `inquilino` configurado

### "auth.token.role is undefined"
➡️ El usuario no tiene el custom claim `role` configurado

---

## ✅ Checklist Final

- [ ] Reglas aplicadas en Firebase Console
- [ ] Reglas publicadas (botón "Publish")
- [ ] Custom claims configurados para usuarios
- [ ] Probado lectura como usuario normal (funciona)
- [ ] Probado escritura como usuario normal (falla)
- [ ] Probado escritura como admin (funciona)
- [ ] API Key guardada por admin desde la interfaz
- [ ] Todos los usuarios pueden usar IA automáticamente

---

## 📞 Soporte

Si tienes problemas:

1. Verificar que las reglas están publicadas
2. Verificar custom claims del usuario en Authentication → User → Custom Claims
3. Ver logs en Firestore → Uso → Ver detalles de solicitudes rechazadas
4. Revisar consola del navegador (F12) para ver errores detallados

---

**Última actualización:** 2026-07-04  
**Estado:** ✅ Listo para aplicar
