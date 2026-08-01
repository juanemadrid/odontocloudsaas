import React, { useState, useEffect } from "react";
import supabase, { supabaseAdmin } from "../../lib/supabaseClient";
import ReactDOM from "react-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { DEFAULT_PERFILES } from "../../constants/DefaultProfiles";

// Singleton secondary Firebase app — prevents duplicate-app crashes
// firebaseConfig debe estar importado antes de esta función
const getSecondaryAuth = () => {
    const existing = getApps().find(app => app.name === "SecondaryAppEmpresa");
    const app = existing || initializeApp(firebaseConfig, "SecondaryAppEmpresa");
    return getAuth(app);
};
import { FiSearch, FiPlus, FiEdit2, FiTrash2, FiX, FiCheck, FiFilter, FiUser, FiArrowLeft, FiArrowRight, FiSave, FiInfo, FiMail, FiPhone, FiCreditCard, FiMapPin, FiActivity, FiLayers, FiChevronRight, FiChevronLeft, FiChevronsRight, FiChevronsLeft, FiEye, FiEyeOff, FiHelpCircle } from "react-icons/fi";
import Input from "../../components/ui/Input";

export default function EmpresaUsuarios() {
    const { userProfile } = useAuth();
    const toast = useToast();

    const getDisplayName = (u) => {
        if (u.nombreCompleto && !u.nombreCompleto.toLowerCase().includes("undefined")) {
            return u.nombreCompleto;
        }
        if (u.nombre || u.apellido) {
            const first = u.nombre || "";
            const last = u.apellido || "";
            const combined = `${first} ${last}`.trim();
            if (combined && !combined.toLowerCase().includes("undefined")) {
                return combined;
            }
        }
        if (u.displayName && !u.displayName.toLowerCase().includes("undefined")) {
            return u.displayName;
        }
        return u.rol === "administrador" ? "Administrador (Propietario)" : "Usuario Sin Nombre";
    };

    // Data States
    const [users, setUsers] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [rolesDisponibles, setRolesDisponibles] = useState([]);
    const [sucursales, setSucursales] = useState([]);
    const [specialties, setSpecialties] = useState([]); // Loaded from 'especialidades'

    // UI States
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [showDisabled, setShowDisabled] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editId, setEditId] = useState(null);
    const [searchTermAvailable, setSearchTermAvailable] = useState("");
    const [searchTermSelected, setSearchTermSelected] = useState("");
    const [searchTermSucAvailable, setSearchTermSucAvailable] = useState("");
    const [searchTermSucSelected, setSearchTermSucSelected] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [deleteConfirmModal, setDeleteConfirmModal] = useState(null); // Usuario a eliminar

    // Form State
    const initialForm = {
        nombre: "",
        apellido: "",
        email: "",
        tipoDocumento: "CC",
        numeroDocumento: "",
        telefonoMovil: "",
        telefonoFijo: "",
        direccion: "",
        genero: "Masculino",
        fechaNacimiento: "",
        esLaboratory: false, // New field from OralDrive

        // Sección Empresarial
        esDoctor: false,
        profileId: "",
        profileType: "Doctor", // New from OralDrive screenshot
        sucursales: [],
        especialidades: [],
        seeOtherDoctorsData: false, // "Puedo ver todo lo de otros doctores"
        comisionPorcentaje: 0, // "Porcentaje"
        clinicalDocsWithLogo: true, // "¿Documentos clínicos se imprimen con logo?"
        clinicalDocsHeader: "sucursal", // "sucursal" o "personalizado"
        encabezadoPersonalizado: "", // New conditional field
        formaPago: "Realizadas y pagadas", // "Forma de pago"

        password: ""
    };
    const [formData, setFormData] = useState(initialForm);

    // 1. Load Data
    const loadData = async () => {
        if (!userProfile?.inquilino) return;
        setLoading(true);
        try {
            const [uRes, sRes, cRes] = await Promise.all([
                supabase.from("profiles").select("*").eq("tenant_id", userProfile.inquilino),
                supabase.from("sucursales").select("*").eq("tenant_id", userProfile.inquilino),
                supabase.from("website_config").select("config").eq("tenant_id", userProfile.inquilino).maybeSingle()
            ]);

            const userDetailsMap = cRes.data?.config?.user_details || {};

            const profilesList = (uRes.data || []).map(u => {
                const detail = userDetailsMap[u.id] || {};
                const rawEsp = u.especialidad || (detail.especialidades ? detail.especialidades.join(", ") : "");
                const especialidadesArr = detail.especialidades || (rawEsp ? rawEsp.split(',').map(e => e.trim()).filter(Boolean) : []);
                const userSucursales = detail.sucursales || (u.sucursal_id ? [u.sucursal_id] : []);
                const rolLower = (u.role || "").toLowerCase();
                const esDoctor = detail.esDoctor ?? (rolLower.includes('doctor') || rolLower.includes('odontólog') || rolLower.includes('odontologo') || especialidadesArr.length > 0);

                let userNombre = detail.nombre || (u.full_name || "").split(" ")[0] || "";
                let userApellido = detail.apellido || (u.full_name || "").split(" ").slice(1).join(" ") || "";

                return {
                    id: u.id,
                    nombre: userNombre,
                    apellido: userApellido,
                    nombreCompleto: u.full_name,
                    email: u.email,
                    rol: u.role,
                    profileId: u.role,
                    especialidad: rawEsp,
                    especialidades: especialidadesArr,
                    sucursales: userSucursales,

                    // Campos personales y de identificación
                    tipoDocumento: detail.tipoDocumento || u.tipo_documento || "CC",
                    numeroDocumento: detail.numeroDocumento || u.registro_medico || "",
                    telefonoMovil: detail.telefonoMovil || u.telefono || "",
                    telefonoFijo: detail.telefonoFijo || "",
                    direccion: detail.direccion || "",
                    genero: detail.genero || "Femenino",
                    fechaNacimiento: detail.fechaNacimiento || "",
                    password: detail.password || "",

                    esDoctor,
                    activo: u.activo !== false,
                    ...detail
                };
            });

            const rolesList = (cRes.data?.config?.perfiles || []).map(p => ({
                id: p.nombre || p.id,
                nombre: p.nombre
            }));

            // Extraer especialidades de website_config → formato {id, nombre}
            const rawEspecialidades = cRes.data?.config?.especialidades || [];
            const defaultEspecialidades = [
                "Odontología General", "Ortodoncia", "Endodoncia", "Periodoncia",
                "Cirugía Oral", "Odontopediatría", "Estética Dental",
                "Implantología", "Rehabilitación Oral", "Patología Oral"
            ];
            const toObj = arr => arr.map(e => {
                if (typeof e === 'string') return { id: e, nombre: e };
                return { id: e.id || e.nombre || e.name, nombre: e.nombre || e.name || e.id };
            }).filter(e => e.id && e.nombre);

            const especialidadesList = toObj(rawEspecialidades);

            setUsers(profilesList);
            setRolesDisponibles(rolesList.length > 0 ? rolesList : DEFAULT_PERFILES);
            setSucursales(sRes.data || []);
            setSpecialties(especialidadesList.length > 0 ? especialidadesList : toObj(defaultEspecialidades));


        } catch (e) {
            console.error("Error al cargar usuarios desde Supabase:", e);
            if (toast?.error) toast.error("Error cargando usuarios");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [userProfile]);

    // 2. Filter Logic
    useEffect(() => {
        let res = users;
        // Search
        if (search.trim()) {
            const lower = search.toLowerCase();
            res = res.filter(u =>
                getDisplayName(u).toLowerCase().includes(lower) ||
                (u.email || "").toLowerCase().includes(lower)
            );
        }
        // Disabled toggle (Currently filtering by 'activo' flag logic implied? 
        // Screenshot implies a toggle to SHOW disabled. Usually we show actives by default.
        // Let's assume most users are active. If 'activo' is false they are disabled.
        if (!showDisabled) {
            res = res.filter(u => u.activo !== false); // Show only active
        } else {
            // Show all or only disabled? Usually "Deshabilitados" button TOGGLES view to show them.
            // Let's make it filter to SHOW disabled ones if button is active? Or show ALL?
            // Screenshot: Blue button "Deshabilitados". Likely a filter. 
            // Let's assume clicking it shows the disabled list.
            res = res.filter(u => u.activo === false);
        }

        // Wait, if button is inactive (default), show actives. If active, show disabled? 
        // Or show ALL? Let's implement: Default = Show Active. Toggle ON = Show Inactive.

        setFiltered(res);
    }, [users, search, showDisabled]);

    // 3. Handlers
    const handleOpenModal = async (user = null) => {
        if (user) {
            setEditId(user.id);
            
            let userNombre = user.nombre || "";
            let userApellido = user.apellido || "";
            if (!userNombre && !userApellido && user.displayName) {
                const parts = user.displayName.trim().split(/\s+/);
                if (parts.length >= 2) {
                    userNombre = parts[0];
                    userApellido = parts.slice(1).join(" ");
                } else if (parts.length === 1) {
                    userNombre = parts[0];
                }
            }

            setFormData({
                ...initialForm,
                nombre: userNombre,
                apellido: userApellido,
                email: user.email || "",
                tipoDocumento: user.tipoDocumento || "CC",
                numeroDocumento: user.numeroDocumento || "",
                telefonoMovil: user.telefonoMovil || "",
                telefonoFijo: user.telefonoFijo || "",
                direccion: user.direccion || "",
                genero: user.genero || "Femenino",
                fechaNacimiento: user.fechaNacimiento || "",
                esDoctor: user.esDoctor || false,
                esLaboratory: user.esLaboratory || false,
                seeOtherDoctorsData: user.seeOtherDoctorsData || false,
                comisionPorcentaje: user.comisionPorcentaje || 0,
                clinicalDocsWithLogo: user.clinicalDocsWithLogo !== undefined ? user.clinicalDocsWithLogo : true,
                clinicalDocsHeader: user.clinicalDocsHeader || "sucursal",
                encabezadoPersonalizado: user.encabezadoPersonalizado || "",
                formaPago: user.formaPago || "Realizadas y pagadas",

                profileId: user.profileId || "",
                sucursales: user.sucursales || [],
                especialidades: user.especialidades || [],
                password: user.password || ""
            });
        } else {
            // Validar límite máximo de usuarios del plan de la clínica
            const tenantPlanObj = userProfile?.tenant?.plan || {};
            const maxUsersLimit = tenantPlanObj.maxUsers || 2;
            const currentCount = users.length;

            if (currentCount >= maxUsersLimit) {
                return toast.error(`⚠️ Has alcanzado el límite máximo de ${maxUsersLimit} usuario(s) de tu plan actual (${tenantPlanObj.name || 'Consultorio'}). Actualiza tu plan para agregar más usuarios.`);
            }

            setEditId(null);
            setFormData(initialForm);
        }
        setModalOpen(true);
    };

    const toggleSelection = (key, id) => {
        setFormData(prev => ({
            ...prev,
            [key]: prev[key].includes(id)
                ? prev[key].filter(x => x !== id)
                : [...prev[key], id]
        }));
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (!formData.nombre.trim()) return toast.error("El nombre es obligatorio");
        if (!formData.email.trim()) return toast.error("El correo electrónico es obligatorio");

        const targetEmail = formData.email.trim().toLowerCase();

        // 1. Validar duplicación de correo en la lista local de usuarios (excluyendo el usuario actual editado)
        const emailDuplicateInMemory = users.find(u => (u.email || "").trim().toLowerCase() === targetEmail && u.id !== editId);
        if (emailDuplicateInMemory) {
            return toast.error(`⚠️ El correo "${targetEmail}" ya pertenece a otro usuario registrado (${emailDuplicateInMemory.nombreCompleto || emailDuplicateInMemory.email}). Por favor ingresa un correo diferente.`);
        }

        // Validar límite de usuarios antes de guardar un nuevo usuario
        if (!editId) {
            const tenantPlanObj = userProfile?.tenant?.plan || {};
            const maxUsersLimit = tenantPlanObj.maxUsers || 2;
            const currentCount = users.length;
            if (currentCount >= maxUsersLimit) {
                return toast.error(`⚠️ Has alcanzado el límite máximo de ${maxUsersLimit} usuario(s) de tu plan actual (${tenantPlanObj.name || 'Consultorio'}). Actualiza tu plan para agregar más usuarios.`);
            }
        }

        setSaving(true);
        try {
            // 2. Validar duplicación de correo en la base de datos (tabla profiles)
            const { data: dbCheck } = await supabase
                .from("profiles")
                .select("id, full_name, email")
                .ilike("email", targetEmail);

            const dbDuplicate = dbCheck?.find(p => p.id !== editId);
            if (dbDuplicate) {
                setSaving(false);
                return toast.error(`⚠️ El correo "${targetEmail}" ya se encuentra registrado por otro usuario (${dbDuplicate.full_name || dbDuplicate.email}).`);
            }

            const selectedProfile = rolesDisponibles.find(r => r.id === formData.profileId || r.nombre === formData.profileId);
            const fullName = `${formData.nombre} ${formData.apellido}`.trim();
            const roleName = editId && users.find(u => u.id === editId)?.rol === "administrador" ? "administrador" : (selectedProfile?.nombre || formData.profileId || "Usuario");

            let targetId = editId || crypto.randomUUID();

            if (!editId) {
                if (!formData.password || formData.password.length < 8) {
                    setSaving(false);
                    return toast.error('La contraseña debe tener mínimo 8 caracteres para crear el usuario');
                }
            }

            // Usar RPC SECURITY DEFINER para crear/actualizar profiles + auth.users directamente
            let saveSuccess = false;
            try {
                const { data: rpcResult, error: rpcErr } = await supabase.rpc('admin_upsert_profile', {
                    p_id: editId || null,
                    p_tenant_id: userProfile.inquilino,
                    p_full_name: fullName,
                    p_email: targetEmail,
                    p_role: roleName,
                    p_especialidad: (formData.especialidades || []).join(', ') || null,
                    p_registro_medico: formData.numeroDocumento || null,
                    p_telefono: formData.telefonoMovil || formData.telefonoFijo || null,
                    p_activo: true,
                    p_password: formData.password ? formData.password.trim() : null
                });

                if (rpcErr) throw rpcErr;

                const resObj = typeof rpcResult === 'string' ? JSON.parse(rpcResult) : rpcResult;
                if (resObj && resObj.success === false) {
                    const errStr = (resObj.error || '').toLowerCase();
                    if (errStr.includes('registrado') || errStr.includes('exists') || errStr.includes('duplicado') || errStr.includes('unique')) {
                        toast.error(`⚠️ El correo "${targetEmail}" ya tiene una cuenta registrada en el sistema. No se pueden duplicar usuarios.`);
                        setSaving(false);
                        return;
                    }
                    throw new Error(resObj.error || 'Error al guardar perfil');
                }
                if (resObj?.id) {
                    targetId = resObj.id;
                }
                saveSuccess = true;
            } catch (rpcError) {
                console.warn('⚠️ admin_upsert_profile RPC error, realizando fallback:', rpcError);
                if (rpcError.message && (rpcError.message.toLowerCase().includes('registrado') || rpcError.message.toLowerCase().includes('exists'))) {
                    toast.error(`⚠️ El correo "${targetEmail}" ya tiene una cuenta registrada en el sistema. No se pueden duplicar usuarios.`);
                    setSaving(false);
                    return;
                }

                // Fallback directo a la tabla profiles
                const { error: profileErr } = await supabase
                    .from('profiles')
                    .upsert({
                        id: targetId,
                        tenant_id: userProfile.inquilino,
                        full_name: fullName,
                        email: targetEmail,
                        role: roleName,
                        especialidad: (formData.especialidades || []).join(', ') || null,
                        registro_medico: formData.numeroDocumento || null,
                        telefono: formData.telefonoMovil || formData.telefonoFijo || null,
                        activo: true
                    }, { onConflict: 'id' });

                if (profileErr) {
                    console.error('Error al guardar en tabla profiles:', profileErr);
                }
            }

            // Guardar configuración extendida de usuario (sucursales, especialidades, etc.) en website_config
            try {
                const { data: cfgData } = await supabase
                    .from("website_config")
                    .select("config")
                    .eq("tenant_id", userProfile.inquilino)
                    .maybeSingle();

                const currentConfig = cfgData?.config || {};
                const userDetails = currentConfig.user_details || {};

                userDetails[targetId] = {
                    nombre: formData.nombre,
                    apellido: formData.apellido,
                    tipoDocumento: formData.tipoDocumento || "CC",
                    numeroDocumento: formData.numeroDocumento || "",
                    telefonoMovil: formData.telefonoMovil || "",
                    telefonoFijo: formData.telefonoFijo || "",
                    direccion: formData.direccion || "",
                    genero: formData.genero || "Femenino",
                    fechaNacimiento: formData.fechaNacimiento || "",
                    password: formData.password || userDetails[targetId]?.password || "",
                    sucursales: formData.sucursales || [],
                    especialidades: formData.especialidades || [],
                    esDoctor: formData.esDoctor || false,
                    esLaboratory: formData.esLaboratory || false,
                    seeOtherDoctorsData: formData.seeOtherDoctorsData || false,
                    comisionPorcentaje: formData.comisionPorcentaje || 0,
                    clinicalDocsWithLogo: formData.clinicalDocsWithLogo !== undefined ? formData.clinicalDocsWithLogo : true,
                    clinicalDocsHeader: formData.clinicalDocsHeader || "sucursal",
                    encabezadoPersonalizado: formData.encabezadoPersonalizado || "",
                    formaPago: formData.formaPago || "Realizadas y pagadas"
                };

                await supabase
                    .from("website_config")
                    .upsert({
                        tenant_id: userProfile.inquilino,
                        config: {
                            ...currentConfig,
                            user_details: userDetails
                        }
                    }, { onConflict: "tenant_id" });
            } catch (cfgErr) {
                console.warn("Error guardando detalles extendidos en website_config:", cfgErr);
            }

            toast.success(editId ? 'Usuario actualizado correctamente' : 'Usuario creado con éxito');
            setModalOpen(false);
            loadData();
        } catch (error) {
            console.error('Error al guardar usuario:', error);
            const errMsg = error.message || '';
            if (errMsg.includes('users_email_partial_key') || errMsg.includes('duplicate key') || errMsg.includes('already registered') || errMsg.includes('ya está registrado')) {
                toast.error('⚠️ Este correo electrónico ya está registrado por otro usuario en el sistema. Por favor utiliza un correo diferente.');
            } else if (errMsg.includes('Could not find the function') || error.code === 'PGRST202') {
                toast.error('⚠️ Falta ejecutar la función RPC en Supabase.');
            } else {
                toast.error('Error al guardar usuario: ' + (errMsg || 'Error desconocido'));
            }
        } finally {
            setSaving(false);
        }
    };


    const handleDisable = async (u) => {
        if (!window.confirm(`¿${u.activo ? 'Deshabilitar' : 'Habilitar'} usuario "${u.nombreCompleto || u.email}"?`)) return;
        try {
            const { data: rpcResult, error } = await supabase.rpc('admin_toggle_profile_active', {
                p_id: u.id,
                p_activo: !u.activo
            });
            if (error) throw error;
            if (rpcResult?.success === false) throw new Error(rpcResult.error);
            toast.success('Estado de usuario actualizado correctamente');
            loadData();
        } catch (e) {
            console.error('Error al cambiar estado:', e);
            toast.error('Error al cambiar estado de usuario: ' + (e.message || ''));
        }
    };


    const handleDelete = async (u) => {
        if (u.rol === "administrador") {
            return toast.error("⛔ No se puede eliminar un usuario administrador");
        }
        setDeleteConfirmModal(u);
    };

    const confirmDelete = async () => {
        if (!deleteConfirmModal) return;
        const u = deleteConfirmModal;
        
        try {
            const { data: rpcResult, error } = await supabase.rpc('admin_delete_profile', { p_id: u.id });
            if (error) throw error;
            if (rpcResult?.success === false) throw new Error(rpcResult.error);

            toast.success(`Usuario "${u.nombreCompleto || u.email}" eliminado correctamente`);
            setUsers(prev => prev.filter(usr => String(usr.id) !== String(u.id)));
            setDeleteConfirmModal(null);
            loadData();
        } catch (e) {
            console.error('Error al eliminar usuario:', e);
            toast.error('Error al eliminar usuario: ' + (e.message || ''));
        }
    };


    const cancelDelete = () => {
        console.log("❌ Usuario canceló la eliminación");
        setDeleteConfirmModal(null);
    };

    return (
        <div className="p-4 max-w-6xl mx-auto space-y-4">
            {/* Toolbar / Search Header */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FiUser size={18} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-[16px] font-bold text-slate-800 tracking-tight">Usuarios y Talento Humano</h1>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#8CC63F]/15 border border-[#8CC63F]/30 text-[#5da832]">
                                {users.length} / {userProfile?.tenant?.plan?.maxUsers || 2} usuarios (Plan {userProfile?.tenant?.plan?.name || 'Consultorio'})
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">Gestión de profesionales, perfiles y accesos a la clínica</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                    {/* Status Toggle */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button
                            onClick={() => setShowDisabled(false)}
                            className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer border-0 ${!showDisabled ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800 bg-transparent'}`}
                        >
                            Activos
                        </button>
                        <button
                            onClick={() => setShowDisabled(true)}
                            className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer border-0 ${showDisabled ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800 bg-transparent'}`}
                        >
                            Deshabilitados
                        </button>
                    </div>

                    {/* Search Input */}
                    <div className="relative flex-1 md:w-56">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full h-8 pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-800 outline-none focus:bg-white focus:border-blue-500 transition-colors"
                        />
                    </div>

                    {/* New User Button */}
                    <button
                        onClick={() => handleOpenModal()}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border-0 shrink-0"
                    >
                        <FiPlus size={16} />
                        <span>Nuevo Miembro</span>
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                            <th className="py-2.5 px-4">Miembro / Contacto</th>
                            <th className="py-2.5 px-4">Perfil / Rol</th>
                            <th className="py-2.5 px-4">Estado Profesional</th>
                            <th className="py-2.5 px-4 text-right">Operaciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[12px] text-slate-700">
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                                    <div className="w-5 h-5 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                                    Sincronizando equipo de trabajo...
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-12 text-center text-slate-400 font-medium">
                                    No se encontraron usuarios registrados
                                </td>
                            </tr>
                        ) : (
                            filtered.map((u) => (
                                <tr key={u.id} className={`hover:bg-slate-50/80 transition-colors ${u.activo === false ? 'opacity-60 bg-slate-50/40' : ''}`}>
                                    <td className="py-2.5 px-4">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${u.activo === false ? 'bg-slate-200 text-slate-500' : 'bg-blue-50 text-blue-600'}`}>
                                                {(() => {
                                                    const name = getDisplayName(u);
                                                    const parts = name.split(" ");
                                                    if (parts.length >= 2) {
                                                        return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
                                                    }
                                                    return name.charAt(0).toUpperCase();
                                                })()}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800 uppercase">{getDisplayName(u)}</span>
                                                <span className="text-[10px] text-slate-400">{u.email}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-700 uppercase">{u.profileName || u.rol || "Sin perfil"}</span>
                                            <span className="text-[10px] text-slate-400">
                                                {u.sucursales?.length || 0} sucursales asignadas
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-2.5 px-4">
                                        {u.esDoctor ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                <FiCheck size={10} /> Médico / Profesional
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                                                No Asistencial
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-2.5 px-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => handleDisable(u)}
                                                className={`w-7 h-7 rounded-lg text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0 ${u.activo === false ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-amber-500 hover:bg-amber-600'}`}
                                                title={u.activo === false ? "Habilitar Usuario" : "Deshabilitar Usuario"}
                                            >
                                                <FiActivity size={13} />
                                            </button>
                                            <button
                                                onClick={() => handleOpenModal(u)}
                                                className="w-7 h-7 rounded-lg bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                title="Editar Usuario"
                                            >
                                                <FiEdit2 size={13} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(u)}
                                                className="w-7 h-7 rounded-lg bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-sm cursor-pointer border-0"
                                                title="Eliminar Usuario"
                                            >
                                                <FiTrash2 size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {modalOpen && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-4xl h-[88vh] rounded-xl overflow-hidden shadow-2xl flex flex-col border border-slate-200">
                        {/* Header limpio consistente con el estilo de config */}
                        <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <FiUser size={18} />
                                </div>
                                <div>
                                    <h2 className="text-[16px] font-bold text-slate-800">
                                        {editId ? "Editar Usuario" : "Nuevo Usuario"}
                                    </h2>
                                    <p className="text-[10px] text-slate-400">Gestión de accesos y privilegios</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                            >
                                <FiX size={18} />
                            </button>
                        </div>

                        {/* Cuerpo del modal */}
                        <div className="flex-1 overflow-hidden relative bg-slate-50">
                            <form onSubmit={handleSave} autoComplete="off" className="h-full overflow-y-auto custom-scrollbar p-4 pb-20 space-y-3">
                                {/* Campos ocultos para evitar autofill agresivo del navegador */}
                                <input type="text" name="prevent_autofill_username" style={{ display: 'none' }} tabIndex={-1} readOnly />
                                <input type="password" name="prevent_autofill_password" style={{ display: 'none' }} tabIndex={-1} readOnly />

                                {/* BLOQUE 1: INFORMACIÓN BÁSICA */}
                                <section className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-3">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                                <FiUser size={18} />
                                            </div>
                                            <div>
                                                <h4 className="text-[13px] font-semibold text-slate-800">Información básica</h4>
                                                <p className="text-[10px] text-slate-400">Datos personales de identificación</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                                            <label className="text-[11px] font-medium text-slate-500">¿Es laboratorio o centro diagnóstico?</label>
                                            <button type="button" onClick={() => setFormData({ ...formData, esLaboratory: !formData.esLaboratory })} className={`w-10 h-5 rounded-full transition-all duration-300 relative shrink-0 ${formData.esLaboratory ? "bg-blue-600" : "bg-slate-200"}`}>
                                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm ${formData.esLaboratory ? "left-6" : "left-1"}`} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Fila 1: Nombre y Apellido */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-500">Nombre *</label>
                                            <Input type="text" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} required placeholder="Ingrese nombre" className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-3 text-[13px] text-slate-800 focus:bg-white focus:border-blue-400 outline-none transition-all" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-500">Apellido *</label>
                                            <Input type="text" value={formData.apellido} onChange={e => setFormData({ ...formData, apellido: e.target.value })} required placeholder="Ingrese apellidos" className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-3 text-[13px] text-slate-800 focus:bg-white focus:border-blue-400 outline-none transition-all" />
                                        </div>
                                    </div>

                                    {/* Fila 2: Tipo documento y Número de documento */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-500">Tipo de documento</label>
                                            <select value={formData.tipoDocumento} onChange={e => setFormData({ ...formData, tipoDocumento: e.target.value })} className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-3 text-[13px] text-slate-800 outline-none focus:border-blue-400 transition-all">
                                                <option value="Cédula de ciudadanía">Cédula de ciudadanía</option>
                                                <option value="Cédula de extranjería">Cédula de extranjería</option>
                                                <option value="Pasaporte">Pasaporte</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-500">Número de documento *</label>
                                            <Input type="text" value={formData.numeroDocumento} onChange={e => setFormData({ ...formData, numeroDocumento: e.target.value })} required placeholder="Ej: 12345678" className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-3 text-[13px] text-slate-800 focus:bg-white focus:border-blue-400 outline-none transition-all" />
                                        </div>
                                    </div>

                                    {/* Fila 3: Teléfonos */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-500">Teléfono móvil *</label>
                                            <Input type="text" value={formData.telefonoMovil} onChange={e => setFormData({ ...formData, telefonoMovil: e.target.value })} required placeholder="Ej: 310..." className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-3 text-[13px] text-slate-800 focus:bg-white focus:border-blue-400 outline-none transition-all" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-500">Teléfono fijo</label>
                                            <Input type="text" value={formData.telefonoFijo} onChange={e => setFormData({ ...formData, telefonoFijo: e.target.value })} placeholder="Ej: 601..." className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-3 text-[13px] text-slate-800 focus:bg-white focus:border-blue-400 outline-none transition-all" />
                                        </div>
                                    </div>

                                    {/* Fila 4: Género y Fecha de nacimiento */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-500">Género *</label>
                                            <select value={formData.genero} onChange={e => setFormData({ ...formData, genero: e.target.value })} className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-3 text-[13px] text-slate-800 outline-none focus:border-blue-400 transition-all">
                                                <option value="Femenino">Femenino</option>
                                                <option value="Masculino">Masculino</option>
                                                <option value="Otro">Otro</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-500">Fecha de nacimiento *</label>
                                            <Input type="date" value={formData.fechaNacimiento} onChange={e => setFormData({ ...formData, fechaNacimiento: e.target.value })} required className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-3 text-[13px] text-slate-800 focus:bg-white focus:border-blue-400 outline-none transition-all" />
                                        </div>
                                    </div>

                                    {/* Fila 5: Dirección (ancho completo) */}
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-medium text-slate-500">Dirección</label>
                                        <Input type="text" value={formData.direccion} onChange={e => setFormData({ ...formData, direccion: e.target.value })} placeholder="Dirección de residencia" className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-3 text-[13px] text-slate-800 focus:bg-white focus:border-blue-400 outline-none transition-all" />
                                    </div>
                                </section>


                                {/* BLOQUE 2: INFORMACIÓN EMPRESARIAL */}
                                <section className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-3">
                                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                            <FiLayers size={18} />
                                        </div>
                                        <div>
                                            <h4 className="text-[13px] font-semibold text-slate-800">Información empresarial</h4>
                                            <p className="text-[10px] text-slate-400">Configuración de rol y prestaciones</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                <div className="space-y-0.5">
                                                    <span className="text-[12px] font-semibold text-slate-700">Es doctor</span>
                                                </div>
                                                <button type="button" onClick={() => setFormData({ ...formData, esDoctor: !formData.esDoctor })} className={`w-12 h-6 rounded-full transition-all duration-500 relative ${formData.esDoctor ? "bg-emerald-500" : "bg-slate-200"}`}>
                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-500 shadow-sm ${formData.esDoctor ? "left-7" : "left-1"}`} />
                                                </button>
                                            </div>

                                            {formData.esDoctor && (
                                                <div className="space-y-4 animate-in slide-in-from-left-2 transition-all">
                                                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 transition-all">
                                                        <span className="text-[12px] font-medium text-slate-700">Puede ver todo lo de otros doctores</span>
                                                        <button type="button" onClick={() => setFormData({ ...formData, seeOtherDoctorsData: !formData.seeOtherDoctorsData })} className={`w-10 h-5 rounded-full transition-all duration-300 relative ${formData.seeOtherDoctorsData ? "bg-blue-600" : "bg-slate-300"}`}>
                                                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${formData.seeOtherDoctorsData ? "left-6" : "left-1"}`} />
                                                        </button>
                                                    </div>

                                                    <div className="space-y-1 transition-all">
                                                        <label className="text-[11px] font-medium text-slate-500">Porcentaje</label>
                                                        <Input type="number" value={formData.comisionPorcentaje} onChange={e => setFormData({ ...formData, comisionPorcentaje: e.target.value })} placeholder="0" className="h-8 bg-white border-slate-200 rounded-lg px-4 font-black text-blue-600 text-[16px] shadow-sm" />
                                                    </div>

                                                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 transition-all">
                                                        <span className="text-[12px] font-medium text-slate-700">¿Documentos clinicos se imprimen con logo?</span>
                                                        <button type="button" onClick={() => setFormData({ ...formData, clinicalDocsWithLogo: !formData.clinicalDocsWithLogo })} className={`w-10 h-5 rounded-full transition-all duration-300 relative ${formData.clinicalDocsWithLogo ? "bg-blue-600" : "bg-slate-300"}`}>
                                                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${formData.clinicalDocsWithLogo ? "left-6" : "left-1"}`} />
                                                        </button>
                                                    </div>

                                                    <div className="space-y-1 transition-all">
                                                        <label className="text-[11px] font-medium text-slate-500">Cabecera documentos clínicos</label>
                                                        <div className="flex bg-slate-100 p-1 rounded-lg">
                                                            <button type="button" onClick={() => setFormData({ ...formData, clinicalDocsHeader: "sucursal" })} className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${formData.clinicalDocsHeader === "sucursal" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"}`}>Sucursal</button>
                                                            <button type="button" onClick={() => setFormData({ ...formData, clinicalDocsHeader: "personalizado" })} className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${formData.clinicalDocsHeader === "personalizado" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"}`}>Personalizado</button>
                                                        </div>
                                                    </div>

                                                    {formData.clinicalDocsHeader === 'personalizado' && (
                                                        <div className="space-y-1.5 animate-in slide-in-from-top-2 transition-all">
                                                            <div className="flex items-center gap-2 ml-1">
                                                                <label className="text-[11px] font-medium text-slate-400">Encabezado personalizado</label>
                                                                <FiHelpCircle size={12} className="text-slate-300 cursor-help" title="Este encabezado se usará en impresiones clínicas" />
                                                            </div>
                                                            <textarea 
                                                                value={formData.encabezadoPersonalizado}
                                                                onChange={e => setFormData({ ...formData, encabezadoPersonalizado: e.target.value })}
                                                                placeholder="Escriba el encabezado que aparecerá en los documentos..."
                                                                className="w-full h-24 p-4 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 text-[12px] shadow-sm focus:border-blue-500 focus:bg-white outline-none transition-all caret-black custom-scrollbar resize-none"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-3">
                                            <div className="space-y-1">
                                                <label className="text-[11px] font-semibold text-slate-500">Forma de pago</label>
                                                <select value={formData.formaPago} onChange={e => setFormData({ ...formData, formaPago: e.target.value })} className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-3 text-[13px] text-slate-800 outline-none focus:border-blue-400 transition-all">
                                                    <option value="Realizadas y pagadas">Realizadas y pagadas</option>
                                                    <option value="Solo realizadas">Solo realizadas</option>
                                                </select>
                                            </div>

                                            <div className="space-y-1">
                                                <label className="text-[11px] font-semibold text-slate-500">Tipo de perfil *</label>
                                                {(() => {
                                                    const isEditingAdmin = editId && users.find(u => u.id === editId)?.rol === "administrador";
                                                    if (isEditingAdmin) {
                                                        return (
                                                            <input 
                                                                type="text" 
                                                                readOnly 
                                                                value="Administrador (Propietario)" 
                                                                className="w-full h-8 bg-slate-100 border border-slate-200 rounded-xl px-4 font-black text-[11px] text-slate-500 cursor-not-allowed outline-none"
                                                            />
                                                        );
                                                    }
                                                    return (
                                                        <select required value={formData.profileId} onChange={e => setFormData({ ...formData, profileId: e.target.value })} className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-3 font-black text-[11px] text-slate-700 focus:border-blue-500 transition-all">
                                                            <option value="">Seleccione perfil...</option>
                                                            {rolesDisponibles.map(p => (
                                                                <option key={p.id} value={p.id}>{p.nombre}</option>
                                                            ))}
                                                        </select>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    {formData.esDoctor && (
                                        <div className="space-y-3 animate-in fade-in transition-all">
                                            <div className="flex items-center gap-2 mb-1">
                                                <FiActivity size={16} className="text-blue-500" />
                                                <label className="text-[10px] font-black text-slate-700 uppercase tracking-[0.2em]">Especializaciones *</label>
                                            </div>

                                            <div className="grid grid-cols-1 xl:grid-cols-[1fr,30px,1fr] gap-3">
                                                <div className="flex flex-col bg-slate-50 rounded-xl border border-slate-100 overflow-hidden h-52">
                                                    <div className="px-4 py-2 border-b border-slate-100 bg-white/50 space-y-1.5">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Especializaciones disponibles</span>
                                                        <div className="relative">
                                                            <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                                                            <input type="text" placeholder="Filtrar..." value={searchTermAvailable} onChange={e => setSearchTermAvailable(e.target.value)} className="w-full h-7 pl-8 pr-3 bg-white border border-slate-200 rounded-md text-[10px] font-bold outline-none focus:border-blue-400" />
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
                                                        {specialties
                                                            .filter(s => !formData.especialidades.includes(s.id) && s.nombre.toLowerCase().includes(searchTermAvailable.toLowerCase()))
                                                            .map(s => (
                                                                <button key={s.id} type="button" onClick={() => toggleSelection('especialidades', s.id)} className="w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-white hover:text-blue-600 border border-transparent transition-all group/it">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="truncate">{s.nombre.toUpperCase()}</span>
                                                                        <FiPlus className="opacity-0 group-hover/it:opacity-100 text-blue-500" />
                                                                    </div>
                                                                </button>
                                                            ))}
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-center opacity-10">
                                                    <FiChevronsRight size={18} className="hidden xl:block" />
                                                </div>

                                                <div className="flex flex-col bg-blue-50/10 rounded-xl border border-blue-200/40 overflow-hidden h-52">
                                                    <div className="px-4 py-2 border-b border-blue-100 bg-blue-50/30 space-y-1.5">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Seleccionadas</span>
                                                        </div>
                                                        <div className="relative">
                                                            <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-blue-300" size={12} />
                                                            <input type="text" placeholder="Buscar..." value={searchTermSelected} onChange={e => setSearchTermSelected(e.target.value)} className="w-full h-7 pl-8 pr-3 bg-white border border-blue-100 rounded-md text-[10px] font-bold outline-none focus:border-blue-400" />
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
                                                        {specialties
                                                            .filter(s => formData.especialidades.includes(s.id) && s.nombre.toLowerCase().includes(searchTermSelected.toLowerCase()))
                                                            .map(s => (
                                                                <button key={s.id} type="button" onClick={() => toggleSelection('especialidades', s.id)} className="w-full text-left px-3 py-2 rounded-lg text-[10px] font-black bg-white text-blue-800 shadow-sm border border-blue-100 hover:bg-red-50 hover:text-red-600 transition-all group/sel">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="truncate">{s.nombre.toUpperCase()}</span>
                                                                        <FiX className="opacity-0 group-hover/sel:opacity-100" />
                                                                    </div>
                                                                </button>
                                                            ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </section>

                                {/* BLOQUE 3: SUCURSALES */}
                                <section className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-3">
                                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                                            <FiMapPin size={18} />
                                        </div>
                                        <div>
                                            <h4 className="text-[13px] font-semibold text-slate-800">Acceso a Sucursales</h4>
                                            <p className="text-[10px] text-slate-400">Puntos de atención autorizados</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 xl:grid-cols-[1fr,30px,1fr] gap-3">
                                        <div className="flex flex-col bg-slate-50 rounded-xl border border-slate-100 overflow-hidden h-52">
                                            <div className="px-4 py-2 border-b border-slate-100 bg-white/50 space-y-1.5">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sucursales disponibles</span>
                                                <div className="relative">
                                                    <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                                                    <input type="text" placeholder="Filtrar..." value={searchTermSucAvailable} onChange={e => setSearchTermSucAvailable(e.target.value)} className="w-full h-7 pl-8 pr-3 bg-white border border-slate-200 rounded-md text-[10px] font-bold outline-none focus:border-blue-400" />
                                                </div>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
                                                {sucursales
                                                    .filter(s => !formData.sucursales.includes(s.id) && s.nombre.toLowerCase().includes(searchTermSucAvailable.toLowerCase()))
                                                    .map(s => (
                                                        <button key={s.id} type="button" onClick={() => toggleSelection('sucursales', s.id)} className="w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold text-slate-600 hover:bg-white hover:text-blue-600 border border-transparent transition-all group/suc">
                                                            <div className="flex items-center justify-between">
                                                                <span className="truncate">{s.nombre.toUpperCase()}</span>
                                                                <FiPlus className="opacity-0 group-hover/suc:opacity-100 text-blue-500" />
                                                            </div>
                                                        </button>
                                                    ))}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-center opacity-10">
                                            <FiArrowRight size={18} className="hidden xl:block" />
                                        </div>

                                        <div className="flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden h-52 shadow-sm">
                                            <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 space-y-1.5">
                                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Acceso Autorizado</span>
                                                <div className="relative">
                                                    <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                                                    <input type="text" placeholder="Buscar..." value={searchTermSucSelected} onChange={e => setSearchTermSucSelected(e.target.value)} className="w-full h-7 pl-8 pr-3 bg-white border border-slate-200 rounded-md text-[10px] font-bold text-slate-700 outline-none focus:border-blue-500 caret-black" />
                                                </div>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
                                                {sucursales
                                                    .filter(s => formData.sucursales.includes(s.id) && s.nombre.toLowerCase().includes(searchTermSucSelected.toLowerCase()))
                                                    .map(s => (
                                                        <button key={s.id} type="button" onClick={() => toggleSelection('sucursales', s.id)} className="w-full text-left px-3 py-2 rounded-lg text-[10px] font-black bg-blue-50 text-blue-700 hover:bg-red-50 hover:text-red-600 transition-all group/sel border border-blue-100 hover:border-red-100">
                                                            <div className="flex items-center justify-between">
                                                                <span className="truncate">{s.nombre.toUpperCase()}</span>
                                                                <FiX className="opacity-0 group-hover/sel:opacity-100" />
                                                            </div>
                                                        </button>
                                                    ))}
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* BLOQUE 4: DATOS DE SESIÓN */}
                                <section className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 space-y-3">
                                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                            <FiActivity size={18} />
                                        </div>
                                        <div>
                                            <h4 className="text-[13px] font-semibold text-slate-800">Datos de sesión</h4>
                                            <p className="text-[10px] text-slate-400">Credenciales de acceso al sistema</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div className="space-y-2.5">
                                            <label className="text-[11px] font-medium text-slate-500">Correo electrónico *</label>
                                            <div className="relative">
                                                <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                <input 
                                                    type="email" 
                                                    name="new_user_email_field"
                                                    autoComplete="new-password"
                                                    value={formData.email} 
                                                    onChange={e => setFormData({ ...formData, email: e.target.value })} 
                                                    required 
                                                    placeholder="usuario@clinica.com" 
                                                    className={`w-full h-9 bg-slate-50 border ${formData.email && users.some(u => u.email?.toLowerCase() === formData.email.trim().toLowerCase() && u.id !== editId) ? 'border-red-500 text-red-600 bg-red-50/20' : 'border-slate-200 focus:border-blue-500'} focus:bg-white rounded-xl pl-11 pr-4 font-bold text-[13px] text-slate-700 outline-none transition-all caret-black`} 
                                                />
                                            </div>
                                            {(() => {
                                                const isDup = formData.email.trim() && users.some(u => u.email?.toLowerCase() === formData.email.trim().toLowerCase() && u.id !== editId);
                                                if (isDup) {
                                                    return (
                                                        <p className="text-[10px] font-bold text-red-500 flex items-center gap-1 mt-1">
                                                            <span>⚠️ Este correo ya está registrado por otro usuario.</span>
                                                        </p>
                                                    );
                                                }
                                                return (
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">Este correo se usa para iniciar sesión</p>
                                                );
                                            })()}
                                        </div>

                                        <div className="space-y-2.5">
                                            <label className="text-[11px] font-medium text-slate-500">Contraseña *</label>
                                            <div className="relative">
                                                <input 
                                                    type={showPassword ? "text" : "password"} 
                                                    name="new_user_password_field"
                                                    autoComplete="new-password"
                                                    value={formData.password} 
                                                    onChange={e => setFormData({ ...formData, password: e.target.value })} 
                                                    required={!editId} 
                                                    minLength={8}
                                                    placeholder="Mínimo 8 caracteres" 
                                                    className={`w-full h-9 bg-slate-50 border ${formData.password && formData.password.length > 0 && formData.password.length < 8 ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-blue-500'} focus:bg-white rounded-xl pl-4 pr-12 font-bold text-[13px] text-slate-700 outline-none transition-all caret-black`}
                                                />
                                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all">
                                                    {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                                                </button>
                                            </div>
                                            {formData.password && formData.password.length > 0 && formData.password.length < 8 && (
                                                <p className="text-[10px] font-semibold text-red-500 pl-1 mt-1">
                                                    Faltan {8 - formData.password.length} caracteres
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </section>
                            </form>
                        </div>

                        {/* Footer limpio */}
                        <div className="bg-white px-5 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] text-slate-400">Validación en tiempo real</span>
                                <div className="h-3 w-px bg-slate-200" />
                                <span className="text-[10px] text-slate-400">Los cambios se aplicarán al próximo inicio de sesión</span>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setModalOpen(false)}
                                    className="px-4 py-2 rounded-lg text-[12px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[13px] font-semibold shadow-sm transition-all disabled:opacity-50"
                                >
                                    {saving ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <FiSave size={15} />
                                            <span>{editId ? "Guardar cambios" : "Crear usuario"}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {deleteConfirmModal && ReactDOM.createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="bg-red-50 px-8 py-6 rounded-t-3xl border-b border-red-100">
                            <div className="flex items-center gap-3">
                                <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center">
                                    <FiTrash2 size={28} className="text-red-600" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-red-900 uppercase tracking-tight">Eliminar Usuario</h3>
                                    <p className="text-sm font-bold text-red-600">Acción Permanente</p>
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="px-8 py-6 space-y-4">
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                <p className="text-sm font-bold text-slate-700">
                                    ¿Está seguro de eliminar <span className="font-black text-red-600">{deleteConfirmModal.nombreCompleto || deleteConfirmModal.nombre}</span>?
                                </p>
                            </div>
                            
                            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex gap-3">
                                <FiInfo className="text-yellow-600 shrink-0 mt-0.5" size={20} />
                                <div className="text-xs font-bold text-slate-600 space-y-1">
                                    <p>⚠️ Esta acción NO se puede deshacer</p>
                                    <p>• Se eliminará el usuario de la base de datos</p>
                                    <p>• Se perderán todos sus datos asociados</p>
                                    {deleteConfirmModal.esDoctor && <p>• Se eliminará también de profesionales/agenda</p>}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-8 py-6 bg-slate-50 rounded-b-3xl flex gap-3 border-t border-slate-100">
                            <button
                                onClick={cancelDelete}
                                className="flex-1 px-6 py-3 rounded-xl bg-white border-2 border-slate-200 text-slate-700 font-black text-sm uppercase tracking-wider hover:bg-slate-50 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 px-6 py-3 rounded-xl bg-red-600 text-white font-black text-sm uppercase tracking-wider hover:bg-red-700 transition-all shadow-lg shadow-red-200 flex items-center justify-center gap-2"
                            >
                                <FiTrash2 size={16} />
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div >
    );
}



