import React, { useEffect, useState } from 'react';
import { getRecentTransactions } from '../../../services/financialService';

export default function TransactionList({ keyRefresh }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, [keyRefresh]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getRecentTransactions(50);
            setTransactions(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-4 text-center text-slate-500">Cargando movimientos...</div>;

    if (transactions.length === 0) {
        return <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-lg">No hay movimientos registrados aún.</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Concepto</th>
                        <th className="px-4 py-3">Categoría</th>
                        <th className="px-4 py-3">Método</th>
                        <th className="px-4 py-3 text-right">Monto</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {transactions.map(t => (
                        <tr key={t.id} className="hover:bg-slate-50 transition">
                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                {t.date ? new Date(t.date).toLocaleDateString() : '---'}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800">
                                {t.description}
                                <div className="text-xs text-slate-400 font-normal">{t.type === 'income' ? 'Ingreso' : 'Gasto'}</div>
                            </td>
                            <td className="px-4 py-3">
                                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs">
                                    {t.category || 'General'}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-slate-500">{t.method}</td>
                            <td className={`px-4 py-3 text-right font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                                {t.type === 'income' ? '+' : '-'} ${parseFloat(t.amount).toLocaleString('es-CO')}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
