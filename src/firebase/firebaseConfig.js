// src/firebase/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

const fallbackFirebaseConfig = {
  apiKey: "AIzaSyC70mGCRrjE8iOap8iTHuid8HEuyadue8Y",
  authDomain: "odontocloud-d92ac.firebaseapp.com",
  projectId: "odontocloud-d92ac",
  storageBucket: "odontocloud-d92ac.firebasestorage.app",
  messagingSenderId: "267020714981",
  appId: "1:267020714981:web:a44416ea83aa1d1172650c",
  measurementId: "G-ZMCC5CFY0C",
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || fallbackFirebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || fallbackFirebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || fallbackFirebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || fallbackFirebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || fallbackFirebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || fallbackFirebaseConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || fallbackFirebaseConfig.measurementId,
};

if (!import.meta.env.DEV && !import.meta.env.VITE_FIREBASE_API_KEY) {
  console.warn("Firebase production env vars are missing. Using bundled fallback config.");
}

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

// Activar la persistencia de datos offline y caché multidominio/pestaña
// Esto reduce drásticamente las lecturas a la base de datos (Database Reads) guardando todo en el disco duro del usuario temporalmente.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
const storage = getStorage(app);
const analytics = getAnalytics(app);

export { app, auth, db, storage, analytics, firebaseConfig };
