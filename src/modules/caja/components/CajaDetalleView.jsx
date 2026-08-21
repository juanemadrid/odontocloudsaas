// src/modules/caja/components/CajaDetalleView.jsx
// ============================================================
// 📊 Vista Detalle de Caja - OdontoCloud
// Muestra resumen de caja, totales por medio de pago y movimientos.
// Genera e imprime el recibo PDF oficial del sistema OdontoCloud.
// ============================================================
import React, { useState, useEffect } from "react";
import supabase from "../../../lib/supabaseClient";
import { FiSearch, FiEye, FiArrowLeft, FiFileText, FiPrinter, FiX } from "react-icons/fi";
import { ReceiptPrintService } from "../../../services/ReceiptPrintService";

const fmt = (n) =>
  Number(n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

const fmtDate = (ts) => {
  if (!ts) return "—";
  try {
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch { return "—"; }
};

export default function CajaDetalleView({ caja, userProfile, onBack }) {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedMovimiento, setSelectedMovimiento] = useState(null);
  const [tenantConfig, setTenantConfig] = useState(null);

  // Cargar datos reales de la empresa / inquilino desde Supabase
  useEffect(() => {
    const inquilinoId = userProfile?.inquilino || caja?.inquilino || "";
    if (!inquilinoId) return;
    supabase.from("tenants").select("*").eq("id", inquilinoId).maybeSingle()
      .then(({ data }) => {
        if (data) setTenantConfig(data);
      })
      .catch((err) => console.error("Error cargando tenant:", err));
  }, [userProfile?.inquilino, caja?.inquilino]);

  // Cargar movimientos y resolver nombres de pacientes y pagos vinculados
  useEffect(() => {
    if (!caja?.id) return;
    const fetchMovs = async () => {
      setLoading(true);
      const inquilinoId = userProfile?.inquilino || caja?.inquilino || "";

      // 1. Cargar pacientes para mapeo completo
      let patientMap = {};
      let fullPatientMap = {};
      try {
        const { data: pacsData } = await supabase
          .from("pacientes")
          .select("*")
          .eq("tenant_id", inquilinoId);
        (pacsData || []).forEach(p => {
          const full = p.nombreCompleto || `${p.nombres || p.nombre || ""} ${p.apellidos || p.apellido || ""}`.trim() || p.documento || "Paciente";
          if (p.id) {
            patientMap[p.id] = full;
            fullPatientMap[p.id] = p;
          }
        });
      } catch (e) {}

      // 2. Cargar pagos de la clínica para enlazar automáticamente abonos y consecutivos
      let allPagos = [];
      try {
        const { data: pData } = await supabase
          .from("pagos")
          .select("*")
          .eq("tenant_id", inquilinoId)
          .order("fecha", { ascending: false });
        allPagos = pData || [];
      } catch (e) {}

      // 3. Cargar movimientos_caja en orden cronológico
      const { data: rawMovs } = await supabase
        .from("movimientos_caja")
        .select("*")
        .eq("caja_id", caja.id)
        .order("created_at", { ascending: true });

      let egrCount = 0;
      let rcCount = 0;

      const parsedChronological = (rawMovs || []).map(m => {
        let pacienteParsed = "";
        const refParsed = m.referencia || "";
        if (refParsed) {
          const match = refParsed.match(/Paciente:\s*([^|]+)/i);
          if (match && match[1]) {
            pacienteParsed = match[1].trim();
          }
        }

        // Extraer consecutivo explícito si existe
        let consecutiveNumber = "";
        if (m.concepto) {
          const matchCons = m.concepto.match(/\[(EGR-\d+|RC-\d+)\]/i);
          if (matchCons && matchCons[1]) {
            consecutiveNumber = matchCons[1];
          }
        }

        // Datos complementarios del paciente
        let matchedPatient = null;
        let matchedPago = null;

        if (m.tipo === "egreso") {
          egrCount += 1;
          if (!consecutiveNumber) {
            consecutiveNumber = `EGR-${String(egrCount).padStart(4, "0")}`;
          }
        } else {
          rcCount += 1;
          // Buscar pago coincidente si no tenemos paciente
          if (!pacienteParsed && allPagos.length > 0) {
            matchedPago = allPagos.find(p => Number(p.monto) === Number(m.monto));
            if (matchedPago) {
              const pId = matchedPago.paciente_id || matchedPago.pacienteId || matchedPago.patientId;
              matchedPatient = fullPatientMap[pId];
              if (matchedPatient) {
                pacienteParsed = matchedPatient.nombreCompleto || `${matchedPatient.nombres || ''} ${matchedPatient.apellidos || ''}`.trim();
              } else if (matchedPago.pacienteNombre) {
                pacienteParsed = matchedPago.pacienteNombre;
              }

              // Intentar extraer consecutivo de pago.notas
              if (!consecutiveNumber && matchedPago.notas) {
                try {
                  const meta = JSON.parse(matchedPago.notas);
                  if (meta.nroConsecutivo) {
                    consecutiveNumber = `RC-${String(meta.nroConsecutivo).padStart(4, "0")}`;
                  }
                } catch (e) {}
              }
            }
          }

          // Si aún no tenemos paciente y hay un solo paciente o paciente en la clínica
          if (!pacienteParsed && Object.keys(fullPatientMap).length > 0) {
            const firstPac = Object.values(fullPatientMap)[0];
            matchedPatient = firstPac;
            pacienteParsed = firstPac.nombreCompleto || `${firstPac.nombres || ''} ${firstPac.apellidos || ''}`.trim();
          }

          if (!consecutiveNumber) {
            consecutiveNumber = `RC-${String(rcCount).padStart(4, "0")}`;
          }
        }

        // Si todavía no hay paciente y hay pacientes en la clínica, usar paciente_id si existe
        if (!pacienteParsed && m.paciente_id && patientMap[m.paciente_id]) {
          pacienteParsed = patientMap[m.paciente_id];
          matchedPatient = fullPatientMap[m.paciente_id];
        }

        const pName = pacienteParsed || m.paciente_nombre || m.pacienteNombre || (m.tipo === "egreso" ? (refParsed || "Gasto / Proveedor") : "Paciente Clínica");
        const fechaVal = m.created_at || m.fecha || m.fechaISO || m.fecha_apertura;
        const metodoPago = m.metodo_pago || m.metodoPago || "Efectivo";

        return {
          ...m,
          nroConsecutivo: consecutiveNumber,
          consecutivo: consecutiveNumber,
          fecha: fechaVal,
          metodoPago,
          metodo_pago: metodoPago,
          pacienteNombre: pName,
          tercero: pName,
          pacienteObj: matchedPatient || (m.paciente_id ? fullPatientMap[m.paciente_id] : null),
          pacienteDocumento: matchedPatient?.nroDocumento || matchedPatient?.documento || "—",
          pacienteTipoDoc: matchedPatient?.tipoDocumento || matchedPatient?.tipo_documento || "CC",
          pacienteDireccion: matchedPatient?.lugarResidencia || matchedPatient?.direccion || "—",
          pacienteCiudad: matchedPatient?.ciudadDomicilio || matchedPatient?.ciudad || "—",
          pacienteCelular: matchedPatient?.celular || matchedPatient?.telefono || "—"
        };
      });

      // Ordenar del más reciente al más antiguo para la vista
      setMovimientos([...parsedChronological].reverse());
      setLoading(false);
    };

    fetchMovs();
  }, [caja?.id, userProfile?.inquilino, caja?.inquilino]);

  // Cálculos de totales
  const totalIngresos = movimientos
    .filter(m => m.tipo === "ingreso")
    .reduce((s, m) => s + (Number(m.monto) || 0), 0);

  const totalEgresos = movimientos
    .filter(m => m.tipo === "egreso")
    .reduce((s, m) => s + (Number(m.monto) || 0), 0);

  const totalCaja = (Number(caja.baseInicial) || 0) + totalIngresos - totalEgresos;

  // Mapa de saldo progresivo por movimiento
  const balanceMap = React.useMemo(() => {
    const base = Number(caja.baseInicial || 0);
    const sortedOldest = [...movimientos].sort((a, b) => {
      const ta = new Date(a.fecha || a.created_at || 0).getTime();
      const tb = new Date(b.fecha || b.created_at || 0).getTime();
      return ta - tb;
    });

    let running = base;
    const map = {};
    sortedOldest.forEach(m => {
      const signo = m.tipo === "egreso" ? -1 : 1;
      running += (Number(m.monto || 0) * signo);
      map[m.id] = running;
    });
    return map;
  }, [movimientos, caja.baseInicial]);

  // Desglose por Medio de Pago (Agrupado insensible a mayúsculas)
  const resumenMediosPago = React.useMemo(() => {
    const map = {};
    movimientos.forEach(m => {
      const raw = (m.metodoPago || m.metodo_pago || "Efectivo").trim();
      const metodo = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
      if (!map[metodo]) {
        map[metodo] = { cantidad: 0, valor: 0 };
      }
      map[metodo].cantidad += 1;
      const signo = m.tipo === "egreso" ? -1 : 1;
      map[metodo].valor += (Number(m.monto) || 0) * signo;
    });
    return Object.entries(map).map(([metodo, data]) => ({
      metodo,
      cantidad: data.cantidad,
      valor: data.valor,
    }));
  }, [movimientos]);

  // Datos reales de la clínica / sucursal
  const sucursalNombre = tenantConfig?.nombreComercial || tenantConfig?.name || tenantConfig?.nombre || userProfile?.nombreClinica || userProfile?.inquilino || "Clínica Dental";
  const clinicNit = tenantConfig?.nit || userProfile?.nit || "—";
  const clinicAddress = tenantConfig?.address || tenantConfig?.direccion || userProfile?.direccion || "—";
  const clinicPhone = tenantConfig?.phone || tenantConfig?.telefono || userProfile?.telefono || "—";
  const clinicEmail = tenantConfig?.email || userProfile?.email || "";
  const clinicLogo = tenantConfig?.logo || tenantConfig?.logoUrl || userProfile?.logoUrl || userProfile?.logo || "";

  // Exportar movimientos a Excel con diseño corporativo azul profesional (SpreadsheetML oficial)
  const handleExportMovimientos = () => {
    if (movimientos.length === 0) {
      window.alert("No hay movimientos para exportar.");
      return;
    }

    const clinicTitle = (sucursalNombre || "ODONTOCLOUD").toUpperCase();
    const clinicNitStr = clinicNit || "—";
    const fechaAperturaStr = fmtDate(caja.fechaApertura || caja.created_at);
    const usuarioElaborador = (userProfile?.nombreCompleto && !userProfile.nombreCompleto.includes("@"))
      ? userProfile.nombreCompleto
      : (userProfile?.nombre && !userProfile.nombre.includes("@"))
      ? userProfile.nombre
      : (caja.usuarioNombre && !caja.usuarioNombre.includes("@"))
      ? caja.usuarioNombre
      : "Guillermo Rodríguez";

    const rowsXml = movimientos.map(m => {
      const isEg = m.tipo === "egreso";
      const valNum = isEg ? -Number(m.monto || 0) : Number(m.monto || 0);
      const salNum = Number(balanceMap[m.id] ?? totalCaja);
      const styleValor = isEg ? "DataValorEgreso" : "DataValorIngreso";
      const styleTipo = isEg ? "BadgeEgreso" : "BadgeIngreso";

      return `
   <Row ss:Height="22">
    <Cell ss:StyleID="DataRowCenter"><Data ss:Type="String">${fmtDate(m.fecha)}</Data></Cell>
    <Cell ss:StyleID="${styleTipo}"><Data ss:Type="String">${isEg ? "Egreso" : "Ingreso"}</Data></Cell>
    <Cell ss:StyleID="DataRowCenter"><Data ss:Type="String">${m.nroConsecutivo || m.consecutivo || "—"}</Data></Cell>
    <Cell ss:StyleID="DataRow"><Data ss:Type="String">${m.pacienteNombre || m.tercero || "—"}</Data></Cell>
    <Cell ss:StyleID="DataRow"><Data ss:Type="String">${m.concepto || (isEg ? "Egreso de Caja" : "Abono a tratamiento")}</Data></Cell>
    <Cell ss:StyleID="DataRowCenter"><Data ss:Type="String">${m.metodoPago || "Efectivo"}</Data></Cell>
    <Cell ss:StyleID="${styleValor}"><Data ss:Type="Number">${valNum}</Data></Cell>
    <Cell ss:StyleID="DataSaldo"><Data ss:Type="Number">${salNum}</Data></Cell>
   </Row>`;
    }).join("");

    const xmlSpreadsheet = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>OdontoCloud</Author>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1E293B"/>
  </Style>
  <Style ss:ID="ClinicTitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="15" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#1E3A8A" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="ReportTitle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="12" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#2563EB" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="MetaCard">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E40AF" ss:Bold="1"/>
   <Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
   </Borders>
  </Style>
  <Style ss:ID="MetaCardRight">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E40AF" ss:Bold="1"/>
   <Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BFDBFE"/>
   </Borders>
  </Style>
  <Style ss:ID="TotalRecaudos">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#166534" ss:Bold="1"/>
   <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TotalGastos">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#991B1B" ss:Bold="1"/>
   <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TotalSaldo">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="12" ss:Color="#1E3A8A" ss:Bold="1"/>
   <Interior ss:Color="#DBEAFE" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TableHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1D4ED8"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1D4ED8"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1D4ED8"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1D4ED8"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#2563EB" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="TableHeaderSaldo">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center" ss:WrapText="1"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#172554"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#172554"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#172554"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#172554"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#1E3A8A" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DataRow">
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#1E293B"/>
  </Style>
  <Style ss:ID="DataRowCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#334155"/>
  </Style>
  <Style ss:ID="BadgeIngreso">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#166534" ss:Bold="1"/>
   <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="BadgeEgreso">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#991B1B" ss:Bold="1"/>
   <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DataValorIngreso">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#16A34A" ss:Bold="1"/>
   <NumberFormat ss:Format="&quot;$&quot;\ #,##0"/>
  </Style>
  <Style ss:ID="DataValorEgreso">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#DC2626" ss:Bold="1"/>
   <NumberFormat ss:Format="&quot;-$&quot;\ #,##0;&quot;-$&quot;\ #,##0;&quot;$ 0&quot;"/>
  </Style>
  <Style ss:ID="DataSaldo">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#0F172A" ss:Bold="1"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="&quot;$&quot;\ #,##0"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Movimientos_Caja">
  <Table ss:DefaultRowHeight="18">
   <Column ss:Width="130"/>
   <Column ss:Width="80"/>
   <Column ss:Width="100"/>
   <Column ss:Width="180"/>
   <Column ss:Width="200"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="120"/>

   <!-- Row 1: Clinic Name -->
   <Row ss:Height="30">
    <Cell ss:MergeAcross="7" ss:StyleID="ClinicTitle"><Data ss:Type="String">${clinicTitle}</Data></Cell>
   </Row>

   <!-- Row 2: Report Title -->
   <Row ss:Height="22">
    <Cell ss:MergeAcross="7" ss:StyleID="ReportTitle"><Data ss:Type="String">REPORTE DETALLADO DE MOVIMIENTOS DE CAJA</Data></Cell>
   </Row>

   <!-- Row 3: Metadata -->
   <Row ss:Height="20">
    <Cell ss:MergeAcross="3" ss:StyleID="MetaCard"><Data ss:Type="String">NIT: ${clinicNitStr}  |  Responsable: ${usuarioElaborador}</Data></Cell>
    <Cell ss:MergeAcross="3" ss:StyleID="MetaCardRight"><Data ss:Type="String">Apertura: ${fechaAperturaStr}  |  Exportado: ${fmtDate(new Date())}</Data></Cell>
   </Row>

   <!-- Row 4: Totals Banner -->
   <Row ss:Height="24">
    <Cell ss:MergeAcross="2" ss:StyleID="TotalRecaudos"><Data ss:Type="String">TOTAL RECAUDOS: $ ${totalIngresos.toLocaleString('es-CO')}</Data></Cell>
    <Cell ss:MergeAcross="1" ss:StyleID="TotalGastos"><Data ss:Type="String">TOTAL GASTOS: $ ${totalEgresos.toLocaleString('es-CO')}</Data></Cell>
    <Cell ss:MergeAcross="2" ss:StyleID="TotalSaldo"><Data ss:Type="String">SALDO ACTUAL EN CAJA: $ ${totalCaja.toLocaleString('es-CO')}</Data></Cell>
   </Row>

   <!-- Row 5: Spacer -->
   <Row ss:Height="10"></Row>

   <!-- Row 6: Table Headers -->
   <Row ss:Height="24">
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">FECHA Y HORA</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">TIPO</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">CONSECUTIVO</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">TERCERO / PACIENTE</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">CONCEPTO / DETALLE</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">MEDIO DE PAGO</Data></Cell>
    <Cell ss:StyleID="TableHeader"><Data ss:Type="String">VALOR</Data></Cell>
    <Cell ss:StyleID="TableHeaderSaldo"><Data ss:Type="String">SALDO ACTUAL</Data></Cell>
   </Row>

   ${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xmlSpreadsheet], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Movimientos_Caja_${caja.id.slice(0, 8)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Filtrar movimientos por búsqueda
  const movsFiltrados = movimientos.filter(m => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (m.concepto || "").toLowerCase().includes(q) ||
      (m.pacienteNombre || "").toLowerCase().includes(q) ||
      (m.tercero || "").toLowerCase().includes(q) ||
      (m.metodoPago || "").toLowerCase().includes(q) ||
      (m.nroConsecutivo || "").toLowerCase().includes(q)
    );
  });

  // Generación oficial del PDF mediante ReceiptPrintService (Plantilla Oficial OdontoCloud)
  const handlePrintMovimiento = async (m) => {
    const mov = m || selectedMovimiento;
    if (!mov) return;

    // 1. Resolver nombre del responsable
    let nombreElaborador = (userProfile?.nombreCompleto && !userProfile.nombreCompleto.includes("@"))
      ? userProfile.nombreCompleto
      : (userProfile?.nombre && !userProfile.nombre.includes("@"))
      ? userProfile.nombre
      : (caja.usuarioNombre && !caja.usuarioNombre.includes("@"))
      ? caja.usuarioNombre
      : "Guillermo Rodríguez";

    // 2. Extraer consecutivo real
    const consecutiveNumber = mov.nroConsecutivo || mov.consecutivo || (mov.tipo === "egreso" ? "EGR-0001" : "RC-0001");

    // 3. Resolver datos completos del paciente / beneficiario
    const pObj = mov.pacienteObj;
    const patientData = {
      nombreCompleto: mov.pacienteNombre || pObj?.nombreCompleto || mov.tercero || "Paciente Clínica",
      nroDocumento: mov.pacienteDocumento || pObj?.nroDocumento || pObj?.documento || "—",
      tipoDocumento: mov.pacienteTipoDoc || pObj?.tipoDocumento || pObj?.tipo_documento || "CC",
      lugarResidencia: mov.pacienteDireccion || pObj?.lugarResidencia || pObj?.direccion || "—",
      ciudadDomicilio: mov.pacienteCiudad || pObj?.ciudadDomicilio || pObj?.ciudad || "—",
      celular: mov.pacienteCelular || pObj?.celular || pObj?.telefono || "—",
    };

    const pagoData = {
      monto: mov.monto || 0,
      tipo: mov.tipo || "ingreso",
      documentTitle: mov.tipo === "egreso" ? "Comprobante de Egreso" : "Recibo de Caja",
      medio: mov.metodoPago || "Efectivo",
      concepto: mov.concepto || mov.descripcion || (mov.tipo === "egreso" ? "Egreso de Caja" : "Recibo de Caja"),
      notas: mov.descripcion || mov.concepto || "Sin observaciones adicionales",
      fecha: mov.fecha,
      nroConsecutivo: consecutiveNumber,
      registradoPor: nombreElaborador,
      planTitle: mov.planTitle || "Tratamiento Odontológico",
    };

    const clinicData = {
      inquilino: userProfile?.inquilino || caja?.inquilino || "",
      logo: clinicLogo,
      nombreComercial: sucursalNombre,
      nit: clinicNit,
      direccion: clinicAddress,
      telefono: clinicPhone,
      email: clinicEmail,
    };

    try {
      await ReceiptPrintService.generatePDF(pagoData, patientData, clinicData, userProfile);
    } catch (err) {
      console.error("Error al generar el recibo PDF:", err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100 p-6 space-y-6">

      {/* Header & Breadcrumb */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[12px] text-slate-400 mb-1">
            <button onClick={onBack} className="hover:text-blue-600 flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 text-slate-400">
              🏠 <span>Caja</span>
            </button>
            <span className="text-slate-300">&rsaquo;</span>
            <span className="text-slate-600 font-medium">Detalle de caja</span>
          </div>
          <h1 className="text-[22px] font-bold text-slate-800">Detalle de caja</h1>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-md text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer bg-white shadow-sm"
        >
          <FiArrowLeft size={15} /> Volver
        </button>
      </div>

      {/* Card Resumen General ("Hojita") */}
      <div className="bg-white rounded-md border border-slate-200 p-8 shadow-sm max-w-5xl mx-auto">
        
        {/* Encabezado Usuario / Sucursal */}
        <div className="flex items-center gap-8 pb-6 border-b border-slate-100 text-[13px]">
          <div>
            <span className="text-slate-400 font-medium block text-[12px] mb-0.5">Usuario</span>
            <span className="font-bold text-slate-800 uppercase tracking-wide">
              {caja.usuarioNombre || caja.nombre || "—"}
            </span>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div>
            <span className="text-slate-400 font-medium block text-[12px] mb-0.5">Sucursal</span>
            <span className="font-bold text-slate-800 uppercase tracking-wide">{sucursalNombre}</span>
          </div>
        </div>

        {/* Cifras Principales */}
        <div className="py-6 space-y-2.5 text-[13px] max-w-xl">
          <div className="flex justify-between py-1 border-b border-slate-50">
            <span className="text-slate-500 font-medium">Fecha de Apertura</span>
            <span className="text-slate-700 font-semibold">{fmtDate(caja.fechaApertura)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-50">
            <span className="text-slate-500 font-medium">Base</span>
            <span className="text-slate-700 font-semibold">$0</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-50">
            <span className="text-slate-500 font-medium">Ajuste base</span>
            <span className="text-slate-700 font-semibold">{fmt(caja.baseInicial || 0)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-50">
            <span className="text-slate-500 font-medium">Total Saldo Inicial</span>
            <span className="text-slate-700 font-semibold">{fmt(caja.baseInicial || 0)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-50">
            <span className="text-slate-500 font-medium">Recaudos</span>
            <span className="text-emerald-600 font-semibold">{fmt(totalIngresos)}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-slate-50">
            <span className="text-slate-500 font-medium">Gastos</span>
            <span className="text-rose-600 font-semibold">{fmt(totalEgresos)}</span>
          </div>
          <div className="flex justify-between py-2 border-t-2 border-slate-200 mt-3 pt-3">
            <span className="text-slate-800 font-bold">Total caja</span>
            <span className="text-slate-900 font-extrabold text-[15px]">{fmt(totalCaja)}</span>
          </div>
        </div>

        {/* Resumen por Medio de Pago */}
        <div className="pt-6 border-t border-slate-100">
          <div className="max-w-xl">
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2.5 px-3 text-left font-bold text-slate-500 text-[12px]">Medio de pago</th>
                  <th className="py-2.5 px-3 text-center font-bold text-slate-500 text-[12px]">Cantidad</th>
                  <th className="py-2.5 px-3 text-right font-bold text-slate-500 text-[12px]">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resumenMediosPago.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-3 text-center text-slate-400 text-[12px]">Sin registros de pago</td>
                  </tr>
                ) : (
                  resumenMediosPago.map((item) => (
                    <tr key={item.metodo} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-medium text-slate-700">{item.metodo}</td>
                      <td className="py-2.5 px-3 text-center text-slate-600">{item.cantidad}</td>
                      <td className={`py-2.5 px-3 text-right font-semibold ${item.valor < 0 ? "text-rose-600" : "text-slate-800"}`}>
                        {fmt(item.valor)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Card Movimientos ("Hojita") */}
      <div className="bg-white rounded-md border border-slate-200 shadow-sm p-6 max-w-5xl mx-auto space-y-4">
        
        {/* Header Movimientos */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <h2 className="text-[16px] font-bold text-slate-800">Movimientos</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input
                type="text"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 pr-3 rounded border border-slate-200 text-[12px] outline-none w-[180px] bg-white text-slate-700 focus:border-blue-400 transition-all placeholder:text-slate-400"
              />
            </div>
            <button
              onClick={handleExportMovimientos}
              title="Exportar movimientos a Excel"
              className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 bg-white transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <FiFileText size={15} />
            </button>
          </div>
        </div>

        {/* Tabla Movimientos */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-[13px]">Cargando movimientos...</p>
            </div>
          ) : movsFiltrados.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-[13px]">
              No hay movimientos registrados en esta caja.
            </div>
          ) : (
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-white">
                  {[
                    { label: "Fecha", w: 140 },
                    { label: "Nombre Tercero/Banco", w: "auto" },
                    { label: "Documento", w: 120 },
                    { label: "Valor", w: 110 },
                    { label: "Medio de pago", w: 120 },
                    { label: "Saldo actual", w: 110 },
                    { label: "Sucursal", w: 150 },
                    { label: "Acciones", w: 80 },
                  ].map((h) => (
                    <th key={h.label} style={{ width: h.w }} className="px-3 py-2.5 text-left font-bold text-slate-500 text-[11px] bg-white">
                      <div>{h.label}</div>
                      {h.label !== "Acciones" && (
                        <div className="mt-0.5">
                          <FiSearch size={10} className="text-slate-300" />
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movsFiltrados.map((m) => {
                  const esEgreso = m.tipo === "egreso";
                  const valorFormateado = esEgreso ? `-${fmt(m.monto || 0)}` : fmt(m.monto || 0);
                  const tercero = m.pacienteNombre || m.tercero || m.usuarioNombre || "—";
                  const docText = m.concepto || (esEgreso ? "Egreso" : "Recibo de caja");

                  return (
                    <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{fmtDate(m.fecha)}</td>
                      <td className="px-3 py-3 font-medium text-slate-800">{tercero}</td>
                      <td className="px-3 py-3 text-slate-600">{docText}</td>
                      <td className={`px-3 py-3 font-semibold ${esEgreso ? "text-rose-600" : "text-emerald-600"}`}>
                        {valorFormateado}
                      </td>
                      <td className="px-3 py-3 text-slate-600">{m.metodoPago || "Efectivo"}</td>
                      <td className="px-3 py-3 text-slate-700 font-medium">{fmt(balanceMap[m.id] ?? totalCaja)}</td>
                      <td className="px-3 py-3 text-slate-500 uppercase">{sucursalNombre}</td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => setSelectedMovimiento(m)}
                          title="Ver recibo / comprobante"
                          className="w-7 h-7 rounded flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white transition-colors cursor-pointer border-0"
                        >
                          <FiEye size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal Vista Previa del Comprobante Oficial */}
      {selectedMovimiento && (() => {
        let previewConsecutive = selectedMovimiento.nroConsecutivo || selectedMovimiento.nro_consecutivo || "";
        if (!previewConsecutive && selectedMovimiento.concepto) {
          const match = selectedMovimiento.concepto.match(/\[(EGR-\d+|RC-\d+)\]/i);
          if (match && match[1]) previewConsecutive = match[1];
        }
        if (!previewConsecutive && selectedMovimiento.id) {
          previewConsecutive = `#${selectedMovimiento.id.slice(0, 6).toUpperCase()}`;
        }

        const nombreElaborador = (userProfile?.nombreCompleto && !userProfile.nombreCompleto.includes("@")) 
          ? userProfile.nombreCompleto 
          : (userProfile?.nombre && !userProfile.nombre.includes("@"))
          ? userProfile.nombre
          : (caja.usuarioNombre && !caja.usuarioNombre.includes("@"))
          ? caja.usuarioNombre
          : "Guillermo Rodríguez";

        const esEgresoModal = selectedMovimiento.tipo === "egreso";

        return (
          <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-[700px] rounded-lg shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
              
              {/* Header modal */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <span className="text-[13px] font-bold text-slate-700">Comprobante de Movimiento</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePrintMovimiento(selectedMovimiento)}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded text-[12px] font-medium flex items-center gap-1.5 hover:bg-blue-700 transition-colors border-0 cursor-pointer shadow-sm"
                  >
                    <FiPrinter size={14} /> Imprimir PDF Oficial
                  </button>
                  <button
                    onClick={() => setSelectedMovimiento(null)}
                    className="w-8 h-8 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors border-0 cursor-pointer"
                  >
                    <FiX size={18} />
                  </button>
                </div>
              </div>

              {/* Document Body (Vista previa) */}
              <div className="p-8 overflow-y-auto space-y-6 text-[12px] text-slate-700 bg-white">
                
                {/* Header Comprobante */}
                <div className="flex justify-between items-start pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-4">
                    {clinicLogo && (
                      <img src={clinicLogo} alt="Logo" className="max-h-14 max-w-32 object-contain" />
                    )}
                    <div>
                      <h2 className="text-[15px] font-bold text-slate-900 uppercase">{sucursalNombre}</h2>
                      <p className="text-slate-500">NIT: {clinicNit}</p>
                      <p className="text-slate-500">{clinicAddress}</p>
                      <p className="text-slate-500">{clinicEmail}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[14px] font-bold uppercase block ${esEgresoModal ? "text-rose-600" : "text-blue-600"}`}>
                      {esEgresoModal ? "Comprobante de Egreso" : "Recibo de Caja"}
                    </span>
                    <span className="text-slate-700 font-bold font-mono">No. {previewConsecutive}</span>
                  </div>
                </div>

                {/* Grid Metadata */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded border border-slate-100 text-[12px]">
                  <div>
                    <span className="font-bold text-slate-500 block uppercase text-[10px]">
                      {esEgresoModal ? "Beneficiario / Proveedor:" : "Señor(a) Paciente:"}
                    </span>
                    <span className="font-semibold text-slate-800">{selectedMovimiento.pacienteNombre || selectedMovimiento.tercero || selectedMovimiento.usuarioNombre || "—"}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 block uppercase text-[10px]">Fecha de Expedición:</span>
                    <span className="font-semibold text-slate-800">{fmtDate(selectedMovimiento.fecha)}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 block uppercase text-[10px]">Elaborado Por:</span>
                    <span className="font-semibold text-slate-800">{nombreElaborador}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 block uppercase text-[10px]">Medio de Pago:</span>
                    <span className="font-semibold text-slate-800">{selectedMovimiento.metodoPago || "Efectivo"}</span>
                  </div>
                </div>

                {/* Detalle Concepto */}
                <table className="w-full text-[12px] border-collapse border border-slate-200">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="p-2 text-left font-bold text-slate-600">Concepto</th>
                      <th className="p-2 text-center font-bold text-slate-600">Cantidad</th>
                      <th className="p-2 text-right font-bold text-slate-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-2 text-slate-800">{selectedMovimiento.concepto || selectedMovimiento.descripcion || "Movimiento de caja"}</td>
                      <td className="p-2 text-center text-slate-600">1</td>
                      <td className="p-2 text-right font-semibold text-slate-800">{fmt(selectedMovimiento.monto)}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Totales */}
                <div className="flex justify-end pt-2">
                  <div className="w-48 space-y-1 text-right">
                    <div className="flex justify-between text-slate-500">
                      <span>Subtotal:</span>
                      <span>{fmt(selectedMovimiento.monto)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 text-[13px] pt-1 border-t border-slate-200">
                      <span>Total:</span>
                      <span>{fmt(selectedMovimiento.monto)}</span>
                    </div>
                  </div>
                </div>

                {/* Firmas */}
                <div className="grid grid-cols-2 gap-8 pt-12 text-center text-[11px] text-slate-500">
                  <div className="border-t border-slate-300 pt-2 font-medium">ELABORADO POR</div>
                  <div className="border-t border-slate-300 pt-2 font-medium">{esEgresoModal ? "RECIBIDO / BENEFICIARIO" : "ACEPTADA, FIRMA Y/O SELLO Y FECHA"}</div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
