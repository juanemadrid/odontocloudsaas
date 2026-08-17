/**
 * useUnsavedChanges
 * -----------------
 * Hook universal para registrar cambios sin guardar en cualquier módulo.
 *
 * Funciona con:
 *   - react-hook-form → pasar formState.isDirty
 *   - Formularios manuales (useState) → pasar booleano calculado
 *
 * Lo que hace:
 *   1. Setea window.hasUnsavedChanges = isDirty  (DashboardLayout lo lee)
 *   2. Registra beforeunload para advertir si el usuario cierra/recarga
 *   3. Limpia al desmontar el componente
 *
 * Uso:
 *   import { useUnsavedChanges } from "../../../hooks/useUnsavedChanges";
 *   useUnsavedChanges(isDirty);
 */
import { useEffect } from "react";

export function useUnsavedChanges(isDirty) {
    useEffect(() => {
        window.hasUnsavedChanges = Boolean(isDirty);

        const handleBeforeUnload = (e) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = "";
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            window.hasUnsavedChanges = false;
        };
    }, [isDirty]);
}
