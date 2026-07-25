import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { updateDoc, doc } from "firebase/firestore";
import { useSearchParams, useLocation } from "react-router-dom";
import "./pacientes.css";

// 🔹 Slender Pro Components
import PatientList from "./components/PatientList";
import PatientDetails from "./components/PatientDetails";
import PatientForm from "./components/PatientForm";

import { db } from "../../firebase/firebaseConfig";
import {
  createOrUpdatePatient,
  deletePatient,
  searchPatients,
  getPatientById
} from "../../services/patientService";
import { useAudit } from "../../hooks/useAudit";
import ImportadorPacientes from "./components/ImportadorPacientes";

export default function Pacientes() {
  const { userProfile } = useAuth();
  const toast = useToast();
  const { logAction } = useAudit();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // listado & búsqueda (0 lecturas al cargar la página)
  const [loading, setLoading] = useState(false);
  const [pacientes, setPacientes] = useState([]);
  const [term, setTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [showImporter, setShowImporter] = useState(false);

  // modal control
  const [open, setOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);

  /* ======= Búsqueda Debounced ======= */
  useEffect(() => {
    const rawTerm = term.trim();
    if (!rawTerm) {
      setIsSearching(false);
      setPacientes([]);
      setLoading(false);
      return;
    }

    setIsSearching(true);
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const results = await searchPatients(userProfile?.inquilino, rawTerm, 30);
        setPacientes(results);
      } catch (err) {
        console.error("Error al realizar búsqueda de pacientes:", err);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [term, userProfile?.inquilino]);

  const reloadData = async () => {
    if (term.trim()) {
      setLoading(true);
      try {
        const results = await searchPatients(userProfile?.inquilino, term.trim(), 30);
        setPacientes(results);
      } catch (e) {
        console.error("Error al recargar búsqueda de pacientes:", e);
      } finally {
        setLoading(false);
      }
    }
  };

  /* ======= Pre-selección por URL ======= */
  useEffect(() => {
    const checkTargetPatient = async () => {
      const pathParts = location.pathname.split("/pacientes/");
      const idFromPath = pathParts[1] ? pathParts[1].split("/")[0] : null;
      const targetId = idFromPath || searchParams.get("id");

      if (targetId) {
        const found = pacientes.find(
          (p) =>
            p.id.toLowerCase() === targetId.toLowerCase() ||
            p.nroDocumento?.toLowerCase() === targetId.toLowerCase()
        );

        if (found) {
          setSelectedPatient(found);
        } else {
          try {
            const fetched = await getPatientById(targetId);
            if (fetched) setSelectedPatient(fetched);
          } catch (e) {
            console.error("Error obteniendo paciente por ID:", e);
          }
        }
      } else {
        setSelectedPatient(null);
      }
    };

    checkTargetPatient();
  }, [searchParams, location.pathname, pacientes]);

  // Escuchar el evento de reset desde el sidebar
  useEffect(() => {
    const handleReset = () => {
      setSelectedPatient(null);
      setOpen(false);
      setShowImporter(false);
      setSearchParams({});
    };
    window.addEventListener("reset-module-pacientes", handleReset);
    return () => {
      window.removeEventListener("reset-module-pacientes", handleReset);
    };
  }, [setSearchParams]);

  // Handle action=new query parameter
  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "new") {
      handleOpenNew();
      const timer = setTimeout(() => {
        const currentParams = new URLSearchParams(window.location.search);
        if (currentParams.get("action") === "new") {
          currentParams.delete("action");
          setSearchParams(currentParams, { replace: true });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchParams, setSearchParams]);

  /* ======= Acciones de Edición / Borrado ======= */
  const handleOpenNew = () => {
    setEditData(null);
    setOpen(true);
  };

  const handleOpenEdit = (p) => {
    setEditData(p);
    setOpen(true);
  };

  const handleSubmit = async (formData, fotoFile) => {
    if (!userProfile?.inquilino) return;
    try {
      const isNew = !editData;
      const saved = await createOrUpdatePatient(
        userProfile.inquilino,
        formData,
        isNew,
        fotoFile
      );

      await logAction(
        saved.id,
        isNew ? "CREATE_PATIENT" : "UPDATE_PATIENT",
        {
          nombre: saved.nombreCompleto || `${saved.nombres} ${saved.apellidos}`,
          documento: saved.nroDocumento
        }
      );

      toast.success(editData ? "Ficha actualizada" : "Paciente registrado");
      setOpen(false);
      reloadData();
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Error al guardar");
    }
  };

  const handleDelete = async (patient) => {
    try {
      await deletePatient(patient.id);

      await logAction(
        patient.id,
        "DELETE_PATIENT",
        {
          nombre: patient.nombreCompleto || patient.paciente,
          documento: patient.nroDocumento || patient.documento
        }
      );

      toast.success("Paciente eliminado correctamente");
      reloadData();
    } catch (err) {
      console.error("Error eliminando paciente:", err?.code, err?.message, err);
      if (err?.code === "permission-denied") {
        toast.error("No tienes permisos para eliminar pacientes. Verifica las reglas de Firestore.");
      } else {
        toast.error(`Error al eliminar el paciente: ${err?.message || "Error desconocido"}`);
      }
    }
  };

  return (
    <div className="relative w-full min-h-[calc(100vh-64px)] overflow-y-auto custom-scrollbar flex flex-col bg-slate-50/50">
      {!selectedPatient ? (
        <PatientList
          pacientes={pacientes}
          loading={loading}
          isSearching={isSearching}
          onSelect={(patient) => {
            setSelectedPatient(patient);
            setSearchParams({ id: patient.id, tab: "datos" });
          }}
          searchTerm={term}
          onSearchChange={setTerm}
          onCreateNew={handleOpenNew}
          onImportClick={() => setShowImporter(true)}
          onDelete={handleDelete}
          onEdit={handleOpenEdit}
          onToggleStatus={async (p) => {
            const isCurrentlyActive = p.activo !== false;
            try {
              await updateDoc(doc(db, "pacientes", p.id), { activo: !isCurrentlyActive });
              reloadData();
            } catch (e) { toast.error("Error al cambiar estado"); }
          }}
        />
      ) : (
        <PatientDetails
          initialData={selectedPatient}
          onClose={() => {
            setSelectedPatient(null);
            setSearchParams({});
          }}
          onEdit={(p) => {
            handleOpenEdit(p);
            setSelectedPatient(null);
            setSearchParams({});
          }}
          onDelete={(p) => {
            handleDelete(p);
            setSelectedPatient(null);
            setSearchParams({});
          }}
        />
      )}

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-10 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="w-full h-full md:max-w-6xl md:max-h-[90vh] overflow-hidden">
            <PatientForm
              initialData={editData}
              onSubmit={handleSubmit}
              onCancel={() => setOpen(false)}
              onDelete={handleDelete}
            />
          </div>
        </div>
      )}

      {showImporter && (
        <ImportadorPacientes
          onComplete={() => reloadData()}
          onClose={() => setShowImporter(false)}
        />
      )}
    </div>
  );
}

