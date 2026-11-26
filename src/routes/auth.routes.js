const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const Usuario = require('../models/Usuario');
const { firmarToken, autenticado } = require('../middleware/auth');
const { comprobarErrores, limpiar, asyncHandler } = require('../middleware/validar');

const router = express.Router();

// Límite estricto en autenticación para frenar ataques de fuerza bruta.
const limiteAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espere 15 minutos.' },
});

const reglasPassword = body('password')
  .isLength({ min: 8, max: 72 }).withMessage('La contraseña debe tener entre 8 y 72 caracteres')
  .matches(/[A-Z]/).withMessage('La contraseña debe incluir una mayúscula')
  .matches(/[0-9]/).withMessage('La contraseña debe incluir un número');

/**
 * POST /api/auth/register
 * El rol NUNCA se acepta desde el cliente: toda alta es CLIENTE.
 * Promover a AGENTE o ADMIN es cosa del panel de administración.
 */
router.post('/register', limiteAuth, [
  body('email').isEmail().normalizeEmail().withMessage('Correo no válido'),
  reglasPassword,
  body('nombre').trim().isLength({ min: 2, max: 80 }).withMessage('Nombre: 2-80 caracteres'),
  body('apellidos').optional().trim().isLength({ max: 120 }),
  body('telefono').optional().trim().isLength({ max: 30 }),
], comprobarErrores, asyncHandler(async (req, res) => {
  const { email, password, nombre, apellidos, telefono } = req.body;

  if (await Usuario.exists({ email })) {
    return res.status(409).json({ error: 'Ese correo ya está registrado' });
  }

  const usuario = new Usuario({
    email,
    nombre: limpiar(nombre),
    apellidos: limpiar(apellidos || ''),
    telefono: limpiar(telefono || ''),
    rol: 'CLIENTE',
  });
  await usuario.establecerPassword(password);
  await usuario.save();

  return res.status(201).json({ token: firmarToken(usuario), user: usuario.toJSON() });
}));

/** POST /api/auth/login */
router.post('/login', limiteAuth, [
  body('email').isEmail().normalizeEmail().withMessage('Correo no válido'),
  body('password').notEmpty().withMessage('La contraseña es obligatoria'),
], comprobarErrores, asyncHandler(async (req, res) => {
  const usuario = await Usuario.findOne({ email: req.body.email });

  // Mismo mensaje tanto si no existe el correo como si la contraseña falla:
  // así no se revela qué correos están registrados.
  const credencialesMal = { error: 'Correo o contraseña incorrectos' };
  if (!usuario) return res.status(401).json(credencialesMal);
  if (!await usuario.comprobarPassword(req.body.password)) return res.status(401).json(credencialesMal);
  if (!usuario.activo) return res.status(403).json({ error: 'Su cuenta está desactivada' });

  return res.json({ token: firmarToken(usuario), user: usuario.toJSON() });
}));

/** GET /api/auth/me */
router.get('/me', autenticado, (req, res) => {
  res.json({ user: req.usuario.toJSON() });
});

/** PUT /api/auth/profile — datos personales y medidas */
router.put('/profile', autenticado, [
  body('nombre').optional().trim().isLength({ min: 2, max: 80 }),
  body('apellidos').optional().trim().isLength({ max: 120 }),
  body('telefono').optional().trim().isLength({ max: 30 }),
], comprobarErrores, asyncHandler(async (req, res) => {
  const usuario = req.usuario;
  const { nombre, apellidos, telefono, medidas } = req.body;

  if (nombre !== undefined) usuario.nombre = limpiar(nombre);
  if (apellidos !== undefined) usuario.apellidos = limpiar(apellidos);
  if (telefono !== undefined) usuario.telefono = limpiar(telefono);

  if (medidas && typeof medidas === 'object') {
    ['pecho', 'cintura', 'cadera', 'hombros', 'manga', 'largoPantalon'].forEach((campo) => {
      if (medidas[campo] === undefined) return;
      const valor = medidas[campo];
      usuario.medidas[campo] = (valor === null || valor === '') ? null : Number(valor);
    });
  }

  await usuario.save();
  return res.json({ user: usuario.toJSON(), mensaje: 'Perfil actualizado' });
}));

module.exports = router;
