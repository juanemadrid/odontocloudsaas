import supabase from "../lib/supabaseClient";

/**
 * Normaliza y extrae los registros de uso de un ciclo de esterilización
 * combinando tanto el arreglo interno `cycle.usos` como las evoluciones
 * registradas en la base de datos que hayan usado este ciclo.
 */
export function extractUsosForCycle(cycle, evolucionesList = []) {
  if (!cycle) return [];

  const directUsos = Array.isArray(cycle.usos) ? cycle.usos : [];
  const cycleLote = String(cycle.nroLote || cycle.consecutivo || "").trim().toUpperCase();
  const cycleId = String(cycle.id || "").trim();

  const evoUsos = [];
  (evolucionesList || []).forEach(evo => {
    let t = {};
    if (typeof evo.tratamiento === "string" && evo.tratamiento.startsWith("{")) {
      try {
        t = JSON.parse(evo.tratamiento);
      } catch (_) {}
    } else if (typeof evo.tratamiento === "object" && evo.tratamiento !== null) {
      t = evo.tratamiento;
    }

    const estList = t.esterilizaciones || evo.esterilizaciones || [];
    if (Array.isArray(estList)) {
      estList.forEach((st, idx) => {
        const stCiclo = String(st.ciclo || "").trim().toUpperCase();
        if (
          stCiclo &&
          (stCiclo === cycleLote ||
           stCiclo === cycleId ||
           stCiclo.includes(cycleLote) ||
           cycleLote.includes(stCiclo))
        ) {
          const rawDate = evo.fecha || t.fecha || t.date || evo.created_at;
          const fechaStr = rawDate ? String(rawDate).split("T")[0] : "";
          evoUsos.push({
            id: `evo_${evo.id || "temp"}_${idx}`,
            usuario: t.profesional || evo.profesional || t.doctor || t.transcribe || t.transcribedBy || "Usuario",
            paciente: t.patientName || evo.paciente_nombre || t.paciente || "Paciente",
            pacienteId: evo.paciente_id || t.paciente_id || t.patientId,
            fecha: fechaStr,
            concepto: st.concepto || "",
            cantidad: Number(st.cantidad) || 1,
            source: "evolucion",
            evolutionId: evo.id
          });
        }
      });
    }
  });

  // Combinar y deduplicar entre directUsos y evoUsos
  const combined = [...directUsos];
  evoUsos.forEach(eu => {
    const alreadyExists = combined.some(u =>
      (eu.evolutionId && u.evolutionId === eu.evolutionId && u.concepto === eu.concepto) ||
      (u.fecha === eu.fecha && u.paciente === eu.paciente && u.concepto === eu.concepto && Number(u.cantidad) === Number(eu.cantidad))
    );
    if (!alreadyExists) {
      combined.push(eu);
    }
  });

  // Ordenar del más reciente al más antiguo
  combined.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

  return combined;
}

/**
 * Calcula la disponibilidad de paquetes de un ciclo y de cada uno de sus conceptos.
 */
export function computeCycleAvailability(cycle, evolucionesList = []) {
  if (!cycle) return cycle;

  const allUsos = extractUsosForCycle(cycle, evolucionesList);
  const rawItems = Array.isArray(cycle.cargaItems) ? cycle.cargaItems : [];

  let totalDisponibles = 0;
  let totalOriginales = 0;

  const cargaItemsWithAvailability = rawItems.map(item => {
    const cantOriginal = Number(item.cantidad) || 0;
    totalOriginales += cantOriginal;

    const cantUsada = allUsos
      .filter(u => String(u.concepto || "").trim().toUpperCase() === String(item.concepto || "").trim().toUpperCase())
      .reduce((sum, u) => sum + (Number(u.cantidad) || 0), 0);

    const cantDisponible = Math.max(0, cantOriginal - cantUsada);
    totalDisponibles += cantDisponible;

    return {
      ...item,
      cantidadOriginal: cantOriginal,
      cantidadUsada: cantUsada,
      cantidadDisponible: cantDisponible
    };
  });

  // Si no hay items detallados en cargaItems, usar nroPaquetes
  if (rawItems.length === 0) {
    const nroPaq = Number(cycle.nroPaquetes) || 1;
    totalOriginales = nroPaq;
    const totalUsado = allUsos.reduce((sum, u) => sum + (Number(u.cantidad) || 0), 0);
    totalDisponibles = Math.max(0, nroPaq - totalUsado);
  }

  const isActivo = totalDisponibles > 0 && cycle.activo !== false;

  return {
    ...cycle,
    cargaItems: cargaItemsWithAvailability,
    totalPaquetesOriginales: totalOriginales,
    totalPaquetesDisponibles: totalDisponibles,
    usos: allUsos,
    isActivo
  };
}

/**
 * Registra en website_config y ciclos_esterilizacion los usos de paquetes
 * aplicados durante una evolución.
 */
export async function registerSterilizationUsages(tenantId, usages = []) {
  if (!tenantId || !Array.isArray(usages) || usages.length === 0) return;

  try {
    const { data: cfgRow } = await supabase
      .from("website_config")
      .select("config")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const currentConfig = cfgRow?.config || {};
    const cycles = Array.isArray(currentConfig.ciclos_esterilizacion)
      ? [...currentConfig.ciclos_esterilizacion]
      : [];

    let modified = false;

    for (const usage of usages) {
      const targetLote = String(usage.ciclo || "").trim().toUpperCase();
      const cycleIdx = cycles.findIndex(c =>
        String(c.nroLote || c.consecutivo || "").trim().toUpperCase() === targetLote ||
        String(c.id || "").trim() === targetLote
      );

      if (cycleIdx !== -1) {
        const cycle = cycles[cycleIdx];
        const existingUsos = Array.isArray(cycle.usos) ? [...cycle.usos] : [];
        
        const newUsage = {
          id: `uso_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          usuario: usage.usuario || "Usuario",
          paciente: usage.paciente || "Paciente",
          pacienteId: usage.pacienteId || null,
          fecha: usage.fecha || new Date().toISOString().split("T")[0],
          concepto: usage.concepto,
          cantidad: Number(usage.cantidad) || 1,
          evolutionId: usage.evolutionId || null,
          createdAt: new Date().toISOString()
        };

        existingUsos.push(newUsage);

        // Recalcular disponibilidad total
        const rawItems = Array.isArray(cycle.cargaItems) ? cycle.cargaItems : [];
        let remainingTotal = 0;
        if (rawItems.length > 0) {
          rawItems.forEach(it => {
            const original = Number(it.cantidad) || 0;
            const used = existingUsos
              .filter(u => String(u.concepto || "").trim().toUpperCase() === String(it.concepto || "").trim().toUpperCase())
              .reduce((sum, u) => sum + (Number(u.cantidad) || 0), 0);
            remainingTotal += Math.max(0, original - used);
          });
        } else {
          const original = Number(cycle.nroPaquetes) || 1;
          const used = existingUsos.reduce((sum, u) => sum + (Number(u.cantidad) || 0), 0);
          remainingTotal += Math.max(0, original - used);
        }

        const isCycleActive = remainingTotal > 0;

        cycles[cycleIdx] = {
          ...cycle,
          usos: existingUsos,
          activo: isCycleActive,
          updatedAt: new Date().toISOString()
        };

        modified = true;

        // Intentar actualizar también en la tabla ciclos_esterilizacion si existe
        try {
          await supabase
            .from("ciclos_esterilizacion")
            .update({
              usos: existingUsos,
              activo: isCycleActive,
              updatedAt: new Date().toISOString()
            })
            .eq("tenant_id", tenantId)
            .eq("id", cycle.id);
        } catch (_) {}
      }
    }

    if (modified) {
      await supabase
        .from("website_config")
        .upsert({
          tenant_id: tenantId,
          config: {
            ...currentConfig,
            ciclos_esterilizacion: cycles
          },
          updated_at: new Date().toISOString()
        }, { onConflict: "tenant_id" });
    }
  } catch (err) {
    console.error("Error al registrar usos de esterilización:", err);
  }
}
