# 🔧 Correcciones Pendientes

## ✅ **Completadas:**
1. ✅ Sucursales - Validaciones completas implementadas
2. ✅ Consecutivos - Guardado Firebase y botones funcionales
3. ✅ Doctores - Campo especialidad agregado

---

## ❌ **Pendientes:**

### 4. Agenda - Eliminar Campo Servicio

**Archivo:** `src/modules/agenda/components/AppointmentModal.jsx`

**Líneas 505-511:** Eliminar completamente este bloque:

```jsx
<div className="space-y-1.5">
    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Servicio / Procedimiento</label>
    <select {...register("precioItemId")} disabled={!hasWritePermission} className="w-full bg-white border border-slate-200 rounded-[14px] px-4 py-3 text-[11px] font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500/30 uppercase cursor-pointer shadow-sm transition-all appearance-none">
        <option value="">BUSCAR ÍTEM EN LISTA DE PRECIOS...</option>
        {priceList.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
    </select>
</div>
```

**Acción:** Buscar el bloque y eliminarlo completamente.

---

### 5. Pacientes - Múltiples Correcciones

**Archivo:** `src/modules/pacientes/components/PatientForm.jsx`

#### A. Quitar Mayúsculas Forzadas

**Problema:** Varios campos tienen `className="... uppercase"` o `.toUpperCase()` forzado

**Solución:**

1. **Campo nombreCompleto (línea ~445):**
   ```jsx
   // ANTES:
   <input value={watch("nombreCompleto")?.toUpperCase() || ""} readOnly .../>
   
   // DESPUÉS:
   <input value={watch("nombreCompleto") || ""} readOnly .../>
   ```

2. **Campo nombreEps (línea ~633):**
   ```jsx
   // ANTES:
   className="form-input text-sm w-full md:w-64 uppercase"
   
   // DESPUÉS:
   className="form-input text-sm w-full md:w-64"
   ```

3. **Buscar TODOS los inputs con clase `uppercase` y eliminarla:**
   ```bash
   # Buscar en el archivo:
   grep -n "uppercase" PatientForm.jsx
   ```

#### B. Agregar Dropdown de Ciudades

**Problema:** `ciudadNacimiento` y `ciudadDomicilio` son inputs de texto libre

**Solución:** Cambiar a `<select>` usando el array `CIUDADES_COLOMBIA`

1. **Importar o definir CIUDADES_COLOMBIA al inicio del archivo:**

```jsx
const CIUDADES_COLOMBIA = [
    "Abejorral", "Acacías", "Aguachica", "Agustín Codazzi", "Anapoima", "Andes", "Apartadó", "Aracataca", "Arauca", "Armenia",
    "Baranoa", "Barbosa", "Barrancabermeja", "Barranquilla", "Bello", "Bogotá D.C.", "Bucaramanga", "Buenaventura", "Buga",
    "Cajicá", "Calarcá", "Caldas", "Cali", "Candelaria", "Carepa", "Cartagena", "Cartago", "Caucasia", "Cereté", "Chía",
    "Chigorodó", "Chiquinquirá", "Ciénaga", "Cota", "Cúcuta", "Dosquebradas", "Duitama", "El Bagre", "El Carmen de Viboral",
    "Envigado", "Espinal", "Facatativá", "Florencia", "Floridablanca", "Fundación", "Funza", "Fusagasugá", "Garzón", "Girardot",
    "Girón", "Granada", "Honda", "Ibagué", "Ipiales", "Itagüí", "Jamundí", "La Ceja", "La Dorada", "La Estrella", "La Mesa",
    "Lorica", "Madrid", "Magangué", "Maicao", "Malambo", "Manizales", "Marinilla", "Medellín", "Melgar", "Mitú", "Montelíbano",
    "Montería", "Mosquera", "Neiva", "Ocaña", "Paipa", "Palmira", "Pamplona", "Pasto", "Pereira", "Pitalito", "Planeta Rica",
    "Plato", "Popayán", "Puerto Asís", "Puerto Berrío", "Puerto Boyacá", "Puerto Carreño", "Puerto Colombia", "Quibdó",
    "Riohacha", "Rionegro", "Sabanalarga", "Sabaneta", "Sahagún", "San Andrés", "San Gil", "Santa Marta", "Santa Rosa de Cabal",
    "Santander de Quilichao", "Saravena", "Sevilla", "Sibaté", "Sincelejo", "Soacha", "Socorro", "Sogamoso", "Soledad", "Sonsón",
    "Sopó", "Tibú", "Tierralta", "Tuluá", "Tumaco", "Tunja", "Turbaco", "Turbo", "Valledupar", "Villa del Rosario", "Villavicencio",
    "Villeta", "Yopal", "Yumbo", "Zipaquirá"
].sort();
```

2. **Ciudad de Nacimiento (línea ~463):**

```jsx
// ANTES:
<FormRow label="Ciudad de nacimiento">
    <input {...register("ciudadNacimiento")} className="form-input text-sm w-full md:w-64" placeholder="Ej: Bogotá" />
</FormRow>

// DESPUÉS:
<FormRow label="Ciudad de nacimiento">
    <select {...register("ciudadNacimiento")} className="form-input text-sm w-full md:w-64">
        <option value="">Seleccione...</option>
        {CIUDADES_COLOMBIA.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
</FormRow>
```

3. **Ciudad de Domicilio (buscar línea similar):**

```jsx
// ANTES:
<FormRow label="Ciudad de domicilio">
    <input {...register("ciudadDomicilio")} ... />
</FormRow>

// DESPUÉS:
<FormRow label="Ciudad de domicilio">
    <select {...register("ciudadDomicilio")} className="form-input text-sm w-full md:w-64">
        <option value="">Seleccione...</option>
        {CIUDADES_COLOMBIA.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
</FormRow>
```

#### C. Campo "Remitido Por" - Implementar Opción Libre o Selección

**Solución Completa:**

1. **Agregar estado para controlar el tipo de referencia:**

```jsx
const [tipoRemision, setTipoRemision] = useState("libre"); // "libre", "usuario", "paciente"
```

2. **Crear el componente de campo "Remitido Por":**

```jsx
<FormRow label="Remitido por">
    <div className="space-y-3">
        {/* Selector de tipo */}
        <div className="flex gap-4 mb-2">
            <label className="flex items-center gap-2 cursor-pointer">
                <input 
                    type="radio" 
                    name="tipoRemision" 
                    value="libre"
                    checked={tipoRemision === "libre"}
                    onChange={(e) => setTipoRemision(e.target.value)}
                    className="w-4 h-4 accent-indigo-600"
                />
                <span className="text-sm font-bold text-slate-700">Texto libre</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
                <input 
                    type="radio" 
                    name="tipoRemision" 
                    value="usuario"
                    checked={tipoRemision === "usuario"}
                    onChange={(e) => setTipoRemision(e.target.value)}
                    className="w-4 h-4 accent-indigo-600"
                />
                <span className="text-sm font-bold text-slate-700">Usuario del sistema</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
                <input 
                    type="radio" 
                    name="tipoRemision" 
                    value="paciente"
                    checked={tipoRemision === "paciente"}
                    onChange={(e) => setTipoRemision(e.target.value)}
                    className="w-4 h-4 accent-indigo-600"
                />
                <span className="text-sm font-bold text-slate-700">Paciente existente</span>
            </label>
        </div>

        {/* Campo dinámico según tipo */}
        {tipoRemision === "libre" && (
            <input 
                {...register("remitidoPor")} 
                className="form-input text-sm w-full md:w-96" 
                placeholder="Ingrese el nombre de quien refiere" 
            />
        )}

        {tipoRemision === "usuario" && (
            <select 
                {...register("remitidoPorUsuarioId")} 
                className="form-input text-sm w-full md:w-96"
            >
                <option value="">Seleccione un usuario...</option>
                {/* Cargar usuarios desde Firebase */}
            </select>
        )}

        {tipoRemision === "paciente" && (
            <select 
                {...register("remitidoPorPacienteId")} 
                className="form-input text-sm w-full md:w-96"
            >
                <option value="">Seleccione un paciente...</option>
                {/* Cargar pacientes desde Firebase */}
            </select>
        )}
    </div>
</FormRow>
```

3. **Cargar usuarios y pacientes (agregar en useEffect):**

```jsx
const [usuarios, setUsuarios] = useState([]);
const [pacientes, setPacientes] = useState([]);

useEffect(() => {
    const loadRemisionData = async () => {
        if (!userProfile?.inquilino) return;
        
        try {
            const [uSnap, pSnap] = await Promise.all([
                getDocs(query(collection(db, "usuarios"), where("inquilino", "==", userProfile.inquilino))),
                getDocs(query(collection(db, "pacientes"), where("inquilino", "==", userProfile.inquilino)))
            ]);
            
            setUsuarios(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));
            setPacientes(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) {
            console.error("Error cargando datos de remisión:", error);
        }
    };
    
    loadRemisionData();
}, [userProfile?.inquilino]);
```

4. **Actualizar los selects con los datos:**

```jsx
{tipoRemision === "usuario" && (
    <select {...register("remitidoPorUsuarioId")} className="form-input text-sm w-full md:w-96">
        <option value="">Seleccione un usuario...</option>
        {usuarios.map(u => (
            <option key={u.id} value={u.id}>
                {u.nombre} {u.apellido} - {u.email}
            </option>
        ))}
    </select>
)}

{tipoRemision === "paciente" && (
    <select {...register("remitidoPorPacienteId")} className="form-input text-sm w-full md:w-96">
        <option value="">Seleccione un paciente...</option>
        {pacientes.map(p => (
            <option key={p.id} value={p.id}>
                {p.nombreCompleto || `${p.nombre} ${p.apellido}`}
            </option>
        ))}
    </select>
)}
```

---

## 📝 Resumen de Archivos a Modificar

1. ✅ `src/modules/config/EmpresaSucursales.jsx` - Completado
2. ✅ `src/modules/config/ConfigConsecutivos.jsx` - Completado
3. ✅ `src/modules/config/ConfigConsecutivosForm.jsx` - Completado
4. ✅ `src/modules/config/ConfigUsuarios.jsx` - Completado
5. ❌ `src/modules/agenda/components/AppointmentModal.jsx` - Eliminar campo servicio
6. ❌ `src/modules/pacientes/components/PatientForm.jsx` - Múltiples correcciones

---

## 🎯 Próximos Pasos

1. Eliminar campo "Servicio" en Agenda
2. Quitar mayúsculas forzadas en Pacientes
3. Agregar dropdowns de ciudades en Pacientes
4. Implementar campo "Remitido Por" mejorado en Pacientes
5. Probar todas las correcciones
6. Commit final y push

---

**Fecha:** 2026-07-04  
**Estado:** 60% Completado  
**Última actualización:** Doctores - Campo especialidad agregado
