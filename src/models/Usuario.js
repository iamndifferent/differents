const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const salidaLimpia = require('./plugins/salidaLimpia');

const ROLES = ['CLIENTE', 'AGENTE', 'ADMIN'];

const medidasSchema = new mongoose.Schema({
  pecho: { type: Number, min: 0, max: 300, default: null },
  cintura: { type: Number, min: 0, max: 300, default: null },
  cadera: { type: Number, min: 0, max: 300, default: null },
  hombros: { type: Number, min: 0, max: 300, default: null },
  manga: { type: Number, min: 0, max: 300, default: null },
  largoPantalon: { type: Number, min: 0, max: 300, default: null },
}, { _id: false });

const usuarioSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'El correo es obligatorio'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'Formato de correo no válido'],
  },
  passwordHash: { type: String, required: true },
  nombre: { type: String, required: [true, 'El nombre es obligatorio'], trim: true, maxlength: 80 },
  apellidos: { type: String, default: '', trim: true, maxlength: 120 },
  telefono: { type: String, default: '', trim: true, maxlength: 30 },
  rol: { type: String, enum: ROLES, default: 'CLIENTE', index: true },
  activo: { type: Boolean, default: true },
  medidas: { type: medidasSchema, default: () => ({}) },
}, { timestamps: true });

usuarioSchema.plugin(salidaLimpia, { privados: ['passwordHash'] });

/** Guarda una contraseña en claro ya cifrada. */
usuarioSchema.methods.establecerPassword = async function establecerPassword(password) {
  const rondas = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;
  this.passwordHash = await bcrypt.hash(password, rondas);
};

/** Comprueba una contraseña contra el hash almacenado. */
usuarioSchema.methods.comprobarPassword = function comprobarPassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

usuarioSchema.virtual('nombreCompleto').get(function nombreCompleto() {
  return [this.nombre, this.apellidos].filter(Boolean).join(' ');
});

module.exports = mongoose.model('Usuario', usuarioSchema);
module.exports.ROLES = ROLES;
