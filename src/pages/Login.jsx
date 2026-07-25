// ===============================
// 📄 Login.jsx - Acceso híbrido OdontoCloud (Supabase Auth)
// ===============================
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabaseClient";
import "../styles/login.css";
import fondo from "/assets/fondo.png";
import logo from "/assets/logo.png";

const BASE_PATH = import.meta.env.BASE_URL || "/odontocloud-react/";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loadingStatus, setLoadingStatus] = useState(false);

  const redirectByRole = (rol) => {
    const r = (rol || "").toLowerCase();

    // 1. Superadmin -> Panel de Superadmin
    if (r === "superadmin" || r.includes("superadmin")) {
      navigate("/superadmin", { replace: true });
      return;
    }

    // 2. Administrador -> Dashboard Admin
    if (r === "administrador" || r === "admin" || r.includes("admin") || r.includes("soporte")) {
      navigate("/dashboard_admin", { replace: true });
      return;
    }

    // 3. Doctor -> Dashboard Doctor
    if (r === "doctor" || r.includes("doctor") || r.includes("odontologo") || r.includes("especialista")) {
      navigate("/dashboard_doctor", { replace: true });
      return;
    }

    // 4. Recepción / Auxiliar -> Dashboard Recepción
    navigate("/dashboard_recepcion", { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoadingStatus(true);

    try {
      // Iniciar Sesión con Supabase Auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (authError) throw authError;

      const user = data.user;
      let normalizedRol = "recepcionista";

      // Determinar Rol del Usuario
      if (email.trim().toLowerCase() === "madridsystem@outlook.es") {
        normalizedRol = "superadmin";
      } else {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.role) {
          normalizedRol = profile.role.trim().toLowerCase();
        }
      }

      redirectByRole(normalizedRol);
    } catch (err) {
      setLoadingStatus(false);
      console.error("Error login Supabase:", err);

      const msg = err.message || "";
      if (msg.includes("Invalid login credentials")) {
        setError("Correo o contraseña incorrectos.");
      } else if (msg.includes("Email not confirmed")) {
        setError("Correo no verificado. Revisa tu bandeja de entrada.");
      } else {
        setError("Error al iniciar sesión: " + msg);
      }
    } finally {
      setLoadingStatus(false);
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
              required
            />
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingRight: '2.5rem', width: '100%' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                style={{
                  position: 'absolute',
                  right: '0.75rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                }}
                tabIndex={-1}
                title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
            <button type="submit" disabled={loadingStatus}>
              {loadingStatus ? "Iniciando..." : "Iniciar sesión"}
            </button>

            {error && <p style={{ color: "red", marginTop: 10 }}>{error}</p>}
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
