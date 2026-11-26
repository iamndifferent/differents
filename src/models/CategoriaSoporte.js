const mongoose = require('mongoose');
const salidaLimpia = require('./plugins/salidaLimpia');

const categoriaSchema = new mongoose.Schema({
  nombre: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
  descripcion: { type: String, default: '', maxlength: 400 },
  activa: { type: Boolean, default: true },
}, { timestamps: true });

categoriaSchema.plugin(salidaLimpia);

module.exports = mongoose.model('CategoriaSoporte', categoriaSchema);
