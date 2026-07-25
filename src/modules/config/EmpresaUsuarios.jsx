import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp, query, orderBy, where, getDoc, or } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { db, firebaseConfig } from "../../firebase/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

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
            // Usuarios (sin orderBy email para evitar error de índice si hay filtros de tenant)
            // Usuarios (Buscando tanto por 'inquilino' como por 'tenantId' para máxima compatibilidad)
            const usersQ = query(
                collection(db, "usuarios"),
                or(
                    where("inquilino", "==", userProfile.inquilino),
                    where("tenantId", "==", userProfile.inquilino)
                )
            );
            const uSnap = await getDocs(usersQ);

            // Otros recursos (sin orderBy para evitar errores de índice si no existen)
            // Ordenaremos del lado del cliente para mayor robustez
            const [pSnap, sSnap, espSnap] = await Promise.all([
                getDocs(query(collection(db, "perfiles"), where("inquilino", "==", userProfile.inquilino))),
                getDocs(query(collection(db, "sucursales"), where("inquilino", "==", userProfile.inquilino))),
                getDocs(query(collection(db, "especialidades"), where("inquilino", "==", userProfile.inquilino)))
            ]);

            const sortedProfiles = pSnap.docs.map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
            const sortedBranches = sSnap.docs.map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
            const sortedSpecialties = espSnap.docs.map(d => ({ id: d.id, ...d.data() }))
                .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));

            const normalizedUsers = uSnap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    // Normalización de campos de asociación
                    inquilino: data.inquilino || data.tenantId || userProfile.inquilino,
                    tenantId: data.tenantId || data.inquilino || userProfile.inquilino
                };
            });

            setUsers(normalizedUsers);
            setRolesDisponibles(sortedProfiles);
            setSucursales(sortedBranches);
            setSpecialties(sortedSpecialties);

        } catch (e) {
            console.error(e);
            toast.error("Error cargando usuarios");
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
                password: ""
            });
        } else {
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

    const handleSubmitForm = async (e) => {
        e.preventDefault();
        const isEditingAdmin = editId && users.find(u => u.id === editId)?.rol === "administrador";
        if (!formData.email || !formData.nombre || (!formData.profileId && !isEditingAdmin)) {
            return toast.warning("Complete los campos obligatorios");
        }
        if (!editId && !formData.password) {
            return toast.warning("Contraseña requerida para nuevos usuarios");
        }
        
        // Validar longitud de contraseña
        if (formData.password && formData.password.length < 8) {
            return toast.error("La contraseña debe tener mínimo 8 caracteres");
        }

        setSaving(true);
        try {
            const selectedProfile = rolesDisponibles.find(p => p.id === formData.profileId);

            let uid = editId;

            // If Creating New -> Create in Auth
            if (!editId) {
                try {
                    const secondaryAuth = getSecondaryAuth();
                    const userCred = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
                    uid = userCred.user.uid;
                    // Cerrar sesión en la app secundaria para no interferir con la sesión principal
                    await secondaryAuth.signOut();
                } catch (authError) {
                    setSaving(false);
                    if (authError.code === 'auth/email-already-in-use') {
                        toast.error("El correo ya está registrado en Firebase. Si el usuario existía antes, edítalo en lugar de crearlo nuevamente.");
                    } else if (authError.code === 'auth/weak-password') {
                        toast.error("La contraseña es muy débil. Use mínimo 8 caracteres.");
                    } else if (authError.code === 'auth/invalid-email') {
                        toast.error("El formato del correo electrónico no es válido.");
                    } else {
                        toast.error("Error al crear cuenta de acceso: " + authError.message);
                    }
                    return;
                }
            }

            // Save to Firestore
            const userData = {
                uid,
                activo: true, // Default active on create/edit

                email: formData.email,
                nombre: formData.nombre,
                apellido: formData.apellido,
                nombreCompleto: `${formData.nombre} ${formData.apellido}`.trim(),

                tipoDocumento: formData.tipoDocumento,
                numeroDocumento: formData.numeroDocumento,
                telefonoMovil: formData.telefonoMovil,
                telefonoFijo: formData.telefonoFijo,
                direccion: formData.direccion,
                genero: formData.genero,
                fechaNacimiento: formData.fechaNacimiento,

                esDoctor: formData.esDoctor,
                esLaboratory: formData.esLaboratory || false,
                seeOtherDoctorsData: formData.seeOtherDoctorsData || false,
                comisionPorcentaje: Number(formData.comisionPorcentaje) || 0,
                clinicalDocsWithLogo: formData.clinicalDocsWithLogo !== undefined ? formData.clinicalDocsWithLogo : true,
                clinicalDocsHeader: formData.clinicalDocsHeader || "sucursal",
                encabezadoPersonalizado: formData.encabezadoPersonalizado || "",
                formaPago: formData.formaPago || "Realizadas y pagadas",
                profileType: formData.profileType || "Doctor",

                sucursales: formData.sucursales,
                especialidades: formData.esDoctor ? formData.especialidades : [],

                profileId: isEditingAdmin ? "" : (selectedProfile?.id || ""),
                profileName: isEditingAdmin ? "Administrador" : (selectedProfile?.nombre || ""),
                rol: (() => {
                    if (isEditingAdmin) return "administrador";
                    const r = (selectedProfile?.baseRole || selectedProfile?.rol || "").trim().toLowerCase();
                    if (r) return r;
                    const n = (selectedProfile?.nombre || "").toLowerCase();
                    if (n.includes("doctor") || n.includes("odont")) return "doctor";
                    return "recepcionista";
                })(),

                inquilino: userProfile.inquilino,
                updatedAt: serverTimestamp()
            };

            // If create, add createdAt
            if (!editId) userData.createdAt = serverTimestamp();

            await setDoc(doc(db, "usuarios", uid), userData, { merge: true });

            // ---------------------------------------------------------
            // DOCTOR SYNCHRONIZATION (profesionales collection)
            // ---------------------------------------------------------
            if (formData.esDoctor) {
                const profData = {
                    id: uid,
                    nombre: formData.nombre.trim(),
                    nombreCompleto: `${formData.nombre} ${formData.apellido}`.trim(),
                    correo: formData.email.toLowerCase(),
                    identificacion: formData.numeroDocumento,
                    telefono: formData.telefonoMovil,
                    especialidades: formData.especialidades,
                    sucursales: formData.sucursales, // Critical fix: mapping branches
                    inquilino: userProfile.inquilino,
                    activo: true,
                    updatedAt: serverTimestamp()
                };
                await setDoc(doc(db, "profesionales", uid), profData, { merge: true });
            } else {
                // If they were a doctor and now aren't, or just ensure it's deleted/deactivated
                // Usually deleting is safe if they aren't a doctor anymore.
                // Alternatively, set activo: false. Let's delete to keep collection clean.
                try {
                    await deleteDoc(doc(db, "profesionales", uid));
                } catch (e) {
                    // Might not exist, ignore
                }
            }
            // ---------------------------------------------------------

            toast.success(editId ? "Usuario actualizado" : "Usuario creado con éxito");
            setModalOpen(false);
            loadData();

        } catch (error) {
            console.error(error);
            if (error.code === 'auth/email-already-in-use') {
                toast.error("El correo ya está registrado");
            } else {
                toast.error("Error al guardar: " + error.message);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDisable = async (u) => {
        if (!window.confirm(`¿${u.activo ? "Deshabilitar" : "Habilitar"} usuario?`)) return;
        try {
            await setDoc(doc(db, "usuarios", u.id), { activo: !u.activo }, { merge: true });
            toast.success("Estado actualizado");
            loadData();
        } catch (e) {
            toast.error("Error al cambiar estado");
        }
    };

    const handleDelete = async (u) => {
        console.log("🗑️ handleDelete llamado con usuario:", u);
        
        // Protección para usuarios administradores
        if (u.rol === "administrador") {
            console.log("⛔ Usuario administrador, bloqueado");
            return toast.error("⛔ No se puede eliminar un usuario administrador");
        }
        
        // Mostrar modal de confirmación personalizado
        setDeleteConfirmModal(u);
    };

    const confirmDelete = async () => {
        if (!deleteConfirmModal) return;
        
        const u = deleteConfirmModal;
        console.log("✅ Usuario confirmó eliminación");
        
        try {
            console.log("Eliminando usuario de Firestore...");
            // Eliminar de la colección usuarios
            await deleteDoc(doc(db, "usuarios", u.id));
            console.log("✅ Usuario eliminado de colección usuarios");
            
            // Si era doctor, también eliminar de profesionales
            if (u.esDoctor) {
                try {
                    await deleteDoc(doc(db, "profesionales", u.id));
                    console.log("✅ Usuario eliminado de colección profesionales");
                } catch (e) {
                    console.warn("No se pudo eliminar de profesionales:", e);
                }
            }
            
            toast.success("Usuario eliminado correctamente");
            setDeleteConfirmModal(null);
            loadData();
        } catch (e) {
            console.error("❌ Error eliminando usuario:", e);
            toast.error("Error al eliminar usuario: " + e.message);
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
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <FiUser size={18} />
                    </div>
                    <div>
                        <h1 className="text-[16px] font-bold text-slate-800 tracking-tight">Usuarios y Talento Humano</h1>
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
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg text-[12px] font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border-0 shrink-0"
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
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-all duration-500">
                    <div className="bg-white w-full max-w-6xl h-[95vh] rounded-[32px] overflow-hidden shadow-[0_48px_128px_rgba(0,0,0,0.3)] flex flex-col animate-scale-in border border-white/40">
                        {/* Header: Pure Elite Styling */}
                        <div className="bg-[#0F172A] px-6 py-4 flex items-center justify-between shrink-0 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-[40%] h-full bg-gradient-to-l from-blue-600/20 to-transparent skew-x-[30deg] pointer-events-none" />
                            <div className="flex items-center gap-6 relative z-10">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-900/20 group">
                                    <FiUser size={28} className="text-white group-hover:scale-110 transition-transform duration-300" />
                                </div>
                                <div className="flex flex-col">
                                    <h2 className="text-[20px] font-black text-white uppercase tracking-[-0.02em] leading-tight">
                                        {editId ? "Configuración de Perfil" : "Apertura de Cuenta Master"}
                                    </h2>
                                    <div className="flex items-center gap-3">
                                        <div className="px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[9px] font-black text-blue-400 uppercase tracking-widest">OdontoCloud Elite</div>
                                        <div className="w-1 h-1 rounded-full bg-slate-700" />
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Gestión de privilegios y datos</p>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="w-12 h-12 rounded-2xl bg-slate-800/50 flex items-center justify-center text-slate-500 hover:text-white hover:bg-red-500 transition-all duration-300 active:scale-90 group"
                            >
                                <FiX size={24} className="group-hover:rotate-90 transition-transform duration-500" />
                            </button>
                        </div>

                        {/* Modal Body: Two-Column Side-by-Side Scrolling Sections */}
                        <div className="flex-1 overflow-hidden relative bg-[#F8FAFC]">
                            <form onSubmit={handleSubmitForm} className="h-full overflow-y-auto custom-scrollbar p-6 pb-32 space-y-6">
                                {/* BLOQUE 1: INFORMACIÓN BÁSICA */}
                                <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6 relative">
                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
                                    
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-50 pb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
                                                <FiUser size={20} />
                                            </div>
                                            <div>
                                                <h4 className="text-[15px] font-black text-slate-800 uppercase tracking-tight">Información básica</h4>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-80">Datos personales de identificación</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-2 italic">¿Es laboratorio o centro diagnóstico?</label>
                                            <button type="button" onClick={() => setFormData({ ...formData, esLaboratory: !formData.esLaboratory })} className={`w-12 h-6 rounded-full transition-all duration-500 relative ${formData.esLaboratory ? "bg-blue-600" : "bg-slate-200"}`}>
                                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-500 shadow-sm ${formData.esLaboratory ? "left-7" : "left-1"}`} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2.5">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Nombre *</label>
                                            <Input type="text" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} required placeholder="Ingrese nombre" className="h-10 bg-slate-50/50 border-slate-200 rounded-xl px-5 font-bold text-slate-700 shadow-sm text-[13px] focus:bg-white transition-all caret-black" />
                                        </div>
                                        <div className="space-y-2.5">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Apellido *</label>
                                            <Input type="text" value={formData.apellido} onChange={e => setFormData({ ...formData, apellido: e.target.value })} required placeholder="Ingrese apellidos" className="h-10 bg-slate-50/50 border-slate-200 rounded-xl px-5 font-bold text-slate-700 shadow-sm text-[13px] focus:bg-white transition-all caret-black" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <div className="space-y-2.5">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo documento *</label>
                                            <select value={formData.tipoDocumento} onChange={e => setFormData({ ...formData, tipoDocumento: e.target.value })} className="w-full h-10 bg-slate-50/50 border border-slate-100 rounded-lg px-3 font-bold text-[11px] text-slate-600 outline-none hover:border-slate-200 transition-all">
                                                <option value="Cédula de ciudadanía">Cédula de ciudadanía</option>
                                                <option value="Cédula de extranjería">Cédula de extranjería</option>
                                                <option value="Pasaporte">Pasaporte</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2.5">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Número de documento *</label>
                                            <Input type="text" value={formData.numeroDocumento} onChange={e => setFormData({ ...formData, numeroDocumento: e.target.value })} required placeholder="Número de identidad" className="h-10 bg-slate-50/50 border-slate-200 rounded-xl px-5 font-bold text-slate-700 shadow-sm text-[13px] focus:bg-white transition-all caret-black" />
                                        </div>
                                        <div className="space-y-2.5">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono móvil *</label>
                                            <div className="relative">
                                                <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                                                <Input type="text" value={formData.telefonoMovil} onChange={e => setFormData({ ...formData, telefonoMovil: e.target.value })} required placeholder="Ej: 310..." className="h-10 pl-12 bg-slate-50/50 border-slate-200 rounded-xl px-5 font-bold text-slate-700 shadow-sm text-[13px] focus:bg-white transition-all caret-black" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <div className="space-y-2.5">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Teléfono fijo</label>
                                            <Input type="text" value={formData.telefonoFijo} onChange={e => setFormData({ ...formData, telefonoFijo: e.target.value })} placeholder="Ej: 601..." className="h-10 bg-slate-50/50 border-slate-200 rounded-xl px-5 font-bold text-slate-700 shadow-sm text-[13px] focus:bg-white transition-all caret-black" />
                                        </div>
                                        <div className="space-y-2.5 lg:col-span-2">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Dirección *</label>
                                            <div className="relative">
                                                <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                                                <Input type="text" value={formData.direccion} onChange={e => setFormData({ ...formData, direccion: e.target.value })} required placeholder="Dirección de residencia" className="h-10 pl-12 bg-slate-50/50 border-slate-200 rounded-xl px-5 font-bold text-slate-700 shadow-sm text-[13px] focus:bg-white transition-all caret-black" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2.5">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Género *</label>
                                            <select value={formData.genero} onChange={e => setFormData({ ...formData, genero: e.target.value })} className="w-full h-10 bg-slate-50/50 border border-slate-200 rounded-xl px-4 font-bold text-[13px] text-slate-700 outline-none hover:border-blue-300 focus:border-blue-500 focus:bg-white transition-all shadow-sm">
                                                <option value="Femenino">Femenino</option>
                                                <option value="Masculino">Masculino</option>
                                                <option value="Otro">Otro</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2.5">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Fecha de nacimiento *</label>
                                            <Input type="date" value={formData.fechaNacimiento} onChange={e => setFormData({ ...formData, fechaNacimiento: e.target.value })} required className="h-10 bg-slate-50/50 border-slate-200 rounded-xl px-5 font-bold text-slate-700 shadow-sm text-[13px] focus:bg-white transition-all caret-black" />
                                        </div>
                                    </div>
                                </section>

                                {/* BLOQUE 2: INFORMACIÓN EMPRESARIAL */}
                                <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6 relative">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-600" />
                                    
                                    <div className="flex items-center gap-3 border-b border-slate-50 pb-4">
                                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
                                            <FiLayers size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-[15px] font-black text-slate-800 uppercase tracking-tight">Información empresarial</h4>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-80">Configuración de rol y prestaciones</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                <div className="space-y-0.5">
                                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Es doctor</span>
                                                </div>
                                                <button type="button" onClick={() => setFormData({ ...formData, esDoctor: !formData.esDoctor })} className={`w-12 h-6 rounded-full transition-all duration-500 relative ${formData.esDoctor ? "bg-emerald-500" : "bg-slate-200"}`}>
                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-500 shadow-sm ${formData.esDoctor ? "left-7" : "left-1"}`} />
                                                </button>
                                            </div>

                                            {formData.esDoctor && (
                                                <div className="space-y-4 animate-in slide-in-from-left-2 transition-all">
                                                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 transition-all">
                                                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Puede ver todo lo de otros doctores</span>
                                                        <button type="button" onClick={() => setFormData({ ...formData, seeOtherDoctorsData: !formData.seeOtherDoctorsData })} className={`w-10 h-5 rounded-full transition-all duration-300 relative ${formData.seeOtherDoctorsData ? "bg-blue-600" : "bg-slate-300"}`}>
                                                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${formData.seeOtherDoctorsData ? "left-6" : "left-1"}`} />
                                                        </button>
                                                    </div>

                                                    <div className="space-y-1.5 transition-all">
                                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Porcentaje</label>
                                                        <Input type="number" value={formData.comisionPorcentaje} onChange={e => setFormData({ ...formData, comisionPorcentaje: e.target.value })} placeholder="0" className="h-10 bg-white border-slate-200 rounded-lg px-4 font-black text-blue-600 text-[16px] shadow-sm" />
                                                    </div>

                                                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 transition-all">
                                                        <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">¿Documentos clinicos se imprimen con logo?</span>
                                                        <button type="button" onClick={() => setFormData({ ...formData, clinicalDocsWithLogo: !formData.clinicalDocsWithLogo })} className={`w-10 h-5 rounded-full transition-all duration-300 relative ${formData.clinicalDocsWithLogo ? "bg-blue-600" : "bg-slate-300"}`}>
                                                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 ${formData.clinicalDocsWithLogo ? "left-6" : "left-1"}`} />
                                                        </button>
                                                    </div>

                                                    <div className="space-y-1.5 transition-all">
                                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Cabecera documentos clínicos</label>
                                                        <div className="flex bg-slate-100 p-1 rounded-lg">
                                                            <button type="button" onClick={() => setFormData({ ...formData, clinicalDocsHeader: "sucursal" })} className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${formData.clinicalDocsHeader === "sucursal" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"}`}>Sucursal</button>
                                                            <button type="button" onClick={() => setFormData({ ...formData, clinicalDocsHeader: "personalizado" })} className={`flex-1 py-1.5 rounded-md text-[9px] font-black uppercase tracking-widest transition-all ${formData.clinicalDocsHeader === "personalizado" ? "bg-white text-blue-600 shadow-sm" : "text-slate-400"}`}>Personalizado</button>
                                                        </div>
                                                    </div>

                                                    {formData.clinicalDocsHeader === 'personalizado' && (
                                                        <div className="space-y-1.5 animate-in slide-in-from-top-2 transition-all">
                                                            <div className="flex items-center gap-2 ml-1">
                                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Encabezado personalizado</label>
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

                                        <div className="space-y-4">
                                            <div className="space-y-2.5">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Forma de pago</label>
                                                <select value={formData.formaPago} onChange={e => setFormData({ ...formData, formaPago: e.target.value })} className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg px-3 font-black text-[11px] text-slate-700 focus:border-blue-500 transition-all">
                                                    <option value="Realizadas y pagadas">Realizadas y pagadas</option>
                                                    <option value="Solo realizadas">Solo realizadas</option>
                                                </select>
                                            </div>

                                            <div className="space-y-2.5">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de perfil *</label>
                                                {(() => {
                                                    const isEditingAdmin = editId && users.find(u => u.id === editId)?.rol === "administrador";
                                                    if (isEditingAdmin) {
                                                        return (
                                                            <input 
                                                                type="text" 
                                                                readOnly 
                                                                value="Administrador (Propietario)" 
                                                                className="w-full h-10 bg-slate-100 border border-slate-200 rounded-xl px-4 font-black text-[11px] text-slate-500 cursor-not-allowed outline-none"
                                                            />
                                                        );
                                                    }
                                                    return (
                                                        <select required value={formData.profileId} onChange={e => setFormData({ ...formData, profileId: e.target.value })} className="w-full h-10 bg-slate-50 border border-slate-200 rounded-lg px-3 font-black text-[11px] text-slate-700 focus:border-blue-500 transition-all">
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
                                <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6 relative">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-slate-900" />
                                    
                                    <div className="flex items-center gap-3 border-b border-slate-50 pb-3 mb-2">
                                        <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-800 flex items-center justify-center shadow-inner">
                                            <FiMapPin size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-[15px] font-black text-slate-800 uppercase tracking-tight">Acceso a Sucursales *</h4>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-80">Puntos de atención autorizados</p>
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
                                <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6 relative">
                                    <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600 rounded-l-3xl" />

                                    <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
                                            <FiActivity size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-[15px] font-black text-slate-800 uppercase tracking-tight">Datos de sesión</h4>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-80">Credenciales de acceso al sistema</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2.5">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Correo electrónico *</label>
                                            <div className="relative">
                                                <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required placeholder="usuario@clinica.com" className="w-full h-11 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl pl-11 pr-4 font-bold text-[13px] text-slate-700 outline-none transition-all caret-black" />
                                            </div>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">Este correo se usa para iniciar sesión</p>
                                        </div>

                                        <div className="space-y-2.5">
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Contraseña *</label>
                                            <div className="relative">
                                                <input 
                                                    type={showPassword ? "text" : "password"} 
                                                    value={formData.password} 
                                                    onChange={e => setFormData({ ...formData, password: e.target.value })} 
                                                    required={!editId} 
                                                    minLength={8}
                                                    placeholder="Mínimo 8 caracteres" 
                                                    className={`w-full h-11 bg-slate-50 border ${formData.password && formData.password.length > 0 && formData.password.length < 8 ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-blue-500'} focus:bg-white rounded-xl pl-4 pr-12 font-bold text-[13px] text-slate-700 outline-none transition-all caret-black`}
                                                />
                                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all">
                                                    {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                                                </button>
                                            </div>
                                            <p className={`text-[9px] font-bold uppercase tracking-widest pl-1 ${formData.password && formData.password.length > 0 && formData.password.length < 8 ? 'text-red-500' : 'text-slate-400'}`}>
                                                {editId ? "Dejar vacío para conservar la actual" : 
                                                 formData.password && formData.password.length > 0 && formData.password.length < 8 ? 
                                                 `Faltan ${8 - formData.password.length} caracteres` : 
                                                 "Mín. 8 caracteres alfanuméricos"}
                                            </p>
                                        </div>
                                    </div>
                                </section>
                            </form>
                        </div>

                        {/* Professional Footer Container */}
                        <div className="bg-white px-10 py-8 border-t border-slate-100 flex items-center justify-between shrink-0 relative z-20">
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Validación de Datos en Tiempo Real</span>
                                </div>
                                <div className="h-4 w-px bg-slate-200" />
                                <div className="flex items-center gap-3">
                                    <FiInfo className="text-blue-500" size={14} />
                                    <span className="text-[9px] font-bold text-slate-400 leading-tight max-w-[200px]">Los cambios en el perfil de acceso se aplicarán de inmediato al próximo inicio de sesión.</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setModalOpen(false)}
                                    className="px-8 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all duration-300"
                                >
                                    Descartar
                                </button>
                                <button
                                    onClick={handleSubmitForm}
                                    disabled={saving}
                                    className="group relative h-14 bg-slate-900 hover:bg-blue-600 text-white px-12 rounded-2xl text-[13px] font-black uppercase tracking-[0.3em] flex items-center gap-4 shadow-[0_20px_50px_rgba(0,0,0,0.2)] hover:shadow-blue-500/30 transition-all duration-500 active:scale-95 disabled:opacity-50 overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-700 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    {saving ? (
                                        <div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin relative z-10" />
                                    ) : (
                                        <>
                                            <span className="relative z-10">{editId ? "Confirmar Cambios" : "Ejecutar Registro"}</span>
                                            <FiSave size={20} className="relative z-10 group-hover:translate-x-1 transition-transform" />
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
                            <div className="flex items-center gap-4">
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
