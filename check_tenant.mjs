import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC70mGCRrjE8iOap8iTHuid8HEuyadue8Y",
  authDomain: "odontocloud-d92ac.firebaseapp.com",
  projectId: "odontocloud-d92ac",
  storageBucket: "odontocloud-d92ac.firebasestorage.app",
  messagingSenderId: "267020714981",
  appId: "1:267020714981:web:a44416ea83aa1d1172650c",
  measurementId: "G-ZMCC5CFY0C",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkSchedules() {
    console.log("🔍 Querying Doctor Schedules and No-Disponibles...");
    try {
        const doctorId = "omvrGLsmJDNTNCXG2ApWrGTPjyt2";
        
        console.log("--- Horarios Predefinidos ---");
        const predSnap = await getDocs(collection(db, "usuarios", doctorId, "horarios_predefinidos"));
        predSnap.forEach(doc => {
            console.log(`- ID: ${doc.id} | Dia: ${doc.data().dia} | Start: ${doc.data().horaInicio} | End: ${doc.data().horaFin} | Active: ${doc.data().activo} | Recurso: ${doc.data().recursoNombre}`);
        });

        console.log("--- Agenda Abierta ---");
        const openSnap = await getDocs(collection(db, "usuarios", doctorId, "agenda_abierta"));
        openSnap.forEach(doc => {
            console.log(`- ID: ${doc.id} | Fecha: ${doc.data().fecha} | Start: ${doc.data().horaInicio} | End: ${doc.data().horaFin} | Active: ${doc.data().active}`);
        });

        console.log("--- No Disponibles ---");
        const unavailSnap = await getDocs(collection(db, "usuarios", doctorId, "no_disponibles"));
        unavailSnap.forEach(doc => {
            console.log(`- ID: ${doc.id} | Fecha: ${doc.data().fecha} | Start: ${doc.data().horaInicio} | End: ${doc.data().horaFin} | Active: ${doc.data().active} | Motivo: ${doc.data().motivo}`);
        });

    } catch (e) {
        console.error("Error in querying schedules:", e);
    }
}

checkSchedules();
