// Datos y respuestas 100% MOCK para la Fase IA-1.1 del Superadministrador
// CERO conexiones a bases de datos, cero APIs externas, cero dependencias backend.
// Modo MOCK — No conectado a producción.

export const MOCK_KPIS = [
    {
        id: "clinicas",
        title: "Clínicas Activas",
        value: "14",
        detail: "Dato simulado • 14 clínicas demo",
        badge: "MOCK",
        badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
        iconType: "clinic",
    },
    {
        id: "vencimientos",
        title: "Próximas a Vencer",
        value: "2",
        detail: "Información demostrativa",
        badge: "Simulado",
        badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
        iconType: "clock",
    },
    {
        id: "alertas",
        title: "Alertas Críticas",
        value: "1",
        detail: "1 alerta simulada de facturación",
        badge: "Demo",
        badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
        iconType: "alert",
    },
    {
        id: "solicitudes",
        title: "Solicitudes Pendientes",
        value: "1",
        detail: "MOCK — sin conexión a datos reales",
        badge: "Prueba",
        badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
        iconType: "file",
    },
];

export const QUICK_QUESTIONS = [
    { id: "vencimientos", label: "¿Qué clínicas vencen este mes?", icon: "clock" },
    { id: "factus", label: "Revisar Factus (Demo)", icon: "file" },
    { id: "servidor", label: "Estado del servidor (Mock)", icon: "server" },
    { id: "actividad", label: "Actividad de clínicas demo", icon: "activity" },
    { id: "rips", label: "RIPS (Simulado)", icon: "fileText" },
    { id: "backups", label: "Backups (Simulado)", icon: "database" },
];

export const MOBILE_CHIPS = [
    { id: "clinicas", label: "Clínicas Demo", prompt: "Actividad de clínicas demo" },
    { id: "vencimientos", label: "Vencimientos", prompt: "¿Qué clínicas vencen este mes?" },
    { id: "factus", label: "Factus (Demo)", prompt: "Revisar Factus" },
    { id: "rips", label: "RIPS (Demo)", prompt: "¿Hay errores en facturación o RIPS?" },
    { id: "servidor", label: "Servidor (Mock)", prompt: "Estado del servidor" },
    { id: "backups", label: "Backups (Mock)", prompt: "Backups" },
];

export const MOCK_RESPONSES = {
    vencimientos: {
        text: `Estas son las clínicas con vencimiento simulado para demostración:

• **Clínica Demo Norte** (Plan Pro) — Vence en 4 días (*Fecha de prueba*).
• **Clínica Demo Centro** (Plan Starter) — Vence en 6 días (*Fecha de prueba*).

💡 *Información demostrativa:* Notificaciones automáticas simuladas para validación de interfaz. MOCK — sin conexión a datos reales.`,
        tags: ["Dato simulado", "2 Clínicas Demo"],
    },
    factus: {
        text: `Diagnóstico demostrativo de facturación (MOCK — sin conexión a datos reales):

• **Estado simulado:** 13 clínicas demo timbrando comprobantes de prueba.
• ⚠️ **1 alerta simulada de facturación:** *Clínica Demo Sur* tiene folios ficticios de prueba por debajo del umbral demo.
• **Promedio simulado:** 1.2 segundos por comprobante demostrativo.

💡 *Nota MOCK:* No se realiza ninguna conexión con DIAN ni Factus en esta fase.`,
        tags: ["1 Alerta simulada", "MOCK"],
    },
    rips: {
        text: `Reporte simulado de facturación y RIPS (MOCK — sin conexión a datos reales):

• **1 alerta simulada de facturación:** Folios de prueba bajos en Clínica Demo Sur.
• **3 inconsistencias RIPS de demostración:** Registros de prueba con diagnósticos CIE-10 no homologados en dataset sintético.
• **Validación previa:** Información demostrativa procesada en memoria local.

💡 *Nota MOCK:* Sin conexión con MinSalud ni historias clínicas reales.`,
        tags: ["3 Inconsistencias demo", "MOCK"],
    },
    servidor: {
        text: `Monitoreo simulado de infraestructura (MOCK — sin conexión a datos reales):

• **Host:** Servidor Demostrativo (Entorno Simulado)
• **Orquestador:** Plataforma de Contenedores Demo
• **Carga CPU:** 18% (Métrica simulada)
• **Memoria RAM:** 42% (Métrica simulada)
• **API Gateway & Auth:** Servicios simulados respondiendo normalmente.
• **Aislamiento:** Verificación lógica demostrativa.

💡 *Nota MOCK:* No se leen métricas ni IPs del VPS real en esta fase. Modo MOCK — No conectado a producción.`,
        tags: ["Servidor Demo", "CPU 18% Simulado", "MOCK"],
    },
    actividad: {
        text: `Resumen de actividad operativa simulada de clínicas (MOCK):

• **14 Clínicas demo** registradas en entorno de pruebas.
• **8 Clínicas demo** con actividad simulada reciente.
• **142 Citas simuladas** registradas en el dataset de prueba.
• **48 Odontogramas e historias simuladas** generadas para demostración.
• Ningún bloqueo registrado en la simulación.

💡 *Información demostrativa:* MOCK — sin conexión a datos reales.`,
        tags: ["Dato simulado", "142 Citas demo"],
    },
    backups: {
        text: `Registro simulado de respaldos (MOCK — sin conexión a datos reales):

• **Último backup: dato MOCK** (Simulado: Hoy a las 03:00 AM UTC - Exitoso ✅)
• **Tamaño estimado:** 48.2 MB (Dato sintético)
• **Ubicación:** Almacenamiento demo simulado
• **Integridad:** Checksum verificado en simulación.

💡 *Nota MOCK:* No se consulta ni se altera ninguna copia de seguridad real.`,
        tags: ["Último backup: dato MOCK", "Simulación"],
    },
};

export function getMockAiResponse(query) {
    const q = (query || "").toLowerCase();

    if (q.includes("rips")) {
        return MOCK_RESPONSES.rips;
    }
    if (q.includes("vence") || q.includes("vencimiento") || q.includes("proxima")) {
        return MOCK_RESPONSES.vencimientos;
    }
    if (q.includes("factus") || q.includes("factur")) {
        return MOCK_RESPONSES.factus;
    }
    if (q.includes("servidor") || q.includes("vps") || q.includes("cpu") || q.includes("ram") || q.includes("coolify") || q.includes("host")) {
        return MOCK_RESPONSES.servidor;
    }
    if (q.includes("actividad") || q.includes("clinica") || q.includes("cita")) {
        return MOCK_RESPONSES.actividad;
    }
    if (q.includes("backup") || q.includes("respaldo") || q.includes("copia")) {
        return MOCK_RESPONSES.backups;
    }

    // Default intelligent response
    return {
        text: `He analizado tu consulta como Superadministrador en el entorno simulado.

*(Modo MOCK — No conectado a producción)*:
La infraestructura de demostración y las clínicas de prueba operan con normalidad.

• Puedes consultar temas de **Vencimientos**, **Factus (Demo)**, **RIPS (Simulado)**, **Servidor (Mock)** o **Backups (Dato MOCK)**.
• Información demostrativa para evaluación de interfaz y experiencia de usuario.
• En la **Fase IA-3** se conectará el modelo LLM definitivo.`,
        tags: ["Dato simulado", "Fase IA-1.1"],
    };
}
