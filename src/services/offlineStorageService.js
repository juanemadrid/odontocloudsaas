// src/services/offlineStorageService.js
// Almacenamiento local seguro en IndexedDB (nativo del navegador, sin dependencias externas)

const DB_NAME = "odontocloud_offline_db";
const DB_VERSION = 1;

let dbPromise = null;

export const initOfflineDB = () => {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        if (typeof window === "undefined" || !window.indexedDB) {
            console.warn("IndexedDB no está disponible en este entorno.");
            return resolve(null);
        }

        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // 1. Catálogo local de pacientes
            if (!db.objectStoreNames.contains("pacientes")) {
                const pStore = db.createObjectStore("pacientes", { keyPath: "id" });
                pStore.createIndex("tenant_id", "tenant_id", { unique: false });
                pStore.createIndex("documento", "documento", { unique: false });
                pStore.createIndex("tenant_doc", ["tenant_id", "documento"], { unique: false });
            }

            // 2. Catálogo local de citas
            if (!db.objectStoreNames.contains("citas")) {
                const cStore = db.createObjectStore("citas", { keyPath: "id" });
                cStore.createIndex("tenant_id", "tenant_id", { unique: false });
                cStore.createIndex("fecha", "fecha", { unique: false });
            }

            // 3. Catálogo local de evoluciones médicas
            if (!db.objectStoreNames.contains("evoluciones")) {
                const eStore = db.createObjectStore("evoluciones", { keyPath: "id" });
                eStore.createIndex("tenant_id", "tenant_id", { unique: false });
                eStore.createIndex("paciente_id", "paciente_id", { unique: false });
            }

            // 4. Cola de sincronización pendiente
            if (!db.objectStoreNames.contains("sync_queue")) {
                const sStore = db.createObjectStore("sync_queue", { keyPath: "id" });
                sStore.createIndex("tenant_id", "tenant_id", { unique: false });
                sStore.createIndex("status", "status", { unique: false });
                sStore.createIndex("timestamp", "timestamp", { unique: false });
            }
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            console.error("Error abriendo IndexedDB:", event.target.error);
            resolve(null); // Fallback suave para evitar romper la app
        };
    });

    return dbPromise;
};

// --- PACIENTES OFFLINE ---

export const cachePatientsOffline = async (patients = []) => {
    if (!patients || patients.length === 0) return;
    try {
        const db = await initOfflineDB();
        if (!db) return;

        const tx = db.transaction("pacientes", "readwrite");
        const store = tx.objectStore("pacientes");

        patients.forEach((p) => {
            if (p && p.id) {
                store.put(p);
            }
        });

        return new Promise((resolve) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    } catch (e) {
        console.warn("Error guardando pacientes en caché local:", e);
    }
};

export const getOfflinePatientsPage = async (tenantId, pageIndex = 0, pageSize = 25) => {
    try {
        const db = await initOfflineDB();
        if (!db) return { patients: [], totalCount: 0, hasMore: false };

        return new Promise((resolve) => {
            const tx = db.transaction("pacientes", "readonly");
            const store = tx.objectStore("pacientes");
            const index = store.index("tenant_id");
            const request = index.getAll(tenantId);

            request.onsuccess = () => {
                const all = request.result || [];
                // Ordenar por updated_at o created_at descendente
                all.sort((a, b) => {
                    const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
                    const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
                    return dateB - dateA;
                });

                const start = pageIndex * pageSize;
                const end = start + pageSize;
                const patients = all.slice(start, end);

                resolve({
                    patients,
                    totalCount: all.length,
                    hasMore: end < all.length
                });
            };

            request.onerror = () => {
                resolve({ patients: [], totalCount: 0, hasMore: false });
            };
        });
    } catch (e) {
        console.warn("Error leyendo pacientes offline:", e);
        return { patients: [], totalCount: 0, hasMore: false };
    }
};

export const searchOfflinePatients = async (tenantId, searchTerm) => {
    try {
        const db = await initOfflineDB();
        if (!db) return [];

        const term = (searchTerm || "").trim().toLowerCase();
        if (!term) return [];

        return new Promise((resolve) => {
            const tx = db.transaction("pacientes", "readonly");
            const store = tx.objectStore("pacientes");
            const index = store.index("tenant_id");
            const request = index.getAll(tenantId);

            request.onsuccess = () => {
                const all = request.result || [];
                const filtered = all.filter((p) => {
                    const nom = (p.nombreCompleto || `${p.nombres || ""} ${p.apellidos || ""}`).toLowerCase();
                    const doc = String(p.documento || p.nroDocumento || "").toLowerCase();
                    const tel = String(p.telefono || p.celular || "").toLowerCase();
                    const em = String(p.email || "").toLowerCase();

                    return nom.includes(term) || doc.includes(term) || tel.includes(term) || em.includes(term);
                });

                resolve(filtered.slice(0, 50));
            };

            request.onerror = () => resolve([]);
        });
    } catch (e) {
        console.warn("Error buscando pacientes offline:", e);
        return [];
    }
};

export const getOfflinePatientById = async (id) => {
    try {
        const db = await initOfflineDB();
        if (!db || !id) return null;

        return new Promise((resolve) => {
            const tx = db.transaction("pacientes", "readonly");
            const store = tx.objectStore("pacientes");
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => resolve(null);
        });
    } catch (e) {
        console.warn("Error leyendo paciente offline por ID:", e);
        return null;
    }
};

export const saveOfflinePatientRecord = async (patient) => {
    try {
        const db = await initOfflineDB();
        if (!db || !patient?.id) return;

        const tx = db.transaction("pacientes", "readwrite");
        const store = tx.objectStore("pacientes");
        store.put(patient);

        return new Promise((resolve) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    } catch (e) {
        console.warn("Error guardando paciente individual offline:", e);
    }
};

// --- COLA DE SINCRONIZACIÓN (SYNC QUEUE) ---

export const addToSyncQueue = async ({ tenant_id, entity, action, payload }) => {
    try {
        const db = await initOfflineDB();
        if (!db) return null;

        const id = (typeof crypto !== "undefined" && crypto.randomUUID)
            ? crypto.randomUUID()
            : `sync_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        const queueItem = {
            id,
            tenant_id,
            entity, // 'pacientes' | 'citas' | 'evoluciones'
            action, // 'upsert' | 'delete'
            payload,
            status: "pending", // 'pending' | 'syncing' | 'failed'
            timestamp: new Date().toISOString(),
            retryCount: 0
        };

        const tx = db.transaction("sync_queue", "readwrite");
        const store = tx.objectStore("sync_queue");
        store.put(queueItem);

        return new Promise((resolve) => {
            tx.oncomplete = () => {
                window.dispatchEvent(new CustomEvent("sync-queue-updated"));
                resolve(queueItem);
            };
            tx.onerror = () => resolve(null);
        });
    } catch (e) {
        console.error("Error agregando elemento a sync_queue:", e);
        return null;
    }
};

export const getPendingSyncQueue = async (tenantId) => {
    try {
        const db = await initOfflineDB();
        if (!db) return [];

        return new Promise((resolve) => {
            const tx = db.transaction("sync_queue", "readonly");
            const store = tx.objectStore("sync_queue");
            const request = store.getAll();

            request.onsuccess = () => {
                const all = request.result || [];
                const filtered = all
                    .filter((item) => (!tenantId || item.tenant_id === tenantId) && item.status !== "synced")
                    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

                resolve(filtered);
            };

            request.onerror = () => resolve([]);
        });
    } catch (e) {
        console.warn("Error consultando sync_queue:", e);
        return [];
    }
};

export const removeSyncQueueItem = async (id) => {
    try {
        const db = await initOfflineDB();
        if (!db || !id) return;

        const tx = db.transaction("sync_queue", "readwrite");
        const store = tx.objectStore("sync_queue");
        store.delete(id);

        return new Promise((resolve) => {
            tx.oncomplete = () => {
                window.dispatchEvent(new CustomEvent("sync-queue-updated"));
                resolve(true);
            };
            tx.onerror = () => resolve(false);
        });
    } catch (e) {
        console.warn("Error eliminando elemento de sync_queue:", e);
    }
};

export const getSyncQueueCount = async (tenantId) => {
    try {
        const items = await getPendingSyncQueue(tenantId);
        return items.length;
    } catch {
        return 0;
    }
};
