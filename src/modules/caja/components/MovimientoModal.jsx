// src/modules/caja/components/MovimientoModal.jsx
// ─── Modal para registrar ingresos y egresos ───
// Conectado en tiempo real con: Cajas + Pacientes + Facturas
import React, { useState, useEffect, useRef } from "react";
import { db } from "../../../firebase/firebaseConfig";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  increment,
  serverTimestamp,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";

const CONCEPTOS = {
  ingreso: [
    "Pago de tratamiento",
    "Abono a deuda",
    "Pago cita",
    "Anticipo",
    "Pago factura",
    "Pago a crédito",
    "Otro ingreso",
  ],
  egreso: [
    "Pago proveedor",
    "Gasto operativo",
    "Devolución al paciente",
    "Retiro de caja",
    "Pago nómina",
    "Compra de insumos",
    "Gastos generales",
    "Otro egreso",
  ],
};

const METODOS = ["Efectivo", "Transferencia", "Tarjeta débito", "Tarjeta crédito", "Cheque", "Nequi/Daviplata", "Otro"];

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0,
  });

// ── Patient search hook ──
function usePatientSearch(inquilino) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!inquilino) return;
    setLoading(true);
    getDocs(query(
      collection(db, "pacientes"),
      where("inquilino", "==", inquilino)
    )).then(snap => {
      setPatients(snap.docs.map(d => ({
        id: d.id,
        nombre: d.data().nombreCompleto || `${d.data().nombres || ""} ${d.data().apellidos || ""}`.trim() || d.data().paciente || "Sin nombre",
        cedula: d.data().nroDocumento || d.data().cedula || "",
        celular: d.data().celular || d.data().celularPaciente || "",
      })));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [inquilino]);

  return { patients, loading };
}

// ── Invoice search (open invoices) ──
function useInvoiceSearch(inquilino, patientId) {
  const [facturas, setFacturas] = useState([]);

  useEffect(() => {
    if (!inquilino || !patientId) { setFacturas([]); return; }
    getDocs(query(
      collection(db, "facturas"),
      where("inquilino", "==", inquilino),
      where("pacienteId", "==", patientId),
      where("estado", "in", ["Pendiente", "Parcial"])
    )).then(snap => {
      setFacturas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }).catch(() => setFacturas([]));
  }, [inquilino, patientId]);

  return facturas;
}

export default function MovimientoModal({ caja, inquilino, userProfile, onClose, onSuccess }) {
  const [tipo, setTipo] = useState("ingreso");
  const [form, setForm] = useState({
    concepto: "",
    monto: "",
    montoDisplay: "",
    metodoPago: "Efectivo",
    descripcion: "",
  });
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedFactura, setSelectedFactura] = useState(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [showPatientDrop, setShowPatientDrop] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const patientRef = useRef(null);

  const { patients } = usePatientSearch(inquilino);
  const facturas = useInvoiceSearch(inquilino, selectedPatient?.id);

  const handle = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));

  // Close patient dropdown on outside click
  useEffect(() => {
    const h = (e) => {
      if (patientRef.current && !patientRef.current.contains(e.target)) {
        setShowPatientDrop(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filteredPatients = patients.filter(p => {
    const q = patientSearch.toLowerCase();
    return (
      p.nombre.toLowerCase().includes(q) ||
      p.cedula.toLowerCase().includes(q) ||
      p.celular.toLowerCase().includes(q)
    );
  }).slice(0, 8);

  const montoNum = parseFloat(String(form.monto).replace(/[^0-9]/g, "")) || 0;
  const nuevoSaldo = (caja.saldoActual || 0) + (tipo === "ingreso" ? montoNum : -montoNum);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.concepto) { setError("Selecciona un concepto."); return; }
    if (montoNum <= 0) { setError("El monto debe ser mayor a 0."); return; }

    setSaving(true);
    setError("");
    try {
      // 1. Registrar en subcolección movimientos
      const movData = {
        inquilino,
        tipo,
        concepto: form.concepto,
        monto: montoNum,
        metodoPago: form.metodoPago,
        descripcion: form.descripcion.trim(),
        // Paciente
        pacienteId: selectedPatient?.id || "",
        pacienteNombre: selectedPatient?.nombre || "",
        pacienteCedula: selectedPatient?.cedula || "",
        // Factura vinculada
        facturaId: selectedFactura?.id || "",
        facturaNum: selectedFactura?.numero || selectedFactura?.numeroFactura || "",
        // Usuario
        usuarioId: userProfile?.uid || "",
        usuarioNombre: userProfile?.nombre || userProfile?.email || "Usuario",
        fecha: serverTimestamp(),
      };

      await addDoc(collection(db, "cajas", caja.id, "movimientos"), movData);

      // 2. Actualizar saldo en caja
      const delta = tipo === "ingreso" ? montoNum : -montoNum;
      await updateDoc(doc(db, "cajas", caja.id), {
        saldoActual: increment(delta),
        totalIngresos: tipo === "ingreso" ? increment(montoNum) : increment(0),
        totalEgresos: tipo === "egreso" ? increment(montoNum) : increment(0),
      });

      // 3. Si tiene factura vinculada, actualizar estado/saldo de la factura
      if (selectedFactura?.id && tipo === "ingreso") {
        const factRef = doc(db, "facturas", selectedFactura.id);
        const pagado = (selectedFactura.montoPagado || 0) + montoNum;
        const total = selectedFactura.monto || selectedFactura.total || 0;
        const nuevoEstado = pagado >= total ? "Pagada" : "Parcial";
        await updateDoc(factRef, {
          montoPagado: pagado,
          saldoPendiente: Math.max(0, total - pagado),
          estado: nuevoEstado,
          ultimoPagoFecha: serverTimestamp(),
          ultimoPagoCaja: caja.id,
        });
      }

      onSuccess?.();
    } catch (err) {
      console.error("Error registrando movimiento:", err);
      setError("No se pudo registrar el movimiento. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={OVERLAY} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={MODAL}>
        {/* Header */}
        <div style={HDR}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#0f172a" }}>
              Registrar Movimiento
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>
              <strong>{caja.usuarioNombre || caja.nombre}</strong>
              {" · "}Saldo: <strong style={{ color: "#1d4ed8" }}>{fmt(caja.saldoActual)}</strong>
            </p>
          </div>
          <button onClick={onClose} style={CLOSE_BTN}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "20px 22px", overflowY: "auto", maxHeight: "75vh" }}>
          {error && <div style={ERR_BOX}>⚠️ {error}</div>}

          {/* Tipo toggle */}
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            {["ingreso", "egreso"].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setTipo(t); setForm(f => ({ ...f, concepto: "" })); }}
                style={{
                  flex: 1, height: 40, borderRadius: 10, border: "2px solid",
                  borderColor: tipo === t ? (t === "ingreso" ? "#10b981" : "#f43f5e") : "#e2e8f0",
                  background: tipo === t ? (t === "ingreso" ? "#ecfdf5" : "#fff1f2") : "#fff",
                  color: tipo === t ? (t === "ingreso" ? "#065f46" : "#9f1239") : "#94a3b8",
                  fontWeight: 800, fontSize: 13, cursor: "pointer",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  transition: "all 0.18s",
                }}
              >
                {t === "ingreso" ? "⬆️ Ingreso" : "⬇️ Egreso"}
              </button>
            ))}
          </div>

          <div style={GRID2}>
            {/* Concepto */}
            <div style={FW}>
              <label style={LBL}>Concepto *</label>
              <select value={form.concepto} onChange={handle("concepto")} style={INP} required>
                <option value="">Seleccionar...</option>
                {CONCEPTOS[tipo].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            {/* Monto */}
            <div style={FW}>
              <label style={LBL}>Monto (COP) *</label>
              <input
                type="text"
                placeholder="0"
                value={form.montoDisplay}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, "");
                  const formatted = new Intl.NumberFormat("es-CO").format(raw);
                  setForm({ 
                    ...form, 
                    monto: raw, 
                    montoDisplay: raw ? formatted : "" 
                  });
                }}
                style={{ ...INP, fontFamily: "monospace", fontWeight: "bold" }}
                required
              />
            </div>
          </div>

          <div style={GRID2}>
            {/* Método pago */}
            <div style={FW}>
              <label style={LBL}>Método de pago</label>
              <select value={form.metodoPago} onChange={handle("metodoPago")} style={INP}>
                {METODOS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>

            {/* Descripción */}
            <div style={FW}>
              <label style={LBL}>Descripción</label>
              <input
                value={form.descripcion}
                onChange={handle("descripcion")}
                placeholder="Detalle opcional..."
                style={INP}
              />
            </div>
          </div>

          {/* ── Paciente (búsqueda en tiempo real) ── */}
          <div style={{ ...FW, marginBottom: 16 }} ref={patientRef}>
            <label style={LBL}>Paciente vinculado</label>
            {selectedPatient ? (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                border: "1.5px solid #a7f3d0", borderRadius: 10, padding: "8px 14px",
                background: "#ecfdf5",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#065f46" }}>{selectedPatient.nombre}</div>
                  {selectedPatient.cedula && <div style={{ fontSize: 11, color: "#64748b" }}>CC: {selectedPatient.cedula}</div>}
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedPatient(null); setSelectedFactura(null); setPatientSearch(""); }}
                  style={{
                    width: 24, height: 24, borderRadius: 6, border: "none",
                    background: "#f43f5e", color: "#fff", cursor: "pointer", fontSize: 11,
                  }}
                >✕</button>
              </div>
            ) : (
              <div style={{ position: "relative" }}>
                <input
                  placeholder="🔍 Buscar por nombre o cédula..."
                  value={patientSearch}
                  onChange={e => { setPatientSearch(e.target.value); setShowPatientDrop(true); }}
                  onFocus={() => setShowPatientDrop(true)}
                  style={INP}
                />
                {showPatientDrop && patientSearch.length >= 1 && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 1000,
                    background: "#fff", borderRadius: 10, border: "1.5px solid #e2e8f0",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.15)", maxHeight: 220, overflowY: "auto",
                    marginTop: 4,
                  }}>
                    {filteredPatients.length === 0 ? (
                      <div style={{ padding: "10px 14px", fontSize: 13, color: "#94a3b8" }}>
                        Sin resultados
                      </div>
                    ) : filteredPatients.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setSelectedPatient(p); setPatientSearch(""); setShowPatientDrop(false); }}
                        style={{
                          display: "flex", flexDirection: "column", width: "100%",
                          padding: "9px 14px", border: "none", background: "transparent",
                          cursor: "pointer", textAlign: "left", borderBottom: "1px solid #f1f5f9",
                          transition: "background 0.1s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "#f0f9ff"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{p.nombre}</span>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>
                          {p.cedula && `CC: ${p.cedula}`}{p.celular && ` · ${p.celular}`}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Facturas pendientes del paciente ── */}
          {selectedPatient && tipo === "ingreso" && facturas.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label style={LBL}>Aplicar a factura pendiente (opcional)</label>
              <select
                value={selectedFactura?.id || ""}
                onChange={e => {
                  const f = facturas.find(f => f.id === e.target.value);
                  setSelectedFactura(f || null);
                  if (f) setForm(p => ({ ...p, monto: String(f.saldoPendiente || f.monto || "") }));
                }}
                style={INP}
              >
                <option value="">Sin vincular a factura</option>
                {facturas.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.numero || f.numeroFactura || f.id.slice(-6)} — {fmt(f.saldoPendiente || f.monto)} pendiente
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Preview saldo */}
          {montoNum > 0 && (
            <div style={{
              background: tipo === "ingreso" ? "#ecfdf5" : "#fff1f2",
              border: `1.5px solid ${tipo === "ingreso" ? "#a7f3d0" : "#fecdd3"}`,
              borderRadius: 12, padding: "12px 16px", marginBottom: 16,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Saldo tras el movimiento
                </div>
                <div style={{
                  fontSize: 22, fontWeight: 900,
                  color: tipo === "ingreso" ? "#065f46" : "#9f1239",
                }}>
                  {fmt(nuevoSaldo)}
                </div>
              </div>
              <div style={{
                fontSize: 16, fontWeight: 800,
                color: tipo === "ingreso" ? "#10b981" : "#f43f5e",
              }}>
                {tipo === "ingreso" ? "+" : "-"}{fmt(montoNum)}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" onClick={onClose} style={BTN_CANCEL}>Cancelar</button>
            <button
              type="submit"
              disabled={saving}
              style={{
                height: 40, padding: "0 24px", borderRadius: 10, border: "none",
                background: tipo === "ingreso"
                  ? "linear-gradient(135deg, #10b981, #059669)"
                  : "linear-gradient(135deg, #f43f5e, #dc2626)",
                color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer",
                boxShadow: tipo === "ingreso"
                  ? "0 4px 14px rgba(16,185,129,0.35)"
                  : "0 4px 14px rgba(244,63,94,0.35)",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Guardando..." : `${tipo === "ingreso" ? "⬆️" : "⬇️"} Registrar ${tipo}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Styles ─── */
const OVERLAY = {
  position: "fixed", inset: 0,
  background: "rgba(15,23,42,0.5)",
  backdropFilter: "blur(4px)",
  zIndex: 1100,
  display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
};
const MODAL = {
  background: "#fff", borderRadius: 12, width: "100%", maxWidth: 540,
  border: "1px solid #e2e8f0",
  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
};
const HDR = {
  padding: "14px 20px", borderBottom: "1px solid #e2e8f0",
  background: "#f8fafc",
  display: "flex", alignItems: "center", justifyContent: "space-between",
};
const CLOSE_BTN = {
  width: 28, height: 28, borderRadius: 8, border: "none",
  background: "transparent", cursor: "pointer", fontSize: 14, color: "#94a3b8",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const GRID2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 };
const FW = { display: "flex", flexDirection: "column", gap: 4 };
const LBL = { fontSize: 11, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" };
const INP = {
  height: 36, borderRadius: 8, border: "1px solid #e2e8f0",
  padding: "0 10px", fontSize: 12, color: "#0f172a", background: "#f8fafc",
  outline: "none", width: "100%", boxSizing: "border-box",
  transition: "all 0.2s",
};
const ERR_BOX = {
  background: "#fff1f2", border: "1px solid #fecdd3",
  borderRadius: 8, padding: "8px 12px", fontSize: 12,
  color: "#be123c", marginBottom: 12, fontWeight: 600,
};
const BTN_CANCEL = {
  height: 36, padding: "0 16px", borderRadius: 8, border: "1px solid #cbd5e1",
  background: "#fff", color: "#334155", fontWeight: 600, fontSize: 12, cursor: "pointer",
};

