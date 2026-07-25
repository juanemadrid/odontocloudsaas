import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
    FiArrowLeft, FiCalendar, FiUser, FiTrash2, 
    FiPlus, FiSave, FiAlertCircle, FiCheckCircle, FiX 
} from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import { db } from "../../../firebase/firebaseConfig";
import { buildDashboardPath } from "../../../utils/dashboardBasePath";
import { 
    collection, addDoc, getDocs, query, where, 
    serverTimestamp, doc, updateDoc, Timestamp 
} from "firebase/firestore";
import { useAuth } from "../../../context/AuthContext";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const formatNumberWithDots = (val) => {
    if (val === undefined || val === null) return "";
    const str = String(val).replace(/\D/g, "");
    if (!str) return "";
    return Number(str).toLocaleString("es-CO").replace(/,/g, ".");
};

const parseRawNumber = (val) => {
    if (!val) return 0;
    return Number(String(val).replace(/\D/g, ""));
};

const FormRow = ({ label, required, children }) => (
  <tr className="border-b border-slate-100 hover:bg-slate-50/40 transition-all duration-300">
    <td className="w-[260px] py-4 pr-6 pl-4 text-xs font-extrabold text-slate-500 text-right select-none uppercase tracking-widest leading-relaxed">
      {label} {required && <span className="text-rose-500 ml-1 text-sm">*</span>}
    </td>
    <td className="py-4 pl-2 pr-4">
      <div className="w-full max-w-lg">
        {children}
      </div>
    </td>
  </tr>
);

export default function NotaCreditoForm({ onCancel, onSuccess }) {
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || "";

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    // Form State
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [paciente, setPaciente] = useState(null);
    const [patientSearch, setPatientSearch] = useState("");
    const [showPatientDrop, setShowPatientDrop] = useState(false);
    const [conceptos, setConceptos] = useState([]);
    const [observaciones, setObservaciones] = useState("");
    const [generarSaldoFavor, setGenerarSaldoFavor] = useState(true);

    // Modal state for New Concept
    const [showNewConceptModal, setShowNewConceptModal] = useState(false);
    const [newConcept, setNewConcept] = useState({
        concepto: "",
        descripcion: "",
        precioUnitario: "",
        cantidad: "1"
    });

    const [pacientes, setPacientes] = useState([]);
    const patientRef = useRef(null);

    const loadBasics = async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            // Load Patients for select
            const pacSnap = await getDocs(query(collection(db, "pacientes"), where("inquilino", "==", inquilino)));
            setPacientes(pacSnap.docs.map(d => ({ 
                id: d.id, 
                nombre: d.data().nombreCompleto || `${d.data().nombres || ""} ${d.data().apellidos || ""}`.trim(),
                cedula: d.data().nroDocumento || d.data().cedula || ""
            })));
        } catch (e) {
            console.error("Error loading patients:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBasics();
    }, [inquilino]);

    // Autocomplete filter for patients
    const filteredPatients = useMemo(() => {
        if (!patientSearch.trim()) return [];
        const q = patientSearch.toLowerCase();
        return pacientes.filter(p => 
            p.nombre.toLowerCase().includes(q) || 
            p.cedula.toLowerCase().includes(q)
        ).slice(0, 10);
    }, [pacientes, patientSearch]);

    // Handle outside clicks to close dropdown
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (patientRef.current && !patientRef.current.contains(e.target)) {
                setShowPatientDrop(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleAddConcept = (e) => {
        e.preventDefault();
        const price = Number(newConcept.precioUnitario);
        const qty = Number(newConcept.cantidad);
        if (!newConcept.concepto.trim()) return;
        if (price < 0 || qty <= 0) return;

        const detail = {
            concepto: newConcept.concepto.trim(),
            descripcion: newConcept.descripcion.trim(),
            precioUnitario: price,
            cantidad: qty,
            total: price * qty
        };

        setConceptos([...conceptos, detail]);
        setNewConcept({
            concepto: "",
            descripcion: "",
            precioUnitario: "",
            cantidad: "1"
        });
        setShowNewConceptModal(false);
    };

    const handleRemoveConcept = (index) => {
        setConceptos(conceptos.filter((_, i) => i !== index));
    };

    const totalCalculado = useMemo(() => {
        return conceptos.reduce((sum, c) => sum + (c.total || 0), 0);
    }, [conceptos]);

    const handleSubmit = async () => {
        if (!paciente) return setError("Debes seleccionar un tercero / paciente.");
        if (conceptos.length === 0) return setError("Debes agregar al menos un detalle o concepto.");

        setSaving(true);
        setError("");

        try {
            // 1. Calculate consecutive number
            const qCount = query(collection(db, "notas_credito"), where("inquilino", "==", inquilino));
            const snapCount = await getDocs(qCount);
            const consecutive = `NC${snapCount.size + 1}`;

            // 2. If generating balance in favor, insert into "pagos"
            let pagoId = null;
            if (generarSaldoFavor && totalCalculado > 0) {
                const pagoData = {
                    inquilino,
                    fecha: Timestamp.fromDate(new Date(fecha + "T00:00:00")),
                    pacienteId: paciente.id,
                    patientNombre: paciente.nombre,
                    concepto: "SALDO A FAVOR",
                    monto: totalCalculado,
                    medio: "Nota de Crédito",
                    notes: `SALDO A FAVOR GENERADO POR NOTA CRÉDITO #${consecutive}`,
                    registradoPor: `${userProfile?.nombre || userProfile?.email}`,
                    estado: "Activo",
                    createdAt: serverTimestamp()
                };
                const pagoRef = await addDoc(collection(db, "pagos"), pagoData);
                pagoId = pagoRef.id;
            }

            // 3. Save credit note document
            const notaData = {
                inquilino,
                fecha: Timestamp.fromDate(new Date(fecha + "T00:00:00")),
                nroConsecutivo: consecutive,
                pacienteId: paciente.id,
                pacienteNombre: paciente.nombre,
                conceptos,
                total: totalCalculado,
                valorUsado: 0,
                saldoFavor: generarSaldoFavor ? totalCalculado : 0,
                generarSaldoFavor,
                pagoId,
                notas: observaciones,
                estado: "Activo",
                registradoPor: `${userProfile?.nombre || userProfile?.email}`,
                createdAt: serverTimestamp()
            };

            await addDoc(collection(db, "notas_credito"), notaData);

            setSuccess(true);
            setTimeout(() => {
                if (onSuccess) onSuccess();
                else navigate(buildDashboardPath('administracion'));
            }, 1500);
        } catch (e) {
            console.error("Error saving credit note:", e);
            setError("Error al guardar la Nota de Crédito. Revisa la consola.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-500 pb-28">

            {/* Form Stack */}
            <div className="space-y-6">
                {/* General Info */}
                <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Información general</h3>
                    </div>
                    <div className="p-4">
                        {loading ? (
                            <div className="p-10 text-center flex flex-col items-center justify-center">
                                <div className="w-8 h-8 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin mb-2" />
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando...</p>
                            </div>
                        ) : (
                            <table className="w-full text-left">
                                <tbody>
                                    <FormRow label="Tercero / Paciente *" required>
                                        <div ref={patientRef} className="relative w-full">
                                            <div className="relative">
                                                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                                    <FiUser size={14} />
                                                </span>
                                                <input
                                                    type="text"
                                                    placeholder={paciente ? `${paciente.nombre} (CC: ${paciente.cedula})` : "Buscar paciente por nombre o CC..."}
                                                    value={patientSearch}
                                                    onChange={e => {
                                                        setPatientSearch(e.target.value);
                                                        setShowPatientDrop(true);
                                                    }}
                                                    onFocus={() => setShowPatientDrop(true)}
                                                    className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/5 transition-all"
                                                />
                                                {paciente && !patientSearch && (
                                                    <button 
                                                        type="button"
                                                        onClick={() => setPaciente(null)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-slate-100 hover:bg-rose-50 hover:text-rose-500 rounded-lg text-slate-400 transition-all text-xs"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                            {showPatientDrop && filteredPatients.length > 0 && (
                                                <div className="absolute left-0 right-0 top-12 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto">
                                                    {filteredPatients.map(p => (
                                                        <div
                                                            key={p.id}
                                                            onClick={() => {
                                                                setPaciente(p);
                                                                setPatientSearch("");
                                                                setShowPatientDrop(false);
                                                            }}
                                                            className="px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-rose-500 transition-colors cursor-pointer border-b border-slate-50 last:border-0"
                                                        >
                                                            {p.nombre} <span className="text-xs text-slate-400 font-medium font-mono ml-2">(CC: {p.cedula})</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </FormRow>

                                    <FormRow label="Fecha *" required>
                                        <div className="relative">
                                            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                                <FiCalendar size={14} />
                                            </span>
                                            <input 
                                                type="date"
                                                className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/5 transition-all"
                                                value={fecha}
                                                onChange={e => setFecha(e.target.value)}
                                            />
                                        </div>
                                    </FormRow>

                                    <FormRow label="Notas u observaciones">
                                        <textarea
                                            placeholder="Detalle el motivo o notas adicionales de la Nota de Crédito..."
                                            value={observaciones}
                                            onChange={e => setObservaciones(e.target.value)}
                                            rows={3}
                                            className="w-full p-4 bg-white border border-slate-200 focus:border-blue-500 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-blue-500/5 transition-all resize-none"
                                        />
                                    </FormRow>
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Concepts Table */}
                <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Detalles</h3>
                        <button
                            type="button"
                            onClick={() => {
                                setNewConcept({
                                    concepto: "",
                                    descripcion: "",
                                    precioUnitario: "",
                                    cantidad: "1"
                                });
                                setShowNewConceptModal(true);
                            }}
                            className="h-9 px-4 bg-[#8cc33f] text-white hover:bg-[#7db02b] rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow transition-all active:scale-95"
                        >
                            <FiPlus size={14} /> Agregar
                        </button>
                    </div>
                    <div className="p-4">
                        {conceptos.length === 0 ? (
                            <div className="p-12 text-center text-slate-400">
                                <p className="text-xs font-bold uppercase tracking-widest">No se han agregado conceptos aún.</p>
                                <p className="text-[10px] mt-1">Haga clic en "+ Agregar" para añadir conceptos al detalle.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50/50 border-b border-slate-100">
                                            <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase">Concepto</th>
                                            <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase">Descripción</th>
                                            <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase text-right">Precio Unitario</th>
                                            <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase text-center">Cantidad</th>
                                            <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase text-right">Total</th>
                                            <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase text-center">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {conceptos.map((c, i) => (
                                            <tr key={i} className="hover:bg-slate-50/20">
                                                <td className="py-3.5 px-4 font-bold text-slate-700">{c.concepto}</td>
                                                <td className="py-3.5 px-4 text-slate-400 font-medium">{c.descripcion || "—"}</td>
                                                <td className="py-3.5 px-4 text-slate-600 font-bold text-right">{fmt(c.precioUnitario)}</td>
                                                <td className="py-3.5 px-4 text-slate-500 font-bold text-center font-mono">{c.cantidad}</td>
                                                <td className="py-3.5 px-4 text-slate-700 font-black text-right">{fmt(c.total)}</td>
                                                <td className="py-3.5 px-4 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveConcept(i)}
                                                        className="w-8 h-8 inline-flex items-center justify-center bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-lg border border-rose-100 transition-colors"
                                                        title="Eliminar concepto"
                                                    >
                                                        <FiTrash2 size={13} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="bg-slate-50/50 font-black border-t-2 border-slate-100">
                                            <td colSpan={4} className="py-4 px-4 text-right uppercase text-slate-400 tracking-wider">Total:</td>
                                            <td className="py-4 px-4 text-right text-rose-500 text-base">{fmt(totalCalculado)}</td>
                                            <td></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                {/* Saldo a Favor Section */}
                <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Saldo a favor</h3>
                    </div>
                    <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-1">
                            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Generar saldo a favor para el tercero</h4>
                            <p className="text-[11px] text-slate-400 font-medium">Si se activa, el valor total se cargará como un saldo a favor en la ficha del paciente.</p>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="flex flex-col text-right">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Valor a generar</span>
                                <strong className="text-emerald-600 text-lg font-black">{generarSaldoFavor ? fmt(totalCalculado) : fmt(0)}</strong>
                            </div>
                            <button
                                type="button"
                                onClick={() => setGenerarSaldoFavor(!generarSaldoFavor)}
                                className={`w-14 h-8 flex items-center rounded-full p-1 transition-all duration-300 ${
                                    generarSaldoFavor ? "bg-[#8cc33f]" : "bg-slate-200"
                                }`}
                            >
                                <div
                                    className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-all duration-300 ${
                                        generarSaldoFavor ? "translate-x-6" : "translate-x-0"
                                    }`}
                                />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODAL: NEW CONCEPT */}
            {showNewConceptModal && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div 
                        className="bg-white w-full max-w-[480px] rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">
                                    Nuevo concepto
                                </h3>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setShowNewConceptModal(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white border border-slate-100 text-slate-400 hover:text-rose-500 transition-all font-bold text-xs"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Form Content */}
                        <form onSubmit={handleAddConcept} className="flex flex-col">
                            <div className="p-6 space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Concepto *</label>
                                    <input 
                                        type="text"
                                        required
                                        value={newConcept.concepto}
                                        onChange={e => setNewConcept({ ...newConcept, concepto: e.target.value })}
                                        placeholder="Ingresa el nombre del concepto"
                                        className="w-full h-11 px-4 bg-slate-50 hover:bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Cantidad *</label>
                                    <input 
                                        type="number"
                                        required
                                        min="1"
                                        value={newConcept.cantidad}
                                        onChange={e => setNewConcept({ ...newConcept, cantidad: e.target.value })}
                                        placeholder="1"
                                        className="w-full h-11 px-4 bg-slate-50 hover:bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all font-mono"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Descripción</label>
                                    <input 
                                        type="text"
                                        value={newConcept.descripcion}
                                        onChange={e => setNewConcept({ ...newConcept, descripcion: e.target.value })}
                                        placeholder="Ingresa la descripción del concepto"
                                        className="w-full h-11 px-4 bg-slate-50 hover:bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Precio Unitario *</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">$</span>
                                        <input 
                                            type="text"
                                            required
                                            value={formatNumberWithDots(newConcept.precioUnitario)}
                                            onChange={e => setNewConcept({ ...newConcept, precioUnitario: parseRawNumber(e.target.value) })}
                                            placeholder="0"
                                            className="w-full h-11 pl-8 pr-4 bg-slate-50 hover:bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all font-mono"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
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
                            ¡Nota de crédito guardada!
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
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
                            <><FiSave size={14} /> Guardar nota</>
                        )}
                    </button>
                </div>
            </div>
        </div>

    );
}
