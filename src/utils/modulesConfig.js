/**
 * Configuración y catálogo maestro de módulos de OdontoCloud
 * Permite al SuperAdmin activar/desactivar módulos por clínica independientemente o según su plan.
 */

export const SYSTEM_MODULES = [
  // ── Módulos Clínicos ──
  {
    id: "agenda",
    name: "Agenda Inteligente",
    description: "Calendario de citas, turnos y recordatorios por WhatsApp.",
    category: "Clínico",
    icon: "FiCalendar",
    badge: "Básico",
    defaultPlans: ["consultorio", "clinica", "enterprise", "trial"]
  },
  {
    id: "pacientes",
    name: "Pacientes e Historia Clínica",
    description: "Fichas clínicas, antecedentes médicos, evoluciones y consentimientos digitales.",
    category: "Clínico",
    icon: "FiUsers",
    badge: "Básico",
    defaultPlans: ["consultorio", "clinica", "enterprise", "trial"]
  },
  {
    id: "odontograma",
    name: "Odontograma Interactivo",
    description: "Odontograma visual digital, presupuestos odontológicos y planes de tratamiento.",
    category: "Clínico",
    icon: "FiActivity",
    badge: "Básico",
    defaultPlans: ["consultorio", "clinica", "enterprise", "trial"]
  },

  // ── Módulos Financieros y Caja ──
  {
    id: "caja",
    name: "Caja y Pagos",
    description: "Control de caja diaria, recibos de caja, abonos y saldo a favor del paciente.",
    category: "Financiero",
    icon: "FiDollarSign",
    badge: "Básico",
    defaultPlans: ["consultorio", "clinica", "enterprise", "trial"]
  },
  {
    id: "reportes",
    name: "Reportes y Estadísticas",
    description: "Reportes de ingresos, citas, productividad y arqueos de caja.",
    category: "Financiero",
    icon: "FiPieChart",
    badge: "Básico",
    defaultPlans: ["consultorio", "clinica", "enterprise", "trial"]
  },
  {
    id: "liquidaciones",
    name: "Liquidaciones Médicas",
    description: "Cálculo y pago de comisiones y honorarios a profesionales médicos.",
    category: "Financiero",
    icon: "FiPercent",
    badge: "Avanzado",
    defaultPlans: ["clinica", "enterprise"]
  },

  // ── Facturación Electrónica & Normativa DIAN ──
  {
    id: "facturacion_electronica",
    name: "Facturación Electrónica DIAN",
    description: "Emisión de facturas electrónicas de venta y notas crédito timbradas ante la DIAN.",
    category: "Facturación & DIAN",
    icon: "FiFileText",
    badge: "Plan Clínica / Enterprise",
    defaultPlans: ["clinica", "enterprise"]
  },
  {
    id: "rips",
    name: "RIPS JSON (Res. 2275)",
    description: "Generación y validación de archivos RIPS JSON oficiales del Ministerio de Salud.",
    category: "Facturación & DIAN",
    icon: "FiActivity",
    badge: "Plan Clínica / Enterprise",
    defaultPlans: ["clinica", "enterprise"]
  },

  // ── Operaciones y Administración ──
  {
    id: "administracion",
    name: "Módulo de Administración",
    description: "Acceso al hub general de administración de la clínica.",
    category: "Administrativo",
    icon: "FiBriefcase",
    badge: "Básico",
    defaultPlans: ["consultorio", "clinica", "enterprise", "trial"]
  },
  {
    id: "convenios",
    name: "Convenios y Tarifarios",
    description: "Tarifas diferenciales, aseguradoras y convenios empresariales.",
    category: "Administrativo",
    icon: "FiCheckSquare",
    badge: "Plan Clínica / Enterprise",
    defaultPlans: ["clinica", "enterprise"]
  },
  {
    id: "terceros",
    name: "Terceros y Proveedores",
    description: "Directorio de proveedores, laboratorios dentales y compras.",
    category: "Administrativo",
    icon: "FiUsers",
    badge: "Básico",
    defaultPlans: ["consultorio", "clinica", "enterprise", "trial"]
  },
  {
    id: "residuos",
    name: "Residuos Hospitalarios (RH1)",
    description: "Bitácora de gestión ambiental y residuos biológicos normativos.",
    category: "Administrativo",
    icon: "FiTrash2",
    badge: "Básico",
    defaultPlans: ["consultorio", "clinica", "enterprise", "trial"]
  },
  {
    id: "esterilizacion",
    name: "Esterilización y Autoclaves",
    description: "Bitácora y controles biológicos de esterilización de instrumental.",
    category: "Administrativo",
    icon: "FiShield",
    badge: "Básico",
    defaultPlans: ["consultorio", "clinica", "enterprise", "trial"]
  },

  // ── Marketing & Expansión ──
  {
    id: "cms",
    name: "Sitio Web Corporativo (CMS)",
    description: "Página web propia de la clínica con reservas y agendamiento en línea.",
    category: "Web & Expansión",
    icon: "FiLayout",
    badge: "Plan Clínica / Enterprise",
    defaultPlans: ["clinica", "enterprise"]
  },
  {
    id: "sucursales",
    name: "Múltiples Sedes / Sucursales",
    description: "Gestión simultánea de más de una sede o consultorio físico.",
    category: "Web & Expansión",
    icon: "FiMapPin",
    badge: "Plan Clínica / Enterprise",
    defaultPlans: ["clinica", "enterprise"]
  }
];

/**
 * Obtiene los módulos que por defecto están DESACTIVADOS para un plan específico
 */
export const getPlanDefaultDisabledModules = (planId = "consultorio") => {
  const p = (planId || "").toLowerCase();
  
  if (p.includes("enterprise") || p.includes("ips")) {
    return []; // Enterprise tiene todo activo
  }
  
  if (p.includes("clinica") || p.includes("pro")) {
    // Clínica tiene todo activo por defecto
    return [];
  }

  // Plan Consultorio (o free / basic):
  // Desactiva Facturación DIAN, RIPS, CMS, Sucursales, Convenios y Liquidaciones
  return [
    "facturacion_electronica",
    "rips",
    "cms",
    "sucursales",
    "convenios",
    "liquidaciones"
  ];
};

/**
 * Resuelve los módulos desactivados para un plan (ya sea por objeto plan configurado o por ID de plan)
 */
export const getDisabledModulesForPlan = (planOrId) => {
  if (!planOrId) return getPlanDefaultDisabledModules("consultorio");

  if (typeof planOrId === "object") {
    if (Array.isArray(planOrId.disabled_modules)) {
      return planOrId.disabled_modules;
    }
    if (Array.isArray(planOrId.included_modules)) {
      return SYSTEM_MODULES.map(m => m.id).filter(id => !planOrId.included_modules.includes(id));
    }
    return getPlanDefaultDisabledModules(planOrId.id || planOrId.name);
  }

  return getPlanDefaultDisabledModules(String(planOrId));
};

/**
 * Resuelve los módulos incluidos (activos) para un plan
 */
export const getIncludedModulesForPlan = (planOrId) => {
  const disabled = getDisabledModulesForPlan(planOrId);
  return SYSTEM_MODULES.map(m => m.id).filter(id => !disabled.includes(id));
};

/**
 * Comprueba si un módulo específico está habilitado para un tenant dado
 */
export const isTenantModuleEnabled = (tenant, moduleId) => {
  if (!tenant || !moduleId) return true;

  const targetId = String(moduleId).toLowerCase().trim();
  const disabledModules = tenant.disabled_modules || tenant.parametros?.disabled_modules || [];

  if (Array.isArray(disabledModules) && disabledModules.includes(targetId)) {
    return false;
  }

  return true;
};

/**
 * Mapea nombres de módulos o features de usePermissions hacia el ID canónico del módulo
 */
export const mapFeatureToModuleId = (moduleName, featureName) => {
  const m = (moduleName || "").toLowerCase();
  const f = (featureName || "").toLowerCase();

  if (f.includes("rip") || m.includes("rip")) return "rips";
  if (f.includes("factura de venta") || f.includes("menú facturación") || f.includes("facturacion") || m.includes("facturaci")) {
    return "facturacion_electronica";
  }
  if (f.includes("convenio") || m.includes("convenio")) return "convenios";
  if (f.includes("residuo") || m.includes("residuo")) return "residuos";
  if (f.includes("esteriliz") || m.includes("esteriliz")) return "esterilizacion";
  if (f.includes("editor web") || f.includes("cms") || m.includes("cms")) return "cms";
  if (f.includes("sucursal") || m.includes("sucursal")) return "sucursales";
  if (f.includes("liquidacion") || m.includes("liquidacion")) return "liquidaciones";
  if (f.includes("tercero") || m.includes("tercero")) return "terceros";
  if (f.includes("agenda") || m.includes("agenda")) return "agenda";
  if (f.includes("paciente") || m.includes("paciente")) return "pacientes";
  if (f.includes("odontograma") || m.includes("odontograma")) return "odontograma";
  if (f.includes("caja") || m.includes("caja")) return "caja";
  if (f.includes("reporte") || m.includes("reporte")) return "reportes";

  return null;
};
