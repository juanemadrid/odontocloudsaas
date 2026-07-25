export const PREDEFINED_TEMPLATES = [
  {
    id: 'formulario_fisico',
    nombre: 'FORMULARIO FISICO',
    isSystem: true,
    createdBy: 'Sistema',
    createdAt: '2026-07-09T12:00:00.000Z',
    campos: [
      { id: 'tension_arterial', label: 'TENSIÓN ARTERIAL', type: 'text' },
      { id: 'frecuencia_cardiaca', label: 'FRECUENCIA CARDÍACA (LPM)', type: 'number' },
      { id: 'frecuencia_respiratoria', label: 'FRECUENCIA RESPIRATORIA (RPM)', type: 'number' },
      { id: 'temperatura', label: 'TEMPERATURA (°C)', type: 'number' },
      { id: 'examen_fisico', label: 'DETALLE DEL EXAMEN FÍSICO', type: 'textarea' }
    ]
  },
  {
    id: 'alergias',
    nombre: 'ALERGIAS',
    isSystem: true,
    createdBy: 'Sistema',
    createdAt: '2026-07-09T12:00:00.000Z',
    campos: [
      { id: 'sustancias_alergicas', label: 'SUSTANCIAS O MEDICAMENTOS ALÉRGICOS', type: 'textarea' },
      { id: 'observaciones_alergias', label: 'OBSERVACIONES', type: 'textarea' }
    ]
  },
  {
    id: 'antecedentes',
    nombre: 'ANTECEDENTES',
    isSystem: true,
    createdBy: 'Sistema',
    createdAt: '2026-07-09T12:00:00.000Z',
    campos: [
      { id: 'antecedentes_patologicos', label: 'ANTECEDENTES PATOLÓGICOS', type: 'textarea' },
      { id: 'antecedentes_quirurgicos', label: 'ANTECEDENTES QUIRÚRGICOS', type: 'textarea' },
      { id: 'antecedentes_traumaticos', label: 'ANTECEDENTES TRAUMÁTICOS', type: 'textarea' },
      { id: 'antecedentes_alergicos', label: 'ANTECEDENTES ALÉRGICOS', type: 'textarea' },
      { id: 'antecedentes_familiares', label: 'ANTECEDENTES FAMILIARES', type: 'textarea' }
    ]
  },
  {
    id: 'atm',
    nombre: 'A.T.M',
    isSystem: true,
    createdBy: 'Sistema',
    createdAt: '2026-07-09T12:00:00.000Z',
    campos: [
      { id: 'normal', label: 'NORMAL', type: 'checkbox' },
      { id: 'problem_art_mandibula', label: 'PROBLEM. ARTI. DE MANDIBULA', type: 'checkbox' },
      { id: 'presencia_sintomas_subjetivos', label: 'PRESENCIA DE SINTOMAS SUBJETIVOS', type: 'checkbox' },
      { id: 'ruidos', label: 'RUIDOS', type: 'checkbox' },
      { id: 'dolor_atm', label: 'DOLOR ATM', type: 'checkbox' },
      { id: 'dolor_muscular', label: 'DOLOR MUSCULAR', type: 'checkbox' },
      { id: 'remision_especialista', label: 'REMISIÓN ESPECIALISTA', type: 'checkbox' },
      { id: 'desviaciones', label: 'DESVIACIONES', type: 'checkbox' },
      { id: 'limitacion_apertura', label: 'LIMITACIÓN APERTURA', type: 'checkbox' },
      { id: 'brinco', label: 'BRINCO', type: 'checkbox' },
      { id: 'cambio_volumen', label: 'CAMBIO DE VOLUMEN', type: 'checkbox' },
      { id: 'bloqueo_mandibular', label: 'BLOQUEO MANDIBULAR', type: 'checkbox' },
      { id: 'crepitacion', label: 'CREPITACIÓN', type: 'checkbox' },
      { id: 'maloclusion', label: 'MALOCLUSIÓN', type: 'checkbox' },
      { id: 'observaciones', label: 'Observaciones', type: 'textarea' },
      { id: 'tercera_firma', label: 'Tercera firma', type: 'toggle' }
    ]
  },
  {
    id: 'diagnostico',
    nombre: 'DIAGNÓSTICO',
    isSystem: true,
    createdBy: 'Sistema',
    createdAt: '2026-07-09T12:00:00.000Z',
    campos: [
      { id: 'diagnostico_principal', label: 'DIAGNÓSTICO PRINCIPAL (CIE-10)', type: 'text' },
      { id: 'observaciones_diagnostico', label: 'DETALLE / EVOLUCIÓN', type: 'textarea' }
    ]
  },
  {
    id: 'motivo_consulta',
    nombre: 'MOTIVO CONSULTA',
    isSystem: true,
    createdBy: 'Sistema',
    createdAt: '2026-07-09T12:00:00.000Z',
    campos: [
      { id: 'motivo_consulta_texto', label: 'MOTIVO DE CONSULTA', type: 'textarea' },
      { id: 'enfermedad_actual', label: 'ENFERMEDAD ACTUAL', type: 'textarea' }
    ]
  },
  {
    id: 'plan_tratamiento',
    nombre: 'PLAN DE TRATAMIENTO CLÍNICO',
    isSystem: true,
    createdBy: 'Sistema',
    createdAt: '2026-07-09T12:00:00.000Z',
    campos: [
      { id: 'fase_higienica', label: 'FASE HIGIÉNICA', type: 'textarea' },
      { id: 'fase_correctiva', label: 'FASE CORRECTIVA', type: 'textarea' },
      { id: 'fase_mantenimiento', label: 'FASE DE MANTENIMIENTO', type: 'textarea' }
    ]
  }
];
