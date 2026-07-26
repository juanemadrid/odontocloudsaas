import React, { useState, useEffect } from "react";
import { FiSearch, FiEdit2, FiTrash2, FiPlus, FiArrowLeft, FiMapPin, FiCheckCircle, FiSave, FiPhoneCall } from "react-icons/fi";
import supabase from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const CIUDADES_COLOMBIA = [
    "Abejorral", "Acacías", "Aguachica", "Agustín Codazzi", "Anapoima", "Andes", "Apartadó", "Aracataca", "Arauca", "Armenia",
    "Baranoa", "Barbosa", "Barrancabermeja", "Barranquilla", "Bello", "Bogotá D.C.", "Bucaramanga", "Buenaventura", "Buga",
    "Cajicá", "Calarcá", "Caldas", "Cali", "Candelaria", "Carepa", "Cartagena", "Cartago", "Caucasia", "Cereté", "Chía",
    "Chigorodó", "Chiquinquirá", "Ciénaga", "Cota", "Cúcuta", "Dosquebradas", "Duitama", "El Bagre", "El Carmen de Viboral",
    "Envigado", "Espinal", "Facatativá", "Florencia", "Floridablanca", "Fundación", "Funza", "Fusagasugá", "Garzón", "Girardot",
    "Girón", "Granada", "Honda", "Ibagué", "Ipiales", "Itagüí", "Jamundí", "La Ceja", "La Dorada", "La Estrella", "La Mesa",
    "Lorica", "Madrid", "Magangué", "Maicao", "Malambo", "Manizales", "Marinilla", "Medellín", "Melgar", "Mitú", "Montelíbano",
    "Montería", "Mosquera", "Neiva", "Ocaña", "Paipa", "Palmira", "Pamplona", "Pasto", "Pereira", "Pitalito", "Planeta Rica",
    "Plato", "Popayán", "Puerto Asís", "Puerto Berrío", "Puerto Boyacá", "Puerto Carreño", "Puerto Colombia", "Quibdó",
    "Riohacha", "Rionegro", "Sabanalarga", "Sabaneta", "Sahagún", "San Andrés", "San Gil", "Santa Marta", "Santa Rosa de Cabal",
    "Santander de Quilichao", "Saravena", "Sevilla", "Sibaté", "Sincelejo", "Soacha", "Socorro", "Sogamoso", "Soledad", "Sonsón",
    "Sopó", "Tibú", "Tierralta", "Tuluá", "Tumaco", "Tunja", "Turbaco", "Turbo", "Valledupar", "Villa del Rosario", "Villavicencio",
    "Villeta", "Yopal", "Yumbo", "Zipaquirá"
].sort();

// Editor Component for Sucursal
function SucursalEditor({ item, onBack, inquilino }) {
    const toast = useToast();
    const [form, setForm] = useState({
        nombre: item?.nombre || "",
        telefono: item?.telefono || "",
        celular: item?.celular || "",
        ciudad: item?.ciudad || "",
        direccion: item?.direccion || "",
        codigoPostal: item?.codigoPostal || "",
        email: item?.email || "",
        consecutivoId: item?.consecutivoId || "",
        listaPrecioId: item?.listaPrecioId || "",
        mostrarPie: item?.mostrarPie || false,
        piePersonalizado: item?.piePersonalizado || "",
        codigoPrestador: item?.codigoPrestador || "",
    });

    const [consecutivos, setConsecutivos] = useState([]);
    const [listasPrecios, setListasPrecios] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const loadDeps = async () => {
            if (!inquilino) return;
            try {
                const [cRes, lRes] = await Promise.all([
                    supabase.from("consecutivos").select("*").eq("tenant_id", inquilino),
                    supabase.from("listas_precios").select("*").eq("tenant_id", inquilino)
                ]);
                if (cRes.data) setConsecutivos(cRes.data);
                if (lRes.data) setListasPrecios(lRes.data);
            } catch (e) { console.error(e); }
        };
        loadDeps();
    }, [inquilino]);

    const handleChange = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!form.nombre.trim()) return alert("El nombre es obligatorio");
        if (!form.ciudad) return alert("La ciudad es obligatoria");

        setIsSaving(true);
        try {
            const payload = {
                nombre: form.nombre.trim(),
                ciudad: form.ciudad,
                direccion: form.direccion,
                telefono: form.telefono,
                celular: form.celular,
                email: form.email,
                tenant_id: inquilino,
            };

            if (item?.id) {
                const { error } = await supabase
                    .from("sucursales")
                    .update(payload)
                    .eq("id", item.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from("sucursales")
                    .insert([payload]);
                if (error) throw error;
            }

            if (toast?.success) toast.success("Sucursal guardada correctamente en Supabase");
            onBack();
        } catch (e) {
            console.error(e);
            alert("Error al guardar en Supabase: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md max-w-4xl mx-auto overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                    <button
                        onClick={onBack}
                        className="w-8 h-8 rounded-lg text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors border-0 cursor-pointer bg-transparent"
                    >
                        <FiArrowLeft size={18} />
                    </button>
                    <div>
                        <h2 className="text-[16px] font-black text-slate-800 uppercase">
                            {item ? "Editar Sucursal" : "Nueva Sucursal"}
                        </h2>
                        <p className="text-[11px] font-semibold text-slate-500">Gestión de sede física y contacto de la clínica</p>
                    </div>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Nombre de la Sede *</label>
                        <input
                            required
                            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            value={form.nombre}
                            onChange={e => handleChange("nombre", e.target.value)}
                            placeholder="Ej. Sede Principal"
                            autoFocus
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Ciudad *</label>
                        <input
                            required
                            list="ciudades-colombia-list"
                            type="text"
                            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            value={form.ciudad}
                            onChange={e => handleChange("ciudad", e.target.value)}
                            placeholder="Escribe o busca la ciudad (Ej. Bogotá, Medellín)..."
                        />
                        <datalist id="ciudades-colombia-list">
                            {CIUDADES_COLOMBIA.map(c => (
                                <option key={c} value={c} />
                            ))}
                        </datalist>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Teléfono Fijo</label>
                        <input
                            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            value={form.telefono}
                            onChange={e => handleChange("telefono", e.target.value)}
                            placeholder="Ej. (601) 555-1234"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Celular</label>
                        <input
                            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            value={form.celular}
                            onChange={e => handleChange("celular", e.target.value)}
                            placeholder="Ej. 300 123 4567"
                        />
                    </div>

                    <div className="space-y-1 md:col-span-2">
                        <label className="text-[11px] font-bold text-slate-600">Dirección Exacta</label>
                        <input
                            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            value={form.direccion}
                            onChange={e => handleChange("direccion", e.target.value)}
                            placeholder="Ej. Carrera 42C # 17A - 35"
                        />
                    </div>

                    <div className="space-y-1 md:col-span-2">
                        <label className="text-[11px] font-bold text-slate-600">Correo Electrónico de la Sede</label>
                        <input
                            type="email"
                            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            value={form.email}
                            onChange={e => handleChange("email", e.target.value)}
                            placeholder="Ej. sede.principal@clinica.com"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onBack}
                        className="px-5 py-2.5 rounded-xl text-slate-600 font-bold hover:bg-slate-100 transition-colors text-xs border border-slate-200 bg-white cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-blue-200 flex items-center gap-2 cursor-pointer border-0 disabled:opacity-50"
                    >
                        {isSaving ? (
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                            <FiSave size={16} />
                        )}
                        <span>{isSaving ? "Guardando..." : "Guardar Sucursal"}</span>
                    </button>
                </div>
            </form>
        </div>
    );
}

// Main Component
export default function EmpresaSucursales() {
    const { userProfile } = useAuth();
    const toast = useToast();
    const inquilino = userProfile?.inquilino;

    const [searchTerm, setSearchTerm] = useState("");
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState("list");
    const [editingItem, setEditingItem] = useState(null);

    const fetchData = async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("sucursales")
                .select("*")
                .eq("tenant_id", inquilino);

            if (error) throw error;
            setRows((data || []).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));
        } catch (error) {
            console.error("Error fetching sucursales:", error);
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [inquilino]);

    const handleDelete = async (id, nombre) => {
        if (!window.confirm(`⚠️ ¿Seguro que deseas eliminar la sucursal "${nombre || ''}"? Esta acción no se puede deshacer.`)) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from("sucursales")
                .delete()
                .eq("id", id);

            if (error) throw error;

            setRows(prev => prev.filter(r => r.id !== id));
            if (toast?.success) toast.success("Sucursal eliminada correctamente");
            else alert("✅ Sucursal eliminada correctamente");
        } catch (e) {
            console.error("Error al eliminar sucursal:", e);
            alert("❌ Error al eliminar la sucursal: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    if (view === "editor") return <SucursalEditor item={editingItem} onBack={() => { setView("list"); fetchData(); }} inquilino={inquilino} />;

    const filteredRows = rows.filter(r => (r.nombre || "").toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-4">
            {/* Header / Search Toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FiMapPin size={20} />
                    </div>
                    <div>
                        <h1 className="text-base font-black text-slate-800 uppercase tracking-tight">Sucursales / Sedes</h1>
                        <p className="text-xs font-medium text-slate-500">Puntos de atención registrados para la clínica</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 transition-colors"
                            placeholder="Buscar sede..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => { setEditingItem(null); setView("editor"); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-blue-200 flex items-center gap-2 transition-all cursor-pointer border-0 shrink-0"
                    >
                        <FiPlus size={16} />
                        <span>Nueva Sede</span>
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-black uppercase tracking-wider">
                            <th className="py-3 px-4">Nombre de Sede</th>
                            <th className="py-3 px-4">Ubicación y Contacto</th>
                            <th className="py-3 px-4">Estado</th>
                            <th className="py-3 px-4 text-right">Operaciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                                    <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                                    Cargando sucursales...
                                </td>
                            </tr>
                        ) : filteredRows.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                                    No se encontraron sucursales registradas
                                </td>
                            </tr>
                        ) : (
                            filteredRows.map(row => (
                                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                                                🏢
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800">{row.nombre}</span>
                                                <span className="text-[10px] font-medium text-slate-400">{row.ciudad}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="space-y-0.5">
                                            <div className="font-semibold text-slate-700 text-[11px] flex items-center gap-1.5">
                                                <FiPhoneCall size={12} className="text-slate-400" />
                                                {row.celular || row.telefono || "Sin contacto"}
                                            </div>
                                            <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                                                <FiMapPin size={11} className="text-slate-400" />
                                                {row.direccion || "Sin dirección"}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                                            <FiCheckCircle size={11} /> Activa
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => { setEditingItem(row); setView("editor"); }}
                                                className="w-8 h-8 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-colors shadow-xs cursor-pointer border-0"
                                                title="Editar Sede"
                                            >
                                                <FiEdit2 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(row.id, row.nombre)}
                                                className="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors shadow-xs cursor-pointer border-0"
                                                title="Eliminar Sede"
                                            >
                                                <FiTrash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
