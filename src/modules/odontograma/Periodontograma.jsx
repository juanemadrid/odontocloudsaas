import React, { useState, useEffect, useRef } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import Button from "../../components/ui/Button";
import { FiActivity, FiSave, FiAlertCircle, FiDroplet, FiSun, FiLayers, FiPrinter, FiCheckCircle, FiRefreshCw, FiTrash2 } from "react-icons/fi";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";

// Tooth numbers (FDI standards)
const TEETH_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const TEETH_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const INITIAL_TOOTH_DATA = {
    v: [{}, {}, {}], // Vestibular
    l: [{}, {}, {}], // Lingual/Palatal
    mobility: 0,
    furcation: 0
};

const printHTMLInHiddenIframe = (htmlContent) => {
    let iframe = document.getElementById("oc-print-iframe");
    if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "oc-print-iframe";
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0px";
        iframe.style.height = "0px";
        iframe.style.border = "none";
        iframe.style.visibility = "hidden";
        document.body.appendChild(iframe);
    }
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
    }, 150);
};

const getSiteLabel = (tooth, index) => {
    const num = Number(tooth);
    const isRightSide = (num >= 11 && num <= 18) || (num >= 41 && num <= 48);
    if (isRightSide) {
        return index === 0 ? "D" : index === 1 ? "C" : "M";
    } else {
        return index === 0 ? "M" : index === 1 ? "C" : "D";
    }
};

// ─── PeriodontogramaChart SVG Sub-component ─────────────────────────────
const PeriodontogramaChart = ({ teeth, face, isUpper, periodonto, faceLabel }) => {
    const Y_cej = isUpper ? 110 : 50; // CEJ level (0 mm)
    const yScale = 6; // 6px per mm
    const cardWidth = 128;
    const cardGap = 10;
    const totalWidth = teeth.length * (cardWidth + cardGap);

    const getY = (val) => {
        const num = Number(val) || 0;
        return isUpper ? Y_cej - num * yScale : Y_cej + num * yScale;
    };

    // Calculate X coordinates for each tooth and site
    const points = [];
    teeth.forEach((tooth, tIdx) => {
        const tData = periodonto[tooth] || {};
        const faceData = tData[face] || [{}, {}, {}];

        [0, 1, 2].forEach((sIdx) => {
            const site = faceData[sIdx] || {};
            const pd = site.pd !== undefined && site.pd !== "" ? Number(site.pd) : 0;
            const gm = site.gm !== undefined && site.gm !== "" ? Number(site.gm) : 0;
            const cal = site.cal !== undefined && site.cal !== "" ? Number(site.cal) : pd + gm;

            const x = tIdx * (cardWidth + cardGap) + 4 + (cardWidth - 8) / 3 * (sIdx + 0.5);
            points.push({
                x,
                gm,
                cal,
                pd,
                bleeding: site.bleeding,
                plaque: site.plaque,
                tooth,
                siteIndex: sIdx
            });
        });
    });

    // Path for Gingival Margin (Blue)
    const gmPath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${getY(p.gm)}`).join(' ');

    // Path for Clinical Attachment Level (Red)
    const calPath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${getY(p.cal)}`).join(' ');

    // Shaded pocket area polygon
    const pocketPoints = [];
    points.forEach(p => {
        pocketPoints.push(`${p.x},${getY(p.gm)}`);
    });
    for (let i = points.length - 1; i >= 0; i--) {
        const p = points[i];
        pocketPoints.push(`${p.x},${getY(p.cal)}`);
    }
    const pocketPolygon = pocketPoints.join(' ');

    // Millimeter Grid scale levels
    const gridLevels = [-4, -2, 0, 2, 4, 6, 8, 10, 12];
    const yCej = getY(0);
    const y4mm = getY(4);

    return (
        <div className="flex flex-col gap-1.5 my-3">
            <div className="flex items-center justify-between px-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${face === 'v' ? 'bg-blue-500' : 'bg-amber-500'}`}></span>
                    Gráfico de Sondaje — Cara {faceLabel} ({isUpper ? 'Maxilar Superior' : 'Mandíbula Inferior'})
                </span>
                <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-wider">
                    <span className="flex items-center gap-1 text-blue-600"><span className="w-2.5 h-0.5 bg-blue-600 rounded"></span> Margen Gingival (GM)</span>
                    <span className="flex items-center gap-1 text-red-600"><span className="w-2.5 h-0.5 bg-red-600 rounded"></span> Profundidad / NIC (CAL)</span>
                    <span className="flex items-center gap-1 text-rose-600"><span className="w-2 h-2 rounded-full bg-rose-600"></span> Sangrado (BOP)</span>
                    <span className="flex items-center gap-1 text-amber-600"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Placa</span>
                </div>
            </div>

            <div className="w-full overflow-x-auto custom-scrollbar pb-2">
                <div style={{ width: `${totalWidth}px` }} className="h-[160px] bg-slate-50/70 rounded-2xl relative border border-slate-200/80 shadow-inner select-none shrink-0">
                    <svg width={totalWidth} height={160} viewBox={`0 0 ${totalWidth} 160`} className="absolute inset-0">
                        <defs>
                            <linearGradient id={`chartGrad-${face}-${isUpper ? 'u' : 'l'}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f8fafc" stopOpacity="0.9" />
                                <stop offset="100%" stopColor="#ffffff" stopOpacity="0.9" />
                            </linearGradient>
                        </defs>
                        <rect width={totalWidth} height={160} fill={`url(#chartGrad-${face}-${isUpper ? 'u' : 'l'})`} />

                        {/* Millimeter Horizontal Grids */}
                        {gridLevels.map((lvl) => {
                            const y = getY(lvl);
                            const isCej = lvl === 0;
                            return (
                                <g key={lvl}>
                                    <line
                                        x1={0}
                                        y1={y}
                                        x2={totalWidth}
                                        y2={y}
                                        stroke={isCej ? "#64748b" : "#e2e8f0"}
                                        strokeWidth={isCej ? 1.5 : 0.75}
                                        strokeDasharray={isCej ? "" : "3,3"}
                                    />
                                    <text x={8} y={y + 3} className="text-[8px] font-black fill-slate-400">{lvl}</text>
                                    <text x={totalWidth - 12} y={y + 3} className="text-[8px] font-black fill-slate-400" textAnchor="end">{lvl}</text>
                                </g>
                            );
                        })}

                        {/* Pathological 4mm Threshold Guide Line */}
                        <line
                            x1={0}
                            y1={y4mm}
                            x2={totalWidth}
                            y2={y4mm}
                            stroke="#f43f5e"
                            strokeWidth={1}
                            strokeDasharray="4,4"
                            opacity={0.85}
                        />
                        <text x={40} y={isUpper ? y4mm + 10 : y4mm - 4} className="text-[7.5px] font-black fill-rose-500 uppercase tracking-widest">Umbral 4mm</text>
                        <text x={24} y={isUpper ? yCej + 10 : yCej - 4} className="text-[7.5px] font-black fill-slate-500 uppercase tracking-widest">Línea CEJ</text>

                        {/* Vertical guides aligning to sites */}
                        {points.map((p, idx) => (
                            <line
                                key={idx}
                                x1={p.x}
                                y1={0}
                                x2={p.x}
                                y2={160}
                                stroke="#e2e8f0"
                                strokeWidth={p.siteIndex === 1 ? 1 : 0.5}
                                strokeDasharray={p.siteIndex === 1 ? "4,4" : "1,3"}
                                opacity={0.4}
                            />
                        ))}

                        {/* Teeth Backdrop */}
                        {teeth.map((tooth, tIdx) => {
                            const xCenter = tIdx * (cardWidth + cardGap) + (cardWidth / 2);
                            const isMolar = [18, 17, 16, 26, 27, 28, 48, 47, 46, 36, 37, 38].includes(tooth);

                            if (isUpper) {
                                return (
                                    <path
                                        key={tooth}
                                        d={isMolar ? `M ${xCenter - 18} 110 C ${xCenter - 18} 135, ${xCenter + 18} 135, ${xCenter + 18} 110 L ${xCenter + 15} 70 C ${xCenter + 15} 30, ${xCenter + 7} 20, ${xCenter + 9} 25 L ${xCenter} 55 L ${xCenter - 9} 25 C ${xCenter - 7} 20, ${xCenter - 15} 30, ${xCenter - 15} 70 Z`
                                                   : `M ${xCenter - 12} 110 C ${xCenter - 12} 132, ${xCenter + 12} 132, ${xCenter + 12} 110 L ${xCenter + 9} 70 C ${xCenter + 9} 30, ${xCenter} 20, ${xCenter} 20 C ${xCenter} 20, ${xCenter - 9} 30, ${xCenter - 9} 70 Z`}
                                        fill="#f1f5f9"
                                        stroke="#cbd5e1"
                                        strokeWidth={1}
                                        fillOpacity={0.45}
                                        strokeOpacity={0.5}
                                    />
                                );
                            } else {
                                return (
                                    <path
                                        key={tooth}
                                        d={isMolar ? `M ${xCenter - 18} 50 C ${xCenter - 18} 25, ${xCenter + 18} 25, ${xCenter + 18} 50 L ${xCenter + 15} 90 C ${xCenter + 15} 130, ${xCenter + 7} 140, ${xCenter + 9} 135 L ${xCenter} 105 L ${xCenter - 9} 135 C ${xCenter - 7} 140, ${xCenter - 15} 130, ${xCenter - 15} 90 Z`
                                                   : `M ${xCenter - 12} 50 C ${xCenter - 12} 28, ${xCenter + 12} 28, ${xCenter + 12} 50 L ${xCenter + 9} 90 C ${xCenter + 9} 130, ${xCenter} 140, ${xCenter} 140 C ${xCenter} 140, ${xCenter - 9} 130, ${xCenter - 9} 90 Z`}
                                        fill="#f1f5f9"
                                        stroke="#cbd5e1"
                                        strokeWidth={1}
                                        fillOpacity={0.45}
                                        strokeOpacity={0.5}
                                    />
                                );
                            }
                        })}

                        {/* Direct Tooth Number Labels inside SVG */}
                        {teeth.map((tooth, tIdx) => {
                            const xCenter = tIdx * (cardWidth + cardGap) + (cardWidth / 2);
                            const yPos = isUpper ? (face === 'v' ? 18 : 148) : (face === 'v' ? 148 : 18);
                            return (
                                <text
                                    key={`num-${tooth}`}
                                    x={xCenter}
                                    y={yPos}
                                    className="text-[9px] font-black fill-slate-400/80 uppercase tracking-widest"
                                    textAnchor="middle"
                                >
                                    {tooth}
                                </text>
                            );
                        })}

                        {/* Shaded pocket area (translucent red) */}
                        {points.some(p => p.pd > 0) && (
                            <polygon
                                points={pocketPolygon}
                                fill="#ef4444"
                                fillOpacity={0.18}
                            />
                        )}

                        {/* GM Line (Blue) */}
                        <path
                            d={gmPath}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />

                        {/* CAL Line (Red) */}
                        <path
                            d={calPath}
                            fill="none"
                            stroke="#ef4444"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />

                        {/* Nodes & Bleeding/Plaque Indicators */}
                        {points.map((p, idx) => {
                            const y_gm = getY(p.gm);
                            const y_cal = getY(p.cal);
                            return (
                                <g key={idx}>
                                    <circle cx={p.x} cy={y_gm} r={3} fill="#2563eb" stroke="#ffffff" strokeWidth={1} />
                                    <circle cx={p.x} cy={y_cal} r={3} fill="#dc2626" stroke="#ffffff" strokeWidth={1} />

                                    {/* Bleeding Marker (BOP - Red Dot) */}
                                    {p.bleeding && (
                                        <circle
                                            cx={p.x}
                                            cy={isUpper ? y_gm + 9 : y_gm - 9}
                                            r={4}
                                            fill="#e11d48"
                                            stroke="#ffffff"
                                            strokeWidth={1.2}
                                        />
                                    )}

                                    {/* Plaque Marker (PLA - Yellow/Amber Dot) */}
                                    {p.plaque && (
                                        <circle
                                            cx={p.x + (p.bleeding ? 5 : 0)}
                                            cy={isUpper ? y_gm + 9 : y_gm - 9}
                                            r={4}
                                            fill="#d97706"
                                            stroke="#ffffff"
                                            strokeWidth={1.2}
                                        />
                                    )}

                                    {/* Probing Depth Label */}
                                    {p.pd > 0 && (
                                        <text
                                            x={p.x}
                                            y={isUpper ? y_cal - 8 : y_cal + 11}
                                            className="text-[8.5px] font-black fill-red-600"
                                            textAnchor="middle"
                                        >
                                            {p.pd}
                                        </text>
                                    )}
                                </g>
                            );
                        })}
                    </svg>
                </div>
            </div>
        </div>
    );
};

// ─── SiteInput Sub-component ──────────────────────
const SiteInput = ({ 
    tooth, 
    face, 
    index, 
    label, 
    isUpper, 
    periodonto, 
    updateSite, 
    handleInputChange, 
    handleKeyDown 
}) => {
    const tData = periodonto[tooth] || INITIAL_TOOTH_DATA;
    const faceData = tData[face] || [{}, {}, {}];
    const site = faceData[index] || {};

    const pd = site.pd !== undefined && site.pd !== "" ? Number(site.pd) : "";
    const gm = site.gm !== undefined && site.gm !== "" ? Number(site.gm) : "";
    const cal = site.cal !== undefined && site.cal !== "" ? Number(site.cal) : "";
    const isDeep = pd !== "" && pd >= 4;

    return (
        <div className="flex flex-col items-center p-1 flex-1 border-r last:border-0 border-slate-100 bg-gradient-to-b from-white to-slate-50/30">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{label}</span>

            {/* PD Input */}
            <input
                data-tooth={tooth}
                data-face={face}
                data-index={index}
                data-field="pd"
                data-upper={isUpper}
                className={`perio-input w-8 h-8 text-center text-sm font-black border-2 rounded-lg outline-none transition-all shadow-sm
                    ${isDeep ? 'bg-red-50 text-red-700 border-red-400 ring-2 ring-red-200' : 'border-slate-300 text-slate-800 bg-white focus:bg-blue-50'} 
                    focus:border-blue-500 focus:ring-2 focus:ring-blue-100 hover:border-slate-400`}
                type="text"
                inputMode="numeric"
                placeholder="-"
                value={pd}
                onChange={(e) => handleInputChange(e, tooth, face, index, 'pd', e.target.value)}
                onKeyDown={handleKeyDown}
                title={`Profundidad de Sondaje (mm) - Sitio ${label}`}
            />

            {/* GM Input */}
            <input
                data-tooth={tooth}
                data-face={face}
                data-index={index}
                data-field="gm"
                data-upper={isUpper}
                className="perio-input w-8 h-6 text-center text-[11px] font-bold border border-t-0 border-slate-300 rounded-b-md outline-none text-slate-600 bg-slate-50 focus:bg-white focus:border-blue-500 transition-all shadow-sm"
                type="text"
                placeholder="0"
                value={gm}
                onChange={(e) => handleInputChange(e, tooth, face, index, 'gm', e.target.value)}
                onKeyDown={handleKeyDown}
                title={`Margen Gingival (mm) - Sitio ${label}`}
            />

            {/* BOP & Plaque Toggles */}
            <div className="flex gap-1 mt-1 mb-0.5">
                <button
                    type="button"
                    className={`w-3.5 h-3.5 rounded-full border transition-all flex items-center justify-center shadow-sm
                        ${site.bleeding ? 'bg-rose-500 border-rose-600 shadow-rose-200 scale-110' : 'bg-white border-slate-300 hover:border-rose-400'}`}
                    onClick={() => updateSite(tooth, face, index, 'bleeding', !site.bleeding)}
                    title="Sangrado al Sondaje (BOP)"
                >
                    {site.bleeding && <FiDroplet size={7} className="text-white" />}
                </button>
                <button
                    type="button"
                    className={`w-3.5 h-3.5 rounded-full border transition-all flex items-center justify-center shadow-sm
                        ${site.plaque ? 'bg-amber-500 border-amber-600 shadow-amber-200 scale-110' : 'bg-white border-slate-300 hover:border-amber-400'}`}
                    onClick={() => updateSite(tooth, face, index, 'plaque', !site.plaque)}
                    title="Placa Bacteriana (PLA)"
                >
                    {site.plaque && <FiAlertCircle size={7} className="text-white" />}
                </button>
            </div>

            {/* CAL Display */}
            <span className={`text-[10px] font-black px-1 rounded ${cal > 4 ? 'text-indigo-700 bg-indigo-100' : cal !== "" ? 'text-slate-600 bg-slate-100' : 'text-slate-300 bg-slate-50'}`}>
                {cal !== "" ? cal : "-"}
            </span>
        </div>
    );
};

// ─── ToothColumn Sub-component ────────────────────
const ToothColumn = ({ 
    tooth, 
    isUpper, 
    periodonto, 
    setPeriodonto, 
    updateSite, 
    handleInputChange, 
    handleKeyDown 
}) => {
    const vFace = "v";
    const lFace = "l";
    const isMolar = [18, 17, 16, 26, 27, 28, 48, 47, 46, 36, 37, 38].includes(tooth);

    return (
        <div className="flex flex-col items-center bg-white border-2 border-slate-200 rounded-2xl shadow-sm overflow-hidden w-[128px] shrink-0 hover:border-indigo-300 transition-all hover:shadow-md">
            <div className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 text-center text-sm font-black py-1.5 text-white uppercase tracking-widest">
                {tooth}
            </div>

            {/* Vestibular Row */}
            <div className="w-full bg-blue-50/50 border-b border-slate-200 p-1.5">
                <div className="text-[9px] font-black text-blue-700 uppercase tracking-wider text-center mb-1 flex items-center justify-center gap-1">
                    <FiSun size={10} /> Vestibular
                </div>
                <div className="flex justify-between w-full">
                    <SiteInput tooth={tooth} face={vFace} index={0} label={getSiteLabel(tooth, 0)} isUpper={isUpper} periodonto={periodonto} updateSite={updateSite} handleInputChange={handleInputChange} handleKeyDown={handleKeyDown} />
                    <SiteInput tooth={tooth} face={vFace} index={1} label={getSiteLabel(tooth, 1)} isUpper={isUpper} periodonto={periodonto} updateSite={updateSite} handleInputChange={handleInputChange} handleKeyDown={handleKeyDown} />
                    <SiteInput tooth={tooth} face={vFace} index={2} label={getSiteLabel(tooth, 2)} isUpper={isUpper} periodonto={periodonto} updateSite={updateSite} handleInputChange={handleInputChange} handleKeyDown={handleKeyDown} />
                </div>
            </div>

            {/* Palatino / Lingual Row */}
            <div className="w-full bg-amber-50/50 p-1.5 border-b border-slate-200">
                <div className="text-[9px] font-black text-amber-700 uppercase tracking-wider text-center mb-1 flex items-center justify-center gap-1">
                    <FiLayers size={10} /> {isUpper ? "Palatino" : "Lingual"}
                </div>
                <div className="flex justify-between w-full">
                    <SiteInput tooth={tooth} face={lFace} index={0} label={getSiteLabel(tooth, 0)} isUpper={isUpper} periodonto={periodonto} updateSite={updateSite} handleInputChange={handleInputChange} handleKeyDown={handleKeyDown} />
                    <SiteInput tooth={tooth} face={lFace} index={1} label={getSiteLabel(tooth, 1)} isUpper={isUpper} periodonto={periodonto} updateSite={updateSite} handleInputChange={handleInputChange} handleKeyDown={handleKeyDown} />
                    <SiteInput tooth={tooth} face={lFace} index={2} label={getSiteLabel(tooth, 2)} isUpper={isUpper} periodonto={periodonto} updateSite={updateSite} handleInputChange={handleInputChange} handleKeyDown={handleKeyDown} />
                </div>
            </div>

            {/* Meta Controls (Mobility & Furcation) */}
            <div className="flex flex-col gap-1 p-1.5 w-full bg-slate-50/70 items-center">
                <div className="flex items-center justify-between w-full px-1">
                    <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-wider">Mov</label>
                    <select
                        className="text-[11px] font-black border border-slate-300 rounded bg-white px-1 py-0.5 text-slate-800 outline-none focus:border-indigo-500"
                        value={periodonto[tooth]?.mobility || 0}
                        onChange={e => {
                            const val = Number(e.target.value);
                            setPeriodonto(prev => {
                                const next = { ...prev };
                                if (!next[tooth]) next[tooth] = JSON.parse(JSON.stringify(INITIAL_TOOTH_DATA));
                                next[tooth].mobility = val;
                                return next;
                            });
                        }}
                    >
                        <option value="0">0</option>
                        <option value="1">I</option>
                        <option value="2">II</option>
                        <option value="3">III</option>
                    </select>
                </div>

                {isMolar && (
                    <div className="flex items-center justify-between w-full pt-1 border-t border-slate-200 px-1">
                        <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-wider">Furc</label>
                        <select
                            className="text-[11px] font-black border border-slate-300 rounded bg-white px-1 py-0.5 text-slate-800 outline-none focus:border-indigo-500"
                            value={periodonto[tooth]?.furcation || 0}
                            onChange={e => {
                                const val = Number(e.target.value);
                                setPeriodonto(prev => {
                                    const next = { ...prev };
                                    if (!next[tooth]) next[tooth] = JSON.parse(JSON.stringify(INITIAL_TOOTH_DATA));
                                    next[tooth].furcation = val;
                                    return next;
                                });
                            }}
                        >
                            <option value="0">0</option>
                            <option value="1">I</option>
                            <option value="2">II</option>
                            <option value="3">III</option>
                        </select>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Periodontograma (Main Component) ───────────────────────────────
export default function Periodontograma({ embeddedPatient }) {
    const toast = useToast();
    const { userProfile } = useAuth();
    const pacienteId = embeddedPatient?.id;
    const [periodonto, setPeriodonto] = useState({});
    const [clinicConfig, setClinicConfig] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const timeoutsRef = useRef({});

    useEffect(() => {
        const tenantId = userProfile?.inquilino || userProfile?.tenantId || userProfile?.tenant?.id;
        if (!tenantId) return;
        const loadClinicConfig = async () => {
            try {
                const snap = await getDoc(doc(db, "tenants", tenantId));
                if (snap.exists()) {
                    setClinicConfig(snap.data());
                }
            } catch (err) {
                console.error("Error loading clinic config", err);
            }
        };
        loadClinicConfig();
    }, [userProfile]);

    useEffect(() => {
        if (!pacienteId) return;
        const load = async () => {
            setLoading(true);
            try {
                const ref = doc(db, "pacientes", pacienteId);
                const snap = await getDoc(ref);
                if (snap.exists() && snap.data().periodontograma) {
                    setPeriodonto(snap.data().periodontograma);
                } else {
                    setPeriodonto({});
                }
            } catch (e) {
                console.error("Error loading periodontogram", e);
            } finally {
                setLoading(false);
            }
        };
        load();

        return () => {
            Object.values(timeoutsRef.current).forEach(clearTimeout);
        };
    }, [pacienteId]);

    const handleSave = async () => {
        if (!pacienteId) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, "pacientes", pacienteId), {
                periodontograma: periodonto
            });
            toast.success("Periodontograma guardado correctamente");
        } catch (e) {
            console.error("Error saving periodontogram", e);
            toast.error("Error al guardar el periodontograma");
        } finally {
            setSaving(false);
        }
    };

    const handlePopulateHealthy = () => {
        setPeriodonto(prev => {
            const next = { ...prev };
            const allTeeth = [...TEETH_UPPER, ...TEETH_LOWER];
            allTeeth.forEach(t => {
                if (!next[t]) next[t] = JSON.parse(JSON.stringify(INITIAL_TOOTH_DATA));
                ['v', 'l'].forEach(face => {
                    if (!next[t][face]) next[t][face] = [{}, {}, {}];
                    [0, 1, 2].forEach(sIdx => {
                        if (next[t][face][sIdx].pd === undefined || next[t][face][sIdx].pd === "") {
                            next[t][face][sIdx].pd = 2;
                            next[t][face][sIdx].gm = 0;
                            next[t][face][sIdx].cal = 2;
                        }
                    });
                });
            });
            return next;
        });
        toast.info("Sitios vacíos completados con 2mm (Salud)");
    };

    const handleClearAll = () => {
        if (window.confirm("¿Deseas reiniciar todos los valores del periodontograma?")) {
            setPeriodonto({});
            toast.success("Periodontograma limpiado");
        }
    };

    const updateSite = (toothIso, face, index, field, value) => {
        setPeriodonto(prev => {
            const next = { ...prev };
            if (!next[toothIso]) {
                next[toothIso] = JSON.parse(JSON.stringify(INITIAL_TOOTH_DATA));
            }
            if (!next[toothIso][face]) {
                next[toothIso][face] = [{}, {}, {}];
            }
            if (!next[toothIso][face][index]) {
                next[toothIso][face][index] = {};
            }

            const numVal = value === "" ? "" : Number(value);
            next[toothIso][face][index][field] = value === "" ? "" : numVal;

            const pd = next[toothIso][face][index].pd !== undefined && next[toothIso][face][index].pd !== "" ? Number(next[toothIso][face][index].pd) : 0;
            const gm = next[toothIso][face][index].gm !== undefined && next[toothIso][face][index].gm !== "" ? Number(next[toothIso][face][index].gm) : 0;
            next[toothIso][face][index].cal = pd + gm;

            return next;
        });
    };

    const advanceToNextInput = (currentInput) => {
        const tooth = Number(currentInput.getAttribute('data-tooth'));
        const face = currentInput.getAttribute('data-face');
        const index = Number(currentInput.getAttribute('data-index'));
        const field = currentInput.getAttribute('data-field');
        const isUpper = currentInput.getAttribute('data-upper') === 'true';

        const teethArray = isUpper ? TEETH_UPPER : TEETH_LOWER;
        const toothIdx = teethArray.indexOf(tooth);

        let targetTooth = tooth;
        let targetIndex = index;
        
        if (index < 2) {
            targetIndex = index + 1;
        } else {
            if (toothIdx < teethArray.length - 1) {
                targetTooth = teethArray[toothIdx + 1];
                targetIndex = 0;
            } else {
                return;
            }
        }

        const selector = `input[data-tooth="${targetTooth}"][data-face="${face}"][data-index="${targetIndex}"][data-field="${field}"]`;
        const form = document.getElementById('periodontograma-form');
        const targetInput = form?.querySelector(selector);
        if (targetInput) {
            targetInput.focus();
            targetInput.select();
        }
    };

    const handleInputChange = (e, tooth, face, index, field, value) => {
        const cleanVal = field === 'gm' ? value.replace(/[^\d-]/g, '') : value.replace(/[^\d]/g, '');
        updateSite(tooth, face, index, field, cleanVal);

        const inputEl = e.target;
        const toothKey = `${tooth}-${face}-${index}-${field}`;

        if (timeoutsRef.current[toothKey]) {
            clearTimeout(timeoutsRef.current[toothKey]);
            delete timeoutsRef.current[toothKey];
        }

        if (cleanVal && cleanVal.length > 0) {
            if (cleanVal === "1" || cleanVal === "-") {
                timeoutsRef.current[toothKey] = setTimeout(() => {
                    advanceToNextInput(inputEl);
                    delete timeoutsRef.current[toothKey];
                }, 350);
            } else {
                advanceToNextInput(inputEl);
            }
        }
    };

    const handleKeyDown = (e) => {
        const current = e.target;
        const tooth = Number(current.getAttribute('data-tooth'));
        const face = current.getAttribute('data-face');
        const index = Number(current.getAttribute('data-index'));
        const field = current.getAttribute('data-field');
        const isUpper = current.getAttribute('data-upper') === 'true';

        const teethArray = isUpper ? TEETH_UPPER : TEETH_LOWER;
        const toothIdx = teethArray.indexOf(tooth);

        if (toothIdx === -1) return;

        let targetTooth = tooth;
        let targetIndex = index;
        let targetField = field;
        let targetFace = face;

        if (e.key === 'ArrowRight' || e.key === 'Enter') {
            e.preventDefault();
            if (index < 2) {
                targetIndex = index + 1;
            } else {
                if (toothIdx < teethArray.length - 1) {
                    targetTooth = teethArray[toothIdx + 1];
                    targetIndex = 0;
                }
            }
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (index > 0) {
                targetIndex = index - 1;
            } else {
                if (toothIdx > 0) {
                    targetTooth = teethArray[toothIdx - 1];
                    targetIndex = 2;
                }
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (field === 'pd') {
                targetField = 'gm';
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (field === 'gm') {
                targetField = 'pd';
            }
        } else {
            return;
        }

        const selector = `input[data-tooth="${targetTooth}"][data-face="${targetFace}"][data-index="${targetIndex}"][data-field="${targetField}"]`;
        const form = document.getElementById('periodontograma-form');
        const targetInput = form?.querySelector(selector);
        if (targetInput) {
            targetInput.focus();
            targetInput.select();
        }
    };

    // Statistics calculations
    const getStats = () => {
        let totalProbed = 0;
        let bleedingCount = 0;
        let plaqueCount = 0;
        let pocketCount = 0;
        let maxPocketDepth = 0;

        const allTeeth = [...TEETH_UPPER, ...TEETH_LOWER];
        allTeeth.forEach(t => {
            const tData = periodonto[t];
            if (!tData) return;

            ['v', 'l'].forEach(face => {
                const faceData = tData[face];
                if (!faceData) return;

                faceData.forEach(site => {
                    if (site.pd !== undefined && site.pd !== "") {
                        totalProbed++;
                        const pdNum = Number(site.pd) || 0;
                        if (pdNum > maxPocketDepth) maxPocketDepth = pdNum;
                        if (pdNum >= 4) pocketCount++;
                        if (site.bleeding) bleedingCount++;
                        if (site.plaque) plaqueCount++;
                    }
                });
            });
        });

        const bopPercent = totalProbed > 0 ? Math.round((bleedingCount / totalProbed) * 100) : 0;
        const plaquePercent = totalProbed > 0 ? Math.round((plaqueCount / totalProbed) * 100) : 0;

        let dxBadge = { label: "Sin datos", color: "bg-slate-100 text-slate-600" };
        if (totalProbed > 0) {
            if (pocketCount === 0 && bopPercent <= 10) {
                dxBadge = { label: "Salud Periodontal", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
            } else if (pocketCount === 0 && bopPercent > 10) {
                dxBadge = { label: "Gingivitis", color: "bg-amber-50 text-amber-700 border-amber-200" };
            } else if (maxPocketDepth >= 6) {
                dxBadge = { label: "Periodontitis Severa / Avanzada (≥6mm)", color: "bg-rose-50 text-rose-700 border-rose-200" };
            } else if (maxPocketDepth >= 4) {
                dxBadge = { label: "Periodontitis Moderada / Leve (4-5mm)", color: "bg-orange-50 text-orange-700 border-orange-200" };
            }
        }

        return {
            totalProbed,
            bleedingCount,
            plaqueCount,
            pocketCount,
            bopPercent,
            plaquePercent,
            maxPocketDepth,
            dxBadge
        };
    };

    const stats = getStats();

    const handlePrintPeriodontograma = () => {
        const logoUrl = clinicConfig?.logo || userProfile?.tenant?.logo || "";
        const clinicName = clinicConfig?.nombreComercial || clinicConfig?.nombre || clinicConfig?.name || userProfile?.tenant?.nombre || "CLÍNICA DENTAL";
        const clinicNit = clinicConfig?.nit || userProfile?.tenant?.nit || "—";
        const clinicAddress = clinicConfig?.direccion || clinicConfig?.address || "—";
        const clinicPhone = clinicConfig?.telefono || clinicConfig?.phone || "—";
        const clinicEmail = clinicConfig?.email || clinicConfig?.correo || "—";

        const html = `
            <html>
            <head>
                <title>Periodontograma Clínico - ${embeddedPatient?.nombreCompleto || ''}</title>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                        color: #1e293b;
                        padding: 30px;
                        max-width: 900px;
                        margin: 0 auto;
                        line-height: 1.4;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        border-bottom: 4px solid #2563eb;
                        padding-bottom: 22px;
                        margin-bottom: 25px;
                        gap: 20px;
                    }
                    .logo-container {
                        display: flex;
                        gap: 20px;
                        align-items: center;
                    }
                    .logo-text-placeholder {
                        width: 75px;
                        height: 75px;
                        background: #2563eb;
                        border-radius: 16px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 32px;
                        font-weight: 900;
                        text-transform: uppercase;
                    }
                    .clinic-title {
                        margin: 0;
                        font-size: 22px;
                        font-weight: 900;
                        color: #0f172a;
                        text-transform: uppercase;
                        letter-spacing: -0.5px;
                    }
                    .clinic-meta {
                        margin: 2px 0;
                        font-size: 11.5px;
                        color: #64748b;
                        font-weight: 500;
                    }
                    .doc-info {
                        text-align: right;
                    }
                    .doc-badge {
                        background: #eff6ff;
                        padding: 10px 18px;
                        border-radius: 14px;
                        border: 2px solid #dbeafe;
                        margin-bottom: 6px;
                        display: inline-block;
                    }
                    .doc-badge span {
                        font-size: 15px;
                        font-weight: 900;
                        color: #1d4ed8;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }
                    .doc-meta {
                        margin: 0;
                        font-size: 10.5px;
                        color: #94a3b8;
                        font-weight: 900;
                        text-transform: uppercase;
                    }
                    .patient-card {
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 12px;
                        padding: 14px 18px;
                        margin-bottom: 22px;
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 10px;
                    }
                    .info-group {
                        padding: 6px 10px;
                        background: #ffffff;
                        border-radius: 8px;
                        border: 1px solid #f1f5f9;
                    }
                    .info-label {
                        font-size: 8px;
                        font-weight: 800;
                        text-transform: uppercase;
                        color: #94a3b8;
                        letter-spacing: 0.05em;
                        margin-bottom: 3px;
                    }
                    .info-value {
                        font-size: 11.5px;
                        font-weight: 700;
                        color: #1e293b;
                    }
                    .stats-card {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 12px;
                        margin-bottom: 22px;
                    }
                    .stat-box {
                        border: 1px solid #e2e8f0;
                        border-radius: 12px;
                        padding: 10px 14px;
                        background: #ffffff;
                    }
                    .stat-title { font-size: 8.5px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; }
                    .stat-val { font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 3px; }
                    .section-title {
                        font-size: 11px;
                        font-weight: 800;
                        text-transform: uppercase;
                        color: #1e3a8a;
                        letter-spacing: 0.08em;
                        border-bottom: 2px solid #e2e8f0;
                        padding-bottom: 5px;
                        margin-top: 25px;
                        margin-bottom: 12px;
                    }
                    .table-perio {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 9.5px;
                        margin-bottom: 20px;
                        border: 1px solid #e2e8f0;
                        border-radius: 8px;
                        overflow: hidden;
                    }
                    .table-perio th, .table-perio td {
                        border: 1px solid #e2e8f0;
                        padding: 4px 5px;
                        text-align: center;
                    }
                    .table-perio th {
                        background: #f8fafc;
                        font-weight: 800;
                        text-transform: uppercase;
                        color: #475569;
                    }
                    .pocket-highlight {
                        background: #fee2e2;
                        color: #991b1b;
                        font-weight: 800;
                    }
                    @media print { body { padding: 15px; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo-container">
                        ${logoUrl 
                            ? `<img src="${logoUrl}" style="max-height: 75px; max-width: 150px; object-fit: contain;" />`
                            : `<div class="logo-text-placeholder">${clinicName.substring(0, 1) || "O"}</div>`
                        }
                        <div>
                            <h1 class="clinic-title">${clinicName}</h1>
                            <p class="clinic-meta" style="font-weight: 800;">NIT: ${clinicNit}</p>
                            <p class="clinic-meta">${clinicAddress}</p>
                            <p class="clinic-meta">TEL: ${clinicPhone} ${clinicEmail !== '—' ? `| ${clinicEmail}` : ''}</p>
                        </div>
                    </div>
                    <div class="doc-info">
                        <div class="doc-badge">
                            <span>Periodontograma Clínico</span>
                        </div>
                        <p class="doc-meta">FECHA IMPRESIÓN: ${new Date().toLocaleDateString('es-CO')}</p>
                    </div>
                </div>

                <div class="patient-card">
                    <div class="info-group">
                        <div class="info-label">Paciente</div>
                        <div class="info-value">${embeddedPatient?.nombreCompleto || '—'}</div>
                    </div>
                    <div class="info-group">
                        <div class="info-label">Documento Identidad</div>
                        <div class="info-value">${embeddedPatient?.tipoDocumento || 'C.C.'} ${embeddedPatient?.nroDocumento || '—'}</div>
                    </div>
                    <div class="info-group">
                        <div class="info-label">Nro. Historia</div>
                        <div class="info-value">#${embeddedPatient?.nroHistoria || 'S/N'}</div>
                    </div>
                    <div class="info-group">
                        <div class="info-label">Edad</div>
                        <div class="info-value">${embeddedPatient?.edad || '—'}</div>
                    </div>
                </div>

                <div class="stats-card">
                    <div class="stat-box">
                        <div class="stat-title">Sitios Evaluados</div>
                        <div class="stat-val">${stats.totalProbed}</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-title">Sangrado (BOP)</div>
                        <div class="stat-val" style="color: #e11d48;">${stats.bopPercent}%</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-title">Placa Bacteriana</div>
                        <div class="stat-val" style="color: #d97706;">${stats.plaquePercent}%</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-title">Bolsas ≥ 4mm</div>
                        <div class="stat-val" style="color: #dc2626;">${stats.pocketCount}</div>
                    </div>
                </div>

                <div style="margin-bottom: 20px; font-size: 12px; font-weight: 800; color: #1e3a8a; text-transform: uppercase;">
                    Diagnóstico Sugerido: <span style="padding: 4px 12px; border-radius: 8px; background: #eff6ff; border: 1.5px solid #bfdbfe; color: #1d4ed8;">${stats.dxBadge.label}</span>
                </div>

                <div class="section-title">Matriz de Sondaje — Arcada Superior (Maxilar 18-28)</div>
                <table class="table-perio">
                    <thead>
                        <tr>
                            <th style="width: 100px;">Diente</th>
                            ${TEETH_UPPER.map(t => `<th colspan="3">${t}</th>`).join('')}
                        </tr>
                        <tr>
                            <th>Cara</th>
                            ${TEETH_UPPER.map(t => `<th>${getSiteLabel(t, 0)}</th><th>${getSiteLabel(t, 1)}</th><th>${getSiteLabel(t, 2)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Vestibular (PD)</strong></td>
                            ${TEETH_UPPER.map(t => {
                                const sites = (periodonto[t]?.v) || [{},{},{}];
                                return sites.map(s => `<td class="${s.pd >= 4 ? 'pocket-highlight' : ''}">${s.pd !== undefined ? s.pd : '-'}</td>`).join('');
                            }).join('')}
                        </tr>
                        <tr>
                            <td><strong>Palatino (PD)</strong></td>
                            ${TEETH_UPPER.map(t => {
                                const sites = (periodonto[t]?.l) || [{},{},{}];
                                return sites.map(s => `<td class="${s.pd >= 4 ? 'pocket-highlight' : ''}">${s.pd !== undefined ? s.pd : '-'}</td>`).join('');
                            }).join('')}
                        </tr>
                    </tbody>
                </table>

                <div class="section-title">Matriz de Sondaje — Arcada Inferior (Mandíbula 48-38)</div>
                <table class="table-perio">
                    <thead>
                        <tr>
                            <th style="width: 100px;">Diente</th>
                            ${TEETH_LOWER.map(t => `<th colspan="3">${t}</th>`).join('')}
                        </tr>
                        <tr>
                            <th>Cara</th>
                            ${TEETH_LOWER.map(t => `<th>${getSiteLabel(t, 0)}</th><th>${getSiteLabel(t, 1)}</th><th>${getSiteLabel(t, 2)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><strong>Vestibular (PD)</strong></td>
                            ${TEETH_LOWER.map(t => {
                                const sites = (periodonto[t]?.v) || [{},{},{}];
                                return sites.map(s => `<td class="${s.pd >= 4 ? 'pocket-highlight' : ''}">${s.pd !== undefined ? s.pd : '-'}</td>`).join('');
                            }).join('')}
                        </tr>
                        <tr>
                            <td><strong>Lingual (PD)</strong></td>
                            ${TEETH_LOWER.map(t => {
                                const sites = (periodonto[t]?.l) || [{},{},{}];
                                return sites.map(s => `<td class="${s.pd >= 4 ? 'pocket-highlight' : ''}">${s.pd !== undefined ? s.pd : '-'}</td>`).join('');
                            }).join('')}
                        </tr>
                    </tbody>
                </table>

                <div style="margin-top: 50px; display: flex; justify-content: space-between; gap: 60px; padding: 0 20px; page-break-inside: avoid;">
                    <div style="flex: 1; text-align: center;">
                        <div style="height: 85px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 6px;">
                            ${(userProfile?.firmaElectronica || userProfile?.firma) ? `<img src="${userProfile.firmaElectronica || userProfile.firma}" style="max-height: 80px; max-width: 280px; object-fit: contain;" />` : ''}
                        </div>
                        <div style="border-top: 1.5px solid #64748b; padding-top: 8px;">
                            <div style="font-weight: 800; font-size: 11px; text-transform: uppercase; color: #0f172a;">${userProfile?.nombreCompleto || userProfile?.displayName || 'Odontólogo Responsable'}</div>
                            <div style="font-size: 9px; color: #64748b; font-weight: 700; text-transform: uppercase;">Especialista / Periodoncista</div>
                            ${userProfile?.tarjetaProfesional ? `<div style="font-size: 9px; color: #64748b; font-weight: 600;">T.P. ${userProfile.tarjetaProfesional}</div>` : ''}
                        </div>
                    </div>
                    <div style="flex: 1; text-align: center;">
                        <div style="height: 85px;"></div>
                        <div style="border-top: 1.5px solid #64748b; padding-top: 8px;">
                            <div style="font-weight: 800; font-size: 11px; text-transform: uppercase; color: #0f172a;">${embeddedPatient?.nombreCompleto || 'Paciente'}</div>
                            <div style="font-size: 9px; color: #64748b; font-weight: 700; text-transform: uppercase;">Paciente / Conformidad</div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        printHTMLInHiddenIframe(html);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/30 animate-fadeIn min-h-0 relative p-6 md:p-8 overflow-y-auto custom-scrollbar">
            
            {/* Upper Action Bar */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm">
                        <FiActivity size={22} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 tracking-tight">Periodontograma Clínico Gráfico</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Control gráfico de bolsas, recesión, placa y sangrado (BOP)</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                    <button
                        type="button"
                        onClick={handlePopulateHealthy}
                        className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-full font-black text-[10.5px] uppercase tracking-wider border border-slate-200 transition-all flex items-center gap-1.5"
                        title="Rellenar sitios vacíos con 2mm (Salud)"
                    >
                        <FiCheckCircle size={14} className="text-emerald-500" />
                        Completar Salud (2mm)
                    </button>
                    <button
                        type="button"
                        onClick={handleClearAll}
                        className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-full font-black text-[10.5px] uppercase tracking-wider border border-rose-100 transition-all flex items-center gap-1.5"
                        title="Limpiar datos del periodontograma"
                    >
                        <FiTrash2 size={14} />
                        Limpiar
                    </button>
                    <button
                        type="button"
                        onClick={handlePrintPeriodontograma}
                        className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-full font-black text-[11px] uppercase tracking-widest transition-all shadow-md shadow-amber-500/20 flex items-center gap-2"
                    >
                        <FiPrinter size={14} />
                        Imprimir / PDF
                    </button>
                    <Button 
                        variant="primary" 
                        onClick={handleSave} 
                        disabled={loading || saving}
                        className="shadow-lg shadow-blue-500/20 px-8 py-2.5 rounded-full font-black text-[11px] uppercase tracking-widest flex items-center gap-2"
                    >
                        <FiSave size={14} />
                        {saving ? "Guardando..." : "Guardar Cambios"}
                    </Button>
                </div>
            </div>

            {/* Statistics panel */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8 shrink-0">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sitios Evaluados</span>
                    <div className="flex items-end justify-between mt-2">
                        <span className="text-2xl font-black text-slate-800">{stats.totalProbed}</span>
                        <span className="text-[10px] font-bold text-slate-400">sitios</span>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                    <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1">
                        <FiDroplet /> Sangrado (BOP)
                    </span>
                    <div className="flex items-end justify-between mt-2">
                        <span className="text-2xl font-black text-rose-600">{stats.bopPercent}%</span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${stats.bopPercent > 25 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {stats.bopPercent > 25 ? 'Alto' : 'Normal'}
                        </span>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1">
                        <FiSun /> Placa Bacteriana
                    </span>
                    <div className="flex items-end justify-between mt-2">
                        <span className="text-2xl font-black text-amber-600">{stats.plaquePercent}%</span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${stats.plaquePercent > 20 ? 'bg-yellow-50 text-yellow-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {stats.plaquePercent > 20 ? 'Alto' : 'Controlado'}
                        </span>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                    <span className="text-[9px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1">
                        <FiActivity /> Bolsas ≥ 4mm
                    </span>
                    <div className="flex items-end justify-between mt-2">
                        <span className="text-2xl font-black text-red-600">{stats.pocketCount}</span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${stats.pocketCount > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {stats.pocketCount > 0 ? `${stats.pocketCount} Puntos` : 'Sano'}
                        </span>
                    </div>
                </div>
                <div className="col-span-2 lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between">
                    <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Diagnóstico Periodontal</span>
                    <div className="mt-2">
                        <span className={`inline-block text-[10.5px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-wide ${stats.dxBadge.color}`}>
                            {stats.dxBadge.label}
                        </span>
                    </div>
                </div>
            </div>

            {/* Form and Graphical Canvas Layout */}
            <form id="periodontograma-form" className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-10 min-h-0 mb-8 shrink-0">
                
                {/* Upper Arch (18 - 28) */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">Arcada Superior (Maxilar 18 — 28)</h4>
                        </div>
                    </div>
                    
                    {/* Graphical SVG Periodontogram for Upper Arch */}
                    <div className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                        <PeriodontogramaChart teeth={TEETH_UPPER} face="v" isUpper={true} periodonto={periodonto} faceLabel="Vestibular" />
                        <PeriodontogramaChart teeth={TEETH_UPPER} face="l" isUpper={true} periodonto={periodonto} faceLabel="Palatino" />
                    </div>

                    {/* Numeric Cards Grid for Upper Arch */}
                    <div className="w-full overflow-x-auto custom-scrollbar pb-2">
                        <div className="flex gap-2.5 min-w-max p-1">
                            {TEETH_UPPER.map(t => (
                                <ToothColumn 
                                    key={t} 
                                    tooth={t} 
                                    isUpper={true} 
                                    periodonto={periodonto}
                                    setPeriodonto={setPeriodonto}
                                    updateSite={updateSite}
                                    handleInputChange={handleInputChange}
                                    handleKeyDown={handleKeyDown}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Lower Arch (48 - 38) */}
                <div className="space-y-6 border-t border-slate-100 pt-8">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wider">Arcada Inferior (Mandíbula 48 — 38)</h4>
                        </div>
                    </div>

                    {/* Graphical SVG Periodontogram for Lower Arch */}
                    <div className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                        <PeriodontogramaChart teeth={TEETH_LOWER} face="l" isUpper={false} periodonto={periodonto} faceLabel="Lingual" />
                        <PeriodontogramaChart teeth={TEETH_LOWER} face="v" isUpper={false} periodonto={periodonto} faceLabel="Vestibular" />
                    </div>

                    {/* Numeric Cards Grid for Lower Arch */}
                    <div className="w-full overflow-x-auto custom-scrollbar pb-2">
                        <div className="flex gap-2.5 min-w-max p-1">
                            {TEETH_LOWER.map(t => (
                                <ToothColumn 
                                    key={t} 
                                    tooth={t} 
                                    isUpper={false} 
                                    periodonto={periodonto}
                                    setPeriodonto={setPeriodonto}
                                    updateSite={updateSite}
                                    handleInputChange={handleInputChange}
                                    handleKeyDown={handleKeyDown}
                                />
                            ))}
                        </div>
                    </div>
                </div>

            </form>

            {/* Premium Legend card */}
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm shrink-0">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4">Leyenda & Convenciones Periodontales</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-50 border-2 border-red-300 text-red-700 flex items-center justify-center font-black">4</div>
                        <span>Bolsa Profunda (≥ 4mm)</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-rose-500 flex items-center justify-center shadow-sm text-white text-[8px] font-black">BOP</div>
                        <span>Sangrado al Sondaje</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center shadow-sm text-white text-[8px] font-black">PLA</div>
                        <span>Placa Bacteriana</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-indigo-650 font-black text-sm">CAL</div>
                        <span>Nivel de inserción clínica (NIC)</span>
                    </div>
                </div>
            </div>

        </div>
    );
}
