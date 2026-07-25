// modules/agenda.js
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  doc,
  setDoc,
  getDoc,
  arrayUnion,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { crearCita } from "./citas.js";


window.initAgendaCalendar = (db, auth) => {
  // ------------------------------
  // DOM ELEMENTS
  // ------------------------------
  const miniCalendarEl = document.getElementById("miniCalendar");
  const miniCalMonthYear = document.getElementById("miniCalMonthYear");
  const miniPrev = document.getElementById("miniCalPrev");
  const miniNext = document.getElementById("miniCalNext");
  const filterSucursal = document.getElementById("filterSucursal");
  const filterDoctor = document.getElementById("filterDoctor");
  const currentDateDisplay = document.getElementById("currentDateDisplay");
  const btnPrev = document.getElementById("btnPrev");
  const btnNext = document.getElementById("btnNext");
  const btnHoy = document.getElementById("btnHoy");
  const btnNuevaCita = document.getElementById("btnNuevaCita");
  const btnPrint = document.getElementById("btnPrint");
  const btnConfirmar = document.getElementById("btnConfirmar");
  const btnHoyCitas = document.getElementById("btnHoyCitas");
  const btnExportar = document.getElementById("btnExportar");
  const searchCitas = document.getElementById("searchCitas");
  const citasTbody = document.getElementById("citasTbody");
  const ocupacionInfo = document.getElementById("ocupacionInfo");

  // ------------------------------
  // STATE
  // ------------------------------
  let selectedDate = new Date();
  let miniCurrent = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  let searchTerm = "";
  const SLOTS_PER_DAY = 18;

  // ------------------------------
  // HELPERS
  // ------------------------------
  const formatDisplayDate = (d) =>
    d.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });

  const toIsoDate = (dateObj) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  // ------------------------------
  // DATE DISPLAY
  // ------------------------------
  function updateCurrentDateDisplay() {
    if (currentDateDisplay)
      currentDateDisplay.textContent = formatDisplayDate(selectedDate);
  }

  // ------------------------------
  // MINI CALENDAR RENDER
  // ------------------------------
  function renderMiniCalendar(dateObj) {
    if (!miniCalendarEl) return;
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();
    miniCalMonthYear.textContent = dateObj.toLocaleString("es-CO", {
      month: "long",
      year: "numeric"
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startIndex = (firstDay + 6) % 7;

    const cells = [];
    for (let i = 0; i < startIndex; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    let html = "";
    for (let r = 0; r < cells.length; r += 7) {
      html += "<tr>";
      for (let c = 0; c < 7; c++) {
        const val = cells[r + c];
        if (!val) {
          html += `<td class="empty"></td>`;
        } else {
          const dd = new Date(year, month, val);
          const classes = [];
          if (new Date().toDateString() === dd.toDateString()) classes.push("today");
          if (selectedDate.toDateString() === dd.toDateString())
            classes.push("selected");
          html += `<td data-day="${val}" data-month="${month}" data-year="${year}" class="${classes.join(" ")}">${val}</td>`;
        }
      }
      html += "</tr>";
    }

    miniCalendarEl.innerHTML = html;

    miniCalendarEl.querySelectorAll("td[data-day]").forEach((el) => {
      el.addEventListener("click", () => {
        const y = parseInt(el.dataset.year, 10);
        const m = parseInt(el.dataset.month, 10);
        const dd = parseInt(el.dataset.day, 10);
        selectedDate = new Date(y, m, dd);
        miniCurrent = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        renderMiniCalendar(miniCurrent);
        updateCurrentDateDisplay();
        loadCitas();
      });
    });
  }

  // ------------------------------
  // NAVIGATION
  // ------------------------------
  if (miniPrev)
    miniPrev.addEventListener("click", () => {
      miniCurrent.setMonth(miniCurrent.getMonth() - 1);
      renderMiniCalendar(miniCurrent);
    });

  if (miniNext)
    miniNext.addEventListener("click", () => {
      miniCurrent.setMonth(miniCurrent.getMonth() + 1);
      renderMiniCalendar(miniCurrent);
    });

  if (btnPrev)
    btnPrev.addEventListener("click", () => {
      selectedDate.setDate(selectedDate.getDate() - 1);
      miniCurrent = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      renderMiniCalendar(miniCurrent);
      updateCurrentDateDisplay();
      loadCitas();
    });

  if (btnNext)
    btnNext.addEventListener("click", () => {
      selectedDate.setDate(selectedDate.getDate() + 1);
      miniCurrent = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      renderMiniCalendar(miniCurrent);
      updateCurrentDateDisplay();
      loadCitas();
    });

  if (btnHoy)
    btnHoy.addEventListener("click", () => {
      selectedDate = new Date();
      miniCurrent = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      renderMiniCalendar(miniCurrent);
      updateCurrentDateDisplay();
      loadCitas();
    });

  // ------------------------------
  // FILTERS & SEARCH
  // ------------------------------
  if (searchCitas)
    searchCitas.addEventListener("input", (e) => {
      searchTerm = e.target.value.trim().toLowerCase();
      loadCitas();
    });

  if (filterSucursal) filterSucursal.addEventListener("change", loadCitas);
  if (filterDoctor) filterDoctor.addEventListener("change", loadCitas);

  async function loadFilters() {
    try {
      if (filterSucursal) {
        filterSucursal.innerHTML = `<option value="">— Todas —</option>`;
        const sucSnap = await getDocs(collection(db, "sucursales"));
        sucSnap.forEach((d) => {
          const val = d.data()?.nombre || d.id;
          const opt = document.createElement("option");
          opt.value = String(val);
          opt.textContent = String(val);
          filterSucursal.appendChild(opt);
        });
      }

      if (filterDoctor) {
        filterDoctor.innerHTML = `<option value="">— Todos —</option>`;
        const docSnap = await getDocs(collection(db, "doctores"));
        docSnap.forEach((d) => {
          const val = d.data()?.nombre || d.id;
          const opt = document.createElement("option");
          opt.value = String(val);
          opt.textContent = String(val);
          filterDoctor.appendChild(opt);
        });
      }
    } catch (err) {
      console.warn("No se pudieron cargar filtros:", err);
    }
  }

  // ------------------------------
  // LOAD CITAS
  // ------------------------------
  async function loadCitas() {
    if (!citasTbody) return;
    citasTbody.innerHTML = `<tr><td colspan="6" class="no-data">Cargando citas...</td></tr>`;

    try {
      const cRef = collection(db, "citas");
      const fechaStr = toIsoDate(selectedDate);
      const q = query(cRef, orderBy("fecha"), where("fecha", "==", fechaStr));
      const snap = await getDocs(q);

      if (snap.empty) {
        citasTbody.innerHTML = `<tr><td colspan="6" class="no-data">No hay citas registradas para esta fecha.</td></tr>`;
        updateOcupacion(0);
        return;
      }

      const sucFilter = (filterSucursal?.value || "").toLowerCase();
      const docFilter = (filterDoctor?.value || "").toLowerCase();
      const rows = [];

      snap.forEach((doc) => {
        const d = doc.data();
        let fechaCita = d.fecha;
        if (fechaCita?.toDate) fechaCita = fechaCita.toDate();
        const fechaCitaStr = fechaCita instanceof Date ? toIsoDate(fechaCita) : String(fechaCita);
        if (fechaCitaStr !== fechaStr) return;

        const hora = d.horaInicio || d.hora || "--";
        const paciente = d.paciente || d.nombrePaciente || "--";
        const doctor = d.doctor || d.nombreDoctor || "--";
        const espacio = d.espacio || d.sala || "--";
        const comentario = d.comentario || "-";
        const estado = d.estado || "Sin definir";
        const email = d.email || d.correo || "";
        const telefono = d.celular || "";

        if (sucFilter && String(d.sucursal || "").toLowerCase() !== sucFilter) return;
        if (docFilter && String(doctor || "").toLowerCase() !== docFilter) return;

        const hay = [hora, paciente, doctor, espacio, comentario, estado].join(" ").toLowerCase();
        if (searchTerm && !hay.includes(searchTerm)) return;

        rows.push({ hora, paciente, doctor, espacio, comentario, estado, email, telefono });
      });

      if (!rows.length) {
        citasTbody.innerHTML = `<tr><td colspan="6" class="no-data">No hay coincidencias con los filtros.</td></tr>`;
        updateOcupacion(0);
        return;
      }

      let html = "";
      for (const r of rows) {
        const dataEmailAttr = r.email ? `data-email="${escapeHtml(r.email)}"` : "";
        html += `
          <tr class="fade-in-row" ${dataEmailAttr}>
            <td>${escapeHtml(r.hora)}</td>
            <td>${escapeHtml(r.paciente)}</td>
            <td>${escapeHtml(r.doctor)}</td>
            <td>${escapeHtml(r.espacio)}</td>
            <td>${escapeHtml(r.comentario)}</td>
            <td>
              <select class="estado-select" style="width:100%;padding:2px 4px;">
                <option value="En espera" ${r.estado === "En espera" ? "selected" : ""}>En espera</option>
                <option value="En sala" ${r.estado === "En sala" ? "selected" : ""}>En sala</option>
                <option value="Atendiendo" ${r.estado === "Atendiendo" ? "selected" : ""}>Atendiendo</option>
                <option value="Finalizada" ${r.estado === "Finalizada" ? "selected" : ""}>Finalizada</option>
              </select>
            </td>
            <td>
              <button class="btn-whatsapp" data-cel="${r.telefono}" style="padding:4px 6px;font-size:13px;cursor:pointer;">📲 WhatsApp</button>
            </td>
          </tr>`;
      }

      citasTbody.innerHTML = html;
      updateOcupacion(rows.length);

      citasTbody.addEventListener("click", (e) => {
        if (e.target.classList.contains("btn-whatsapp")) {
          const btn = e.target;
          const numero = btn.dataset.cel;
          if (!numero) {
            alert("No hay número de celular registrado para este paciente.");
            return;
          }
          const mensaje = encodeURIComponent(
            "Hola, este es un recordatorio de su cita programada. Por favor, acérquese a nuestra sede según lo indicado. Gracias."
          );
          const url = `https://wa.me/${numero.replace(/\D/g, "")}?text=${mensaje}`;
          window.open(url, "_blank");
        }
      });
    } catch (err) {
      console.error("Error al cargar citas:", err);
      citasTbody.innerHTML =
        `<tr><td colspan="6" style="color:crimson;padding:12px">Error al cargar citas</td></tr>`;
      updateOcupacion(0);
    }
  }

  // ------------------------------
  // ACTUALIZAR OCUPACIÓN
  // ------------------------------
  function updateOcupacion(bookedCount) {
    if (!ocupacionInfo) return;
    const percent = Math.round((bookedCount / SLOTS_PER_DAY) * 100);
    ocupacionInfo.textContent = `Ocupación: ${bookedCount} / ${SLOTS_PER_DAY} (${isNaN(percent) ? 0 : percent}%)`;
  }

  // ------------------------------
  // IMPRIMIR, EXPORTAR, CONFIRMAR, HOY
  // ------------------------------
  function printAgenda() {
    const fecha = formatDisplayDate(selectedDate);
    const tableHtml = document.querySelector(".appointments-table")?.outerHTML || "<p>No hay citas registradas.</p>";

    const style = `
      <style>
        body { font-family: Inter, Arial, sans-serif; color: #222; padding: 30px; background: white; }
        h1 { font-size: 20px; margin-bottom: 16px; color: #0a86d8; text-align: center; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th, td { padding: 8px 10px; border: 1px solid #ddd; }
        th { background: #f6f9fc; color: #333; text-align: left; }
        tr:nth-child(even) { background: #fafafa; }
        @media print { button, input, select { display: none !important; } }
      </style>`;

    const content = `
      <html>
        <head><meta charset="utf-8">${style}</head>
        <body>
          <h1>Agenda del día - ${fecha}</h1>
          ${tableHtml}
        </body>
      </html>`;

    const w = window.open("", "_blank", "width=1000,height=800");
    if (!w) {
      alert("El navegador bloqueó la ventana de impresión.");
      return;
    }
    w.document.open();
    w.document.write(content);
    w.document.close();
    setTimeout(() => {
      w.focus();
      w.print();
    }, 350);
  }

  function exportCitasCSV() {
    const filas = document.querySelectorAll("#citasTbody tr");
    const cabecera = ["Hora", "Paciente", "Doctor", "Espacio físico", "Comentario", "Estado"];
    const filasCSV = [cabecera.join(",")];

    if (!filas.length || (filas.length === 1 && filas[0].querySelector(".no-data"))) {
      const blob = new Blob([filasCSV.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `agenda_${toIsoDate(selectedDate)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    filas.forEach((fila) => {
      if (fila.querySelector(".no-data")) return;
      const cols = Array.from(fila.querySelectorAll("td")).map((td) => {
        const text = td.textContent.trim().replace(/"/g, '""');
        return `"${text}"`;
      });
      filasCSV.push(cols.join(","));
    });

    const blob = new Blob([filasCSV.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agenda_${toIsoDate(selectedDate)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openConfirmModal() {
    const filas = Array.from(document.querySelectorAll("#citasTbody tr")).filter(
      (r) => !r.querySelector(".no-data")
    );
    if (!filas.length) {
      alert("No hay citas para confirmar.");
      return;
    }

    const modal = document.createElement("div");
    Object.assign(modal.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "100%",
      height: "100%",
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "9999"
    });

    const box = document.createElement("div");
    Object.assign(box.style, {
      background: "#fff",
      padding: "18px",
      borderRadius: "8px",
      width: "420px",
      maxHeight: "80vh",
      overflow: "auto",
      boxShadow: "0 8px 24px rgba(0,0,0,0.2)"
    });

    const title = document.createElement("h3");
    title.textContent = `Confirmar asistencia - ${formatDisplayDate(selectedDate)}`;
    box.appendChild(title);

    const list = document.createElement("div");
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "8px";

    filas.forEach((fila) => {
      const nombre = fila.children[1]?.textContent?.trim() || "";
      if (!nombre) return;
      const item = document.createElement("label");
      item.style.display = "flex";
      item.style.alignItems = "center";
      item.style.gap = "8px";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.dataset.nombre = nombre;
      const span = document.createElement("span");
      span.textContent = nombre;
      item.appendChild(input);
      item.appendChild(span);
      list.appendChild(item);
    });

    box.appendChild(list);

    const btnCerrar = document.createElement("button");
    btnCerrar.textContent = "Cerrar";
    btnCerrar.style.marginTop = "12px";
    btnCerrar.addEventListener("click", () => modal.remove());
    box.appendChild(btnCerrar);

    modal.appendChild(box);
    document.body.appendChild(modal);
  }

  if (btnPrint) btnPrint.addEventListener("click", printAgenda);
  if (btnExportar) btnExportar.addEventListener("click", exportCitasCSV);
  if (btnConfirmar) btnConfirmar.addEventListener("click", openConfirmModal);
  if (btnHoyCitas) btnHoyCitas.addEventListener("click", () => {
    selectedDate = new Date();
    miniCurrent = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    renderMiniCalendar(miniCurrent);
    updateCurrentDateDisplay();
    loadCitas();
  });

 // --- NUEVA CITA (con búsqueda o registro de paciente nuevo) ---
// ===============================================
// MODAL PROFESIONAL "NUEVA CITA"
// ===============================================
if (btnNuevaCita) btnNuevaCita.addEventListener("click", () => {
  // Crear modal de fondo
  const modal = document.createElement("div");
  Object.assign(modal.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: "9999",
  });

  // Caja del formulario
  const box = document.createElement("div");
  Object.assign(box.style, {
    background: "#fff",
    padding: "25px 30px",
    borderRadius: "14px",
    width: "520px",
    maxWidth: "95%",
    maxHeight: "95%",
    overflowY: "auto",
    boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
    fontFamily: "Segoe UI, Roboto, sans-serif",
  });

  // Contenido HTML del modal
  box.innerHTML = `
    <h2 style="margin-top:0;text-align:center;color:#0a86d8;font-weight:600;">🗓️ Nueva Cita</h2>
    <form id="formNuevaCita" style="display:flex;flex-direction:column;gap:12px;margin-top:10px;">
      <label style="font-weight:600;">Paciente existente</label>
      <input type="text" id="buscarPaciente" placeholder="Buscar por nombre, apellido o documento..." />
      <small style="color:gray;">Si el paciente no existe, marca “Nuevo paciente” para registrarlo.</small>

      <label style="display:flex;align-items:center;gap:8px;margin-top:5px;">
        <input type="checkbox" id="esNuevoPaciente" />
        <span>Registrar nuevo paciente</span>
      </label>

      <div id="nuevoPacienteCampos" style="display:none;flex-direction:column;gap:8px;margin-top:10px;padding:10px;border-radius:8px;background:#f9f9f9;border:1px solid #ddd;">
        <h4 style="margin:0;text-align:center;color:#0a86d8;">Datos del paciente</h4>
        <div style="display:flex;gap:8px;">
          <input type="text" id="npNombre" placeholder="Nombre" style="flex:1;" />
          <input type="text" id="npApellido" placeholder="Apellido" style="flex:1;" />
        </div>
        <select id="npTipoDocumento">
          <option value="">Tipo de documento</option>
          <option value="CC">Cédula de Ciudadanía</option>
          <option value="CE">Cédula de Extranjería</option>
          <option value="TI">Tarjeta de Identidad</option>
          <option value="PA">Pasaporte</option>
          <option value="DI">Documento Internacional</option>
          <option value="OTRO">Otro</option>
        </select>
        <input type="text" id="npDocumento" placeholder="Número de documento" />
        <input type="email" id="npCorreo" placeholder="Correo electrónico" />
        <div style="display:flex;gap:5px;">
          <select id="npIndicativo" style="width:40%;">
            <option value="+57">🇨🇴 +57</option>
            <option value="+1">🇺🇸 +1</option>
            <option value="+34">🇪🇸 +34</option>
            <option value="+52">🇲🇽 +52</option>
            <option value="+54">🇦🇷 +54</option>
            <option value="+593">🇪🇨 +593</option>
            <option value="+56">🇨🇱 +56</option>
            <option value="+58">🇻🇪 +58</option>
          </select>
          <input type="tel" id="npCelular" placeholder="Celular" style="flex:1;" />
        </div>
        <input type="tel" id="npTelefono" placeholder="Teléfono fijo (opcional)" />
        <label style="font-weight:500;">Fecha de nacimiento:</label>
        <input type="date" id="npNacimiento" />
        <select id="npSexo">
          <option value="">Sexo</option>
          <option value="Masculino">Masculino</option>
          <option value="Femenino">Femenino</option>
          <option value="Otro">Otro</option>
        </select>
        <textarea id="npComentario" placeholder="Comentario o antecedentes del paciente" rows="2"></textarea>
      </div>

      <hr style="margin:10px 0;border:none;border-top:1px solid #ddd;" />
      <h4 style="margin:0;text-align:center;color:#0a86d8;">Detalles de la cita</h4>
      <input type="text" id="ncDoctor" placeholder="Doctor asignado" required />
      <input type="date" id="ncFecha" required value="${toIsoDate(selectedDate)}" />
      <input type="time" id="ncHora" required />
      <input type="text" id="ncEspacio" placeholder="Espacio físico / Sala" />
      <textarea id="ncComentario" placeholder="Comentario sobre la cita" rows="3"></textarea>

      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:10px;">
        <button type="button" id="btnCancelarModal" class="btn-cancelar">Cancelar</button>
        <button type="submit" class="btn-guardar">Guardar</button>
      </div>
    </form>
  `;

  // Estilos para botones e inputs
  const style = document.createElement("style");
  style.textContent = `
    .btn-cancelar, .btn-guardar {
      padding: 8px 14px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
      transition: 0.2s;
    }
    .btn-cancelar { background: #e0e0e0; color: #333; }
    .btn-cancelar:hover { background: #d5d5d5; }
    .btn-guardar { background: #0a86d8; color: white; }
    .btn-guardar:hover { background: #0669ac; }
    input, select, textarea {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid #ccc;
      border-radius: 6px;
      font-size: 14px;
      outline: none;
    }
    input:focus, select:focus, textarea:focus {
      border-color: #0a86d8;
      box-shadow: 0 0 0 2px rgba(10,134,216,0.2);
    }
  `;
  document.head.appendChild(style);

  modal.appendChild(box);
  document.body.appendChild(modal);

  const chkNuevo = box.querySelector("#esNuevoPaciente");
  const camposNuevo = box.querySelector("#nuevoPacienteCampos");
  chkNuevo.addEventListener("change", () => {
    camposNuevo.style.display = chkNuevo.checked ? "flex" : "none";
  });

  box.querySelector("#btnCancelarModal").addEventListener("click", () => modal.remove());

  // 💾 Guardar cita (versión corregida con búsqueda mejorada y vínculo paciente ↔ cita)
const form = box.querySelector("#formNuevaCita");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const esNuevo = chkNuevo.checked;
  const nombrePaciente = esNuevo
    ? `${form.querySelector("#npNombre").value.trim()} ${form.querySelector("#npApellido").value.trim()}`.trim()
    : form.querySelector("#buscarPaciente").value.trim();

  if (!nombrePaciente) {
    alert("⚠️ Por favor, ingresa o selecciona un paciente.");
    return;
  }

  try {
    let pacienteId = null;
    let pacienteRef = null;

    // 🔹 Si es paciente nuevo
    if (esNuevo) {
      const docPaciente = form.querySelector("#npDocumento").value.trim();
      pacienteId = docPaciente || nombrePaciente.toLowerCase().replace(/\s+/g, "_");
      pacienteRef = doc(db, "pacientes", pacienteId);

      const pacienteSnap = await getDoc(pacienteRef);
      if (!pacienteSnap.exists()) {
        const pacienteData = {
          nombre: form.querySelector("#npNombre").value.trim(),
          apellido: form.querySelector("#npApellido").value.trim(),
          tipoDocumento: form.querySelector("#npTipoDocumento").value,
          documento: docPaciente,
          correo: form.querySelector("#npCorreo").value.trim(),
          indicativo: form.querySelector("#npIndicativo").value,
          celular: form.querySelector("#npCelular").value.trim(),
          telefono: form.querySelector("#npTelefono").value.trim(),
          nacimiento: form.querySelector("#npNacimiento").value,
          sexo: form.querySelector("#npSexo").value,
          comentario: form.querySelector("#npComentario").value.trim(),
          creado: new Date().toISOString(),
          activo: true,
          citas: []
        };
        await setDoc(pacienteRef, pacienteData);
      }
    } else {
      // 🔹 Buscar paciente existente por nombre o documento
      const nombreBuscar = nombrePaciente.toLowerCase();
      const docBuscar = form.querySelector("#buscarPaciente").value.trim();

      const q1 = query(collection(db, "pacientes"), where("nombre", "==", nombreBuscar));
      const q2 = query(collection(db, "pacientes"), where("documento", "==", docBuscar));

      const [snapNombre, snapDoc] = await Promise.all([getDocs(q1), getDocs(q2)]);
      const snap = !snapDoc.empty ? snapDoc : snapNombre;

      if (!snap.empty) {
        pacienteRef = snap.docs[0].ref;
        pacienteId = snap.docs[0].id;
      } else {
        console.warn("⚠️ No se encontró el paciente, se guardará la cita sin ID asociado.");
      }
    }

    // 🔹 Crear cita con vínculo al paciente
    const fechaSeleccionada = form.querySelector("#ncFecha").value;
    const horaSeleccionada = form.querySelector("#ncHora").value;

    if (!fechaSeleccionada || !horaSeleccionada) {
      alert("⚠️ Debes seleccionar fecha y hora para la cita.");
      return;
    }

    const nuevaCita = {
      paciente: nombrePaciente,
      pacienteId: pacienteId || null,
      doctor: form.querySelector("#ncDoctor").value.trim(),
      fecha: fechaSeleccionada,
      horaInicio: horaSeleccionada,
      espacio: form.querySelector("#ncEspacio").value.trim(),
      comentario: form.querySelector("#ncComentario").value.trim(),
      estado: "En espera",
      creado: new Date().toISOString(),
    };

    const citaRef = await addDoc(collection(db, "citas"), nuevaCita);

    // 🔹 Si hay paciente asociado, actualizar su registro con el ID de la cita
    if (pacienteRef) {
      await setDoc(
        pacienteRef,
        { citas: arrayUnion(citaRef.id) },
        { merge: true }
      );
    }

    alert("✅ Cita registrada correctamente y vinculada al paciente.");
    modal.remove();
    loadCitas(); // 🔁 Refresca las citas sin recargar la página

  } catch (err) {
    console.error("❌ Error al guardar cita:", err);
    alert("❌ Error al guardar la cita. Revisa la consola para más detalles.");
  }
}); // ← cierre del submit listener

}); // ← cierre del btnNuevaCita.addEventListener

// ------------------------------
// AUTH LISTENER
// ------------------------------
onAuthStateChanged(auth, (user) => {
  if (!user) return;
  renderMiniCalendar(miniCurrent);
  updateCurrentDateDisplay();
  loadFilters();
  loadCitas();
});

}; // ← cierre final de window.initAgendaCalendar
