// src/pages/ResetPassword.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../lib/supabaseClient";
import { FiLock, FiCheck, FiEye, FiEyeOff, FiAlertCircle } from "react-icons/fi";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: "", text: "" });

  useEffect(() => {
    // Escuchar el evento PASSWORD_RECOVERY de Supabase Auth
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "PASSWORD_RECOVERY") {
        console.log("Sesión de recuperación de contraseña activa");
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatusMsg({ type: "", text: "" });

    if (newPassword.length < 6) {
      setStatusMsg({ type: "error", text: "La contraseña debe tener al menos 6 caracteres." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatusMsg({ type: "error", text: "Las contraseñas no coinciden. Por favor verifica." });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setStatusMsg({
        type: "success",
        text: "¡Contraseña actualizada exitosamente! Redirigiendo al inicio de sesión..."
      });

      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 2500);

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
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 border border-slate-100 animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 font-black text-xl shadow-inner">
            <FiLock size={26} />
          </div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Crear Nueva Contraseña</h2>
          <p className="text-xs font-semibold text-slate-400 mt-1">
            Ingresa tu nueva clave de acceso a OdontoCloud.
          </p>
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

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
              Nueva Contraseña *
            </label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full h-11 px-4 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all"
                placeholder="Mínimo 6 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
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

          <button
            type="submit"
            disabled={loading || !newPassword || newPassword !== confirmPassword}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
            ) : (
              "Actualizar Contraseña"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
