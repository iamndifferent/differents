const mongoose = require('mongoose');

/**
 * Contadores para códigos legibles (DIF-2026-0001, PED-2026-0001).
 *
 * En SQL esto lo resolvía un AUTOINCREMENT. En MongoDB se hace con una
 * colección propia y `findOneAndUpdate` con `$inc`, que es una operación
 * atómica: dos peticiones simultáneas nunca reciben el mismo número.
 */
const contadorSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  secuencia: { type: Number, default: 0 },
});

const Contador = mongoose.model('Contador', contadorSchema);

/** Devuelve el siguiente número de la serie indicada. */
async function siguiente(clave) {
  const doc = await Contador.findByIdAndUpdate(
    clave,
    { $inc: { secuencia: 1 } },
    { new: true, upsert: true },
  );
  return doc.secuencia;
}

/** Código con prefijo, año y cuatro dígitos: DIF-2026-0007 */
async function siguienteCodigo(prefijo) {
  const anio = new Date().getFullYear();
  const n = await siguiente(`${prefijo}-${anio}`);
  return `${prefijo}-${anio}-${String(n).padStart(4, '0')}`;
}

module.exports = { Contador, siguiente, siguienteCodigo };
