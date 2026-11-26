/**
 * Levanta un MongoDB en memoria y arranca la API contra él.
 * Sirve para probar en local sin instalar MongoDB ni tocar Atlas.
 *
 *   node test/servidor-memoria.js
 *
 * Los datos se pierden al cerrar el proceso.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  const mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri('differents');

  process.env.MONGODB_URI = uri;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'clave_solo_para_pruebas_locales_0123456789';
  process.env.PORT = process.env.PORT || '3000';
  process.env.NODE_ENV = 'development';

  console.log(`· MongoDB en memoria: ${uri}`);

  // El seed y el servidor leen process.env, ya configurado arriba.
  const { conectarDB } = require('../src/config/db');
  await conectarDB(uri);

  const app = require('../src/server');
  app.listen(process.env.PORT, () => {
    console.log(`🎩 API de pruebas en http://localhost:${process.env.PORT}`);
    console.log('   Ejecute "npm run seed" en otra terminal NO funcionará:');
    console.log('   esta base vive sólo en este proceso. Use test/smoke.test.js.');
  });

  process.on('SIGINT', async () => { await mongo.stop(); process.exit(0); });
})();
