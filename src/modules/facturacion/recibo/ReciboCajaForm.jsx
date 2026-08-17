import React, { useState, useEffect, useMemo } from "react";
import { 
    FiArrowLeft, FiCalendar, FiBriefcase, FiUser, FiTrash2, 
    FiPlus, FiSave, FiAlertCircle, FiCheckCircle, FiX 
} from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { buildDashboardPath } from "../../../utils/dashboardBasePath";
import { getActiveCaja } from "../../../services/supabaseServices";
import { getConfigItems, saveConfigItem } from "../../../services/configPersistenceService";
import { isDoctorUser } from "../../../utils/doctorHelpers";

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
            // 1. Professionals (from profiles table, fallback to profesionales or website_config)
            let profsList = [];
            try {
                const { data: profData } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("tenant_id", inquilino);
                if (profData && profData.length > 0) profsList = profData;
            } catch (e) {}

            if (profsList.length === 0) {
                try {
                    const { data: profData2 } = await supabase
                        .from("profesionales")
                        .select("*")
                        .eq("tenant_id", inquilino);
                    if (profData2 && profData2.length > 0) profsList = profData2;
                } catch (e) {}
            }

            if (profsList.length === 0) {
                const { data: cfgRow } = await supabase
                    .from("website_config")
                    .select("config")
                    .eq("tenant_id", inquilino)
                    .maybeSingle();
                profsList = cfgRow?.config?.profesionales || cfgRow?.config?.profiles || [];
            }

            setProfesionales(profsList.filter(d => isDoctorUser(d)).map(d => ({ 
                id: d.id, 
                nombre: d.full_name || d.nombre_completo || d.nombreCompleto || d.nombre || `${d.nombres || ""} ${d.apellidos || ""}`.trim() || d.email 
            })));

            // 2. Patients / Terceros
            let pacsList = [];
            try {
                const { data: pacData } = await supabase
                    .from("pacientes")
                    .select("*")
                    .eq("tenant_id", inquilino);
                if (pacData && pacData.length > 0) pacsList = pacData;
            } catch (e) {}

            if (pacsList.length === 0) {
                try {
                    const { data: tercData } = await supabase
                        .from("terceros")
                        .select("*")
                        .eq("tenant_id", inquilino);
                    if (tercData && tercData.length > 0) pacsList = tercData;
                } catch (e) {}
            }

            if (pacsList.length === 0) {
                const { data: cfgRow } = await supabase
                    .from("website_config")
                    .select("config")
                    .eq("tenant_id", inquilino)
                    .maybeSingle();
                pacsList = cfgRow?.config?.pacientes || cfgRow?.config?.terceros || [];
            }

            setPacientes(pacsList.map(d => ({ 
                id: d.id, 
                nombre: d.nombreCompleto || d.full_name || d.nombre || `${d.nombres || d.nombre || ""} ${d.apellidos || d.apellido || ""}`.trim(),
                cedula: d.nroDocumento || d.cedula || d.documento || ""
            })));

            // 3. Active Caja
            const uId = userProfile?.uid || userProfile?.id || "";
            const currentCaja = await getActiveCaja(inquilino, uId);
            if (currentCaja) {
                setActiveCaja(currentCaja);
            }

            // 4. Dynamic payment methods from website_config
            const { data: cfgRow } = await supabase
                .from("website_config")
                .select("config")
                .eq("tenant_id", inquilino)
                .maybeSingle();

            const rawMetodos = cfgRow?.config?.metodos_pago || [
                { id: "1", nombre: "Efectivo", activo: true },
                { id: "2", nombre: "Tarjeta", activo: true },
                { id: "3", nombre: "Transferencia", activo: true },
                { id: "4", nombre: "Nequi", activo: true },
                { id: "5", nombre: "Bici-B", activo: true }
            ];

            const activeMetodos = rawMetodos.filter(m => m.activo !== false).map(m => m.nombre || m);
            if (activeMetodos.length > 0) {
                setPaymentMethods(activeMetodos);
                setMedioPago(activeMetodos[0] || "Efectivo");
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
            const { data: createdPatient, error: pacErr } = await supabase
                .from("pacientes")
                .insert([{
                    tenant_id: inquilino,
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
                    created_at: new Date().toISOString()
                }])
                .select()
                .single();
            if (pacErr) throw pacErr;

            const selectedPatientObj = {
                id: createdPatient.id,
                nombre: name,
                cedula: newTercero.nroDocumento.trim()
            };

            // Select newly created patient
            setPaciente(selectedPatientObj);

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
            // Leer la configuración activa de consecutivos desde website_config (configPersistenceService)
            const consList = await getConfigItems(inquilino, "consecutivos", "consecutivos");
            const activeConsDoc = (Array.isArray(consList) && consList.length > 0) ? consList[0] : {};

            const currentCount = parseInt(String(activeConsDoc.contReciboCaja || activeConsDoc.cont_recibo_caja || 1), 10) || 1;
            const nextCount = currentCount + 1;
            const finalConsecutivo = String(currentCount).padStart(4, '0');

            const reciboData = {
                tenant_id: inquilino,
                inquilino,
                nroConsecutivo: finalConsecutivo,
                fecha: new Date(fecha + "T00:00:00").toISOString(),
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
                created_at: new Date().toISOString()
            };

            const { data: newRecibo, error: recErr } = await supabase
                .from("recibos_caja")
                .insert([reciboData])
                .select()
                .single();
            if (recErr) throw recErr;

            // Incrementar el consecutivo en website_config y en la base de datos
            const updatedConsDoc = {
                ...activeConsDoc,
                nombre: activeConsDoc.nombre || "Consecutivo Principal",
                contReciboCaja: nextCount,
                cont_recibo_caja: nextCount
            };
            await saveConfigItem(inquilino, "consecutivos", "consecutivos", updatedConsDoc);

            if (activeCaja) {
                const movData = {
                    tenant_id: inquilino,
                    tipo: "ingreso",
                    concepto: "Recibo de Caja #" + newRecibo.id.slice(0,6).toUpperCase(),
                    monto: totals.total,
                    metodo_pago: medioPago,
                    descripcion: `Cobro a ${paciente.nombre}. Conceptos: ${conceptos.map(c => c.concepto).join(", ")}`,
                    paciente_id: paciente.id,
                    paciente_nombre: paciente.nombre,
                    recibo_id: newRecibo.id,
                    usuario_id: userProfile?.uid,
                    caja_id: activeCaja.id,
                    created_at: new Date().toISOString()
                };
                await supabase.from("movimientos_caja").insert([movData]);
                await supabase
                    .from("cajas")
                    .update({
                        saldo_actual: (activeCaja.saldo_actual || activeCaja.saldoActual || 0) + totals.total,
                        total_ingresos: (activeCaja.total_ingresos || activeCaja.totalIngresos || 0) + totals.total
                    })
                    .eq("id", activeCaja.id);
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
        <div className="flex flex-col items-center justify-center h-64 bg-slate-50">
            <div className="w-8 h-8 border-4 border-[#8cc33f] border-t-transparent rounded-full animate-spin mb-3" />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cargando...</span>
        </div>
    );

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4 animate-in fade-in duration-300">

            {/* Form Fields Stack */}
            <div className="space-y-4">

                {/* CARD 1: Datos generales */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-500 flex items-center justify-center">
                            <FiCalendar size={12} />
                        </div>
                        <h3 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Datos generales</h3>
                    </div>
                    <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fecha <span className="text-rose-500">*</span></label>
                                <input
                                    type="date"
                                    className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
                                    value={fecha}
                                    onChange={e => setFecha(e.target.value)}
                                 max="9999-12-31" min="1900-01-01" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Profesional</label>
                                <select
                                    className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all cursor-pointer"
                                    value={profesional.id}
                                    onChange={e => {
                                        const p = profesionales.find(x => x.id === e.target.value);
                                        setProfesional({ id: e.target.value, nombre: p?.nombre || "" });
                                    }}
                                >
                                    <option value="">Seleccione...</option>
                                    {profesionales.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CARD 2: Datos tercero */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-500 flex items-center justify-center">
                            <FiUser size={12} />
                        </div>
                        <h3 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Datos tercero</h3>
                    </div>
                    <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Tercero search - full width */}
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tercero <span className="text-rose-500">*</span></label>
                                <div ref={patientRef} className="relative flex items-center gap-2 w-full">
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
                                            className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
                                        />
                                        {showPatientDrop && filteredPatients.length > 0 && (
                                            <div className="absolute left-0 right-0 top-10 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-52 overflow-y-auto">
                                                {filteredPatients.map(p => (
                                                    <div
                                                        key={p.id}
                                                        onClick={() => {
                                                            setPaciente(p);
                                                            setPatientSearch("");
                                                            setShowPatientDrop(false);
                                                        }}
                                                        className="px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer border-b border-slate-50 last:border-0"
                                                    >
                                                        {p.nombre} <span className="text-[10px] text-slate-400 font-medium font-mono">(CC: {p.cedula})</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowNewTerceroModal(true)}
                                        className="h-9 px-3 bg-[#8cc33f] text-white rounded-lg flex items-center justify-center hover:bg-[#7db02b] transition-all shrink-0 font-extrabold text-sm"
                                        title="Nuevo tercero"
                                    >
                                        <FiPlus size={14} />
                                    </button>
                                </div>
                                {paciente && (
                                    <div className="mt-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-2">
                                        <FiUser size={11} className="text-emerald-600" />
                                        <span className="text-xs font-bold text-emerald-700">{paciente.nombre}</span>
                                        <span className="text-[10px] text-emerald-500 font-mono ml-auto">CC: {paciente.cedula}</span>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Condición de pago <span className="text-rose-500">*</span></label>
                                <select
                                    className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all cursor-pointer"
                                    value={condicionPago}
                                    onChange={e => setCondicionPago(e.target.value)}
                                >
                                    <option value="Contado">Contado</option>
                                    <option value="15 días">15 días</option>
                                    <option value="30 días">30 días</option>
                                    <option value="60 días">60 días</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Medio de pago <span className="text-rose-500">*</span></label>
                                <select
                                    className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all cursor-pointer"
                                    value={medioPago}
                                    onChange={e => setMedioPago(e.target.value)}
                                >
                                    {paymentMethods.map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* CARD 3: Conceptos */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <h3 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Conceptos</h3>
                        <button 
                            type="button"
                            onClick={handleOpenNewConcept}
                            className="h-8 px-3 bg-[#8cc33f] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-[#7db02b] transition-all shadow-xs"
                        >
                            <FiPlus size={13} /> Nuevo concepto
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="py-2 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Concepto</th>
                                    <th className="py-2 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Descripción</th>
                                    <th className="py-2 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">P. Unitario</th>
                                    <th className="py-2 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center w-16">Cant.</th>
                                    <th className="py-2 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-24">Descuento</th>
                                    <th className="py-2 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Total</th>
                                    <th className="py-2 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center w-12"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {conceptos.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="py-6 text-center text-xs text-slate-400 italic">
                                            No hay conceptos. Haz clic en "+ Nuevo concepto" para agregar.
                                        </td>
                                    </tr>
                                ) : (
                                    conceptos.map(c => (
                                        <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-2.5 px-3 text-xs font-semibold text-slate-800">{c.concepto}</td>
                                            <td className="py-2.5 px-3 text-xs text-slate-500">{c.descripcion || "—"}</td>
                                            <td className="py-2.5 px-3 text-xs font-semibold text-slate-600 font-mono text-right">{fmt(c.precioUnitario)}</td>
                                            <td className="py-2.5 px-3 text-xs font-bold text-slate-700 font-mono text-center">{c.cantidad}</td>
                                            <td className="py-2.5 px-3 text-xs font-semibold text-rose-500 font-mono text-right">{fmt(c.descuento)}</td>
                                            <td className="py-2.5 px-3 text-xs font-bold text-slate-900 font-mono text-right">{fmt(c.total)}</td>
                                            <td className="py-2.5 px-3 text-center">
                                                <button 
                                                    type="button"
                                                    onClick={() => removeConcept(c.id)}
                                                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center mx-auto transition-all"
                                                >
                                                    <FiTrash2 size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-4 py-3 border-t border-slate-100 flex justify-end items-center gap-2 bg-slate-50/50">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total:</span>
                        <span className="text-sm font-black text-[#8cc33f] font-mono">{fmt(totals.total)}</span>
                    </div>
                </div>

                {/* CARD 4: Observaciones */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                        <h3 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Observaciones</h3>
                    </div>
                    <div className="p-4">
                        <textarea 
                            className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 outline-none focus:bg-white focus:border-blue-500 transition-all resize-none"
                            placeholder="Observaciones del recibo..."
                            value={observaciones}
                            onChange={e => setObservaciones(e.target.value)}
                        />
                    </div>
                </div>

                {/* Action footer card */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-xs px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {error && (
                            <span className="flex items-center gap-1.5 text-rose-600 text-xs font-bold">
                                <FiAlertCircle size={13} />
                                {error}
                            </span>
                        )}
                        {success && (
                            <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
                                <FiCheckCircle size={13} />
                                ¡Recibo guardado exitosamente!
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onCancel || (() => navigate(-1))}
                            className="h-9 px-4 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={saving}
                            className="h-9 px-5 flex items-center gap-1.5 justify-center bg-[#8cc33f] text-white rounded-lg text-xs font-bold hover:bg-[#7db02b] shadow-xs transition-all active:scale-95 disabled:opacity-60"
                        >
                            {saving ? (
                                <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Guardando...</>
                            ) : (
                                <><FiSave size={13} /> Guardar recibo</>
                            )}
                        </button>
                    </div>
                </div>

            </div>

            {/* MODAL: NUEVO TERCERO */}
            {showNewTerceroModal && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div 
                        className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                            <h3 className="text-sm font-bold text-slate-800">Nuevo Tercero</h3>
                            <button 
                                type="button"
                                onClick={() => setShowNewTerceroModal(false)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-500 transition-all"
                            >
                                <FiX size={14} />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto space-y-3">
                            {modalError && (
                                <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-rose-700 text-xs font-semibold">
                                    {modalError}
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nombre *</label>
                                    <input type="text" value={newTercero.nombre} onChange={e => setNewTercero({ ...newTercero, nombre: e.target.value })} placeholder="Nombre" className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Apellidos *</label>
                                    <input type="text" value={newTercero.apellidos} onChange={e => setNewTercero({ ...newTercero, apellidos: e.target.value })} placeholder="Apellidos" className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tipo doc. *</label>
                                    <select value={newTercero.tipoDocumento} onChange={e => setNewTercero({ ...newTercero, tipoDocumento: e.target.value })} className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all cursor-pointer">
                                        <option value="CC">Cédula de Ciudadanía</option>
                                        <option value="CE">Cédula de Extranjería</option>
                                        <option value="NIT">NIT</option>
                                        <option value="Pasaporte">Pasaporte</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nro. documento *</label>
                                    <input type="text" value={newTercero.nroDocumento} onChange={e => setNewTercero({ ...newTercero, nroDocumento: e.target.value })} placeholder="Número" className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Razón social</label>
                                    <input type="text" value={newTercero.razonSocial} onChange={e => setNewTercero({ ...newTercero, razonSocial: e.target.value })} placeholder="Razón social" className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Teléfono *</label>
                                    <input type="text" value={newTercero.telefono} onChange={e => setNewTercero({ ...newTercero, telefono: e.target.value })} placeholder="Teléfono" className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Dirección *</label>
                                    <input type="text" value={newTercero.direccion} onChange={e => setNewTercero({ ...newTercero, direccion: e.target.value })} placeholder="Dirección" className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">País</label>
                                    <select value={newTercero.pais} onChange={e => setNewTercero({ ...newTercero, pais: e.target.value })} className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all cursor-pointer">
                                        <option value="Colombia">Colombia</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ciudad</label>
                                    <select value={newTercero.ciudad} onChange={e => setNewTercero({ ...newTercero, ciudad: e.target.value })} className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all cursor-pointer">
                                        <option value="">Seleccione...</option>
                                        {CIUDADES_COLOMBIA.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email</label>
                                    <input type="email" value={newTercero.email} onChange={e => setNewTercero({ ...newTercero, email: e.target.value })} placeholder="Email" className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all" />
                                </div>
                            </div>
                        </div>

                        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
                            <button type="button" onClick={() => setShowNewTerceroModal(false)} className="h-9 px-4 bg-white border border-slate-200 text-slate-500 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all">Cerrar</button>
                            <button type="button" onClick={handleSaveTercero} disabled={savingModal} className="h-9 px-4 bg-[#8cc33f] text-white rounded-lg text-xs font-bold hover:bg-[#7db02b] transition-all shadow-xs disabled:opacity-60">
                                {savingModal ? "Guardando..." : "Guardar tercero"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: NUEVO CONCEPTO */}
            {showNewConceptModal && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div 
                        className="bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                            <h3 className="text-sm font-bold text-slate-800">Nuevo Concepto</h3>
                            <button type="button" onClick={() => setShowNewConceptModal(false)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-500 transition-all">
                                <FiX size={14} />
                            </button>
                        </div>

                        <form onSubmit={handleAddConceptFromModal}>
                            <div className="p-5 space-y-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Concepto *</label>
                                    <input type="text" required value={newConcept.concepto} onChange={e => setNewConcept({ ...newConcept, concepto: e.target.value })} placeholder="Nombre del concepto" className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Descripción</label>
                                    <input type="text" value={newConcept.descripcion} onChange={e => setNewConcept({ ...newConcept, descripcion: e.target.value })} placeholder="Descripción (opcional)" className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Precio unitario *</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                                            <input type="text" required value={formatNumberWithDots(newConcept.precioUnitario)} onChange={e => setNewConcept({ ...newConcept, precioUnitario: parseRawNumber(e.target.value) })} placeholder="0" className="w-full h-9 pl-6 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 font-mono outline-none focus:bg-white focus:border-blue-500 transition-all" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cantidad *</label>
                                        <input type="number" required min="1" value={newConcept.cantidad} onChange={e => setNewConcept({ ...newConcept, cantidad: e.target.value })} placeholder="1" className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 font-mono outline-none focus:bg-white focus:border-blue-500 transition-all" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Descuento por unidad</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                                        <input type="text" value={formatNumberWithDots(newConcept.descuento)} onChange={e => setNewConcept({ ...newConcept, descuento: parseRawNumber(e.target.value) })} placeholder="0" className="w-full h-9 pl-6 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-rose-500 font-mono outline-none focus:bg-white focus:border-blue-500 transition-all" />
                                    </div>
                                </div>
                            </div>

                            <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50">
                                <button type="button" onClick={() => setShowNewConceptModal(false)} className="h-9 px-4 bg-white border border-slate-200 text-slate-500 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all">Cerrar</button>
                                <button type="submit" className="h-9 px-4 bg-[#8cc33f] text-white rounded-lg text-xs font-bold hover:bg-[#7db02b] transition-all shadow-xs">Agregar concepto</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
