import { useState, useEffect, useCallback } from "react";
import { saveOdontogramSnapshot, subscribeToOdontogramSnapshot } from "../services/clinicalService";
import { useToast } from "../context/ToastContext";

export function useOdontograma(selectedPatient) {
    const [wholeOdontogramaData, setWholeOdontogramaData] = useState({ initial: {}, plan: {}, evolution: {} });
    const [loading, setLoading] = useState(false);
    const toast = useToast();

    // Subscribe to data when patient changes
    useEffect(() => {
        if (!selectedPatient?.id) {
            setWholeOdontogramaData({ initial: {}, plan: {}, evolution: {} });
            return;
        }

        setLoading(true);

        // Subscribe to each subcollection independently
        const unsubInitial = subscribeToOdontogramSnapshot(selectedPatient.id, 'initial', (data) => {
            setWholeOdontogramaData(prev => ({ ...prev, initial: data }));
        });
        const unsubPlan = subscribeToOdontogramSnapshot(selectedPatient.id, 'plan', (data) => {
            setWholeOdontogramaData(prev => ({ ...prev, plan: data }));
        });
        const unsubEvolution = subscribeToOdontogramSnapshot(selectedPatient.id, 'evolution', (data) => {
            setWholeOdontogramaData(prev => ({ ...prev, evolution: data }));
            // Start loading as false once we get at least one update (approximation)
            setLoading(false);
        });

        return () => {
            unsubInitial();
            unsubPlan();
            unsubEvolution();
        };

    }, [selectedPatient?.id]);

    const updateTooth = useCallback(async (viewMode, dienteId, zona, tool) => {
        if (!selectedPatient) return;

        // 1. Calculate New State (Optimistic logic matching previous implementation)
        const currentLayerData = wholeOdontogramaData[viewMode] || {};
        const currentTooth = currentLayerData[dienteId] || {};
        let newTooth = { ...currentTooth };

        if (tool.id === "borrador") {
            delete newTooth[zona];
            if (newTooth.general) delete newTooth.general;
        } else if (tool.id === "ausente") {
            newTooth.general = { id: tool.id, color: tool.color, label: tool.label };
        } else {
            newTooth[zona] = { id: tool.id, color: tool.color, label: tool.label };
        }

        // Prepare updated layer
        let updatedLayer = { ...currentLayerData };
        if (Object.keys(newTooth).length === 0) {
            delete updatedLayer[dienteId];
        } else {
            updatedLayer[dienteId] = newTooth;
        }

        // 2. Optimistic Update (Local State) is handled by the subscription callback mostly, 
        // but for instant feedback we could update state. 
        // However, since we have real-time listeners, if we update state here AND get listener update, it might conflict or be redundant.
        // Best practice with Firestore generic listeners: Optimistic update local state, then let listener confirm.
        const newWholeData = {
            ...wholeOdontogramaData,
            [viewMode]: updatedLayer
        };
        setWholeOdontogramaData(newWholeData);

        // 3. Persist
        try {
            await saveOdontogramSnapshot(selectedPatient.id, viewMode, updatedLayer);

            // 4. AUTO-EVOLUTION INTEGRATION
            if (viewMode === 'evolution' && tool.id !== 'borrador') {
                const { addEvolution } = await import('../services/evolutionService');

                await addEvolution({
                    patientId: selectedPatient.id,
                    date: new Date().toISOString(),
                    description: `Registro Automático desde Odontograma:\nSe marca tratamiento en diente ${dienteId}.`,
                    treatment: `${tool.label} en zona ${zona === 'general' ? 'General' : zona}`,
                    prognosis: 'Favorable',
                    doctorId: 'system' // Should be current user if available
                });
                toast.success("Evolución registrada");
            }

        } catch (error) {
            console.error(error);
            toast.error("Error al guardar tratamiento");
            // Revert state if needed, but listener might fix it
        }
    }, [wholeOdontogramaData, selectedPatient, toast]);

    return {
        odontogramaData: wholeOdontogramaData,
        loading,
        updateTooth
    };
}
