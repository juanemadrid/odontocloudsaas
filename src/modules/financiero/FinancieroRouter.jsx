import React from "react";
import { Routes, Route } from "react-router-dom";
import FinancialDashboard from "./components/FinancialDashboard";
import ReciboCaja from "../facturacion/recibo/ReciboCaja";
import SaldoFavor from "../facturacion/saldo/SaldoFavor";

export default function FinancieroRouter() {
    return (
        <Routes>
            <Route index element={<FinancialDashboard />} />
            {/* Direct access from Financiero module */}
            <Route path="recibo/*" element={<ReciboCaja />} />
            <Route path="saldo/*" element={<SaldoFavor />} />
            
            {/* ✅ Compatibility for navigation paths from Dashboard (MegaMenu) */}
            <Route path="facturacion/recibo/*" element={<ReciboCaja />} />
            <Route path="facturacion/saldo/*" element={<SaldoFavor />} />
            <Route path="facturacion/facturas/*" element={<FinancialDashboard />} />
            <Route path="facturacion/pagos/*" element={<FinancialDashboard />} />
            {/* Fallback for other facturacion routes */}
            <Route path="facturacion/*" element={<FinancialDashboard />} />
        </Routes>
    );
}
