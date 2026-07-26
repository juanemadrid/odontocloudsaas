import { db } from "./src/firebase/firebaseConfig";
import { collection, getDocs, query, where, updateDoc, doc } from "firebase/firestore";

const normalize = (str) => {
    if (!str) return "";
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
};

async function repairPatients(inquilino) {
    console.log(`Buscando pacientes para el inquilino: ${inquilino}`);
    const q = query(collection(db, "pacientes"), where("inquilino", "==", inquilino));
    const snap = await getDocs(q);

    console.log(`Encontrados ${snap.size} pacientes. Actualizando...`);

    for (const d of snap.docs) {
        const data = d.data();
        const nombreCompleto = data.nombreCompleto || data.paciente || "";
        await updateDoc(doc(db, "pacientes", d.id), {
            nombreCompletoLower: normalize(nombreCompleto),
            nombresLower: normalize(data.nombres || ""),
            apellidosLower: normalize(data.apellidos || ""),
            documentoLower: normalize(data.nroDocumento || data.documento || ""),
            emailLower: normalize(data.email || "")
        });
        console.log(`Actualizado: ${nombreCompleto}`);
    }
    console.log("Reparación completada.");
}

// Para ejecutar: repairPatients("TU_INQUILINO_ID")
