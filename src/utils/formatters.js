/**
 * Formateador de moneda para Pesos Colombianos (COP)
 * Utiliza el punto (.) como separador de miles.
 */
export const formatCurrency = (value) => {
    const num = Number(value || 0);
    return num.toLocaleString('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
};

/**
 * Formateador de fecha corto (DD/MM/YYYY)
 */
export const formatDate = (date) => {
    if (!date) return '—';
    const d = new Date(date);
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

