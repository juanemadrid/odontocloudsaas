// src/modules/administracion/views/Terceros.jsx
import React, { useState, useEffect } from "react";
import { db } from "../../../firebase/firebaseConfig";
import { 
  collection, query, where, getDocs, doc, setDoc, 
  addDoc, serverTimestamp, updateDoc, deleteDoc 
} from "firebase/firestore";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { 
  FiUsers, FiPlus, FiSearch, FiEdit3, FiTrash2, 
  FiCheck, FiX, FiSave, FiAlertCircle, FiShield, 
  FiToggleLeft, FiToggleRight, FiEye, FiEyeOff 
} from "react-icons/fi";

const TIPO_DOCUMENTS = [
  { id: "CC", label: "Cédula de Ciudadanía" },
  { id: "NIT", label: "NIT" },
  { id: "CE", label: "Cédula de Extranjería" },
  { id: "PA", label: "Pasaporte" },
  { id: "TI", label: "Tarjeta de Identidad" },
  { id: "RC", label: "Registro Civil" },
  { id: "Otro", label: "Otro" }
];

const PAISES = [
  "Colombia", "Venezuela", "Ecuador", "Perú", "Chile", 
  "Argentina", "España", "Estados Unidos", "Otro"
];

const CIUDADES_COLOMBIA = [
  "Bogotá", "Medellín", "Cali", "Barranquilla", "Cartagena", 
  "Bucaramanga", "Cúcuta", "Pereira", "Santa Marta", "Ibagué", 
  "Pasto", "Manizales", "Neiva", "Villavicencio", "Valledupar", 
  "Montería", "Sincelejo", "Tunja", "Popayán", "Riohacha", 
  "Quibdó", "Florencia", "Yopal", "Arauca", "San Andrés", 
  "Mocoa", "San José del Guaviare", "Mitú", "Puerto Inírida", 
  "Leticia", "Otro"
];

const PROCEDENCIAS = [
  { id: "Nacional", label: "Nacional" },
  { id: "Extranjero", label: "Extranjero" },
  { id: "Territorial", label: "Territorial" }
];

const RESP_TRIBUTARIAS = [
  "Gran contribuyente", "Autorretenedor", "Responsable de IVA", 
  "No responsable de IVA", "Régimen simple de tributación", "Otro"
];

const TIPOS_PERSONA = [
  { id: "Natural", label: "Persona Natural" },
  { id: "Juridica", label: "Persona Jurídica" }
];

const MODALIDADES_PAGO = [
  "Contado", "Crédito 30 días", "Crédito 60 días", "Crédito 90 días", 
  "Débito automático", "Otro"
];

const CUENTAS_CONTABLES = [
  { id: "110505", label: "110505 - Caja General" },
  { id: "111005", label: "111005 - Bancos Nacionales" },
  { id: "130505", label: "130505 - Clientes Nacionales" },
  { id: "220505", label: "220505 - Proveedores Nacionales" },
  { id: "233595", label: "233595 - Otros Costos y Gastos" },
  { id: "415005", label: "415005 - Servicios de Salud" }
];

export default function Terceros() {
  const { userProfile } = useAuth();
  const toast = useToast();
  const inquilino = userProfile?.inquilino || userProfile?.tenantId;

  // View state: 'LIST' | 'FORM'
  const [viewMode, setViewMode] = useState("LIST");
  const [terceros, setTerceros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTercero, setEditingTercero] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactivos, setShowInactivos] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    nombre: "",
    apellidos: "",
    tipoDocumento: "CC",
    nroDocumento: "",
    razonSocial: "",
    telefono: "",
    pais: "Colombia",
    ciudad: "",
    direccion: "",
    codigoPostal: "",
    email: "",
    cuentaContable: "",
    identificadorProcedencia: "Nacional",
    responsabilidadTributaria: "No responsable de IVA",
    tipoPersona: "Natural",
    modalidadPago: "Contado",
    contrato: "",
    isEps: false,
    codigoEntidadAdministradora: "",
    activo: true
  });

  useEffect(() => {
    if (inquilino) loadTerceros();
  }, [inquilino]);

  const loadTerceros = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "terceros"), 
        where("inquilino", "==", inquilino)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTerceros(list);
    } catch (e) {
      console.error("Error loading terceros:", e);
      toast?.error("Error al cargar los terceros");
    } finally {
      setLoading(false);
    }
  };

  const handleNew = () => {
    setEditingTercero(null);
    setFormData({
      nombre: "",
      apellidos: "",
      tipoDocumento: "CC",
      nroDocumento: "",
      razonSocial: "",
      telefono: "",
      pais: "Colombia",
      ciudad: "",
      direccion: "",
      codigoPostal: "",
      email: "",
      cuentaContable: "",
      identificadorProcedencia: "Nacional",
      responsabilidadTributaria: "No responsable de IVA",
      tipoPersona: "Natural",
      modalidadPago: "Contado",
      contrato: "",
      isEps: false,
      codigoEntidadAdministradora: "",
      activo: true
    });
    setViewMode("FORM");
  };

  const handleEdit = (tercero) => {
    setEditingTercero(tercero);
    setFormData({
      nombre: tercero.nombre || "",
      apellidos: tercero.apellidos || "",
      tipoDocumento: tercero.tipoDocumento || "CC",
      nroDocumento: tercero.nroDocumento || "",
      razonSocial: tercero.razonSocial || "",
      telefono: tercero.telefono || "",
      pais: tercero.pais || "Colombia",
      ciudad: tercero.ciudad || "",
      direccion: tercero.direccion || "",
      codigoPostal: tercero.codigoPostal || "",
      email: tercero.email || "",
      cuentaContable: tercero.cuentaContable || "",
      identificadorProcedencia: tercero.identificadorProcedencia || "Nacional",
      responsabilidadTributaria: tercero.responsabilidadTributaria || "No responsable de IVA",
      tipoPersona: tercero.tipoPersona || "Natural",
      modalidadPago: tercero.modalidadPago || "Contado",
      contrato: tercero.contrato || "",
      isEps: tercero.isEps || false,
      codigoEntidadAdministradora: tercero.codigoEntidadAdministradora || "",
      activo: tercero.activo !== undefined ? tercero.activo : true
    });
    setViewMode("FORM");
  };

  const handleToggleActivo = async (tercero) => {
    try {
      const docRef = doc(db, "terceros", tercero.id);
      const newStatus = !tercero.activo;
      await updateDoc(docRef, { activo: newStatus });
      toast?.success(`Tercero ${newStatus ? "activado" : "inactivado"} con éxito`);
      loadTerceros();
    } catch (e) {
      console.error(e);
      toast?.error("Error al actualizar estado");
    }
  };

  const handleDelete = async (tercero) => {
    const isNatural = tercero.tipoPersona === "Natural";
    const name = isNatural ? `${tercero.nombre} ${tercero.apellidos || ""}`.trim() : tercero.razonSocial || tercero.nombre;
    if (!window.confirm(`¿Está seguro de que desea eliminar permanentemente al tercero "${name}"?`)) return;
    
    try {
      await deleteDoc(doc(db, "terceros", tercero.id));
      if (tercero.isEps) {
        try {
          await deleteDoc(doc(db, "eps_catalogo", tercero.id));
        } catch {}
      }
      toast?.success("Tercero eliminado con éxito");
      loadTerceros();
    } catch (e) {
      console.error("Error deleting tercero:", e);
      toast?.error("Error al eliminar el tercero");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return toast?.error("El nombre es requerido");
    if (!formData.tipoDocumento) return toast?.error("El tipo de documento es requerido");
    if (!formData.nroDocumento.trim()) return toast?.error("El número de documento es requerido");
    if (!formData.telefono.trim()) return toast?.error("El teléfono es requerido");
    if (!formData.direccion.trim()) return toast?.error("La dirección es requerida");
    if (!formData.email.trim()) return toast?.error("El correo electrónico es requerido");
    if (!formData.identificadorProcedencia) return toast?.error("El identificador de procedencia es requerido");
    if (!formData.tipoPersona) return toast?.error("El tipo de persona es requerido");
    if (!formData.modalidadPago) return toast?.error("La modalidad de pago es requerida");
    if (formData.isEps && !formData.codigoEntidadAdministradora?.trim()) {
      return toast?.error("El código de entidad administradora es requerido para EPS");
    }

    setSaving(true);
    try {
      const dataToSave = {
        ...formData,
        nombre: formData.nombre.trim(),
        apellidos: formData.apellidos.trim(),
        nroDocumento: formData.nroDocumento.trim(),
        razonSocial: formData.razonSocial.trim(),
        telefono: formData.telefono.trim(),
        direccion: formData.direccion.trim(),
        codigoPostal: formData.codigoPostal.trim(),
        email: formData.email.trim(),
        contrato: formData.contrato.trim(),
        codigoEntidadAdministradora: formData.isEps ? formData.codigoEntidadAdministradora.trim() : "",
        inquilino,
        updatedAt: serverTimestamp()
      };

      let terceroId = editingTercero?.id;
      if (terceroId) {
        await setDoc(doc(db, "terceros", terceroId), dataToSave, { merge: true });
      } else {
        dataToSave.createdAt = serverTimestamp();
        const docRef = await addDoc(collection(db, "terceros"), dataToSave);
        terceroId = docRef.id;
      }

      // Sincronización con EPS Catálogo para módulo RIPS
      if (formData.isEps) {
        const epsName = formData.razonSocial || `${formData.nombre} ${formData.apellidos}`.trim();
        await setDoc(doc(db, "eps_catalogo", terceroId), {
          nombre: epsName,
          inquilino,
          terceroId,
          codigoEps: formData.codigoEntidadAdministradora.trim(),
          activo: formData.activo
        }, { merge: true });
      } else {
        // Si ya no es EPS o se inactivó, eliminar del catálogo de RIPS
        try {
          await deleteDoc(doc(db, "eps_catalogo", terceroId));
        } catch {}
      }

      toast?.success(editingTercero ? "Tercero actualizado correctamente" : "Tercero creado con éxito");
      setViewMode("LIST");
      loadTerceros();
    } catch (e) {
      console.error(e);
      toast?.error("Error al guardar el tercero");
    } finally {
      setSaving(false);
    }
  };

  // Filtered list
  const filteredTerceros = terceros.filter(t => {
    const isStatusMatch = showInactivos ? !t.activo : t.activo;
    if (!isStatusMatch) return false;

    const term = searchQuery.toLowerCase();
    const fullName = `${t.nombre || ""} ${t.apellidos || ""}`.toLowerCase();
    const docNum = (t.nroDocumento || "").toLowerCase();
    const rSocial = (t.razonSocial || "").toLowerCase();

    return fullName.includes(term) || docNum.includes(term) || rSocial.includes(term);
  });

  return (
    <div className="bg-white rounded-[28px] border border-slate-200/60 shadow-md p-6 h-full flex flex-col overflow-hidden animate-fadeIn">
      {viewMode === "LIST" ? (
        <>
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
            <div className="relative w-full sm:max-w-md">
              <FiSearch size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar tercero por documento, nombres o apellido..."
                className="w-full pl-11 pr-4 py-2.5 rounded-2xl border border-slate-200 text-[12px] font-bold text-slate-700 bg-slate-50/50 outline-none focus:border-blue-400 focus:bg-white transition-all placeholder:text-slate-300"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                onClick={() => setShowInactivos(!showInactivos)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  showInactivos 
                    ? "bg-blue-50 text-blue-600 border border-blue-200"
                    : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                {showInactivos ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                <span>{showInactivos ? "Ver Activos" : "Ver Inactivos"}</span>
              </button>

              <button
                onClick={handleNew}
                className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#8dc63f] hover:bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-md shadow-emerald-100 hover:-translate-y-0.5 active:scale-95"
              >
                <FiPlus size={15} strokeWidth={3} />
                <span>Nuevo tercero</span>
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-auto custom-scrollbar border border-slate-100 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Nombre / Razón Social</th>
                  <th className="px-6 py-4">Documento</th>
                  <th className="px-6 py-4">Teléfono / Email</th>
                  <th className="px-6 py-4">Detalles</th>
                  <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-20 text-center">
                      <div className="w-8 h-8 border-3 border-slate-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" style={{ border: "3px solid #f1f5f9", borderTopColor: "#3b82f6" }} />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando terceros...</span>
                    </td>
                  </tr>
                ) : filteredTerceros.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-20 text-center">
                      <div className="text-3xl mb-3">👥</div>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No se encontraron terceros registrados</p>
                    </td>
                  </tr>
                ) : (
                  filteredTerceros.map((tercero) => {
                    const isNatural = tercero.tipoPersona === "Natural";
                    const dispName = isNatural 
                      ? `${tercero.nombre} ${tercero.apellidos}`.trim()
                      : tercero.razonSocial || tercero.nombre;
                    return (
                      <tr key={tercero.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800 text-[13px]">{dispName}</div>
                          {!isNatural && (
                            <div className="text-[10px] text-slate-400 font-medium">Rep: {`${tercero.nombre} ${tercero.apellidos}`.trim()}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-black mr-2 uppercase">{tercero.tipoDocumento}</span>
                          <span className="text-[12px] font-bold text-slate-600">{tercero.nroDocumento}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[12px] font-bold text-slate-700">{tercero.telefono}</div>
                          <div className="text-[10px] text-slate-400 lowercase">{tercero.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {tercero.isEps && (
                              <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full text-[9px] font-black uppercase">EPS</span>
                            )}
                            <span className="bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full text-[9px] font-black uppercase">{tercero.tipoPersona}</span>
                            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[9px] font-bold">{tercero.identificadorProcedencia}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(tercero)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                              title="Editar tercero"
                            >
                              <FiEdit3 size={15} />
                            </button>
                            <button
                              onClick={() => handleToggleActivo(tercero)}
                              className={`p-2 rounded-xl transition-all ${
                                tercero.activo 
                                  ? "text-emerald-500 hover:text-rose-500 hover:bg-rose-50" 
                                  : "text-slate-300 hover:text-emerald-600 hover:bg-emerald-50"
                              }`}
                              title={tercero.activo ? "Inactivar tercero" : "Activar tercero"}
                            >
                              {tercero.activo ? <FiToggleRight size={18} /> : <FiToggleLeft size={18} />}
                            </button>
                            <button
                              onClick={() => handleDelete(tercero)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                              title="Eliminar tercero"
                            >
                              <FiTrash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* CREATE / EDIT FORM VIEW */
        <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden animate-fadeIn">
          {/* Form Header */}
          <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6 shrink-0">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                Terceros / {editingTercero ? "Editar" : "Nuevo Tercero"}
              </span>
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                {editingTercero ? "Modificar Tercero" : "Información Básica"}
              </h3>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#8dc63f] hover:bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-md shadow-emerald-100 disabled:opacity-50"
            >
              <FiSave size={14} />
              <span>{saving ? "Guardando..." : "Guardar"}</span>
            </button>
          </div>

          {/* Form Body - Scrollable */}
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Nombres */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                  Nombre *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Nombres del tercero"
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-slate-50/30 outline-none focus:border-blue-400 focus:bg-white transition-all caret-slate-950"
                />
              </div>

              {/* Apellidos */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                  Apellidos
                </label>
                <input
                  type="text"
                  value={formData.apellidos}
                  onChange={(e) => setFormData({ ...formData, apellidos: e.target.value })}
                  placeholder="Apellidos del tercero"
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-slate-50/30 outline-none focus:border-blue-400 focus:bg-white transition-all caret-slate-950"
                />
              </div>

              {/* Tipo de Documento */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                  Tipo de documento *
                </label>
                <select
                  required
                  value={formData.tipoDocumento}
                  onChange={(e) => setFormData({ ...formData, tipoDocumento: e.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all"
                >
                  {TIPO_DOCUMENTS.map(doc => (
                    <option key={doc.id} value={doc.id}>{doc.label}</option>
                  ))}
                </select>
              </div>

              {/* Número de Documento */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                  Número de documento *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nroDocumento}
                  onChange={(e) => setFormData({ ...formData, nroDocumento: e.target.value })}
                  placeholder="Reg. de documento del tercero"
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-slate-50/30 outline-none focus:border-blue-400 focus:bg-white transition-all caret-slate-950"
                />
              </div>

              {/* Razón Social */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                  Razón social
                </label>
                <input
                  type="text"
                  value={formData.razonSocial}
                  onChange={(e) => setFormData({ ...formData, razonSocial: e.target.value })}
                  placeholder="Razón social del tercero"
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-slate-50/30 outline-none focus:border-blue-400 focus:bg-white transition-all caret-slate-950"
                />
              </div>

              {/* Teléfono */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                  Teléfono *
                </label>
                <input
                  type="text"
                  required
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  placeholder="Teléfono del tercero"
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-slate-50/30 outline-none focus:border-blue-400 focus:bg-white transition-all caret-slate-950"
                />
              </div>

              {/* País de Domicilio */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                  País de domicilio
                </label>
                <select
                  value={formData.pais}
                  onChange={(e) => setFormData({ ...formData, pais: e.target.value, ciudad: "" })}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all"
                >
                  {PAISES.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Ciudad de Domicilio */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                  Ciudad de domicilio
                </label>
                {formData.pais === "Colombia" ? (
                  <select
                    value={formData.ciudad}
                    onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all"
                  >
                    <option value="">Seleccione...</option>
                    {CIUDADES_COLOMBIA.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.ciudad}
                    onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                    placeholder="Escriba ciudad"
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-slate-50/30 outline-none focus:border-blue-400 focus:bg-white transition-all"
                  />
                )}
              </div>

              {/* Dirección */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                  Dirección *
                </label>
                <input
                  type="text"
                  required
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  placeholder="Dirección del tercero"
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-slate-50/30 outline-none focus:border-blue-400 focus:bg-white transition-all caret-slate-950"
                />
              </div>

              {/* Código Postal */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                  Código postal
                </label>
                <input
                  type="text"
                  value={formData.codigoPostal}
                  onChange={(e) => setFormData({ ...formData, codigoPostal: e.target.value })}
                  placeholder="Código postal"
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-slate-50/30 outline-none focus:border-blue-400 focus:bg-white transition-all caret-slate-950"
                />
              </div>

              {/* Correo Electrónico */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                  Correo electrónico *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Correo tercero"
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-slate-50/30 outline-none focus:border-blue-400 focus:bg-white transition-all caret-slate-950"
                />
              </div>

              {/* Cuenta Contable */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                  Cuenta contable
                </label>
                <select
                  value={formData.cuentaContable}
                  onChange={(e) => setFormData({ ...formData, cuentaContable: e.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all"
                >
                  <option value="">Buscar item...</option>
                  {CUENTAS_CONTABLES.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Identificador de procedencia */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                  Identificador de procedencia *
                </label>
                <select
                  required
                  value={formData.identificadorProcedencia}
                  onChange={(e) => setFormData({ ...formData, identificadorProcedencia: e.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all"
                >
                  {PROCEDENCIAS.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* Responsabilidad Tributaria */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                  Responsabilidad tributaria
                </label>
                <select
                  value={formData.responsabilidadTributaria}
                  onChange={(e) => setFormData({ ...formData, responsabilidadTributaria: e.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all"
                >
                  {RESP_TRIBUTARIAS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Tipo de Persona */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                  Tipo de persona *
                </label>
                <select
                  required
                  value={formData.tipoPersona}
                  onChange={(e) => setFormData({ ...formData, tipoPersona: e.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all"
                >
                  {TIPOS_PERSONA.map(tp => (
                    <option key={tp.id} value={tp.id}>{tp.label}</option>
                  ))}
                </select>
              </div>

              {/* Modalidad de Pago */}
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                  Modalidad de pago *
                </label>
                <select
                  required
                  value={formData.modalidadPago}
                  onChange={(e) => setFormData({ ...formData, modalidadPago: e.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all"
                >
                  {MODALIDADES_PAGO.map(mp => (
                    <option key={mp} value={mp}>{mp}</option>
                  ))}
                </select>
              </div>

              {/* Contrato */}
              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                  Contrato
                </label>
                <input
                  type="text"
                  value={formData.contrato}
                  onChange={(e) => setFormData({ ...formData, contrato: e.target.value })}
                  placeholder="Contrato con el tercero"
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-slate-50/30 outline-none focus:border-blue-400 focus:bg-white transition-all caret-slate-950"
                />
              </div>

              {/* Toggle EPS */}
              <div className="md:col-span-2 flex items-center justify-between p-4 bg-slate-50 border border-slate-200/50 rounded-2xl">
                <div>
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-1">
                    ¿Es una entidad promotora de salud (EPS)?
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">
                    Si se marca, se habilitará automáticamente en las opciones del Generador de RIPS de la clínica.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isEps}
                    onChange={(e) => setFormData({ ...formData, isEps: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8dc63f]"></div>
                </label>
              </div>

              {formData.isEps && (
                <div className="md:col-span-2 animate-fadeIn">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                    Código de entidad administradora *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.codigoEntidadAdministradora || ""}
                    onChange={(e) => setFormData({ ...formData, codigoEntidadAdministradora: e.target.value })}
                    placeholder="Código de entidad administradora"
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-slate-50/30 outline-none focus:border-blue-400 focus:bg-white transition-all caret-slate-950"
                  />
                </div>
              )}

            </div>
          </div>

          {/* Form Actions footer */}
          <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("LIST")}
              className="px-6 py-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 text-[11px] font-black text-slate-600 uppercase tracking-widest border border-slate-200/60 transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-md shadow-blue-100"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
