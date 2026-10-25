# Asistente de ayuda de OdontoCloud

Implementación aditiva para Supabase **autohospedado** en el servicio **2 de OdontoCloud en Coolify**, VPS `150.136.210.37`. No usa Supabase Cloud. No requiere modificar, reiniciar ni inspeccionar servicios de Edunexus.

## Comportamiento

- Superadministrador > Clínicas > **Asistente IA de ayuda · Control por clínica**: interruptor general y uno por clínica. Todo empieza apagado. Las guías públicas permanecen accesibles.
- El servidor comprueba el interruptor general, la clínica, la pertenencia y el estado del usuario antes de reservar generación. RLS impide a administradores de clínica y usuarios normales leer o cambiar esta configuración. El cliente no puede elegir clínica, proveedor, modelo, URL ni instrucciones.
- Gemini recibe documentación pública seleccionada, requisitos, la pantalla de una lista permitida y una representación operativa de la pregunta y de los cuatro últimos mensajes. `_shared/helpMeaning.mjs` la construye exclusivamente con vocabulario fijo del sistema y palabras canónicas del manual público estático: conserva orden, negaciones, condiciones y motivos, pero omite términos desconocidos, correos, URL y valores con dígitos. No se envían las cadenas originales ni identificadores de clínica o sesión. El contexto proyectado permite distinguir «cómo genera» de «qué pasa si no genera» sin enviar valores personales. Si la proyección deja una ambigüedad, el modelo debe pedir aclaración sin inventar los detalles omitidos.
- La IA solo dispone de `read_system_guides`, una lectura limitada a tres guías públicas del catálogo de 43 procedimientos vinculados al código. No tiene acceso a datos clínicos ni capacidad de ejecutar acciones. Se excluyen cuatro fichas comerciales del catálogo operativo. Solicitudes detectadas sobre otras clínicas, ataques, credenciales o consejos clínicos se rechazan sin consumir IA. El filtrado por patrones no sustituye la separación de datos y permisos.
- Hasta 120 palabras solicitadas; máximo 400 tokens en modelos anteriores y 1024 en Gemini 3, cuyo presupuesto incluye razonamiento (nivel bajo). El modelo elegido no se cambia automáticamente. No hay reintentos. Una consulta puede realizar hasta dos peticiones al proveedor si necesita leer otras guías; la segunda deshabilita nuevas lecturas. Se rechazan respuestas truncadas, enlaces externos y botones ajenos a la documentación. Las rutas compuestas por nombres documentados se aceptan aunque vengan en un solo par de corchetes. Esto no garantiza exactitud semántica: contrastar siempre las guías con las pantallas.
- Las preguntas de funcionamiento, incluyendo crear citas/presupuestos, seguimientos y aperturas como «tengo una duda» o «no sé cómo explicarlo», se envían al proveedor cuando está habilitado y tiene cuota. Sin tema identificable, `_shared/helpTriage.mjs` aporta contexto general de soporte para una pregunta natural de aclaración: no se exige que la persona conozca módulos ni se inventan procedimientos. Esta fase no muestra fuentes de una guía que todavía no se ha identificado. Saludos y agradecimientos simples se responden localmente; la biblioteca tampoco consume tokens. Las preguntas claramente ajenas al sistema se rechazan. La interfaz identifica las respuestas automáticas, las guías y las respuestas reales de Gemini.
- Cuota por clínica: 15 intentos/día y 150/mes. Cuota global: 40/día y 500/mes. Además: 4 intentos/minuto entre todas las clínicas y 10 segundos entre intentos del mismo usuario. Los límites son conservadores propios, no una afirmación de la cuota disponible en Google.
- Los contadores persisten en PostgreSQL; la reserva bloquea las filas global y de clínica para impedir exceder límites desde varias réplicas. Cuenta también intentos fallidos y no almacena mensajes. Períodos diarios/mensuales en America/Bogota. Los contadores históricos se depuran después de 65 días, conservando un marcador de espera por usuario.
- Ante cuota, error, bloqueo del proveedor, cancelación o configuración ausente, se devuelve la guía verificada. Los interruptores bloquean nuevas reservas; una solicitud ya enviada puede terminar.
- Cada respuesta de Gemini incluye el modelo confirmado. El respaldo incluye un código limitado de diagnóstico (permisos de Google, modelo no disponible, cuota, truncamiento, botones no verificados, error de conexión o lectura de configuración), sin cuerpos de error de Google ni claves. Los logs registran finalización o causa de respaldo, nunca mensajes ni identificadores personales. La cuota temporal y la diaria se mantienen sin cambios.

## Prueba de la configuración por clínica

Superadministrador > Clínicas > Asistente IA de ayuda > **Probar IA**, junto al interruptor de cada clínica. El servidor valida al superadministrador, verifica que la clínica y un perfil pertenezcan al mismo tenant y estén activos, y reproduce la conversación fija «no sé cómo se generan los RIPS» → «cómo se envían y a dónde se envían» por el **mismo handler de producción**, con los mismos interruptores, clave cifrada, modelo, validación de salida y reserva de cuota. No crea una sesión de usuario, no cambia banderas ni consulta pacientes. Si genera, consume una consulta y puede activar la espera de 10 segundos para el perfil usado para comprobar pertenencia.

El resultado distingue «Gemini respondió · modelo» del manual y explica el bloqueo. Esta prueba comprueba el recorrido de servidor de esa clínica, no sustituye verificar su JWT real desde una sesión de clínica. En el chat de una clínica activa, una consulta como «¿Dónde genero RIPS?» debe mostrar **Respuesta generada con Gemini AI · modelo**. «Mensaje automático de ayuda» es un saludo/aclaración local; «Guía verificada» es respaldo y muestra por qué se utilizó. Esperar al menos 10 segundos entre consultas y recordar el máximo global de 4/minuto durante las pruebas.

## Variables del servicio de funciones de OdontoCloud

### Configuración desde el panel (recomendada)

En **Superadministrador > Clínicas > Asistente IA de ayuda · Control por clínica > Conexión de Gemini para ayuda**:

1. Pegar la clave dedicada en el campo de contraseña y elegir Gemini 2.5 Flash-Lite.
2. Opcionalmente pulsar **Probar conexión**. Envía únicamente «Responde OK.» a Google. Es una prueba de clave/modelo; no certifica los interruptores ni la cuota de cada clínica. Para ello utilizar **Probar IA**.
3. Pulsar **Probar y guardar clave**. El servidor vuelve a probarla y solo entonces sustituye la anterior. Si falla la prueba, el cifrado o la escritura, no se sustituye intencionalmente la clave anterior. Ante un fallo de red durante la escritura, actualizar el estado antes de repetir porque la escritura puede haberse completado.
4. Encender el interruptor general y las clínicas deseadas. Guardar la clave no enciende clínicas ni cambia el asistente de superadministrador.

La clave se cifra con `_shared/helpCrypto.mjs` (AES-256-GCM), AAD exclusiva `odontocloud|help|gemini|v1` y una clave maestra dedicada a la ayuda de **OdontoCloud**. Las credenciales guardadas anteriormente con `tenant-secrets/crypto.ts` conservan su descifrado original. La tabla `odonto_help_credentials` no permite lectura/escritura directa a `anon` ni `authenticated`, ni siquiera al navegador del superadministrador. La función `odontocloud-help-settings` valida el usuario con GoTrue y su rol activo en `profiles`; nunca usa roles de `user_metadata`. Solo devuelve estado y fechas, nunca la clave ni el ciphertext.

La configuración se lee en cada consulta autenticada; las sustituciones se aplican sin reiniciar. El panel tiene prioridad sobre la clave de entorno de ayuda. Un fallo de descifrado devuelve guías y no utiliza otra clave silenciosamente. Las pruebas tienen un límite persistente compartido de 6/minuto y 30/día; no consumen la cuota por clínica.

El campo, la prueba, el guardado y la lectura del runtime comparten `_shared/helpApiKey.mjs`: admite claves de autorización nuevas (incluidos puntos y longitudes superiores a 200 caracteres) y tradicionales, con un máximo de 1024 caracteres ASCII imprimibles. No se presupone un prefijo ni se permite espacio o CRLF dentro de la clave. Google comprueba su autenticidad. La versión de la función se identifica en la cabecera `X-Odonto-Help-Version`; esto permite comprobar la instalación sin exponer credenciales.

**Instalación automática del cifrado:** `scripts/deploy-help-coolify.sh` crea una sola vez 32 bytes aleatorios para la ayuda, en `/data/coolify/services/ueh7xuehxl9thmhre7fpk4xx/volumes/functions/.odonto-help-secrets/master-key-v1`. Se monta como `/home/deno/functions/.odonto-help-secrets/master-key-v1`, con directorio 700 y archivo 600, propiedad del usuario del runtime. No se imprime el secreto y se respalda en el directorio privado del despliegue. Este archivo no se publica con React, no se copia al repositorio ni se devuelve por una función. No hay endpoint para descargar archivos arbitrarios. Conservarlo en los respaldos privados del servicio: no regenerarlo ni borrarlo cuando haya API cifrada. Si falta y ya existe una credencial con identificador `help-v1`, el instalador se detiene para exigir restaurar la clave original.

No hace falta crear variables de cifrado manualmente. Como alternativa administrada se admite `ODONTO_HELP_MASTER_KEY_V1` en el runtime; si está presente tiene prioridad sobre el archivo, debe contener la misma clave al trasladarla y debe conservarse entre despliegues. El instalador no la sobrescribe. No modifica `TENANT_SECRETS_*`, la clave del asistente de superadministrador ni claves de Edunexus. Sin clave dedicada se mantiene compatibilidad con el cifrado anterior de OdontoCloud; errores de permisos o formato del archivo fallan de forma cerrada.

Con una clave guardada desde el panel no es necesario configurar variables Gemini nuevas. `ODONTO_HELP_ENABLED=false` sigue siendo un bloqueo de emergencia del servidor; no lo anula el panel. Mantener el interruptor general apagado durante el despliegue.

### Configuración alternativa por entorno

Configurar exclusivamente en las Environment Variables correspondientes al runtime de funciones de **OdontoCloud** en Coolify, nunca en variables `VITE_`:

```dotenv
ODONTO_HELP_ENABLED=true
ODONTO_HELP_PROVIDER=gemini
ODONTO_HELP_GEMINI_MODEL=gemini-2.5-flash-lite
ODONTO_HELP_GEMINI_API_KEY=<clave dedicada de ayuda>
```

`ODONTO_HELP_ENABLED=false` es un corte adicional desde el entorno. Con `true`, aún deben estar encendidos los dos interruptores en la base de datos. La clave debe ser dedicada, distinta de las funciones clínicas. Nunca se reutiliza `GEMINI_API_KEY` ni se persiste una clave en el navegador. La alternativa del panel guarda exclusivamente el sobre cifrado en una tabla accesible solo por el backend.

El código no habilita facturación ni compra cuota. **Una clave de un proyecto con facturación puede generar cargos**: para usar exclusivamente la cuota gratuita, verificar que el proyecto dedicado esté sin facturación y comprobar sus cuotas. No existe un parámetro de la petición que fuerce el uso gratuito de una clave facturada. El servicio gratuito de Google puede usar entradas/salidas para mejorar sus productos; por eso se evita enviar texto libre, incluso si el usuario escribe datos personales.

Para conservar el proveedor local: seleccionar explícitamente `ODONTO_HELP_PROVIDER=ollama`, mantener URL/modelo privados de Ollama, habilitar `ODONTO_HELP_ENABLED=true` y los mismos interruptores. Esta ruta conserva el comportamiento conversacional anterior dentro del VPS. Gemini no recibe solicitudes cuando se selecciona Ollama. La ayuda comercial pública usa guías, sin acceso anónimo a generación con ninguno de los proveedores.

## Orden seguro de despliegue

1. Hacer un respaldo de la base de **OdontoCloud** y guardar la versión actual de la función y el frontend, usando el procedimiento existente. Identificar exactamente el runtime y volumen de funciones del servicio 2. No ejecutar comandos masivos sobre Docker ni tocar otro servicio.
2. Aplicar únicamente estas dos migraciones, en orden: `supabase/migrations/20261024142001_odontocloud_help_controls.sql` y `supabase/migrations/20261024145608_odontocloud_help_credentials.sql`, en PostgreSQL de OdontoCloud. Son transaccionales; crean tablas y funciones nuevas sin modificar tablas clínicas ni flags existentes. Si la primera ya está aplicada, aplicar solo la segunda. No ejecutar todas las migraciones antiguas ni repetir estas migraciones. Ambas incluyen recarga del esquema de PostgREST.
3. Actualizar las carpetas `supabase/functions/odontocloud-help/` y `supabase/functions/odontocloud-help-settings/` completas, los archivos `_shared/helpKnowledge.mjs`, `_shared/helpConversation.mjs`, `_shared/helpCrypto.mjs`, `_shared/helpApiKey.mjs`, `_shared/helpRuntime.ts`, `_shared/helpFeedback.mjs`, `_shared/helpMeaning.mjs`, `_shared/helpTriage.mjs` y asegurar que `tenant-secrets/crypto.ts` esté disponible con su versión actual. Conservar las demás funciones y el runtime principal que enruta por nombre de función.
4. Usar `scripts/deploy-help-coolify.sh <SHA-publicado-de-40-caracteres>` desde la terminal del host de Coolify para aplicar los pasos de backend: valida nombres y volumen del servicio de OdontoCloud, prepara el cifrado dedicado sin sobrescribirlo, respalda y reinicia solo el runtime de funciones de OdontoCloud. No ejecutar desde el contenedor de React. Mantener el interruptor general de la base apagado. La API de Gemini se pegará en el panel tras publicar el frontend.
5. Publicar el frontend construido desde este código. Verificar que las clínicas existentes accedan y que la biblioteca de ayuda funcione con la IA apagada.
6. Desde superadministrador, comprobar la clave guardada en **Conexión de Gemini para ayuda**. No es necesario volver a pegarla al actualizar. Encender únicamente una clínica de prueba y el interruptor general, pulsar **Probar IA** y comprobar proveedor/modelo. Desde la sesión de esa clínica preguntar «¿Dónde está el botón de generar RIPS?»: comprobar respuesta corta, fuente y badge de Gemini. «Cómo apartar una cita» también debe consultar Gemini cuando está habilitado.
7. Probar apagado por clínica, apagado general y una segunda clínica apagada; deben responder con guías sin solicitudes a Google. Comprobar que un usuario de clínica no pueda modificar los interruptores desde REST. Revisar los contadores sin registrar mensajes.
8. Solo tras estas comprobaciones habilitar las clínicas deseadas. Confirmar cuota/modelo con la clave real. Si falla, apagar el interruptor general o `ODONTO_HELP_ENABLED`; las guías siguen disponibles.

Reversión inmediata: apagar el interruptor general. Si hace falta revertir código, restaurar función y frontend de la misma versión. Las tablas nuevas pueden permanecer; no es necesario borrar datos ni revertir otras migraciones.

## Validación local

- `npm run test:ci`: seguridad, ayuda anterior y Gemini, agenda, configuración, odontograma, controles de producción y build.
- `npx --yes deno check supabase/functions/odontocloud-help/index.ts supabase/functions/odontocloud-help-settings/index.ts`: comprobación de tipos de las dos funciones. El módulo compartido de cifrado incluye únicamente ajustes de tipos `BufferSource`; conserva el algoritmo y el formato anteriores.
- `scripts/test-help-gemini.mjs` usa un proveedor simulado: confirma aislamiento del texto privado, clave dedicada, única herramienta de lectura documental y rechazo de herramientas/argumentos ajenos, límites de tokens, apagados, cuotas y respaldo ante errores.
- `scripts/test-help-settings.mjs` usa el cifrado real y un proveedor simulado: valida el rol contra `profiles`, sobres AES-GCM/AAD, estado sin secretos, pruebas mínimas, conservación de la clave ante fallo y uso inmediato de la clave guardada por el handler de ayuda.
- `node scripts/test-help-controls-ui.mjs`: prueba el componente real en Chromium con dos clínicas ficticias y todas las llamadas externas bloqueadas; valida interruptores independientes, pausa general y errores de guardado. Requiere Chromium de Playwright instalado.
- La migración y las políticas pueden verificarse en PostgreSQL local en memoria con PGlite, sin conectar a ninguna base real:

```powershell
$validationRoot = Join-Path $env:TEMP 'odontocloud-help-validation'
npm install --prefix "$validationRoot" --no-audit --no-fund --package-lock=false @electric-sql/pglite@0.5.11
node scripts/test-help-db.mjs (Join-Path $validationRoot 'node_modules\@electric-sql\pglite')
```

Esta comprobación valida migración, RLS, permisos de ejecución, pertenencia, interruptores y contadores con usuarios ficticios. No certifica el runtime remoto, la cuota real de Google ni todos los procedimientos del manual. No se ha desplegado ni enviado una consulta real a Gemini como parte de estas pruebas locales.

Referencias: [generateContent](https://ai.google.dev/api/generate-content), [precios](https://ai.google.dev/gemini-api/docs/pricing), [condiciones de datos](https://ai.google.dev/gemini-api/terms), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Cobertura y límites del conocimiento

El modelo recibe el procedimiento seleccionado completo y un catálogo para consultar otras guías públicas. La trazabilidad de los 43 procedimientos está en [help-knowledge-coverage.md](help-knowledge-coverage.md). Este catálogo no equivale a documentar toda función ni garantiza que toda respuesta sea correcta. Las funciones sin evidencia no deben afirmarse, y los ensayos locales usan un proveedor simulado; la calidad de las respuestas reales requiere comprobar la versión instalada y ejecutar Probar IA.

## Evaluación de interpretación

La batería local incluye 13 preguntas operativas y de confianza del producto combinadas con 5 temas anteriores (65 combinaciones), además de alcance, aislamiento y transporte. Verifica la selección y preservación de significado; las respuestas del proveedor en estas pruebas son simuladas. No certifica respuestas a cualquier pregunta ni conocimiento completo de todos los módulos. El manual público amplía el vocabulario fijo, sin incorporar valores del usuario. La política distingue procedimientos, explicaciones, capacidades, estados reales, garantías y consultas ajenas; la pantalla actual nunca debe determinar por sí sola el tema.

Las críticas a la respuesta y expresiones de inconformidad se tratan como una tarea de conversación distinta del tema del manual. Conservan vocabulario emocional en la proyección, pueden corregir una respuesta usando la biblioteca y no heredan automáticamente fuentes de una guía previa. El respaldo por cuota reconoce la inconformidad sin recitar la guía anterior. Las pruebas incluyen las dos frases de la captura y variantes, con proveedor simulado y con cuota bloqueada.
