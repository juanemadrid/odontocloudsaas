import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { BrandingProvider } from './context/BrandingContext';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { HelmetProvider } from 'react-helmet-async';

// Mock matchMedia for various UI libraries
window.matchMedia = window.matchMedia || function () {
    return {
        matches: false,
        addListener: function () { },
        removeListener: function () { }
    };
};

describe('App Smoke Test', () => {
    it('renders without crashing and shows lazy loading state', () => {
        render(
            <HelmetProvider>
                <BrandingProvider>
                    <AuthProvider>
                        <ToastProvider>
                            <BrowserRouter>
                                <App />
                            </BrowserRouter>
                        </ToastProvider>
                    </AuthProvider>
                </BrandingProvider>
            </HelmetProvider>
        );
        // Because of Lazy Loading, we might see "Cargando..."
        // Or if it loads fast, the Landing/Login content.
        // Let's just check if container exists or loading text
        expect(screen.getByText(/Cargando/i)).toBeInTheDocument();
    });
});
