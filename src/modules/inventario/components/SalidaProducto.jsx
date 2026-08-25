import React, { useState, useMemo, useEffect } from "react";
import { FiCalendar, FiBox, FiMinusCircle } from "react-icons/fi";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "sonner";

export default function SalidaProducto({ items, onLoadRequired }) {
  const { userProfile } = useAuth();
  const inquilino = userProfile?.inquilino || "";

  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("Consumo interno");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  // Filter items for searchable combobox
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return items.slice(0, 30);
    const q = searchQuery.toLowerCase();
    return items.filter(i => (i.nombre || "").toLowerCase().includes(q) || (i.referencia || "").toLowerCase().includes(q));
  }, [items, searchQuery]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClose = () => setShowDropdown(false);
    document.addEventListener("click", handleClose);
    return () => document.removeEventListener("click", handleClose);
  }, []);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!selectedItem) {
      toast.error("Seleccione un producto.");
      return;
    }
    const qty = parseFloat(cantidad);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Ingrese una cantidad válida mayor a 0.");
      return;
    }

    const currentStock = parseFloat(selectedItem.cantidad || 0);
    if (qty > currentStock) {
      if (!window.confirm(`La cantidad a retirar (${qty}) supera el stock disponible (${currentStock}). ¿Desea continuar de todos modos con stock negativo?`)) {
        return;
      }
    }

    setSaving(true);
    try {
      // 1. Add movement log
      const mov = {
        tenant_id: inquilino,
        inquilino,
        itemId: selectedItem.id,
        itemNombre: selectedItem.nombre,
        tipo: "Salida",
        cantidad: qty,
        fecha,
        motivo,
        notas,
        responsable: userProfile?.nombre || "Administrador",
        created_at: new Date().toISOString()
      };
      await supabase.from("registro_movimientos_inventario").insert([mov]);

      // 2. Update product stock count
      const newStock = Math.max(0, currentStock - qty);
      await supabase.from("inventario").update({
        cantidad: newStock,
        updated_at: new Date().toISOString()
      }).eq("id", selectedItem.id);

      toast.success(`Consumo registrado: -${qty} ${selectedItem.unidad || "unidades"}`);
      
      // Reset form
      setSelectedItem(null);
      setSearchQuery("");
      setCantidad("");
      setNotas("");
      
      if (onLoadRequired) onLoadRequired();
    } catch (err) {
      console.error("Error logging product output:", err);
      toast.error("Error al registrar el retiro de stock");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto animate-in fade-in duration-300 font-sans text-slate-800">
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="border-b border-slate-100 pb-2">
          <h3 className="text-sm font-bold text-slate-800">Registrar salida / consumo</h3>
          <p className="text-xs text-slate-500 font-normal mt-0.5">Registrar insumo utilizado, vendido o descartado</p>
        </div>

        <form onSubmit={handleSave} className="space-y-3.5">
          {/* Autocomplete Select Product */}
          <div className="flex flex-col gap-1 relative" onClick={e => e.stopPropagation()}>
            <label className="text-[11px] font-semibold text-slate-600">Producto *</label>
            {selectedItem ? (
              <div className="flex items-center gap-2.5 w-full h-8 px-3 border border-slate-200 rounded-lg bg-slate-50 text-xs font-medium text-slate-700">
                <FiBox className="text-emerald-600 shrink-0" size={13} />
                <span className="flex-1 truncate">
                  {selectedItem.nombre} {selectedItem.marca ? `(${selectedItem.marca})` : ""}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedItem(null);
                    setSearchQuery("");
                  }}
                  className="text-[10px] font-semibold text-rose-500 hover:text-rose-700 border border-slate-200 px-2 py-0.5 rounded bg-white cursor-pointer"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Escriba nombre del producto..."
                  className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                />
                {showDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {filteredProducts.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-slate-400 italic">No se encontraron productos</div>
                    ) : (
                      filteredProducts.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedItem(p);
                            setSearchQuery("");
                            setShowDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex flex-col cursor-pointer"
                        >
                          <span className="text-xs font-bold text-slate-800">
                            {p.nombre}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Marca: {p.marca || "—"} | Stock disponible: {p.cantidad} {p.unidad}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Fecha */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Fecha de salida *</label>
              <div className="relative">
                <input
                  type="date"
                  required
                  className="w-full h-8 px-3 pl-8 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                  value={fecha}
                  onChange={e => setFecha(e.target.value)}
                  max="9999-12-31" min="1900-01-01" 
                />
                <FiCalendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              </div>
            </div>

            {/* Cantidad */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-slate-600">Cantidad a retirar *</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="Ej: 5"
                className="w-full h-8 px-3 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors"
                value={cantidad}
                onChange={e => setCantidad(e.target.value)}
              />
            </div>
          </div>

          {/* Motivo de Salida */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-600">Motivo / Destino *</label>
            <select
              required
              className="w-full h-8 px-3 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors cursor-pointer"
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
            >
              <option value="Consumo interno">Consumo interno / Procedimiento</option>
              <option value="Venta directa">Venta directa al paciente</option>
              <option value="Vencimiento / Descarte">Vencimiento / Descarte</option>
              <option value="Merma / Pérdida">Merma / Pérdida / Daño</option>
            </select>
          </div>

          {/* Notas */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-slate-600">Notas / Observaciones</label>
            <textarea
              rows="2"
              placeholder="Detalles sobre el retiro de stock..."
              className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-normal text-slate-700 outline-none focus:border-emerald-500 transition-colors resize-none"
              value={notas}
              onChange={e => setNotas(e.target.value)}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving || !selectedItem}
              className="w-full h-8 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <FiMinusCircle size={13} />
              {saving ? "Registrando..." : "Registrar Salida"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
