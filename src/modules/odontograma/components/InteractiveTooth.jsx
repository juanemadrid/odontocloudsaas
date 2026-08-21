import React from 'react';
import CircularSurfaceSelector from './CircularSurfaceSelector';
import ToothSVGInline from './ToothSVGInline';
import GeneralToothMark from './GeneralToothMark';

export default function InteractiveTooth({ 
    numero, 
    data = {}, 
    onZoneClick, 
    isReadOnly,
    activeToothId
}) {
    const num = parseInt(numero, 10);
    const isUpper = (num >= 11 && num <= 28) || (num >= 51 && num <= 65);
    const isRightSide = (num >= 11 && num <= 18) || (num >= 41 && num <= 48) || (num >= 51 && num <= 55) || (num >= 81 && num <= 85);
    const isActive = activeToothId === String(numero);

    // Estado general del diente
    const g = data?.general?.id;
    const isAusente   = g === 'ausente';
    const isImplante  = g?.includes('implante');

    const toothOpacity = isAusente ? 0.16 : isImplante ? 0.24 : 1;

    // ─── Contenedor del diente ────────────────────────────────────────────────
    // isUpper → scaleY(-1): los sprites tienen corona abajo; para arcada
    // superior la corona debe apuntar hacia el plano oclusal (hacia abajo) —
    // igual que hacía el componente original ToothAnatomy.jsx
    const toothContainer = (flipY = false) => (
        <div
            className={`relative w-full ${isReadOnly ? '' : 'cursor-pointer'} overflow-hidden`}
            style={{
                opacity: toothOpacity,
                height: 'clamp(26px, 3.8vw, 56px)',
                transform: flipY ? 'scaleY(-1)' : 'none',
            }}
        >
            <ToothSVGInline
                numero={numero}
                data={data}
                onZoneClick={isReadOnly ? () => {} : onZoneClick}
                isReadOnly={isReadOnly}
            />
            <GeneralToothMark
                treatmentId={g}
                toothNumber={numero}
                isUpper={isUpper}
            />
        </div>
    );

    // ─── Layout ───────────────────────────────────────────────────────────────
    const activeRing = isActive
        ? 'bg-indigo-50/50 ring-2 ring-indigo-200 shadow-lg shadow-indigo-100/50 scale-105 z-10'
        : 'hover:bg-slate-50';

    return (
        <div className={`flex flex-col items-center w-full rounded-lg p-0.5 transition-all duration-200 ${isReadOnly ? '' : 'hover:bg-[#e2e8f0] hover:scale-[1.06]'}`}>
            {isUpper ? (
                <>
                    {/* SUPERIOR: imagen (sin flip, el sprite ya apunta corona abajo) → número → selector */}
                    <div className={`flex flex-col items-center w-full rounded-[16px] transition-all duration-300 ${activeRing}`}>
                        {toothContainer(false)}
                        <div className="text-[9px] xl:text-[11px] font-black text-slate-600 tracking-tighter my-0.5 leading-none">
                            {numero}
                        </div>
                    </div>

                    <CircularSurfaceSelector
                        activeToothId={numero}
                        toothData={data}
                        onZoneClick={onZoneClick}
                        isReadOnly={isReadOnly}
                        isUpper={isUpper}
                        isRightSide={isRightSide}
                    />
                </>
            ) : (
                <>
                    {/* INFERIOR: selector → número → imagen (sin flip, el sprite ya apunta corona arriba) */}
                    <CircularSurfaceSelector
                        activeToothId={numero}
                        toothData={data}
                        onZoneClick={onZoneClick}
                        isReadOnly={isReadOnly}
                        isUpper={isUpper}
                        isRightSide={isRightSide}
                    />

                    <div className={`flex flex-col items-center w-full rounded-[16px] transition-all duration-300 ${activeRing}`}>
                        <div className="text-[9px] xl:text-[11px] font-black text-slate-600 tracking-tighter my-0.5 leading-none">
                            {numero}
                        </div>
                        {toothContainer(false)}
                    </div>
                </>
            )}
        </div>
    );
}
