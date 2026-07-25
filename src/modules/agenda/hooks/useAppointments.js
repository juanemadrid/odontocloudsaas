import { useState, useEffect } from "react";
import { subscribeToAppointments, createAppointment, updateAppointment, deleteAppointment } from "../../../services/appointmentService";
import { useToast } from "../../../context/ToastContext";

export function useAppointments(inquilino, selectedDate, viewType = 'day') {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    // Subscribe to real-time updates
    useEffect(() => {
        if (!inquilino) {
            setAppointments([]); // Clear if no tenant
            return;
        }

        setLoading(true);
        // Subscribe to changes for the selected day/month
        const unsubscribe = subscribeToAppointments(inquilino, selectedDate, viewType, (data) => {
            setAppointments(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [inquilino, selectedDate, viewType]);

    const addAppointment = async (data) => {
        if (!inquilino) {
            toast.error("Error: No se ha identificado la clínica.");
            return false;
        }
        try {
            await createAppointment(inquilino, data);
            toast.success("Cita agendada correctamente");
            return true;
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Error al crear cita");
            return false;
        }
    };

    const editAppointment = async (id, data) => {
        if (!inquilino) return false;
        try {
            await updateAppointment(inquilino, id, data);
            toast.success("Cita actualizada");
            return true;
        } catch (error) {
            console.error(error);
            toast.error(error.message || "Error al actualizar");
            return false;
        }
    };

    const removeAppointment = async (id) => {
        try {
            await deleteAppointment(id);
            toast.success("Cita eliminada");
            return true;
        } catch (error) {
            console.error(error);
            toast.error("Error al eliminar cita");
            return false;
        }
    };

    return {
        appointments,
        loading,
        addAppointment,
        editAppointment,
        removeAppointment
    };
}
