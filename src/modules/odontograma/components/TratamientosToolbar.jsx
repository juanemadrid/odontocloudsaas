// src/modules/odontograma/components/TratamientosToolbar.jsx
// Catálogo clínico completo 1:1 con OralDrive — 35 diagnósticos clínicos

import React from 'react';

// Iconos SVG Clínicos
const IconCaries = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full drop-shadow-sm"><circle cx="12" cy="12" r="8"/></svg>;
const IconSano = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="w-full h-full" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>;
const IconFractura = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><polyline points="4 2 8 8 5 13 10 18 8 22"></polyline></svg>;
const IconCorona = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" className="w-full h-full"><path d="M3 13C3 13 5 3 12 3C19 3 21 13 21 13C21 13 18 16 12 16C6 16 3 13 3 13Z" /></svg>;
const IconCoronaDes = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="3 2" strokeLinejoin="round" className="w-full h-full"><path d="M3 13C3 13 5 3 12 3C19 3 21 13 21 13C21 13 18 16 12 16C6 16 3 13 3 13Z" /></svg>;
const IconCarilla = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M4 6C4 6 12 3 20 6C20 14 16 20 12 21C8 20 4 14 4 6Z" opacity="0.8"/></svg>;
const IconPerno = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M10 2L14 2L13 18L11 18Z"/><path d="M8 18L16 18L15 22L9 22Z"/></svg>;
const IconAusente = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="w-full h-full" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;
const IconEndo = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full" strokeLinecap="round"><line x1="12" y1="2" x2="12" y2="22"></line><line x1="8" y1="4" x2="8" y2="18"></line><line x1="16" y1="4" x2="16" y2="18"></line></svg>;
const IconImplante = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M8 2H16V5H8V2ZM9 6H15V8H9V6ZM7 9H17V11H7V9ZM9 12H15V14H9V12ZM8 15H16V17H8V15ZM10 18H14V22H10V18Z" /></svg>;
const IconAmalgama = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><circle cx="12" cy="12" r="7"/></svg>;
const IconAmalgamaDes = () => <svg viewBox="0 0 24 24" fill="currentColor" stroke="#EF4444" strokeWidth="2.5" strokeDasharray="3 1.5" className="w-full h-full"><circle cx="12" cy="12" r="6.5"/></svg>;
const IconSellante = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><path d="M3 12 Q 8 2 12 12 T 21 12"/></svg>;
const IconStar = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z" /></svg>;
const IconWedge = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><polygon points="3,18 21,18 12,6"/></svg>;
const IconArrowUp = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>;
const IconPontico = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><rect x="3" y="8" width="18" height="8" rx="3"/></svg>;
const IconProvisional = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><rect x="4" y="6" width="16" height="12" rx="2"/></svg>;
const IconRoot = () => <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M8 4L12 20L16 4Z"/></svg>;
const IconLesionApical = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-full h-full"><circle cx="12" cy="18" r="4" fill="currentColor"/><line x1="12" y1="4" x2="12" y2="14"/></svg>;

export const TOOLS = [
    // ── COLUMNA 1 (OralDrive) ────────────────────────────────────────────────
    { id: "abfraccion",         label: "Abfracción",                 color: "#F59E0B", icon: <IconWedge /> },
    { id: "abrasion_cervical",  label: "Abrasión cervical",          color: "#D97706", icon: <IconWedge /> },
    { id: "amalgama_ok",        label: "Amalgama adaptada",          color: "#2563EB", icon: <IconAmalgama /> },
    { id: "amalgama_des",       label: "Amalgama desadaptada",       color: "#2563EB", icon: <IconAmalgamaDes /> },
    { id: "caries",             label: "Caries",                     color: "#EF4444", icon: <IconCaries /> },
    { id: "carilla_adap",       label: "Carilla adaptada",           color: "#3B82F6", icon: <IconCarilla /> },
    { id: "carilla_des",        label: "Carilla desadaptada",        color: "#EF4444", icon: <IconCarilla /> },
    { id: "corona_buena",       label: "Corona adaptada",            color: "#3B82F6", icon: <IconCorona /> },
    { id: "corona_des",         label: "Corona desadaptada",         color: "#EF4444", icon: <IconCoronaDes /> },

    // ── COLUMNA 2 (OralDrive) ────────────────────────────────────────────────
    { id: "ausente",            label: "Diente ausente",             color: "#94A3B8", icon: <IconAusente /> },
    { id: "diente_incluido",    label: "Diente incluido",            color: "#6366F1", icon: <IconArrowUp /> },
    { id: "diente_parcial_erup",label: "Diente parcial. erup.",      color: "#8B5CF6", icon: <IconArrowUp /> },
    { id: "diente_sano",        label: "Diente sano",                color: "#10B981", icon: <IconSano /> },
    { id: "diente_sin_erup",    label: "Diente sin erupcionar",      color: "#EC4899", icon: <IconAusente /> },
    { id: "endodoncia_buena",   label: "Endodoncia buena",           color: "#3B82F6", icon: <IconEndo /> },
    { id: "endodoncia_indicada",label: "Endodoncia indicada",        color: "#F97316", icon: <IconEndo /> },
    { id: "endodoncia_mala",    label: "Endodoncia mala",            color: "#EF4444", icon: <IconEndo /> },
    { id: "erosion_cervical",   label: "Erosión cervical",           color: "#E11D48", icon: <IconWedge /> },

    // ── COLUMNA 3 (OralDrive) ────────────────────────────────────────────────
    { id: "extraccion",         label: "Extracción indicada",        color: "#DC2626", icon: <IconAusente /> },
    { id: "fractura",           label: "Fractura",                   color: "#EF4444", icon: <IconFractura /> },
    { id: "implante_bueno",     label: "Implante adaptado",          color: "#3B82F6", icon: <IconImplante /> },
    { id: "implante_malo",      label: "Implante desadaptado",       color: "#E11D48", icon: <IconImplante /> },
    { id: "lesion_apical",      label: "Lesión apical",              color: "#B91C1C", icon: <IconLesionApical /> },
    { id: "mancha",             label: "Mancha",                     color: "#A16207", icon: <IconCaries /> },
    { id: "otras",              label: "Otros",                      color: "#94A3B8", icon: <IconStar /> },
    { id: "perno_bueno",        label: "Ret. intrarradicular adap.", color: "#3B82F6", icon: <IconPerno /> },
    { id: "perno_malo",         label: "Ret. intrarradicular des.",  color: "#E11D48", icon: <IconPerno /> },

    // ── COLUMNA 4 (OralDrive) ────────────────────────────────────────────────
    { id: "pontico",            label: "Póntico",                    color: "#EAB308", icon: <IconPontico /> },
    { id: "provisional_adap",   label: "Provisional adaptado",       color: "#3B82F6", icon: <IconProvisional /> },
    { id: "provisional_des",    label: "Provisional desadaptado",    color: "#EF4444", icon: <IconProvisional /> },
    { id: "rest_adaptado",      label: "Rest. adaptada",             color: "#10B981", icon: <IconAmalgama /> },
    { id: "rest_desadaptado",   label: "Rest. desadaptada",          color: "#EF4444", icon: <IconAmalgamaDes /> },
    { id: "resto_radicular",    label: "Resto radicular",            color: "#78716C", icon: <IconRoot /> },
    { id: "sellante_bueno",     label: "Sellante adaptado",          color: "#10B981", icon: <IconSellante /> },
    { id: "sellante_des",       label: "Sellante desadaptado",       color: "#EF4444", icon: <IconSellante /> },

    // Borrador
    { id: "borrador",           label: "Borrador General",           color: "#CBD5E1", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H7L3 16C2 15 2 13 3 12L13 2C14 1 16 1 17 2L21 6C22 7 22 9 21 10L11 20" /><path d="m17 2 4 4" /></svg> },
];

// Herramientas que aplican exclusivamente a toda la pieza dental (bloquean caras)
export const GENERAL_TOOLS = [
    "ausente",
    "diente_incluido",
    "diente_parcial_erup",
    "diente_sano",
    "diente_sin_erup",
    "endodoncia_buena",
    "endodoncia_indicada",
    "endodoncia_mala",
    "extraccion",
    "fractura",
    "implante_bueno",
    "implante_malo",
    "lesion_apical",
    "perno_bueno",
    "perno_malo",
    "corona_buena",
    "corona_des",
    "carilla_adap",
    "carilla_des",
    "pontico",
    "provisional_adap",
    "provisional_des",
    "resto_radicular"
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
    return null;
}
