/* Organizador Avanzado: script.js
   - LocalStorage
   - Editar, borrar, marcar completada
   - Buscar, ordenar, filtrar
   - Notificaciones programadas con sonido y recurrencia simple
   - Tema (dark/light) persistente
   - Reagenda notificaciones al cargar
   - PWA install prompt
*/

const LS_KEY = "organizador_avanzado_v1";
let actividades = JSON.parse(localStorage.getItem(LS_KEY)) || [];
const timeouts = new Map(); // id -> timeoutId
let deferredInstallPrompt = null;

// ELEMENTOS
const buscarInput = document.getElementById("buscar");
const ordenSelect = document.getElementById("orden");
const filtroSelect = document.getElementById("filtro");
const listaEl = document.getElementById("listaActividades");
const form = document.getElementById("formActividad");
const actividadInput = document.getElementById("actividad");
const fechaInput = document.getElementById("fecha");
const horaInput = document.getElementById("hora");
const categoriaSelect = document.getElementById("categoria");
const recurrenciaSelect = document.getElementById("recurrencia");
const notificarChk = document.getElementById("notificar");
const conSonidoChk = document.getElementById("conSonido");
const editingIdInput = document.getElementById("editingId");
const guardarBtn = document.getElementById("guardarBtn");
const cancelEditBtn = document.getElementById("cancelEdit");
const totalCount = document.getElementById("totalCount");
const pendientesCount = document.getElementById("pendientesCount");
const completadasCount = document.getElementById("completadasCount");
const toggleThemeBtn = document.getElementById("toggleTheme");
const installBtn = document.getElementById("installBtn");
const alarmaAudio = document.getElementById("alarmaAudio");

// Pedir permiso de notificaciones
if ("Notification" in window && Notification.permission !== "granted") {
  Notification.requestPermission();
}

// Theme
const currentTheme = localStorage.getItem("theme") || "light";
if (currentTheme === "dark") document.documentElement.setAttribute("data-theme", "dark");

// PWA install prompt
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  installBtn.classList.remove("hidden");
});
installBtn.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installBtn.classList.add("hidden");
});

toggleThemeBtn.addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next === "dark" ? "dark" : "");
  localStorage.setItem("theme", next);
});

// UTIL
function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(actividades));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}

function parseDateTime(fechaStr, horaStr){
  // fechaStr: yyyy-mm-dd, horaStr: HH:MM
  return new Date(`${fechaStr}T${horaStr}:00`);
}

function formatSmall(dt){
  const opt = { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' };
  return new Intl.DateTimeFormat('es-ES', opt).format(dt);
}

// CRUD & UI
function actualizarContadores(){
  totalCount.textContent = `Total: ${actividades.length}`;
  pendientesCount.textContent = `Pendientes: ${actividades.filter(a => !a.completada).length}`;
  completadasCount.textContent = `Completadas: ${actividades.filter(a => a.completada).length}`;
}

function render(){
  listaEl.innerHTML = "";
  let list = actividades.slice();

  // Buscar
  const q = buscarInput.value.trim().toLowerCase();
  if (q) list = list.filter(a => a.texto.toLowerCase().includes(q) || (a.categoria||"").toLowerCase().includes(q));

  // Filtrar
  const f = filtroSelect.value;
  if (f === "pendientes") list = list.filter(a=>!a.completada);
  if (f === "completadas") list = list.filter(a=>a.completada);

  // Orden
  const ord = ordenSelect.value;

if (ord === "proximo") {
  list.sort((x, y) => new Date(`${x.fecha}T${x.hora}`) - new Date(`${y.fecha}T${y.hora}`));
}

if (ord === "antiguo") {
  list.sort((x, y) => new Date(`${y.fecha}T${y.hora}`) - new Date(`${x.fecha}T${x.hora}`));
}

if (ord === "alfabetico") {
  list.sort((x, y) => x.texto.localeCompare(y.texto));
}

  // Render items
  list.forEach(item => {
    const li = document.createElement("li");
    li.className = "item" + (item.completada ? " completed" : "");
    li.dataset.id = item.id;

    const left = document.createElement("div");
    left.className = "left";
    left.innerHTML = `<strong>${escapeHTML(item.texto)}</strong>
      <div class="meta">${item.categoria} • ${item.fecha} ${item.hora} • ${item.recurrencia !== 'none' ? '🔁 ' + item.recurrencia : ''}</div>
      <div class="tags">${item.notificar ? '<span class="tag">🔔 Notificar</span>' : ''}</div>`;

    const actions = document.createElement("div");
    actions.className = "actions";
    const btnComplete = document.createElement("button");
    btnComplete.className = "btnsmall complete";
    btnComplete.textContent = item.completada ? "↩" : "✔";
    btnComplete.addEventListener("click", ()=> toggleComplete(item.id));

    const btnEdit = document.createElement("button");
    btnEdit.className = "btnsmall edit";
    btnEdit.textContent = "✏";
    btnEdit.addEventListener("click", ()=> startEdit(item.id));

    const btnDel = document.createElement("button");
    btnDel.className = "btnsmall del";
    btnDel.textContent = "🗑";
    btnDel.addEventListener("click", ()=> borrar(item.id));

    actions.append(btnComplete, btnEdit, btnDel);
    li.append(left, actions);
    listaEl.appendChild(li);
  });

  actualizarContadores();
}

function escapeHTML(s){
  return s.replace(/[&<>'"]/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

// CRUD Handlers
function startEdit(id){
  const a = actividades.find(x=>x.id===id);
  if(!a) return;
  editingIdInput.value = a.id;
  actividadInput.value = a.texto;
  fechaInput.value = a.fecha;
  horaInput.value = a.hora;
  categoriaSelect.value = a.categoria || "Personal";
  recurrenciaSelect.value = a.recurrencia || "none";
  notificarChk.checked = !!a.notificar;
  conSonidoChk.checked = !!a.conSonido;
  guardarBtn.textContent = "Guardar cambios";
  cancelEditBtn.classList.remove("hidden");
  window.scrollTo({top:0, behavior:'smooth'});
}

function cancelEdit(){
  editingIdInput.value = "";
  form.reset();
  guardarBtn.textContent = "Agregar";
  cancelEditBtn.classList.add("hidden");
}

function borrar(id){
  if(!confirm("¿Eliminar esta actividad?")) return;
  actividades = actividades.filter(a=>a.id!==id);
  save();
  clearSchedule(id);
  render();
}

function toggleComplete(id){
  const a = actividades.find(x=>x.id===id);
  if(!a) return;
  a.completada = !a.completada;
  save();
  render();
}

form.addEventListener("submit", (e)=>{
  e.preventDefault();
  const texto = actividadInput.value.trim();
  const fecha = fechaInput.value;
  const hora = horaInput.value;
  const categoria = categoriaSelect.value;
  const recurrencia = recurrenciaSelect.value;
  const notificar = notificarChk.checked;
  const conSonido = conSonidoChk.checked;

  if(!texto || !fecha || !hora){ alert("Completa todos los campos de fecha/hora/título"); return; }

  const editingId = editingIdInput.value;
  if(editingId){
    // editar
    const a = actividades.find(x=>x.id===editingId);
    if(!a) return;
    a.texto = texto; a.fecha = fecha; a.hora = hora; a.categoria = categoria;
    a.recurrencia = recurrencia; a.notificar = notificar; a.conSonido = conSonido;
    save();
    clearSchedule(editingId);
    if(notificar) scheduleNotification(a);
    cancelEdit();
    render();
    return;
  }

  // nuevo
  const nuevo = {
    id: uid(),
    texto, fecha, hora, categoria,
    recurrencia, notificar, conSonido,
    completada: false,
    createdAt: new Date().toISOString()
  };
  actividades.push(nuevo);
  save();
  render();
  if(notificar) scheduleNotification(nuevo);
  form.reset();
});

// Filtrado y orden en vivo
[buscarInput, ordenSelect, filtroSelect].forEach(el => el.addEventListener("input", render));
cancelEditBtn.addEventListener("click", cancelEdit);

// NOTIFICACIONES: schedule + clear
function scheduleNotification(item){
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  // Clear previous
  clearSchedule(item.id);

  const target = parseDateTime(item.fecha, item.hora);
  const now = new Date();
  const delay = target - now;
  if (delay <= 0) return; // ya pasó

const t = setTimeout(async () => {
  // Re-fetch item en caso de edición o eliminación
  const a = actividades.find(x => x.id === item.id);
  if (!a) return;

  if (!a.completada) {
    // Mostrar notificación
    new Notification("Recordatorio", {
      body: `${a.texto} — ${a.fecha} ${a.hora}`,
      icon: "" // opcional
    });

    if (a.conSonido) {
      try {
        await alarmaAudio.play();
      } catch (e) {}
    }
  }

  // Si tiene recurrencia, crear próxima instancia (simple)
  if (a.recurrencia && a.recurrencia !== "none") {
    const nextDate = computeNextDate(a.fecha, a.recurrencia);
    if (nextDate) {
      // Actualizar la actividad a la siguiente fecha
      a.fecha = nextDate;
      save();
      scheduleNotification(a); // Reprogramar notificación
      render(); // Actualizar interfaz
    }
  } else {
    // Si no es recurrente, no reprogramar
    timeouts.delete(a.id);
  }

}, delay);

timeouts.set(item.id, t);
}

function clearSchedule(id){
  const t = timeouts.get(id);
  if (t) { clearTimeout(t); timeouts.delete(id); }
}

// Reprogramar todas al cargar
function reprogramarTodas(){
  actividades.forEach(a => {
    clearSchedule(a.id);
    if (a.notificar){
      scheduleNotification(a);
    }
  });
}

// Calcular fecha siguiente para recurrencia (simple)
function computeNextDate(fechaStr, recurr) {
  const dt = new Date(fechaStr + "T00:00:00");
  if (isNaN(dt)) return null;

  if (recurr === "daily") dt.setDate(dt.getDate() + 1);
  if (recurr === "weekly") dt.setDate(dt.getDate() + 7);
  if (recurr === "monthly") dt.setMonth(dt.getMonth() + 1);

  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');

  // ✅ Usar template literal para formar la fecha correctamente
  return `${y}-${m}-${d}`;
}

// Helper parse date/time
function parseDateTime(fechaStr, horaStr) {
  // ✅ También con template literal
  return new Date(`${fechaStr}T${horaStr}:00`);
}

// On load
render();
reprogramarTodas();


// === CALENDARIO ===
const calendarGrid = document.getElementById("calendarGrid");
const monthYearLabel = document.getElementById("monthYear");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");

// Estado del calendario (mes actual)
let currentDate = new Date();

function renderCalendar() {
  if (!calendarGrid) return;

  calendarGrid.innerHTML = "";

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Mostrar mes y año
  const opciones = { month: "long", year: "numeric" };
  monthYearLabel.textContent = currentDate.toLocaleDateString("es-ES", opciones);

  const primerDia = new Date(year, month, 1);
  const ultimoDia = new Date(year, month + 1, 0);
  const primerDiaSemana = primerDia.getDay();
  const totalDias = ultimoDia.getDate();

  // Ajustar para iniciar en lunes
  const offset = (primerDiaSemana === 0 ? 6 : primerDiaSemana - 1);

  // Celdas vacías antes del 1
  for (let i = 0; i < offset; i++) {
    const empty = document.createElement("div");
    empty.className = "day";
    calendarGrid.appendChild(empty);
  }

  // Días del mes
  for (let d = 1; d <= totalDias; d++) {
    const cell = document.createElement("div");
    cell.className = "day";
    const num = document.createElement("div");
    num.className = "day-number";
    num.textContent = d;
    cell.appendChild(num);

    // Buscar actividades del día
    const fechaStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const delDia = actividades.filter(a => a.fecha === fechaStr);

    delDia.forEach(a => {
      const ev = document.createElement("div");
      ev.className = "event";
      ev.textContent = a.texto;
      ev.title = `${a.hora} • ${a.categoria}`;
      cell.appendChild(ev);
    });

    calendarGrid.appendChild(cell);
  }
}

// Botones para cambiar de mes
prevMonthBtn.addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
});

nextMonthBtn.addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
});

// Llamar al iniciar
document.addEventListener("DOMContentLoaded", renderCalendar);

// Actualizar calendario al renderizar lista
const oldRender = render;
render = function() {
  oldRender();
  renderCalendar();
};



// Register service worker for PWA/offline
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('sw.js')
    .catch(err => console.warn('SW failed', err));
}

