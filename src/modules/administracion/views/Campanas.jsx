// src/modules/administracion/views/Campanas.jsx
import React, { useState, useEffect } from "react";
import { db } from "../../../firebase/firebaseConfig";
import { 
  collection, query, where, getDocs, doc, setDoc, 
  addDoc, serverTimestamp, updateDoc, deleteDoc 
} from "firebase/firestore";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { 
  FiPieChart, FiPlus, FiSearch, FiEdit3, FiTrash2, 
  FiSave, FiAlertCircle, FiEye, FiEyeOff, FiToggleLeft, FiToggleRight 
} from "react-icons/fi";

export default function Campanas() {
  const { userProfile } = useAuth();
  const toast = useToast();
  const inquilino = userProfile?.inquilino || userProfile?.tenantId;

  // Views: 'LIST' | 'FORM'
  const [viewMode, setViewMode] = useState("LIST");
  const [campanas, setCampanas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingCampana, setEditingCampana] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [showInactivos, setShowInactivos] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    nombre: "",
    activo: true
  });

  useEffect(() => {
    if (inquilino) loadCampanas();
  }, [inquilino]);

  const loadCampanas = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "campanas"), 
        where("inquilino", "==", inquilino)
      );
      const snap = await getDocs(q);
      setCampanas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error("Error loading campanas:", e);
      toast?.error("Error al cargar campañas");
    } finally {
      setLoading(false);
    }
  };

  const handleNew = () => {
    setEditingCampana(null);
    setFormData({
      nombre: "",
      activo: true
    });
    setViewMode("FORM");
  };

  const handleEdit = (campana) => {
    setEditingCampana(campana);
    setFormData({
      nombre: campana.nombre || "",
      activo: campana.activo !== undefined ? campana.activo : true
    });
    setViewMode("FORM");
  };

  const handleToggleActivo = async (campana) => {
    try {
      const docRef = doc(db, "campanas", campana.id);
      const newStatus = !campana.activo;
      await updateDoc(docRef, { activo: newStatus });
      toast?.success(`Campaña ${newStatus ? "activada" : "inactivada"} con éxito`);
      loadCampanas();
    } catch (e) {
      console.error(e);
      toast?.error("Error al actualizar estado");
    }
  };

  const handleDelete = async (campana) => {
    if (!window.confirm(`¿Está seguro de que desea eliminar permanentemente la campaña "${campana.nombre}"?`)) return;
    try {
      await deleteDoc(doc(db, "campanas", campana.id));
      toast?.success("Campaña eliminada con éxito");
      loadCampanas();
    } catch (e) {
      console.error(e);
      toast?.error("Error al eliminar la campaña");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) return toast?.error("El nombre de la campaña es requerido");

    setSaving(true);
    try {
      const dataToSave = {
        ...formData,
        nombre: formData.nombre.trim(),
        inquilino,
        updatedAt: serverTimestamp()
      };

      if (editingCampana?.id) {
        await setDoc(doc(db, "campanas", editingCampana.id), dataToSave, { merge: true });
      } else {
        dataToSave.createdAt = serverTimestamp();
        await addDoc(collection(db, "campanas"), dataToSave);
      }

      toast?.success(editingCampana ? "Campaña actualizada correctamente" : "Campaña creada con éxito");
      setViewMode("LIST");
      loadCampanas();
    } catch (e) {
      console.error(e);
      toast?.error("Error al guardar la campaña");
    } finally {
      setSaving(false);
    }
  };

  // Filtered List
  const filteredCampanas = campanas.filter(c => {
    const isStatusMatch = showInactivos ? !c.activo : c.activo;
    if (!isStatusMatch) return false;

    const term = searchQuery.toLowerCase();
    const cName = (c.nombre || "").toLowerCase();
    return cName.includes(term);
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
                placeholder="Buscar campaña..."
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
                <span>{showInactivos ? "Ver Activas" : "Ver Inactivas"}</span>
              </button>

              <button
                onClick={handleNew}
                className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#8dc63f] hover:bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-md shadow-emerald-100 hover:-translate-y-0.5 active:scale-95"
              >
                <FiPlus size={15} strokeWidth={3} />
                <span>Nueva campaña</span>
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-auto custom-scrollbar border border-slate-100 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Nombre de la Campaña</th>
                  <th className="px-6 py-4 text-center">Estado</th>
                  <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan="3" className="px-6 py-20 text-center">
                      <div className="w-8 h-8 border-3 border-slate-100 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" style={{ border: "3px solid #f1f5f9", borderTopColor: "#3b82f6" }} />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando campañas...</span>
                    </td>
                  </tr>
                ) : filteredCampanas.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="px-6 py-20 text-center">
                      <div className="text-3xl mb-3">📢</div>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No se encontraron campañas registradas</p>
                    </td>
                  </tr>
                ) : (
                  filteredCampanas.map((campana) => (
                    <tr key={campana.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-800 text-[13px]">
                        {campana.nombre}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                          campana.activo 
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                            : "bg-rose-50 text-rose-600 border border-rose-100"
                        }`}>
                          {campana.activo ? "Activa" : "Inactiva"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(campana)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                            title="Editar campaña"
                          >
                            <FiEdit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleToggleActivo(campana)}
                            className={`p-2 rounded-xl transition-all ${
                              campana.activo 
                                ? "text-emerald-500 hover:text-rose-500 hover:bg-rose-50" 
                                : "text-slate-300 hover:text-emerald-600 hover:bg-emerald-50"
                            }`}
                            title={campana.activo ? "Inactivar campaña" : "Activar campaña"}
                          >
                            {campana.activo ? <FiToggleRight size={18} /> : <FiToggleLeft size={18} />}
                          </button>
                          <button
                            onClick={() => handleDelete(campana)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                            title="Eliminar campaña"
                          >
                            <FiTrash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
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
                Campañas / {editingCampana ? "Editar" : "Nueva Campaña"}
              </span>
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">
                {editingCampana ? "Modificar Campaña" : "Información Básica"}
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

          {/* Form Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-6 space-y-6">
            <div className="bg-slate-50/50 p-6 rounded-2xl border border-slate-100 space-y-6">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">
                  Nombre *
                </label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  placeholder="Nombre de la campaña"
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 bg-white outline-none focus:border-blue-400 transition-all caret-slate-950"
                />
              </div>

              {/* Toggle Activo */}
              <div className="flex items-center justify-between p-4 bg-white border border-slate-200/50 rounded-2xl">
                <div>
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider block mb-1">
                    Campaña Activa
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">
                    Si se desactiva, los usuarios no podrán asignarla como origen de remisión en nuevos pacientes.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#8dc63f]"></div>
                </label>
              </div>
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
