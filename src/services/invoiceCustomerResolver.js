import { billingPatient } from '../utils/billingPresentation.js';

// Read the current identity from this clinic; never rewrite the original fiscal invoice.
export async function resolveInvoiceCustomer({client,tenantId,invoice,patient}) {
  if (!tenantId || (invoice.tenant_id && invoice.tenant_id !== tenantId)) throw new Error('La factura no pertenece a la clínica autorizada.');
  const details=invoice.detalles || {};
  const original=billingPatient(details.paciente || invoice.paciente || details.tercero || patient || {});
  const document=String(details.pacienteDocumento || original.documento || '').trim();
  if (!document) throw new Error('Falta el documento del cliente de la factura original.');
  if (patient && String(billingPatient(patient).documento || '').trim() !== document) throw new Error('El cliente indicado no corresponde al documento de la factura.');

  let query=client.from('pacientes').select('*').eq('tenant_id',tenantId);
  query=invoice.paciente_id ? query.eq('id',invoice.paciente_id) : query.eq('documento',document);
  const {data:patients,error:patientError}=await query;
  if (patientError) throw new Error('No se pudo consultar la ficha actual del paciente: '+patientError.message);
  const patientMatches=(patients || []).map(billingPatient).filter(person=>String(person.documento || '').trim()===document);
  if (invoice.paciente_id && patientMatches.length!==1) throw new Error('La ficha vinculada no coincide con el cliente de la factura.');
  if (patientMatches.length>1) throw new Error('Hay varias fichas con el mismo documento. Revise la identidad antes de emitir.');
  let master=patientMatches[0];
  if (!master) {
    const {data:thirds,error:thirdError}=await client.from('terceros').select('*').eq('tenant_id',tenantId).eq('nro_documento',document);
    if (thirdError && !['42P01','PGRST205'].includes(thirdError.code)) throw new Error('No se pudo consultar el tercero: '+thirdError.message);
    let matches=(thirds || []).map(billingPatient).filter(person=>String(person.documento || '').trim()===document);
    if (!matches.length) {
      const {data:config,error:configError}=await client.from('website_config').select('config').eq('tenant_id',tenantId).maybeSingle();
      if (configError) throw configError;
      const rows=Array.isArray(config?.config?.terceros) ? config.config.terceros : [];
      matches=rows.map(billingPatient).filter(person=>String(person.documento || '').trim()===document);
    }
    if (matches.length>1) throw new Error('Hay varios terceros con el mismo documento. Revise la identidad antes de emitir.');
    master=matches[0];
  }
  const current=master || original;
  const name=current.nombreCompleto;
  const company=Boolean(current.razonSocial || current.razon_social || current.company);
  if (!name || (!company && !/\S+\s+\S+/.test(name))) {
    throw new Error('Complete los nombres y apellidos del paciente o tercero antes de emitir la nota crédito.');
  }
  // Keep the fiscal document and its contact snapshot; refresh only the verified name.
  return {...original,documento:document,nombre:name,nombreCompleto:name};
}
