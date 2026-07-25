// src/modules/pacientes/PacienteForm.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { buildDashboardPath } from "../../utils/dashboardBasePath";
import { useToast } from "../../context/ToastContext";
import { getPatientById, createOrUpdatePatient, deletePatient } from "../../services/patientService";
import { useAudit } from "../../hooks/useAudit";

// UI Component
import PatientForm from "./components/PatientForm";

export default function PacienteForm() {
  const { pacienteId } = useParams(); // "nuevo" or real ID (doc number)
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const toast = useToast();
  const { logAction } = useAudit();

  const isNew = !pacienteId || pacienteId === "nuevo";
  const [loading, setLoading] = useState(!isNew);
  const [initialData, setInitialData] = useState(null);

  // 1. Load data if editing
  useEffect(() => {
    if (isNew) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const data = await getPatientById(pacienteId);
        if (data) {
          setInitialData(data);
        } else {
          toast.error("El paciente no existe o el ID es inválido.");
          navigate(buildDashboardPath("pacientes"));
        }
      } catch (err) {
        console.error("Error loading patient:", err);
        toast.error("Error al cargar los datos del paciente.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isNew, pacienteId, navigate, toast]);

  // 2. Handle Save
  const handleSubmit = async (formData, fotoFile) => {
    if (!userProfile?.inquilino) {
      toast.error("Sesión no válida. Por favor recarga.");
      return;
    }

    try {
      const saved = await createOrUpdatePatient(
        userProfile.inquilino,
        formData,
        isNew,
        fotoFile
      );

      // Audit log
      await logAction(
        saved.id,
        isNew ? "CREATE_PATIENT" : "UPDATE_PATIENT",
        {
          nombre: saved.nombreCompleto || `${saved.nombres} ${saved.apellidos}`,
          documento: saved.nroDocumento
        }
      );

      toast.success(isNew ? "¡Paciente registrado con éxito!" : "Ficha de paciente actualizada.");

      // Redirect to the newly created/updated patient details
      navigate(buildDashboardPath("pacientes"));
    } catch (err) {
      console.error("Error saving patient:", err);
      toast.error(err.message || "No se pudo guardar la información.");
    }
  };

  // 3. Handle Delete
  const handleDelete = async (patient) => {
    if (!window.confirm(`¿Realmente desea eliminar a ${patient.nombreCompleto}? Esta acción es irreversible.`)) {
      return;
    }

    try {
      await deletePatient(patient.id);

      // Audit log
      await logAction(
        patient.id,
        "DELETE_PATIENT",
        {
          nombre: patient.nombreCompleto,
          documento: patient.nroDocumento
        }
      );

      toast.success("Paciente eliminado correctamente.");
      navigate(buildDashboardPath("pacientes"));
    } catch (err) {
      console.error("Error deleting patient:", err);
      toast.error("No se pudo eliminar el registro.");
    }
  };

  const handleCancel = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-20 bg-slate-50/50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Protocolizando Acceso a Ficha...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 lg:p-12 bg-slate-50/30 min-h-screen animate-fadeIn">
      <div className="max-w-[1200px] mx-auto">
        <PatientForm
          initialData={initialData}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
