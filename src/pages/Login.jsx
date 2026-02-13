// ===============================
// 📄 Login.jsx - Acceso híbrido OdontoCloud (PWA + Offline)
// ===============================
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import "../styles/login.css";
import fondo from "/assets/fondo.png";
import logo from "/assets/logo.png";

// ------------------------------
// 🔒 Sesión offline (simple con localStorage)
// ------------------------------
const saveSessionOffline = (email, rol) => {
  const sessionData = { email, rol, timestamp: Date.now() };
  localStorage.setItem("odc_session", JSON.stringify(sessionData));
};

const getOfflineSession = () => {
  try {
    const data = JSON.parse(localStorage.getItem("odc_session"));

    if (data && Date.now() - data.timestamp < 1000 * 60 * 60 * 24) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
};

// ------------------------------
const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const redirectByRole = (rol) => {
    const r = (rol || "").toLowerCase();

    // 1. Superadmin -> Panel de Superadmin
    if (r === "superadmin" || r.includes("superadmin")) {
      navigate("/superadmin", { replace: true });
      return;
    }

    // 2. Administrador -> Dashboard Admin
    if (r === "administrador" || r.includes("administrador") || r.includes("soporte")) {
      navigate("/dashboard_admin", { replace: true });
      return;
    }

    // 3. Doctor -> Dashboard Doctor
    if (r === "doctor" || r.includes("doctor") || r.includes("odontologo") || r.includes("especialista")) {
      navigate("/dashboard_doctor", { replace: true });
      return;
    }

    // 4. Recepción / Auxiliar -> Dashboard Recepción
    if (
      r === "recepcionista" ||
      r.includes("recepcion") ||
      r.includes("auxiliar") ||
      r.includes("caja") ||
      r === "sin_rol"
    ) {
      navigate("/dashboard_recepcion", { replace: true });
      return;
    }

    // 5. Fallback Default
    // Si no coincide con nada, mandar al dashboard de recepción o mostrar error si es muy estricto.
    // Usaremos recepción como fallback seguro para evitar "limbo".
    console.warn(`Rol desconocido: "${rol}". Redirigiendo a recepción.`);
    navigate("/dashboard_recepcion", { replace: true });
  };

  useEffect(() => {
    if (!navigator.onLine) {
      const s = getOfflineSession();
      if (s?.rol) {
        redirectByRole(s.rol);
      } else {
        setError("Sin conexión y no hay sesión guardada.");
      }
      return;
    }

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const s = getOfflineSession();
        if (s?.rol) {
          redirectByRole(s.rol);
          return;
        }

        try {
          const qUsers = query(
            collection(db, "usuarios"),
            where("email", "==", user.email || "")
          );
          const snap = await getDocs(qUsers);
          if (!snap.empty) {
            const rawRol = snap.docs[0].data().rol || "sin_rol";
            let normalizedRol = rawRol.trim().toLowerCase();

            // HARDCODED FALLBACK: MadridSystem siempre es superadmin
            if (user.email === "madridsystem@outlook.es") {
              normalizedRol = "superadmin";
            }

            console.log("Login - Datos de Firestore encontrados:", {
              email: user.email,
              rolOriginal: rawRol,
              rolNormalizado: normalizedRol,
              path: snap.docs[0].ref.path
            });
            saveSessionOffline(user.email || "", normalizedRol);
            redirectByRole(normalizedRol);
          }
        } catch {

        }
      }
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!isOnline) {
      const session = getOfflineSession();
      if (session?.rol) {
        redirectByRole(session.rol);
      } else {
        setError("Sin conexión y no hay sesión guardada.");
      }
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;


      const qUsers = query(
        collection(db, "usuarios"),
        where("email", "==", email)
      );
      const snapshot = await getDocs(qUsers);

      if (snapshot.empty) {
        setError("Usuario no encontrado en la base de datos.");
        return;
      }

      const userData = snapshot.docs[0].data();
      const rawRol = userData.rol || "sin_rol";
      let normalizedRol = rawRol.trim().toLowerCase();

      // HARDCODED FALLBACK: MadridSystem siempre es superadmin
      if (email === "madridsystem@outlook.es") {
        normalizedRol = "superadmin";
      }

      console.log("Login - handleSubmit: Datos de Firestore:", {
        email,
        rolOriginal: rawRol,
        rolNormalizado: normalizedRol,
        path: snapshot.docs[0].ref.path
      });

      localStorage.removeItem("odc_session");
      saveSessionOffline(email, normalizedRol);

      redirectByRole(normalizedRol);
    } catch (err) {
      console.error("Error login:", err);
      switch (err.code) {
        case "auth/user-not-found":
          setError("Usuario no registrado.");
          break;
        case "auth/wrong-password":
          setError("Contraseña incorrecta.");
          break;
        case "auth/invalid-email":
          setError("Correo no válido.");
          break;
        case "auth/network-request-failed":
          setError("Sin conexión. Usa la sesión guardada o reconecta.");
          break;
        default:
          setError("Error al iniciar sesión.");
      }
    }
  };

  return (
    <div
      className="login-root"
      style={{
        backgroundImage: `url(${fondo})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
        width: "100vw",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <div className="login-container">
        <div className="left-panel">
          <img src={logo} alt="OdontoCloud Logo" className="logo" />
          <h2>
            Su clínica, <br /> más conectada.
          </h2>
          <p>OdontoCloud optimiza cada detalle de su gestión.</p>
        </div>
        <div className="right-panel">
          <h3>Acceso a la plataforma</h3>
          <style>
            {`
                  input:-webkit-autofill,
                  input:-webkit-autofill:hover,
                  input:-webkit-autofill:focus,
                  input:-webkit-autofill:active {
                      -webkit-box-shadow: 0 0 0 30px white inset !important;
                      -webkit-text-fill-color: #334155 !important;
                      transition: background-color 5000s ease-in-out 0s;
                  }
              `}
          </style>
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="usuario@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required={isOnline}
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={isOnline}
            />
            <button type="submit">
              {isOnline ? "Iniciar sesión" : "Entrar (modo offline)"}
            </button>

            {error && <p style={{ color: "red", marginTop: 10 }}>{error}</p>}
            {!isOnline && (
              <p style={{ color: "orange", marginTop: 10 }}>
                ⚠️ Modo offline activado
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
