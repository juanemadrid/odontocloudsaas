import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiCalendar, FiUsers, FiDollarSign, FiMaximize2, FiX, FiSearch, FiBell, FiHelpCircle, FiChevronDown, FiPlus, FiHome, FiBriefcase, FiPieChart, FiMenu, FiChevronLeft } from "react-icons/fi";
import AgendaHeading from "../../modules/agenda/components/AgendaHeading";
import AgendaSidebar from "../../modules/agenda/components/AgendaSidebar";
import AgendaDailyTable from "../../modules/agenda/components/AgendaDailyTable";
import PatientListView from "../../modules/pacientes/components/PatientListView";
import CajaListView from "../../modules/caja/components/CajaListView";
import DashboardWelcome from "../../components/dashboard/DashboardWelcome";
import AdministrationMenu from "../../modules/administracion/AdministrationMenu";
import ReportsMenu from "../../modules/reportes/ReportsMenu";
import "./product-demo.css";

const noop = () => {};
const showActions = () => true;
const date = new Date(2026, 9, 19, 8);
const patients = ["María López", "Carlos Ramírez", "Ana Torres", "Luis Gómez", "Laura Martínez"].map((nombreCompleto, i) => ({
  id: `demo-patient-${i}`, nombreCompleto, tipoDocumento: "DEMO", nroDocumento: `EJEMPLO-00${i + 1}`,
  activo: true, created_at: "2026-10-01T12:00:00Z",
}));
const doctors = [{ id: "demo-doctor", nombre: "Carolina", apellido: "Mejía", nombreCompleto: "Carolina Mejía" }];
const branches = [{ id: "demo-branch", nombre: "Sede principal" }];
const chairs = [{ id: "demo-chair", nombre: "Consultorio 1" }];
const appointments = patients.map((patient, i) => ({
  id: `demo-appointment-${i}`, pacienteId: patient.id, pacienteNombre: patient.nombreCompleto,
  paciente: patient.nombreCompleto, documento: patient.nroDocumento, doctorId: doctors[0].id, sucursalId: branches[0].id,
  consultorioId: chairs[0].id, start: new Date(2026, 9, 19, 8 + i), end: new Date(2026, 9, 19, 8 + i, 30),
  comentario: ["Valoración inicial", "Control de ortodoncia", "Limpieza dental", "Restauración en resina", "Control de tratamiento"][i],
  status: ["confirmed", "attended", "waiting", "pending", "confirmed"][i],
}));
const cashRegisters = [{ id: "demo-cash", nombre: "Caja principal", usuarioNombre: "Recepción Demo", estado: "abierta", fechaApertura: "2026-10-19T08:00:00-05:00", baseInicial: 200000, totalIngresos: 1450000, totalEgresos: 150000, saldoActual: 1500000 }];
const sections = [
  { id: "inicio", label: "Inicio", icon: FiHome, description: "Panel de bienvenida de OdontoCloud con información de ejemplo." },
  { id: "agenda", label: "Agenda", icon: FiCalendar, description: "Agenda real de OdontoCloud con cinco citas de ejemplo. Las operaciones están deshabilitadas." },
  { id: "pacientes", label: "Pacientes", icon: FiUsers, description: "Directorio real de pacientes con cinco expedientes de ejemplo. Las operaciones están deshabilitadas." },
  { id: "caja", label: "Caja", icon: FiDollarSign, description: "Listado real de cajas con valores de ejemplo. Las operaciones están deshabilitadas." },
  { id: "administracion", label: "Administración", icon: FiBriefcase, description: "Menú real de los módulos de administración. Solo vista de ejemplo." },
  { id: "reportes", label: "Reportes", icon: FiPieChart, description: "Menú real de reportes de OdontoCloud. Solo vista de ejemplo." },
];

function AgendaPreview() {
  return <div className="demo-agenda flex flex-col bg-slate-50 h-full pt-5">
    <AgendaHeading occupancyPercentage={21} can={showActions} handleDownload={noop} setEditingApt={noop} setSlotData={noop} setModalOpen={noop} />
    <div className="demo-agenda-content flex flex-1 min-h-0 px-8 pb-8 gap-6">
      <div className="demo-agenda-sidebar w-64 shrink-0 overflow-y-auto"><AgendaSidebar selectedDate={date} onDateChange={noop} doctors={doctors} branches={branches} chairs={chairs} appointments={appointments} onSelectDoctor={noop} onSelectBranch={noop} onSelectChair={noop} /></div>
      <div className="demo-agenda-table flex-1 min-w-0 flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 text-slate-700">
          <span className="font-black text-xs uppercase">Lunes, 19 de octubre de 2026</span>
          <span className="bg-slate-100 rounded-xl px-5 py-2 text-blue-600 text-[10px] font-black">Día</span>
        </div>
        <AgendaDailyTable appointments={appointments} doctors={doctors} branches={branches} chairs={chairs} sidebarVisible onEventClick={noop} onUpdateStatus={noop} onWhatsApp={noop} />
      </div>
    </div>
  </div>;
}

function CashPreview() {
  return <div className="demo-cash flex bg-white h-full">
    <aside className="w-[190px] shrink-0 border-r border-slate-200 pt-5">
      <div className="px-5 pb-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">Menú</div>
      <div className="px-3 pb-3"><button className="w-full bg-[#8cc33f] text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"><FiPlus /> Abrir Caja</button></div>
      <div className="mx-3 border-t border-slate-100 mb-3" />
      {["Cajas abiertas", "Cajas cerradas", "Mi caja", "Cierres simulados", "Bancos"].map((label, i) => <div key={label} className={`mx-3 px-4 py-2 text-[13px] rounded ${i === 0 ? "font-semibold bg-slate-100 text-slate-900 border-l-2 border-blue-600" : "text-slate-600"}`}>{label}</div>)}
    </aside>
    <div className="flex-1 min-w-0 flex flex-col bg-gray-50">
      <div className="px-8 pt-5 pb-4 bg-white border-b border-slate-100"><div className="text-xs text-slate-400 mb-1">⌂ › Caja</div><h2 className="text-[20px] font-bold text-slate-800">Cajas abiertas</h2></div>
      <div className="p-5 flex-1 flex flex-col"><CajaListView activeMenu="abiertas" search="" setSearch={noop} loading={false} cajasFiltradas={cashRegisters} userProfile={{rol:"admin"}} userId="demo" userName="Recepción Demo" can={showActions} setSelectedCaja={noop} setShowDetalle={noop} setShowCerrar={noop} setShowMovimiento={noop} /></div>
    </div>
  </div>;
}

function DemoScreen({ section, onSectionChange, collapsed, onToggleMenu }) {
  const frameRef = useRef(null);
  const [scale, setScale] = useState(0.5);
  const [compact, setCompact] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => { setScale(entry.contentRect.width / 1440); setCompact(entry.contentRect.width < 640); });
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, []);
  return <div className={`product-demo-frame ${compact ? "is-compact" : ""} ${collapsed ? "is-collapsed" : ""} ${drawerOpen ? "is-drawer-open" : ""}`} ref={frameRef}>
    <div className="product-demo-canvas" style={{transform:compact ? "none" : `scale(${scale})`}}>
      {compact && drawerOpen && <button className="product-demo-menu-backdrop" aria-label="Cerrar menú de la demo" onClick={() => setDrawerOpen(false)} />}
      <aside id="product-demo-sidebar" className="product-demo-sidebar" aria-label="Menú principal de la demo" hidden={compact && !drawerOpen}>
        {compact && <button className="product-demo-drawer-close" onClick={() => setDrawerOpen(false)} aria-label="Cerrar menú principal"><FiX /></button>}
        <div className="product-demo-brand"><img src={`${import.meta.env.BASE_URL}assets/logo.png`} alt="" /><strong>Clínica de demostración</strong><span>OdontoCloud</span></div>
        <div className="product-demo-search"><FiSearch /><span>Buscar…</span><small>Ctrl K</small></div>
        <div className="product-demo-menu-label">Menú principal</div>
        <nav aria-label="Módulos de la demostración">{sections.map(({id,label,icon:Icon}) => <button key={id} type="button" onClick={() => { onSectionChange(id); setDrawerOpen(false); }} aria-label={label} title={label} aria-pressed={section === id} className={section === id ? "is-active" : ""}><Icon /><span>{label}</span></button>)}</nav>
        <div className="product-demo-sidebar-note">Vista de ejemplo<br />Solo navegación visual</div>
      </aside>
      <div className="product-demo-workspace">
        <header className="product-demo-appbar"><span><button type="button" className="product-demo-menu-toggle" onClick={() => compact ? setDrawerOpen(value => !value) : onToggleMenu()} aria-controls="product-demo-sidebar" aria-expanded={compact ? drawerOpen : !collapsed} aria-label={compact ? "Abrir menú principal" : collapsed ? "Expandir menú principal" : "Ocultar menú principal"}>{compact || collapsed ? <FiMenu /> : <FiChevronLeft />}</button><span>Sede principal</span> <FiChevronDown /></span><div><FiHelpCircle /> Ayuda <FiBell /><span className="product-demo-avatar">D</span> Usuario Demo</div></header>
        <div className="product-demo-view" role="img" aria-label={sections.find(item => item.id === section).description}>
          <div inert="" className="product-demo-inert" key={section}>
            {section === "inicio" && <div className="demo-home p-8 space-y-6"><DashboardWelcome initials="UD" rolLabel="Administrador" dateLabel="Lunes, 19 de octubre de 2026" saludo="¡Buenos días" displayName="Usuario Demo" companyName="Clínica de demostración" /><div className="rounded-2xl bg-white border border-slate-200 p-5"><h2 className="text-sm font-bold text-slate-800 flex gap-2 items-center"><FiBell /> Tablón de avisos</h2><p className="text-xs text-slate-500 mt-2">Comunicados del sistema OdontoCloud</p><div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-100"><strong className="text-sm text-blue-800">Bienvenido a OdontoCloud</strong><p className="mt-2 text-xs text-slate-600">Explora las secciones desde el menú principal. Esta vista utiliza datos de ejemplo.</p></div></div></div>}
            {section === "administracion" && <div className="demo-admin p-4 max-w-6xl mx-auto"><AdministrationMenu /></div>}
            {section === "reportes" && <div className="demo-reports"><ReportsMenu /></div>}
            {section === "agenda" && <AgendaPreview />}
            {section === "pacientes" && <div className="demo-patients"><PatientListView pacientes={patients} loading={false} totalCount={5} searchTerm="" autoFocus={false} permissions={{canCreate:true,canEdit:true,canToggle:true,canDelete:true}} onSelect={noop} onEdit={noop} onSearchChange={noop} onCreateNew={noop} onImportClick={noop} onToggleStatus={noop} onDelete={noop} /></div>}
            {section === "caja" && <CashPreview />}
          </div>
        </div>
      </div>
    </div>
  </div>;
}

export default function ProductDemo() {
  const [section, setSection] = useState("inicio");
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!expanded) return undefined;
    dialogRef.current.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [expanded]);
  const toolbar = <div className="product-demo-toolbar"><span><span className="product-demo-dot" />Demo interactiva <small>· Datos de ejemplo</small></span><button type="button" onClick={() => setExpanded(!expanded)}>{expanded ? <FiX /> : <FiMaximize2 />}{expanded ? "Cerrar demo" : "Ampliar demo"}</button></div>;

  return <div className="product-demo">
    {toolbar}
    {expanded ? <div className="product-demo-placeholder"><button type="button" onClick={() => dialogRef.current?.focus()}>La demo está ampliada</button></div> : <><DemoScreen section={section} onSectionChange={setSection} collapsed={collapsed} onToggleMenu={() => setCollapsed(value => !value)} /></>}
    {!expanded && <p className="product-demo-caption">Explora el sistema desde el menú lateral. Puedes plegarlo o ampliar la demo.</p>}
    {expanded && createPortal(<dialog ref={dialogRef} className="product-demo-dialog" aria-label="Demo interactiva de OdontoCloud" onCancel={() => setExpanded(false)} onClick={event => {if (event.target === event.currentTarget) setExpanded(false);}}>
      {toolbar}<div className="product-demo-dialog-body"><DemoScreen section={section} onSectionChange={setSection} collapsed={collapsed} onToggleMenu={() => setCollapsed(value => !value)} /></div>
      <p className="product-demo-caption">Solo navegación visual · Las operaciones están deshabilitadas.</p>
    </dialog>, document.body)}
  </div>;
}
