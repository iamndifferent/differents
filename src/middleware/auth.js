const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

function firmarToken(usuario) {
  return jwt.sign(
    { id: String(usuario._id), rol: usuario.rol, email: usuario.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
  );
}

function leerToken(req) {
  const cabecera = req.headers.authorization || '';
  return cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : null;
}

/**
 * Exige sesión válida. Además de verificar la firma del token, vuelve a leer
 * el usuario de la base de datos: así, si se le desactiva la cuenta o se le
 * cambia el rol, el token que tuviera en la mano deja de servir al instante.
 */
async function autenticado(req, res, next) {
  const token = leerToken(req);
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    const datos = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await Usuario.findById(datos.id);
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Cuenta no disponible' });
    }
    req.usuario = usuario;
    return next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o caducado' });
  }
}

/** Sesión opcional: si hay token válido rellena req.usuario, si no, sigue. */
async function autenticadoOpcional(req, res, next) {
  const token = leerToken(req);
  if (!token) return next();
  try {
    const datos = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await Usuario.findById(datos.id);
    if (usuario && usuario.activo) req.usuario = usuario;
  } catch { /* token inservible: se continúa como visitante */ }
  return next();
}

/** Restringe la ruta a los roles indicados. */
function exigirRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ error: 'Token requerido' });
    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tiene permisos para esta acción' });
    }
    return next();
  };
}

/**
 * Protección IDOR.
 * Devuelve true si el usuario puede acceder al recurso:
 *  · ADMIN siempre
 *  · AGENTE siempre (trabaja sobre la cola de soporte)
 *  · CLIENTE sólo si el recurso es suyo
 * Con esto, cambiar el id en la URL no da acceso a datos ajenos.
 */
function puedeAcceder(usuario, propietarioId) {
  if (!usuario) return false;
  if (usuario.rol === 'ADMIN' || usuario.rol === 'AGENTE') return true;
  return String(propietarioId) === String(usuario._id);
}

module.exports = { firmarToken, autenticado, autenticadoOpcional, exigirRol, puedeAcceder };
