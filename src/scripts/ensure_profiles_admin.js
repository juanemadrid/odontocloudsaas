const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, getDoc } = require('firebase/firestore');

// Partial config - I'll use the one from the project
const firebaseConfig = require('../firebase/firebaseConfig.js'); 

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function ensureAdministrativo() {
  const profileId = "administrativo"; // Standard ID
  const profileRef = doc(db, "perfiles", profileId);
  const snap = await getDoc(profileRef);

  if (!snap.exists()) {
    console.log("Creating 'Administrativo' profile...");
    await setDoc(profileRef, {
      nombre: "Administrativo",
      permisos: {
        "Agenda": true,
        "Pacientes": true,
        "Facturación": true,
        "Caja": true,
        "Inventario": true,
        "Reportes": false, // Selective
        "Configuración": false
      },
      descripcion: "Perfil para personal de recepción y administración básica."
    });
    console.log("Success.");
  } else {
    console.log("Profile already exists.");
  }
}

ensureAdministrativo().catch(console.error);
