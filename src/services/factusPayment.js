// Receipts store labels; Factus requires a catalog code.
export const factusPaymentCode = (raw) => {
  const value = String(raw || "10").trim();
  if (/^\d+$/.test(value) || value === "ZZZ") return value;
  const label = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (label.includes("efectivo") || label === "cash") return "10";
  if (label.includes("cheque")) return "20";
  if (label.includes("consigna") || label.includes("transfer") || label.includes("nequi") || label.includes("daviplata") || label.includes("banc")) return "42";
  if (label.includes("credito")) return "48";
  if (label.includes("debito")) return "49";
  throw new Error("PRE_VALIDATION: El medio de pago requiere un código Factus válido: " + value);
};
