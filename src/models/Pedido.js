const mongoose = require('mongoose');
const salidaLimpia = require('./plugins/salidaLimpia');
const { TALLAS } = require('./Traje');

const ESTADOS_PEDIDO = ['CONFIRMADO', 'EN_PREPARACION', 'ENVIADO', 'ENTREGADO', 'CANCELADO'];

const pedidoSchema = new mongoose.Schema({
  numeroPedido: { type: String, required: true, unique: true },
  cliente: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  traje: { type: mongoose.Schema.Types.ObjectId, ref: 'Traje', required: true },

  // Se guarda el nombre y el precio del traje en el momento de la compra.
  // Si mañana cambia el catálogo, el pedido antiguo sigue contando la verdad.
  trajeNombre: { type: String, required: true },
  talla: { type: String, required: true, enum: TALLAS },
  cantidad: { type: Number, default: 1, min: 1, max: 10 },
  precioUnitario: { type: Number, required: true, min: 0 },
  precioTotal: { type: Number, required: true, min: 0 },

  estado: { type: String, enum: ESTADOS_PEDIDO, default: 'CONFIRMADO', index: true },
  notas: { type: String, default: '', maxlength: 600 },
}, { timestamps: true });

pedidoSchema.plugin(salidaLimpia);

module.exports = mongoose.model('Pedido', pedidoSchema);
module.exports.ESTADOS_PEDIDO = ESTADOS_PEDIDO;
