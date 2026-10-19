import React from "react";
import { usePermissions } from "../../../hooks/usePermissions";
import { useToast } from "../../../context/ToastContext";
import PatientListView from "./PatientListView";

export default function PatientList(props) {
  const { can } = usePermissions();
  const toast = useToast();
  return <PatientListView {...props} toast={toast} permissions={{
    canCreate: can("Pacientes", "Paciente", "crear"),
    canEdit: can("Pacientes", "Paciente", "editar"),
    canToggle: can("Pacientes", "Paciente", "desactivar"),
    canDelete: can("Pacientes", "Paciente", "eliminar"),
  }} />;
}
