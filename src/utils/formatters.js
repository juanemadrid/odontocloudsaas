/**
 * Formateador de moneda para Pesos Colombianos (COP)
 * Utiliza el punto (.) como separador de miles.
 */
export const formatCurrency = (value) => {
    const num = Number(value || 0);
    return num.toLocaleString('es-CO', {
        minimumFractionDigits: num % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2
    });
};

/**
 * Formateador de moneda con símbolo para COP ($ 102.400,63)
 */
export const formatCurrencyCOP = (value) => {
    const num = Number(value || 0);
    return num.toLocaleString('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: num % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 2
    });
};

/**
 * Parsea cualquier valor numérico ingresado por el usuario (soporta separadores de coma y punto)
 * Convierte strings como "102.400,63", "102400.63" o "102400,63" a float nativo 102400.63
 */
export const parseRawNumber = (val) => {
    if (val === undefined || val === null || val === "") return 0;
    if (typeof val === "number") return isNaN(val) ? 0 : val;

    let str = String(val).trim();
    if (!str) return 0;

    const hasDot = str.includes(".");
    const hasComma = str.includes(",");

    if (hasDot && hasComma) {
        const lastDot = str.lastIndexOf(".");
        const lastComma = str.lastIndexOf(",");
        if (lastComma > lastDot) {
            // Estándar colombiano: 102.400,63 -> elimina puntos, coma pasa a punto decimal
            str = str.replace(/\./g, "").replace(",", ".");
        } else {
            // Estándar internacional: 102,400.63 -> elimina comas
            str = str.replace(/,/g, "");
        }
    } else if (hasComma) {
        const commaCount = (str.match(/,/g) || []).length;
        if (commaCount === 1) {
            str = str.replace(",", ".");
        } else {
            str = str.replace(/,/g, "");
        }
    } else if (hasDot) {
        const dotCount = (str.match(/\./g) || []).length;
        if (dotCount > 1) {
            str = str.replace(/\./g, "");
        } else {
            const parts = str.split(".");
            if (parts[1].length === 3 && parts[0].length <= 3) {
                str = parts[0] + parts[1];
            }
        }
    }

    str = str.replace(/[^0-9.-]/g, "");
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
};

/**
 * Formatea un número o texto mientras el usuario escribe en inputs monetarios.
 * Respeta comas y puntos decimales ingresados por el usuario.
 */
export const formatNumberWithDots = (val) => {
    if (val === undefined || val === null || val === "") return "";
    const str = String(val).trim();
    if (!str) return "";

    if (typeof val === "number") {
        if (isNaN(val)) return "";
        return val.toLocaleString("es-CO", {
            minimumFractionDigits: val % 1 === 0 ? 0 : 2,
            maximumFractionDigits: 2
        });
    }

    const hasComma = str.includes(",");
    const hasDot = str.includes(".");

    let sep = null;
    let integerPart = str;
    let decimalPart = "";

    if (hasComma && hasDot) {
        const lastComma = str.lastIndexOf(",");
        const lastDot = str.lastIndexOf(".");
        if (lastComma > lastDot) {
            sep = ",";
            integerPart = str.slice(0, lastComma).replace(/\D/g, "");
            decimalPart = str.slice(lastComma + 1).replace(/\D/g, "").slice(0, 2);
        } else {
            sep = ".";
            integerPart = str.slice(0, lastDot).replace(/\D/g, "");
            decimalPart = str.slice(lastDot + 1).replace(/\D/g, "").slice(0, 2);
        }
    } else if (hasComma) {
        sep = ",";
        const parts = str.split(",");
        integerPart = parts[0].replace(/\D/g, "");
        decimalPart = parts.slice(1).join("").replace(/\D/g, "").slice(0, 2);
    } else if (hasDot) {
        const parts = str.split(".");
        if (parts.length === 2 && parts[1].length <= 2) {
            sep = ",";
            integerPart = parts[0].replace(/\D/g, "");
            decimalPart = parts[1].replace(/\D/g, "").slice(0, 2);
        } else {
            integerPart = str.replace(/\D/g, "");
        }
    } else {
        integerPart = str.replace(/\D/g, "");
    }

    if (!integerPart && !decimalPart) return "";
    const formattedInt = integerPart ? Number(integerPart).toLocaleString("es-CO") : "0";

    if (sep && (str.endsWith(",") || str.endsWith("."))) {
        return `${formattedInt},`;
    }
    if (decimalPart !== "") {
        return `${formattedInt},${decimalPart}`;
    }
    return formattedInt;
};


/**
 * Formatea y normaliza entradas de dinero en Pesos Colombianos (COP) para inputs interactivos.
 * - Soporta montos enteros: 826.000, 826.050, 3, 1.500.000, etc.
 * - Soporta decimales (centavos): 865.000,32 o 3,50 (con coma oficial o punto).
 * - Distingue puntos de miles de comas decimales sin confundir 826.000 con 8,26.
 * 
 * @param {string|number} val - Entrada a formatear
 * @returns {{ display: string, normalized: string, amount: number }}
 */
export const formatColombianMoneyInput = (val) => {
    if (val === null || val === undefined || val === '') {
        return { display: '', normalized: '0', amount: 0 };
    }

    const str = String(val).trim().replace(/[^0-9,.-]/g, '');
    if (!str) return { display: '', normalized: '0', amount: 0 };

    const hasComma = str.includes(',');
    const hasDot = str.includes('.');

    let integerDigits = '';
    let decimalDigits = null; // null = sin decimales activos

    if (hasComma && hasDot) {
        const lastComma = str.lastIndexOf(',');
        const lastDot = str.lastIndexOf('.');
        if (lastComma > lastDot) {
            // Estándar colombiano: 865.000,32 -> puntos son miles y coma es decimal
            integerDigits = str.slice(0, lastComma).replace(/\D/g, '');
            decimalDigits = str.slice(lastComma + 1).replace(/\D/g, '').slice(0, 2);
        } else {
            // Estándar alternativo: 865,000.32 -> comas miles, punto decimal
            integerDigits = str.slice(0, lastDot).replace(/\D/g, '');
            decimalDigits = str.slice(lastDot + 1).replace(/\D/g, '').slice(0, 2);
        }
    } else if (hasComma) {
        // En Colombia la coma es el separador oficial de centavos/decimales
        const parts = str.split(',');
        integerDigits = parts[0].replace(/\D/g, '');
        if (parts.length > 1) {
            decimalDigits = parts.slice(1).join('').replace(/\D/g, '').slice(0, 2);
        }
    } else if (hasDot) {
        // Solo puntos en el texto
        const parts = str.split('.');
        const lastPart = parts[parts.length - 1];

        // Si tiene exactamente 1 o 2 dígitos después del único punto (ej. '865000.32' o '3.5'):
        // Se interpreta como decimal (centavos ingresados por teclado numérico).
        if (parts.length === 2 && lastPart.length > 0 && lastPart.length <= 2) {
            integerDigits = parts[0].replace(/\D/g, '');
            decimalDigits = lastPart.replace(/\D/g, '');
        } else {
            // Miles colombianos: ej. 826.000, 826.050, 1.500.000 o tipeo progresivo '826.'
            integerDigits = str.replace(/\D/g, '');
        }
    } else {
        // Dígitos puros
        integerDigits = str.replace(/\D/g, '');
    }

    const numInt = Number(integerDigits || '0');
    const fmtInt = integerDigits ? numInt.toLocaleString('es-CO') : '';

    let display = fmtInt;
    let normalized = integerDigits || '0';

    if (decimalDigits !== null) {
        display = (fmtInt || '0') + ',' + decimalDigits;
        normalized = (integerDigits || '0') + (decimalDigits ? '.' + decimalDigits : '');
    } else if (str.endsWith(',') || (str.endsWith('.') && str.replace(/\D/g, '').length >= 4)) {
        display = (fmtInt || '0') + ',';
    }

    const amount = Number(normalized) || 0;
    return { display, normalized, amount };
};

export const parseColombianMoney = (val) => formatColombianMoneyInput(val).amount;

/**
 * Formateador de fecha corto (DD/MM/YYYY)
 */
export const formatDate = (date) => {
    if (!date) return '—';
    if (typeof date === 'string') {
        const match = date.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (match && (!date.includes('T') || date.includes('T00:00:00') || date.includes('T05:00:00'))) {
            const [, y, m, d] = match;
            return `${d}/${m}/${y}`;
        }
    }
    const d = date?.toDate ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-CO');
};

/**
 * Calcula la edad en base a una fecha de nacimiento (YYYY-MM-DD o DD/MM/YYYY)
 * sin desfases de zona horaria.
 */
export const calculateAgeStr = (birthDate) => {
    if (!birthDate) return "";
    
    let birth = null;
    if (typeof birthDate === 'string') {
        if (birthDate.includes("-")) {
            const parts = birthDate.split("-");
            if (parts.length === 3) {
                const y = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10) - 1;
                const d = parseInt(parts[2], 10);
                birth = new Date(y, m, d);
            }
        } else if (birthDate.includes("/")) {
            const parts = birthDate.split("/");
            if (parts.length === 3) {
                const d = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10) - 1;
                const y = parseInt(parts[2], 10);
                birth = new Date(y, m, d);
            }
        }
    }
    
    if (!birth || isNaN(birth.getTime())) {
        birth = new Date(birthDate);
    }
    
    if (isNaN(birth.getTime())) return "";

    const today = new Date();
    let years = today.getFullYear() - birth.getFullYear();
    let months = today.getMonth() - birth.getMonth();
    
    if (months < 0 || (months === 0 && today.getDate() < birth.getDate())) {
        years--;
        months += 12;
    }
    
    if (today.getDate() < birth.getDate()) {
        months--;
        if (months < 0) {
            months += 12;
            years--;
        }
    }

    if (years < 0) return "";
    
    let ageStr = `${years} años`;
    if (months > 0) {
        ageStr += ` y ${months} meses`;
    }
    return ageStr;
};

