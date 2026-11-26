const express = require('express');
const { body } = require('express-validator');
const Pedido = require('../models/Pedido');
const Traje = require('../models/Traje');
const { siguienteCodigo } = require('../models/Contador');
const { autenticado, exigirRol } = require('../middleware/auth');
const { comprobarErrores, limpiar, asyncHandler } = require('../middleware/validar');

const router = express.Router();

/**
 * POST /api/pedidos — el cliente encarga un traje.
 *
 * El descuento de stock se hace con un único findOneAndUpdate que exige
 * `stock.talla >= cantidad` dentro del propio filtro. Al ser una operación
 * atómica de MongoDB, dos clientes que compren la última unidad a la vez
 * no pueden dejar el stock en negativo: el segundo recibe 400.
 */
router.post('/', autenticado, exigirRol('CLIENTE'), [
  body('traje_id').isMongoId().withMessage('Traje no válido'),
  body('talla').isIn(Traje.TALLAS).withMessage('Talla no válida'),
  body('cantidad').optional().isInt({ min: 1, max: 10 }).withMessage('Cantidad entre 1 y 10'),
], comprobarErrores, asyncHandler(async (req, res) => {
  const { traje_id: trajeId, talla, notas } = req.body;
  const cantidad = parseInt(req.body.cantidad, 10) || 1;

  const traje = await Traje.findOneAndUpdate(
    { _id: trajeId, estado: 'ACTIVO', [`stock.${talla}`]: { $gte: cantidad } },
    { $inc: { [`stock.${talla}`]: -cantidad } },
    { new: true },
  );

  if (!traje) {
    const existe = await Traje.exists({ _id: trajeId, estado: 'ACTIVO' });
    return res.status(existe
      ? 400 : 404).json({ error: existe ? `Sin stock suficiente en la talla ${talla}` : 'Traje no encontrado' });
  }

  try {
    const pedido = await Pedido.create({
      numeroPedido: await siguienteCodigo('PED'),
      cliente: req.usuario._id,
      traje: traje._id,
      trajeNombre: traje.nombre,
      talla,
      cantidad,
      precioUnitario: traje.precio,
      precioTotal: traje.precio * cantidad,
      notas: limpiar(notas || ''),
    });
    return res.status(201).json({ mensaje: 'Pedido confirmado', pedido, numeroPedido: pedido.numeroPedido });
  } catch (err) {
    // Si el pedido no se pudo crear, se devuelve el stock reservado.
    await Traje.updateOne({ _id: traje._id }, { $inc: { [`stock.${talla}`]: cantidad } });
    throw err;
  }
}));

/**
 * GET /api/pedidos
 * El cliente ve sólo los suyos; agentes y administradores, todos.
 * El filtro se construye en el servidor a partir del token, nunca del query.
 */
router.get('/', autenticado, asyncHandler(async (req, res) => {
  const filtro = req.usuario.rol === 'CLIENTE' ? { cliente: req.usuario._id } : {};

  const pedidos = await Pedido.find(filtro)
    .populate('cliente', 'nombre apellidos email')
    .sort({ createdAt: -1 })
    .limit(200);

  const salida = pedidos.map((p) => ({
    ...p.toJSON(),
    clienteNombre: p.cliente ? `${p.cliente.nombre} ${p.cliente.apellidos || ''}`.trim() : '',
  }));

  return res.json({ total: salida.length, pedidos: salida });
}));

module.exports = router;
