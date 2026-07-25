import React, { useState, useEffect } from "react";
import { 
    FiArrowLeft, FiCalendar, FiBriefcase, FiUser, 
    FiSave, FiAlertCircle, FiCheckCircle 
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { db } from "../../../firebase/firebaseConfig";
import { buildDashboardPath } from "../../../utils/dashboardBasePath";
import { 
    collection, addDoc, getDocs, query, where, 
    serverTimestamp, increment, doc, updateDoc, Timestamp 
} from "firebase/firestore";
import { useAuth } from "../../../context/AuthContext";

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

// Modern label+field pair
const Field = ({ label, required, children, colSpan }) => (
  <div className={colSpan === 2 ? "md:col-span-2" : ""}>
    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-0.5">
      {label}{required && <span className="text-rose-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);

export default function SaldoFavorForm({ onCancel, onSuccess }) {
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || "";

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    // Form State
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [profesional, setProfesional] = useState({ id: "", nombre: "" });
    const [paciente, setPaciente] = useState(null);
    const [valor, setValor] = useState("");
    const [medioPago, setMedioPago] = useState("Efectivo");
    const [observaciones, setObservaciones] = useState("");

    // Lookups
    const [profesionales, setProfesionales] = useState([]);
    const [pacientes, setPacientes] = useState([]);
    const [activeCaja, setActiveCaja] = useState(null);
    const [paymentMethods, setPaymentMethods] = useState(["Efectivo", "Tarjeta", "Transferencia", "Nequi", "Bici-B", "Otros"]);

    // Modal state for New Tercero
    const [showNewTerceroModal, setShowNewTerceroModal] = useState(false);
    const [savingModal, setSavingModal] = useState(false);
    const [modalError, setModalError] = useState("");
    const [newTercero, setNewTercero] = useState({
        nombre: "",
        apellidos: "",
        tipoDocumento: "CC",
        nroDocumento: "",
        razonSocial: "",
        telefono: "",
        direccion: "",
        pais: "Colombia",
        ciudad: "",
        email: ""
    });

    const loadBasics = async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            // 1. Professionals
            const pSnap = await getDocs(query(collection(db, "profesionales"), where("inquilino", "==", inquilino)));
            setProfesionales(pSnap.docs.map(d => ({ 
                id: d.id, 
                nombre: d.data().nombreCompleto || d.data().nombre 
            })));

            // 2. Patients (Basic list for select)
            const pacSnap = await getDocs(query(collection(db, "pacientes"), where("inquilino", "==", inquilino)));
            setPacientes(pacSnap.docs.map(d => ({ 
                id: d.id, 
                nombre: d.data().nombreCompleto || `${d.data().nombres || ""} ${d.data().apellidos || ""}`.trim(),
                cedula: d.data().nroDocumento || d.data().cedula || ""
            })));

            // 3. Active Caja
            const cSnap = await getDocs(query(
                collection(db, "cajas"), 
                where("inquilino", "==", inquilino),
                where("estado", "==", "abierta"),
                where("usuarioId", "==", userProfile?.uid)
            ));
            if (!cSnap.empty) {
                setActiveCaja({ id: cSnap.docs[0].id, ...cSnap.docs[0].data() });
            }

            // 4. Dynamic payment methods
            const qMetodos = query(
                collection(db, "metodos_pago"),
                where("inquilino", "==", inquilino),
                where("activo", "==", true)
            );
            const snapMetodos = await getDocs(qMetodos);
            if (!snapMetodos.empty) {
                const metodosList = snapMetodos.docs.map(d => d.data().nombre);
                setPaymentMethods(metodosList);
                setMedioPago(metodosList[0] || "Efectivo");
            }

        } catch (e) {
            console.error("Error loading form basics:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBasics();
    }, [inquilino, userProfile?.uid]);

    const handleSaveTercero = async () => {
        if (!newTercero.nombre.trim() || !newTercero.apellidos.trim() || !newTercero.nroDocumento.trim() || !newTercero.telefono.trim()) {
            setModalError("Por favor completa los campos obligatorios (*).");
            return;
        }
        setSavingModal(true);
        setModalError("");
        try {
            const name = `${newTercero.nombre.trim()} ${newTercero.apellidos.trim()}`;
            const docRef = await addDoc(collection(db, "pacientes"), {
                inquilino,
                nombres: newTercero.nombre.trim(),
                apellidos: newTercero.apellidos.trim(),
                nombreCompleto: name,
                tipoDocumento: newTercero.tipoDocumento,
                nroDocumento: newTercero.nroDocumento.trim(),
                razonSocial: newTercero.razonSocial.trim(),
                celular: newTercero.telefono.trim(),
                direccion: newTercero.direccion.trim(),
                email: newTercero.email.trim(),
                pais: newTercero.pais,
                ciudad: newTercero.ciudad,
                fechaCreacion: serverTimestamp()
            });

            const createdPatient = {
                id: docRef.id,
                nombre: name,
                cedula: newTercero.nroDocumento.trim()
            };

            // Select newly created patient
            setPaciente(createdPatient);

            // Reset modal form
            setNewTercero({
                nombre: "",
                apellidos: "",
                tipoDocumento: "CC",
                nroDocumento: "",
                razonSocial: "",
                telefono: "",
                direccion: "",
                pais: "Colombia",
                ciudad: "",
                email: ""
            });
            setShowNewTerceroModal(false);

            // Reload patients lookup
            await loadBasics();
        } catch (err) {
            console.error("Error saving new tercero:", err);
            setModalError("No se pudo guardar el tercero. Revisa la consola.");
        } finally {
            setSavingModal(false);
        }
    };

    const handleSubmit = async () => {
        if (!paciente) return setError("Debes seleccionar un tercero / paciente.");
        const valNum = Number(valor);
        if (!valor || isNaN(valNum) || valNum <= 0) return setError("Ingresa un valor válido mayor que 0.");
        if (medioPago === "Efectivo" && !activeCaja) return setError("No tienes una caja abierta para registrar el efectivo.");

        setSaving(true);
        setError("");

        try {
            // Save credit to "pagos" collection with concept "SALDO A FAVOR"
            const creditData = {
                inquilino,
                fecha: Timestamp.fromDate(new Date(fecha + "T00:00:00")),
                profesionalId: profesional.id || null,
                profesionalNombre: profesional.nombre || null,
                pacienteId: paciente.id,
                patientNombre: paciente.nombre, // Match exact key used in AddCreditModal
                concepto: "SALDO A FAVOR",
                monto: valNum,
                medio: medioPago,
                notes: observaciones || "ABONO SALDO A FAVOR",
                cajaId: activeCaja ? activeCaja.id : null,
                registradoPor: `${userProfile?.nombre || userProfile?.email}`,
                createdAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, "pagos"), creditData);

            // Sync with open Caja
            if (activeCaja) {
                const movData = {
                    inquilino,
                    tipo: "ingreso",
                    concepto: "SALDO A FAVOR",
                    monto: valNum,
                    metodoPago: medioPago,
                    descripcion: `Saldo a favor para ${paciente.nombre}`,
                    pacienteId: paciente.id,
                    pacienteNombre: paciente.nombre,
                    pagoId: docRef.id,
                    usuarioId: userProfile?.uid,
                    usuarioNombre: userProfile?.nombre || userProfile?.email,
                    fecha: serverTimestamp(),
                };
                await addDoc(collection(db, "cajas", activeCaja.id, "movimientos"), movData);
                await updateDoc(doc(db, "cajas", activeCaja.id), {
                    saldoActual: increment(valNum),
                    totalIngresos: increment(valNum)
                });
            }

            setSuccess(true);
            setTimeout(() => onSuccess ? onSuccess() : navigate(buildDashboardPath('facturacion/saldo')), 1500);

        } catch (e) {
            console.error("Error saving credit balance:", e);
            setError("Error crítico al guardar. Intenta de nuevo.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
            <span className="text-[13px] font-black text-slate-400 uppercase tracking-widest">Iniciando terminal...</span>
        </div>
    );

    return (
        <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500 pb-28">

            {/* Single Unified Card */}
            <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100">
                
                {/* Section 1: Datos Generales */}
                <div className="p-6 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <FiCalendar size={14} />
                        </div>
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Datos generales</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Fecha" required>
                            <input
                                type="date"
                                className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                                value={fecha}
                                onChange={e => setFecha(e.target.value)}
                            />
                        </Field>
                        <Field label="Profesional">
                            <select
                                className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all cursor-pointer"
                                value={profesional.id}
                                onChange={e => {
                                    const p = profesionales.find(x => x.id === e.target.value);
                                    setProfesional({ id: e.target.value, nombre: p?.nombre || "" });
                                }}
                            >
                                <option value="">Seleccione...</option>
                                {profesionales.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                            </select>
                        </Field>
                    </div>
                </div>

                {/* Section 2: Datos del Tercero y Pago */}
                <div className="p-6 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <FiUser size={14} />
                        </div>
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Datos tercero y monto</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Tercero" required colSpan={2}>
                            <div className="flex items-center gap-3">
                                <select
                                    className="flex-1 h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all cursor-pointer"
                                    value={paciente?.id || ""}
                                    onChange={e => {
                                        const p = pacientes.find(x => x.id === e.target.value);
                                        setPaciente(p || null);
                                    }}
                                >
                                    <option value="">Seleccione...</option>
                                    {pacientes.map(p => (
                                        <option key={p.id} value={p.id}>{p.nombre} (CC: {p.cedula})</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => setShowNewTerceroModal(true)}
                                    className="w-10 h-10 bg-[#8cc33f] text-white rounded-xl flex items-center justify-center hover:bg-[#7db02b] shadow transition-all shrink-0 font-extrabold text-xl"
                                    title="Nuevo tercero"
                                >
                                    +
                                </button>
                            </div>
                            {paciente && (
                                <div className="mt-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2">
                                    <FiUser size={13} className="text-emerald-600" />
                                    <span className="text-xs font-bold text-emerald-700">{paciente.nombre}</span>
                                    <span className="text-[10px] text-emerald-500 font-mono ml-auto">CC: {paciente.cedula}</span>
                                </div>
                            )}
                        </Field>
                        <Field label="Valor" required>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">$</span>
                                <input
                                    type="number"
                                    placeholder="0"
                                    className="w-full h-11 pl-8 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all font-mono"
                                    value={valor}
                                    onChange={e => setValor(e.target.value)}
                                />
                            </div>
                        </Field>
                        <Field label="Medio de pago">
                            <select
                                className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all cursor-pointer"
                                value={medioPago}
                                onChange={e => setMedioPago(e.target.value)}
                            >
                                {paymentMethods.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Observaciones" colSpan={2}>
                            <textarea
                                className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 transition-all resize-none"
                                placeholder="Observaciones del saldo a favor..."
                                value={observaciones}
                                onChange={e => setObservaciones(e.target.value)}
                            />
                        </Field>
                    </div>
                </div>

            </div>

            {/* Sticky Save Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-[100] bg-white/90 backdrop-blur-md border-t border-slate-200 px-6 py-3 flex items-center justify-between shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
                <div className="flex items-center gap-3">
                    {error && (
                        <span className="flex items-center gap-2 text-rose-600 text-xs font-bold">
                            <FiAlertCircle size={14} />
                            {error}
                        </span>
                    )}
                    {success && (
                        <span className="flex items-center gap-2 text-emerald-600 text-xs font-bold">
                            <FiCheckCircle size={14} />
                            ¡Saldo a favor guardado!
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onCancel || (() => navigate(-1))}
                        className="h-10 px-5 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-50 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saving}
                        className="h-10 px-8 flex items-center gap-2 justify-center bg-[#8cc33f] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#7db02b] shadow-lg shadow-[#8cc33f]/20 transition-all active:scale-95 disabled:opacity-60"
                    >
                        {saving ? (
                            <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Guardando...</>
                        ) : (
                            <><FiSave size={14} /> Guardar saldo</>
                        )}
                    </button>
                </div>
            </div>

            {/* MODAL: NUEVO TERCERO */}
            {showNewTerceroModal && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div 
                        className="bg-white w-full max-w-[600px] rounded-[32px] shadow-[0_20px_70px_rgba(0,0,0,0.3)] overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                                    Nuevo tercero *
                                </h3>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setShowNewTerceroModal(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-500 transition-all shadow-sm font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Form Content */}
                        <div className="p-8 overflow-y-auto custom-scrollbar space-y-4">
                            {modalError && (
                                <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl text-rose-700 text-xs font-bold uppercase tracking-wider">
                                    {modalError}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nombre *</label>
                                    <input 
                                        type="text"
                                        value={newTercero.nombre}
                                        onChange={e => setNewTercero({ ...newTercero, nombre: e.target.value })}
                                        placeholder="Nombre del tercero"
                                        className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Apellidos *</label>
                                    <input 
                                        type="text"
                                        value={newTercero.apellidos}
                                        onChange={e => setNewTercero({ ...newTercero, apellidos: e.target.value })}
                                        placeholder="Apellidos del tercero"
                                        className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tipo de documento *</label>
                                    <select
                                        value={newTercero.tipoDocumento}
                                        onChange={e => setNewTercero({ ...newTercero, tipoDocumento: e.target.value })}
                                        className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all cursor-pointer"
                                    >
                                        <option value="CC">Cédula de Ciudadanía</option>
                                        <option value="CE">Cédula de Extranjería</option>
                                        <option value="NIT">NIT</option>
                                        <option value="Pasaporte">Pasaporte</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Número de documento *</label>
                                    <input 
                                        type="text"
                                        value={newTercero.nroDocumento}
                                        onChange={e => setNewTercero({ ...newTercero, nroDocumento: e.target.value })}
                                        placeholder="Nro. de documento del tercero"
                                        className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Razón social</label>
                                    <input 
                                        type="text"
                                        value={newTercero.razonSocial}
                                        onChange={e => setNewTercero({ ...newTercero, razonSocial: e.target.value })}
                                        placeholder="Razón social del tercero"
                                        className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Teléfono *</label>
                                    <input 
                                        type="text"
                                        value={newTercero.telefono}
                                        onChange={e => setNewTercero({ ...newTercero, telefono: e.target.value })}
                                        placeholder="Teléfono del tercero"
                                        className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Dirección *</label>
                                    <input 
                                        type="text"
                                        value={newTercero.direccion}
                                        onChange={e => setNewTercero({ ...newTercero, direccion: e.target.value })}
                                        placeholder="Dirección del tercero"
                                        className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">País de domicilio</label>
                                    <select
                                        value={newTercero.pais}
                                        onChange={e => setNewTercero({ ...newTercero, pais: e.target.value })}
                                        className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all cursor-pointer"
                                    >
                                        <option value="Colombia">Colombia</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Ciudad de domicilio</label>
                                    <select
                                        value={newTercero.ciudad}
                                        onChange={e => setNewTercero({ ...newTercero, ciudad: e.target.value })}
                                        className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all cursor-pointer"
                                    >
                                        <option value="">Seleccione...</option>
                                        {CIUDADES_COLOMBIA.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Correo electrónico</label>
                                    <input 
                                        type="email"
                                        value={newTercero.email}
                                        onChange={e => setNewTercero({ ...newTercero, email: e.target.value })}
                                        placeholder="Correo del tercero"
                                        className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50 shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowNewTerceroModal(false)}
                                className="h-10 px-5 bg-white border border-slate-200 text-slate-500 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-50 transition-all"
                            >
                                Cerrar
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveTercero}
                                disabled={savingModal}
                                className="h-10 px-6 bg-[#8cc33f] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#7db02b] transition-all shadow"
                            >
                                {savingModal ? "Guardando..." : "Guardar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
