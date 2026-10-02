// src/modules/caja/components/MovimientoModal.jsx
// ─── Modal para registrar ingresos y egresos ───
// Conectado en tiempo real con: Cajas + Pacientes + Facturas
import React, { useState, useEffect, useRef } from "react";
import supabase from "../../../lib/supabaseClient";

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
    supabase.from("pacientes")
      .select("*")
      .eq("tenant_id", inquilino)
      .then(({ data }) => {
        setPatients((data || []).map(d => ({
          id: d.id,
          nombre: d.nombreCompleto || d.nombre || `${d.nombres || ""} ${d.apellidos || ""}`.trim() || "Sin nombre",
          cedula: d.nroDocumento || d.cedula || "",
          celular: d.celular || "",
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
    supabase.from("facturas")
      .select("*")
      .eq("tenant_id", inquilino)
      .or(`pacienteId.eq.${patientId},paciente_id.eq.${patientId}`)
      .in("estado", ["Pendiente", "Parcial"])
      .then(({ data }) => {
        setFacturas(data || []);
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
  const [confirmEgresoDescubierto, setConfirmEgresoDescubierto] = useState(false);
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

    const currentCajaSaldo = Number(caja.saldoActual ?? caja.saldo_actual ?? 0);
    if (tipo === "egreso" && montoNum > currentCajaSaldo && !confirmEgresoDescubierto) {
      setConfirmEgresoDescubierto(true);
      return;
    }

    setSaving(true);
    setError("");
    setConfirmEgresoDescubierto(false);
    try {
      // 1. Obtener y consumir consecutivo oficial y atómico desde consecutivosService
      let nroConsecutivo = 1;
      try {
        const { consumeNextConsecutivo, CONSECUTIVO_TYPES } = await import("../../../services/consecutivosService");
        const tipoField = tipo === "egreso" ? CONSECUTIVO_TYPES.EGRESOS : CONSECUTIVO_TYPES.RECIBO_CAJA;
        nroConsecutivo = await consumeNextConsecutivo(inquilino, tipoField);
      } catch (e) {
        console.warn("Aviso al obtener consecutivo atómico:", e);
      }
      const finalConsStr = String(nroConsecutivo);
      const docLabel = tipo === "egreso" 
        ? `[EGR-${finalConsStr.padStart(4, "0")}] ` 
        : `[RC-${finalConsStr.padStart(4, "0")}] `;

      let refText = "";
      if (selectedPatient?.nombre) {
        refText += `Paciente: ${selectedPatient.nombre}`;
      }
      if (form.descripcion?.trim()) {
        refText += (refText ? " | " : "") + form.descripcion.trim();
      }
      if (selectedFactura?.numero || selectedFactura?.numeroFactura) {
        refText += (refText ? " | " : "") + `Factura: ${selectedFactura.numero || selectedFactura.numeroFactura}`;
      }

      // 2. Registrar en movimientos_caja (gaveta interna de la caja)
      const movData = {
        tenant_id: inquilino,
        caja_id: caja.id,
        usuario_id: userProfile?.uid || userProfile?.id || null,
        tipo,
        concepto: `${docLabel}${form.concepto}`,
        monto: montoNum,
        metodo_pago: form.metodoPago || "Efectivo",
        referencia: refText || null,
        created_at: new Date().toISOString()
      };

      const { error: insertErr } = await supabase.from("movimientos_caja").insert([movData]);
      if (insertErr) throw insertErr;

      // 3. Actualizar saldo_actual, ingresos/egresos y updated_at en caja
      try {
        const curSaldo = Number(caja.saldoActual ?? caja.saldo_actual ?? 0);
        const curIng = Number(caja.totalIngresos ?? caja.total_ingresos ?? 0);
        const curEg = Number(caja.totalEgresos ?? caja.total_egresos ?? 0);

        const newSal = tipo === "ingreso" ? curSaldo + montoNum : curSaldo - montoNum;
        const newIng = tipo === "ingreso" ? curIng + montoNum : curIng;
        const newEg = tipo === "egreso" ? curEg + montoNum : curEg;

        await supabase.from("cajas").update({
          saldo_actual: newSal,
          saldoActual: newSal,
          total_ingresos: newIng,
          totalIngresos: newIng,
          total_egresos: newEg,
          totalEgresos: newEg,
          updated_at: new Date().toISOString()
        }).eq("id", caja.id);
      } catch (e) {}

      // 4. SINCRONIZACIÓN AUTOMÁTICA SEGÚN TIPO:
      const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(str || ""));
      const currentUserName = userProfile?.nombreCompleto || userProfile?.nombre || userProfile?.email || "Cajero";

      if (tipo === "ingreso") {
        // A. Sincronizar en Facturación -> Recibos de Caja (recibos_caja)
        const pacNombreFinal = selectedPatient?.nombre || "Cliente Particular / Venta Mostrador";
        const newRecId = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : null;
        const reciboPayload = {
          id: newRecId,
          tenant_id: inquilino,
          inquilino: inquilino,
          numero: finalConsStr,
          nro_consecutivo: finalConsStr,
          nroConsecutivo: finalConsStr,
          fecha: new Date().toISOString(),
          paciente_id: isUUID(selectedPatient?.id) ? selectedPatient.id : null,
          pacienteId: isUUID(selectedPatient?.id) ? selectedPatient.id : null,
          paciente_nombre: pacNombreFinal,
          pacienteNombre: pacNombreFinal,
          pacienteDocumento: selectedPatient?.cedula || "",
          pacienteTelefono: selectedPatient?.celular || "",
          condicion_pago: "Contado",
          condicionPago: "Contado",
          medio_pago: form.metodoPago || "Efectivo",
          medioPago: form.metodoPago || "Efectivo",
          concepto: form.concepto || "Ingreso de caja",
          conceptos: [{
            concepto: form.concepto || "Ingreso de caja",
            precioUnitario: montoNum,
            cantidad: 1,
            descuento: 0,
            total: montoNum
          }],
          monto: montoNum,
          subtotal: montoNum,
          total: montoNum,
          observaciones: form.descripcion ? `${form.concepto}: ${form.descripcion}` : form.concepto,
          caja_id: isUUID(caja.id) ? caja.id : null,
          cajaId: isUUID(caja.id) ? caja.id : null,
          creado_por: currentUserName,
          creadoPor: currentUserName,
          created_at: new Date().toISOString()
        };
        if (!reciboPayload.id) delete reciboPayload.id;

        try {
          await supabase.from("recibos_caja").insert([reciboPayload]);
        } catch (rErr) {
          console.warn("Aviso insertando en recibos_caja:", rErr);
        }

        // Respaldo en website_config (recibos_caja)
        try {
          const { getConfigSection, saveConfigSection } = await import("../../../services/configPersistenceService");
          const cfgRecibos = await getConfigSection(inquilino, "recibos_caja", []);
          const safeReciboId = reciboPayload.id || `rc_${Date.now()}`;
          await saveConfigSection(inquilino, "recibos_caja", [
            { ...reciboPayload, id: safeReciboId },
            ...(Array.isArray(cfgRecibos) ? cfgRecibos.filter(r => r.id !== safeReciboId) : [])
          ]);
        } catch (e) {}

        // B. Si hay paciente seleccionado, sincronizar en ficha del paciente -> Histórico de Pagos (pagos)
        if (selectedPatient?.id) {
          try {
            const pagoPacientePayload = {
              tenant_id: inquilino,
              fecha: new Date().toISOString(),
              paciente_id: selectedPatient.id,
              monto: montoNum,
              metodo: form.metodoPago || "Efectivo",
              referencia: form.descripcion 
                ? `[RC-${finalConsStr.padStart(4, "0")}] ${form.concepto} - ${form.descripcion}`
                : `[RC-${finalConsStr.padStart(4, "0")}] ${form.concepto}`,
              nro_consecutivo: finalConsStr,
              notas: JSON.stringify({
                concepto: form.concepto,
                referencia: form.descripcion || "",
                nroConsecutivo: finalConsStr,
                registradoPor: currentUserName,
                usuarioNombre: currentUserName,
                medio: form.metodoPago || "Efectivo",
                cajaId: caja.id,
                facturaId: selectedFactura?.id || null
              }),
              created_at: new Date().toISOString()
            };
            await supabase.from("pagos").insert([pagoPacientePayload]);
          } catch (pErr) {
            console.warn("Aviso insertando en pagos del paciente:", pErr);
          }
        }

        // C. Si tiene factura vinculada, actualizar saldo de la factura
        if (selectedFactura?.id) {
          try {
            const pagado = (selectedFactura.montoPagado || 0) + montoNum;
            const total = selectedFactura.monto || selectedFactura.total || 0;
            const nuevoEstado = pagado >= total ? "Pagada" : "Parcial";
            await supabase.from("facturas").update({
              montoPagado: pagado,
              saldoPendiente: Math.max(0, total - pagado),
              estado: nuevoEstado,
              ultimoPagoFecha: new Date().toISOString(),
              ultimoPagoCaja: caja.id,
              updated_at: new Date().toISOString()
            }).eq("id", selectedFactura.id);
          } catch (e) {}
        }
      } else {
        // EGRESO: Sincronizar en Administración -> Facturación -> Pagos (pagos_proveedor)
        const egresoRecord = {
          id: `pago_${Date.now()}`,
          tenant_id: inquilino,
          fecha: new Date().toISOString().split("T")[0],
          numero: finalConsStr,
          consecutivo: finalConsStr,
          nroConsecutivo: finalConsStr,
          bancoCaja: caja.nombre || "Caja Principal",
          medioPago: form.metodoPago || "Efectivo",
          terceroId: "caja_menor",
          tercero: "Caja Menor / Gastos Varios",
          proveedor: "Caja Menor / Gastos Varios",
          documentoTercero: "",
          tipoTercero: "tercero",
          items: [{
            concepto: form.concepto || "Gasto de caja",
            descripcion: form.descripcion || "",
            total: montoNum,
            precioUnitario: montoNum
          }],
          concepto: form.concepto || "Gasto de caja",
          monto: montoNum,
          total: montoNum,
          observaciones: form.descripcion ? `Egreso caja menor: ${form.descripcion}` : `Egreso de caja ${caja.nombre || ""}`,
          created_at: new Date().toISOString(),
          created_by: userProfile?.uid || userProfile?.id || null
        };

        try {
          await supabase.from("pagos_proveedor").insert([egresoRecord]);
        } catch (e) {
          console.warn("Aviso insertando en pagos_proveedor:", e);
        }

        // Respaldo en website_config (pagos_proveedor)
        try {
          const { getConfigSection, saveConfigSection } = await import("../../../services/configPersistenceService");
          const currPagos = await getConfigSection(inquilino, "pagos_proveedor", []);
          await saveConfigSection(inquilino, "pagos_proveedor", [
            egresoRecord,
            ...(Array.isArray(currPagos) ? currPagos : [])
          ]);
        } catch (e) {}
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

          {confirmEgresoDescubierto && (
            <div style={{
              background: "#fffbeb",
              border: "1.5px solid #fde68a",
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 16,
            }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{ fontSize: 18 }}>⚠️</span>
                <div style={{ fontSize: 12, color: "#92400e" }}>
                  <div style={{ fontWeight: 800, marginBottom: 4, fontSize: 13 }}>
                    Dinero insuficiente en caja
                  </div>
                  <div>
                    El dinero disponible en la caja ({fmt(caja.saldoActual ?? caja.saldo_actual ?? 0)}) no es suficiente para realizar este pago de {fmt(montoNum)}. El saldo en caja quedará en negativo ({fmt(nuevoSaldo)}).
                  </div>
                  <div style={{ marginTop: 6, fontWeight: 700 }}>
                    ¿Desea confirmar y registrar el pago de todos modos?
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setConfirmEgresoDescubierto(false)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    color: "#475569"
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: "none",
                    background: "#dc2626",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    color: "#fff"
                  }}
                >
                  Sí, confirmar y realizar pago
                </button>
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
                height: 36, padding: "0 20px", borderRadius: 8, border: "none",
                background: tipo === "ingreso" ? "#8cc33f" : "#f43f5e",
                color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer",
                boxShadow: "none",
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

