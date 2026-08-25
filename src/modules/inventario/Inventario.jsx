import React, { useState, useEffect, useMemo } from "react";
import supabase from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { subscribeToCategories } from "../../services/resourceService";
import { getConfigItems } from "../../services/configPersistenceService";
import { toast } from "sonner";
import { 
  FiBox, FiAlertTriangle, FiMinus, FiPlus, 
  FiSettings, FiHelpCircle, FiChevronRight, FiDatabase 
} from "react-icons/fi";

// Sub-modules
import ProductosList from "./components/ProductosList";
import ProductoForm from "./components/ProductoForm";
import RecepcionProducto from "./components/RecepcionProducto";
import SalidaProducto from "./components/SalidaProducto";
import ListadoInventario from "./components/ListadoInventario";
import MovimientosInventario from "./components/MovimientosInventario";
import AjustesInventario from "./components/AjustesInventario";

const UnidadBadge = ({ unidad }) => {
  const colors = {
    unidades: "bg-blue-50 text-blue-600 border-blue-100",
    ml: "bg-purple-50 text-purple-600 border-purple-100",
    litros: "bg-indigo-50 text-indigo-600 border-indigo-100",
    g: "bg-emerald-50 text-emerald-600 border-emerald-100",
    kg: "bg-green-50 text-green-600 border-green-100",
    cajas: "bg-amber-50 text-amber-600 border-amber-100",
    pares: "bg-orange-50 text-orange-600 border-orange-100",
  };
  return (
    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${colors[unidad] || colors.unidades}`}>
      {unidad}
    </span>
  );
};

export default function Inventario() {
  const { userProfile } = useAuth();
  const inquilino = userProfile?.inquilino || "";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoriasList, setCategoriasList] = useState([]);

  // Warehouses (Almacenes)
  const [almacenes, setAlmacenes] = useState([]);
  const [selectedAlmacen, setSelectedAlmacen] = useState(() => {
    try {
      const saved = localStorage.getItem("selected_almacen_inventario");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [tempAlmacenId, setTempAlmacenId] = useState("");

  // Submodule navigation
  const [currentModule, setCurrentModule] = useState("productos"); // productos, gestion, recepcion, salida, listado, movimientos, ajustes
  const [showForm, setShowForm] = useState(false);
  const [activeFormItem, setActiveFormItem] = useState(null);

  // Load categories
  useEffect(() => {
    if (!inquilino) return;
    const unsubscribe = subscribeToCategories(inquilino, (data) => {
      setCategoriasList(data);
    });
    return () => unsubscribe();
  }, [inquilino]);

  // Load warehouses (Almacenes)
  useEffect(() => {
    if (!inquilino) return;
    const loadAlmacenes = async () => {
      try {
        let almList = await getConfigItems(inquilino, "almacenes", null);

        // Auto-populate default warehouses if empty
        if (almList.length === 0) {
          almList = [
            { id: `alm_1_${Date.now()}`, nombre: "ALMACÉN PRINCIPAL", tenant_id: inquilino },
            { id: `alm_2_${Date.now()}`, nombre: "BODEGA SECUNDARIA", tenant_id: inquilino }
          ];
        }
        setAlmacenes(almList.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")));
        if (almList.length > 0) setTempAlmacenId(almList[0].id);
      } catch (err) {
        console.error("Error loading warehouses:", err);
      }
    };
    loadAlmacenes();
  }, [inquilino]);

  // Load items
  useEffect(() => {
    if (!inquilino) return;
    const loadItems = async () => {
      try {
        let itemList = [];
        try {
          const { data } = await supabase
            .from("inventario")
            .select("*")
            .eq("tenant_id", inquilino)
            .order("nombre", { ascending: true });
          if (data && data.length > 0) itemList = data;
        } catch (e) {}

        if (itemList.length === 0) {
          const { data: cfgRow } = await supabase
            .from("website_config")
            .select("config")
            .eq("tenant_id", inquilino)
            .maybeSingle();
          itemList = cfgRow?.config?.inventario || [];
        }

        setItems(itemList);
        setLoading(false);
      } catch (err) {
        console.error("Error loading inventory:", err);
      }
    };
    loadItems();
  }, [inquilino]);

  const handleStockChange = async (item, delta) => {
    const newQty = Math.max(0, (item.cantidad || 0) + delta);
    try {
      await supabase
        .from("inventario")
        .update({
          cantidad: newQty,
          updated_at: new Date().toISOString()
        })
        .eq("id", item.id);
    } catch (e) {
      console.error("Error setting stock delta:", e);
    }
  };

  const handleSaveProduct = async (data) => {
    try {
      if (activeFormItem) {
        await supabase
          .from("inventario")
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq("id", activeFormItem.id);
        toast.success("Producto modificado correctamente.");
      } else {
        await supabase
          .from("inventario")
          .insert([{ ...data, tenant_id: inquilino, inquilino, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
        toast.success("Producto creado correctamente.");
      }
      setShowForm(false);
      setActiveFormItem(null);
    } catch (e) {
      console.error("Error saving product data:", e);
      toast.error("Error al guardar el producto.");
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm("¿Está seguro de eliminar este producto?")) return;
    try {
      await supabase.from("inventario").delete().eq("id", id);
      toast.success("Producto eliminado.");
    } catch (e) {
      console.error("Error deleting product:", e);
      toast.error("Error al eliminar el producto.");
    }
  };

  // Select warehouse form save
  const handleSelectAlmacen = (e) => {
    if (e) e.preventDefault();
    const alm = almacenes.find(a => a.id === tempAlmacenId);
    if (alm) {
      setSelectedAlmacen(alm);
      localStorage.setItem("selected_almacen_inventario", JSON.stringify(alm));
      toast.success(`Almacén seleccionado: ${alm.nombre}`);
    }
  };

  // Standard backup categories if empty
  const standardCategories = [
    { id: "cat-meds", nombre: "Medicamentos" },
    { id: "cat-insumos", nombre: "Insumos Clínicos" },
    { id: "cat-desinf", nombre: "Desinfectantes" },
    { id: "cat-equipos", nombre: "Equipos" },
    { id: "cat-lab", nombre: "Material de Laboratorio" },
    { id: "cat-oficina", nombre: "Oficina" }
  ];
  const categoriesToDisplay = categoriasList.length > 0 ? categoriasList : standardCategories;

  // Filter items for quick stock adjustments in "Gestión inventario" view
  const filteredQuickList = useMemo(() => {
    const t = searchTerm.toLowerCase();
    return items.filter(i =>
      (i.nombre || "").toLowerCase().includes(t) ||
      (i.descripcion || "").toLowerCase().includes(t) ||
      (i.referencia || "").toLowerCase().includes(t)
    );
  }, [items, searchTerm]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5 font-sans text-slate-800 animate-in fade-in duration-300">
      
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <FiBox className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
              <span>Administración</span>
              <FiChevronRight size={12} />
              <span className="text-emerald-600 font-bold">Inventario</span>
            </div>
            <h1 className="text-sm font-bold text-slate-800 tracking-tight">Gestión de Inventarios y Productos</h1>
          </div>
        </div>
        <div className="text-xs text-slate-500 font-medium hidden md:block">
          Control de stock, entradas, salidas y catálogo
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* 1. Left sub-navigation sidebar */}
        <div className="w-full lg:w-56 shrink-0">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="px-2 pb-1 border-b border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Información general</span>
            </div>

            <div className="flex flex-col gap-1">
              {/* Tab: Productos */}
              <div className="relative group/tooltip">
                <button
                  onClick={() => {
                    setCurrentModule("productos");
                    setShowForm(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                    currentModule === "productos" && !showForm
                      ? "bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
                  }`}
                >
                  <span>Productos</span>
                  <FiChevronRight size={13} className={currentModule === "productos" ? "opacity-100 text-emerald-600" : "opacity-0"} />
                </button>
                {/* Tooltip */}
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-52 p-2.5 bg-slate-800 text-white text-[11px] font-normal leading-snug rounded-lg shadow-xl border border-slate-700 opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity z-50">
                  Son los productos que ofrece la empresa, para la venta y/o compra. Estos también pueden ser de consumo interno.
                </div>
              </div>

              {/* Tab: Gestión inventario */}
              <button
                onClick={() => {
                  setCurrentModule("gestion");
                  setShowForm(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                  currentModule === "gestion" && !showForm
                    ? "bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
                }`}
              >
                <span>Gestión inventario</span>
                <FiChevronRight size={13} className={currentModule === "gestion" ? "opacity-100 text-emerald-600" : "opacity-0"} />
              </button>

              {/* Tab: Recepción producto */}
              <button
                onClick={() => {
                  setCurrentModule("recepcion");
                  setShowForm(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                  currentModule === "recepcion" && !showForm
                    ? "bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
                }`}
              >
                <span>Recepción producto</span>
                <FiChevronRight size={13} className={currentModule === "recepcion" ? "opacity-100 text-emerald-600" : "opacity-0"} />
              </button>

              {/* Tab: Salida producto */}
              <button
                onClick={() => {
                  setCurrentModule("salida");
                  setShowForm(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                  currentModule === "salida" && !showForm
                    ? "bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
                }`}
              >
                <span>Salida producto</span>
                <FiChevronRight size={13} className={currentModule === "salida" ? "opacity-100 text-emerald-600" : "opacity-0"} />
              </button>

              {/* Tab: Listado de inventario */}
              <button
                onClick={() => {
                  setCurrentModule("listado");
                  setShowForm(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                  currentModule === "listado" && !showForm
                    ? "bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
                }`}
              >
                <span>Listado de inventario</span>
                <FiChevronRight size={13} className={currentModule === "listado" ? "opacity-100 text-emerald-600" : "opacity-0"} />
              </button>

              {/* Tab: Listado de movimientos */}
              <button
                onClick={() => {
                  setCurrentModule("movimientos");
                  setShowForm(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                  currentModule === "movimientos" && !showForm
                    ? "bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
                }`}
              >
                <span>Listado de movimientos</span>
                <FiChevronRight size={13} className={currentModule === "movimientos" ? "opacity-100 text-emerald-600" : "opacity-0"} />
              </button>

              {/* Tab: Ajustes de inventario */}
              <button
                onClick={() => {
                  setCurrentModule("ajustes");
                  setShowForm(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                  currentModule === "ajustes" && !showForm
                    ? "bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium"
                }`}
              >
                <span>Ajustes de inventario</span>
                <FiChevronRight size={13} className={currentModule === "ajustes" ? "opacity-100 text-emerald-600" : "opacity-0"} />
              </button>
            </div>
          </div>
        </div>

        {/* 2. Right Module Content Area */}
        <div className="flex-1 min-w-0 w-full">
          {showForm ? (
            <ProductoForm 
              item={activeFormItem}
              categories={categoriesToDisplay}
              inquilino={inquilino}
              onSave={handleSaveProduct}
              onCancel={() => {
                setShowForm(false);
                setActiveFormItem(null);
              }}
            />
          ) : ["gestion", "salida", "listado", "movimientos", "ajustes"].includes(currentModule) && !selectedAlmacen ? (
            <div className="max-w-md mx-auto animate-in fade-in duration-300">
              <form onSubmit={handleSelectAlmacen} className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Almacén a usar</h3>
                </div>
                
                <div className="p-5 space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-slate-600">Almacén a usar *</label>
                    <select
                      required
                      className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 outline-none focus:border-emerald-500 transition-colors cursor-pointer"
                      value={tempAlmacenId}
                      onChange={e => setTempAlmacenId(e.target.value)}
                    >
                      <option value="">Seleccione...</option>
                      {almacenes.map(a => (
                        <option key={a.id} value={a.id}>{a.nombre.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-end pt-3 border-t border-slate-100">
                    <button
                      type="submit"
                      className="h-8 px-5 rounded-lg bg-[#7cb342] hover:bg-[#689f38] text-white text-xs font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer"
                    >
                      Aceptar
                    </button>
                  </div>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Shared Warehouse Indicator */}
              {["gestion", "salida", "listado", "movimientos", "ajustes"].includes(currentModule) && selectedAlmacen && (
                <div className="bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <FiDatabase className="text-emerald-600 shrink-0" size={14} />
                    <span>Almacén en uso:</span>
                    <span className="text-emerald-700 font-bold">{selectedAlmacen.nombre}</span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedAlmacen(null);
                      localStorage.removeItem("selected_almacen_inventario");
                    }}
                    className="px-3 py-1 rounded-md bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-600 text-[11px] font-semibold border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer"
                  >
                    Cambiar almacén
                  </button>
                </div>
              )}

              {/* Products (Price list) */}
              {currentModule === "productos" && (
                <ProductosList 
                  items={items}
                  loading={loading}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  onNew={() => {
                    setActiveFormItem(null);
                    setShowForm(true);
                  }}
                  onEdit={(item) => {
                    setActiveFormItem(item);
                    setShowForm(true);
                  }}
                  onDelete={handleDeleteProduct}
                />
              )}

              {/* Gestión inventario (Quick adjustments card grid) */}
              {currentModule === "gestion" && (
                <div className="space-y-4">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="relative w-full max-w-sm">
                      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                      <input 
                        type="text" 
                        placeholder="Buscar por nombre o referencia..."
                        className="w-full h-8 pl-8 pr-3 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#7cb342]" />
                      <span className="text-[11px] font-semibold text-slate-600">Total: {items.length}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {loading ? (
                      <div className="col-span-full py-16 text-center text-xs font-medium text-slate-400">Cargando inventario...</div>
                    ) : filteredQuickList.length === 0 ? (
                      <div className="col-span-full py-16 text-center text-xs font-medium text-slate-400">No hay productos registrados</div>
                    ) : (
                      filteredQuickList.map(item => {
                        const isLow = (item.cantidad || 0) <= (item.minimo || 5);
                        return (
                          <div key={item.id} className={`bg-white rounded-xl p-4 border ${isLow ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200'} shadow-2xs space-y-3 hover:shadow-xs transition-shadow flex flex-col justify-between`}>
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <UnidadBadge unidad={item.unidad} />
                                {isLow && (
                                  <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded text-[10px] font-bold border border-rose-200">
                                    <FiAlertTriangle className="inline mr-1" size={10} /> Bajo Stock
                                  </span>
                                )}
                              </div>
                              <h4 className="text-xs font-bold text-slate-800 tracking-tight leading-snug mb-0.5">{item.nombre}</h4>
                              <p className="text-[11px] text-slate-400 font-medium">{item.marca ? `Marca: ${item.marca}` : "Sin marca"}</p>
                            </div>

                            <div className="pt-3 border-t border-slate-100 space-y-3">
                              <div className="flex items-end justify-between">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Stock Actual</span>
                                  <span className={`text-xl font-bold leading-none mt-0.5 font-mono ${isLow ? 'text-rose-600' : 'text-slate-800'}`}>
                                    {item.cantidad}
                                  </span>
                                </div>
                                <div className="flex flex-col items-end">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mínimo</span>
                                  <span className="text-xs font-bold text-slate-600 mt-0.5 font-mono">{item.minimo || 5}</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => handleStockChange(item, -1)}
                                  className="h-7 rounded-lg bg-slate-50 hover:bg-rose-50 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-slate-500 transition-colors active:scale-95 flex items-center justify-center cursor-pointer"
                                  title="Restar 1"
                                >
                                  <FiMinus size={13} />
                                </button>
                                <button
                                  onClick={() => handleStockChange(item, 1)}
                                  className="h-7 rounded-lg bg-slate-50 hover:bg-emerald-50 hover:text-emerald-600 border border-slate-200 hover:border-emerald-200 text-slate-500 transition-colors active:scale-95 flex items-center justify-center cursor-pointer"
                                  title="Sumar 1"
                                >
                                  <FiPlus size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Recepción producto */}
              {currentModule === "recepcion" && (
                <RecepcionProducto items={items} />
              )}

              {/* Salida producto */}
              {currentModule === "salida" && (
                <SalidaProducto items={items} />
              )}

              {/* Listado de inventario */}
              {currentModule === "listado" && (
                <ListadoInventario 
                  items={items}
                  loading={loading}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                />
              )}

              {/* Listado de movimientos */}
              {currentModule === "movimientos" && (
                <MovimientosInventario />
              )}

              {/* Ajustes de inventario */}
              {currentModule === "ajustes" && (
                <AjustesInventario items={items} />
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
