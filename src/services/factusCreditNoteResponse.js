// V2 returns the note itself in data; data.bill is the RELATED invoice.
export function readValidatedCreditNote(response, { referenceCode, billNumber } = {}) {
  const root = response?.result || response;
  const data = root?.data || root;
  const note = data?.credit_note || root?.credit_note || data;
  const valid = note?.is_validated === true || note?.is_validated === 1 || note?.is_validated === '1';
  const number = String(note?.number || '').trim();
  const cude = String(note?.cude || '').trim();
  if (!valid || !number || !/^[a-f0-9]{96}$/i.test(cude) || number === billNumber ||
      (referenceCode && note?.reference_code !== referenceCode)) {
    const error = new Error('Factus respondió sin una nota crédito validada con número, referencia y CUDE verificables. Consulte su estado; no vuelva a emitirla.');
    error.code = 'CREDIT_NOTE_RESPONSE_INDETERMINATE';
    throw error;
  }
  let validatedAt = note.validated_at;
  if (validatedAt) {
    const match = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2}) (AM|PM)$/.exec(validatedAt);
    if (match) {
      const [,day,month,year,hour,minute,second,period] = match;
      validatedAt = `${year}-${month}-${day}T${String(Number(hour)%12+(period==='PM'?12:0)).padStart(2,'0')}:${minute}:${second}-05:00`;
    }
    if (!/^\d{4}-\d{2}-\d{2}T/.test(validatedAt) || !Number.isFinite(Date.parse(validatedAt))) {
      const error = new Error('La fecha de validación de la nota crédito no es válida.');
      error.code = 'CREDIT_NOTE_RESPONSE_INDETERMINATE';
      throw error;
    }
  }
  return {...note,validated_at:validatedAt};
}
