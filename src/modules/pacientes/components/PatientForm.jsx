import React, { useState, useEffect, useMemo } from "react";
import {
    FiUser, FiCamera, FiMapPin, FiPhone, FiActivity, FiShield,
    FiX, FiCheck, FiTrash2, FiMail, FiCalendar, FiGlobe,
    FiTag, FiPlus, FiClock, FiBriefcase, FiAlertCircle, FiChevronRight, FiHome,
    FiDollarSign, FiUsers, FiTrendingUp, FiSearch, FiFileText
} from "react-icons/fi";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import supabase from "../../../lib/supabaseClient";
import { useToast } from "../../../context/ToastContext";
import { useAuth } from "../../../context/AuthContext";
import { patientSchema } from "../schemas/patientSchema";
import { 
    TIPOS_DOCUMENTO, PAISES, PREFIJOS_TELEFONICOS, TIPOS_VINCULACION,
    SEXOS, ESTADOS_CIVILES, ESTRATOS, ZONAS_RESIDENCIALES, PARENTESCOS, MEDIOS_CONOCIMIENTO
} from "../constants/patientConstants";
import { fetchCitiesForCountry, CIUDADES_COLOMBIA } from "../services/geoService";
import SearchableSelect from "../../../components/ui/SearchableSelect";

const FormRow = ({ label, required, children, error, helpText, className = "" }) => (
    <div className={`flex flex-col gap-1.5 ${className}`}>
        {label && (
            <label className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 ${error ? 'text-rose-500' : 'text-slate-600'}`}>
                {label} {required && <span className="text-rose-500">*</span>}
            </label>
        )}
        <div className="w-full relative">
            {children}
            {error && <p className="text-rose-500 text-[10px] font-bold uppercase tracking-wider mt-0.5">{error.message}</p>}
            {helpText && !error && <p className="text-slate-400 text-[10px] font-medium mt-0.5 uppercase tracking-widest">{helpText}</p>}
        </div>
    </div>
);

const SectionTitle = ({ title, num }) => (
    <div className="flex items-center gap-3 border-b border-slate-100 pb-3 mb-2">
        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-black shrink-0">{num}</div>
        <h3 className="text-[13px] font-bold text-slate-800 uppercase tracking-wide">{title}</h3>
    </div>
);

const normalizeTipoDocumento = (tipo) => {
    if (!tipo) return "";
    const mapping = {
        "CC": "Cédula de ciudadanía",
        "TI": "Tarjeta de identidad",
        "RC": "Registro civil de nacimiento",
        "CE": "Cédula de extranjería",
        "PA": "Pasaporte",
        "PE": "Permiso por protección temporal",
        "PEP": "PEP"
    };
    return mapping[tipo] || tipo;
};

export default function PatientForm({
    initialData,
    onSubmit,
    onCancel,
    onDelete
}) {
    const toast = useToast();
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;

    const [planes, setPlanes] = useState([]);
    const [profesionales, setProfesionales] = useState([]);
    const [sucursales, setSucursales] = useState([]);
    const [epsList, setEpsList] = useState([]);
    const [barrioList, setBarrioList] = useState([]);
    const [conveniosList, setConveniosList] = useState([]);
    const [loadingPlanes, setLoadingPlanes] = useState(false);
    const [loadingProfesionales, setLoadingProfesionales] = useState(false);
    const [loadingEps, setLoadingEps] = useState(false);
    const [loadingBarrios, setLoadingBarrios] = useState(false);
    const [showEpsSuggestions, setShowEpsSuggestions] = useState(false);
    const [showBarrioSuggestions, setShowBarrioSuggestions] = useState(false);
    const [showPrefijoDrop, setShowPrefijoDrop] = useState(false);
    const [prefijoSearch, setPrefijoSearch] = useState("");
    const [fotoFile, setFotoFile] = useState(null);
    const [fotoPreview, setFotoPreview] = useState(initialData?.fotoUrl || "");
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [cameraStream, setCameraStream] = useState(null);
    // Datos para campo "Remitido por"
    const [usuariosRemision, setUsuariosRemision] = useState([]);
    const [pacientesRemision, setPacientesRemision] = useState([]);
    const videoRef = React.useRef(null);
    const canvasRef = React.useRef(null);

    const [formConfig, setFormConfig] = useState(null);

    // States for dynamic cities list based on selected country
    const [ciudadesNacimiento, setCiudadesNacimiento] = useState([]);
    const [ciudadesDomicilio, setCiudadesDomicilio] = useState([]);
    const [loadingCiudadesNacimiento, setLoadingCiudadesNacimiento] = useState(false);
    const [loadingCiudadesDomicilio, setLoadingCiudadesDomicilio] = useState(false);

    const initialNacimientoRef = React.useRef(true);
    const initialDomicilioRef = React.useRef(true);

    useEffect(() => {
        const loadFormConfig = async () => {
            if (!inquilino) return;
            try {
                const { configuracionFormulariosService } = await import("../../../services/supabaseServices");
                const config = await configuracionFormulariosService.get(inquilino, "formulario_pacientes");
                if (config) {
                    setFormConfig(config);
                }
            } catch (e) {
                console.error("Error loading patient form config from Supabase:", e);
            }
        };
        loadFormConfig();
    }, [inquilino]);

    const isVisible = (key) => {
        if (!formConfig) return true;
        return formConfig[key]?.visible !== false;
    };

    const isRequired = (key, defaultRequired = false) => {
        if (!formConfig) return defaultRequired;
        return formConfig[key]?.required === true;
    };

    const dynamicSchema = useMemo(() => {
        if (!formConfig) return patientSchema;

        let shape = { ...patientSchema.shape };

        const keyMapping = {
            paisNacimiento: "paisNacimiento",
            ciudadNacimiento: "ciudadNacimiento",
            sexo: "sexo",
            estadoCivil: "estadoCivil",
            fechaNacimiento: "fechaNacimiento",
            paisDomicilio: "paisDomicilio",
            ciudadDomicilio: "ciudadDomicilio",
            barrioDomicilio: "barrio",
            lugarResidencia: "lugarResidencia",
            estrato: "estrato",
            zonaResidencial: "zonaResidencial",
            esExtranjero: "esExtranjero",
            permitePublicidad: "permitePublicidad",
            celular: "celular",
            telefonoDomicilio: "telDomicilio",
            telefonoOficina: "telOficina",
            extension: "extension",
            correoElectronico: "email",
            ocupacion: "ocupacion",
            respNombre: "nombreResponsable",
            respParentesco: "parentesco",
            respCelular: "celularResponsable",
            respTelefono: "telefonoResponsable",
            respCorreo: "emailResponsable",
            acompNombre: "nombreAcompanante",
            acompTelefono: "telefonoAcompanante",
            convenioBeneficio: "convenioBeneficio",
            convenioPago: "convenioPago",
            comoNosConocio: "comoConocio",
            campana: "campania",
            remitidoPor: "remitidoPorValue",
            asesorComercial: "asesorComercialValue",
            tipoVinculacion: "tipoVinculacion",
            nombreEps: "nombreEps",
            polizaSalud: "polizaSalud",
            profesionales: "profesionalId",
            nota: "notas"
        };

        if (!shape.numeroDentadura) shape.numeroDentadura = z.string().optional();
        if (!shape.rh) shape.rh = z.string().optional();
        if (!shape.orientacionSexual) shape.orientacionSexual = z.string().optional();
        if (!shape.lugarExpedicion) shape.lugarExpedicion = z.string().optional();
        if (!shape.soat) shape.soat = z.string().optional();
        if (!shape.tipoPaciente) shape.tipoPaciente = z.string().optional();
        if (!shape.cuentaContable) shape.cuentaContable = z.string().optional();

        Object.entries(keyMapping).forEach(([configKey, schemaKey]) => {
            const fieldConfig = formConfig[configKey];
            if (!shape[schemaKey]) return;

            if (fieldConfig) {
                if (fieldConfig.visible === false) {
                    shape[schemaKey] = z.any().optional().nullable().or(z.literal(""));
                } else if (fieldConfig.required === false) {
                    shape[schemaKey] = shape[schemaKey].optional().or(z.literal("")).or(z.any());
                } else {
                    shape[schemaKey] = z.string().min(1, `El campo es obligatorio`);
                }
            }
        });

        return z.object(shape);
    }, [formConfig]);

    // Camera Handlers
    const startCamera = async () => {
        if (!navigator?.mediaDevices?.getUserMedia) {
            toast.error("El acceso a la cámara requiere una conexión segura (HTTPS o localhost) o un navegador compatible.");
            return;
        }

        const constraintConfigs = [
            { video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } },
            { video: { facingMode: "user" } },
            { video: true }
        ];

        let stream = null;
        let lastError = null;

        for (const constraints of constraintConfigs) {
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                if (stream) break;
            } catch (err) {
                lastError = err;
            }
        }

        if (stream) {
            setCameraStream(stream);
            setIsCameraActive(true);
        } else {
            console.error("Error accessing camera:", lastError);
            let msg = "No se pudo acceder a la cámara. Verifica los permisos de tu navegador.";
            if (lastError?.name === "NotAllowedError" || lastError?.name === "PermissionDeniedError") {
                msg = "Permiso de cámara denegado. Haz clic en el icono del candado en la barra de navegación para permitir el acceso.";
            } else if (lastError?.name === "NotFoundError" || lastError?.name === "DevicesNotFoundError") {
                msg = "No se encontró ninguna cámara conectada a este dispositivo.";
            } else if (lastError?.name === "NotReadableError" || lastError?.name === "TrackStartError") {
                msg = "La cámara está siendo usada por otra aplicación (ej: Zoom, Meet, Teams). Ciérrala e inténtalo de nuevo.";
            } else if (lastError?.name === "OverconstrainedError") {
                msg = "La cámara no admite la resolución o configuración solicitada.";
            }
            toast.error(msg);
        }
    };

    useEffect(() => {
        if (isCameraActive && cameraStream && videoRef.current) {
            videoRef.current.srcObject = cameraStream;
            videoRef.current.play().catch(e => console.error("Error playing video:", e));
        }
    }, [isCameraActive, cameraStream]);

    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }
        setIsCameraActive(false);
    };

    const takePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
                if (blob) {
                    const photoFile = new File([blob], `capture_${Date.now()}.jpg`, { 
                        type: "image/jpeg",
                        lastModified: Date.now()
                    });
                    onFotoChange(photoFile);
                    stopCamera();
                    toast.success("Foto capturada correctamente.");
                } else {
                    toast.error("Error al capturar la imagen. Inténtalo de nuevo.");
                }
            }, "image/jpeg", 0.9);
        }
    };

    useEffect(() => {
        return () => stopCamera();
    }, []);

    // Load Catalogs
    useEffect(() => {
        // TODO: Migrar loadPlanes a Supabase cuando esté listo el servicio
        const loadPlanes = async () => {
            if (!inquilino) return;
            setLoadingPlanes(true);
            try {
                console.log("💡 Planes temporalmente vacío - pendiente migración a Supabase");
                setPlanes([]);
            } catch (e) {
                console.error("Error loading planes:", e);
            } finally {
                setLoadingPlanes(false);
            }
        };

        const loadProfesionales = async () => {
            if (!inquilino) return;
            setLoadingProfesionales(true);
            try {
                const { profesionales } = await import("../../../services/supabaseServices");
                const data = await profesionales.getByTenant(inquilino);
                const professionalsList = data.map(d => ({ 
                    id: d.id, 
                    ...d, 
                    displayName: d.nombre_completo || d.nombre 
                }));
                // Ordenar alfabéticamente
                professionalsList.sort((a, b) => a.displayName.localeCompare(b.displayName));
                setProfesionales(professionalsList);
            } catch (e) {
                console.error("Error loading profesionales from Supabase:", e);
            } finally {
                setLoadingProfesionales(false);
            }
        };

        const loadEps = async () => {
            if (!inquilino) return;
            setLoadingEps(true);
            try {
                const { epsCatalogo } = await import("../../../services/supabaseServices");
                const eps = await epsCatalogo.getByTenant(inquilino);
                const uniqueEps = eps.map(e => e.nombre).filter(Boolean);
                uniqueEps.sort((a, b) => a.localeCompare(b));
                setEpsList(uniqueEps);
            } catch (e) {
                console.error("Error loading EPS catalog from Supabase:", e);
            } finally {
                setLoadingEps(false);
            }
        };

        const loadBarrios = async () => {
            if (!inquilino) return;
            setLoadingBarrios(true);
            try {
                const { barriosCatalogo } = await import("../../../services/supabaseServices");
                const barrios = await barriosCatalogo.getByTenant(inquilino);
                const uniqueBarrios = barrios.map(b => b.nombre).filter(Boolean);
                uniqueBarrios.sort((a, b) => a.localeCompare(b));
                setBarrioList(uniqueBarrios);
            } catch (e) {
                console.error("Error loading Barrio catalog from Supabase:", e);
            } finally {
                setLoadingBarrios(false);
            }
        };

        const loadSucursales = async () => {
            if (!inquilino) return;
            try {
                const q = query(collection(db, "sucursales"), where("inquilino", "==", inquilino));
                const snap = await getDocs(q);
                const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                data.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
                setSucursales(data);
            } catch (e) {
                console.error("Error loading sucursales:", e);
            }
        };

        const loadRemisionData = async () => {
            if (!inquilino) return;
            try {
                const [uSnap, pSnap] = await Promise.all([
                    getDocs(query(collection(db, "usuarios"), where("inquilino", "==", inquilino))),
                    getDocs(query(collection(db, "pacientes"), where("inquilino", "==", inquilino)))
                ]);
                const usuarios = uSnap.docs.map(d => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
                const pacientes = pSnap.docs.map(d => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => (a.nombreCompleto || a.nombre || "").localeCompare(b.nombreCompleto || b.nombre || ""));
                setUsuariosRemision(usuarios);
                setPacientesRemision(pacientes);
            } catch (e) {
                console.error("Error loading remision data:", e);
            }
        };

        const loadConvenios = async () => {
            if (!inquilino) return;
            try {
                const q = query(collection(db, "convenios"), where("inquilino", "==", inquilino), where("activo", "==", true));
                const snap = await getDocs(q);
                const data = snap.docs.map(d => d.data().nombre?.trim()).filter(Boolean);
                data.sort((a, b) => a.localeCompare(b));
                setConveniosList(data);
            } catch (e) {
                console.error("Error loading convenios:", e);
            }
        };

        // TODO: Migrar estas funciones a Supabase cuando estén listos los servicios
        // const loadPlanes = async () => {
        //     if (!inquilino) return;
        //     setLoadingPlanes(true);
        //     // ... implementar cuando esté listo el servicio de planes
        //     setLoadingPlanes(false);
        // };

        // const loadSucursales = async () => {
        //     if (!inquilino) return;
        //     // ... implementar cuando esté listo el servicio de sucursales  
        // };

        // const loadConvenios = async () => {
        //     if (!inquilino) return;
        //     // ... implementar cuando esté listo el servicio de convenios
        // };

        // const loadRemisionData = async () => {
        //     if (!inquilino) return;
        //     // ... implementar cuando esté listo el servicio de usuarios/pacientes para remisión
        // };

        // Cargar solo los servicios que ya están migrados
        loadProfesionales();
        loadEps();
        loadBarrios();
        // loadPlanes();           // TODO: Migrar
        // loadSucursales();       // TODO: Migrar  
        // loadConvenios();        // TODO: Migrar
        // loadRemisionData();     // TODO: Migrar
    }, [inquilino]);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        setError,
        clearErrors,
        formState: { errors, isSubmitting, isDirty }
    } = useForm({
        defaultValues: {
            ...initialData,
            tipoDocumento: normalizeTipoDocumento(initialData?.tipoDocumento),
            prefijoCelular: initialData?.prefijoCelular || "+57",
            remitidoPorType: initialData?.remitidoPorType || "Libre",
            asesorComercialType: initialData?.asesorComercialType || "Libre",
            esExtranjero: initialData?.esExtranjero || false,
            permitePublicidad: initialData?.permitePublicidad ?? true,
            multiplesResponsables: initialData?.multiplesResponsables || false,
            fechaIngreso: initialData?.fechaIngreso || (() => {
                const d = new Date();
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            })()
        },
        resolver: zodResolver(dynamicSchema)
    });

    const nroDocumentoValue = watch("nroDocumento");
    useEffect(() => {
        if (nroDocumentoValue) {
            setValue("nroHistoria", nroDocumentoValue);
        }
    }, [nroDocumentoValue, setValue]);

    const checkDocumentDuplication = async (e) => {
        const val = e.target.value?.trim();
        if (!val) return;
        if (initialData?.nroDocumento === val) {
            clearErrors("nroDocumento");
            return;
        }
        
        try {
            const { data, error } = await supabase
                .from("pacientes")
                .select("id")
                .eq("tenant_id", inquilino)
                .eq("documento", val)
                .limit(1);

            if (error) throw error;

            if (data && data.length > 0) {
                const foundDoc = data[0];
                if (foundDoc.id !== initialData?.id) {
                    setError("nroDocumento", {
                        type: "manual",
                        message: `Ya existe un paciente registrado con el número de documento ${val}`
                    });
                    toast.error(`Atención: Ya existe un paciente con el número de documento ${val}`);
                } else {
                    clearErrors("nroDocumento");
                }
            } else {
                clearErrors("nroDocumento");
            }
        } catch (err) {
            console.error("Error checking document duplication:", err);
        }
    };

    const [showCancelConfirm, setShowCancelConfirm] = useState(false);

    const handleCancel = () => {
        if (isDirty) {
            setShowCancelConfirm(true);
            return;
        }
        onCancel();
    };

    useEffect(() => {
        if (initialData) {
            reset({
                ...initialData,
                tipoDocumento: normalizeTipoDocumento(initialData?.tipoDocumento),
                prefijoCelular: initialData?.prefijoCelular || "+57",
                remitidoPorType: initialData?.remitidoPorType || "Libre",
                asesorComercialType: initialData?.asesorComercialType || "Libre",
                esExtranjero: initialData?.esExtranjero || false,
                permitePublicidad: initialData?.permitePublicidad ?? true,
                multiplesResponsables: initialData?.multiplesResponsables || false,
                fechaIngreso: initialData?.fechaIngreso || (() => {
                    const d = new Date();
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                })()
            });
            setFotoFile(null); 
            if (initialData.fotoUrl) {
                 setFotoPreview(initialData.fotoUrl);
             } else {
                 setFotoPreview("");
             }
            initialNacimientoRef.current = true;
            initialDomicilioRef.current = true;
        }
    }, [initialData, reset]);

    const nombres = watch("nombres");
    const apellidos = watch("apellidos");
    const docNum = watch("nroDocumento");
    const birthDate = watch("fechaNacimiento");
    const epsValue = watch("nombreEps");
    const barrioValue = watch("barrio");

    const filteredEps = useMemo(() => {
        if (!epsValue || epsValue.length < 1) return [];
        return epsList.filter(e => 
            e.toLowerCase().includes(epsValue.toLowerCase()) && 
            e.toLowerCase() !== epsValue.toLowerCase()
        ).slice(0, 5);
    }, [epsValue, epsList]);

    const filteredBarrios = useMemo(() => {
        if (!barrioValue || barrioValue.length < 1) return [];
        return barrioList.filter(b => 
            b.toLowerCase().includes(barrioValue.toLowerCase()) && 
            b.toLowerCase() !== barrioValue.toLowerCase()
        ).slice(0, 5);
    }, [barrioValue, barrioList]);

    useEffect(() => {
        if (nombres || apellidos) {
            setValue("nombreCompleto", `${nombres || ""} ${apellidos || ""}`.trim());
        }
    }, [nombres, apellidos, setValue]);

    const remitidoPorType = watch("remitidoPorType");
    const initialRemitidoRef = React.useRef(true);
    useEffect(() => {
        if (initialRemitidoRef.current) {
            initialRemitidoRef.current = false;
        } else {
            setValue("remitidoPorValue", "");
        }
    }, [remitidoPorType, setValue]);

    const asesorComercialType = watch("asesorComercialType");
    const initialAsesorRef = React.useRef(true);
    useEffect(() => {
        if (initialAsesorRef.current) {
            initialAsesorRef.current = false;
        } else {
            setValue("asesorComercialValue", "");
        }
    }, [asesorComercialType, setValue]);

    const paisNacimiento = watch("paisNacimiento");
    const paisDomicilio = watch("paisDomicilio");

    useEffect(() => {
        if (!paisNacimiento) {
            setCiudadesNacimiento([]);
            setLoadingCiudadesNacimiento(false);
            return;
        }

        if (initialNacimientoRef.current) {
            initialNacimientoRef.current = false;
        } else {
            setValue("ciudadNacimiento", "");
        }

        let isMounted = true;
        const loadCities = async () => {
            setLoadingCiudadesNacimiento(true);
            try {
                const cities = await fetchCitiesForCountry(paisNacimiento);
                if (isMounted) {
                    setCiudadesNacimiento(cities);
                }
            } catch (err) {
                console.error("Error loading birth cities:", err);
            } finally {
                if (isMounted) {
                    setLoadingCiudadesNacimiento(false);
                }
            }
        };

        loadCities();
        return () => {
            isMounted = false;
        };
    }, [paisNacimiento, setValue]);

    useEffect(() => {
        if (!paisDomicilio) {
            setCiudadesDomicilio([]);
            setLoadingCiudadesDomicilio(false);
            return;
        }

        if (initialDomicilioRef.current) {
            initialDomicilioRef.current = false;
        } else {
            setValue("ciudadDomicilio", "");
        }

        let isMounted = true;
        const loadCities = async () => {
            setLoadingCiudadesDomicilio(true);
            try {
                const cities = await fetchCitiesForCountry(paisDomicilio);
                if (isMounted) {
                    setCiudadesDomicilio(cities);
                }
            } catch (err) {
                console.error("Error loading residence cities:", err);
            } finally {
                if (isMounted) {
                    setLoadingCiudadesDomicilio(false);
                }
            }
        };

        loadCities();
        return () => {
            isMounted = false;
        };
    }, [paisDomicilio, setValue]);

    // Cerrar dropdown de prefijo al hacer click fuera
    useEffect(() => {
        if (!showPrefijoDrop) return;
        const handler = () => setShowPrefijoDrop(false);
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showPrefijoDrop]);

    const age = useMemo(() => {
        if (!birthDate) return "";
        
        let birth = null;
        if (birthDate.includes("-")) {
            const parts = birthDate.split("-");
            if (parts.length === 3) {
                const y = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10) - 1;
                const d = parseInt(parts[2], 10);
                birth = new Date(y, m, d);
            }
        } else if (birthDate.includes("/")) {
            const parts = birthDate.split("/");
            if (parts.length === 3) {
                const d = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10) - 1;
                const y = parseInt(parts[2], 10);
                birth = new Date(y, m, d);
            }
        }
        if (!birth || isNaN(birth.getTime())) {
            birth = new Date(birthDate);
        }
        if (isNaN(birth.getTime())) return "";

        const today = new Date();
        let years = today.getFullYear() - birth.getFullYear();
        let months = today.getMonth() - birth.getMonth();
        
        if (months < 0 || (months === 0 && today.getDate() < birth.getDate())) {
            years--;
            months += 12;
        }
        
        if (today.getDate() < birth.getDate()) {
            months--;
            if (months < 0) {
                months += 12;
                years--;
            }
        }

        if (years < 0) return "";
        
        let ageStr = `${years} años`;
        if (months > 0) {
            ageStr += ` y ${months} meses`;
        }
        return ageStr;
    }, [birthDate]);

    const defaultFechaIngreso = useMemo(() => {
        const now = new Date();
        return now.toLocaleString('es-CO', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }, []);

    useEffect(() => {
        if (!initialData?.id && !watch("fechaIngreso")) {
            setValue("fechaIngreso", defaultFechaIngreso);
        }
    }, [defaultFechaIngreso, setValue, initialData]);

    const onFotoChange = (file) => {
        if (!file) {
            setFotoFile(null);
            setFotoPreview("");
            setValue("fotoUrl", "");
            return;
        }
        setFotoFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setFotoPreview(ev.target.result);
        reader.readAsDataURL(file);
    };

    const handleAgregarEps = async () => {
        const epsInput = watch("nombreEps");
        if (!epsInput || !epsInput.trim()) {
            toast.error("Por favor, ingrese un nombre de EPS");
            return;
        }
        const normalizedEps = epsInput.trim();
        if (epsList.map(e => e.toLowerCase()).includes(normalizedEps.toLowerCase())) {
            toast.info("Esta EPS ya se encuentra registrada");
            return;
        }
        if (!inquilino) {
            toast.error("Inquilino no identificado");
            return;
        }
        try {
            const { epsCatalogo } = await import("../../../services/supabaseServices");
            await epsCatalogo.create(inquilino, normalizedEps);
            setEpsList(prev => [...prev, normalizedEps].sort((a, b) => a.localeCompare(b)));
            toast.success("EPS agregada al catálogo con éxito");
        } catch (err) {
            console.error("Error saving new EPS to Supabase:", err);
            toast.error("Error al guardar la EPS en el catálogo");
        }
    };

    const handleAgregarBarrio = async () => {
        const barrioInput = watch("barrio");
        if (!barrioInput || !barrioInput.trim()) {
            toast.error("Por favor, ingrese un nombre de barrio");
            return;
        }
        const normalizedBarrio = barrioInput.trim();
        if (barrioList.map(b => b.toLowerCase()).includes(normalizedBarrio.toLowerCase())) {
            toast.info("Este barrio ya se encuentra registrado");
            return;
        }
        if (!inquilino) {
            toast.error("Inquilino no identificado");
            return;
        }
        try {
            const { barriosCatalogo } = await import("../../../services/supabaseServices");
            await barriosCatalogo.create(inquilino, normalizedBarrio);
            setBarrioList(prev => [...prev, normalizedBarrio].sort((a, b) => a.localeCompare(b)));
            toast.success("Barrio agregado al catálogo con éxito");
        } catch (err) {
            console.error("Error saving new barrio to Supabase:", err);
            toast.error("Error al guardar el barrio en el catálogo");
        }
    };

    const onValidSubmit = async (data) => {
        const selectedPlan = planes.find(p => p.id === data.planId);
        const selectedProf = profesionales.find(p => p.id === data.profesionalId);
        
        if (data.nombreEps && inquilino) {
            const normalizedEps = data.nombreEps.trim();
            if (!epsList.map(e => e.toLowerCase()).includes(normalizedEps.toLowerCase())) {
                try {
                    const { epsCatalogo } = await import("../../../services/supabaseServices");
                    await epsCatalogo.create(inquilino, normalizedEps);
                } catch (e) {
                    console.error("Error saving new EPS to Supabase:", e);
                }
            }
        }

        if (data.barrio && inquilino) {
            const normalizedBarrio = data.barrio.trim();
            if (!barrioList.map(b => b.toLowerCase()).includes(normalizedBarrio.toLowerCase())) {
                try {
                    const { barriosCatalogo } = await import("../../../services/supabaseServices");
                    await barriosCatalogo.create(inquilino, normalizedBarrio);
                } catch (e) {
                    console.error("Error saving new barrio to Supabase:", e);
                }
            }
        }

        const finalData = {
            ...data,
            edad: age, 
            planNombre: selectedPlan?.nombre || "PARTICULAR",
            profesionalNombre: selectedProf?.displayName || "",
            updatedAt: new Date().toISOString()
        };
        onSubmit(finalData, fotoFile);
    };

    const onErrorSubmit = (err) => {
        console.warn("Validation Errors:", err);
        const firstErrorField = Object.keys(err)[0];
        const errorMessage = err[firstErrorField]?.message || "REVISA LOS DATOS";
        toast.error(`Error en ${firstErrorField}: ${errorMessage}`);
    };

    return (
        <div className="bg-white w-full h-full rounded-none md:rounded-xl shadow-2xl flex flex-col border-0 md:border border-slate-200">

            {/* Header Sticky */}
            <div className="bg-white px-8 py-5 border-b border-slate-200 flex justify-between items-center shrink-0 z-10 sticky top-0">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-white shadow-md">
                        <FiUser size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 tracking-tight">
                            {initialData?.id ? "Edición de Paciente" : "Registro de Nuevo Paciente"}
                        </h3>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                            Formulario Clínico Unificado
                        </p>
                    </div>
                </div>
                {onCancel && (
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="w-10 h-10 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center hover:bg-rose-50 hover:text-rose-600 transition-all active:scale-95"
                    >
                        <FiX size={20} />
                    </button>
                )}
            </div>

            <form autoComplete="off" onSubmit={handleSubmit(onValidSubmit, onErrorSubmit)} className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                
                {/* BIG SCROLL CANVAS */}
                <div className="flex-1 overflow-y-auto px-4 md:px-12 py-6 bg-slate-50/50 custom-scrollbar scroll-smooth">
                    
                    <div className="w-full max-w-[1700px] mx-auto space-y-6">

                        {/* TOP BANNER CARD: FOTO Y ADMINISTRATIVO */}
                        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                            {/* FOTO COMPACTA Y MODERNA */}
                            <div className="lg:col-span-5 flex items-center gap-4 bg-slate-50/80 p-3 rounded-xl border border-slate-200">
                                <div className="relative group w-20 h-20 shrink-0 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col items-center justify-center shadow-xs">
                                    {isCameraActive ? (
                                        <div className="flex flex-col items-center justify-center text-emerald-600 bg-emerald-50 w-full h-full">
                                            <FiCamera size={24} className="animate-pulse" />
                                            <span className="text-[9px] font-bold uppercase mt-1">Cámara activa</span>
                                        </div>
                                    ) : fotoPreview ? (
                                        <>
                                            <img src={fotoPreview} className="w-full h-full object-cover" alt="Preview" />
                                            <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-2">
                                                <button type="button" onClick={startCamera} className="p-1.5 bg-white/20 text-white rounded-full hover:bg-[#8CC63F]"><FiCamera size={12} /></button>
                                                <button type="button" onClick={() => onFotoChange(null)} className="p-1.5 bg-white/20 text-white rounded-full hover:bg-rose-500"><FiTrash2 size={12} /></button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center p-1">
                                            <FiCamera size={20} className="text-slate-400 mx-auto mb-0.5" />
                                            <span className="text-[9px] text-slate-400 font-bold uppercase block leading-tight">Subir Foto</span>
                                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => onFotoChange(e.target.files[0])} title="Subir archivo" />
                                        </div>
                                    )}
                                    <canvas ref={canvasRef} className="hidden" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-[12px] font-bold text-slate-800 uppercase tracking-wide">Foto del Paciente</h4>
                                    <p className="text-[10px] text-slate-400 font-medium">Adjunta foto o activa la cámara</p>
                                    {!isCameraActive && (
                                        <button type="button" onClick={startCamera} className="text-[10px] font-bold text-white bg-[#8CC63F] hover:bg-[#7bb335] px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 shadow-xs border-0 cursor-pointer">
                                            <FiCamera size={12} /> ACTIVAR CÁMARA
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* MODAL CÁMARA */}
                            {isCameraActive && (
                                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
                                    <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-md w-full border border-slate-100 flex flex-col items-center p-5 space-y-4">
                                        <div className="w-full flex items-center justify-between border-b border-slate-100 pb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                                    <FiCamera size={18} />
                                                </div>
                                                <div>
                                                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Capturar Foto de Paciente</h3>
                                                    <p className="text-[10px] text-slate-400 font-medium">Centra el rostro en la guía</p>
                                                </div>
                                            </div>
                                            <button type="button" onClick={stopCamera} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                                                <FiX size={18} />
                                            </button>
                                        </div>

                                        <div className="relative w-full aspect-4/3 bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
                                            <video 
                                                ref={videoRef} 
                                                className="w-full h-full object-cover" 
                                                autoPlay 
                                                playsInline 
                                            />
                                            {/* Guía ovalada para centrar el rostro */}
                                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                                <div className="w-48 h-60 rounded-[50%] border-2 border-white/40 border-dashed shadow-2xl"></div>
                                            </div>
                                        </div>

                                        <div className="w-full flex items-center justify-end gap-2 pt-1">
                                            <button
                                                type="button"
                                                onClick={stopCamera}
                                                className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={takePhoto}
                                                className="px-4 py-2 text-xs font-bold text-white bg-[#8CC63F] hover:bg-[#7bb335] rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <FiCamera size={14} /> CAPTURAR FOTO
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* CAMPOS ADMINISTRATIVOS INTEGRADOS */}
                            <div className="lg:col-span-7 bg-slate-50/80 p-3 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Plan de Atención</label>
                                    <select {...register("planId")} className="form-input text-xs w-full bg-white border-slate-200">
                                        <option value="">SELECCIONE PLAN...</option>
                                        {planes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                                    </select>
                                </div>
                                {isVisible("profesionales") && (
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Profesional Responsable</label>
                                        <select {...register("profesionalId")} className="form-input text-xs w-full bg-white border-slate-200">
                                            <option value="">Ninguno asignado</option>
                                            {profesionales.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                                        </select>
                                    </div>
                                )}
                                {isVisible("sucursales") && (
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Sede de atención</label>
                                        <select {...register("sede")} className="form-input text-xs w-full bg-white border-slate-200">
                                            <option value="">Ninguna asignada</option>
                                            {sucursales.map(s => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* SECTION 1: DATOS DE IDENTIFICACIÓN */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                            <SectionTitle num="1" title="Datos de Identificación" />
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                                <FormRow label="Tipo de documento" required error={errors.tipoDocumento}>
                                    <select {...register("tipoDocumento")} className="form-input text-sm w-full">
                                        <option value="">Seleccione...</option>
                                        {TIPOS_DOCUMENTO.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </FormRow>

                                <FormRow label="Nro. de documento" required error={errors.nroDocumento}>
                                    <input 
                                        {...register("nroDocumento")} 
                                        onBlur={(e) => {
                                            register("nroDocumento").onBlur(e);
                                            checkDocumentDuplication(e);
                                        }}
                                        className="form-input text-sm w-full" 
                                        placeholder="Nro. documento paciente" 
                                    />
                                </FormRow>

                                <FormRow label="Número de Historia">
                                    <input {...register("nroHistoria")} className="form-input text-sm w-full" placeholder="Nro. historia paciente" />
                                </FormRow>

                                {isVisible("fechaIngreso") && (
                                    <FormRow label="Fecha de ingreso" required={isRequired("fechaIngreso")} error={errors.fechaIngreso}>
                                        <div className="relative w-full md:w-64">
                                            <input {...register("fechaIngreso")} readOnly className="form-input text-sm w-full bg-slate-50/50 cursor-not-allowed" />
                                            <FiCalendar className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        </div>
                                    </FormRow>
                                )}

                                <FormRow label="Nombres" required error={errors.nombres}>
                                    <input {...register("nombres")} autoComplete="new-password" className="form-input text-sm w-full" placeholder="Nombres paciente" />
                                </FormRow>

                                <FormRow label="Apellidos" required error={errors.apellidos}>
                                    <input {...register("apellidos")} autoComplete="new-password" className="form-input text-sm w-full" placeholder="Apellidos paciente" />
                                </FormRow>

                                <FormRow label="Nombre completo">
                                    <input value={watch("nombreCompleto") || ""} readOnly className="form-input text-sm w-full bg-slate-50 text-slate-600 font-bold border-transparent" placeholder="Calculado automáticamente..." />
                                </FormRow>

                                {isVisible("sexo") && (
                                    <FormRow label="Sexo" required={isRequired("sexo", true)} error={errors.sexo}>
                                        <select {...register("sexo")} className="form-input text-sm w-full">
                                            <option value="">Seleccione...</option>
                                            {SEXOS.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </FormRow>
                                )}

                                {isVisible("estadoCivil") && (
                                    <FormRow label="Estado civil" required={isRequired("estadoCivil", true)} error={errors.estadoCivil}>
                                        <select {...register("estadoCivil")} className="form-input text-sm w-full">
                                            <option value="">Seleccione...</option>
                                            {ESTADOS_CIVILES.map(ec => <option key={ec} value={ec}>{ec}</option>)}
                                        </select>
                                    </FormRow>
                                )}
                            </div></div><div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4"><SectionTitle num="2" title="Información de Contacto" />
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {isVisible("paisNacimiento") && (
                                    <FormRow label="País de nacimiento" required={isRequired("paisNacimiento", true)} error={errors.paisNacimiento}>
                                        <SearchableSelect 
                                            value={watch("paisNacimiento")}
                                            onChange={(val) => setValue("paisNacimiento", val, { shouldDirty: true })}
                                            options={PAISES.map(p => typeof p === "object" ? p.pais : p)}
                                            placeholder="Seleccione..."
                                        />
                                    </FormRow>
                                )}

                                {isVisible("ciudadNacimiento") && (
                                    <FormRow label="Ciudad de nacimiento" required={isRequired("ciudadNacimiento")} error={errors.ciudadNacimiento}>
                                        {!paisNacimiento ? (
                                            <select disabled className="form-input text-sm w-full md:w-64 bg-slate-50 cursor-not-allowed">
                                                <option value="">Seleccione primero un país...</option>
                                            </select>
                                        ) : loadingCiudadesNacimiento ? (
                                            <select disabled className="form-input text-sm w-full md:w-64 bg-slate-50 cursor-not-allowed">
                                                <option value="">Cargando ciudades...</option>
                                            </select>
                                        ) : ciudadesNacimiento.length > 0 ? (
                                            <SearchableSelect 
                                                value={watch("ciudadNacimiento")}
                                                onChange={(val) => setValue("ciudadNacimiento", val, { shouldDirty: true })}
                                                options={ciudadesNacimiento}
                                                placeholder="Seleccione..."
                                                disabled={!paisNacimiento}
                                                disabledPlaceholder="Seleccione primero un país..."
                                                loading={loadingCiudadesNacimiento}
                                                loadingPlaceholder="Cargando ciudades..."
                                            />
                                        ) : (
                                            <input 
                                                type="text" 
                                                {...register("ciudadNacimiento")} 
                                                className="form-input text-sm w-full font-medium" 
                                                placeholder="Escriba la ciudad" 
                                            />
                                        )}
                                    </FormRow>
                                )}

                                {isVisible("fechaNacimiento") && (
                                    <FormRow label="Fecha de Nacimiento" required={isRequired("fechaNacimiento", true)} error={errors.fechaNacimiento}>
                                        <div className="flex gap-4">
                                            <input type="date" {...register("fechaNacimiento")} className="form-input text-sm w-full md:w-48" />
                                            <div className="px-4 py-2 bg-slate-100 rounded-lg text-sm text-slate-700 font-bold flex items-center shadow-inner">
                                                Edad: {age || "---"}
                                            </div>
                                        </div>
                                    </FormRow>
                                )}

                                {isVisible("paisDomicilio") && (
                                    <FormRow label="País de domicilio" required={isRequired("paisDomicilio", true)} error={errors.paisDomicilio}>
                                        <SearchableSelect 
                                            value={watch("paisDomicilio")}
                                            onChange={(val) => setValue("paisDomicilio", val, { shouldDirty: true })}
                                            options={PAISES.map(p => typeof p === "object" ? p.pais : p)}
                                            placeholder="Seleccione..."
                                        />
                                    </FormRow>
                                )}

                                {isVisible("ciudadDomicilio") && (
                                    <FormRow label="Ciudad de domicilio" required={isRequired("ciudadDomicilio", true)} error={errors.ciudadDomicilio}>
                                        {!paisDomicilio ? (
                                            <select disabled className="form-input text-sm w-full md:w-64 bg-slate-50 cursor-not-allowed">
                                                <option value="">Seleccione primero un país...</option>
                                            </select>
                                        ) : loadingCiudadesDomicilio ? (
                                            <select disabled className="form-input text-sm w-full md:w-64 bg-slate-50 cursor-not-allowed">
                                                <option value="">Cargando ciudades...</option>
                                            </select>
                                        ) : ciudadesDomicilio.length > 0 ? (
                                            <SearchableSelect 
                                                value={watch("ciudadDomicilio")}
                                                onChange={(val) => setValue("ciudadDomicilio", val, { shouldDirty: true })}
                                                options={ciudadesDomicilio}
                                                placeholder="Seleccione..."
                                                disabled={!paisDomicilio}
                                                disabledPlaceholder="Seleccione primero un país..."
                                                loading={loadingCiudadesDomicilio}
                                                loadingPlaceholder="Cargando ciudades..."
                                            />
                                        ) : (
                                            <input 
                                                type="text" 
                                                {...register("ciudadDomicilio")} 
                                                className="form-input text-sm w-full font-medium" 
                                                placeholder="Escriba la ciudad" 
                                            />
                                        )}
                                    </FormRow>
                                )}

                                {isVisible("barrioDomicilio") && (
                                     <FormRow label="Barrio" required={isRequired("barrioDomicilio", true)} error={errors.barrio}>
                                         <div className="flex gap-2">
                                             <div className="relative flex-1 max-w-[16rem]">
                                                 <input 
                                                     {...register("barrio")} 
                                                     onFocus={() => setShowBarrioSuggestions(true)}
                                                     onBlur={() => setTimeout(() => setShowBarrioSuggestions(false), 200)}
                                                     placeholder="Barrio del paciente"
                                                     className="form-input text-sm w-full"
                                                 />
                                                 {loadingBarrios && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>}
                                                 {showBarrioSuggestions && filteredBarrios.length > 0 && (
                                                     <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden py-1">
                                                         {filteredBarrios.map(b => (
                                                             <button key={b} type="button" onMouseDown={() => setValue("barrio", b, { shouldDirty: true })} className="w-full px-4 py-2 text-left text-[13px] font-semibold hover:bg-slate-50 text-slate-700 transition-colors">
                                                                 {b}
                                                             </button>
                                                         ))}
                                                     </div>
                                                 )}
                                             </div>
                                             <button type="button" onClick={handleAgregarBarrio} className="w-10 h-10 shrink-0 bg-[#8CC63F] text-white rounded-xl flex items-center justify-center hover:bg-[#7bb335] transition-colors shadow-md shadow-[#8CC63F]/20" title="Agregar barrio al catálogo">
                                                 <FiPlus size={20} />
                                             </button>
                                         </div>
                                     </FormRow>
                                 )}

                                {isVisible("lugarResidencia") && (
                                    <FormRow label="Lugar de residencia" required={isRequired("lugarResidencia", true)} error={errors.lugarResidencia}>
                                        <input {...register("lugarResidencia")} className="form-input text-sm w-full" placeholder="Dirección completa" />
                                    </FormRow>
                                )}

                                {(isVisible("estrato") || isVisible("zonaResidencial")) && (
                                    <FormRow label="Configuración Domicilio">
                                        <div className="flex gap-4 items-center">
                                            {isVisible("estrato") && (
                                                <select {...register("estrato")} className="form-input text-sm w-32">
                                                    <option value="">Estrato</option>
                                                    {ESTRATOS.map(e => <option key={e} value={e}>{e}</option>)}
                                                </select>
                                            )}
                                            {isVisible("zonaResidencial") && (
                                                <select {...register("zonaResidencial")} className="form-input text-sm w-40">
                                                    <option value="">Zona Residencial</option>
                                                    {ZONAS_RESIDENCIALES.map(z => <option key={z} value={z}>{z}</option>)}
                                                </select>
                                            )}
                                        </div>
                                    </FormRow>
                                )}

                                {isVisible("celular") && (
                                    <FormRow label="Celular" required={isRequired("celular", true)} error={errors.celular}>
                                        <div className="flex items-center gap-0 w-full max-w-sm">
                                            <div className="relative shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => { setShowPrefijoDrop(v => !v); setPrefijoSearch(""); }}
                                                    className="h-9 px-2.5 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1 transition-colors whitespace-nowrap focus:outline-none focus:ring-1 focus:ring-blue-400"
                                                >
                                                    {watch("prefijoCelular") || "+57"}
                                                    <svg className="w-2.5 h-2.5 text-slate-400" fill="none" viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                                </button>
                                                <input type="hidden" {...register("prefijoCelular")} />
                                                {showPrefijoDrop && (
                                                    <div
                                                        className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden"
                                                        style={{ minWidth: "200px" }}
                                                        onMouseDown={e => e.stopPropagation()}
                                                    >
                                                        <div className="px-2 pt-2 pb-1 border-b border-slate-100">
                                                            <input
                                                                autoFocus
                                                                type="text"
                                                                value={prefijoSearch}
                                                                onChange={e => setPrefijoSearch(e.target.value)}
                                                                placeholder="Buscar país o prefijo..."
                                                                className="w-full h-7 px-2 text-[11px] font-bold border border-slate-200 rounded-md outline-none focus:border-blue-400 bg-slate-50"
                                                            />
                                                        </div>
                                                        <div className="max-h-52 overflow-y-auto custom-scrollbar">
                                                            {PREFIJOS_TELEFONICOS
                                                                .filter(p =>
                                                                    !prefijoSearch ||
                                                                    p.pais.toLowerCase().includes(prefijoSearch.toLowerCase()) ||
                                                                    p.prefijo.includes(prefijoSearch)
                                                                )
                                                                .map(p => (
                                                                    <button
                                                                        key={`${p.pais}-${p.prefijo}`}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setValue("prefijoCelular", p.prefijo);
                                                                            setShowPrefijoDrop(false);
                                                                        }}
                                                                        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-blue-50 transition-colors group"
                                                                    >
                                                                        <span className="text-[11px] font-semibold text-slate-600 group-hover:text-blue-700">{p.pais}</span>
                                                                        <span className="text-[11px] font-black text-slate-800 group-hover:text-blue-700 ml-2">{p.prefijo}</span>
                                                                    </button>
                                                                ))
                                                            }
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <input
                                                {...register("celular")}
                                                autoComplete="off"
                                                className="form-input text-sm flex-1 rounded-l-none border-l-0 focus:z-10"
                                                placeholder="Número de celular"
                                                onFocus={() => setShowPrefijoDrop(false)}
                                            />
                                        </div>
                                    </FormRow>
                                )}

                                {(isVisible("telefonoDomicilio") || isVisible("telefonoOficina") || isVisible("extension")) && (
                                    <FormRow label="Teléfonos Secundarios">
                                        <div className="flex gap-2 w-full">
                                            {isVisible("telefonoDomicilio") && <input {...register("telDomicilio")} className="form-input text-sm flex-1" placeholder="Tel. domicilio" />}
                                            {isVisible("telefonoOficina") && <input {...register("telOficina")} className="form-input text-sm flex-1" placeholder="Tel. oficina" />}
                                            {isVisible("extension") && <input {...register("extension")} className="form-input text-sm w-24" placeholder="Ext #" />}
                                        </div>
                                    </FormRow>
                                )}

                                {isVisible("correoElectronico") && (
                                    <FormRow label="Correo Electrónico" required={isRequired("correoElectronico", true)} error={errors.email}>
                                        <input {...register("email")} className="form-input text-sm w-full" placeholder="Correo electrónico del paciente" />
                                    </FormRow>
                                )}

                                {isVisible("ocupacion") && (
                                    <FormRow label="Ocupación" required={isRequired("ocupacion", true)} error={errors.ocupacion}>
                                        <input {...register("ocupacion")} className="form-input text-sm w-full" placeholder="Ocupación del paciente" />
                                    </FormRow>
                                )}

                                {(isVisible("esExtranjero") || isVisible("permitePublicidad")) && (
                                    <FormRow label="Opciones Adicionales">
                                        <div className="flex gap-8 items-center py-2">
                                            {isVisible("esExtranjero") && (
                                                <label className="flex items-center gap-3 cursor-pointer group">
                                                    <div className="relative">
                                                        <input type="checkbox" {...register("esExtranjero")} className="sr-only" />
                                                        <div className={`w-8 h-5 rounded-full transition-all ${watch("esExtranjero") ? 'bg-blue-600' : 'bg-slate-200'}`} />
                                                        <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-all ${watch("esExtranjero") ? 'translate-x-3' : ''}`} />
                                                    </div>
                                                    <span className="text-[13px] font-semibold text-slate-600">¿Es extranjero?</span>
                                                </label>
                                            )}
                                            {isVisible("permitePublicidad") && (
                                                <label className="flex items-center gap-3 cursor-pointer group">
                                                    <div className="relative">
                                                        <input type="checkbox" {...register("permitePublicidad")} className="sr-only" />
                                                        <div className={`w-8 h-5 rounded-full transition-all ${watch("permitePublicidad") ? 'bg-blue-600' : 'bg-slate-200'}`} />
                                                        <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-all ${watch("permitePublicidad") ? 'translate-x-3' : ''}`} />
                                                    </div>
                                                    <span className="text-[13px] font-semibold text-slate-600">¿Permitir publicidad?</span>
                                                </label>
                                            )}
                                        </div>
                                    </FormRow>
                                )}
                            </div></div>

                            {(isVisible("nombreEps") || isVisible("tipoVinculacion") || isVisible("polizaSalud")) && (<div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                                    <SectionTitle num="3" title="EPS y Aseguramiento" />
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {isVisible("nombreEps") && (
                                             <FormRow label="Nombre de la EPS" required={isRequired("nombreEps", true)} error={errors.nombreEps}>
                                                 <div className="flex gap-2">
                                                     <div className="relative flex-1 max-w-[16rem]">
                                                         <input 
                                                             {...register("nombreEps")} 
                                                             onFocus={() => setShowEpsSuggestions(true)}
                                                             onBlur={() => setTimeout(() => setShowEpsSuggestions(false), 200)}
                                                             placeholder="Escriba el nombre..."
                                                             className="form-input text-sm w-full"
                                                         />
                                                         {loadingEps && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>}
                                                         {showEpsSuggestions && filteredEps.length > 0 && (
                                                             <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden py-1">
                                                                 {filteredEps.map(eps => (
                                                                     <button key={eps} type="button" onMouseDown={() => setValue("nombreEps", eps, { shouldDirty: true })} className="w-full px-4 py-2 text-left text-[13px] font-semibold hover:bg-slate-50 text-slate-700 transition-colors">
                                                                         {eps}
                                                                     </button>
                                                                 ))}
                                                                 </div>
                                                         )}
                                                     </div>
                                                     <button type="button" onClick={handleAgregarEps} className="w-10 h-10 shrink-0 bg-[#8CC63F] text-white rounded-xl flex items-center justify-center hover:bg-[#7bb335] transition-colors shadow-md shadow-[#8CC63F]/20" title="Agregar EPS al catálogo">
                                                         <FiPlus size={20} />
                                                     </button>
                                                 </div>
                                             </FormRow>
                                         )}
                                        {isVisible("tipoVinculacion") && (
                                            <FormRow label="Tipo de Vinculación" required={isRequired("tipoVinculacion", true)} error={errors.tipoVinculacion}>
                                                <select {...register("tipoVinculacion")} className="form-input text-sm w-full">
                                                    <option value="">Seleccione tipo...</option>
                                                    {TIPOS_VINCULACION.map(v => <option key={v} value={v}>{v}</option>)}
                                                </select>
                                            </FormRow>
                                        )}

                                        {isVisible("polizaSalud") && (
                                            <FormRow label="Póliza de Salud">
                                                <input {...register("polizaSalud")} className="form-input text-sm w-full" placeholder="Número de contrato o póliza" />
                                            </FormRow>
                                        )}
                                    </div></div>
                            )}

                            {(isVisible("comoNosConocio") || isVisible("campana") || isVisible("remitidoPor") || isVisible("asesorComercial")) && (<div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                                    <SectionTitle num="4" title="Estrategia de Mercadeo" />
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {isVisible("comoNosConocio") && (
                                            <FormRow label="¿Cómo nos conoció?">
                                                <select {...register("comoConocio")} className="form-input text-sm w-full">
                                                    <option value="">Seleccione...</option>
                                                    {MEDIOS_CONOCIMIENTO.map(m => <option key={m} value={m}>{m}</option>)}
                                                </select>
                                            </FormRow>
                                        )}
                                        {isVisible("campana") && (
                                            <FormRow label="Campaña Relacionada">
                                                <input {...register("campania")} className="form-input text-sm w-full" placeholder="Campaña relacionada con el paciente" />
                                            </FormRow>
                                        )}
                                        {isVisible("remitidoPor") && (
                                            <FormRow label="Remitido por">
                                                 <div className="flex flex-col gap-3 w-full">
                                                     {/* Segmented Control / Selector de tipo de remisión */}
                                                     <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                                                         <button
                                                             type="button"
                                                             onClick={() => setValue("remitidoPorType", "Usuario")}
                                                             className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all duration-200 ${
                                                                 watch("remitidoPorType") === "Usuario"
                                                                     ? "bg-white text-indigo-600 shadow-sm"
                                                                     : "text-slate-500 hover:text-slate-800"
                                                             }`}
                                                         >
                                                             Usuario
                                                         </button>
                                                         <button
                                                             type="button"
                                                             onClick={() => setValue("remitidoPorType", "Paciente")}
                                                             className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all duration-200 ${
                                                                 watch("remitidoPorType") === "Paciente"
                                                                     ? "bg-white text-indigo-600 shadow-sm"
                                                                     : "text-slate-500 hover:text-slate-800"
                                                             }`}
                                                         >
                                                             Paciente
                                                         </button>
                                                         <button
                                                             type="button"
                                                             onClick={() => setValue("remitidoPorType", "Libre")}
                                                             className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all duration-200 ${
                                                                 watch("remitidoPorType") === "Libre"
                                                                     ? "bg-white text-indigo-600 shadow-sm"
                                                                     : "text-slate-500 hover:text-slate-800"
                                                             }`}
                                                         >
                                                             Libre
                                                         </button>
                                                     </div>

                                                     {/* Campo de valor de remisión */}
                                                     <div className="flex gap-2">
                                                         {watch("remitidoPorType") === "Usuario" && (
                                                             <SearchableSelect 
                                                                 value={watch("remitidoPorValue")}
                                                                 onChange={(val) => setValue("remitidoPorValue", val, { shouldDirty: true })}
                                                                 options={profesionales.map(p => p.displayName)}
                                                                 placeholder="Seleccione un doctor..."
                                                                 className="w-full md:w-96"
                                                             />
                                                         )}
                                                         {watch("remitidoPorType") === "Paciente" && (
                                                             <SearchableSelect 
                                                                 value={watch("remitidoPorValue")}
                                                                 onChange={(val) => setValue("remitidoPorValue", val, { shouldDirty: true })}
                                                                 options={pacientesRemision.map(p => p.nombreCompleto || `${p.nombre || ""} ${p.apellido || ""}`.trim())}
                                                                 placeholder="Seleccione un paciente..."
                                                                 className="w-full md:w-96"
                                                             />
                                                         )}
                                                         {watch("remitidoPorType") === "Libre" && (
                                                             <input
                                                                 {...register("remitidoPorValue")}
                                                                 className="form-input text-sm w-full md:w-96"
                                                                 placeholder="Nombre de la persona que refiere"
                                                             />
                                                         )}
                                                     </div>
                                                 </div>
                                             </FormRow>
                                        )}
                                        {isVisible("asesorComercial") && (
                                            <FormRow label="Asesor comercial">
                                                <div className="flex flex-col gap-3 w-full">
                                                    {/* Segmented Control / Selector de tipo de asesor */}
                                                    <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                                                        <button
                                                            type="button"
                                                            onClick={() => setValue("asesorComercialType", "Usuario")}
                                                            className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all duration-200 ${
                                                                watch("asesorComercialType") === "Usuario"
                                                                    ? "bg-white text-indigo-600 shadow-sm"
                                                                    : "text-slate-500 hover:text-slate-800"
                                                            }`}
                                                        >
                                                            Usuario
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setValue("asesorComercialType", "Libre")}
                                                            className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all duration-200 ${
                                                                watch("asesorComercialType") === "Libre"
                                                                    ? "bg-white text-indigo-600 shadow-sm"
                                                                    : "text-slate-500 hover:text-slate-800"
                                                            }`}
                                                        >
                                                            Libre
                                                        </button>
                                                    </div>

                                                    {/* Campo de valor de asesor */}
                                                    <div className="flex gap-2">
                                                        {watch("asesorComercialType") === "Usuario" && (
                                                            <SearchableSelect 
                                                                value={watch("asesorComercialValue")}
                                                                onChange={(val) => setValue("asesorComercialValue", val, { shouldDirty: true })}
                                                                options={profesionales.map(p => p.displayName)}
                                                                placeholder="Seleccione un asesor..."
                                                                className="w-full md:w-96"
                                                            />
                                                        )}
                                                        {watch("asesorComercialType") === "Libre" && (
                                                            <input
                                                                {...register("asesorComercialValue")}
                                                                className="form-input text-sm w-full md:w-96"
                                                                placeholder="Nombre del asesor comercial"
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            </FormRow>
                                        )}
                                    </div></div>
                            )}

                            {(isVisible("respNombre") || isVisible("respParentesco") || isVisible("respCelular") || isVisible("respTelefono") || isVisible("respCorreo") || isVisible("acompNombre") || isVisible("acompTelefono")) && (<div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                                    <SectionTitle num="5" title="Responsable y Acompañante" />
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {isVisible("respNombre") && (
                                            <FormRow label="Nombre Responsable" error={errors.nombreResponsable}>
                                                <input {...register("nombreResponsable")} className="form-input text-sm w-full" placeholder="Nombre completo del responsable" />
                                            </FormRow>
                                        )}
                                        {isVisible("respParentesco") && (
                                            <FormRow label="Parentesco">
                                                <select {...register("parentesco")} className="form-input text-sm w-full">
                                                    <option value="">Seleccione...</option>
                                                    {PARENTESCOS.map(p => <option key={p} value={p}>{p}</option>)}
                                                </select>
                                            </FormRow>
                                        )}
                                        {isVisible("respCelular") && (
                                            <FormRow label="Celular Responsable" error={errors.celularResponsable}>
                                                <input {...register("celularResponsable")} className="form-input text-sm w-full" placeholder="Celular" />
                                            </FormRow>
                                        )}
                                        {isVisible("respTelefono") && (
                                            <FormRow label="Teléfono Responsable" error={errors.telefonoResponsable}>
                                                <input {...register("telefonoResponsable")} className="form-input text-sm w-full" placeholder="Teléfono" />
                                            </FormRow>
                                        )}
                                        {isVisible("respCorreo") && (
                                            <FormRow label="Correo Responsable" error={errors.emailResponsable}>
                                                <input {...register("emailResponsable")} className="form-input text-sm w-full" placeholder="Correo electrónico del responsable" />
                                            </FormRow>
                                        )}

                                    </div></div>
                            )}

                            {(isVisible("alertas") || isVisible("nota")) && (<div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                                    <SectionTitle num="6" title="Alertas y Notas Clínicas" />
                                    <div className="pl-0 md:pl-4 space-y-4">
                                        {isVisible("alertas") && (
                                            <div className="border border-rose-200/50 bg-rose-50/10 rounded-2xl p-6">
                                                <label className="flex items-center gap-2 text-rose-600 font-bold mb-3"><FiAlertCircle /> ALERTA MÉDICA</label>
                                                <textarea 
                                                    {...register("alertas")} 
                                                    className="w-full h-24 p-4 border border-rose-200 rounded-xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 text-sm text-slate-800 shadow-inner" 
                                                    placeholder="Escribe alergias o condiciones médicas críticas aquí..."
                                                />
                                            </div>
                                        )}
                                        
                                        {isVisible("nota") && (
                                            <div className="border border-slate-200/50 bg-slate-50/30 rounded-2xl p-6">
                                                <label className="flex items-center gap-2 text-slate-600 font-bold mb-3 text-[13px]">Notas Administrativas</label>
                                                <textarea 
                                                    {...register("notas")} 
                                                    className="w-full h-32 p-4 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 text-sm text-slate-700 shadow-inner" 
                                                    placeholder="Observaciones adicionales, seguimiento administrativo..."
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                    </div>
                </div>



                {/* BOTTOM FIX BAR */}
                <div className="px-8 py-5 bg-white border-t border-slate-200 flex justify-between items-center shrink-0 z-10 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center gap-4">
                        {initialData?.id && onDelete && (
                            <button
                                type="button"
                                onClick={() => onDelete(initialData)}
                                className="px-5 py-2.5 text-rose-500 font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-rose-50 transition-all flex items-center gap-2"
                            >
                                <FiTrash2 size={16} /> Eliminar
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="px-6 py-2.5 text-slate-500 font-bold text-xs uppercase tracking-widest rounded-lg hover:bg-slate-100 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-8 py-3 bg-[#8CC63F] text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-[#7bb335] shadow-lg shadow-[#8CC63F]/20 transition-all flex items-center gap-2"
                        >
                            {isSubmitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FiCheck size={16} />}
                            {initialData?.id ? "Guardar Cambios" : "Finalizar Registro"}
                        </button>
                    </div>
                </div>
                {showCancelConfirm && (
                    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
                        <div className="bg-white rounded-[32px] max-w-md w-full p-8 border border-slate-100 shadow-2xl animate-scaleIn relative overflow-hidden flex flex-col items-center text-center">
                            <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-600 flex items-center justify-center mb-6 shadow-inner animate-pulse">
                                <FiAlertCircle size={32} strokeWidth={2.5} />
                            </div>
                            
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mb-2">
                                ¿Descartar Cambios?
                            </h3>
                            
                            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wide leading-relaxed mb-6">
                                Tienes cambios sin guardar en este formulario. Si cancelas ahora, perderás todas las modificaciones realizadas.
                            </p>

                            <div className="flex flex-col gap-3 w-full">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCancelConfirm(false);
                                        onCancel();
                                    }}
                                    className="w-full py-3 bg-rose-600 text-white text-[11px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-rose-600/20 hover:bg-rose-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    Descartar Cambios
                                </button>
                                
                                <button
                                    type="button"
                                    onClick={() => setShowCancelConfirm(false)}
                                    className="w-full py-3 bg-slate-100 text-slate-500 text-[11px] font-black uppercase tracking-widest rounded-full hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center"
                                >
                                    Seguir Editando
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </form>
        </div>
    );
}




