/**
 * Pruebas de humo de la API: siembra los datos y recorre los flujos reales
 * (pedidos, incidencias, permisos, citas y panel de administración).
 *
 * Dos formas de ejecutarlas:
 *
 *   npm run test:api
 *       Levanta un MongoDB en memoria. Requiere que la máquina pueda
 *       descargar el binario de mongodb.org la primera vez.
 *
 *   MONGODB_URI="mongodb://127.0.0.1:27017/differents_test" npm run test:api
 *       Usa la base que le indique. Úselo si tiene MongoDB instalado o si
 *       quiere probar contra un clúster de Atlas de pruebas.
 *
 *  las pruebas vacían las colecciones de la base indicada.
 * No probar nunca a una base con datos reales.
 */

let fallos = 0;
let pasadas = 0;

function comprobar(descripcion, condicion, detalle = '') {
  if (condicion) {
    pasadas += 1;
    console.log(`  ✓ ${descripcion}`);
  } else {
    fallos += 1;
    console.log(`  ✗ ${descripcion}${detalle ? ` → ${detalle}` : ''}`);
  }
}


async function prepararBase() {
  if (process.env.MONGODB_URI) {
    console.log(`· Usando la base indicada: ${process.env.MONGODB_URI.replace(/\/\/[^@]+@/, '//***@')}`);
    return { uri: process.env.MONGODB_URI, parar: async () => {} };
  }
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongo = await MongoMemoryServer.create();
    console.log('· MongoDB en memoria levantado');
    return { uri: mongo.getUri('differents_test'), parar: () => mongo.stop() };
  } catch (err) {
    console.error('\n✗ No se pudo levantar MongoDB en memoria:', err.message);
    console.error('\n  Esa opción descarga un binario de mongodb.org la primera vez.');
    console.error('  Si su red lo bloquea, lance las pruebas contra una base propia:\n');
    console.error('    MONGODB_URI="mongodb://127.0.0.1:27017/differents_test" npm run test:api\n');
    process.exit(1);
  }
  return null;
}

(async () => {
  const mongo = await prepararBase();
  process.env.MONGODB_URI = mongo.uri;
  process.env.JWT_SECRET = 'clave_de_pruebas_no_usar_en_produccion_0123456789';
  process.env.NODE_ENV = 'development';
  process.env.PORT = '0';

  const mongoose = require('mongoose');
  const { conectarDB } = require('../src/config/db');
  const { sembrar } = require('../src/seed');

  await conectarDB(mongo.uri);
  await sembrar({ conectar: false, desconectar: false, silencioso: true });

  const app = require('../src/server');
  const servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  const base = `http://127.0.0.1:${servidor.address().port}/api`;

  const pedir = async (ruta, { metodo = 'GET', token, cuerpo } = {}) => {
    const res = await fetch(base + ruta, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    return { estado: res.status, datos: await res.json().catch(() => ({})) };
  };
  const entrar = async (email, password) => (await pedir('/auth/login', { metodo: 'POST', cuerpo: { email, password } })).datos.token;

  console.log('\n── Salud y catálogo público ──');
  const salud = await pedir('/health');
  comprobar('GET /health responde ok', salud.datos.estado === 'ok' && salud.datos.mongodb === 'conectado');

  const catalogo = await pedir('/trajes');
  comprobar('GET /trajes devuelve los 8 trajes', catalogo.datos.total === 8, `total=${catalogo.datos.total}`);
  comprobar('el traje incluye stockTotal calculado', typeof catalogo.datos.trajes[0].stockTotal === 'number');
  comprobar('el traje expone "id" y no "_id"', !!catalogo.datos.trajes[0].id && !catalogo.datos.trajes[0]._id);

  const filtrado = await pedir('/trajes?categoria=ETIQUETA');
  comprobar('filtro por categoría funciona', filtrado.datos.trajes.every((t) => t.categoria === 'ETIQUETA'));

  const buscado = await pedir('/trajes?buscar=milano');
  comprobar('búsqueda libre encuentra "Milano"', buscado.datos.trajes.some((t) => t.nombre === 'Milano'));

  console.log('\n── Autenticación ──');
  const tokenJuan = await entrar('juan@correo.com', 'Cliente2026!');
  comprobar('login de cliente devuelve token', !!tokenJuan);

  const yo = await pedir('/auth/me', { token: tokenJuan });
  comprobar('GET /auth/me devuelve al usuario', yo.datos.user?.email === 'juan@correo.com');
  comprobar('la respuesta NO incluye el hash de la contraseña', yo.datos.user?.passwordHash === undefined);

  const malPass = await pedir('/auth/login', { metodo: 'POST', cuerpo: { email: 'juan@correo.com', password: 'incorrecta' } });
  comprobar('contraseña incorrecta devuelve 401', malPass.estado === 401);

  const altaConRol = await pedir('/auth/register', { metodo: 'POST', cuerpo: {
    email: 'intruso@correo.com', password: 'Prueba2026', nombre: 'Intruso', rol: 'ADMIN',
  } });
  comprobar('el registro ignora el rol enviado y crea CLIENTE', altaConRol.datos.user?.rol === 'CLIENTE', `rol=${altaConRol.datos.user?.rol}`);

  const passDebil = await pedir('/auth/register', { metodo: 'POST', cuerpo: {
    email: 'otro@correo.com', password: 'corta', nombre: 'Otro',
  } });
  comprobar('rechaza contraseñas débiles', passDebil.estado === 400);

  console.log('\n── Pedidos y stock ──');
  const traje = catalogo.datos.trajes.find((t) => t.sku === 'DIF-TRJ-002');
  const stockAntes = traje.stock['50'];
  const pedido = await pedir('/pedidos', { metodo: 'POST', token: tokenJuan, cuerpo: { traje_id: traje.id, talla: '50' } });
  comprobar('el cliente crea un pedido', pedido.estado === 201 && /^PED-\d{4}-\d{4}$/.test(pedido.datos.numeroPedido), pedido.datos.numeroPedido);

  const trasPedido = await pedir(`/trajes/${traje.id}`);
  comprobar('el stock baja en una unidad', trasPedido.datos.traje.stock['50'] === stockAntes - 1,
    `${stockAntes} → ${trasPedido.datos.traje.stock['50']}`);

  const sinStock = await pedir('/pedidos', { metodo: 'POST', token: tokenJuan, cuerpo: { traje_id: traje.id, talla: '50', cantidad: 999 } });
  comprobar('no deja pedir más unidades de las que hay', sinStock.estado === 400);

  const tokenPedro = await entrar('pedro@correo.com', 'Cliente2026!');
  const misPedidos = await pedir('/pedidos', { token: tokenPedro });
  comprobar('cada cliente ve sólo sus pedidos', misPedidos.datos.pedidos.every((p) => p.trajeNombre === 'Roma'));

  console.log('\n── Incidencias ──');
  const cats = await pedir('/categorias-soporte');
  comprobar('las categorías de soporte son públicas', cats.estado === 200 && cats.datos.categorias.length === 5);

  const nuevoTicket = await pedir('/tickets', { metodo: 'POST', token: tokenJuan, cuerpo: {
    asunto: 'Consulta sobre la manga del Roma',
    descripcion: 'Quisiera acortar la manga dos centímetros antes de la entrega.',
    categoria_id: cats.datos.categorias[0].id,
    prioridad: 'ALTA',
  } });
  comprobar('el cliente abre una incidencia', nuevoTicket.estado === 201 && /^DIF-\d{4}-\d{4}$/.test(nuevoTicket.datos.codigo), nuevoTicket.datos.codigo);
  const ticketId = nuevoTicket.datos.ticket.id;
  comprobar('la descripción queda como primer mensaje', nuevoTicket.datos.ticket.mensajes.length === 1);

  const pedidoAjeno = await pedir('/tickets', { metodo: 'POST', token: tokenPedro, cuerpo: {
    asunto: 'Intento de vincular pedido ajeno',
    descripcion: 'Esto no debería permitirse de ninguna manera.',
    categoria_id: cats.datos.categorias[0].id,
    pedido_id: pedido.datos.pedido.id,
  } });
  comprobar('no se puede vincular un pedido de otro cliente (403)', pedidoAjeno.estado === 403, `estado=${pedidoAjeno.estado}`);

  console.log('\n── Protección IDOR ──');
  const robo = await pedir(`/tickets/${ticketId}`, { token: tokenPedro });
  comprobar('otro cliente NO puede leer la incidencia (403)', robo.estado === 403, `estado=${robo.estado}`);

  const sinToken = await pedir(`/tickets/${ticketId}`);
  comprobar('sin token devuelve 401', sinToken.estado === 401);

  const idInventado = await pedir('/tickets/000000000000000000000000', { token: tokenJuan });
  comprobar('un id inexistente devuelve 404', idInventado.estado === 404);

  const idRoto = await pedir('/tickets/no-es-un-id', { token: tokenJuan });
  comprobar('un id con formato inválido devuelve 400', idRoto.estado === 400);

  console.log('\n── Ciclo de vida y notas internas ──');
  const tokenElena = await entrar('sastre@differents.com', 'Agente2026!');

  const aCurso = await pedir(`/tickets/${ticketId}`, { metodo: 'PUT', token: tokenElena, cuerpo: { estado: 'EN_CURSO' } });
  comprobar('el asesor pasa la incidencia a EN_CURSO', aCurso.datos.ticket?.estado === 'EN_CURSO');
  comprobar('la incidencia se autoasigna al asesor', !!aCurso.datos.ticket?.agenteNombre, aCurso.datos.ticket?.agenteNombre);

  await pedir(`/tickets/${ticketId}/mensajes`, { metodo: 'POST', token: tokenElena, cuerpo: {
    mensaje: 'Aviso al taller: revisar el patrón antes de tocar la manga.', es_nota_interna: true,
  } });
  const vistaAgente = await pedir(`/tickets/${ticketId}`, { token: tokenElena });
  const vistaCliente = await pedir(`/tickets/${ticketId}`, { token: tokenJuan });
  comprobar('el asesor ve la nota interna', vistaAgente.datos.ticket.mensajes.some((m) => m.esNotaInterna));
  comprobar('el cliente NO ve la nota interna', !vistaCliente.datos.ticket.mensajes.some((m) => m.esNotaInterna));
  comprobar('el cliente NO recibe el historial de auditoría', vistaCliente.datos.ticket.historial === undefined);
  comprobar('el asesor sí recibe el historial', Array.isArray(vistaAgente.datos.ticket.historial));

  const notaDeCliente = await pedir(`/tickets/${ticketId}/mensajes`, { metodo: 'POST', token: tokenJuan, cuerpo: {
    mensaje: 'Intento marcar esto como nota interna.', es_nota_interna: true,
  } });
  const trasIntento = await pedir(`/tickets/${ticketId}`, { token: tokenElena });
  const ultimoDelCliente = trasIntento.datos.ticket.mensajes.filter((m) => m.autorRol === 'CLIENTE').pop();
  comprobar('un cliente no puede crear notas internas', notaDeCliente.estado === 201 && ultimoDelCliente.esNotaInterna === false);

  const saltoInvalido = await pedir(`/tickets/${ticketId}`, { metodo: 'PUT', token: tokenElena, cuerpo: { estado: 'ABIERTO' } });
  comprobar('rechaza una transición no permitida (409)', saltoInvalido.estado === 409, `estado=${saltoInvalido.estado}`);

  await pedir(`/tickets/${ticketId}`, { metodo: 'PUT', token: tokenElena, cuerpo: { estado: 'PENDIENTE_CLIENTE' } });
  await pedir(`/tickets/${ticketId}/mensajes`, { metodo: 'POST', token: tokenJuan, cuerpo: { mensaje: 'Confirmo que me viene bien el jueves.' } });
  const trasResponder = await pedir(`/tickets/${ticketId}`, { token: tokenElena });
  comprobar('si el cliente responde, vuelve a EN_CURSO', trasResponder.datos.ticket.estado === 'EN_CURSO', trasResponder.datos.ticket.estado);

  const subirPrioridad = await pedir(`/tickets/${ticketId}`, { metodo: 'PUT', token: tokenJuan, cuerpo: { prioridad: 'BAJA' } });
  comprobar('el cliente no puede cambiar la prioridad (403)', subirPrioridad.estado === 403);

  await pedir(`/tickets/${ticketId}`, { metodo: 'PUT', token: tokenElena, cuerpo: { estado: 'RESUELTO' } });
  const cierre = await pedir(`/tickets/${ticketId}`, { metodo: 'PUT', token: tokenJuan, cuerpo: { estado: 'CERRADO' } });
  comprobar('el cliente confirma el cierre de una resuelta', cierre.datos.ticket?.estado === 'CERRADO');

  const mensajeEnCerrada = await pedir(`/tickets/${ticketId}/mensajes`, { metodo: 'POST', token: tokenJuan, cuerpo: { mensaje: 'Una cosa más.' } });
  comprobar('no se escribe en una incidencia cerrada (409)', mensajeEnCerrada.estado === 409);

  const reabrirAgente = await pedir(`/tickets/${ticketId}`, { metodo: 'PUT', token: tokenElena, cuerpo: { estado: 'EN_CURSO' } });
  comprobar('un asesor no reabre una cerrada (403)', reabrirAgente.estado === 403);

  const tokenAdmin = await entrar('admin@differents.com', 'Admin2026!');
  const reabrirAdmin = await pedir(`/tickets/${ticketId}`, { metodo: 'PUT', token: tokenAdmin, cuerpo: { estado: 'EN_CURSO' } });
  comprobar('el administrador sí reabre una cerrada', reabrirAdmin.datos.ticket?.estado === 'EN_CURSO');

  console.log('\n── Citas privadas ──');
  const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const cita = await pedir('/citas', { metodo: 'POST', cuerpo: {
    nombre: 'Alejandro García Pérez', ciudad: 'Madrid', ocasion: 'Boda', fecha_preferida: manana,
  } });
  comprobar('un visitante reserva cita sin cuenta', cita.estado === 201);

  const ciudadMala = await pedir('/citas', { metodo: 'POST', cuerpo: {
    nombre: 'Alguien', ciudad: 'Roma', ocasion: 'Boda', fecha_preferida: manana,
  } });
  comprobar('rechaza una ciudad fuera de la lista (400)', ciudadMala.estado === 400);

  const fechaPasada = await pedir('/citas', { metodo: 'POST', cuerpo: {
    nombre: 'Alguien Más', ciudad: 'Madrid', ocasion: 'Boda', fecha_preferida: '2020-01-01',
  } });
  comprobar('rechaza una fecha pasada (400)', fechaPasada.estado === 400);

  console.log('\n── Panel de administración ──');
  const metricas = await pedir('/admin/metricas', { token: tokenAdmin });
  comprobar('las métricas se calculan con agregación', metricas.estado === 200 && Array.isArray(metricas.datos.porEstado));
  comprobar('incluye los ingresos acumulados', typeof metricas.datos.ingresosTotales === 'number', `${metricas.datos.ingresosTotales} €`);

  const metricasCliente = await pedir('/admin/metricas', { token: tokenJuan });
  comprobar('un cliente no accede al panel (403)', metricasCliente.estado === 403);

  const autoDegradar = await pedir(`/admin/usuarios/${(await pedir('/auth/me', { token: tokenAdmin })).datos.user.id}`,
    { metodo: 'PUT', token: tokenAdmin, cuerpo: { rol: 'CLIENTE' } });
  comprobar('el administrador no puede degradarse a sí mismo (409)', autoDegradar.estado === 409);

  const nuevoTraje = await pedir('/admin/trajes', { metodo: 'POST', token: tokenAdmin, cuerpo: {
    sku: 'DIF-TRJ-009', nombre: 'Como', categoria: 'EJECUTIVO', corte: 'SLIM_FIT',
    color: 'Gris Humo', tejido: 'Lana Super 140s', precio: 1390, stock: { 50: 4 },
  } });
  comprobar('el administrador crea un traje', nuevoTraje.estado === 201);

  const skuRepetido = await pedir('/admin/trajes', { metodo: 'POST', token: tokenAdmin, cuerpo: {
    sku: 'DIF-TRJ-009', nombre: 'Duplicado', categoria: 'EJECUTIVO', corte: 'SLIM_FIT',
    color: 'Gris', tejido: 'Lana', precio: 1000,
  } });
  comprobar('rechaza un SKU repetido (409)', skuRepetido.estado === 409);

  const borrado = await pedir(`/admin/trajes/${nuevoTraje.datos.traje.id}`, { metodo: 'DELETE', token: tokenAdmin });
  comprobar('el borrado sólo desactiva, no elimina', borrado.datos.traje?.estado === 'INACTIVO');

  const citasAdmin = await pedir('/admin/citas', { token: tokenAdmin });
  comprobar('el administrador ve las citas solicitadas', citasAdmin.datos.total >= 2, `total=${citasAdmin.datos.total}`);

  console.log('\n── Sitio web ──');
  const web = await fetch(`http://127.0.0.1:${servidor.address().port}/`);
  const html = await web.text();
  comprobar('la página se sirve correctamente', web.status === 200 && html.includes('<!DOCTYPE html>'));
  comprobar('contiene los seis capítulos', ['cap1', 'cap2', 'cap3', 'cap4', 'cap5', 'cap6'].every((c) => html.includes(`id="${c}"`)));

  const rutaInventada = await pedir('/no-existe');
  comprobar('una ruta de API inexistente devuelve 404 en JSON', rutaInventada.estado === 404 && !!rutaInventada.datos.error);

  console.log(`\n═══════════════════════════════════════`);
  console.log(` ${pasadas} pruebas superadas · ${fallos} fallidas`);
  console.log(`═══════════════════════════════════════\n`);

  servidor.close();
  await mongoose.disconnect();
  await mongo.parar();
  process.exit(fallos === 0 ? 0 : 1);
})().catch((err) => {
  console.error('\n✗ Las pruebas se interrumpieron:', err);
  process.exit(1);
});
