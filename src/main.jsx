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

const baseUrl = import.meta.env.BASE_URL ? import.meta.env.BASE_URL.replace(/\/$/, '') : '';

createRoot(document.getElementById('root')).render(
    <HelmetProvider>
        <AuthProvider>
            <ToastProvider>
                <BrowserRouter basename={baseUrl}>
                    <App />
                </BrowserRouter>
            </ToastProvider>
        </AuthProvider>
    </HelmetProvider>
)

// Clean up development service workers
if ('serviceWorker' in navigator && import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) {
            registration.unregister().then(() => {
                console.log('Service Worker removido para evitar caché en desarrollo.');
            });
        }
    });
}

