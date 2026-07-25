import React, { useState, useEffect, useMemo } from "react";
import { 
    FiArrowLeft, FiCalendar, FiBriefcase, FiUser, FiTrash2, 
    FiPlus, FiSave, FiAlertCircle, FiCheckCircle, FiX 
} from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../../firebase/firebaseConfig";
import { 
    collection, addDoc, doc, updateDoc, getDoc, getDocs, 
    query, where, serverTimestamp, increment, Timestamp 
} from "firebase/firestore";
import { useAuth } from "../../../context/AuthContext";
import { buildDashboardPath } from "../../../utils/dashboardBasePath";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

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

// Modern label+field pair (no table)
const Field = ({ label, required, children, colSpan }) => (
  <div className={colSpan === 2 ? "md:col-span-2" : ""}>
    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-0.5">
      {label}{required && <span className="text-rose-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);

export default function ReciboCajaForm({ onCancel, onSuccess }) {
    const navigate = useNavigate();
    const { id } = useParams();
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
    const [patientSearch, setPatientSearch] = useState("");
    const [showPatientDrop, setShowPatientDrop] = useState(false);
    const [condicionPago, setCondicionPago] = useState("Contado");
    const [medioPago, setMedioPago] = useState("Efectivo");
    const [conceptos, setConceptos] = useState([]);
    const [observaciones, setObservaciones] = useState("");

    // Modal state for New Concept
    const [showNewConceptModal, setShowNewConceptModal] = useState(false);
    const [newConcept, setNewConcept] = useState({
        concepto: "",
        descripcion: "",
        precioUnitario: "",
        cantidad: "1",
        descuento: "0"
    });

    // Lookups
    const [profesionales, setProfesionales] = useState([]);
    const [pacientes, setPacientes] = useState([]);
    const [activeCaja, setActiveCaja] = useState(null);
    const [paymentMethods, setPaymentMethods] = useState(["Efectivo", "Tarjeta", "Transferencia", "Nequi", "Bici-B", "Otros"]);
    const patientRef = React.useRef(null);

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

     // Close patient dropdown on outside click
     useEffect(() => {
         const handleClickOutside = (e) => {
             if (patientRef.current && !patientRef.current.contains(e.target)) {
                 setShowPatientDrop(false);
             }
         };
         document.addEventListener("mousedown", handleClickOutside);
         return () => document.removeEventListener("mousedown", handleClickOutside);
     }, []);

     const filteredPatients = useMemo(() => {
         const q = patientSearch.toLowerCase().trim();
         if (!q) return [];
         return pacientes.filter(p => 
             p.nombre.toLowerCase().includes(q) ||
             p.cedula.toLowerCase().includes(q)
         ).slice(0, 8);
     }, [patientSearch, pacientes]);

     const formatNumberWithDots = (val) => {
         const clean = String(val).replace(/\D/g, "");
         if (!clean) return "";
         return Number(clean).toLocaleString("es-CO");
     };

     const parseRawNumber = (val) => {
         return String(val).replace(/\D/g, "");
     };

     const handleOpenNewConcept = () => {
         setNewConcept({
             concepto: "",
             descripcion: "",
             precioUnitario: "",
             cantidad: "1",
             descuento: "0"
         });
         setShowNewConceptModal(true);
     };

     const handleAddConceptFromModal = (e) => {
         e.preventDefault();
         if (!newConcept.concepto.trim()) return alert("El concepto es obligatorio");
         const price = Number(newConcept.precioUnitario) || 0;
         const qty = Number(newConcept.cantidad) || 1;
         const desc = Number(newConcept.descuento) || 0;
         const total = Math.max(0, (price - desc) * qty);

         const added = {
             id: Date.now(),
             concepto: newConcept.concepto.trim(),
             descripcion: newConcept.descripcion.trim(),
             precioUnitario: price,
             cantidad: qty,
             descuento: desc,
             total
         };

         setConceptos(prev => [...prev, added]);
         setShowNewConceptModal(false);
     };

     const removeConcept = (conceptId) => {
         setConceptos(conceptos.filter(c => c.id !== conceptId));
     };

    // Calculate totals
    const totals = useMemo(() => {
        const subtotal = conceptos.reduce((sum, c) => sum + (c.precioUnitario * c.cantidad), 0);
        const descuento = conceptos.reduce((sum, c) => sum + (Number(c.descuento || 0) * c.cantidad), 0);
        return {
            subtotal,
            descuento,
            total: Math.max(0, subtotal - descuento)
        };
    }, [conceptos]);

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
        if (conceptos.length === 0) return setError("Debes agregar al menos un concepto.");
        if (conceptos.some(c => !c.concepto || c.precioUnitario <= 0)) return setError("Revisa los conceptos y precios.");
        if (medioPago === "Efectivo" && !activeCaja) return setError("No tienes una caja abierta para registrar el pago en efectivo.");

        setSaving(true);
        setError("");

        try {
            // Fetch and increment consecutive number
            const qCons = query(collection(db, "consecutivos"), where("inquilino", "==", inquilino));
            const snapCons = await getDocs(qCons);
            let finalConsecutivo = "";
            let consDocId = null;
            let nextCount = 1;

            if (!snapCons.empty) {
                const consDoc = snapCons.docs[0];
                consDocId = consDoc.id;
                const consData = consDoc.data();
                // Parse as number regardless of whether it was stored as string or number
                const currentCount = parseInt(String(consData.contReciboCaja || 1), 10) || 1;
                nextCount = currentCount + 1;
                finalConsecutivo = String(currentCount).padStart(2, '0');
            } else {
                const newConsDoc = await addDoc(collection(db, "consecutivos"), {
                    inquilino,
                    nombre: "Consecutivo Principal",
                    contReciboCaja: 2,
                    creado: serverTimestamp()
                });
                consDocId = newConsDoc.id;
                nextCount = 2;
                finalConsecutivo = "01";
            }

            const reciboData = {
                inquilino,
                nroConsecutivo: finalConsecutivo,
                fecha: Timestamp.fromDate(new Date(fecha + "T00:00:00")),
                profesionalId: profesional.id || null,
                profesionalNombre: profesional.nombre || null,
                pacienteId: paciente.id,
                pacienteNombre: paciente.nombre,
                condicionPago,
                medioPago,
                conceptos,
                subtotal: totals.subtotal,
                descuentoTotal: totals.descuento,
                total: totals.total,
                observaciones,
                cajaId: activeCaja ? activeCaja.id : null,
                creadoPor: `${userProfile?.nombre || userProfile?.email} - ${userProfile?.profileName || "Administrativo"}`,
                createdAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, "recibos_caja"), reciboData);

            // Always write nextCount as a plain integer (never use increment() — fails on string fields)
            if (consDocId) {
                await updateDoc(doc(db, "consecutivos", consDocId), {
                    contReciboCaja: nextCount
                });
            }

            if (activeCaja) {
                const movData = {
                    inquilino,
                    tipo: "ingreso",
                    concepto: "Recibo de Caja #" + docRef.id.slice(0,6).toUpperCase(),
                    monto: totals.total,
                    metodoPago: medioPago,
                    descripcion: `Cobro a ${paciente.nombre}. Conceptos: ${conceptos.map(c => c.concepto).join(", ")}`,
                    pacienteId: paciente.id,
                    pacienteNombre: paciente.nombre,
                    reciboId: docRef.id,
                    usuarioId: userProfile?.uid,
                    usuarioNombre: userProfile?.nombre || userProfile?.email,
                    fecha: serverTimestamp(),
                };
                await addDoc(collection(db, "cajas", activeCaja.id, "movimientos"), movData);
                await updateDoc(doc(db, "cajas", activeCaja.id), {
                    saldoActual: increment(totals.total),
                    totalIngresos: increment(totals.total)
                });
            }

            setSuccess(true);
            setTimeout(() => onSuccess ? onSuccess() : navigate(buildDashboardPath('facturacion/recibo')), 1500);

        } catch (e) {
            console.error("Error al guardar recibo:", e);
            setError("Error crítico al guardar. Intenta de nuevo.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
            <span className="text-[13px] font-black text-slate-400 uppercase tracking-widest">Iniciando terminal financiera...</span>
        </div>
    );

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-28">


            {/* Form Fields Stack */}
            <div className="space-y-6">
                
                {/* CARD 1: Datos generales */}
                <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                            <FiCalendar size={14} />
                        </div>
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Datos generales</h3>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                </div>

                {/* CARD 2: Datos tercero */}
                <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <FiUser size={14} />
                        </div>
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Datos tercero</h3>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <Field label="Tercero" required colSpan={2}>
                                <div ref={patientRef} className="relative flex items-center gap-3 w-full">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            placeholder={paciente ? `${paciente.nombre} (CC: ${paciente.cedula})` : "Seleccione o escribe para buscar..."}
                                            value={patientSearch}
                                            onChange={e => {
                                                setPatientSearch(e.target.value);
                                                setShowPatientDrop(true);
                                            }}
                                            onFocus={() => setShowPatientDrop(true)}
                                            className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all"
                                        />
                                        {showPatientDrop && filteredPatients.length > 0 && (
                                            <div className="absolute left-0 right-0 top-12 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto">
                                                {filteredPatients.map(p => (
                                                    <div
                                                        key={p.id}
                                                        onClick={() => {
                                                            setPaciente(p);
                                                            setPatientSearch("");
                                                            setShowPatientDrop(false);
                                                        }}
                                                        className="px-4 py-3 text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer border-b border-slate-50 last:border-0"
                                                    >
                                                        {p.nombre} <span className="text-xs text-slate-400 font-medium font-mono">(CC: {p.cedula})</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
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
                            <Field label="Condición de pago" required>
                                <select
                                    className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all cursor-pointer"
                                    value={condicionPago}
                                    onChange={e => setCondicionPago(e.target.value)}
                                >
                                    <option value="Contado">Contado</option>
                                    <option value="15 días">15 días</option>
                                    <option value="30 días">30 días</option>
                                    <option value="60 días">60 días</option>
                                </select>
                            </Field>
                            <Field label="Medio de pago" required>
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
                        </div>
                    </div>
                </div>

                {/* CARD 3: Detalle de Conceptos */}
                <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Conceptos</h3>
                        <button 
                            type="button"
                            onClick={handleOpenNewConcept}
                            className="h-10 px-5 bg-[#8cc33f] text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-[#7db02b] transition-all shadow"
                        >
                            + Nuevo concepto
                        </button>
                    </div>
                    <div className="p-6 overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="text-slate-400 border-b border-slate-100">
                                    <th className="pb-3 font-bold uppercase tracking-widest pl-2">Concepto</th>
                                    <th className="pb-3 font-bold uppercase tracking-widest">Descripción</th>
                                    <th className="pb-3 font-bold uppercase tracking-widest text-right">Precio unitario</th>
                                    <th className="pb-3 font-bold uppercase tracking-widest text-center w-20">Cantidad</th>
                                    <th className="pb-3 font-bold uppercase tracking-widest text-right w-24">Descuento</th>
                                    <th className="pb-3 font-bold uppercase tracking-widest text-right pr-2">Total</th>
                                    <th className="pb-3 font-bold uppercase tracking-widest text-center w-16">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-[13px] text-slate-700">
                                {conceptos.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="py-8 text-center text-slate-400 italic">
                                            No se han agregado conceptos. Haz clic en "+ Nuevo concepto" para agregar.
                                        </td>
                                    </tr>
                                ) : (
                                    conceptos.map(c => (
                                        <tr key={c.id} className="hover:bg-slate-50/20 transition-colors">
                                            <td className="py-4 pl-2 font-bold text-slate-800">
                                                {c.concepto}
                                            </td>
                                            <td className="py-4 text-slate-500">
                                                {c.descripcion || "—"}
                                            </td>
                                            <td className="py-4 text-right font-semibold text-slate-600 font-mono">
                                                {fmt(c.precioUnitario)}
                                            </td>
                                            <td className="py-4 text-center font-bold text-slate-700 font-mono">
                                                {c.cantidad}
                                            </td>
                                            <td className="py-4 text-right font-semibold text-rose-500 font-mono">
                                                {fmt(c.descuento)}
                                            </td>
                                            <td className="py-4 text-right font-black text-slate-900 pr-2 font-mono">
                                                {fmt(c.total)}
                                            </td>
                                            <td className="py-4 text-center">
                                                <button 
                                                    type="button"
                                                    onClick={() => removeConcept(c.id)}
                                                    className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center mx-auto transition-all"
                                                    title="Eliminar concepto"
                                                >
                                                    <FiTrash2 size={15} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                        <div className="flex justify-end pt-4 border-t border-slate-100 text-base font-black text-slate-800">
                            Total: <span className="text-[#8cc33f] ml-2 font-mono">{fmt(totals.total)}</span>
                        </div>
                    </div>
                </div>

                {/* CARD 5: Observaciones */}
                <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Observaciones</h3>
                    </div>
                    <div className="p-6">
                        <textarea 
                            className="w-full h-32 p-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 outline-none focus:border-blue-500 transition-all resize-none shadow-inner"
                            placeholder="Observaciones"
                            value={observaciones}
                            onChange={e => setObservaciones(e.target.value)}
                        />
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
                            ¡Recibo guardado exitosamente!
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
                            <><FiSave size={14} /> Guardar recibo</>
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
                                        <option value="CC">Cédula de Cédula de Ciudadanía</option>
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
            {/* MODAL: NUEVO CONCEPTO */}
            {showNewConceptModal && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div 
                        className="bg-white w-full max-w-[500px] rounded-[32px] shadow-[0_20px_70px_rgba(0,0,0,0.3)] overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                                    Nuevo concepto
                                </h3>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setShowNewConceptModal(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-500 transition-all shadow-sm font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Form Content */}
                        <form onSubmit={handleAddConceptFromModal} className="flex flex-col flex-1 min-h-0">
                            <div className="p-8 overflow-y-auto custom-scrollbar space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Concepto *</label>
                                    <input 
                                        type="text"
                                        required
                                        value={newConcept.concepto}
                                        onChange={e => setNewConcept({ ...newConcept, concepto: e.target.value })}
                                        placeholder="Ingresa el nombre del concepto"
                                        className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Cantidad *</label>
                                    <input 
                                        type="number"
                                        required
                                        min="1"
                                        value={newConcept.cantidad}
                                        onChange={e => setNewConcept({ ...newConcept, cantidad: e.target.value })}
                                        placeholder="1"
                                        className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all font-mono"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Descripción</label>
                                    <input 
                                        type="text"
                                        value={newConcept.descripcion}
                                        onChange={e => setNewConcept({ ...newConcept, descripcion: e.target.value })}
                                        placeholder="Ingresa la descripción del concepto"
                                        className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Precio Unitario *</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">$</span>
                                        <input 
                                            type="text"
                                            required
                                            value={formatNumberWithDots(newConcept.precioUnitario)}
                                            onChange={e => setNewConcept({ ...newConcept, precioUnitario: parseRawNumber(e.target.value) })}
                                            placeholder="0"
                                            className="w-full h-11 pl-8 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all font-mono"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Descuento por unidad</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">$</span>
                                        <input 
                                            type="text"
                                            value={formatNumberWithDots(newConcept.descuento)}
                                            onChange={e => setNewConcept({ ...newConcept, descuento: parseRawNumber(e.target.value) })}
                                            placeholder="0"
                                            className="w-full h-11 pl-8 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-rose-500 outline-none focus:bg-white focus:border-blue-500 transition-all font-mono"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-8 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setShowNewConceptModal(false)}
                                    className="h-10 px-5 bg-white border border-slate-200 text-slate-500 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-50 transition-all"
                                >
                                    Cerrar
                                </button>
                                <button
                                    type="submit"
                                    className="h-10 px-6 bg-[#8cc33f] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#7db02b] transition-all shadow"
                                >
                                    Agregar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
