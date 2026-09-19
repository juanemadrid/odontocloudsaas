// src/components/ui/ConnectionStatusBadge.jsx
import React, { useEffect, useState } from "react";
import { FiWifi, FiWifiOff, FiRefreshCw, FiCheckCircle } from "react-icons/fi";
import { offlineSyncService } from "../../services/offlineSyncService";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

export default function ConnectionStatusBadge() {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;
    const toast = useToast();

    const [status, setStatus] = useState({
        isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
        isSyncing: false,
        pendingCount: 0
    });

    useEffect(() => {
        if (inquilino) {
            offlineSyncService.setTenantId(inquilino);
        }

        const unsubscribe = offlineSyncService.subscribe((newStatus) => {
            setStatus(newStatus);
        });

        const handleSyncSuccess = (event) => {
            const count = event.detail?.count || 1;
            toast.success(`¡Conexión en línea! ${count} cambio(s) sincronizados con la nube.`);
        };

        window.addEventListener("offline-sync-success", handleSyncSuccess);

        return () => {
            unsubscribe();
            window.removeEventListener("offline-sync-success", handleSyncSuccess);
        };
    }, [inquilino, toast]);

    const handleManualSync = async () => {
        if (!status.isOnline) {
            toast.info("Sin conexión a internet. Los cambios se sincronizarán en cuanto vuelva la señal.");
            return;
        }

        if (status.pendingCount === 0) {
            toast.success("Todo está sincronizado con la nube.");
            return;
        }

        toast.info("Sincronizando cambios con el servidor...");
        const res = await offlineSyncService.syncNow(inquilino);
        if (res.success && res.syncedCount > 0) {
            toast.success(`${res.syncedCount} cambios sincronizados con éxito.`);
        }
    };

    // 1. Estado Sincronizando
    if (status.isSyncing) {
        return (
            <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 animate-pulse shadow-2xs select-none"
                title="Sincronizando cambios pendientes con Supabase..."
            >
                <FiRefreshCw size={12} className="animate-spin text-blue-600" />
                <span className="hidden md:inline">Sincronizando...</span>
            </div>
        );
    }

    // 2. Estado Offline (Sin conexión a internet)
    if (!status.isOnline) {
        return (
            <div
                onClick={handleManualSync}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100 transition-colors shadow-2xs cursor-pointer select-none"
                title="Estás trabajando en Modo Local Seguro. Toda la información se guarda en tu equipo y se subirá automáticamente cuando vuelva el internet."
            >
                <FiWifiOff size={13} className="text-amber-600" />
                <span>Modo Local</span>
                {status.pendingCount > 0 && (
                    <span className="bg-amber-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black">
                        {status.pendingCount}
                    </span>
                )}
            </div>
        );
    }

    // 3. Estado Online pero con cambios pendientes por sincronizar
    if (status.pendingCount > 0) {
        return (
            <button
                type="button"
                onClick={handleManualSync}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-2xs cursor-pointer"
                title="Hay cambios locales pendientes. Haz clic para sincronizar ahora."
            >
                <FiRefreshCw size={12} className="text-indigo-600" />
                <span>Sincronizar ({status.pendingCount})</span>
            </button>
        );
    }

    // 4. Estado Online Normal (100% conectado)
    return (
        <div
            onClick={handleManualSync}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs select-none cursor-pointer hover:bg-emerald-100/60 transition-colors"
            title="Conectado a la nube. Haz clic para verificar sincronización."
        >
            <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="hidden sm:inline">En línea</span>
        </div>
    );
}
