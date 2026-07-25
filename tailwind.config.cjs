/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./src/modules/**/*.{js,ts,jsx,tsx}", // Explicitly include modules
    ],
    theme: {
        container: {
            center: true,
            padding: '2rem',
            screens: {
                sm: '640px',
                md: '768px',
                lg: '1024px',
                xl: '1280px',
                '2xl': '1400px',
            }
        },
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
                display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
            },
            colors: {
                primary: {
                    DEFAULT: '#022a63',
                    light: '#00aeef',
                    dark: '#0f172a',
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                },
                secondary: {
                    DEFAULT: '#97c93d',
                    light: '#bef264',
                    dark: '#65a30d',
                },
                accent: {
                    DEFAULT: '#00aeef',
                    hover: '#0ea5e9',
                },
                // Nuevos colores futuristas (Reload Triggered)
                galaxy: {
                    900: '#0B0E14', // Fondo ultra oscuro
                    800: '#151A25', // Paneles oscuros
                    700: '#1E2433', // Bordes / Elementos secundarios
                },
                neon: {
                    blue: '#00f0ff',
                    purple: '#7000ff',
                    pink: '#ff00aa',
                }
            },
            boxShadow: {
                'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.3)', // Sombra más oscura para modo dark
                'premium': '0 20px 40px -5px rgba(0, 0, 0, 0.5), 0 10px 20px -5px rgba(0, 0, 0, 0.2)',
                'neon': '0 0 10px rgba(0, 240, 255, 0.5), 0 0 20px rgba(0, 240, 255, 0.3)',
            },
            borderRadius: {
                'xl': '1rem',
                '2xl': '1.5rem',
                '3xl': '2rem',
            },
            animation: {
                'blob': 'blob 10s infinite',
                'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                blob: {
                    '0%': {
                        transform: 'translate(0px, 0px) scale(1)',
                    },
                    '33%': {
                        transform: 'translate(30px, -50px) scale(1.1)',
                    },
                    '66%': {
                        transform: 'translate(-20px, 20px) scale(0.9)',
                    },
                    '100%': {
                        transform: 'translate(0px, 0px) scale(1)',
                    },
                }
            }
        },
    },
    plugins: [],
}
