import React, { useState } from 'react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { addTransaction } from '../../../services/financialService';
import { useToast } from '../../../context/ToastContext';

export default function TransactionForm({ onClose, onSaved }) {
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [amountDisplay, setAmountDisplay] = useState('');
    const [formData, setFormData] = useState({
        type: 'income', // 'income' | 'expense'
        amount: '',
        description: '',
        category: 'General',
        date: new Date().toISOString().split('T')[0],
        method: 'Efectivo'
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAmountChange = (e) => {
        // Strip everything except digits
        const raw = e.target.value.replace(/\D/g, '');
        // Format with thousand separators (dots for COP)
        const formatted = raw ? Number(raw).toLocaleString('es-CO') : '';
        setAmountDisplay(formatted);
        setFormData(prev => ({ ...prev, amount: raw }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.amount || !formData.description) {
            toast.error("Completa los campos obligatorios");
            return;
        }

        setLoading(true);
        try {
            await addTransaction({
                ...formData,
                amount: parseFloat(formData.amount)
            });
            toast.success("Transacción registrada correctamente");
            if (onSaved) onSaved();
            if (onClose) onClose();
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md mx-auto flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                    {formData.type === 'income' ? 'Registrar Ingreso 💰' : 'Registrar Gasto 💸'}
                </h3>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all text-xl leading-none"
                    >
                        ×
                    </button>
                )}
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">

            {/* Selector de Tipo */}
            <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-lg">
                <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'income' })}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition ${formData.type === 'income' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Ingreso
                </button>
                <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'expense' })}
                    className={`flex-1 py-2 text-sm font-bold rounded-md transition ${formData.type === 'expense' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Gasto
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label="Monto"
                    name="amount"
                    type="text"
                    inputMode="numeric"
                    value={amountDisplay}
                    onChange={handleAmountChange}
                    placeholder="0"
                    autoFocus
                />

                <Input
                    label="Descripción / Concepto"
                    name="description"
                    type="text"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Ej. Pago de Alquiler"
                />

                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Fecha"
                        name="date"
                        type="date"
                        value={formData.date}
                        onChange={handleChange}
                    />
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Método</label>
                        <select
                            name="method"
                            value={formData.method}
                            onChange={handleChange}
                            className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <option value="Efectivo">Efectivo 💵</option>
                            <option value="Transferencia">Transferencia 🏦</option>
                            <option value="Tarjeta">Tarjeta 💳</option>
                            <option value="Cheque">Cheque 🎫</option>
                            <option value="Otro">Otro</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
                    <select
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        {formData.type === 'income' ? (
                            <>
                                <option value="Consulta">Consulta</option>
                                <option value="Tratamiento">Tratamiento</option>
                                <option value="Venta Producto">Venta Producto</option>
                                <option value="Otro">Otro</option>
                            </>
                        ) : (
                            <>
                                <option value="Insumos">Insumos</option>
                                <option value="Servicios Públicos">Servicios Públicos</option>
                                <option value="Nómina">Nómina</option>
                                <option value="Mantenimiento">Mantenimiento</option>
                                <option value="Marketing">Marketing</option>
                                <option value="Impuestos">Impuestos</option>
                                <option value="Otro">Otro</option>
                            </>
                        )}
                    </select>
                </div>

                <div className="pt-4 flex gap-3">
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-all"
                        >
                            Cancelar
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        style={{ background: formData.type === 'income' ? '#059669' : '#e11d48', color: '#fff' }}
                        className="flex-1 py-3 px-4 rounded-xl text-sm font-black uppercase tracking-wide shadow-lg transition-all hover:opacity-90 disabled:opacity-50"
                    >
                        {loading ? 'Guardando...' : 'Guardar Transacción'}
                    </button>
                </div>
            </form>
            </div>
        </div>
    );
}
