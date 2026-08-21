import React from 'react';
import InteractiveTooth from './InteractiveTooth';
import { DENTITION_ROWS, getDentitionVisibility } from '../utils/odontogramInteraction.mjs';

// Ancho de cada slot de diente — mismo valor para el selector circular y la imagen
// 2.5vw = 32px @ 1284px viewport, 40px @ 1600px  → encaja sin overflow
const SLOT_W = 'clamp(18px, 2.5vw, 40px)';

export default function OdontogramaVisual({ 
    odontogramaData, 
    onToothClick, 
    tipoDenticion = 'completo', 
    activeToothId, 
    surfaceFilter 
}) {
    const { showPermanent, showTemporary } = getDentitionVisibility(tipoDenticion);

    const renderRow = (teethArray) => {
        const halfLen = Math.floor(teethArray.length / 2);
        return (
            <div className="flex justify-center flex-nowrap my-1 px-1 w-full max-w-full"
                 style={{ gap: '1px' }}>
                {teethArray.map((toothNum, idx) => {
                    const isCenterGap = idx === halfLen && teethArray.length % 2 === 0;
                    return (
                        <React.Fragment key={toothNum}>
                            {/* Brecha central (separación entre hemiarcadas) */}
                            {isCenterGap && (
                                <div style={{ width: '10px', flexShrink: 0 }} />
                            )}

                            {/* Slot del diente — ancho fijo vw */}
                            <div style={{ width: SLOT_W, flexShrink: 0 }}>
                                <InteractiveTooth 
                                    numero={String(toothNum)}
                                    data={odontogramaData[String(toothNum)] || {}}
                                    onZoneClick={onToothClick}
                                    isReadOnly={!onToothClick}
                                    activeToothId={activeToothId}
                                />
                            </div>
                        </React.Fragment>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="w-full h-auto min-h-[360px] bg-white pb-6 overflow-x-auto">
            <div className="flex flex-col items-center mx-auto p-1 lg:p-2 w-full min-w-fit">

                {/* Arcada Superior */}
                <div className="flex flex-col items-center w-full">
                    {showPermanent && renderRow(DENTITION_ROWS.upperPermanent)}
                    {showTemporary && renderRow(DENTITION_ROWS.upperTemporary)}
                </div>

                {/* Plano oclusal */}
                <div className="w-full flex items-center gap-2 my-1 px-4">
                    <div className="flex-1 border-t border-dashed border-slate-200" />
                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest whitespace-nowrap">
                        Plano oclusal
                    </span>
                    <div className="flex-1 border-t border-dashed border-slate-200" />
                </div>

                {/* Arcada Inferior */}
                <div className="flex flex-col items-center w-full">
                    {showTemporary && renderRow(DENTITION_ROWS.lowerTemporary)}
                    {showPermanent && renderRow(DENTITION_ROWS.lowerPermanent)}
                </div>

            </div>
        </div>
    );
}
