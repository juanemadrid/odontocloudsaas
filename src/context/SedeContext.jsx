import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "./AuthContext";
import { getConfigItems } from "../services/configPersistenceService";
import supabase from "../lib/supabaseClient";

const SedeContext = createContext({
    activeSede: null,
    sedesList: [],
    loadingSedes: true,
    setActiveSede: () => {},
    refreshSedes: () => Promise.resolve(),
    isMultiSede: false,
});

export const useSede = () => useContext(SedeContext);

export const SedeProvider = ({ children }) => {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;

    const [sedesList, setSedesList] = useState([]);
    const [activeSedeId, setActiveSedeId] = useState(() => {
        try {
            return localStorage.getItem("oc_active_sede_id") || "";
        } catch {
            return "";
        }
    });
    const [loadingSedes, setLoadingSedes] = useState(true);

    const defaultPrincipalName = useMemo(() => {
        return (
            userProfile?.empresaNombre ||
            userProfile?.tenant?.nombre ||
            userProfile?.tenant?.name ||
            "ATM CENTRO DEL DOLOR OROFACIAL"
        ).toUpperCase();
    }, [userProfile]);

    const loadSedes = useCallback(async () => {
        if (!inquilino) {
            setLoadingSedes(false);
            return;
        }

        try {
            // 1. Cargar desde la clave sucursales (usada por EmpresaSucursales.jsx)
            const [sucursales1, sucursales2] = await Promise.all([
                getConfigItems(inquilino, "sucursales", "sucursales").catch(() => []),
                getConfigItems(inquilino, "empresa_sucursales", "sucursales").catch(() => [])
            ]);

            const rawList = [
                ...(Array.isArray(sucursales1) ? sucursales1 : []),
                ...(Array.isArray(sucursales2) ? sucursales2 : [])
            ];

            let formattedList = [];
            const seen = new Set();

            rawList.forEach((s, idx) => {
                const name = (s.nombre || s.nombreComercial || s.name || "").trim();
                const key = (s.id || name).toLowerCase();
                if (name && !seen.has(key)) {
                    seen.add(key);
                    formattedList.push({
                        id: s.id || `sede_${idx + 1}`,
                        nombre: name.toUpperCase(),
                        direccion: s.direccion || s.dir || "",
                        telefono: s.telefono || s.telCelular || "",
                        ciudad: s.ciudad || "",
                        esPrincipal: !!s.esPrincipal || idx === 0,
                        almacenes: s.almacenes || [],
                        sillones: s.sillones || [],
                        profesionales: s.profesionales || []
                    });
                }
            });

            // 2. Si no hay ninguna sucursal creada, usar la sede principal basada en el perfil
            if (formattedList.length === 0) {
                formattedList = [
                    {
                        id: "sede_principal",
                        nombre: defaultPrincipalName,
                        direccion: userProfile?.tenant?.direccion || "",
                        telefono: userProfile?.tenant?.telefono || "",
                        ciudad: "Montería",
                        esPrincipal: true,
                        almacenes: [],
                        sillones: [],
                        profesionales: []
                    }
                ];
            }

            setSedesList(formattedList);

            // 3. Determinar sede activa inicial
            const savedId = localStorage.getItem("oc_active_sede_id");
            const existingMatch = formattedList.find(s => String(s.id) === String(savedId));

            if (existingMatch) {
                setActiveSedeId(existingMatch.id);
            } else {
                const principal = formattedList.find(s => s.esPrincipal) || formattedList[0];
                const fallbackId = principal?.id || formattedList[0]?.id || "";
                setActiveSedeId(fallbackId);
                try {
                    localStorage.setItem("oc_active_sede_id", fallbackId);
                } catch {}
            }
        } catch (err) {
            console.error("Error loading sedes in SedeContext:", err);
            // Fallback de emergencia
            setSedesList([
                {
                    id: "sede_principal",
                    nombre: defaultPrincipalName,
                    esPrincipal: true
                }
            ]);
            setActiveSedeId("sede_principal");
        } finally {
            setLoadingSedes(false);
        }
    }, [inquilino, defaultPrincipalName, userProfile]);

    useEffect(() => {
        loadSedes();

        const handleRefresh = () => loadSedes();
        window.addEventListener("sedes-updated", handleRefresh);
        return () => window.removeEventListener("sedes-updated", handleRefresh);
    }, [loadSedes]);

    const activeSede = useMemo(() => {
        if (!sedesList || sedesList.length === 0) {
            return {
                id: "sede_principal",
                nombre: defaultPrincipalName,
                esPrincipal: true
            };
        }
        const found = sedesList.find(s => String(s.id) === String(activeSedeId));
        return found || sedesList[0];
    }, [sedesList, activeSedeId, defaultPrincipalName]);

    const handleSetActiveSede = useCallback((sedeOrId) => {
        const targetId = typeof sedeOrId === "object" ? sedeOrId.id : sedeOrId;
        const targetObj = sedesList.find(s => String(s.id) === String(targetId));

        if (targetObj) {
            setActiveSedeId(targetObj.id);
            try {
                localStorage.setItem("oc_active_sede_id", targetObj.id);
            } catch {}

            // Disparar evento global para que Agenda, Caja, etc. se actualicen de inmediato
            window.dispatchEvent(
                new CustomEvent("sede-changed", {
                    detail: {
                        sede: targetObj,
                        sedeId: targetObj.id,
                        sedeNombre: targetObj.nombre
                    }
                })
            );
        }
    }, [sedesList]);

    const value = useMemo(() => ({
        activeSede,
        sedesList,
        loadingSedes,
        setActiveSede: handleSetActiveSede,
        refreshSedes: loadSedes,
        isMultiSede: sedesList.length > 1
    }), [activeSede, sedesList, loadingSedes, handleSetActiveSede, loadSedes]);

    return (
        <SedeContext.Provider value={value}>
            {children}
        </SedeContext.Provider>
    );
};
