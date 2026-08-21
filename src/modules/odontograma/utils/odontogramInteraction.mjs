export const DENTITION_ROWS = Object.freeze({
    upperPermanent: Object.freeze([18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]),
    upperTemporary: Object.freeze([55, 54, 53, 52, 51, 61, 62, 63, 64, 65]),
    lowerTemporary: Object.freeze([85, 84, 83, 82, 81, 71, 72, 73, 74, 75]),
    lowerPermanent: Object.freeze([48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]),
});

export function normalizeDentitionType(value) {
    if (value === 'adulto' || value === 'permanente') return 'adulto';
    if (value === 'nino' || value === 'temporal') return 'nino';
    return 'completo';
}

export function getDentitionVisibility(value) {
    const type = normalizeDentitionType(value);
    return {
        type,
        showPermanent: type === 'adulto' || type === 'completo',
        showTemporary: type === 'nino' || type === 'completo',
    };
}

export function getVisibleToothNumbers(value) {
    const { showPermanent, showTemporary } = getDentitionVisibility(value);
    return [
        ...(showPermanent ? DENTITION_ROWS.upperPermanent : []),
        ...(showTemporary ? DENTITION_ROWS.upperTemporary : []),
        ...(showTemporary ? DENTITION_ROWS.lowerTemporary : []),
        ...(showPermanent ? DENTITION_ROWS.lowerPermanent : []),
    ];
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Convierte un clic sobre la imagen completa del diente en una de las cinco
 * superficies usadas por el odontograma. La corona ocupa el extremo orientado
 * hacia el plano oclusal; los clics sobre la raíz se interpretan como la cara
 * visible (vestibular), que es el comportamiento clínico menos ambiguo.
 */
export function inferToothSurface({ x, y, width, height, isUpper, crownRatio = 0.42 }) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || width <= 0 || height <= 0) {
        return 'top';
    }

    const normalizedX = clamp(x / width, 0, 1);
    const normalizedY = clamp(y / height, 0, 1);
    const ratio = clamp(crownRatio, 0.25, 0.6);
    const crownStart = isUpper ? 1 - ratio : 0;
    const crownEnd = isUpper ? 1 : ratio;

    if (normalizedY < crownStart || normalizedY > crownEnd) return 'top';

    const crownY = (normalizedY - crownStart) / ratio;
    const dx = normalizedX - 0.5;
    const dy = crownY - 0.5;

    if (Math.abs(dx) <= 0.18 && Math.abs(dy) <= 0.18) return 'center';
    if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
    return dy < 0 ? 'top' : 'bottom';
}
