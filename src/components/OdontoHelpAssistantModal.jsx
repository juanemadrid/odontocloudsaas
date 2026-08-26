import React, { useState, useRef, useEffect } from "react";
import { 
    FiX, FiSend, FiHelpCircle, FiSearch, FiMessageSquare, 
    FiCheckCircle, FiExternalLink, FiCalendar, FiDollarSign, 
    FiUsers, FiLayers, FiFileText, FiShield, FiMapPin, FiPhoneCall,
    FiCreditCard, FiActivity, FiStar, FiCornerDownRight
} from "react-icons/fi";
import { generateGeminiContent } from "../services/geminiKeyService";

const QUICK_TOPICS = [
    {
        id: "sedes",
        icon: FiMapPin,
        title: "Gestión de Sedes",
        keywords: ["sede", "sucursal", "sucursales", "monteria", "cambiar sede", "crear sede"],
        question: "¿Cómo gestionar o cambiar de Sede / Sucursal?",
        answer: `**Gestión de Sedes y Sucursales en OdontoCloud:**
1. **Cambiar de Sede Activa:** Haz clic en el botón verde de sede en la barra superior (ej: [ATM MONTERÍA]) y elige la sucursal de atención.
2. **Crear o Editar Sedes:** Ingresa a **Configuración > Sucursales y Sedes**. Allí configuras nombre, dirección, ciudad, almacén y sillones.
3. **Historia Clínica Global:** Los pacientes y sus tratamientos están disponibles en todas las sedes automáticamente para garantizar continuidad clínica.`
    },
    {
        id: "pagos",
        icon: FiCreditCard,
        title: "Pagos y Proveedores",
        keywords: ["pago", "pagos", "proveedor", "facturas compra", "egreso", "nuevo pago", "tercero"],
        question: "¿Cómo registrar un pago o egreso a proveedor?",
        answer: `**Registro de Pagos y Egresos a Proveedores:**
1. Ingresa a **Facturación > Pagos** y haz clic en **+ Nuevo pago**.
2. **Banco / Caja:** Selecciona tu caja activa o la cuenta bancaria de donde sale el dinero.
3. **Modos de Pago:**
   - **Pago facturas de compra (Desactivado):** Pulsa **+ Nuevo concepto** para registrar gastos de insumos o servicios libres.
   - **Pago facturas de compra (Activado):** Pulsa **+ Añadir factura** para asociar y liquidar facturas de compra pendientes del proveedor.
4. Presiona **Guardar** para asentar el egreso en caja y generar el comprobante imprimible.`
    },
    {
        id: "caja",
        icon: FiDollarSign,
        title: "Apertura y Cierre de Caja",
        keywords: ["caja", "abrir caja", "cerrar caja", "arqueo", "efectivo", "ingreso", "egreso"],
        question: "¿Cómo abrir, cuadrar o cerrar la Caja diaria?",
        answer: `**Flujo de Caja Diaria:**
1. **Apertura de Caja:** Entra al módulo **Caja** y digita el monto base en efectivo al iniciar turno.
2. **Registro Automático:** Cada cobro a paciente y pago a proveedor se descuenta o suma en tiempo real a tu caja activa.
3. **Cierre y Arqueo:** Al finalizar el día, digita el conteo físico de dinero. OdontoCloud calcula diferencias o cuadre exacto y emite el acta de arqueo.`
    },
    {
        id: "citas",
        icon: FiCalendar,
        title: "Agenda de Citas",
        keywords: ["cita", "agenda", "agendar", "cancelar cita", "doctor", "calendario", "turno"],
        question: "¿Cómo agendar y gestionar citas odontológicas?",
        answer: `**Gestión de la Agenda:**
1. Ve a **Agenda**.
2. Haz clic sobre el horario y sillón deseado.
3. Busca al paciente por nombre o documento, asigna el profesional y procedimiento.
4. Guarda la cita y envía confirmación por WhatsApp en 1 clic.`
    },
    {
        id: "facturacion",
        icon: FiFileText,
        title: "Facturación DIAN",
        keywords: ["factura", "factura electronica", "dian", "factus", "resolucion", "cufe"],
        question: "¿Cómo emitir Factura Electrónica DIAN?",
        answer: `**Facturación Electrónica DIAN:**
1. En **Facturación > Factura de Venta**, selecciona el paciente y los tratamientos liquidados.
2. Presiona **Emitir Factura Electrónica**. El sistema se enlaza a la DIAN vía Factus.
3. Se genera el código **CUFE**, QR y se despacha la factura oficial en PDF al correo del paciente.`
    },
    {
        id: "odontograma",
        icon: FiActivity,
        title: "Odontograma y Evolución",
        keywords: ["odontograma", "diente", "caries", "tratamiento", "evolucion", "historia clinica"],
        question: "¿Cómo registrar Odontograma y Evoluciones?",
        answer: `**Odontograma & Evoluciones Clínicas:**
1. Entra a la ficha del paciente y haz clic en la pestaña **Odontograma**.
2. Selecciona la superficie o pieza dental (Adulto o Infantil) y asigna el hallazgo clínico (Caries, Resina, Corona, Extracción, etc.).
3. En **Evolución**, escribe el resumen de la cita y guarda con tu firma digital del perfil.`
    }
];

// Helper para renderizar texto enriquecido sin asteriscos markdown sin procesar
function FormattedMessage({ text }) {
    if (!text) return null;

    const lines = text.split("\n");

    return (
        <div className="space-y-2 text-xs leading-relaxed">
            {lines.map((line, idx) => {
                const trimmed = line.trim();
                if (!trimmed) return <div key={idx} className="h-1" />;

                // 1. Títulos en negrita (ej: **Título:**)
                if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
                    const cleanTitle = trimmed.replace(/\*\*/g, "");
                    return (
                        <div key={idx} className="font-bold text-slate-900 text-[13px] pt-1 pb-0.5 flex items-center gap-1.5 border-b border-slate-100">
                            <FiCheckCircle className="text-[#8dc63f] shrink-0" size={14} />
                            <span>{cleanTitle}</span>
                        </div>
                    );
                }

                // 2. Pasos numerados (ej: 1. **Paso:** detalle)
                const stepMatch = trimmed.match(/^(\d+)\.\s*(.*)$/);
                if (stepMatch) {
                    const stepNum = stepMatch[1];
                    let stepContent = stepMatch[2];

                    // Formatear negritas y etiquetas internas
                    const parts = stepContent.split(/(\*\*.*?\*\*|\[.*?\]|\`.*?\`)/g);

                    return (
                        <div key={idx} className="flex items-start gap-2 pt-1 pl-1">
                            <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                                {stepNum}
                            </span>
                            <div className="flex-1 text-slate-700">
                                {parts.map((p, pIdx) => {
                                    if (p.startsWith("**") && p.endsWith("**")) {
                                        return <strong key={pIdx} className="font-bold text-slate-900">{p.replace(/\*\*/g, "")} </strong>;
                                    }
                                    if (p.startsWith("[") && p.endsWith("]")) {
                                        return <span key={pIdx} className="px-1.5 py-0.5 bg-[#8dc63f]/20 text-[#608d20] font-bold rounded-md mx-0.5">{p.slice(1, -1)}</span>;
                                    }
                                    if (p.startsWith("`") && p.endsWith("`")) {
                                        return <code key={pIdx} className="px-1 py-0.5 bg-slate-100 text-blue-600 font-mono rounded text-[11px]">{p.slice(1, -1)}</code>;
                                    }
                                    return <span key={pIdx}>{p}</span>;
                                })}
                            </div>
                        </div>
                    );
                }

                // 3. Viñetas (ej: - Subpaso)
                if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
                    const bulletContent = trimmed.substring(2);
                    const parts = bulletContent.split(/(\*\*.*?\*\*|\[.*?\]|\`.*?\`)/g);

                    return (
                        <div key={idx} className="flex items-start gap-2 pl-6 pt-0.5">
                            <FiCornerDownRight className="text-slate-400 shrink-0 mt-1" size={11} />
                            <div className="flex-1 text-slate-600">
                                {parts.map((p, pIdx) => {
                                    if (p.startsWith("**") && p.endsWith("**")) {
                                        return <strong key={pIdx} className="font-semibold text-slate-800">{p.replace(/\*\*/g, "")} </strong>;
                                    }
                                    if (p.startsWith("[") && p.endsWith("]")) {
                                        return <span key={pIdx} className="px-1.5 py-0.5 bg-slate-100 text-slate-800 font-bold rounded-md mx-0.5">{p.slice(1, -1)}</span>;
                                    }
                                    return <span key={pIdx}>{p}</span>;
                                })}
                            </div>
                        </div>
                    );
                }

                // 4. Texto estándar con negritas
                const parts = trimmed.split(/(\*\*.*?\*\*|\[.*?\]|\`.*?\`)/g);
                return (
                    <p key={idx} className="text-slate-700">
                        {parts.map((p, pIdx) => {
                            if (p.startsWith("**") && p.endsWith("**")) {
                                return <strong key={pIdx} className="font-bold text-slate-900">{p.replace(/\*\*/g, "")}</strong>;
                            }
                            if (p.startsWith("[") && p.endsWith("]")) {
                                return <span key={pIdx} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 font-bold rounded-md">{p.slice(1, -1)}</span>;
                            }
                            return <span key={pIdx}>{p}</span>;
                        })}
                    </p>
                );
            })}
        </div>
    );
}

export default function OdontoHelpAssistantModal({ isOpen, onClose }) {
    const [messages, setMessages] = useState([
        {
            id: 1,
            sender: "bot",
            text: "👋 ¡Hola! Soy **OdontoIA**, tu asistente inteligente para OdontoCloud.\n\nSelecciona un tema frecuente o escribe cualquier duda sobre el sistema para guiarte paso a paso."
        }
    ]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isOpen]);

    if (!isOpen) return null;

    const findKnowledgeAnswer = (query) => {
        const q = query.toLowerCase();
        let bestMatch = null;
        let highestScore = 0;

        for (const item of QUICK_TOPICS) {
            let score = 0;
            for (const kw of item.keywords) {
                if (q.includes(kw)) score += 2;
            }
            if (score > highestScore) {
                highestScore = score;
                bestMatch = item;
            }
        }

        return highestScore >= 2 ? bestMatch.answer : null;
    };

    const handleSend = async (userQuery) => {
        const queryText = (userQuery || input).trim();
        if (!queryText) return;

        const userMsg = { id: Date.now(), sender: "user", text: queryText };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setIsTyping(true);

        // 1. Base de conocimiento local exacta
        const localAnswer = findKnowledgeAnswer(queryText);

        if (localAnswer) {
            setTimeout(() => {
                setMessages(prev => [
                    ...prev,
                    { id: Date.now() + 1, sender: "bot", text: localAnswer }
                ]);
                setIsTyping(false);
            }, 300);
            return;
        }

        // 2. Consulta IA Gemini contextualizada
        try {
            const systemPrompt = `Eres OdontoIA, el copiloto inteligente del software dental OdontoCloud en Colombia.
Tu trabajo es responder dudas de doctores, recepcionistas y administradores con explicaciones claras, pasos numerados y lenguaje amable.
Módulos principales: Agenda de citas, Historias Clínicas, Odontograma interactivo, Facturación DIAN (Factus), Pagos y Egresos, Múltiples Sedes/Sucursales, Caja diaria.
Pregunta del usuario: "${queryText}".
Responde estructuradamente con pasos numerados. Evita explicaciones complejas innecesarias.`;

            const aiResponse = await generateGeminiContent(
                [{ parts: [{ text: systemPrompt }] }],
                { temperature: 0.2, maxOutputTokens: 500 },
                "gemini-2.5-flash"
            );

            const botText = aiResponse?.candidates?.[0]?.content?.parts?.[0]?.text || 
                "Para este procedimiento, puedes ingresar directamente al módulo desde la barra lateral o presionar el botón inferior de WhatsApp para soporte con un asesor.";

            setMessages(prev => [
                ...prev,
                { id: Date.now() + 1, sender: "bot", text: botText }
            ]);
        } catch (e) {
            console.warn("AI error fallback:", e);
            setMessages(prev => [
                ...prev,
                { 
                    id: Date.now() + 1, 
                    sender: "bot", 
                    text: "**Guía del Sistema:**\nPuedes navegar directamente al módulo correspondiente en el menú lateral o comunicarte con nuestro equipo de soporte por WhatsApp." 
                }
            ]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden animate-scaleIn flex flex-col h-[640px] max-h-[92vh]">
                
                {/* Header Asistente IA */}
                <div className="px-5 py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-lg shadow-xs">
                            🤖
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xs font-bold uppercase tracking-wider">Asistente OdontoIA</h2>
                                <span className="px-2 py-0.5 bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 rounded-full text-[9px] font-black uppercase">
                                    En línea
                                </span>
                            </div>
                            <p className="text-[10px] text-blue-100">Centro de ayuda & guía inteligente del sistema</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                    >
                        <FiX size={18} />
                    </button>
                </div>

                {/* Quick Topics Grid Elegante (Sin scrollbar rota) */}
                <div className="p-3 bg-slate-50 border-b border-slate-100">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <FiStar className="text-amber-500" size={12} />
                        <span>Temas rápidos de ayuda:</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {QUICK_TOPICS.map(item => {
                            const IconComponent = item.icon;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleSend(item.question)}
                                    className="p-2 bg-white hover:bg-blue-50 border border-slate-200/80 hover:border-blue-300 rounded-xl text-left transition-all shadow-2xs group cursor-pointer active:scale-95 flex items-center gap-2"
                                >
                                    <div className="w-6 h-6 rounded-lg bg-blue-50 group-hover:bg-blue-600 group-hover:text-white text-blue-600 flex items-center justify-center shrink-0 transition-colors">
                                        <IconComponent size={12} />
                                    </div>
                                    <span className="text-[11px] font-bold text-slate-700 group-hover:text-blue-700 truncate">
                                        {item.title}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Chat Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#f8fafc] text-xs custom-scrollbar">
                    {messages.map((m) => (
                        <div
                            key={m.id}
                            className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
                        >
                            <div
                                className={`max-w-[88%] p-3.5 rounded-2xl shadow-xs ${
                                    m.sender === "user"
                                        ? "bg-blue-600 text-white rounded-br-xs font-semibold"
                                        : "bg-white text-slate-800 rounded-bl-xs border border-slate-200/80 shadow-sm"
                                }`}
                            >
                                {m.sender === "user" ? (
                                    <p className="whitespace-pre-wrap">{m.text}</p>
                                ) : (
                                    <FormattedMessage text={m.text} />
                                )}
                            </div>
                        </div>
                    ))}

                    {isTyping && (
                        <div className="flex justify-start">
                            <div className="bg-white border border-slate-200 px-4 py-2.5 rounded-2xl rounded-bl-xs text-slate-400 text-xs flex items-center gap-2 shadow-xs">
                                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce" />
                                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:0.2s]" />
                                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:0.4s]" />
                                <span className="text-[11px] text-slate-500 font-medium">OdontoIA está buscando la respuesta...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Footer Input + WhatsApp Direct Advisor */}
                <div className="p-3 bg-white border-t border-slate-100 space-y-2">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSend();
                        }}
                        className="flex items-center gap-2"
                    >
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Escribe tu duda sobre el sistema (ej. ¿Cómo crear una cita?)..."
                            className="flex-1 h-9 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isTyping}
                            className="h-9 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
                        >
                            <FiSend size={13} />
                        </button>
                    </form>

                    {/* Botón WhatsApp de Asesor Humano */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100/80 px-1">
                        <span className="text-[10px] text-slate-400 font-medium">
                            ¿Prefieres atención personalizada?
                        </span>
                        <a
                            href="https://wa.me/573103583706?text=Hola,%20necesito%20asistencia%20en%20el%20sistema%20OdontoCloud"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 hover:underline cursor-pointer"
                        >
                            <span>💬 Contactar Asesor por WhatsApp</span>
                            <FiExternalLink size={10} />
                        </a>
                    </div>
                </div>

            </div>
        </div>
    );
}
