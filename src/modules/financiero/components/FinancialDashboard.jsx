import React, { useState, useEffect } from "react";
import Button from "../../../components/ui/Button";
import TransactionForm from "./TransactionForm";
import TransactionList from "./TransactionList";
import { getFinancialStats } from "../../../services/financialService";
import { FiActivity } from "react-icons/fi";

export default function FinancialDashboard() {
    const [showForm, setShowForm] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0); // To force reload Lists

    // Stats State
    const [stats, setStats] = useState({ income: 0, expense: 0, balance: 0 });
    const [loadingStats, setLoadingStats] = useState(true);
    const [dateRange, setDateRange] = useState(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1); // 1st of month
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last of month
        return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
    });

    useEffect(() => {
        loadStats();
    }, [refreshKey, dateRange]);

    const loadStats = async () => {
        setLoadingStats(true);
        try {
            // Add time to dates to cover full day range
            const start = new Date(dateRange.start);
            start.setHours(0, 0, 0, 0);
            const end = new Date(dateRange.end);
            end.setHours(23, 59, 59, 999);

            const data = await getFinancialStats(start, end);
            setStats(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingStats(false);
        }
    };

    const handleTransactionSaved = () => {
        setShowForm(false);
        setRefreshKey(prev => prev + 1); // Refresh data
    };

    return (
        <div className="w-full flex flex-col gap-10 animate-fadeIn px-2 md:px-6 lg:px-10 pb-10">
            {/* 1. THE ARCHITECTURAL HEADER (Slender Pro Institutional Style) */}
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        <FiActivity className="text-blue-600" />
                        <span>Institucional</span>
                        <span className="text-slate-200">/</span>
                        <span className="text-slate-800">Gestión Financiera</span>
                    </div>
                    <div className="flex items-end gap-4">
                        <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tight leading-none">
                            Gestión <span className="text-blue-600">Financiera</span>
                        </h2>
                    </div>
                    <div className="w-12 h-1.5 bg-blue-600 rounded-full" />
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setShowForm(true)}
                        className="bg-blue-600 text-white px-6 py-3 rounded-[18px] font-black text-[11px] uppercase tracking-widest flex items-center gap-3 hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition-all active:scale-95 border-0"
                    >
                        + Nueva Transacción
                    </button>
                </div>
            </div>

            {/* 2. THE SLENDER HUD (Filters & KPI Summary) */}
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] p-4 flex flex-col lg:flex-row items-center justify-between gap-4">

                {/* Date Range Controls */}
                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-[24px] border border-slate-100 w-full lg:w-auto">
                    <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="bg-transparent border-none text-[11px] font-black text-slate-600 uppercase tracking-wider focus:ring-0"
                    />
                    <span className="text-slate-300">|</span>
                    <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="bg-transparent border-none text-[11px] font-black text-slate-600 uppercase tracking-wider focus:ring-0"
                    />
                </div>

                {/* KPI Summary Chips */}
                <div className="flex flex-wrap justify-center gap-3 px-4">
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-full px-5 py-3">
                        <div className="text-[10px] font-black text-emerald-600 uppercase tracking-tight">
                            Ingresos: {loadingStats ? "..." : `$${stats.income.toLocaleString('es-CO')}`}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-full px-5 py-3">
                        <div className="text-[10px] font-black text-rose-600 uppercase tracking-tight">
                            Gastos: {loadingStats ? "..." : `$${stats.expense.toLocaleString('es-CO')}`}
                        </div>
                    </div>
                    <div className={`flex items-center gap-2 border rounded-full px-5 py-3 ${stats.balance >= 0 ? 'bg-slate-800 border-slate-700 text-white' : 'bg-red-600 border-red-500 text-white'}`}>
                        <div className="text-[10px] font-black uppercase tracking-tight">
                            Balance: {loadingStats ? "..." : `$${stats.balance.toLocaleString('es-CO')}`}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 gap-6">

                {/* 3. THE INSTITUTIONAL TABLE CONTAINER */}
                <div className="bg-white rounded-[40px] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden">
                    <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                        <h3 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.2em]">Movimientos Recientes</h3>
                        <div className="px-3 py-1 bg-white border border-slate-200 rounded-full text-[9px] font-bold text-slate-400 uppercase tracking-wider">Últimos 50</div>
                    </div>
                    <div className="p-6">
                        <TransactionList keyRefresh={refreshKey} />
                    </div>
                </div>

            </div>

            {/* Modal Layer */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fadeIn">
                    <TransactionForm
                        onClose={() => setShowForm(false)}
                        onSaved={handleTransactionSaved}
                    />
                </div>
            )}
        </div>
    );
}
