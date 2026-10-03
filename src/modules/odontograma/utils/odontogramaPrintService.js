// src/modules/odontograma/utils/odontogramaPrintService.js

const createSlicePath = (cx, cy, innerRadius, outerRadius, startAngle, endAngle) => {
    const startRad = (startAngle - 90) * Math.PI / 180.0;
    const endRad = (endAngle - 90) * Math.PI / 180.0;
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

const getSectorColor = (toothData, zoneId) => {
    const findingId = toothData?.[zoneId]?.id;
    if (!findingId) return '#ffffff';
    if (findingId.includes('caries')) return '#EF4444';
    if (findingId.includes('amalgama')) return '#2563EB';
    if (findingId.includes('resina') || findingId.includes('rest_')) return '#10B981';
    if (findingId.includes('sellante')) return '#A855F7';
    return toothData[zoneId].color || '#94A3B8';
};

const getSpriteConfig = (fdiNum, baseUrl = "") => {
    const n = parseInt(fdiNum, 10);
    const sprites = {
        permSup: { img: `${baseUrl}assets/dontograma/permanente/superior.png`, numCols: 16, posY: '100%' },
        permInf: { img: `${baseUrl}assets/dontograma/permanente/inferior.png`, numCols: 16, posY: '0%' },
        tempSup: { img: `${baseUrl}assets/dontograma/temporal/superior.png`, numCols: 10, posY: '100%' },
        tempInf: { img: `${baseUrl}assets/dontograma/temporal/inferior.png`, numCols: 10, posY: '0%' },
    };

    if (n >= 11 && n <= 18) return { ...sprites.permSup, col: 18 - n };
    if (n >= 21 && n <= 28) return { ...sprites.permSup, col: 8 + (n - 21) };
    if (n >= 41 && n <= 48) return { ...sprites.permInf, col: 48 - n };
    if (n >= 31 && n <= 38) return { ...sprites.permInf, col: 8 + (n - 31) };

    if (n >= 51 && n <= 55) return { ...sprites.tempSup, col: 55 - n };
    if (n >= 61 && n <= 65) return { ...sprites.tempSup, col: 5 + (n - 61) };
    if (n >= 81 && n <= 85) return { ...sprites.tempInf, col: 85 - n };
    if (n >= 71 && n <= 75) return { ...sprites.tempInf, col: 5 + (n - 71) };

    return null;
};

const renderToothCircleSVG = (toothData) => {
    const CX = 50, CY = 50, R_INNER = 18, R_OUTER = 44;
    const topColor = getSectorColor(toothData, 'top');
    const rightColor = getSectorColor(toothData, 'right');
    const bottomColor = getSectorColor(toothData, 'bottom');
    const leftColor = getSectorColor(toothData, 'left');
    const centerColor = getSectorColor(toothData, 'center');
    const gen = toothData?.general?.id;

    return `
        <svg viewBox="0 0 100 100" style="width: 26px; height: 26px; display: block; margin: 0 auto; overflow: visible;">
            <path d="${createSlicePath(CX, CY, R_INNER, R_OUTER, -45, 45)}" fill="${topColor}" stroke="#1e293b" stroke-width="2.5" />
            <path d="${createSlicePath(CX, CY, R_INNER, R_OUTER, 45, 135)}" fill="${rightColor}" stroke="#1e293b" stroke-width="2.5" />
            <path d="${createSlicePath(CX, CY, R_INNER, R_OUTER, 135, 225)}" fill="${bottomColor}" stroke="#1e293b" stroke-width="2.5" />
            <path d="${createSlicePath(CX, CY, R_INNER, R_OUTER, 225, 315)}" fill="${leftColor}" stroke="#1e293b" stroke-width="2.5" />
            <circle cx="${CX}" cy="${CY}" r="${R_INNER}" fill="${centerColor}" stroke="#1e293b" stroke-width="2.5" />
            ${gen === 'extraccion' || gen === 'ausente' ? `
                <line x1="12" y1="12" x2="88" y2="88" stroke="#ef4444" stroke-width="6" stroke-linecap="round" />
                <line x1="88" y1="12" x2="12" y2="88" stroke="#ef4444" stroke-width="6" stroke-linecap="round" />
            ` : ''}
            ${gen === 'fractura' ? `
                <path d="M 45,8 L 57,28 L 44,48 L 56,68 L 46,92" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M 45,8 L 57,28 L 44,48 L 56,68 L 46,92" fill="none" stroke="#ef4444" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
            ` : ''}
            ${gen === 'diente_sano' ? `
                <path d="M 32,48 L 44,62 L 68,32" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M 32,48 L 44,62 L 68,32" fill="none" stroke="#10b981" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
            ` : ''}
            ${gen && gen.includes('perno') ? `
                <path d="M 28,50 H 72 M 50,22 V 78" fill="none" stroke="${gen.includes('malo') ? '#e11d48' : '#2563eb'}" stroke-width="4.5" stroke-linecap="round" />
            ` : ''}
            ${gen && gen.includes('endodoncia') ? `
                <line x1="50" y1="18" x2="50" y2="82" stroke="${gen.includes('mala') ? '#ef4444' : '#2563eb'}" stroke-width="4" stroke-linecap="round" />
                <circle cx="${CX}" cy="${CY}" r="15" fill="none" stroke="${gen.includes('mala') ? '#ef4444' : '#2563eb'}" stroke-width="3" stroke-dasharray="3,2" />
            ` : ''}
            ${gen && (gen.includes('carilla') || gen === 'carilla_adap' || gen === 'carilla_des') ? `
                <path d="M 20,20 Q 50,5 80,20 Q 85,50 80,80 Q 50,95 20,80 Z" fill="none" stroke="${gen.includes('des') ? '#ef4444' : '#3b82f6'}" stroke-width="3.5" />
            ` : ''}
            ${gen && (gen.includes('pontico') || gen === 'pontico') ? `
                <rect x="15" y="35" width="70" height="30" rx="6" fill="#2563eb" fill-opacity="0.25" stroke="#2563eb" stroke-width="3" />
            ` : ''}
            ${gen && (gen.includes('provisional') || gen === 'provisional_adap' || gen === 'provisional_des') ? `
                <rect x="18" y="18" width="64" height="64" rx="8" fill="none" stroke="${gen.includes('des') ? '#ef4444' : '#3b82f6'}" stroke-width="3.5" stroke-dasharray="4,2" />
            ` : ''}
            ${gen && (gen.includes('lesion_apical') || gen === 'lesion_apical') ? `
                <circle cx="50" cy="50" r="14" fill="#b91c1c" fill-opacity="0.3" stroke="#b91c1c" stroke-width="3" />
            ` : ''}
            ${gen && (gen.includes('resto_radicular') || gen === 'resto_radicular') ? `
                <line x1="20" y1="20" x2="80" y2="80" stroke="#78716c" stroke-width="5" stroke-linecap="round" />
            ` : ''}
            ${gen && gen.includes('implante') ? `
                <rect x="36" y="8" width="28" height="84" rx="6" fill="#3b82f6" fill-opacity="0.3" stroke="#2563eb" stroke-width="4" />
            ` : ''}
            ${gen && gen.includes('corona') ? `
                <circle cx="${CX}" cy="${CY}" r="47" fill="none" stroke="${gen.includes('malo') || gen.includes('des') ? '#ef4444' : '#2563eb'}" stroke-width="4" stroke-dasharray="4,2" />
            ` : ''}
        </svg>
    `;
};

const renderToothSprite = (toothNum, baseUrl, toothData = {}, isUpper = false) => {
    const cfg = getSpriteConfig(toothNum, baseUrl);
    if (!cfg) return `<div style="height: 38px;"></div>`;
    const bgPosXPct = cfg.col * (100 / (cfg.numCols - 1));
    const bgSizeXPct = cfg.numCols * 100;
    const gen = toothData?.general?.id;
    const isAusente = gen === 'ausente' || gen === 'extraccion' || gen === 'resto_radicular';
    const isImplante = gen && gen.includes('implante');
    const opacity = isAusente ? 0.2 : isImplante ? 0.3 : 1;

    let markSVG = '';
    if (gen === 'fractura') {
        markSVG = `
            <svg viewBox="0 0 100 100" style="position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none;">
                <g ${isUpper ? 'transform="translate(0 100) scale(1 -1)"' : ''}>
                    <path d="M 47,4 L 57,14 L 48,22 L 55,30 L 44,42" fill="none" stroke="white" stroke-width="7" opacity="0.95" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M 47,4 L 57,14 L 48,22 L 55,30 L 44,42" fill="none" stroke="#ef4444" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
                </g>
            </svg>
        `;
    } else if (gen === 'extraccion' || gen === 'ausente') {
        const strokeColor = gen === 'extraccion' ? '#dc2626' : '#94a3b8';
        markSVG = `
            <svg viewBox="0 0 100 100" style="position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none;">
                <line x1="12" y1="10" x2="88" y2="90" stroke="white" stroke-width="7" stroke-linecap="round" />
                <line x1="88" y1="10" x2="12" y2="90" stroke="white" stroke-width="7" stroke-linecap="round" />
                <line x1="12" y1="10" x2="88" y2="90" stroke="${strokeColor}" stroke-width="3.8" stroke-linecap="round" />
                <line x1="88" y1="10" x2="12" y2="90" stroke="${strokeColor}" stroke-width="3.8" stroke-linecap="round" />
            </svg>
        `;
    } else if (gen === 'diente_sano') {
        markSVG = `
            <svg viewBox="0 0 100 100" style="position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none;">
                <g ${isUpper ? 'transform="translate(0 100) scale(1 -1)"' : ''}>
                    <path d="M 40,20 L 47,28 L 60,11" fill="none" stroke="white" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M 40,20 L 47,28 L 60,11" fill="none" stroke="#10b981" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
                </g>
            </svg>
        `;
    } else if (gen && gen.includes('perno')) {
        const color = gen.includes('malo') ? '#e11d48' : '#2563eb';
        markSVG = `
            <svg viewBox="0 0 100 100" style="position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none;">
                <g ${isUpper ? 'transform="translate(0 100) scale(1 -1)"' : ''}>
                    <path d="M 38,24 H 62" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" />
                    <path d="M 50,24 L 50,88 L 45,80" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" />
                </g>
            </svg>
        `;
    } else if (gen && gen.includes('endodoncia')) {
        const color = gen.includes('mala') ? '#ef4444' : '#2563eb';
        markSVG = `
            <svg viewBox="0 0 100 100" style="position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none;">
                <g ${isUpper ? 'transform="translate(0 100) scale(1 -1)"' : ''}>
                    <path d="M 50,20 Q 50,45 50,88" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" />
                    <path d="M 42,20 Q 42,45 38,88" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" />
                    <path d="M 58,20 Q 58,45 62,88" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" />
                </g>
            </svg>
        `;
    } else if (gen && gen.includes('implante')) {
        const color = gen.includes('malo') ? '#e11d48' : '#2563eb';
        markSVG = `
            <svg viewBox="0 0 100 100" style="position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none;">
                <g ${isUpper ? 'transform="translate(0 100) scale(1 -1)"' : ''}>
                    <rect x="38" y="9" width="24" height="18" rx="5" fill="white" fill-opacity="0.9" stroke="${color}" stroke-width="2.8" />
                    <path d="M 43,28 L 57,28 L 54,86 L 50,93 L 46,86 Z" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="2.8" />
                </g>
            </svg>
        `;
    } else if (gen && gen.includes('corona')) {
        const color = gen.includes('des') || gen.includes('malo') ? '#ef4444' : '#2563eb';
        markSVG = `
            <svg viewBox="0 0 100 100" style="position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none;">
                <circle cx="50" cy="50" r="46" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="${gen.includes('des') ? '4,2' : 'none'}" />
            </svg>
        `;
    } else if (gen && (gen.includes('carilla') || gen === 'carilla_adap' || gen === 'carilla_des')) {
        const color = gen.includes('des') ? '#ef4444' : '#3b82f6';
        markSVG = `
            <svg viewBox="0 0 100 100" style="position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none;">
                <g ${isUpper ? 'transform="translate(0 100) scale(1 -1)"' : ''}>
                    <path d="M 30,12 Q 50,2 70,12 Q 74,32 70,42 Q 50,48 30,42 Z" fill="none" stroke="${color}" stroke-width="3" />
                </g>
            </svg>
        `;
    } else if (gen && gen === 'lesion_apical') {
        markSVG = `
            <svg viewBox="0 0 100 100" style="position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none;">
                <circle cx="50" cy="${isUpper ? 10 : 90}" r="8" fill="#b91c1c" stroke="white" stroke-width="2" />
            </svg>
        `;
    } else if (gen && gen === 'resto_radicular') {
        markSVG = `
            <svg viewBox="0 0 100 100" style="position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none;">
                <line x1="20" y1="15" x2="80" y2="85" stroke="#78716c" stroke-width="4" stroke-linecap="round" />
            </svg>
        `;
    }

    // Reflejo visual de restauraciones y caries superficiales en la corona del diente impreso
    let surfaceSVG = '';
    const topCol = getSectorColor(toothData, 'top');
    const centerCol = getSectorColor(toothData, 'center');
    const bottomCol = getSectorColor(toothData, 'bottom');
    const leftCol = getSectorColor(toothData, 'left');
    const rightCol = getSectorColor(toothData, 'right');

    const hasAnySurface = topCol !== '#ffffff' || centerCol !== '#ffffff' || bottomCol !== '#ffffff' || leftCol !== '#ffffff' || rightCol !== '#ffffff';

    if (hasAnySurface && !gen) {
        // En arcada superior la corona está en la mitad inferior (baseY ~60), en inferior está arriba (baseY ~10)
        const baseY = isUpper ? 60 : 8;
        surfaceSVG = `
            <svg viewBox="0 0 100 100" style="position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none;">
                <g opacity="0.9">
                    ${topCol !== '#ffffff' ? `<ellipse cx="50" cy="${baseY + 5}" rx="16" ry="6" fill="${topCol}" stroke="#0f172a" stroke-width="1.2" />` : ''}
                    ${centerCol !== '#ffffff' ? `<circle cx="50" cy="${baseY + 15}" r="7.5" fill="${centerCol}" stroke="#0f172a" stroke-width="1.2" />` : ''}
                    ${bottomCol !== '#ffffff' ? `<ellipse cx="50" cy="${baseY + 25}" rx="16" ry="6" fill="${bottomCol}" stroke="#0f172a" stroke-width="1.2" />` : ''}
                    ${leftCol !== '#ffffff' ? `<ellipse cx="30" cy="${baseY + 15}" rx="6" ry="10" fill="${leftCol}" stroke="#0f172a" stroke-width="1.2" />` : ''}
                    ${rightCol !== '#ffffff' ? `<ellipse cx="70" cy="${baseY + 15}" rx="6" ry="10" fill="${rightCol}" stroke="#0f172a" stroke-width="1.2" />` : ''}
                </g>
            </svg>
        `;
    }

    return `
        <div style="width: 26px; height: 38px; position: relative; overflow: hidden; margin: 0 auto; opacity: ${opacity};">
            <div style="position: absolute; inset: 0; background-image: url('${cfg.img}'); background-size: ${bgSizeXPct}% auto; background-repeat: no-repeat; background-position: ${bgPosXPct.toFixed(2)}% ${cfg.posY};"></div>
            ${surfaceSVG}
            ${markSVG}
        </div>
    `;
};

export const generateOralDriveOdontogramaPrintHTML = ({
    sesion,
    paciente = {},
    userProfile = {},
    baseUrl = window.location.origin + "/"
}) => {
    const tenant = userProfile?.tenant || {};
    const clinicName = tenant.nombreComercial || tenant.nombre || tenant.name || "CLÍNICA DENTAL";
    const clinicNit = tenant.nit || "—";
    const clinicAddress = tenant.direccion || "—";
    const clinicPhone = tenant.telefono || "—";
    const clinicEmail = tenant.email || "";
    const logoUrl = tenant.logo || "";

    const fechaSesion = sesion?.creado
        ? (sesion.creado.toDate ? sesion.creado.toDate() : new Date(sesion.creado))
        : new Date();
    const fechaSesionStr = fechaSesion.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });
    const horaSesionStr = fechaSesion.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit"
    });

    const fechaImpresionStr = new Date().toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    });

    const odontogramaData = sesion?.data || sesion?.hallazgos?.data || {};
    const planItems = sesion?.plan || sesion?.hallazgos?.plan || [];
    const tipoDenticion = sesion?.tipoDenticion || sesion?.hallazgos?.tipoDenticion || "adulto";
    const showTemporary = tipoDenticion === "temporal" || tipoDenticion === "mixta" || tipoDenticion === "completo" || tipoDenticion === "nino";
    const showPermanent = tipoDenticion !== "temporal" && tipoDenticion !== "nino";

    // Si planItems está vacío pero hay datos en odontogramaData, extraemos los hallazgos
    let hallazgosList = [...planItems];
    if (hallazgosList.length === 0 && Object.keys(odontogramaData).length > 0) {
        Object.entries(odontogramaData).forEach(([diente, marks]) => {
            if (marks.general?.id) {
                hallazgosList.push({
                    diente,
                    tratamiento: marks.general.id.replace(/_/g, " ").toUpperCase(),
                    zonaLabel: "Pieza Completa",
                    fechaISO: sesion?.creado || new Date().toISOString()
                });
            }
            ["top", "right", "bottom", "left", "center"].forEach(z => {
                if (marks[z]?.id) {
                    const zonaLabelMap = {
                        top: "Vestibular",
                        center: "Oclusal/Incisal",
                        bottom: parseInt(diente) <= 28 || (parseInt(diente) >= 51 && parseInt(diente) <= 65) ? "Palatina" : "Lingual",
                        left: "Mesial/Distal",
                        right: "Distal/Mesial"
                    };
                    hallazgosList.push({
                        diente,
                        tratamiento: marks[z].id.replace(/_/g, " ").toUpperCase(),
                        zonaLabel: zonaLabelMap[z] || z,
                        fechaISO: sesion?.creado || new Date().toISOString()
                    });
                }
            });
        });
    }

    const upperPerm = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
    const lowerPerm = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
    const upperTemp = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
    const lowerTemp = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

    const firmaDoctorImg = sesion?.firmaDoctor || sesion?.hallazgos?.firmaDoctor || userProfile?.firmaElectronica || userProfile?.firma || "";
    const firmaPacienteImg = sesion?.firmaPaciente || sesion?.hallazgos?.firmaPaciente || sesion?.firmaUrl || "";

    const renderToothBlock = (num, isUpper) => {
        const tData = odontogramaData[String(num)] || {};
        return `
            <div style="display: flex; flex-direction: column; align-items: center; width: 28px; flex-shrink: 0;">
                ${isUpper ? `
                    ${renderToothSprite(num, baseUrl, tData, isUpper)}
                    <span style="font-size: 9px; font-weight: 800; color: #334155; margin: 1px 0;">${num}</span>
                    ${renderToothCircleSVG(tData)}
                ` : `
                    ${renderToothCircleSVG(tData)}
                    <span style="font-size: 9px; font-weight: 800; color: #334155; margin: 1px 0;">${num}</span>
                    ${renderToothSprite(num, baseUrl, tData, isUpper)}
                `}
            </div>
        `;
    };

    const renderArcadaRow = (teethArray, isUpper) => {
        const half = Math.floor(teethArray.length / 2);
        const leftGroup = teethArray.slice(0, half);
        const rightGroup = teethArray.slice(half);

        return `
            <div style="display: flex; justify-content: center; align-items: center; gap: 2px; margin: 3px 0;">
                <div style="display: flex; gap: 2px;">
                    ${leftGroup.map(n => renderToothBlock(n, isUpper)).join("")}
                </div>
                <div style="width: 14px; border-left: 1.5px dashed #cbd5e1; height: 60px; margin: 0 4px;"></div>
                <div style="display: flex; gap: 2px;">
                    ${rightGroup.map(n => renderToothBlock(n, isUpper)).join("")}
                </div>
            </div>
        `;
    };

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Odontograma - ${paciente.nombreCompleto || 'Paciente'}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0;
            padding: 24px 32px;
            color: #0f172a;
            background: #ffffff;
            font-size: 11px;
            line-height: 1.35;
        }

        @page {
            size: letter portrait;
            margin: 12mm 15mm;
        }

        .header-table {
            width: 100%;
            margin-bottom: 8px;
            border-bottom: 2px solid #0284c7;
            padding-bottom: 8px;
        }

        .header-logo {
            max-height: 52px;
            max-width: 140px;
            object-fit: contain;
        }

        .demographic-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            margin-bottom: 10px;
            border: 1px solid #94a3b8;
        }

        .demographic-table td {
            border: 1px solid #cbd5e1;
            padding: 4px 6px;
            vertical-align: middle;
        }

        .demographic-table .lbl {
            font-weight: 800;
            color: #475569;
            background: #f8fafc;
            width: 15%;
            font-size: 9.5px;
        }

        .demographic-table .val {
            color: #0f172a;
            font-weight: 600;
            width: 35%;
        }

        .section-bar {
            background: #f8fafc;
            border: 1px solid #94a3b8;
            border-radius: 3px;
            padding: 4px 0;
            text-align: center;
            font-weight: 800;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #1e293b;
            margin: 6px 0;
        }

        .odontogram-visual-container {
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 6px 4px;
            background: #ffffff;
            margin-bottom: 10px;
        }

        .findings-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9.5px;
            margin-top: 6px;
            border: 1px solid #94a3b8;
        }

        .findings-table th {
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 5px 6px;
            font-weight: 800;
            color: #334155;
            text-align: left;
            text-transform: uppercase;
            font-size: 9px;
            letter-spacing: 0.04em;
        }

        .findings-table td {
            border: 1px solid #cbd5e1;
            padding: 4px 6px;
            color: #1e293b;
        }

        .findings-table tr:nth-child(even) {
            background: #f8fafc;
        }

        .observations-box {
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 6px 8px;
            background: #f8fafc;
            margin-top: 8px;
            font-size: 9.5px;
        }

        .signatures-grid {
            margin-top: 32px;
            display: table;
            width: 100%;
        }

        .signature-cell {
            display: table-cell;
            width: 50%;
            text-align: center;
            padding: 0 24px;
            vertical-align: bottom;
        }

        .sig-line {
            border-top: 1.5px solid #475569;
            padding-top: 4px;
            margin-top: 6px;
        }

        .page-footer {
            margin-top: 18px;
            border-top: 1px solid #e2e8f0;
            padding-top: 6px;
            display: flex;
            justify-content: space-between;
            font-size: 9px;
            color: #64748b;
        }
    </style>
</head>
<body>

    <!-- ── ENCABEZADO DE CLÍNICA ── -->
    <table class="header-table" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="width: 160px; vertical-align: middle;">
                ${logoUrl 
                    ? `<img src="${logoUrl}" class="header-logo" alt="Logo" />` 
                    : `<div style="font-size: 18px; font-weight: 900; color: #0284c7;">${clinicName}</div>`
                }
            </td>
            <td style="text-align: center; vertical-align: middle;">
                <div style="font-size: 13px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -0.02em;">
                    ${clinicName}
                </div>
                <div style="font-size: 9.5px; font-weight: 700; color: #334155;">NIT: ${clinicNit}</div>
                <div style="font-size: 9px; color: #64748b;">${clinicAddress} ${clinicPhone ? `• Tel: ${clinicPhone}` : ''}</div>
            </td>
            <td style="width: 160px; text-align: right; vertical-align: middle;">
                <div style="display: inline-block; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; font-size: 9px; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">
                    Odontograma Clínico
                </div>
                <div style="font-size: 8.5px; color: #64748b; margin-top: 4px; font-weight: 600;">
                    Emisión: ${fechaImpresionStr}
                </div>
            </td>
        </tr>
    </table>

    <!-- ── TABLA DEMOGRÁFICA DEL PACIENTE (MATCHING ORALDRIVE) ── -->
    <table class="demographic-table">
        <tr>
            <td class="lbl">Nombre del paciente</td>
            <td class="val" style="font-weight: 800; color: #0f172a;">${paciente.nombreCompleto || "—"}</td>
            <td class="lbl">Edad</td>
            <td class="val">${paciente.edad ? `${paciente.edad} años` : "—"}</td>
            <td class="lbl">Nro Historia</td>
            <td class="val">${paciente.nroHistoria || paciente.numeroDocumento || "—"}</td>
        </tr>
        <tr>
            <td class="lbl">Tipo documento</td>
            <td class="val">${paciente.tipoDocumento || "Cédula de Ciudadanía"}</td>
            <td class="lbl">Nro de documento</td>
            <td class="val">${paciente.numeroDocumento || paciente.nroDocumento || "—"}</td>
            <td class="lbl">Sexo</td>
            <td class="val">${paciente.genero || paciente.sexo || "—"}</td>
        </tr>
        <tr>
            <td class="lbl">Correo</td>
            <td class="val">${paciente.email || paciente.correo || "—"}</td>
            <td class="lbl">Ocupación</td>
            <td class="val">${paciente.ocupacion || "—"}</td>
            <td class="lbl">Doctor/Profesional</td>
            <td class="val" style="font-weight: 700;">${sesion?.profesional || paciente.dentistaResponsable || userProfile?.nombreCompleto || "Profesional de Planta"}</td>
        </tr>
        <tr>
            <td class="lbl">Teléfono</td>
            <td class="val">${paciente.telefono || paciente.celular || "—"}</td>
            <td class="lbl">EPS / Convenio</td>
            <td class="val">${paciente.eps || "Particular"}</td>
            <td class="lbl">Fecha Sesión</td>
            <td class="val">${fechaSesionStr} ${horaSesionStr}</td>
        </tr>
        <tr>
            <td class="lbl">Nombre responsable</td>
            <td class="val">${paciente.nombreResponsable || paciente.responsableNombre || "—"}</td>
            <td class="lbl">Tel. Responsable</td>
            <td class="val">${paciente.telefonoResponsable || "—"}</td>
            <td class="lbl">Dirección</td>
            <td class="val">${paciente.direccion || "—"}</td>
        </tr>
    </table>

    <!-- ── BARRA DE SECCIÓN: ODONTOGRAMA ── -->
    <div class="section-bar">Odontograma</div>

    <!-- ── DIAGRAMA VISUAL DEL ODONTOGRAMA (VECTORIAL + SPRITE) ── -->
    <div class="odontogram-visual-container">
        ${showPermanent ? renderArcadaRow(upperPerm, true) : ''}
        ${showTemporary ? renderArcadaRow(upperTemp, true) : ''}
        
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin: 4px 0;">
            <div style="flex: 1; border-top: 1px dashed #cbd5e1;"></div>
            <span style="font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em;">
                Plano Oclusal
            </span>
            <div style="flex: 1; border-top: 1px dashed #cbd5e1;"></div>
        </div>

        ${showTemporary ? renderArcadaRow(lowerTemp, false) : ''}
        ${showPermanent ? renderArcadaRow(lowerPerm, false) : ''}
    </div>

    <!-- ── TABLA DE HALLAZGOS (EXACTAMENTE COMO ORALDRIVE) ── -->
    <table class="findings-table">
        <thead>
            <tr>
                <th style="width: 18%;">Fecha de creación</th>
                <th style="width: 32%;">Doctor</th>
                <th style="width: 10%; text-align: center;">Pieza</th>
                <th style="width: 20%;">Situación</th>
                <th style="width: 20%;">Cara afectada</th>
            </tr>
        </thead>
        <tbody>
            ${hallazgosList.length === 0 ? `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 12px; color: #94a3b8; font-style: italic;">
                        Sin hallazgos clínicos registrados en esta sesión
                    </td>
                </tr>
            ` : hallazgosList.map(h => {
                const fDate = h.fechaISO ? new Date(h.fechaISO) : fechaSesion;
                const fStr = fDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) + " " + fDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                return `
                    <tr>
                        <td style="font-weight: 600; color: #475569;">${fStr}</td>
                        <td style="font-weight: 700; color: #0f172a;">${sesion?.profesional || userProfile?.nombreCompleto || "Odontólogo Tratante"}</td>
                        <td style="text-align: center; font-weight: 900; color: #0284c7;">#${h.diente}</td>
                        <td style="font-weight: 700; color: #334155;">${h.tratamiento || "Tratamiento"}</td>
                        <td style="color: #475569;">${h.zonaLabel || h.zona || "Pieza Completa"}</td>
                    </tr>
                `;
            }).join("")}
        </tbody>
    </table>

    <!-- ── OBSERVACIONES CLÍNICAS (SI EXISTEN) ── -->
    ${sesion?.observaciones ? `
        <div class="observations-box">
            <span style="font-weight: 800; color: #334155; text-transform: uppercase;">Observaciones: </span>
            <span style="color: #475569;">${sesion.observaciones}</span>
        </div>
    ` : ''}

    <!-- ── SECCIÓN DE FIRMAS LEGALES ── -->
    <div class="signatures-grid">
        <div class="signature-cell">
            <div style="height: 60px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 2px;">
                ${firmaDoctorImg ? `<img src="${firmaDoctorImg}" style="max-height: 55px; max-width: 220px; object-fit: contain;" />` : ''}
            </div>
            <div class="sig-line">
                <div style="font-size: 10px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
                    ${sesion?.profesional || userProfile?.nombreCompleto || "Odontólogo Tratante"}
                </div>
                <div style="font-size: 8.5px; color: #64748b; font-weight: 700; text-transform: uppercase;">
                    Firma del Especialista / Odontólogo • ${userProfile?.registroMedico ? `TP: ${userProfile.registroMedico}` : 'Registro Médico'}
                </div>
            </div>
        </div>

        <div class="signature-cell">
            <div style="height: 60px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 2px;">
                ${firmaPacienteImg ? `<img src="${firmaPacienteImg}" style="max-height: 55px; max-width: 220px; object-fit: contain;" />` : ''}
            </div>
            <div class="sig-line">
                <div style="font-size: 10px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
                    ${paciente.nombreCompleto || "Paciente"}
                </div>
                <div style="font-size: 8.5px; color: #64748b; font-weight: 700; text-transform: uppercase;">
                    Firma del Paciente / Acompañante • Doc: ${paciente.numeroDocumento || paciente.nroDocumento || '—'}
                </div>
            </div>
        </div>
    </div>

    <!-- ── FOOTER DE PÁGINA ── -->
    <div class="page-footer">
        <div>1 de 1</div>
        <div>${clinicAddress} ${clinicPhone ? `• Tel: ${clinicPhone}` : ''} • OdontoCloud Elite</div>
    </div>

    <script>
        window.onload = function() {
            setTimeout(function() {
                window.focus();
                window.print();
            }, 250);
        };
    </script>
</body>
</html>
    `;
};
