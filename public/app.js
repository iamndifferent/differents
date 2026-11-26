// ══════════════════════════════════════════════════════
// Differents — lógica del sitio (API sobre MongoDB)
// ══════════════════════════════════════════════════════

// La API vive en el mismo dominio que la página. Si algún día sirve el
// frontend por separado (Vercel, Netlify), ponga aquí la URL del backend:
//   const API = 'https://differents-api.onrender.com/api';
const API = (window.DIFFERENTS_API_URL || window.location.origin) + '/api';

let currentUser = null;
let token = localStorage.getItem('dif_token');
const REF_IMG = [
  'img/hero-sastreria.jpg',
  'img/ref-negro-dos-piezas.jpg',
  'img/ref-smoking-negro.jpg'
];
const TALLAS = ['46', '48', '50', '52', '54', '56'];

// ── Helper de API ──
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API + path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) logout(true);
    throw new Error(data.error || data.detalles?.[0] || 'Ha ocurrido un error');
  }
  return data;
}

// Si la API no responde, el sitio sigue siendo navegable: los seis capítulos
// son del navegador. Sólo se avisa de que catálogo, acceso y citas necesitan
// el servidor levantado.
let apiDisponible = true;

async function comprobarApi() {
  try {
    const res = await fetch(`${API}/health`, { cache: 'no-store' });
    apiDisponible = res.ok;
  } catch { apiDisponible = false; }

  if (!apiDisponible) {
    document.getElementById('avisoApi')?.classList.remove('hidden');
    document.querySelectorAll('[data-necesita-api]').forEach((el) => { el.disabled = true; });
  }
  return apiDisponible;
}

// ── Utilidades ──
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 4200);
}
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function toggleMobileMenu() { document.getElementById('mainNav').classList.toggle('open'); }
const fmt = (n) => Number(n || 0).toLocaleString('es-ES') + ' €';
const fecha = (d) => (d ? new Date(d).toLocaleDateString('es-ES') : '—');
const fechaHora = (d) => (d ? new Date(d).toLocaleString('es-ES') : '—');
const stockDe = (traje, talla) => (traje.stock ? traje.stock[talla] || 0 : 0);
const stockTotal = (traje) => (traje.stockTotal ?? TALLAS.reduce((a, t) => a + stockDe(traje, t), 0));

// ── Navegación ──
function navigate(page) {
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  document.getElementById(`page-${page}`)?.classList.add('active');
  document.querySelectorAll('.nav-links a[data-page]').forEach((a) => a.classList.toggle('active', a.dataset.page === page));
  document.querySelectorAll('.nav-links a[data-chap]').forEach((a) => a.classList.remove('active'));
  document.getElementById('mainNav').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'instant' });

  if (page === 'catalogo') loadSuits();
  if (page === 'soporte' || page === 'agente') loadTickets();
  if (page === 'admin') adminTab('dashboard', document.querySelector('#page-admin .tab-btn'));
  if (page === 'perfil') loadProfile();
  if (page === 'pedidos') loadPedidos();
  if (page === 'home') setTimeout(revealInView, 50);
}
function goChapter(id) {
  if (!document.getElementById('page-home').classList.contains('active')) navigate('home');
  setTimeout(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('mainNav').classList.remove('open');
  }, 60);
}
function accesoClientes() {
  if (currentUser) {
    return navigate(currentUser.rol === 'ADMIN' ? 'admin' : currentUser.rol === 'AGENTE' ? 'agente' : 'perfil');
  }
  return openModal('authModal');
}
function toggleAuthForm() {
  document.getElementById('authLoginForm').classList.toggle('hidden');
  document.getElementById('authRegisterForm').classList.toggle('hidden');
  document.getElementById('authTitle').textContent =
    document.getElementById('authLoginForm').classList.contains('hidden') ? 'Crear cuenta' : 'Acceso Clientes';
}

// ── Autenticación ──
async function doLogin() {
  try {
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({
      email: document.getElementById('loginEmail').value.trim(),
      password: document.getElementById('loginPass').value,
    }) });
    token = data.token; localStorage.setItem('dif_token', token);
    currentUser = data.user;
    closeModal('authModal');
    toast(`Bienvenido, ${currentUser.nombre}`, 'success');
    updateNav();
    navigate('home');
  } catch (e) { toast(e.message, 'error'); }
}
async function doRegister() {
  try {
    const data = await api('/auth/register', { method: 'POST', body: JSON.stringify({
      email: document.getElementById('regEmail').value.trim(),
      password: document.getElementById('regPass').value,
      nombre: document.getElementById('regNombre').value.trim(),
      apellidos: document.getElementById('regApellidos').value.trim(),
      telefono: document.getElementById('regTel').value.trim(),
    }) });
    token = data.token; localStorage.setItem('dif_token', token);
    currentUser = data.user;
    closeModal('authModal');
    toast('Cuenta creada con éxito', 'success');
    updateNav();
    navigate('home');
  } catch (e) { toast(e.message, 'error'); }
}
function logout(silencioso) {
  token = null; currentUser = null;
  localStorage.removeItem('dif_token');
  updateNav();
  navigate('home');
  if (!silencioso) toast('Sesión cerrada', 'info');
}
async function checkAuth() {
  if (!token) return updateNav();
  try { currentUser = (await api('/auth/me')).user; }
  catch { token = null; localStorage.removeItem('dif_token'); }
  return updateNav();
}
function updateNav() {
  const dyn = document.getElementById('navDynamic');
  const userEl = document.getElementById('navUser');
  const btn = document.getElementById('btnAcceso');
  if (currentUser) {
    const r = currentUser.rol;
    dyn.innerHTML =
      (r === 'CLIENTE' ? '<a href="#" data-page="soporte" onclick="navigate(\'soporte\');return false">Soporte</a><a href="#" data-page="pedidos" onclick="navigate(\'pedidos\');return false">Pedidos</a>' : '')
      + (r === 'AGENTE' ? '<a href="#" data-page="agente" onclick="navigate(\'agente\');return false">Workspace</a>' : '')
      + (r === 'ADMIN' ? '<a href="#" data-page="admin" onclick="navigate(\'admin\');return false">Administración</a>' : '');
    userEl.innerHTML = `<a href="#" class="user-chip" onclick="navigate('perfil');return false">${esc(currentUser.nombre)}</a> <button class="btn btn-dark btn-sm" onclick="logout()">Salir</button>`;
    btn.classList.add('hidden');
  } else {
    dyn.innerHTML = '';
    userEl.innerHTML = '';
    btn.classList.remove('hidden');
  }
}

// ══════════════════════════════════════════════
// Capítulo II · Tejidos
// ══════════════════════════════════════════════
const FABRICS = [
  { t: 'Lana merina italiana Super 150s', x: 'Una lana de fibra fina que cae con naturalidad y conserva la forma tras horas de uso. Tejida en Italia, con un acabado mate que no brilla bajo la luz.', s: [['Micra', '18,5 µm'], ['Peso', '260 g/m²'], ['Uso', 'Todo el año']], bg: 'linear-gradient(135deg,#2B2F38 0%,#1A1C22 45%,#3A3A40 100%)' },
  { t: 'Cachemira', x: 'Fibra suave y ligera que abriga sin peso. Sus reflejos discretos y su tacto sedoso la convierten en la elección para la temporada fría y las noches de gala.', s: [['Micra', '15 µm'], ['Peso', '240 g/m²'], ['Uso', 'Invierno']], bg: 'linear-gradient(135deg,#6B5A4A 0%,#A08B73 50%,#D9C7AE 100%)' },
  { t: 'Forro de seda', x: 'Seda natural en el interior de la chaqueta. Deslizar el brazo es un gesto tan silencioso como el propio traje. Disponible en tonos a juego o en contraste discreto.', s: [['Fibra', '100% seda'], ['Tejido', 'Crepé'], ['Color', 'A elegir']], bg: 'linear-gradient(135deg,#7A1C24 0%,#A4343D 50%,#D7A7AB 100%)' },
];
function selectFabric(i) {
  document.querySelectorAll('.fabric-option').forEach((b, k) => b.setAttribute('aria-selected', k === i ? 'true' : 'false'));
  const f = FABRICS[i];
  document.getElementById('fabricSwatch').style.background = f.bg;
  document.getElementById('fabricTitle').textContent = f.t;
  document.getElementById('fabricText').textContent = f.x;
  document.getElementById('fabricSpecs').innerHTML = f.s.map(([k, v]) => `<div><b>${esc(k)}</b>${esc(v)}</div>`).join('');
}

// ══════════════════════════════════════════════
// Capítulo III · Solapas
// ══════════════════════════════════════════════
const LAPELS = [
  { t: 'Solapa de pico', x: 'Las puntas apuntan hacia el hombro. Es la solapa más formal y estilizada, la que domina en la chaqueta de etiqueta y en los trajes de negocios de alto nivel.', l: [['Ocasión', 'Negocios, gala, boda'], ['Efecto', 'Alarga la silueta'], ['Ancho', '8 a 10 cm']] },
  { t: 'Solapa de muesca', x: 'Una solapa clásica y versátil, con el corte en ángulo recto entre cuello y solapa. Es la más usada en trajes de diario y de ocasiones informales.', l: [['Ocasión', 'Diario, negocios'], ['Efecto', 'Equilibrio y versatilidad'], ['Ancho', '7 a 9 cm']] },
  { t: 'Solapa de esmoquin', x: 'Solapa de seda que se extiende en una sola pieza sin corte visible. Es la solapa del esmoquin por excelencia y se acompaña de un fino ribete de seda.', l: [['Ocasión', 'Etiqueta y gala'], ['Efecto', 'Elegancia nocturna'], ['Acabado', 'Ribete de seda']] },
];
function selectLapel(i) {
  document.querySelectorAll('.cut-tabs button').forEach((b, k) => b.setAttribute('aria-selected', k === i ? 'true' : 'false'));
  const l = LAPELS[i];
  document.getElementById('lapelTitle').textContent = l.t;
  document.getElementById('lapelText').textContent = l.x;
  document.getElementById('lapelList').innerHTML = l.l.map(([k, v]) => `<li><b>${esc(k)}</b><span>${esc(v)}</span></li>`).join('');
}

// ── Capítulo V · Monograma ──
function updateMonogram() {
  const v = document.getElementById('monoInput').value.toUpperCase().replace(/[^A-ZÑ]/g, '');
  document.getElementById('monoPreview').textContent = v || '···';
}

// ══════════════════════════════════════════════
// Capítulo VI · Reserva de cita
// ══════════════════════════════════════════════
async function submitCita(e) {
  e.preventDefault();
  const f = e.target;
  const nombre = f.nombre.value.trim();
  if (nombre.length < 3) return toast('Indique su nombre completo', 'error');
  if (!f.fecha_preferida.value) return toast('Seleccione una fecha', 'error');
  if (!apiDisponible) {
    return toast('Vista previa sin servidor: la reserva no se guardará. Arranque la API para activarla.', 'error');
  }

  const btn = document.getElementById('citaBtn');
  btn.disabled = true; btn.textContent = 'Enviando…';
  try {
    const data = await api('/citas', { method: 'POST', body: JSON.stringify({
      nombre, ciudad: f.ciudad.value, ocasion: f.ocasion.value, fecha_preferida: f.fecha_preferida.value,
    }) });
    toast(data.mensaje, 'success');
    f.reset();
    document.getElementById('citaFecha').min = new Date().toISOString().slice(0, 10);
  } catch (err) { toast(err.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Reservar Cita Privada'; }
}

// ── Revelado de paneles al hacer scroll ──
function revealInView() {
  document.querySelectorAll('#page-home .reveal, #page-home .panel-clip').forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight * 0.88) el.classList.add('in');
  });
}

// ══════════════════════════════════════════════
// Catálogo
// ══════════════════════════════════════════════
function suitCardHTML(s, idx) {
  const total = stockTotal(s);
  const cat = { ETIQUETA: 'Etiqueta', EJECUTIVO: 'Ejecutivo', CEREMONIA: 'Ceremonia', CASUAL_SASTRERIA: 'Casual sastrería' }[s.categoria] || s.categoria;
  const img = s.imagenUrl || REF_IMG[idx % REF_IMG.length];
  return `<article class="suit-card" onclick="showSuitDetail('${esc(s.id)}')" tabindex="0">
    <div class="suit-img"><img src="${esc(img)}" alt="${esc(s.nombre)}" loading="lazy"></div>
    <div class="suit-body">
      <div class="suit-category">${esc(cat)} · ${esc((s.corte || '').replace(/_/g, ' '))}</div>
      <div class="suit-name">${esc(s.nombre)}</div>
      <div class="suit-details">${esc(s.color)} · ${esc(s.tejido)}</div>
      <div class="suit-footer"><span class="suit-price">${fmt(s.precio)}</span>${total && total <= 5 ? `<span class="suit-stock">Últimas ${total} unidades</span>` : ''}</div>
    </div>
  </article>`;
}
async function loadSuits() {
  const params = new URLSearchParams();
  const buscar = document.getElementById('filterSearch').value.trim();
  const cat = document.getElementById('filterCat').value;
  const corte = document.getElementById('filterCorte').value;
  const precio = document.getElementById('filterPrecio').value;
  if (buscar) params.set('buscar', buscar);
  if (cat) params.set('categoria', cat);
  if (corte) params.set('corte', corte);
  if (precio) { const [min, max] = precio.split('-'); params.set('precio_min', min); params.set('precio_max', max); }
  try {
    const data = await api(`/trajes?${params}`);
    document.getElementById('catalogGrid').innerHTML = data.trajes.length
      ? data.trajes.map(suitCardHTML).join('')
      : '<p class="text-muted" style="grid-column:1/-1;padding:40px 0">No hay trajes que coincidan con estos filtros.</p>';
  } catch (e) { toast(e.message, 'error'); }
}
async function showSuitDetail(id) {
  try {
    const s = (await api(`/trajes/${id}`)).traje;
    const disponibles = TALLAS.filter((t) => stockDe(s, t) > 0);
    const img = s.imagenUrl || REF_IMG[Math.abs(id.charCodeAt(id.length - 1)) % REF_IMG.length];
    document.getElementById('suitModalContent').innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;align-items:start">
        <img src="${esc(img)}" alt="${esc(s.nombre)}" style="width:100%;aspect-ratio:4/5;object-fit:cover;background:var(--bg-alt)">
        <div>
          <div class="suit-category">${esc((s.categoria || '').replace(/_/g, ' '))} · ${esc(s.sku)}</div>
          <h2 style="margin:8px 0 12px;font-size:1.5rem">${esc(s.nombre)}</h2>
          <p style="font-size:0.9rem">${esc(s.color)} · ${esc(s.tejido)}</p>
          <p style="font-size:0.9rem;margin-top:14px">${esc(s.descripcion)}</p>
          <div style="font-family:var(--font-display);font-size:1.7rem;margin-top:20px">${fmt(s.precio)}</div>
          ${currentUser?.rol === 'CLIENTE' ? `
            <div class="form-group mt-24">
              <label class="form-label" for="orderTalla">Talla</label>
              <select class="form-select" id="orderTalla">
                ${disponibles.length ? disponibles.map((t) => `<option value="${t}">${t} · ${stockDe(s, t)} disponibles</option>`).join('') : '<option disabled>Sin stock</option>'}
              </select>
            </div>
            <button class="btn btn-cta btn-block" ${disponibles.length ? '' : 'disabled'} onclick="placeOrder('${esc(s.id)}')">Añadir al pedido</button>
          ` : !currentUser ? '<button class="btn btn-cta btn-block mt-24" onclick="closeModal(\'suitModal\');accesoClientes()">Acceda para encargar</button>' : ''}
        </div>
      </div>`;
    openModal('suitModal');
  } catch (e) { toast(e.message, 'error'); }
}
async function placeOrder(trajeId) {
  const talla = document.getElementById('orderTalla')?.value;
  if (!talla) return toast('Seleccione una talla', 'error');
  try {
    const data = await api('/pedidos', { method: 'POST', body: JSON.stringify({ traje_id: trajeId, talla }) });
    toast(`Pedido ${data.numeroPedido} confirmado`, 'success');
    closeModal('suitModal');
  } catch (e) { toast(e.message, 'error'); }
}

// ── Pedidos ──
async function loadPedidos() {
  const el = document.getElementById('pedidosList');
  try {
    const data = await api('/pedidos');
    if (!data.pedidos.length) { el.innerHTML = '<p class="text-muted">Todavía no tiene pedidos.</p>'; return; }
    el.innerHTML = `<div class="table-wrap"><table class="admin-table">
      <thead><tr><th>Nº pedido</th><th>Traje</th><th>Talla</th><th>Total</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>
      ${data.pedidos.map((p) => `<tr>
        <td style="color:var(--accent);font-weight:600">${esc(p.numeroPedido)}</td>
        <td>${esc(p.trajeNombre)}</td><td>${esc(p.talla)}</td><td>${fmt(p.precioTotal)}</td>
        <td><span class="badge badge-${esc((p.estado || '').toLowerCase())}">${esc((p.estado || '').replace(/_/g, ' '))}</span></td>
        <td>${fecha(p.createdAt)}</td></tr>`).join('')}
    </tbody></table></div>`;
  } catch (e) { toast(e.message, 'error'); }
}

// ── Perfil ──
async function loadProfile() {
  try {
    const u = (await api('/auth/me')).user;
    const m = u.medidas || {};
    const med = (k) => (m[k] === null || m[k] === undefined ? '' : m[k]);
    document.getElementById('perfilContent').innerHTML = `
      <div class="form-group"><label class="form-label">Correo electrónico</label><input class="form-input" value="${esc(u.email)}" disabled></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label" for="profNombre">Nombre</label><input class="form-input" id="profNombre" value="${esc(u.nombre)}"></div>
        <div class="form-group"><label class="form-label" for="profApellidos">Apellidos</label><input class="form-input" id="profApellidos" value="${esc(u.apellidos || '')}"></div>
      </div>
      <div class="form-group"><label class="form-label" for="profTel">Teléfono</label><input class="form-input" id="profTel" value="${esc(u.telefono || '')}"></div>
      <h3 style="margin:36px 0 16px;font-size:1.1rem">Sus medidas (cm)</h3>
      <div class="form-row">
        <div class="form-group"><label class="form-label" for="profPecho">Pecho</label><input class="form-input" type="number" id="profPecho" value="${esc(med('pecho'))}"></div>
        <div class="form-group"><label class="form-label" for="profCintura">Cintura</label><input class="form-input" type="number" id="profCintura" value="${esc(med('cintura'))}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label" for="profCadera">Cadera</label><input class="form-input" type="number" id="profCadera" value="${esc(med('cadera'))}"></div>
        <div class="form-group"><label class="form-label" for="profHombros">Hombros</label><input class="form-input" type="number" id="profHombros" value="${esc(med('hombros'))}"></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label" for="profManga">Largo de manga</label><input class="form-input" type="number" id="profManga" value="${esc(med('manga'))}"></div>
        <div class="form-group"><label class="form-label" for="profPantalon">Largo de pantalón</label><input class="form-input" type="number" id="profPantalon" value="${esc(med('largoPantalon'))}"></div>
      </div>
      <button class="btn btn-cta btn-block mt-24" onclick="saveProfile()">Guardar cambios</button>`;
  } catch (e) { toast(e.message, 'error'); }
}
async function saveProfile() {
  const val = (id) => { const v = document.getElementById(id).value; return v === '' ? null : Number(v); };
  try {
    await api('/auth/profile', { method: 'PUT', body: JSON.stringify({
      nombre: document.getElementById('profNombre').value.trim(),
      apellidos: document.getElementById('profApellidos').value.trim(),
      telefono: document.getElementById('profTel').value.trim(),
      medidas: {
        pecho: val('profPecho'), cintura: val('profCintura'), cadera: val('profCadera'),
        hombros: val('profHombros'), manga: val('profManga'), largoPantalon: val('profPantalon'),
      },
    }) });
    toast('Perfil actualizado', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

// ══════════════════════════════════════════════
// Incidencias
// ══════════════════════════════════════════════
async function loadTickets() {
  const esAgente = currentUser?.rol === 'AGENTE';
  const prefijo = esAgente ? 'agente' : 'ticket';
  const listEl = document.getElementById(esAgente ? 'agenteTicketList' : 'ticketList');
  if (!listEl) return;

  const params = new URLSearchParams();
  const buscar = document.getElementById(`${prefijo}Search`)?.value;
  const estado = document.getElementById(`${prefijo}FilterEstado`)?.value;
  const prioridad = document.getElementById(`${prefijo}FilterPrioridad`)?.value;
  if (buscar) params.set('buscar', buscar);
  if (estado) params.set('estado', estado);
  if (prioridad) params.set('prioridad', prioridad);

  try {
    const data = await api(`/tickets?${params}`);
    listEl.innerHTML = data.tickets.length ? data.tickets.map((t) => `
      <div class="ticket-card" onclick="showTicketDetail('${esc(t.id)}')" tabindex="0">
        <div class="ticket-priority ${esc(t.prioridad)}"></div>
        <div>
          <div class="ticket-code">${esc(t.codigo)}</div>
          <div class="ticket-subject">${esc(t.asunto)}</div>
          <div class="ticket-meta">${esc(t.categoriaNombre || '—')} · ${fecha(t.updatedAt)}${t.agenteNombre ? ` · ${esc(t.agenteNombre)}` : ''}</div>
        </div>
        <span class="badge badge-${esc(t.estado.toLowerCase())}">${esc(t.estado.replace(/_/g, ' '))}</span>
      </div>`).join('') : '<p class="text-muted" style="padding:32px 0">No hay incidencias.</p>';
  } catch (e) { toast(e.message, 'error'); }
}

async function showTicketDetail(id) {
  try {
    const t = (await api(`/tickets/${id}`)).ticket;
    const esEquipo = currentUser?.rol === 'AGENTE' || currentUser?.rol === 'ADMIN';
    const esCliente = currentUser?.rol === 'CLIENTE';

    let acciones = '';
    if (esEquipo) {
      acciones = `<div class="flex gap-12 flex-wrap mt-16 mb-16">
        <select class="filter-select" id="ticketNewEstado" style="flex:1" aria-label="Nuevo estado">
          <option value="">Cambiar estado</option>
          <option value="EN_CURSO">En curso</option>
          <option value="PENDIENTE_CLIENTE">Pendiente del cliente</option>
          <option value="RESUELTO">Resuelto</option>
          <option value="CERRADO">Cerrado</option>
        </select>
        <select class="filter-select" id="ticketNewPrioridad" style="flex:1" aria-label="Nueva prioridad">
          <option value="">Cambiar prioridad</option>
          <option value="BAJA">Baja</option><option value="MEDIA">Media</option><option value="ALTA">Alta</option>
        </select>
        <button class="btn btn-gold btn-sm" onclick="updateTicket('${esc(t.id)}')">Aplicar</button>
      </div>`;
    } else if (esCliente && t.estado === 'RESUELTO') {
      acciones = `<div class="flex gap-12 mt-16 mb-16">
        <button class="btn btn-cta btn-sm" onclick="clientTicketAction('${esc(t.id)}','CERRADO')">Confirmar cierre</button>
        <button class="btn btn-dark btn-sm" onclick="clientTicketAction('${esc(t.id)}','EN_CURSO')">Reabrir</button>
      </div>`;
    }

    const chat = (t.mensajes || []).map((m) => `
      <div class="chat-msg ${esc((m.autorRol || '').toLowerCase())} ${m.esNotaInterna ? 'nota' : ''} ${String(m.autor) === String(currentUser?.id) ? 'own' : ''}">
        <div class="chat-msg-header">
          <strong>${esc(m.autorNombre)}</strong><span>${esc(m.autorRol)}</span>
          ${m.esNotaInterna ? '<span style="color:var(--warning)">Nota interna</span>' : ''}
          <span>${fechaHora(m.createdAt)}</span>
        </div>
        <div class="chat-msg-body">${esc(m.mensaje)}</div>
      </div>`).join('');

    const responder = t.estado !== 'CERRADO' ? `<div class="chat-input-bar mt-16">
        <input class="form-input" id="ticketReply" placeholder="Escriba su mensaje" aria-label="Mensaje">
        ${esEquipo ? '<label style="display:flex;align-items:center;gap:6px;font-size:0.75rem;white-space:nowrap"><input type="checkbox" id="ticketNotaInterna"> Nota interna</label>' : ''}
        <button class="btn btn-cta btn-sm" onclick="sendTicketReply('${esc(t.id)}')">Enviar</button>
      </div>` : '<p class="text-muted mt-16" style="font-size:0.85rem">Esta incidencia está cerrada.</p>';

    const auditoria = esEquipo && t.historial?.length ? `
      <details style="margin-top:20px">
        <summary style="cursor:pointer;font-size:0.78rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted)">Historial de cambios (${t.historial.length})</summary>
        <div style="margin-top:12px;font-size:0.82rem;color:var(--ink-soft)">
          ${t.historial.map((h) => `<div style="padding:6px 0;border-bottom:1px solid var(--line)">
            ${fechaHora(h.createdAt)} · <strong>${esc(h.autorNombre)}</strong> cambió <em>${esc(h.campo)}</em>: ${esc(h.valorAnterior || '—')} → ${esc(h.valorNuevo || '—')}
          </div>`).join('')}
        </div>
      </details>` : '';

    document.getElementById('ticketModalContent').innerHTML = `
      <div class="flex justify-between items-center flex-wrap gap-12 mb-16">
        <div><span class="ticket-code">${esc(t.codigo)}</span>
        <span class="badge badge-${esc(t.estado.toLowerCase())}" style="margin-left:8px">${esc(t.estado.replace(/_/g, ' '))}</span></div>
        <span class="badge badge-${t.prioridad === 'ALTA' ? 'pendiente_cliente' : t.prioridad === 'MEDIA' ? 'en_curso' : 'resuelto'}">${esc(t.prioridad)}</span>
      </div>
      <h3>${esc(t.asunto)}</h3>
      <p class="text-muted mt-16" style="font-size:0.85rem">${esc(t.categoriaNombre || '—')}${t.numeroPedido ? ` · Pedido ${esc(t.numeroPedido)}` : ''} · Cliente: ${esc(t.clienteNombre)}${t.agenteNombre ? ` · Asesor: ${esc(t.agenteNombre)}` : ''}</p>
      ${acciones}
      <div class="chat-container mt-16">${chat}</div>
      ${responder}
      ${auditoria}`;
    openModal('ticketModal');
  } catch (e) { toast(e.message, 'error'); }
}

async function sendTicketReply(id) {
  const msg = document.getElementById('ticketReply')?.value.trim();
  if (!msg) return;
  const esNota = document.getElementById('ticketNotaInterna')?.checked || false;
  try {
    await api(`/tickets/${id}/mensajes`, { method: 'POST', body: JSON.stringify({ mensaje: msg, es_nota_interna: esNota }) });
    toast('Mensaje enviado', 'success');
    showTicketDetail(id);
  } catch (e) { toast(e.message, 'error'); }
}
async function updateTicket(id) {
  const estado = document.getElementById('ticketNewEstado')?.value;
  const prioridad = document.getElementById('ticketNewPrioridad')?.value;
  if (!estado && !prioridad) return toast('Seleccione un cambio', 'error');
  const body = {};
  if (estado) body.estado = estado;
  if (prioridad) body.prioridad = prioridad;
  try {
    await api(`/tickets/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    toast('Incidencia actualizada', 'success');
    showTicketDetail(id);
    loadTickets();
  } catch (e) { toast(e.message, 'error'); }
}
async function clientTicketAction(id, estado) {
  try {
    await api(`/tickets/${id}`, { method: 'PUT', body: JSON.stringify({ estado }) });
    toast(estado === 'CERRADO' ? 'Incidencia cerrada' : 'Incidencia reabierta', 'success');
    showTicketDetail(id);
    loadTickets();
  } catch (e) { toast(e.message, 'error'); }
}

// ── Asistente de nueva incidencia ──
async function showNewTicketWizard() {
  if (!currentUser) return accesoClientes();
  try {
    const [cats, pedidos] = await Promise.all([api('/categorias-soporte'), api('/pedidos')]);
    document.getElementById('newTicketCat').innerHTML = cats.categorias.map((c) => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join('');
    document.getElementById('newTicketPedido').innerHTML = '<option value="">Sin pedido vinculado</option>'
      + pedidos.pedidos.map((p) => `<option value="${esc(p.id)}">${esc(p.numeroPedido)} · ${esc(p.trajeNombre || 'Traje')}</option>`).join('');
    ticketNextStep(1);
    return openModal('newTicketModal');
  } catch (e) { return toast(e.message, 'error'); }
}
function setStepper(prefijo, paso) {
  const contenedor = prefijo === 'ticket' ? 'ticketStepper' : 'medidaStepper';
  for (let i = 1; i <= 3; i += 1) {
    document.getElementById(`${prefijo}Step${i}`).classList.toggle('hidden', i !== paso);
    const el = document.querySelector(`#${contenedor} .step[data-step="${i}"]`);
    el.classList.toggle('active', i === paso);
    el.classList.toggle('done', i < paso);
    const linea = el.nextElementSibling;
    if (linea?.classList.contains('step-line')) linea.classList.toggle('done', i < paso);
  }
}
function ticketNextStep(paso) {
  if (paso === 3) {
    const asunto = document.getElementById('newTicketAsunto').value.trim();
    const desc = document.getElementById('newTicketDesc').value.trim();
    if (asunto.length < 5) return toast('El asunto necesita al menos 5 caracteres', 'error');
    if (desc.length < 10) return toast('La descripción necesita al menos 10 caracteres', 'error');
    const cat = document.getElementById('newTicketCat');
    document.getElementById('ticketResumen').innerHTML = `
      <p><strong>Motivo:</strong> ${esc(cat.options[cat.selectedIndex]?.text || '')}</p>
      <p><strong>Prioridad:</strong> ${esc(document.getElementById('newTicketPrioridad').value)}</p>
      <p><strong>Asunto:</strong> ${esc(asunto)}</p>
      <p style="margin-top:12px"><strong>Descripción:</strong></p><p class="text-muted">${esc(desc)}</p>`;
  }
  return setStepper('ticket', paso);
}
async function submitTicket() {
  const pedidoId = document.getElementById('newTicketPedido').value;
  try {
    const data = await api('/tickets', { method: 'POST', body: JSON.stringify({
      asunto: document.getElementById('newTicketAsunto').value.trim(),
      descripcion: document.getElementById('newTicketDesc').value.trim(),
      categoria_id: document.getElementById('newTicketCat').value,
      prioridad: document.getElementById('newTicketPrioridad').value,
      ...(pedidoId ? { pedido_id: pedidoId } : {}),
    }) });
    toast(`Incidencia ${data.codigo} creada`, 'success');
    closeModal('newTicketModal');
    document.getElementById('newTicketAsunto').value = '';
    document.getElementById('newTicketDesc').value = '';
    loadTickets();
  } catch (e) { toast(e.message, 'error'); }
}

// ── Configurador a medida ──
function medidaNextStep(paso) {
  setStepper('medida', paso);
  if (paso === 3) {
    const tipo = document.getElementById('medTipo'); const corte = document.getElementById('medCorte');
    const v = (id) => document.getElementById(id).value || '—';
    document.getElementById('medidaResumen').innerHTML = `
      <p><strong>Prenda:</strong> ${esc(tipo.options[tipo.selectedIndex].text)}</p>
      <p><strong>Corte:</strong> ${esc(corte.options[corte.selectedIndex].text)}</p>
      <p><strong>Tejido:</strong> ${esc(v('medTejido'))}</p>
      <p style="margin-top:14px"><strong>Medidas:</strong> pecho ${esc(v('medPecho'))} cm · cintura ${esc(v('medCintura'))} cm · cadera ${esc(v('medCadera'))} cm</p>
      <p>hombros ${esc(v('medHombros'))} cm · manga ${esc(v('medManga'))} cm · pantalón ${esc(v('medPantalon'))} cm</p>`;
  }
}
function submitMedida() {
  if (!currentUser) { accesoClientes(); return toast('Acceda para solicitar la asesoría', 'info'); }
  toast('Solicitud enviada. Un asesor le contactará en breve.', 'success');
  return setStepper('medida', 1);
}

function toggleFaq(btn) { btn.closest('.faq-item').classList.toggle('open'); }

// ══════════════════════════════════════════════
// Panel de administración
// ══════════════════════════════════════════════
async function adminTab(tab, btn) {
  document.querySelectorAll('#page-admin .tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
  const c = document.getElementById('adminContent');
  c.innerHTML = '<p class="text-muted">Cargando…</p>';
  try {
    if (tab === 'dashboard') {
      const m = await api('/admin/metricas');
      const maxDe = (arr) => Math.max(...arr.map((x) => x.total), 1);
      const barra = (etiqueta, valor, max) => `<div class="chart-bar-row">
        <div class="chart-bar-label">${esc(etiqueta)}</div>
        <div class="chart-bar" style="width:${((valor / max) * 100).toFixed(1)}%"></div>
        <div class="chart-bar-value">${valor}</div></div>`;
      c.innerHTML = `
        <div class="metrics-grid">
          <div class="metric-card"><div class="metric-value">${m.totalUsuarios}</div><div class="metric-label">Usuarios</div></div>
          <div class="metric-card"><div class="metric-value">${m.totalPedidos}</div><div class="metric-label">Pedidos</div></div>
          <div class="metric-card"><div class="metric-value">${m.totalTrajes}</div><div class="metric-label">Trajes activos</div></div>
          <div class="metric-card"><div class="metric-value">${m.totalCitas}</div><div class="metric-label">Citas pendientes</div></div>
          <div class="metric-card"><div class="metric-value" style="font-size:1.8rem">${fmt(m.ingresosTotales)}</div><div class="metric-label">Facturado</div></div>
        </div>
        <h3 class="mb-24">Incidencias por estado</h3>
        <div class="chart-bar-container">${m.porEstado.map((e) => barra(e.estado.replace(/_/g, ' '), e.total, maxDe(m.porEstado))).join('') || '<p class="text-muted">Sin datos.</p>'}</div>
        <h3 class="mb-24">Carga por asesor</h3>
        <div class="chart-bar-container">${m.porAgente.map((a) => barra(a.agente || 'Sin asignar', a.total, maxDe(m.porAgente))).join('') || '<p class="text-muted">Sin incidencias asignadas.</p>'}</div>
        <h3 class="mb-24">Por categoría</h3>
        <div class="chart-bar-container">${m.porCategoria.map((x) => barra(x.categoria || 'Sin categoría', x.total, maxDe(m.porCategoria))).join('') || '<p class="text-muted">Sin datos.</p>'}</div>`;
    } else if (tab === 'tickets') {
      const [data, agentes] = await Promise.all([api('/tickets'), api('/admin/agentes')]);
      c.innerHTML = `<div class="table-wrap"><table class="admin-table">
        <thead><tr><th>Código</th><th>Asunto</th><th>Cliente</th><th>Asesor</th><th>Estado</th><th>Prioridad</th></tr></thead><tbody>
        ${data.tickets.map((t) => `<tr>
          <td><a href="#" style="color:var(--accent);font-weight:600" onclick="showTicketDetail('${esc(t.id)}');return false">${esc(t.codigo)}</a></td>
          <td>${esc(t.asunto)}</td><td>${esc(t.clienteNombre || '')}</td>
          <td><select class="filter-select" style="min-width:150px;padding:8px 10px" onchange="assignAgent('${esc(t.id)}', this.value)" aria-label="Asignar asesor">
            <option value="">Sin asignar</option>
            ${agentes.agentes.map((a) => `<option value="${esc(a.id)}" ${String(t.agente) === String(a.id) ? 'selected' : ''}>${esc(a.nombre)}</option>`).join('')}
          </select></td>
          <td><span class="badge badge-${esc(t.estado.toLowerCase())}">${esc(t.estado.replace(/_/g, ' '))}</span></td>
          <td>${esc(t.prioridad)}</td></tr>`).join('')}
      </tbody></table></div>`;
    } else if (tab === 'trajes') {
      const data = await api('/admin/trajes');
      c.innerHTML = `
        <button class="btn btn-cta btn-sm mb-24" onclick="toggleSuitForm()">Nuevo traje</button>
        <div id="adminSuitForm" class="hidden mb-24" style="background:var(--surface);border:1px solid var(--line);padding:28px"></div>
        <div class="table-wrap"><table class="admin-table">
        <thead><tr><th>SKU</th><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Estado</th><th></th></tr></thead><tbody>
        ${data.trajes.map((s) => `<tr>
          <td style="color:var(--accent)">${esc(s.sku)}</td><td>${esc(s.nombre)}</td><td>${esc(s.categoria)}</td>
          <td>${fmt(s.precio)}</td><td>${stockTotal(s)}</td><td>${esc(s.estado)}</td>
          <td><button class="btn btn-dark btn-sm" onclick="toggleSuitStatus('${esc(s.id)}','${s.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'}')">${s.estado === 'ACTIVO' ? 'Desactivar' : 'Activar'}</button></td>
        </tr>`).join('')}
      </tbody></table></div>`;
    } else if (tab === 'usuarios') {
      const data = await api('/admin/usuarios');
      c.innerHTML = `<div class="table-wrap"><table class="admin-table">
        <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Activo</th><th></th></tr></thead><tbody>
        ${data.usuarios.map((u) => {
    const esYo = String(u.id) === String(currentUser?.id);
    return `<tr><td>${esc(u.nombre)} ${esc(u.apellidos || '')}${esYo ? ' <small class="text-muted">(usted)</small>' : ''}</td><td>${esc(u.email)}</td>
          <td><select class="filter-select" style="padding:8px 10px;min-width:130px" ${esYo ? 'disabled' : ''} onchange="changeUserRole('${esc(u.id)}', this.value)" aria-label="Rol">
            <option value="CLIENTE" ${u.rol === 'CLIENTE' ? 'selected' : ''}>Cliente</option>
            <option value="AGENTE" ${u.rol === 'AGENTE' ? 'selected' : ''}>Asesor</option>
            <option value="ADMIN" ${u.rol === 'ADMIN' ? 'selected' : ''}>Administrador</option>
          </select></td>
          <td>${u.activo ? 'Sí' : 'No'}</td>
          <td>${esYo ? '' : `<button class="btn btn-dark btn-sm" onclick="toggleUser('${esc(u.id)}',${u.activo ? 'false' : 'true'})">${u.activo ? 'Desactivar' : 'Activar'}</button>`}</td></tr>`;
  }).join('')}
      </tbody></table></div>`;
    } else if (tab === 'pedidos') {
      const data = await api('/pedidos');
      c.innerHTML = `<div class="table-wrap"><table class="admin-table">
        <thead><tr><th>Nº</th><th>Cliente</th><th>Traje</th><th>Talla</th><th>Total</th><th>Estado</th><th>Fecha</th></tr></thead><tbody>
        ${data.pedidos.map((p) => `<tr><td style="color:var(--accent)">${esc(p.numeroPedido)}</td><td>${esc(p.clienteNombre || '')}</td>
          <td>${esc(p.trajeNombre)}</td><td>${esc(p.talla)}</td><td>${fmt(p.precioTotal)}</td>
          <td><span class="badge badge-${esc((p.estado || '').toLowerCase())}">${esc((p.estado || '').replace(/_/g, ' '))}</span></td>
          <td>${fecha(p.createdAt)}</td></tr>`).join('')}
      </tbody></table></div>`;
    } else if (tab === 'citas') {
      const data = await api('/admin/citas');
      c.innerHTML = data.citas.length ? `<div class="table-wrap"><table class="admin-table">
        <thead><tr><th>Nombre</th><th>Ciudad</th><th>Ocasión</th><th>Fecha preferida</th><th>Estado</th></tr></thead><tbody>
        ${data.citas.map((x) => `<tr><td>${esc(x.nombre)}</td><td>${esc(x.ciudad)}</td><td>${esc(x.ocasion)}</td><td>${fecha(x.fechaPreferida)}</td>
          <td><select class="filter-select" style="padding:8px 10px" onchange="updateCita('${esc(x.id)}', this.value)" aria-label="Estado de la cita">
            ${['SOLICITADA', 'CONFIRMADA', 'ATENDIDA', 'CANCELADA'].map((e) => `<option value="${e}" ${x.estado === e ? 'selected' : ''}>${e.charAt(0) + e.slice(1).toLowerCase()}</option>`).join('')}
          </select></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="text-muted">No hay citas solicitadas.</p>';
    }
  } catch (e) { c.innerHTML = `<p class="text-muted">${esc(e.message)}</p>`; }
}

async function assignAgent(ticketId, agenteId) {
  try {
    await api(`/tickets/${ticketId}`, { method: 'PUT', body: JSON.stringify({ agente_id: agenteId || null }) });
    toast('Asesor asignado', 'success');
  } catch (e) { toast(e.message, 'error'); }
}
async function changeUserRole(userId, rol) {
  try { await api(`/admin/usuarios/${userId}`, { method: 'PUT', body: JSON.stringify({ rol }) }); toast('Rol actualizado', 'success'); }
  catch (e) { toast(e.message, 'error'); }
}
async function toggleUser(userId, activo) {
  try {
    await api(`/admin/usuarios/${userId}`, { method: 'PUT', body: JSON.stringify({ activo }) });
    toast('Usuario actualizado', 'success');
    adminTab('usuarios', document.querySelectorAll('#page-admin .tab-btn')[3]);
  } catch (e) { toast(e.message, 'error'); }
}
async function updateCita(id, estado) {
  try { await api(`/admin/citas/${id}`, { method: 'PUT', body: JSON.stringify({ estado }) }); toast('Cita actualizada', 'success'); }
  catch (e) { toast(e.message, 'error'); }
}
async function toggleSuitStatus(id, estado) {
  try {
    await api(`/admin/trajes/${id}`, { method: 'PUT', body: JSON.stringify({ estado }) });
    toast('Estado actualizado', 'success');
    adminTab('trajes', document.querySelectorAll('#page-admin .tab-btn')[2]);
  } catch (e) { toast(e.message, 'error'); }
}
function toggleSuitForm() {
  const f = document.getElementById('adminSuitForm');
  f.classList.toggle('hidden');
  if (f.classList.contains('hidden')) return;
  f.innerHTML = `
    <h3 style="margin-bottom:20px;font-size:1.1rem">Nuevo traje</h3>
    <div class="form-row">
      <div class="form-group"><label class="form-label" for="nsSku">SKU</label><input class="form-input" id="nsSku" placeholder="DIF-TRJ-009"></div>
      <div class="form-group"><label class="form-label" for="nsNombre">Nombre</label><input class="form-input" id="nsNombre"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label" for="nsCat">Categoría</label><select class="form-select" id="nsCat">
        <option value="ETIQUETA">Etiqueta</option><option value="EJECUTIVO">Ejecutivo</option>
        <option value="CEREMONIA">Ceremonia</option><option value="CASUAL_SASTRERIA">Casual sastrería</option></select></div>
      <div class="form-group"><label class="form-label" for="nsCorte">Corte</label><select class="form-select" id="nsCorte">
        <option value="SLIM_FIT">Slim Fit</option><option value="TAILORED_FIT">Tailored Fit</option><option value="REGULAR_FIT">Regular Fit</option></select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label" for="nsColor">Color</label><input class="form-input" id="nsColor"></div>
      <div class="form-group"><label class="form-label" for="nsTejido">Tejido</label><input class="form-input" id="nsTejido"></div>
    </div>
    <div class="form-group"><label class="form-label" for="nsDesc">Descripción</label><textarea class="form-textarea" id="nsDesc" rows="2"></textarea></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label" for="nsPrecio">Precio (€)</label><input class="form-input" type="number" id="nsPrecio"></div>
      <div class="form-group"><label class="form-label" for="nsImg">URL de la imagen (opcional)</label><input class="form-input" id="nsImg" placeholder="img/mi-traje.jpg"></div>
    </div>
    <p class="form-label">Stock por talla</p>
    <div class="flex gap-12 flex-wrap mb-24">${TALLAS.map((t) => `<div style="width:84px"><label class="form-label" for="nsS${t}">${t}</label><input class="form-input" type="number" min="0" id="nsS${t}" value="0"></div>`).join('')}</div>
    <button class="btn btn-cta" onclick="createSuit()">Crear traje</button>`;
}
async function createSuit() {
  const v = (id) => document.getElementById(id).value.trim();
  const stock = {};
  TALLAS.forEach((t) => { stock[t] = parseInt(v(`nsS${t}`), 10) || 0; });
  try {
    await api('/admin/trajes', { method: 'POST', body: JSON.stringify({
      sku: v('nsSku'), nombre: v('nsNombre'), categoria: v('nsCat'), corte: v('nsCorte'),
      color: v('nsColor'), tejido: v('nsTejido'), descripcion: v('nsDesc'),
      precio: parseFloat(v('nsPrecio')), imagenUrl: v('nsImg'), stock,
    }) });
    toast('Traje creado', 'success');
    adminTab('trajes', document.querySelectorAll('#page-admin .tab-btn')[2]);
  } catch (e) { toast(e.message, 'error'); }
}

// ══════════════════════════════════════════════
// Arranque
// ══════════════════════════════════════════════
const io = new IntersectionObserver((entradas) => {
  entradas.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
}, { threshold: 0.12 });
document.querySelectorAll('#page-home .reveal, #page-home .panel-clip').forEach((el) => io.observe(el));

window.addEventListener('scroll', () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  document.getElementById('progressRail').style.width = `${max > 0 ? (window.scrollY / max) * 100 : 0}%`;
  revealInView();
}, { passive: true });

document.getElementById('citaFecha').min = new Date().toISOString().slice(0, 10);
updateMonogram();
selectFabric(0);
selectLapel(0);

comprobarApi().then((ok) => { if (ok) checkAuth(); });
