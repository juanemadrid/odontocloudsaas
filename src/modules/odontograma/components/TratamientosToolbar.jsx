// src/modules/odontograma/components/TratamientosToolbar.jsx
// Lista completa de diagnósticos clínicos — igual que OralDrive
// Iconos SVG Clínicos (Estilo Médico Orgánico/Realista)
// Caries: Mancha irregular (blob) semi-transparente roja.
const IconCaries = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full drop-shadow-sm"><path d="M12.9 4.3C15 4.8 17 6 18.5 7.8C19.7 9.4 20 11.5 19.4 13.5C18.8 15.6 17 17.5 14.8 18.3C12.5 19.3 10 18.8 8 17.5C5.8 16.1 4.5 13.7 4 11.2C3.5 8.7 4.2 6 6.1 4.3C8.1 2.5 10.7 2.3 12.9 4.3Z" opacity="0.9"/></svg>;

// Sano: Marca de check médico.
const IconSano = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="w-full h-full" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>;

// Fractura: Línea diagonal en zigzag simulando una rotura o fisura del esmalte.
const IconFractura = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><polyline points="4 2 8 8 5 13 10 18 8 22"></polyline></svg>;

// Corona: Un contorno grueso que recubre la parte de arriba
const IconCorona = () => <svg viewBox="0 0 24 24" fill="transparent" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" className="w-full h-full"><path d="M3 13C3 13 5 3 12 3C19 3 21 13 21 13C21 13 18 16 12 16C6 16 3 13 3 13Z" /></svg>;

// Perno/Núcleo: Un poste cónico que va hacia la raíz
const IconPerno = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M10 2L14 2L13 18L11 18Z"/><path d="M8 18L16 18L15 22L9 22Z"/></svg>;

// Ausente/Extracción: Cruz gigante o X indicadora
const IconAusente = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="w-full h-full" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;

// Endodoncia: Tres líneas delgadas (simulando los conductos radiculares)
const IconEndo = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full" strokeLinecap="round"><line x1="12" y1="2" x2="12" y2="22"></line><line x1="8" y1="4" x2="8" y2="18"></line><line x1="16" y1="4" x2="16" y2="18"></line></svg>;

// Implante: Tornillo intraóseo
const IconImplante = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M8 2H16V5H8V2ZM9 6H15V8H9V6ZM7 9H17V11H7V9ZM9 12H15V14H9V12ZM8 15H16V17H8V15ZM10 18H14V22H10V18Z" /></svg>;

// Amalgama (Plomba): Mancha metálica irregular más densa que la caries.
const IconAmalgama = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full opacity-90"><path d="M12 2C16 2 18 5 21 8C22.5 9.5 21 14 19 16C16.5 18.5 13 21 9 20C4.5 18.8 2 13.5 3 9C4 5 7.5 2 12 2Z"/></svg>;

// Amalgama Desadaptada: Mancha metálica pero con borde punteado rojo (lo manejaremos con CSS o color dual si tuviéramos)
const IconAmalgamaDesadaptada = () => <svg viewBox="0 0 24 24" fill="currentColor" stroke="#EF4444" strokeWidth="2" strokeDasharray="2" className="w-full h-full opacity-90"><path d="M12 2C16 2 18 5 21 8C22.5 9.5 21 14 19 16C16.5 18.5 13 21 9 20C4.5 18.8 2 13.5 3 9C4 5 7.5 2 12 2Z"/></svg>;

// Sellante: Una resina fluida delineando las fosas de oclusal (línea sinuosa)
const IconSellante = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full opacity-80"><path d="M3 12 Q 8 2 12 12 T 21 12"/></svg>;

// Otros/Genérico: Estrella
const IconStar = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z" /></svg>;

export const TOOLS = [
    // Col 1
    { id: "caries",              label: "Caries",                    color: "#EF4444", icon: <IconCaries /> },
    { id: "amalgama_des",        label: "Amalgama desadaptada",       color: "#3B82F6", icon: <IconAmalgamaDesadaptada /> }, // Blue inside, Red border
    { id: "fractura",            label: "Fractura",                  color: "#EF4444", icon: <IconFractura /> },
    { id: "corona_buena",        label: "Corona buena",              color: "#3B82F6", icon: <IconCorona /> },
    { id: "perno_bueno",         label: "Perno bueno",               color: "#3B82F6", icon: <IconPerno /> },
    { id: "plomba",              label: "Plomba",                    color: "#8B5CF6", icon: <IconAmalgama /> },
    // Col 2
    { id: "rest_adaptado",       label: "Rest. adaptado",            color: "#22C55E", icon: <IconAmalgama /> },
    { id: "diente_sano",         label: "Diente sano",               color: "#10B981", icon: <IconSano /> },
    { id: "corona_des",          label: "Corona desadaptada",        color: "#EF4444", icon: <IconCorona /> },
    { id: "ausente",             label: "Diente ausente",            color: "#EF4444", icon: <IconAusente /> },
    { id: "perno_malo",          label: "Perno malo",                color: "#F43F5E", icon: <IconPerno /> },
    { id: "otras",               label: "Otras",                     color: "#94A3B8", icon: <IconStar /> },
    // Col 3
    { id: "rest_desadaptado",    label: "Rest. desadaptado",         color: "#EF4444", icon: <IconAmalgamaDesadaptada /> },
    { id: "sellante_bueno",      label: "Sellante bueno",            color: "#10B981", icon: <IconSellante /> },
    { id: "endodoncia_buena",    label: "Endodoncia buena",          color: "#3B82F6", icon: <IconEndo /> },
    { id: "extraccion",          label: "Extracción indicada",       color: "#DC2626", icon: <IconAusente /> },
    { id: "implante_bueno",      label: "Implante bueno",            color: "#3B82F6", icon: <IconImplante /> },
    // Col 4
    { id: "amalgama_ok",         label: "Amalgama adaptada",         color: "#3B82F6", icon: <IconAmalgama /> },
    { id: "sellante_des",        label: "Sellante desadaptado",      color: "#EF4444", icon: <IconSellante /> },
    { id: "endodoncia_mala",     label: "Endodoncia mala",           color: "#EF4444", icon: <IconEndo /> },
    { id: "implante_malo",       label: "Implante malo",             color: "#E11D48", icon: <IconImplante /> },
    // Borrador (especial)
    { id: "borrador",            label: "Borrador",                  color: "#CBD5E1", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H7L3 16C2 15 2 13 3 12L13 2C14 1 16 1 17 2L21 6C22 7 22 9 21 10L11 20" /><path d="m17 2 4 4" /></svg> },
];

export const SURFACES = [
    { id: "todas",     label: "Todas las superficies" },
    { id: "vestibular",label: "Vestibular" },
    { id: "oclusal",   label: "Oclusal/Incisal" },
    { id: "lingual",   label: "Lingual/Palatino" },
    { id: "mesial",    label: "Mesial" },
    { id: "distal",    label: "Distal" },
];

export default function TratamientosToolbar({ selected, onSelect }) {
    return null; // Ahora el grid se renderiza directamente en Odontograma.jsx
}
