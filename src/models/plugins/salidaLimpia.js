/**
 * Plugin de Mongoose que normaliza lo que la API devuelve en JSON:
 *  · `_id` pasa a llamarse `id` (texto)
 *  · se eliminan `__v` y cualquier campo marcado como privado
 *
 * Así el frontend trabaja siempre con `id` y nunca ve el hash de la contraseña.
 */
module.exports = function salidaLimpia(schema, opciones = {}) {
  const privados = opciones.privados || [];

  const transformar = (doc, ret) => {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.__v;
    privados.forEach((campo) => delete ret[campo]);
    return ret;
  };

  schema.set('toJSON', { virtuals: false, transform: transformar });
  schema.set('toObject', { virtuals: false, transform: transformar });
};
