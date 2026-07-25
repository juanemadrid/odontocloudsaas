import React from 'react';

export default function Button({
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    style = {},
    ...props
}) {
    // Using pure CSS classes defined in theme.css or inline-styles
    const styles = {
        base: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '600',
            transition: 'all 0.2s ease',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit'
        },
        variants: {
            primary: {
                background: 'linear-gradient(135deg, var(--primary-color), var(--primary-dark))',
                color: '#fff',
                boxShadow: 'var(--shadow-md)'
            },
            secondary: {
                background: 'var(--secondary-color)',
                color: '#fff',
                boxShadow: 'var(--shadow-sm)'
            },
            ghost: {
                background: 'transparent',
                color: 'var(--text-muted)'
            },
            danger: {
                background: 'var(--accent-color)',
                color: '#fff'
            },
            outline: {
                background: 'transparent',
                border: '1px solid var(--text-light)',
                color: 'var(--text-main)'
            }
        },
        sizes: {
            sm: { padding: '0.4rem 0.8rem', fontSize: '0.75rem', borderRadius: 'var(--radius-md)' },
            md: { padding: '0.6rem 1.2rem', fontSize: '0.875rem', borderRadius: 'var(--radius-lg)' },
            lg: { padding: '0.8rem 1.6rem', fontSize: '1rem', borderRadius: 'var(--radius-lg)' }
        }
    };

    const computedStyle = {
        ...styles.base,
        ...styles.variants[variant],
        ...styles.sizes[size],
        ...style
    };

    return (
        <button
            className={`btn-${variant} ${className}`}
            style={computedStyle}
            onMouseEnter={(e) => {
                if (variant === 'primary') e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
                if (variant === 'primary') e.currentTarget.style.transform = 'translateY(0)';
            }}
            {...props}
        >
            {children}
        </button>
    );
}
