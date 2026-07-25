import React from 'react';

export default function Card({ children, className = '', glass = false, style = {} }) {
    const cardStyle = {
        background: glass ? 'var(--glass-bg)' : 'var(--bg-card)',
        backdropFilter: glass ? 'var(--glass-blur)' : 'none',
        border: glass ? '1px solid var(--glass-border)' : '1px solid #E2E8F0',
        borderRadius: 'var(--radius-xl)',
        boxShadow: glass ? 'var(--glass-shadow)' : '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
        padding: '1.5rem',
        ...style
    };

    return (
        <div className={`card-component ${className}`} style={cardStyle}>
            {children}
        </div>
    );
}
