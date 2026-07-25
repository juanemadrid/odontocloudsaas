import React from 'react';
import { getToothTypeByIso } from '../utils/ToothAnatomyPaths';

// Mapa de rutas a las imágenes precargadas
const TOOTH_IMAGES = {
    molar: '/images/teeth/molar.png',
    premolar: '/images/teeth/premolar.png',
    canine: '/images/teeth/canine.png',
    incisor: '/images/teeth/incisor.png'
};

const ZONES = [
    { id: 'top', label: 'Vestibular', position: { top: '5%', left: '25%', width: '50%', height: '25%' } },
    { id: 'bottom', label: 'Lingual/Palatino', position: { bottom: '5%', left: '25%', width: '50%', height: '25%' } },
    { id: 'left', label: 'Mesial', position: { top: '25%', left: '5%', width: '25%', height: '50%' } },
    { id: 'right', label: 'Distal', position: { top: '25%', right: '5%', width: '25%', height: '50%' } },
    { id: 'center', label: 'Oclusal/Incisal', position: { top: '35%', left: '35%', width: '30%', height: '30%', borderRadius: '50%' } }
];

export default function SurfaceSelector3D({ activeToothId, toothData, onZoneClick, isReadOnly }) {
    if (!activeToothId) {
        return (
            <div className="flex items-center justify-center h-[200px] w-full bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                <div className="text-center">
                    <div className="text-4xl text-slate-300 mb-2">🦷</div>
                    <div className="text-[12px] font-black text-slate-400 uppercase tracking-widest">
                        Selecciona un diente<br/>en el odontograma
                    </div>
                </div>
            </div>
        );
    }

    const type = getToothTypeByIso(activeToothId);
    const imageUrl = TOOTH_IMAGES[type] || TOOTH_IMAGES.molar;
    
    // Si el diente completo tiene una corona o está ausente, mostramos un efecto por defecto en la previsualización
    const isAusente = toothData?.general?.id?.includes('ausente') || toothData?.general?.id?.includes('extraccion');
    const isCorona = toothData?.general?.id?.includes('corona') || toothData?.general?.id?.includes('provisional');

    return (
        <div className="flex gap-8 items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            {/* Contenedor Visual 3D */}
            <div className="relative w-[160px] h-[160px] bg-slate-50 rounded-2xl p-4 flex-shrink-0 shadow-inner">
                {/* Imagen Base */}
                <img 
                    src={imageUrl} 
                    alt={`Diente ${activeToothId}`}
                    className="w-full h-full object-contain drop-shadow-md transition-all duration-300"
                    style={{
                        filter: isAusente ? 'grayscale(1) opacity(0.3)' : 'none'
                    }}
                />

                {/* Si tiene corona, pintamos todo el selector suavemente */}
                {isCorona && (
                    <div 
                        className="absolute inset-0 m-4 bg-indigo-500/20 mix-blend-multiply rounded-2xl pointer-events-none transition-all"
                        style={{ backgroundColor: toothData?.general?.color + '40' }}
                    />
                )}

                {/* Zonas Interactivas Oclusales/Vestibulares */}
                {!isAusente && ZONES.map(zone => {
                    const finding = toothData?.[zone.id];
                    const hasFinding = !!finding && !!finding.color;
                    const isCaries = finding?.id?.includes("caries");

                    return (
                        <button
                            key={zone.id}
                            disabled={isReadOnly}
                            onClick={() => onZoneClick(activeToothId, zone.id)}
                            className="absolute group transition-all duration-300"
                            style={{
                                ...zone.position,
                                // Forma del botón orgánico para la superficie
                                borderRadius: zone.borderRadius || '30%',
                            }}
                        >
                            {/* Hitbox visual y de hover */}
                            <div className={`w-full h-full transition-all duration-300 ${
                                isReadOnly ? '' : 'cursor-pointer hover:bg-slate-300/30 hover:backdrop-blur-[2px] border-2 border-transparent hover:border-slate-400 border-dashed rounded-[30%]'
                            }`} />

                            {/* Mostrar Hallazgo sobre la zona */}
                            {hasFinding && (
                                <div 
                                    className="absolute inset-0 m-auto transition-transform scale-in"
                                    style={{
                                        width: '80%', height: '80%',
                                        backgroundColor: finding.color,
                                        borderRadius: '50%',
                                        opacity: isCaries ? 0.85 : 0.95,
                                        filter: isCaries ? 'blur(6px)' : 'blur(2px)',
                                        mixBlendMode: 'multiply',
                                        boxShadow: isCaries ? 'none' : `0 0 10px ${finding.color}`
                                    }}
                                />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Metadatos del Diente y Botones Rápidos */}
            <div className="flex-1 min-w-0">
                <div className="bg-indigo-600 text-white w-min px-3 py-1 rounded-full text-[10px] font-black tracking-widest mb-2">
                    PIEZA {activeToothId}
                </div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-4">
                    Inspector Anatómico
                </h3>
                
                <div className="grid grid-cols-2 gap-2">
                    {ZONES.map(zone => (
                        <button
                            key={'btn-'+zone.id}
                            disabled={isReadOnly}
                            onClick={() => onZoneClick(activeToothId, zone.id)}
                            className={`px-3 py-2 text-left rounded-xl text-[11px] font-bold transition-all border ${
                                toothData?.[zone.id] 
                                    ? 'bg-slate-800 text-white border-slate-800' 
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: toothData?.[zone.id]?.color || '#cbd5e1' }} />
                                {zone.label}
                            </span>
                        </button>
                    ))}
                    
                    {/* Botón para aplicar hallazgo a TODA LA PIEZA */}
                    <button
                        disabled={isReadOnly}
                        onClick={() => onZoneClick(activeToothId, "Completo")}
                        className="col-span-2 mt-2 px-3 py-2 text-center rounded-xl text-[11px] font-black uppercase tracking-widest transition-all bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200"
                    >
                        Seleccionar Pieza Completa
                    </button>
                </div>
            </div>
        </div>
    );
}
