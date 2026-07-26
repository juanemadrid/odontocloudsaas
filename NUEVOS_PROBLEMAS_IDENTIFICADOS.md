# 🐛 Nuevos Problemas Identificados - Módulos Clínicos

## 1. ❌ **RX (Radiografías) - No deja editar imágenes subidas**
**Módulo:** Gestión de imágenes radiológicas  
**Problema:** Una vez subida la RX, no se puede editar/reemplazar  
**Acción:** Agregar botón de editar/reemplazar imagen

---

## 2. ❌ **Receta Médica - Cálculo automático de cantidad**
**Módulo:** Prescripciones médicas  
**Problema:** La cantidad no se calcula automáticamente según frecuencia y duración  
**Fórmula:** `Cantidad = Frecuencia (dosis/día) × Duración (días)`  
**Ejemplo:** 3 veces al día × 7 días = 21 unidades  
**Acción:** Implementar cálculo automático en tiempo real

---

## 3. ❌ **Receta Médica - Falta firma del doctor**
**Módulo:** Prescripciones médicas  
**Problema:** No hay icono/acción para firma del doctor en recetas cargadas  
**Acción:** Agregar botón de firma en acciones de cada receta

---

## 4. ❌ **Presupuestos - Botón guardar no funciona**
**Módulo:** Gestión de presupuestos  
**Problema:** El botón "Guardar presupuesto" no tiene funcionalidad  
**Acción:** Implementar guardado en Firebase

---

## 5. ❌ **Presupuestos - Descuentos sin validación**
**Módulo:** Descuentos en presupuestos  
**Problema:** Permite descuentos que superan el monto del ítem  
**Validación:** `Descuento <= Precio del ítem`  
**Acción:** Agregar validación de descuento máximo

---

## 6. ❌ **Pagos - Campo referencia no aparece**
**Módulo:** Procesamiento de pagos  
**Problema:** Cuando se selecciona medio de pago que requiere referencia, no aparece el campo  
**Medios que requieren referencia:** Transferencia, cheque, etc.  
**Acción:** Mostrar campo referencia condicionalmente

---

## 7. ❌ **Pagos - Saldo a favor mal calculado**
**Módulo:** Aplicación de saldo a favor  
**Problema:** Aplica todo el saldo aunque sea menor al monto a pagar  
**Lógica correcta:** `Descuento = Math.min(saldoAFavor, montoAPagar)`  
**Acción:** Corregir cálculo de aplicación de saldo

---

## 8. ❌ **Histórico Pagos - Eliminar sin motivo**
**Módulo:** Anulación de pagos  
**Problema:** Permite eliminar pago sin pedir motivo de anulación  
**Acción:** Modal para capturar motivo antes de eliminar

---

## 9. ❌ **Evoluciones - Falta firma del doctor**
**Módulo:** Evoluciones médicas  
**Problema:** No permite agregar firma del doctor en evoluciones  
**Acción:** Agregar campo/botón de firma en evoluciones

---

## 10. ❌ **Evoluciones ↔ Presupuestos - Sin sincronización**
**Módulo:** Integración evolución-presupuesto  
**Problema:** Al marcar servicio como realizado en evolución, no se refleja en presupuesto  
**Estados requeridos:**  
- ✅ **Realizado y pagado** → Verde  
- ⚠️ **Realizado no pagado** → Amarillo/Rojo (deuda)  
- ⭕ **No realizado** → Gris  
**Acción:** Implementar sincronización bidireccional

---

## 📂 **Archivos Probables a Revisar:**

### Radiografías:
- `src/modules/pacientes/components/RadiografiaManager.jsx`
- `src/modules/pacientes/components/ImageUploader.jsx`

### Recetas:
- `src/modules/pacientes/components/RecetaManager.jsx`
- `src/modules/pacientes/components/PrescriptionForm.jsx`

### Presupuestos:
- `src/modules/pacientes/components/BudgetManager.jsx`
- `src/modules/pacientes/components/TreatmentPlan.jsx`

### Pagos:
- `src/modules/caja/components/PaymentForm.jsx`
- `src/modules/caja/components/PaymentHistory.jsx`

### Evoluciones:
- `src/modules/pacientes/components/EvolutionManager.jsx`
- `src/modules/pacientes/components/EvolutionForm.jsx`

---

## 🎯 **Prioridad de Correcciones:**

### Alta Prioridad:
1. **Presupuestos** - Botón guardar no funciona
2. **Pagos** - Campo referencia y saldo a favor
3. **Evoluciones** - Sincronización con presupuestos

### Media Prioridad:
4. **Recetas** - Cálculo cantidad y firma
5. **Histórico** - Motivo anulación
6. **RX** - Edición de imágenes

### Baja Prioridad:
7. **Presupuestos** - Validación descuentos
8. **Evoluciones** - Firma doctor

---

**Fecha identificación:** 2026-07-04  
**Estado:** ✅ Documentado - Listo para corrección  
**Estimación:** 8-10 archivos a modificar