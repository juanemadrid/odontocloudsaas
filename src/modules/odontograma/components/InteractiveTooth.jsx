import React from 'react';
import CircularSurfaceSelector from './CircularSurfaceSelector';
import ToothSVGInline from './ToothSVGInline';
import { TOOLS } from './TratamientosToolbar';

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
    const isExtraccion = g === 'extraccion';
    const isCorona    = g?.includes('corona');
    const isImplante  = g?.includes('implante');

    const toothOpacity = isAusente ? 0.18 : 1;

    // Efectos generales superpuestos
    const renderGeneralEffects = () => {
        if (isAusente) {
            return (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <svg viewBox="0 0 24 24" className="w-[85%] h-[85%] text-slate-400 drop-shadow-md" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
                        <line x1="4" y1="4" x2="20" y2="20"/>
                        <line x1="20" y1="4" x2="4" y2="20"/>
                    </svg>
                </div>
            );
        }
        if (isExtraccion) {
            return (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <svg viewBox="0 0 24 24" className="w-[85%] h-[85%] text-red-500 drop-shadow-md" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
                        <line x1="4" y1="4" x2="20" y2="20"/>
                        <line x1="20" y1="4" x2="4" y2="20"/>
                    </svg>
                </div>
            );
        }
        if (isCorona) {
            return (
                <div className="absolute inset-0 rounded-md border-[3px] border-indigo-500 opacity-60 pointer-events-none z-20 mix-blend-multiply"/>
            );
        }
        if (g === 'fractura') {
            return (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <svg viewBox="0 0 24 24" className="w-[85%] h-[85%] text-purple-500 drop-shadow-md" fill="currentColor">
                        <path d="M13,2L3,14H10l-1,8L21,10H14Z"/>
                    </svg>
                </div>
            );
        }
        if (g?.includes('endodoncia')) {
            const color = g.includes('buena') ? '#3B82F6' : '#EF4444';
            return (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20" style={{ color }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="w-[85%] h-[85%] drop-shadow-md" strokeLinecap="round">
                        <line x1="12" y1="2" x2="12" y2="22"></line>
                        <line x1="8" y1="4" x2="8" y2="18"></line>
                        <line x1="16" y1="4" x2="16" y2="18"></line>
                    </svg>
                </div>
            );
        }
        if (g?.includes('perno')) {
            const color = g.includes('bueno') ? '#3B82F6' : '#F43F5E';
            return (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20" style={{ color }}>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-[85%] h-[85%] drop-shadow-md">
                        <path d="M10 2L14 2L13 18L11 18Z"/>
                        <path d="M8 18L16 18L15 22L9 22Z"/>
                    </svg>
                </div>
            );
        }
        if (isImplante) {
            const tool = TOOLS.find(t => t.id === g);
            const color = g.includes('bueno') ? '#3B82F6' : '#EF4444';
            return tool ? (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20" style={{ color }}>
                    <div className="w-[85%] h-[85%] flex items-center justify-center">
                        {tool.icon}
                    </div>
                </div>
            ) : null;
        }
        return null;
    };

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
            {renderGeneralEffects()}
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
                    <div 
                        onClick={() => {
                            if (!isReadOnly) onZoneClick(String(numero), "Completo");
                        }}
                        className={`flex flex-col items-center w-full rounded-[16px] transition-all duration-300 ${activeRing} cursor-pointer`}
                    >
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

                    <div 
                        onClick={() => {
                            if (!isReadOnly) onZoneClick(String(numero), "Completo");
                        }}
                        className={`flex flex-col items-center w-full rounded-[16px] transition-all duration-300 ${activeRing} cursor-pointer`}
                    >
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
