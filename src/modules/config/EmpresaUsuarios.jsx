import React, { useState, useEffect } from "react";
import supabase from "../../lib/supabaseClient";
import ReactDOM from "react-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { DEFAULT_PERFILES } from "../../constants/DefaultProfiles";
import {
    upsertManagedUser,
    setManagedUserActive,
    deleteManagedUser
} from "../../services/userAdminService";

import { FiSearch, FiPlus, FiEdit2, FiTrash2, FiX, FiCheck, FiFilter, FiUser, FiArrowLeft, FiArrowRight, FiSave, FiInfo, FiMail, FiPhone, FiCreditCard, FiMapPin, FiActivity, FiLayers, FiChevronRight, FiChevronLeft, FiChevronsRight, FiChevronsLeft, FiEye, FiEyeOff, FiHelpCircle } from "react-icons/fi";
import {
    deleteConfigItem,
    getConfigItems,
    getConfigSection,
    saveConfigItem,
    saveConfigSection,
} from "../../services/configPersistenceService";
import Input from "../../components/ui/Input";

const normalizeDate = (val) => {
    if (!val) return "";
    if (typeof val === "string") {
        if (val.includes("T")) return val.split("T")[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
        const parts = val.split(/[-/]/);
        if (parts.length === 3) {
            if (parts[2].length === 4) {
                return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
            if (parts[0].length === 4) {
                return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            }
        }
    }
    return val;
};

const extractNombreApellido = (rawNombre, rawApellido, rawFullName) => {
    let nom = (rawNombre || "").trim();
    let ape = (rawApellido || "").trim();

    // 1. Si el apellido ya viene y el nombre termina con ese apellido, limpiar el apellido del nombre
    if (nom && ape && nom.toLowerCase().endsWith(ape.toLowerCase())) {
        nom = nom.slice(0, nom.length - ape.length).trim();
    }

    // 2. Si el apellido está vacío pero el nombre tiene espacios
    if (nom && !ape && nom.includes(" ")) {
        const parts = nom.split(/\s+/);
        nom = parts[0];
        ape = parts.slice(1).join(" ");
    } else if (!nom && !ape && rawFullName) {
        const parts = rawFullName.trim().split(/\s+/);
        if (parts.length >= 2) {
            nom = parts[0];
            ape = parts.slice(1).join(" ");
        } else {
            nom = parts[0] || "";
            ape = "";
        }
    }
    return { nombre: nom, apellido: ape };
};
const resolveTenantPlan = (tenant) => {
    const rawPlan = tenant?.plan;
    const plan = rawPlan && typeof rawPlan === "object" ? rawPlan : { id: rawPlan };
    const key = String(plan.id || tenant?.planId || "consultorio").toLowerCase();
    const fallbackLimit = key.includes("enterp")
        ? 999
        : (key.includes("clinica") || key.includes("clínica") || key.includes("pro") ? 12 : 2);

    return {
        ...plan,
        name: plan.name || (fallbackLimit === 999 ? "Enterprise" : fallbackLimit === 12 ? "Clínica" : "Consultorio"),
        maxUsers: Number(plan.maxUsers ?? fallbackLimit),
    };
};

export default function EmpresaUsuarios() {
    const { userProfile } = useAuth();
    const toast = useToast();

    const getDisplayName = (u) => {
        if (u.nombre || u.apellido) {
            const first = u.nombre || "";
            const last = u.apellido || "";
            const combined = `${first} ${last}`.trim();
            if (combined && !combined.toLowerCase().includes("undefined")) {
                return combined;
            }
        }
        if (u.nombreCompleto && !u.nombreCompleto.toLowerCase().includes("undefined")) {
            return u.nombreCompleto;
        }
        if (u.displayName && !u.displayName.toLowerCase().includes("undefined")) {
            return u.displayName;
        }
        return u.email || "Sin Nombre";
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
    const [errors, setErrors] = useState({});
    const [deleteConfirmModal, setDeleteConfirmModal] = useState(null); // Usuario a eliminar

    // Form State
    const initialForm = {
        nombre: "",
        apellido: "",
        email: "",
        tipoDocumento: "Cédula de ciudadanía",
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
            const [
                uRes,
                sData,
                userDetailsMap,
                configUsersData,
                configuredProfiles,
                configuredSpecialties
            ] = await Promise.all([
                supabase.from("profiles").select("*").eq("tenant_id", userProfile.inquilino),
                getConfigItems(userProfile.inquilino, "sucursales", "sucursales"),
                getConfigSection(userProfile.inquilino, "user_details", {}),
                getConfigItems(userProfile.inquilino, "usuarios", null),
                getConfigItems(userProfile.inquilino, "perfiles", null),
                getConfigItems(userProfile.inquilino, "especialidades", "especialidades")
            ]);
            if (uRes.error) throw uRes.error;
            const profilesMap = new Map();

            // A. Cargar usuarios desde public.profiles
            (uRes.data || []).forEach(u => {
                const detail = userDetailsMap[u.id] || {};
                const rawEsp = u.especialidad || (detail.especialidades ? detail.especialidades.join(", ") : "");
                const especialidadesArr = detail.especialidades || (rawEsp ? rawEsp.split(',').map(e => e.trim()).filter(Boolean) : []);
                const userSucursales = detail.sucursales || (u.sucursal_id ? [u.sucursal_id] : []);
                const rolLower = (u.role || "").toLowerCase();
                const esDoctor = detail.esDoctor ?? (rolLower.includes('doctor') || rolLower.includes('odontólog') || rolLower.includes('odontologo') || especialidadesArr.length > 0);

                const { nombre: userNombre, apellido: userApellido } = extractNombreApellido(
                    detail.nombre,
                    detail.apellido,
                    u.full_name
                );
                const updatedFullName = `${userNombre} ${userApellido}`.trim() || u.full_name;

                profilesMap.set(u.id, {
                    ...detail,
                    id: u.id,
                    nombre: userNombre,
                    apellido: userApellido,
                    nombreCompleto: updatedFullName,
                    email: u.email,
                    rol: u.role,
                    profileId: u.role,
                    especialidad: rawEsp,
                    especialidades: especialidadesArr,
                    sucursales: userSucursales,
                    tipoDocumento: detail.tipoDocumento || u.tipo_documento || "Cédula de ciudadanía",
                    numeroDocumento: detail.numeroDocumento || u.registro_medico || "",
                    telefonoMovil: detail.telefonoMovil || u.telefono || "",
                    telefonoFijo: detail.telefonoFijo || "",
                    direccion: detail.direccion || "",
                    genero: detail.genero || "Masculino",
                    fechaNacimiento: normalizeDate(detail.fechaNacimiento || u.fecha_nacimiento || u.fechaNacimiento || ""),
                    password: "",
                    esDoctor,
                    activo: u.activo !== false
                });
            });

            // B. Cargar/fusionar usuarios desde website_config usuarios
            (configUsersData || []).forEach(u => {
                if (!u.id) return;
                const existing = profilesMap.get(u.id) || {};
                const { nombre: uNom, apellido: uApe } = extractNombreApellido(
                    u.nombre || existing.nombre,
                    u.apellido || existing.apellido,
                    u.nombreCompleto || existing.nombreCompleto || u.full_name || existing.nombre
                );
                const nombreCompleto = `${uNom} ${uApe}`.trim() || u.email;
                profilesMap.set(u.id, {
                    ...existing,
                    ...u,
                    id: u.id,
                    nombre: uNom,
                    apellido: uApe,
                    nombreCompleto: nombreCompleto,
                    email: u.email || existing.email,
                    rol: u.role || u.rol || existing.rol || "Doctor",
                    profileId: u.role || u.rol || existing.profileId || "Doctor",
                    especialidad: u.especialidad || existing.especialidad || "",
                    especialidades: u.especialidades || existing.especialidades || [],
                    sucursales: u.sucursales || existing.sucursales || [],
                    tipoDocumento: u.tipoDocumento || existing.tipoDocumento || "Cédula de ciudadanía",
                    numeroDocumento: u.numeroDocumento || existing.numeroDocumento || "",
                    telefonoMovil: u.telefonoMovil || existing.telefonoMovil || "",
                    telefonoFijo: u.telefonoFijo || existing.telefonoFijo || "",
                    direccion: u.direccion || existing.direccion || "",
                    genero: u.genero || existing.genero || "Masculino",
                    fechaNacimiento: normalizeDate(u.fechaNacimiento || existing.fechaNacimiento || ""),
                    password: "",
                    esDoctor: u.esDoctor ?? existing.esDoctor ?? true,
                    activo: u.activo !== false
                });
            });

            const mergedUsersList = Array.from(profilesMap.values());

            const rolesList = configuredProfiles.map(p => ({
                id: p.nombre || p.id,
                nombre: p.nombre
            }));

            // Extraer especialidades de website_config → formato {id, nombre}
            const rawEspecialidades = configuredSpecialties;
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

            setUsers(mergedUsersList);
            setRolesDisponibles(rolesList.length > 0 ? rolesList : DEFAULT_PERFILES);
            setSucursales(sData || []);
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
        if (!showDisabled) {
            res = res.filter(u => u.activo !== false); // Show only active
        } else {
            res = res.filter(u => u.activo === false);
        }

        setFiltered(res);
    }, [users, search, showDisabled]);

    // 3. Handlers
    const handleFieldChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }));
        }
    };

    const handleOpenModal = async (user = null) => {
        setErrors({});
        if (user) {
            setEditId(user.id);
            
            const { nombre: userNombre, apellido: userApellido } = extractNombreApellido(
                user.nombre,
                user.apellido,
                user.nombreCompleto || user.displayName || user.full_name
            );

            setFormData({
                ...initialForm,
                nombre: userNombre,
                apellido: userApellido,
                email: user.email || "",
                tipoDocumento: user.tipoDocumento || "Cédula de ciudadanía",
                numeroDocumento: user.numeroDocumento || "",
                telefonoMovil: user.telefonoMovil || "",
                telefonoFijo: user.telefonoFijo || "",
                direccion: user.direccion || "",
                genero: user.genero || "Masculino",
                fechaNacimiento: normalizeDate(user.fechaNacimiento || user.fecha_nacimiento || ""),
                esDoctor: user.esDoctor || false,
                esLaboratory: user.esLaboratory || false,
                seeOtherDoctorsData: user.seeOtherDoctorsData || false,
                comisionPorcentaje: user.comisionPorcentaje || 0,
                clinicalDocsWithLogo: user.clinicalDocsWithLogo !== undefined ? user.clinicalDocsWithLogo : true,
                clinicalDocsHeader: user.clinicalDocsHeader || "sucursal",
                encabezadoPersonalizado: user.encabezadoPersonalizado || "",
                formaPago: user.formaPago || "Realizadas y pagadas",

                profileId: user.profileId || user.rol || "",
                sucursales: user.sucursales || [],
                especialidades: user.especialidades || [],
                password: user.password || ""
            });
        } else {
            // Validar límite máximo de usuarios del plan de la clínica
            const tenantPlanObj = resolveTenantPlan(userProfile?.tenant);
            const maxUsersLimit = tenantPlanObj.maxUsers;
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
        setFormData(prev => {
            const nextList = prev[key].includes(id)
                ? prev[key].filter(x => x !== id)
                : [...prev[key], id];
            return {
                ...prev,
                [key]: nextList
            };
        });
        if (key === 'especialidades' && errors.especialidades) {
            setErrors(prev => ({ ...prev, especialidades: null }));
        }
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();

        // Validar todos los campos obligatorios (*)
        const newErrors = {};

        if (!formData.nombre?.trim()) newErrors.nombre = "El nombre es obligatorio";
        if (!formData.apellido?.trim()) newErrors.apellido = "El apellido es obligatorio";
        if (!formData.numeroDocumento?.trim()) newErrors.numeroDocumento = "El número de documento es obligatorio";
        if (!formData.telefonoMovil?.trim()) newErrors.telefonoMovil = "El teléfono móvil es obligatorio";
        if (!formData.genero?.trim()) newErrors.genero = "El género es obligatorio";
        if (!formData.fechaNacimiento?.trim()) newErrors.fechaNacimiento = "La fecha de nacimiento es obligatoria";

        const isEditingAdmin = editId && users.find(u => u.id === editId)?.rol === "administrador";
        if (!isEditingAdmin && !formData.profileId?.trim()) {
            newErrors.profileId = "El tipo de perfil es obligatorio";
        }

        if (formData.esDoctor && (!formData.especialidades || formData.especialidades.length === 0)) {
            newErrors.especialidades = "Debe seleccionar al menos una especialización para el doctor";
        }

        if (!formData.email?.trim()) {
            newErrors.email = "El correo electrónico es obligatorio";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
            newErrors.email = "Ingrese un correo electrónico válido";
        }

        if (!editId) {
            if (!formData.password?.trim()) {
                newErrors.password = "La contraseña es obligatoria (mínimo 8 caracteres)";
            } else if (formData.password.trim().length < 8) {
                newErrors.password = "La contraseña debe tener mínimo 8 caracteres";
            }
        } else {
            if (formData.password && formData.password.trim().length > 0 && formData.password.trim().length < 8) {
                newErrors.password = "La contraseña debe tener mínimo 8 caracteres";
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return toast.error("⚠️ Hay campos obligatorios sin diligenciar (*). Por favor completa los campos marcados en rojo.");
        }

        const targetEmail = formData.email.trim().toLowerCase();

        // 1. Validar duplicación de correo en la lista local de usuarios (excluyendo el usuario actual editado)
        const emailDuplicateInMemory = users.find(u => (u.email || "").trim().toLowerCase() === targetEmail && u.id !== editId);
        if (emailDuplicateInMemory) {
            return toast.error(`⚠️ El correo "${targetEmail}" ya pertenece a otro usuario registrado (${emailDuplicateInMemory.nombreCompleto || emailDuplicateInMemory.email}). Por favor ingresa un correo diferente.`);
        }

        // Validar límite de usuarios antes de guardar un nuevo usuario
        if (!editId) {
            const tenantPlanObj = resolveTenantPlan(userProfile?.tenant);
            const maxUsersLimit = tenantPlanObj.maxUsers;
            const currentCount = users.length;
            if (currentCount >= maxUsersLimit) {
                return toast.error(`⚠️ Has alcanzado el límite máximo de ${maxUsersLimit} usuario(s) de tu plan actual (${tenantPlanObj.name || 'Consultorio'}). Actualiza tu plan para agregar más usuarios.`);
            }
        }

        setSaving(true);
        try {
            // 2. Validar duplicación de correo en la base de datos (tabla profiles)
            const { data: dbCheck, error: dbCheckError } = await supabase
                .from("profiles")
                .select("id, full_name, email")
                .ilike("email", targetEmail);
            if (dbCheckError) throw dbCheckError;

            const dbDuplicate = dbCheck?.find(p => p.id !== editId);
            if (dbDuplicate) {
                setSaving(false);
                return toast.error(`⚠️ El correo "${targetEmail}" ya se encuentra registrado por otro usuario (${dbDuplicate.full_name || dbDuplicate.email}).`);
            }

            const selectedProfile = rolesDisponibles.find(r => r.id === formData.profileId || r.nombre === formData.profileId);
            const fullName = `${formData.nombre.trim()} ${formData.apellido.trim()}`.trim();
            const primaryEmail = (userProfile?.email || "atmcentrodeldolor@gmail.com").toLowerCase().trim();
            const isPrimaryAccount = targetEmail === primaryEmail;
            
            // Asignar rol respetando la elección del usuario (Doctor, Odontólogo, etc.)
            let roleName = isPrimaryAccount ? "administrador" : (selectedProfile?.nombre || formData.profileId || "Doctor");

            const res = await upsertManagedUser({
                id: editId || null,
                tenantId: userProfile.inquilino,
                email: targetEmail,
                password: formData.password?.trim() || undefined,
                fullName,
                role: roleName,
                especialidad: (formData.especialidades || []).join(', ') || null,
                registroMedico: formData.numeroDocumento?.trim() || null,
                telefono: formData.telefonoMovil?.trim() || formData.telefonoFijo?.trim() || null,
                activo: true
            });
            const targetId = res?.user?.id || editId || (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2));
            
            // Guardar únicamente metadatos no sensibles del usuario.
            const currentUserDetails = await getConfigSection(
                userProfile.inquilino,
                "user_details",
                {}
            );
            const userDetail = {
                nombre: formData.nombre.trim(),
                apellido: formData.apellido.trim(),
                tipoDocumento: formData.tipoDocumento || "Cédula de ciudadanía",
                numeroDocumento: formData.numeroDocumento?.trim() || "",
                telefonoMovil: formData.telefonoMovil?.trim() || "",
                telefonoFijo: formData.telefonoFijo?.trim() || "",
                direccion: formData.direccion?.trim() || "",
                genero: formData.genero || "Masculino",
                fechaNacimiento: formData.fechaNacimiento || "",
                sucursales: formData.sucursales || [],
                especialidades: formData.especialidades || [],
                esDoctor: formData.esDoctor || false,
                esLaboratory: formData.esLaboratory || false,
                seeOtherDoctorsData: formData.seeOtherDoctorsData || false,
                comisionPorcentaje: formData.comisionPorcentaje || 0,
                clinicalDocsWithLogo: formData.clinicalDocsWithLogo !== false,
                clinicalDocsHeader: formData.clinicalDocsHeader || "sucursal",
                encabezadoPersonalizado: formData.encabezadoPersonalizado || "",
                formaPago: formData.formaPago || "Realizadas y pagadas"
            };
            await saveConfigSection(userProfile.inquilino, "user_details", {
                ...(currentUserDetails || {}),
                [targetId]: userDetail
            });

            await saveConfigItem(userProfile.inquilino, "usuarios", null, {
                id: targetId,
                ...userDetail,
                nombreCompleto: fullName,
                email: targetEmail,
                rol: roleName,
                profileId: roleName,
                activo: true
            });

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
        const actionLabel = u.activo ? 'Deshabilitar' : 'Habilitar';
        if (!window.confirm(actionLabel + ' usuario "' + (u.nombreCompleto || u.email) + '"?')) return;
        try {
            await setManagedUserActive(u.id, !u.activo);
            toast.success('Estado de usuario actualizado correctamente');
            loadData();
        } catch (error) {
            console.error('Error al cambiar estado:', error);
            toast.error('Error al cambiar estado de usuario: ' + (error.message || ''));
        }
    };
    const handleDelete = async (u) => {
        const primaryEmail = (userProfile?.email || "atmcentrodeldolor@gmail.com").toLowerCase().trim();
        const targetEmail = (u.email || "").toLowerCase().trim();
        if (targetEmail && targetEmail === primaryEmail) {
            return toast.error("⛔ No se puede eliminar el usuario administrador principal de la clínica (" + primaryEmail + ")");
        }
        setDeleteConfirmModal(u);
    };

    const confirmDelete = async () => {
        if (!deleteConfirmModal) return;
        const userToDelete = deleteConfirmModal;

        try {
            await deleteManagedUser(userToDelete.id);
            await deleteConfigItem(userProfile.inquilino, "usuarios", "usuarios", userToDelete.id);

            const currentUserDetails = await getConfigSection(
                userProfile.inquilino,
                "user_details",
                {}
            );
            if (currentUserDetails?.[userToDelete.id]) {
                const nextUserDetails = { ...currentUserDetails };
                delete nextUserDetails[userToDelete.id];
                await saveConfigSection(
                    userProfile.inquilino,
                    "user_details",
                    nextUserDetails
                );
            }

            toast.success('Usuario eliminado correctamente');
            setDeleteConfirmModal(null);
            loadData();
        } catch (error) {
            console.error('Error al eliminar usuario:', error);
            toast.error('Error al eliminar usuario: ' + (error.message || ''));
        }
    };

    const cancelDelete = () => {
        setDeleteConfirmModal(null);
    };

    return (
        <div className="space-y-4">
            {/* Header con estilo uniforme */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div>
                    <h3 className="text-base font-bold text-slate-800">
                        Usuarios y Permisos
                    </h3>
                    <p className="text-xs text-slate-500">
                        Gestiona el acceso del personal y doctores al sistema
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowDisabled(!showDisabled)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${showDisabled
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            }`}
                    >
                        <FiFilter size={13} />
                        {showDisabled ? "Viendo Inactivos" : "Ver Inactivos"}
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all shadow-blue-500/10 cursor-pointer border-0"
                    >
                        <FiPlus size={15} />
                        <span>Nuevo Usuario</span>
                    </button>
                </div>
            </div>

            {/* Buscador */}
            <div className="relative">
                <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar usuario por nombre o correo..."
                    className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-blue-500 transition-colors shadow-sm"
                />
            </div>

            {/* Tabla de Usuarios */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
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
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase">
                                                <FiCheck size={10} /> {u.profileName || u.rol || (u.especialidades?.[0]) || "Odontólogo"}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500 uppercase">
                                                {u.profileName || u.rol || "No Asistencial"}
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
                        {/* Header limpio */}
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
                                {/* Campos ocultos para evitar autofill */}
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
                                            <input 
                                                type="text" 
                                                value={formData.nombre} 
                                                onChange={e => handleFieldChange("nombre", e.target.value)} 
                                                placeholder="Ingrese nombre" 
                                                className={`w-full h-8 bg-slate-50 border ${errors.nombre ? 'border-red-500 bg-red-50/30 ring-1 ring-red-400' : 'border-slate-200 focus:border-blue-400'} rounded-lg px-3 text-[13px] text-slate-800 focus:bg-white outline-none transition-all`} 
                                            />
                                            {errors.nombre && <span className="text-[10px] font-semibold text-red-500">{errors.nombre}</span>}
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-500">Apellido *</label>
                                            <input 
                                                type="text" 
                                                value={formData.apellido} 
                                                onChange={e => handleFieldChange("apellido", e.target.value)} 
                                                placeholder="Ingrese apellidos" 
                                                className={`w-full h-8 bg-slate-50 border ${errors.apellido ? 'border-red-500 bg-red-50/30 ring-1 ring-red-400' : 'border-slate-200 focus:border-blue-400'} rounded-lg px-3 text-[13px] text-slate-800 focus:bg-white outline-none transition-all`} 
                                            />
                                            {errors.apellido && <span className="text-[10px] font-semibold text-red-500">{errors.apellido}</span>}
                                        </div>
                                    </div>

                                    {/* Fila 2: Tipo documento y Número de documento */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-500">Tipo de documento</label>
                                            <select value={formData.tipoDocumento} onChange={e => handleFieldChange("tipoDocumento", e.target.value)} className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-3 text-[13px] text-slate-800 outline-none focus:border-blue-400 transition-all">
                                                <option value="Cédula de ciudadanía">Cédula de ciudadanía</option>
                                                <option value="Cédula de extranjería">Cédula de extranjería</option>
                                                <option value="Pasaporte">Pasaporte</option>
                                                <option value="Tarjeta de identidad">Tarjeta de identidad</option>
                                                <option value="Permiso Especial">Permiso Especial</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-500">Número de documento *</label>
                                            <input 
                                                type="text" 
                                                value={formData.numeroDocumento} 
                                                onChange={e => handleFieldChange("numeroDocumento", e.target.value)} 
                                                placeholder="Ej: 12345678" 
                                                className={`w-full h-8 bg-slate-50 border ${errors.numeroDocumento ? 'border-red-500 bg-red-50/30 ring-1 ring-red-400' : 'border-slate-200 focus:border-blue-400'} rounded-lg px-3 text-[13px] text-slate-800 focus:bg-white outline-none transition-all`} 
                                            />
                                            {errors.numeroDocumento && <span className="text-[10px] font-semibold text-red-500">{errors.numeroDocumento}</span>}
                                        </div>
                                    </div>

                                    {/* Fila 3: Teléfonos */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-500">Teléfono móvil *</label>
                                            <input 
                                                type="text" 
                                                value={formData.telefonoMovil} 
                                                onChange={e => handleFieldChange("telefonoMovil", e.target.value)} 
                                                placeholder="Ej: 310..." 
                                                className={`w-full h-8 bg-slate-50 border ${errors.telefonoMovil ? 'border-red-500 bg-red-50/30 ring-1 ring-red-400' : 'border-slate-200 focus:border-blue-400'} rounded-lg px-3 text-[13px] text-slate-800 focus:bg-white outline-none transition-all`} 
                                            />
                                            {errors.telefonoMovil && <span className="text-[10px] font-semibold text-red-500">{errors.telefonoMovil}</span>}
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-500">Teléfono fijo</label>
                                            <input 
                                                type="text" 
                                                value={formData.telefonoFijo} 
                                                onChange={e => handleFieldChange("telefonoFijo", e.target.value)} 
                                                placeholder="Ej: 601..." 
                                                className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-3 text-[13px] text-slate-800 focus:bg-white focus:border-blue-400 outline-none transition-all" 
                                            />
                                        </div>
                                    </div>

                                    {/* Fila 4: Género y Fecha de nacimiento */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-500">Género *</label>
                                            <select 
                                                value={formData.genero} 
                                                onChange={e => handleFieldChange("genero", e.target.value)} 
                                                className={`w-full h-8 bg-slate-50 border ${errors.genero ? 'border-red-500 bg-red-50/30 ring-1 ring-red-400' : 'border-slate-200 focus:border-blue-400'} rounded-lg px-3 text-[13px] text-slate-800 outline-none transition-all`}
                                            >
                                                <option value="Masculino">Masculino</option>
                                                <option value="Femenino">Femenino</option>
                                                <option value="Otro">Otro</option>
                                            </select>
                                            {errors.genero && <span className="text-[10px] font-semibold text-red-500">{errors.genero}</span>}
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[11px] font-medium text-slate-500">Fecha de nacimiento *</label>
                                            <input 
                                                type="date" 
                                                value={formData.fechaNacimiento} 
                                                onChange={e => handleFieldChange("fechaNacimiento", e.target.value)} 
                                                className={`w-full h-8 bg-slate-50 border ${errors.fechaNacimiento ? 'border-red-500 bg-red-50/30 ring-1 ring-red-400' : 'border-slate-200 focus:border-blue-400'} rounded-lg px-3 text-[13px] text-slate-800 focus:bg-white outline-none transition-all`} 
                                                max="9999-12-31" 
                                                min="1900-01-01" 
                                            />
                                            {errors.fechaNacimiento && <span className="text-[10px] font-semibold text-red-500">{errors.fechaNacimiento}</span>}
                                        </div>
                                    </div>

                                    {/* Fila 5: Dirección */}
                                    <div className="space-y-1">
                                        <label className="text-[11px] font-medium text-slate-500">Dirección</label>
                                        <input 
                                            type="text" 
                                            value={formData.direccion} 
                                            onChange={e => handleFieldChange("direccion", e.target.value)} 
                                            placeholder="Dirección de residencia" 
                                            className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-3 text-[13px] text-slate-800 focus:bg-white focus:border-blue-400 outline-none transition-all" 
                                        />
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
                                                        <input type="number" value={formData.comisionPorcentaje} onChange={e => handleFieldChange("comisionPorcentaje", e.target.value)} placeholder="0" className="h-8 bg-white border-slate-200 rounded-lg px-4 font-black text-blue-600 text-[16px] shadow-sm" />
                                                    </div>

                                                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 transition-all">
                                                        <span className="text-[12px] font-medium text-slate-700">¿Documentos clínicos se imprimen con logo?</span>
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
                                                                onChange={e => handleFieldChange("encabezadoPersonalizado", e.target.value)}
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
                                                <select value={formData.formaPago} onChange={e => handleFieldChange("formaPago", e.target.value)} className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-3 text-[13px] text-slate-800 outline-none focus:border-blue-400 transition-all">
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
                                                        <>
                                                            <select 
                                                                value={formData.profileId} 
                                                                onChange={e => handleFieldChange("profileId", e.target.value)} 
                                                                className={`w-full h-8 bg-slate-50 border ${errors.profileId ? 'border-red-500 bg-red-50/30 ring-1 ring-red-400' : 'border-slate-200 focus:border-blue-500'} rounded-lg px-3 font-black text-[11px] text-slate-700 transition-all`}
                                                            >
                                                                <option value="">Seleccione perfil...</option>
                                                                {rolesDisponibles.map(p => (
                                                                    <option key={p.id} value={p.id}>{p.nombre}</option>
                                                                ))}
                                                            </select>
                                                            {errors.profileId && <span className="text-[10px] font-semibold text-red-500">{errors.profileId}</span>}
                                                        </>
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

                                            {errors.especialidades && (
                                                <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-[11px] font-semibold">
                                                    ⚠️ {errors.especialidades}
                                                </div>
                                            )}

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
                                                    onChange={e => handleFieldChange("email", e.target.value)} 
                                                    placeholder="usuario@clinica.com" 
                                                    className={`w-full h-9 bg-slate-50 border ${errors.email || (formData.email && users.some(u => u.email?.toLowerCase() === formData.email.trim().toLowerCase() && u.id !== editId)) ? 'border-red-500 text-red-600 bg-red-50/20 ring-1 ring-red-400' : 'border-slate-200 focus:border-blue-500'} focus:bg-white rounded-xl pl-11 pr-4 font-bold text-[13px] text-slate-700 outline-none transition-all caret-black`} 
                                                />
                                            </div>
                                            {errors.email ? (
                                                <p className="text-[10px] font-bold text-red-500 flex items-center gap-1 mt-1">
                                                    <span>⚠️ {errors.email}</span>
                                                </p>
                                            ) : (formData.email && users.some(u => u.email?.toLowerCase() === formData.email.trim().toLowerCase() && u.id !== editId)) ? (
                                                <p className="text-[10px] font-bold text-red-500 flex items-center gap-1 mt-1">
                                                    <span>⚠️ Este correo ya está registrado por otro usuario.</span>
                                                </p>
                                            ) : (
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">Este correo se usa para iniciar sesión</p>
                                            )}
                                        </div>

                                        <div className="space-y-2.5">
                                            <label className="text-[11px] font-medium text-slate-500">Contraseña *</label>
                                            <div className="relative max-w-sm">
                                                <input 
                                                    type={showPassword ? "text" : "password"} 
                                                    name="new_user_password_field"
                                                    autoComplete="new-password"
                                                    value={formData.password} 
                                                    onChange={e => handleFieldChange("password", e.target.value)} 
                                                    minLength={8}
                                                    placeholder={editId ? "Contraseña del usuario" : "Mínimo 8 caracteres"} 
                                                    className={`w-full h-9 bg-slate-50 border ${errors.password || (formData.password && formData.password.length > 0 && formData.password.length < 8) ? 'border-red-500 focus:border-red-500 ring-1 ring-red-400' : 'border-slate-200 focus:border-blue-500'} focus:bg-white rounded-xl pl-4 pr-12 font-bold text-[13px] text-slate-700 outline-none transition-all caret-black`}
                                                />
                                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all">
                                                    {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                                                </button>
                                            </div>
                                            {errors.password ? (
                                                <p className="text-[10px] font-semibold text-red-500 pl-1 mt-1">
                                                    ⚠️ {errors.password}
                                                </p>
                                            ) : formData.password && formData.password.length > 0 && formData.password.length < 8 ? (
                                                <p className="text-[10px] font-semibold text-red-500 pl-1 mt-1">
                                                    Faltan {8 - formData.password.length} caracteres
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>
                                </section>
                            </form>
                        </div>

                        {/* Footer del Modal */}
                        <div className="bg-white px-5 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] text-slate-400">Validación en tiempo real</span>
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
