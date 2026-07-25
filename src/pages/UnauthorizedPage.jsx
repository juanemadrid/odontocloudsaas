import React from 'react';
import { Link } from 'react-router-dom';

export default function UnauthorizedPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
            <h1 className="text-4xl font-bold text-red-500 mb-4">Acceso Denegado</h1>
            <p className="text-lg mb-8">No tienes permisos para ver esta página.</p>
            <Link to="/" className="px-6 py-3 bg-blue-600 rounded hover:bg-blue-700 transition">
                Volver al Inicio
            </Link>
        </div>
    );
}
