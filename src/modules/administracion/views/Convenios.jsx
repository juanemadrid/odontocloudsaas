// src/modules/administracion/views/Convenios.jsx
import React, { useState, useEffect, useMemo } from "react";
import supabase from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import { 
  FiSearch, FiPlus, FiEdit3, FiTrash2, 
  FiEye, FiHome, FiHelpCircle, FiCheck,
  FiArrowLeft, FiSave, FiAlertCircle, FiMapPin, FiCheckCircle
} from "react-icons/fi";
import { CUPS_DENTAL_CODES } from "../../../data/cupsCodes";
import { getConfigItems } from "../../../services/configPersistenceService";

const formatCurrency = (num) => {
  const val = Number(num) || 0;
  return `$${val.toLocaleString("es-CO")}`;
};

const formatNumberWithDots = (num) => {
  if (num === undefined || num === null || num === "" || num === 0) return "";
  const parts = String(Math.round(Number(num) || 0)).replace(/\D/g, "");
  return parts.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

export default function Convenios() {
  const { userProfile } = useAuth();
  const toast = useToast();
  const inquilino = userProfile?.inquilino || userProfile?.tenantId;

  // Navigation / View state: 'LIST' | 'FORM'
  const [viewMode, setViewMode] = useState("LIST");
  const [step, setStep] = useState(1); // 1: Info & Contacto, 2: Detalle del convenio / Descuentos

  // Data states
  const [convenios, setConvenios] = useState([]);
  const [listasPrecios, setListasPrecios] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingConvenio, setEditingConvenio] = useState(null);

  // Form State (Step 1)
  const [formData, setFormData] = useState({
    nombre: "",
    nroBeneficiarios: 0,
    listaPreciosId: "",
    listaPreciosNombre: "",
    nombreContacto: "",
    email: "",
    telefono: "",
    direccion: "",
    sucursalesIds: [],
    activo: true
  });

  // Services & Discounts State (Step 2)
  const [serviceItems, setServiceItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [discounts, setDiscounts] = useState({});

  // Sucursales Modal State
  const [selectedBranchConvenio, setSelectedBranchConvenio] = useState(null);
  const [showBranchesModal, setShowBranchesModal] = useState(false);

  useEffect(() => {
    if (inquilino) {
      loadConvenios();
      loadMetadata();
    }
  }, [inquilino]);

  // Load Convenios from Supabase / Fallback
  const loadConvenios = async () => {
    setLoading(true);
    try {
      let list = [];
      try {
        const { data, error } = await supabase
          .from("convenios")
          .select("*")
          .eq("tenant_id", inquilino)
          .order("created_at", { ascending: false });
        if (!error && data && data.length > 0) list = data;
      } catch (e) {}

      if (list.length === 0) {
        const { data: cfgRow } = await supabase
          .from("website_config")
          .select("config")
          .eq("tenant_id", inquilino)
          .maybeSingle();
        list = cfgRow?.config?.convenios || [];
      }

      setConvenios(list);
    } catch (e) {
      console.error("Error cargando convenios:", e);
      toast?.error("Error al cargar los convenios");
    } finally {
      setLoading(false);
    }
  };

  // Load Metadata (Listas de Precios & Sucursales via getConfigItems)
  const loadMetadata = async () => {
    try {
      // 1. Fetch Listas de Precios
      let lists = await getConfigItems(inquilino, "listas_precios", "listas_precios");
      if (!lists || lists.length === 0) {
        const { data: snapL } = await supabase.from("listas_precios").select("*").eq("tenant_id", inquilino);
        lists = snapL || [];
      }
      setListasPrecios(lists || []);

      // 2. Fetch Sucursales
      let sucs = await getConfigItems(inquilino, "sucursales", "sucursales");
      if (!sucs || sucs.length === 0) {
        const { data: snapS } = await supabase.from("sucursales").select("*").eq("tenant_id", inquilino);
        sucs = snapS || [];
      }
      setSucursales(sucs || []);
    } catch (e) {
      console.error("Error cargando metadata:", e);
    }
  };

  // Helper: Get or infer sucursales for a given convenio based on its selected price list
  const getSucursalesForConvenio = (convenio) => {
    if (!convenio) return [];

    const plistId = convenio.listaPreciosId || "";
    const plistName = convenio.listaPreciosNombre || "PRECIOS MONTERIA";

    // A. Match system sucursales linked by listaPrecioId or matching sucursalesIds
    let matched = sucursales.filter(s => {
      if (convenio.sucursalesIds && convenio.sucursalesIds.length > 0) {
        if (convenio.sucursalesIds.includes(s.id) || convenio.sucursalesIds.includes(s.nombre)) return true;
      }
      if (plistId && (s.listaPrecioId === plistId || s.lista_precio_id === plistId)) return true;
      if (s.nombre && plistName.toLowerCase().includes(s.nombre.toLowerCase())) return true;
      return false;
    });

    // B. If system has configured sucursales but none explicitly matched, return sucursales that use this price list or active sucursales
    if (matched.length === 0 && sucursales.length > 0) {
      matched = sucursales;
    }

    // C. Fallback: Automatically generate/infer sucursal representation from the price list name
    if (matched.length === 0) {
      let sucursalName = plistName.replace(/^precios\s+/i, "Sucursal ");
      if (!sucursalName.toLowerCase().startsWith("sucursal") && !sucursalName.toLowerCase().startsWith("sede")) {
        sucursalName = `Sucursal ${sucursalName}`;
      }
      matched = [{
        id: `derived_${convenio.id || 'default'}`,
        nombre: sucursalName,
        ciudad: convenio.direccion ? convenio.direccion.split(" ")[0] : "Montería",
        direccion: convenio.direccion || "Dirección de Sede",
        isDerived: true
      }];
    }

    return matched;
  };

  // Start creation flow (Step 1)
  const handleNew = () => {
    setEditingConvenio(null);
    const defaultListObj = listasPrecios[0];
    const defaultListId = defaultListObj?.id || "";
    const defaultListName = defaultListObj?.nombre || "PRECIOS MONTERIA";

    const autoSucursales = sucursales.filter(s => 
      s.listaPrecioId === defaultListId || 
      (s.nombre && defaultListName.toLowerCase().includes(s.nombre.toLowerCase()))
    );

    setFormData({
      nombre: "",
      nroBeneficiarios: 0,
      listaPreciosId: defaultListId,
      listaPreciosNombre: defaultListName,
      nombreContacto: "",
      email: "",
      telefono: "",
      direccion: "",
      sucursalesIds: autoSucursales.map(s => s.id),
      activo: true
    });
    setDiscounts({});
    setStep(1);
    setViewMode("FORM");
  };

  // Handle changing price list in Step 1 (Auto-loads related sucursal)
  const handleListaPreciosChange = (listId) => {
    const selectedListObj = listasPrecios.find(l => l.id === listId);
    const listName = selectedListObj?.nombre || "Particular / Base";

    const matchingSucs = sucursales.filter(s => 
      s.listaPrecioId === listId || 
      s.lista_precio_id === listId || 
      (s.nombre && listName.toLowerCase().includes(s.nombre.toLowerCase()))
    );

    const newSucIds = matchingSucs.length > 0 ? matchingSucs.map(s => s.id) : [listId];

    setFormData(prev => ({
      ...prev,
      listaPreciosId: listId,
      listaPreciosNombre: listName,
      sucursalesIds: newSucIds
    }));
  };

  // Edit existing convenio (Step 1)
  const handleEdit = (convenio) => {
    setEditingConvenio(convenio);
    setFormData({
      nombre: convenio.nombre || "",
      nroBeneficiarios: convenio.nroBeneficiarios || 0,
      listaPreciosId: convenio.listaPreciosId || "",
      listaPreciosNombre: convenio.listaPreciosNombre || "",
      nombreContacto: convenio.nombreContacto || "",
      email: convenio.email || "",
      telefono: convenio.telefono || "",
      direccion: convenio.direccion || "",
      sucursalesIds: convenio.sucursalesIds || [],
      discounts: convenio.discounts || {},
      activo: convenio.activo !== undefined ? convenio.activo : true
    });
    loadServicesForConvenio(convenio);
    setStep(1);
    setViewMode("FORM");
  };

  // Open Step 2 (Detalle del convenio / Descuentos) directly from table
  const handleOpenDetail = (convenio) => {
    setEditingConvenio(convenio);
    setFormData({
      nombre: convenio.nombre || "",
      nroBeneficiarios: convenio.nroBeneficiarios || 0,
      listaPreciosId: convenio.listaPreciosId || "",
      listaPreciosNombre: convenio.listaPreciosNombre || "",
      nombreContacto: convenio.nombreContacto || "",
      email: convenio.email || "",
      telefono: convenio.telefono || "",
      direccion: convenio.direccion || "",
      sucursalesIds: convenio.sucursalesIds || [],
      discounts: convenio.discounts || {},
      activo: convenio.activo !== undefined ? convenio.activo : true
    });
    loadServicesForConvenio(convenio);
    setStep(2);
    setViewMode("FORM");
  };

  // Delete Convenio
  const handleDelete = async (convenio) => {
    if (!window.confirm(`¿Está seguro de eliminar el convenio "${convenio.nombre}"?`)) return;
    try {
      try {
        await supabase.from("convenios").delete().eq("id", convenio.id);
      } catch (e) {}

      // Update config fallback
      const { data: cfgRow } = await supabase
        .from("website_config")
        .select("config")
        .eq("tenant_id", inquilino)
        .maybeSingle();

      const currentConfig = cfgRow?.config || {};
      const updatedList = (currentConfig.convenios || []).filter(c => c.id !== convenio.id);

      await supabase.from("website_config").upsert(
        { tenant_id: inquilino, config: { ...currentConfig, convenios: updatedList } },
        { onConflict: "tenant_id" }
      );

      toast?.success("Convenio eliminado correctamente");
      loadConvenios();
    } catch (e) {
      console.error(e);
      toast?.error("Error al eliminar el convenio");
    }
  };

  // Load services for Step 2 and merge stored discounts
  const loadServicesForConvenio = async (convenioOrFormData) => {
    const listId = convenioOrFormData.listaPreciosId;
    const convenioId = convenioOrFormData.id || editingConvenio?.id;
    setLoadingItems(true);
    try {
      let items = [];
      if (listId) {
        const { data: snapItems } = await supabase
          .from("items_lista_precios")
          .select("*")
          .eq("lista_precios_id", listId);
        
        if (snapItems && snapItems.length > 0) {
          items = snapItems.map(i => ({
            id: i.id || i.codigo || i.code,
            codigo: i.codigo || i.code || "-",
            nombre: i.nombre || i.name || "Servicio sin nombre",
            precio: Number(i.precio) || 0,
            categoria: i.categoria || i.category || "General"
          }));
        } else {
          // Check description field in listas_precios if stored as JSON
          const { data: listRow } = await supabase
            .from("listas_precios")
            .select("descripcion")
            .eq("id", listId)
            .maybeSingle();
          
          try {
            const parsed = typeof listRow?.descripcion === "string" ? JSON.parse(listRow.descripcion) : listRow?.descripcion;
            if (Array.isArray(parsed) && parsed.length > 0) {
              items = parsed.map((i, idx) => ({
                id: i.id || i.codigo || i.code || `item_${idx}`,
                codigo: i.codigo || i.code || `PROD-${idx + 1}`,
                nombre: i.nombre || i.name || "Servicio",
                precio: Number(i.precio) || 0,
                categoria: i.categoria || i.category || "General"
              }));
            }
          } catch (err) {}
        }
      }

      // Fallback if no items found in custom price list: use CUPS dental catalog
      if (items.length === 0) {
        items = CUPS_DENTAL_CODES.map((cups) => ({
          id: cups.code,
          codigo: cups.code,
          nombre: cups.name,
          precio: cups.precio,
          categoria: cups.category || "General"
        }));
      }

      setServiceItems(items);

      // Start discMap with discounts stored directly on the convenio record
      let discMap = { ...(convenioOrFormData?.discounts || editingConvenio?.discounts || discounts || {}) };

      // Fetch saved discounts from Supabase table if available
      if (convenioId) {
        try {
          const { data: snapDiscounts } = await supabase
            .from("descuentos_convenio")
            .select("*")
            .eq("convenio_id", convenioId);

          if (snapDiscounts && snapDiscounts.length > 0) {
            snapDiscounts.forEach(doc => {
              discMap[doc.item_id] = {
                desc_porc: Number(doc.desc_porc) || 0,
                descuento: Number(doc.descuento) || 0,
                mode: doc.desc_porc > 0 ? "porc" : "valor"
              };
            });
          }
        } catch (e) {}
      }

      setDiscounts(discMap);
    } catch (e) {
      console.error("Error al cargar servicios del convenio:", e);
    } finally {
      setLoadingItems(false);
    }
  };

  // Continue button (Step 1 -> Step 2)
  const handleContinue = (e) => {
    if (e) e.preventDefault();
    if (!formData.nombre.trim()) return toast?.error("El nombre del convenio es obligatorio");
    if (formData.nroBeneficiarios < 0) return toast?.error("El número de beneficiarios no puede ser negativo");
    if (!formData.nombreContacto.trim()) return toast?.error("El nombre del contacto es obligatorio");
    if (!formData.email.trim()) return toast?.error("El e-mail del contacto es obligatorio");
    if (!formData.telefono.trim()) return toast?.error("El teléfono es obligatorio");
    if (!formData.direccion.trim()) return toast?.error("La dirección es obligatoria");

    loadServicesForConvenio(formData);
    setStep(2);
  };

  // Handle discount change for percentage / fixed value
  const handleDiscountChange = (itemKey, originalPrice, field, value) => {
    setDiscounts(prev => {
      const current = prev[itemKey] || { desc_porc: 0, descuento: 0, mode: field === "desc_porc" ? "porc" : "valor" };
      let newPorc = current.desc_porc;
      let newVal = current.descuento;
      let mode = current.mode;

      if (field === "desc_porc") {
        mode = "porc";
        newPorc = Math.max(0, Math.min(100, Number(value) || 0));
        newVal = Math.round((originalPrice * newPorc) / 100);
      } else if (field === "descuento") {
        mode = "valor";
        newVal = Math.max(0, Math.min(originalPrice, Number(value) || 0));
        newPorc = originalPrice > 0 ? Number(((newVal / originalPrice) * 100).toFixed(2)) : 0;
      } else if (field === "mode") {
        mode = value;
      }

      return {
        ...prev,
        [itemKey]: {
          desc_porc: newPorc,
          descuento: newVal,
          mode
        }
      };
    });
  };

  // Save Convenio & Discounts (Step 1 or Step 2)
  const handleSave = async () => {
    if (!formData.nombre.trim()) return toast?.error("El nombre del convenio es obligatorio");
    setSaving(true);
    try {
      const selectedListObj = listasPrecios.find(l => l.id === formData.listaPreciosId);
      const priceListName = selectedListObj?.nombre || formData.listaPreciosNombre || "PRECIOS MONTERIA";
      
      const convenioId = editingConvenio?.id || (crypto.randomUUID ? crypto.randomUUID() : `conv_${Date.now()}`);
      
      const record = {
        id: convenioId,
        nombre: formData.nombre.trim(),
        nroBeneficiarios: Number(formData.nroBeneficiarios) || 0,
        listaPreciosId: formData.listaPreciosId || "",
        listaPreciosNombre: priceListName,
        nombreContacto: formData.nombreContacto.trim(),
        email: formData.email.trim(),
        telefono: formData.telefono.trim(),
        direccion: formData.direccion.trim(),
        sucursalesIds: formData.sucursalesIds || [],
        discounts: discounts, // Store discounts directly inside the convenio record
        activo: formData.activo !== undefined ? formData.activo : true,
        tenant_id: inquilino,
        updated_at: new Date().toISOString()
      };

      // 1. Save Convenio in Supabase
      try {
        if (editingConvenio?.id) {
          await supabase.from("convenios").update(record).eq("id", editingConvenio.id);
        } else {
          record.created_at = new Date().toISOString();
          await supabase.from("convenios").insert([record]);
        }
      } catch (e) {}

      // 2. Save Discounts in Supabase table
      if (Object.keys(discounts).length > 0) {
        try {
          const discountPromises = Object.entries(discounts).map(async ([itemId, disc]) => {
            if (disc.desc_porc > 0 || disc.descuento > 0) {
              await supabase.from("descuentos_convenio").upsert({
                id: `${convenioId}_${itemId}`,
                convenio_id: convenioId,
                item_id: itemId,
                desc_porc: disc.desc_porc,
                descuento: disc.descuento,
                updated_at: new Date().toISOString()
              });
            } else {
              await supabase.from("descuentos_convenio").delete().eq("id", `${convenioId}_${itemId}`);
            }
          });
          await Promise.all(discountPromises);
        } catch (e) {}
      }

      // 3. Fallback sync to website_config JSON (saves entire convenio + discounts object)
      const { data: cfgRow } = await supabase
        .from("website_config")
        .select("config")
        .eq("tenant_id", inquilino)
        .maybeSingle();

      const currentConfig = cfgRow?.config || {};
      const currentList = Array.isArray(currentConfig.convenios) ? currentConfig.convenios : [];
      let updatedList;
      if (editingConvenio?.id) {
        updatedList = currentList.map(item => item.id === editingConvenio.id ? { ...item, ...record } : item);
      } else {
        const existingIdx = currentList.findIndex(c => c.id === convenioId);
        if (existingIdx >= 0) {
          currentList[existingIdx] = { ...currentList[existingIdx], ...record };
          updatedList = currentList;
        } else {
          updatedList = [record, ...currentList];
        }
      }

      await supabase.from("website_config").upsert(
        { tenant_id: inquilino, config: { ...currentConfig, convenios: updatedList } },
        { onConflict: "tenant_id" }
      );

      toast?.success(editingConvenio ? "Convenio actualizado correctamente" : "Convenio creado con éxito");
      setViewMode("LIST");
      loadConvenios();
    } catch (e) {
      console.error("Error al guardar el convenio:", e);
      toast?.error("Error al guardar el convenio");
    } finally {
      setSaving(false);
    }
  };

  // Group service items by category for Step 2
  const groupedServiceItems = useMemo(() => {
    const groups = {};
    serviceItems.forEach(item => {
      const cat = item.categoria || "General";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });
    return groups;
  }, [serviceItems]);

  // Filtered convenios for main list
  const filteredConvenios = convenios.filter(c => {
    const term = searchQuery.toLowerCase().trim();
    if (!term) return true;
    const name = (c.nombre || "").toLowerCase();
    const plist = (c.listaPreciosNombre || "").toLowerCase();
    const contact = (c.nombreContacto || "").toLowerCase();
    const dir = (c.direccion || "").toLowerCase();
    return name.includes(term) || plist.includes(term) || contact.includes(term) || dir.includes(term);
  });

  return (
    <div className="bg-slate-50/50 min-h-full flex flex-col font-sans text-slate-700 animate-fadeIn">
      
      {/* ─── CASE 1: MAIN CONVENIOS LIST VIEW ─── */}
      {viewMode === "LIST" && (
        <div className="flex-1 flex flex-col gap-5">
          {/* Top Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col gap-6">
            
            {/* Breadcrumb & Title */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                <FiHome size={13} className="text-slate-400" />
                <span>-</span>
                <span>Administración - Convenios</span>
              </div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                Convenios
              </h2>
            </div>

            {/* Header Toolbar: Search & New Convenio Button */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="relative w-full sm:w-80">
                <FiSearch size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 placeholder:text-slate-400 outline-none focus:border-cyan-500 focus:bg-white transition-all"
                />
              </div>

              <button
                type="button"
                onClick={handleNew}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#8CC63F] hover:bg-[#7bb335] active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer border-0"
              >
                <FiPlus size={16} strokeWidth={2.5} />
                <span>Nuevo convenio</span>
              </button>
            </div>

            {/* Convenios Table */}
            <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
              <table className="w-full text-left border-collapse min-w-[750px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    <th className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <span>Nombre convenio</span>
                        <span className="text-[10px] text-slate-400">▲▼</span>
                      </div>
                    </th>
                    <th className="py-3 px-4">Lista de precios</th>
                    <th className="py-3 px-4">Dirección</th>
                    <th className="py-3 px-4">Nombre contacto</th>
                    <th className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span>Sucursales</span>
                        <FiHelpCircle size={13} className="text-slate-400" title="Sucursales asignadas por la lista de precios" />
                      </div>
                    </th>
                    <th className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span>Opciones</span>
                        <span className="text-[10px] text-slate-400">▲▼</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="py-16 text-center">
                        <div className="w-7 h-7 border-2 border-slate-200 border-t-cyan-500 rounded-full animate-spin mx-auto mb-2" />
                        <span className="text-xs font-semibold text-slate-400">Cargando convenios...</span>
                      </td>
                    </tr>
                  ) : filteredConvenios.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-16 text-center">
                        <p className="text-xs font-bold text-slate-400">No hay convenios registrados</p>
                      </td>
                    </tr>
                  ) : (
                    filteredConvenios.map((convenio) => {
                      return (
                        <tr key={convenio.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-slate-800">
                            {convenio.nombre}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-600">
                            {convenio.listaPreciosNombre || "PRECIOS MONTERIA"}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-600">
                            {convenio.direccion || "-"}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-600">
                            {convenio.nombreContacto || "-"}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBranchConvenio(convenio);
                                setShowBranchesModal(true);
                              }}
                              className="w-7 h-7 inline-flex items-center justify-center bg-[#00A3E0] hover:bg-[#008fc7] text-white rounded-md transition-colors shadow-xs border-0 cursor-pointer"
                              title="Ver Sucursal vinculada a la Lista de Precios"
                            >
                              <FiEye size={14} />
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              {/* Edit Step 1 (Green button) */}
                              <button
                                type="button"
                                onClick={() => handleEdit(convenio)}
                                className="w-7 h-7 inline-flex items-center justify-center bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-md transition-colors shadow-xs border-0 cursor-pointer"
                                title="Editar convenio"
                              >
                                <FiEdit3 size={13} />
                              </button>
                              
                              {/* Detail / Discounts (Cyan button) */}
                              <button
                                type="button"
                                onClick={() => handleOpenDetail(convenio)}
                                className="w-7 h-7 inline-flex items-center justify-center bg-[#00A3E0] hover:bg-[#008fc7] text-white rounded-md transition-colors shadow-xs border-0 cursor-pointer"
                                title="Edición de convenio (Detalle y Descuentos)"
                              >
                                <FiEye size={13} />
                              </button>

                              {/* Delete (Red button) */}
                              <button
                                type="button"
                                onClick={() => handleDelete(convenio)}
                                className="w-7 h-7 inline-flex items-center justify-center bg-rose-500 hover:bg-rose-600 text-white rounded-md transition-colors shadow-xs border-0 cursor-pointer"
                                title="Eliminar convenio"
                              >
                                <FiTrash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

      {/* ─── CASE 2: FORM STEP 1 (NUEVO / EDICIÓN DE CONVENIO) ─── */}
      {viewMode === "FORM" && step === 1 && (
        <div className="flex-1 flex flex-col gap-5">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col gap-6">
            
            {/* Header & Navigation */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                  {editingConvenio ? "Edición de convenio" : "Nuevo convenio"}
                </h2>
                <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                  <FiHome size={13} className="text-slate-400" />
                  <span>-</span>
                  <span>Administración - Convenios - {editingConvenio ? "Edición de convenio" : "Nuevo convenio"}</span>
                </div>
              </div>

              {/* Action Buttons Top Right */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleContinue}
                  className="px-5 py-2 bg-[#00A3E0] hover:bg-[#008fc7] active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm transition-all border-0 cursor-pointer"
                >
                  Continuar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 bg-[#8CC63F] hover:bg-[#7bb335] active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm transition-all border-0 cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>

            {/* Form Sections */}
            <div className="flex flex-col gap-6">
              
              {/* SECTION 1: Información convenio */}
              <div className="border border-slate-200/80 rounded-xl p-5 bg-white">
                <h3 className="text-xs font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 uppercase tracking-wide">
                  Información convenio
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
                  {/* Nombre del convenio */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Nombre del convenio *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      placeholder="Nombre del convenio"
                      className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs text-slate-700 font-medium focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                    />
                  </div>

                  {/* Nro de beneficiarios */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Nro. de beneficiarios *
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={formData.nroBeneficiarios}
                      onChange={(e) => setFormData({ ...formData, nroBeneficiarios: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs text-slate-700 font-medium focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                    />
                  </div>

                  {/* Lista de precios */}
                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Lista de precios
                    </label>
                    <select
                      value={formData.listaPreciosId}
                      onChange={(e) => handleListaPreciosChange(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs text-slate-700 font-medium bg-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                    >
                      <option value="">Seleccione...</option>
                      {listasPrecios.map(list => (
                        <option key={list.id} value={list.id}>{list.nombre}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Información de contacto */}
              <div className="border border-slate-200/80 rounded-xl p-5 bg-white">
                <h3 className="text-xs font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100 uppercase tracking-wide">
                  Información de contacto
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
                  {/* Nombre del contacto */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Nombre del contacto *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nombreContacto}
                      onChange={(e) => setFormData({ ...formData, nombreContacto: e.target.value })}
                      placeholder="Nombre del contacto"
                      className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs text-slate-700 font-medium focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                    />
                  </div>

                  {/* E-mail */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      E-mail *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Ingrese e-mail"
                      className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs text-slate-700 font-medium focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                    />
                  </div>

                  {/* Teléfono */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Teléfono *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      placeholder="Celular o fijo"
                      className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs text-slate-700 font-medium focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                    />
                  </div>

                  {/* Dirección */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Dirección *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.direccion}
                      onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                      placeholder="Ingrese la dirección"
                      className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs text-slate-700 font-medium focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Bottom Buttons */}
            <div className="flex justify-between items-center border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setViewMode("LIST")}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-all border border-slate-200 cursor-pointer"
              >
                Cancelar
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleContinue}
                  className="px-5 py-2 bg-[#00A3E0] hover:bg-[#008fc7] active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm transition-all border-0 cursor-pointer"
                >
                  Continuar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 bg-[#8CC63F] hover:bg-[#7bb335] active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm transition-all border-0 cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ─── CASE 3: FORM STEP 2 (EDICIÓN DE CONVENIO - DETALLE DEL CONVENIO & DESCUENTOS) ─── */}
      {viewMode === "FORM" && step === 2 && (
        <div className="flex-1 flex flex-col gap-5">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col gap-6">
            
            {/* Header & Navigation */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                  Edición de convenio
                </h2>
                <div className="flex items-center gap-2 text-[11px] font-medium text-slate-400">
                  <FiHome size={13} className="text-slate-400" />
                  <span>-</span>
                  <span>Administración - Convenios - Edición de convenio</span>
                </div>
              </div>

              {/* Top Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-2 bg-[#00A3E0] hover:bg-[#008fc7] active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm transition-all border-0 cursor-pointer"
                >
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 bg-[#8CC63F] hover:bg-[#7bb335] active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm transition-all border-0 cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>

            {/* Section Title */}
            <div>
              <h3 className="text-sm font-bold text-slate-800 tracking-tight">
                Detalle del convenio
              </h3>
            </div>

            {/* Services Table Grouped by Category */}
            <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    <th className="py-3 px-4 w-32">Código</th>
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-4 text-right w-32">Precio</th>
                    <th className="py-3 px-4 text-center w-40">Dcta. Porcentaje</th>
                    <th className="py-3 px-4 text-center w-44">Dcta. Valor</th>
                    <th className="py-3 px-4 text-right w-36">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {loadingItems ? (
                    <tr>
                      <td colSpan="6" className="py-16 text-center">
                        <div className="w-7 h-7 border-2 border-slate-200 border-t-cyan-500 rounded-full animate-spin mx-auto mb-2" />
                        <span className="text-xs font-semibold text-slate-400">Cargando catálogo de servicios...</span>
                      </td>
                    </tr>
                  ) : Object.keys(groupedServiceItems).length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-16 text-center">
                        <p className="text-xs font-bold text-slate-400">No hay servicios en el tarifario seleccionado</p>
                      </td>
                    </tr>
                  ) : (
                    Object.entries(groupedServiceItems).map(([categoryName, items]) => (
                      <React.Fragment key={categoryName}>
                        {/* Category Header Row */}
                        <tr className="bg-slate-50/90 border-t border-b border-slate-200/70">
                          <td colSpan="6" className="py-2.5 px-4 font-bold text-slate-700 text-xs italic">
                            {categoryName}
                          </td>
                        </tr>

                        {/* Category Items Rows */}
                        {items.map((item) => {
                          const itemKey = item.id || item.codigo;
                          const originalPrice = item.precio || 0;
                          const disc = discounts[itemKey] || discounts[item.codigo] || { desc_porc: 0, descuento: 0, mode: "porc" };
                          const finalPrice = Math.max(0, originalPrice - (disc.descuento || 0));

                          return (
                            <tr key={itemKey} className="hover:bg-slate-50/50 transition-colors">
                              {/* Código */}
                              <td className="py-3 px-4 font-medium text-slate-500">
                                {item.codigo || "-"}
                              </td>

                              {/* Producto */}
                              <td className="py-3 px-4 font-semibold text-slate-800">
                                {item.nombre}
                              </td>

                              {/* Precio base */}
                              <td className="py-3 px-4 text-right font-medium text-slate-600">
                                {formatCurrency(originalPrice)}
                              </td>

                              {/* Dcta. Porcentaje */}
                              <td className="py-3 px-4 text-center">
                                <div className="inline-flex items-center gap-1.5">
                                  <span className="text-xs text-slate-400 font-medium">%</span>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="any"
                                    value={disc.desc_porc || ""}
                                    onChange={(e) => handleDiscountChange(itemKey, originalPrice, "desc_porc", e.target.value)}
                                    placeholder="0"
                                    className="w-16 px-2 py-1 border border-slate-200 rounded-md text-xs font-semibold text-slate-700 text-right outline-none focus:border-cyan-500"
                                  />
                                  <input
                                    type="checkbox"
                                    checked={disc.mode === "porc"}
                                    onChange={() => handleDiscountChange(itemKey, originalPrice, "mode", "porc")}
                                    className="w-3.5 h-3.5 text-cyan-600 border-slate-300 rounded focus:ring-cyan-500 cursor-pointer"
                                    title="Modo Porcentaje"
                                  />
                                </div>
                              </td>

                              {/* Dcta. Valor */}
                              <td className="py-3 px-4 text-center">
                                <div className="inline-flex items-center gap-1.5">
                                  <span className="text-xs text-slate-400 font-medium">$</span>
                                  <input
                                    type="text"
                                    value={disc.descuento ? formatNumberWithDots(disc.descuento) : ""}
                                    onChange={(e) => {
                                      const raw = e.target.value.replace(/\D/g, "");
                                      handleDiscountChange(itemKey, originalPrice, "descuento", raw);
                                    }}
                                    placeholder="0"
                                    className="w-24 px-2 py-1 border border-slate-200 rounded-md text-xs font-semibold text-slate-700 text-right outline-none focus:border-cyan-500"
                                  />
                                  <input
                                    type="checkbox"
                                    checked={disc.mode === "valor"}
                                    onChange={() => handleDiscountChange(itemKey, originalPrice, "mode", "valor")}
                                    className="w-3.5 h-3.5 text-cyan-600 border-slate-300 rounded focus:ring-cyan-500 cursor-pointer"
                                    title="Modo Valor Fijo"
                                  />
                                </div>
                              </td>

                              {/* Total */}
                              <td className="py-3 px-4 text-right font-bold text-slate-800">
                                {formatCurrency(finalPrice)}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Action Buttons */}
            <div className="flex justify-end items-center gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-5 py-2 bg-[#00A3E0] hover:bg-[#008fc7] active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm transition-all border-0 cursor-pointer"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-[#8CC63F] hover:bg-[#7bb335] active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm transition-all border-0 cursor-pointer disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ─── SUCURSALES DEL CONVENIO MODAL ─── */}
      {showBranchesModal && selectedBranchConvenio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 flex flex-col gap-4 animate-scaleIn">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                Sucursales del Convenio
              </h3>
              <button
                type="button"
                onClick={() => setShowBranchesModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-1 text-xs">
              <p className="text-slate-600 font-medium">
                Convenio: <span className="font-bold text-slate-800">{selectedBranchConvenio.nombre}</span>
              </p>
              <p className="text-slate-500 font-medium">
                Lista de precios: <span className="font-semibold text-cyan-600">{selectedBranchConvenio.listaPreciosNombre || "PRECIOS MONTERIA"}</span>
              </p>
            </div>

            {/* Sucursales vinculadas */}
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {getSucursalesForConvenio(selectedBranchConvenio).map((suc, idx) => (
                <div key={suc.id || idx} className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-slate-50/70">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <FiMapPin size={13} className="text-cyan-600" />
                      {suc.nombre}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">
                      {suc.direccion || selectedBranchConvenio.direccion || "Dirección de la sucursal"}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 flex items-center gap-1">
                    <FiCheckCircle size={11} />
                    Habilitada
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBranchesModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors cursor-pointer border-0"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
