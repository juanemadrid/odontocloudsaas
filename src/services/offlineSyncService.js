// src/services/offlineSyncService.js
// Gestor de sincronización automática y detección de red (Online / Offline)

import supabase from "../lib/supabaseClient";
import {
    getPendingSyncQueue,
    removeSyncQueueItem,
    getSyncQueueCount
} from "./offlineStorageService";

class OfflineSyncService {
    constructor() {
        this.isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
        this.isSyncing = false;
        this.listeners = new Set();
        this.currentTenantId = null;

        if (typeof window !== "undefined") {
            window.addEventListener("online", () => this.handleNetworkChange(true));
            window.addEventListener("offline", () => this.handleNetworkChange(false));

            // Escuchar cambios en la cola local
            window.addEventListener("sync-queue-updated", () => this.notifyListeners());
        }
    }

    setTenantId(tenantId) {
        this.currentTenantId = tenantId;
    }

    handleNetworkChange(online) {
        this.isOnline = online;
        this.notifyListeners();

        if (online) {
            console.log("🌐 Conexión a Internet restablecida. Iniciando sincronización automática...");
            // Pequeña pausa de 1 segundo para asegurar estabilidad del socket
            setTimeout(() => {
                this.syncNow(this.currentTenantId);
            }, 1000);
        } else {
            console.warn("⚠️ Conexión perdida. Sistema operando en Modo Local Seguro (Offline).");
        }
    }

    subscribe(callback) {
        this.listeners.add(callback);
        // Emitir estado inicial
        this.getStatus().then((s) => callback(s));

        return () => {
            this.listeners.delete(callback);
        };
    }

    notifyListeners() {
        this.getStatus().then((status) => {
            this.listeners.forEach((cb) => {
                try {
                    cb(status);
                } catch (err) {
                    console.warn("Error en listener de conexión:", err);
                }
            });
        });
    }

    async getStatus() {
        const queueCount = await getSyncQueueCount(this.currentTenantId);
        return {
            isOnline: this.isOnline,
            isSyncing: this.isSyncing,
            pendingCount: queueCount
        };
    }

    async syncNow(tenantId = this.currentTenantId) {
        if (this.isSyncing) return { success: false, message: "Ya hay una sincronización en curso." };
        if (!this.isOnline) return { success: false, message: "Sin conexión a internet." };

        const pendingItems = await getPendingSyncQueue(tenantId);
        if (!pendingItems || pendingItems.length === 0) {
            return { success: true, count: 0 };
        }

        this.isSyncing = true;
        this.notifyListeners();

        let syncedCount = 0;
        const errors = [];

        console.log(`🔄 Sincronizando ${pendingItems.length} cambios pendientes con la nube...`);

        try {
            for (const item of pendingItems) {
                try {
                    let err = null;

                    if (item.entity === "pacientes") {
                        const { error } = await supabase
                            .from("pacientes")
                            .upsert(item.payload, { onConflict: "tenant_id,documento" });
                        err = error;
                    } else if (item.entity === "evoluciones") {
                        const { error } = await supabase
                            .from("evoluciones")
                            .upsert(item.payload);
                        err = error;
                    } else if (item.entity === "citas") {
                        const { error } = await supabase
                            .from("citas")
                            .upsert(item.payload);
                        err = error;
                    }

                    if (err) {
                        console.error(`Error sincronizando elemento ${item.id} (${item.entity}):`, err);
                        errors.push(err);
                    } else {
                        await removeSyncQueueItem(item.id);
                        syncedCount++;
                    }
                } catch (itemErr) {
                    console.error("Excepción sincronizando elemento individual:", itemErr);
                    errors.push(itemErr);
                }
            }

            if (syncedCount > 0) {
                window.dispatchEvent(
                    new CustomEvent("offline-sync-success", {
                        detail: { count: syncedCount }
                    })
                );
            }
        } finally {
            this.isSyncing = false;
            this.notifyListeners();
        }

        return {
            success: errors.length === 0,
            syncedCount,
            errorsCount: errors.length
        };
    }
}

export const offlineSyncService = new OfflineSyncService();
export default offlineSyncService;
