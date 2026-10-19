import React from "react";
export default function DashboardWelcome({initials, rolLabel, dateLabel, saludo, displayName, companyName}) { return (
                <div
                    className="relative rounded-3xl overflow-hidden shadow-xl"
                    style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 40%, #4f46e5 75%, #7c3aed 100%)" }}
                >
                    {/* Decoración de fondo */}
                    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
                        <div style={{ position: "absolute", top: "-60px", right: "-60px", width: "260px", height: "260px", borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
                        <div style={{ position: "absolute", bottom: "-40px", left: "30%", width: "180px", height: "180px", borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
                        <div style={{ position: "absolute", top: "20px", left: "42%", width: "80px", height: "80px", borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
                        {/* Grid decorativo */}
                        <svg style={{ position: "absolute", right: 0, top: 0, opacity: 0.07 }} width="320" height="200" viewBox="0 0 320 200">
                            {Array.from({ length: 8 }).map((_, r) =>
                                Array.from({ length: 12 }).map((_, c) => (
                                    <circle key={`${r}-${c}`} cx={c * 28 + 14} cy={r * 25 + 12} r="1.5" fill="white" />
                                ))
                            )}
                        </svg>
                    </div>

                    <div className="relative z-10 p-7 md:p-10 flex flex-col md:flex-row items-start md:items-center gap-6">
                        {/* Avatar con Identidad Odontológica y Centrado Milimétrico */}
                        <div style={{ flexShrink: 0, position: "relative" }}>
                            <div style={{
                                width: 76, height: 76, borderRadius: 22,
                                background: "linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.08) 100%)",
                                border: "2px solid rgba(255,255,255,0.35)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                backdropFilter: "blur(12px)",
                                boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
                                position: "relative"
                            }}>
                                {/* Ícono de diente Odontología (Centrado Geométrico 100%) */}
                                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.3))" }}>
                                    <path d="M12 2C8.5 2 6 4 6 7c0 2.5 1 4.5 1.5 7.5.5 3 1.5 6.5 3.5 6.5 1.5 0 1.5-2 1.5-3.5 0-1.5 1-2 1.5-2s1.5.5 1.5 2c0 1.5 0 3.5 1.5 3.5 2 0 3-3.5 3.5-6.5C21 11.5 22 9.5 22 7c0-3-2.5-5-6-5-1.5 0-3 1-4 2-1-1-2.5-2-4-2z" fill="rgba(255,255,255,0.25)" />
                                </svg>
                            </div>

                            {/* Badge de Iniciales en esquina inferior derecha */}
                            <div style={{
                                position: "absolute",
                                bottom: -4, right: -4,
                                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                                border: "2px solid #ffffff",
                                borderRadius: 10,
                                padding: "2px 7px",
                                boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
                                display: "flex", alignItems: "center", justifyContent: "center"
                            }}>
                                <span style={{ fontSize: 10, fontWeight: 900, color: "#ffffff", letterSpacing: "0.05em", lineHeight: 1 }}>
                                    {initials}
                                </span>
                            </div>
                        </div>

                        {/* Texto */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <span style={{
                                    fontSize: 10, fontWeight: 800, letterSpacing: "0.12em",
                                    textTransform: "uppercase", color: "rgba(196,181,253,0.9)",
                                    background: "rgba(255,255,255,0.1)", padding: "2px 10px",
                                    borderRadius: 20, border: "1px solid rgba(255,255,255,0.15)"
                                }}>{rolLabel}</span>
                                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)" }}>·</span>
                                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 500, textTransform: "capitalize" }}>{dateLabel}</span>
                            </div>
                            <h1 style={{ fontSize: 28, fontWeight: 900, color: "white", margin: "4px 0 2px", lineHeight: 1.1, letterSpacing: "-0.02em" }}>
                                {saludo}, {displayName}! 👋
                            </h1>
                            {companyName && companyName !== "OdontoCloud" && (
                                <p style={{ fontSize: 13, color: "rgba(196,181,253,0.85)", fontWeight: 600, marginTop: 4 }}>
                                    🏥 {companyName}
                                </p>
                            )}
                            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 8, fontWeight: 400 }}>
                                Bienvenido a tu panel de gestión clínica. Usa el menú para navegar entre módulos.
                            </p>
                        </div>

                        {/* Badge OdontoCloud */}
                        <div style={{ flexShrink: 0, textAlign: "center", display: "none" }} className="md:block">
                            <div style={{
                                background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)",
                                borderRadius: 16, padding: "12px 20px", backdropFilter: "blur(8px)"
                            }}>
                                <div style={{ fontSize: 10, color: "rgba(196,181,253,0.7)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Sistema</div>
                                <div style={{ fontSize: 18, fontWeight: 900, color: "white", letterSpacing: "-0.02em" }}>OdontoCloud</div>
                                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>v2.5 · 2026</div>
                            </div>
                        </div>
                    </div>

                    {/* Barra decorativa inferior */}
                    <div style={{ height: 3, background: "linear-gradient(90deg, #818cf8, #a78bfa, #34d399, #60a5fa)", opacity: 0.7 }} />
                </div>
); }
