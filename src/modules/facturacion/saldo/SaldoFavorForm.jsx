import React, { useState, useEffect } from "react";
import { 
    FiArrowLeft, FiCalendar, FiBriefcase, FiUser, 
    FiSave, FiAlertCircle, FiCheckCircle, FiX, FiPlus
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import supabase from "../../../lib/supabaseClient";
import { buildDashboardPath } from "../../../utils/dashboardBasePath";
import { useAuth } from "../../../context/AuthContext";
import { isDoctorUser } from "../../../utils/doctorHelpers";

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
                cedula: d.documento || d.nroDocumento || d.nro_documento || d.cedula || d.identificacion || ""
            })));

            // 3. Active Caja (DB + website_config fallback)
            let openCajas = [];
            try {
                const { data: dbCajas } = await supabase
                    .from("cajas")
                    .select("*")
                    .eq("tenant_id", inquilino)
                    .eq("estado", "abierta");
                if (dbCajas && dbCajas.length > 0) {
                    openCajas = dbCajas;
                }
            } catch (e) {}

            const { data: cfgRow } = await supabase
                .from("website_config")
                .select("config")
                .eq("tenant_id", inquilino)
                .maybeSingle();

            const cfgCajas = (cfgRow?.config?.cajas || []).filter(c => c.estado === "abierta");
            const allOpenCajas = [...openCajas, ...cfgCajas];

            const currentUid = userProfile?.uid || userProfile?.id || "";
            const currentName = userProfile?.nombre || userProfile?.full_name || userProfile?.email || "";

            const myCaja = allOpenCajas.find(c => 
                (c.usuario_id && (c.usuario_id === currentUid || c.usuario_id === userProfile?.id)) ||
                (c.usuarioId && (c.usuarioId === currentUid || c.usuarioId === userProfile?.id)) ||
                (c.usuario_nombre && c.usuario_nombre.toLowerCase() === currentName.toLowerCase()) ||
                (c.usuarioNombre && c.usuarioNombre.toLowerCase() === currentName.toLowerCase())
            ) || allOpenCajas[0];

            if (myCaja) {
                setActiveCaja(myCaja);
            }

            // 4. Dynamic payment methods from website_config
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
        const valNum = Number(String(valor).replace(/\D/g, ""));
        if (!valor || isNaN(valNum) || valNum <= 0) return setError("Ingresa un valor válido mayor que 0.");
        if (medioPago === "Efectivo" && !activeCaja) return setError("No tienes una caja abierta para registrar el efectivo.");

        setSaving(true);
        setError("");

        try {
            const creditId = crypto.randomUUID ? crypto.randomUUID() : `pago_${Date.now()}`;
            const fechaIso = new Date(fecha + "T00:00:00").toISOString();
            const nowIso = new Date().toISOString();

            // Datos a guardar en tabla pagos (solo columnas válidas en PostgreSQL Supabase)
            const dbData = {
                id: creditId,
                tenant_id: inquilino,
                fecha: fechaIso,
                paciente_id: paciente.id,
                monto: valNum,
                metodo: medioPago,
                referencia: "SALDO A FAVOR",
                notas: observaciones ? `SALDO A FAVOR - ${observaciones}` : "ABONO SALDO A FAVOR",
                created_at: nowIso
            };

            const { error: insertError } = await supabase.from("pagos").insert([dbData]);
            if (insertError) {
                console.error("Error al insertar saldo a favor en pagos:", insertError);
                // No lanzar error - continuar sincronización
            }

            // Sync con website_config para fallback
            try {
                const { data: cfgRow } = await supabase
                    .from("website_config")
                    .select("config")
                    .eq("tenant_id", inquilino)
                    .maybeSingle();

                const currentConfig = cfgRow?.config || {};
                const currentPagos = Array.isArray(currentConfig.pagos) ? currentConfig.pagos : [];
                const currentSaldos = Array.isArray(currentConfig.saldos_favor) ? currentConfig.saldos_favor : [];

                const updatedPagos = [dbData, ...currentPagos.filter(p => p.id !== creditId)];
                const updatedSaldos = [dbData, ...currentSaldos.filter(s => s.id !== creditId)];

                await supabase.from("website_config").upsert(
                    { tenant_id: inquilino, config: { ...currentConfig, pagos: updatedPagos, saldos_favor: updatedSaldos } },
                    { onConflict: "tenant_id" }
                );
            } catch (e) {}

            // Sync with active Caja & Movimientos
            if (activeCaja) {
                const movId = crypto.randomUUID ? crypto.randomUUID() : `mov_${Date.now()}`;
                const movData = {
                    id: movId,
                    tenant_id: inquilino,
                    tipo: "ingreso",
                    concepto: "SALDO A FAVOR",
                    monto: valNum,
                    metodo_pago: medioPago,
                    descripcion: `Saldo a favor para ${paciente.nombre}`,
                    paciente_id: paciente.id,
                    paciente_nombre: paciente.nombre,
                    pago_id: creditId,
                    usuario_id: userProfile?.uid || null,
                    caja_id: activeCaja.id,
                    created_at: nowIso
                };

                try {
                    await supabase.from("movimientos_caja").insert([movData]);
                } catch (e) {}

                try {
                    await supabase
                        .from("cajas")
                        .update({
                            saldo_actual: (activeCaja.saldo_actual || activeCaja.saldoActual || 0) + valNum,
                            total_ingresos: (activeCaja.total_ingresos || activeCaja.totalIngresos || 0) + valNum,
                            updated_at: nowIso
                        })
                        .eq("id", activeCaja.id);
                } catch (e) {}

                try {
                    const { data: cfgRow } = await supabase
                        .from("website_config")
                        .select("config")
                        .eq("tenant_id", inquilino)
                        .maybeSingle();

                    const currentConfig = cfgRow?.config || {};
                    const currentCajas = Array.isArray(currentConfig.cajas) ? currentConfig.cajas : [];
                    const updatedCajas = currentCajas.map(c => {
                        if (c.id === activeCaja.id) {
                            return {
                                ...c,
                                saldoActual: (c.saldoActual || c.saldo_actual || 0) + valNum,
                                saldo_actual: (c.saldoActual || c.saldo_actual || 0) + valNum,
                                totalIngresos: (c.totalIngresos || c.total_ingresos || 0) + valNum,
                                total_ingresos: (c.totalIngresos || c.total_ingresos || 0) + valNum,
                                updated_at: nowIso
                            };
                        }
                        return c;
                    });

                    await supabase.from("website_config").upsert(
                        { tenant_id: inquilino, config: { ...currentConfig, cajas: updatedCajas } },
                        { onConflict: "tenant_id" }
                    );
                } catch (e) {}
            }

            // ── SYNC saldo_favor with pacientes profile ──
            try {
                const { data: pac } = await supabase
                    .from("pacientes")
                    .select("id, saldo_favor")
                    .eq("id", paciente.id)
                    .single();

                if (pac) {
                    const currentSaldo = Number(pac.saldo_favor || 0);
                    await supabase
                        .from("pacientes")
                        .update({
                            saldo_favor: currentSaldo + valNum
                        })
                        .eq("id", paciente.id);
                }
            } catch (e) {
                console.warn("No se pudo sincronizar saldo_favor en paciente:", e.message);
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
        <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
            {/* Header + Title */}
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onCancel || (() => navigate(-1))}
                        className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                        title="Volver"
                    >
                        <FiArrowLeft size={16} />
                    </button>
                    <div>
                        <h2 className="text-base font-bold text-slate-800 tracking-tight">Nuevo Saldo a Favor</h2>
                        <p className="text-xs text-slate-500 font-medium">Registrar abono de saldo a favor para un tercero o paciente</p>
                    </div>
                </div>
            </div>

            {/* Main Form Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 md:p-6 space-y-6">
                
                {/* Section 1: Datos Generales */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                        <FiCalendar className="text-blue-600" size={16} />
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Datos generales</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Fecha <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="date"
                                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                                value={fecha}
                                onChange={e => setFecha(e.target.value)}
                             max="9999-12-31" min="1900-01-01" />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Profesional
                            </label>
                            <select
                                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all cursor-pointer"
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

                {/* Section 2: Datos del Tercero y Pago */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                        <FiUser className="text-emerald-600" size={16} />
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Datos tercero y monto</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Tercero / Paciente <span className="text-rose-500">*</span>
                            </label>
                            <div className="flex items-center gap-2">
                                <select
                                    className="flex-1 h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all cursor-pointer"
                                    value={paciente?.id || ""}
                                    onChange={e => {
                                        const p = pacientes.find(x => x.id === e.target.value);
                                        setPaciente(p || null);
                                    }}
                                >
                                    <option value="">Seleccione un tercero o paciente...</option>
                                    {pacientes.map(p => (
                                        <option key={p.id} value={p.id}>{p.nombre} (CC: {p.cedula})</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => setShowNewTerceroModal(true)}
                                    className="h-10 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg flex items-center gap-1.5 font-bold text-xs shrink-0 transition-all"
                                    title="Nuevo tercero"
                                >
                                    <span className="text-emerald-600 font-extrabold text-sm">+</span>
                                    <span>Nuevo tercero</span>
                                </button>
                            </div>
                            {paciente && (
                                <div className="mt-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-2">
                                    <FiUser size={12} className="text-emerald-600" />
                                    <span className="text-xs font-bold text-emerald-800">{paciente.nombre}</span>
                                    <span className="text-[11px] text-emerald-600 font-mono ml-auto">Doc: {paciente.cedula}</span>
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Valor <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="0"
                                    className="w-full h-10 pl-7 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all font-mono"
                                    value={valor}
                                    onChange={e => {
                                        const clean = e.target.value.replace(/\D/g, "");
                                        setValor(clean ? Number(clean).toLocaleString("es-CO") : "");
                                    }}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Medio de pago
                            </label>
                            <select
                                className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all cursor-pointer"
                                value={medioPago}
                                onChange={e => setMedioPago(e.target.value)}
                            >
                                {paymentMethods.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Observaciones
                            </label>
                            <textarea
                                className="w-full h-20 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all resize-none"
                                placeholder="Observaciones del saldo a favor..."
                                value={observaciones}
                                onChange={e => setObservaciones(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Form Footer / Action Buttons */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {error && (
                            <span className="flex items-center gap-1 text-rose-600 text-xs font-bold bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100">
                                <FiAlertCircle size={14} />
                                {error}
                            </span>
                        )}
                        {success && (
                            <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                                <FiCheckCircle size={14} />
                                ¡Saldo a favor guardado con éxito!
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={onCancel || (() => navigate(-1))}
                            className="h-9 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={saving}
                            className="h-9 px-5 bg-[#8cc33f] text-white rounded-lg text-xs font-bold hover:bg-[#7db02b] shadow-xs transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-60"
                        >
                            {saving ? (
                                <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> <span>Guardando...</span></>
                            ) : (
                                <><FiSave size={14} /> <span>Guardar saldo</span></>
                            )}
                        </button>
                    </div>
                </div>

            </div>

            {/* MODAL: NUEVO TERCERO */}
            {showNewTerceroModal && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
                    <div 
                        className="bg-white w-full max-w-lg rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                                    Nuevo Tercero
                                </h3>
                                <p className="text-[11px] text-slate-500">Crear nuevo registro de tercero / paciente</p>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setShowNewTerceroModal(false)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors border-0 cursor-pointer"
                            >
                                <FiX size={16} />
                            </button>
                        </div>

                        {/* Form Content */}
                        <div className="p-5 overflow-y-auto custom-scrollbar space-y-3">
                            {modalError && (
                                <div className="bg-rose-50 border border-rose-200 p-3 rounded-lg text-rose-700 text-xs font-semibold">
                                    ⚠️ {modalError}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Nombre *</label>
                                    <input 
                                        type="text"
                                        value={newTercero.nombre}
                                        onChange={e => setNewTercero({ ...newTercero, nombre: e.target.value })}
                                        placeholder="Nombre del tercero"
                                        className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Apellidos *</label>
                                    <input 
                                        type="text"
                                        value={newTercero.apellidos}
                                        onChange={e => setNewTercero({ ...newTercero, apellidos: e.target.value })}
                                        placeholder="Apellidos del tercero"
                                        className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Tipo Documento *</label>
                                    <select
                                        value={newTercero.tipoDocumento}
                                        onChange={e => setNewTercero({ ...newTercero, tipoDocumento: e.target.value })}
                                        className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all cursor-pointer"
                                    >
                                        <option value="CC">Cédula de Ciudadanía (CC)</option>
                                        <option value="CE">Cédula de Extranjería (CE)</option>
                                        <option value="NIT">NIT</option>
                                        <option value="PASAPORTE">Pasaporte</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Nro. Documento *</label>
                                    <input 
                                        type="text"
                                        value={newTercero.nroDocumento}
                                        onChange={e => setNewTercero({ ...newTercero, nroDocumento: e.target.value })}
                                        placeholder="Número de documento"
                                        className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Razón social</label>
                                    <input 
                                        type="text"
                                        value={newTercero.razonSocial}
                                        onChange={e => setNewTercero({ ...newTercero, razonSocial: e.target.value })}
                                        placeholder="Razón social"
                                        className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Teléfono *</label>
                                    <input 
                                        type="text"
                                        value={newTercero.telefono}
                                        onChange={e => setNewTercero({ ...newTercero, telefono: e.target.value })}
                                        placeholder="Teléfono contacto"
                                        className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all font-mono"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Dirección *</label>
                                    <input 
                                        type="text"
                                        value={newTercero.direccion}
                                        onChange={e => setNewTercero({ ...newTercero, direccion: e.target.value })}
                                        placeholder="Dirección completa"
                                        className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">País</label>
                                    <select
                                        value={newTercero.pais}
                                        onChange={e => setNewTercero({ ...newTercero, pais: e.target.value })}
                                        className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all cursor-pointer"
                                    >
                                        <option value="Colombia">Colombia</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Ciudad</label>
                                    <select
                                        value={newTercero.ciudad}
                                        onChange={e => setNewTercero({ ...newTercero, ciudad: e.target.value })}
                                        className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all cursor-pointer"
                                    >
                                        <option value="">Seleccione...</option>
                                        {CIUDADES_COLOMBIA.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Correo electrónico</label>
                                    <input 
                                        type="email"
                                        value={newTercero.email}
                                        onChange={e => setNewTercero({ ...newTercero, email: e.target.value })}
                                        placeholder="correo@ejemplo.com"
                                        className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50 shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowNewTerceroModal(false)}
                                className="h-9 px-4 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveTercero}
                                disabled={savingModal}
                                className="h-9 px-5 bg-[#8cc33f] text-white rounded-lg text-xs font-bold hover:bg-[#7db02b] transition-all shadow-xs active:scale-95 disabled:opacity-60"
                            >
                                {savingModal ? "Guardando..." : "Guardar Tercero"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
