const clean = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';

export function billingFullName(person = {}) {
  if (typeof person === 'string') return clean(person);
  const company = clean(person.razonSocial || person.razon_social || person.company);
  if (String(person.tipoPersona || person.tipo_persona).toLowerCase() === 'juridica' && company) return company;
  const explicit = clean(person.nombreCompleto || person.nombre_completo || person.full_name);
  if (explicit) return explicit;
  const first = clean(person.nombres || person.nombre || person.names);
  const last = clean(person.apellidos || person.apellido || person.last_names);
  if (!last || first.toLocaleLowerCase().endsWith(' ' + last.toLocaleLowerCase()) || first.toLocaleLowerCase() === last.toLocaleLowerCase()) return first || company;
  return [first,last].filter(Boolean).join(' ') || company;
}

export function billingItemDescription(item = {}) {
  const code = clean(String(item.code_reference || item.code || item.cups || item.codigo || ''));
  const candidates = [item.descripcion,item.nombre,item.name,item.procedimiento,item.concepto].map(clean).filter(Boolean);
  const text = candidates.find(value => value !== code && !/^\d+$/.test(value) && !/^servicio(?: odontológico)?$/i.test(value)) || candidates.find(value => value !== code && !/^\d+$/.test(value)) || '';
  if (!text) return 'Servicio Odontológico';
  if (!code) return text;
  const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp('^' + escaped + '\\s*(?:[-–—:]\\s*|\\s+)', 'i'), '').trim() || text;
}

export function billingPatient(person = {}) {
  const city = person.ciudadDomicilio || person.ciudad || person.municipio || person.municipality;
  const address = clean(person.direccionDomicilio || person.lugarResidencia || person.direccion || person.address);
  const neighborhood = clean(person.barrio);
  return { ...person, nombreCompleto:billingFullName(person),
    documento:person.documento || person.nroDocumento || person.numero_documento || person.nro_documento || person.identification,
    direccion:neighborhood && !address.toLocaleLowerCase().includes(neighborhood.toLocaleLowerCase()) ? [address,neighborhood].filter(Boolean).join(' - ') : address,
    ciudad:typeof city === 'object' ? city?.name || city?.nombre : city,
    telefono:person.telefono || person.celular || person.phone,
  };
}
