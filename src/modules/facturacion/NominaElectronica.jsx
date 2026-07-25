import React, { useState, useEffect } from "react";
import {
    FiUsers, FiSend, FiFileText, FiCheckCircle, FiClock, FiAlertCircle,
    FiSearch, FiPlus, FiEdit2, FiTrash2, FiX, FiPieChart, FiTrendingUp
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, AreaChart, Area
} from "recharts";
import { useAuth } from "../../context/AuthContext";
import {
    getEmployees,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    getPayrollRecords,
    generatePayrollRecord,
    sendPayrollToDian
} from "../../services/payrollService";

const NominaElectronica = () => {
    const { userProfile } = useAuth();
    const inquilino = userProfile?.inquilino;

    const [searchTerm, setSearchTerm] = useState("");
    const [employees, setEmployees] = useState([]);
    const [payrollRecords, setPayrollRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("empleados");
    const [currentPeriod] = useState(new Date().toISOString().slice(0, 7));

    // Modal states
    const [showEmployeeModal, setShowEmployeeModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [employeeForm, setEmployeeForm] = useState({ nombre: "", cargo: "", salary: "" });

    useEffect(() => {
        if (inquilino) {
            loadData();
        }
    }, [inquilino, currentPeriod]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [emps, records] = await Promise.all([
                getEmployees(inquilino),
                getPayrollRecords(inquilino, currentPeriod)
            ]);
            setEmployees(emps);
            setPayrollRecords(records);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveEmployee = async (e) => {
        e.preventDefault();
        try {
            if (editingEmployee) {
                await updateEmployee(editingEmployee.id, employeeForm);
            } else {
                await addEmployee(inquilino, employeeForm);
            }
            setShowEmployeeModal(false);
            setEditingEmployee(null);
            setEmployeeForm({ nombre: "", cargo: "", salary: "" });
            loadData();
        } catch (error) {
            alert("Error al guardar empleado");
        }
    };

    const handleDeleteEmployee = async (id) => {
        if (window.confirm("¿Seguro que deseas eliminar este empleado?")) {
            await deleteEmployee(id);
            loadData();
        }
    };

    const handleGeneratePayroll = async (emp) => {
        try {
            await generatePayrollRecord(inquilino, emp, currentPeriod);
            loadData();
        } catch (error) {
            alert("Error al generar nómina");
        }
    };

    const handleSendToDian = async (id) => {
        try {
            await sendPayrollToDian(id);
            loadData();
        } catch (error) {
            alert("Error en el envío");
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case "Enviado": return <FiCheckCircle />;
            case "Pendiente": return <FiClock />;
            case "Error": return <FiAlertCircle />;
            default: return null;
        }
    };

    // Chart Data
    const chartData = [
        { name: "Salario Base", value: payrollRecords.reduce((acc, r) => acc + Number(r.salaryBase), 0) },
        { name: "Deducciones", value: payrollRecords.reduce((acc, r) => acc + Number(r.deducciones.total), 0) },
        { name: "Neto Pagado", value: payrollRecords.reduce((acc, r) => acc + Number(r.totalNeto), 0) },
    ];

    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.6, staggerChildren: 0.1 } }
    };

    const itemVariants = {
        hidden: { opacity: 0, scale: 0.95 },
        visible: { opacity: 1, scale: 1 }
    };

    return (
        <motion.div
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="space-y-8 pb-10"
        >
            {/* Ultra-Premium Hero Section */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-[40px] p-10 border border-slate-800 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] -mr-48 -mt-48" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] -ml-32 -mb-32" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="space-y-4">
                        <motion.div
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full"
                        >
                            <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em]">Enterprise Premium Access</span>
                        </motion.div>
                        <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tight leading-none">
                            Nómina <span className="text-indigo-400">Inteligente</span>
                        </h1>
                        <p className="text-slate-400 text-sm font-medium max-w-xl leading-relaxed">
                            Automatización completa de pagos, cumplimiento DIAN y analítica financiera avanzada para tu equipo clínico.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-4">
                        <button
                            onClick={() => { setEditingEmployee(null); setEmployeeForm({ nombre: "", cargo: "", salary: "" }); setShowEmployeeModal(true); }}
                            className="bg-white hover:bg-slate-50 text-slate-900 px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
                        >
                            <FiPlus size={18} /> Nuevo Miembro
                        </button>
                    </div>
                </div>
            </div>

            {/* Analytics Dashboard Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Stats Cards */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                        { label: "Talento Humano", value: employees.length, icon: <FiUsers />, color: "border-blue-500/20 bg-blue-50/50 text-blue-600" },
                        { label: "Efectividad DIAN", value: `${payrollRecords.length > 0 ? Math.round((payrollRecords.filter(r => r.statusDian === 'Enviado').length / payrollRecords.length) * 100) : 0}%`, icon: <FiCheckCircle />, color: "border-emerald-500/20 bg-emerald-50/50 text-emerald-600" },
                        { label: "Costo Mensual", value: `$ ${(payrollRecords.reduce((acc, r) => acc + r.totalNeto, 0) / 1000000).toFixed(1)}M`, icon: <FiTrendingUp />, color: "border-indigo-500/20 bg-indigo-50/50 text-indigo-600" },
                    ].map((stat, idx) => (
                        <motion.div
                            key={idx}
                            variants={itemVariants}
                            className={`p-8 rounded-[32px] border shadow-sm flex flex-col gap-4 group hover:shadow-md transition-all ${stat.color}`}
                        >
                            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-xl">
                                {stat.icon}
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.15em] opacity-60 mb-1">{stat.label}</p>
                                <h4 className="text-3xl font-black tracking-tight">{stat.value}</h4>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Mini Chart Card */}
                <motion.div
                    variants={itemVariants}
                    className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-4"
                >
                    <div className="flex items-center justify-between">
                        <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <FiPieChart className="text-indigo-500" /> Distribución de Costos
                        </h5>
                    </div>
                    <div className="h-32 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <Bar dataKey="value" radius={[4, 4, 4, 4]}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 2 ? "#6366f1" : index === 1 ? "#ef4444" : "#94a3b8"} />
                                    ))}
                                </Bar>
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-slate-900 text-white p-3 rounded-xl text-[10px] font-bold shadow-xl">
                                                    {payload[0].name}: ${payload[0].value.toLocaleString()}
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                        <span>Base</span>
                        <span>Deduc.</span>
                        <span className="text-indigo-600 font-black">Neto</span>
                    </div>
                </motion.div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-1 bg-slate-100/80 p-1.5 rounded-3xl w-fit">
                {["empleados", "nominas"].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-8 py-3 rounded-[20px] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-500 hover:bg-white/50'}`}
                    >
                        {tab === 'empleados' ? 'Gestión de Talento' : 'Registro de Nóminas'}
                    </button>
                ))}
            </div>

            {/* Main Content Table Area */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.4 }}
                    className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden min-h-[500px]"
                >
                    <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="relative w-full md:w-[400px]">
                            <FiSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder={activeTab === 'empleados' ? "Buscar por nombre o cargo..." : "Buscar en registros..."}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-14 pr-6 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-3 px-6 py-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                            <FiClock className="text-indigo-500" />
                            <span className="text-sm font-black text-indigo-700 tracking-tight uppercase tracking-[0.1em]">Periodo Fiscal: {currentPeriod}</span>
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-32 flex flex-col items-center justify-center gap-4">
                            <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sincronizando con la nube...</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50">
                                    <tr>
                                        {activeTab === 'empleados' ? (
                                            <>
                                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Empleado Ejecutivo</th>
                                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Compensación</th>
                                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estatus</th>
                                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                                            </>
                                        ) : (
                                            <>
                                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Registro de Pago</th>
                                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Neto de Desembolso</th>
                                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Integración DIAN</th>
                                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Gestión</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {activeTab === 'empleados' ? (
                                        employees.filter(e => e.nombre?.toLowerCase().includes(searchTerm.toLowerCase())).map((emp) => {
                                            const hasPayroll = payrollRecords.find(r => r.employeeId === emp.id);
                                            return (
                                                <motion.tr
                                                    layout
                                                    key={emp.id}
                                                    className="hover:bg-slate-50/60 transition-colors group"
                                                >
                                                    <td className="px-10 py-6">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-indigo-200">
                                                                {emp.nombre.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <h6 className="font-black text-slate-800 tracking-tight leading-none mb-1">{emp.nombre}</h6>
                                                                <p className="text-[11px] font-medium text-slate-400">{emp.cargo}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-10 py-6">
                                                        <div className="bg-slate-50 w-fit px-4 py-2 rounded-xl border border-slate-100">
                                                            <span className="text-sm font-black text-slate-800">$ {Number(emp.salary).toLocaleString("es-CO")}</span>
                                                            <span className="text-[9px] font-bold text-slate-400 block tracking-tighter uppercase">Asignación Mensual</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-10 py-6 text-center">
                                                        <span className={`px-4 py-2 rounded-xl text-[9px] font-black border uppercase tracking-wider ${hasPayroll ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                                            {hasPayroll ? 'Nómina Ejecutada' : 'Pendiente Generar'}
                                                        </span>
                                                    </td>
                                                    <td className="px-10 py-6 text-right">
                                                        <div className="flex justify-end items-center gap-4">
                                                            {!hasPayroll && (
                                                                <button
                                                                    onClick={() => handleGeneratePayroll(emp)}
                                                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all flex items-center gap-2"
                                                                >
                                                                    <FiSend /> Ejecutar Pago
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => { setEditingEmployee(emp); setEmployeeForm({ nombre: emp.nombre, cargo: emp.cargo, salary: emp.salary }); setShowEmployeeModal(true); }}
                                                                className="w-10 h-10 rounded-xl hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 flex items-center justify-center transition-all"
                                                            >
                                                                <FiEdit2 size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteEmployee(emp.id)}
                                                                className="w-10 h-10 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-all"
                                                            >
                                                                <FiTrash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            );
                                        })
                                    ) : (
                                        payrollRecords.map((record) => (
                                            <motion.tr layout key={record.id} className="hover:bg-slate-50/60 transition-colors group">
                                                <td className="px-10 py-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                        <h6 className="font-black text-slate-800 tracking-tight">{record.employeeName}</h6>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-6">
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-black text-indigo-600 tracking-tight">$ {Number(record.totalNeto).toLocaleString("es-CO")}</span>
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Transferencia Neta</span>
                                                    </div>
                                                </td>
                                                <td className="px-10 py-6">
                                                    <div className={`w-fit flex items-center gap-2 px-4 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest ${record.statusDian === 'Enviado' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : record.statusDian === 'Error' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                                        {getStatusIcon(record.statusDian)}
                                                        {record.statusDian === 'Enviado' ? 'Validado por DIAN' : record.statusDian}
                                                    </div>
                                                </td>
                                                <td className="px-10 py-6 text-right">
                                                    {record.statusDian !== 'Enviado' && (
                                                        <button
                                                            onClick={() => handleSendToDian(record.id)}
                                                            className="px-6 py-3 bg-indigo-600 hover:bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95"
                                                        >
                                                            Transmitir DIAN
                                                        </button>
                                                    )}
                                                    {record.statusDian === 'Enviado' && (
                                                        <button className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-6 py-3 border border-slate-100 rounded-2xl bg-slate-50 ml-auto">
                                                            <FiFileText /> Comprobante
                                                        </button>
                                                    )}
                                                </td>
                                            </motion.tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            {((activeTab === 'empleados' && employees.length === 0) || (activeTab === 'nominas' && payrollRecords.length === 0)) && (
                                <div className="py-24 text-center">
                                    <div className="w-20 h-20 bg-slate-50 rounded-[30px] flex items-center justify-center text-slate-200 text-4xl mx-auto mb-6">
                                        <FiFileText />
                                    </div>
                                    <h4 className="text-lg font-black text-slate-800 tracking-tight mb-2">Sin registros activos</h4>
                                    <p className="text-xs font-medium text-slate-400 max-w-xs mx-auto mb-8">Empieza por agregar a los miembros de tu equipo clínico para gestionar su nómina.</p>
                                    <button
                                        onClick={() => { setEditingEmployee(null); setEmployeeForm({ nombre: "", cargo: "", salary: "" }); setShowEmployeeModal(true); }}
                                        className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:scale-105 transition-all"
                                    >
                                        <FiPlus /> Registrar Miembro
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Premium Modal Design */}
            <AnimatePresence>
                {showEmployeeModal && (
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                            onClick={() => setShowEmployeeModal(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 30 }}
                            className="bg-white rounded-[40px] shadow-[0_30px_100px_rgba(0,0,0,0.3)] w-full max-w-lg overflow-hidden relative z-11"
                        >
                            <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-gradient-to-r from-white to-slate-50">
                                <div>
                                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block mb-1">Configuración Administrativa</span>
                                    <h3 className="text-3xl font-black text-slate-800 tracking-tight">{editingEmployee ? "Refactorizar Datos" : "Alta de Miembro"}</h3>
                                </div>
                                <button
                                    onClick={() => setShowEmployeeModal(false)}
                                    className="w-12 h-12 rounded-2xl bg-white border border-slate-100 text-slate-400 hover:text-slate-800 flex items-center justify-center transition-all hover:shadow-md"
                                >
                                    <FiX size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSaveEmployee} className="p-10 space-y-8">
                                <div className="grid grid-cols-1 gap-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Nombre y Apellidos</label>
                                        <input
                                            type="text"
                                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-6 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
                                            required
                                            placeholder="Ej: Dr. Julian Arango"
                                            value={employeeForm.nombre}
                                            onChange={e => setEmployeeForm({ ...employeeForm, nombre: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Cargo Corporativo</label>
                                        <input
                                            type="text"
                                            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 px-6 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
                                            required
                                            placeholder="Ej: Especialista en Ortodoncia"
                                            value={employeeForm.cargo}
                                            onChange={e => setEmployeeForm({ ...employeeForm, cargo: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Asignación Mensual (COP)</label>
                                        <div className="relative">
                                            <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-indigo-400">$</span>
                                            <input
                                                type="number"
                                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 pl-10 pr-6 text-sm font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
                                                required
                                                placeholder="0.00"
                                                value={employeeForm.salary}
                                                onChange={e => setEmployeeForm({ ...employeeForm, salary: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowEmployeeModal(false)}
                                        className="flex-1 py-5 bg-slate-50 text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-100 transition-colors"
                                    >
                                        Retroceder
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-[2] py-5 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl transition-all transform hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-3"
                                    >
                                        <FiCheckCircle size={18} /> {editingEmployee ? "Confirmar Cambios" : "Sincronizar Miembro"}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default NominaElectronica;
