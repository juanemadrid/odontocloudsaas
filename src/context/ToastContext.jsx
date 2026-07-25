import React, { createContext, useContext, useState, useCallback } from "react";
import "../styles/toast.css";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = "info") => {
        const id = Date.now() + Math.random();
        setToasts((prev) => [...prev, { id, message, type }]);

        // Auto remove after 3s
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }, []);

    const removeToast = (id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    const value = {
        addToast,
        success: (msg) => addToast(msg, "success"),
        error: (msg) => addToast(msg, "error"),
        warning: (msg) => addToast(msg, "warning"),
        info: (msg) => addToast(msg, "info"),
    };

    React.useEffect(() => {
        const originalAlert = window.alert;
        window.alert = (message) => {
            if (message === undefined || message === null) return;
            const strMsg = String(message);
            const lower = strMsg.toLowerCase();
            if (lower.includes("error") || lower.includes("falló") || lower.includes("incorrecto") || lower.includes("no se pudo") || lower.includes("❌")) {
                addToast(strMsg, "error");
            } else if (lower.includes("guardado") || lower.includes("exito") || lower.includes("creado") || lower.includes("actualizado") || lower.includes("eliminado") || lower.includes("✅")) {
                addToast(strMsg, "success");
            } else if (lower.includes("obligatorio") || lower.includes("debe") || lower.includes("selecciona") || lower.includes("advertencia") || lower.includes("⚠️")) {
                addToast(strMsg, "warning");
            } else {
                addToast(strMsg, "info");
            }
        };
        return () => {
            window.alert = originalAlert;
        };
    }, [addToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="toast-container">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={`toast-item ${t.type}`}
                        onClick={() => removeToast(t.id)}
                    >
                        <span className="toast-icon">
                            {t.type === "success" && "✅"}
                            {t.type === "error" && "❌"}
                            {t.type === "warning" && "⚠️"}
                            {t.type === "info" && "ℹ️"}
                        </span>
                        <span>{t.message}</span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}
