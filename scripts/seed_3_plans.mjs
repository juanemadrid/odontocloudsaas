import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseAnonKey = 'sb_publishable_G87lxtV9IRKBUA71AFGzmA_8c5qz8wB';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const SUPERADMIN_TENANT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

async function seedThreePlans() {
  console.log("Iniciando sesión como SuperAdmin...");
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: "madridsystem@outlook.es",
    password: process.env.ODONTOCLOUD_TEST_PASSWORD
  });

  if (authError) {
    console.error("Error de autenticación:", authError.message);
    return;
  }

  console.log("Configurando 3 planes estratégicos en Supabase...");

  const threePlans = [
    {
      id: "plan-basico-cop",
      name: "Consultorio Básico",
      description: "Ideal para odontólogos independientes y pequeños consultorios particulares.",
      maxUsers: 3,
      monthlyPrice: 89000,
      yearlyPrice: 890000,
      includeFacturacion: false,
      facturasIncluidas: 0,
      recommended: false,
      features: [
        "Hasta 3 Usuarios (Odontólogo + Asistentes)",
        "Agenda Inteligente con Recordatorios WhatsApp",
        "Gestión de Pacientes e Historia Clínica Digital",
        "Odontograma 3D Interactivo",
        "Control de Citas y Estado de Consultas"
      ]
    },
    {
      id: "plan-pro-cop",
      name: "Clínica Profesional",
      description: "La solución completa preferida por clínicas dentales en crecimiento.",
      maxUsers: 10,
      monthlyPrice: 189000,
      yearlyPrice: 1890000,
      includeFacturacion: true,
      facturasIncluidas: 500,
      recommended: true,
      features: [
        "Hasta 10 Usuarios (Odontólogos + Recepción)",
        "⚡ Facturación Electrónica DIAN (500 facturas/mes)",
        "RIPS y Normativa Minsalud Vigente",
        "Control de Inventarios e Insumos Dentales",
        "Liquidación y Porcentajes para Odontólogos"
      ]
    },
    {
      id: "plan-enterprise-cop",
      name: "IPS Enterprise Multi-Sede",
      description: "Diseñado para redes de clínicas, IPS odontológicas y alta demanda.",
      maxUsers: 50,
      monthlyPrice: 349000,
      yearlyPrice: 3490000,
      includeFacturacion: true,
      facturasIncluidas: 2000,
      recommended: false,
      features: [
        "Usuarios y Sillas Odontológicas Ampliadas",
        "⚡ Facturación Electrónica DIAN (2.000 facturas/mes)",
        "Gestión Multi-Sucursal y Multi-Sede",
        "Sitio Web Corporativo Personalizado (CMS)",
        "Reportes Financieros Avanzados e IA",
        "Soporte Técnico Prioritario 24/7"
      ]
    }
  ];

  const { data: existing } = await supabase
    .from("website_config")
    .select("config")
    .eq("tenant_id", SUPERADMIN_TENANT_ID)
    .maybeSingle();

  const updatedConfig = {
    ...(existing?.config || {}),
    plans: threePlans,
    updatedAt: new Date().toISOString()
  };

  const { error } = await supabase
    .from("website_config")
    .upsert({
      tenant_id: SUPERADMIN_TENANT_ID,
      config: updatedConfig,
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error("Error al guardar los 3 planes:", error.message);
  } else {
    console.log("🚀 ¡Los 3 planes estratégicos en COP se guardaron exitosamente en Supabase PostgreSQL!");
  }
}

seedThreePlans();
