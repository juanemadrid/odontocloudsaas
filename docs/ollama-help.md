# Ayuda de OdontoCloud con Ollama

## Qué incluye

El botón existente de ayuda abre una biblioteca de procedimientos y un chat. Las guías se pueden consultar sin IA. Las preguntas libres pasan por `odontocloud-help`; no pasan por Gemini. El servidor selecciona las guías y llama al modelo local con esas referencias. Las respuestas muestran las guías consultadas, que se pueden abrir directamente.

El manual está en `supabase/functions/_shared/helpKnowledge.mjs`. Cada entrada incluye categoría, palabras de búsqueda, pasos, limitaciones y archivo fuente. Es documentación revisada contra el código, no una certificación de que todos los módulos funcionen en producción. Al cambiar pantallas se deben revisar también sus guías. No introducir datos reales ni secretos en este archivo público. Las guías más generales orientan a la sección; ampliar sus pasos al verificar los flujos particulares con usuarios.

## Aislamiento

- La función valida el token en el proyecto Supabase de **OdontoCloud**, resuelve el perfil por el usuario autenticado y comprueba la clínica. El cliente no puede elegir aplicación, clínica, modelo, servidor ni instrucciones.
- Las únicas consultas son al perfil autenticado y al estado de su clínica. No consulta pacientes, documentos, historiales, tablas de Edunexus ni vectores compartidos.
- Solo se envía la pregunta actual y documentación pública de OdontoCloud al modelo. No se envían tokens de usuario, identificadores de clínica ni historiales de chat. Los seguimientos usan hasta tres identificadores de guías verificadas.
- El chat vive en memoria de la pantalla y se reinicia al cerrar, iniciar nueva conversación o cambiar de usuario/clínica. Las respuestas pendientes de un contexto anterior se descartan.
- El modelo no tiene herramientas que ejecuten acciones. Las instrucciones limitan las respuestas al manual, pero los modelos pueden equivocarse: las referencias permiten contrastarlas.
- La misma instalación de Ollama puede servir a Edunexus. Mantener su backend y sus credenciales independientes. Si ambos proyectos comparten un proyecto Supabase, se necesita además una pertenencia explícita por aplicación antes de habilitar este servicio: los perfiles actuales no contienen esa distinción.

## Configuración pendiente del servidor

Definir únicamente en el entorno del servicio que ejecuta las Edge Functions de OdontoCloud:

```dotenv
ODONTO_HELP_OLLAMA_URL=http://ollama:11434
ODONTO_HELP_OLLAMA_MODEL=qwen3:4b-instruct
# Opcional: token de un proxy autenticado privado, distinto para cada aplicación.
# ODONTO_HELP_OLLAMA_TOKEN=
```

La URL y el modelo son ejemplos: confirmar la red interna y el modelo instalado. La URL debe ser la base de Ollama, sin `/api/chat` ni `/v1`. No usar variables `VITE_` para esta configuración. La función usa `/api/chat`, sin streaming y con 35 segundos de límite. No hay sustitución por proveedores de pago.

En un Supabase autohospedado, desplegar `odontocloud-help` junto con `_shared/helpKnowledge.mjs` en el volumen de funciones siguiendo el despliegue existente; conservar las demás funciones y configurar las variables en el contenedor de funciones. Si se usa Supabase administrado, desplegar la función y definir secretos con el flujo del proyecto. No se ha identificado ni modificado el despliegue remoto desde esta sesión.

El contenedor de funciones debe alcanzar Ollama por la red privada. `localhost` dentro de ese contenedor no es el contenedor de Ollama. No publicar el puerto 11434 directamente a Internet. Si hay un proxy entre servidores, verificar TLS y autenticación, limitar tamaño/frecuencia de solicitudes y evitar registrar preguntas. El aislamiento de datos no evita que ambas aplicaciones compitan por CPU/RAM; verificar concurrencia y latencia con la carga real. El servicio no implementa un contador distribuido de cuotas.

## Verificación

1. `npm run test:help`: búsqueda por intención, fuentes existentes, límites de petición, validación de acceso, rechazo de parámetros de otra aplicación, errores de Ollama y respuesta por guías.
2. `npm run security:check` y `npm run build`.
3. Con una cuenta real de prueba de OdontoCloud, abrir Ayuda y preguntar «¿Cómo hago para apartar una cita?». Con Ollama conectado debe indicar **Respuesta de IA local**. Abrir las referencias y contrastar los pasos.
4. Probar un seguimiento, nueva conversación, cierre/reapertura y cambio de usuario o clínica. El chat anterior no debe reaparecer.
5. Probar una sesión inválida y un perfil o clínica inactivos: la función debe rechazar la generación. Las guías públicas locales pueden seguir mostrándose.
6. Desconectar Ollama en un entorno de prueba: debe aparecer **La IA local no está disponible** y una guía. No debe haber solicitudes a Gemini.
7. Verificar por separado el chat de Edunexus y su propia autenticación. Estos tests locales no certifican su despliegue ni sus políticas.

No se ha probado el modelo real ni desplegado esta función en el servidor. La IA clínica (Nova, Insights, reportes IA) conserva su integración anterior con Gemini; esta entrega cambia exclusivamente la ayuda de uso del sistema.

Referencias de implementación: https://docs.ollama.com/api/chat y https://supabase.com/docs/reference/javascript/auth-getuser.
