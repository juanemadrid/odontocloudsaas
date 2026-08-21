import React, { useState, useEffect, useMemo } from "react";
import { FiPlus, FiCalendar, FiSearch, FiPrinter, FiUser } from "react-icons/fi";
import { useNavigate } from "react-router-dom";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { ReceiptPrintService } from "../../../services/ReceiptPrintService";
import { buildDashboardPath } from "../../../utils/dashboardBasePath";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const formatDateOnly = (dObj) => {
  if (!dObj) return "—";
  try {
    const d = dObj.toDate ? dObj.toDate() : new Date(dObj);
    return d.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  } catch { return "—"; }
};

export const printHTMLInHiddenIframe = (html) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    iframe.contentWindow.focus();
    setTimeout(() => {
        iframe.contentWindow.print();
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 1000);
    }, 300);
};

export default function SaldoFavorList({ onNew }) {
    const navigate = useNavigate();
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino || userProfile?.tenant_id || userProfile?.tenantId || userProfile?.tenant?.inquilino || userProfile?.tenant?.id || "";

    const [loading, setLoading] = useState(true);
    const [pagos, setPagos] = useState([]);
    const [pacientes, setPacientes] = useState([]);

    // Toggles
    const [detalleMovimientos, setDetalleMovimientos] = useState(false);
    const [conSaldo, setConSaldo] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedPaciente, setSelectedPaciente] = useState(null);
    const [searchTermTercero, setSearchTermTercero] = useState("");
    const [showTerceroDropdown, setShowTerceroDropdown] = useState(false);

    useEffect(() => {
        const handleClickOutside = () => {
            setShowTerceroDropdown(false);
        };
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, []);

    const isNotAnulado = (p) => {
        const estadoStr = (p.estado || "").toLowerCase();
        const refStr = (p.referencia || "").toUpperCase();
        const notesStr = (p.notas || p.notes || "").toUpperCase();
        return estadoStr !== "anulado" && !refStr.includes("ANULADO") && !notesStr.includes("ANULADO");
    };

    const isCreditTopUp = (p) => {
        const ref = (p.referencia || p.concepto || "").toUpperCase();
        const notes = (p.notas || p.notes || "").toUpperCase();
        const method = (p.metodo || p.medio || "").toLowerCase();
        return method !== "saldo a favor" && (ref === "SALDO A FAVOR" || notes.includes("SALDO A FAVOR")) && isNotAnulado(p);
    };

    const isCreditUsed = (p) => {
        const m = (p.metodo || p.medio || "").toLowerCase();
        return m === "saldo a favor" && isNotAnulado(p);
    };

    const filteredTerceros = useMemo(() => {
        if (!searchTermTercero.trim()) return pacientes.slice(0, 50);
        const q = searchTermTercero.toLowerCase();
        return pacientes.filter(p => {
            const name = (p.nombreCompleto || `${p.nombres || ""} ${p.apellidos || ""}`).toLowerCase();
            const doc = (p.documento || p.nroDocumento || p.nro_documento || p.cedula || p.identificacion || "").toLowerCase();
            return name.includes(q) || doc.includes(q);
        });
    }, [pacientes, searchTermTercero]);

    const loadData = async () => {
        if (!inquilino) return;
        setLoading(true);
        try {
            let pList = [];
            try {
                const { data } = await supabase
                    .from("pagos")
                    .select("*")
                    .eq("tenant_id", inquilino);
                if (data && data.length > 0) pList = data;
            } catch (e) {}

            if (pList.length === 0) {
                const { data: cfgRow } = await supabase
                    .from("website_config")
                    .select("config")
                    .eq("tenant_id", inquilino)
                    .maybeSingle();
                pList = cfgRow?.config?.pagos || [];
            }
            setPagos(pList);

            const { data: pacList } = await supabase
                .from("pacientes")
                .select("*")
                .eq("tenant_id", inquilino);
            setPacientes(pacList || []);
        } catch (e) {
            console.error("Error loading credit balances:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [inquilino]);

    // Aggregate credit balance per patient
    const creditBalances = useMemo(() => {
        return pacientes.map(pac => {
            const pacPayments = pagos.filter(p => 
                (p.paciente_id === pac.id || p.pacienteId === pac.id || p.patient_id === pac.id || p.patientId === pac.id) && 
                isNotAnulado(p)
            );
            
            // Total credit added
            const totalCredits = pacPayments
                .filter(p => isCreditTopUp(p))
                .reduce((sum, p) => sum + Number(p.monto || 0), 0);
            
            // Total credit used
            const usedCredits = pacPayments
                .filter(p => isCreditUsed(p))
                .reduce((sum, p) => sum + Number(p.monto || 0), 0);
            
            // Available credit (takes into account patient profile saldo_favor and total topup payments)
            const patientSaldoFavor = Number(pac.saldo_favor || pac.saldoFavor || 0);
            const availableCredit = Math.max(0, Math.max(patientSaldoFavor, totalCredits) - usedCredits);

            // Get date of the latest credit top-up
            const creditDates = pacPayments
                .filter(p => isCreditTopUp(p))
                .map(p => p.fecha || p.createdAt || p.created_at)
                .filter(Boolean);
            
            let latestDate = null;
            if (creditDates.length > 0) {
                latestDate = creditDates.reduce((latest, current) => {
                    const timeL = latest.seconds || new Date(latest).getTime() / 1000;
                    const timeC = current.seconds || new Date(current).getTime() / 1000;
                    return timeC > timeL ? current : latest;
                });
            }

            return {
                id: pac.id,
                nombre: pac.nombreCompleto || `${pac.nombres || ""} ${pac.apellidos || ""}`.trim(),
                documento: pac.documento || pac.nroDocumento || pac.nro_documento || pac.cedula || pac.identificacion || "—",
                fecha: latestDate,
                valorDisponible: availableCredit,
                valorUsado: usedCredits,
                valorTotal: totalCredits
            };
        });
    }, [pagos, pacientes]);

    // Filter list
    const filteredBalances = useMemo(() => {
        return creditBalances.filter(item => {
            // Con saldo filter
            if (conSaldo && item.valorDisponible <= 0) return false;

            // Search filter
            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase();
                const matchesName = item.nombre.toLowerCase().includes(q);
                const matchesDoc = item.documento.toLowerCase().includes(q);
                if (!matchesName && !matchesDoc) return false;
            }

            // Exclude patients with absolutely no credit history (valorTotal === 0)
            if (item.valorTotal === 0) return false;

            return true;
        });
    }, [creditBalances, conSaldo, searchTerm]);

    // Sum column totals
    const columnTotals = useMemo(() => {
        return filteredBalances.reduce((acc, curr) => {
            acc.disponible += curr.valorDisponible;
            acc.usado += curr.valorUsado;
            acc.total += curr.valorTotal;
            return acc;
        }, { disponible: 0, usado: 0, total: 0 });
    }, [filteredBalances]);

    // Reactive calculations for selected patient in detailed view
    const selectedTotals = useMemo(() => {
        if (!selectedPaciente) return { disponible: 0, usado: 0, total: 0 };
        const pacPayments = pagos.filter(p => 
            (p.paciente_id === selectedPaciente.id || p.pacienteId === selectedPaciente.id || p.patient_id === selectedPaciente.id || p.patientId === selectedPaciente.id) && 
            isNotAnulado(p)
        );
        
        const total = pacPayments
            .filter(p => isCreditTopUp(p))
            .reduce((sum, p) => sum + Number(p.monto || 0), 0);
            
        const usado = pacPayments
            .filter(p => isCreditUsed(p))
            .reduce((sum, p) => sum + Number(p.monto || 0), 0);
            
        const patientSaldoFavor = Number(selectedPaciente.saldo_favor || selectedPaciente.saldoFavor || 0);
        const totalBase = Math.max(patientSaldoFavor, total);
        const disponible = Math.max(0, totalBase - usado);
        return { disponible, usado, total: totalBase };
    }, [selectedPaciente, pagos]);

    const selectedMovements = useMemo(() => {
        let listPayments = pagos;

        if (selectedPaciente) {
            listPayments = pagos.filter(p => 
                p.paciente_id === selectedPaciente.id || 
                p.pacienteId === selectedPaciente.id || 
                p.patient_id === selectedPaciente.id || 
                p.patientId === selectedPaciente.id
            );
        }

        const creditPayments = listPayments.filter(p => {
            const ref = (p.referencia || p.concepto || "").toUpperCase();
            const notes = (p.notas || p.notes || "").toUpperCase();
            const m = (p.metodo || p.medio || "").toLowerCase();
            return ref.includes("SALDO A FAVOR") || notes.includes("SALDO A FAVOR") || m === "saldo a favor" || !isNotAnulado(p);
        });
        
        const list = creditPayments.map(p => {
            const isTopUp = isCreditTopUp(p);
            const isVoid = !isNotAnulado(p);
            const motivo = p.motivoAnulacion || p.motivo_anulacion || (p.notas && p.notas.includes("ANULADO") ? p.notas.replace(/^ANULADO\s*-\s*/i, "") : "");
            
            const pId = p.paciente_id || p.pacienteId || p.patient_id || p.patientId;
            const pacObj = pacientes.find(pac => pac.id === pId);
            const pacName = p.paciente_nombre || p.pacienteNombre || (pacObj ? (pacObj.nombreCompleto || `${pacObj.nombres || ""} ${pacObj.apellidos || ""}`).trim() : "Tercero");

            let displayPlan = p.planTitle || "";
            if (!displayPlan && p.notas) {
                if (typeof p.notas === "string" && p.notas.trim().startsWith("{")) {
                    try {
                        const parsed = JSON.parse(p.notas);
                        displayPlan = parsed.planTitle || (parsed.itemPayments && parsed.itemPayments.map(it => it.desc).filter(Boolean).join(", ")) || parsed.concepto || parsed.observaciones || "Abono a tratamiento";
                    } catch (_) {}
                } else if (p.notas !== "SALDO A FAVOR") {
                    displayPlan = p.notas;
                }
            }
            if (!displayPlan) displayPlan = isTopUp ? "Abono Saldo a Favor" : "Tratamiento Odontológico";

            let docLabel = p.nroConsecutivo || p.consecutivo || "";
            if (!docLabel) {
                if (p.referencia && p.referencia !== "SALDO A FAVOR") {
                    docLabel = p.referencia;
                } else {
                    docLabel = isTopUp ? "SALDO A FAVOR" : "USO SALDO A FAVOR";
                }
            }

            return {
                id: p.id,
                fecha: p.fecha || p.createdAt || p.created_at,
                tercero: pacName,
                tipoMovimiento: isTopUp ? "Abono a saldo a favor" : "Consumo s. a favor",
                valor: Number(p.monto || 0),
                tipoDocumento: isTopUp ? "Recibo de saldo" : "Recibo de caja",
                documento: docLabel,
                planTratamiento: displayPlan,
                estado: isVoid ? "Anulado" : "Activo",
                motivoAnulacion: motivo,
                pagoOriginal: p
            };
        });

        if (searchTermTercero.trim()) {
            const q = searchTermTercero.toLowerCase();
            return list.filter(m => 
                (m.tercero || "").toLowerCase().includes(q) ||
                (m.planTratamiento || "").toLowerCase().includes(q) ||
                (m.motivoAnulacion || "").toLowerCase().includes(q)
            );
        }

        list.sort((a, b) => {
            const timeA = a.fecha?.seconds || new Date(a.fecha).getTime() / 1000;
            const timeB = b.fecha?.seconds || new Date(b.fecha).getTime() / 1000;
            return timeB - timeA;
        });

        return list;
    }, [selectedPaciente, pagos, pacientes, searchTermTercero]);

    const handlePrint = async (pago) => {
        try {
            const pId = pago.pacienteId || pago.patientId;
            if (!pId) return;
            const { data: patientData } = await supabase
                .from("pacientes")
                .select("*")
                .eq("id", pId)
                .single();
            if (!patientData) {
                alert("No se pudo cargar la información del paciente");
                return;
            }
            
            const clinic = userProfile?.tenant || {
                nombre: userProfile?.tenantNombre || userProfile?.clinica || "Clínica",
                inquilino: userProfile?.inquilino || userProfile?.tenantId
            };
            
            await ReceiptPrintService.generatePDF(pago, patientData, clinic, userProfile);
        } catch (e) {
            console.error("Error printing receipt:", e);
            alert("Error al preparar la impresión");
        }
    };

    const handlePrintPatientMovements = () => {
        if (!selectedPaciente || selectedMovements.length === 0) return;
        
        const clinic = userProfile?.tenant || {};
        const clinicName = userProfile?.tenantNombre || userProfile?.clinica || clinic.nombre || "CLÍNICA ODONTOLÓGICA";
        const nit = userProfile?.tenantNit || clinic.nit || userProfile?.nit || "";
        const direccion = userProfile?.tenantDireccion || clinic.direccion || userProfile?.direccion || "";
        const ciudad = userProfile?.tenantCiudad || clinic.ciudad || userProfile?.ciudad || "Sincelejo";
        const telefono = userProfile?.tenantTelefono || clinic.telefono || userProfile?.telefono || "";
        const email = userProfile?.tenantEmail || clinic.email || userProfile?.email || "";
        const logoUrl = userProfile?.tenantLogo || clinic.logo || "";

        const pacName = (selectedPaciente.nombreCompleto || `${selectedPaciente.nombres || ""} ${selectedPaciente.apellidos || ""}`).trim().toUpperCase();
        const pacDoc = selectedPaciente.documento || selectedPaciente.nroDocumento || selectedPaciente.nro_documento || selectedPaciente.cedula || "—";
        const pacDocType = (selectedPaciente.tipoDocumento || selectedPaciente.tipo_documento || "CÉDULA DE CIUDADANÍA").toUpperCase();
        const pacAddress = selectedPaciente.direccion || selectedPaciente.dir || "—";
        const pacCity = selectedPaciente.ciudad || selectedPaciente.municipio || ciudad || "—";
        const pacTel = selectedPaciente.celular || selectedPaciente.telefono || "—";
        const elaboradoPor = (userProfile?.nombreCompleto || userProfile?.nombre || userProfile?.email?.split('@')[0] || "ADMINISTRADOR").toUpperCase();

        const now = new Date();
        const expeditionDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

        const rowsHtml = selectedMovements.map(mov => {
            const isAbono = mov.tipoMovimiento.toLowerCase().includes("abono") || mov.tipoMovimiento.toLowerCase().includes("entrada");
            const tMov = isAbono ? "Entrada" : "Salida";
            const tDoc = isAbono ? (mov.tipoDocumento || "Recibo de caja") : "Cons. s. a fav.";
            const isAnulado = mov.estado === "Anulado";

            let docClean = String(mov.documento || "").replace(/^#/, "");
            if (docClean.toUpperCase().includes("SALDO A FAVOR") || !docClean) {
                docClean = "—";
            }

            return `
            <tr>
                <td style="border: 1px solid #334155; padding: 5px 6px; text-align: center; ${isAnulado ? 'text-decoration: line-through; color: #ef4444;' : ''}">
                    ${formatDateOnly(mov.fecha)}
                </td>
                <td style="border: 1px solid #334155; padding: 5px 6px; text-align: center; font-weight: 600;">
                    ${tMov}
                </td>
                <td style="border: 1px solid #334155; padding: 5px 6px; text-align: right; font-family: monospace; font-weight: 700;">
                    $${formatCurrency(mov.valor || 0)}
                </td>
                <td style="border: 1px solid #334155; padding: 5px 6px; text-align: center; text-transform: uppercase;">
                    ${tDoc}
                </td>
                <td style="border: 1px solid #334155; padding: 5px 6px; text-align: center; font-family: monospace; font-weight: 700;">
                    ${docClean}
                </td>
                <td style="border: 1px solid #334155; padding: 5px 6px; text-align: left; text-transform: uppercase; font-size: 9.5px;">
                    ${mov.planTratamiento || "—"}
                    ${isAnulado && mov.motivoAnulacion ? `<div style="color: #ef4444; font-size: 8.5px; font-style: italic;">(Anulado: ${mov.motivoAnulacion})</div>` : ''}
                </td>
            </tr>`;
        }).join("");

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Histórico saldo a favor - ${pacName}</title>
    <style>
        * { box-sizing: border-box; }
        body { 
            font-family: Arial, Helvetica, sans-serif; 
            margin: 0; 
            padding: 30px 40px; 
            color: #0f172a; 
            font-size: 11px;
            background: #ffffff;
        }
        @media print { 
            @page { margin: 12mm 15mm; size: letter portrait; }
            body { padding: 0; }
        }
    </style>
</head>
<body>

    <!-- Header -->
    <table style="width: 100%; margin-bottom: 22px; border-collapse: collapse;">
        <tr>
            <td style="width: 25%; vertical-align: middle;">
                ${logoUrl ? `<img src="${logoUrl}" style="max-height: 65px; max-width: 160px; object-fit: contain;" />` : `<div style="font-size: 16px; font-weight: 900; color: #1e293b;">${clinicName}</div>`}
            </td>
            <td style="width: 50%; text-align: center; vertical-align: middle; font-size: 10.5px; line-height: 1.35;">
                <div style="font-weight: 900; font-size: 12px; text-transform: uppercase; margin-bottom: 2px;">${clinicName}</div>
                ${nit ? `<div>NIT ${nit}</div>` : ''}
                ${direccion ? `<div>${direccion}${ciudad ? ` - ${ciudad}` : ''}</div>` : ''}
                ${telefono ? `<div>${telefono}</div>` : ''}
                ${email ? `<div>${email}</div>` : ''}
            </td>
            <td style="width: 25%; text-align: right; vertical-align: top; font-size: 11px; font-weight: 600; color: #334155;">
                Histórico saldo a favor
            </td>
        </tr>
    </table>

    <!-- Patient Details Table Grid -->
    <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #334155; margin-bottom: 20px; font-size: 9.5px;">
        <tr>
            <td style="border: 1px solid #334155; background: #ffffff; padding: 5px 8px; font-weight: 900; text-transform: uppercase; width: 16%;">SEÑOR(A)</td>
            <td style="border: 1px solid #334155; padding: 5px 8px; font-weight: 700; width: 44%; text-transform: uppercase;" colspan="3">${pacName}</td>
            <td style="border: 1px solid #334155; background: #ffffff; padding: 5px 8px; font-weight: 900; text-align: center; width: 40%; font-size: 10px;" colspan="2">FECHA DE EXPEDICIÓN (DD/MM/AA)</td>
        </tr>
        <tr>
            <td style="border: 1px solid #334155; background: #ffffff; padding: 5px 8px; font-weight: 900; text-transform: uppercase;">DIRECCIÓN</td>
            <td style="border: 1px solid #334155; padding: 5px 8px; text-transform: uppercase;" colspan="3">${pacAddress}</td>
            <td style="border: 1px solid #334155; padding: 8px; text-align: center; font-weight: 700; font-size: 11px; vertical-align: middle;" colspan="2" rowspan="3">
                ${expeditionDate}
            </td>
        </tr>
        <tr>
            <td style="border: 1px solid #334155; background: #ffffff; padding: 5px 8px; font-weight: 900; text-transform: uppercase;">CIUDAD</td>
            <td style="border: 1px solid #334155; padding: 5px 8px; text-transform: uppercase;" colspan="3">${pacCity}</td>
        </tr>
        <tr>
            <td style="border: 1px solid #334155; background: #ffffff; padding: 5px 8px; font-weight: 900; text-transform: uppercase;">TELÉFONO</td>
            <td style="border: 1px solid #334155; padding: 5px 8px; width: 18%; font-weight: 600;">${pacTel}</td>
            <td style="border: 1px solid #334155; background: #ffffff; padding: 5px 6px; font-weight: 900; text-align: center; text-transform: uppercase; width: 14%; font-size: 8.5px; line-height: 1.1;">
                ${pacDocType}
            </td>
            <td style="border: 1px solid #334155; padding: 5px 8px; font-weight: 700; width: 12%; font-family: monospace; font-size: 10.5px;">
                ${pacDoc}
            </td>
        </tr>
        <tr>
            <td style="border: 1px solid #334155; background: #ffffff; padding: 5px 8px; font-weight: 900; text-transform: uppercase;">ELABORADO POR</td>
            <td style="border: 1px solid #334155; padding: 5px 8px; font-weight: 700; text-transform: uppercase;" colspan="5">${elaboradoPor}</td>
        </tr>
    </table>

    <!-- Movements Table -->
    <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #334155; margin-bottom: 22px; font-size: 9.5px;">
        <thead>
            <tr style="background: #ffffff; text-transform: uppercase;">
                <th style="border: 1px solid #334155; padding: 5px 6px; text-align: center; width: 12%; font-weight: 900;">Fecha</th>
                <th style="border: 1px solid #334155; padding: 5px 6px; text-align: center; width: 15%; font-weight: 900; line-height: 1.1;">T.<br/>movimiento</th>
                <th style="border: 1px solid #334155; padding: 5px 6px; text-align: right; width: 14%; font-weight: 900;">Valor</th>
                <th style="border: 1px solid #334155; padding: 5px 6px; text-align: center; width: 15%; font-weight: 900;">T. documento</th>
                <th style="border: 1px solid #334155; padding: 5px 6px; text-align: center; width: 12%; font-weight: 900;">Documento</th>
                <th style="border: 1px solid #334155; padding: 5px 6px; text-align: left; width: 32%; font-weight: 900;">P. de trat.</th>
            </tr>
        </thead>
        <tbody>
            ${rowsHtml}
        </tbody>
    </table>

    <!-- Totals Area -->
    <div style="display: flex; justify-content: flex-end; margin-bottom: 50px;">
        <table style="border-collapse: collapse; font-size: 11px; font-weight: 900; width: 280px;">
            <tr>
                <td style="padding: 3px 10px; text-align: right; text-transform: none;">Valor total</td>
                <td style="padding: 3px 10px; text-align: right; font-family: monospace; font-size: 12px;">$ ${formatCurrency(selectedTotals.total)}</td>
            </tr>
            <tr>
                <td style="padding: 3px 10px; text-align: right; text-transform: none;">Valor usado</td>
                <td style="padding: 3px 10px; text-align: right; font-family: monospace; font-size: 12px;">$ ${formatCurrency(selectedTotals.usado)}</td>
            </tr>
            <tr>
                <td style="padding: 3px 10px; text-align: right; text-transform: none;">Valor disponible</td>
                <td style="padding: 3px 10px; text-align: right; font-family: monospace; font-size: 12px;">$ ${formatCurrency(selectedTotals.disponible)}</td>
            </tr>
        </table>
    </div>

    <!-- Signatures -->
    <div style="margin-top: 60px; display: flex; justify-content: space-around;">
        <div style="width: 240px; text-align: center;">
            <div style="border-top: 1.5px solid #334155; margin-bottom: 6px;"></div>
            <div style="font-size: 9.5px; font-weight: 900; text-transform: uppercase;">ELABORADO POR</div>
        </div>
        <div style="width: 240px; text-align: center;">
            <div style="border-top: 1.5px solid #334155; margin-bottom: 6px;"></div>
            <div style="font-size: 9.5px; font-weight: 900; text-transform: uppercase;">ACEPTADA. FIRMA Y/O SELLO Y FECHA</div>
        </div>
    </div>

</body>
</html>`;

        printHTMLInHiddenIframe(html);
    };

    return (
        <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-4 animate-in fade-in duration-300">

            {/* Top Bar: Header & Main Action */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div>
                    <h2 className="text-base font-bold text-slate-800 tracking-tight">Saldo a Favor</h2>
                    <p className="text-xs text-slate-500 font-medium">Gestión y control de saldos a favor de terceros y pacientes</p>
                </div>
                {/* Only show button when rendered standalone (not from FacturacionHub which already has it in toolbar) */}
                {!onNew && (
                    <button
                        type="button"
                        onClick={() => navigate(buildDashboardPath("facturacion/saldo/nuevo"))}
                        className="h-9 px-4 bg-[#8cc33f] text-white rounded-lg text-xs font-bold hover:bg-[#7db02b] shadow-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    >
                        <FiPlus size={16} />
                        <span>Nuevo Saldo a Favor</span>
                    </button>
                )}
            </div>

            {/* Filter & Toolbar Card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
                
                {/* Search Bar */}
                {!detalleMovimientos ? (
                    <div className="relative flex-1 max-w-sm">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                            type="text" 
                            placeholder="Buscar por tercero o documento..."
                            className="w-full h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                ) : (
                    <div className="flex-1 max-w-md relative" onClick={e => e.stopPropagation()}>
                        {selectedPaciente ? (
                            <div className="flex items-center gap-2 w-full h-9 px-3 border border-slate-200 rounded-lg bg-slate-50 text-xs font-semibold text-slate-700">
                                <FiUser className="text-slate-400 shrink-0" size={14} />
                                <span className="flex-1 truncate uppercase">
                                    {(selectedPaciente.nombreCompleto || `${selectedPaciente.nombres || ""} ${selectedPaciente.apellidos || ""}`).trim()} (CC: {selectedPaciente.documento || selectedPaciente.nroDocumento || selectedPaciente.nro_documento || selectedPaciente.cedula || selectedPaciente.identificacion || "—"})
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setSelectedPaciente(null)}
                                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-xs"
                                >
                                    Cambiar
                                </button>
                            </div>
                        ) : (
                            <div className="relative">
                                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input
                                    type="text"
                                    placeholder="Buscar tercero por nombre o cédula..."
                                    className="w-full h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-blue-500 transition-all"
                                    value={searchTermTercero}
                                    onChange={(e) => {
                                        setSearchTermTercero(e.target.value);
                                        setShowTerceroDropdown(true);
                                    }}
                                    onFocus={() => setShowTerceroDropdown(true)}
                                />
                                {showTerceroDropdown && (
                                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto divide-y divide-slate-100">
                                        {filteredTerceros.length === 0 ? (
                                            <div className="px-3 py-2 text-xs text-slate-400 italic">No se encontraron resultados</div>
                                        ) : (
                                            filteredTerceros.map(p => (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedPaciente(p);
                                                        setSearchTermTercero("");
                                                        setShowTerceroDropdown(false);
                                                    }}
                                                    className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex flex-col gap-0.5"
                                                >
                                                    <span className="text-xs font-bold text-slate-800 uppercase">
                                                        {(p.nombreCompleto || `${p.nombres || ""} ${p.apellidos || ""}`).trim()}
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 font-mono">CC: {p.documento || p.nroDocumento || p.nro_documento || p.cedula || p.identificacion || "—"}</span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Compact Toggle Controls & Print History Button */}
                <div className="flex items-center gap-4 flex-wrap">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                        <input
                            type="checkbox"
                            checked={detalleMovimientos}
                            onChange={() => {
                                setDetalleMovimientos(!detalleMovimientos);
                                setSelectedPaciente(null);
                            }}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <span>Detalle de movimiento por paciente</span>
                    </label>

                    {detalleMovimientos && selectedPaciente && (
                        <button
                            type="button"
                            onClick={handlePrintPatientMovements}
                            className="h-8 px-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
                            title="Imprimir historial completo de movimientos del paciente"
                        >
                            <FiPrinter size={13} />
                            <span>Imprimir Historial</span>
                        </button>
                    )}

                    {!detalleMovimientos && (
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                            <input
                                type="checkbox"
                                checked={conSaldo}
                                onChange={() => setConSaldo(!conSaldo)}
                                className="w-4 h-4 text-[#8cc33f] rounded border-slate-300 focus:ring-[#8cc33f] cursor-pointer"
                            />
                            <span>Solo con saldo disponible</span>
                        </label>
                    )}
                </div>

            </div>

            {/* Selected Patient Stats in Detailed View */}
            {detalleMovimientos && selectedPaciente && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-fadeIn">
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saldo Total</span>
                        <span className="text-sm font-bold text-slate-800 font-mono">{fmt(selectedTotals.total)}</span>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saldo Usado</span>
                        <span className="text-sm font-bold text-rose-600 font-mono">{fmt(selectedTotals.usado)}</span>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saldo Disponible</span>
                        <span className="text-sm font-bold text-emerald-600 font-mono">{fmt(selectedTotals.disponible)}</span>
                    </div>
                </div>
            )}

            {/* Balances Data Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                {detalleMovimientos ? (
                                    <>
                                        <th className="py-3 px-4">Fecha</th>
                                        <th className="py-3 px-4">Tipo Movimiento</th>
                                        <th className="py-3 px-4 text-right">Valor</th>
                                        <th className="py-3 px-4">Tipo Documento</th>
                                        <th className="py-3 px-4">Documento</th>
                                        <th className="py-3 px-4">Plan Tratamiento</th>
                                        <th className="py-3 px-4">Estado</th>
                                        <th className="py-3 px-4 text-center w-20">Acciones</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="py-3 px-4">Fecha</th>
                                        <th className="py-3 px-4">Tercero</th>
                                        <th className="py-3 px-4">Documento</th>
                                        <th className="py-3 px-4 text-right">Valor Disponible</th>
                                        <th className="py-3 px-4 text-right">Valor Usado</th>
                                        <th className="py-3 px-4 text-right">Valor Total</th>
                                        <th className="py-3 px-4 text-center w-20">Acciones</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                            {loading ? (
                                <tr>
                                    <td colSpan={detalleMovimientos ? 8 : 7} className="py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-6 h-6 border-2 border-[#8cc33f] border-t-transparent rounded-full animate-spin" />
                                            <span className="text-xs font-bold text-slate-400">Cargando saldos...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : detalleMovimientos ? (
                                selectedMovements.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" className="py-12 text-center text-slate-400 italic">
                                            No se registran movimientos de saldo a favor.
                                        </td>
                                    </tr>
                                ) : (
                                    selectedMovements.map(mov => (
                                        <tr key={mov.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="py-2.5 px-4 font-medium text-slate-500">
                                                {formatDateOnly(mov.fecha)}
                                            </td>
                                            <td className="py-2.5 px-4 font-semibold text-slate-800 uppercase">
                                                {mov.tipoMovimiento}
                                            </td>
                                            <td className={`py-2.5 px-4 text-right font-bold font-mono ${mov.tipoMovimiento.includes("Abono") ? "text-emerald-600" : "text-rose-600"}`}>
                                                {fmt(mov.valor)}
                                            </td>
                                            <td className="py-2.5 px-4 text-slate-500 font-medium uppercase">
                                                {mov.tipoDocumento}
                                            </td>
                                            <td className="py-2.5 px-4 font-mono font-bold text-slate-600">
                                                #{mov.documento}
                                            </td>
                                             <td className="py-2.5 px-4 text-slate-600 font-medium">
                                                 <div>{mov.planTratamiento}</div>
                                                 {mov.estado === "Anulado" && mov.motivoAnulacion && (
                                                     <div className="text-[10px] font-semibold text-rose-600 italic mt-0.5">
                                                         ⚠️ Motivo: {mov.motivoAnulacion}
                                                     </div>
                                                 )}
                                             </td>
                                            <td className="py-2.5 px-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${mov.estado === "Anulado" ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"}`}>
                                                    {mov.estado}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-4 text-center">
                                                <button 
                                                    className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-colors mx-auto"
                                                    title="Imprimir Recibo"
                                                    onClick={() => handlePrint(mov.pagoOriginal)}
                                                >
                                                    <FiPrinter size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )
                            ) : (
                                filteredBalances.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="py-12 text-center text-slate-400 italic">
                                            No se encontraron terceros con saldo a favor registrado.
                                        </td>
                                    </tr>
                                ) : (
                                    <>
                                        {filteredBalances.map(item => (
                                            <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="py-2.5 px-4 font-medium text-slate-500">
                                                    {formatDateOnly(item.fecha)}
                                                </td>
                                                <td className="py-2.5 px-4 font-bold text-slate-800 uppercase">
                                                    {item.nombre}
                                                </td>
                                                <td className="py-2.5 px-4 font-mono text-slate-600 font-medium">
                                                    {item.documento}
                                                </td>
                                                <td className="py-2.5 px-4 text-right font-bold text-emerald-600 font-mono">
                                                    {fmt(item.valorDisponible)}
                                                </td>
                                                <td className="py-2.5 px-4 text-right font-semibold text-rose-600 font-mono">
                                                    {fmt(item.valorUsado)}
                                                </td>
                                                <td className="py-2.5 px-4 text-right font-bold text-slate-800 font-mono">
                                                    {fmt(item.valorTotal)}
                                                </td>
                                                <td className="py-2.5 px-4 text-center">
                                                    <button 
                                                        className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-colors mx-auto"
                                                        title="Ver historial en Ficha"
                                                        onClick={() => navigate(buildDashboardPath(`pacientes?id=${item.id}&tab=saldo`))}
                                                    >
                                                        <FiUser size={13} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {/* Totals Row */}
                                        <tr className="bg-slate-50 font-bold text-slate-800 text-xs border-t-2 border-slate-200">
                                            <td colSpan="3" className="py-3 px-4 text-right uppercase tracking-wider">Totales</td>
                                            <td className="py-3 px-4 text-right text-emerald-600 font-mono font-bold">{fmt(columnTotals.disponible)}</td>
                                            <td className="py-3 px-4 text-right text-rose-600 font-mono font-bold">{fmt(columnTotals.usado)}</td>
                                            <td className="py-3 px-4 text-right text-slate-900 font-mono font-bold">{fmt(columnTotals.total)}</td>
                                            <td></td>
                                        </tr>
                                    </>
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
