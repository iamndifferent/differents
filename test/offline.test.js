/**
 * Pruebas que NO necesitan MongoDB.
 *
 *   npm run test:offline
 *
 * Mongoose valida documentos en memoria sin conexión, así que aquí se
 * comprueban los esquemas, el cifrado de contraseñas, los tokens, las
 * transiciones de estado y la capa HTTP previa a la base de datos.
 *
 * Para los flujos completos (pedidos, incidencias de principio a fin)
 * use test/smoke.test.js, que sí necesita una base.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'clave_de_pruebas_offline_0123456789abcdef';
process.env.NODE_ENV = 'development';
process.env.BCRYPT_SALT_ROUNDS = '4'; // rápido: estas pruebas no miden seguridad real

const jwt = require('jsonwebtoken');

let pasadas = 0;
let fallos = 0;
/** Valida un documento en memoria sin el aviso de obsolescencia de Mongoose. */
function errores(doc) {
  const avisar = process.emitWarning;
  process.emitWarning = () => {};
  try { return doc.validateSync(); } finally { process.emitWarning = avisar; }
}

function comprobar(descripcion, condicion, detalle = '') {
  if (condicion) { pasadas += 1; console.log(`  ✓ ${descripcion}`); }
  else { fallos += 1; console.log(`  ✗ ${descripcion}${detalle ? ` → ${detalle}` : ''}`); }
}

(async () => {
  const Usuario = require('../src/models/Usuario');
  const Traje = require('../src/models/Traje');
  const Ticket = require('../src/models/Ticket');
  const Cita = require('../src/models/Cita');
  const Pedido = require('../src/models/Pedido');

  console.log('\n── Esquema de Usuario ──');
  const sinNada = new Usuario({});
  const errSinNada = errores(sinNada);
  comprobar('exige correo, contraseña y nombre', !!errSinNada?.errors.email && !!errSinNada?.errors.nombre);

  const correoMalo = new Usuario({ email: 'esto-no-es-correo', passwordHash: 'x', nombre: 'Ana' });
  comprobar('rechaza un correo con formato inválido', !!errores(correoMalo)?.errors.email);

  const rolInventado = new Usuario({ email: 'a@b.com', passwordHash: 'x', nombre: 'Ana', rol: 'SUPERADMIN' });
  comprobar('rechaza un rol fuera de la lista', !!errores(rolInventado)?.errors.rol);

  const valido = new Usuario({ email: 'Ana@Ejemplo.COM', passwordHash: 'x', nombre: 'Ana', apellidos: 'Pérez' });
  comprobar('el rol por defecto es CLIENTE', valido.rol === 'CLIENTE');
  comprobar('normaliza el correo a minúsculas', valido.email === 'ana@ejemplo.com', valido.email);
  comprobar('compone el nombre completo', valido.nombreCompleto === 'Ana Pérez');

  console.log('\n── Contraseñas ──');
  await valido.establecerPassword('Secreta2026');
  comprobar('la contraseña se guarda cifrada, no en claro', valido.passwordHash !== 'Secreta2026' && valido.passwordHash.startsWith('$2'));
  comprobar('acepta la contraseña correcta', await valido.comprobarPassword('Secreta2026'));
  comprobar('rechaza una contraseña incorrecta', !await valido.comprobarPassword('Secreta2025'));

  console.log('\n── Salida JSON ──');
  const json = valido.toJSON();
  comprobar('el JSON NUNCA incluye el hash de la contraseña', json.passwordHash === undefined);
  comprobar('expone "id" en lugar de "_id"', typeof json.id === 'string' && json._id === undefined);
  comprobar('oculta el campo interno __v', json.__v === undefined);

  console.log('\n── Tokens JWT ──');
  const { firmarToken } = require('../src/middleware/auth');
  const token = firmarToken(valido);
  const datos = jwt.verify(token, process.env.JWT_SECRET);
  comprobar('el token lleva id y rol', datos.id === String(valido._id) && datos.rol === 'CLIENTE');
  comprobar('el token NO lleva la contraseña', !JSON.stringify(datos).includes('passwordHash'));
  let firmaMala = false;
  try { jwt.verify(token, 'otra_clave_distinta'); } catch { firmaMala = true; }
  comprobar('un token firmado con otra clave se rechaza', firmaMala);

  const { puedeAcceder } = require('../src/middleware/auth');
  const cliente = new Usuario({ email: 'c@b.com', passwordHash: 'x', nombre: 'C', rol: 'CLIENTE' });
  const otro = new Usuario({ email: 'o@b.com', passwordHash: 'x', nombre: 'O', rol: 'CLIENTE' });
  const agente = new Usuario({ email: 'a2@b.com', passwordHash: 'x', nombre: 'A', rol: 'AGENTE' });
  comprobar('un cliente accede a lo suyo', puedeAcceder(cliente, cliente._id));
  comprobar('un cliente NO accede a lo de otro (IDOR)', !puedeAcceder(cliente, otro._id));
  comprobar('un asesor accede a la cola de soporte', puedeAcceder(agente, otro._id));
  comprobar('sin usuario no se accede a nada', !puedeAcceder(null, otro._id));

  console.log('\n── Esquema de Traje ──');
  const trajeMal = new Traje({ sku: 'X', nombre: 'Y', categoria: 'DEPORTIVO', corte: 'SLIM_FIT', color: 'A', tejido: 'B', precio: 10 });
  comprobar('rechaza una categoría inventada', !!errores(trajeMal)?.errors.categoria);

  const precioNegativo = new Traje({ sku: 'X', nombre: 'Y', categoria: 'ETIQUETA', corte: 'SLIM_FIT', color: 'A', tejido: 'B', precio: -5 });
  comprobar('rechaza un precio negativo', !!errores(precioNegativo)?.errors.precio);

  const traje = new Traje({
    sku: 'dif-trj-100', nombre: 'Prueba', categoria: 'ETIQUETA', corte: 'SLIM_FIT',
    color: 'Negro', tejido: 'Lana', precio: 1200, stock: { 48: 2, 50: 3 },
  });
  comprobar('el SKU se guarda en mayúsculas', traje.sku === 'DIF-TRJ-100', traje.sku);
  comprobar('suma el stock total de todas las tallas', traje.toJSON().stockTotal === 5, String(traje.toJSON().stockTotal));
  comprobar('las tallas sin stock valen 0', traje.stock['56'] === 0);

  console.log('\n── Esquema de Pedido ──');
  const mongoose = require('mongoose');
  const idFalso = new mongoose.Types.ObjectId();
  const pedidoTallaMala = new Pedido({
    numeroPedido: 'PED-2026-0001', cliente: idFalso, traje: idFalso, trajeNombre: 'X',
    talla: '44', precioUnitario: 100, precioTotal: 100,
  });
  comprobar('rechaza una talla fuera del rango 46-56', !!errores(pedidoTallaMala)?.errors.talla);

  console.log('\n── Esquema de Ticket ──');
  const asuntoCorto = new Ticket({ codigo: 'DIF-2026-0001', asunto: 'Hola', descripcion: 'Descripción suficientemente larga', cliente: idFalso, clienteNombre: 'X' });
  comprobar('rechaza un asunto de menos de 5 caracteres', !!errores(asuntoCorto)?.errors.asunto);

  const estadoRaro = new Ticket({ codigo: 'DIF-2026-0002', asunto: 'Asunto válido', descripcion: 'Descripción suficientemente larga', cliente: idFalso, clienteNombre: 'X', estado: 'ARCHIVADO' });
  comprobar('rechaza un estado fuera del ciclo de vida', !!errores(estadoRaro)?.errors.estado);

  const ticket = new Ticket({ codigo: 'DIF-2026-0003', asunto: 'Asunto válido', descripcion: 'Descripción suficientemente larga', cliente: idFalso, clienteNombre: 'Juan' });
  comprobar('un ticket nace ABIERTO y con prioridad MEDIA', ticket.estado === 'ABIERTO' && ticket.prioridad === 'MEDIA');
  ticket.anotarCambio(agente, 'estado', 'ABIERTO', 'EN_CURSO');
  comprobar('anotarCambio registra la auditoría', ticket.historial.length === 1
    && ticket.historial[0].valorNuevo === 'EN_CURSO' && ticket.historial[0].autorRol === 'AGENTE');
  ticket.mensajes.push({ autor: idFalso, autorNombre: 'Elena', autorRol: 'AGENTE', mensaje: 'Nota', esNotaInterna: true });
  comprobar('los mensajes se guardan dentro del propio ticket', ticket.mensajes.length === 1 && ticket.mensajes[0].esNotaInterna === true);

  console.log('\n── Ciclo de vida de las incidencias ──');
  const { TRANSICIONES } = require('../src/routes/tickets.routes');
  comprobar('de ABIERTO se puede pasar a EN_CURSO', TRANSICIONES.ABIERTO.includes('EN_CURSO'));
  comprobar('de CERRADO NO se puede volver a RESUELTO', !TRANSICIONES.CERRADO.includes('RESUELTO'));
  comprobar('de CERRADO sólo se puede reabrir a EN_CURSO', TRANSICIONES.CERRADO.length === 1 && TRANSICIONES.CERRADO[0] === 'EN_CURSO');
  comprobar('de RESUELTO se puede cerrar o reabrir', TRANSICIONES.RESUELTO.includes('CERRADO') && TRANSICIONES.RESUELTO.includes('EN_CURSO'));
  comprobar('todos los estados del modelo están en el mapa', Ticket.ESTADOS.every((e) => Array.isArray(TRANSICIONES[e])));

  console.log('\n── Esquema de Cita ──');
  const ciudadMala = new Cita({ nombre: 'Alejandro García', ciudad: 'Roma', ocasion: 'Boda', fechaPreferida: new Date() });
  comprobar('rechaza una ciudad que no es atelier', !!errores(ciudadMala)?.errors.ciudad);
  const ocasionMala = new Cita({ nombre: 'Alejandro García', ciudad: 'Madrid', ocasion: 'Cumpleaños', fechaPreferida: new Date() });
  comprobar('rechaza una ocasión fuera de la lista', !!errores(ocasionMala)?.errors.ocasion);
  const citaOk = new Cita({ nombre: 'Alejandro García', ciudad: 'Madrid', ocasion: 'Boda', fechaPreferida: new Date() });
  comprobar('una cita válida pasa la validación', !errores(citaOk));
  comprobar('la cita nace como SOLICITADA', citaOk.estado === 'SOLICITADA');

  console.log('\n── Capa HTTP (sin base de datos) ──');
  const app = require('../src/server');
  const servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  const raiz = `http://127.0.0.1:${servidor.address().port}`;

  const pedir = async (ruta, opts = {}) => {
    const res = await fetch(raiz + ruta, {
      method: opts.metodo || 'GET',
      headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
      body: opts.cuerpo ? JSON.stringify(opts.cuerpo) : undefined,
    });
    return { estado: res.status, cabeceras: res.headers, datos: await res.json().catch(() => null) };
  };

  const salud = await pedir('/api/health');
  comprobar('/api/health responde', salud.estado === 200 && salud.datos.estado === 'ok');
  comprobar('/api/health avisa de que MongoDB no está conectado', salud.datos.mongodb === 'desconectado', salud.datos.mongodb);

  const web = await fetch(raiz + '/');
  const html = await web.text();
  comprobar('sirve la página de inicio', web.status === 200 && html.includes('<!DOCTYPE html>'));
  comprobar('la página incluye los seis capítulos', ['cap1', 'cap2', 'cap3', 'cap4', 'cap5', 'cap6'].every((c) => html.includes(`id="${c}"`)));
  comprobar('la página carga app.js como archivo externo', html.includes('src="app.js"'));
  comprobar('envía cabecera de seguridad CSP', !!web.headers.get('content-security-policy'));
  comprobar('la CSP permite las tipografías de Google', (web.headers.get('content-security-policy') || '').includes('fonts.googleapis.com'));

  const appJs = await fetch(raiz + '/app.js');
  comprobar('sirve app.js', appJs.status === 200);
  const imagen = await fetch(raiz + '/img/logo.png');
  comprobar('sirve las imágenes', imagen.status === 200);

  const rutaFantasma = await pedir('/api/no-existe');
  comprobar('una ruta de API inexistente devuelve 404 en JSON', rutaFantasma.estado === 404 && !!rutaFantasma.datos.error);

  const rutaWebFantasma = await fetch(raiz + '/cualquier/cosa');
  comprobar('una ruta web devuelve la página (una sola página)', rutaWebFantasma.status === 200);

  const sinToken = await pedir('/api/tickets');
  comprobar('sin token devuelve 401', sinToken.estado === 401, `estado=${sinToken.estado}`);

  const tokenRoto = await pedir('/api/tickets', { token: 'esto.no.es.un.token' });
  comprobar('un token manipulado devuelve 401', tokenRoto.estado === 401);

  const idRoto = await pedir('/api/trajes/no-es-un-objectid');
  comprobar('un id con formato inválido devuelve 400 antes de consultar', idRoto.estado === 400);

  const citaInvalida = await pedir('/api/citas', { metodo: 'POST', cuerpo: { nombre: 'A', ciudad: 'Roma', ocasion: 'Boda', fecha_preferida: '2027-01-01' } });
  comprobar('la validación de la cita corta antes de la base de datos', citaInvalida.estado === 400 && citaInvalida.datos.detalles.length === 2,
    JSON.stringify(citaInvalida.datos));

  const loginInvalido = await pedir('/api/auth/login', { metodo: 'POST', cuerpo: { email: 'no-es-correo' } });
  comprobar('el login valida el formato antes de consultar', loginInvalido.estado === 400);

  const cuerpoEnorme = await fetch(`${raiz}/api/citas`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: 'x'.repeat(300000) }),
  });
  comprobar('rechaza cuerpos de petición desmesurados', cuerpoEnorme.status === 413, `estado=${cuerpoEnorme.status}`);

  servidor.close();

  console.log('\n═══════════════════════════════════════');
  console.log(` ${pasadas} pruebas superadas · ${fallos} fallidas`);
  console.log('═══════════════════════════════════════\n');
  process.exit(fallos === 0 ? 0 : 1);
})().catch((err) => {
  console.error('\n✗ Las pruebas se interrumpieron:', err);
  process.exit(1);
});
