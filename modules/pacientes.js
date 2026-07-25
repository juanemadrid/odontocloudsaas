// modules/pacientes.js
export async function initPacientes(db, auth) {
  const tablaPacientes = document.getElementById("tablaPacientes");
  const resultCount = document.getElementById("resultCount");
  const btnNuevoPaciente = document.getElementById("btnNuevoPaciente");
  const modalPaciente = document.getElementById("modalPaciente");
  const btnCerrarModal = document.getElementById("btnCerrarModal");
  const formPaciente = document.getElementById("formPaciente");
  const btnInactivos = document.getElementById("btnInactivos");
  const buscarPaciente = document.getElementById("buscarPaciente");
  const btnBuscar = document.getElementById("btnBuscar");
  const inputFoto = document.getElementById("inputFoto");
  const fotoPreview = document.getElementById("fotoPreview");

  let mostrandoInactivos = false;
  let pacientesData = [];

  // ===============================
  // 🔹 Función cargar pacientes
  // ===============================
  async function cargarPacientes() {
    const pacientesRef = collection(db, "pacientes");
    const q = pacientesRef; // Podrías agregar filtros si quieres
    const snapshot = await getDocs(pacientesRef);
    pacientesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    renderTabla();
  }

  // ===============================
  // 🔹 Renderizar tabla
  // ===============================
  function renderTabla() {
    tablaPacientes.innerHTML = "";
    const filtrados = pacientesData.filter(p => p.activo !== false); // activos por defecto
    const lista = mostrandoInactivos
      ? pacientesData.filter(p => p.activo === false)
      : filtrados;

    if (lista.length === 0) {
      tablaPacientes.innerHTML = `<tr class="sin-datos"><td colspan="6">Sin datos</td></tr>`;
      resultCount.textContent = 0;
      return;
    }

    lista.forEach(p => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${p.nombres} ${p.apellidos}</td>
        <td>${p.nroDocumento || ""}</td>
        <td>${p.fechaIngreso || ""}</td>
        <td style="text-align:center">
          <button class="btn-ver" data-id="${p.id}">Ver</button>
          <button class="btn-toggle-activo" data-id="${p.id}">
            ${p.activo === false ? "Activar" : "Inactivar"}
          </button>
        </td>
      `;
      tablaPacientes.appendChild(tr);
    });

    resultCount.textContent = lista.length;
    attachRowButtons();
  }

  // ===============================
  // 🔹 Botones de fila
  // ===============================
  function attachRowButtons() {
    document.querySelectorAll(".btn-toggle-activo").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const pacienteRef = doc(db, "pacientes", id);
        const paciente = pacientesData.find(p => p.id === id);
        await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js").then(async fire => {
          await fire.updateDoc(pacienteRef, { activo: paciente.activo === false ? true : false });
        });
        await cargarPacientes();
      });
    });
  }

  // ===============================
  // 🔹 Botón Nuevo Paciente
  // ===============================
  btnNuevoPaciente.addEventListener("click", () => {
    formPaciente.reset();
    fotoPreview.style.display = "none";
    modalPaciente.style.display = "block";
  });

  btnCerrarModal.addEventListener("click", () => {
    modalPaciente.style.display = "none";
  });

  // ===============================
  // 🔹 Guardar paciente
  // ===============================
  formPaciente.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = {
      tipoDocumento: document.getElementById("tipoDocumento").value,
      nroDocumento: document.getElementById("nroDocumento").value,
      nombres: document.getElementById("nombres").value,
      apellidos: document.getElementById("apellidos").value,
      fechaIngreso: document.getElementById("fechaIngreso").value,
      activo: true,
      // agregar más campos aquí según tu formulario
    };

    const pacientesRef = collection(db, "pacientes");
    await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js").then(async fire => {
      if (document.getElementById("pacienteId").value) {
        const pacienteRef = doc(db, "pacientes", document.getElementById("pacienteId").value);
        await fire.updateDoc(pacienteRef, data);
      } else {
        await fire.addDoc(pacientesRef, data);
      }
    });

    modalPaciente.style.display = "none";
    await cargarPacientes();
  });

  // ===============================
  // 🔹 Mostrar inactivos
  // ===============================
  btnInactivos.addEventListener("click", () => {
    mostrandoInactivos = !mostrandoInactivos;
    btnInactivos.textContent = mostrandoInactivos ? "Activos" : "Inactivos";
    renderTabla();
  });

  // ===============================
  // 🔹 Vista previa foto
  // ===============================
  inputFoto.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        fotoPreview.src = ev.target.result;
        fotoPreview.style.display = "block";
      };
      reader.readAsDataURL(file);
    }
  });

  // ===============================
  // 🔹 Buscar paciente
  // ===============================
  btnBuscar.addEventListener("click", () => {
    const term = buscarPaciente.value.toLowerCase();
    pacientesData = pacientesData.filter(p => 
      p.nombres.toLowerCase().includes(term) ||
      p.apellidos.toLowerCase().includes(term) ||
      (p.nroDocumento || "").toLowerCase().includes(term)
    );
    renderTabla();
  });

  // ===============================
  // 🔹 Cargar al inicio
  // ===============================
  await cargarPacientes();
}
