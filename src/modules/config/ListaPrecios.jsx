// ===============================
// 🧾 ListaPrecios.jsx
// Configuración → Lista de precios (iconos + Nuevo producto + Editar en la misma vista)
// ===============================
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where
} from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";

// 🧩 API para sincronizar con listas_precios (categorías/items + espejos)
import { saveItemEnLista } from "../../utils/listaPreciosApi";

// ---------- helpers ----------
function getDashBase(pathname = "") {
  const segs = pathname.split("/").filter(Boolean);
  const i = segs.findIndex((s) => s.startsWith("dashboard_"));
  return i >= 0 ? `/${segs.slice(0, i + 1).join("/")}` : "";
}

// COP en vivo
const formatCOPInput = (v) => {
  let d = String(v ?? "").replace(/\D/g, "");
  if (d === "") return "";
  d = d.replace(/^0+(?=\d)/, "");
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};
const toNumber = (v) => Number(String(v ?? "").replace(/\D/g, "")) || 0;

// Descargar CSV util
function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) =>
      row
        .map((v) => {
          const s = String(v ?? "").replace(/"/g, '""');
          return /[",\n]/.test(s) ? `"${s}"` : s;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- estilos (solo UI) ----------
function useInlineStyles() {
  useEffect(() => {
    document.getElementById("lp-acciones-unificadas-icons26")?.remove();
    document.getElementById("lp-acciones-unificadas-icons_v2")?.remove();

    const ID = "lp-acciones-unificadas-icons_v2";
    const css = `
      .lp-wrap{padding:0;}
      .lp-h2{margin:0 0 12px;font-weight:800;font-size:20px;color:#0f172a;}

      .lp-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;}
      .lp-pill{padding:7px 16px;border-radius:999px;border:1px solid #d1d5db;background:#fff;
        font-weight:600;color:#374151;cursor:pointer;font-size:14px;transition:.2s;}
      .lp-pill:hover{background:#f3f4f6;}
      .lp-pill.active{background:#2b6cb0;color:#fff;border-color:#2b6cb0;}

      .lp-card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:18px;box-shadow:0 1px 2px rgba(0,0,0,.04);}
      .lp-card-header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px;}
      .lp-subtitle{font-size:16px;font-weight:800;color:#111827;margin:0 0 8px;border-bottom:1px solid #e5e7eb;padding-bottom:6px;}

      .chip{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 12px;border-radius:999px;border:1px solid #d1d5db;
        background:#fff;color:#374151;font-weight:600;cursor:pointer;transition:.2s;white-space:nowrap;}
      .chip:hover{background:#f3f4f6;}
      .btn-soft{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;border:none;cursor:pointer;
        font-weight:700;font-size:13px;background:#22c55e;color:#fff;}
      .btn-soft.gray{background:#6b7280;}
      .btn-soft:hover{filter:brightness(.95);}

      .lp-table-wrap{overflow-x:hidden;width:100%;}
      .lp-card table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:14px;}
      thead tr{background:#f9fafb;}
      th,td{padding:8px 10px;white-space:normal;word-break:break-word;vertical-align:middle;}
      th{text-align:left;border-bottom:1px solid #e5e7eb;font-weight:700;color:#475569;}
      tbody tr{border-top:1px solid #f1f5f9;}
      .muted{color:#6b7280;}

      /* Acciones unificadas */
      th.actions, td.actions{width:140px;text-align:right;}
      .lp-actions{display:flex;gap:8px;justify-content:flex-end;align-items:center;flex-wrap:nowrap;}

      .iconbtn{
        display:inline-flex;align-items:center;justify-content:center;
        width:32px;height:32px;border-radius:10px;border:1px solid transparent;cursor:pointer;transition:.15s;
      }
      .iconbtn.green{background:#ecfdf5;color:#0f9d5b;border-color:#bbf7d0;}
      .iconbtn.blue {background:#eff6ff;color:#1e3a8a;border-color:#bfdbfe;}
      .iconbtn.red  {background:#fef2f2;color:#b91c1c;border-color:#fecaca;}
      .iconbtn:hover{filter:brightness(.97);}

      .iconbtn > svg{
        width:38px !important;
        height:38px !important;
        display:block;
        stroke-width:2.4;
        vector-effect: non-scaling-stroke;
        pointer-events:none;
      }

      .badge{display:inline-block;padding:5px 10px;border-radius:999px;font-weight:700;font-size:12px;line-height:1;}
      .badge.green{background:#e8f7ee;color:#16a34a;border:1px solid #cbead7;}

      /* ---------- Form (nuevo/editar) ---------- */
      .np-grid{display:grid;grid-template-columns:1fr;gap:12px;margin-top:6px;}
      .np-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
      .np-row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}
      .np-field{display:flex;flex-direction:column;gap:6px;}
      .np-label{font-weight:700;color:#334155;font-size:13px;}
      .np-input, .np-select, .np-text{
        border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;font-size:14px;background:#fff;
      }
      .np-text{min-height:72px;resize:vertical;}
      .np-toggle{display:flex;align-items:center;gap:10px;}
      .np-card-img{display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:6px;}
      .np-avatar{width:140px;height:140px;border-radius:12px;background:#e5e7eb;display:flex;align-items:center;justify-content:center;color:#64748b;}
      .np-drop{border:2px dashed #d1d5db;border-radius:12px;padding:16px;text-align:center;color:#64748b;}
      .np-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:14px;}

      @media (max-width:900px){
        .np-row, .np-row-3{grid-template-columns:1fr;}
      }
    `;
    const tag = document.createElement("style");
    tag.id = ID;
    tag.appendChild(document.createTextNode(css));
    document.head.appendChild(tag);
  }, []);
}

/* --------- Íconos (SVG) --------- */
const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
  </svg>
);
const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
    <path d="M10 11v6M14 11v6"></path>
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6L9 17l-5-5"></path>
  </svg>
);

/* ==========================================================
   CLÍNICOS
========================================================== */
function ListaClinicosInline() {
  const [loading, setLoading] = useState(true);
  const [listas, setListas] = useState([]);
  const [modo, setModo] = useState("list");
  const [nombre, setNombre] = useState("");

  const { pathname } = useLocation();
  const navigate = useNavigate();
  const baseDash = useMemo(() => getDashBase(pathname), [pathname]);

  const cargar = async () => {
    setLoading(true);
    try {
      // Solo listas tipo "clinicos"
      const qref = query(collection(db, "listas_precios"), where("tipo", "==", "clinicos"));
      const snap = await getDocs(qref);
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      arr.sort((a, b) =>
        String(b.actualizado || b.creado || "").localeCompare(String(a.actualizado || a.creado || ""))
      );
      setListas(arr);
    } catch {
      setListas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const crear = async () => {
    if (!nombre.trim()) return alert("Escribe el nombre de la lista.");
    const ahora = new Date().toLocaleString("es-CO");
    const data = { nombre: nombre.trim(), creado: ahora, actualizado: ahora, en_uso: false, tipo: "clinicos" };
    const ref = await addDoc(collection(db, "listas_precios"), data);
    setListas((prev) => [{ id: ref.id, ...data }, ...prev]);
    setNombre(""); setModo("list");
  };

  const usar = async (row) => {
    // Desactivar "en_uso" solo entre listas clínicos
    const qref = query(collection(db, "listas_precios"), where("tipo", "==", "clinicos"));
    const snap = await getDocs(qref);
    await Promise.all(
      snap.docs.map((d) => updateDoc(doc(db, "listas_precios", d.id), { en_uso: d.id === row.id }))
    );
    setListas((prev) => prev.map((x) => ({ ...x, en_uso: x.id === row.id })));
  };

  const eliminar = async (row) => {
    if (!window.confirm(`¿Eliminar "${row?.nombre}"?`)) return;
    await deleteDoc(doc(db, "listas_precios", row.id));
    setListas((prev) => prev.filter((x) => x.id !== row.id));
  };

  const clonar = async (row) => {
    const ahora = new Date().toLocaleString("es-CO");
    const { id, ...base } = row;
    const payload = { ...base, nombre: `${row?.nombre || "Lista"} (copia)`, en_uso: false, creado: ahora, actualizado: ahora };
    const ref = await addDoc(collection(db, "listas_precios"), payload);
    setListas((prev) => [{ id: ref.id, ...payload }, ...prev]);
  };

  const irEditar = (row) => navigate(`${baseDash}/config/lista-de-precios/editar/${row.id}`);

  return (
    <div className="lp-card">
      <h3 className="lp-subtitle">Lista de precios clínicos</h3>

      {modo === "list" ? (
        <>
          <div className="lp-card-header">
            <div></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="chip" onClick={() => setModo("nuevo")}>
                <span style={{ fontWeight: 800, fontSize: 16 }}>＋</span> Nuevo listado de precios
              </button>
              <button
                className="chip"
                onClick={() =>
                  downloadCsv(
                    "Plantilla_Clinicos.csv",
                    [
                      ["Categoría","Código","Nombre","Permite desc","Precio","Genera RIPS","Es consulta","Ver en agenda","Cuenta contable"],
                      ["Odontología General","890201","Consulta inicial","si","0","no","si","no","4 · Ingresos"]
                    ]
                  )
                }
              >
                Exportar plantilla
              </button>
            </div>
          </div>

          <div className="lp-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Fecha de creación</th>
                  <th>Fecha de actualización</th>
                  <th>En uso</th>
                  <th className="actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ textAlign: "center" }}>Cargando…</td></tr>
                ) : listas.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center" }} className="muted">Sin datos</td></tr>
                ) : (
                  listas.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r?.nombre || "—"}</td>
                      <td>{r?.creado || "—"}</td>
                      <td>{r?.actualizado || "—"}</td>
                      <td>
                        {r?.en_uso ? (
                          <span className="badge green">En uso</span>
                        ) : (
                          <button className="btn-soft" onClick={() => usar(r)} title="Usar esta lista" aria-label="Usar esta lista">
                            <CheckIcon /> Usar
                          </button>
                        )}
                      </td>
                      <td className="actions">
                        <div className="lp-actions">
                          <button className="iconbtn green" title="Clonar" onClick={() => clonar(r)} aria-label="Clonar"><CopyIcon /></button>
                          <button className="iconbtn blue"  title="Editar" onClick={() => irEditar(r)} aria-label="Editar"><EditIcon /></button>
                          <button className="iconbtn red"   title="Eliminar" onClick={() => eliminar(r)} aria-label="Eliminar"><TrashIcon /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div>
          <div className="lp-card-header">
            <h4 style={{ margin: 0, fontWeight: 700 }}>Nueva lista de precios</h4>
            <button className="chip" onClick={() => setModo("list")}>← Volver</button>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", maxWidth: 560, marginTop: 10 }}>
            <input
              type="text"
              placeholder="Nombre de la lista"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              style={{ flex: 1, border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 10px" }}
            />
            <button
              type="button"
              title="Sugerir nombre automático"
              className="chip"
              onClick={() => setNombre("Lista de precios " + new Date().toLocaleDateString("es-CO"))}
            >
              ⓘ
            </button>
            <button className="btn-soft" onClick={crear}>Guardar</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================================
   PRODUCTOS — listado + NUEVO/EDITAR en la misma vista
========================================================== */
function ListaProductosInline() {
  const [rows, setRows] = useState([]);
  const [modo, setModo] = useState("list"); // list | nuevo | editar
  const [imgPreview, setImgPreview] = useState(null);
  const [editId, setEditId] = useState(null);

  // 🆕 Detectar la lista clínicos "En uso" para adjuntar listaId a cada producto
  const [listaIdEnUso, setListaIdEnUso] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const qref = query(
          collection(db, "listas_precios"),
          where("tipo", "==", "clinicos"),
          where("en_uso", "==", true)
        );
        const snap = await getDocs(qref);
        const first = snap.docs?.[0];
        setListaIdEnUso(first ? first.id : "");
      } catch {
        setListaIdEnUso("");
      }
    })();
  }, []);

  // Estado del formulario compartido
  const init = {
    nombre: "", referencia: "", descripcion: "",
    cuentaContable: "", categoria: "",
    esServicio: false, precioCompra: "",
    marca: "", principioActivo: "", registroInvima: "",
    formaFarmaceutica: "", concentracion: "", presentacionComercial: "",
    tempAlmacenamiento: "", unidadTemperatura: "",
    humedadAlmacenamiento: "", unidadHumedad: "",
    esInventariable: false, clasificacionRiesgo: "", vidaUtil: "",
    periodicidadMantenimiento: "", periodicidadCalibracion: "",
    extTexto1: "", extTexto2: "", extNumero1: "", extNumero2: "",
    extFecha1: "", extFecha2: ""
  };
  const [f, setF] = useState(init);

  // Cargar tabla
  const cargar = async () => {
    try {
      const snap = await getDocs(collection(db, "listas_precios_productos"));
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRows(arr);
    } catch { setRows([]); }
  };
  useEffect(() => { cargar(); }, []);

  // Acciones tabla
  const clonar = async (row) => {
    const { id, ...base } = row;
    const ref = await addDoc(collection(db, "listas_precios_productos"), {
      ...base, nombre: `${row?.nombre || "Producto"} (copia)`,
      creado: new Date().toISOString()
    });
    setRows((p) => [{ id: ref.id, ...base, nombre: `${row?.nombre || "Producto"} (copia)` }, ...p]);
  };

  const eliminar = async (row) => {
    if (!window.confirm(`¿Eliminar "${row?.nombre}"?`)) return;
    await deleteDoc(doc(db, "listas_precios_productos", row.id));
    setRows((p) => p.filter((x) => x.id !== row.id));
  };

  // Imagen
  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImgPreview(reader.result);
    reader.readAsDataURL(file);
  };

  // Exportar plantilla CSV
  const exportarPlantilla = () => {
    const head = [
      "Nombre","Referencia","Descripción","Cuenta contable","Categoría",
      "Es servicio","Precio compra","Marca","Principio activo","Registro Invima",
      "Forma farmacéutica","Concentración","Presentación comercial",
      "Temp. almacenamiento","Unidad temp.","Humedad almac.","Unidad humedad",
      "Es inventariable","Clasif. riesgo","Vida útil",
      "Periodicidad mant.","Periodicidad calib.",
      "Ext. texto 1","Ext. texto 2","Ext. número 1","Ext. número 2","Ext. fecha 1","Ext. fecha 2"
    ];
    const sample = [
      "Hilo reabsorbible 3/0","","","4 · Ingresos","Insumos",
      "no","0","Marca X","","",
      "Sutura","","",
      "25","°C","60","%","si","","",
      "12 meses","12 meses",
      "","","","","",""
    ];
    downloadCsv("Plantilla_Productos.csv", [head, sample]);
  };

  // Guardar nuevo
  const guardarProducto = async () => {
    if (!f.nombre.trim()) return alert("El nombre es obligatorio.");

    // 1) Guarda en tu colección actual de productos (como ya hacías)
    const payload = {
      ...f,
      precioCompra: toNumber(f.precioCompra),
      creado: new Date().toISOString(),
      imgPreview: imgPreview || null,
      // clave para que Planes encuentre en el espejo 'listas_precios_productos'
      listaId: listaIdEnUso || null,
    };
    const ref = await addDoc(collection(db, "listas_precios_productos"), payload);

    // 2) 🆕 Si hay lista 'en uso', reflejar también en listas_precios/{listaId}/items
    if (!listaIdEnUso) {
      alert("Guardado. Nota: selecciona una 'Lista de precios clínicos' EN USO para que Planes tome precio automáticamente.");
    } else {
      try {
        await saveItemEnLista({
          listaId: listaIdEnUso,
          categoriaNombre: f.categoria || "Productos",
          dataRaw: {
            codigo: f.referencia,             // ← código / referencia
            nombre: f.nombre,
            precio: toNumber(f.precioCompra),
            permite_desc: true,
            max_desc_pct: 0,
            max_desc_valor: 0,
            comentario: f.descripcion || "",
          },
        });
      } catch (e) {
        console.error("No se pudo reflejar en listas_precios:", e);
      }
    }

    setRows((prev) => [{ id: ref.id, ...payload }, ...prev]);
    setF(init); setImgPreview(null); setModo("list");
    alert("Producto guardado.");
  };

  // Abrir editar
  const abrirEditar = (row) => {
    setEditId(row.id);
    setF({
      nombre: row.nombre || "",
      referencia: row.referencia || "",
      descripcion: row.descripcion || "",
      cuentaContable: row.cuentaContable || "",
      categoria: row.categoria || "",
      esServicio: !!row.esServicio,
      precioCompra: row.precioCompra ? formatCOPInput(row.precioCompra) : "",
      marca: row.marca || "",
      principioActivo: row.principioActivo || "",
      registroInvima: row.registroInvima || "",
      formaFarmaceutica: row.formaFarmaceutica || "",
      concentracion: row.concentracion || "",
      presentacionComercial: row.presentacionComercial || "",
      tempAlmacenamiento: row.tempAlmacenamiento || "",
      unidadTemperatura: row.unidadTemperatura || "",
      humedadAlmacenamiento: row.humedadAlmacenamiento || "",
      unidadHumedad: row.unidadHumedad || "",
      esInventariable: !!row.esInventariable,
      clasificacionRiesgo: row.clasificacionRiesgo || "",
      vidaUtil: row.vidaUtil || "",
      periodicidadMantenimiento: row.periodicidadMantenimiento || "",
      periodicidadCalibracion: row.periodicidadCalibracion || "",
      extTexto1: row.extTexto1 || "",
      extTexto2: row.extTexto2 || "",
      extNumero1: row.extNumero1 ?? "",
      extNumero2: row.extNumero2 ?? "",
      extFecha1: row.extFecha1 || "",
      extFecha2: row.extFecha2 || ""
    });
    setImgPreview(row.imgPreview || null);
    setModo("editar");
  };

  // Actualizar edición
  const actualizarProducto = async () => {
    if (!editId) return;
    if (!f.nombre.trim()) return alert("El nombre es obligatorio.");

    // 1) Actualiza tu colección de productos
    const payload = {
      ...f,
      precioCompra: toNumber(f.precioCompra),
      actualizado: new Date().toISOString(),
      imgPreview: imgPreview || null,
      listaId: listaIdEnUso || null,
    };
    await updateDoc(doc(db, "listas_precios_productos", editId), payload);

    // 2) 🆕 Reflejar también en la lista 'en uso'
    if (!listaIdEnUso) {
      alert("Actualizado. Nota: selecciona una 'Lista de precios clínicos' EN USO para que Planes tome precio automáticamente.");
    } else {
      try {
        await saveItemEnLista({
          listaId: listaIdEnUso,
          categoriaNombre: f.categoria || "Productos",
          dataRaw: {
            codigo: f.referencia,
            nombre: f.nombre,
            precio: toNumber(f.precioCompra),
            permite_desc: true,
            max_desc_pct: 0,
            max_desc_valor: 0,
            comentario: f.descripcion || "",
          },
        });
      } catch (e) {
        console.error("No se pudo reflejar en listas_precios:", e);
      }
    }

    setRows((prev) => prev.map(r => r.id === editId ? { id: editId, ...payload } : r));
    setEditId(null); setF(init); setImgPreview(null); setModo("list");
    alert("Producto actualizado.");
  };

  // UI
  const FormTitulo = modo === "editar" ? "Editar producto" : "Nuevo producto";
  const AccionPrincipal = modo === "editar" ? actualizarProducto : guardarProducto;

  return (
    <div className="lp-card">
      <h3 className="lp-subtitle">Lista de precios productos</h3>

      {modo === "list" ? (
        <>
          <div className="lp-card-header">
            <div></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="chip" onClick={() => { setF(init); setImgPreview(null); setModo("nuevo"); }}>
                <span style={{ fontWeight: 800, fontSize: 16 }}>＋</span> Nuevo producto
              </button>
              <button className="chip" onClick={exportarPlantilla}>
                Exportar plantilla
              </button>
            </div>
          </div>

          <div className="lp-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Marca</th>
                  <th>Descripción</th>
                  <th className="actions">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={4} className="muted" style={{ textAlign: "center", padding: 18 }}>Sin datos</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r?.nombre || "—"}</td>
                    <td>{r?.marca || "—"}</td>
                    <td>{r?.descripcion || "—"}</td>
                    <td className="actions">
                      <div className="lp-actions">
                        <button className="iconbtn green" title="Clonar" onClick={() => clonar(r)} aria-label="Clonar"><CopyIcon /></button>
                        <button className="iconbtn blue"  title="Editar" onClick={() => abrirEditar(r)} aria-label="Editar"><EditIcon /></button>
                        <button className="iconbtn red"   title="Eliminar" onClick={() => eliminar(r)} aria-label="Eliminar"><TrashIcon /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="lp-card-header">
            <h4 style={{ margin: 0, fontWeight: 700 }}>{FormTitulo}</h4>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-soft gray" onClick={() => { setModo("list"); setEditId(null); setF(init); setImgPreview(null); }}>← Volver</button>
              <button className="btn-soft" onClick={AccionPrincipal}>{modo === "editar" ? "Actualizar" : "Guardar"}</button>
            </div>
          </div>

          {/* Imagen + Drop */}
          <div className="np-card-img">
            <div className="np-avatar">
              {imgPreview ? (
                <img src={imgPreview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }} />
              ) : (
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="12" cy="8" r="4"></circle>
                  <path d="M6 20c0-3.314 2.686 0 6 0s6 2.686 6 6"></path>
                </svg>
              )}
            </div>
            <div className="np-drop">
              <div style={{ marginBottom: 6 }}>Arrastra o haz click para cargar la foto.<br/>Solo archivos de imágenes</div>
              <input type="file" accept="image/*" onChange={onFile} />
            </div>
          </div>

          {/* Campos */}
          <div className="np-grid">
            <div className="np-row">
              <div className="np-field">
                <label className="np-label">Nombre*</label>
                <input className="np-input" value={f.nombre} onChange={e=>setF({...f,nombre:e.target.value})} placeholder="Nombre del concepto" />
              </div>
              <div className="np-field">
                <label className="np-label">Referencia (código)*</label>
                <input className="np-input" value={f.referencia} onChange={e=>setF({...f,referencia:e.target.value})} placeholder="Código / referencia" />
              </div>
            </div>

            <div className="np-field">
              <label className="np-label">Descripción</label>
              <textarea className="np-text" value={f.descripcion} onChange={e=>setF({...f,descripcion:e.target.value})} placeholder="Descripción del concepto" />
            </div>

            <div className="np-row">
              <div className="np-field">
                <label className="np-label">Cuenta contable</label>
                <input className="np-input" value={f.cuentaContable} onChange={e=>setF({...f,cuentaContable:e.target.value})} placeholder="Buscar ítem..." />
              </div>
              <div className="np-field">
                <label className="np-label">Categoría*</label>
                <select className="np-select" value={f.categoria} onChange={e=>setF({...f,categoria:e.target.value})}>
                  <option value="">Seleccione...</option>
                  <option>Medicamentos</option>
                  <option>Insumos</option>
                  <option>Equipos</option>
                </select>
              </div>
            </div>

            <div className="np-row">
              <div className="np-field np-toggle">
                <label className="np-label" style={{ margin: 0 }}>¿Es servicio?</label>
                <input type="checkbox" checked={f.esServicio} onChange={e=>setF({...f,esServicio:e.target.checked})} />
              </div>
              <div className="np-field">
                <label className="np-label">Precio compra*</label>
                <input
                  className="np-input"
                  inputMode="numeric"
                  value={f.precioCompra}
                  onChange={e=>setF({...f,precioCompra:formatCOPInput(e.target.value)})}
                  placeholder="$0"
                />
              </div>
            </div>

            <div className="np-row">
              <div className="np-field">
                <label className="np-label">Marca</label>
                <input className="np-input" value={f.marca} onChange={e=>setF({...f,marca:e.target.value})} placeholder="Marca del concepto" />
              </div>
              <div className="np-field">
                <label className="np-label">Principio activo</label>
                <input className="np-input" value={f.principioActivo} onChange={e=>setF({...f,principioActivo:e.target.value})} placeholder="Principio activo del concepto" />
              </div>
            </div>

            <div className="np-row">
              <div className="np-field">
                <label className="np-label">Registro Invima</label>
                <input className="np-input" value={f.registroInvima} onChange={e=>setF({...f,registroInvima:e.target.value})} placeholder="Información Invima del concepto" />
              </div>
              <div className="np-field">
                <label className="np-label">Forma farmacéutica</label>
                <input className="np-input" value={f.formaFarmaceutica} onChange={e=>setF({...f,formaFarmaceutica:e.target.value})} placeholder="Forma farmacéutica del concepto" />
              </div>
            </div>

            <div className="np-row">
              <div className="np-field">
                <label className="np-label">Concentración</label>
                <input className="np-input" value={f.concentracion} onChange={e=>setF({...f,concentracion:e.target.value})} placeholder="Concentración del concepto" />
              </div>
              <div className="np-field">
                <label className="np-label">Presentación comercial</label>
                <input className="np-input" value={f.presentacionComercial} onChange={e=>setF({...f,presentacionComercial:e.target.value})} placeholder="Presentación com. del concepto" />
              </div>
            </div>

            <div className="np-row-3">
              <div className="np-field">
                <label className="np-label">Temperatura de almacenamiento</label>
                <input className="np-input" value={f.tempAlmacenamiento} onChange={e=>setF({...f,tempAlmacenamiento:e.target.value})} placeholder="Temperatura de almacenamiento" />
              </div>
              <div className="np-field">
                <label className="np-label">Unidad de temperatura</label>
                <input className="np-input" value={f.unidadTemperatura} onChange={e=>setF({...f,unidadTemperatura:e.target.value})} placeholder="Unidad de temp. del concepto" />
              </div>
              <div className="np-field">
                <label className="np-label">Humedad de almacenamiento</label>
                <input className="np-input" value={f.humedadAlmacenamiento} onChange={e=>setF({...f,humedadAlmacenamiento:e.target.value})} placeholder="Humedad de almacenamiento" />
              </div>
            </div>

            <div className="np-row">
              <div className="np-field">
                <label className="np-label">Unidad de humedad</label>
                <input className="np-input" value={f.unidadHumedad} onChange={e=>setF({...f,unidadHumedad:e.target.value})} placeholder="Unidad de hum. del concepto" />
              </div>
              <div className="np-field np-toggle">
                <label className="np-label" style={{ margin: 0 }}>¿Es inventariable?</label>
                <input type="checkbox" checked={f.esInventariable} onChange={e=>setF({...f,esInventariable:e.target.checked})} />
              </div>
            </div>

            <div className="np-row">
              <div className="np-field">
                <label className="np-label">Clasificación de riesgo</label>
                <input className="np-input" value={f.clasificacionRiesgo} onChange={e=>setF({...f,clasificacionRiesgo:e.target.value})} placeholder="Clasif. riesgo del concepto" />
              </div>
              <div className="np-field">
                <label className="np-label">Vida útil</label>
                <input className="np-input" value={f.vidaUtil} onChange={e=>setF({...f,vidaUtil:e.target.value})} placeholder="Vida útil del concepto" />
              </div>
            </div>

            <div className="np-row">
              <div className="np-field">
                <label className="np-label">Periodicidad mantenimiento</label>
                <input className="np-input" value={f.periodicidadMantenimiento} onChange={e=>setF({...f,periodicidadMantenimiento:e.target.value})} placeholder="Periodicidad mant. del concepto" />
              </div>
              <div className="np-field">
                <label className="np-label">Periodicidad calibración</label>
                <input className="np-input" value={f.periodicidadCalibracion} onChange={e=>setF({...f,periodicidadCalibracion:e.target.value})} placeholder="Periodicidad cal. del concepto" />
              </div>
            </div>

            <div className="np-row">
              <div className="np-field">
                <label className="np-label">Extensión texto 1</label>
                <input className="np-input" value={f.extTexto1} onChange={e=>setF({...f,extTexto1:e.target.value})} placeholder="Ext. texto 1 del concepto" />
              </div>
              <div className="np-field">
                <label className="np-label">Extensión texto 2</label>
                <input className="np-input" value={f.extTexto2} onChange={e=>setF({...f,extTexto2:e.target.value})} placeholder="Ext. texto 2 del concepto" />
              </div>
            </div>

            <div className="np-row">
              <div className="np-field">
                <label className="np-label">Extensión número 1</label>
                <input className="np-input" inputMode="numeric" value={f.extNumero1} onChange={e=>setF({...f,extNumero1:formatCOPInput(e.target.value)})} placeholder="Ext. número 1 del concepto" />
              </div>
              <div className="np-field">
                <label className="np-label">Extensión número 2</label>
                <input className="np-input" inputMode="numeric" value={f.extNumero2} onChange={e=>setF({...f,extNumero2:formatCOPInput(e.target.value)})} placeholder="Ext. número 2 del concepto" />
              </div>
            </div>

            <div className="np-row">
              <div className="np-field">
                <label className="np-label">Extensión fecha 1 (dd/mm/aaaa)</label>
                <input className="np-input" type="date" value={f.extFecha1} onChange={e=>setF({...f,extFecha1:e.target.value})} />
              </div>
              <div className="np-field">
                <label className="np-label">Extensión fecha 2 (dd/mm/aaaa)</label>
                <input className="np-input" type="date" value={f.extFecha2} onChange={e=>setF({...f,extFecha2:e.target.value})} />
              </div>
            </div>

            <div className="np-actions">
              <button className="btn-soft gray" onClick={() => { setModo("list"); setEditId(null); setF(init); setImgPreview(null); }}>Cancelar</button>
              <button className="btn-soft" onClick={AccionPrincipal}>{modo === "editar" ? "Actualizar" : "Guardar"}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ==========================================================
   SERVICIOS (sin cambios de lógica)
========================================================== */
function ListaServiciosInline() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "listas_precios_servicios"));
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRows(arr);
      } catch { setRows([]); }
    })();
  }, []);

  const clonar = async (row) => {
    const { id, ...base } = row;
    const ref = await addDoc(collection(db, "listas_precios_servicios"), {
      ...base, nombre: `${row?.nombre || "Servicio"} (copia)`
    });
    setRows((p) => [{ id: ref.id, ...base, nombre: `${row?.nombre || "Servicio"} (copia)` }, ...p]);
  };
  const eliminar = async (row) => {
    if (!window.confirm(`¿Eliminar "${row?.nombre}"?`)) return;
    await deleteDoc(doc(db, "listas_precios_servicios", row.id));
    setRows((p) => p.filter((x) => x.id !== row.id));
  };

  const exportarPlantilla = () => {
    downloadCsv(
      "Plantilla_Servicios.csv",
      [
        ["Nombre","Descripción","Cuenta contable","Categoría","Precio base","Genera RIPS"],
        ["Toma de Rx periapical","","4 · Ingresos","Radiología","0","si"]
      ]
    );
  };

  return (
    <div className="lp-card">
      <h3 className="lp-subtitle">Lista de precios servicios</h3>

      <div className="lp-card-header">
        <div></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="chip" onClick={() => alert("Nuevo listado de servicios (próximamente)")}>
            <span style={{ fontWeight: 800, fontSize: 16 }}>＋</span> Nuevo listado de servicios
          </button>
          <button className="chip" onClick={exportarPlantilla}>
            Exportar plantilla
          </button>
        </div>
      </div>

      <div className="lp-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Marca</th>
              <th>Descripción</th>
              <th className="actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="muted" style={{ textAlign: "center", padding: 18 }}>Sin datos</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r?.nombre || "—"}</td>
                <td>{r?.marca || "—"}</td>
                <td>{r?.descripcion || "—"}</td>
                <td className="actions">
                  <div className="lp-actions">
                    <button className="iconbtn green" title="Clonar" onClick={() => clonar(r)} aria-label="Clonar"><CopyIcon /></button>
                    <button className="iconbtn blue"  title="Editar" onClick={() => alert("Editar servicio (próx.)")} aria-label="Editar"><EditIcon /></button>
                    <button className="iconbtn red"   title="Eliminar" onClick={() => eliminar(r)} aria-label="Eliminar"><TrashIcon /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ==========================================================
   CONTENEDOR
========================================================== */
export default function ListaPrecios() {
  useInlineStyles();
  const [tab, setTab] = useState("clinicos");

  return (
    <div className="lp-wrap">
      <h2 className="lp-h2">Configuración · Lista de precios</h2>

      <div className="lp-tabs">
        <button className={`lp-pill ${tab === "clinicos" ? "active" : ""}`} onClick={() => setTab("clinicos")}>
          Lista de precios clínicos
        </button>
        <button className={`lp-pill ${tab === "productos" ? "active" : ""}`} onClick={() => setTab("productos")}>
          Lista de precios productos
        </button>
        <button className={`lp-pill ${tab === "servicios" ? "active" : ""}`} onClick={() => setTab("servicios")}>
          Lista de precios servicios
        </button>
      </div>

      {tab === "productos" ? (
        <ListaProductosInline />
      ) : tab === "servicios" ? (
        <ListaServiciosInline />
      ) : (
        <ListaClinicosInline />
      )}
    </div>
  );
}
