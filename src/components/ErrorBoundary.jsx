import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 max-w-2xl mx-auto mt-10 bg-white rounded-xl shadow-lg border border-red-100">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">⚠️ Algo salió mal</h1>
                    <p className="text-slate-600 mb-4">
                        Se ha producido un error al renderizar este componente.
                    </p>
                    <div className="bg-slate-100 p-4 rounded-lg overflow-auto text-xs font-mono border border-slate-200">
                        <p className="font-bold text-red-800 mb-2">{this.state.error && this.state.error.toString()}</p>
                        <pre className="text-slate-500 whitespace-pre-wrap">
                            {this.state.errorInfo && this.state.errorInfo.componentStack}
                        </pre>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-6 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
                    >
                        Recargar Página
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
