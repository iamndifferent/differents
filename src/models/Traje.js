const mongoose = require('mongoose');
const salidaLimpia = require('./plugins/salidaLimpia');

const CATEGORIAS = ['ETIQUETA', 'EJECUTIVO', 'CEREMONIA', 'CASUAL_SASTRERIA'];
const CORTES = ['SLIM_FIT', 'TAILORED_FIT', 'REGULAR_FIT'];
const TALLAS = ['46', '48', '50', '52', '54', '56'];

// El stock vive dentro del propio traje: una clave por talla.
const stockSchema = new mongoose.Schema(
  TALLAS.reduce((campos, talla) => {
    campos[talla] = { type: Number, default: 0, min: 0 };
    return campos;
  }, {}),
  { _id: false },
);

const trajeSchema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true, trim: true, uppercase: true },
  nombre: { type: String, required: true, trim: true, maxlength: 120 },
  categoria: { type: String, required: true, enum: CATEGORIAS, index: true },
  corte: { type: String, required: true, enum: CORTES, index: true },
  color: { type: String, required: true, trim: true, maxlength: 60 },
  tejido: { type: String, required: true, trim: true, maxlength: 120 },
  descripcion: { type: String, default: '', maxlength: 1200 },
  precio: { type: Number, required: true, min: 0 },
  stock: { type: stockSchema, default: () => ({}) },
  imagenUrl: { type: String, default: '', trim: true },
  estado: { type: String, enum: ['ACTIVO', 'INACTIVO'], default: 'ACTIVO', index: true },
}, { timestamps: true });

// Índice de texto para la búsqueda libre del catálogo.
trajeSchema.index({ nombre: 'text', tejido: 'text', color: 'text', descripcion: 'text' });

/** Unidades disponibles sumando todas las tallas. */
trajeSchema.virtual('stockTotal').get(function stockTotal() {
  return TALLAS.reduce((total, talla) => total + (this.stock?.[talla] || 0), 0);
});

// Salida JSON: `id` en lugar de `_id`, más el total de stock ya calculado
// para que el frontend no tenga que sumar las seis tallas.
trajeSchema.plugin(salidaLimpia);
const limpiarTraje = (doc, ret) => {
  ret.id = String(ret._id);
  delete ret._id;
  delete ret.__v;
  ret.stockTotal = TALLAS.reduce((t, talla) => t + (ret.stock?.[talla] || 0), 0);
  return ret;
};
trajeSchema.set('toJSON', { transform: limpiarTraje });
trajeSchema.set('toObject', { transform: limpiarTraje });

module.exports = mongoose.model('Traje', trajeSchema);
module.exports.CATEGORIAS = CATEGORIAS;
module.exports.CORTES = CORTES;
module.exports.TALLAS = TALLAS;
