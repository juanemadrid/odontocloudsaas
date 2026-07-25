// src/services/geminiService.js

// ─── Modelos en orden de preferencia (fallback automático) ──────────────────
// PROBADO con cuenta joshuastream27@gmail.com:
// gemini-2.5-flash: ✅ Único modelo disponible (limit: 20 RPM - respeta el retry-after)
// gemini-2.0-flash / gemini-2.0-flash-lite: limit: 0 en esta cuenta (sin cuota)
const GEMINI_MODELS = [
    'gemini-2.5-flash',
    'gemini-1.5-flash'
];

// Tokens máximos para respuestas del asistente guiado (respuestas JSON completas)
// Aumentado a 2000 para soportar el dictado clínico rico del paso 4 (Nova)
// con extracción simultánea de diagnósticos, medicamentos, procedimientos y campos RIPS
const MAX_TOKENS_GUIDED = 2000;
// Tokens máximos para análisis de notas clínicas (respuestas más largas)
const MAX_TOKENS_REFINE = 2000;

/**
 * Realiza una petición a la API de Gemini con reintentos y fallback de modelo.
 * - Reintenta ante errores de cuota (429), servidor ocupado (503) o modelo no disponible (404).
 * - Usa backoff exponencial entre reintentos.
 */
async function fetchGeminiWithRetry(contents, apiKey, maxRetries = 3, maxTokens = MAX_TOKENS_GUIDED) {
    const delay = (ms) => new Promise(res => setTimeout(res, ms));

    const parseRetryAfter = (errMsg) => {
        const match = errMsg?.match(/retry in ([\d.]+)s/i);
        if (match) return Math.ceil(parseFloat(match[1]) * 1000);
        return 15000;
    };

    // Detectar tipo de key:
    // - AQ. = nuevo formato Auth Key → header x-goog-api-key
    // - AIzaSy = key clásica → query param ?key=
    const isAuthKey = apiKey.startsWith('AQ.');

    let lastError = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const model = GEMINI_MODELS[Math.min(attempt, GEMINI_MODELS.length - 1)];
        
        const url = isAuthKey
            ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
            : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        const headers = isAuthKey
            ? { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }
            : { 'Content-Type': 'application/json' };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({ 
                    contents,
                    generationConfig: {
                        temperature: 0,
                        maxOutputTokens: maxTokens,
                        responseMimeType: "application/json"
                    }
                })
            });

            // Éxito → retornar directamente
            if (response.ok) {
                const data = await response.json();
                return data;
            }

            const errData = await response.json().catch(() => ({}));
            const errMsg = errData?.error?.message || `HTTP ${response.status} - ${response.statusText}`;
            lastError = new Error(errMsg);

            // Errores recuperables: alta demanda (503), límites de cuota (429) y modelo no soportado (404)
            if (response.status === 503 || response.status === 429 || response.status === 404) {
                console.warn(`[GeminiService] Intento ${attempt + 1}/${maxRetries} con modelo "${model}" falló (${response.status}): ${errMsg}.`);
                
                if (attempt + 1 < maxRetries) {
                    if (response.status === 429) {
                        // Esperar el tiempo exacto que Google recomienda
                        const waitMs = parseRetryAfter(errMsg);
                        if (waitMs > 3000) {
                            // Si la espera supera los 3 segundos, lanzamos el error inmediatamente
                            // para no congelar la UI esperando un reintento largo en segundo plano.
                            console.warn(`[GeminiService] Espera de ${(waitMs/1000).toFixed(1)}s excede el límite razonable. Cancelando reintentos.`);
                            throw lastError;
                        }
                        console.warn(`[GeminiService] Esperando ${(waitMs/1000).toFixed(1)}s antes de reintentar...`);
                        await delay(waitMs);
                    } else if (response.status === 503) {
                        await delay(2000);
                    }
                    // 404: cambiar de modelo sin delay
                }
                continue;
            }

        } catch (fetchError) {
            // Si ya lo lanzamos nosotros (error terminal), propagarlo directamente
            if (fetchError === lastError) throw fetchError;
            // Error de red puro (TypeError: failed to fetch)
            if (fetchError.name === 'TypeError') {
                lastError = fetchError;
                console.warn(`[GeminiService] Error de red en intento ${attempt + 1}/${maxRetries} con modelo "${model}".`);
                if (attempt + 1 < maxRetries) {
                    const nextModel = GEMINI_MODELS[Math.min(attempt + 1, GEMINI_MODELS.length - 1)];
                    if (nextModel === model) {
                        await delay(1000 * Math.pow(2, attempt));
                    } else {
                        await delay(50); // Pequeño delay de transición para estabilización de red
                    }
                }
                continue;
            }
            throw fetchError;
        }
    }

    throw lastError || new Error('El servicio de IA no está disponible. Intente de nuevo en unos momentos.');
}

/** Extrae y limpia el texto JSON de una respuesta de Gemini */
function extractJsonText(data) {
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) throw new Error('Respuesta vacía del servicio de IA.');
    let clean = raw.trim();
    if (clean.startsWith('```json')) clean = clean.slice(7);
    else if (clean.startsWith('```')) clean = clean.slice(3);
    if (clean.endsWith('```')) clean = clean.slice(0, -3);
    return clean.trim();
}

/**
 * Llama a la API de Gemini (Free Tier) para estructurar y refinar notas clínicas a partir de transcripciones.
 * @param {string} rawText La transcripción de voz del odontólogo.
 * @param {string} apiKey La API Key de Gemini del usuario.
 * @returns {Promise<{comentario: string, prognosis: string, tratamiento: string}>}
 */
export async function refineClinicalNotes(rawText, apiKey) {
    if (!apiKey) {
        throw new Error('Se requiere una clave API de Gemini para refinar con IA.');
    }

    const prompt = `Eres un asistente de inteligencia artificial especializado en odontología clínica. Tu trabajo es tomar una transcripción de voz informal o desordenada realizada por un odontólogo y estructurarla en notas clínicas profesionales en español.

Debes extraer y rellenar las siguientes secciones:
1. "comentario" (Una descripción clínica detallada del estado del paciente, hallazgos, diagnóstico y evolución, usando terminología dental correcta y formal, redactada en tercera persona. Debe ser profesional, ordenada y clara. No incluyas información redundante o comentarios informales del dictado).
2. "prognosis" (Determina el pronóstico entre "Favorable", "Reservado" o "Desfavorable").
3. "tratamiento" (Describe brevemente el procedimiento o tratamiento realizado en esta sesión).

Devuelve EXCLUSIVAMENTE un objeto JSON válido con la siguiente estructura (no agregues bloques de código markdown como \`\`\`json o texto adicional, solo el JSON puro):
{
  "comentario": "...",
  "prognosis": "Favorable" | "Reservado" | "Desfavorable",
  "tratamiento": "..."
}

Transcripción del odontólogo:
"${rawText.replace(/"/g, '\\"')}"`;

    try {
        const contents = [{ parts: [{ text: prompt }] }];
        const data = await fetchGeminiWithRetry(contents, apiKey, 3, MAX_TOKENS_REFINE);
        const parsedData = JSON.parse(extractJsonText(data));
        return {
            comentario: parsedData.comentario || '',
            prognosis: parsedData.prognosis || 'Favorable',
            tratamiento: parsedData.tratamiento || ''
        };
    } catch (e) {
        console.error('Error al refinar las notas con Gemini:', e);
        throw e;
    }
}

/**
 * Multi-turn chat assistant that responds verbally and structures clinical data.
 * @param {string} rawText Spoken input from the dentist.
 * @param {Array} history Conversation history in [{role: 'user'|'model', parts: [{text: '...'}]}] format.
 * @param {string} apiKey Gemini API Key.
 * @returns {Promise<{speechResponse: string, comentario: string, prognosis: string, tratamiento: string}>}
 */
export async function chatClinicalAssistant(rawText, history = [], apiKey) {
    if (!apiKey) {
        throw new Error('Se requiere una clave API de Gemini.');
    }

    const systemPrompt = `Eres "Nova", la asistente virtual de voz inteligente de la clínica dental. El odontólogo te hablará mientras atiende a un paciente. 

Tus responsabilidades son:
1. Responderle al doctor de manera breve, profesional, sumamente educada y conversacional (en 1 o 2 frases cortas, pensadas para ser leídas en voz alta por un sintetizador de voz). Sé amable y eficiente. Presentándote o refiriéndote como Nova.
2. Ir redactando y actualizando una evolución clínica formal en base a lo que el doctor te dicta o conversa. Redáctala de forma profesional, en tercera persona, omitiendo los saludos o charla informal.
3. Determinar la prognosis ("Favorable", "Reservado" o "Desfavorable").
4. Mantener un resumen del tratamiento realizado.

Debes devolver obligatoriamente un objeto JSON válido con la siguiente estructura (sin formato markdown \`\`\`json, solo el JSON puro):
{
  "speechResponse": "La respuesta corta para hablar en voz alta al doctor (ej. 'Entendido doctor, he registrado resina en el diente 24. ¿Hay alguna observación adicional?')",
  "comentario": "El comentario clínico acumulado y redactado formalmente",
  "prognosis": "Favorable" | "Reservado" | "Desfavorable",
  "tratamiento": "El tratamiento realizado"
}`;

    const contents = [
        {
            role: 'user',
            parts: [{ text: systemPrompt }]
        },
        {
            role: 'model',
            parts: [{ text: 'Entendido. Estoy listo para asistirle en la consulta. ¿Qué paciente estamos atendiendo hoy o qué procedimiento iniciamos?' }]
        },
        ...history,
        {
            role: 'user',
            parts: [{ text: rawText }]
        }
    ];

    try {
        const data = await fetchGeminiWithRetry(contents, apiKey, 3, MAX_TOKENS_REFINE);
        const parsedData = JSON.parse(extractJsonText(data));
        return {
            speechResponse: parsedData.speechResponse || 'Entendido, doctor.',
            comentario: parsedData.comentario || '',
            prognosis: parsedData.prognosis || 'Favorable',
            tratamiento: parsedData.tratamiento || parsedData.treatment || ''
        };
    } catch (e) {
        console.error('Error in chatClinicalAssistant:', e);
        throw e;
    }
}

/**
 * Asistente de voz conversacional guiado paso a paso para llenar el formulario.
 * @param {string} rawText Dictado del odontólogo.
 * @param {number} currentStep Paso actual de la evolución (1 al 7).
 * @param {Array} history Historial del chat en formato [{role: 'user'|'model', parts: [{text: '...'}]}]
 * @param {Object} contextData Datos de doctores, planes y valores del formulario actual.
 * @param {string} apiKey Gemini API Key.
 * @returns {Promise<{speechResponse: string, extractedValue: any, fieldToUpdate: string, nextStep: number}>}
 */
export async function chatGuidedAssistant(rawText, currentStep, history = [], contextData, apiKey) {
    if (!apiKey) {
        throw new Error('Se requiere una clave API de Gemini.');
    }

    const { doctors, planes, currentForm, activeTab, servicios } = contextData;

    let systemPrompt = "";
    if (activeTab === 'nota') {
        systemPrompt = `Eres "Nova", una asistente virtual de voz clínica interactiva diseñada para ayudar al odontólogo a llenar el formulario de Nota Aclaratoria paso a paso mediante una conversación guiada, breve y muy educada.

El formulario consta de los siguientes pasos correlativos (1 al 3):
1. doctorId (Seleccionar el doctor que realiza la nota). Doctores disponibles en la clínica: ${JSON.stringify(doctors.map(d => ({ id: d.id, name: `${d.nombre || d.nombres || ''} ${d.apellido || d.apellidos || ''}`.trim() || d.nombreCompleto })))}
2. comentario (Comentario o aclaración clínica formal. Debe ser redactado en tercera persona, de manera muy profesional, ordenada y clara, omitiendo saludos o muletillas).
3. submit (Guardar y finalizar la nota aclaratoria).

El paso actual es el paso número: ${currentStep}.
Valores actuales del formulario: ${JSON.stringify(currentForm)}

Instrucciones para evaluar la respuesta del usuario (dictado actual: "${rawText}"):
- Si el usuario dice un saludo inicial o estamos en el inicio, debes darle la bienvenida de manera muy breve y preguntar por el primer paso (Doctor).
- Analiza el dictado actual del usuario con respecto al paso actual (${currentStep}).
- Si logras extraer la información para el paso actual, debes:
  1. Definir "extractedValue" con el valor extraído (para doctorId debe ser el ID correspondiente; para comentario el texto redactado; para submit un booleano true).
  2. Definir "fieldToUpdate" con el nombre del campo ("doctorId" | "comentario" | "submit").
  3. Incrementar "nextStep" al siguiente paso y formular una pregunta muy breve y profesional para el siguiente paso en "speechResponse".
  Ejemplo de avance al paso 2: { "speechResponse": "Doctor registrado. Ahora, dícteme el comentario o aclaración clínica que desea registrar.", "extractedValue": "id_doctor", "fieldToUpdate": "doctorId", "nextStep": 2 }
  Ejemplo de avance al paso 3: { "speechResponse": "Aclaración clínica registrada. ¿Desea que guardemos y finalicemos esta nota aclaratoria?", "extractedValue": "El odontólogo aclara que...", "fieldToUpdate": "comentario", "nextStep": 3 }
- Si el usuario da una respuesta inválida, no coincide o no logras extraer el dato, debes pedir aclaración amablemente en "speechResponse", manteniendo "nextStep" igual a ${currentStep} y dejando "fieldToUpdate" y "extractedValue" en null.
- Si el usuario dice "guardar", "finalizar", "sí" o confirma en el paso 3, define "fieldToUpdate" como "submit", "extractedValue" como true y "nextStep" como 4.

Debes devolver obligatoriamente un objeto JSON válido con la siguiente estructura (sin bloques de código markdown, solo el JSON puro):
{
  "speechResponse": "La respuesta verbal en español (breve, máx 2 frases) para el odontólogo.",
  "extractedValue": <el valor extraído o null>,
  "fieldToUpdate": "doctorId" | "comentario" | "submit" | null,
  "nextStep": <el número del paso siguiente (1 al 4)>
}`;
    } else {
        const serviciosText = (servicios && servicios.length > 0)
            ? `Procedimientos clínicos de la plantilla del plan de tratamiento seleccionado actualmente: ${JSON.stringify(servicios.map((s, idx) => ({ paso: idx + 1, descripcion: s.desc || s.procedimiento || s.nombre })))}`
            : "No hay un plan de tratamiento seleccionado aún o no tiene procedimientos registrados.";

        // Construir resumen de lo registrado hasta ahora para el paso 7
        const resumenActual = (() => {
            if (!currentForm) return '';
            const doctorObj = (doctors || []).find(d => d.id === currentForm.doctorId);
            const doctorNombre = doctorObj ? (doctorObj.nombreCompleto || doctorObj.nombre || '') : '';
            const planObj = (planes || []).find(p => p.id === currentForm.planId);
            const planNombre = planObj ? (planObj.title || planObj.nombre || '') : '';
            const meds = (currentForm.medicamentos || []).map(m => `${m.medicamento} (${m.dosis} - ${m.via})`).join(', ');
            const ests = (currentForm.esterilizaciones || []).map(e => `${e.ciclo} – ${e.concepto}`).join(', ');
            return [
                doctorNombre && `Doctor: ${doctorNombre}`,
                planNombre && `Plan: ${planNombre}`,
                currentForm.horaInicio && `Hora inicio: ${currentForm.horaInicio}`,
                currentForm.finalidad && `Finalidad: ${currentForm.finalidad}`,
                currentForm.ambito && `Ámbito: ${currentForm.ambito}`,
                currentForm.dxPrincipal?.code && `Dx principal: ${currentForm.dxPrincipal.code} – ${currentForm.dxPrincipal.name}`,
                meds && `Medicamentos: ${meds}`,
                ests && `Esterilización: ${ests}`,
            ].filter(Boolean).join('. ');
        })();

        systemPrompt = `Eres "Nova", una asistente virtual de voz clínica interactiva diseñada para ayudar al odontólogo a registrar la evolución clínica completa de un paciente, paso a paso, mediante una conversación guiada, profesional y muy eficiente.

FLUJO DE 8 PASOS – EVOLUCIÓN CLÍNICA COMPLETA:

Paso 1 – Doctor: Seleccionar el profesional que atiende.
  Doctores disponibles: ${JSON.stringify(doctors.map(d => ({ id: d.id, name: `${d.nombre || d.nombres || ''} ${d.apellido || d.apellidos || ''}`.trim() || d.nombreCompleto })))}

Paso 2 – Plan de tratamiento: Seleccionar el plan activo del paciente.
  Planes disponibles: ${JSON.stringify(planes.map(p => ({ id: p.id, name: p.title || p.nombre || `Plan #${p.id.slice(-4)}` })))}
  Al seleccionar el plan, menciona brevemente los procedimientos disponibles de ese plan (${serviciosText}) y pregunta al doctor cuáles de ellos se realizaron hoy o si se completaron todos.

Paso 3 – Hora de inicio: Registrar la hora exacta en que inició el procedimiento.
  Hora actual de referencia: ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}.
  Devolver en formato "HH:MM" (24h). Si el doctor dice "ahora", usar la hora actual.
  NO preguntar la hora de fin; se registrará automáticamente al guardar.

Paso 4 – Dictado clínico completo: El doctor dicta en un solo mensaje todos los detalles del procedimiento:
  hallazgos, diagnóstico, procedimientos realizados (de la plantilla), medicamentos aplicados,
  esterilización, ámbito, finalidad y cualquier observación relevante.
  En este paso debes extraer SIMULTÁNEAMENTE todos los campos posibles en extraUpdates:
  comentario (redactado formalmente en 3ª persona), dxPrincipal (CIE-10), dxRelacionado,
  complicacion, finalidad, ambito, modalidadAtencion, personalAtiende,
  medicamentos[], esterilizaciones[], completarProcedimientos[], plantillaObservaciones[].
  ${serviciosText}
  Si el doctor menciona realizar "todos los procedimientos", establece extraUpdates.completarProcedimientos: ["todos"].
  Al avanzar al paso 5, pregunta brevemente: "¿Desea confirmar los procedimientos de la plantilla que marcamos como realizados?" (solo si hay plantilla con procedimientos).

Paso 5 – Confirmación de procedimientos de plantilla (solo si hay plan con servicios):
  Confirmar verbalmente qué procedimientos quedaron marcados como realizados.
  Si el doctor corrige o agrega alguno, actualizar completarProcedimientos en extraUpdates.
  Si no hay plan seleccionado o no tiene servicios, saltar este paso directamente al 6.
  Devolver fieldToUpdate: null y nextStep: 6 al confirmar.

Paso 6 – Medicamento y esterilización:
  Si ya se detectaron medicamentos en el paso 4, confirmar brevemente y preguntar si hay esterilización pendiente.
  Si NO se detectó medicamento: preguntar "¿Aplicó algún medicamento o anestesia en esta sesión?"
    - Si Sí: pedir nombre, dosis y vía → extraer en extraUpdates.medicamentos y aplicaMedicamento: true.
    - Si No: avanzar directamente.
  Luego preguntar "¿Se realizó control de esterilización?"
    - Si Sí: pedir ciclo y concepto → extraer en extraUpdates.esterilizaciones y controlEsterilizacion: true.
    - Si No: avanzar al paso 7.
  Para avanzar desde este paso usar: fieldToUpdate: "controlEsterilizacion", extractedValue: true/false, nextStep: 7.

Paso 7 – Resumen verbal antes de guardar:
  Nova lee en voz alta un resumen completo de todo lo registrado para que el doctor confirme.
  Resumen actual: "${resumenActual || 'Sin datos registrados aún.'}"
  Terminar con: "¿Confirma que guardemos esta evolución?"
  Usar: fieldToUpdate: "resumen", extractedValue: null, nextStep: 7 (esperar confirmación).

Paso 8 – Guardar: Si el doctor confirma, guardar la evolución.
  Usar: fieldToUpdate: "submit", extractedValue: true, nextStep: 8.

---

PASO ACTUAL: ${currentStep}
VALORES ACTUALES DEL FORMULARIO: ${JSON.stringify(currentForm)}

INSTRUCCIONES GENERALES PARA EVALUAR EL DICTADO ("${rawText}"):
- Si el usuario saluda al inicio (paso 1), dar bienvenida muy breve y preguntar el primer dato (doctor).
- Analizar el dictado con respecto al paso actual (${currentStep}).
- Si se extrae el dato del paso actual: avanzar al siguiente, responder confirmando y preguntando lo siguiente.
- Si no se entiende el dato, pedir aclaración amablemente. No avanzar de paso. fieldToUpdate: null, nextStep: ${currentStep}.
- Si el doctor dice "guardar" o "sí confirmo" estando en el paso 7, avanzar al paso 8 (submit).
- Si el doctor dice "guardar" en cualquier paso anterior al 7, primero ir al paso 7 para hacer el resumen.
- El doctor puede saltar pasos o dar varios datos en un solo mensaje; extrae lo que puedas en extraUpdates y avanza.

REGLAS DE EXTRACCIÓN DE CAMPOS (extraUpdates – aplicar en TODOS los pasos):
- personalAtiende: string – nombre del asistente dental o auxiliar mencionado.
- aplicaMedicamento: boolean – true si menciona medicamento, anestesia o inyección.
- controlEsterilizacion: boolean – true si menciona autoclave, esterilización o ciclo.
- completarProcedimientos: array – índices 1-based de procedimientos completados, o ["todos"] / ["ninguno"].
- plantillaObservaciones: array de { index: número, checked: boolean, observation: string } – observaciones por ítem de plantilla.
- medicamentos: array de { medicamento, via, dosis, hora } – via debe ser: 'Oral'|'Tópica'|'Infiltración Local'|'Sublingual'|'Intramuscular'|'Intravenosa'.
- esterilizaciones: array de { ciclo, concepto, cantidad } – concepto: 'Aprobado'|'Rechazado'|'En proceso'.
- ambito: 'Ambulatorio'|'Hospitalario'|'Urgencias'.
- finalidad: 'Diagnóstico'|'Terapéutico'|'Preventivo'|'Rehabilitación'.
- formaCirugia: 'Único'|'Múltiple'|''.
- modalidadAtencion: 'Intramural'|'Extramural'|'Telemedicina'.
- dxPrincipal: { code: "CIE-10", name: "Nombre CIE-10" } – deducir el código más apropiado:
    caries → K029, pulpitis → K040, periodontitis → K053, gingivitis → K051,
    fractura dental → S023, absceso → K047, exodoncia indicada → K086, preventivo → Z012.
- dxRelacionado: { code, name }.
- complicacion: { code, name }.

RESPUESTA JSON OBLIGATORIA (sin markdown, solo JSON puro):
{
  "speechResponse": "Respuesta verbal corta en español (máx 2-3 frases, clara y profesional).",
  "extractedValue": <valor extraído del paso actual, o null>,
  "fieldToUpdate": "doctorId"|"planId"|"horaInicio"|"comentario"|"aplicaMedicamento"|"controlEsterilizacion"|"resumen"|"submit"|null,
  "nextStep": <número entre 1 y 8>,
  "extraUpdates": {
    "personalAtiende": "...",
    "aplicaMedicamento": true/false,
    "controlEsterilizacion": true/false,
    "completarProcedimientos": [...],
    "plantillaObservaciones": [{ "index": 1, "checked": true, "observation": "..." }],
    "medicamentos": [{ "medicamento": "...", "via": "...", "dosis": "...", "hora": "..." }],
    "esterilizaciones": [{ "ciclo": "...", "concepto": "...", "cantidad": 1 }],
    "dxPrincipal": { "code": "...", "name": "..." },
    "dxRelacionado": { "code": "...", "name": "..." },
    "complicacion": { "code": "...", "name": "..." },
    "ambito": "...",
    "finalidad": "...",
    "formaCirugia": "...",
    "modalidadAtencion": "..."
  }
}`;
    }

    // Limitar el historial a los últimos 6 turnos para reducir tokens y mejorar velocidad
    const recentHistory = history.slice(-6);

    const contents = [
        {
            role: 'user',
            parts: [{ text: systemPrompt }]
        },
        {
            role: 'model',
            parts: [{ text: 'Entendido. Responderé solo con el JSON solicitado.' }]
        },
        ...recentHistory,
        {
            role: 'user',
            parts: [{ text: rawText }]
        }
    ];

    try {
        const data = await fetchGeminiWithRetry(contents, apiKey, 3, MAX_TOKENS_GUIDED);
        const parsedData = JSON.parse(extractJsonText(data));
        return {
            speechResponse: parsedData.speechResponse || 'Entendido.',
            extractedValue: parsedData.extractedValue !== undefined ? parsedData.extractedValue : null,
            fieldToUpdate: parsedData.fieldToUpdate || null,
            nextStep: typeof parsedData.nextStep === 'number' ? parsedData.nextStep : currentStep,
            extraUpdates: parsedData.extraUpdates || null
        };
    } catch (e) {
        console.error('Error in chatGuidedAssistant:', e);
        throw e;
    }
}
