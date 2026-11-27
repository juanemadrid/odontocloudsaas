// Promoción vigente sobre el plan ANUAL de OdontoCloud.
// Para una nueva promoción basta con cambiar estos valores; fuera de las fechas no se aplica nada.
export const ANNUAL_PROMO = {
    id: 'black-friday-2026',
    label: 'Black Friday',
    percent: 40,
    startsAt: '2026-11-27T00:00:00-05:00', // hora Colombia
    endsAt: '2026-12-20T23:59:59-05:00',
    endsLabel: '20 de diciembre',
};

export function getActiveAnnualPromo(now = new Date()) {
    const t = now instanceof Date ? now.getTime() : new Date(now).getTime();
    const start = Date.parse(ANNUAL_PROMO.startsAt);
    const end = Date.parse(ANNUAL_PROMO.endsAt);
    if (!ANNUAL_PROMO.percent || Number.isNaN(t) || t < start || t > end) return null;
    return ANNUAL_PROMO;
}

/** Precio anual con la promoción vigente (redondeado a miles). Devuelve { price, original, promo }. */
export function applyAnnualPromo(yearlyPrice, now = new Date()) {
    const original = Math.round(Number(yearlyPrice) || 0);
    const promo = getActiveAnnualPromo(now);
    if (!promo || original <= 0) return { price: original, original, promo: null };
    const price = Math.round((original * (100 - promo.percent)) / 100 / 1000) * 1000;
    return { price, original, promo };
}

export function annualPromoText(promo) {
    return promo ? `${promo.label} -${promo.percent}% en el plan anual · hasta el ${promo.endsLabel}` : '';
}
