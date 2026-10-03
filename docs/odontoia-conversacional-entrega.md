# OdontoIA conversacional — entrega del 3 de octubre de 2026

## Cambios

- Saludos, agradecimientos y presentación inmediatos, identificados como asistente (no como texto generado por el modelo).
- Historial efímero de hasta cuatro mensajes, 600 caracteres por mensaje y 1.800 en total. Se envía al modelo local solo para esa solicitud; no se guarda en el servidor.
- Seguimientos como «no entendí», «y ahora» y «paso a paso» conservan la guía anterior. Una pregunta con un nuevo tema explícito cambia de guía.
- Respuesta progresiva desde Ollama, con botón Detener y descarte de solicitudes antiguas al reiniciar/cerrar el chat. Una respuesta interrumpida o truncada se reemplaza por una guía identificada.
- Instrucciones conversacionales y referencias específicas en lugar de enviar todo el catálogo comercial con cada pregunta. No hay promesa de equivalencia con ChatGPT.
- Se respeta exactamente ODONTO_HELP_OLLAMA_URL y ODONTO_HELP_OLLAMA_MODEL de Coolify.
- Se conservan la autenticación por clínica de la ayuda interna y la selección de guías comerciales en la página pública. La ayuda no consulta expedientes ni ejecuta acciones.

## Instalar en el VPS de OdontoCloud

Hay dos partes: backend y frontend. El instalador de funciones NO publica la interfaz web.

1. Abrir `scratch/instalar-odontoia-conversacional.sh`, copiarlo entero y pegarlo en la terminal del servidor Coolify (`root@madrid-cloud-prod:~#`). Instala cinco archivos, valida sus hashes y crea respaldo; no reinicia servicios ni modifica redes, modelos o Edunexus.
2. Tras `INSTALACION COMPLETA`, ejecutar:

```sh
docker restart supabase-edge-functions-ueh7xuehxl9thmhre7fpk4xx
```

3. Publicar también los cambios de `src/components/OdontoHelpAssistantModal.jsx`, `src/components/landing/LandingAiAssistant.jsx`, `src/services/helpAssistantService.js` y los módulos compartidos mediante el flujo Git/Coolify de la aplicación OdontoCloud. Hasta desplegar el frontend no aparecen historial, respuesta progresiva ni Detener. Instalar el backend primero; sigue aceptando solicitudes del frontend anterior.
4. En ambos chats probar: «hola»; una consulta de citas (app) o planes (página pública); «no entendí»; «paso a paso»; cambiar de tema; Detener; Nueva conversación mientras responde.
5. Consultar el registro del contenedor anterior: debe terminar con `answer_completed` para una respuesta de IA. Una guía de respaldo no demuestra generación exitosa.

## Alcance de la verificación

Pruebas locales de autenticación, historial acotado, aislamiento de solicitudes, referencias públicas, streaming UTF-8, cortes, cancelación y cliente conectado a un servidor simulado. Build y revisión de seguridad locales. Falta medir en el VPS real la latencia y comprobar que Kong y el proxy entregan los fragmentos sin almacenarlos hasta el final.

Ollama tiene un límite de 45 segundos por solicitud; el navegador espera hasta 58 segundos, incluyendo la verificación de sesión (máximo 8 segundos). Streaming reduce la espera para ver texto, no aumenta la velocidad de cálculo. El runtime actual tiene un límite de 60 segundos. La carga en frío o las consultas largas todavía pueden terminar en respaldo.

El endpoint comercial sigue siendo público y no implementa cuotas distribuidas: el proxy debe limitar abuso si se expone a tráfico alto. No se modificó ningún servicio de Edunexus ni la configuración global de Ollama.
