const express = require('express');
const Traje = require('../models/Traje');
const { validarObjectId, asyncHandler } = require('../middleware/validar');

const router = express.Router();

/**
 * GET /api/trajes — catálogo público, sólo trajes activos.
 * Filtros: ?categoria= &corte= &precio_min= &precio_max= &buscar=
 */
router.get('/', asyncHandler(async (req, res) => {
  const { categoria, corte, precio_min: min, precio_max: max, buscar } = req.query;

  const filtro = { estado: 'ACTIVO' };
  if (categoria) filtro.categoria = categoria;
  if (corte) filtro.corte = corte;

  if (min || max) {
    filtro.precio = {};
    if (min) filtro.precio.$gte = Number(min);
    if (max) filtro.precio.$lte = Number(max);
  }

  if (buscar) {
    // Búsqueda parcial e insensible a mayúsculas sobre los campos visibles.
    const termino = new RegExp(String(buscar).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filtro.$or = [{ nombre: termino }, { tejido: termino }, { color: termino }, { sku: termino }];
  }

  const trajes = await Traje.find(filtro).sort({ createdAt: -1 }).limit(100);
  return res.json({ total: trajes.length, trajes });
}));

/** GET /api/trajes/:id — ficha pública */
router.get('/:id', validarObjectId(), asyncHandler(async (req, res) => {
  const traje = await Traje.findOne({ _id: req.params.id, estado: 'ACTIVO' });
  if (!traje) return res.status(404).json({ error: 'Traje no encontrado' });
  return res.json({ traje });
}));

module.exports = router;
