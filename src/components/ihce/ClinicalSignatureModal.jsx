import React, { useState } from 'react';
import { ShieldCheck, Lock, AlertTriangle, Key, CheckCircle } from 'lucide-react';

/**
 * Modal de Reautenticación y Firma Confiable de Evoluciones Clínicas
 * Cumplimiento: Ley 527 de 1999, Decreto 2364 de 2012 y Res. 1995 de 1999.
 */
export default function ClinicalSignatureModal({ isOpen, onClose, onConfirm, evolutionData, practitionerName }) {
  const [pinOrPassword, setPinOrPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pinOrPassword.trim()) {
      setError('Debe ingresar su contraseña o PIN de firma electrónica para continuar.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await onConfirm(pinOrPassword);
      setPinOrPassword('');
      onClose();
    } catch (err) {
      setError(err.message || 'Error al validar las credenciales de firma.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md">
              <ShieldCheck className="w-7 h-7 text-blue-200" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Cierre y Firma Electrónica</h2>
              <p className="text-xs text-blue-200 mt-0.5">Sellado Criptográfico e Inmutabilidad IHCE</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Advertencia Legal */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <strong className="font-semibold text-amber-950">Aviso Legal Obligatorio:</strong> Al firmar esta evolución, el expediente quedará sellado de forma <strong>definitiva e inmutable</strong> mediante un hash criptográfico SHA-256. Ningún usuario ni administrador podrá alterar o eliminar este registro.
            </div>
          </div>

          {/* Resumen Clínico */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2 text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Profesional Firmante:</span>
              <span className="font-semibold text-slate-900">{practitionerName || 'Odontólogo Tratante'}</span>
            </div>
            {evolutionData?.diagnostico && (
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Diagnóstico Principal:</span>
                <span className="font-semibold text-slate-900">{evolutionData.diagnostico}</span>
              </div>
            )}
            {evolutionData?.procedimiento_cups && (
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Procedimiento CUPS:</span>
                <span className="font-semibold text-slate-900">{evolutionData.procedimiento_cups}</span>
              </div>
            )}
          </div>

          {/* Campo de Reautenticación */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Contraseña o PIN del Profesional
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Key className="w-4 h-4" />
              </div>
              <input
                type="password"
                value={pinOrPassword}
                onChange={(e) => setPinOrPassword(e.target.value)}
                placeholder="Ingrese su credencial de confirmación"
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                autoFocus
              />
            </div>
            {error && (
              <p className="text-xs text-rose-600 font-medium">{error}</p>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center space-x-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 active:bg-blue-900 rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Sellando...</span>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Firmar y Sellar Evolución</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
