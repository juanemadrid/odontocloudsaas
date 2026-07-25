// modules/citas.js
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  doc,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

/**
 * Crear una nueva cita en Firestore.
 */
export async function crearCita(db, citaData) {
  try {
    const ref = await addDoc(collection(db, "citas"), {
      ...citaData,
      creado: new Date().toISOString(),
    });
    return { ok: true, id: ref.id };
  } catch (err) {
    console.error("❌ Error al crear cita:", err);
    return { ok: false, error: err };
  }
}

/**
 * Obtener todas las citas de una fecha específica.
 */
export async function obtenerCitasPorFecha(db, fechaIso) {
  try {
    const cRef = collection(db, "citas");
    const q = query(cRef, where("fecha", "==", fechaIso), orderBy("horaInicio"));
    const snap = await getDocs(q);

    const citas = [];
    snap.forEach((docSnap) => {
      citas.push({ id: docSnap.id, ...docSnap.data() });
    });
    return citas;
  } catch (err) {
    console.error("❌ Error al obtener citas:", err);
    return [];
  }
}

/**
 * Buscar citas por nombre de paciente o doctor.
 */
export async function buscarCitas(db, termino) {
  try {
    const citasRef = collection(db, "citas");
    const snap = await getDocs(citasRef);
    const term = termino.toLowerCase();
    const coincidencias = [];

    snap.forEach((d) => {
      const data = d.data();
      const texto = `${data.paciente || ""} ${data.doctor || ""} ${data.comentario || ""}`.toLowerCase();
      if (texto.includes(term)) coincidencias.push({ id: d.id, ...data });
    });

    return coincidencias;
  } catch (err) {
    console.error("❌ Error al buscar citas:", err);
    return [];
  }
}

/**
 * Actualizar una cita existente.
 */
export async function actualizarCita(db, citaId, nuevosDatos) {
  try {
    const ref = doc(db, "citas", citaId);
    await updateDoc(ref, nuevosDatos);
    return { ok: true };
  } catch (err) {
    console.error("❌ Error al actualizar cita:", err);
    return { ok: false, error: err };
  }
}

/**
 * Eliminar una cita por ID.
 */
export async function eliminarCita(db, citaId) {
  try {
    await deleteDoc(doc(db, "citas", citaId));
    return { ok: true };
  } catch (err) {
    console.error("❌ Error al eliminar cita:", err);
    return { ok: false, error: err };
  }
}
