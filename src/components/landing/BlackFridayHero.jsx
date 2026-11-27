import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { applyAnnualPromo, getActiveAnnualPromo } from '../../constants/promotions';

const cop = (n) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n || 0);

const CONFETTI_COLORS = ['#fbbf24', '#f59e0b', '#ef4444', '#ec4899', '#22d3ee', '#34d399', '#60a5fa', '#ffffff'];

function useCountdown(endIso) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);
    const diff = Math.max(0, Date.parse(endIso) - now);
    return {
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
    };
}

/** Emblema propio de la promoción (etiqueta de precio con el porcentaje). */
function PromoEmblem({ percent }) {
    return (
        <svg viewBox="0 0 220 220" className="w-36 h-36 md:w-44 md:h-44 drop-shadow-[0_10px_30px_rgba(251,191,36,0.35)]" aria-hidden="true">
            <defs>
                <linearGradient id="bfGold" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#fde68a" />
                    <stop offset="55%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
            </defs>
            {/* Sello dentado */}
            <polygon
                fill="url(#bfGold)"
                points={Array.from({ length: 32 }, (_, i) => {
                    const a = (Math.PI * 2 * i) / 32;
                    const r = i % 2 === 0 ? 104 : 92;
                    return `${110 + r * Math.cos(a)},${110 + r * Math.sin(a)}`;
                }).join(' ')}
            />
            <circle cx="110" cy="110" r="80" fill="#0b1020" />
            <circle cx="110" cy="110" r="74" fill="none" stroke="#fbbf24" strokeWidth="2" strokeDasharray="4 6" />
            <text x="110" y="82" textAnchor="middle" fill="#ffffff" fontSize="17" fontWeight="900" letterSpacing="3" fontFamily="inherit">BLACK</text>
            <text x="110" y="102" textAnchor="middle" fill="#ffffff" fontSize="17" fontWeight="900" letterSpacing="3" fontFamily="inherit">FRIDAY</text>
            <text x="110" y="148" textAnchor="middle" fill="#fbbf24" fontSize="44" fontWeight="900" fontFamily="inherit">-{percent}%</text>
            <text x="110" y="168" textAnchor="middle" fill="#cbd5e1" fontSize="10" fontWeight="800" letterSpacing="2" fontFamily="inherit">PLAN ANUAL</text>
        </svg>
    );
}

export default function BlackFridayHero({ plans = [], loading = false, onSelectPlan }) {
    const promo = getActiveAnnualPromo();
    const { days, hours, minutes, seconds } = useCountdown(promo?.endsAt || new Date().toISOString());

    const confetti = useMemo(
        () =>
            Array.from({ length: 34 }, (_, i) => ({
                left: (i * 37) % 100,
                delay: (i * 0.73) % 9,
                duration: 7 + ((i * 1.3) % 6),
                size: 6 + ((i * 5) % 8),
                color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                round: i % 3 === 0,
                rotate: (i * 47) % 360,
            })),
        []
    );

    if (!promo) return null;

    const pad = (n) => String(n).padStart(2, '0');
    const cards = plans
        .map((plan) => {
            const base = Number(plan.yearlyPrice || (Number(plan.monthlyPrice || 0) * 10)) || 0;
            const deal = applyAnnualPromo(base);
            return { plan, base, price: deal.price };
        })
        .filter((c) => c.base > 0);

    return (
        <section className="relative overflow-hidden pt-28 md:pt-32 pb-12 px-6 bg-[radial-gradient(ellipse_at_top,_#1e1b4b_0%,_#0b1020_55%,_#05070f_100%)] text-white">
            <style>{`
                @keyframes bfFall { 0% { transform: translateY(-40px) rotate(0deg); opacity: 0; } 10% { opacity: 1; } 100% { transform: translateY(620px) rotate(540deg); opacity: 0; } }
                @keyframes bfShine { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
                @media (prefers-reduced-motion: reduce) { .bf-confetti { animation: none !important; opacity: .6 !important; } }
            `}</style>

            {/* Confeti */}
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                {confetti.map((c, i) => (
                    <span
                        key={i}
                        className="bf-confetti absolute top-0"
                        style={{
                            left: `${c.left}%`,
                            width: c.size,
                            height: c.round ? c.size : c.size * 0.45,
                            background: c.color,
                            borderRadius: c.round ? '999px' : '2px',
                            transform: `rotate(${c.rotate}deg)`,
                            animation: `bfFall ${c.duration}s linear ${c.delay}s infinite`,
                        }}
                    />
                ))}
                <div className="absolute -top-24 left-1/4 w-96 h-96 rounded-full bg-amber-400/10 blur-3xl" />
                <div className="absolute -bottom-24 right-1/4 w-96 h-96 rounded-full bg-pink-500/10 blur-3xl" />
            </div>

            <div className="relative z-10 max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
                    <motion.div
                        initial={{ scale: 0.6, rotate: -20, opacity: 0 }}
                        animate={{ scale: 1, rotate: -8, opacity: 1 }}
                        transition={{ type: 'spring', damping: 12, stiffness: 140 }}
                        className="shrink-0"
                    >
                        <PromoEmblem percent={promo.percent} />
                    </motion.div>

                    <div className="text-center md:text-left flex-1">
                        <motion.p
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-amber-300 text-xs md:text-sm font-black uppercase tracking-[0.3em] mb-2"
                            style={{ animation: 'bfShine 2.4s ease-in-out infinite' }}
                        >
                            ¡OdontoCloud está de fiesta!
                        </motion.p>
                        <motion.h1
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 }}
                            className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] text-white"
                            style={{ color: '#ffffff', textShadow: '0 2px 18px rgba(255,255,255,0.18)' }}
                        >
                            Black Friday <span className="text-amber-400" style={{ color: '#fbbf24' }}>{promo.percent}% OFF</span>
                        </motion.h1>
                        <p className="mt-3 text-slate-300 text-base md:text-lg">
                            En el plan anual de todos los planes. Solo hasta el <strong className="text-white">{promo.endsLabel}</strong>.
                        </p>

                        {/* Cuenta regresiva */}
                        <div className="mt-5 inline-flex items-center gap-2" aria-label="Tiempo restante de la promoción">
                            {[
                                [days, 'días'],
                                [pad(hours), 'horas'],
                                [pad(minutes), 'min'],
                                [pad(seconds), 'seg'],
                            ].map(([v, l]) => (
                                <div key={l} className="min-w-[58px] px-2 py-1.5 rounded-xl bg-white/10 border border-white/15 text-center">
                                    <div className="text-xl font-black tabular-nums leading-none">{v}</div>
                                    <div className="text-[10px] uppercase tracking-wider text-slate-300 mt-1">{l}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Precios visibles arriba */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {loading && cards.length === 0
                        ? [0, 1, 2].map((i) => <div key={i} className="h-36 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />)
                        : cards.map(({ plan, base, price }, i) => {
                              const featured = plan.recommended || plan.isPopular;
                              return (
                                  <motion.button
                                      type="button"
                                      key={plan.id || i}
                                      initial={{ opacity: 0, y: 16 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ delay: 0.1 + i * 0.08 }}
                                      onClick={() => onSelectPlan?.({ ...plan, billing: 'anual', displayPrice: base })}
                                      className={`text-left rounded-2xl p-5 border transition-all hover:-translate-y-1 cursor-pointer ${
                                          featured
                                              ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 border-amber-300 shadow-xl shadow-amber-500/20'
                                              : 'bg-white/10 border-white/15 hover:bg-white/15'
                                      }`}
                                  >
                                      <div className="flex items-center justify-between">
                                          <span className={`text-sm font-black uppercase tracking-wide ${featured ? 'text-slate-950' : 'text-white'}`}>{plan.name}</span>
                                          <span className={`text-[11px] font-black px-2 py-0.5 rounded-md ${featured ? 'bg-slate-950 text-amber-300' : 'bg-red-500 text-white'}`}>
                                              -{promo.percent}%
                                          </span>
                                      </div>
                                      <div className={`mt-3 text-sm line-through font-semibold ${featured ? 'text-slate-800/70' : 'text-slate-400'}`}>{cop(base)} / año</div>
                                      <div className={`text-3xl font-black tabular-nums ${featured ? 'text-slate-950' : 'text-amber-300'}`}>
                                          {cop(price)}
                                          <span className={`text-sm font-bold ml-1 ${featured ? 'text-slate-800' : 'text-slate-300'}`}>/ año</span>
                                      </div>
                                      <div className={`mt-1 text-xs font-semibold ${featured ? 'text-slate-800' : 'text-slate-300'}`}>
                                          Equivale a {cop(Math.round(price / 12))} / mes · ahorras {cop(base - price)}
                                      </div>
                                      <div className={`mt-4 w-full text-center py-2.5 rounded-xl text-xs font-black uppercase tracking-wider ${featured ? 'bg-slate-950 text-white' : 'bg-amber-400 text-slate-950'}`}>
                                          Aprovechar oferta
                                      </div>
                                  </motion.button>
                              );
                          })}
                </div>
            </div>
        </section>
    );
}
