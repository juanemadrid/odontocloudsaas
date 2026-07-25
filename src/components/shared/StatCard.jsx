import React from "react";
import { FiTrendingUp, FiTrendingDown, FiMinus } from "react-icons/fi";

export default function StatCard({ title, value, subtitle, icon: Icon, trend, trendLabel, color = "blue" }) {
    const colorClasses = {
        blue: "bg-blue-50 text-blue-600",
        green: "bg-emerald-50 text-emerald-600",
        amber: "bg-amber-50 text-amber-600",
        purple: "bg-purple-50 text-purple-600",
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-md p-4 flex flex-col justify-between h-full transition-all duration-500 hover:shadow-lg hover:-translate-y-1 group relative overflow-hidden">
            {/* Subtle Accent Edge */}
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${color === 'blue' ? 'bg-blue-600' : color === 'green' ? 'bg-emerald-600' : color === 'amber' ? 'bg-amber-600' : 'bg-purple-600'} opacity-100 transition-opacity`} />

            <div className="flex items-start justify-between relative z-10">
                <div className="space-y-1">
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{title}</div>
                        {Icon && (
                            <div className={`w-7 h-7 rounded-lg ${colorClasses[color]} flex items-center justify-center shadow-sm`}>
                                <Icon className="text-xs" />
                            </div>
                        )}
                    </div>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-xl font-bold text-slate-900 tracking-tight transition-all duration-500 group-hover:text-blue-600">{value}</h3>
                        {subtitle && <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{subtitle}</span>}
                    </div>
                </div>
            </div>

            <div className="mt-6 relative z-10">
                {trend ? (
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center px-3 py-2 rounded-full text-[10px] font-black tracking-tight shadow-sm ${trend > 0 ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/10" : "bg-rose-500/10 text-rose-600 border border-rose-500/10"}`}>
                            {trend > 0 ? <FiTrendingUp size={14} className="mr-1.5" /> : <FiTrendingDown size={14} className="mr-1.5" />}
                            {trend > 0 ? "+" : ""}{trend}%
                        </div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{trendLabel || "vs mes anterior"}</span>
                    </div>
                ) : (
                    <div className="h-6 flex items-center">
                        <div className="w-12 h-1 bg-slate-100 rounded-full group-hover:w-20 group-hover:bg-slate-200 transition-all duration-700" />
                    </div>
                )}
            </div>
        </div>
    );
}
