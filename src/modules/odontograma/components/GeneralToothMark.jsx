import React from 'react';
import { getToothKind, getTreatmentVisual } from '../utils/treatmentVisuals.mjs';

const KIND_WIDTHS = {
    molar: 76,
    premolar: 58,
    canine: 46,
    incisor: 38,
};

function GeneralSymbol({ mode, color, alert, kind }) {
    const width = KIND_WIDTHS[kind] || KIND_WIDTHS.molar;
    const left = 50 - width / 2;
    const right = 50 + width / 2;
    const rootSpread = kind === 'molar' ? 14 : kind === 'premolar' ? 8 : 4;
    const canalXs = kind === 'molar' ? [38, 50, 62] : kind === 'premolar' ? [45, 55] : [50];
    const common = {
        vectorEffect: 'non-scaling-stroke',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
    };

    if (mode === 'healthy') {
        return (
            <g data-symbol="healthy">
                <path d="M 40,20 L 47,28 L 60,11" fill="none" stroke="white" strokeWidth="7" opacity="0.92" {...common} />
                <path d="M 40,20 L 47,28 L 60,11" fill="none" stroke={color} strokeWidth="3.4" {...common} />
            </g>
        );
    }

    if (mode === 'crown') {
        const crownPath = `M ${left + 2},7 Q 50,-1 ${right - 2},7 Q ${right + 3},19 ${right - 5},34 Q 50,42 ${left + 5},34 Q ${left - 3},19 ${left + 2},7 Z`;
        return (
            <g data-symbol="crown">
                {alert && <path d={crownPath} fill="none" stroke={alert} strokeWidth="6" opacity="0.32" {...common} />}
                <path d={crownPath} fill={color} fillOpacity="0.1" stroke={color} strokeWidth="3" strokeDasharray={alert ? '5 2' : undefined} {...common} />
            </g>
        );
    }

    if (mode === 'fracture') {
        return (
            <g data-symbol="fracture">
                <path d="M 47,3 L 57,13 L 48,20 L 55,28 L 44,39" fill="none" stroke="white" strokeWidth="6" opacity="0.9" {...common} />
                <path d="M 47,3 L 57,13 L 48,20 L 55,28 L 44,39" fill="none" stroke={color} strokeWidth="3.2" {...common} />
            </g>
        );
    }

    if (mode === 'post') {
        return (
            <g data-symbol="post">
                {alert && <path d="M 38,24 H 62 M 50,24 L 50,88" fill="none" stroke={alert} strokeWidth="7" opacity="0.28" {...common} />}
                <path d="M 38,24 H 62" fill="none" stroke={color} strokeWidth="4" {...common} />
                <path d="M 50,24 L 50,88 L 45,80" fill="none" stroke={color} strokeWidth="4" {...common} />
            </g>
        );
    }

    if (mode === 'endo') {
        return (
            <g data-symbol="endo">
                {canalXs.map((x, index) => {
                    const endX = 50 + (index - (canalXs.length - 1) / 2) * rootSpread;
                    const d = `M ${x},20 Q ${x},45 ${endX},88`;
                    return (
                        <React.Fragment key={x}>
                            {alert && <path d={d} fill="none" stroke={alert} strokeWidth="6" opacity="0.26" {...common} />}
                            <path d={d} fill="none" stroke={color} strokeWidth="2.8" {...common} />
                        </React.Fragment>
                    );
                })}
            </g>
        );
    }

    if (mode === 'implant') {
        return (
            <g data-symbol="implant">
                {alert && <path d="M 39,11 H 61 V 27 L 56,86 L 50,94 L 44,86 L 39,27 Z" fill="none" stroke={alert} strokeWidth="6" opacity="0.3" {...common} />}
                <rect x="38" y="9" width="24" height="18" rx="5" fill="white" fillOpacity="0.9" stroke={color} strokeWidth="2.8" {...common} />
                <path d="M 43,28 L 57,28 L 54,86 L 50,93 L 46,86 Z" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="2.8" {...common} />
                {[38, 47, 56, 65, 74].map(y => (
                    <path key={y} d={`M 44,${y} L 56,${y - 3}`} fill="none" stroke={color} strokeWidth="2" {...common} />
                ))}
            </g>
        );
    }

    if (mode === 'absent' || mode === 'extraction') {
        return (
            <g data-symbol={mode}>
                <path d={`M ${left + 3},7 L ${right - 3},91`} fill="none" stroke="white" strokeWidth="7" opacity="0.88" {...common} />
                <path d={`M ${right - 3},7 L ${left + 3},91`} fill="none" stroke="white" strokeWidth="7" opacity="0.88" {...common} />
                <path d={`M ${left + 3},7 L ${right - 3},91`} fill="none" stroke={color} strokeWidth={mode === 'extraction' ? 3.8 : 3.2} {...common} />
                <path d={`M ${right - 3},7 L ${left + 3},91`} fill="none" stroke={color} strokeWidth={mode === 'extraction' ? 3.8 : 3.2} {...common} />
            </g>
        );
    }

    return null;
}

export default function GeneralToothMark({ treatmentId, toothNumber, isUpper }) {
    if (!treatmentId) return null;
    const visual = getTreatmentVisual(treatmentId);
    if (visual.scope !== 'general') return null;
    if (visual.mode === 'crown') return null;
    const kind = getToothKind(toothNumber);

    return (
        <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 z-20 h-full w-full pointer-events-none overflow-visible"
            data-general-treatment={treatmentId}
            aria-hidden="true"
        >
            <g transform={isUpper ? 'translate(0 100) scale(1 -1)' : undefined}>
                <GeneralSymbol
                    mode={visual.mode}
                    color={visual.stroke}
                    alert={visual.alert}
                    kind={kind}
                />
            </g>
        </svg>
    );
}
