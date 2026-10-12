/**
 * IHCE External RDA Service — Adaptador y Procesador de RDA Externos
 * 
 * Permite consultar, decodificar y estructurar Resúmenes Digitales de Atención (RDA)
 * emitidos por otras IPS hacia nuestros pacientes a través de la red nacional IHCE.
 * 
 * Convierte los recursos FHIR R4 heterogéneos en una vista clínica amigable
 * para la toma de decisiones del odontólogo tratante.
 */

class IhceExternalRdaService {
  constructor(options = {}) {
    this.syntheticRepository = options.syntheticRepository || new Map();
    this._initializeSyntheticData();
  }

  /**
   * Carga ejemplos sintéticos de RDA externos para pruebas y demostración
   */
  _initializeSyntheticData() {
    // RDA Sintético 1: Atención de Urgencia en Hospital San Vicente
    const sampleRda1 = {
      id: 'ext-rda-001-medellin',
      fecha: '2026-08-15T14:30:00Z',
      institucionEmisora: 'Hospital Universitario San Vicente Fundación',
      repsEmisor: '050010023401',
      profesional: {
        nombre: 'Dr. Julián Restrepo Montoya',
        especialidad: 'Cirugía Oral y Maxilofacial',
        registroMedico: 'RETHUS-05-99881'
      },
      paciente: {
        tipoDocumento: 'CC',
        documento: '1018234567',
        nombreCompleto: 'Carlos Sintético Apolo'
      },
      atencion: {
        modalidad: 'Intramural (Urgencias)',
        motivoConsulta: 'Dolor agudo en región mandibular posterior derecha secundario a trauma leve',
        diagnosticos: [
          {
            codigo: 'S025',
            descripcion: 'Fractura de los dientes',
            tipo: 'Confirmado nuevo'
          },
          {
            codigo: 'K040',
            descripcion: 'Pulpitis aguda irreversible',
            tipo: 'Confirmado nuevo'
          }
        ],
        procedimientos: [
          {
            codigo: '890201',
            descripcion: 'Consulta de urgencias odontológicas',
            fecha: '2026-08-15'
          },
          {
            codigo: '237101',
            descripcion: 'Pulpectomía coronal de urgencia',
            fecha: '2026-08-15'
          }
        ],
        evolucionClinica: 'Se realiza trepanación y pulpectomía cameral en pieza 46 bajo anestesia infiltrativa con lidocaína 2%. Se sella con cemento provisional. Se remite a odontología general para endodoncia definitiva.',
        alergiasAdvertencias: ['Alergia reportada: Penicilina (Reacción cutánea moderada)']
      }
    };

    this.syntheticRepository.set('1018234567', [sampleRda1]);
  }

  /**
   * Consulta los RDA externos disponibles para un paciente por su tipo y número de documento.
   */
  async fetchExternalRdasByPatient(tipoDocumento, documento) {
    if (!documento) {
      return [];
    }

    // En entorno aislado, consultar el repositorio sintético
    const rdas = this.syntheticRepository.get(documento) || [];
    return rdas;
  }

  /**
   * Parsea un Bundle FHIR R4 externo recibido en bruto y extrae los datos clínicos estructurados.
   */
  parseExternalFhirBundle(bundle) {
    if (!bundle || bundle.resourceType !== 'Bundle' || !Array.isArray(bundle.entry)) {
      throw new Error('BUNDLE_INVALID: El recurso no corresponde a un Bundle FHIR válido.');
    }

    const composition = bundle.entry.find(e => e.resource?.resourceType === 'Composition')?.resource;
    const patient = bundle.entry.find(e => e.resource?.resourceType === 'Patient')?.resource;
    const encounter = bundle.entry.find(e => e.resource?.resourceType === 'Encounter')?.resource;
    const practitioner = bundle.entry.find(e => e.resource?.resourceType === 'Practitioner')?.resource;
    const organization = bundle.entry.find(e => e.resource?.resourceType === 'Organization')?.resource;
    const conditions = bundle.entry.filter(e => e.resource?.resourceType === 'Condition').map(e => e.resource);
    const procedures = bundle.entry.filter(e => e.resource?.resourceType === 'Procedure').map(e => e.resource);

    return {
      id: bundle.id,
      fecha: composition?.date || encounter?.period?.start || new Date().toISOString(),
      titulo: composition?.title || 'Resumen Digital de Atención Odontológica',
      institucionEmisora: organization?.name || 'Prestador Nacional Externo',
      repsEmisor: organization?.identifier?.find(i => i.system?.includes('reps'))?.value || 'N/A',
      profesional: {
        nombre: practitioner?.name?.[0]?.text || 'Profesional no identificado',
        especialidad: practitioner?.qualification?.[0]?.code?.text || 'Odontología General',
        registroMedico: practitioner?.identifier?.find(i => i.system?.includes('rethus'))?.value || 'N/A'
      },
      paciente: {
        tipoDocumento: patient?.identifier?.[0]?.type?.coding?.[0]?.code || 'CC',
        documento: patient?.identifier?.[0]?.value || 'N/A',
        nombreCompleto: patient?.name?.[0]?.text || 'Paciente'
      },
      atencion: {
        modalidad: encounter?.extension?.find(e => e.url?.includes('CoModalidadAtencion'))?.valueCoding?.display || 'Consulta Intramural',
        diagnosticos: conditions.map(c => ({
          codigo: c.code?.coding?.[0]?.code || 'N/A',
          descripcion: c.code?.coding?.[0]?.display || c.code?.text || 'Diagnóstico',
          tipo: 'Confirmado'
        })),
        procedimientos: procedures.map(p => ({
          codigo: p.code?.coding?.[0]?.code || 'N/A',
          descripcion: p.code?.coding?.[0]?.display || p.code?.text || 'Procedimiento',
          fecha: p.performedDateTime || 'N/A'
        })),
        evolucionClinica: composition?.section?.[0]?.text?.div || 'Sin notas clínicas detalladas.',
        alergiasAdvertencias: []
      }
    };
  }
}

export { IhceExternalRdaService };
