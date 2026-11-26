const mongoose = require('mongoose');
const salidaLimpia = require('./plugins/salidaLimpia');

const ESTADOS = ['ABIERTO', 'EN_CURSO', 'PENDIENTE_CLIENTE', 'RESUELTO', 'CERRADO'];
const PRIORIDADES = ['BAJA', 'MEDIA', 'ALTA'];

/**
 * Mensajes e historial van EMBEBIDOS dentro del ticket, no en colecciones
 * aparte. En SQL eran tres tablas con JOIN; aquí, como nunca se consultan
 * sueltos y siempre se leen junto a su ticket, van dentro del documento:
 * una sola lectura devuelve la incidencia completa.
 */
const mensajeSchema = new mongoose.Schema({
  autor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  autorNombre: { type: String, required: true },
  autorRol: { type: String, required: true },
  mensaje: { type: String, required: true, maxlength: 4000 },
  // Las notas internas sólo las ven agentes y administradores.
  esNotaInterna: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const historialSchema = new mongoose.Schema({
  autor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  autorNombre: { type: String, required: true },
  autorRol: { type: String, required: true },
  campo: { type: String, required: true },
  valorAnterior: { type: String, default: null },
  valorNuevo: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const ticketSchema = new mongoose.Schema({
  codigo: { type: String, required: true, unique: true },
  asunto: { type: String, required: true, trim: true, minlength: 5, maxlength: 200 },
  descripcion: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },

  categoria: { type: mongoose.Schema.Types.ObjectId, ref: 'CategoriaSoporte', default: null },
  categoriaNombre: { type: String, default: '' },

  prioridad: { type: String, enum: PRIORIDADES, default: 'MEDIA', index: true },
  estado: { type: String, enum: ESTADOS, default: 'ABIERTO', index: true },

  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  clienteNombre: { type: String, required: true },
  agente: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null, index: true },
  agenteNombre: { type: String, default: null },

  pedido: { type: mongoose.Schema.Types.ObjectId, ref: 'Pedido', default: null },
  numeroPedido: { type: String, default: null },

  mensajes: { type: [mensajeSchema], default: [] },
  historial: { type: [historialSchema], default: [] },
}, { timestamps: true });

ticketSchema.index({ asunto: 'text', descripcion: 'text', codigo: 'text' });

/** Registra un cambio en el historial de auditoría del ticket. */
ticketSchema.methods.anotarCambio = function anotarCambio(usuario, campo, anterior, nuevo) {
  this.historial.push({
    autor: usuario._id || usuario.id,
    autorNombre: usuario.nombre,
    autorRol: usuario.rol,
    campo,
    valorAnterior: anterior === null || anterior === undefined ? null : String(anterior),
    valorNuevo: nuevo === null || nuevo === undefined ? null : String(nuevo),
  });
};

ticketSchema.plugin(salidaLimpia);

module.exports = mongoose.model('Ticket', ticketSchema);
module.exports.ESTADOS = ESTADOS;
module.exports.PRIORIDADES = PRIORIDADES;
