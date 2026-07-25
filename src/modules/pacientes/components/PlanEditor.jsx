import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../../../context/ToastContext';
import { createPlan, updatePlan, deletePlan } from '../../../services/planService';
import { db } from '../../../firebase/firebaseConfig';
import { doc, getDoc, collection, getDocs, query, where, limit, updateDoc, onSnapshot } from 'firebase/firestore';
import { FiSearch, FiTrash2, FiPlus, FiCheck, FiX, FiInfo, FiActivity, FiDollarSign, FiChevronLeft, FiPlusCircle, FiPackage, FiFileText, FiPrinter, FiPlusSquare, FiSave, FiAlertCircle, FiLoader, FiSend, FiEye } from 'react-icons/fi';
import { useFormContext } from 'react-hook-form';
import { useAuth } from '../../../context/AuthContext';
import ProcedureAdditionModal from './ProcedureAdditionModal';
import ToothSelectorModal from './ToothSelectorModal';
import { BudgetPrintService } from '../../../services/BudgetPrintService';
import factusService from '../../../services/factusService';

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

    // Load Factus credentials from tenant
    useEffect(() => {
        if (!inquilino) return;
        (async () => {
            try {
                const snap = await getDoc(doc(db, 'tenants', inquilino));
                if (snap.exists()) {
                    const d = snap.data();
                    if (d.factusClientId && d.factusClientSecret) {
                        setFactusCredentials({
                            factusClientId:         d.factusClientId,
                            factusClientSecret:     d.factusClientSecret,
                            username:               d.factusUsername,
                            password:               d.factusPassword,
                            factusTestMode:         d.factusTestMode !== undefined ? d.factusTestMode : true,
                            factusNumberingRangeId: d.factusNumberingRangeId || null,
                        });
                    }
                }
            } catch (e) { console.error('Error loading Factus credentials:', e); }
        })();
    }, [inquilino]);

    useEffect(() => {
        const fetchPlanes = async () => {
            if (!inquilino) return;
            setLoadingPlanes(true);
            try {
                const snap = await getDocs(query(
                    collection(db, "planes"),
                    where("inquilino", "==", inquilino)
                ));
                const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                data.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
                setPlanes(data);
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

        // Real-time listener so that when an evolution is saved/updated,
        // isItemRealized() reflects the change immediately without a page reload.
        const evoQuery = query(
            collection(db, "clinical_evolutions"),
            where("patientId", "==", patientId)
        );
        const unsubscribeEvo = onSnapshot(evoQuery, (snap) => {
            setEvolutions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (err) => {
            console.error("Error listening to clinical evolutions:", err);
        });

        // Payments are less time-critical — a one-time fetch is fine
        const fetchPayments = async () => {
            if (!currentPlanId) return;
            try {
                const paySnap = await getDocs(query(
                    collection(db, "pagos"),
                    where("patientId", "==", patientId),
                    where("planId", "==", currentPlanId)
                ));
                setPayments(paySnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.estado !== "Anulado"));
            } catch (err) {
                console.error("Error fetching payments for plan editor:", err);
            }
        };
        fetchPayments();

        return () => unsubscribeEvo();
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
        // 1. Check direct fechaRealizado on item itself
        const itemDirectly = items.find(i => i.id === itemId);
        if (itemDirectly?.realizado && itemDirectly?.fechaRealizado) {
            try {
                const d = new Date(itemDirectly.fechaRealizado);
                return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
            } catch { /* fall through */ }
        }
        // 2. Check clinical evolutions
        const evo = evolutions.find(e =>
            e.planId === currentPlanId &&
            (e.plantillaItems?.[itemId]?.realizado === true ||
             (e.plantillaItems?.[itemId]?.realizado === undefined && e.plantillaItems?.[itemId]?.checked === true))
        );
        if (!evo) return null;
        try {
            const d = evo.date?.toDate ? evo.date.toDate() : new Date(evo.date);
            return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch { return null; }
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

    const handleGenerateSelectedInvoice = async () => {
        if (selectedForInvoice.size === 0) return;
        if (!currentPlanId) {
            toast.error('Guarda el plan antes de generar la factura.');
            return;
        }

        const selectedItems = items.filter(it => selectedForInvoice.has(it.id));

        // Bloqueo: no se puede facturar un ítem que ya tiene factura emitida
        const yaFacturados = selectedItems.filter(it => it.facturado === true);
        if (yaFacturados.length > 0) {
            toast.error(`❌ ${yaFacturados.length} procedimiento(s) ya tienen factura emitida.`);
            setSelectedForInvoice(new Set());
            return;
        }

        if (!factusCredentials) {
            // Try centralized credentials
            const { getFactusAdminCredentials } = await import('../../../services/factusAdminService');
            const adminCreds = await getFactusAdminCredentials();
            if (!adminCreds) {
                toast.error('La facturación electrónica no está configurada. Contacta al administrador del sistema.');
                return;
            }
        }
        if (!patient?.nroDocumento && !patient?.documento && !patient?.identificacion) {
            toast.error('El paciente debe tener número de documento registrado para facturar ante la DIAN.');
            return;
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
            const { addDoc, updateDoc: updDoc, doc: docRef } = await import('firebase/firestore');

            // Build the invoice document
            const invoiceItems = selectedItems.map(it => {
                const totalCost = (Number(it.amount || 0) * Number(it.qty || 1)) - Number(it.descuento || 0);
                return {
                    itemId:      it.id,
                    nombre:      it.desc || 'Servicio Dental',
                    descripcion: it.desc || 'Servicio Dental',
                    precio:      Number(it.amount || 0),
                    precioUnitario: Number(it.amount || 0),
                    cantidad:    Number(it.qty || 1),
                    descuento:   Number(it.descuento || 0),
                    totalLinea:  totalCost
                };
            });

            const invoiceData = {
                patientId,
                inquilino:  inquilino || '',
                planId:     currentPlanId,
                nroFactura: `FE-${Math.floor(1000 + Math.random() * 9000)}`,
                fechaISO:   new Date().toISOString(),
                total:      totalFactura,
                medioPago:  '10', // Efectivo por defecto; se puede cambiar
                condicionPago: '1',
                estado:     'Pendiente',
                factusEstado: 'Pendiente',
                profesional: initialData?.profesionalId || initialData?.profesional || userProfile?.nombreCompleto || 'Profesional',
                items:      invoiceItems,
            };

            // 1️⃣ Save to Firestore first (so we don't lose it if Factus fails)
            const invoiceRef = await addDoc(collection(db, 'facturas'), invoiceData);

            // 2️⃣ Mark plan items as invoiced immediately
            const updatedItems = items.map(it =>
                selectedForInvoice.has(it.id)
                    ? { ...it, facturado: true, fechaFacturado: new Date().toISOString() }
                    : it
            );
            await updDoc(docRef(db, 'treatment_plans', currentPlanId), { items: updatedItems });
            setItems(updatedItems);

            // 3️⃣ Emit to DIAN via Factus
            try {
                toast.info('Emitiendo factura ante la DIAN…');
                // Build a patient-compatible object for factusService
                const patientForFactus = {
                    ...patient,
                    documento:      patient?.nroDocumento || patient?.documento || patient?.identificacion,
                    identificacion: patient?.nroDocumento || patient?.documento || patient?.identificacion,
                    nombre:         patient?.nombres || patient?.nombre || (patient?.nombreCompleto || '').split(' ')[0] || 'Cliente',
                    apellido:       patient?.apellidos || patient?.apellido || (patient?.nombreCompleto || '').split(' ').slice(1).join(' ') || 'OdontoCloud',
                    email:          patient?.email || patient?.correo || 'sin.email@odontocloud.com',
                    telefono:       patient?.celular || patient?.telefono || '3000000000',
                    direccion:      patient?.direccion || 'Dirección no registrada',
                    ciudad:         patient?.ciudad || '',
                };

                const result = await factusService.sendInvoice(
                    { ...invoiceData, id: invoiceRef.id },
                    patientForFactus,
                    factusCredentials
                );

                const bill = result?.data?.bill || result?.bill || result?.data || {};
                const updates = {
                    factusEstado:      'Emitido',
                    estado:            'Emitido',
                    factusUuid:        bill?.uuid    || result?.data?.uuid    || null,
                    factusNumero:      bill?.number  || bill?.invoice_number  || result?.data?.number || null,
                    factusPdfUrl:      bill?.pdf_download_url || bill?.pdf   || result?.data?.pdf_download_url || null,
                    factusQr:          bill?.qr_code || bill?.qr             || result?.data?.qr_code || null,
                    factusCufe:        bill?.cufe    || bill?.cude            || result?.data?.cufe   || null,
                    nroFactura:        bill?.number  || bill?.invoice_number  || result?.data?.number || invoiceData.nroFactura,
                    factusRawResponse: result?.data  || null,
                };
                await updDoc(invoiceRef, updates);

                // ── Consumir una factura de la cuota del tenant ──
                try {
                    const { consumeOneInvoice } = await import('../../../services/factusAdminService');
                    await consumeOneInvoice(inquilino);
                } catch (e) {
                    console.warn('Could not decrement invoice quota:', e.message);
                }

                toast.success(`✅ Factura emitida ante la DIAN.${ updates.nroFactura ? ` N.º: ${updates.nroFactura}` : '' }`);
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
            const snap = await getDocs(collection(db, "planes", plan.id, "planes_items"));
            const planItems = snap.docs.map(d => d.data());
            
            if (planItems.length === 0) {
                toast.error("Este plan no tiene ítems configurados.");
                return;
            }

            // Inyectar al presupuesto
            const newItems = planItems.map(it => ({
                id: Math.random().toString(36).substr(2, 9),
                code: it.codigo || "",
                desc: it.nombre || "",
                amount: Number(it.precio || 0),
                qty: Number(it.cantidad || 1),
                descuento: Number(it.descuento || 0),
                dientes: it.dientes || "",
                line_obs: it.line_obs || "",
                permite_descuento: it.permite_descuento !== undefined ? it.permite_descuento : true,
                max_desc: it.max_desc !== undefined ? Number(it.max_desc) : 100
            }));

            const nextItems = [...items, ...newItems];
            setItems(nextItems);
            setShowPlanesModal(false);
            toast.success(`Combo "${plan.nombre}" cargado!`);
            triggerAutoSave(nextItems);
        } catch (e) {
            console.error(e);
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

    const handleOpenOdontoModal = async () => {
        if (!patientId) {
            toast.error("Error: ID de paciente no disponible.");
            return;
        }
        setShowOdontoModal(true);
        setOdontoLoading(true);
        try {
            const { collection, getDocs, query, orderBy } = await import("firebase/firestore");
            const colRef = collection(db, "pacientes", patientId, "odontogramas");
            const snap = await getDocs(query(colRef, orderBy("creado", "desc")));
            
            const list = [];
            snap.docs.forEach(doc => {
                const s = doc.data();
                const creadoDate = s.creado?.toDate ? s.creado.toDate() : s.creado ? new Date(s.creado) : null;
                const formattedDate = creadoDate 
                    ? creadoDate.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) 
                    : "---";
                const creadoPor = s.creadoPor || s.profesional || "---";

                if (s.plan && Array.isArray(s.plan)) {
                    s.plan.forEach(item => {
                        list.push({
                            id: doc.id,
                            fecha: formattedDate,
                            creadoPor: creadoPor,
                            pieza: item.diente || item.tooth || "---",
                            situacion: item.tratamiento || item.label || "---",
                            cara: item.cara || item.surface || "---"
                        });
                    });
                }
            });
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
            const currentInquilino = inquilino || patient?.inquilino;
            if (!currentInquilino) return;
            try {
                const q = query(collection(db, "listas_precios"), where("inquilino", "==", currentInquilino));
                const snap = await getDocs(q);
                setAllPriceLists(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (e) { console.error(e); }
        };
        fetchAllLists();
    }, [inquilino, patient?.inquilino]);

    useEffect(() => {
        const fetchInitialBaseList = async () => {
            const currentInquilino = inquilino || patient?.inquilino;
            if (!currentInquilino) return;
            
            try {
                // SI EL PACIENTE TIENE CONVENIO: Cargar descuentos y usar su lista de precios
                if (patient?.convenioBeneficio) {
                    const qConv = query(
                        collection(db, "convenios"),
                        where("inquilino", "==", currentInquilino),
                        where("nombre", "==", patient.convenioBeneficio.trim()),
                        where("activo", "==", true),
                        limit(1)
                    );
                    const convSnap = await getDocs(qConv);
                    if (!convSnap.empty) {
                        const convenioDoc = convSnap.docs[0];
                        const convData = convenioDoc.data();
                        
                        // Cargar los descuentos asociados a este convenio
                        const descSnap = await getDocs(collection(db, "convenios", convenioDoc.id, "descuentos"));
                        const descMap = {};
                        descSnap.docs.forEach(d => {
                            descMap[d.id] = d.data();
                        });
                        setConvenioDescuentos(descMap);

                        // Si no hay lista pre-establecida en initialData, usamos la del convenio
                        if (!initialData?.baseListId && convData.listaPreciosId) {
                            setBaseListId(convData.listaPreciosId);
                            const listSnap = await getDoc(doc(db, "listas_precios", convData.listaPreciosId));
                            if (listSnap.exists()) setBaseListName(listSnap.data().nombre);
                            return;
                        }
                    }
                }

                // PRIMERO: Intentar por el plan actual (si ya tiene uno guardado)
                if (initialData?.baseListId) {
                    setBaseListId(initialData.baseListId);
                    const listSnap = await getDoc(doc(db, "listas_precios", initialData.baseListId));
                    if(listSnap.exists()) setBaseListName(listSnap.data().nombre);
                    return;
                }

                // SEGUNDO: Intentar por el plan asignado al paciente
                if (patient?.planId) {
                    const planSnap = await getDoc(doc(db, "planes", patient.planId));
                    if (planSnap.exists() && planSnap.data().baseListId) {
                        const bId = planSnap.data().baseListId;
                        setBaseListId(bId);
                        const listSnap = await getDoc(doc(db, "listas_precios", bId));
                        if(listSnap.exists()) setBaseListName(listSnap.data().nombre);
                        return;
                    }
                }

                // TERCERO: Fallback - Buscar la lista marcada como "en_uso"
                const q = query(
                    collection(db, "listas_precios"),
                    where("inquilino", "==", currentInquilino),
                    where("en_uso", "==", true),
                    limit(1)
                );
                const activeListSnap = await getDocs(q);
                if (!activeListSnap.empty) {
                    const docData = activeListSnap.docs[0].data();
                    setBaseListId(activeListSnap.docs[0].id);
                    setBaseListName(docData.nombre);
                } else {
                    // CUARTO: Fallback final - Cualquier lista del inquilino
                    const qAll = query(
                        collection(db, "listas_precios"),
                        where("inquilino", "==", currentInquilino),
                        limit(1)
                    );
                    const anyListSnap = await getDocs(qAll);
                    if (!anyListSnap.empty) {
                        const docData = anyListSnap.docs[0].data();
                        setBaseListId(anyListSnap.docs[0].id);
                        setBaseListName(docData.nombre);
                    }
                }
            } catch (e) {
                console.error("Error fetching price list context:", e);
            }
        };
        fetchInitialBaseList();
    }, [patient?.planId, inquilino, patient?.inquilino, initialData?.baseListId, patient?.convenioBeneficio]);

    const handleListChange = async (e) => {
        const id = e.target.value;
        setBaseListId(id);
        const selected = allPriceLists.find(l => l.id === id);
        if (selected) setBaseListName(selected.nombre);
        toast.info(`Tarifario cambiado a: ${selected?.nombre}`);
    };

    const handleItemSearch = async (id, term) => {
        updateItem(id, 'desc', term);
        if (!baseListId || term.length < 1) { // Reducido a 1 carácter
            setSearchResults([]);
            setShowResults(false);
            return;
        }

        setSearchLoading(true);
        setActiveSearchId(id);
        setShowResults(true);
        try {
            const q = query(
                collection(db, "listas_precios", baseListId, "items"),
                where("search_name", ">=", term.toLowerCase()),
                where("search_name", "<=", term.toLowerCase() + "\uf8ff"),
                limit(10)
            );
            const snap = await getDocs(q);
            setSearchResults(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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

            if (currentPlanId) {
                // Plan ya guardado: actualizar tipo a 'plan'
                await updatePlan(currentPlanId, planPayload);
            } else {
                // Plan nuevo (sin ID aún): crear directamente como plan de tratamiento
                const saved = await createPlan(planPayload);
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
                                <FiActivity className="text-indigo-600" /> Plan de Tratamiento
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
                    {hasPayments && (
                        <div className="bg-amber-50 border border-amber-100 rounded-3xl p-5 flex items-center gap-4 text-amber-800 shrink-0 animate-fadeIn shadow-sm">
                            <FiAlertCircle size={24} className="text-amber-500 shrink-0" />
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-widest leading-none text-amber-600 mb-1">Modificación Protegida</p>
                                <p className="text-[10px] font-bold text-amber-500/80 uppercase tracking-wider leading-normal">
                                    Este plan de tratamiento tiene pagos registrados. Los tratamientos ya pagados o abonados no pueden modificarse ni eliminarse. Sin embargo, puede agregar nuevos tratamientos a este plan.
                                </p>
                            </div>
                        </div>
                    )}
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
                                    />
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
                        
                        {/* Header Table Stylized */}
                        <div className="bg-slate-50/50 px-6 py-4 flex items-center justify-between border-b border-slate-100">
                             <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-400">
                                      <FiFileText size={14} />
                                  </div>
                                  <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Detalle de Procedimientos & Costos</h5>
                             </div>
                        </div>

                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-white border-b border-slate-50">
                                    <th className="px-3 py-3 text-[9px] font-black text-slate-300 uppercase tracking-widest w-8 text-center">#</th>
                                    <th className="px-2 py-3 text-[9px] font-black text-slate-300 uppercase tracking-widest w-8 text-center"></th>
                                    <th className="px-2 py-3 w-8 text-center relative group/th cursor-help">
                                        <div className="w-5 h-5 mx-auto rounded border-2 border-slate-200 bg-white flex items-center justify-center">
                                            <FiFileText size={10} className="text-slate-300" />
                                        </div>
                                        {/* Tooltip estilo OralDrive */}
                                        <div className="hidden group-hover/th:block absolute top-full left-0 mt-1 z-50 w-56 bg-slate-800 text-white text-[10px] font-bold rounded-xl p-3 shadow-xl leading-relaxed">
                                            <span className="text-yellow-300">Seleccionar para facturar:</span> Puede seleccionar ítems que hayan sido realizados o aún no hayan sido facturados en su totalidad.
                                        </div>
                                    </th>
                                    <th className="px-3 py-3 text-[9px] font-black text-slate-300 uppercase tracking-widest">Procedimiento</th>
                                    <th className="px-3 py-3 text-[9px] font-black text-slate-300 uppercase tracking-widest text-center w-20">Dientes</th>
                                    <th className="px-3 py-3 text-[9px] font-black text-slate-300 uppercase tracking-widest text-center w-24">Realizado</th>
                                    <th className="px-3 py-3 text-[9px] font-black text-slate-300 uppercase tracking-widest text-center w-14">Cant.</th>
                                    <th className="px-3 py-3 text-[9px] font-black text-slate-300 uppercase tracking-widest text-right w-28">Valor Unit.</th>
                                    <th className="px-3 py-3 text-[9px] font-black text-slate-300 uppercase tracking-widest text-right w-24">Desc.</th>
                                    <th className="px-3 py-3 text-[9px] font-black text-slate-300 uppercase tracking-widest text-right w-28">Sub</th>
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

                                    const statusConfig = {
                                        none:    { color: 'bg-slate-200',    ring: 'ring-slate-300',    label: 'Sin realizar',            tooltip: 'Este procedimiento aún no ha sido realizado.' },
                                        debt:    { color: 'bg-rose-500',     ring: 'ring-rose-300',     label: 'Realizado · Sin pagar',   tooltip: `Realizado${realizedDate ? ' el ' + realizedDate : ''} · Deuda total: $${totalCost.toLocaleString('es-CO')}` },
                                        partial: { color: 'bg-amber-400',    ring: 'ring-amber-300',    label: 'Realizado · Abono parcial', tooltip: `Realizado${realizedDate ? ' el ' + realizedDate : ''} · Abonado: $${paidAmt.toLocaleString('es-CO')} / $${totalCost.toLocaleString('es-CO')} · Saldo: $${debtAmt.toLocaleString('es-CO')}` },
                                        paid:    { color: 'bg-emerald-500',  ring: 'ring-emerald-300',  label: 'Realizado · Pagado',       tooltip: `Realizado${realizedDate ? ' el ' + realizedDate : ''} · Pagado en su totalidad` },
                                    };
                                    const sc = statusConfig[itemStatus];

                                    return (
                                    <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50">
                                        {/* # */}
                                        <td className="px-3 py-2.5 text-[10px] font-black text-slate-300 text-center">{index + 1}</td>
                                        {/* Status dot */}
                                        <td className="px-2 py-2.5 text-center">
                                            <div
                                                className={`w-3.5 h-3.5 rounded-full mx-auto ${sc.color} ${itemStatus === 'debt' ? 'animate-pulse' : ''} ring-2 ${sc.ring} ring-offset-1 cursor-help`}
                                                title={sc.tooltip}
                                            />
                                        </td>
                                        {/* Checkbox seleccionar para facturar */}
                                        <td className="px-2 py-2.5 text-center">
                                            {(() => {
                                                const realized = isItemRealized(item.id);
                                                // Bloqueado si ya tiene factura emitida (independiente de pagos)
                                                const yaFacturado = item.facturado === true;

                                                if (!realized) {
                                                    // No realizado: espacio vacío
                                                    return <span className="w-6 h-6 block mx-auto" />;
                                                }
                                                if (yaFacturado) {
                                                    // Ya tiene factura: grayed-out bloqueado (igual a OralDrive)
                                                    return (
                                                        <span
                                                            title="Ya tiene factura electrónica emitida"
                                                            className="w-6 h-6 rounded border-2 border-slate-200 bg-slate-100 flex items-center justify-center mx-auto text-slate-300 cursor-not-allowed"
                                                        >
                                                            <FiCheck size={11} strokeWidth={3} />
                                                        </span>
                                                    );
                                                }
                                                // Realizado y sin factura: se puede seleccionar
                                                return (
                                                    <button
                                                        onClick={() => toggleInvoiceSelection(item.id)}
                                                        title={`Seleccionar para facturar — Valor: $${totalCost.toLocaleString('es-CO')}`}
                                                        className={`w-6 h-6 rounded border-2 flex items-center justify-center mx-auto transition-all ${
                                                            selectedForInvoice.has(item.id)
                                                                ? 'bg-indigo-500 border-indigo-500 text-white'
                                                                : 'bg-white border-slate-300 text-transparent hover:border-indigo-400 hover:text-indigo-400'
                                                        }`}
                                                    >
                                                        <FiCheck size={11} strokeWidth={3} />
                                                    </button>
                                                );
                                            })()}
                                        </td>
                                        {/* Descripción del procedimiento */}
                                        <td className="px-3 py-2.5 align-middle">
                                            <div className="text-[11px] font-black text-slate-800 uppercase tracking-tight leading-tight">
                                                {item.code && <span className="text-indigo-400 mr-1.5 text-[9px] font-mono">{item.code}</span>}
                                                {item.desc}
                                            </div>
                                        </td>
                                        {/* Dientes */}
                                        <td className="px-3 py-2.5 align-middle text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <input
                                                    type="text"
                                                    disabled={paidMap[item.id] > 0}
                                                    className="w-14 h-8 text-center bg-slate-50 border border-slate-100 rounded outline-none focus:bg-white font-black text-slate-500 text-[10px] transition-all uppercase disabled:opacity-75 disabled:cursor-not-allowed"
                                                    value={item.dientes || ""}
                                                    onChange={(e) => updateItem(item.id, 'dientes', e.target.value)}
                                                />
                                                {paidMap[item.id] === 0 && (
                                                    <button
                                                        onClick={() => openToothSelector(item)}
                                                        className="text-indigo-400 hover:text-indigo-600 transition-colors"
                                                    >
                                                        <FiPlusCircle size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        {/* Fecha realizado */}
                                        <td className="px-3 py-2.5 align-middle text-center">
                                            {realizedDate ? (
                                                <span className="text-[9px] font-bold text-emerald-600 leading-none">{realizedDate}</span>
                                            ) : (
                                                <span className="text-[9px] text-slate-200 font-bold">—</span>
                                            )}
                                        </td>
                                        {/* Cantidad */}
                                        <td className="px-3 py-2.5 align-middle text-center">
                                            <input
                                                type="number"
                                                disabled={paidMap[item.id] > 0}
                                                className="w-11 h-8 text-center bg-slate-50 border border-slate-100 rounded outline-none focus:bg-white font-black text-slate-700 text-xs transition-all disabled:opacity-75 disabled:cursor-not-allowed"
                                                value={item.qty}
                                                onChange={(e) => updateItem(item.id, 'qty', Number(e.target.value))}
                                                min="1"
                                            />
                                        </td>
                                        {/* Valor unitario */}
                                        <td className="px-3 py-2.5 align-middle text-right font-black font-mono text-slate-700 text-xs">
                                            {paidMap[item.id] > 0 ? (
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
                                            {(paidMap[item.id] > 0 || isItemRealized(item.id)) ? (
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
                                        {/* Subtotal fila */}
                                        <td className="px-3 py-2.5 align-middle text-right font-black text-[12px] text-slate-700 font-mono">
                                            <span className="text-[10px] font-bold text-slate-300 mr-0.5">$</span>
                                            {((item.qty * item.amount) - (item.descuento || 0)).toLocaleString('es-CO')}
                                        </td>
                                        {/* Acciones (eliminar) */}
                                        <td className="px-3 py-2.5 align-middle text-center">
                                            {isItemRealized(item.id) ? (
                                                <div
                                                    title="No se puede eliminar: procedimiento ya realizado"
                                                    className="w-7 h-7 rounded flex items-center justify-center text-slate-200 cursor-not-allowed opacity-60 group-hover:opacity-100 mx-auto"
                                                >
                                                    <FiTrash2 size={14} />
                                                </div>
                                            ) : paidMap[item.id] === 0 ? (
                                                <button
                                                    onClick={() => removeItem(item.id)}
                                                    className="w-7 h-7 rounded flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all opacity-0 group-hover:opacity-100 mx-auto"
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
                        <button
                            onClick={handleOpenOdontoModal}
                            className="bg-[#8CC63F]/10 border border-[#8CC63F]/20 text-[#8CC63F] hover:bg-[#8CC63F] hover:text-white py-3.5 px-6 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-3 transition-all hover:shadow-lg active:scale-95 whitespace-nowrap"
                        >
                            <FiEye size={18} strokeWidth={3} />
                            Odonto. Actual
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
                onClose={() => setShowProcedureModal(false)}
                onAdd={handleModalAdd}
                baseListId={baseListId}
                inquilino={inquilino}
                convenioDescuentos={convenioDescuentos}
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
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden animate-fadeIn border border-slate-100">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                     🦷 Odonto. Actual
                                </h3>
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mt-1">
                                    Historial de hallazgos del odontograma más reciente para {patient?.nombreCompleto}
                                </p>
                            </div>
                            <button onClick={() => setShowOdontoModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <FiX size={20} />
                            </button>
                        </div>
                        <div className="p-6">
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
                            ) : (
                                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner max-h-[400px] overflow-y-auto">
                                    <table className="w-full text-left table-auto">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200 uppercase text-[9px] font-black text-slate-400 tracking-widest">
                                                <th className="px-4 py-3.5">Fecha de creación</th>
                                                <th className="px-4 py-3.5">Creado por</th>
                                                <th className="px-4 py-3.5 text-center">Pieza</th>
                                                <th className="px-4 py-3.5">Situación</th>
                                                <th className="px-4 py-3.5">Cara afectada</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-[11px] font-bold text-slate-600 uppercase">
                                            {odontoItems.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-3 text-slate-500">{item.fecha}</td>
                                                    <td className="px-4 py-3 text-slate-500 font-semibold">{item.creadoPor}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className="inline-flex items-center justify-center w-7 h-7 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-lg font-black text-[10px]">
                                                            {item.pieza}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-800 font-black">{item.situacion}</td>
                                                    <td className="px-4 py-3 text-slate-400 font-black text-[10px] tracking-wide">{item.cara || "General"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            
                            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 mt-6">
                                <button
                                    onClick={() => setShowOdontoModal(false)}
                                    className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-all active:scale-95"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
