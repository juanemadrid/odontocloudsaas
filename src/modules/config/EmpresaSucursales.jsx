import React, { useState, useEffect } from "react";
import { FiSearch, FiEdit2, FiTrash2, FiPlus, FiArrowLeft, FiMapPin, FiCheckCircle, FiSave, FiPhoneCall } from "react-icons/fi";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";

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

// Compact Editor Component for Sucursal
function SucursalEditor({ item, onBack, inquilino }) {
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
        entidadExtranjeros: item?.entidadExtranjeros || "000508",
        entidadNacionales: item?.entidadNacionales || "000508",
        centroCostos: item?.centroCostos || false,
        centroCostosValor: item?.centroCostosValor || "",
        usuarioSoporte: item?.usuarioSoporte || "Ninguno",
        codigoPrestadorPropio: item?.codigoPrestadorPropio || false,
        dianResolucion: item?.dianResolucion || "",
        dianPrefijo: item?.dianPrefijo || "",
        dianRangoDesde: item?.dianRangoDesde || 1,
        dianRangoHasta: item?.dianRangoHasta || 1000,
        dianClaveTecnica: item?.dianClaveTecnica || "",
        dianFechaResolucion: item?.dianFechaResolucion || ""
    });

    const [allAlmacenes, setAllAlmacenes] = useState([]);
    const [selectedAlmacenesIds, setSelectedAlmacenesIds] = useState(item?.almacenesIds || []);
    const [consecutivos, setConsecutivos] = useState([]);
    const [listasPrecios, setListasPrecios] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const loadDeps = async () => {
            if (!inquilino) return;
            try {
                const snapC = await getDocs(query(collection(db, "consecutivos"), where("inquilino", "==", inquilino)));
                setConsecutivos(snapC.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));

                const snapL = await getDocs(query(collection(db, "listas_precios"), where("inquilino", "==", inquilino)));
                setListasPrecios(snapL.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));

                const snapA = await getDocs(query(collection(db, "almacenes"), where("inquilino", "==", inquilino)));
                setAllAlmacenes(snapA.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));
            } catch (e) { console.error(e); }
        };
        loadDeps();
    }, [inquilino]);

    const handleChange = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!form.nombre.trim()) return alert("El nombre es obligatorio");
        if (!form.telefono.trim()) return alert("El teléfono fijo es obligatorio");
        if (!form.celular.trim()) return alert("El celular es obligatorio");
        if (!form.ciudad) return alert("La ciudad es obligatoria");
        if (!form.direccion.trim()) return alert("La dirección es obligatoria");
        if (!form.email.trim()) return alert("El correo electrónico es obligatorio");

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(form.email)) return alert("El correo electrónico no es válido");

        setIsSaving(true);
        try {
            const payload = { ...form, inquilino, almacenesIds: selectedAlmacenesIds, actualizado: new Date() };
            if (item?.id) {
                await updateDoc(doc(db, "sucursales", item.id), payload);
            } else {
                await addDoc(collection(db, "sucursales"), { ...payload, creado: new Date() });
            }
            onBack();
        } catch (e) {
            console.error(e);
            alert("Error al guardar: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-md max-w-4xl mx-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                    <button
                        onClick={onBack}
                        className="w-7 h-7 rounded-lg text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors border-0 cursor-pointer bg-transparent"
                    >
                        <FiArrowLeft size={16} />
                    </button>
                    <div>
                        <h2 className="text-[15px] font-bold text-slate-800">
                            {item ? "Editar Sucursal" : "Nueva Sucursal"}
                        </h2>
                        <p className="text-[11px] text-slate-500">Gestión de sede física y datos de facturación</p>
                    </div>
                </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Nombre de la Sede *</label>
                        <input
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            value={form.nombre}
                            onChange={e => handleChange("nombre", e.target.value)}
                            placeholder="Ej. Sede Principal"
                            autoFocus
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Ciudad *</label>
                        <select
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            value={form.ciudad}
                            onChange={e => handleChange("ciudad", e.target.value)}
                        >
                            <option value="">Seleccione una ciudad...</option>
                            {CIUDADES_COLOMBIA.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Teléfono Fijo *</label>
                        <input
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            value={form.telefono}
                            onChange={e => handleChange("telefono", e.target.value)}
                            placeholder="Ej. (601) 555-1234"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Celular *</label>
                        <input
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            value={form.celular}
                            onChange={e => handleChange("celular", e.target.value)}
                            placeholder="Ej. 300 123 4567"
                        />
                    </div>

                    <div className="space-y-1 md:col-span-2">
                        <label className="text-[11px] font-bold text-slate-600">Dirección Exacta *</label>
                        <input
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            value={form.direccion}
                            onChange={e => handleChange("direccion", e.target.value)}
                            placeholder="Ej. Carrera 42C # 17A - 35"
                        />
                    </div>

                    <div className="space-y-1 md:col-span-2">
                        <label className="text-[11px] font-bold text-slate-600">Correo Electrónico de la Sede *</label>
                        <input
                            type="email"
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            value={form.email}
                            onChange={e => handleChange("email", e.target.value)}
                            placeholder="Ej. sede.principal@clinica.com"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Consecutivo de Facturación</label>
                        <select
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            value={form.consecutivoId}
                            onChange={e => handleChange("consecutivoId", e.target.value)}
                        >
                            <option value="">Seleccione consecutivo...</option>
                            {consecutivos.map(c => (
                                <option key={c.id} value={c.id}>{c.nombre || c.id}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Lista de Precios Predeterminada</label>
                        <select
                            className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            value={form.listaPrecioId}
                            onChange={e => handleChange("listaPrecioId", e.target.value)}
                        >
                            <option value="">Seleccione lista de precio...</option>
                            {listasPrecios.map(l => (
                                <option key={l.id} value={l.id}>{l.nombre || l.id}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onBack}
                        className="px-4 py-2 rounded-lg text-slate-600 font-semibold hover:bg-slate-100 transition-colors text-[12px] border border-slate-200 bg-white cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-[12px] font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer border-0"
                    >
                        {isSaving ? (
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                            <FiSave size={15} />
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
            const q = query(collection(db, "sucursales"), where("inquilino", "==", inquilino));
            const snap = await getDocs(q);
            setRows(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));
        } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    useEffect(() => { fetchData(); }, [inquilino]);

    const handleDelete = async (id) => {
        if (!window.confirm("¿Estás seguro de eliminar esta sucursal?")) return;
        try {
            await deleteDoc(doc(db, "sucursales", id));
            setRows(prev => prev.filter(r => r.id !== id));
        } catch (e) {
            alert("Error al eliminar: " + e.message);
        }
    };

    if (view === "editor") return <SucursalEditor item={editingItem} onBack={() => { setView("list"); fetchData(); }} inquilino={inquilino} />;

    const filteredRows = rows.filter(r => (r.nombre || "").toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-4">
            {/* Header / Search Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FiMapPin size={18} />
                    </div>
                    <div>
                        <h1 className="text-[16px] font-bold text-slate-800 tracking-tight">Sucursales</h1>
                        <p className="text-[11px] text-slate-500 font-medium">Sedes y puntos de atención de la clínica</p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full h-8 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors"
                        />
                    </div>
                    <button
                        onClick={() => { setEditingItem(null); setView("editor"); }}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border-0 shrink-0"
                    >
                        <FiPlus size={16} />
                        <span>Nueva</span>
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                            <th className="py-2.5 px-4">Nombre de Sede</th>
                            <th className="py-2.5 px-4">Ubicación y Contacto</th>
                            <th className="py-2.5 px-4">Estado</th>
                            <th className="py-2.5 px-4 text-right">Operaciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[12px] text-slate-700">
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
                                    <td className="py-2.5 px-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                                                🏢
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800">{row.nombre}</span>
                                                <span className="text-[10px] text-slate-400">{row.ciudad}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-4">
                                        <div className="space-y-0.5">
                                            <div className="font-semibold text-slate-700 text-[11px] flex items-center gap-1">
                                                <FiPhoneCall size={11} className="text-slate-400" />
                                                {row.celular || row.telefono || "Sin contacto"}
                                            </div>
                                            <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                                <FiMapPin size={10} className="text-slate-400" />
                                                {row.direccion || "Sin dirección"}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-4">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                                            <FiCheckCircle size={10} /> Activo
                                        </span>
                                    </td>
                                    <td className="py-2.5 px-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => { setEditingItem(row); setView("editor"); }}
                                                className="w-7 h-7 rounded-lg bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                title="Editar Sucursal"
                                            >
                                                <FiEdit2 size={13} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(row.id)}
                                                className="w-7 h-7 rounded-lg bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                title="Eliminar Sucursal"
                                            >
                                                <FiTrash2 size={13} />
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
