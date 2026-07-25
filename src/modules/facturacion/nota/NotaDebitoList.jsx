import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FiPlus, FiCalendar, FiSearch, FiPrinter, FiEye, FiTrash2, FiX } from "react-icons/fi";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { useAuth } from "../../../context/AuthContext";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const fmtDate = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
};

export default function NotaDebitoList({ onNew }) {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || "";

    const [loading, setLoading] = useState(true);
    const [notas, setNotas] = useState([]);
    
    // Toggles and filters
    const [detalleMovimientos, setDetalleMovimientos] = useState(false);
    const [conSaldo, setConSaldo] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [fechaInicio, setFechaInicio] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);

    // View Modal
    const [viewModal, setViewModal] = useState({ open: false, nota: null });
    
    // Void Modal
    const [voidModal, setVoidModal] = useState({ open: false, nota: null });
    const [voidReason, setVoidReason] = useState("");
    const [voidUser, setVoidUser] = useState("");

    useEffect(() => {
        if (userProfile) {
            setVoidUser(userProfile.nombreCompleto || userProfile.nombre || userProfile.email || "");
        }
    }, [userProfile]);

    const parseLocalDate = (dateStr) => {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    const loadData = useCallback(async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            const start = parseLocalDate(fechaInicio);
            start.setHours(0, 0, 0, 0);
            const end = parseLocalDate(fechaFin);
            end.setHours(23, 59, 59, 999);

            const q = query(
                collection(db, "notas_debito"),
                where("inquilino", "==", inquilino)
            );
            const snap = await getDocs(q);
            const list = snap.docs.map(doc => {
                const data = doc.data();
                const ts = data.fecha;
                const dObj = ts?.toDate ? ts.toDate() : new Date(ts);
                return {
                    id: doc.id,
                    ...data,
                    fechaObj: dObj
                };
            });

            // Filter locally by date range
            const filtered = list.filter(item => {
                return item.fechaObj >= start && item.fechaObj <= end;
            });

            // Sort by date desc
            filtered.sort((a, b) => b.fechaObj - a.fechaObj);

            setNotas(filtered);
        } catch (e) {
            console.error("Error loading debit notes:", e);
        } finally {
            setLoading(false);
        }
    }, [inquilino, fechaInicio, fechaFin]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredNotas = useMemo(() => {
        return notas.filter(n => {
            // Search filter
            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase();
                const matchesName = (n.pacienteNombre || "").toLowerCase().includes(q);
                const matchesDoc = (n.nroConsecutivo || "").toLowerCase().includes(q);
                const matchesNotes = (n.notas || "").toLowerCase().includes(q);
                if (!matchesName && !matchesDoc && !matchesNotes) return false;
            }

            return true;
        });
    }, [notas, searchTerm]);

    const handlePrint = (nota) => {
        const printWindow = window.open("", "_blank");
        const dateStr = fmtDate(nota.fecha);
        const totalStr = fmt(nota.total);
        const ticketNum = nota.nroConsecutivo || nota.id.slice(0, 8).toUpperCase();
        const isAnulado = nota.estado === "Anulado";

        const logoUrl = userProfile?.tenant?.logo || "";
        const clinicName = userProfile?.tenant?.nombreComercial || userProfile?.tenant?.nombre || userProfile?.tenant?.name || "Clínica Dental";
        const clinicNit = userProfile?.tenant?.nit || "—";
        const clinicAddress = userProfile?.tenant?.direccion || "—";
        const clinicPhone = userProfile?.tenant?.telefono || "—";
        const clinicEmail = userProfile?.tenant?.email || "";
        
        const anulStamp = isAnulado ? `
            <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:90px;font-weight:900;color:rgba(239,68,68,0.13);text-transform:uppercase;letter-spacing:6px;pointer-events:none;z-index:9999;white-space:nowrap;">ANULADO</div>` : "";
        const anulBanner = isAnulado ? `
            <div style="background:#fef2f2;border:2px solid #fca5a5;border-radius:12px;padding:14px 20px;margin-bottom:24px;display:flex;align-items:flex-start;gap:12px;z-index:10;position:relative;">
                <span style="font-size:22px;">🚫</span>
                <div>
                    <div style="font-size:13px;font-weight:900;color:#dc2626;text-transform:uppercase;letter-spacing:1px;">Nota de Débito Anulada</div>
                    ${nota.motivoAnulacion ? `<div style="font-size:12px;color:#7f1d1d;margin-top:4px;"><strong>Motivo:</strong> ${nota.motivoAnulacion}</div>` : ""}
                    ${nota.anuladoPor ? `<div style="font-size:11px;color:#991b1b;margin-top:2px;"><strong>Anulado por:</strong> ${nota.anuladoPor}</div>` : ""}
                    ${nota.fechaAnulacion ? `<div style="font-size:11px;color:#991b1b;margin-top:2px;"><strong>Fecha anulación:</strong> ${new Date(nota.fechaAnulacion).toLocaleString("es-CO")}</div>` : ""}
                </div>
            </div>` : "";

        let conceptsHtml = "";
        if (nota.conceptos && nota.conceptos.length > 0) {
            nota.conceptos.forEach(c => {
                conceptsHtml += `
                    <tr>
                        <td style="padding: 12px 15px; border-bottom: 1px solid #f1f5f9;"><strong>${c.concepto}</strong>${c.descripcion ? `<br><small style="color: #64748b; font-weight: normal;">${c.descripcion}</small>` : ""}</td>
                        <td style="padding: 12px 15px; border-bottom: 1px solid #f1f5f9; text-align: center; font-weight: bold;">${c.cantidad}</td>
                        <td style="padding: 12px 15px; border-bottom: 1px solid #f1f5f9; text-align: right;">${fmt(c.precioUnitario)}</td>
                        <td style="padding: 12px 15px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: bold; color: #0f172a;">${fmt(c.total || (c.precioUnitario * c.cantidad))}</td>
                    </tr>
                `;
            });
        }

        printWindow.document.write(`
            <html>
                <head>
                    <title>Nota de Débito #${ticketNum}${isAnulado ? ' [ANULADO]' : ''}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
                        body { 
                            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
                            color: #1e293b; 
                            padding: 30px; 
                            line-height: 1.5; 
                            position: relative;
                            max-width: 850px;
                            margin: 0 auto;
                        }
                        .header {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            border-bottom: 4px solid #2563eb;
                            padding-bottom: 25px;
                            margin-bottom: 30px;
                            gap: 20px;
                        }
                        .logo-container {
                            display: flex;
                            gap: 25px;
                            align-items: center;
                        }
                        .logo-text-placeholder {
                            width: 80px;
                            height: 80px;
                            background: #2563eb;
                            border-radius: 16px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: white;
                            font-size: 36px;
                            font-weight: 900;
                            text-transform: uppercase;
                        }
                        .clinic-title {
                            margin: 0;
                            font-size: 24px;
                            font-weight: 900;
                            color: #0f172a;
                            text-transform: uppercase;
                            letter-spacing: -1px;
                        }
                        .clinic-meta {
                            margin: 2px 0;
                            font-size: 12px;
                            color: #64748b;
                            font-weight: 500;
                        }
                        .doc-info {
                            text-align: right;
                        }
                        .doc-badge {
                            background: #fff7ed;
                            padding: 12px 20px;
                            border-radius: 16px;
                            border: 2px solid #ffedd5;
                            margin-bottom: 8px;
                            display: inline-block;
                        }
                        .doc-badge span {
                            font-size: 16px;
                            font-weight: 900;
                            color: #f97316;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                        }
                        .doc-meta {
                            margin: 0;
                            font-size: 11px;
                            color: #94a3b8;
                            font-weight: 900;
                            text-transform: uppercase;
                        }
                        .patient-card {
                            background: #f8fafc;
                            border: 1px solid #e2e8f0;
                            border-radius: 16px;
                            padding: 20px;
                            margin-bottom: 25px;
                            display: grid;
                            grid-template-columns: 1.2fr 1fr;
                            gap: 20px;
                        }
                        .table-container {
                            margin-bottom: 30px;
                        }
                        .table { 
                            border-collapse: collapse; 
                            width: 100%; 
                            border-radius: 16px;
                            overflow: hidden;
                            border-style: hidden;
                            box-shadow: 0 0 0 1px #cbd5e1;
                        }
                        .table th { 
                            background: #2563eb; 
                            color: white;
                            padding: 12px 15px; 
                            font-size: 11px; 
                            font-weight: 900; 
                            text-transform: uppercase; 
                            letter-spacing: 1px; 
                            text-align: left; 
                        }
                        .total-card-container {
                            display: flex;
                            justify-content: space-between;
                            gap: 40px;
                            margin-bottom: 50px;
                            align-items: flex-start;
                        }
                        .observations-box {
                            flex: 1;
                            border: 1px dashed #cbd5e1;
                            border-radius: 20px;
                            padding: 20px;
                            background-color: #f8fafc;
                            font-size: 11px;
                            line-height: 1.6;
                        }
                        .totals-box {
                            width: 280px;
                            display: flex;
                            flex-direction: column;
                            gap: 6px;
                        }
                        .footer { 
                            margin-top: 80px; 
                            text-align: center; 
                            font-size: 9px; 
                            color: #cbd5e1; 
                            border-top: 1px solid #f1f5f9; 
                            padding-top: 20px;
                            text-transform: uppercase;
                            letter-spacing: 4px;
                        }
                        .signatures-block {
                            margin-top: 80px;
                            display: flex;
                            justify-content: space-between;
                            gap: 80px;
                            padding: 0 30px;
                        }
                    </style>
                </head>
                <body>
                    ${anulStamp}
                    <div class="header">
                        <div class="logo-container">
                            ${logoUrl 
                                ? `<img src="${logoUrl}" style="max-height: 75px; max-width: 150px; object-fit: contain;" />`
                                : `<div class="logo-text-placeholder">${clinicName.substring(0, 1) || "O"}</div>`
                            }
                            <div>
                                <h1 class="clinic-title">${clinicName}</h1>
                                <p class="clinic-meta" style="font-weight: 800;">NIT: ${clinicNit}</p>
                                <p class="clinic-meta">${clinicAddress}</p>
                                <p class="clinic-meta">TEL: ${clinicPhone} | ${clinicEmail}</p>
                            </div>
                        </div>
                        <div class="doc-info">
                            <div class="doc-badge" style="${isAnulado ? 'background:#fef2f2; border-color:#fca5a5;' : ''}">
                                <span style="${isAnulado ? 'color:#dc2626;' : ''}">Nota de Débito</span>
                            </div>
                            <p class="doc-meta">FECHA EMISIÓN: ${dateStr}</p>
                            <p class="doc-meta" style="margin-top: 4px; font-family: monospace; font-size: 12px;">NRO: ${ticketNum}</p>
                        </div>
                    </div>

                    ${anulBanner}

                    <div class="patient-card">
                        <div style="border-right: 1px solid #cbd5e1; padding-right: 20px;">
                            <span style="font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 6px;">Información del Paciente</span>
                            <h2 style="margin: 0; font-size: 15px; font-weight: 900; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px;">${nota.pacienteNombre}</h2>
                            <div style="display: grid; grid-template-columns: 1fr; gap: 4px; margin-top: 10px; font-size: 11px;">
                                <p style="margin: 0; color: #64748b; font-weight: 600;"><strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">ID / DOC:</strong> ${nota.pacienteDocumento || "—"}</p>
                            </div>
                        </div>
                        <div style="padding-left: 10px;">
                            <span style="font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; display: block; margin-bottom: 6px;">Detalles de la Nota</span>
                            <div style="display: grid; grid-template-columns: 1fr; gap: 6px; margin-top: 8px; font-size: 11px;">
                                <p style="margin: 0; color: #64748b; font-weight: 600;">
                                    <strong style="color: #94a3b8; font-size: 9px; text-transform: uppercase; margin-right: 5px;">SALDO EN CONTRA GENERADO:</strong> 
                                    <strong style="text-transform: uppercase; color: #dc2626;">SÍ (${fmt(nota.total)})</strong>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div class="table-container">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th style="padding: 12px 15px;">Concepto</th>
                                    <th style="text-align: center; padding: 12px 15px; width: 70px;">Cant.</th>
                                    <th style="text-align: right; padding: 12px 15px; width: 120px;">P. Unitario</th>
                                    <th style="text-align: right; padding: 12px 15px; width: 130px;">Total</th>
                                </tr>
                            </thead>
                            <tbody style="font-size: 12px; color: #334155; font-weight: 600;">
                                ${conceptsHtml}
                            </tbody>
                        </table>
                    </div>

                    <div class="total-card-container">
                        <div class="observations-box">
                            <span style="font-weight: 900; color: #475569; text-transform: uppercase; font-size: 9px; display: block; margin-bottom: 8px;">Notas y Observaciones:</span>
                            <div style="font-weight: 500; color: #334155; white-space: pre-wrap;">${nota.notas || "Sin observaciones adicionales."}</div>
                        </div>
                        <div class="totals-box">
                            <div style="height: 2px; background: #f97316; margin: 6px 0;"></div>
                            <div style="display: flex; justify-content: space-between; align-items: center; background: #f97316; color: white; padding: 12px 18px; border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(249,115,22,0.2);">
                                <span style="font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px;">VALOR NOTA DÉBITO</span>
                                <span style="font-size: 18px; font-weight: 900;">${totalStr}</span>
                            </div>
                        </div>
                    </div>

                    <div class="signatures-block">
                        <div style="flex: 1; border-top: 1px solid #cbd5e1; padding-top: 15px; text-align: center; font-size: 11px;">
                            <p style="margin: 0; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 1px;">Autorizado por</p>
                            <p style="margin: 4px 0; color: #94a3b8; font-weight: 700; text-transform: uppercase; font-size: 9px;">Administrador / Auditor</p>
                        </div>
                        <div style="flex: 1; border-top: 1px solid #cbd5e1; padding-top: 15px; text-align: center; font-size: 11px;">
                            <p style="margin: 0; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 1px;">Recibido por el Paciente</p>
                            <p style="margin: 4px 0; color: #94a3b8; font-weight: 700; text-transform: uppercase; font-size: 9px;">Firma y Cédula</p>
                        </div>
                    </div>

                    <div class="footer">
                        Documento oficial generado por OdontoCloud Elite Pro
                    </div>

                    <script>
                        window.onload = function() { window.print(); window.close(); }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleConfirmVoid = async () => {
        if (!voidReason.trim()) {
            alert("El motivo de la anulación es obligatorio");
            return;
        }

        try {
            const nota = voidModal.nota;

            // Update Nota de Débito status to voided
            await updateDoc(doc(db, "notas_debito", nota.id), {
                estado: "Anulado",
                motivoAnulacion: voidReason.trim(),
                anuladoPor: voidUser.trim(),
                fechaAnulacion: new Date().toISOString()
            });

            await loadData();
            setVoidModal({ open: false, nota: null });
        } catch (e) {
            console.error("Error voiding debit note:", e);
            alert("Error al anular la nota de débito");
        }
    };

    return (
        <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold">
                            <span>🏠</span>
                            <span>-</span>
                            <span>Administración</span>
                            <span>-</span>
                            <span>Nota débito</span>
                        </div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight leading-none mt-1">
                            Nota débito
                        </h2>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onNew}
                        className="h-10 px-8 flex items-center justify-center bg-[#8cc33f] text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-[#7db02b] shadow-lg shadow-[#8cc33f]/20 transition-all active:scale-95"
                    >
                        + Nueva nota débito
                    </button>
                </div>
            </div>

            {/* Filter Bar — unified single card */}
            <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                    <div className="space-y-1.5 lg:col-span-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Buscar paciente o nota...</label>
                        <div className="relative">
                            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="text"
                                placeholder="Nombre o consecutivo..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-11 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 transition-all"
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Inicio</label>
                        <div className="relative">
                            <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="date"
                                value={fechaInicio}
                                onChange={(e) => setFechaInicio(e.target.value)}
                                className="w-full h-11 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 transition-all"
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha Fin</label>
                        <div className="relative">
                            <FiCalendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input
                                type="date"
                                value={fechaFin}
                                onChange={(e) => setFechaFin(e.target.value)}
                                className="w-full h-11 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:bg-white focus:border-blue-500 transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={loadData}
                            className="w-full h-11 flex items-center justify-center gap-2 bg-[#8cc33f] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#7db02b] transition-all active:scale-95 shadow"
                        >
                            <FiSearch size={14} /> Buscar
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-20 text-center flex flex-col items-center justify-center gap-4">
                        <div className="w-10 h-10 border-4 border-rose-500/20 border-t-orange-500 rounded-full animate-spin" />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Cargando Notas de Débito...</p>
                    </div>
                ) : filteredNotas.length === 0 ? (
                    <div className="p-20 text-center flex flex-col items-center justify-center gap-2">
                        <span className="text-4xl">🗒️</span>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-2">No se encontraron notas de débito.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50 border-b border-slate-100">
                                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nota débito</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Paciente/Tercero</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor total</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Saldo a favor</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Notas</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estado</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Nota C. compens.</th>
                                    <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredNotas.map((n) => (
                                    <tr key={n.id} className="hover:bg-slate-50/30 transition-colors">
                                        <td className="py-4 px-6 text-xs font-bold text-slate-500 whitespace-nowrap">
                                            {fmtDate(n.fecha)}
                                        </td>
                                        <td className="py-4 px-6 text-xs font-extrabold text-orange-500 uppercase whitespace-nowrap">
                                            #{n.nroConsecutivo || n.id.slice(0, 8).toUpperCase()}
                                        </td>
                                        <td className="py-4 px-6 text-xs font-black text-slate-700">
                                            {n.pacienteNombre}
                                        </td>
                                        <td className="py-4 px-6 text-xs font-black text-slate-700 text-right whitespace-nowrap">
                                            {fmt(n.total)}
                                        </td>
                                        <td className="py-4 px-6 text-xs font-bold text-slate-400 text-right whitespace-nowrap">
                                            $0
                                        </td>
                                        <td className="py-4 px-6 text-xs text-slate-400 max-w-[200px] truncate" title={n.notas}>
                                            {n.notas || "—"}
                                        </td>
                                        <td className="py-4 px-6 text-center whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider leading-none ${
                                                n.estado === "Anulado" 
                                                    ? "bg-rose-50 text-rose-600 border border-rose-100" 
                                                    : "bg-orange-50 text-orange-600 border border-orange-100"
                                            }`}>
                                                {n.estado || "Activo"}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-xs text-slate-400 text-center font-bold">
                                            {n.notaCreditoCompensatoria || "—"}
                                        </td>
                                        <td className="py-4 px-6 text-center whitespace-nowrap">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => handlePrint(n)}
                                                    className="w-8 h-8 flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 text-emerald-600 hover:text-emerald-700 rounded-lg transition-all"
                                                    title="Imprimir nota débito"
                                                >
                                                    <FiPrinter size={14} />
                                                </button>
                                                <button
                                                    onClick={() => setViewModal({ open: true, nota: n })}
                                                    className="w-8 h-8 flex items-center justify-center bg-blue-50 hover:bg-blue-100 border border-blue-100 text-blue-600 hover:text-blue-700 rounded-lg transition-all"
                                                    title="Ver detalles"
                                                >
                                                    <FiEye size={14} />
                                                </button>
                                                {n.estado !== "Anulado" && (
                                                    <button
                                                        onClick={() => {
                                                            setVoidReason("");
                                                            setVoidModal({ open: true, nota: n });
                                                        }}
                                                        className="w-8 h-8 flex items-center justify-center bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 hover:text-rose-700 rounded-lg transition-all"
                                                        title="Anular"
                                                    >
                                                        <FiTrash2 size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* View Details Modal */}
            {viewModal.open && viewModal.nota && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[28px] border border-slate-100 shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em]">Detalle Nota de Débito</span>
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mt-1">
                                    #{viewModal.nota.nroConsecutivo || viewModal.nota.id.slice(0, 8).toUpperCase()}
                                </h3>
                            </div>
                            <button 
                                onClick={() => setViewModal({ open: false, nota: null })}
                                className="w-8 h-8 flex items-center justify-center hover:bg-slate-50 border border-transparent hover:border-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
                            >
                                <FiX size={18} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-6">
                            <div className="grid grid-cols-2 gap-6 text-xs">
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Paciente/Tercero</span>
                                    <strong className="text-slate-700 text-sm block">{viewModal.nota.pacienteNombre}</strong>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Fecha</span>
                                    <strong className="text-slate-700 text-sm block">{fmtDate(viewModal.nota.fecha)}</strong>
                                </div>
                            </div>

                            <div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-2">Conceptos Detallados</span>
                                <div className="border border-slate-100 rounded-2xl overflow-hidden">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50">
                                                <th className="p-3 text-[10px] font-black text-slate-400 uppercase">Concepto</th>
                                                <th className="p-3 text-[10px] font-black text-slate-400 uppercase text-center">Cant</th>
                                                <th className="p-3 text-[10px] font-black text-slate-400 uppercase text-right">Precio Unit.</th>
                                                <th className="p-3 text-[10px] font-black text-slate-400 uppercase text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {viewModal.nota.conceptos?.map((c, i) => (
                                                <tr key={i} className="hover:bg-slate-50/50">
                                                    <td className="p-3 text-slate-700 font-bold">
                                                        {c.concepto}
                                                        {c.descripcion && <span className="block text-[10px] text-slate-400 font-normal">{c.descripcion}</span>}
                                                    </td>
                                                    <td className="p-3 text-slate-500 text-center font-bold">{c.cantidad}</td>
                                                    <td className="p-3 text-slate-500 text-right font-bold">{fmt(c.precioUnitario)}</td>
                                                    <td className="p-3 text-slate-700 text-right font-black">{fmt(c.total || (c.precioUnitario * c.cantidad))}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6 text-xs bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Saldo en contra generado</span>
                                    <strong className="text-slate-700 text-sm block">Sí (Aumento de Deuda)</strong>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Valor Total</span>
                                    <strong className="text-orange-500 text-lg font-black block">{fmt(viewModal.nota.total)}</strong>
                                </div>
                            </div>

                            {viewModal.nota.notaCreditoCompensatoria && (
                                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs space-y-1">
                                    <strong className="text-emerald-600 uppercase tracking-wider text-[10px] block">Nota de Crédito Compensatoria:</strong>
                                    <p className="text-emerald-800 font-bold">#{viewModal.nota.notaCreditoCompensatoria}</p>
                                </div>
                            )}

                            {viewModal.nota.notas && (
                                <div className="text-xs">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Observaciones</span>
                                    <p className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-slate-600 font-bold italic leading-relaxed">
                                        "{viewModal.nota.notas}"
                                    </p>
                                </div>
                            )}

                            {viewModal.nota.estado === "Anulado" && (
                                <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-xs space-y-1">
                                    <strong className="text-rose-600 uppercase tracking-wider text-[10px] block">Motivo de Anulación:</strong>
                                    <p className="text-rose-800 font-bold">"{viewModal.nota.motivoAnulacion || "—"}"</p>
                                    <div className="flex gap-4 text-[10px] text-rose-500 font-medium pt-1">
                                        <span>Por: {viewModal.nota.anuladoPor || "—"}</span>
                                        <span>•</span>
                                        <span>Fecha: {viewModal.nota.fechaAnulacion ? new Date(viewModal.nota.fechaAnulacion).toLocaleString("es-CO") : "—"}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Void Confirmation Modal */}
            {voidModal.open && voidModal.nota && (
                <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[28px] border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <span className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em]">Confirmar Anulación</span>
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mt-1">
                                    Nota de Débito #{voidModal.nota.nroConsecutivo || voidModal.nota.id.slice(0, 8).toUpperCase()}
                                </h3>
                            </div>
                            <button 
                                onClick={() => setVoidModal({ open: false, nota: null })}
                                className="w-8 h-8 flex items-center justify-center hover:bg-slate-50 border border-transparent hover:border-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-all"
                            >
                                <FiX size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-xs font-bold text-slate-500 leading-relaxed">
                                ¿Estás seguro de que deseas anular esta Nota de Débito? Al anularla se restará este cargo del estado financiero del paciente. Esta acción no se puede deshacer.
                            </p>
                            
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Motivo de Anulación *</label>
                                <textarea
                                    required
                                    placeholder="Indique el motivo por el cual anula este documento..."
                                    value={voidReason}
                                    onChange={(e) => setVoidReason(e.target.value)}
                                    rows={3}
                                    className="w-full p-4 bg-slate-50 hover:bg-slate-50/80 border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all outline-none resize-none"
                                />
                            </div>
                        </div>
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setVoidModal({ open: false, nota: null })}
                                className="h-10 px-6 rounded-full text-xs font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 border border-slate-200 hover:bg-white transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmVoid}
                                disabled={!voidReason.trim()}
                                className="h-10 px-8 rounded-full text-xs font-black uppercase tracking-widest text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-lg shadow-rose-500/20"
                            >
                                Confirmar Anulación
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
