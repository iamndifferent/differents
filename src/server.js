require('dotenv').config({ quiet: true });

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const { conectarDB } = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const trajesRoutes = require('./routes/trajes.routes');
const pedidosRoutes = require('./routes/pedidos.routes');
const ticketsRoutes = require('./routes/tickets.routes');
const citasRoutes = require('./routes/citas.routes');
const categoriasRoutes = require('./routes/categorias.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Render, Railway y similares sirven detrás de un proxy. Sin esto, el
// limitador de peticiones vería siempre la misma IP y contaría mal.
app.set('trust proxy', 1);

// ── Seguridad ─────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // El frontend es una sola página con estilos y script en línea, de ahí
      // 'unsafe-inline'. Si separa el CSS y el JS en archivos, quítelo.
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS: en producción indique su dominio en CORS_ORIGIN.
const origenes = (process.env.CORS_ORIGIN || '*').split(',').map((o) => o.trim());
app.use(cors({
  origin: origenes.includes('*') ? true : origenes,
  credentials: true,
}));

app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));

app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Intente de nuevo en 15 minutos.' },
}));

// ── Archivos del sitio ────────────────────────────────────
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h' }));

// ── Comprobación de estado (la usa Render para el health check) ──
app.get('/api/health', (req, res) => {
  const estados = ['desconectado', 'conectado', 'conectando', 'desconectando'];
  res.json({
    estado: 'ok',
    mongodb: estados[mongoose.connection.readyState] || 'desconocido',
    entorno: process.env.NODE_ENV || 'development',
    hora: new Date().toISOString(),
  });
});

// ── Rutas de la API ───────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/trajes', trajesRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/citas', citasRoutes);
app.use('/api/categorias-soporte', categoriasRoutes);
app.use('/api/admin', adminRoutes);

// ── 404 de la API ─────────────────────────────────────────
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// ── El resto devuelve la página (aplicación de una sola página) ──
app.use((req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

// ── Manejador de errores ──────────────────────────────────
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  // Cuerpo de petición demasiado grande.
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({ error: 'El contenido enviado es demasiado grande' });
  }
  // JSON mal formado.
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err)) {
    return res.status(400).json({ error: 'El cuerpo de la petición no es JSON válido' });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'Identificador no válido' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Datos inválidos',
      detalles: Object.values(err.errors).map((e) => e.message),
    });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'Ese registro ya existe', campo: Object.keys(err.keyPattern || {})[0] });
  }
  console.error('✗ Error no controlado:', err);
  return res.status(500).json({ error: 'Error interno del servidor' });
});

// ── Arranque ──────────────────────────────────────────────
async function arrancar() {
  if (!process.env.JWT_SECRET) {
    console.error('✗ Falta JWT_SECRET. Copie .env.example a .env y rellénelo.');
    process.exit(1);
  }
  if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET.includes('cambie_esta_clave')) {
    console.error('✗ JWT_SECRET sigue con el valor de ejemplo. Cámbielo antes de publicar.');
    process.exit(1);
  }

  try {
    await conectarDB();
  } catch (err) {
    console.error('✗ No se pudo conectar con MongoDB:', err.message);
    process.exit(1);
  }

  const servidor = app.listen(PORT, () => {
    console.log(`\n🎩 Differents — servidor activo en el puerto ${PORT}`);
    console.log(`   http://localhost:${PORT}\n`);
  });

  // Render y Railway envían SIGTERM al reiniciar: cerrar bien evita
  // dejar peticiones a medias y conexiones colgadas.
  ['SIGTERM', 'SIGINT'].forEach((senal) => {
    process.on(senal, () => {
      console.log(`\n${senal} recibida, cerrando…`);
      servidor.close(() => mongoose.connection.close(false).then(() => process.exit(0)));
    });
  });
}

if (require.main === module) arrancar();

module.exports = app;
