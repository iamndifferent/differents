const express = require('express');
const { body } = require('express-validator');
const Ticket = require('../models/Ticket');
const Pedido = require('../models/Pedido');
const Usuario = require('../models/Usuario');
const CategoriaSoporte = require('../models/CategoriaSoporte');
const { siguienteCodigo } = require('../models/Contador');
const { autenticado, puedeAcceder } = require('../middleware/auth');
const { comprobarErrores, limpiar, validarObjectId, asyncHandler } = require('../middleware/validar');

const router = express.Router();

/**
 * Ciclo de vida de una incidencia.
 * Cada estado declara a cuáles puede saltar. Cualquier transición que no
 * figure aquí se rechaza, de modo que un ticket no puede pasar, por ejemplo,
 * de CERRADO a RESUELTO.
 */
const TRANSICIONES = {
  ABIERTO: ['EN_CURSO', 'PENDIENTE_CLIENTE', 'RESUELTO', 'CERRADO'],
  EN_CURSO: ['PENDIENTE_CLIENTE', 'RESUELTO', 'CERRADO'],
  PENDIENTE_CLIENTE: ['EN_CURSO', 'RESUELTO', 'CERRADO'],
  RESUELTO: ['EN_CURSO', 'CERRADO'],
  CERRADO: ['EN_CURSO'], // sólo un administrador puede reabrir un ticket cerrado
};

/** Proyección del ticket según quién lo pide. */
function ticketParaUsuario(ticket, usuario) {
  const salida = ticket.toJSON();
  if (usuario.rol === 'CLIENTE') {
    // El cliente no ve las notas internas del equipo ni el registro de auditoría.
    salida.mensajes = salida.mensajes.filter((m) => !m.esNotaInterna);
    delete salida.historial;
  }
  return salida;
}

/**
 * POST /api/tickets — el cliente abre una incidencia.
 */
router.post('/', autenticado, [
  body('asunto').trim().isLength({ min: 5, max: 200 }).withMessage('Asunto: 5-200 caracteres'),
  body('descripcion').trim().isLength({ min: 10, max: 2000 }).withMessage('Descripción: 10-2000 caracteres'),
  body('categoria_id').isMongoId().withMessage('Categoría no válida'),
  body('prioridad').optional().isIn(Ticket.PRIORIDADES).withMessage('Prioridad no válida'),
  body('pedido_id').optional({ nullable: true }).isMongoId().withMessage('Pedido no válido'),
], comprobarErrores, asyncHandler(async (req, res) => {
  if (req.usuario.rol !== 'CLIENTE') {
    return res.status(403).json({ error: 'Sólo los clientes pueden abrir incidencias' });
  }

  const { asunto, descripcion, categoria_id: categoriaId, prioridad, pedido_id: pedidoId } = req.body;

  const categoria = await CategoriaSoporte.findOne({ _id: categoriaId, activa: true });
  if (!categoria) return res.status(400).json({ error: 'La categoría indicada no existe' });

  // IDOR: sólo se puede vincular un pedido propio.
  let pedido = null;
  if (pedidoId) {
    pedido = await Pedido.findById(pedidoId);
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (String(pedido.cliente) !== String(req.usuario._id)) {
      return res.status(403).json({ error: 'Ese pedido no le pertenece' });
    }
  }

  const ticket = new Ticket({
    codigo: await siguienteCodigo('DIF'),
    asunto: limpiar(asunto),
    descripcion: limpiar(descripcion),
    categoria: categoria._id,
    categoriaNombre: categoria.nombre,
    prioridad: prioridad || 'MEDIA',
    estado: 'ABIERTO',
    cliente: req.usuario._id,
    clienteNombre: req.usuario.nombreCompleto,
    pedido: pedido ? pedido._id : null,
    numeroPedido: pedido ? pedido.numeroPedido : null,
  });

  // La descripción inicial queda también como primer mensaje de la conversación.
  ticket.mensajes.push({
    autor: req.usuario._id,
    autorNombre: req.usuario.nombre,
    autorRol: req.usuario.rol,
    mensaje: limpiar(descripcion),
    esNotaInterna: false,
  });
  ticket.anotarCambio(req.usuario, 'estado', null, 'ABIERTO');

  await ticket.save();
  return res.status(201).json({
    mensaje: 'Incidencia registrada',
    codigo: ticket.codigo,
    ticket: ticketParaUsuario(ticket, req.usuario),
  });
}));

/**
 * GET /api/tickets — listado filtrado por rol.
 * Filtros opcionales: ?estado= &prioridad= &buscar= &asignados=mios
 */
router.get('/', autenticado, asyncHandler(async (req, res) => {
  const { estado, prioridad, buscar, asignados } = req.query;

  // El alcance lo marca el token, no la petición.
  const filtro = req.usuario.rol === 'CLIENTE' ? { cliente: req.usuario._id } : {};
  if (req.usuario.rol === 'AGENTE' && asignados === 'mios') filtro.agente = req.usuario._id;

  if (estado) filtro.estado = estado;
  if (prioridad) filtro.prioridad = prioridad;
  if (buscar) {
    const termino = new RegExp(String(buscar).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filtro.$or = [{ codigo: termino }, { asunto: termino }];
  }

  const tickets = await Ticket.find(filtro)
    .select('-mensajes -historial')
    .sort({ updatedAt: -1 })
    .limit(200);

  return res.json({ total: tickets.length, tickets });
}));

/**
 * GET /api/tickets/:id — detalle con la conversación.
 * Aquí vive la comprobación IDOR: un cliente que cambie el id de la URL
 * recibe 403, no los datos de otro.
 */
router.get('/:id', autenticado, validarObjectId(), asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Incidencia no encontrada' });
  if (!puedeAcceder(req.usuario, ticket.cliente)) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  return res.json({ ticket: ticketParaUsuario(ticket, req.usuario) });
}));

/**
 * POST /api/tickets/:id/mensajes — responder en la conversación.
 */
router.post('/:id/mensajes', autenticado, validarObjectId(), [
  body('mensaje').trim().isLength({ min: 1, max: 4000 }).withMessage('El mensaje no puede estar vacío'),
  body('es_nota_interna').optional().isBoolean(),
], comprobarErrores, asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Incidencia no encontrada' });
  if (!puedeAcceder(req.usuario, ticket.cliente)) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  if (ticket.estado === 'CERRADO') {
    return res.status(409).json({ error: 'La incidencia está cerrada. Reábrala para continuar.' });
  }

  // Sólo el equipo puede marcar una nota como interna.
  const esNota = req.usuario.rol !== 'CLIENTE' && req.body.es_nota_interna === true;

  ticket.mensajes.push({
    autor: req.usuario._id,
    autorNombre: req.usuario.nombre,
    autorRol: req.usuario.rol,
    mensaje: limpiar(req.body.mensaje),
    esNotaInterna: esNota,
  });

  // Si el cliente responde a un ticket que esperaba su respuesta, vuelve a la cola.
  if (req.usuario.rol === 'CLIENTE' && ticket.estado === 'PENDIENTE_CLIENTE') {
    ticket.anotarCambio(req.usuario, 'estado', ticket.estado, 'EN_CURSO');
    ticket.estado = 'EN_CURSO';
  }

  await ticket.save();
  return res.status(201).json({ mensaje: 'Mensaje enviado', ticket: ticketParaUsuario(ticket, req.usuario) });
}));

/**
 * PUT /api/tickets/:id — cambios de estado, prioridad y asignación.
 *
 * El cliente sólo puede cerrar o reabrir una incidencia ya resuelta.
 * Agentes y administradores manejan el resto del ciclo.
 */
router.put('/:id', autenticado, validarObjectId(), asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Incidencia no encontrada' });
  if (!puedeAcceder(req.usuario, ticket.cliente)) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }

  const { estado, prioridad, agente_id: agenteId } = req.body;
  const esCliente = req.usuario.rol === 'CLIENTE';
  let cambios = 0;

  // ── Cliente: confirmar cierre o reabrir ──
  if (esCliente) {
    if (prioridad !== undefined || agenteId !== undefined) {
      return res.status(403).json({ error: 'Sólo puede cerrar o reabrir su incidencia' });
    }
    if (ticket.estado !== 'RESUELTO' || !['CERRADO', 'EN_CURSO'].includes(estado)) {
      return res.status(403).json({ error: 'Sólo puede cerrar o reabrir una incidencia resuelta' });
    }
    ticket.anotarCambio(req.usuario, 'estado', ticket.estado, estado);
    ticket.estado = estado;
    await ticket.save();
    return res.json({
      mensaje: estado === 'CERRADO' ? 'Incidencia cerrada' : 'Incidencia reabierta',
      ticket: ticketParaUsuario(ticket, req.usuario),
    });
  }

  // ── Equipo: estado, prioridad y asignación ──
  if (estado !== undefined) {
    if (!Ticket.ESTADOS.includes(estado)) {
      return res.status(400).json({ error: 'Estado no válido' });
    }
    if (estado !== ticket.estado) {
      if (!TRANSICIONES[ticket.estado].includes(estado)) {
        return res.status(409).json({
          error: `No se puede pasar de ${ticket.estado} a ${estado}`,
          permitidos: TRANSICIONES[ticket.estado],
        });
      }
      if (ticket.estado === 'CERRADO' && req.usuario.rol !== 'ADMIN') {
        return res.status(403).json({ error: 'Sólo un administrador reabre una incidencia cerrada' });
      }
      ticket.anotarCambio(req.usuario, 'estado', ticket.estado, estado);
      ticket.estado = estado;
      cambios += 1;
    }
  }

  if (prioridad !== undefined && prioridad !== ticket.prioridad) {
    if (!Ticket.PRIORIDADES.includes(prioridad)) {
      return res.status(400).json({ error: 'Prioridad no válida' });
    }
    ticket.anotarCambio(req.usuario, 'prioridad', ticket.prioridad, prioridad);
    ticket.prioridad = prioridad;
    cambios += 1;
  }

  if (agenteId !== undefined) {
    if (agenteId === null || agenteId === '') {
      ticket.anotarCambio(req.usuario, 'agente', ticket.agenteNombre, null);
      ticket.agente = null;
      ticket.agenteNombre = null;
      cambios += 1;
    } else {
      const agente = await Usuario.findOne({ _id: agenteId, rol: { $in: ['AGENTE', 'ADMIN'] }, activo: true });
      if (!agente) return res.status(400).json({ error: 'El asesor indicado no existe' });
      ticket.anotarCambio(req.usuario, 'agente', ticket.agenteNombre, agente.nombre);
      ticket.agente = agente._id;
      ticket.agenteNombre = agente.nombre;
      cambios += 1;
    }
  }

  // Si un agente atiende una incidencia sin dueño, se la queda.
  if (cambios > 0 && !ticket.agente && req.usuario.rol === 'AGENTE') {
    ticket.agente = req.usuario._id;
    ticket.agenteNombre = req.usuario.nombre;
    ticket.anotarCambio(req.usuario, 'agente', null, req.usuario.nombre);
  }

  if (cambios === 0) return res.status(400).json({ error: 'No se indicó ningún cambio' });

  await ticket.save();
  return res.json({ mensaje: 'Incidencia actualizada', ticket: ticketParaUsuario(ticket, req.usuario) });
}));

module.exports = router;
module.exports.TRANSICIONES = TRANSICIONES;
