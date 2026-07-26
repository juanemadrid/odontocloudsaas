# Guía de Despliegue a Producción (OdontoCloud)

Esta guía te ayudará a preparar y desplegar tu aplicación en un entorno real.

## 1. Variables de Entorno (.env)
Se ha creado un archivo `.env` en la raíz con tus credenciales de Firebase.
**IMPORTANTE**: Nunca subas este archivo a GitHub si tu repositorio es público.

Contenido típico de `.env`:
```env
VITE_API_KEY=AIzaSy...
VITE_AUTH_DOMAIN=...
VITE_PROJECT_ID=...
...
```

## 2. Construcción (Build)
Para generar los archivos estáticos optimizados para producción:

```bash
npm run build
```

**Nota Técnica**: Se ha deshabilitado la minificación (`minify: false`) en `vite.config.mjs` para evitar errores de memoria durante la construcción. Los archivos generados en `dist/` son totalmente funcionales.

Esto creará una carpeta `dist/` con tu aplicación lista para subir a cualquier hosting.

## 3. Vista Previa (Preview)
Antes de subir, puedes probar la versión construida localmente:

```bash
npm run preview
```

## 4. Opciones de Hosting

### Opción A: Firebase Hosting (Recomendado)
Ya que usas Firebase para la BD, es la opción más natural.
1.  Instala Firebase Tools: `npm install -g firebase-tools`
2.  Loguéate: `firebase login`
3.  Inicializa: `firebase init` (Selecciona Hosting, carpeta `dist`, "single-page app: Yes")
4.  Despliega: `firebase deploy`

### Opción B: Vercel / Netlify
1.  Conecta tu repositorio de GitHub.
2.  Configura el comando de build: `npm run build`.
3.  Directorio de salida: `dist`.
4.  **IMPORTANTE**: Debes agregar las variables de entorno (del archivo `.env`) en el panel de configuración de Vercel/Netlify.

## 5. Verificación Final
*   Revisa que el **Sitio Web Público** cargue en la raíz.
*   Intenta hacer Login.
*   Verifica que los gráficos de Reportes se muestren correctamente.

¡Tu software está listo para alquilar! 🚀
