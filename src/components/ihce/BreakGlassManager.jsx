import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle, Clock, XCircle, UserCheck, KeyRound } from 'lucide-react';

export default function BreakGlassManager({ sessions = [], onRevokeSession, onApproveSession, isRevoking, isApproving }) {
  const [revokingId, setRevokingId] = useState(null);
  const [motivoRevocacion, setMotivoRevocacion] = useState('');

  const handleRevoke = async (sessionId) => {
    if (!motivoRevocacion.trim()) {
      alert('Debe indicar un motivo para la revocación del acceso excepcional.');
      return;
    }

    try {
      await onRevokeSession(sessionId, motivoRevocacion.trim());
      setRevokingId(null);
      setMotivoRevocacion('');
    } catch (err) {
      alert(`Error al revocar: ${err.message}`);
    }
  };

  const getStatusBadge = (session) => {
    const isExpired = new Date(session.valido_hasta) < new Date();
    if (session.estado === 'PENDIENTE_APROBACION') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 animate-pulse">
          <Clock className="w-3.5 h-3.5 mr-1 text-amber-600" /> Pendiente Aprobación
        </span>
      );
    }
    if (session.estado === 'REVOCADA' || session.revocado_at) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
          <XCircle className="w-3.5 h-3.5 mr-1 text-rose-600" /> Revocada
        </span>
      );
    }
    if (isExpired) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
          <Clock className="w-3.5 h-3.5 mr-1 text-slate-500" /> Expirada
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
        <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Activa (Vigente)
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-900 to-slate-900 text-white p-6">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-rose-600/30 border border-rose-400/30 rounded-xl">
            <ShieldAlert className="w-6 h-6 text-rose-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Control y Auditoría de Acceso Excepcional (Break-Glass)</h3>
            <p className="text-xs text-rose-200">Monitoreo y Revocación de Accesos de Contingencia sobre Pacientes</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 leading-relaxed">
          <strong>Protocolo de Seguridad Clínica:</strong> Ningún superadmin tiene permiso indiscriminado sobre las historias de los pacientes. Cada evento break-glass exige justificación legal, ticket de soporte y caduca en 30 minutos. El Administrador de la Clínica tiene la potestad de revocar cualquier sesión activa en tiempo real.
        </div>

        {/* Tabla de Sesiones */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100">
                <th className="py-3 px-4">Usuario Solicitante</th>
                <th className="py-3 px-4">Paciente Afectado</th>
                <th className="py-3 px-4">Motivo Legal / Ticket</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4">Válido Hasta</th>
                <th className="py-3 px-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                    No se registran solicitudes de acceso excepcional break-glass en esta clínica.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => {
                  const isAlive = !s.revocado_at && new Date(s.valido_hasta) > new Date();
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {s.usuario_nombre || 'Superadmin de Soporte'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        {s.paciente_nombre || s.paciente_id}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="truncate font-medium text-slate-800">{s.motivo}</div>
                        {s.ticket_referencia && (
                          <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-mono">
                            Ticket: {s.ticket_referencia}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {getStatusBadge(s)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(s.valido_hasta).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {s.estado === 'PENDIENTE_APROBACION' ? (
                          <button
                            onClick={() => onApproveSession && onApproveSession(s.id)}
                            disabled={isApproving}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                          >
                            Aprobar Acceso
                          </button>
                        ) : isAlive ? (
                          <button
                            onClick={() => setRevokingId(s.id)}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
                          >
                            Revocar
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Confirmación de Revocación */}
      {revokingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center space-x-3 text-rose-600">
              <AlertTriangle className="w-6 h-6" />
              <h4 className="font-bold text-base text-slate-900">Confirmar Revocación de Acceso</h4>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Esta acción cerrará de inmediato la sesión de contingencia y el usuario perderá todo acceso al paciente especificado.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Motivo de la Revocación *
              </label>
              <textarea
                value={motivoRevocacion}
                onChange={(e) => setMotivoRevocacion(e.target.value)}
                placeholder="Indique el motivo de la cancelación del acceso..."
                rows={3}
                className="w-full p-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-600"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setRevokingId(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleRevoke(revokingId)}
                disabled={isRevoking}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm disabled:opacity-50"
              >
                {isRevoking ? 'Revocando...' : 'Revocar Acceso Ahora'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
