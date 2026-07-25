import React from 'react';

// Mapeo ISO → imagen PNG disponible
const TOOTH_IMAGE = {
    incisor: '/images/teeth/incisor.png',
    canine: '/images/teeth/canine.png',
    premolar: '/images/teeth/premolar.png',
    molar: '/images/teeth/molar.png',
};

const getToothType = (iso) => {
    const n = iso % 10;
    if (n >= 1 && n <= 2) return 'incisor';
    if (n === 3) return 'canine';
    if (n >= 4 && n <= 5) return 'premolar';
    return 'molar';
};

export default function ToothAnatomy({ numero }) {
    const type = getToothType(numero);
    // Superiores: cuadrante 1,2 (11-28) y temporales 5,6 (51-65)
    const isUpper = (numero >= 11 && numero <= 28) || (numero >= 51 && numero <= 65);

    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                userSelect: 'none',
                transform: isUpper ? 'scaleY(-1)' : 'none',
            }}
        >
            <img
                src={TOOTH_IMAGE[type]}
                alt={`Diente ${numero}`}
                draggable={false}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                }}
            />
        </div>
    );
}
