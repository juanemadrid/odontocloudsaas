// Residencia del paciente para RIPS: país (ISO 3166-1 numérico) y municipio (DIVIPOLA DANE, 5 dígitos).
// La ficha del paciente guarda el nombre de la ciudad y del país; aquí se traducen a los códigos oficiales.
// Si la ciudad no se reconoce NO se inventa un código: se devuelve null para que la clínica la corrija.

const plain = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();

export const COUNTRY_CODES = {
  colombia: "170", "estados unidos": "840", "estados unidos de america": "840", usa: "840", eeuu: "840", "ee uu": "840",
  venezuela: "862", ecuador: "218", peru: "604", panama: "591", mexico: "484", argentina: "032", chile: "152",
  espana: "724", brasil: "076", canada: "124", "costa rica": "188", "republica dominicana": "214", cuba: "192",
  italia: "380", francia: "250", alemania: "276", "reino unido": "826", bolivia: "068", paraguay: "600", uruguay: "858",
};

// Ciudades fuera de Colombia que aparecen en fichas (residencia en el exterior).
const FOREIGN_CITIES = { miami: "840", "nueva york": "840", orlando: "840", houston: "840", madrid: "724", caracas: "862",
  maracaibo: "862", quito: "218", lima: "604", "ciudad de panama": "591", "puerto madryn": "032", "buenos aires": "032" };

export const DIVIPOLA = {
  // Capitales
  medellin: "05001", barranquilla: "08001", bogota: "11001", "bogota dc": "11001", "bogota d c": "11001", cartagena: "13001",
  "cartagena de indias": "13001", tunja: "15001", manizales: "17001", florencia: "18001", popayan: "19001", valledupar: "20001",
  monteria: "23001", quibdo: "27001", neiva: "41001", riohacha: "44001", "santa marta": "47001", villavicencio: "50001",
  pasto: "52001", cucuta: "54001", "san jose de cucuta": "54001", armenia: "63001", pereira: "66001", bucaramanga: "68001",
  sincelejo: "70001", ibague: "73001", cali: "76001", "santiago de cali": "76001", arauca: "81001", yopal: "85001",
  mocoa: "86001", "san andres": "88001", leticia: "91001", inirida: "94001", "san jose del guaviare": "95001", mitu: "97001",
  "puerto carreno": "99001",
  // Sucre
  buenavista: "70110", caimito: "70124", coloso: "70204", corozal: "70215", covenas: "70221", chalan: "70230",
  "el roble": "70233", galeras: "70235", guaranda: "70265", "la union": "70400", "los palmitos": "70418", majagual: "70429",
  morroa: "70473", ovejas: "70508", palmito: "70523", sampues: "70670", "san benito abad": "70678",
  "san juan de betulia": "70702", betulia: "70702", "san marcos": "70708", "san onofre": "70713", "san pedro": "70717",
  "san luis de since": "70742", since: "70742", sucre: "70771", "santiago de tolu": "70820", tolu: "70820",
  "tolu viejo": "70823", toluviejo: "70823",
  // Córdoba
  ayapel: "23068", canalete: "23090", cerete: "23162", chima: "23168", chinu: "23182", "cienaga de oro": "23189",
  cotorra: "23300", "la apartada": "23350", lorica: "23417", "santa cruz de lorica": "23417", "los cordobas": "23419",
  momil: "23464", montelibano: "23466", monitos: "23500", "planeta rica": "23555", "pueblo nuevo": "23570",
  "puerto escondido": "23574", "puerto libertador": "23580", purisima: "23586", sahagun: "23660",
  "san andres de sotavento": "23670", "san antero": "23672", "san bernardo del viento": "23675", "san carlos": "23678",
  "san jose de ure": "23682", "san pelayo": "23686", tierralta: "23807", tuchin: "23815", valencia: "23855",
  // Bolívar
  magangue: "13430", "el carmen de bolivar": "13244", turbaco: "13836", arjona: "13052", mompos: "13468",
  "santa cruz de mompox": "13468", "san juan nepomuceno": "13657", "san jacinto": "13654",
  // Atlántico
  soledad: "08758", malambo: "08433", "puerto colombia": "08573", sabanalarga: "08638", galapa: "08296",
  // Antioquia y otros
  apartado: "05045", turbo: "05837", caucasia: "05154", envigado: "05266", itagui: "05360", bello: "05088",
  rionegro: "05615", soacha: "25754",
};

/**
 * @returns {{ codPaisResidencia: string|null, codMunicipioResidencia: string|null, error: string|null }}
 */
export function resolveResidence({ ciudad, pais } = {}) {
  const c = plain(ciudad).replace(/\s*\(.*\)$/, "");
  const p = plain(pais);
  if (/^\d{5}$/.test(c)) return { codPaisResidencia: "170", codMunicipioResidencia: c, error: null };
  const foreign = FOREIGN_CITIES[c] || (p && p !== "colombia" ? COUNTRY_CODES[p] : null);
  if (foreign) return { codPaisResidencia: foreign, codMunicipioResidencia: null, error: null };
  if (p && p !== "colombia" && !COUNTRY_CODES[p]) {
    return { codPaisResidencia: null, codMunicipioResidencia: null, error: `País de residencia '${pais}' no reconocido.` };
  }
  if (!c) return { codPaisResidencia: "170", codMunicipioResidencia: null, error: "Falta la ciudad de residencia del paciente." };
  const code = DIVIPOLA[c] || DIVIPOLA[c.replace(/\s+(sucre|cordoba|bolivar|atlantico|antioquia)$/, "")];
  if (!code) {
    return { codPaisResidencia: "170", codMunicipioResidencia: null,
      error: `La ciudad de residencia '${ciudad}' no se reconoce. Escríbala completa en la ficha del paciente (ej. Sincelejo, Montería) o escriba su código DANE de 5 dígitos.` };
  }
  return { codPaisResidencia: "170", codMunicipioResidencia: code, error: null };
}

/** País de nacimiento → código ISO numérico (Colombia = 170). */
export function resolveCountry(pais) {
  const p = plain(pais);
  if (!p) return "170";
  if (/^\d{3}$/.test(p)) return p;
  return COUNTRY_CODES[p] || null;
}
