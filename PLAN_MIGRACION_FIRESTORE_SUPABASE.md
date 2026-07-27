# Plan de Migración Completa: Firestore → Supabase

## 🎯 Objetivo
Migrar **TODO** el sistema OdontoCloud de Firestore a Supabase sin migrar datos históricos. El sistema funcionará desde cero con Supabase.

---

## 📊 Estado Actual de Migración

### ✅ **COMPLETADO** (20%)
1. **Pacientes** → `patientService.js` ✅
2. **Configuración de formularios** → `configuracionFormularios` ✅  
3. **Barrios catálogo** → `barriosCatalogo` ✅
4. **EPS catálogo** → `epsCatalogo` ✅
5. **Schema SQL completo** → `20250127_full_system_migration.sql` ✅
6. **Servicios base** → `supabaseServices.js` ✅

### 🔄 **EN PROGRESO** (30%)
7. **PatientDetails.jsx** → Migración parcial de catálogos ⚠️
8. **Citas/Agenda** → Schema existe pero lógica mixta ⚠️
9. **Evoluciones** → Schema existe pero lógica mixta ⚠️
10. **Pagos** → Schema existe pero lógica mixta ⚠️

### ❌ **PENDIENTE** (50%)
**Críticos para funcionalidad básica:**
11. Recibos de caja
12. Cajas y movimientos
13. Facturas (completar)
14. Odontogramas (migrar subcollection)
15. Documentos clínicos
16. Profesionales
17. Métodos de pago

**Secundarios:**
18. Convenios
19. Inventario
20. Reportes
21. Portal de pacientes
22. Configuraciones avanzadas

---

## 🚀 Plan de Ejecución

### **FASE 1: CRÍTICA - Funcionalidad Básica**
**Objetivo:** Sistema funcional para nuevos datos (sin migrar históricos)

#### 1.1 Completar migración de Pacientes
- [x] PatientDetails - Barrios catálogo
- [x] PatientDetails - EPS catálogo  
- [x] PatientDetails - Configuración de formularios
- [ ] PatientForm.jsx - Migrar catálogos
- [ ] Eliminar todas las referencias a Firestore en módulo pacientes

#### 1.2 Migrar Agenda/Citas
- [ ] `src/modules/agenda/` → Usar `citas` table
- [ ] `agendaLogic.js` → Reemplazar Firestore
- [ ] Real-time subscriptions → Supabase realtime

#### 1.3 Migrar Evoluciones Clínicas
- [ ] `EvolutionList.jsx` → Usar `evoluciones` table
- [ ] `HistoriaClinicaContainer.jsx` → Supabase
- [ ] Documentos clínicos → `documentos_clinicos` table

#### 1.4 Migrar Sistema de Pagos
- [ ] `PagoTab.jsx` → Usar `pagos` table
- [ ] `HistoricoPagosTab.jsx` → Supabase
- [ ] `SaldoTab.jsx` → Supabase

### **FASE 2: FACTURACIÓN**
**Objetivo:** Sistema de facturación completo

#### 2.1 Recibos de Caja
- [ ] `ReciboCajaForm.jsx` → `recibos_caja` table
- [ ] `ReciboCajaList.jsx` → Supabase
- [ ] Consecutivos automáticos

#### 2.2 Cajas
- [ ] Sistema de cajas → `cajas` + `movimientos_caja` tables
- [ ] Apertura/cierre de caja
- [ ] Control de saldos

#### 2.3 Facturas
- [ ] Completar `FacturaElectronicaForm.jsx`
- [ ] Notas débito/crédito
- [ ] Integración con DIAN

### **FASE 3: ADMINISTRACIÓN**
**Objetivo:** Configuración y administración

#### 3.1 Profesionales y Recursos
- [ ] `profesionales` → Unificar con `profiles`
- [ ] `sucursales` table
- [ ] `recursos_fisicos` + horarios

#### 3.2 Configuraciones
- [ ] Métodos de pago → `metodos_pago` table
- [ ] Convenios → `convenios` + `convenios_descuentos`
- [ ] Plantillas clínicas

### **FASE 4: CLÍNICO**
**Objetivo:** Funcionalidad clínica completa

#### 4.1 Odontogramas
- [ ] Migrar subcollection → `odontogramas` table plana
- [ ] `Odontograma.jsx` → Supabase
- [ ] Planes de tratamiento integrados

#### 4.2 Historia Clínica
- [ ] Subcollection `docClis` → `documentos_clinicos` table
- [ ] Firmas digitales
- [ ] Plantillas

### **FASE 5: AVANZADO**
**Objetivo:** Funcionalidades completas

#### 5.1 Inventario
- [ ] `inventario` + `movimientos_inventario` tables
- [ ] Control de stock automático
- [ ] Descuento por procedimientos

#### 5.2 Reportes
- [ ] Migrar todas las consultas de Firestore
- [ ] RIPS desde Supabase
- [ ] Dashboards

#### 5.3 Otros Módulos
- [ ] Portal de pacientes
- [ ] WhatsApp logs
- [ ] Notificaciones

---

## 📋 Checklist por Archivo

### Servicios Críticos
- [ ] `appointmentService.js` → Migrar a Supabase
- [ ] `evolutionService.js` → Migrar a Supabase  
- [ ] `billingService.js` → Migrar a Supabase
- [ ] `planService.js` → Migrar a Supabase

### Componentes de Pacientes
- [x] `PatientDetails.jsx` → Parcialmente migrado
- [ ] `PatientForm.jsx` → Migrar catálogos
- [ ] `EvolutionList.jsx` → Migrar a Supabase
- [ ] `PagoTab.jsx` → Migrar a Supabase
- [ ] `HistoricoPagosTab.jsx` → Migrar a Supabase
- [ ] `SaldoTab.jsx` → Migrar a Supabase
- [ ] `PatientRxTab.jsx` → Migrar Storage + metadata
- [ ] `ProfesionalesTab.jsx` → Migrar a Supabase
- [ ] `BeneficiariosTab.jsx` → Migrar a Supabase

### Componentes de Agenda
- [ ] `Agenda.jsx` → Migrar a Supabase
- [ ] `AppointmentModal.jsx` → Migrar a Supabase
- [ ] `agendaLogic.js` → Migrar completamente

### Componentes de Facturación
- [ ] `ReciboCajaForm.jsx` → Migrar a Supabase
- [ ] `ReciboCajaList.jsx` → Migrar a Supabase
- [ ] `FacturaElectronicaForm.jsx` → Migrar a Supabase
- [ ] `SaldoFavorForm.jsx` → Migrar a Supabase

### Componentes de Administración
- [ ] `GestionAgenda.jsx` → Migrar horarios y recursos
- [ ] `ConfigPestanasMedicas.jsx` → Migrar configuración
- [ ] `EmpresaFormularioPacientes.jsx` → Ya migrado ✅

---

## 🔧 Pasos de Migración por Componente

### Patrón Estándar
1. **Identificar imports de Firestore**
   ```javascript
   // ANTES
   import { collection, query, where, getDocs } from "firebase/firestore";
   import { db } from "../../firebase/firebaseConfig";
   
   // DESPUÉS  
   import supabase from "../../lib/supabaseClient";
   // O usar servicios: import { nombreServicio } from "../../services/supabaseServices";
   ```

2. **Reemplazar consultas**
   ```javascript
   // ANTES - Firestore
   const snap = await getDocs(query(collection(db, "coleccion"), where("campo", "==", valor)));
   const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
   
   // DESPUÉS - Supabase
   const { data, error } = await supabase.from("tabla").select("*").eq("campo", valor);
   if (error) throw error;
   ```

3. **Actualizar real-time subscriptions**
   ```javascript
   // ANTES - Firestore onSnapshot
   const unsub = onSnapshot(query, (snap) => {
     setData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
   });
   
   // DESPUÉS - Supabase realtime (cuando esté listo)
   const subscription = supabase.channel('tabla')
     .on('postgres_changes', { event: '*', schema: 'public', table: 'tabla' }, 
         (payload) => { /* manejar cambio */ })
     .subscribe();
   ```

4. **Operaciones CRUD**
   ```javascript
   // CREATE - Firestore → Supabase
   await addDoc(collection(db, "coleccion"), data);
   // →
   await supabase.from("tabla").insert([data]);
   
   // UPDATE - Firestore → Supabase  
   await updateDoc(doc(db, "coleccion", id), updates);
   // →
   await supabase.from("tabla").update(updates).eq("id", id);
   
   // DELETE - Firestore → Supabase
   await deleteDoc(doc(db, "coleccion", id));
   // →
   await supabase.from("tabla").delete().eq("id", id);
   ```

---

## 🎯 Próximos Pasos Inmediatos

### 1. **Ejecutar migraciones SQL**
```bash
# En Supabase Dashboard → SQL Editor
# Ejecutar: supabase/migrations/20250127_add_patient_fields.sql
# Ejecutar: supabase/migrations/20250127_full_system_migration.sql
```

### 2. **Completar PatientForm.jsx**
- Migrar catálogos de barrios y EPS
- Eliminar referencias a Firestore

### 3. **Migrar AppointmentModal.jsx**
- Usar tabla `citas` en lugar de collection `agenda`
- Actualizar búsqueda de pacientes

### 4. **Migrar EvolutionList.jsx**
- Usar tabla `evoluciones` 
- Eliminar onSnapshot de Firestore

---

## ⚠️ Consideraciones Importantes

### **Real-time Subscriptions**
Supabase realtime está disponible pero puede requerir configuración adicional. Por ahora usar polling manual o cargar datos una sola vez.

### **Storage de Archivos** 
Firebase Storage se puede mantener temporalmente o migrar a Supabase Storage según necesidad.

### **Autenticación**
Firebase Auth se puede mantener inicialmente, pero considerar migración a Supabase Auth.

### **Naming Conventions**
- Firestore: `camelCase` y collections anidadas
- Supabase: `snake_case` y tablas relacionadas

### **Transacciones**
Firestore batch operations → Supabase transactions o RPC functions

---

## 📈 Progreso Esperado

- **Semana 1**: FASE 1 completa (funcionalidad básica)
- **Semana 2**: FASE 2 completa (facturación)  
- **Semana 3**: FASE 3-4 (administración y clínico)
- **Semana 4**: FASE 5 (módulos avanzados)

**Total estimado**: 4 semanas para migración completa

---

## 🔍 Testing

Después de cada fase:
1. Verificar que no hay errores de consola
2. Probar CRUD completo en cada módulo
3. Verificar que los datos se persisten correctamente
4. Comprobar que las relaciones entre tablas funcionan

---

**Última actualización**: 27 de Enero de 2025  
**Estado**: FASE 1 - En progreso (20% completado)