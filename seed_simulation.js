
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, setDoc, doc, serverTimestamp } = require('firebase/firestore');

const firebaseConfig = { projectId: 'odontocloud-d92ac' };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seed() {
    const inquilino = 'odontosalud-h9ff3';

    console.log('--- Iniciando siembra de datos para', inquilino, '---');

    // 1. Sucursal
    const sucursalRef = await addDoc(collection(db, "sucursales"), {
        nombre: "SEDE CENTRAL PREMIUM",
        direccion: "AV. SIEMPRE VIVA 123",
        telefono: "555-0199",
        inquilino,
        activo: true,
        creado: new Date()
    });
    console.log('Sucursal creada:', sucursalRef.id);

    // 2. Consultorio
    const consultorioRef = await addDoc(collection(db, "consultorios"), {
        nombre: "BOX 01 - ODONTOLOGÍA GENERAL",
        descripcion: "EQUIPADO CON RAYOS X",
        inquilino,
        activo: true,
        creado: new Date()
    });
    console.log('Consultorio creado:', consultorioRef.id);

    // 3. Profesional (Usuario + Profesional)
    const profUid = 'simulador-prof-001';
    const profData = {
        uid: profUid,
        nombre: "CARLOS",
        apellido: "SIMULADOR",
        nombreCompleto: "CARLOS SIMULADOR",
        email: "carlos.simulador@odontocloud.com",
        rol: "doctor",
        esDoctor: true,
        sucursales: [sucursalRef.id],
        inquilino,
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    await setDoc(doc(db, "usuarios", profUid), profData);

    await setDoc(doc(db, "profesionales", profUid), {
        id: profUid,
        nombre: "CARLOS",
        nombreCompleto: "CARLOS SIMULADOR",
        correo: "carlos.simulador@odontocloud.com",
        identificacion: "12345678",
        telefono: "3001234567",
        especialidades: [],
        sucursales: [sucursalRef.id],
        inquilino,
        activo: true,
        updatedAt: new Date()
    });
    console.log('Profesional creado:', profUid);

    console.log('--- Siembra completada con éxito ---');
}

seed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
