import React from "react";

/*
  Topbar Premium — usa SVG inline
  Props:
  - onToggleSidebar
  - darkMode
  - setDarkMode
  - onLogout (opcional)
*/
export default function Topbar({ onToggleSidebar, darkMode, setDarkMode, onLogout }) {
  return (
    <header className="oc-topbar">
      <div className="oc-topbar-left">
        <button
          className="oc-topbar-btn oc-hamburger"
          onClick={onToggleSidebar}
          aria-label="Abrir menú"
        >
          {/* simple hamburger SVG */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3" y="6" width="18" height="2" rx="1" fill="currentColor" />
            <rect x="3" y="11" width="18" height="2" rx="1" fill="currentColor" />
            <rect x="3" y="16" width="18" height="2" rx="1" fill="currentColor" />
          </svg>
        </button>

        <div className="oc-topbar-title">OdontoCloud</div>
      </div>

      <div className="oc-topbar-right">
        <button
          className="oc-topbar-btn"
          onClick={() => setDarkMode(!darkMode)}
          aria-label="Cambiar tema"
          title={darkMode ? "Cambiar a claro" : "Cambiar a oscuro"}
        >
          {/* moon / sun svg */}
          {darkMode ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="currentColor"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6.76 4.84l-1.8-1.79L3.17 4.84l1.79 1.8 1.8-1.8zM1 13h3v-2H1v2zM11 1h2v3h-2V1zm9.83 2.05l-1.79 1.79 1.8 1.8 1.79-1.8-1.8-1.79zM20 11v2h3v-2h-3zM13 20h-2v3h2v-3zM4.22 19.78l1.8-1.79-1.8-1.8-1.79 1.79 1.79 1.8zM17.24 19.16l1.79 1.79 1.8-1.79-1.8-1.8-1.79 1.8z" fill="currentColor"/></svg>
          )}
        </button>

        <div className="oc-avatar" title="Admin - Juan Madrid" onClick={onLogout} role="button" tabIndex={0}>
          {/* small avatar circle svg */}
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="8" r="3.2" fill="currentColor" opacity="0.95"/>
            <path d="M4.5 20.5a8.5 8.5 0 0 1 15 0" fill="currentColor" opacity="0.95"/>
          </svg>
        </div>
      </div>
    </header>
  );
}
