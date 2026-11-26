const express = require('express');
const CategoriaSoporte = require('../models/CategoriaSoporte');
const { asyncHandler } = require('../middleware/validar');

const router = express.Router();

/** GET /api/categorias-soporte — motivos de incidencia disponibles (público) */
router.get('/', asyncHandler(async (req, res) => {
  const categorias = await CategoriaSoporte.find({ activa: true }).sort({ nombre: 1 });
  res.json({ total: categorias.length, categorias });
}));

module.exports = router;
