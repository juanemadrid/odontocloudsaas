import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { HelmetProvider } from 'react-helmet-async';
import App from './App'
import './index.css'
import './styles/theme.css'
import './styles/global.css'

import { ToastProvider } from './context/ToastContext'

createRoot(document.getElementById('root')).render(
    <HelmetProvider>
        <AuthProvider>
            <ToastProvider>
                <BrowserRouter basename="/odontocloud-react">
                    <App />
                </BrowserRouter>
            </ToastProvider>
        </AuthProvider>
    </HelmetProvider>
)

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    if (import.meta.env.DEV) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
            for (let registration of registrations) {
                registration.unregister().then(() => {
                    console.log('Service Worker removido para evitar caché en desarrollo.');
                });
            }
        });
    } else {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/odontocloud-react/sw.js')
                .then((reg) => console.log('Service Worker registrado con éxito:', reg.scope))
                .catch((err) => console.error('Error al registrar el Service Worker:', err));
        });
    }
}

