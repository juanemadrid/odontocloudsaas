import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Send, 
  Search, 
  Settings, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import IhceConfigForm from '../components/ihce/IhceConfigForm.jsx';
import IhceOutboxTable from '../components/ihce/IhceOutboxTable.jsx';
import IhceExternalRdaViewer from '../components/ihce/IhceExternalRdaViewer.jsx';
import BreakGlassManager from '../components/ihce/BreakGlassManager.jsx';

export default function IhceDashboard() {
  const [activeTab, setActiveTab] = useState('outbox');
  const [config, setConfig] = useState({
    codigo_habilitacion_reps: '110010998801',
    codigo_sede_reps: '01',
    nombre_prestador: 'Clínica OdontoCloud Piloto',
    nit: '901234567',
    ambiente: 'SANDBOX_MOCK',
    client_id: 'odontocloud-client-01',
    client_secret: '••••••••••••••••',
    is_active: true,
    auto_dispatch_enabled: true
  });

  const [outboxItems, setOutboxItems] = useState([
    {
      id: 'f9b20e11-7a1a-4d22-92ab-129088716253',
      paciente_nombre: 'Carlos Sintético Apolo',
      paciente_documento: 'CC 1018234567',
      status: 'ACEPTADO',
      radicado_oficial: 'RAD-IHCE-2026-918234',
      intentos: 1,
      max_intentos: 5,
      ultimo_http_status: 201,
      idempotency_key: '9ceb9caa7844c62b9fc9d065406865741b265176a64968133699d96df51725af',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date(Date.now() - 3500000).toISOString()
    },
    {
      id: 'e1c40f22-8b2b-4e33-83bc-230199827364',
      paciente_nombre: 'Diana Sintética Boreal',
      paciente_documento: 'CC 1020345678',
      status: 'PENDIENTE',
      radicado_oficial: null,
      intentos: 0,
      max_intentos: 5,
      ultimo_http_status: null,
      idempotency_key: '3ab78ee234f9a01889c023412716a541b265176a64968133699d96df51725ab',
      created_at: new Date(Date.now() - 1200000).toISOString(),
      updated_at: new Date(Date.now() - 1200000).toISOString()
    }
  ]);

  const [breakGlassSessions, setBreakGlassSessions] = useState([
    {
      id: 'bg-session-001',
      usuario_nombre: 'Ing. Soporte Técnico TI',
      paciente_id: 'paciente-apolo-1',
      paciente_nombre: 'Carlos Sintético Apolo',
      motivo: 'Auditoría judicial urgente expediente No. 4921',
      ticket_referencia: 'TICKET-SEC-882',
      valido_hasta: new Date(Date.now() + 15 * 60000).toISOString(),
      estado: 'ACTIVA'
    },
    {
      id: 'bg-session-002',
      usuario_nombre: 'Ing. Soporte Técnico TI',
      paciente_id: 'paciente-boreal-2',
      paciente_nombre: 'Diana Sintética Boreal',
      motivo: 'Falla de sincronización de odontograma en estación local',
      ticket_referencia: 'TICKET-SEC-904',
      valido_hasta: new Date(Date.now() + 120 * 60000).toISOString(),
      estado: 'PENDIENTE_APROBACION'
    }
  ]);

  const [isSaving, setIsSaving] = useState(false);

  // Métricas
  const totalItems = outboxItems.length;
  const acceptedItems = outboxItems.filter(i => i.status === 'ACEPTADO').length;
  const pendingItems = outboxItems.filter(i => i.status === 'PENDIENTE' || i.status === 'PROCESANDO').length;
  const errorItems = outboxItems.filter(i => i.status === 'ERROR_REINTENTO' || i.status === 'RECHAZADO' || i.status === 'ERROR_DEFINITIVO').length;

  const handleSaveConfig = async (newConfig) => {
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 600));
    setConfig(newConfig);
    setIsSaving(false);
  };

  const handleRetryItem = async (itemId) => {
    setOutboxItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, status: 'PROCESANDO', intentos: (item.intentos || 0) + 1 };
      }
      return item;
    }));

    // Simular resultado
    setTimeout(() => {
      setOutboxItems(prev => prev.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            status: 'ACEPTADO',
            radicado_oficial: `RAD-IHCE-2026-${Math.floor(100000 + Math.random() * 900000)}`,
            ultimo_http_status: 201,
            updated_at: new Date().toISOString()
          };
        }
        return item;
      }));
    }, 1500);
  };

  const handleApproveBreakGlass = async (sessionId) => {
    setBreakGlassSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return {
          ...s,
          estado: 'ACTIVA',
          aprobado_at: new Date().toISOString(),
          valido_hasta: new Date(Date.now() + 30 * 60000).toISOString()
        };
      }
      return s;
    }));
  };

  const handleRevokeBreakGlass = async (sessionId, motivo) => {
    setBreakGlassSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return { ...s, estado: 'REVOCADA', revocado_at: new Date().toISOString(), motivo_revocacion: motivo };
      }
      return s;
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Interoperabilidad IHCE
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
              Ley 2015 / Res. 1888
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Mecanismo Nacional de Historia Clínica Electrónica — Resumen Digital de Atención (RDA)
          </p>
        </div>

        {/* Estado Global */}
        <div className="flex items-center space-x-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-sm">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-slate-700">
            {config.is_active ? 'Conexión Activa (Simulador Local)' : 'Interoperabilidad Desactivada'}
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Atenciones RDA</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalItems}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Aceptados MinSalud</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{acceptedItems}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pendientes en Cola</p>
            <p className="text-2xl font-bold text-slate-700 mt-1">{pendingItems}</p>
          </div>
          <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rechazos / Errores</p>
            <p className="text-2xl font-bold text-rose-600 mt-1">{errorItems}</p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200 flex space-x-6 text-sm font-semibold text-slate-500">
        <button
          onClick={() => setActiveTab('outbox')}
          className={`pb-3 transition-colors flex items-center space-x-2 border-b-2 ${activeTab === 'outbox' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-800'}`}
        >
          <Send className="w-4 h-4" />
          <span>Bandeja de Envíos RDA</span>
        </button>

        <button
          onClick={() => setActiveTab('external')}
          className={`pb-3 transition-colors flex items-center space-x-2 border-b-2 ${activeTab === 'external' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-800'}`}
        >
          <Search className="w-4 h-4" />
          <span>Visor de RDA Externos</span>
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`pb-3 transition-colors flex items-center space-x-2 border-b-2 ${activeTab === 'config' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-800'}`}
        >
          <Settings className="w-4 h-4" />
          <span>Configuración del Prestador</span>
        </button>

        <button
          onClick={() => setActiveTab('breakglass')}
          className={`pb-3 transition-colors flex items-center space-x-2 border-b-2 ${activeTab === 'breakglass' ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-800'}`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Auditoría Break-Glass</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'outbox' && (
          <IhceOutboxTable items={outboxItems} onRetry={handleRetryItem} />
        )}

        {activeTab === 'external' && (
          <IhceExternalRdaViewer defaultDocumento="1018234567" />
        )}

        {activeTab === 'config' && (
          <IhceConfigForm config={config} onSave={handleSaveConfig} isSaving={isSaving} />
        )}

        {activeTab === 'breakglass' && (
          <BreakGlassManager 
            sessions={breakGlassSessions} 
            onRevokeSession={handleRevokeBreakGlass} 
            onApproveSession={handleApproveBreakGlass} 
          />
        )}
      </div>
    </div>
  );
}
