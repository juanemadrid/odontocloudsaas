import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// CircularSurfaceSelector
// Tamaño: 100% del ancho de su slot padre (OdontogramaVisual define el ancho)
// ─────────────────────────────────────────────────────────────────────────────

// Generador de path para segmento de anillo (donut slice)
const createSlicePath = (cx, cy, innerRadius, outerRadius, startAngle, endAngle) => {
    const startRad = (startAngle - 90) * Math.PI / 180.0;
    const endRad   = (endAngle   - 90) * Math.PI / 180.0;
    const x1 = cx + outerRadius * Math.cos(startRad);
    const y1 = cy + outerRadius * Math.sin(startRad);
    const x2 = cx + outerRadius * Math.cos(endRad);
    const y2 = cy + outerRadius * Math.sin(endRad);
    const x3 = cx + innerRadius * Math.cos(endRad);
    const y3 = cy + innerRadius * Math.sin(endRad);
    const x4 = cx + innerRadius * Math.cos(startRad);
    const y4 = cy + innerRadius * Math.sin(startRad);
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4} Z`;
};

export default function CircularSurfaceSelector({ activeToothId, toothData, onZoneClick, isReadOnly, isUpper, isRightSide }) {

    const getSectorColor = (zoneId) => {
        const findingId = toothData?.[zoneId]?.id;
        if (!findingId) return 'transparent';
        if (findingId.includes('caries'))  return '#EF4444';
        if (findingId.includes('amalgama')) return '#2563EB';
        if (findingId.includes('resina') || findingId.includes('rest_')) return '#34D399';
        if (findingId.includes('sellante')) return '#A855F7';
        return toothData[zoneId].color || '#94A3B8';
    };

    const hasMark = (zoneId) => !!toothData?.[zoneId];

    const getFaceProps = (zoneId) => ({
        fill: getSectorColor(zoneId),
        stroke: '#1e293b',
        strokeWidth: '2.5',
        opacity: hasMark(zoneId) && toothData?.[zoneId]?.id?.includes('malo') ? 0.7 : 1,
        className: `transition-all duration-300 ${isReadOnly ? '' : 'cursor-pointer hover:fill-slate-200'} origin-center`,
        onClick: () => !isReadOnly && onZoneClick(activeToothId, zoneId),
    });

    const CX = 50, CY = 50, RADIUS_INNER = 18, RADIUS_OUTER = 44;

    return (
        // w-full: ocupa exactamente el ancho del slot de OdontogramaVisual
        // aspect-square: hace que el alto = ancho (cuadrado)
        <div className="w-full aspect-square">
            <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                {/* ARRIBA  – Vestibular */}
                <path d={createSlicePath(CX, CY, RADIUS_INNER, RADIUS_OUTER, -45,  45)} {...getFaceProps('top')} />
                {/* DERECHA – Mesial/Distal */}
                <path d={createSlicePath(CX, CY, RADIUS_INNER, RADIUS_OUTER,  45, 135)} {...getFaceProps('right')} />
                {/* ABAJO   – Lingual/Palatino */}
                <path d={createSlicePath(CX, CY, RADIUS_INNER, RADIUS_OUTER, 135, 225)} {...getFaceProps('bottom')} />
                {/* IZQUIERDA – Distal/Mesial */}
                <path d={createSlicePath(CX, CY, RADIUS_INNER, RADIUS_OUTER, 225, 315)} {...getFaceProps('left')} />
                {/* CENTRO  – Oclusal */}
                <circle cx={CX} cy={CY} r={RADIUS_INNER} {...getFaceProps('center')} />
            </svg>
        </div>
    );
}
