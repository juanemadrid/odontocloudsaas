import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyC70mGCRrjE8iOap8iTHuid8HEuyadue8Y",
    authDomain: "odontocloud-d92ac.firebaseapp.com",
    projectId: "odontocloud-d92ac",
    storageBucket: "odontocloud-d92ac.firebasestorage.app",
    messagingSenderId: "267020714981",
    appId: "1:267020714981:web:a44416ea83aa1d1172650c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkAgenda() {
    console.log("🔍 Checking agenda appointments...");
    try {
        const snapAll = await getDocs(collection(db, "agenda"));
        console.log(`Total appointments in DB: ${snapAll.size}`);
        
        snapAll.forEach(doc => {
            const data = doc.data();
            console.log(`- Appt ID: ${doc.id}`);
            console.log(`  pacienteId: "${data.pacienteId}"`);
            console.log(`  paciente: "${data.paciente}"`);
            console.log(`  fecha/hora: ${data.fecha} ${data.hora}`);
        });

        console.log("\n🔍 Checking invoices (facturas)...");
        const snapFacturas = await getDocs(collection(db, "facturas"));
        console.log(`Total invoices: ${snapFacturas.size}`);
        snapFacturas.forEach(doc => {
            const data = doc.data();
            console.log(`- Invoice ID: ${doc.id}`);
            console.log(`  pacienteId: "${data.pacienteId}"`);
            console.log(`  monto: ${data.monto}`);
        });
    } catch (e) {
        console.error("Error:", e);
    }
}

checkAgenda();
