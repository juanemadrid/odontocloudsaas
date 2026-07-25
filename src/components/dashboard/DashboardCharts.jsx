import React, { useState, useEffect, useRef } from "react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip
} from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900 border border-slate-800 shadow-2xl rounded-xl p-3 backdrop-blur-md">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">{label}</p>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <p className="text-sm font-bold text-white tracking-tight">
                        {payload[0].value} <span className="text-slate-400 font-normal">PACIENTES</span>
                    </p>
                </div>
            </div>
        );
    }
    return null;
};

const ChartWrapper = ({ children }) => {
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const containerRef = useRef(null);

    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            if (!entries || entries.length === 0) return;
            const { width, height } = entries[0].contentRect;
            setDimensions({ width, height });
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    return (
        <div ref={containerRef} className="w-full h-full relative">
            {dimensions.width > 0 && dimensions.height > 0 ? (
                React.cloneElement(children, { width: dimensions.width, height: dimensions.height })
            ) : null}
        </div>
    );
};

export default function DashboardCharts({ data, title, period }) {
    // Ensure valid data or use placeholder
    const safeData = data && data.length > 0 ? data : [
        { label: "Lun", value: 0 }, { label: "Mar", value: 0 }, { label: "Mié", value: 0 },
        { label: "Jue", value: 0 }, { label: "Vie", value: 0 }, { label: "Sáb", value: 0 }, { label: "Dom", value: 0 }
    ];

    const isEmpty = safeData.every(d => Number(d.value) === 0);

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-4 md:p-5 h-full flex flex-col group transition-all duration-500 hover:shadow-[0_20px_60px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
                    <div>
                        <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.25em]">{title || "ANÁLISIS DE FLUJO"}</h3>
                        {period && <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 opacity-60">{period}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <div className="w-1 h-1 rounded-full bg-blue-600" />
                    </div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Realtime Data</span>
                </div>
            </div>

            <div className="w-full h-[200px]">
                {isEmpty ? (
                    <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-100 rounded-[24px] bg-slate-50/30">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-pulse" />
                        </div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-300">Esperando registros</p>
                    </div>
                ) : (
                    <ChartWrapper>
                        <AreaChart data={safeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15}/>
                                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F8FAFC" />
                            <XAxis
                                dataKey="label"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94A3B8', fontSize: 9, fontWeight: 800, textTransform: 'uppercase' }}
                                dy={15}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94A3B8', fontSize: 9, fontWeight: 800 }}
                            />
                            <Tooltip
                                content={<CustomTooltip />}
                                cursor={{ stroke: '#E2E8F0', strokeWidth: 1 }}
                            />
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke="#3B82F6"
                                strokeWidth={2.5}
                                fillOpacity={1}
                                fill="url(#colorValue)"
                                animationDuration={1500}
                                activeDot={{ r: 5, strokeWidth: 0, fill: '#1E40AF' }}
                            />
                        </AreaChart>
                    </ChartWrapper>
                )}
            </div>
        </div>
    );
}
