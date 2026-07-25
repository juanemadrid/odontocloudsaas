import React from 'react';

export default function Input({ label, error, variant = 'default', className = '', containerClassName = '', ...props }) {
    const baseClasses = "w-full px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 outline-none";
    const variantClasses = {
        default: "bg-white border border-slate-300 text-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-sm",
        filled: "bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10",
        glass: "bg-white/50 backdrop-blur-md border border-white/20 focus:bg-white/80"
    };

    return (
        <div className={`flex flex-col gap-1.5 mb-4 ${containerClassName}`}>
            {label && (
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    {label}
                </label>
            )}
            <input
                className={`
                    ${baseClasses}
                    ${variantClasses[variant]}
                    placeholder:text-slate-300
                    ${error ? 'border-red-500 ring-red-50' : ''}
                    ${className}
                `}
                style={{ caretColor: '#0f172a' }}
                {...props}
            />
            {error && (
                <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider ml-1 mt-1">
                    {error}
                </span>
            )}
        </div>
    );
}
