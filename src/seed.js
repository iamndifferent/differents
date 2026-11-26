/**
 * Carga inicial de datos.
 *
 *   npm run seed            
 *   npm run seed -- --keep  
 *
 */
require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');
const { conectarDB } = require('./config/db');
const Usuario = require('./models/Usuario');
const Traje = require('./models/Traje');
const Pedido = require('./models/Pedido');
const Ticket = require('./models/Ticket');
const Cita = require('./models/Cita');
const CategoriaSoporte = require('./models/CategoriaSoporte');
const { Contador, siguienteCodigo } = require('./models/Contador');

const CONSERVAR = process.argv.includes('--keep');

const USUARIOS = [
  { email: 'admin@differents.com', password: 'Admin2026!', nombre: 'Carlos', apellidos: 'Lema Vargas', rol: 'ADMIN', telefono: '+34 910 000 001' },
  { email: 'sastre@differents.com', password: 'Agente2026!', nombre: 'Elena', apellidos: 'Ferrer Soto', rol: 'AGENTE', telefono: '+34 910 000 002' },
  { email: 'soporte@differents.com', password: 'Agente2026!', nombre: 'Marco', apellidos: 'Bianchi Ruiz', rol: 'AGENTE', telefono: '+34 910 000 003' },
  { email: 'juan@correo.com', password: 'Cliente2026!', nombre: 'Juan', apellidos: 'Delgado Ríos', rol: 'CLIENTE', telefono: '+34 600 111 222', medidas: { pecho: 100, cintura: 86, cadera: 98, hombros: 46, manga: 64, largoPantalon: 104 } },
  { email: 'pedro@correo.com', password: 'Cliente2026!', nombre: 'Pedro', apellidos: 'Ibáñez Luna', rol: 'CLIENTE', telefono: '+34 600 333 444' },
];

const CATEGORIAS = [
  { nombre: 'Cambio de Talla', descripcion: 'Solicitudes de cambio por una talla distinta' },
  { nombre: 'Arreglos de Sastrería', descripcion: 'Ajustes de bajos, mangas, cintura y hombros' },
  { nombre: 'Estado de Pedido', descripcion: 'Consultas sobre plazos, envío y entrega' },
  { nombre: 'Asesoría de Etiqueta', descripcion: 'Dudas sobre protocolo y combinaciones' },
  { nombre: 'Devoluciones y Facturación', descripcion: 'Devoluciones, reembolsos y facturas' },
];

const TRAJES = [
  { sku: 'DIF-TRJ-001', nombre: 'Milano', categoria: 'ETIQUETA', corte: 'SLIM_FIT', color: 'Negro Medianoche', tejido: 'Lana Virgen Super 150s', precio: 1890, descripcion: 'Esmoquin de solapa de pico con ribete de seda. La pieza de gala por excelencia, pensada para la luz de la noche.', stock: { 46: 2, 48: 4, 50: 5, 52: 3, 54: 2, 56: 1 } },
  { sku: 'DIF-TRJ-002', nombre: 'Roma', categoria: 'EJECUTIVO', corte: 'TAILORED_FIT', color: 'Azul Marino', tejido: 'Lana Merina Super 130s', precio: 1290, descripcion: 'Traje de dos piezas con solapa de muesca. El azul marino que funciona de la reunión de la mañana a la cena del jueves.', stock: { 46: 3, 48: 6, 50: 8, 52: 6, 54: 3, 56: 2 } },
  { sku: 'DIF-TRJ-003', nombre: 'Firenze', categoria: 'CEREMONIA', corte: 'SLIM_FIT', color: 'Gris Perla', tejido: 'Lana y Seda', precio: 1650, descripcion: 'Chaqué contemporáneo en gris perla con chaleco a juego. Concebido para bodas de mañana.', stock: { 46: 1, 48: 3, 50: 4, 52: 3, 54: 1, 56: 0 } },
  { sku: 'DIF-TRJ-004', nombre: 'Nápoles', categoria: 'CASUAL_SASTRERIA', corte: 'REGULAR_FIT', color: 'Beige Arena', tejido: 'Lino y Lana', precio: 890, descripcion: 'Chaqueta sin estructura de hombro, al estilo napolitano. Ligera, fresca y cómoda desde la primera hora.', stock: { 46: 4, 48: 5, 50: 6, 52: 4, 54: 3, 56: 2 } },
  { sku: 'DIF-TRJ-005', nombre: 'Torino', categoria: 'EJECUTIVO', corte: 'SLIM_FIT', color: 'Gris Antracita', tejido: 'Lana Virgen Super 120s', precio: 1190, descripcion: 'Silueta ajustada en gris antracita, con pinza trasera y pantalón de caída recta.', stock: { 46: 2, 48: 5, 50: 7, 52: 5, 54: 2, 56: 1 } },
  { sku: 'DIF-TRJ-006', nombre: 'Venetian', categoria: 'ETIQUETA', corte: 'TAILORED_FIT', color: 'Azul Noche', tejido: 'Lana Mohair', precio: 2150, descripcion: 'Esmoquin cruzado en mohair con reflejo discreto. Para quien prefiere el azul noche al negro.', stock: { 46: 1, 48: 2, 50: 3, 52: 2, 54: 1, 56: 0 } },
  { sku: 'DIF-TRJ-007', nombre: 'Sicilia', categoria: 'CEREMONIA', corte: 'TAILORED_FIT', color: 'Azul Cobalto', tejido: 'Lana Fresco', precio: 1450, descripcion: 'Traje de tres piezas en azul cobalto, con chaleco cruzado. Pensado para ceremonias de verano.', stock: { 46: 2, 48: 4, 50: 5, 52: 4, 54: 2, 56: 1 } },
  { sku: 'DIF-TRJ-008', nombre: 'Lombardi', categoria: 'CASUAL_SASTRERIA', corte: 'REGULAR_FIT', color: 'Verde Oliva', tejido: 'Algodón Stretch Premium', precio: 790, descripcion: 'Traje informal en verde oliva. Se lleva entero o por piezas, con camisa o con jersey fino.', stock: { 46: 3, 48: 6, 50: 7, 52: 5, 54: 3, 56: 2 } },
];

async function sembrar(opciones = {}) {
  const { conectar = true, desconectar = true, silencioso = false, conservar = CONSERVAR } = opciones;
  const log = silencioso ? () => {} : console.log;

  if (conectar) await conectarDB();

  if (!conservar) {
    log('· Vaciando colecciones…');
    await Promise.all([
      Usuario.deleteMany({}), Traje.deleteMany({}), Pedido.deleteMany({}),
      Ticket.deleteMany({}), Cita.deleteMany({}), CategoriaSoporte.deleteMany({}),
      Contador.deleteMany({}),
    ]);
  }

  // ── Usuarios ──
  const usuarios = {};
  for (const datos of USUARIOS) {
    let usuario = await Usuario.findOne({ email: datos.email });
    if (!usuario) {
      usuario = new Usuario({
        email: datos.email,
        nombre: datos.nombre,
        apellidos: datos.apellidos,
        telefono: datos.telefono || '',
        rol: datos.rol,
        medidas: datos.medidas || {},
      });
      await usuario.establecerPassword(datos.password);
      await usuario.save();
    }
    usuarios[datos.email] = usuario;
  }
  log(`✓ ${Object.keys(usuarios).length} usuarios`);

  // ── Categorías ──
  const categorias = {};
  for (const datos of CATEGORIAS) {
    const cat = await CategoriaSoporte.findOneAndUpdate(
      { nombre: datos.nombre }, { $setOnInsert: datos }, { new: true, upsert: true },
    );
    categorias[datos.nombre] = cat;
  }
  log(`✓ ${Object.keys(categorias).length} categorías de soporte`);

  // ── Trajes ──
  const trajes = {};
  for (const datos of TRAJES) {
    const traje = await Traje.findOneAndUpdate(
      { sku: datos.sku }, { $setOnInsert: datos }, { new: true, upsert: true },
    );
    trajes[datos.sku] = traje;
  }
  log(`✓ ${Object.keys(trajes).length} trajes en catálogo`);

  // ── Pedidos de ejemplo ──
  const juan = usuarios['juan@correo.com'];
  const pedro = usuarios['pedro@correo.com'];

  if (await Pedido.countDocuments() === 0) {
    const milano = trajes['DIF-TRJ-001'];
    const roma = trajes['DIF-TRJ-002'];

    await Pedido.create({
      numeroPedido: await siguienteCodigo('PED'),
      cliente: juan._id, traje: milano._id, trajeNombre: milano.nombre,
      talla: '50', cantidad: 1, precioUnitario: milano.precio, precioTotal: milano.precio,
      estado: 'ENTREGADO', notas: 'Entregado en tienda',
    });
    await Pedido.create({
      numeroPedido: await siguienteCodigo('PED'),
      cliente: pedro._id, traje: roma._id, trajeNombre: roma.nombre,
      talla: '52', cantidad: 1, precioUnitario: roma.precio, precioTotal: roma.precio,
      estado: 'EN_PREPARACION',
    });
    log('✓ 2 pedidos de ejemplo');
  }

  // ── Incidencia de ejemplo ──
  if (await Ticket.countDocuments() === 0) {
    const pedidoJuan = await Pedido.findOne({ cliente: juan._id });
    const elena = usuarios['sastre@differents.com'];
    const categoria = categorias['Arreglos de Sastrería'];

    const ticket = new Ticket({
      codigo: await siguienteCodigo('DIF'),
      asunto: 'Ajuste de bajo de pantalón en el modelo Milano',
      descripcion: 'El pantalón me queda unos dos centímetros largo. Me gustaría pasar por el atelier para que lo ajusten antes de la boda del día 12.',
      categoria: categoria._id, categoriaNombre: categoria.nombre,
      prioridad: 'MEDIA', estado: 'EN_CURSO',
      cliente: juan._id, clienteNombre: juan.nombreCompleto,
      agente: elena._id, agenteNombre: elena.nombre,
      pedido: pedidoJuan?._id || null, numeroPedido: pedidoJuan?.numeroPedido || null,
    });

    ticket.mensajes.push(
      { autor: juan._id, autorNombre: juan.nombre, autorRol: 'CLIENTE', mensaje: 'El pantalón me queda unos dos centímetros largo. Me gustaría pasar por el atelier para que lo ajusten antes de la boda del día 12.' },
      { autor: elena._id, autorNombre: elena.nombre, autorRol: 'AGENTE', mensaje: 'Buenos días, Juan. Sin problema. Tenemos hueco el jueves por la mañana y el viernes por la tarde. ¿Cuál le viene mejor?' },
      { autor: elena._id, autorNombre: elena.nombre, autorRol: 'AGENTE', mensaje: 'Nota: cliente con boda el día 12, dar prioridad en el taller.', esNotaInterna: true },
    );
    ticket.anotarCambio(juan, 'estado', null, 'ABIERTO');
    ticket.anotarCambio(elena, 'estado', 'ABIERTO', 'EN_CURSO');
    ticket.anotarCambio(elena, 'agente', null, elena.nombre);

    await ticket.save();
    log(`✓ 1 incidencia de ejemplo (${ticket.codigo})`);
  }

  // ── Cita de ejemplo ──
  if (await Cita.countDocuments() === 0) {
    const dentroDeDosSemanas = new Date();
    dentroDeDosSemanas.setDate(dentroDeDosSemanas.getDate() + 14);
    await Cita.create({
      nombre: 'Alejandro Ventura Sanz', ciudad: 'Madrid', ocasion: 'Boda',
      fechaPreferida: dentroDeDosSemanas, estado: 'SOLICITADA',
    });
    log('✓ 1 cita de ejemplo');
  }

  log('\n─────────────────────────────────────────');
  log(' Credenciales de prueba (sólo desarrollo)');
  log('─────────────────────────────────────────');
  log(' Admin    admin@differents.com    Admin2026!');
  log(' Asesor   sastre@differents.com   Agente2026!');
  log(' Cliente  juan@correo.com         Cliente2026!');
  log(' Cliente  pedro@correo.com        Cliente2026!');
  log('─────────────────────────────────────────\n');

  if (desconectar) await mongoose.disconnect();
  return { ok: true };
}

if (require.main === module) {
  sembrar().catch(async (err) => {
    console.error('✗ Error durante la carga inicial:', err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
}

module.exports = { sembrar };
