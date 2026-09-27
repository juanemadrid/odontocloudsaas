import React, { useState, useEffect } from "react";
import {
  FiX, FiAlertTriangle, FiCheckCircle, FiFileText,
  FiDownload, FiRefreshCw, FiDollarSign, FiInfo, FiLock
} from "react-icons/fi";
import {
  CREDIT_NOTE_CONCEPTS,
  getCreditNoteConcept,
  isTotalCreditNoteConcept,
  isPartialCreditNoteConcept,
} from "../../../utils/dian/creditNoteCatalogs";
import {
  getFacturaCreditedBalance,
  createCreditNoteDraft,
  emitCreditNote,
} from "../../../services/factusCreditNoteService";
import factusService, {
  filterActiveCreditNoteRanges,
  downloadCreditNotePDF,
  downloadCreditNoteXML,
} from "../../../services/factusService";
import {
  isHealthInvoice,
  validatePartialCreditNoteClinicalTraceability,
} from "../../../services/muvCreditNoteRipsBuilder";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

export default function NotaCreditoElectronicaModal({
  factura,
  inquilino,
  onClose,
  onSuccess,
}) {
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState({
    totalFactura: 0,
    totalAcreditado: 0,
    saldoDisponible: 0,
    ncCount: 0,
    fiscalStatus: "NONE",
  });
  const [ranges, setRanges] = useState([]);
  const [selectedRangeId, setSelectedRangeId] = useState("");

  // Form State
  const [tipoNC, setTipoNC] = useState("TOTAL"); // 'TOTAL' | 'PARCIAL'
  const [selectedConcept, setSelectedConcept] = useState("2");
  const [montoAcreditar, setMontoAcreditar] = useState(0);
  const [observacion, setObservacion] = useState("");
  const [confirmado, setConfirmado] = useState(false);

  // Items
  const [adjustedItems, setAdjustedItems] = useState([]);

  // Flow State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [acceptedResult, setAcceptedResult] = useState(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isDownloadingXml, setIsDownloadingXml] = useState(false);

  const billNumber =
    factura.detalles?.factusInvoiceNumber ||
    factura.detalles?.bill_number ||
    factura.nro_consecutivo ||
    "—";

  const cufe =
    factura.detalles?.cufe ||
    factura.detalles?.factusCufe ||
    factura.detalles?.factusResponse?.data?.bill?.cufe ||
    "—";

  const pacienteNombre =
    factura.paciente?.nombre ||
    factura.detalles?.paciente?.nombre ||
    "Consumidor Final";

  const pacienteDoc =
    factura.paciente?.identificacion ||
    factura.detalles?.paciente?.identificacion ||
    factura.detalles?.paciente?.documento ||
    "—";

  // 1. Cargar saldo actual y rangos autorizados de NC
  useEffect(() => {
    let isMounted = true;
    async function loadInitialData() {
      try {
        setLoading(true);
        setErrorMessage(null);

        // A. Cargar saldo atómico
        const bal = await getFacturaCreditedBalance(inquilino, factura.id);
        if (!isMounted) return;
        setBalance(bal);
        setMontoAcreditar(bal.saldoDisponible);

        // B. Inicializar items preservando trazabilidad clínica
        const originalItems = factura.detalles?.items || factura.items || [];
        setAdjustedItems(
          originalItems.map((it, idx) => {
            const qty = parseFloat(it.cantidad || 1) || 1;
            const price = parseFloat(it.precioUnitario || it.precio || it.valor || 0) || 0;
            return {
              ...it,
              id: it.id || it.invoiceLineId || idx,
              invoiceLineId: it.invoiceLineId || null,
              clinicalSourceId: it.clinicalSourceId || it.planItemId || it.evolucionId || it.atencionId || (it.planId && it.id ? it.id : null),
              clinicalSourceType: it.clinicalSourceType || (it.planItemId || it.planId ? "PLAN_ITEM" : it.evolucionId ? "EVOLUCION" : it.atencionId ? "DOCUMENTO_CLINICO" : null),
              cups: it.cups || it.codigo_cups || it.code || null,
              descripcion: it.descripcion || it.nombre || it.concepto || `Servicio ${idx + 1}`,
              cantidad_original: qty,
              valor_original: price,
              cantidad_acreditada: qty,
              valor_acreditado: price,
              cantidad: qty,
              precio: price,
              selected: true,
            };
          })
        );

        // C. Cargar rangos Factus /v2/numbering-ranges
        const rangesData = await factusService.getNumberingRanges();
        if (!isMounted) return;
        const ncRanges = filterActiveCreditNoteRanges(rangesData);
        setRanges(ncRanges);
        if (ncRanges.length > 0) {
          setSelectedRangeId(String(ncRanges[0].id));
        }
      } catch (err) {
        if (!isMounted) return;
        setErrorMessage(err.message || "Error cargando datos para la Nota Crédito.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInitialData();
    return () => {
      isMounted = false;
    };
  }, [factura.id, inquilino]);

  // Manejo de cambio de tipo de NC
  const handleTipoChange = (tipo) => {
    setTipoNC(tipo);
    if (tipo === "TOTAL") {
      setSelectedConcept("2");
      setMontoAcreditar(balance.saldoDisponible);
    } else {
      setSelectedConcept("1");
      // Ajustar monto inicial al saldo o suma de seleccionados
      const selTotal = adjustedItems
        .filter((it) => it.selected)
        .reduce((sum, it) => sum + it.precio * it.cantidad, 0);
      setMontoAcreditar(Math.min(balance.saldoDisponible, selTotal || balance.saldoDisponible));
    }
  };

  const handleConceptChange = (code) => {
    setSelectedConcept(code);
    if (code === "2") {
      setTipoNC("TOTAL");
      setMontoAcreditar(balance.saldoDisponible);
    } else {
      setTipoNC("PARCIAL");
    }
  };

  // Envío y emisión de la Nota Crédito
  const handleEmitirNotaCredito = async (e) => {
    e.preventDefault();
    if (!confirmado) {
      setErrorMessage("Debe confirmar que desea generar un documento electrónico ante la DIAN.");
      return;
    }
    if (!selectedRangeId) {
      setErrorMessage("Debe seleccionar un rango de numeración Factus autorizado para Nota Crédito (Documento 22).");
      return;
    }
    if (Number(montoAcreditar) <= 0) {
      setErrorMessage("El monto a acreditar debe ser mayor a cero.");
      return;
    }
    if (Number(montoAcreditar) > balance.saldoDisponible) {
      setErrorMessage(`El monto ($${montoAcreditar}) supera el saldo disponible ($${balance.saldoDisponible}).`);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      // Precheck canónico para FEV Salud + NC Parcial antes de llamar a Factus
      if (tipoNC === "PARCIAL" && isHealthInvoice(factura)) {
        const selectedForPrecheck = adjustedItems.filter((it) => it.selected);
        validatePartialCreditNoteClinicalTraceability({
          factura,
          items: selectedForPrecheck,
        });
      }

      // Paso 1: Crear borrador DRAFT y generar reference_code estable
      const draft = await createCreditNoteDraft({
        tenantId: inquilino,
        facturaId: factura.id,
        pacienteId: factura.paciente_id,
        correctionConceptCode: selectedConcept,
        tipo: tipoNC,
        montoAcreditado: Number(montoAcreditar),
        observacion: observacion || `Nota Crédito ${tipoNC} - Factura ${billNumber}`,
        items: tipoNC === "PARCIAL"
          ? adjustedItems
              .filter((it) => it.selected)
              .map((it) => ({
                invoiceLineId: it.invoiceLineId,
                clinicalSourceId: it.clinicalSourceId,
                clinicalSourceType: it.clinicalSourceType,
                cups: it.cups,
                descripcion: it.descripcion,
                cantidad_original: it.cantidad_original,
                valor_original: it.valor_original,
                cantidad_acreditada: it.cantidad_acreditada !== undefined ? it.cantidad_acreditada : it.cantidad,
                valor_acreditado: it.valor_acreditado !== undefined ? it.valor_acreditado : it.precio,
                id: it.id,
                cantidad: it.cantidad,
                precio: it.precio,
                selected: true,
              }))
          : null,
      });

      // Paso 2: Emitir ante Factus / DIAN
      const emitRes = await emitCreditNote({
        creditNoteId: draft.id,
        tenantId: inquilino,
        numberingRangeId: Number(selectedRangeId),
      });

      setAcceptedResult({
        numero: emitRes.numero || emitRes.creditNote?.numero || "NC-EMITIDA",
        cude: emitRes.cude || emitRes.creditNote?.cude || "CUDE-PROCESADO",
        montoAcreditado: Number(montoAcreditar),
        concepto: getCreditNoteConcept(selectedConcept)?.shortName || selectedConcept,
        tipo: tipoNC,
        facturaRelacionada: billNumber,
        creditNoteId: draft.id,
        muvStatus: emitRes.creditNote?.detalles?.muvStatus || "LISTA PARA MUV",
        cuvNotaCredito: emitRes.creditNote?.detalles?.cuv || null,
        muvCancellationResult: tipoNC === "TOTAL" ? "Anulación Total Lista para Procesar ante MinSalud" : null,
      });

      if (onSuccess) {
        onSuccess(emitRes);
      }
    } catch (err) {
      console.error("Error emitiendo Nota Crédito:", err);
      setErrorMessage(err.message || "Error emitiendo la Nota Crédito ante Factus.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!acceptedResult?.numero) return;
    try {
      setIsDownloadingPdf(true);
      const blob = await downloadCreditNotePDF(acceptedResult.numero);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `NotaCredito-${acceptedResult.numero}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setErrorMessage(`Error descargando PDF de Nota Crédito: ${err.message}`);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleDownloadXML = async () => {
    if (!acceptedResult?.numero) return;
    try {
      setIsDownloadingXml(true);
      const { blob, fileName } = await downloadCreditNoteXML(acceptedResult.numero);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setErrorMessage(`Error descargando XML de Nota Crédito: ${err.message}`);
    } finally {
      setIsDownloadingXml(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Encabezado */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <FiFileText className="text-amber-400" size={20} />
            <div>
              <h2 className="text-base font-bold">Nota Crédito Electrónica Factus / DIAN</h2>
              <p className="text-xs text-slate-300">
                Ajuste fiscal formal para factura {billNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors border-0 bg-transparent cursor-pointer"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500">
              <FiRefreshCw className="animate-spin text-blue-600" size={32} />
              <p className="text-sm font-medium">Verificando elegibilidad y saldo fiscal...</p>
            </div>
          ) : acceptedResult ? (
            /* VISTA DE ÉXITO ACEPTADA (Section 19) */
            <div className="space-y-6 py-2">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-start gap-4">
                <FiCheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={28} />
                <div>
                  <h3 className="text-base font-bold text-emerald-900">
                    ✓ Nota Crédito aceptada ante la DIAN
                  </h3>
                  <p className="text-xs text-emerald-700 mt-1">
                    El documento electrónico fue validado y registrado oficialmente con CUDE fiscal.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Número Nota Crédito:</span>
                  <span className="font-bold text-slate-900 text-sm">{acceptedResult.numero}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Estado Fiscal:</span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold uppercase tracking-wider text-[10px]">
                    ACEPTADA
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Factura Relacionada:</span>
                  <span className="font-semibold text-slate-800">{acceptedResult.facturaRelacionada}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Concepto DIAN:</span>
                  <span className="font-semibold text-slate-800">{acceptedResult.concepto}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">Valor Acreditado:</span>
                  <span className="font-bold text-slate-900 text-sm">{fmt(acceptedResult.montoAcreditado)}</span>
                </div>
                <div className="pt-2">
                  <span className="text-slate-500 font-medium block mb-1">CUDE Fiscal:</span>
                  <p className="font-mono text-[10px] text-slate-700 bg-white p-2 rounded border border-slate-200 break-all select-all">
                    {acceptedResult.cude}
                  </p>
                </div>
              </div>

              {/* Sección Oficial MUV: VALIDACIÓN MINISTERIO DE SALUD (Fase P1-FEV4) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                    VALIDACIÓN MINISTERIO DE SALUD
                  </span>
                  <span className="px-2 py-0.5 rounded font-bold text-[10px] uppercase bg-blue-100 text-blue-800">
                    {acceptedResult.muvStatus || "LISTA PARA MUV"}
                  </span>
                </div>
                {acceptedResult.tipo === "PARCIAL" ? (
                  <div>
                    <span className="text-slate-500 font-medium block">CUV Nota Crédito:</span>
                    <p className="font-mono text-xs font-bold text-slate-800 break-all select-all mt-0.5">
                      {acceptedResult.cuvNotaCredito || "Pendiente de radicación MUV"}
                    </p>
                  </div>
                ) : (
                  <div>
                    <span className="text-slate-500 font-medium block">Resultado Anulación MUV:</span>
                    <p className="font-semibold text-xs text-slate-800 mt-0.5">
                      {acceptedResult.muvCancellationResult || "Anulación total lista para radicación MUV"}
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      (CUV histórico de factura {billNumber} preservado sin alteraciones)
                    </span>
                  </div>
                )}
              </div>

              {/* Advertencia de Tesorería */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                <FiInfo className="text-amber-600 shrink-0 mt-0.5" size={18} />
                <div className="text-xs text-amber-800">
                  <span className="font-bold block">Aclaración de Tesorería:</span>
                  La emisión de la Nota Crédito anula el efecto fiscal y contable exigido por la DIAN. No genera movimientos de caja automáticos. Si hubo pagos recaudados, proceda posteriormente con la devolución de dinero o acreditación de saldo a favor del paciente.
                </div>
              </div>

              {/* Botones de Descarga */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={isDownloadingPdf}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer border-0 shadow-sm transition-all disabled:opacity-50"
                >
                  <FiDownload size={14} />
                  <span>{isDownloadingPdf ? "Descargando..." : "Descargar PDF"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadXML}
                  disabled={isDownloadingXml}
                  className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer border-0 shadow-sm transition-all disabled:opacity-50"
                >
                  <FiDownload size={14} />
                  <span>{isDownloadingXml ? "Descargando..." : "Descargar XML"}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer border-0 transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>
          ) : (
            /* FORMULARIO DE EMISIÓN */
            <form onSubmit={handleEmitirNotaCredito} className="space-y-5">
              {errorMessage && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3.5 text-xs flex items-start gap-2.5">
                  <FiAlertTriangle className="shrink-0 mt-0.5 text-red-500" size={16} />
                  <div>
                    <span className="font-bold block">No se pudo emitir la Nota Crédito:</span>
                    <span>{errorMessage}</span>
                  </div>
                </div>
              )}

              {/* Resumen de Factura y Saldo */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Factura Factus</span>
                  <span className="font-bold text-slate-800 text-sm">{billNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Paciente</span>
                  <span className="font-semibold text-slate-800 truncate block" title={pacienteNombre}>
                    {pacienteNombre}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Factura</span>
                  <span className="font-bold text-slate-800">{fmt(balance.totalFactura)}</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-2 rounded-lg">
                  <span className="text-emerald-700 block text-[10px] uppercase font-bold">Saldo Disponible</span>
                  <span className="font-bold text-emerald-800 text-sm">{fmt(balance.saldoDisponible)}</span>
                </div>
              </div>

              {/* Tipo de Nota Crédito */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Tipo de corrección fiscal:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleTipoChange("TOTAL")}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      tipoNC === "TOTAL"
                        ? "bg-blue-50 border-blue-500 text-blue-900 font-bold ring-1 ring-blue-500"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-xs font-bold">Anulación total</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Cancela el 100% del saldo ({fmt(balance.saldoDisponible)})
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTipoChange("PARCIAL")}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      tipoNC === "PARCIAL"
                        ? "bg-blue-50 border-blue-500 text-blue-900 font-bold ring-1 ring-blue-500"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-xs font-bold">Corrección parcial</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Rebaja, ajuste de precio o devolución de ítem
                    </div>
                  </button>
                </div>
              </div>

              {/* Concepto de Corrección Factus/DIAN */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Concepto de corrección DIAN:
                </label>
                <select
                  value={selectedConcept}
                  onChange={(e) => handleConceptChange(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  {CREDIT_NOTE_CONCEPTS.map((c) => {
                    const disabled = tipoNC === "TOTAL" && c.code !== "2";
                    return (
                      <option key={c.code} value={c.code} disabled={disabled}>
                        {c.code} - {c.name}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Rango de numeración autorizado para Nota Crédito */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Rango de numeración Factus (Documento 22 - Nota Crédito):
                </label>
                {ranges.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-xl">
                    No se encontró un rango activo de Nota Crédito en Factus. Verifique la configuración en el menú DIAN.
                  </div>
                ) : (
                  <select
                    value={selectedRangeId}
                    onChange={(e) => setSelectedRangeId(e.target.value)}
                    className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {ranges.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.prefix || "NC"} (Rango ID: {r.id}) — Desde: {r.from || 1} Hasta: {r.to || 999999}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Monto Acreditado */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Monto acreditado a emitir:
                  </label>
                  <span className="text-[10px] text-slate-500">
                    Techo disponible: {fmt(balance.saldoDisponible)}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-xs">$</span>
                  <input
                    type="number"
                    min="1"
                    max={balance.saldoDisponible}
                    step="1"
                    disabled={tipoNC === "TOTAL"}
                    value={montoAcreditar}
                    onChange={(e) => setMontoAcreditar(parseFloat(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-2 text-xs font-bold text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100"
                  />
                </div>
              </div>

              {/* Observación */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Motivo / Observación de la Nota Crédito:
                </label>
                <textarea
                  rows={2}
                  maxLength={250}
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  placeholder="Explique brevemente el motivo de la anulación o ajuste fiscal..."
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Advertencia Obligatoria DIAN */}
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
                <FiAlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                <div className="text-xs text-amber-900 space-y-1">
                  <span className="font-bold block">
                    Advertencia Fiscal Obligatoria:
                  </span>
                  <p>
                    Esta acción generará un documento electrónico oficial ante la DIAN que afectará la contabilidad tributaria. Esta operación no se puede revertir salvo emitiendo una Nota Débito posterior.
                  </p>
                  <label className="flex items-center gap-2 pt-1 font-bold text-slate-900 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={confirmado}
                      onChange={(e) => setConfirmado(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>He revisado los valores y confirmo la emisión fiscal ante la DIAN.</span>
                  </label>
                </div>
              </div>

              {/* Botones de Acción */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl border-0 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !confirmado || balance.saldoDisponible <= 0 || !selectedRangeId}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl border-0 shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting && <FiRefreshCw className="animate-spin" size={13} />}
                  <span>{isSubmitting ? "Emitiendo ante DIAN..." : "Emitir Nota Crédito Oficial"}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
