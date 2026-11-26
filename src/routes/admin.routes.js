const express = require('express');
const { body } = require('express-validator');
const Usuario = require('../models/Usuario');
const Traje = require('../models/Traje');
const Pedido = require('../models/Pedido');
const Ticket = require('../models/Ticket');
const Cita = require('../models/Cita');
const CategoriaSoporte = require('../models/CategoriaSoporte');
const { autenticado, exigirRol } = require('../middleware/auth');
const { comprobarErrores, limpiar, validarObjectId, asyncHandler } = require('../middleware/validar');

const router = express.Router();

// Todo lo que cuelga de /api/admin exige sesión de administrador.
router.use(autenticado, exigirRol('ADMIN'));

// ── USUARIOS ──────────────────────────────────────────────

router.get('/usuarios', asyncHandler(async (req, res) => {
  const usuarios = await Usuario.find().sort({ createdAt: -1 }).limit(300);
  res.json({ total: usuarios.length, usuarios });
}));

/**
 * PUT /api/admin/usuarios/:id — cambiar rol o activar/desactivar.
 * Un administrador no puede quitarse a sí mismo el rol ni desactivarse:
 * evita quedarse sin ningún administrador con acceso.
 */
router.put('/usuarios/:id', validarObjectId(), asyncHandler(async (req, res) => {
  const { rol, activo } = req.body;
  const usuario = await Usuario.findById(req.params.id);
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

  const esMiCuenta = String(usuario._id) === String(req.usuario._id);
  if (esMiCuenta && (rol !== undefined || activo === false)) {
    return res.status(409).json({ error: 'No puede modificar su propio acceso de administrador' });
  }

  if (rol !== undefined) {
    if (!Usuario.ROLES.includes(rol)) return res.status(400).json({ error: 'Rol no válido' });
    usuario.rol = rol;
  }
  if (activo !== undefined) usuario.activo = Boolean(activo);

  await usuario.save();
  return res.json({ mensaje: 'Usuario actualizado', usuario });
}));

/** GET /api/admin/agentes — para el desplegable de asignación */
router.get('/agentes', asyncHandler(async (req, res) => {
  const agentes = await Usuario.find({ rol: { $in: ['AGENTE', 'ADMIN'] }, activo: true })
    .select('nombre apellidos email rol')
    .sort({ nombre: 1 });
  res.json({ agentes });
}));

// ── MÉTRICAS ──────────────────────────────────────────────

/**
 * GET /api/admin/metricas — datos del panel.
 * Los recuentos se calculan con el pipeline de agregación de MongoDB,
 * que agrupa en el servidor de base de datos en vez de traerse los
 * documentos enteros para contarlos en Node.
 */
router.get('/metricas', asyncHandler(async (req, res) => {
  const [totalUsuarios, totalPedidos, totalTrajes, totalCitas, porEstado, porPrioridad, porAgente, porCategoria, ingresos] =
    await Promise.all([
      Usuario.countDocuments(),
      Pedido.countDocuments(),
      Traje.countDocuments({ estado: 'ACTIVO' }),
      Cita.countDocuments({ estado: 'SOLICITADA' }),
      Ticket.aggregate([
        { $group: { _id: '$estado', total: { $sum: 1 } } },
        { $project: { _id: 0, estado: '$_id', total: 1 } },
        { $sort: { total: -1 } },
      ]),
      Ticket.aggregate([
        { $group: { _id: '$prioridad', total: { $sum: 1 } } },
        { $project: { _id: 0, prioridad: '$_id', total: 1 } },
      ]),
      Ticket.aggregate([
        { $match: { agente: { $ne: null } } },
        { $group: { _id: '$agenteNombre', total: { $sum: 1 } } },
        { $project: { _id: 0, agente: '$_id', total: 1 } },
        { $sort: { total: -1 } },
      ]),
      Ticket.aggregate([
        { $group: { _id: '$categoriaNombre', total: { $sum: 1 } } },
        { $project: { _id: 0, categoria: '$_id', total: 1 } },
        { $sort: { total: -1 } },
      ]),
      Pedido.aggregate([
        { $match: { estado: { $ne: 'CANCELADO' } } },
        { $group: { _id: null, total: { $sum: '$precioTotal' } } },
      ]),
    ]);

  res.json({
    totalUsuarios,
    totalPedidos,
    totalTrajes,
    totalCitas,
    ingresosTotales: ingresos[0]?.total || 0,
    porEstado,
    porPrioridad,
    porAgente,
    porCategoria,
  });
}));

// ── CATÁLOGO ──────────────────────────────────────────────

/** GET /api/admin/trajes — incluye los desactivados */
router.get('/trajes', asyncHandler(async (req, res) => {
  const trajes = await Traje.find().sort({ createdAt: -1 });
  res.json({ total: trajes.length, trajes });
}));

router.post('/trajes', [
  body('sku').trim().isLength({ min: 3, max: 40 }).withMessage('SKU: 3-40 caracteres'),
  body('nombre').trim().isLength({ min: 2, max: 120 }).withMessage('Nombre obligatorio'),
  body('categoria').isIn(Traje.CATEGORIAS).withMessage('Categoría no válida'),
  body('corte').isIn(Traje.CORTES).withMessage('Corte no válido'),
  body('color').trim().isLength({ min: 2, max: 60 }).withMessage('Color obligatorio'),
  body('tejido').trim().isLength({ min: 2, max: 120 }).withMessage('Tejido obligatorio'),
  body('precio').isFloat({ min: 0 }).withMessage('Precio no válido'),
], comprobarErrores, asyncHandler(async (req, res) => {
  const sku = String(req.body.sku).trim().toUpperCase();
  if (await Traje.exists({ sku })) return res.status(409).json({ error: 'Ese SKU ya existe' });

  const stock = {};
  Traje.TALLAS.forEach((t) => { stock[t] = parseInt(req.body.stock?.[t] ?? req.body[`stock_${t}`], 10) || 0; });

  const traje = await Traje.create({
    sku,
    nombre: limpiar(req.body.nombre),
    categoria: req.body.categoria,
    corte: req.body.corte,
    color: limpiar(req.body.color),
    tejido: limpiar(req.body.tejido),
    descripcion: limpiar(req.body.descripcion || ''),
    precio: Number(req.body.precio),
    imagenUrl: limpiar(req.body.imagenUrl || req.body.imagen_url || ''),
    stock,
  });

  res.status(201).json({ mensaje: 'Traje creado', traje });
}));

router.put('/trajes/:id', validarObjectId(), asyncHandler(async (req, res) => {
  const traje = await Traje.findById(req.params.id);
  if (!traje) return res.status(404).json({ error: 'Traje no encontrado' });

  const textos = ['nombre', 'color', 'tejido', 'descripcion', 'imagenUrl'];
  textos.forEach((campo) => { if (req.body[campo] !== undefined) traje[campo] = limpiar(req.body[campo]); });

  if (req.body.categoria !== undefined) {
    if (!Traje.CATEGORIAS.includes(req.body.categoria)) return res.status(400).json({ error: 'Categoría no válida' });
    traje.categoria = req.body.categoria;
  }
  if (req.body.corte !== undefined) {
    if (!Traje.CORTES.includes(req.body.corte)) return res.status(400).json({ error: 'Corte no válido' });
    traje.corte = req.body.corte;
  }
  if (req.body.estado !== undefined) {
    if (!['ACTIVO', 'INACTIVO'].includes(req.body.estado)) return res.status(400).json({ error: 'Estado no válido' });
    traje.estado = req.body.estado;
  }
  if (req.body.precio !== undefined) traje.precio = Number(req.body.precio);

  Traje.TALLAS.forEach((t) => {
    const valor = req.body.stock?.[t] ?? req.body[`stock_${t}`];
    if (valor !== undefined) traje.stock[t] = parseInt(valor, 10) || 0;
  });

  await traje.save();
  res.json({ mensaje: 'Traje actualizado', traje });
}));

/**
 * DELETE /api/admin/trajes/:id — desactiva en lugar de borrar.
 * Los pedidos antiguos apuntan al traje; eliminarlo rompería su historial.
 */
router.delete('/trajes/:id', validarObjectId(), asyncHandler(async (req, res) => {
  const traje = await Traje.findByIdAndUpdate(req.params.id, { estado: 'INACTIVO' }, { new: true });
  if (!traje) return res.status(404).json({ error: 'Traje no encontrado' });
  res.json({ mensaje: 'Traje desactivado', traje });
}));

// ── CITAS ─────────────────────────────────────────────────

router.get('/citas', asyncHandler(async (req, res) => {
  const filtro = req.query.estado ? { estado: req.query.estado } : {};
  const citas = await Cita.find(filtro).sort({ fechaPreferida: 1 }).limit(300);
  res.json({ total: citas.length, citas });
}));

router.put('/citas/:id', validarObjectId(), asyncHandler(async (req, res) => {
  if (!Cita.ESTADOS_CITA.includes(req.body.estado)) {
    return res.status(400).json({ error: 'Estado no válido', permitidos: Cita.ESTADOS_CITA });
  }
  const cita = await Cita.findByIdAndUpdate(req.params.id, { estado: req.body.estado }, { new: true });
  if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });
  return res.json({ mensaje: 'Cita actualizada', cita });
}));

// ── CATEGORÍAS DE SOPORTE ─────────────────────────────────

router.post('/categorias-soporte', [
  body('nombre').trim().isLength({ min: 3, max: 80 }).withMessage('Nombre: 3-80 caracteres'),
], comprobarErrores, asyncHandler(async (req, res) => {
  const nombre = limpiar(req.body.nombre);
  if (await CategoriaSoporte.exists({ nombre })) return res.status(409).json({ error: 'Esa categoría ya existe' });
  const categoria = await CategoriaSoporte.create({ nombre, descripcion: limpiar(req.body.descripcion || '') });
  res.status(201).json({ mensaje: 'Categoría creada', categoria });
}));

module.exports = router;
