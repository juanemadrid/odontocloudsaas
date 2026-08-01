import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jhdflchyhkwpedtbkusp.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConfigPersistence() {
  console.log("=== COMPROBANDO GUARDADO EN website_config JSON ===");

  const tenantId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"; // Main tenant / master

  // Fetch current website_config
  const { data: cfgRow, error: fErr } = await supabase
    .from("website_config")
    .select("config")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (fErr) {
    console.error("Error consultando website_config:", fErr);
    return;
  }

  const currentConfig = cfgRow?.config || {};
  const currentTemplates = Array.isArray(currentConfig.plantillas_clinicas) ? currentConfig.plantillas_clinicas : [];

  console.log(`Actualmente hay ${currentTemplates.length} plantillas personalizadas en website_config.`);

  const newTemplate = {
    id: "tmpl_implantologia_" + Date.now(),
    nombre: "CONSENTIMIENTO DE IMPLANTOLOGÍA Y CIRUGÍA DENTAL",
    cuerpo: "Yo [NombrePaciente], identificado(a) con [TipoDocumento] N° [Documento], declaro que el Dr. [Doctor] me ha explicado el procedimiento quirúrgico de implantes dentales en la fecha [Fecha].\n\nFirma Paciente: [FirmaPaciente]\nFirma Odontólogo: [FirmaDoctor]",
    contenido: "Yo [NombrePaciente], identificado(a) con [TipoDocumento] N° [Documento], declaro que el Dr. [Doctor] me ha explicado el procedimiento quirúrgico de implantes dentales en la fecha [Fecha].\n\nFirma Paciente: [FirmaPaciente]\nFirma Odontólogo: [FirmaDoctor]",
    campos: [
      { id: "c1", type: "text", label: "DIAGNÓSTICO PREQUIRÚRGICO", required: true },
      { id: "c2", type: "select", label: "TIPO DE ANESTESIA", options: ["LOCAL", "SEDACIÓN"], required: true },
      { id: "c3", type: "checkbox", label: "ACEPTA INDICACIONES POSTOPERATORIAS", required: true }
    ],
    terceraFirma: true,
    created_at: new Date().toISOString(),
    created_by: "johnemadrid@gmail.com"
  };

  const updatedTemplates = [...currentTemplates, newTemplate];
  const newConfig = {
    ...currentConfig,
    plantillas_clinicas: updatedTemplates,
    updatedAt: new Date().toISOString()
  };

  const { error: uErr } = await supabase
    .from("website_config")
    .upsert({ tenant_id: tenantId, config: newConfig }, { onConflict: "tenant_id" });

  if (uErr) {
    console.error("Error guardando plantilla en website_config:", uErr);
  } else {
    console.log("✅ Plantilla clínica registrada exitosamente en website_config JSON!");
    console.log("Total de plantillas en clínica:", updatedTemplates.length);
    updatedTemplates.forEach((t, i) => {
      console.log(` ${i + 1}. [${t.id}] ${t.nombre} (${t.campos?.length || 0} campos)`);
    });
  }
}

testConfigPersistence();
