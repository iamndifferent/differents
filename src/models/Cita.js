const mongoose = require('mongoose');
const salidaLimpia = require('./plugins/salidaLimpia');

const CIUDADES = ['Madrid', 'Barcelona', 'Milán', 'París'];
const OCASIONES = ['Boda', 'Etiqueta y Gala', 'Negocios', 'Fondo de Armario'];
const ESTADOS_CITA = ['SOLICITADA', 'CONFIRMADA', 'ATENDIDA', 'CANCELADA'];

const citaSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
  ciudad: { type: String, required: true, enum: CIUDADES },
  ocasion: { type: String, required: true, enum: OCASIONES },
  fechaPreferida: { type: Date, required: true, index: true },
  estado: { type: String, enum: ESTADOS_CITA, default: 'SOLICITADA', index: true },
  // Si la solicita un cliente con sesión abierta, queda vinculada a su cuenta.
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },
}, { timestamps: true });

citaSchema.plugin(salidaLimpia);

module.exports = mongoose.model('Cita', citaSchema);
module.exports.CIUDADES = CIUDADES;
module.exports.OCASIONES = OCASIONES;
module.exports.ESTADOS_CITA = ESTADOS_CITA;
