// src/lib/listaPreciosApi.js
// API de Lista de Precios — guarda ítems con precio y mantiene espejos.
// Usa las mismas rutas/alias que ya maneja tu proyecto.

import {
  addDoc, setDoc, updateDoc, getDoc, getDocs, doc, collection, query, where,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig"; // ajusta la ruta si tu firebaseConfig está en otro lugar

export const COLLECTIONS = {
  listas_precios: "listas_precios",
  listas_precios_productos: "listas_precios_productos",
  catalogo_procedimientos: "catalogo_procedimientos",
};

export const FIELD_ALIASES = {
  precio: ["precio", "valor", "price", "monto", "precio_venta", "precioVenta", "precioCompra"],
  nombre: ["nombre", "descripcion", "descripción", "name"],
  codigo: ["codigo", "código", "code", "referencia"],
  categoria: ["categoria", "categoriaNombre", "grupo", "area"],
  max_desc_pct: ["max_desc_pct", "max_descuento_pct"],
  max_desc_valor: ["max_desc_valor", "max_descuento_valor"],
  permite_desc: ["permite_desc", "permite_descuento"],
};

const parseCOP = (v) => {
  if (typeof v === "number") return v;
  const n = Number(String(v ?? "").replace(/[^\d-]+/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const first = (obj, keys, def) => {
  for (const k of keys) if (obj?.[k] !== undefined && obj[k] !== null) return obj[k];
  return def;
};

/** Normaliza el shape interno del ítem (nombre/codigo/precio/… ) */
function normalizeItemPayload(raw) {
  const codigo = (first(raw, FIELD_ALIASES.codigo, raw?.id || "") || "").toString().trim();
  const nombre = (first(raw, FIELD_ALIASES.nombre, codigo) || "").toString().trim();
  const precio = parseCOP(first(raw, FIELD_ALIASES.precio, 0));
  const categoria = (first(raw, FIELD_ALIASES.categoria, raw?.categoria || "") || "").toString().trim();
  const max_desc_pct = Number(first(raw, FIELD_ALIASES.max_desc_pct, raw?.max_desc_pct ?? 0)) || 0;
  const max_desc_valor = Number(first(raw, FIELD_ALIASES.max_desc_valor, raw?.max_desc_valor ?? 0)) || 0;
  const permite_desc = !!first(raw, FIELD_ALIASES.permite_desc, raw?.permite_desc ?? true);

  return {
    codigo, nombre, precio, categoria,
    max_desc_pct, max_desc_valor, permite_desc,
    // puedes anexar más flags si los usas en tu app:
    genera_rips: !!raw?.genera_rips,
    es_consulta: !!raw?.es_consulta,
    ver_en_agenda: !!raw?.ver_en_agenda,
    comentario: raw?.comentario || "",
  };
}

/** Crea (si no existe) o devuelve el ID de una categoría por nombre dentro de una lista */
export async function upsertCategoriaByNombre(listaId, nombreCategoria) {
  const catsRef = collection(db, COLLECTIONS.listas_precios, listaId, "categorias");
  // Búsqueda naive (puedes optimizar creando un índice por 'nombre')
  const snap = await getDocs(catsRef);
  const nombreNorm = (nombreCategoria || "").toString().trim().toLowerCase();
  let existing = snap.docs.find(d => (d.data()?.nombre || "").toString().trim().toLowerCase() === nombreNorm);
  if (existing) return existing.id;

  const ref = await addDoc(catsRef, {
    nombre: nombreCategoria || "Sin categoría",
    activo: true,
    creado: new Date(),
    actualizado: new Date(),
  });
  return ref.id;
}

/**
 * Guarda/actualiza un ítem con precio dentro de la lista y la categoría indicada.
 * Además mantiene:
 *  - espejo plano: listas_precios/{listaId}/items
 *  - espejo global: listas_precios_productos (con listaId)
 */
export async function saveItemEnLista({
  listaId,
  categoriaNombre,   // string visible ("Cirugía Oral")
  categoriaId,       // si ya la sabes, puedes pasarla para saltar el lookup
  itemId,            // si quieres forzar un id específico dentro de la categoría (opcional)
  dataRaw,           // objeto con codigo/nombre/precio/... (acepta alias)
}) {
  if (!listaId) throw new Error("Falta listaId");
  const data = normalizeItemPayload(dataRaw);
  if (!data.codigo) throw new Error("Falta código");
  if (!data.nombre) throw new Error("Falta nombre");

  // resolver categoria
  let catId = categoriaId;
  if (!catId) {
    catId = await upsertCategoriaByNombre(listaId, categoriaNombre || data.categoria || "Sin categoría");
  }

  // 1) Guardar dentro de categorias/*/items
  const baseCat = collection(db, COLLECTIONS.listas_precios, listaId, "categorias", catId, "items");
  let itemDocRef;
  if (itemId) {
    itemDocRef = doc(baseCat, itemId);
    const exists = await getDoc(itemDocRef);
    if (exists.exists()) {
      await updateDoc(itemDocRef, {
        ...data, categoria: categoriaNombre || data.categoria || "", actualizado: new Date(),
      });
    } else {
      await setDoc(itemDocRef, {
        ...data, categoria: categoriaNombre || data.categoria || "", creado: new Date(), actualizado: new Date(),
      });
    }
  } else {
    itemDocRef = await addDoc(baseCat, {
      ...data, categoria: categoriaNombre || data.categoria || "", creado: new Date(), actualizado: new Date(),
    });
  }

  // 1b) Espejo plano: listas_precios/{listaId}/items
  const planoRef = doc(collection(db, COLLECTIONS.listas_precios, listaId, "items"), data.codigo);
  await setDoc(planoRef, {
    ...data,
    categoria: categoriaNombre || data.categoria || "",
    catRef: catId,
    itemRef: itemDocRef.id,
    actualizado: new Date(),
  }, { merge: true });

  // 2) Espejo global por listaId (para queries cross-lista)
  // clave compuesta: `${listaId}__${codigo}`
  const globalKey = `${listaId}__${data.codigo}`;
  const globalRef = doc(collection(db, COLLECTIONS.listas_precios_productos), globalKey);
  await setDoc(globalRef, {
    ...data,
    listaId,
    categoria: categoriaNombre || data.categoria || "",
    catRef: catId,
    itemRef: itemDocRef.id,
    actualizado: new Date(),
  }, { merge: true });

  return { itemId: itemDocRef.id, catId, codigo: data.codigo };
}

/** Devuelve el item {codigo, nombre, precio, categoria, ...} buscando por las 4 fuentes (orden de tu app) */
export async function findItemByCodigo(listaId, codigo) {
  if (!listaId || !codigo) return null;
  const codeNorm = String(codigo).trim().toLowerCase();

  // 1) categorias/*/(items|procedimientos)
  try {
    const catsSnap = await getDocs(collection(db, COLLECTIONS.listas_precios, listaId, "categorias")).catch(()=>null);
    if (catsSnap && !catsSnap.empty) {
      for (const catDoc of catsSnap.docs) {
        for (const leaf of ["items","procedimientos"]) {
          const snap = await getDocs(collection(db, COLLECTIONS.listas_precios, listaId, "categorias", catDoc.id, leaf)).catch(()=>null);
          if (!snap || snap.empty) continue;
          for (const d of snap.docs) {
            const x = d.data() || {};
            const c = (first(x, FIELD_ALIASES.codigo, d.id) || d.id).toString().trim().toLowerCase();
            if (c === codeNorm) {
              return {
                id: d.id,
                codigo: (first(x, FIELD_ALIASES.codigo, d.id) || "").toString(),
                nombre: (first(x, FIELD_ALIASES.nombre, "") || "").toString(),
                precio: parseCOP(first(x, FIELD_ALIASES.precio, 0)),
                categoria: (first(x, FIELD_ALIASES.categoria, catDoc.data()?.nombre || "") || "").toString(),
              };
            }
          }
        }
      }
    }
  } catch {}

  // 1b) subcolección items (plano)
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.listas_precios, listaId, "items")).catch(()=>null);
    if (snap && !snap.empty) {
      for (const d of snap.docs) {
        const x = d.data() || {};
        const c = (first(x, FIELD_ALIASES.codigo, d.id) || d.id).toString().trim().toLowerCase();
        if (c === codeNorm) {
          return {
            id: d.id,
            codigo: (first(x, FIELD_ALIASES.codigo, d.id) || "").toString(),
            nombre: (first(x, FIELD_ALIASES.nombre, "") || "").toString(),
            precio: parseCOP(first(x, FIELD_ALIASES.precio, 0)),
            categoria: (first(x, FIELD_ALIASES.categoria, "") || "").toString(),
          };
        }
      }
    }
  } catch {}

  // 2) espejo global por listaId
  try {
    const qLP = query(collection(db, COLLECTIONS.listas_precios_productos), where("listaId","==",listaId));
    const snap = await getDocs(qLP).catch(()=>null);
    if (snap && !snap.empty) {
      for (const d of snap.docs) {
        const x = d.data() || {};
        const c = (first(x, FIELD_ALIASES.codigo, d.id) || d.id).toString().trim().toLowerCase();
        if (c === codeNorm) {
          return {
            id: d.id,
            codigo: (first(x, FIELD_ALIASES.codigo, d.id) || "").toString(),
            nombre: (first(x, FIELD_ALIASES.nombre, "") || "").toString(),
            precio: parseCOP(first(x, FIELD_ALIASES.precio, 0)),
            categoria: (first(x, FIELD_ALIASES.categoria, "") || "").toString(),
          };
        }
      }
    }
  } catch {}

  // 3) catálogo (fallback)
  try {
    const snap = await getDocs(collection(db, COLLECTIONS.catalogo_procedimientos)).catch(()=>null);
    if (snap && !snap.empty) {
      for (const d of snap.docs) {
        const x = d.data() || {};
        const c = (first(x, FIELD_ALIASES.codigo, d.id) || d.id).toString().trim().toLowerCase();
        if (c === codeNorm) {
          return {
            id: d.id,
            codigo: (first(x, FIELD_ALIASES.codigo, d.id) || "").toString(),
            nombre: (first(x, FIELD_ALIASES.nombre, "") || "").toString(),
            precio: parseCOP(first(x, FIELD_ALIASES.precio, 0)),
            categoria: (first(x, FIELD_ALIASES.categoria, "") || "").toString(),
          };
        }
      }
    }
  } catch {}

  return null;
}
