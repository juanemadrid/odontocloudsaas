/* eslint-disable react/prop-types */
import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Dashboard Module Error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center p-8 bg-red-50 border border-red-200 rounded-2xl m-4 animate-in fade-in duration-500 h-full">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4 shadow-sm">
                        <span className="text-3xl">⚠️</span>
                    </div>
                    <h2 className="text-xl font-black text-red-800 mb-2 uppercase tracking-wide">Error en el módulo</h2>
                    <p className="text-sm text-red-600 font-medium mb-6 text-center max-w-md">
                        Ocurrió un problema inesperado al cargar esta sección.
                        <br />
                        <span className="opacity-70 text-xs">Por favor reporta este error al soporte técnico.</span>
                    </p>

                    <div className="bg-white p-4 rounded-xl border border-red-100 w-full max-w-3xl overflow-auto custom-scrollbar shadow-inner max-h-[300px]">
                        <pre className="text-xs font-mono text-red-700 whitespace-pre-wrap leading-relaxed">
                            {this.state.error && this.state.error.toString()}
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </pre>
                    </div>

                    <div className="flex gap-4 mt-8">
                        <button
                            onClick={() => this.setState({ hasError: false })}
                            className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition shadow-sm"
                        >
                            Intentar de nuevo
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-red-700 transition shadow-lg shadow-red-200"
                        >
                            Recargar Página
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
