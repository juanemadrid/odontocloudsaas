// src/modules/odontograma/components/FirmaHuellaModal.jsx
import React, { useRef, useState, useEffect, useCallback } from "react";
import { FiX, FiCheckCircle, FiSend } from "react-icons/fi";

// ── Canvas de firma dibujable ──
function SignatureCanvas({ onClear, canvasRef }) {
    const isDrawing = useRef(false);
    const lastPos = useRef(null);

    const getPos = (e, canvas) => {
        const rect = canvas.getBoundingClientRect();
        const src = e.touches ? e.touches[0] : e;
        return { x: src.clientX - rect.left, y: src.clientY - rect.top };
    };

    const startDraw = (e) => {
        e.preventDefault();
        isDrawing.current = true;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const pos = getPos(e, canvas);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        lastPos.current = pos;
    };

    const draw = (e) => {
        e.preventDefault();
        if (!isDrawing.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const pos = getPos(e, canvas);
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#1e293b";
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        lastPos.current = pos;
    };

    const endDraw = () => { isDrawing.current = false; };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (onClear) onClear();
    };

    return (
        <div>
            <canvas
                ref={canvasRef}
                width={440}
                height={130}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
                style={{
                    width: "100%", height: "130px",
                    border: "1.5px solid #e2e8f0", borderRadius: "12px",
                    background: "#fffef7", cursor: "crosshair", display: "block",
                    touchAction: "none",
                }}
            />
            <button
                onClick={clearCanvas}
                style={{
                    marginTop: "6px", padding: "4px 14px", borderRadius: "20px", border: "none",
                    background: "#fecdd3", color: "#be123c", fontSize: "10px", fontWeight: 800,
                    cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em",
                }}
            >
                Borrar Firma
            </button>
        </div>
    );
}

// ── Uploader de huella ──
function HuellaUploader({ imagen, onImagen, onBorrar }) {
    const fileRef = useRef();

    return (
        <div>
            <div
                onClick={() => fileRef.current.click()}
                style={{
                    width: "100%", height: "110px", border: "1.5px solid #e2e8f0",
                    borderRadius: "12px", background: "#f8fafc",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", overflow: "hidden", position: "relative",
                }}
            >
                {imagen ? (
                    <img src={imagen} alt="Huella" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                ) : (
                    <div style={{ textAlign: "center", color: "#cbd5e1" }}>
                        <div style={{ fontSize: "32px", marginBottom: "4px" }}>👆</div>
                        <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            Clic para agregar
                        </div>
                    </div>
                )}
            </div>
            <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={e => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => onImagen(ev.target.result);
                    reader.readAsDataURL(file);
                }}
            />
            <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                <button
                    onClick={onBorrar}
                    style={{ padding: "4px 12px", borderRadius: "20px", border: "none", background: "#fecdd3", color: "#be123c", fontSize: "10px", fontWeight: 800, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em" }}
                >
                    Borrar Huella
                </button>
                <button
                    onClick={() => fileRef.current.click()}
                    style={{ padding: "4px 12px", borderRadius: "20px", border: "none", background: "#bbf7d0", color: "#15803d", fontSize: "10px", fontWeight: 800, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em" }}
                >
                    Agregar Huella
                </button>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════
//  MODAL PRINCIPAL — Firma Paciente
// ══════════════════════════════════════════════════════════
export default function FirmaHuellaModal({ sesion, paciente, planTratamiento = [], onClose, onGuardar }) {
    const firmaRef = useRef(null);
    const [huellaImg, setHuellaImg] = useState(sesion?.huellaUrl || null);
    const [saving, setSaving] = useState(false);

    const handleGuardar = async () => {
        setSaving(true);
        try {
            const firmaDataUrl = firmaRef.current
                ? firmaRef.current.toDataURL("image/png")
                : null;
            await onGuardar?.({ firmaDataUrl, huellaImg });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 300,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(15,23,42,0.65)", backdropFilter: "blur(6px)",
        }}>
            <div style={{
                background: "white", borderRadius: "16px", width: "100%", maxWidth: "680px",
                maxHeight: "90vh", overflowY: "auto", margin: "16px",
                boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
            }}>
                {/* ── HEADER ── */}
                <div style={{ padding: "16px 24px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#1e293b", margin: 0 }}>Firma paciente</h2>
                    <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "4px" }}>
                        <FiX size={20} />
                    </button>
                </div>

                {/* ── DOCUMENTO PREVIEW ── */}
                <div style={{ margin: "16px 24px", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
                    {/* Doc header */}
                    <div style={{ background: "#f8fafc", padding: "12px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "40px", height: "40px", background: "#4f46e5", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "11px", fontWeight: 900 }}>
                            OC
                        </div>
                        <div>
                            <div style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>OdontoCloud Elite</div>
                            <div style={{ fontSize: "10px", color: "#64748b" }}>Registro de Odontograma Clínico</div>
                        </div>
                    </div>

                    {/* Patient info table */}
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                        <tbody>
                            <tr style={{ background: "#f8fafc" }}>
                                <td style={{ padding: "6px 10px", fontWeight: 700, color: "#475569", borderRight: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9", width: "140px" }}>Nombre del paciente</td>
                                <td style={{ padding: "6px 10px", color: "#1e293b", borderRight: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>{paciente?.nombreCompleto || "—"}</td>
                                <td style={{ padding: "6px 10px", fontWeight: 700, color: "#475569", borderRight: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9", width: "80px" }}>Edad</td>
                                <td style={{ padding: "6px 10px", color: "#1e293b", borderBottom: "1px solid #f1f5f9" }}>{paciente?.edad || "—"}</td>
                            </tr>
                            <tr>
                                <td style={{ padding: "6px 10px", fontWeight: 700, color: "#475569", borderRight: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>Tipo documento</td>
                                <td style={{ padding: "6px 10px", color: "#1e293b", borderRight: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>{paciente?.tipoDocumento || "Cédula"}</td>
                                <td style={{ padding: "6px 10px", fontWeight: 700, color: "#475569", borderRight: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>No. Documento</td>
                                <td style={{ padding: "6px 10px", color: "#1e293b", borderBottom: "1px solid #f1f5f9" }}>{paciente?.numeroDocumento || "—"}</td>
                            </tr>
                            <tr style={{ background: "#f8fafc" }}>
                                <td style={{ padding: "6px 10px", fontWeight: 700, color: "#475569", borderRight: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>Correo</td>
                                <td style={{ padding: "6px 10px", color: "#1e293b", borderRight: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>{paciente?.email || "—"}</td>
                                <td style={{ padding: "6px 10px", fontWeight: 700, color: "#475569", borderRight: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>Profesional</td>
                                <td style={{ padding: "6px 10px", color: "#1e293b", borderBottom: "1px solid #f1f5f9" }}>{sesion?.profesional || "—"}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Odontograma section */}
                    <div style={{ padding: "10px 16px 0", borderTop: "2px solid #f1f5f9" }}>
                        <div style={{ textAlign: "center", fontWeight: 700, fontSize: "13px", color: "#1e293b", padding: "8px 0", borderBottom: "1px solid #f1f5f9", marginBottom: "0" }}>
                            Odontograma
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
                            <thead>
                                <tr style={{ background: "#f8fafc" }}>
                                    {["Fecha de creación", "Doctor", "Pieza", "Situación", "Cara afectada"].map(col => (
                                        <th key={col} style={{ padding: "6px 8px", fontWeight: 700, color: "#64748b", borderBottom: "1px solid #f1f5f9", textAlign: "left" }}>{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {planTratamiento.length === 0 ? (
                                    <tr><td colSpan={5} style={{ padding: "12px 8px", color: "#94a3b8", fontSize: "10px", textAlign: "center" }}>Sin registros de tratamiento</td></tr>
                                ) : planTratamiento.slice(0, 8).map((item, i) => (
                                    <tr key={i} style={{ background: i % 2 === 0 ? "white" : "#f8fafc" }}>
                                        <td style={{ padding: "5px 8px", color: "#334155" }}>
                                            {item.fechaISO ? new Date(item.fechaISO).toLocaleDateString('es-ES') : "—"}
                                        </td>
                                        <td style={{ padding: "5px 8px", color: "#334155" }}>{sesion?.profesional || "—"}</td>
                                        <td style={{ padding: "5px 8px", color: "#334155" }}>{item.diente}</td>
                                        <td style={{ padding: "5px 8px", color: "#334155" }}>{item.tratamiento}</td>
                                        <td style={{ padding: "5px 8px", color: "#334155" }}>{item.zonaLabel || item.zona}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ── FIRMA + HUELLA ── */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", padding: "0 24px 16px" }}>
                    <div>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "8px" }}>Firma paciente</div>
                        <SignatureCanvas canvasRef={firmaRef} />
                    </div>
                    <div>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#475569", marginBottom: "8px" }}>Huella digital</div>
                        <HuellaUploader
                            imagen={huellaImg}
                            onImagen={setHuellaImg}
                            onBorrar={() => setHuellaImg(null)}
                        />
                    </div>
                </div>

                {/* ── FOOTER BOTONES ── */}
                <div style={{ padding: "12px 24px 20px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                    <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "white", color: "#64748b", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
                        Cerrar
                    </button>
                    <button
                        onClick={handleGuardar}
                        style={{ padding: "8px 18px", borderRadius: "8px", border: "none", background: "#3b82f6", color: "white", fontSize: "11px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                    >
                        <FiSend size={13} /> Enviar
                    </button>
                    <button
                        onClick={handleGuardar}
                        disabled={saving}
                        style={{ padding: "8px 18px", borderRadius: "8px", border: "none", background: "#22c55e", color: "white", fontSize: "11px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px" }}
                    >
                        <FiCheckCircle size={13} /> {saving ? "Guardando..." : "Guardar"}
                    </button>
                </div>
            </div>
        </div>
    );
}
