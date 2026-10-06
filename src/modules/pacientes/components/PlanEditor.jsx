import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../../../context/ToastContext';
import { createPlan, updatePlan, deletePlan } from '../../../services/planService';
import supabase from '../../../lib/supabaseClient';
import { FiSearch, FiTrash2, FiPlus, FiCheck, FiX, FiInfo, FiActivity, FiDollarSign, FiChevronLeft, FiPlusCircle, FiPackage, FiFileText, FiPrinter, FiPlusSquare, FiSave, FiAlertCircle, FiLoader, FiSend, FiEye } from 'react-icons/fi';
import { useFormContext } from 'react-hook-form';
import { useAuth } from '../../../context/AuthContext';
import ProcedureAdditionModal from './ProcedureAdditionModal';
import ToothSelectorModal from './ToothSelectorModal';
import EvolutionModal from './EvolutionModal';
import DocClinicoModal from './DocClinicoModal';
import { BudgetPrintService } from '../../../services/BudgetPrintService';
import factusService from '../../../services/factusService';
import { getConfigItems } from '../../../services/configPersistenceService';

export default function PlanEditor({ patient: dbPatient, initialData, onClose, onSaved }) {
    const { watch: watchPatient } = useFormContext() || { watch: () => ({}) };
    const { userProfile } = useAuth();
    
    // Merge live data
    const patient = {
        ...dbPatient,
        nombreCompleto: watchPatient("nombreCompleto") || dbPatient?.nombreCompleto,
        nroDocumento: watchPatient("nroDocumento") || dbPatient?.nroDocumento,
        celular: watchPatient("celular") || dbPatient?.celular,
        email: watchPatient("email") || dbPatient?.email,
        nombreEps: watchPatient("nombreEps") || dbPatient?.nombreEps,
        convenioBeneficio: watchPatient("convenioBeneficio") || dbPatient?.convenioBeneficio
    };

    const [currentPlanId, setCurrentPlanId] = useState(initialData?.id || null);
    const isEditing = !!currentPlanId;
    const isPlan = initialData?.type === 'plan';
    const patientId = patient?.id;
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState(initialData?.title || "Presupuesto Integral de Tratamiento");
    const [baseListId, setBaseListId] = useState(null);

    // Items state
    const [items, setItems] = useState(initialData?.items || []);
    const [obs, setObs] = useState(initialData?.observaciones || "");
    const [cobertura, setCobertura] = useState(() => ({
        tipo: initialData?.cobertura?.tipo || (patient?.nombreEps || patient?.convenioBeneficio ? "entidad" : "particular"),
        epsNombre: initialData?.cobertura?.epsNombre || patient?.nombreEps || "",
        entidadId: initialData?.cobertura?.entidadId || "",
        entidadNombre: initialData?.cobertura?.entidadNombre || patient?.convenioBeneficio || "",
        tarifaId: initialData?.cobertura?.tarifaId || "",
        tarifaNombre: initialData?.cobertura?.tarifaNombre || "",
        ordenNumero: initialData?.cobertura?.ordenNumero || "",
        ordenFecha: initialData?.cobertura?.ordenFecha || "",
        ordenUrgente: initialData?.cobertura?.ordenUrgente || false
    }));

    const [evolutions, setEvolutions] = useState([]);
    const [payments, setPayments] = useState([]);

    const inquilino = userProfile?.inquilino;
    const [planes, setPlanes] = useState([]);
    const [showPlanesModal, setShowPlanesModal] = useState(false);
    const [loadingPlanes, setLoadingPlanes] = useState(false);
    const [loadingPlanItems, setLoadingPlanItems] = useState(false);
    const [showProcedureModal, setShowProcedureModal] = useState(false);
    const [showOdontoModal, setShowOdontoModal] = useState(false);
    const [odontoLoading, setOdontoLoading] = useState(false);
    const [odontoItems, setOdontoItems] = useState([]);
    const [odontoFilterMode, setOdontoFilterMode] = useState("pendientes"); // "pendientes" | "todos"

    // ── Realizar & Asociar Consulta Workflow (OralDrive) ──
    const [selectedForRealizar, setSelectedForRealizar] = useState(new Set());
    const [showEvolutionModal, setShowEvolutionModal] = useState(false);
    const [evolutionInitialData, setEvolutionInitialData] = useState(null);
    const [showAsocConsultaModal, setShowAsocConsultaModal] = useState(false);
    const [targetConsultaItem, setTargetConsultaItem] = useState(null);
    const [consultasList, setConsultasList] = useState([]);
    const [loadingConsultas, setLoadingConsultas] = useState(false);
    const [showNewConsultaModal, setShowNewConsultaModal] = useState(false);
    const [newConsultaInitialData, setNewConsultaInitialData] = useState(null);

    // Refs for auto-saving
    const autoSaveTimeoutRef = useRef(null);
    const pendingSaveDataRef = useRef(null);

    useEffect(() => {
        setCurrentPlanId(initialData?.id || null);
    }, [initialData?.id]);

    // Keep pendingSaveDataRef in sync with the latest values
    useEffect(() => {
        pendingSaveDataRef.current = { items, title, obs };
    }, [items, title, obs]);

    // On unmount, flush any pending save
    useEffect(() => {
        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
                const { items: finalItems, title: finalTitle, obs: finalObs } = pendingSaveDataRef.current || {};
                if (finalItems && finalTitle) {
                    autoSaveSilent(finalItems, finalTitle, finalObs);
                }
            }
        };
    }, []);

    const autoSaveSilent = async (updatedItems, updatedTitle, updatedObs) => {
        if (!updatedTitle.trim()) return;
        const validItems = updatedItems.filter(i => (i.desc || "").trim() !== "");
        if (validItems.length === 0) return;

        try {
            const planData = {
                patientId,
                title: updatedTitle,
                items: validItems,
                total: validItems.reduce((acc, curr) => acc + (Number(curr.amount) * Number(curr.qty)), 0) - validItems.reduce((acc, curr) => acc + (Number(curr.descuento || 0)), 0),
                subtotal: validItems.reduce((acc, curr) => acc + (Number(curr.amount) * Number(curr.qty)), 0),
                totalDescuento: validItems.reduce((acc, curr) => acc + (Number(curr.descuento || 0)), 0),
                status: initialData?.status || "draft",
                type: initialData?.type || "presupuesto",
                profesionalId: initialData?.profesionalId || "",
                vigencia: initialData?.vigencia || 30,
                observaciones: updatedObs,
                cobertura,
                inquilino: inquilino || patient?.inquilino || "",
                baseListId: baseListId
            };

            let planIdToUse = pendingSaveDataRef.current?.tempPlanId || currentPlanId;

            if (planIdToUse) {
                await updatePlan(planIdToUse, planData);
                console.log("Auto-save: updated plan", planIdToUse);
            } else {
                const saved = await createPlan(planData);
                setCurrentPlanId(saved.id);
                if (pendingSaveDataRef.current) {
                    pendingSaveDataRef.current.tempPlanId = saved.id;
                }
                console.log("Auto-save: created plan", saved.id);
            }
        } catch (error) {
            console.error("Error in autoSaveSilent:", error);
        }
    };

    const triggerAutoSave = (updatedItems = items, updatedTitle = title, updatedObs = obs) => {
        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }
        autoSaveTimeoutRef.current = setTimeout(() => {
            autoSaveSilent(updatedItems, updatedTitle, updatedObs);
        }, 1000);
    };
    const [convenioDescuentos, setConvenioDescuentos] = useState({});

    // ── Factus / DIAN ──
    const [factusCredentials, setFactusCredentials] = useState(null);
    const [emittingInvoice, setEmittingInvoice] = useState(false);

    // Load Factus credentials from tenant / global config
    useEffect(() => {
        if (!inquilino) return;
        (async () => {
            try {
                const { getFactusCredentialsForTenant } = await import('../../../services/factusAdminService');
                const creds = await getFactusCredentialsForTenant(inquilino);
                setFactusCredentials(creds || null);
            } catch (e) { console.error('Error loading Factus credentials:', e); }
        })();
    }, [inquilino]);

    useEffect(() => {
        const fetchPlanes = async () => {
            if (!inquilino) return;
            setLoadingPlanes(true);
            try {
                const data = await getConfigItems(inquilino, "planes", null);
                const sorted = (data || []).sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
                setPlanes(sorted);
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingPlanes(false);
            }
        };
        fetchPlanes();
    }, [inquilino]);

    useEffect(() => {
        if (!patientId) return;

        const loadEvolutions = async () => {
            try {
                const { data, error } = await supabase
                    .from("evoluciones")
                    .select("*")
                    .eq("paciente_id", patientId);

                if (error) {
                    console.error("Error loading clinical evolutions:", error);
                    return;
                }

                const parsedEvos = (data || []).map(row => {
                    let parsed = {};
                    if (row.tratamiento && typeof row.tratamiento === 'string' && row.tratamiento.startsWith('{')) {
                        try { parsed = JSON.parse(row.tratamiento); } catch (e) {}
                    } else if (row.tratamiento && typeof row.tratamiento === 'object') {
                        parsed = row.tratamiento;
                    }
                    return {
                        ...row,
                        ...parsed,
                        id: row.id,
                        planId: parsed.planId || row.planId,
                        plantillaItems: parsed.plantillaItems || row.plantillaItems || {}
                    };
                });
                setEvolutions(parsedEvos);
            } catch (err) {
                console.error("Error loading clinical evolutions:", err);
            }
        };
        loadEvolutions();

        const fetchPayments = async () => {
            if (!currentPlanId) return;
            try {
                const { data: payData, error } = await supabase
                    .from("pagos")
                    .select("*")
                    .eq("paciente_id", patientId);

                if (error) {
                    console.error("Error fetching payments:", error);
                    return;
                }
                
                const parsedPayments = (payData || []).map(p => {
                    let parsedNotes = {};
                    if (p.notas && typeof p.notas === 'string' && p.notas.trim().startsWith('{')) {
                        try { parsedNotes = JSON.parse(p.notas); } catch (e) {}
                    }
                    return {
                        ...p,
                        ...parsedNotes,
                        planId: parsedNotes.planId || p.planId || p.plan_id
                    };
                }).filter(p => p.planId === currentPlanId && (p.estado || "").toLowerCase() !== "anulado");
                setPayments(parsedPayments);
            } catch (err) {
                console.error("Error fetching payments for plan editor:", err);
            }
        };
        fetchPayments();
    }, [patientId, currentPlanId]);

    const isItemRealized = (itemId) => {
        // 1. Check direct realizado flag on the item itself (set from plan editor)
        const itemDirectly = items.find(i => i.id === itemId);
        if (itemDirectly?.realizado === true) return true;
        // 2. Check clinical evolutions (set from evolution modal)
        return evolutions.some(evo => 
            evo.planId === currentPlanId && 
            // Compatibilidad: registros nuevos usan `realizado`, antiguos usaban `checked`
            (evo.plantillaItems?.[itemId]?.realizado === true ||
             (evo.plantillaItems?.[itemId]?.realizado === undefined && evo.plantillaItems?.[itemId]?.checked === true))
        );
    };

    const paidMap = React.useMemo(() => {
        const map = {};
        (items || []).forEach(it => {
            map[it.id] = 0;
        });
        
        const oldPayments = [];
        const newPayments = [];
        payments.forEach(p => {
            if (p.itemPayments && p.itemPayments.length > 0) {
                newPayments.push(p);
            } else {
                oldPayments.push(p);
            }
        });

        // 1. Process explicit item payments
        newPayments.forEach(p => {
            p.itemPayments.forEach(ip => {
                if (map[ip.itemId] !== undefined) {
                    map[ip.itemId] += Number(ip.monto || 0);
                }
            });
        });

        // 2. Process legacy payments
        oldPayments.forEach(p => {
            let remaining = Number(p.monto || 0);
            for (let i = 0; i < (items || []).length; i++) {
                if (remaining <= 0) break;
                const it = (items || [])[i];
                const totalCost = (Number(it.amount || 0) * Number(it.qty || 1)) - Number(it.descuento || 0);
                const currentPaid = map[it.id] || 0;
                const currentSaldo = Math.max(0, totalCost - currentPaid);
                if (currentSaldo > 0) {
                    const allocated = Math.min(currentSaldo, remaining);
                    map[it.id] = (map[it.id] || 0) + allocated;
                    remaining -= allocated;
                }
            }
        });

        return map;
    }, [payments, items]);

    const hasRealizedDebt = React.useMemo(() => {
        if (!currentPlanId) return false;
        return (items || []).some(item => {
            const totalCost = (Number(item.amount || 0) * Number(item.qty || 1)) - Number(item.descuento || 0);
            const paid = paidMap[item.id] || 0;
            return isItemRealized(item.id) && (totalCost - paid) > 0;
        });
    }, [items, paidMap, evolutions]);

    const hasPayments = React.useMemo(() => {
        return payments && payments.length > 0;
    }, [payments]);

    const getItemRealizedDate = (itemId) => {
        const formatDateTime = (val) => {
            try {
                const d = val?.toDate ? val.toDate() : new Date(val);
                if (isNaN(d.getTime())) return null;
                const datePart = d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const timePart = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false });
                return `${datePart}\n${timePart}`;
            } catch { return null; }
        };

        // 1. Check direct fechaRealizado on item itself
        const itemDirectly = items.find(i => i.id === itemId);
        if (itemDirectly?.realizado && itemDirectly?.fechaRealizado) {
            const formatted = formatDateTime(itemDirectly.fechaRealizado);
            if (formatted) return formatted;
        }
        // 2. Check clinical evolutions
        const evo = evolutions.find(e =>
            e.planId === currentPlanId &&
            (e.plantillaItems?.[itemId]?.realizado === true ||
             (e.plantillaItems?.[itemId]?.realizado === undefined && e.plantillaItems?.[itemId]?.checked === true))
        );
        if (evo) {
            const formatted = formatDateTime(evo.date || evo.fecha || evo.created_at);
            if (formatted) return formatted;
        }
        return null;
    };

    const [selectedForInvoice, setSelectedForInvoice] = useState(new Set());

    const toggleInvoiceSelection = (itemId) => {
        setSelectedForInvoice(prev => {
            const next = new Set(prev);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return next;
        });
    };

    // ── Realizar & Asociar Consulta Handlers (OralDrive Style) ──
    const toggleRealizarSelection = (itemId) => {
        if (isItemRealized(itemId)) return;
        setSelectedForRealizar(prev => {
            const next = new Set(prev);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return next;
        });
    };

    const isItemConsulta = (item) => {
        if (!item) return false;
        if (item.es_consulta === true || item.is_consulta === true) return true;
        const cups = String(item.codigo_cups || item.code || item.codigo || '').trim();
        if (cups.startsWith('890')) return true;
        const desc = (item.desc || item.nombre || '').toLowerCase();
        if (desc.startsWith('consulta') || desc.includes('consulta valoracion') || desc.includes('consulta odontol')) return true;
        return false;
    };

    const openAsocConsultaModal = async (item) => {
        setTargetConsultaItem(item);
        setShowAsocConsultaModal(true);
        setLoadingConsultas(true);
        try {
            let list = [];
            const { data: dbList, error } = await supabase
                .from("documentos_clinicos")
                .select("*")
                .eq("paciente_id", patientId)
                .or("tipo.eq.Consulta,tipoDocumento.eq.Consulta")
                .order("created_at", { ascending: false });
            if (!error && dbList) {
                list = dbList;
            }
            const hmDocs = (patient?.historial_medico?.documentosClinicos || []).filter(d => 
                d.tipo === "Consulta" || d.tipoDocumento === "Consulta"
            );
            const merged = [...list];
            hmDocs.forEach(h => {
                if (!merged.some(m => m.id === h.id)) {
                    merged.push(h);
                }
            });
            setConsultasList(merged);
        } catch (err) {
            console.error("Error cargando consultas médicas:", err);
            toast.error("Error al cargar las consultas médicas del paciente");
        } finally {
            setLoadingConsultas(false);
        }
    };

    const handleAssociateConsulta = async (selectedConsulta) => {
        if (!targetConsultaItem) return;
        try {
            const nowIso = new Date().toISOString();
            const updatedItems = items.map(it => {
                if (it.id === targetConsultaItem.id) {
                    return {
                        ...it,
                        realizado: true,
                        fechaRealizado: nowIso,
                        asocConsultaId: selectedConsulta.id,
                        asocConsultaTitulo: selectedConsulta.titulo || 'Consulta Odontológica',
                        asocConsultaFecha: selectedConsulta.fechaIso || selectedConsulta.created_at || selectedConsulta.date || nowIso
                    };
                }
                return it;
            });
            setItems(updatedItems);
            if (currentPlanId) {
                await updatePlan(currentPlanId, { items: updatedItems });
            }
            // Link in documentos_clinicos if possible
            try {
                const docId = selectedConsulta.database_id || selectedConsulta.id;
                if (docId) {
                    await supabase
                        .from("documentos_clinicos")
                        .update({
                            metadata: {
                                ...(selectedConsulta.metadata || {}),
                                planId: currentPlanId,
                                planItemId: targetConsultaItem.id,
                                asociadoPlanFecha: nowIso
                            }
                        })
                        .eq("id", docId);
                }
            } catch (e) {}

            setSelectedForRealizar(prev => {
                const next = new Set(prev);
                next.delete(targetConsultaItem.id);
                return next;
            });
            setShowAsocConsultaModal(false);
            setTargetConsultaItem(null);
            toast.success("✅ Consulta médica asociada y procedimiento marcado como realizado.");
            if (onSaved) onSaved();
        } catch (err) {
            console.error("Error al asociar consulta:", err);
            toast.error("Error al asociar la consulta médica.");
        }
    };

    const handleRealizarAction = () => {
        if (selectedForRealizar.size === 0) {
            toast.warning("Selecciona al menos un procedimiento en la casilla (✓) para realizar.");
            return;
        }

        const selectedItems = items.filter(it => selectedForRealizar.has(it.id));
        const unrealizedSelected = selectedItems.filter(it => !isItemRealized(it.id));
        if (unrealizedSelected.length === 0) {
            toast.info("Los procedimientos seleccionados ya fueron realizados.");
            return;
        }

        // Check if any selected item is a consultation
        const consultaItem = unrealizedSelected.find(it => isItemConsulta(it));
        if (consultaItem) {
            // Flow B: Associate Consultation with Doc. Clínicos
            openAsocConsultaModal(consultaItem);
        } else {
            // Flow A: Open Clinical Evolution
            const plantillaItems = {};
            unrealizedSelected.forEach(it => {
                plantillaItems[it.id] = {
                    checked: true,
                    realizado: true,
                    desc: it.desc,
                    dientes: it.dientes || '',
                    superficie: it.superficie || '',
                    codigo_cups: it.codigo_cups || it.code || it.codigo || '',
                    hallazgo_origen: it.hallazgo_origen || '',
                    observation: ''
                };
            });
            setEvolutionInitialData({
                planId: currentPlanId,
                serviciosIds: unrealizedSelected.map(it => it.id),
                plantillaItems
            });
            setShowEvolutionModal(true);
        }
    };

    const handleEvolutionSaved = async (savedEvo) => {
        if (savedEvo) {
            setEvolutions(prev => [savedEvo, ...prev]);
        }
        const nowIso = new Date().toISOString();
        const updatedItems = items.map(it => {
            if (selectedForRealizar.has(it.id)) {
                return {
                    ...it,
                    realizado: true,
                    fechaRealizado: it.fechaRealizado || nowIso
                };
            }
            return it;
        });
        setItems(updatedItems);
        if (currentPlanId) {
            await updatePlan(currentPlanId, { items: updatedItems });
        }
        setSelectedForRealizar(new Set());
        setShowEvolutionModal(false);
        setEvolutionInitialData(null);
        toast.success("✅ Evolución registrada y procedimientos marcados como realizados.");
        if (onSaved) onSaved();
    };

    const handleGenerateSelectedInvoice = async () => {
        if (selectedForInvoice.size === 0) return;
        if (!currentPlanId) {
            toast.error('Guarda el plan antes de generar la factura.');
            return;
        }

        const selectedItems = items.filter(it => selectedForInvoice.has(it.id));

        // Bloqueo clínico: solo atenciones REALIZADAS pueden facturarse
        const noRealizados = selectedItems.filter(it => it.realizado !== true && !it.fechaRealizado);
        if (noRealizados.length > 0) {
            toast.error(`❌ ${noRealizados.length} procedimiento(s) no han sido realizados aún. Solo atenciones clínicas realizadas pueden facturarse.`);
            return;
        }

        // Bloqueo: no se puede facturar un ítem que ya tiene factura emitida
        const yaFacturados = selectedItems.filter(it => it.facturado === true);
        if (yaFacturados.length > 0) {
            toast.error(`❌ ${yaFacturados.length} procedimiento(s) ya tienen factura emitida.`);
            setSelectedForInvoice(new Set());
            return;
        }

        let activeCreds = factusCredentials;
        if (!activeCreds) {
            const { getFactusCredentialsForTenant } = await import('../../../services/factusAdminService');
            activeCreds = await getFactusCredentialsForTenant(inquilino);
            if (!activeCreds) {
                toast.error('La facturación electrónica no está configurada. Contacta al administrador del sistema.');
                return;
            }
            setFactusCredentials(activeCreds);
        }
        if (!patient?.nroDocumento && !patient?.documento && !patient?.identificacion) {
            toast.error('El paciente debe tener número de documento registrado para facturar ante la DIAN.');
            return;
        }

        // ── Resolver Configuración Autoritativa de Facturación y REPS ──
        let providerCode = '';
        let billingCfg = {};
        try {
            const { getConfigSection } = await import('../../../services/configPersistenceService');
            const [billingSection, companyCfg, tenantRow, sisproSecrets] = await Promise.all([
                getConfigSection(inquilino, "facturacion_electronica", {}),
                getConfigSection(inquilino, "empresa_datos", {}),
                supabase.from("tenants").select("*").eq("id", inquilino).maybeSingle(),
                supabase.from("tenant_secrets").select("sispro_config").eq("tenant_id", inquilino).maybeSingle()
            ]);
            billingCfg = billingSection?.general || billingSection?.por_sucursal?.general || billingSection || {};
            const dTenant = tenantRow?.data || {};
            const dSispro = sisproSecrets?.data?.sispro_config || {};
            providerCode = String(
                billingCfg?.provider_code ||
                dTenant.codigoPrestador ||
                dSispro.codigoPrestador ||
                companyCfg?.codigoPrestador ||
                companyCfg?.reps ||
                ''
            ).trim();
        } catch (e) {
            console.warn('Error cargando configuración en PlanEditor:', e);
        }

        // ── Verificar cuota disponible ──
        const { canTenantEmit } = await import('../../../services/factusAdminService');
        const tieneDisponibles = await canTenantEmit(inquilino);
        if (!tieneDisponibles) {
            toast.error('❌ No tienes facturas electrónicas disponibles. Contacta al administrador para adquirir más.');
            return;
        }

        // La factura es por el VALOR TOTAL del ítem (sin restar abonos/pagos)
        const totalFactura = selectedItems.reduce((s, it) => {
            const totalCost = (Number(it.amount || 0) * Number(it.qty || 1)) - Number(it.descuento || 0);
            return s + totalCost;
        }, 0);

        setEmittingInvoice(true);
        try {
            // Build the invoice document
            const invoiceItems = selectedItems.map((it, idx) => {
                const totalCost = (Number(it.amount || 0) * Number(it.qty || 1)) - Number(it.descuento || 0);
                const cupsCode = it.codigo_cups || it.cups || it.code || 'SERV-0001';
                const lineId = it.invoiceLineId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `line-${idx + 1}-${Date.now()}`);
                const sourceId = it.clinicalSourceId || it.id;
                const sourceType = it.clinicalSourceType || 'PLAN_ITEM';
                const fechaAtencion = it.fechaRealizado || it.fecha || new Date().toISOString().slice(0, 10);
                return {
                    itemId:             it.id,
                    invoiceLineId:      lineId,
                    clinicalSourceId:   sourceId,
                    clinicalSourceType: sourceType,
                    code:               cupsCode,
                    code_reference:     cupsCode,
                    cups:               cupsCode,
                    nombre:             it.desc || 'Servicio Dental',
                    descripcion:        it.desc || 'Servicio Dental',
                    precio:             Number(it.amount || 0),
                    precioUnitario:     Number(it.amount || 0),
                    cantidad:           Number(it.qty || 1),
                    descuento:          Number(it.descuento || 0),
                    totalLinea:         totalCost,
                    valor:              totalCost,
                    fechaRealizado:     fechaAtencion,
                    fechaAtencion:      fechaAtencion,
                    realizado:          true
                };
            });

            let nroFactura = `FE-${Math.floor(1000 + Math.random() * 9000)}`;
            try {
                const consList = await getConfigItems(inquilino, "consecutivos", "consecutivos");
                const activeCons = consList.find(c => c.activo !== false) || consList[0] || {};
                const prefix = activeCons.fvPrefijo || activeCons.fePrefijoFactura || "FE";
                const currentCount = Number(activeCons.fvNumActual || activeCons.feNumActual || activeCons.contFacturaBorrador || 0) + 1;
                nroFactura = `${prefix}-${String(currentCount).padStart(4, "0")}`;
                
                const { saveConfigItem } = await import('../../../services/configPersistenceService');
                await saveConfigItem(inquilino, "consecutivos", "consecutivos", {
                    ...activeCons,
                    fvNumActual: currentCount,
                    contFacturaBorrador: currentCount
                });
            } catch (e) {}

            const planCob = cobertura || initialData?.cobertura;
            const isPlanEntidad = planCob?.tipo === 'entidad' && (planCob?.terceroId || planCob?.entidadId);
            let terceroObj = planCob?.tercero || null;
            if (isPlanEntidad && !terceroObj) {
                const tId = planCob.terceroId || planCob.entidadId;
                try {
                    const { data: tRow } = await supabase.from('terceros').select('*').eq('id', tId).maybeSingle();
                    if (tRow) terceroObj = tRow;
                } catch (e) {}
            }

            const terceroNombre = planCob?.terceroNombre || planCob?.entidadNombre || terceroObj?.razonSocial || terceroObj?.nombre || 'Entidad Convenio';
            const terceroDoc = planCob?.terceroDocumento || terceroObj?.nroDocumento || terceroObj?.nit || '';
            const terceroTipoDoc = terceroObj?.tipoDocumento || (terceroDoc.includes('-') || terceroObj?.tipoPersona === 'Juridica' ? 'NIT' : 'NIT');
            const patientFullName = patient?.nombreCompleto || [patient?.nombre || patient?.nombres, patient?.apellido || patient?.apellidos].filter(Boolean).join(' ') || 'Paciente';

            // ── Construir componentes oficiales FEV Salud (SS-CUFE) ──
            const {
                buildBillingPeriodFromAttentions,
                buildBeneficiaryFromPatient,
                resolveHealthDataFromConfig,
                resolveHealthCatalogProfile,
                preflightHealthInvoice,
            } = await import('../../../services/factusHealthPayloadBuilder');

            // 1. Resolver perfil de catálogo de salud autoritativo (NO inferido silenciosamente)
            let catalogProfile = null;
            try {
                catalogProfile = resolveHealthCatalogProfile({
                    tenantConfig: billingCfg,
                    factusConfig: activeCreds || factusCredentials,
                });
            } catch (errProf) {
                toast.error(`❌ ${errProf.code || 'FACTUS_HEALTH_CATALOG_PROFILE_REQUIRED'}: ${errProf.message}`);
                setEmittingInvoice(false);
                return;
            }

            // 2. Resolver numbering_range_id autoritativo
            const numberingRangeId = billingCfg?.numbering_range_id || (activeCreds || factusCredentials)?.factusNumberingRangeId;

            let billingPeriod = null;
            try {
                billingPeriod = buildBillingPeriodFromAttentions(selectedItems, new Date());
            } catch (errDate) {
                toast.error(`❌ Error en fechas de atención: ${errDate.message}`);
                setEmittingInvoice(false);
                return;
            }

            const beneficiary = buildBeneficiaryFromPatient(patient);

            const modalidadPago = planCob?.modalidadPago || billingCfg?.health_payment_method_code || '04';
            const coberturaCode = planCob?.coberturaCode || billingCfg?.coverage_code || (isPlanEntidad ? null : '15');
            const contractNumber = isPlanEntidad ? (planCob?.numeroContrato || planCob?.contrato || billingCfg?.contract_number || null) : null;
            const withoutContractCode = isPlanEntidad ? null : (billingCfg?.without_contract_code || '05');

            // 3. Preflight formal estricto antes de llamar a Factus
            let preflightResult = null;
            try {
                preflightResult = preflightHealthInvoice({
                    catalogProfile,
                    numberingRangeId,
                    providerCode,
                    paymentMethodCode: modalidadPago,
                    coverageCode: coberturaCode,
                    contractNumber,
                    withoutContractCode,
                    items: selectedItems,
                    beneficiary,
                    billingPeriod,
                });
            } catch (errPreflight) {
                toast.error(`❌ ${errPreflight.code || 'PREFLIGHT_ERROR'}: ${errPreflight.message}`);
                setEmittingInvoice(false);
                return;
            }

            const healthData = resolveHealthDataFromConfig({
                providerCode: preflightResult.providerCode,
                planCob,
                isEntidad: isPlanEntidad,
                modalidadPago: preflightResult.paymentMethodCode,
                coberturaCode: preflightResult.coverageCode,
                contractNumber: preflightResult.contractNumber,
                withoutContractCode: preflightResult.withoutContractCode,
                catalogProfile,
            });

            const dbPayload = {
                tenant_id:        inquilino || null,
                paciente_id:      patientId || null,
                numero:           nroFactura,
                fecha_emision:    new Date().toISOString(),
                subtotal:         totalFactura,
                total:            totalFactura,
                estado:           'Pendiente',
                // Si el presupuesto fue marcado por entidad/IPS, la factura se carga a nombre del Tercero
                tercero_id:       isPlanEntidad ? (planCob.terceroId || planCob.entidadId) : null,
                tercero_nombre:   isPlanEntidad ? terceroNombre : null,
                tercero_documento: isPlanEntidad ? terceroDoc : null,
                cliente_nombre:   isPlanEntidad ? terceroNombre : patientFullName,
                cliente_documento: isPlanEntidad ? terceroDoc : (patient?.nroDocumento || patient?.documento || ''),
                paciente_nombre:  patientFullName,
                es_entidad:       Boolean(isPlanEntidad),
                entidad_id:       isPlanEntidad ? (planCob.terceroId || planCob.entidadId) : null,
                entidad_nombre:   isPlanEntidad ? terceroNombre : null,
                observaciones:    isPlanEntidad 
                    ? `Facturado a Entidad / IPS: ${terceroNombre} (NIT: ${terceroDoc}) - Paciente: ${patientFullName}` 
                    : (obs || '')
            };

            const invoiceData = {
                paciente_id: patientId,
                patientId,
                tenant_id:  inquilino || '',
                inquilino:  inquilino || '',
                planId:     currentPlanId,
                nroFactura: nroFactura,
                numero:     nroFactura,
                numbering_range_id: preflightResult.numberingRangeId,
                numberingRangeId: preflightResult.numberingRangeId,
                fechaISO:   new Date().toISOString(),
                total:      totalFactura,
                subtotal:   totalFactura,
                medioPago:  '10',
                condicionPago: '1',
                estado:     'Pendiente',
                factusEstado: 'Pendiente',
                profesional: initialData?.profesionalId || initialData?.profesional || userProfile?.nombreCompleto || 'Profesional',
                terceroId:   isPlanEntidad ? (planCob.terceroId || planCob.entidadId) : null,
                terceroNombre: isPlanEntidad ? terceroNombre : null,
                terceroDocumento: isPlanEntidad ? terceroDoc : null,
                clienteNombre: isPlanEntidad ? terceroNombre : patientFullName,
                pacienteNombre: patientFullName,
                esEntidad:   Boolean(isPlanEntidad),
                items:      invoiceItems,
                // Flujo oficial FEV Salud SS-CUFE
                esSectorSalud: true,
                tipoOperacion: "SS-CUFE",
                fevRipsFlagEnabled: true,
                healthData,
                billing_period: preflightResult.billingPeriod,
                beneficiary: preflightResult.beneficiary,
            };

            // 1️⃣ Save to Supabase first with complete JSONB detalles
            const { data: invData, error: invError } = await supabase
                .from('facturas')
                .insert([{
                    ...dbPayload,
                    detalles: {
                        ...invoiceData,
                        planId: currentPlanId,
                        pacienteNombre: patientFullName,
                        pacienteDocumento: patient?.nroDocumento || patient?.documento || '',
                        estado_pago: 'PENDIENTE',
                        saldo_pendiente: totalFactura,
                        monto_pagado: 0,
                        recibos_asociados: []
                    }
                }])
                .select()
                .single();
            if (invError) throw invError;

            // 2️⃣ Mark plan items as invoiced immediately
            const updatedItems = items.map(it =>
                selectedForInvoice.has(it.id)
                    ? { ...it, facturado: true, fechaFacturado: new Date().toISOString() }
                    : it
            );
            await updatePlan(currentPlanId, { items: updatedItems });
            setItems(updatedItems);

            // 3️⃣ Emit to DIAN via Factus
            try {
                toast.info('Emitiendo factura ante la DIAN…');
                // Si el presupuesto fue marcado por entidad, el comprador ante la DIAN es la IPS / Tercero
                const customerForFactus = isPlanEntidad ? {
                    documento:      terceroDoc || terceroObj?.nroDocumento || '222222222222',
                    identificacion: terceroDoc || terceroObj?.nroDocumento || '222222222222',
                    tipoDocumento:  terceroTipoDoc,
                    tipoPersona:    terceroObj?.tipoPersona || 'Juridica',
                    nombre:         terceroObj?.razonSocial || terceroNombre,
                    apellido:       terceroObj?.tipoPersona === 'Natural' ? (terceroObj?.apellidos || '') : '',
                    razonSocial:    terceroObj?.razonSocial || terceroNombre,
                    email:          terceroObj?.email || patient?.email || 'facturacion@odontocloud.com',
                    telefono:       terceroObj?.telefono || patient?.celular || '3000000000',
                    direccion:      terceroObj?.direccion || patient?.direccion || 'Dirección no registrada',
                    ciudad:         terceroObj?.ciudad || patient?.ciudad || 'Bogotá D.C.',
                } : {
                    ...patient,
                    documento:      patient?.nroDocumento || patient?.documento || patient?.identificacion,
                    identificacion: patient?.nroDocumento || patient?.documento || patient?.identificacion,
                    tipoDocumento:  patient?.tipoDocumento || 'CC',
                    tipoPersona:    'Natural',
                    nombre:         patient?.nombres || patient?.nombre || (patient?.nombreCompleto || '').split(' ')[0] || 'Cliente',
                    apellido:       patient?.apellidos || patient?.apellido || (patient?.nombreCompleto || '').split(' ').slice(1).join(' ') || 'OdontoCloud',
                    email:          patient?.email || patient?.correo || 'sin.email@odontocloud.com',
                    telefono:       patient?.celular || patient?.telefono || '3000000000',
                    direccion:      patient?.direccion || 'Dirección no registrada',
                    ciudad:         patient?.ciudad || '',
                };

                const result = await factusService.sendInvoice(
                    { ...invoiceData, id: invData?.id },
                    customerForFactus,
                    activeCreds || factusCredentials
                );

                const bill = result?.data?.bill || result?.bill || result?.data || {};
                const finalNro = bill?.number || bill?.invoice_number || result?.data?.number || nroFactura;
                const cufe = bill?.cufe || bill?.cude || result?.data?.cufe || null;
                const qr = bill?.qr_code || bill?.qr || result?.data?.qr_code || (cufe ? `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${cufe}` : null);
                const pdfUrl = bill?.public_url || bill?.qr_image || bill?.pdf_url || null;

                if (invData?.id) {
                    let currentDet = invData.detalles || {};
                    if (typeof currentDet === 'string') {
                        try { currentDet = JSON.parse(currentDet); } catch { currentDet = {}; }
                    }
                    const updatedDet = {
                        ...currentDet,
                        factusEstado: 'Emitido',
                        factusNumero: finalNro,
                        factusCufe: cufe,
                        factusQr: qr,
                        factusPdfUrl: pdfUrl,
                        factusResponse: result?.data || result || null,
                        dianStatus: 'ACEPTADA',
                    };
                    await supabase
                        .from('facturas')
                        .update({
                            estado: 'Emitido',
                            numero: finalNro,
                            detalles: updatedDet,
                        })
                        .eq('id', invData.id);
                }

                // ── Consumir una factura de la cuota del tenant ──
                try {
                    const { consumeOneInvoice } = await import('../../../services/factusAdminService');
                    await consumeOneInvoice(inquilino);
                } catch (e) {
                    console.warn('Could not decrement invoice quota:', e.message);
                }

                toast.success(`✅ Factura emitida ante la DIAN.${ finalNro ? ` N.º: ${finalNro}` : '' }`);
            } catch (factusErr) {
                // Factus failed — invoice saved as Pendiente, user can retry from Historial
                console.error('Factus error:', factusErr);
                toast.error(`Factura guardada pero NO emitida a la DIAN: ${factusErr.message}. Reintenta desde Historial de Facturas.`);
            }

            setSelectedForInvoice(new Set());
        } catch (err) {
            console.error(err);
            toast.error('Error al generar la factura.');
        } finally {
            setEmittingInvoice(false);
        }
    };

    // Returns: 'none' | 'debt' | 'partial' | 'paid'
    const getItemStatus = (item) => {
        if (!isItemRealized(item.id)) return 'none';
        const totalCost = (Number(item.amount || 0) * Number(item.qty || 1)) - Number(item.descuento || 0);
        const paid = paidMap[item.id] || 0;
        if (paid <= 0) return 'debt';
        if (paid < totalCost) return 'partial';
        return 'paid';
    };

    const cargarCombo = async (plan) => {
        setLoadingPlanItems(true);
        try {
            const planItems = plan.items || [];
            
            if (planItems.length === 0) {
                toast.error("Este plan no tiene ítems configurados. Ve a Configuración -> Planes para agregar servicios.");
                return;
            }

            // Inyectar al presupuesto
            const newItems = planItems.map(it => ({
                id: Math.random().toString(36).substr(2, 9),
                code: it.codigo || it.code || "",
                codigo: it.codigo || it.code || "",
                codigo_cups: it.codigo || it.code || it.codigo_cups || "",
                desc: it.nombre || it.desc || "",
                amount: Number(it.valor_unit || it.precio || it.amount || 0),
                qty: Number(it.cantidad || it.qty || 1),
                descuento: Number(it.descuento || 0),
                dientes: it.dientes || "",
                line_obs: it.observaciones || it.line_obs || "",
                es_consulta: Boolean(it.es_consulta),
                permite_descuento: it.permite_descuento !== undefined ? it.permite_descuento : true,
                max_desc: it.max_desc !== undefined ? Number(it.max_desc) : 100
            }));

            const nextItems = [...items, ...newItems];
            setItems(nextItems);
            setShowPlanesModal(false);
            toast.success(`Combo "${plan.nombre}" cargado con éxito!`);
            triggerAutoSave(nextItems);
        } catch (e) {
            console.error("Error cargando combo:", e);
            toast.error("Error cargando el combo.");
        } finally {
            setLoadingPlanItems(false);
        }
    };

    const handleModalAdd = (newStagedItems) => {
        const nextItems = [...items, ...newStagedItems];
        setItems(nextItems);
        toast.success(`${newStagedItems.length} servicios cargados con éxito`);
        triggerAutoSave(nextItems);
    };

    // ── Flujo de Importación Asistida Odontograma → Lista de Precios / CUPS (Fase 1) ──
    const [odontoImportQueue, setOdontoImportQueue] = useState([]);
    const [currentQueueIndex, setCurrentQueueIndex] = useState(-1);

    const cleanHallazgoName = (situacion) => {
        if (!situacion) return "Hallazgo Clínico";
        const parts = String(situacion).split(' - ');
        return parts[0].trim();
    };

    const activeFindingContext = React.useMemo(() => {
        if (currentQueueIndex >= 0 && currentQueueIndex < odontoImportQueue.length) {
            const item = odontoImportQueue[currentQueueIndex];
            return {
                hallazgo: cleanHallazgoName(item.situacion),
                situacionOriginal: item.situacion,
                diente: item.pieza && item.pieza !== '---' ? String(item.pieza) : "",
                superficie: item.cara || "General",
                tipoDenticion: item.tipoDenticion || "adulto",
                odontograma_id: item.odontograma_id || null,
                tratamiento_pendiente_id: item.tratamiento_pendiente_id || null,
                step: currentQueueIndex + 1,
                totalSteps: odontoImportQueue.length
            };
        }
        return null;
    }, [odontoImportQueue, currentQueueIndex]);

    const handleCloseProcedureModal = () => {
        setShowProcedureModal(false);
        setOdontoImportQueue([]);
        setCurrentQueueIndex(-1);
    };

    const handleSkipFinding = () => {
        if (currentQueueIndex + 1 < odontoImportQueue.length) {
            toast.info(`Hallazgo omitido (${currentQueueIndex + 1}/${odontoImportQueue.length})`);
            setCurrentQueueIndex(prev => prev + 1);
        } else {
            toast.info("Importación de hallazgos finalizada.");
            handleCloseProcedureModal();
        }
    };

    const handleConfirmFinding = (stagedItems, ctx) => {
        const formattedNewItems = stagedItems.map(si => ({
            ...si,
            id: si.id || `proc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            status: 'pending',
            realizado: false,
            dientes: si.dientes || ctx?.diente || "",
            superficie: si.superficie || ctx?.superficie || "",
            line_obs: si.line_obs || ((si.superficie || ctx?.superficie) && (si.superficie || ctx?.superficie) !== 'General' && (si.superficie || ctx?.superficie) !== '---' && (si.superficie || ctx?.superficie) !== 'Pieza Completa' ? `Cara: ${si.superficie || ctx?.superficie}` : ""),
            hallazgo_origen: si.hallazgo_origen || ctx?.hallazgo || "",
            odontograma_id: si.odontograma_id || ctx?.odontograma_id || null,
            tratamiento_pendiente_id: si.tratamiento_pendiente_id || ctx?.tratamiento_pendiente_id || null,
            code: si.codigo_cups || si.code || si.codigo || "",
            codigo: si.codigo_cups || si.code || si.codigo || "",
            codigo_cups: si.codigo_cups || si.code || si.codigo || ""
        }));

        const nextItems = [...items, ...formattedNewItems];
        setItems(nextItems);
        triggerAutoSave(nextItems);

        toast.success(`✓ ${formattedNewItems[0]?.desc || 'Procedimiento'} vinculado para Diente ${ctx?.diente || 'General'}`);

        if (currentQueueIndex + 1 < odontoImportQueue.length) {
            setCurrentQueueIndex(prev => prev + 1);
        } else {
            const totalImported = odontoImportQueue.length;
            handleCloseProcedureModal();
            if (totalImported > 1) {
                toast.success(`🎉 Se completó la importación y vinculación de ${totalImported} hallazgos.`);
            }
        }
    };

    const isNonPresupuestable = (situacion) => {
        const s = String(situacion || "").toLowerCase().trim();
        return (
            s.includes("sano") ||
            s.includes("sana") ||
            s.includes("ausente") ||
            s.includes("sin erupcionar") ||
            s.includes("parcial. erup") ||
            s.includes("adaptada") ||
            s.includes("adaptado") ||
            s.includes("buena") ||
            s.includes("bueno")
        );
    };

    const pendingOdontoItems = useMemo(() => {
        return (odontoItems || []).filter(item => !isNonPresupuestable(item.situacion));
    }, [odontoItems]);

    const displayedOdontoItems = useMemo(() => {
        if (odontoFilterMode === "todos") return odontoItems || [];
        return pendingOdontoItems;
    }, [odontoFilterMode, odontoItems, pendingOdontoItems]);

    const importSingleOdontoItem = (odontoItem) => {
        setShowOdontoModal(false);
        setOdontoImportQueue([odontoItem]);
        setCurrentQueueIndex(0);
        setShowProcedureModal(true);
    };

    const importAllOdontoItems = () => {
        const toImport = displayedOdontoItems;
        if (!toImport.length) return;
        setShowOdontoModal(false);
        setOdontoImportQueue([...toImport]);
        setCurrentQueueIndex(0);
        setShowProcedureModal(true);
    };

    const handleOpenOdontoModal = async () => {
        const targetPatientId = patientId || patient?.id;
        if (!targetPatientId) {
            toast.error("Error: ID de paciente no disponible.");
            return;
        }
        setOdontoFilterMode("pendientes");
        setShowOdontoModal(true);
        setOdontoLoading(true);
        try {
            const { data: odontoData, error: odontoErr } = await supabase
                .from("odontogramas")
                .select("*")
                .eq("paciente_id", targetPatientId)
                .order("created_at", { ascending: false });
            
            if (odontoErr) console.warn("Aviso consultando odontogramas:", odontoErr);

            const list = [];
            (odontoData || []).forEach(doc => {
                const creadoDate = doc.created_at ? new Date(doc.created_at) : null;
                const formattedDate = creadoDate 
                    ? creadoDate.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) 
                    : "---";
                const hallazgos = doc.hallazgos || {};
                const creadoPor = hallazgos.profesional || hallazgos.creadoPor || doc.profesional || doc.creado_por || "Odontólogo Tratante";
                const docTipoDenticion = hallazgos.tipoDenticion || doc.tipo_denticion || doc.tipoDenticion || "adulto";

                // 1. Extraer del plan de tratamiento guardado (hallazgos.plan o doc.plan)
                const plan = (Array.isArray(hallazgos.plan) && hallazgos.plan.length > 0)
                    ? hallazgos.plan
                    : (Array.isArray(doc.plan) && doc.plan.length > 0 ? doc.plan : []);

                if (plan.length > 0) {
                    plan.forEach(item => {
                        list.push({
                            id: item.id || `${doc.id}-${item.diente}-${item.zona}`,
                            odontograma_id: doc.id,
                            tipoDenticion: item.tipoDenticion || docTipoDenticion,
                            fecha: formattedDate,
                            creadoPor: creadoPor,
                            pieza: item.diente || item.tooth || item.pieza || "---",
                            situacion: item.tratamiento || item.label || item.situacion || item.diagnostico || "Hallazgo",
                            cara: item.zonaLabel || item.zona || item.cara || item.surface || "Pieza Completa",
                            zona: item.zona || "",
                            zona_label: item.zonaLabel || ""
                        });
                    });
                }

                // 2. Extraer del mapa de hallazgos anatómicos (hallazgos.data o doc.data)
                const dataObj = hallazgos.data || doc.data;
                if ((!plan || plan.length === 0) && dataObj && typeof dataObj === 'object') {
                    const zonaLabelMap = {
                        center: "Oclusal/Incisal",
                        top: "Vestibular",
                        bottom: "Palatina/Lingual",
                        left: "Mesial/Distal",
                        right: "Distal/Mesial",
                        Completo: "Pieza Completa"
                    };
                    Object.entries(dataObj).forEach(([dienteNum, zonas]) => {
                        if (zonas && typeof zonas === 'object') {
                            Object.entries(zonas).forEach(([zonaKey, val]) => {
                                if (val && typeof val === 'object' && (val.tool || val.label || val.tratamiento)) {
                                    list.push({
                                        id: `${doc.id}-${dienteNum}-${zonaKey}`,
                                        odontograma_id: doc.id,
                                        tipoDenticion: docTipoDenticion,
                                        fecha: formattedDate,
                                        creadoPor: creadoPor,
                                        pieza: dienteNum,
                                        situacion: val.label || val.tratamiento || val.tool || "Hallazgo",
                                        cara: val.zonaLabel || zonaLabelMap[zonaKey] || zonaKey || "General",
                                        zona: zonaKey || "",
                                        zona_label: val.zonaLabel || zonaLabelMap[zonaKey] || zonaKey || ""
                                    });
                                }
                            });
                        }
                    });
                }
            });

            // 3. Consultar tabla tratamientos_pendientes para sincronizar y enriquecer IDs
            try {
                const { data: pendData } = await supabase
                    .from("tratamientos_pendientes")
                    .select("*")
                    .eq("paciente_id", targetPatientId)
                    .order("created_at", { ascending: false });

                if (pendData && pendData.length > 0) {
                    if (list.length === 0) {
                        pendData.forEach(p => {
                            const creadoDate = p.created_at ? new Date(p.created_at) : null;
                            const formattedDate = creadoDate 
                                ? creadoDate.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) 
                                : "---";
                            list.push({
                                id: p.id,
                                tratamiento_pendiente_id: p.id,
                                odontograma_id: p.odontograma_id,
                                fecha: formattedDate,
                                creadoPor: p.creado_por || "Odontólogo Tratante",
                                pieza: p.diente || "---",
                                situacion: p.tratamiento || "Tratamiento Pendiente",
                                cara: p.zona_label || p.zona || "General",
                                zona: p.zona || "",
                                zona_label: p.zona_label || ""
                            });
                        });
                    } else {
                        // Enlazar id de tratamientos_pendientes con los registros existentes de la lista
                        list.forEach(item => {
                            const matched = pendData.find(p => 
                                (p.odontograma_id === item.odontograma_id || !item.odontograma_id) && 
                                String(p.diente) === String(item.pieza) &&
                                (!p.zona || !item.zona || p.zona === item.zona || p.zona === "Completo" || item.zona === "Completo")
                            );
                            if (matched) {
                                item.tratamiento_pendiente_id = matched.id;
                            }
                        });
                    }
                }
            } catch (syncErr) {
                console.warn("Aviso al consultar tratamientos_pendientes:", syncErr);
            }

            setOdontoItems(list);
        } catch (e) {
            console.error("Error loading current odontogram data:", e);
            toast.error("Error al cargar el odontograma actual");
        } finally {
            setOdontoLoading(false);
        }
    };

    // UI state for search
    const [activeSearchId, setActiveSearchId] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);

    // Dropdown visibility
    const [showResults, setShowResults] = useState(false);

    // Tooth Selector State
    const [toothModal, setToothModal] = useState({ isOpen: false, itemId: null, initialValue: "" });

    // Deletion Modal State
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, planId: null, planName: "" });
    
    // Convert to Plan Confirmation Modal
    const [convertModal, setConvertModal] = useState(false);

    const openToothSelector = (item) => {
        setToothModal({
            isOpen: true,
            itemId: item.id,
            initialValue: item.dientes || ""
        });
    };

    const handleToothSelection = (teethString) => {
        updateItem(toothModal.itemId, 'dientes', teethString);
    };

    const [baseListName, setBaseListName] = useState("Sin Lista Asignada");
    const [allPriceLists, setAllPriceLists] = useState([]);

    useEffect(() => {
        const fetchAllLists = async () => {
            const currentInquilino = inquilino || patient?.inquilino || patient?.tenant_id;
            if (!currentInquilino) return;
            try {
                const { data } = await supabase
                    .from("listas_precios")
                    .select("*")
                    .eq("tenant_id", currentInquilino);
                setAllPriceLists(data || []);
            } catch (e) { console.error(e); }
        };
        fetchAllLists();
    }, [inquilino, patient?.inquilino, patient?.tenant_id]);

    useEffect(() => {
        const fetchInitialBaseList = async () => {
            const currentInquilino = inquilino || patient?.inquilino || patient?.tenant_id;
            if (!currentInquilino) return;
            
            try {
                if (patient?.convenioBeneficio) {
                    const { data: convData } = await supabase
                        .from("convenios")
                        .select("*")
                        .eq("tenant_id", currentInquilino)
                        .eq("nombre", patient.convenioBeneficio.trim())
                        .maybeSingle();

                    if (convData) {
                        if (!initialData?.baseListId && (convData.lista_precios_id || convData.listaPreciosId)) {
                            const listId = convData.lista_precios_id || convData.listaPreciosId;
                            setBaseListId(listId);
                            const { data: listData } = await supabase
                                .from("listas_precios")
                                .select("*")
                                .eq("id", listId)
                                .maybeSingle();
                            if (listData) setBaseListName(listData.nombre);
                            return;
                        }
                    }
                }

                if (initialData?.baseListId) {
                    setBaseListId(initialData.baseListId);
                    const { data: listData } = await supabase
                        .from("listas_precios")
                        .select("*")
                        .eq("id", initialData.baseListId)
                        .maybeSingle();
                    if (listData) setBaseListName(listData.nombre);
                    return;
                }

                const { data: lists } = await supabase
                    .from("listas_precios")
                    .select("*")
                    .eq("tenant_id", currentInquilino);
                console.log('===BEGIN_ALL_LISTAS_PRECIOS===');
                console.log(JSON.stringify(lists, null, 2));
                console.log('===END_ALL_LISTAS_PRECIOS===');
                if (lists && lists.length > 0) {
                    const activeList = lists.find(l => l.en_uso) || lists[0];
                    setBaseListId(activeList.id);
                    setBaseListName(activeList.nombre);
                }
            } catch (e) {
                console.error("Error fetching price list context:", e);
            }
        };
        fetchInitialBaseList();
    }, [patient?.planId, inquilino, patient?.inquilino, patient?.tenant_id, initialData?.baseListId, patient?.convenioBeneficio]);

    const handleListChange = async (e) => {
        const id = e.target.value;
        setBaseListId(id);
        const selected = allPriceLists.find(l => l.id === id);
        if (selected) setBaseListName(selected.nombre);
        toast.info(`Tarifario cambiado a: ${selected?.nombre}`);
    };

    const handleItemSearch = async (id, term) => {
        updateItem(id, 'desc', term);
        if (term.length < 1) {
            setSearchResults([]);
            setShowResults(false);
            return;
        }

        setSearchLoading(true);
        setActiveSearchId(id);
        setShowResults(true);
        try {
            let rawItems = [];
            if (baseListId) {
                const { data: listRow } = await supabase
                    .from("listas_precios")
                    .select("descripcion")
                    .eq("id", baseListId)
                    .maybeSingle();

                if (listRow?.descripcion) {
                    try {
                        const parsed = JSON.parse(listRow.descripcion);
                        if (Array.isArray(parsed) && parsed.length > 0) rawItems = parsed;
                    } catch (_) {}
                }
            }

            if (rawItems.length === 0) {
                rawItems = CUPS_DENTAL_CODES.map((c, idx) => ({
                    id: `cups_${c.code}_${idx}`,
                    codigo: c.code,
                    nombre: c.name,
                    precio: Number(c.precio || 0)
                }));
            }

            const searchWords = term.toLowerCase().split(/\s+/).filter(Boolean);
            const filtered = rawItems.filter(item => {
                const nameLower = (item.nombre || item.descripcion || item.desc || "").toLowerCase();
                const codeLower = (item.codigo || "").toLowerCase();
                return searchWords.every(word => nameLower.includes(word) || codeLower.includes(word));
            }).slice(0, 10);

            setSearchResults(filtered.map((d, idx) => ({
                id: d.id || `search_${idx}`,
                ...d,
                amount: Number(d.precio || d.valor || d.amount || 0),
                desc: d.nombre || d.descripcion || d.desc || ""
            })));
        } catch (e) {
            console.error("Search error:", e);
        } finally {
            setSearchLoading(false);
        }
    };

    const selectProcedure = (itemId, proc) => {
        const convenioDisc = convenioDescuentos[proc.id] || null;
        let discountVal = 0;
        if (convenioDisc) {
            discountVal = ((proc.precio || 0) * (convenioDisc.desc_porc || 0) / 100);
        }

        setItems(items.map(i => i.id === itemId ? {
            ...i,
            desc: proc.nombre || proc.label,
            amount: proc.precio || proc.value || 0,
            code: proc.codigo || "",
            permite_descuento: proc.permite_descuento !== undefined ? proc.permite_descuento : true,
            max_desc: proc.max_desc !== undefined ? Number(proc.max_desc) : 100,
            descuento: discountVal * (i.qty || 1)
        } : i));
        setSearchResults([]);
        setShowResults(false);
        setActiveSearchId(null);
    };

    const addItem = () => {
        setItems([...items, { id: Date.now(), desc: "", amount: 0, qty: 1, code: "", dientes: "", line_obs: "", descuento: 0 }]);
    };

    const removeItem = (id) => {
        if (items.length === 1) return;
        const nextItems = items.filter(i => i.id !== id);
        setItems(nextItems);
        triggerAutoSave(nextItems);
    };

    const updateItem = (id, field, val) => {
        if (field === 'descuento') {
            const item = items.find(i => i.id === id);
            if (item) {
                const permiteDesc = item.permite_descuento !== undefined ? item.permite_descuento : true;
                if (!permiteDesc && Number(val) > 0) {
                    toast.error(`Este procedimiento ("${item.desc}") no permite descuentos.`);
                    return;
                }

                const maxDescPercent = item.max_desc !== undefined ? Number(item.max_desc) : 100;
                const maxDiscountVal = (item.amount * item.qty) * (maxDescPercent / 100);
                if (Number(val) > maxDiscountVal) {
                    toast.error(`El descuento máximo para "${item.desc}" es del ${maxDescPercent}% ($${maxDiscountVal.toLocaleString('es-CO')})`);
                    return;
                }
            }
        }
        const nextItems = items.map(i => i.id === id ? { ...i, [field]: val } : i);
        setItems(nextItems);
        triggerAutoSave(nextItems);
    };

    const calculateSubtotal = () => {
        return items.reduce((acc, curr) => acc + (Number(curr.amount) * Number(curr.qty)), 0);
    };

    const calculateDiscounts = () => {
        return items.reduce((acc, curr) => acc + (Number(curr.descuento || 0)), 0);
    };

    const calculateTotal = () => {
        return calculateSubtotal() - calculateDiscounts();
    };

    const handleConvertToPlan = () => {
        const validItems = items.filter(i => (i.desc || "").trim() !== "");
        if (!title.trim()) {
            toast.error("Ingresa un título para el presupuesto antes de convertir");
            return;
        }
        if (validItems.length === 0) {
            toast.error("Agrega al menos un tratamiento antes de convertir");
            return;
        }
        setConvertModal(true);
    };

    const confirmConvertToPlan = async () => {
        setConvertModal(false);
        setLoading(true);
        try {
            const validItems = items.filter(i => (i.desc || "").trim() !== "");

            const planPayload = {
                patientId,
                title: title || "Plan de Tratamiento",
                items: validItems,
                total: calculateTotal(),
                subtotal: calculateSubtotal(),
                totalDescuento: calculateDiscounts(),
                type: 'plan',
                status: 'accepted',
                profesionalId: initialData?.profesionalId || "",
                vigencia: initialData?.vigencia || 30,
                observaciones: obs,
                cobertura,
                inquilino: inquilino || patient?.inquilino || "",
                baseListId: baseListId || null,
                convertedAt: new Date()
            };

            let planConsecutivo = null;
            try {
                const { consumeNextConsecutivo, CONSECUTIVO_TYPES } = await import("../../../services/consecutivosService");
                planConsecutivo = await consumeNextConsecutivo(inquilino || patient?.inquilino || patient?.tenant_id, CONSECUTIVO_TYPES.PLAN_TRATAMIENTO);
            } catch (consErr) {
                console.warn("Error incrementing plan consecutivo:", consErr);
            }

            if (currentPlanId) {
                // Plan ya guardado: actualizar tipo a 'plan'
                await updatePlan(currentPlanId, {
                    ...planPayload,
                    title: title,
                    nombre: title,
                    nroConsecutivo: planConsecutivo
                });
            } else {
                // Plan nuevo (sin ID aún): crear directamente como plan de tratamiento
                const saved = await createPlan({
                    ...planPayload,
                    title: title,
                    nombre: title,
                    nroConsecutivo: planConsecutivo
                });
                setCurrentPlanId(saved.id);
            }

            toast.success("¡Convertido a Plan de Tratamiento exitosamente!");
            onSaved?.();
        } catch (e) {
            console.error("Error al convertir:", e);
            toast.error("Error al convertir el presupuesto");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (status) => {
        if (!title.trim()) {
            toast.error("Ingresa un título para el presupuesto");
            return;
        }

        const validItems = items.filter(i => (i.desc || "").trim() !== "");
        if (validItems.length === 0) {
            toast.error("Agrega al menos un tratamiento");
            return;
        }

        setLoading(true);
        try {
            const planData = {
                patientId,
                title,
                items: validItems,
                total: calculateTotal(),
                subtotal: calculateSubtotal(),
                totalDescuento: calculateDiscounts(),
                status,
                type: initialData?.type || "presupuesto",
                profesionalId: initialData?.profesionalId || "",
                vigencia: initialData?.vigencia || 30,
                observaciones: obs,
                cobertura,
                inquilino: inquilino || patient?.inquilino || "",
                baseListId: baseListId // Persistir el tarifario usado
            };

            if (isEditing) {
                await updatePlan(currentPlanId, planData);
                toast.success("Presupuesto actualizado");
            } else {
                const saved = await createPlan(planData);
                setCurrentPlanId(saved.id);
                toast.success("Presupuesto guardado");
            }
            onSaved?.();
        } catch (error) {
            console.error("Error saving plan:", error);
            toast.error(`Error al guardar: ${error.message || 'Error desconocido'}`);
        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = async () => {
        if (!isEditing) {
            onClose();
            return;
        }
        setLoading(true);
        try {
            await deletePlan(currentPlanId);
            toast.success("Presupuesto eliminado");
            onSaved?.();
        } catch (error) {
            toast.error("Error al eliminar");
        } finally {
            setLoading(false);
            setDeleteModal({ ...deleteModal, isOpen: false });
        }
    };

    const handlePrint = async () => {
        // Build clinic object with robust fallbacks — same pattern as PlanList
        const clinic = userProfile?.tenant || {
            nombre: userProfile?.tenantNombre || userProfile?.clinica || userProfile?.inquilino || "Clínica",
            nombreComercial: userProfile?.tenantNombre || userProfile?.clinica || "Clínica",
            id: userProfile?.inquilino || userProfile?.tenantId,
            inquilino: userProfile?.inquilino || userProfile?.tenantId,
            nit: userProfile?.nit || "---",
            direccion: userProfile?.direccion || "---",
            telefono: userProfile?.telefono || "---"
        };

        if (!clinic.inquilino && !clinic.id && !clinic.nombre) {
            toast.error("Error: Información de clínica no disponible. Configure el tenant en Administración.");
            return;
        }

        const planData = {
            id: currentPlanId,
            title: title || "Presupuesto",
            items: items,
            subtotal: calculateSubtotal(),
            totalDescuento: calculateDiscounts(),
            total: calculateTotal(),
            date: initialData?.date || new Date(),
            type: initialData?.type || "presupuesto",
            profesional: initialData?.profesional || userProfile?.nombreCompleto || userProfile?.nombre || "",
            observaciones: obs,
            cobertura
        };

        await BudgetPrintService.generatePDF(planData, patient, clinic, userProfile);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/50 animate-fadeIn relative">
            
            {/* Header: Global Actions */}
            <div className="flex-none bg-white p-4 md:px-8 py-3 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-100 shadow-sm z-30">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button onClick={onClose} className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 transition-all border border-slate-100 group">
                        <FiChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                             <div className="flex items-center gap-2">
                                <FiActivity className="text-indigo-600" /> {isPlan ? "Plan de Tratamiento" : "Presupuesto"}
                             </div>
                             <span className="hidden sm:inline mx-2 text-slate-200">|</span>
                             <div className="flex items-center gap-2">
                                 <span className="text-slate-300">Tarifario Aplicado:</span>
                                 <select 
                                    className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase outline-none border transition-all ${baseListId ? 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:border-indigo-300' : 'bg-amber-50 text-amber-600 border-amber-100'}`}
                                    value={baseListId || ""}
                                    onChange={handleListChange}
                                 >
                                     <option value="" disabled>Seleccione Tarifario...</option>
                                     {allPriceLists.map(l => (
                                         <option key={l.id} value={l.id}>{l.nombre}</option>
                                     ))}
                                 </select>
                             </div>
                        </div>
                        <input
                            placeholder="TÍTULO DEL PRESUPUESTO..."
                            value={title}
                            disabled={hasPayments}
                            onChange={(e) => {
                                setTitle(e.target.value);
                                triggerAutoSave(items, e.target.value, obs);
                            }}
                            className="bg-transparent border-none p-0 text-lg font-black text-slate-800 tracking-tight outline-none w-full max-w-sm focus:ring-0"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
                    {/* Investment total — compact inline */}
                    <div className="hidden xl:flex flex-col items-end px-4 border-r border-slate-100">
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Total</span>
                        <h4 className="text-lg font-black text-indigo-600 tracking-tighter leading-none">
                            <span className="text-xs mr-0.5 font-bold text-slate-400">$</span>
                            {calculateTotal().toLocaleString('es-CO')}
                        </h4>
                    </div>

                    {/* Print icon */}
                    <button onClick={handlePrint} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all shrink-0" title="Imprimir">
                         <FiPrinter size={18} />
                    </button>

                    {/* Action buttons — compact */}
                    <div className="flex items-center gap-1.5 w-full md:w-auto font-black text-[10px] uppercase tracking-wider">
                        {hasPayments && (
                            <span className="px-3 py-2 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl flex items-center gap-1 shadow-sm mr-2">
                                🔒 PAGOS REGISTRADOS
                            </span>
                        )}
                        {(initialData?.type || 'presupuesto') === 'presupuesto' && (
                            <button 
                                onClick={handleConvertToPlan}
                                disabled={loading}
                                title="Convertir este presupuesto a Plan de Tratamiento activo"
                                className="shrink-0 px-3 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl font-black text-[9px] uppercase tracking-wider transition-all flex items-center gap-1.5 border border-indigo-100 disabled:opacity-50 whitespace-nowrap"
                            >
                                <FiActivity size={13} /> Convertir a Plan
                            </button>
                        )}
                        {!hasPayments && (
                            <button 
                                onClick={() => setDeleteModal({ isOpen: true, planId: currentPlanId, planName: title })} 
                                disabled={loading} 
                                className="shrink-0 px-3 py-2 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl font-black text-[9px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 border border-rose-100 whitespace-nowrap"
                            >
                                <FiTrash2 size={13} /> {isEditing ? "Eliminar" : "Descartar"}
                            </button>
                        )}
                        {/* 
                        <button 
                            onClick={() => handleSave('accepted')} 
                            disabled={loading} 
                            className="shrink-0 px-4 py-2 bg-[#8CC63F] text-white rounded-xl font-black text-[9px] uppercase tracking-wider shadow-lg shadow-[#8CC63F]/20 hover:bg-[#7bb335] transition-all active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap"
                        >
                             <FiCheck size={13} strokeWidth={3} /> {isEditing ? "Guardar" : "Finalizar & Aprobar"}
                        </button>
                        */}
                    </div>
                </div>
            </div>


            {/* Main Area: The Invoice Editor */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar pb-32">
                <div className="max-w-6xl mx-auto space-y-4">

                    {!hasPayments && items.some(it => isItemRealized(it.id)) && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-3xl p-5 flex items-center gap-4 shrink-0 animate-fadeIn shadow-sm">
                            <FiCheck size={24} className="text-indigo-500 shrink-0" />
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-widest leading-none text-indigo-600 mb-1">Procedimientos Realizados</p>
                                <p className="text-[10px] font-bold text-indigo-500/80 uppercase tracking-wider leading-normal">
                                    Algunos procedimientos ya fueron marcados como realizados en una evolución clínica y no pueden eliminarse ni modificarse. Sí puede editar el valor de los que aún no están realizados.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.02)] border border-slate-100 overflow-hidden">
                        <div className="bg-slate-50/50 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-blue-500">
                                    <FiInfo size={14} />
                                </div>
                                <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Modalidad administrativa del plan</h5>
                            </div>
                            <div className="grid grid-cols-2 gap-2 w-full md:w-auto">
                                <button
                                    type="button"
                                    onClick={() => setCobertura({ ...cobertura, tipo: "particular" })}
                                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${cobertura.tipo === "particular" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}
                                >
                                    Particular
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCobertura({ ...cobertura, tipo: "entidad" })}
                                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${cobertura.tipo === "entidad" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-500 border-slate-200 hover:border-blue-200"}`}
                                >
                                    EPS / convenio
                                </button>
                            </div>
                        </div>

                        {cobertura.tipo === "entidad" && (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-5 animate-fadeIn">
                                <div>
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">EPS</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-300"
                                        value={cobertura.epsNombre}
                                        onChange={(e) => setCobertura({ ...cobertura, epsNombre: e.target.value })}
                                        placeholder="EPS"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Entidad</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-300"
                                        value={cobertura.entidadNombre}
                                        onChange={(e) => setCobertura({ ...cobertura, entidadNombre: e.target.value })}
                                        placeholder="Entidad responsable"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tarifa</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-300"
                                        value={cobertura.tarifaNombre}
                                        onChange={(e) => setCobertura({ ...cobertura, tarifaNombre: e.target.value })}
                                        placeholder="Tarifario"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Orden</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-300"
                                        value={cobertura.ordenNumero}
                                        onChange={(e) => setCobertura({ ...cobertura, ordenNumero: e.target.value })}
                                        placeholder="Autorizacion"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Fecha de orden</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[11px] font-bold text-slate-700 outline-none focus:bg-white focus:border-blue-300"
                                        value={cobertura.ordenFecha}
                                        onChange={(e) => setCobertura({ ...cobertura, ordenFecha: e.target.value })}
                                     max="9999-12-31" min="1900-01-01" />
                                </div>
                                <label className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-[9px] font-black text-slate-500 uppercase tracking-widest md:col-span-3">
                                    <input
                                        type="checkbox"
                                        checked={cobertura.ordenUrgente}
                                        onChange={(e) => setCobertura({ ...cobertura, ordenUrgente: e.target.checked })}
                                        className="accent-blue-600"
                                    />
                                    Orden por urgencia
                                </label>
                            </div>
                        )}
                    </div>
                    <div className="bg-white rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.02)] border border-slate-100 overflow-hidden">
                        
                        {/* Header Table Stylized - Barra superior estilo OralDrive */}
                        <div className="bg-slate-50/70 px-6 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100">
                             <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 bg-sky-50 border border-sky-100 rounded-xl flex items-center justify-center text-sky-600 shadow-xs">
                                      <FiFileText size={15} />
                                  </div>
                                  <div>
                                      <h5 className="text-[11px] font-black text-slate-700 uppercase tracking-widest leading-tight">
                                          {title || "Detalle de Procedimientos & Costos"}
                                      </h5>
                                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                          {items.length} {items.length === 1 ? 'procedimiento' : 'procedimientos'}{selectedForRealizar.size > 0 ? ` · ${selectedForRealizar.size} seleccionado(s) para realizar` : ''}
                                      </p>
                                  </div>
                             </div>

                             {/* Botones de acción estilo OralDrive */}
                             <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                      type="button"
                                      onClick={handleRealizarAction}
                                      className={`px-4 py-2 rounded-full font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer ${
                                          selectedForRealizar.size > 0
                                              ? 'bg-[#00a8e8] hover:bg-[#0092c9] text-white shadow-sky-500/25 ring-2 ring-sky-300 ring-offset-1 animate-pulse'
                                              : 'bg-[#00a8e8] hover:bg-[#0092c9] text-white'
                                      }`}
                                      title={selectedForRealizar.size > 0 ? `Realizar ${selectedForRealizar.size} procedimiento(s) seleccionado(s)` : 'Seleccione uno o más procedimientos (✓) para realizar'}
                                  >
                                      <FiCheck size={14} strokeWidth={3} /> Realizar
                                  </button>

                                  <button
                                      type="button"
                                      onClick={() => setShowProcedureModal(true)}
                                      className="px-4 py-2 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-full font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                                      title="Agregar nuevos procedimientos al plan"
                                  >
                                      <FiPlus size={14} strokeWidth={3} /> Agregar items
                                  </button>

                                  <button
                                      type="button"
                                      onClick={handleOpenOdontoModal}
                                      className="px-4 py-2 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-full font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                                      title="Ver hallazgos del odontograma actual"
                                  >
                                      <FiEye size={14} strokeWidth={2.5} /> Odonto. Actual
                                  </button>
                             </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-white border-b border-slate-100">
                                        <th className="px-3 py-3 text-[9px] font-black text-slate-300 uppercase tracking-widest w-8 text-center">#</th>
                                        {/* Status dot (?) */}
                                        <th className="px-2 py-3 text-[9px] font-black text-slate-300 uppercase tracking-widest w-7 text-center cursor-help" title="Estado del procedimiento">?</th>
                                        {/* Columna Realizar (✓) estilo OralDrive */}
                                        <th className="px-2 py-3 text-[12px] font-black text-sky-500 uppercase tracking-widest w-8 text-center" title="Seleccionar para realizar">
                                            ✓
                                        </th>
                                        {/* Columna Facturar (📄$) */}
                                        <th className="px-2 py-3 w-8 text-center relative group/th cursor-help">
                                            <div className="w-5 h-5 mx-auto rounded border-2 border-slate-200 bg-white flex items-center justify-center">
                                                <FiFileText size={10} className="text-slate-300" />
                                            </div>
                                            {/* Tooltip estilo OralDrive */}
                                            <div className="hidden group-hover/th:block absolute top-full left-0 mt-1 z-50 w-56 bg-slate-800 text-white text-[10px] font-bold rounded-xl p-3 shadow-xl leading-relaxed">
                                                <span className="text-yellow-300">Seleccionar para facturar:</span> Puede seleccionar ítems que hayan sido realizados o aún no hayan sido facturados en su totalidad.
                                            </div>
                                        </th>
                                        <th className="px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Acciones clínicas</th>
                                        <th className="px-2 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center w-12">Ct.</th>
                                        <th className="px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center w-20">Dientes</th>
                                        <th className="px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center w-24">Realizado</th>
                                        <th className="px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center w-28">Observa...</th>
                                        <th className="px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right w-24">Valor unitario</th>
                                        <th className="px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right w-20">Descuento</th>
                                        <th className="px-3 py-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right w-24">Total</th>
                                        <th className="px-3 py-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {items.map((item, index) => {
                                        const itemStatus = getItemStatus(item);
                                        const totalCost = (Number(item.amount || 0) * Number(item.qty || 1)) - Number(item.descuento || 0);
                                        const paidAmt = paidMap[item.id] || 0;
                                        const debtAmt = Math.max(0, totalCost - paidAmt);
                                        const realizedDate = getItemRealizedDate(item.id);
                                        const isRealized = isItemRealized(item.id);
                                        const isConsulta = isItemConsulta(item);

                                        const statusConfig = {
                                            none:    { color: 'bg-slate-300',    ring: 'ring-slate-200',    label: 'Sin realizar',            tooltip: 'Sin realizar y sin pagar' },
                                            debt:    { color: 'bg-rose-500',     ring: 'ring-rose-300',     label: 'Realizado · Con deuda',   tooltip: `Realizado · Con deuda: $${debtAmt.toLocaleString('es-CO')}` },
                                            partial: { color: 'bg-amber-400',    ring: 'ring-amber-300',    label: 'Abono parcial',           tooltip: `Abonado: $${paidAmt.toLocaleString('es-CO')} · Saldo: $${debtAmt.toLocaleString('es-CO')}` },
                                            paid:    { color: 'bg-emerald-500',  ring: 'ring-emerald-300',  label: 'Totalmente pagado',       tooltip: `Totalmente pagado ($${totalCost.toLocaleString('es-CO')})` },
                                        };
                                        const sc = statusConfig[itemStatus] || statusConfig.none;

                                        return (
                                        <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50">
                                            {/* # */}
                                            <td className="px-3 py-2.5 text-[10px] font-black text-slate-300 text-center">{index + 1}</td>
                                            
                                            {/* Status dot (semáforo) */}
                                            <td className="px-2 py-2.5 text-center">
                                                <div
                                                    className={`w-3.5 h-3.5 rounded-full mx-auto ${sc.color} ${itemStatus === 'debt' ? 'animate-pulse' : ''} ring-2 ${sc.ring} ring-offset-1 cursor-help`}
                                                    title={sc.tooltip}
                                                />
                                            </td>

                                            {/* Columna Realizar (✓) estilo OralDrive */}
                                            <td className="px-2 py-2.5 text-center">
                                                {isRealized ? (
                                                    <div
                                                        title={`Procedimiento ya realizado${realizedDate ? ':\n' + realizedDate : ''}`}
                                                        className="w-5 h-5 rounded border border-slate-300 bg-slate-200 text-slate-600 flex items-center justify-center mx-auto shadow-inner cursor-default"
                                                    >
                                                        <FiCheck size={11} strokeWidth={3} />
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleRealizarSelection(item.id)}
                                                        title={selectedForRealizar.has(item.id) ? "Deseleccionar de realizar" : (isConsulta ? "Seleccionar consulta para asociar y marcar realizada" : "Seleccionar procedimiento para realizar")}
                                                        className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-all cursor-pointer ${
                                                            selectedForRealizar.has(item.id)
                                                                ? 'bg-[#00a8e8] border-[#00a8e8] text-white shadow-xs'
                                                                : 'bg-white border-slate-300 hover:border-sky-400 text-transparent'
                                                        }`}
                                                    >
                                                        <FiCheck size={11} strokeWidth={3} />
                                                    </button>
                                                )}
                                            </td>

                                            {/* Checkbox seleccionar para facturar */}
                                            <td className="px-2 py-2.5 text-center">
                                                {(() => {
                                                    // Bloqueado si ya tiene factura emitida (independiente de pagos)
                                                    const yaFacturado = item.facturado === true;

                                                    if (!isRealized) {
                                                        // No realizado: espacio vacío
                                                        return <span className="w-5 h-5 block mx-auto" />;
                                                    }
                                                    if (yaFacturado) {
                                                        // Ya tiene factura: grayed-out bloqueado (igual a OralDrive)
                                                        return (
                                                            <span
                                                                title="Ya tiene factura electrónica emitida"
                                                                className="w-5 h-5 rounded border-2 border-slate-200 bg-slate-100 flex items-center justify-center mx-auto text-slate-300 cursor-not-allowed"
                                                            >
                                                                <FiCheck size={10} strokeWidth={3} />
                                                            </span>
                                                        );
                                                    }
                                                    // Realizado y sin factura: se puede seleccionar
                                                    return (
                                                        <button
                                                            onClick={() => toggleInvoiceSelection(item.id)}
                                                            title={`Seleccionar para facturar — Valor: $${totalCost.toLocaleString('es-CO')}`}
                                                            className={`w-5 h-5 rounded border-2 flex items-center justify-center mx-auto transition-all cursor-pointer ${
                                                                selectedForInvoice.has(item.id)
                                                                    ? 'bg-indigo-500 border-indigo-500 text-white'
                                                                    : 'bg-white border-slate-300 text-transparent hover:border-indigo-400 hover:text-indigo-400'
                                                            }`}
                                                        >
                                                            <FiCheck size={10} strokeWidth={3} />
                                                        </button>
                                                    );
                                                })()}
                                            </td>

                                            {/* Acciones clínicas (Descripción + badges) */}
                                            <td className="px-3 py-2.5 align-middle">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight leading-tight">
                                                        {item.desc || item.nombre}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                                        {(item.codigo_cups || item.code || item.codigo) && (
                                                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200" title={`Código CUPS: ${item.codigo_cups || item.code || item.codigo}`}>
                                                                CUPS: {item.codigo_cups || item.code || item.codigo}
                                                            </span>
                                                        )}
                                                        {item.hallazgo_origen && (
                                                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200" title={`Hallazgo clínico en Odontograma: ${item.hallazgo_origen}`}>
                                                                Hallazgo: {item.hallazgo_origen}
                                                            </span>
                                                        )}
                                                        {item.superficie && item.superficie !== '---' && item.superficie !== 'General' && item.superficie !== 'Pieza Completa' && (
                                                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200" title={`Superficie: ${item.superficie}`}>
                                                                Cara: {item.superficie}
                                                            </span>
                                                        )}
                                                        {isConsulta && (
                                                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
                                                                Consulta {item.codigo_cups ? `· ${item.codigo_cups}` : (item.code ? `· ${item.code}` : '')}
                                                            </span>
                                                        )}
                                                        {item.asocConsultaId && (
                                                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200" title={`Asociada a Doc. Clínico el ${item.asocConsultaFecha || ''}`}>
                                                                ✓ Doc. Clínico Vinculado
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Ct. (Cantidad) */}
                                            <td className="px-2 py-2.5 align-middle text-center">
                                                <input
                                                    type="number"
                                                    disabled={paidMap[item.id] > 0 || isRealized}
                                                    className="w-11 h-8 text-center bg-slate-50 border border-slate-100 rounded outline-none focus:bg-white font-black text-slate-700 text-xs transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                                                    value={item.qty}
                                                    onChange={(e) => updateItem(item.id, 'qty', Number(e.target.value))}
                                                    min="1"
                                                />
                                            </td>

                                            {/* Dientes */}
                                            <td className="px-3 py-2.5 align-middle text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <input
                                                        type="text"
                                                        disabled={paidMap[item.id] > 0 || isRealized}
                                                        className="w-14 h-8 text-center bg-slate-50 border border-slate-100 rounded outline-none focus:bg-white font-black text-slate-500 text-[10px] transition-all uppercase disabled:opacity-75 disabled:cursor-not-allowed"
                                                        value={item.dientes || ""}
                                                        onChange={(e) => updateItem(item.id, 'dientes', e.target.value)}
                                                    />
                                                    {paidMap[item.id] === 0 && !isRealized && (
                                                        <button
                                                            onClick={() => openToothSelector(item)}
                                                            className="text-indigo-400 hover:text-indigo-600 transition-colors"
                                                            title="Seleccionar piezas dentales"
                                                        >
                                                            <FiPlusCircle size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Realizado (Fecha y hora estilo OralDrive) */}
                                            <td className="px-3 py-2.5 align-middle text-center">
                                                {realizedDate ? (
                                                    <span className="text-[9px] font-bold text-slate-700 leading-tight block whitespace-pre-line text-center">
                                                        {realizedDate}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-slate-200 font-bold">—</span>
                                                )}
                                            </td>

                                            {/* Observaciones por fila */}
                                            <td className="px-3 py-2.5 align-middle text-center">
                                                <input
                                                    type="text"
                                                    disabled={isRealized}
                                                    placeholder="-"
                                                    className="w-24 h-8 text-center bg-slate-50 border border-slate-100 rounded outline-none focus:bg-white font-medium text-slate-600 text-[10px] transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                                                    value={item.line_obs || ""}
                                                    onChange={(e) => updateItem(item.id, 'line_obs', e.target.value)}
                                                />
                                            </td>

                                            {/* Valor unitario */}
                                            <td className="px-3 py-2.5 align-middle text-right font-black font-mono text-slate-700 text-xs">
                                                {paidMap[item.id] > 0 || isRealized ? (
                                                    <span>$ {Number(item.amount || 0).toLocaleString('es-CO')}</span>
                                                ) : (
                                                    <div className="flex items-center justify-end gap-1 bg-slate-50 px-2 h-8 rounded border border-slate-100 w-24 ml-auto font-sans">
                                                        <span className="text-slate-300 text-[10px] font-bold">$</span>
                                                        <input
                                                            type="text"
                                                            className="w-full bg-transparent text-right outline-none font-black text-slate-700 text-[11px]"
                                                            value={Number(item.amount || 0) === 0 ? "" : Number(item.amount || 0).toLocaleString('es-CO')}
                                                            onChange={(e) => {
                                                                const cleanVal = e.target.value.replace(/\D/g, '');
                                                                updateItem(item.id, 'amount', cleanVal ? Number(cleanVal) : 0);
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </td>

                                            {/* Descuento */}
                                            <td className="px-3 py-2.5 align-middle text-right font-black font-mono text-rose-500 text-xs">
                                                {(paidMap[item.id] > 0 || isRealized) ? (
                                                    <span>$ {Number(item.descuento || 0).toLocaleString('es-CO')}</span>
                                                ) : (
                                                    <div className="flex items-center justify-end gap-1 bg-rose-50 px-2 h-8 rounded border border-rose-100 w-20 ml-auto font-sans">
                                                        <span className="text-rose-300 text-[10px] font-bold">$</span>
                                                        <input
                                                            type="text"
                                                            className="w-full bg-transparent text-right outline-none font-black text-rose-500 text-[11px]"
                                                            value={Number(item.descuento || 0) === 0 ? "0" : Number(item.descuento || 0).toLocaleString('es-CO')}
                                                            onChange={(e) => {
                                                                const cleanVal = e.target.value.replace(/\D/g, '');
                                                                updateItem(item.id, 'descuento', cleanVal ? Number(cleanVal) : 0);
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </td>

                                            {/* Subtotal / Total fila */}
                                            <td className="px-3 py-2.5 align-middle text-right font-black text-[12px] text-slate-700 font-mono">
                                                <span className="text-[10px] font-bold text-slate-300 mr-0.5">$</span>
                                                {((item.qty * item.amount) - (item.descuento || 0)).toLocaleString('es-CO')}
                                            </td>

                                            {/* Acciones (eliminar) */}
                                            <td className="px-3 py-2.5 align-middle text-center">
                                                {isRealized ? (
                                                    <div
                                                        title="No se puede eliminar: procedimiento ya realizado"
                                                        className="w-7 h-7 rounded flex items-center justify-center text-slate-200 cursor-not-allowed opacity-60 group-hover:opacity-100 mx-auto"
                                                    >
                                                        <FiTrash2 size={14} />
                                                    </div>
                                                ) : paidMap[item.id] === 0 ? (
                                                    <button
                                                        onClick={() => removeItem(item.id)}
                                                        className="w-7 h-7 rounded flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100 mx-auto cursor-pointer"
                                                        title="Eliminar procedimiento"
                                                    >
                                                        <FiTrash2 size={14} />
                                                    </button>
                                                ) : null}
                                            </td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                    {/* Add Button */}
                    <div className="p-6 border-t border-slate-100 bg-slate-50/20 flex flex-col md:flex-row gap-4">
                        <button
                            onClick={() => setShowProcedureModal(true)}
                            className="bg-indigo-600 flex-1 border border-indigo-600 text-white hover:bg-indigo-700 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all hover:shadow-lg shadow-indigo-200 active:scale-95"
                        >
                            <FiPlusCircle size={18} strokeWidth={3} />
                            + Agregar Items / Procedimientos
                        </button>
                        <button
                            onClick={() => setShowPlanesModal(true)}
                            className="bg-white flex-1 border border-dashed border-slate-200 text-slate-400 hover:border-indigo-600 hover:text-indigo-600 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all hover:shadow-lg hover:shadow-indigo-50"
                        >
                            <FiPackage size={18} strokeWidth={3} />
                            Cargar Paquete / Combo Completo
                        </button>
                    </div>

                    {/* Summary Block - estilo OralDrive */}
                    <div className="grid grid-cols-1 md:grid-cols-2 bg-white p-6 gap-8 border-t border-slate-100">
                         <div className="space-y-4">
                              <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                   <FiFileText /> Observaciones Generales
                              </h5>
                              <textarea 
                                  className="w-full h-32 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[12px] font-medium text-slate-600 outline-none focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all resize-none"
                                  placeholder="Escriba aquí los términos, condiciones u observaciones del plan..."
                                  value={obs}
                                  onChange={(e) => {
                                      setObs(e.target.value);
                                      triggerAutoSave(items, title, e.target.value);
                                  }}
                              />
                              <button 
                                onClick={() => handleSave(initialData?.status || 'draft')}
                                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                              >
                                  Guardar Observaciones
                              </button>
                         </div>
                         <div className="flex flex-col justify-center space-y-1.5">
                              {(() => {
                                  const subtotal = calculateSubtotal();
                                  const descuentos = calculateDiscounts();
                                  const total = calculateTotal();
                                  const abono = payments.reduce((s, p) => s + Number(p.monto || 0), 0);
                                  const saldoPendiente = Math.max(0, total - abono);
                                  const saldoFacturado = (items || []).reduce((s, it) => {
                                      // Saldo facturado = valor total de ítems que ya tienen factura emitida
                                      if (isItemRealized(it.id) && it.facturado === true) {
                                          const cost = (Number(it.amount || 0) * Number(it.qty || 1)) - Number(it.descuento || 0);
                                          return s + cost;
                                      }
                                      return s;
                                  }, 0);
                                  const valorAFacturar = (items || []).reduce((s, it) => {
                                      // Valor a facturar = valor total de ítems realizados que aún NO tienen factura
                                      if (isItemRealized(it.id) && it.facturado !== true) {
                                          const cost = (Number(it.amount || 0) * Number(it.qty || 1)) - Number(it.descuento || 0);
                                          return s + cost;
                                      }
                                      return s;
                                  }, 0);
                                  const row = (label, value, cls = 'text-slate-500') => (
                                      <div className="flex justify-between items-center text-[11px] font-bold">
                                          <span className="uppercase tracking-widest text-slate-400">{label}</span>
                                          <span className={`font-mono ${cls}`}>$ {value.toLocaleString('es-CO')}</span>
                                      </div>
                                  );
                                  return (
                                      <>
                                          {row('Subtotal', subtotal)}
                                          {row('Descuentos', descuentos, 'text-rose-400')}
                                          <div className="h-px bg-slate-100 my-1" />
                                          {row('Total', total, 'text-slate-800 font-black text-sm')}
                                          {isPlan && (
                                              <>
                                                  {row('Abono', abono, 'text-emerald-600')}
                                                  <div className="h-px bg-slate-100 my-1" />
                                                  <div className="flex justify-between items-center">
                                                      <span className="text-[11px] uppercase tracking-widest text-slate-400 font-bold">Saldo pendiente</span>
                                                      <span className={`font-mono font-black text-sm ${saldoPendiente > 0 ? 'text-rose-500' : 'text-emerald-600'}`}>
                                                          $ {saldoPendiente.toLocaleString('es-CO')}
                                                      </span>
                                                  </div>
                                                  {row('Saldo facturado', saldoFacturado, 'text-indigo-500')}
                                                  {row('Valor a facturar', valorAFacturar, 'text-amber-600 font-black')}
                                                  {/* Botón Generar Factura - solo aparece cuando hay ítems seleccionados */}
                                                  {selectedForInvoice.size > 0 && (
                                                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                                                          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                              {selectedForInvoice.size} ítem(s) seleccionado(s) para facturar
                                                          </div>
                                                          {!factusCredentials && (
                                                              <div className="flex items-center gap-1.5 text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
                                                                  <FiAlertCircle size={10} />
                                                                  Configura Factus en Configuración → Facturación Electrónica
                                                              </div>
                                                          )}
                                                          <button
                                                              onClick={handleGenerateSelectedInvoice}
                                                              disabled={emittingInvoice}
                                                              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-100"
                                                          >
                                                              {emittingInvoice
                                                                  ? <><FiLoader size={13} className="animate-spin" /> Emitiendo ante DIAN…</>
                                                                  : <><FiSend size={13} /> Emitir Factura DIAN</>
                                                              }
                                                          </button>
                                                      </div>
                                                  )}
                                              </>
                                          )}
                                      </>
                                  );
                              })()}
                         </div>
                    </div>
                </div>
            </div>
        </div>

            {/* Modal de Planes */}
            {showPlanesModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[999] animate-in fade-in p-4">
                    <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden border border-white/40 ring-1 ring-black/5 animate-in zoom-in-95">
                        <div className="bg-slate-50 px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                <FiPackage className="text-indigo-500" /> Seleccionar Paquete / Combo
                            </h3>
                        </div>
                        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            {loadingPlanes ? (
                                <div className="p-10 text-center text-slate-400 font-bold animate-pulse">Cargando paquetes...</div>
                            ) : planes.length === 0 ? (
                                <div className="p-10 text-center text-slate-400 font-bold">No tienes paquetes configurados. Ve a "Configuración - Planes".</div>
                            ) : planes.map(p => (
                                <div key={p.id} onClick={() => cargarCombo(p)} className="flex items-center justify-between p-4 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 rounded-2xl cursor-pointer transition-all group">
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-black text-slate-700 uppercase tracking-tight group-hover:text-indigo-700 transition-colors">{p.nombre}</h4>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.listaNombre || p.listaId}</p>
                                    </div>
                                    <div className="text-indigo-400 group-hover:text-indigo-600 transition-colors">
                                        {loadingPlanItems ? <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> : <FiPlus size={20} />}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-right">
                            <button onClick={() => setShowPlanesModal(false)} className="px-6 py-2 text-xs font-black uppercase text-slate-500 hover:text-slate-700 transition-colors">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Adición de Procedimientos */}
            <ProcedureAdditionModal 
                isOpen={showProcedureModal}
                onClose={handleCloseProcedureModal}
                onAdd={handleModalAdd}
                baseListId={baseListId}
                inquilino={inquilino}
                convenioDescuentos={convenioDescuentos}
                findingContext={activeFindingContext}
                onConfirmFinding={handleConfirmFinding}
                onSkipFinding={handleSkipFinding}
            />
            <ToothSelectorModal 
                isOpen={toothModal.isOpen}
                onClose={() => setToothModal({ ...toothModal, isOpen: false })}
                onSave={handleToothSelection}
                initialValue={toothModal.initialValue}
            />

            {/* Modal de Confirmación de Eliminación Elite */}
            {deleteModal.isOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[10000] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn border border-rose-100">
                        <div className="p-8 text-center">
                            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-6 animate-pulse">
                                <FiTrash2 size={40} />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">
                                {isEditing ? "¿Eliminar Presupuesto?" : "¿Descartar Cambios?"}
                            </h3>
                            <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">
                                {isEditing 
                                    ? `Estás a punto de eliminar "${deleteModal.planName}". Esta acción no se puede deshacer.`
                                    : "Si sales ahora sin guardar, se perderán todos los procedimientos agregados."}
                            </p>
                            
                            <div className="flex flex-col gap-3">
                                <button 
                                    onClick={confirmDelete}
                                    className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-rose-200 hover:bg-rose-700 transition-all active:scale-95"
                                >
                                    {isEditing ? "SÍ, ELIMINAR PERMANENTEMENTE" : "SÍ, DESCARTAR TODO"}
                                </button>
                                <button 
                                    onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                                    className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all text-center"
                                >
                                    NO, CONTINUAR EDITANDO
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmación: Convertir a Plan */}
            {convertModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[10000] flex items-center justify-center p-4">
                    <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn border border-indigo-100">
                        <div className="p-8 text-center">
                            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500 mx-auto mb-6">
                                <FiActivity size={36} />
                            </div>
                            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">
                                ¿Convertir a Plan de Tratamiento?
                            </h3>
                            <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">
                                Este presupuesto se marcará como <strong>Plan de Tratamiento</strong> activo. El cambio es permanente y no se puede revertir desde aquí.
                            </p>
                            <div className="flex flex-col gap-3">
                                <button 
                                    onClick={confirmConvertToPlan}
                                    disabled={loading}
                                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    SÍ, CONVERTIR A PLAN
                                </button>
                                <button 
                                    onClick={() => setConvertModal(false)}
                                    className="w-full py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                                >
                                    CANCELAR
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Odonto. Actual (estilo OralDrive) */}
            {showOdontoModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden animate-fadeIn border border-slate-100 flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50">
                            <div>
                                <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                     🦷 Odonto. Actual
                                </h3>
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-0.5">
                                    Historial de hallazgos del odontograma más reciente para {patient?.nombreCompleto}
                                </p>
                            </div>
                            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                                {/* Segmented Filter Pills */}
                                <div className="flex items-center bg-slate-200/70 p-0.5 rounded-xl text-[10px] font-black uppercase tracking-wider">
                                    <button
                                        type="button"
                                        onClick={() => setOdontoFilterMode("pendientes")}
                                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                                            odontoFilterMode === "pendientes"
                                                ? "bg-white text-emerald-700 shadow-xs"
                                                : "text-slate-500 hover:text-slate-800"
                                        }`}
                                        title="Mostrar únicamente dientes con patologías o tratamientos a realizar"
                                    >
                                        <span className={`w-2 h-2 rounded-full ${pendingOdontoItems.length > 0 ? "bg-emerald-500" : "bg-slate-300"}`} />
                                        Tratamientos pendientes ({pendingOdontoItems.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setOdontoFilterMode("todos")}
                                        className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                                            odontoFilterMode === "todos"
                                                ? "bg-white text-slate-800 shadow-xs"
                                                : "text-slate-500 hover:text-slate-800"
                                        }`}
                                        title="Ver el odontograma completo incluyendo piezas sanas y ausentes"
                                    >
                                        Todos los hallazgos ({odontoItems.length})
                                    </button>
                                </div>
                                <button onClick={() => setShowOdontoModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                                    <FiX size={20} />
                                </button>
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            {odontoLoading ? (
                                <div className="p-10 text-center text-slate-400 font-bold animate-pulse uppercase text-xs tracking-widest">
                                    Cargando odontograma...
                                </div>
                            ) : odontoItems.length === 0 ? (
                                <div className="p-12 text-center text-slate-400 font-medium">
                                    <div className="text-3xl mb-2">🦷</div>
                                    <p className="text-xs uppercase font-black tracking-widest text-slate-400 mb-1">Sin hallazgos registrados</p>
                                    <p className="text-[10px] text-slate-300">Este paciente aún no tiene tratamientos registrados en su odontograma.</p>
                                </div>
                            ) : displayedOdontoItems.length === 0 ? (
                                <div className="p-10 text-center text-slate-500 font-medium bg-emerald-50/60 rounded-xl border border-emerald-100 my-4">
                                    <div className="text-3xl mb-2">🦷✨</div>
                                    <p className="text-xs uppercase font-black tracking-widest text-emerald-800 mb-1">
                                        Sin tratamientos patológicos pendientes
                                    </p>
                                    <p className="text-[11px] text-slate-500 max-w-md mx-auto leading-relaxed">
                                        Todos los {odontoItems.length} registros del odontograma corresponden a piezas sanas, ausentes o restauraciones ya adaptadas (no requieren cotización en presupuesto).
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setOdontoFilterMode("todos")}
                                        className="mt-4 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-xs transition-all cursor-pointer"
                                    >
                                        Ver todos los hallazgos anatómicos ({odontoItems.length})
                                    </button>
                                </div>
                            ) : (
                                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner max-h-[380px] overflow-y-auto">
                                    <table className="w-full text-left table-auto">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200 uppercase text-[9px] font-black text-slate-400 tracking-widest sticky top-0 z-10">
                                                <th className="px-4 py-3.5">Fecha de creación</th>
                                                <th className="px-4 py-3.5">Creado por</th>
                                                <th className="px-4 py-3.5 text-center">Pieza</th>
                                                <th className="px-4 py-3.5">Situación</th>
                                                <th className="px-4 py-3.5">Cara afectada</th>
                                                <th className="px-4 py-3.5 text-right">Acción</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-[11px] font-bold text-slate-600 uppercase">
                                            {displayedOdontoItems.map((item, idx) => {
                                                const isNonPresup = isNonPresupuestable(item.situacion);
                                                return (
                                                    <tr key={idx} className={`hover:bg-slate-50 transition-colors ${isNonPresup ? "opacity-75 bg-slate-50/30" : ""}`}>
                                                        <td className="px-4 py-3 text-slate-500">{item.fecha}</td>
                                                        <td className="px-4 py-3 text-slate-500 font-semibold">{item.creadoPor}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className="inline-flex items-center justify-center w-7 h-7 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg font-black text-[10px]">
                                                                {item.pieza}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-800 font-black">
                                                            <div className="flex items-center gap-2">
                                                                <span>{item.situacion}</span>
                                                                {isNonPresup && (
                                                                    <span className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-slate-100 text-slate-400 border border-slate-200">
                                                                        Anatómico
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-400 font-black text-[10px] tracking-wide">{item.cara || "General"}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            <button
                                                                type="button"
                                                                onClick={() => importSingleOdontoItem(item)}
                                                                className="px-3 py-1.5 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-lg font-black text-[10px] uppercase tracking-wider transition-all shadow-xs active:scale-95 cursor-pointer inline-flex items-center gap-1"
                                                                title="Agregar este tratamiento al presupuesto"
                                                            >
                                                                <FiPlus size={12} strokeWidth={3} /> Agregar
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t border-slate-100 mt-6">
                                <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                                    {displayedOdontoItems.length > 0 && (
                                        <span>
                                            {displayedOdontoItems.length} {odontoFilterMode === "pendientes" ? "tratamiento(s) pendiente(s)" : "hallazgo(s) anatómico(s)"}
                                            {odontoFilterMode === "pendientes" && odontoItems.length > pendingOdontoItems.length && (
                                                <span className="text-slate-400 font-normal lowercase ml-1">
                                                    ({odontoItems.length - pendingOdontoItems.length} sanos/ausentes omitidos)
                                                </span>
                                            )}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                                    {displayedOdontoItems.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={importAllOdontoItems}
                                            className="px-5 py-2.5 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                                        >
                                            <FiPlus size={14} strokeWidth={3} /> Cargar {odontoFilterMode === "pendientes" ? "tratamientos" : "todos"} ({displayedOdontoItems.length})
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowOdontoModal(false)}
                                        className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all active:scale-95 cursor-pointer"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Evolución Clínica (para procedimientos no-consulta) */}
            {showEvolutionModal && (
                <EvolutionModal
                    isOpen={showEvolutionModal}
                    onClose={() => {
                        setShowEvolutionModal(false);
                        setEvolutionInitialData(null);
                    }}
                    onSave={handleEvolutionSaved}
                    patient={patient}
                    initialData={evolutionInitialData}
                />
            )}

            {/* Modal: Asociar Consulta Médica con Doc. Clínicos (estilo OralDrive) */}
            {showAsocConsultaModal && targetConsultaItem && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh] animate-in zoom-in-95">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center shadow-xs">
                                    <FiCheck size={16} strokeWidth={3} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                                        Asociar Consulta Médica (Doc. Clínicos)
                                    </h4>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        Procedimiento del plan: <span className="text-sky-600">{targetConsultaItem.desc}</span>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setShowAsocConsultaModal(false);
                                    setTargetConsultaItem(null);
                                }}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all cursor-pointer"
                            >
                                <FiX size={16} />
                            </button>
                        </div>

                        {/* Banner explicativo y de CUPS */}
                        <div className="px-6 py-3 bg-sky-50/60 border-b border-sky-100/80 flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2">
                                <span className="text-sky-500 font-bold">ℹ️</span>
                                <span className="text-slate-600 text-[11px] font-medium">
                                    Para marcar como realizada esta consulta, selecciónela de las registradas en <strong>Doc. Clínicos</strong>.
                                </span>
                            </div>
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white text-sky-700 border border-sky-200 shadow-xs shrink-0">
                                CUPS: {targetConsultaItem.codigo_cups || targetConsultaItem.code || '890203'}
                            </span>
                        </div>

                        {/* List of Consultations */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                            {loadingConsultas ? (
                                <div className="py-12 text-center text-slate-400 font-bold uppercase text-xs tracking-widest animate-pulse flex flex-col items-center gap-2">
                                    <FiLoader size={20} className="animate-spin text-sky-500" />
                                    <span>Cargando consultas de Doc. Clínicos...</span>
                                </div>
                            ) : consultasList.length === 0 ? (
                                <div className="py-10 text-center space-y-3">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 border border-amber-200 flex items-center justify-center mx-auto text-xl">
                                        📋
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-black text-slate-700 uppercase tracking-wide">
                                            No se encontraron consultas registradas
                                        </p>
                                        <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                                            Este paciente aún no tiene consultas médicas registradas en Doc. Clínicos. Puede registrarla directamente con el botón de abajo.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setNewConsultaInitialData({
                                                cups: targetConsultaItem.codigo_cups || targetConsultaItem.code || '890203',
                                                codigo_cups: targetConsultaItem.codigo_cups || targetConsultaItem.code || '890203',
                                                motivoConsulta: targetConsultaItem.desc || ''
                                            });
                                            setShowNewConsultaModal(true);
                                        }}
                                        className="px-5 py-2.5 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all active:scale-95 inline-flex items-center gap-2 cursor-pointer"
                                    >
                                        <FiPlus size={14} strokeWidth={3} /> Crear Consulta en Doc. Clínicos
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between pb-1">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                            Consultas disponibles en Doc. Clínicos ({consultasList.length})
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setNewConsultaInitialData({
                                                    cups: targetConsultaItem.codigo_cups || targetConsultaItem.code || '890203',
                                                    codigo_cups: targetConsultaItem.codigo_cups || targetConsultaItem.code || '890203',
                                                    motivoConsulta: targetConsultaItem.desc || ''
                                                });
                                                setShowNewConsultaModal(true);
                                            }}
                                            className="text-[10px] font-black uppercase tracking-wider text-[#8CC63F] hover:underline flex items-center gap-1 cursor-pointer"
                                        >
                                            <FiPlus size={12} strokeWidth={3} /> Nueva Consulta
                                        </button>
                                    </div>

                                    <div className="overflow-x-auto rounded-2xl border border-slate-100">
                                        <table className="w-full text-left text-xs">
                                            <thead>
                                                <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                                    <th className="px-4 py-3">Fecha</th>
                                                    <th className="px-4 py-3">Profesional</th>
                                                    <th className="px-4 py-3">Código CUPS</th>
                                                    <th className="px-4 py-3">Diagnóstico / Motivo</th>
                                                    <th className="px-4 py-3 text-right">Acción</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {consultasList.map(c => {
                                                    const targetCups = String(targetConsultaItem.codigo_cups || targetConsultaItem.code || '890203').trim();
                                                    const consultaCupsVal = String(c.cups || c.codigo_cups || c.codigoCups || c.metadata?.cups || c.metadata?.codigo_cups || '890203').trim();
                                                    const cupsMatch = targetCups === consultaCupsVal;
                                                    const dateStr = c.fechaIso || c.created_at || c.date;
                                                    let displayDate = '-';
                                                    try {
                                                        const d = new Date(dateStr);
                                                        if (!isNaN(d.getTime())) {
                                                            displayDate = d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                                                        }
                                                    } catch {}

                                                    const doctorStr = c.profesional || c.doctor || c.metadata?.profesional || c.metadata?.profesionalNombre || c.transcribe || 'Odontólogo';
                                                    const diagStr = c.diagnostico || c.motivoConsulta || c.metadata?.motivoConsulta || c.metadata?.diagnostico || c.titulo || 'Consulta Odontológica';

                                                    return (
                                                        <tr key={c.id} className={`hover:bg-slate-50/70 transition-colors ${cupsMatch ? 'bg-sky-50/30' : ''}`}>
                                                            <td className="px-4 py-3 font-bold text-slate-700 whitespace-nowrap">
                                                                {displayDate}
                                                            </td>
                                                            <td className="px-4 py-3 font-semibold text-slate-600 uppercase text-[11px]">
                                                                {doctorStr}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                                                    cupsMatch 
                                                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                                                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                                                                }`}>
                                                                    {consultaCupsVal} {cupsMatch ? '✓ Coincide' : ''}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 font-medium text-slate-600 max-w-xs truncate text-[11px]" title={diagStr}>
                                                                {diagStr}
                                                            </td>
                                                            <td className="px-4 py-3 text-right">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAssociateConsulta(c)}
                                                                    className="px-3 py-1.5 bg-[#8CC63F] hover:bg-[#7bb335] text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-xs active:scale-95 cursor-pointer inline-flex items-center gap-1"
                                                                    title="Asociar consulta y marcar procedimiento como realizado"
                                                                >
                                                                    <FiCheck size={12} strokeWidth={3} /> Asociar
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => {
                                    setNewConsultaInitialData({
                                        cups: targetConsultaItem.codigo_cups || targetConsultaItem.code || '890203',
                                        codigo_cups: targetConsultaItem.codigo_cups || targetConsultaItem.code || '890203',
                                        motivoConsulta: targetConsultaItem.desc || ''
                                    });
                                    setShowNewConsultaModal(true);
                                }}
                                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer"
                            >
                                <FiPlus size={13} strokeWidth={3} /> + Registrar Nueva Consulta en Doc. Clínicos
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowAsocConsultaModal(false);
                                    setTargetConsultaItem(null);
                                }}
                                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal para Crear Nueva Consulta en Doc. Clínicos */}
            {showNewConsultaModal && (
                <DocClinicoModal
                    isOpen={showNewConsultaModal}
                    onClose={() => {
                        setShowNewConsultaModal(false);
                        setNewConsultaInitialData(null);
                        // Refresh consultations when closing
                        if (targetConsultaItem) {
                            openAsocConsultaModal(targetConsultaItem);
                        }
                    }}
                    patient={patient}
                    docType="Consulta"
                    initialData={newConsultaInitialData}
                />
            )}
        </div>
    );
}
