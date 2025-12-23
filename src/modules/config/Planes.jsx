// ===============================
// 🗂️ Planes.jsx — Catálogo de Planes (PRODUCCIÓN, layout ordenado v6.3 - FIX visual tabla editor + FIX parser error + FIX acciones visibles)
// ===============================
// Características:
// - Busca/filtra por categoría y por código/nombre.
// - Lee ítems desde 4 fuentes en este orden:
//   1) listas_precios/{listaId}/categorias/*/items
//   1b) listas_precios/{listaId}/items
//   2)  listas_precios_productos (con campo listaId)
//   3)  catalogo_procedimientos (fallback)
// - Si las 3 primeras devuelven 0, cae automáticamente a 3) para que SIEMPRE veas resultados.
// - Guarda renglones del plan en: planes/{planId}/planes_items
// - Descuento % y $ con topes; total calculado.
// - Botón "Diagnóstico" para verificar fuentes y conteos.

const COLLECTIONS = {
  listas_precios: "listas_precios",
  listas_precios_productos: "listas_precios_productos",
  catalogo_procedimientos: "catalogo_procedimientos",
  catalogo_categorias: "catalogo_categorias",
};

const FIELD_ALIASES = {
  precio: ["precio", "valor", "price", "monto", "precioCompra", "precio_venta", "precioVenta"],
  nombre: ["nombre", "descripcion", "descripción", "name"],
  codigo: ["codigo", "código", "code", "referencia"],
  categoria: ["categoria", "categoriaNombre", "grupo", "area"],
  max_desc_pct: ["max_desc_pct", "max_descuento_pct"],
  max_desc_valor: ["max_desc_valor", "max_descuento_valor"],
  permite_desc: ["permite_desc", "permite_descuento"],
  genera_rips: ["genera_rips"],
  es_consulta: ["es_consulta"],
  ver_en_agenda: ["ver_en_agenda"],
};

import React, { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../../firebase/firebaseConfig";
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query,
  serverTimestamp, updateDoc, where
} from "firebase/firestore";

/* ===================== utilidades ===================== */
const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const normalize = (s) =>
  (s || "").toString().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
const clamp = (n, min, max) => Math.min(max, Math.max(min, Number.isFinite(+n) ? +n : min));
const toNumber = (v, def = 0) => {
  const n = Number(String(v ?? "").replace(/[^\d-]+/g, ""));
  return Number.isFinite(n) ? n : def;
};
const parseCOP = (v) => {
  if (typeof v === "number") return v;
  return Number(String(v ?? "").replace(/[^\d-]+/g, "")) || 0;
};
const sameCat = (a, b) => {
  const na = normalize(a), nb = normalize(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
};
function pick(obj, keys, def = undefined) {
  for (const k of keys) {
    if (obj?.[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return def;
}

/* ===================== estilos inyectados (layout ordenado v6.3 — FIX editor interno) ===================== */
function usePlanesStyles() {
  useEffect(() => {
    const id = "oc-planes-styles-v6-3-acciones-fix"; // 🔄 id nuevo para forzar recarga
    if (document.getElementById(id)) return;

    const css = `
      :root{
        --oc-primary:#3b82f6; --oc-primary-600:#2563eb;
        --oc-green:#22c55e; --oc-green-600:#16a34a;
        --oc-red:#ef4444; --oc-red-600:#dc2626;
        --oc-gray:#e6e9ef; --oc-muted:#64748b;
      }
      .oc-muted{color:var(--oc-muted)}
      .mono{font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,"Liberation Mono",monospace}

      .oc-input,.oc-select{
        height:34px;border:1px solid #d6dbe6;border-radius:8px;background:#fff;
        padding:0 10px;font-size:14px
      }
      .oc-input:focus,.oc-select:focus{
        outline:none;border-color:#60a5fa;
        box-shadow:0 0 0 2px rgba(96,165,250,.15)
      }
      .oc-input.num{text-align:right}

      .oc-btn{
        display:inline-flex;align-items:center;justify-content:center;
        height:30px;padding:0 10px;border-radius:8px;
        border:1px solid var(--oc-gray);background:#fff;color:#0f172a;
        font-weight:700;font-size:12px;cursor:pointer;transition:.15s
      }
      .oc-btn:hover{background:#f8fafc}
      .oc-btn.small{height:26px;padding:0 8px}
      .oc-btn.primary{background:var(--oc-primary);border-color:var(--oc-primary-600);color:#fff}
      .oc-btn.primary:hover{background:var(--oc-primary-600)}
      .oc-btn.success{background:var(--oc-green);border-color:var(--oc-green-600);color:#fff}
      .oc-btn.success:hover{background:var(--oc-green-600)}
      .oc-btn.danger{background:var(--oc-red);border-color:var(--oc-red-600);color:#fff}
      .oc-btn.danger:hover{background:var(--oc-red-600)}
      .oc-btn.outline{background:#fff;color:var(--oc-primary);border-color:var(--oc-primary)}
      .oc-btn.outline:hover{background:#eff6ff}

      /* ===== Tabla general ===== */
      .oc-scroll-x{overflow:auto}
      .oc-tbl{
        width:100%;
        border-collapse:separate;
        border-spacing:0;
        border:1px solid #e6e9ef;
        border-radius:10px;
        overflow:hidden;
        table-layout:auto;
      }
      .oc-tbl.sticky thead th{
        position:sticky; top:0; z-index:1; background:#f8fafc;
      }
      .oc-tbl thead th{
        white-space:nowrap; word-break:normal; overflow-wrap:normal;
        height:auto; line-height:1.25; text-align:left;
        padding:8px 10px; border-bottom:1px solid #e6e9ef; font-weight:700;
      }
      .oc-tbl tbody td{
        white-space:nowrap; overflow-wrap:normal; vertical-align:middle;
        height:44px; padding:6px 10px; border-bottom:1px solid #f0f3f8;
      }
      .oc-tbl tbody tr:nth-child(odd){background:#fcfdff}
      .oc-tbl tbody tr:last-child td{border-bottom:0}
      .oc-code{font-variant-numeric:tabular-nums}
      .oc-num{text-align:right}
      .oc-name{overflow:hidden;text-overflow:ellipsis}

      /* ===== SOLO tabla interna del editor de plan ===== */
      .oc-tbl.plan-editor{
        table-layout:fixed; width:100%; font-size:12.5px;
      }
      .oc-tbl.plan-editor thead th,
      .oc-tbl.plan-editor tbody td { padding:6px 8px; }

      /* Distribución proporcional por columnas */
      .oc-tbl.plan-editor th:nth-child(1), .oc-tbl.plan-editor td:nth-child(1){ width:9%;  text-align:left; }
      .oc-tbl.plan-editor th:nth-child(2), .oc-tbl.plan-editor td:nth-child(2){ width:38%; text-align:left; }
      .oc-tbl.plan-editor th:nth-child(3), .oc-tbl.plan-editor td:nth-child(3){ width:9%;  text-align:right;}
      .oc-tbl.plan-editor th:nth-child(4), .oc-tbl.plan-editor td:nth-child(4){ width:6%;  text-align:center;}
      .oc-tbl.plan-editor th:nth-child(5), .oc-tbl.plan-editor td:nth-child(5){ width:6%;  text-align:center;}
      .oc-tbl.plan-editor th:nth-child(6), .oc-tbl.plan-editor td:nth-child(6){ width:7%;  text-align:right;}
      .oc-tbl.plan-editor th:nth-child(7), .oc-tbl.plan-editor td:nth-child(7){ width:10%; text-align:left; }
      .oc-tbl.plan-editor th:nth-child(8), .oc-tbl.plan-editor td:nth-child(8){ width:7%;  text-align:right;}
      .oc-tbl.plan-editor th:nth-child(9), .oc-tbl.plan-editor td:nth-child(9){ width:16%; text-align:center;}

      /* Nombre: visible sin recorte */
      .oc-tbl.plan-editor tbody td:nth-child(2){
        overflow:visible; text-overflow:clip; white-space:nowrap; font-size:12px;
      }

      /* ✅ Acciones: permitir wrap dentro de la celda (FIX) */
      .oc-tbl.plan-editor tbody td:nth-child(9){
        white-space:normal; /* ← esto habilita que los botones salten de línea si no caben */
      }

      /* Inputs dentro de la tabla */
      .oc-tbl.plan-editor input.oc-input{
        width:100%; height:30px; padding:0 8px; font-size:12px;
      }

      /* Acciones con wrap */
      .oc-actions{display:flex; gap:6px; flex-wrap:wrap; justify-content:center}
      .oc-actions .oc-btn{height:26px; padding:0 8px; font-size:11.5px}

      /* ===== Modal y sugerencias (faltaban estilos base) ===== */
      .oc-mask{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;z-index:50}
      .oc-modal{width:min(1100px,96vw);max-height:90vh;background:#fff;border:1px solid #e6e9ef;border-radius:12px;display:flex;flex-direction:column}
      .oc-modal-h{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #edf0f6}
      .oc-modal-t{display:grid;grid-template-columns:220px 1fr auto auto;gap:10px;align-items:center;padding:12px;border-bottom:1px solid #edf0f6}
      .oc-modal-b{padding:12px;overflow:auto}
      .oc-modal-f{display:flex;justify-content:flex-end;gap:8px;padding:12px;border-top:1px solid #edf0f6}
      .oc-sug{position:absolute;left:0;right:0;top:36px;background:#fff;border:1px solid #e6e9ef;border-radius:8px;box-shadow:0 6px 18px rgba(15,23,42,.08);max-height:280px;overflow:auto;z-index:60}
      .oc-sug-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 10px;cursor:pointer}
      .oc-sug-item:hover{background:#f8fafc}
      .table-wrap{width:100%;overflow:auto}
    `;
    const tag = document.createElement("style");
    tag.id = id;
    tag.textContent = css;
    document.head.appendChild(tag);
  }, []);
}

/* ===================== util Firestore ===================== */
function mapItem(d, x, catNameFromParent = "") {
  const codigo = (pick(x, FIELD_ALIASES.codigo, d.id) || "").toString().trim();
  const nombre = (pick(x, FIELD_ALIASES.nombre, codigo) || "").toString().trim();
  const precio = parseCOP(pick(x, FIELD_ALIASES.precio, 0));
  let categoria = (pick(x, FIELD_ALIASES.categoria, catNameFromParent) || "").toString().trim();
  if (!categoria) categoria = "Sin categoría";
  return {
    id: d.id,
    codigo,
    nombre,
    precio,
    categoria,
    max_desc_pct: Number(pick(x, FIELD_ALIASES.max_desc_pct, 0)) || 0,
    max_desc_valor: Number(pick(x, FIELD_ALIASES.max_desc_valor, 0)) || 0,
    permite_desc: !!pick(x, FIELD_ALIASES.permite_desc, true),
    genera_rips: !!pick(x, FIELD_ALIASES.genera_rips, false),
    es_consulta: !!pick(x, FIELD_ALIASES.es_consulta, false),
    ver_en_agenda: !!pick(x, FIELD_ALIASES.ver_en_agenda, false),
    _norm: normalize(`${codigo} ${nombre} ${categoria}`) // ✅ corregido sin escape
  };
}

/* ====== helper que faltaba: inferir categoría por prefijos ====== */
function deriveCategoria(codigo = "", nombre = "", selectedCat = "", catMap = []) {
  const txt = normalize(`${codigo} ${nombre}`);
  // 1) si hay un mapa con prefijos para la categoría seleccionada, úsalo
  if (selectedCat && selectedCat !== "*") {
    const m = catMap.find((c) => sameCat(c.nombre, selectedCat));
    if (m?.prefijos?.length) {
      for (const p of m.prefijos) {
        const pref = normalize(String(p || ""));
        if (pref && (txt.startsWith(pref) || txt.includes(` ${pref}`))) return m.nombre;
      }
    }
  }
  // 2) o el primer match de cualquier categoría por prefijo
  for (const m of catMap) {
    for (const p of (m.prefijos || [])) {
      const pref = normalize(String(p || ""));
      if (pref && (txt.startsWith(pref) || txt.includes(` ${pref}`))) return m.nombre;
    }
  }
  return "";
}

// 1) listas_precios/{listaId}/categorias/*/items (o /procedimientos)
async function fetchItemsFromNestedCategories(listaId) {
  try {
    const catsSnap = await getDocs(collection(db, COLLECTIONS.listas_precios, listaId, "categorias")).catch(() => null);
    if (!catsSnap || catsSnap.empty) return [];
    const out = [];
    for (const catDoc of catsSnap.docs) {
      const catName = (catDoc.data()?.nombre || "").toString().trim();
      let itemsSnap = await getDocs(
        collection(db, COLLECTIONS.listas_precios, listaId, "categorias", catDoc.id, "items")
      ).catch(() => null);
      if (!itemsSnap || itemsSnap.empty) {
        itemsSnap = await getDocs(
          collection(db, COLLECTIONS.listas_precios, listaId, "categorias", catDoc.id, "procedimientos")
        ).catch(() => null);
      }
      if (!itemsSnap || itemsSnap.empty) continue;
      itemsSnap.forEach((d) => out.push(mapItem(d, d.data() || {}, catName)));
    }
    return out;
  } catch {
    return [];
  }
}

/* ===================== Modal: Agregar productos ===================== */
function AgregarProductosModal({ listaId, onClose, onLoadLines }) {
  const [cats, setCats] = useState(["*"]);
  const [cat, setCat] = useState("*");
  const [term, setTerm] = useState("");
  const [qty, setQty] = useState(1);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openSug, setOpenSug] = useState(false);
  const inputRef = useRef(null);
  const [bag, setBag] = useState([]);
  const [catMap, setCatMap] = useState([]);

  const FALLBACK_CATS = ["*","Cirugía Oral","Endodoncia","Implantología","Odontología General","Ortodoncia","Periodoncia","Psicología","Radiología","Rehabilitación Oral"];

  // 🔧 Diagnóstico
  const diagnostico = async () => {
    const out = { listaId: listaId || "(vacío)", fuentes: [] };

    // 1) anidado
    let n1 = 0, sample1 = [];
    if (listaId) {
      const catsSnap = await getDocs(collection(db, COLLECTIONS.listas_precios, listaId, "categorias")).catch(()=>null);
      if (catsSnap && !catsSnap.empty) {
        for (const c of catsSnap.docs) {
          let itSnap = await getDocs(collection(db, COLLECTIONS.listas_precios, listaId, "categorias", c.id, "items")).catch(()=>null);
          if (!itSnap || itSnap.empty) {
            itSnap = await getDocs(collection(db, COLLECTIONS.listas_precios, listaId, "categorias", c.id, "procedimientos")).catch(()=>null);
          }
          if (itSnap && !itSnap.empty) {
            n1 += itSnap.size;
            itSnap.docs.slice(0,3).forEach(d => {
              const x = d.data()||{};
              sample1.push((pick(x, FIELD_ALIASES.codigo, d.id) || d.id)+"");
            });
          }
        }
      }
    }
    out.fuentes.push({ ruta: "listas_precios/{listaId}/categorias/*/(items|procedimientos)", total: n1, sample: sample1.slice(0,3) });

    // 1b) subcolección items
    let n1b = 0, sample1b = [];
    if (listaId) {
      const subItems = await getDocs(collection(db, COLLECTIONS.listas_precios, listaId, "items")).catch(()=>null);
      if (subItems && !subItems.empty) {
        n1b = subItems.size;
        subItems.docs.slice(0,3).forEach(d => {
          const x=d.data()||{};
          sample1b.push((pick(x, FIELD_ALIASES.codigo, d.id) || d.id)+"");
        });
      }
    }
    out.fuentes.push({ ruta: "listas_precios/{listaId}/items", total: n1b, sample: sample1b });

    // 2) espejo por listaId
    let n2 = 0, sample2 = [];
    if (listaId) {
      const qLP = query(collection(db, COLLECTIONS.listas_precios_productos), where("listaId","==", listaId));
      const snapLP = await getDocs(qLP).catch(()=>null);
      if (snapLP && !snapLP.empty) {
        n2 = snapLP.size;
        snapLP.docs.slice(0,3).forEach(d=>{
          const x=d.data()||{};
          sample2.push((pick(x, FIELD_ALIASES.codigo, d.id) || d.id)+"");
        });
      }
    }
    out.fuentes.push({ ruta: "listas_precios_productos (por listaId)", total: n2, sample: sample2 });

    // 3) catálogo
    let n3 = 0, sample3 = [];
    const catSnap = await getDocs(collection(db, COLLECTIONS.catalogo_procedimientos)).catch(()=>null);
    if (catSnap && !catSnap.empty) {
      n3 = catSnap.size;
      catSnap.docs.slice(0,3).forEach(d=>{
        const x=d.data()||{};
        sample3.push((pick(x, FIELD_ALIASES.codigo, d.id) || d.id)+"");
      });
    }
    out.fuentes.push({ ruta: "catalogo_procedimientos", total: n3, sample: sample3 });

    const lines = [
      `Lista seleccionada: ${out.listaId}`,
      ...out.fuentes.map(f => `• ${f.ruta} → ${f.total} items ${f.sample.length?(`(ej: ${f.sample.join(", ")})`):""}`)
    ];
    alert(lines.join("\n"));
    console.info("[Diagnóstico Planes]", out);
  };

  // Cargar categorías + prefijos
  useEffect(() => {
    let alive = true;
    (async () => {
      const setC = new Set();
      let map = [];
      try {
        const snapCats = await getDocs(collection(db, COLLECTIONS.catalogo_categorias)).catch(() => null);
        if (snapCats && !snapCats.empty) {
          setC.add("*");
          snapCats.forEach((d) => {
            const data = d.data() || {};
            const nombre = (data.nombre || "").toString().trim();
            const prefijos = Array.isArray(data.prefijos) ? data.prefijos.map((p) => (p || "").toString()) : [];
            if (nombre) { setC.add(nombre); map.push({ nombre, prefijos }); }
          });
        }
        if (listaId) {
          const catsSnap = await getDocs(collection(db, COLLECTIONS.listas_precios, listaId, "categorias")).catch(() => null);
          catsSnap?.forEach((d) => {
            const c = (d.data()?.nombre || "").toString().trim();
            if (c) setC.add(c);
          });
          const subItems = await getDocs(collection(db, COLLECTIONS.listas_precios, listaId, "items")).catch(() => null);
          subItems?.forEach((d) => {
            const c = (pick(d.data()||{}, FIELD_ALIASES.categoria, "") || "").toString().trim();
            if (c) setC.add(c);
          });
          const qLP = query(collection(db, COLLECTIONS.listas_precios_productos), where("listaId", "==", listaId));
          const snapLP = await getDocs(qLP).catch(() => null);
          snapLP?.forEach((d) => {
            const c = (pick(d.data()||{}, FIELD_ALIASES.categoria, "") || "").toString().trim();
            if (c) setC.add(c);
          });
        }
      } finally {
        if (setC.size === 0) FALLBACK_CATS.forEach((c) => setC.add(c));
        if (!setC.has("*")) setC.add("*");
        if (alive) { setCats(Array.from(setC)); setCatMap(map); }
      }
    })();
    return () => { alive = false; };
  }, [listaId]);

  useEffect(() => { if (cat !== "*") { setOpenSug(true); } else setOpenSug(false); }, [cat]);

  // Query de items (anidado -> plano -> espejo -> catálogo con fallback)
  useEffect(() => {
    let alive = true;
    const mustQuery = (normalize(term).length >= 2) || (cat !== "*");
    if (!mustQuery) { setRows([]); return; }
    (async () => {
      setLoading(true);
      try {
        let merged = [];

        // 1) anidado
        if (listaId) {
          const nested = await fetchItemsFromNestedCategories(listaId);
          if (nested.length) merged = nested;
        }

        // 1b) subcolección items
        if (!merged.length && listaId) {
          const subItems = await getDocs(collection(db, COLLECTIONS.listas_precios, listaId, "items")).catch(() => null);
          if (subItems && !subItems.empty) {
            merged = subItems.docs.map((d) => mapItem(d, d.data() || {}));
          }
        }

        // 2) espejo por listaId
        if (!merged.length && listaId) {
          const qLP = query(collection(db, COLLECTIONS.listas_precios_productos), where("listaId", "==", listaId));
          const snapLP = await getDocs(qLP).catch(() => null);
          merged = (snapLP?.docs || []).map((d) => mapItem(d, d.data() || {}));
        }

        // 3) fallback catálogo
        if (!merged.length) {
          const catSnap = await getDocs(collection(db, COLLECTIONS.catalogo_procedimientos)).catch(() => null);
          catSnap?.forEach((d) => merged.push(mapItem(d, d.data() || {})));
        }

        // Filtro por categoría + texto
        const tnorm = normalize(term);
        let filtered = merged.filter((r) => {
          if (cat !== "*") {
            const derived = deriveCategoria(r.codigo, r.nombre, cat, catMap) || r.categoria || "";
            if (!sameCat(derived, cat)) return false;
          }
          if (tnorm && !r._norm.includes(tnorm)) return false;
          return true;
        });

        filtered.sort(
          (a, b) =>
            (a.codigo || "").localeCompare(b.codigo || "") ||
            (a.nombre || "").localeCompare(b.nombre || "")
        );

        if (cat !== "*" && !tnorm) filtered = filtered.slice(0, 120);

        if (alive) setRows(filtered);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [listaId, cat, term, catMap]);

  const addFromRow = (r) => {
    const cantidad = Math.max(1, Number(qty) || 1);
    setBag((prev) => {
      const idx = prev.findIndex((x) => x.codigo === r.codigo);
      const base = {
        codigo: r.codigo,
        nombre: r.nombre,
        precio: Number(r.precio || 0),
        cantidad,
        descuentoPct: 0,
        descuentoValor: 0,
        observaciones: "",
        _max_desc_pct: Number(r.max_desc_pct || 0),
        _max_desc_valor: Number(r.max_desc_valor || 0),
        _permite_desc: !!(r.permite_desc ?? true),
        _flags: {
          genera_rips: !!r.genera_rips,
          es_consulta: !!r.es_consulta,
          ver_en_agenda: !!r.ver_en_agenda,
        },
      };
      if (idx >= 0) {
        const next = [...prev];
        const row = { ...next[idx] };
        row.cantidad = clamp((row.cantidad || 1) + cantidad, 1, 999999);
        const unit = row.precio || base.precio || 0;
        const baseAmt = unit * row.cantidad;
        const pctAmt = (baseAmt * clamp(row.descuentoPct || 0, 0, base._max_desc_pct || 100)) / 100;
        const absAmt = clamp(row.descuentoValor || 0, 0, base._max_desc_valor || baseAmt);
        const disc = row._permite_desc ? Math.min(Math.max(pctAmt, absAmt), baseAmt) : 0;
        row.total = Math.max(0, baseAmt - disc);
        next[idx] = row;
        return next;
      }
      const baseAmt = base.precio * cantidad;
      const total = Math.max(0, baseAmt);
      return [...prev, { ...base, total } ];
    });
  };

  const updateBag = (i, patch) => {
    setBag((prev) => {
      const next = [...prev];
      const row = { ...next[i], ...patch };
      row.cantidad = clamp(toNumber(row.cantidad, 1), 1, 999999);
      row.precio = toNumber(row.precio, 0);
      row.descuentoPct = clamp(toNumber(row.descuentoPct, 0), 0, toNumber(row._max_desc_pct, 100));
      row.descuentoValor = clamp(
        toNumber(row.descuentoValor, 0),
        0,
        Number.isFinite(row._max_desc_valor) ? row._max_desc_valor : 999999999
      );
      const baseAmt = row.precio * row.cantidad;
      const pctAmt = (baseAmt * row.descuentoPct) / 100;
      const absAmt = clamp(row.descuentoValor, 0, Number.isFinite(row._max_desc_valor) ? row._max_desc_valor : baseAmt);
      const disc = row._permite_desc ? Math.min(Math.max(pctAmt, absAmt), baseAmt) : 0;
      row.total = Math.max(0, baseAmt - disc);
      next[i] = row;
      return next;
    });
  };
  const removeBag = (i) => setBag((p) => p.filter((_, idx) => idx !== i));

  const cargar = () => {
    if (!bag.length && rows.length) {
      const cantidad = Math.max(1, Number(qty) || 1);
      const all = rows.map((r) => ({
        codigo: r.codigo, nombre: r.nombre, precio: Number(r.precio || 0),
        cantidad, descuentoPct: 0, descuentoValor: 0, observaciones: "",
        _max_desc_pct: Number(r.max_desc_pct || 0), _max_desc_valor: Number(r.max_desc_valor || 0),
        _permite_desc: !!(r.permite_desc ?? true),
        _flags: { genera_rips: !!r.genera_rips, es_consulta: !!r.es_consulta, ver_en_agenda: !!r.ver_en_agenda },
        total: Number(r.precio || 0) * cantidad,
      }));
      onLoadLines(all);
      setTerm(""); setOpenSug(false); if (inputRef.current) inputRef.current.blur(); onClose(); return;
    }
    if (bag.length) onLoadLines(bag);
    setTerm(""); setOpenSug(false); if (inputRef.current) inputRef.current.blur(); onClose();
  };

  const visibleSug = openSug && (loading || rows.length > 0);
  const showHint = rows.length === 0 && normalize(term).length < 2 && cat === "*";
  const showRowsTable = !visibleSug && cat === "*";

  return (
    <div className="oc-mask" role="dialog" aria-modal="true">
      <div className="oc-modal">
        <div className="oc-modal-h">
          <b>Agregar productos</b>
          <div style={{display:"flex",gap:8}}>
            <button className="oc-btn" onClick={diagnostico}>Diagnóstico</button>
            <button className="oc-btn" onClick={onClose}>Cerrar</button>
          </div>
        </div>

        <div className="oc-modal-t">
          <select className="oc-select" value={cat} onChange={(e) => setCat(e.target.value)}>
            {cats.map((c) => <option key={c} value={c}>{c === "*" ? "Todas las categorías" : c}</option>)}
          </select>

          <div style={{ position: "relative" }}>
            <input
              ref={inputRef}
              className="oc-input"
              placeholder="Buscar ítem por código o nombre…"
              value={term}
              onChange={(e) => { setTerm(e.target.value); setOpenSug(true); }}
              onFocus={() => { if (cat !== "*") { setOpenSug(true); } }}
            />
            {visibleSug && (
              <div className="oc-sug">
                {loading ? (
                  <div className="oc-muted" style={{ padding: 10 }}>Cargando…</div>
                ) : rows.length === 0 ? (
                  <div className="oc-muted" style={{ padding: 10 }}>Sin resultados.</div>
                ) : rows.map((r) => (
                  <div
                    key={`${r.id}-${r.codigo}`}
                    className="oc-sug-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addFromRow(r);
                      setTerm(""); setOpenSug(false);
                      if (inputRef.current) inputRef.current.blur();
                    }}
                  >
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.nombre}</div>
                    <div className="mono" style={{ opacity:.85 }}>{r.codigo}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label style={{ display:"flex", alignItems:"center", gap:6, justifySelf:"start" }}>
            <span className="oc-muted" style={{ fontSize:12, fontWeight:700 }}>Cantidad</span>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className="oc-input" style={{ width:90 }} />
          </label>

          <button className="oc-btn success" onClick={cargar}>Agregar</button>
        </div>

        <div className="oc-modal-b">
          {showHint ? (
            <div className="oc-muted">Escribe al menos 2 caracteres o elige una categoría para ver resultados.</div>
          ) : loading ? (
            <div className="oc-muted">Cargando…</div>
          ) : rows.length === 0 ? (
            <div className="oc-muted">Sin resultados.</div>
          ) : (
            showRowsTable && (
              <table className="oc-tbl" style={{ marginBottom:10 }}>
                <thead>
                  <tr>
                    <th style={{ width:110 }}>Código</th>
                    <th>Nombre</th>
                    <th style={{ width:140 }} className="oc-num">Valor<br/>unit.</th>
                    <th style={{ width:160 }}>Categoría</th>
                    <th style={{ width:120 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={`${r.id}-${r.codigo}`}>
                      <td className="mono oc-code">{r.codigo}</td>
                      <td className="oc-name" title={r.nombre}>{r.nombre}</td>
                      <td className="mono oc-num">{COP.format(r.precio || 0)}</td>
                      <td>{r.categoria || "—"}</td>
                      <td>
                        <button
                          className="oc-btn success small"
                          onClick={() => {
                            addFromRow(r);
                            setTerm(""); setOpenSug(false);
                            if (inputRef.current) inputRef.current.blur();
                          }}
                        >
                          Agregar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {!!bag.length && (
            <>
              <div style={{ margin:"6px 0 8px", fontWeight:700 }} className="oc-muted">Ítems a cargar</div>
              <table className="oc-tbl">
                <thead>
                  <tr>
                    <th style={{ width:110 }}>Código</th>
                    <th>Nombre</th>
                    <th style={{ width:120 }} className="oc-num">Valor<br/>unit.</th>
                    <th style={{ width:80 }} className="oc-num">Cant.</th>
                    <th style={{ width:90 }} className="oc-num">Desc.<br/>%</th>
                    <th style={{ width:110 }} className="oc-num">Desc.<br/>$</th>
                    <th>Observaciones</th>
                    <th style={{ width:120 }} className="oc-num">Total</th>
                    <th style={{ width:140 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {bag.map((it, i) => (
                    <tr key={i}>
                      <td className="mono oc-code">{it.codigo}</td>
                      <td className="oc-name" title={it.nombre}>{it.nombre}</td>
                      <td><input type="number" min={0} value={Number.isFinite(it.precio)?it.precio:0} onChange={(e)=>updateBag(i,{precio:e.target.value})} className="oc-input num" /></td>
                      <td><input type="number" min={1} value={it.cantidad} onChange={(e)=>updateBag(i,{cantidad:e.target.value})} className="oc-input num" /></td>
                      <td><input type="number" min={0} max={100} value={it.descuentoPct} onChange={(e)=>updateBag(i,{descuentoPct:e.target.value})} className="oc-input num" /></td>
                      <td><input type="number" min={0} value={it.descuentoValor||0} onChange={(e)=>updateBag(i,{descuentoValor:e.target.value})} className="oc-input num" /></td>
                      <td><input value={it.observaciones||""} onChange={(e)=>updateBag(i,{observaciones:e.target.value})} className="oc-input" /></td>
                      <td className="mono oc-num">{COP.format(it.total || 0)}</td>
                      <td>
                        <div className="oc-actions">
                          <button className="oc-btn success small" onClick={()=>removeBag(i)}>Quitar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div className="oc-modal-f">
          <button className="oc-btn" onClick={onClose}>Cerrar</button>
          <button className="oc-btn success" onClick={cargar} disabled={!bag.length && !rows.length}>Cargar</button>
        </div>
      </div>
    </div>
  );
}

/* ===================== Editor de Plan ===================== */
function PlanEditor({ planId, onBack }) {
  const [plan, setPlan] = useState(null);
  const [listas, setListas] = useState([]);
  const [lines, setLines] = useState([]);
  const [saving, setSaving] = useState(false);
  const [openModal, setOpenModal] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const snapL = await getDocs(query(collection(db, COLLECTIONS.listas_precios), orderBy("nombre", "asc"))).catch(() => null);
      if (alive) setListas(snapL ? snapL.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })) : []);

      const pSnap = await getDoc(doc(db, "planes", planId));
      if (!pSnap.exists()) return;
      const pdata = { id: pSnap.id, ...(pSnap.data() || {}) };
      if (alive) setPlan(pdata);

      const itemsSnap = await getDocs(collection(db, "planes", planId, "planes_items"));
      const its = itemsSnap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
      if (alive) setLines(its);
    })();
    return () => { alive = false; };
  }, [planId]);

  const listaId = plan?.listaId || "";
  const updateHead = (patch) => setPlan((p) => ({ ...(p || {}), ...patch }));

  const recompute = (ln) => {
    const cant = clamp(toNumber(ln.cantidad, 1), 1, 999999);
    const precio = toNumber(ln.precio, 0);

    const permite = !!(ln._permite_desc ?? true);
    const topePct = Number.isFinite(ln._max_desc_pct) ? ln._max_desc_pct : 100;
    const topeAbs = Number.isFinite(ln._max_desc_valor) ? ln._max_desc_valor : Infinity;

    const pct = clamp(toNumber(ln.descuentoPct, 0), 0, topePct);
    const abs = clamp(toNumber(ln.descuentoValor, 0), 0, topeAbs);

    const baseAmt = precio * cant;
    const pctAmt = baseAmt * (permite ? pct : 0) / 100;
    const absAmt = permite ? Math.min(abs, topeAbs, baseAmt) : 0;
    const disc = permite ? Math.min(Math.max(pctAmt, absAmt), baseAmt) : 0;

    const total = Math.max(0, baseAmt - disc);
    return { ...ln, cantidad: cant, precio, descuentoPct: pct, descuentoValor: abs, total };
  };

  const addLines = (arr) => {
    setLines((prev) => {
      const map = new Map(prev.map((x) => [x.codigo, { ...x }]));
      for (const it of arr) {
        if (map.has(it.codigo)) {
          const m = { ...map.get(it.codigo) };
          m.cantidad = clamp((toNumber(m.cantidad,1) + toNumber(it.cantidad,1)), 1, 999999);
          m.precio = toNumber(it.precio, m.precio || 0);
          m.descuentoPct = toNumber(m.descuentoPct, 0);
          m.descuentoValor = toNumber(m.descuentoValor, 0);
          m.observaciones = m.observaciones || "";
          m._max_desc_pct = toNumber(m._max_desc_pct ?? it._max_desc_pct ?? 0);
          m._max_desc_valor = toNumber(m._max_desc_valor ?? it._max_desc_valor ?? 0);
          m._permite_desc = (m._permite_desc ?? it._permite_desc ?? true);
          m._flags = m._flags || it._flags || {};
          map.set(it.codigo, recompute(m));
        } else {
          map.set(it.codigo, recompute({ ...it, descuentoValor: toNumber(it.descuentoValor, 0) }));
        }
      }
      return Array.from(map.values());
    });
  };

  const updateLine = (idx, patch) => {
    setLines((prev) => {
      const next = [...prev];
      next[idx] = recompute({ ...next[idx], ...patch });
      return next;
    });
  };

  const removeLine = async (id, idx) => {
    if (!plan?.id) { setLines((p) => p.filter((_, i) => i !== idx)); return; }
    if (id) await deleteDoc(doc(db, "planes", plan.id, "planes_items", id));
    setLines((p) => id ? p.filter((x) => x.id !== id) : p.filter((_, i) => i !== idx));
  };

  // 👇 añadimos editar para que el botón funcione y no falle
  const editar = (ln) => { alert(`(Demo) Editar: ${ln.codigo} — ${ln.nombre}`); };
  const agendar = (ln) => { alert(`(Demo) Agendar: ${ln.codigo} — ${ln.nombre}`); };
  const facturar = (ln) => { alert(`(Demo) Facturar: ${ln.codigo} — ${ln.nombre}`); };

  const saveAll = async () => {
    if (!plan?.nombre?.trim()) return alert("El nombre del plan es obligatorio.");
    if (!plan?.listaId) return alert("Selecciona la lista de precios.");
    setSaving(true);
    try {
      await updateDoc(doc(db, "planes", plan.id), {
        nombre: plan.nombre.trim(),
        listaId: plan.listaId,
        actualizado: serverTimestamp(),
      });
      const colRef = collection(db, "planes", plan.id, "planes_items");
      await Promise.all(
        lines.map(async (ln) => {
          const rec = recompute(ln);
          const payload = {
            codigo: rec.codigo || "",
            nombre: rec.nombre || "",
            precio: toNumber(rec.precio, 0),
            cantidad: toNumber(rec.cantidad, 1),
            descuentoPct: toNumber(rec.descuentoPct, 0),
            descuentoValor: toNumber(rec.descuentoValor, 0),
            observaciones: rec.observaciones || "",
            total: toNumber(rec.total, 0),
            _max_desc_pct: toNumber(rec._max_desc_pct, 0),
            _max_desc_valor: toNumber(rec._max_desc_valor, 0),
            _permite_desc: !!(rec._permite_desc ?? true),
            _flags: rec._flags || {},
            actualizado: serverTimestamp(),
          };
          if (ln.id) await updateDoc(doc(colRef, ln.id), payload);
          else await addDoc(colRef, { ...payload, creado: serverTimestamp() });
        })
      );
      alert("✅ Plan guardado.");
    } catch (e) {
      console.error(e);
      alert("❌ No se pudo guardar el plan.");
    } finally {
      setSaving(false);
    }
  };

  if (!plan) return <div className="oc-muted">Cargando plan…</div>;

  const totalPlan = lines.reduce((acc, ln) =>
    acc + (Number.isFinite(ln.total) ? ln.total : toNumber(ln.precio,0)*toNumber(ln.cantidad,1)), 0);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <h3 style={{ margin:0 }}>Edición de plan</h3>
        <div style={{ display:"flex", gap:8 }}>
          <button className="oc-btn" onClick={onBack}>Volver</button>
          <button className="oc-btn primary" onClick={saveAll} disabled={saving}>{saving?"Guardando…":"Guardar cambios"}</button>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"120px 1fr", gap:10, alignItems:"center", marginBottom:8 }}>
        <label>Nombre</label>
        <input className="oc-input" value={plan.nombre || ""} onChange={(e) => updateHead({ nombre: e.target.value })} />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"120px 1fr auto", gap:10, alignItems:"center", marginBottom:16 }}>
        <label>Lista de precios</label>
        <select className="oc-select" value={plan.listaId || ""} onChange={(e) => updateHead({ listaId: e.target.value })}>
          <option value="">Seleccione…</option>
          {listas.map((l) => <option key={l.id} value={l.id}>{l.nombre || l.id}</option>)}
        </select>
        <button className="oc-btn outline small" onClick={() => setOpenModal(true)}>+ Productos</button>
      </div>

      {/* ===== Tabla interna del editor (solo cambios visuales) ===== */}
      <div className="table-wrap oc-scroll-x">
        <table className="oc-tbl sticky plan-editor">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th className="oc-num">Valor<br/>unit.</th>
              <th className="oc-num">Cant.</th>
              <th className="oc-num">Desc.<br/>%</th>
              <th className="oc-num">Desc.<br/>$</th>
              <th>Observaciones</th>
              <th className="oc-num">Total</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={9} className="oc-muted">Sin productos en el plan.</td></tr>
            ) : lines.map((ln, i) => (
              <tr key={ln.id || `new-${i}`}>
                <td className="mono oc-code">{ln.codigo}</td>
                <td title={ln.nombre}>{ln.nombre}</td>

                <td>
                  <input
                    type="number" min={0}
                    value={Number.isFinite(ln.precio)?ln.precio:0}
                    onChange={(e)=>updateLine(i,{precio:e.target.value})}
                    className="oc-input num"
                  />
                </td>

                <td>
                  <input
                    type="number" min={1}
                    value={ln.cantidad||1}
                    onChange={(e)=>updateLine(i,{cantidad:e.target.value})}
                    className="oc-input num"
                  />
                </td>

                <td>
                  <input
                    type="number" min={0} max={100}
                    value={ln.descuentoPct||0}
                    onChange={(e)=>updateLine(i,{descuentoPct:e.target.value})}
                    className="oc-input num"
                  />
                </td>

                <td>
                  <input
                    type="number" min={0}
                    value={ln.descuentoValor||0}
                    onChange={(e)=>updateLine(i,{descuentoValor:e.target.value})}
                    className="oc-input num"
                  />
                </td>

                <td>
                  <input
                    className="oc-input" value={ln.observaciones||""}
                    onChange={(e)=>updateLine(i,{observaciones:e.target.value})}
                  />
                </td>

                <td className="mono oc-num">
                  {COP.format(
                    (Number.isFinite(ln.total) ? ln.total :
                      (toNumber(ln.precio,0)*toNumber(ln.cantidad,1)))
                  )}
                </td>

                <td>
                  <div className="oc-actions">
                    <button className="oc-btn outline small" onClick={()=>editar(ln)}>Editar</button>
                    <button className="oc-btn outline small" onClick={()=>facturar(ln)}>Facturar</button>
                    <button className="oc-btn danger small" onClick={()=>removeLine(ln.id, i)}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Total del plan */}
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:8,fontWeight:700}}>
        <span style={{marginRight:8}}>Total del plan:</span>
        <span className="mono">{COP.format(totalPlan)}</span>
      </div>

      {openModal && (
        <AgregarProductosModal
          listaId={listaId}
          onClose={() => setOpenModal(false)}
          onLoadLines={addLines}
        />
      )}
    </div>
  );
}

/* ===================== Listado / Crear / Editar (wrapper) ===================== */
export default function Planes({ mode, planId }) {
  usePlanesStyles();

  const [localMode, setLocalMode] = useState(mode || "list");
  const [editId, setEditId] = useState(planId || null);

  const [term, setTerm] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listas, setListas] = useState([]);
  const [nuevo, setNuevo] = useState({ nombre: "", listaId: "" });

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const snapL = await getDocs(query(collection(db, COLLECTIONS.listas_precios), orderBy("nombre", "asc"))).catch(() => null);
        if (alive) setListas(snapL ? snapL.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })) : []);
        const snap = await getDocs(query(collection(db, "planes"), orderBy("nombre", "asc")));
        if (alive) setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => { if (mode) setLocalMode(mode); }, [mode]);
  useEffect(() => { if (planId) setEditId(planId); }, [planId]);

  const filtered = useMemo(() => {
    const t = normalize(term);
    if (!t) return rows;
    return rows.filter((r) => normalize(`${r.nombre} ${r.listaNombre || ""}`).includes(t));
  }, [rows, term]);

  const crear = async () => {
    if (!nuevo.nombre?.trim()) return alert("El nombre es obligatorio.");
    if (!nuevo.listaId) return alert("Selecciona una lista de precios.");
    const lista = listas.find((l) => l.id === nuevo.listaId);
    const ref = await addDoc(collection(db, "planes"), {
      nombre: nuevo.nombre.trim(),
      listaId: nuevo.listaId,
      listaNombre: lista?.nombre || "",
      creado: serverTimestamp(),
      actualizado: serverTimestamp(),
    });
    setRows((p) => [...p, { id: ref.id, nombre: nuevo.nombre.trim(), listaId: nuevo.listaId, listaNombre: lista?.nombre || "" }]);
    setNuevo({ nombre: "", listaId: "" });
    setEditId(ref.id);
    setLocalMode("edit");
  };

  const eliminar = async (row) => {
    if (!window.confirm(`¿Eliminar el plan "${row.nombre}"?`)) return;
    await deleteDoc(doc(db, "planes", row.id));
    setRows((p) => p.filter((x) => x.id !== row.id));
  };

  if (localMode === "edit" && editId) {
    return (
      <PlanEditor
        planId={editId}
        onBack={() => { setLocalMode("list"); setEditId(null); }}
      />
    );
  }

  if (localMode === "new") {
    return (
      <div>
        <h2 style={{ marginTop:0 }}>Nuevo plan</h2>
        <div className="card" style={{ background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:12,marginBottom:12 }}>
          <div style={{ display:"grid", gridTemplateColumns:"minmax(220px, 1fr) minmax(240px, 1fr) auto", gap:8, alignItems:"center" }}>
            <input className="oc-input" placeholder="Nombre del plan" value={nuevo.nombre} onChange={(e)=>setNuevo((p)=>({ ...p, nombre:e.target.value }))} />
            <select className="oc-select" value={nuevo.listaId} onChange={(e)=>setNuevo((p)=>({ ...p, listaId:e.target.value }))}>
              <option value="">Seleccione lista de precios…</option>
              {listas.map((l)=> <option key={l.id} value={l.id}>{l.nombre || l.id}</option>)}
            </select>
            <button className="oc-btn primary" onClick={crear}>Crear</button>
          </div>
        </div>
        <button className="oc-btn" onClick={() => setLocalMode("list")}>Volver</button>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginTop:0 }}>Planes</h2>

      <div className="card" style={{ background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:12,marginBottom:12 }}>
        <h3 style={{ marginTop:0 }}>Nuevo plan</h3>
        <div style={{ display:"grid", gridTemplateColumns:"minmax(220px, 1fr) minmax(240px, 1fr) auto", gap:8, alignItems:"center" }}>
          <input className="oc-input" placeholder="Nombre del plan" value={nuevo.nombre} onChange={(e)=>setNuevo((p)=>({ ...p, nombre:e.target.value }))} />
          <select className="oc-select" value={nuevo.listaId} onChange={(e)=>setNuevo((p)=>({ ...p, listaId:e.target.value }))}>
            <option value="">Seleccione lista de precios…</option>
            {listas.map((l)=> <option key={l.id} value={l.id}>{l.nombre || l.id}</option>)}
          </select>
          <button className="oc-btn primary" onClick={crear}>Crear</button>
        </div>
      </div>

      <div className="card" style={{ background:"#fff",border:"1px solid #e5e7eb",borderRadius:12,padding:12 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <h3 style={{ margin:0 }}>Listado</h3>
          <input className="oc-input" placeholder="Buscar…" value={term} onChange={(e)=>setTerm(e.target.value)} style={{ minWidth:240 }} />
        </div>

        {loading ? (
          <div className="oc-muted">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="oc-muted">Sin planes.</div>
        ) : (
          <div className="table-wrap oc-scroll-x">
            <table className="oc-tbl sticky">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Lista de precios</th>
                  <th style={{ width:220 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="oc-name" title={r.nombre}>{r.nombre}</td>
                    <td className="oc-name" title={r.listaNombre || r.listaId || "—"}>{r.listaNombre || r.listaId || "—"}</td>
                    <td>
                      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                        <button className="oc-btn outline small" onClick={()=>{ setEditId(r.id); setLocalMode("edit"); }}>Editar</button>
                        <button className="oc-btn danger small" onClick={()=>eliminar(r)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
