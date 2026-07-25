import React from "react";
import { useAuth } from "../context/AuthContext";

/*
  Sidebar premium — icons inline, accesible
  Props:
  - activeModule
  - setActiveModule
*/
export default function Sidebar({ activeModule, setActiveModule }) {
  const { userProfile } = useAuth();
  const items = [
    { id: "Inicio", label: "Inicio", icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3l9 8h-3v8H6v-8H3l9-8z" fill="currentColor"/></svg>
    )},
    { id: "Pacientes", label: "Pacientes", icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v1h20v-1c0-3.3-6.7-5-10-5z" fill="currentColor"/></svg>
    )},
    { id: "Agenda", label: "Agenda", icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M7 10h5v5H7zM19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" fill="currentColor"/></svg>
    )},
    { id: "Facturación", label: "Facturación", icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 8V7l-3 2-2-2-3 2V7l-3 2-2-2v12h16V8zM5 21v-2h14v2H5z" fill="currentColor"/></svg>
    )},
    { id: "Inventario", label: "Inventario", icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2l8 4v6c0 5-3 9-8 10-5-1-8-5-8-10V6l8-4z" fill="currentColor"/></svg>
    )},
    { id: "Odontograma", label: "Odontograma", icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2C8 2 5 5 5 9c0 3 2 6 7 11 5-5 7-8 7-11 0-4-3-7-7-7z" fill="currentColor"/></svg>
    )},
    { id: "Reportes", label: "Reportes", icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 13h2v6H3v-6zm4-8h2v14H7V5zm4 4h2v10h-2V9zm4-6h2v16h-2V3z" fill="currentColor"/></svg>
    )},
    { id: "Configuración", label: "Configuración", icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill="currentColor"/></svg>
    )},
  ];

  return (
    <nav className="oc-sidebar-nav" aria-label="Menú principal">
      <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-50">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg">O</div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-slate-800 leading-none">OdontoCloud</span>
          <span className="text-[10px] font-semibold text-slate-400 mt-0.5">Gestión Clínica</span>
        </div>
      </div>
      
      <div className="flex flex-col items-center gap-3 py-8 px-6 border-b border-slate-50" aria-hidden>
        {userProfile?.tenant?.logo ? (
          <div className="w-16 h-16 bg-white rounded-xl shadow-sm border border-slate-100 p-2 flex items-center justify-center">
            <img 
              src={userProfile.tenant.logo} 
              alt="Logo Clínica" 
              className="w-full h-full object-contain"
            />
          </div>
        ) : (
          <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300">
             <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M12 2C8 2 5 5 5 9c0 3 2 6 7 11 5-5 7-8 7-11 0-4-3-7-7-7z" fill="currentColor"/></svg>
          </div>
        )}
        <span className="text-sm font-semibold text-slate-700 text-center w-full truncate">
          {userProfile?.tenant?.nombreComercial || "Mi Clínica"}
        </span>
      </div>

      <ul className="oc-side-list">
        {items.map((it) => (
          <li key={it.id} className={`oc-side-item ${activeModule === it.id ? "active" : ""}`}>
            <button
              onClick={() => setActiveModule(it.id)}
              className="oc-side-btn"
              aria-current={activeModule === it.id}
            >
              <span className="oc-side-ico">{it.icon}</span>
              <span className="oc-side-label">{it.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
