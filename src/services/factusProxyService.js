import supabase from "../lib/supabaseClient.js";

export const invokeFactusProxy = async (action, payload = {}) => {
  const { data, error } = await supabase.functions.invoke("factus-proxy", {
    body: { action, ...payload },
  });

  if (error) {
    let message = error.message || "No fue posible contactar el servicio Factus.";
    try {
      const details = await error.context?.json();
      message = details?.error || message;
    } catch {
      // La respuesta no siempre incluye JSON.
    }
    throw new Error(message);
  }

  if (!data?.success) {
    throw new Error(data?.error || "La operacion Factus fue rechazada.");
  }
  return data;
};

export const getFactusStatus = (tenantId) =>
  invokeFactusProxy("status", tenantId ? { tenantId } : {});

export const configureFactus = (tenantId, config) =>
  invokeFactusProxy("configure", { tenantId, config });

export const testFactusCredentials = (config) =>
  invokeFactusProxy("test", { config });

export const getFactusRanges = () =>
  invokeFactusProxy("ranges");

export const sendFactusBill = (payload) =>
  invokeFactusProxy("send_bill", { payload });

export const downloadFactusPdf = (billNumber) =>
  invokeFactusProxy("download_pdf", { billNumber });

export const downloadFactusAttachedDocumentXml = (billNumber) =>
  invokeFactusProxy("download_attached_document", { billNumber });

export const sendFactusSupportDocument = (payload) =>
  invokeFactusProxy("send_support_document", { payload });

export const sendFactusAdjustmentNote = (payload) =>
  invokeFactusProxy("send_adjustment_note", { payload });

export const downloadFactusSupportDocumentPdf = (number) =>
  invokeFactusProxy("download_support_document_pdf", { number });

export const checkFactusBill = ({ billNumber, referenceCode, tenantId }) =>
  invokeFactusProxy("check_bill", {
    ...(billNumber ? { billNumber } : {}),
    ...(referenceCode ? { referenceCode } : {}),
    ...(tenantId ? { tenantId } : {}),
  });

export const deleteUnvalidatedFactusBill = ({ referenceCode, invoiceId, tenantId }) =>
  invokeFactusProxy("delete_unvalidated_bill", {
    referenceCode,
    ...(invoiceId ? { invoiceId } : {}),
    ...(tenantId ? { tenantId } : {}),
  });

export const sendFactusCreditNote = (payload) =>
  invokeFactusProxy("send_credit_note", { payload });

export const checkFactusCreditNote = ({ number, referenceCode, tenantId }) =>
  invokeFactusProxy("check_credit_note", {
    ...(number ? { number } : {}),
    ...(referenceCode ? { referenceCode } : {}),
    ...(tenantId ? { tenantId } : {}),
  });

export const deleteUnvalidatedFactusCreditNote = ({ referenceCode, creditNoteId, tenantId }) =>
  invokeFactusProxy("delete_unvalidated_credit_note", {
    referenceCode,
    ...(creditNoteId ? { creditNoteId } : {}),
    ...(tenantId ? { tenantId } : {}),
  });

export const downloadFactusCreditNotePdf = (number) =>
  invokeFactusProxy("download_credit_note_pdf", { number });

export const downloadFactusCreditNoteXml = (number) =>
  invokeFactusProxy("download_credit_note_xml", { number });



