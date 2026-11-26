const express = require('express');
const { body } = require('express-validator');
const Cita = require('../models/Cita');
const { autenticadoOpcional } = require('../middleware/auth');
const { comprobarErrores, limpiar, asyncHandler } = require('../middleware/validar');

const router = express.Router();

/**
 * POST /api/citas — reserva de cita privada (Capítulo VI).
 * Es pública: un visitante puede reservar sin tener cuenta. Si llega con
 * sesión abierta, la cita queda además vinculada a su ficha de cliente.
 */
router.post('/', autenticadoOpcional, [
  body('nombre').trim().isLength({ min: 3, max: 120 }).withMessage('Nombre: 3-120 caracteres'),
  body('ciudad').isIn(Cita.CIUDADES).withMessage('Ciudad no válida'),
  body('ocasion').isIn(Cita.OCASIONES).withMessage('Ocasión no válida'),
  body('fecha_preferida').isISO8601().withMessage('Fecha no válida'),
], comprobarErrores, asyncHandler(async (req, res) => {
  const fecha = new Date(req.body.fecha_preferida);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  if (fecha < hoy) {
    return res.status(400).json({ error: 'La fecha debe ser igual o posterior a hoy' });
  }

  const cita = await Cita.create({
    nombre: limpiar(req.body.nombre),
    ciudad: req.body.ciudad,
    ocasion: req.body.ocasion,
    fechaPreferida: fecha,
    cliente: req.usuario ? req.usuario._id : null,
  });

  return res.status(201).json({
    mensaje: 'Solicitud de cita recibida. Le confirmaremos en un plazo de 24 horas.',
    cita,
  });
}));

module.exports = router;
