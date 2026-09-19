import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import supabase from "../../lib/supabaseClient";
import { useSearchParams, useLocation } from "react-router-dom";
import "./pacientes.css";

// 🔹 Slender Pro Components
import PatientList from "./components/PatientList";
import PatientDetails from "./components/PatientDetails";
import PatientForm from "./components/PatientForm";

import {
  createOrUpdatePatient,
  deletePatient,
  searchPatients,
  getPatientsPage,
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

  // listado & búsqueda paginada
  const [loading, setLoading] = useState(false);
  const [pacientes, setPacientes] = useState([]);
  const [term, setTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(5);
  const [totalCount, setTotalCount] = useState(0);

  // modal control
  const [open, setOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const loadPage = useCallback(async (pageToLoad = 0) => {
    const tenantId = userProfile?.inquilino;
    if (!tenantId) return;
    setLoading(true);
    setIsSearching(false);
    try {
      const res = await getPatientsPage(tenantId, pageToLoad, pageSize);
      setPacientes(res.patients || []);
      setTotalCount(res.totalCount || 0);
      setPage(pageToLoad);
    } catch (e) {
      console.error("Error al cargar página de pacientes:", e);
    } finally {
      setLoading(false);
    }
  }, [userProfile?.inquilino, pageSize]);

  /* ======= Búsqueda Debounced / Carga de Página ======= */
  useEffect(() => {
    const rawTerm = term.trim();
    if (!rawTerm) {
      loadPage(0);
      return;
    }

    setIsSearching(true);
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const results = await searchPatients(userProfile?.inquilino, rawTerm, 50);
        setPacientes(results);
      } catch (err) {
        console.error("Error al realizar búsqueda de pacientes:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [term, userProfile?.inquilino, loadPage]);

  const reloadData = async () => {
    if (term.trim()) {
      setLoading(true);
      try {
        const results = await searchPatients(userProfile?.inquilino, term.trim(), 50);
        setPacientes(results);
      } catch (e) {
        console.error("Error al recargar búsqueda de pacientes:", e);
      } finally {
        setLoading(false);
      }
    } else {
      await loadPage(page);
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
            p.id?.toLowerCase() === targetId.toLowerCase() ||
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

  const handleOpenEdit = async (p) => {
    setLoading(true);
    try {
      const fullPatient = p?.id ? await getPatientById(p.id) : null;
      setEditData(fullPatient || p);
      setOpen(true);
    } finally {
      setLoading(false);
    }
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
        toast.error("No tienes permisos para eliminar pacientes. Verifica las políticas RLS de Supabase.");
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
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={(newPage) => loadPage(newPage)}
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
              await supabase.from("pacientes").update({ activo: !isCurrentlyActive }).eq("id", p.id);
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-6 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
          <div className="w-full h-full md:max-w-[95vw] md:max-h-[94vh] overflow-hidden rounded-2xl shadow-2xl">
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
