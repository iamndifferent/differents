const mongoose = require('mongoose');

/**
 * Conecta con MongoDB. Si falla, corta el arranque del servidor:
 * es preferible no levantar la API antes que servirla sin base de datos.
 */
async function conectarDB(uri) {
  const cadena = uri || process.env.MONGODB_URI;
  if (!cadena) {
    throw new Error('Falta la variable MONGODB_URI. Copie .env.example a .env y rellénela.');
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(cadena, {
    serverSelectionTimeoutMS: 10000,
  });

  const { host, name } = mongoose.connection;
  console.log(`✓ MongoDB conectado — base "${name}" en ${host}`);

  mongoose.connection.on('error', (err) => console.error('✗ Error de MongoDB:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('⚠ MongoDB desconectado'));

  return mongoose.connection;
}

async function desconectarDB() {
  await mongoose.disconnect();
}

module.exports = { conectarDB, desconectarDB };
