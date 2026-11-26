const { validationResult } = require('express-validator');
const xss = require('xss');
const mongoose = require('mongoose');

/** Corta la petición si express-validator encontró errores. */
function comprobarErrores(req, res, next) {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(400).json({
      error: 'Datos inválidos',
      detalles: errores.array().map((e) => e.msg),
    });
  }
  return next();
}

/** Limpia etiquetas y scripts de un texto antes de guardarlo. */
function limpiar(texto) {
  return xss(String(texto ?? '').trim(), { whiteList: {}, stripIgnoreTag: true });
}

/** Valida que un parámetro sea un ObjectId de MongoDB antes de consultar. */
function validarObjectId(nombreParam = 'id') {
  return (req, res, next) => {
    if (!mongoose.isValidObjectId(req.params[nombreParam])) {
      return res.status(400).json({ error: 'Identificador no válido' });
    }
    return next();
  };
}

/** Envuelve un controlador async para que los errores lleguen al manejador global. */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { comprobarErrores, limpiar, validarObjectId, asyncHandler };
