import React, { useState, useEffect } from "react";
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp, query, orderBy, where, getDoc } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { db, firebaseConfig } from "../../firebase/firebaseConfig"; // Import config to create secondary app
import { useAuth } from "../../context/AuthContext";
import { FiTrash2, FiEdit2 } from "react-icons/fi";

// Singleton secondary Firebase app — prevents duplicate-app crashes
const getSecondaryAuth = () => {
    const existing = getApps().find(app => app.name === "SecondaryAppUsuarios");
    const app = existing || initializeApp(firebaseConfig, "SecondaryAppUsuarios");
    return getAuth(app);
};

export default function ConfigUsuarios() {
    const { userProfile } = useAuth();
    const [users, setUsers] = useState([]);
    const [rolesDisponibles, setRolesDisponibles] = useState([]);
    const [sucursales, setSucursales] = useState([]);
    const [especialidades, setEspecialidades] = useState([]);

    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form State Expanded
    const [formData, setFormData] = useState({
        // Basic Info
        nombre: "",
        apellido: "",
        email: "", // "Correo electrónico"
        tipoDocumento: "CC",
        numeroDocumento: "",
        telefonoMovil: "",
        telefonoFijo: "",
        direccion: "",
        genero: "Femenino",
        fechaNacimiento: "",

        // Enterprise Info
        esDoctor: false, // Checkbox "Es doctor"
        especialidades: [], // Array de IDs de especialidades
        profileId: "", // "Tipo de perfil"
        sucursales: [], // IDs selected

        // Session Data
        username: "", // Usually email
        password: ""
    });

    // Load Data
    const loadData = async () => {
        if (!userProfile) return;

        setLoading(true);
        try {
            // Filter users by Tenant if applicable
            let usersQuery = query(collection(db, "usuarios"), orderBy("email"));
            if (userProfile.inquilino) {
                usersQuery = query(collection(db, "usuarios"), where("inquilino", "==", userProfile.inquilino));
            }

            const [uSnap, pSnap, sSnap, eSnap] = await Promise.all([
                getDocs(usersQuery),
                getDocs(query(collection(db, "perfiles"), orderBy("nombre"))),
                getDocs(query(collection(db, "sucursales"), orderBy("nombre"))),
                getDocs(query(collection(db, "especialidades"), where("inquilino", "==", userProfile.inquilino), orderBy("nombre")))
            ]);

            setUsers(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setRolesDisponibles(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setSucursales(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setEspecialidades(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (userProfile) loadData();
    }, [userProfile]);

    // Handle Branch Selection
    const toggleBranch = (id) => {
        setFormData(prev => {
            const current = prev.sucursales || [];
            if (current.includes(id)) return { ...prev, sucursales: current.filter(x => x !== id) };
            return { ...prev, sucursales: [...current, id] };
        });
    };

    // Handle Specialty Selection
    const toggleEspecialidad = (id) => {
        setFormData(prev => {
            const current = prev.especialidades || [];
            if (current.includes(id)) return { ...prev, especialidades: current.filter(x => x !== id) };
            return { ...prev, especialidades: [...current, id] };
        });
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        if (!formData.email || !formData.password || !formData.nombre || !formData.profileId) {
            return alert("Complete los campos obligatorios (*)");
        }

        setSaving(true);
        try {
            const selectedProfile = rolesDisponibles.find(p => p.id === formData.profileId);
            const secondaryAuth = getSecondaryAuth();

            try {
                const userCred = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
                const uid = userCred.user.uid;

                // Determine the role robustly: prefer baseRole from profile, fallback by name
                const rolFromProfile = (selectedProfile.baseRole || selectedProfile.rol || "").trim().toLowerCase();
                const rolByName = (selectedProfile.nombre || "").toLowerCase().includes("doctor") || 
                                  (selectedProfile.nombre || "").toLowerCase().includes("odont") ? "doctor" : null;
                const finalRol = rolFromProfile || rolByName || "recepcionista";

                await setDoc(doc(db, "usuarios", uid), {
                    uid,
                    createdAt: serverTimestamp(),
                    activo: true,

                    // Mapped Data
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

                    esDoctor: formData.esDoctor || finalRol === "doctor",
                    especialidades: formData.esDoctor ? (formData.especialidades || []) : [],
                    sucursales: formData.sucursales,

                    // Profile Link
                    profileId: selectedProfile.id,
                    profileName: selectedProfile.nombre,
                    rol: finalRol,

                    // TENANT ASSOCIATION
                    inquilino: userProfile?.inquilino || null,
                    tenantId: userProfile?.inquilino || null,
                });

                alert("✅ Usuario creado exitosamente.");
                setModalOpen(false);
                setFormData({
                    nombre: "", apellido: "", email: "", tipoDocumento: "CC", numeroDocumento: "",
                    telefonoMovil: "", telefonoFijo: "", direccion: "", genero: "Femenino", fechaNacimiento: "",
                    esDoctor: false, especialidades: [], profileId: "", sucursales: [], username: "", password: ""
                });
                loadData();
            } catch (inner) {
                if (inner.code === 'auth/email-already-in-use') alert("Correo ya registrado.");
                else throw inner;
            }
        } catch (err) {
            console.error(err);
            alert("Error: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (u) => {
        if (u.rol === "administrador") return alert("⛔ Protegido.");
        if (!window.confirm("¿Eliminar usuario?")) return;
        await deleteDoc(doc(db, "usuarios", u.id));
        loadData();
    };

    return (
        <div className="card shadow-md p-6 bg-white rounded-xl">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Gestión de Usuarios</h2>
                <button onClick={() => setModalOpen(true)} className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-bold shadow hover:bg-indigo-700">
                    + Nuevo Usuario
                </button>
            </div>

            {/* User Table (Simplified Presentation) */}
            <table className="w-full text-left bg-white border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-bold">
                    <tr>
                        <th className="p-4">Usuario</th>
                        <th className="p-4">Perfil</th>
                        <th className="p-4">Sucursales</th>
                        <th className="p-4 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                    {users.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50">
                            <td className="p-4">
                                <div className="font-bold">{u.nombreCompleto || u.nombre}</div>
                                <div className="text-xs text-slate-500">{u.email}</div>
                            </td>
                            <td className="p-4"><span className="tag">{u.profileName || u.rol || "Sin Perfil"}</span></td>
                            <td className="p-4 text-xs text-slate-500">
                                {u.sucursales?.length || 0} asignadas
                            </td>
                            <td className="p-4 text-right">
                                <div className="flex justify-end gap-2">
                                    <button 
                                        onClick={() => handleDelete(u)} 
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 text-sm font-medium"
                                        title="Eliminar usuario"
                                    >
                                        <FiTrash2 className="text-base" />
                                        <span>Eliminar</span>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {users.length === 0 && <tr><td colSpan={4} className="p-4 text-center">No hay usuarios</td></tr>}
                </tbody>
            </table>

            {/* BIG FORM MODAL */}
            {modalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
                    <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl flex flex-col h-[90vh] animate-scale-in">

                        {/* Header */}
                        <div className="border-b px-8 py-5 flex justify-between items-center bg-slate-50 rounded-t-xl shrink-0">
                            <h3 className="text-xl font-bold text-slate-700">Editar usuario / Crear usuario</h3>
                            <button onClick={() => setModalOpen(false)} className="text-2xl text-slate-400 hover:text-slate-600">×</button>
                        </div>

                        <form onSubmit={handleCreateUser} className="p-8 space-y-8 overflow-y-auto grow custom-scrollbar">

                            {/* SECTION 1: INFO BASICA */}
                            <div>
                                <h4 className="text-sm font-bold text-indigo-600 uppercase mb-4 border-b pb-1">Información Básica</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="label">Nombre *</label>
                                        <input className="input" value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} required />
                                    </div>
                                    <div>
                                        <label className="label">Apellido *</label>
                                        <input className="input" value={formData.apellido} onChange={e => setFormData({ ...formData, apellido: e.target.value })} required />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="label">Correo electrónico *</label>
                                        <input type="email" className="input bg-white" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
                                    </div>
                                    <div>
                                        <label className="label">Tipo documento *</label>
                                        <select className="input" value={formData.tipoDocumento} onChange={e => setFormData({ ...formData, tipoDocumento: e.target.value })}>
                                            <option value="CC">Cédula de ciudadanía</option>
                                            <option value="CE">Cédula de extranjería</option>
                                            <option value="TI">Tarjeta de identidad</option>
                                            <option value="PAS">Pasaporte</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label">Número de documento *</label>
                                        <input className="input" value={formData.numeroDocumento} onChange={e => setFormData({ ...formData, numeroDocumento: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="label">Teléfono móvil *</label>
                                        <input className="input" value={formData.telefonoMovil} onChange={e => setFormData({ ...formData, telefonoMovil: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="label">Teléfono Fijo</label>
                                        <input className="input" value={formData.telefonoFijo} onChange={e => setFormData({ ...formData, telefonoFijo: e.target.value })} />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="label">Dirección *</label>
                                        <input className="input" value={formData.direccion} onChange={e => setFormData({ ...formData, direccion: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="label">Género *</label>
                                        <select className="input" value={formData.genero} onChange={e => setFormData({ ...formData, genero: e.target.value })}>
                                            <option value="Femenino">Femenino</option>
                                            <option value="Masculino">Masculino</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label">Fecha de nacimiento *</label>
                                        <input type="date" className="input" value={formData.fechaNacimiento} onChange={e => setFormData({ ...formData, fechaNacimiento: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 2: INFO EMPRESARIAL */}
                            <div>
                                <h4 className="text-sm font-bold text-indigo-600 uppercase mb-4 border-b pb-1">Información Empresarial</h4>

                                <div className="mb-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" className="w-4 h-4 accent-indigo-600" checked={formData.esDoctor} onChange={e => setFormData({ ...formData, esDoctor: e.target.checked })} />
                                        <span className="text-sm font-bold text-slate-700">¿Es doctor? (Aparecerá en agenda)</span>
                                    </label>
                                </div>

                                {/* Especialidades (solo si es doctor) */}
                                {formData.esDoctor && (
                                    <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
                                        <label className="label mb-2 block">Especialidades del doctor *</label>
                                        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 max-h-40 overflow-y-auto">
                                            {especialidades.length === 0 ? (
                                                <p className="text-xs text-slate-400 p-2">No hay especialidades creadas. Cree especialidades en Config → Empresa → Especialidades.</p>
                                            ) : (
                                                <div className="grid gap-2">
                                                    {especialidades.map(esp => (
                                                        <label key={esp.id} className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-white transition-colors ${formData.especialidades?.includes(esp.id) ? "bg-white shadow-sm border border-indigo-100" : ""}`}>
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.especialidades?.includes(esp.id)}
                                                                onChange={() => toggleEspecialidad(esp.id)}
                                                                className="w-4 h-4 accent-indigo-600"
                                                            />
                                                            <span className="text-sm text-slate-700">{esp.nombre}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1">Seleccione las especialidades que el doctor puede atender.</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Profile Type */}
                                    <div>
                                        <label className="label">Tipo de perfil *</label>
                                        <select
                                            className="input text-lg font-medium text-slate-800"
                                            value={formData.profileId}
                                            onChange={e => setFormData({ ...formData, profileId: e.target.value })}
                                            required
                                        >
                                            <option value="">Seleccione...</option>
                                            {rolesDisponibles.map(r => (
                                                <option key={r.id} value={r.id}>{r.nombre}</option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-slate-400 mt-1">Este perfil define los permisos de acceso.</p>
                                    </div>

                                    {/* Branch Transfer List */}
                                    <div>
                                        <label className="label mb-2 block">Sucursales *</label>
                                        <div className="border border-slate-200 rounded-lg h-48 overflow-y-auto p-2 bg-slate-50 grid gap-1">
                                            {sucursales.length === 0 && <p className="text-xs text-slate-400 p-2">No hay sucursales creadas. Cree sucursales en Config &gt; Sucursales.</p>}
                                            {sucursales.map(s => (
                                                <label key={s.id} className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-white transition-colors ${formData.sucursales.includes(s.id) ? "bg-white shadow-sm border border-indigo-100" : ""}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.sucursales.includes(s.id)}
                                                        onChange={() => toggleBranch(s.id)}
                                                        className="w-4 h-4 accent-indigo-600"
                                                    />
                                                    <span className="text-sm text-slate-700">{s.nombre}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 3: SESSION DATA */}
                            <div>
                                <h4 className="text-sm font-bold text-indigo-600 uppercase mb-4 border-b pb-1">Datos de Sesión</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    <div>
                                        <label className="label">Nombre de usuario (Email) *</label>
                                        <input type="email" className="input bg-white" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
                                    </div>
                                    <div>
                                        <label className="label">Contraseña *</label>
                                        <input type="text" className="input font-mono" placeholder="******" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required={!formData.uid} minLength={6} />
                                    </div>
                                </div>
                            </div>

                        </form>

                        {/* Footer Actions Fixed */}
                        <div className="p-5 border-t bg-white flex justify-end gap-3 rounded-b-xl shrink-0">
                            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
                            <button type="button" onClick={handleCreateUser} disabled={saving} className="btn-primary px-8">
                                {saving ? "Guardando..." : "Guardar Usuario"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Styles Injection for this component */}
            <style>{`
        .label { display: block; font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 0.25rem; }
        .input { width: 100%; padding: 0.6rem; border: 1px solid #cbd5e1; border-radius: 0.5rem; outline: none; transition: all; }
        .input:focus { border-color: #6366f1; ring: 2px solid #e0e7ff; }
        .btn-primary { background-color: #7dd3fc; color: #0c4a6e; font-weight: bold; padding: 0.75rem 1.5rem; border-radius: 0.5rem; transition: background 0.2s; }
        .btn-primary:hover { background-color: #38bdf8; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-secondary { background-color: white; color: #64748b; font-weight: 600; padding: 0.75rem 1.5rem; border-radius: 0.5rem; border: 1px solid #cbd5e1; }
        .btn-secondary:hover { background-color: #f1f5f9; }
        .tag { padding: 0.25rem 0.5rem; background: #e0f2fe; color: #0369a1; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
        </div>
    );
}
