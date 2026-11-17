// Videos tutoriales de OdontoCloud (YouTube «Oculto»: solo se ven con el enlace, que vive aquí dentro del sistema).
// Para agregar un video: pega el código de YouTube en `youtube` (lo que va después de youtu.be/).
// Los videos sin código no se muestran.
// `guias`: ids de la Biblioteca (supabase/functions/_shared/helpKnowledge.mjs) donde aparece el botón «Ver video».

export const HELP_VIDEO_SERIES = ["Configuración", "Uso diario"];

export const HELP_VIDEOS = [
  { id: "config-1", serie: "Configuración", orden: 1, titulo: "Datos de la clínica", youtube: "a6LSxKEqHqM", guias: ["empresa"], palabras: "datos basicos clinica empresa nit logo reps prestador configuracion inicial" },
  { id: "config-2", serie: "Configuración", orden: 2, titulo: "Consecutivos", youtube: "-n1RehnWRGU", guias: [], palabras: "consecutivos numeracion recibos facturas prefijo" },
  { id: "config-3", serie: "Configuración", orden: 3, titulo: "Lista de precios", youtube: "d7KRMJHklcg", guias: ["precios"], palabras: "lista de precios procedimientos tarifas cups productos ajuste global" },
  { id: "config-4", serie: "Configuración", orden: 4, titulo: "Planes y paquetes", youtube: "hXfVsDuOjDw", guias: ["precios"], palabras: "planes paquetes tratamientos" },
  { id: "config-5", serie: "Configuración", orden: 5, titulo: "Sedes", youtube: "oJjdT-TcsVg", guias: ["sedes"], palabras: "sedes sucursales pie de pagina" },
  { id: "config-6", serie: "Configuración", orden: 6, titulo: "Recursos físicos", youtube: "z-O3YzECu38", guias: ["sedes", "horarios"], palabras: "recursos fisicos sillon consultorio espacio clinico" },
  { id: "config-7", serie: "Configuración", orden: 7, titulo: "Especialidades y perfiles", youtube: "3tovKxKjLBw", guias: ["especialidades"], palabras: "especialidades perfiles permisos roles" },
  { id: "config-8", serie: "Configuración", orden: 8, titulo: "Usuarios", youtube: "FwSWWqiEzNY", guias: ["usuarios"], palabras: "usuarios doctores odontologos crear usuario contrasena firma sispro" },
  { id: "config-9", serie: "Configuración", orden: 9, titulo: "Configuración 9", youtube: "", guias: [], palabras: "" },
  { id: "config-10", serie: "Configuración", orden: 10, titulo: "Pacientes, plantillas y cargas", youtube: "Psil3g8-uF0", guias: ["formularios", "importar-pacientes"], palabras: "formulario de pacientes plantillas documentos clinicos cargas importar excel" },
  { id: "config-11", serie: "Configuración", orden: 11, titulo: "Facturación, IHCE y suscripción", youtube: "hJV9_pT513o", guias: ["suscripcion", "proveedor-electronico"], palabras: "facturacion electronica factus ihce interoperabilidad suscripcion" },
  { id: "uso-1", serie: "Uso diario", orden: 1, titulo: "Pacientes", youtube: "", guias: ["pacientes", "ficha-paciente"], palabras: "crear paciente buscar paciente ficha" },
  { id: "uso-2", serie: "Uso diario", orden: 2, titulo: "Apartar una cita", youtube: "", guias: ["citas", "editar-cita"], palabras: "agendar cita apartar cita agenda" },
  { id: "uso-3", serie: "Uso diario", orden: 3, titulo: "Historia clínica", youtube: "", guias: ["historia", "evoluciones", "odontograma"], palabras: "historia clinica evolucion odontograma consulta" },
  { id: "uso-4", serie: "Uso diario", orden: 4, titulo: "Presupuestos y planes de tratamiento", youtube: "", guias: ["presupuestos"], palabras: "presupuesto plan de tratamiento" },
  { id: "uso-5", serie: "Uso diario", orden: 5, titulo: "Caja", youtube: "", guias: ["abrir-caja", "pagos-paciente", "cerrar-caja"], palabras: "abrir caja cerrar caja pago abono arqueo" },
  { id: "uso-6", serie: "Uso diario", orden: 6, titulo: "Factura electrónica y RIPS", youtube: "", guias: ["facturas", "rips", "facturacion-dian-rips"], palabras: "factura electronica dian nota credito rips" },
  { id: "uso-7", serie: "Uso diario", orden: 7, titulo: "Inventario", youtube: "", guias: [], palabras: "inventario insumos stock kardex entrada salida ajuste" },
];

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Videos publicados (con código de YouTube), en orden de serie y número. */
export function videosDisponibles() {
  return HELP_VIDEOS.filter((v) => v.youtube)
    .sort((a, b) => HELP_VIDEO_SERIES.indexOf(a.serie) - HELP_VIDEO_SERIES.indexOf(b.serie) || a.orden - b.orden);
}

/** Primer video publicado asociado a alguna de estas guías. */
export function videoParaGuias(guideIds = []) {
  const ids = new Set(guideIds.filter(Boolean));
  return videosDisponibles().find((v) => v.guias.some((g) => ids.has(g))) || null;
}

/** Video publicado cuyas palabras clave coinciden mejor con una pregunta (mínimo 2 palabras con contenido en común). */
const VACIAS = new Set(["como", "para", "donde", "cual", "cuales", "quiero", "puedo", "hacer", "tengo", "sistema", "odontocloud", "esta", "este", "estos"]);
// Raíz simple: sin tildes y sin plural («usuarios» → «usuari», «doctores» → «doctor»).
const raiz = (w) => w.replace(/(es|s)$/, "").replace(/[oa]$/, "");
const raices = (texto) => new Set(norm(texto).split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !VACIAS.has(w)).map(raiz));

export function videoParaPregunta(texto) {
  const pregunta = raices(texto);
  if (!pregunta.size) return null;
  let mejor = null, puntos = 1; // mínimo 2 palabras en común, para no recomendar videos por una sola palabra suelta
  for (const v of videosDisponibles()) {
    const p = [...raices(`${v.titulo} ${v.palabras}`)].filter((w) => pregunta.has(w)).length;
    if (p > puntos) { mejor = v; puntos = p; }
  }
  return mejor;
}

export const youtubeEmbedUrl = (codigo) => `https://www.youtube-nocookie.com/embed/${encodeURIComponent(codigo)}?rel=0&modestbranding=1&playsinline=1&autoplay=1`;
export const youtubeThumb = (codigo) => `https://i.ytimg.com/vi/${encodeURIComponent(codigo)}/mqdefault.jpg`;
