import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  FiArrowLeft, FiSearch, FiUser, FiPlus, FiTrash2,
  FiSave, FiAlertCircle, FiCheckCircle, FiFileText,
} from "react-icons/fi";
import {
  collection, query, where, getDocs, addDoc, doc, getDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { emitirFacturaDian } from "../../../services/DianService";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const PAYMENT_FORMS = [
  { code: "1", label: "Contado" },
  { code: "2", label: "Crédito" },
];

const PAYMENT_METHODS = [
  { code: "10", label: "Efectivo" },
  { code: "47", label: "Tarjeta débito" },
  { code: "48", label: "Tarjeta crédito" },
  { code: "42", label: "Transferencia / Nequi" },
  { code: "20", label: "Cheque" },
  { code: "ZZZ", label: "Otro" },
];

const StepIndicator = ({ step }) => (
  <div className="flex items-center gap-2 mb-8">
    {[1, 2, 3].map((s) => (
      <React.Fragment key={s}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all
          ${step === s ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : step > s ? "bg-green-500 text-white" : "bg-slate-100 text-slate-400"}`}>
          {step > s ? "✓" : s}
        </div>
        {s < 3 && <div className={`flex-1 h-0.5 rounded ${step > s ? "bg-green-400" : "bg-slate-100"}`} />}
      </React.Fragment>
    ))}
  </div>
);

const inputCls = "w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all";
const labelCls = "text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1";

export default function FacturaElectronicaForm({ onCancel, onSuccess }) {
  const { userProfile } = useAuth();
  const toast = useToast();
  const inquilino = userProfile?.inquilino || "";

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successData, setSuccessData] = useState(null);
  const [noCredsWarning, setNoCredsWarning] = useState(false);

  // Step 1: Patient
  const [paciente, setPaciente] = useState(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [patients, setPatients] = useState([]);
  const [loadingPacientes, setLoadingPacientes] = useState(false);
  const [showPatientDrop, setShowPatientDrop] = useState(false);

  // Step 2: Items
  const [items, setItems] = useState([
    { descripcion: "", cantidad: 1, precioUnitario: 0, descuento: 0 },
  ]);

  // Step 3: Payment
  const [condicionPago, setCondicionPago] = useState("1");
  const [medioPago, setMedioPago] = useState("10");
  const [referenciaPago, setReferenciaPago] = useState("");
  const [observaciones, setObservaciones] = useState("");

  // ─── Patient search ───
  const searchPatients = useCallback(async (term) => {
    if (!term || term.length < 2 || !inquilino) { setPatients([]); return; }
    setLoadingPacientes(true);
    try {
      const snap = await getDocs(
        query(collection(db, "pacientes"), where("inquilino", "==", inquilino))
      );
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const q = term.toLowerCase();
      setPatients(
        all.filter(
          (p) =>
            (p.nombre || "").toLowerCase().includes(q) ||
            (p.apellido || "").toLowerCase().includes(q) ||
            (p.documento || "").includes(q) ||
            (p.cedula || "").includes(q)
        ).slice(0, 8)
      );
    } catch (_) {
      setPatients([]);
    } finally {
      setLoadingPacientes(false);
    }
  }, [inquilino]);

  useEffect(() => {
    const t = setTimeout(() => searchPatients(patientSearch), 300);
    return () => clearTimeout(t);
  }, [patientSearch, searchPatients]);

  const selectPatient = (p) => {
    setPaciente(p);
    setPatientSearch(`${p.nombre || ""} ${p.apellido || ""}`.trim());
    setShowPatientDrop(false);
  };

  // ─── Item helpers ───
  const addItem = () =>
    setItems((prev) => [
      ...prev,
      { descripcion: "", cantidad: 1, precioUnitario: 0, descuento: 0 },
    ]);

  const removeItem = (idx) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const updateItem = (idx, field, value) =>
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it))
    );

  const itemTotal = (it) => {
    const q = parseFloat(it.cantidad) || 0;
    const p = parseFloat(it.precioUnitario) || 0;
    const d = parseFloat(it.descuento) || 0;
    return q * p * (1 - d / 100);
  };

  const totals = useMemo(() => {
    const subtotalBruto = items.reduce(
      (s, it) => s + (parseFloat(it.cantidad) || 0) * (parseFloat(it.precioUnitario) || 0),
      0
    );
    const totalDescuento = items.reduce((s, it) => {
      const gross = (parseFloat(it.cantidad) || 0) * (parseFloat(it.precioUnitario) || 0);
      return s + gross * ((parseFloat(it.descuento) || 0) / 100);
    }, 0);
    const total = subtotalBruto - totalDescuento;
    return { subtotalBruto, totalDescuento, total };
  }, [items]);

  // ─── Validation ───
  const validateStep = (s) => {
    if (s === 1) {
      if (!paciente) { toast.error("Selecciona un paciente."); return false; }
      return true;
    }
    if (s === 2) {
      if (items.length === 0) { toast.error("Agrega al menos un ítem."); return false; }
      for (const it of items) {
        if (!it.descripcion) { toast.error("Todos los ítems deben tener descripción."); return false; }
        if ((parseFloat(it.precioUnitario) || 0) <= 0) { toast.error("El precio unitario debe ser mayor a 0."); return false; }
      }
      return true;
    }
    return true;
  };

  const goNext = () => {
    if (validateStep(step)) setStep((s) => s + 1);
  };

  // ─── Save ───
  const handleSave = async () => {
    if (!validateStep(step)) return;
    setSaving(true);
    setError("");
    setNoCredsWarning(false);
    try {
      // Load tenant credentials
      const tenantSnap = await getDoc(doc(db, "tenants", inquilino));
      const tenantData = tenantSnap.exists() ? tenantSnap.data() : {};
      const hasCredentials =
        tenantData.factusClientId &&
        tenantData.factusClientSecret &&
        tenantData.factusUsername &&
        tenantData.factusPassword;

      if (!hasCredentials) setNoCredsWarning(true);

      const invoiceData = {
        items: items.map((it) => ({
          ...it,
          total: itemTotal(it),
        })),
        subtotal: totals.subtotalBruto,
        descuento: totals.totalDescuento,
        total: totals.total,
        condicionPago,
        medioPago,
        referenciaPago: medioPago !== "10" ? referenciaPago : "",
        observaciones,
        factusReferenceCode: `OC-${Date.now().toString(36).toUpperCase()}`,
      };

      const result = await emitirFacturaDian(
        invoiceData,
        paciente,
        hasCredentials ? tenantData : null
      );

      const firestoreDoc = {
        inquilino,
        pacienteId: paciente.id,
        pacienteNombre: `${paciente.nombre || ""} ${paciente.apellido || ""}`.trim(),
        pacienteDocumento: paciente.documento || paciente.cedula || "",
        items: invoiceData.items,
        subtotal: totals.subtotalBruto,
        descuento: totals.totalDescuento,
        total: totals.total,
        medioPago,
        condicionPago,
        referenciaPago: invoiceData.referenciaPago,
        observaciones,
        factusReferenceCode: invoiceData.factusReferenceCode,
        factusResponse: result.factusResponse || null,
        dianStatus: result.dianStatus || "NO_CONFIGURADA",
        cufe: result.cufe || null,
        qrCode: result.qrCode || null,
        factusInvoiceNumber: result.factusInvoiceNumber || null,
        createdAt: serverTimestamp(),
        creadoPor: userProfile?.uid || "",
      };

      await addDoc(collection(db, "facturas_electronicas"), firestoreDoc);

      if (result.success && result.cufe) {
        setSuccessData(result);
        toast.success("¡Factura electrónica emitida con éxito!");
      } else if (!hasCredentials) {
        toast.info("Factura guardada como borrador (sin credenciales Factus).");
        setSuccessData({ ...result, draft: true });
      } else {
        setError(result.message || "Error al emitir la factura.");
        toast.error(result.message || "Error al emitir la factura.");
      }
    } catch (err) {
      console.error(err);
      setError(err.message || "Error inesperado al guardar la factura.");
      toast.error(err.message || "Error inesperado.");
    } finally {
      setSaving(false);
    }
  };

  // ─── Success screen ───
  if (successData) {
    return (
      <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-10 animate-in fade-in duration-500 text-center max-w-2xl mx-auto">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
          <FiCheckCircle size={32} className="text-green-500" />
        </div>
        <h2 className="text-lg font-black text-slate-800 mb-1">
          {successData.draft ? "Factura guardada como borrador" : "¡Factura emitida con éxito!"}
        </h2>
        <p className="text-sm text-slate-500 mb-6">{successData.message}</p>
        {successData.cufe && (
          <div className="bg-slate-50 rounded-2xl p-4 text-left mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">CUFE</p>
            <p className="text-xs font-mono text-slate-700 break-all">{successData.cufe}</p>
          </div>
        )}
        {successData.factusInvoiceNumber && (
          <div className="bg-blue-50 rounded-2xl p-4 text-left mb-6">
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Número de Factura</p>
            <p className="text-2xl font-black text-blue-700">{successData.factusInvoiceNumber}</p>
          </div>
        )}
        <button onClick={onSuccess} className="bg-blue-600 text-white px-8 py-3 rounded-[18px] font-black text-[11px] uppercase tracking-widest">
          Volver a la lista
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onCancel} className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-all">
          <FiArrowLeft size={16} />
        </button>
        <div>
          <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest">Nueva Factura Electrónica</h2>
          <p className="text-[10px] text-slate-400 font-bold">
            {step === 1 ? "Paso 1: Selección de paciente" : step === 2 ? "Paso 2: Ítems de la factura" : "Paso 3: Datos de pago"}
          </p>
        </div>
      </div>

      <StepIndicator step={step} />

      {/* No credentials warning */}
      {noCredsWarning && (
        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-6">
          <FiAlertCircle className="text-orange-500 mt-0.5 shrink-0" size={18} />
          <p className="text-xs font-bold text-orange-700">
            Configura las credenciales Factus en <strong>Configuración → Facturación Electrónica</strong> para emitir facturas con validez ante la DIAN. La factura se guardará como borrador.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
          <FiAlertCircle className="text-red-500 mt-0.5 shrink-0" size={18} />
          <p className="text-xs font-bold text-red-700">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-6 space-y-6">
        {/* ── STEP 1: Patient ── */}
        {step === 1 && (
          <>
            <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Buscar Paciente</p>
            <div className="relative">
              <label className={labelCls}>Nombre o documento</label>
              <div className="relative mt-1">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  value={patientSearch}
                  onChange={(e) => { setPatientSearch(e.target.value); setShowPatientDrop(true); setPaciente(null); }}
                  onFocus={() => setShowPatientDrop(true)}
                  placeholder="Buscar por nombre o cédula..."
                  className={`${inputCls} pl-9`}
                />
              </div>
              {showPatientDrop && (patientSearch.length >= 2) && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden">
                  {loadingPacientes ? (
                    <div className="p-4 text-center text-xs text-slate-400 font-bold">Buscando...</div>
                  ) : patients.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 font-bold">Sin resultados</div>
                  ) : patients.map((p) => (
                    <button key={p.id} type="button" onClick={() => selectPatient(p)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-all text-left border-b border-slate-50 last:border-0">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-black">
                        {(p.nombre || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">{p.nombre} {p.apellido}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{p.tipoDocumento || "CC"}: {p.documento || p.cedula}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {paciente && (
              <div className="bg-blue-50 rounded-2xl p-5 space-y-3 animate-in fade-in duration-300">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center font-black text-sm">
                    {(paciente.nombre || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-black text-slate-800">{paciente.nombre} {paciente.apellido}</p>
                    <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{paciente.tipoDocumento || "CC"}: {paciente.documento || paciente.cedula}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {paciente.email && <div><span className="text-slate-400 font-black uppercase tracking-widest">Email</span><p className="font-bold text-slate-700">{paciente.email}</p></div>}
                  {(paciente.telefono || paciente.celular) && <div><span className="text-slate-400 font-black uppercase tracking-widest">Teléfono</span><p className="font-bold text-slate-700">{paciente.telefono || paciente.celular}</p></div>}
                  {paciente.direccion && <div><span className="text-slate-400 font-black uppercase tracking-widest">Dirección</span><p className="font-bold text-slate-700">{paciente.direccion}</p></div>}
                  {paciente.ciudad && <div><span className="text-slate-400 font-black uppercase tracking-widest">Ciudad</span><p className="font-bold text-slate-700">{paciente.ciudad}</p></div>}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── STEP 2: Items ── */}
        {step === 2 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Ítems de la Factura</p>
              <button type="button" onClick={addItem}
                className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-[14px] text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all">
                <FiPlus size={13} /> Agregar Ítem
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest py-2 pr-2">Descripción</th>
                    <th className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest py-2 px-2 w-20">Cant.</th>
                    <th className="text-right text-[10px] font-black text-slate-400 uppercase tracking-widest py-2 px-2 w-28">Precio Unit.</th>
                    <th className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest py-2 px-2 w-20">Dto. %</th>
                    <th className="text-right text-[10px] font-black text-slate-400 uppercase tracking-widest py-2 px-2 w-28">Total</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className="border-b border-slate-50">
                      <td className="py-2 pr-2">
                        <input value={it.descripcion} onChange={(e) => updateItem(idx, "descripcion", e.target.value)}
                          placeholder="Descripción del servicio" className={inputCls} />
                      </td>
                      <td className="py-2 px-2">
                        <input type="number" min="1" value={it.cantidad} onChange={(e) => updateItem(idx, "cantidad", e.target.value)}
                          className={`${inputCls} text-center`} />
                      </td>
                      <td className="py-2 px-2">
                        <input type="number" min="0" value={it.precioUnitario} onChange={(e) => updateItem(idx, "precioUnitario", e.target.value)}
                          className={`${inputCls} text-right`} />
                      </td>
                      <td className="py-2 px-2">
                        <input type="number" min="0" max="100" value={it.descuento} onChange={(e) => updateItem(idx, "descuento", e.target.value)}
                          className={`${inputCls} text-center`} />
                      </td>
                      <td className="py-2 px-2 text-right text-sm font-black text-slate-700">{fmt(itemTotal(it))}</td>
                      <td className="py-2 pl-2">
                        {items.length > 1 && (
                          <button type="button" onClick={() => removeItem(idx)}
                            className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500 transition-all">
                            <FiTrash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 pt-4 space-y-1 text-right">
              <p className="text-xs text-slate-500 font-bold">Subtotal: <span className="text-slate-700">{fmt(totals.subtotalBruto)}</span></p>
              {totals.totalDescuento > 0 && (
                <p className="text-xs text-red-500 font-bold">Descuento: <span>-{fmt(totals.totalDescuento)}</span></p>
              )}
              <p className="text-lg font-black text-slate-800">TOTAL: <span className="text-blue-600">{fmt(totals.total)}</span></p>
            </div>
          </>
        )}

        {/* ── STEP 3: Payment ── */}
        {step === 3 && (
          <>
            <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Datos de Pago</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={labelCls}>Condición de Pago *</label>
                <select value={condicionPago} onChange={(e) => setCondicionPago(e.target.value)} className={`${inputCls} mt-1`}>
                  {PAYMENT_FORMS.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Medio de Pago *</label>
                <select value={medioPago} onChange={(e) => setMedioPago(e.target.value)} className={`${inputCls} mt-1`}>
                  {PAYMENT_METHODS.map((m) => <option key={m.code} value={m.code}>{m.label}</option>)}
                </select>
              </div>
              {medioPago !== "10" && (
                <div className="sm:col-span-2">
                  <label className={labelCls}>Referencia de Pago</label>
                  <input value={referenciaPago} onChange={(e) => setReferenciaPago(e.target.value)}
                    placeholder="Número de transacción o referencia" className={`${inputCls} mt-1`} />
                </div>
              )}
              <div className="sm:col-span-2">
                <label className={labelCls}>Observaciones (máx. 250 caracteres)</label>
                <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value.slice(0, 250))}
                  rows={3} placeholder="Observaciones opcionales..."
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all mt-1 resize-none" />
                <p className="text-[10px] text-slate-400 font-bold text-right mt-1">{observaciones.length}/250</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Resumen</p>
              <p className="text-sm font-bold text-slate-700">Paciente: <span className="text-slate-900">{paciente?.nombre} {paciente?.apellido}</span></p>
              <p className="text-sm font-bold text-slate-700">{items.length} ítem(s) · {fmt(totals.total)}</p>
            </div>
          </>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between mt-6">
        <button type="button" onClick={step === 1 ? onCancel : () => setStep((s) => s - 1)}
          className="flex items-center gap-2 px-6 py-3 rounded-[18px] border border-slate-200 bg-white text-slate-600 font-black text-[11px] uppercase tracking-widest hover:bg-slate-50 transition-all">
          <FiArrowLeft size={14} /> {step === 1 ? "Cancelar" : "Atrás"}
        </button>
        {step < 3 ? (
          <button type="button" onClick={goNext}
            className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-[18px] font-black text-[11px] uppercase tracking-widest hover:bg-blue-700 transition-all">
            Siguiente →
          </button>
        ) : (
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-[#8cc33f] text-white px-8 py-3 rounded-full font-black text-[11px] uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 shadow-md shadow-green-100">
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Emitiendo...</>
            ) : (
              <><FiSave size={14} /> Emitir Factura Electrónica</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
