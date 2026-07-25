import React, { useState, useEffect } from 'react';
import { FiX, FiCheck, FiInfo } from 'react-icons/fi';

const FDI_PERMANENT = {
    upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
    upperLeft: [21, 22, 23, 24, 25, 26, 27, 28],
    lowerLeft: [31, 32, 33, 34, 35, 36, 37, 38],
    lowerRight: [48, 47, 46, 45, 44, 43, 42, 41]
};

const FDI_TEMPORAL = {
    upperRight: [55, 54, 53, 52, 51],
    upperLeft: [61, 62, 63, 64, 65],
    lowerLeft: [71, 72, 73, 74, 75],
    lowerRight: [85, 84, 83, 82, 81]
};

export default function ToothSelectorModal({ isOpen, onClose, onSave, initialValue = "" }) {
    const [activeTab, setActiveTab] = useState('perm'); // 'perm' | 'temp'
    const [selectedTeeth, setSelectedTeeth] = useState([]);

    useEffect(() => {
        if (isOpen) {
            // Parse initial value (e.g., "18, 17, 54")
            const teeth = initialValue
                .split(',')
                .map(s => s.trim())
                .filter(s => s !== "")
                .map(s => parseInt(s, 10))
                .filter(n => !isNaN(n));
            setSelectedTeeth(teeth);
        }
    }, [isOpen, initialValue]);

    const toggleTooth = (num) => {
        if (selectedTeeth.includes(num)) {
            setSelectedTeeth(selectedTeeth.filter(t => t !== num));
        } else {
            setSelectedTeeth([...selectedTeeth, num].sort((a, b) => a - b));
        }
    };

    const handleSave = () => {
        onSave(selectedTeeth.join(', '));
        onClose();
    };

    if (!isOpen) return null;

    const renderTooth = (num) => {
        const isSelected = selectedTeeth.includes(num);
        return (
            <button
                key={num}
                onClick={() => toggleTooth(num)}
                className={`w-9 h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all border-2 group ${
                    isSelected 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' 
                        : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-300 hover:text-indigo-600'
                }`}
            >
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-black ${isSelected ? 'border-white/40' : 'border-slate-100 group-hover:border-indigo-100'}`}>
                    {num}
                </div>
                <div className={`w-5 h-5 rounded-lg border-2 ${isSelected ? 'bg-white/20 border-white/40' : 'bg-slate-50 border-slate-100 group-hover:bg-indigo-50'}`} />
            </button>
        );
    };

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden animate-fadeIn border border-slate-100">
                
                {/* Header Tabs */}
                <div className="px-8 pt-6">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">Selector de Piezas Dentales</h3>
                            <div className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[8px] font-black rounded-full uppercase tracking-widest">FDI Nomenclature</div>
                        </div>
                        <button onClick={onClose} className="text-slate-300 hover:text-slate-600 transition-colors">
                            <FiX size={24} />
                        </button>
                    </div>

                    <div className="flex bg-slate-50 p-1.5 rounded-[20px] gap-1 mb-8">
                        <button 
                            onClick={() => setActiveTab('perm')}
                            className={`flex-1 py-3 px-4 rounded-[16px] text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'perm' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Dentición Permanente
                        </button>
                        <button 
                            onClick={() => setActiveTab('temp')}
                            className={`flex-1 py-3 px-4 rounded-[16px] text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'temp' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Dentición Temporal
                        </button>
                    </div>
                </div>

                {/* Tooth Grid Rendering */}
                <div className="px-8 pb-8 flex flex-col gap-8">
                    {activeTab === 'perm' ? (
                        <>
                            {/* Upper Arch */}
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] ml-2">Arcada Superior (P)</span>
                                <div className="flex justify-between">
                                    <div className="flex gap-1.5">
                                        {FDI_PERMANENT.upperRight.map(renderTooth)}
                                    </div>
                                    <div className="flex gap-1.5">
                                        {FDI_PERMANENT.upperLeft.map(renderTooth)}
                                    </div>
                                </div>
                            </div>
                            {/* Lower Arch */}
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] ml-2">Arcada Inferior (P)</span>
                                <div className="flex justify-between">
                                    <div className="flex gap-1.5">
                                        {FDI_PERMANENT.lowerRight.reverse().map(renderTooth)}
                                    </div>
                                    <div className="flex gap-1.5">
                                        {FDI_PERMANENT.lowerLeft.reverse().map(renderTooth)}
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                             {/* Upper Arch Temporal */}
                             <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] ml-2">Arcada Superior (T)</span>
                                <div className="flex justify-center gap-12">
                                    <div className="flex gap-1.5">
                                        {FDI_TEMPORAL.upperRight.map(renderTooth)}
                                    </div>
                                    <div className="flex gap-1.5">
                                        {FDI_TEMPORAL.upperLeft.map(renderTooth)}
                                    </div>
                                </div>
                            </div>
                            {/* Lower Arch Temporal */}
                            <div className="flex flex-col gap-2">
                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] ml-2 text-center">Arcada Inferior (T)</span>
                                <div className="flex justify-center gap-12">
                                    <div className="flex gap-1.5">
                                        {FDI_TEMPORAL.lowerRight.reverse().map(renderTooth)}
                                    </div>
                                    <div className="flex gap-1.5">
                                        {FDI_TEMPORAL.lowerLeft.reverse().map(renderTooth)}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer and Summary */}
                <div className="bg-slate-50/50 p-8 flex flex-col md:flex-row justify-between items-center gap-6 border-t border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white border border-slate-200 rounded-2xl">
                             <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Piezas Seleccionadas:</div>
                             <div className="text-xs font-black text-indigo-600 min-w-[100px]">
                                 {selectedTeeth.length > 0 ? selectedTeeth.join(', ') : 'NINGUNA'}
                             </div>
                        </div>
                        <div className="text-slate-400 hover:text-slate-600 cursor-help" title="FDI World Dental Federation notation (ISO 3950)">
                            <FiInfo size={16} />
                        </div>
                    </div>
                    
                    <div className="flex gap-3 w-full md:w-auto">
                        <button onClick={onClose} className="px-6 py-2 text-xs font-black uppercase text-slate-500 hover:text-slate-700 transition-colors">Cancelar</button>
                        <button 
                            onClick={handleSave}
                            className="flex-1 md:flex-none px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                        >
                            <FiCheck /> Guardar Selección
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
