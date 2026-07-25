// src/modules/odontograma/components/OdontogramaVisual.jsx
import React, { useMemo } from "react";
import Diente from "./Diente";
import ToothAnatomy from "./ToothAnatomy";

export default function OdontogramaVisual({
    odontogramaData = {},
    onToothClick,
    dentitionType = 'adult'
}) {
    const range = (start, end) => {
        const arr = [];
        if (start > end) {
            for (let i = start; i >= end; i--) arr.push(i);
        } else {
            for (let i = start; i <= end; i++) arr.push(i);
        }
        return arr;
    };

    // --- ADULTOS ---
    const Q1 = range(18, 11);
    const Q2 = range(21, 28);
    const Q4 = range(48, 41);
    const Q3 = range(31, 38);

    // --- NIÑOS (Deciduos) ---
    const Q5 = range(55, 51);
    const Q6 = range(61, 65);
    const Q8 = range(85, 81);
    const Q7 = range(71, 75);

    // Optimized Bridge Detection
    const hasPuente = (iso) => {
        const data = odontogramaData[iso];
        if (!data) return false;
        // Check if any zone or general has 'puente'
        return Object.values(data).some(v => v.id === 'puente');
    };

    // Render a single tooth stack
    const ToothStack = useMemo(() => {
        return ({ iso, isUpper, hasBridgeLeft, hasBridgeRight }) => {
            return (
                // Increased width from w-16 to w-20 for larger teeth
                <div className="flex flex-col items-center group relative w-20">
                    {/* Bridge Connection Visuals */}
                    {hasBridgeLeft && (
                        <div className="absolute top-1/2 left-0 w-1/2 h-1 bg-indigo-500/80 z-20 -translate-x-1/2" style={{ top: isUpper ? '65%' : '35%' }} />
                    )}
                    {hasBridgeRight && (
                        <div className="absolute top-1/2 right-0 w-1/2 h-1 bg-indigo-500/80 z-20 translate-x-1/2" style={{ top: isUpper ? '65%' : '35%' }} />
                    )}

                    {/* Top: Anatomy (if Upper) or Map (if Lower) */}
                    {isUpper ? (
                        <>
                            <ToothAnatomy numero={iso} />
                            <div className="-mt-4 mb-1 z-10 scale-125"> {/* Increased scale for larger interaction area */}
                                <Diente
                                    numero={iso}
                                    data={odontogramaData[iso]}
                                    onSurfaceClick={onToothClick}
                                />
                            </div>
                            <span className="text-sm font-bold text-slate-500 font-mono mt-1">{iso}</span>
                        </>
                    ) : (
                        <>
                            <span className="text-sm font-bold text-slate-500 font-mono mb-1">{iso}</span>
                            <div className="-mb-4 mt-1 z-10 scale-125">
                                <Diente
                                    numero={iso}
                                    data={odontogramaData[iso]}
                                    onSurfaceClick={onToothClick}
                                />
                            </div>
                            <ToothAnatomy numero={iso} />
                        </>
                    )}
                </div>
            );
        };
    }, [odontogramaData, onToothClick]);

    const renderQuadrant = (dientes, isUpper) => (
        <div className="flex gap-1 md:gap-2 justify-center min-w-max">
            {dientes.map((iso, idx) => {
                const bridgeRight = hasPuente(iso) && idx < dientes.length - 1 && hasPuente(dientes[idx + 1]);
                const bridgeLeft = hasPuente(iso) && idx > 0 && hasPuente(dientes[idx - 1]);

                return (
                    <ToothStack
                        key={iso}
                        iso={iso}
                        isUpper={isUpper}
                        hasBridgeLeft={bridgeLeft}
                        hasBridgeRight={bridgeRight}
                    />
                );
            })}
        </div>
    );

    const showAdult = dentitionType === 'adult' || dentitionType === 'mixed';
    const showChild = dentitionType === 'child' || dentitionType === 'mixed';

    return (
        <div className="flex flex-col gap-10 items-center select-none py-8 min-w-max px-8 bg-white/50 rounded-xl">

            {/* --- UPPER TEETH --- */}
            <div className="flex flex-col items-center gap-4">
                {showAdult && (
                    <div className="flex gap-6 md:gap-12 transition-all duration-300">
                        {renderQuadrant(Q1, true)}
                        {renderQuadrant(Q2, true)}
                    </div>
                )}
                {showChild && (
                    /* Creating a much distinct look for Child Dentition: Larger and closer */
                    <div className={`flex gap-4 md:gap-8 mt-6 p-4 rounded-xl transition-all duration-300 ${dentitionType === 'child' ? 'scale-125 bg-blue-50/30' : 'scale-100 opacity-80'}`}>
                        {renderQuadrant(Q5, true)}
                        {renderQuadrant(Q6, true)}
                    </div>
                )}
            </div>

            {/* --- MID LINE --- */}
            <div className={`w-full h-px bg-slate-200 relative my-8 transition-all duration-300 ${dentitionType === 'child' ? 'scale-125 w-[80%]' : ''}`}>
                <span className="absolute left-1/2 -translate-x-1/2 -top-3 text-[11px] text-slate-400 font-bold bg-white px-3 tracking-[0.2em] border border-slate-200 rounded-full shadow-sm">LÍNEA MEDIA</span>
            </div>

            {/* --- LOWER TEETH --- */}
            <div className="flex flex-col items-center gap-4">
                {showChild && (
                    <div className={`flex gap-10 mb-6 p-4 rounded-xl transition-all duration-300 ${dentitionType === 'child' ? 'scale-125 mb-10 bg-blue-50/30' : 'scale-100 opacity-80'}`}>
                        {renderQuadrant(Q8, false)}
                        {renderQuadrant(Q7, false)}
                    </div>
                )}
                {showAdult && (
                    <div className="flex gap-12 transition-all duration-300">
                        {renderQuadrant(Q4, false)}
                        {renderQuadrant(Q3, false)}
                    </div>
                )}
            </div>

        </div>
    );
}
