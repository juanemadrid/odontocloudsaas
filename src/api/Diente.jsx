// src/modules/odontograma/components/Diente.jsx
import React, { useState } from "react";
import { motion } from "framer-motion";

// Mapeo de colores y efectos según estado (Solid Colors matching OralDrive)
const STATUS_STYLES = {
    'caries': { fill: "#dc2626" }, // Red
    'obturado': { fill: "#2563eb" }, // Blue
    'endodoncia': { fill: "#d97706" }, // Amber
    'corona': { fill: "#9333ea" }, // Purple
    'extraccion': { fill: "#57534e" }, // Gray/Black
    'puente': { fill: "#6366f1" }, // Indigo/Bridge
    'sano': { fill: "#ffffff" } // White
};

const Diente = React.memo(({
    numero,
    data = {},
    onSurfaceClick,
}) => {
    const [hoveredZone, setHoveredZone] = useState(null);
    const isAusente = data.general?.id === "ausente";

    const getFill = (zona) => {
        const estadoObj = data[zona];
        const statusId = estadoObj?.id || 'sano';

        // Custom color
        if (estadoObj?.color && !STATUS_STYLES[statusId]) return estadoObj.color;

        return STATUS_STYLES[statusId]?.fill || "#ffffff";
    };

    // Geometric Paths for "Wheel" (Standard Odontogram)
    // Center Circle + 4 Sectors
    const SectorPath = ({ d, zona }) => {
        const fill = getFill(zona);
        const isHovered = hoveredZone === zona;

        return (
            <motion.path
                d={d}
                fill={fill}
                stroke="#000000"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                onMouseEnter={() => setHoveredZone(zona)}
                onMouseLeave={() => setHoveredZone(null)}
                onClick={() => onSurfaceClick(numero, zona)}
                initial={false}
                animate={{
                    fill: fill,
                    opacity: isHovered ? 0.7 : 1
                }}
                style={{ cursor: "pointer" }}
            />
        );
    };

    return (
        <div className="relative flex flex-col items-center group m-0.5">
            {/* Interaction Area: 40x40 circle map */}
            <div className={`relative w-10 h-10 transition-opacity ${isAusente ? 'opacity-20' : 'opacity-100'}`}>
                <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">

                    {/* CIRCULAR / WHEEL MAP for OralDrive Style */}
                    {/* Ring divided by diagonals, with a center circle */}

                    {/* TOP SECTOR (Vestibular/Lingual depending on arch) */}
                    <SectorPath
                        d="M15,15 L35,35 A21,21 0 0 1 65,35 L85,15 A49,49 0 0 0 15,15 Z"
                        zona="top"
                    />

                    {/* BOTTOM SECTOR */}
                    <SectorPath
                        d="M15,85 A49,49 0 0 0 85,85 L65,65 A21,21 0 0 1 35,65 L15,85 Z"
                        zona="bottom"
                    />

                    {/* LEFT SECTOR */}
                    <SectorPath
                        d="M15,15 A49,49 0 0 0 15,85 L35,65 A21,21 0 0 1 35,35 L15,15 Z"
                        zona="left"
                    />

                    {/* RIGHT SECTOR */}
                    <SectorPath
                        d="M85,15 L65,35 A21,21 0 0 1 65,65 L85,85 A49,49 0 0 0 85,15 Z"
                        zona="right"
                    />

                    {/* CENTER SECTOR (Occlusal) */}
                    <SectorPath
                        d="M50,50 m-22,0 a22,22 0 1,0 44,0 a22,22 0 1,0 -44,0"
                        zona="center"
                    />

                </svg>

                {/* X MARK FOR ABSENT */}
                {isAusente && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <svg viewBox="0 0 100 100" className="w-full h-full p-1 opacity-90">
                            <line x1="0" y1="0" x2="100" y2="100" stroke="#333" strokeWidth="4" />
                            <line x1="100" y1="0" x2="0" y2="100" stroke="#333" strokeWidth="4" />
                        </svg>
                    </div>
                )}
            </div>
        </div>
    );
});

export default Diente;
