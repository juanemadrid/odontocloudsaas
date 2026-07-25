// src/services/financialService.js
import supabase from "../lib/supabaseClient";

export const addTransaction = async (transactionData) => {
    try {
        const payload = {
            tenant_id: transactionData.tenant_id || transactionData.inquilino,
            monto: Number(transactionData.amount || transactionData.monto || 0),
            metodo: transactionData.type || transactionData.metodo || "efectivo",
            referencia: transactionData.category || transactionData.referencia || "",
            notas: transactionData.description || transactionData.notas || "",
            fecha: transactionData.date ? new Date(transactionData.date).toISOString() : new Date().toISOString()
        };

        const { data, error } = await supabase
            .from("pagos")
            .insert([payload])
            .select()
            .single();

        if (error) throw error;
        return data.id;
    } catch (error) {
        console.error("Error adding transaction in Supabase:", error);
        throw error;
    }
};

export const getRecentTransactions = async (tenantId, limitCount = 20) => {
    if (!tenantId) return [];
    try {
        const { data, error } = await supabase
            .from("pagos")
            .select("*")
            .eq("tenant_id", tenantId)
            .order("fecha", { ascending: false })
            .limit(limitCount);

        if (error) throw error;

        return (data || []).map(t => ({
            id: t.id,
            ...t,
            amount: t.monto,
            type: t.monto >= 0 ? "income" : "expense",
            date: new Date(t.fecha || t.created_at)
        }));
    } catch (error) {
        console.error("Error fetching transactions from Supabase:", error);
        return [];
    }
};

export const getFinancialStats = async (tenantId, startDate, endDate) => {
    if (!tenantId) return { income: 0, expense: 0, balance: 0, count: 0 };
    try {
        const { data: pagos, error } = await supabase
            .from("pagos")
            .select("monto, fecha")
            .eq("tenant_id", tenantId)
            .gte("fecha", startDate ? new Date(startDate).toISOString() : new Date(0).toISOString())
            .lte("fecha", endDate ? new Date(endDate).toISOString() : new Date().toISOString());

        if (error) throw error;

        let income = 0;
        let expense = 0;

        (pagos || []).forEach(p => {
            const amount = parseFloat(p.monto) || 0;
            if (amount >= 0) income += amount;
            else expense += Math.abs(amount);
        });

        return {
            income,
            expense,
            balance: income - expense,
            count: (pagos || []).length
        };
    } catch (error) {
        console.error("Error generating financial stats from Supabase:", error);
        return { income: 0, expense: 0, balance: 0, count: 0 };
    }
};
