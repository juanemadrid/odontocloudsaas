// ===============================
// 🔥 Inicialización de Firebase
// ===============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

// ⚙️ Configuración de tu proyecto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC70mGCRrjE8iOap8iTHuid8HEuyadue8Y",
  authDomain: "odontocloud-d92ac.firebaseapp.com",
  projectId: "odontocloud-d92ac",
  storageBucket: "odontocloud-d92ac.firebasestorage.app",
  messagingSenderId: "267020714981",
  appId: "1:267020714981:web:a44416ea83aa1d1172650c",
  measurementId: "G-ZMCC5CFY0C",
};

// ===============================
// 🚀 Inicializar Firebase
// ===============================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const analytics = getAnalytics(app);

// ✅ Exportar para otros módulos (como agenda.js)
export { app, auth, db, storage };

// ✅ Hacer disponibles las instancias globalmente
// (para que otros scripts puedan usarlas sin reimportar)
window.app = app;
window.auth = auth;
window.db = db;
window.storage = storage;
window.analytics = analytics;

console.log("🔥 Firebase inicializado correctamente.");

// ===============================
// 🔑 Manejo de inicio de sesión
// ===============================
const loginForm = document.getElementById("loginForm");
const errorMsg = document.getElementById("errorMsg");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    errorMsg.textContent = "";

    console.log("Intentando iniciar sesión con:", email);

    try {
      // 1️⃣ Autenticación en Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log("✅ Sesión iniciada correctamente:", user.email);

      // 2️⃣ Consultar rol en Firestore
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("correo", "==", email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.warn("⚠️ No se encontró el usuario en Firestore");
        errorMsg.textContent = "El usuario no existe en la base de datos Firestore.";
        return;
      }

      const userData = querySnapshot.docs[0].data();
      const rol = userData.rol?.toLowerCase() || "sin_rol";
      console.log(`Rol del usuario: ${rol}`);

      // 3️⃣ Guardar en localStorage
      localStorage.setItem("rol", rol);
      localStorage.setItem("correo", email);

      // 4️⃣ Redirigir según rol
      switch (rol) {
        case "administrador":
          window.location.href = "dashboard_admin.html";
          break;
        case "doctor":
          window.location.href = "dashboard_doctor.html";
          break;
        case "recepcionista":
          window.location.href = "dashboard_recepcion.html";
          break;
        default:
          errorMsg.textContent = "Rol no reconocido. Contacte al administrador.";
      }
    } catch (error) {
      console.error("❌ Error al iniciar sesión:", error);
      switch (error.code) {
        case "auth/user-not-found":
          errorMsg.textContent = "El usuario no está registrado.";
          break;
        case "auth/wrong-password":
          errorMsg.textContent = "Contraseña incorrecta.";
          break;
        case "auth/invalid-email":
          errorMsg.textContent = "Correo electrónico no válido.";
          break;
        case "auth/too-many-requests":
          errorMsg.textContent = "Demasiados intentos fallidos. Intente más tarde.";
          break;
        default:
          errorMsg.textContent = "Error al iniciar sesión. Verifique sus credenciales.";
      }
    }
  });
}

// ===============================
// 🔒 Mantener sesión activa
// ===============================
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Usuario activo:", user.email);
  } else {
    console.log("No hay sesión activa");
  }
});
