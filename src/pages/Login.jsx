// ===============================
// 📄 Login.jsx - Acceso híbrido OdontoCloud (Supabase Auth)
// ===============================
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import supabase from "../lib/supabaseClient";
import "../styles/login.css";
import fondo from "/assets/fondo.png";
import logo from "/assets/logo.png";

const BASE_PATH = import.meta.env.BASE_URL || "/odontocloudsaas/";

const Login = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [forgotModal, setForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState({ type: "", text: "" });
  const [sendingReset, setSendingReset] = useState(false);

  const [sendingResend, setSendingResend] = useState(false);
  const [resendMsg, setResendMsg] = useState({ type: "", text: "" });

  // PWA Install Prompt
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setCanInstall(false);
    }
    setDeferredPrompt(null);
  };

  const handleResendVerification = async () => {
    const targetEmail = email.trim();
    if (!targetEmail) {
      setError("Por favor ingresa tu correo electrónico.");
      return;
    }

    setSendingResend(true);
    setResendMsg({ type: "", text: "" });

    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: targetEmail,
        options: {
          emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL || '/odontocloudsaas/'}`
        }
      });

      if (resendErr) throw resendErr;

      setResendMsg({
        type: "success",
        text: "¡Correo de verificación reenviado! Por favor revisa tu bandeja de entrada y la carpeta de Spam."
      });
    } catch (err) {
      console.error("Error al reenviar correo de verificación:", err);
      setResendMsg({
        type: "error",
        text: err.message || "No se pudo reenviar el correo. Intenta de nuevo más tarde."
      });
    } finally {
      setSendingResend(false);
    }
  };

  const handleSendResetEmail = async (e) => {
    e.preventDefault();
    const targetEmail = (forgotEmail || email).trim();

    if (!targetEmail) {
      setForgotMsg({ type: "error", text: "Por favor ingresa tu correo electrónico." });
      return;
    }

    setSendingReset(true);
    setForgotMsg({ type: "", text: "" });

    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL || '/odontocloudsaas/'}reset-password`
      });

      if (resetErr) throw resetErr;

      setForgotMsg({
        type: "success",
        text: `¡Enlace enviado! Revisa la bandeja de entrada (y spam) de ${targetEmail}.`
      });
    } catch (err) {
      console.error("Error enviando recuperación:", err);
      const msg = (err.message || "").toLowerCase();
      let spanishErr = "Error al enviar el enlace de recuperación. Por favor intente más tarde.";

      if (msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("exceeded")) {
        spanishErr = "Has realizado demasiados intentos en muy poco tiempo. Por favor, espera 1 o 2 minutos antes de solicitar un nuevo enlace.";
      } else if (msg.includes("user not found") || msg.includes("not found")) {
        spanishErr = "No existe ninguna cuenta registrada con este correo electrónico.";
      } else if (msg.includes("invalid email")) {
        spanishErr = "El correo electrónico ingresado no es válido.";
      }

      setForgotMsg({
        type: "error",
        text: spanishErr
      });
    } finally {
      setSendingReset(false);
    }
  };

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

    const emailClean = email.trim().toLowerCase();

    try {
      // Autenticar a través de AuthContext para activar el control estricto de sesión única
      const data = await signIn(emailClean, password);

      const user = data.user;
      let normalizedRol = "recepcionista";

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, activo, tenant_id, tenant:tenants(id, nombre, activo)")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        try { sessionStorage.clear(); } catch {}
        setError("No fue posible validar el perfil de acceso. Contacta al administrador.");
        return;
      }

      const profileRole = (profile.role || "").trim().toLowerCase();
      if (profileRole !== "superadmin") {
        if (profile.activo === false || !profile.tenant_id || !profile.tenant || profile.tenant.activo === false) {
          await supabase.auth.signOut();
          try { sessionStorage.clear(); } catch {}
          setError("🚫 Esta clínica o cuenta ha sido suspendida o inhabilitada del sistema.");
          return;
        }
      }

      if (profile.role) {
        normalizedRol = profileRole;
      }

      redirectByRole(normalizedRol);
    } catch (err) {
      setLoadingStatus(false);
      const msg = (err.message || "").toLowerCase();
      if (msg.includes("invalid login credentials")) {
        setError("Correo o contraseña incorrectos.");
      } else if (msg.includes("email not confirmed")) {
        setError("Correo no verificado. Revisa tu bandeja de entrada.");
      } else if (msg.includes("rate limit") || msg.includes("too many requests") || msg.includes("exceeded")) {
        setError("Has realizado demasiados intentos de inicio de sesión. Por favor espera un minuto.");
      } else {
        setError("Error al iniciar sesión. Por favor verifica tus datos e intenta nuevamente.");
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

            <a
              href="#forgot"
              onClick={(e) => {
                e.preventDefault();
                setForgotEmail(email);
                setForgotMsg({ type: "", text: "" });
                setForgotModal(true);
              }}
              className="forgot"
            >
              ¿Olvidaste tu contraseña?
            </a>

            <button type="submit" disabled={loadingStatus}>
              {loadingStatus ? "Iniciando..." : "Iniciar sesión"}
            </button>

            {error && (
              <div
                style={{
                  marginTop: "1.25rem",
                  padding: "0.875rem 1rem",
                  borderRadius: "0.75rem",
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.5rem"
                }}
              >
                <p style={{ color: "#991b1b", fontSize: "0.84rem", fontWeight: 600, margin: 0 }}>
                  {error}
                </p>
                {error.includes("no verificado") && (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={sendingResend}
                    style={{
                      marginTop: "0.25rem",
                      padding: "0.45rem 1rem",
                      borderRadius: "0.5rem",
                      border: "1px solid #fca5a5",
                      backgroundColor: "#ffffff",
                      color: "#dc2626",
                      fontSize: "0.78125rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
                    }}
                  >
                    {sendingResend ? "Reenviando correo..." : "✉️ Reenviar correo de verificación"}
                  </button>
                )}
              </div>
            )}

            {canInstall && (
              <div style={{ marginTop: "1.25rem", textAlign: "center" }}>
                <button
                  type="button"
                  onClick={handleInstallApp}
                  style={{
                    width: "100%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                    padding: "0.625rem 1rem",
                    borderRadius: "0.625rem",
                    border: "1px solid #bfdbfe",
                    backgroundColor: "#eff6ff",
                    color: "#1d4ed8",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Instalar OdontoCloud en este equipo
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Modal Olvidé mi Contraseña */}
      {forgotModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff', borderRadius: '1.25rem', width: '100%', maxWidth: '420px',
            padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            position: 'relative'
          }}>
            <button
              type="button"
              onClick={() => setForgotModal(false)}
              style={{
                position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none',
                fontSize: '1.25rem', cursor: 'pointer', color: '#94a3b8'
              }}
            >
              ✕
            </button>

            <h4 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem', textAlign: 'center' }}>
              Recuperar Contraseña
            </h4>
            <p style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: '1.25rem', textAlign: 'center' }}>
              Ingresa tu correo electrónico registrado y te enviaremos un enlace seguro para crear una nueva clave.
            </p>

            {forgotMsg.text && (
              <div style={{
                padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.8125rem', fontWeight: 600,
                backgroundColor: forgotMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
                color: forgotMsg.type === 'success' ? '#166534' : '#991b1b',
                border: `1px solid ${forgotMsg.type === 'success' ? '#bbf7d0' : '#fecaca'}`
              }}>
                {forgotMsg.text}
              </div>
            )}

            <form onSubmit={handleSendResetEmail}>
              <input
                type="email"
                placeholder="tu-correo@ejemplo.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', marginBottom: '1rem' }}
              />
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setForgotModal(false)}
                  style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: '#ffffff', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sendingReset}
                  style={{ padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: '#2bb673', color: '#ffffff', fontWeight: 600, cursor: 'pointer', opacity: sendingReset ? 0.6 : 1 }}
                >
                  {sendingReset ? "Enviando..." : "Enviar Enlace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
