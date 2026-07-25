import React, { useState, useEffect } from "react";
import { FiSearch, FiEdit2, FiTrash2, FiPlus, FiSave, FiX, FiBook, FiBriefcase } from "react-icons/fi";
import { collection, query, orderBy, deleteDoc, doc, updateDoc, setDoc, getDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

const INITIAL_CLASSES = [
    { code: "1", nombre: "Activos" },
    { code: "2", nombre: "Pasivos" },
    { code: "3", nombre: "Patrimonio" },
    { code: "4", nombre: "Ingresos" },
    { code: "5", nombre: "Egresos" },
    { code: "6", nombre: "Costos de ventas" },
    { code: "7", nombre: "Costos de producción" },
    { code: "8", nombre: "Cuentas de orden deudoras" },
    { code: "9", nombre: "Cuentas de orden acreedoras" }
];

export default function ConfigCatalogoCuentas() {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;
    const toast = useToast();

    // GENERAL CONFIG STATE
    const [generalConfig, setGeneralConfig] = useState({
        comprobanteFacturasEmpresas: "",
        comprobanteFacturasPersonas: "",
        comprobanteRecibosCaja: ""
    });
    const [savingGeneral, setSavingGeneral] = useState(false);

    // CATALOGO STATE
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // MODAL STATE
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [savingAccount, setSavingAccount] = useState(false);
    const [formData, setFormData] = useState({
        nombre: "",
        codigoPadre: "",
        codigoSufijo: "",
        descripcion: "",
        naturaleza: "Debito"
    });

    useEffect(() => {
        if (!inquilino) return;

        fetchGeneralConfig();

        setLoading(true);
        const q = query(
            collection(db, "tenants", inquilino, "catalogo_cuentas"),
            orderBy("codigo", "asc")
        );

        const unsub = onSnapshot(q, (snap) => {
            const fetchedAccounts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const combined = [...fetchedAccounts];
            INITIAL_CLASSES.forEach(c => {
                if (!combined.find(a => a.codigo === c.code)) {
                    combined.push({ id: `base-${c.code}`, codigo: c.code, nombre: c.nombre, isBase: true });
                }
            });
            combined.sort((a, b) => a.codigo.localeCompare(b.codigo));
            setAccounts(combined);
            setLoading(false);
        }, (err) => {
            console.error(err);
            if (toast?.error) toast.error("Error al sincronizar catálogo");
            setLoading(false);
        });

        return () => unsub();
    }, [inquilino]);

    const fetchGeneralConfig = async () => {
        try {
            const docSnap = await getDoc(doc(db, "tenants", inquilino, "config", "contabilidad"));
            if (docSnap.exists()) {
                setGeneralConfig(docSnap.data());
            }
        } catch (e) {
            console.error("Error fetching config:", e);
        }
    };

    const handleSaveGeneral = async () => {
        setSavingGeneral(true);
        try {
            await setDoc(doc(db, "tenants", inquilino, "config", "contabilidad"), {
                ...generalConfig,
                updatedAt: serverTimestamp(),
                updatedBy: userProfile.email
            }, { merge: true });
            if (toast?.success) toast.success("Configuración contable guardada");
        } catch (e) {
            console.error(e);
            if (toast?.error) toast.error("Error al guardar configuración");
        } finally {
            setSavingGeneral(false);
        }
    };

    const handleSaveAccount = async (e) => {
        if (e) e.preventDefault();
        if (!formData.nombre.trim()) {
            if (toast?.warning) toast.warning("Defina el nombre de la cuenta");
            return;
        }
        if (!formData.codigoSufijo.trim()) {
            if (toast?.warning) toast.warning("El código es obligatorio");
            return;
        }

        const codigoCompleto = formData.codigoPadre ? `${formData.codigoPadre}${formData.codigoSufijo}` : formData.codigoSufijo;

        if (!editingId && accounts.find(a => a.codigo === codigoCompleto)) {
            if (toast?.error) toast.error("El código contable ya existe");
            return;
        }

        setSavingAccount(true);
        try {
            const payload = {
                nombre: formData.nombre.trim(),
                codigo: codigoCompleto,
                codigoPadre: formData.codigoPadre,
                descripcion: formData.descripcion.trim(),
                naturaleza: formData.naturaleza,
                updatedAt: serverTimestamp(),
                updatedBy: userProfile.email
            };

            if (editingId) {
                await updateDoc(doc(db, "tenants", inquilino, "catalogo_cuentas", editingId), payload);
                if (toast?.success) toast.success("Cuenta contable actualizada");
            } else {
                await setDoc(doc(db, "tenants", inquilino, "catalogo_cuentas", codigoCompleto), {
                    ...payload,
                    createdAt: serverTimestamp(),
                    createdBy: userProfile.email
                });
                if (toast?.success) toast.success("Nueva cuenta vinculada al catálogo");
            }
            closeModal();
        } catch (e) {
            console.error(e);
            if (toast?.error) toast.error("Error al procesar registro");
        } finally {
            setSavingAccount(false);
        }
    };

    const handleDeleteAccount = async (id) => {
        if (!window.confirm("¿Seguro que desea eliminar esta cuenta del PUC?")) return;
        try {
            await deleteDoc(doc(db, "tenants", inquilino, "catalogo_cuentas", id));
            if (toast?.success) toast.success("Cuenta removida del catálogo");
        } catch (e) {
            console.error(e);
            if (toast?.error) toast.error("Error al eliminar");
        }
    };

    const openModal = (item = null) => {
        if (item) {
            setEditingId(item.id);
            setFormData({
                nombre: item.nombre,
                codigoPadre: item.codigoPadre || "",
                codigoSufijo: item.codigo.replace(item.codigoPadre || "", ""),
                descripcion: item.descripcion || "",
                naturaleza: item.naturaleza || "Debito"
            });
        } else {
            setEditingId(null);
            setFormData({
                nombre: "",
                codigoPadre: "",
                codigoSufijo: "",
                descripcion: "",
                naturaleza: "Debito"
            });
        }
        setShowModal(true);
    };

    const closeModal = () => setShowModal(false);

    const filteredAccounts = accounts.filter(a =>
        a.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.codigo.includes(searchTerm)
    );

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-4">
            {/* Header Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FiBriefcase size={18} />
                    </div>
                    <div>
                        <h1 className="text-[16px] font-bold text-slate-800 tracking-tight">Gestión Contable</h1>
                        <p className="text-[11px] text-slate-500 font-medium">Configuración de comprobantes y Plan Único de Cuentas (PUC)</p>
                    </div>
                </div>

                <button
                    onClick={handleSaveGeneral}
                    disabled={savingGeneral}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border-0 shrink-0"
                >
                    {savingGeneral ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                        <FiSave size={15} />
                    )}
                    <span>Guardar Ajustes</span>
                </button>
            </div>

            {/* Comprobantes Contables Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                <h2 className="text-[13px] font-bold text-slate-800 uppercase tracking-tight">Comprobantes Contables por Defecto</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Facturas - Empresas</label>
                        <input
                            type="text"
                            placeholder="Ej. FVE-001"
                            value={generalConfig.comprobanteFacturasEmpresas}
                            onChange={e => setGeneralConfig({ ...generalConfig, comprobanteFacturasEmpresas: e.target.value })}
                            className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Facturas - Personas</label>
                        <input
                            type="text"
                            placeholder="Ej. FVP-001"
                            value={generalConfig.comprobanteFacturasPersonas}
                            onChange={e => setGeneralConfig({ ...generalConfig, comprobanteFacturasPersonas: e.target.value })}
                            className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-600">Recibos de Caja</label>
                        <input
                            type="text"
                            placeholder="Ej. RC-001"
                            value={generalConfig.comprobanteRecibosCaja}
                            onChange={e => setGeneralConfig({ ...generalConfig, comprobanteRecibosCaja: e.target.value })}
                            className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                </div>
            </div>

            {/* Plan Unico de Cuentas (PUC) Table Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
                <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                            <FiBook size={15} />
                        </div>
                        <h2 className="text-[14px] font-bold text-slate-800">Plan Único de Cuentas (PUC)</h2>
                    </div>

                    <div className="flex items-center gap-2.5 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="text"
                                placeholder="Buscar cuenta o código..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-8 pl-8 pr-3 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>

                        <button
                            onClick={() => openModal()}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border-0 shrink-0"
                        >
                            <FiPlus size={16} />
                            <span>Nueva Cuenta</span>
                        </button>
                    </div>
                </div>

                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                            <th className="py-2.5 px-4">Jerarquía / Código y Cuenta</th>
                            <th className="py-2.5 px-4 text-right">Operaciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[12px] text-slate-700">
                        {loading ? (
                            <tr>
                                <td colSpan={2} className="py-12 text-center text-slate-400 font-medium">
                                    <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                                    Cargando catálogo contable PUC...
                                </td>
                            </tr>
                        ) : filteredAccounts.length === 0 ? (
                            <tr>
                                <td colSpan={2} className="py-12 text-center text-slate-400 font-medium">
                                    No se encontraron cuentas contables en el catálogo
                                </td>
                            </tr>
                        ) : (
                            filteredAccounts.map(acc => {
                                const level = acc.codigo.length;
                                const indent = (level - 1) * 20;
                                return (
                                    <tr key={acc.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="py-2.5 px-4">
                                            <div className="flex items-center gap-2" style={{ paddingLeft: `${indent}px` }}>
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${level === 1 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                                                    {acc.codigo}
                                                </span>
                                                <span className={`font-bold uppercase ${level === 1 ? 'text-slate-800' : 'text-slate-700'}`}>
                                                    {acc.nombre}
                                                </span>
                                                {acc.descripcion && (
                                                    <span className="text-[10px] text-slate-400 ml-2 hidden sm:inline">
                                                        ({acc.descripcion})
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-2.5 px-4 text-right">
                                            {acc.isBase ? (
                                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                                                    ESTRUCTURA BASE
                                                </span>
                                            ) : (
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => openModal(acc)}
                                                        className="w-7 h-7 rounded-lg bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                        title="Editar Cuenta"
                                                    >
                                                        <FiEdit2 size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteAccount(acc.id)}
                                                        className="w-7 h-7 rounded-lg bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                        title="Eliminar Cuenta"
                                                    >
                                                        <FiTrash2 size={13} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal Form */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/70 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                    <FiBook size={15} />
                                </div>
                                <h3 className="text-[14px] font-bold text-slate-800">
                                    {editingId ? "Editar Cuenta Contable" : "Nueva Cuenta Contable"}
                                </h3>
                            </div>
                            <button
                                onClick={closeModal}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors border-0 cursor-pointer bg-transparent"
                            >
                                <FiX size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveAccount} className="p-5 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Código Padre / Subcuenta</label>
                                <input
                                    type="text"
                                    placeholder="Ej. 11, 1105 (Dejar en blanco si es clase)"
                                    value={formData.codigoPadre}
                                    onChange={(e) => setFormData({ ...formData, codigoPadre: e.target.value })}
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] font-mono text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Código Sufijo *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej. 05, 10"
                                    value={formData.codigoSufijo}
                                    onChange={(e) => setFormData({ ...formData, codigoSufijo: e.target.value })}
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] font-mono font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Nombre de la Cuenta *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej. CAJA GENERAL, BANCOS NACIONALES"
                                    value={formData.nombre}
                                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] text-slate-800 outline-none focus:border-blue-500 transition-colors uppercase"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Naturaleza *</label>
                                <select
                                    value={formData.naturaleza}
                                    onChange={(e) => setFormData({ ...formData, naturaleza: e.target.value })}
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500 transition-colors"
                                >
                                    <option value="Debito">Débito (+)</option>
                                    <option value="Credito">Crédito (-)</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-slate-600">Descripción / Nota</label>
                                <textarea
                                    rows={2}
                                    placeholder="Detalles sobre el uso de esta cuenta..."
                                    value={formData.descripcion}
                                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                                    className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:border-blue-500 transition-colors resize-none"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-1.5 rounded-lg text-slate-600 font-semibold hover:bg-slate-100 transition-colors text-[12px] border border-slate-200 bg-white cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingAccount}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer border-0"
                                >
                                    {savingAccount ? (
                                        <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <FiSave size={15} />
                                    )}
                                    <span>{savingAccount ? "Guardando..." : "Guardar Cuenta"}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
