import React, { useState } from "react";
import Button from "../../../components/ui/Button";
import { toast } from "sonner";

export default function FacturacionTab({
    facturacion = {},
    totalFacturado = 0,
    totalPagado = 0,
    onUpdateSaldo, // function to update numeric fields
    onGenerateRips
}) {

    const saldoPendiente = totalFacturado - totalPagado;

    return (
        <div className="flex flex-col h-full animation-fade-in-up">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="glass-panel p-4 bg-white/60">
                    <div className="text-xs font-bold text-slate-400 uppercase">Total Tratamientos</div>
                    <div className="text-xl font-bold text-slate-800 mt-1">${totalFacturado.toLocaleString()}</div>
                </div>
                <div className="glass-panel p-4 bg-white/60">
                    <div className="text-xs font-bold text-slate-400 uppercase">Total Recaudado</div>
                    <div className="text-xl font-bold text-green-600 mt-1">${totalPagado.toLocaleString()}</div>
                </div>
                <div className="glass-panel p-4 bg-white/60">
                    <div className="text-xs font-bold text-slate-400 uppercase">Por Cobrar</div>
                    <div className="text-xl font-bold text-red-500 mt-1">${saldoPendiente.toLocaleString()}</div>
                </div>
                <div className="glass-panel p-4 bg-indigo-50/50 border-indigo-100">
                    <div className="text-xs font-bold text-indigo-400 uppercase">Saldo a Favor</div>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xl font-bold text-indigo-700">$</span>
                        <input
                            type="number"
                            className="w-full bg-transparent font-bold text-indigo-700 text-xl outline-none"
                            value={facturacion.saldoFavor || 0}
                            onChange={(e) => onUpdateSaldo("saldoFavor", Number(e.target.value))}
                        />
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 mb-6">
                <Button variant="secondary" onClick={() => toast.info("Para registrar pagos, use el módulo de Facturación → Recibos de Caja")}>
                    Registrar Copago / Abono
                </Button>
                <Button variant="secondary" onClick={onGenerateRips}>
                    Generar RIPS (JSON)
                </Button>
            </div>

            {/* Transactions Table (Placeholder for now as logic manages totals differently currently) */}
            <div className="flex-1 overflow-hidden bg-white rounded-xl border border-slate-200 shadow-sm p-8 flex flex-col items-center justify-center text-slate-400">
                <div className="text-4xl mb-4">🧾</div>
                <p>El detalle de transacciones se genera automáticamente desde los presupuestos realizados.</p>
                <p className="text-sm mt-2">Gestiona el estado de los tratamientos en la pestaña "Presupuestos" para actualizar el total facturado.</p>
            </div>

        </div>
    );
}
