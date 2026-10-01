// src/pages/ResetPassword.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabaseClient";
import { 
  FiLock, 
  FiCheck, 
  FiEye, 
  FiEyeOff, 
  FiAlertCircle, 
  FiUser, 
  FiCopy, 
  FiArrowRight, 
  FiCheckCircle 
} from "react-icons/fi";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: "", text: "" });
  const [userEmail, setUserEmail] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [savedPassword, setSavedPassword] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 1. Detectar token_hash en query params (por si GoTrue redirige con parámetros de búsqueda)
    const searchParams = new URLSearchParams(window.location.search);
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type");

    if (tokenHash && type === "recovery") {
      supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" }).then(({ data, error }) => {
        if (error) {
          setStatusMsg({
            type: "error",
            text: "El enlace de activación ha expirado o ya fue utilizado. Solicita uno nuevo si es necesario."
          });
        } else if (data?.user?.email) {
          setUserEmail(data.user.email);
        }
      });
    }

    // 2. Obtener el usuario actual si la sesión ya fue creada por el hash de GoTrue
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.email) {
        setUserEmail(data.user.email);
      }
    };
    fetchUser();

    // 3. Escuchar evento PASSWORD_RECOVERY o cambio de sesión
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user?.email) {
        setUserEmail(session.user.email);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const handleCopyPassword = () => {
    if (savedPassword) {
      navigator.clipboard.writeText(savedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMsg({ type: "", text: "" });

    if (newPassword.length < 8) {
      setStatusMsg({ type: "error", text: "La contraseña debe tener al menos 8 caracteres." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatusMsg({ type: "error", text: "Las contraseñas no coinciden. Por favor verifica." });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      if (data?.user?.email) {
        setUserEmail(data.user.email);
      }
      setSavedPassword(newPassword);
      setIsSuccess(true);
    } catch (err) {
      console.error("Error al actualizar contraseña:", err);
      setStatusMsg({
        type: "error",
        text: err.message || "Error al actualizar la contraseña. El enlace puede haber expirado."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-6 sm:p-10 border border-slate-100 animate-fade-in my-auto">
        
        {/* PANTALLA DE ÉXITO Y BIENVENIDA */}
        {isSuccess ? (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
              <FiCheckCircle size={36} />
            </div>

            <div>
              <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black uppercase tracking-wider rounded-full mb-2">
                ✨ ¡Cuenta Activada con Éxito!
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                ¡Bienvenido a OdontoCloud!
              </h2>
              <p className="text-sm font-medium text-slate-500 mt-2">
                Tu contraseña ha sido guardada. Tu clínica ya está 100% activa y lista para operar.
              </p>
            </div>

            {/* Tarjeta Recordatorio de Credenciales */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left space-y-3">
              <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">
                📋 Tus Datos de Acceso
              </div>

              <div>
                <span className="text-xs font-bold text-slate-400 block mb-0.5">Usuario / Correo:</span>
                <div className="flex items-center gap-2 text-sm font-extrabold text-slate-800 bg-white p-2.5 rounded-xl border border-slate-200">
                  <FiUser className="text-blue-600" size={16} />
                  <span>{userEmail || "Tu correo registrado"}</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-400 block mb-0.5">Contraseña:</span>
                <div className="flex items-center justify-between text-sm font-extrabold text-slate-800 bg-white p-2.5 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2">
                    <FiLock className="text-blue-600" size={16} />
                    <span>{showPwd ? savedPassword : "••••••••••••"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded"
                      title={showPwd ? "Ocultar" : "Mostrar"}
                    >
                      {showPwd ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded flex items-center gap-1 text-xs font-bold"
                      title="Copiar contraseña"
                    >
                      <FiCopy size={15} />
                      <span className="text-[10px]">{copied ? "¡Copiada!" : "Copiar"}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 font-medium pt-1">
                💡 <strong>Recordatorio:</strong> Guarda tu correo y contraseña en un lugar seguro para ingresar a tu cuenta cuando lo desees.
              </div>
            </div>

            {/* Botón de Entrada Inmediata */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate("/dashboard", { replace: true })}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black rounded-2xl shadow-xl shadow-blue-500/25 transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-wider text-sm"
              >
                🚀 Entrar a mi Clínica Ahora <FiArrowRight size={18} />
              </button>
            </div>
          </div>
        ) : (
          /* FORMULARIO DE DEFINICIÓN DE CONTRASEÑA */
          <div>
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 font-black text-xl shadow-inner">
                <FiLock size={26} />
              </div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Activa tu Cuenta</h2>
              <p className="text-xs font-semibold text-slate-400 mt-1">
                Crea una contraseña segura para tu clínica en OdontoCloud.
              </p>
              {userEmail && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-700">
                  <FiUser size={13} className="text-blue-600" />
                  <span>{userEmail}</span>
                </div>
              )}
            </div>

            {statusMsg.text && (
              <div className={`p-4 rounded-2xl mb-6 text-xs font-bold flex items-center gap-2 ${
                statusMsg.type === "success" 
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                  : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}>
                {statusMsg.type === "success" ? <FiCheck size={16}/> : <FiAlertCircle size={16}/>}
                <span>{statusMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  Nueva Contraseña *
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full h-11 px-4 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="Mínimo 8 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    title={showPwd ? "Ocultar" : "Mostrar"}
                  >
                    {showPwd ? <FiEyeOff size={16}/> : <FiEye size={16}/>}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  Confirmar Contraseña *
                </label>
                <input
                  type={showPwd ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full h-11 px-4 bg-slate-50 border rounded-xl text-sm font-medium text-slate-800 outline-none focus:bg-white transition-all ${
                    confirmPassword && confirmPassword !== newPassword
                      ? "border-rose-400 focus:border-rose-500"
                      : confirmPassword && confirmPassword === newPassword
                      ? "border-emerald-400 focus:border-emerald-500"
                      : "border-slate-200 focus:border-blue-500"
                  }`}
                  placeholder="Repite tu contraseña"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !newPassword || newPassword !== confirmPassword}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                  ) : (
                    "Guardar Contraseña y Activar Cuenta"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
