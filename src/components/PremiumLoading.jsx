import React from "react";
import logo from "/assets/logo.png";

const PremiumLoading = () => {
    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white overflow-hidden">
            {/* Background Gradients for Depth */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-50/50 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-50/50 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="relative flex flex-col items-center gap-4">
                {/* Logo Container with Pulse */}
                <div className="relative">
                    {/* Subtle Outer Glow */}
                    <div className="absolute inset-[-10px] bg-blue-400/10 rounded-full blur-xl animate-pulse"></div>

                    <div className="relative group">
                        {/* Shimmer Effect Overlay */}
                        <div className="absolute inset-0 w-full h-full bg-gradient-to-tr from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_3s_infinite] pointer-events-none z-10"></div>

                        <img
                            src={logo}
                            alt="OdontoCloud Logo"
                            className="w-48 md:w-[320px] h-auto relative animate-[float_4s_ease-in-out_infinite]"
                        />
                    </div>
                </div>

                {/* Loading Text & Progress */}
                <div className="flex flex-col items-center gap-4 mt-6">
                    <div className="text-slate-500 font-medium text-sm animate-pulse">
                        Iniciando OdontoCloud...
                    </div>

                    {/* Custom Progress Bar */}
                    <div className="w-48 h-1 bg-slate-100 rounded-full overflow-hidden relative">
                        <div className="absolute inset-0 bg-blue-600 w-full animate-[loading_1.5s_infinite_ease-in-out] origin-left"></div>
                    </div>
                </div>

                {/* Professional Footer Text */}
                <div className="absolute bottom-[-80px] text-slate-400 text-[10px] font-semibold tracking-wider">
                    PLATAFORMA DE GESTIÓN CLÍNICA
                </div>
            </div>

            <style jsx="true">{`
        @keyframes loading {
          0% { transform: scaleX(0); left: 0; }
          45% { transform: scaleX(0.7); left: 0; }
          100% { transform: scaleX(0); left: 100%; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-10px) scale(1.02); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-150%); }
          50% { transform: translateX(150%); }
          100% { transform: translateX(150%); }
        }
      `}</style>
        </div>
    );
};

export default PremiumLoading;
