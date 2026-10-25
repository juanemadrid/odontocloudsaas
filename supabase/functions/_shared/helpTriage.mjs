import { HELP_GUIDES, normalize } from './helpKnowledge.mjs';

export function isHelpFeedback(question) {
  const q = normalize(question);
  return /\b(?:tu|tus|esa|esta|la) respuestas?\b.{0,55}\b(?:no|mal|mala|sirve|repite|repetida|incorrecta|equivocada|entiendo)\b/.test(q) ||
    /\b(?:no (?:me )?(?:entiendes|escuchas|respondes|ayudas)|(?:solo|siempre) (?:sabes|dices|repites|respondes)|estas repitiendo|ya (?:me )?(?:dijiste|respondiste)|no era (?:eso|lo que)|no (?:fue|es) lo que (?:pregunte|pedi)|deja de repetir)\b/.test(q) ||
    /\b(?:sistema|programa|asistente|ia)\b.{0,30}\b(?:malo|mala|pesimo|pesima|inutil|estupido|estupida|mierda|no sirve)\b/.test(q) ||
    /\b(?:estoy|me siento) (?:frustrad[oa]|decepcionad[oa]|molest[oa]|inconforme)\b/.test(q);
}

export const helpFeedbackReply = () => ({ success: true, provider: 'assistant', sources: [], reason: 'conversation',
  answer: 'Entiendo tu inconformidad. No quiero repetirte información que no resuelve lo que necesitas. ¿Qué estabas intentando hacer o qué parte de mi respuesta no te sirvió?' });

export function isHelpOpening(question) {
  return /^(?:(?:hola|bueno|oye|mira) )?(?:tengo (?:(?:una|otra|unas|algunas) )?(?:duda|dudas|pregunta|preguntas)|(?:necesito|quiero|me puedes dar) (?:algo de )?ayuda|ayuda|ayudame|no se (?:ni )?(?:como (?:explicarlo|empezar)|que (?:preguntar|hacer)|por donde empezar)|estoy (?:perdido|perdida|confundido|confundida))$/.test(normalize(question));
}

// General support context for a conversation that has no identifiable topic yet.
// It does not authorize instructions for undocumented operations.
export const HELP_TRIAGE_ID = 'help-triage';
export const HELP_TRIAGE_GUIDE = {
  id: HELP_TRIAGE_ID, title: 'Conversación inicial de soporte de OdontoCloud', category: 'Ayuda', prereq: '',
  steps: [
    'El usuario puede no saber cómo explicar el problema o desconocer los nombres de módulos. Empieza de forma natural, con una sola invitación breve a contar qué sucede o qué intentaba hacer. No le exijas identificar un módulo, elegir una categoría ni escribir una pregunta técnica. No des un tutorial ni una lista de opciones antes de entender la duda.',
    'Si dice «tengo una duda», reconoce que quieres escucharla y pídele que te cuente. Si dice que no sabe por dónde empezar, acompáñalo con una pregunta sencilla sobre lo que quiere lograr. Si menciona un error, pregunta qué pasó sin pedir nombres, documentos ni datos privados.',
    'Cuando el usuario expresa inconformidad o critica la respuesta, atiende esa crítica. No repitas documentación del tema anterior, no defiendas el producto ni recites políticas. Reconoce brevemente el problema. Si indicó qué estuvo mal, corrígelo usando documentación; si no lo indicó, haz una sola pregunta concreta. No prometas acciones o revisiones realizadas.',
    'Áreas documentadas del sistema: ' + [...new Set(HELP_GUIDES.map(g => g.category))].map(c => '[' + c + ']').join(', ') + '. Esto es solo un mapa de alcance, no documentación de procedimientos. No inventes botones, requisitos ni pasos. Una pregunta ajena a OdontoCloud se rechaza brevemente.',
  ],
  note: 'No conoces datos reales de pacientes ni de clínicas. No ejecutas acciones. El contexto anterior ayuda a entender la conversación, pero no debes asumir que toda duda nueva trata del tema anterior.',
};
