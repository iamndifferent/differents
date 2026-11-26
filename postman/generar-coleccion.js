/**
 * Genera la colección y el entorno de Postman.
 *   node postman/generar-coleccion.js
 *
 * Se mantiene como script para que, si añade rutas a la API, pueda
 * regenerar la colección en lugar de editar el JSON a mano.
 */
const fs = require('fs');
const path = require('path');

const json = (obj) => JSON.stringify(obj, null, 2);

/** Crea una petición de la colección. */
function peticion({ nombre, metodo = 'GET', ruta, token, cuerpo, descripcion, tests = [] }) {
  const partes = ruta.split('?');
  const segmentos = partes[0].split('/').filter(Boolean);
  const query = partes[1]
    ? partes[1].split('&').map((p) => {
      const [key, value] = p.split('=');
      return { key, value: value ?? '' };
    })
    : undefined;

  return {
    name: nombre,
    event: tests.length ? [{ listen: 'test', script: { type: 'text/javascript', exec: tests } }] : undefined,
    request: {
      method: metodo,
      header: [
        { key: 'Content-Type', value: 'application/json' },
        ...(token ? [{ key: 'Authorization', value: `Bearer {{${token}}}` }] : []),
      ],
      body: cuerpo ? { mode: 'raw', raw: json(cuerpo), options: { raw: { language: 'json' } } } : undefined,
      url: {
        raw: `{{baseUrl}}/${partes[0]}${partes[1] ? `?${partes[1]}` : ''}`,
        host: ['{{baseUrl}}'],
        path: segmentos,
        query,
      },
      description: descripcion,
    },
  };
}

const estado = (n) => `pm.test("Responde ${n}", () => pm.response.to.have.status(${n}));`;

const coleccion = {
  info: {
    _postman_id: 'd1ff3r3n-7501-4a9b-8c2d-differents2026',
    name: 'Differents — API (MongoDB)',
    description: [
      'Colección completa de la API de Differents.',
      '',
      'CÓMO USARLA',
      '1. Importe también el archivo del entorno (Differents.postman_environment.json)',
      '   y selecciónelo arriba a la derecha.',
      '2. Ajuste la variable baseUrl si su servidor no está en localhost:3000.',
      '3. Ejecute primero las peticiones de "01 · Autenticación": guardan los',
      '   tokens solas, así que el resto de carpetas ya funcionan.',
      '4. También puede pulsar "Run collection" y ejecutarlo todo de una vez,',
      '   en el orden en que están las carpetas.',
      '',
      'Las peticiones guardan automáticamente los identificadores que generan',
      '(traje, pedido, incidencia) en variables del entorno.',
    ].join('\n'),
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [{ key: 'baseUrl', value: 'http://localhost:3000/api' }],
  item: [
    {
      name: '00 · Estado del servicio',
      item: [
        peticion({
          nombre: 'Comprobar salud',
          ruta: 'health',
          descripcion: 'Confirma que la API responde y que MongoDB está conectado. Úselo siempre primero.',
          tests: [
            estado(200),
            'const d = pm.response.json();',
            'pm.test("MongoDB está conectado", () => pm.expect(d.mongodb).to.eql("conectado"));',
          ],
        }),
      ],
    },
    {
      name: '01 · Autenticación',
      item: [
        peticion({
          nombre: 'Registro de cliente nuevo',
          metodo: 'POST',
          ruta: 'auth/register',
          cuerpo: { email: 'nuevo{{$randomInt}}@correo.com', password: 'Prueba2026', nombre: 'Cliente', apellidos: 'De Prueba', telefono: '+34 600 000 000' },
          descripcion: 'Da de alta un cliente. El rol siempre es CLIENTE aunque se envíe otro.',
          tests: [
            estado(201),
            'const d = pm.response.json();',
            'pm.test("El rol asignado es CLIENTE", () => pm.expect(d.user.rol).to.eql("CLIENTE"));',
            'pm.test("No devuelve el hash de la contraseña", () => pm.expect(d.user.passwordHash).to.be.undefined);',
          ],
        }),
        peticion({
          nombre: 'Login — Cliente (Juan)',
          metodo: 'POST',
          ruta: 'auth/login',
          cuerpo: { email: 'juan@correo.com', password: 'Cliente2026!' },
          descripcion: 'Guarda el token en la variable tokenCliente.',
          tests: [
            estado(200),
            'const d = pm.response.json();',
            'pm.environment.set("tokenCliente", d.token);',
            'pm.environment.set("clienteId", d.user.id);',
            'pm.test("Devuelve un token", () => pm.expect(d.token).to.be.a("string"));',
          ],
        }),
        peticion({
          nombre: 'Login — Cliente (Pedro)',
          metodo: 'POST',
          ruta: 'auth/login',
          cuerpo: { email: 'pedro@correo.com', password: 'Cliente2026!' },
          descripcion: 'Segundo cliente. Hace falta para probar la protección IDOR.',
          tests: [estado(200), 'pm.environment.set("tokenOtroCliente", pm.response.json().token);'],
        }),
        peticion({
          nombre: 'Login — Asesor',
          metodo: 'POST',
          ruta: 'auth/login',
          cuerpo: { email: 'sastre@differents.com', password: 'Agente2026!' },
          tests: [estado(200), 'pm.environment.set("tokenAgente", pm.response.json().token);'],
        }),
        peticion({
          nombre: 'Login — Administrador',
          metodo: 'POST',
          ruta: 'auth/login',
          cuerpo: { email: 'admin@differents.com', password: 'Admin2026!' },
          tests: [
            estado(200),
            'const d = pm.response.json();',
            'pm.environment.set("tokenAdmin", d.token);',
            'pm.environment.set("adminId", d.user.id);',
          ],
        }),
        peticion({
          nombre: 'Mi perfil',
          ruta: 'auth/me',
          token: 'tokenCliente',
          tests: [estado(200)],
        }),
        peticion({
          nombre: 'Actualizar perfil y medidas',
          metodo: 'PUT',
          ruta: 'auth/profile',
          token: 'tokenCliente',
          cuerpo: { nombre: 'Juan', apellidos: 'Delgado Ríos', telefono: '+34 600 111 222', medidas: { pecho: 102, cintura: 86, cadera: 98, hombros: 46, manga: 64, largoPantalon: 104 } },
          tests: [
            estado(200),
            'pm.test("Guarda las medidas", () => pm.expect(pm.response.json().user.medidas.pecho).to.eql(102));',
          ],
        }),
      ],
    },
    {
      name: '02 · Catálogo (público)',
      item: [
        peticion({
          nombre: 'Listar trajes',
          ruta: 'trajes',
          descripcion: 'No requiere token. Guarda el id del primer traje para las siguientes peticiones.',
          tests: [
            estado(200),
            'const d = pm.response.json();',
            'pm.environment.set("trajeId", d.trajes[0].id);',
            'pm.test("Devuelve trajes", () => pm.expect(d.trajes.length).to.be.above(0));',
            'pm.test("Incluye el stock total", () => pm.expect(d.trajes[0].stockTotal).to.be.a("number"));',
          ],
        }),
        peticion({ nombre: 'Filtrar por categoría', ruta: 'trajes?categoria=ETIQUETA', tests: [estado(200)] }),
        peticion({ nombre: 'Filtrar por corte y precio', ruta: 'trajes?corte=SLIM_FIT&precio_min=800&precio_max=1500', tests: [estado(200)] }),
        peticion({ nombre: 'Búsqueda libre', ruta: 'trajes?buscar=milano', tests: [estado(200)] }),
        peticion({ nombre: 'Ficha de un traje', ruta: 'trajes/{{trajeId}}', tests: [estado(200)] }),
      ],
    },
    {
      name: '03 · Pedidos',
      item: [
        peticion({
          nombre: 'Crear pedido',
          metodo: 'POST',
          ruta: 'pedidos',
          token: 'tokenCliente',
          cuerpo: { traje_id: '{{trajeId}}', talla: '50', cantidad: 1 },
          descripcion: 'Descuenta stock de forma atómica. Si no hay unidades, responde 400.',
          tests: [
            estado(201),
            'const d = pm.response.json();',
            'pm.environment.set("pedidoId", d.pedido.id);',
            'pm.test("Genera número de pedido", () => pm.expect(d.numeroPedido).to.match(/^PED-\\d{4}-\\d{4}$/));',
          ],
        }),
        peticion({
          nombre: 'Pedir más unidades de las que hay',
          metodo: 'POST',
          ruta: 'pedidos',
          token: 'tokenCliente',
          cuerpo: { traje_id: '{{trajeId}}', talla: '50', cantidad: 10 },
          descripcion: 'Comprueba que el stock no puede quedar en negativo.',
          tests: [estado(400)],
        }),
        peticion({ nombre: 'Mis pedidos', ruta: 'pedidos', token: 'tokenCliente', tests: [estado(200)] }),
      ],
    },
    {
      name: '04 · Incidencias (tickets)',
      item: [
        peticion({
          nombre: 'Categorías de soporte',
          ruta: 'categorias-soporte',
          descripcion: 'Pública. Guarda el id de la primera categoría.',
          tests: [estado(200), 'pm.environment.set("categoriaId", pm.response.json().categorias[0].id);'],
        }),
        peticion({
          nombre: 'Abrir incidencia',
          metodo: 'POST',
          ruta: 'tickets',
          token: 'tokenCliente',
          cuerpo: {
            asunto: 'Ajuste de manga en el traje recibido',
            descripcion: 'Me gustaría acortar la manga unos dos centímetros antes del evento del día 20.',
            categoria_id: '{{categoriaId}}',
            prioridad: 'ALTA',
            pedido_id: '{{pedidoId}}',
          },
          tests: [
            estado(201),
            'const d = pm.response.json();',
            'pm.environment.set("ticketId", d.ticket.id);',
            'pm.test("Genera código DIF-AAAA-NNNN", () => pm.expect(d.codigo).to.match(/^DIF-\\d{4}-\\d{4}$/));',
            'pm.test("Nace en estado ABIERTO", () => pm.expect(d.ticket.estado).to.eql("ABIERTO"));',
          ],
        }),
        peticion({ nombre: 'Mis incidencias', ruta: 'tickets', token: 'tokenCliente', tests: [estado(200)] }),
        peticion({ nombre: 'Filtrar por estado y prioridad', ruta: 'tickets?estado=ABIERTO&prioridad=ALTA', token: 'tokenAgente', tests: [estado(200)] }),
        peticion({
          nombre: 'Detalle (como cliente)',
          ruta: 'tickets/{{ticketId}}',
          token: 'tokenCliente',
          descripcion: 'El cliente no recibe notas internas ni el historial de auditoría.',
          tests: [
            estado(200),
            'const t = pm.response.json().ticket;',
            'pm.test("Sin notas internas", () => pm.expect(t.mensajes.filter(m => m.esNotaInterna).length).to.eql(0));',
            'pm.test("Sin historial de auditoría", () => pm.expect(t.historial).to.be.undefined);',
          ],
        }),
        peticion({
          nombre: 'Asesor toma la incidencia (EN_CURSO)',
          metodo: 'PUT',
          ruta: 'tickets/{{ticketId}}',
          token: 'tokenAgente',
          cuerpo: { estado: 'EN_CURSO' },
          descripcion: 'Al actuar sobre una incidencia sin dueño, el asesor se la autoasigna.',
          tests: [
            estado(200),
            'const t = pm.response.json().ticket;',
            'pm.test("Pasa a EN_CURSO", () => pm.expect(t.estado).to.eql("EN_CURSO"));',
            'pm.test("Queda asignada", () => pm.expect(t.agenteNombre).to.be.a("string"));',
          ],
        }),
        peticion({
          nombre: 'Responder al cliente',
          metodo: 'POST',
          ruta: 'tickets/{{ticketId}}/mensajes',
          token: 'tokenAgente',
          cuerpo: { mensaje: 'Buenos días. Podemos verlo el jueves por la mañana en el atelier. ¿Le viene bien?' },
          tests: [estado(201)],
        }),
        peticion({
          nombre: 'Añadir nota interna',
          metodo: 'POST',
          ruta: 'tickets/{{ticketId}}/mensajes',
          token: 'tokenAgente',
          cuerpo: { mensaje: 'Aviso al taller: cliente con evento el día 20, dar prioridad.', es_nota_interna: true },
          descripcion: 'Sólo la ve el equipo. Compruébelo con "Detalle (como cliente)".',
          tests: [estado(201)],
        }),
        peticion({
          nombre: 'Detalle (como asesor)',
          ruta: 'tickets/{{ticketId}}',
          token: 'tokenAgente',
          tests: [
            estado(200),
            'const t = pm.response.json().ticket;',
            'pm.test("Ve la nota interna", () => pm.expect(t.mensajes.some(m => m.esNotaInterna)).to.be.true);',
            'pm.test("Ve el historial", () => pm.expect(t.historial).to.be.an("array"));',
          ],
        }),
        peticion({
          nombre: 'Transición no permitida (409)',
          metodo: 'PUT',
          ruta: 'tickets/{{ticketId}}',
          token: 'tokenAgente',
          cuerpo: { estado: 'ABIERTO' },
          descripcion: 'De EN_CURSO no se puede volver a ABIERTO. La API lo rechaza.',
          tests: [estado(409)],
        }),
        peticion({
          nombre: 'Marcar como RESUELTO',
          metodo: 'PUT',
          ruta: 'tickets/{{ticketId}}',
          token: 'tokenAgente',
          cuerpo: { estado: 'RESUELTO' },
          tests: [estado(200)],
        }),
        peticion({
          nombre: 'Cliente confirma el cierre',
          metodo: 'PUT',
          ruta: 'tickets/{{ticketId}}',
          token: 'tokenCliente',
          cuerpo: { estado: 'CERRADO' },
          descripcion: 'El cliente sólo puede cerrar o reabrir una incidencia ya RESUELTA.',
          tests: [estado(200), 'pm.test("Queda cerrada", () => pm.expect(pm.response.json().ticket.estado).to.eql("CERRADO"));'],
        }),
        peticion({
          nombre: 'Escribir en una cerrada (409)',
          metodo: 'POST',
          ruta: 'tickets/{{ticketId}}/mensajes',
          token: 'tokenCliente',
          cuerpo: { mensaje: 'Una última cosa.' },
          tests: [estado(409)],
        }),
      ],
    },
    {
      name: '05 · Citas privadas',
      item: [
        peticion({
          nombre: 'Reservar cita (sin cuenta)',
          metodo: 'POST',
          ruta: 'citas',
          cuerpo: { nombre: 'Alejandro García Pérez', ciudad: 'Madrid', ocasion: 'Boda', fecha_preferida: '{{fechaFutura}}' },
          descripcion: 'Formulario del Capítulo VI. Es público: no necesita token.',
          tests: [estado(201)],
        }),
        peticion({
          nombre: 'Ciudad no válida (400)',
          metodo: 'POST',
          ruta: 'citas',
          cuerpo: { nombre: 'Alguien Cualquiera', ciudad: 'Roma', ocasion: 'Boda', fecha_preferida: '{{fechaFutura}}' },
          tests: [estado(400)],
        }),
        peticion({
          nombre: 'Fecha pasada (400)',
          metodo: 'POST',
          ruta: 'citas',
          cuerpo: { nombre: 'Alguien Cualquiera', ciudad: 'Madrid', ocasion: 'Boda', fecha_preferida: '2020-01-01' },
          tests: [estado(400)],
        }),
      ],
    },
    {
      name: '06 · Administración',
      item: [
        peticion({
          nombre: 'Métricas del panel',
          ruta: 'admin/metricas',
          token: 'tokenAdmin',
          descripcion: 'Los recuentos se calculan con el pipeline de agregación de MongoDB.',
          tests: [
            estado(200),
            'const d = pm.response.json();',
            'pm.test("Agrupa por estado", () => pm.expect(d.porEstado).to.be.an("array"));',
            'pm.test("Calcula lo facturado", () => pm.expect(d.ingresosTotales).to.be.a("number"));',
          ],
        }),
        peticion({ nombre: 'Listar usuarios', ruta: 'admin/usuarios', token: 'tokenAdmin', tests: [estado(200)] }),
        peticion({ nombre: 'Listar asesores', ruta: 'admin/agentes', token: 'tokenAdmin', tests: [estado(200)] }),
        peticion({
          nombre: 'No puede degradarse a sí mismo (409)',
          metodo: 'PUT',
          ruta: 'admin/usuarios/{{adminId}}',
          token: 'tokenAdmin',
          cuerpo: { rol: 'CLIENTE' },
          descripcion: 'Evita quedarse sin ningún administrador con acceso.',
          tests: [estado(409)],
        }),
        peticion({
          nombre: 'Catálogo completo (incluye inactivos)',
          ruta: 'admin/trajes',
          token: 'tokenAdmin',
          tests: [estado(200)],
        }),
        peticion({
          nombre: 'Crear traje',
          metodo: 'POST',
          ruta: 'admin/trajes',
          token: 'tokenAdmin',
          cuerpo: {
            sku: 'DIF-TRJ-{{$randomInt}}', nombre: 'Como', categoria: 'EJECUTIVO', corte: 'SLIM_FIT',
            color: 'Gris Humo', tejido: 'Lana Super 140s', descripcion: 'Traje ejecutivo de prueba.',
            precio: 1390, stock: { 46: 1, 48: 2, 50: 4, 52: 3, 54: 1, 56: 0 },
          },
          tests: [estado(201), 'pm.environment.set("trajeNuevoId", pm.response.json().traje.id);'],
        }),
        peticion({
          nombre: 'Editar traje',
          metodo: 'PUT',
          ruta: 'admin/trajes/{{trajeNuevoId}}',
          token: 'tokenAdmin',
          cuerpo: { precio: 1450, stock: { 50: 6 } },
          tests: [estado(200)],
        }),
        peticion({
          nombre: 'Desactivar traje',
          metodo: 'DELETE',
          ruta: 'admin/trajes/{{trajeNuevoId}}',
          token: 'tokenAdmin',
          descripcion: 'No borra el documento: lo marca INACTIVO para no romper el historial de pedidos.',
          tests: [estado(200), 'pm.test("Queda inactivo", () => pm.expect(pm.response.json().traje.estado).to.eql("INACTIVO"));'],
        }),
        peticion({ nombre: 'Citas solicitadas', ruta: 'admin/citas', token: 'tokenAdmin', tests: [estado(200)] }),
        peticion({
          nombre: 'Crear categoría de soporte',
          metodo: 'POST',
          ruta: 'admin/categorias-soporte',
          token: 'tokenAdmin',
          cuerpo: { nombre: 'Garantía {{$randomInt}}', descripcion: 'Incidencias cubiertas por garantía' },
          tests: [estado(201)],
        }),
      ],
    },
    {
      name: '07 · Pruebas de seguridad',
      item: [
        peticion({
          nombre: 'IDOR — Otro cliente lee mi incidencia (403)',
          ruta: 'tickets/{{ticketId}}',
          token: 'tokenOtroCliente',
          descripcion: 'La prueba clave: cambiar el id de la URL no da acceso a datos ajenos.',
          tests: [estado(403)],
        }),
        peticion({ nombre: 'Sin token (401)', ruta: 'tickets', tests: [estado(401)] }),
        peticion({
          nombre: 'Cliente entra al panel de administración (403)',
          ruta: 'admin/metricas',
          token: 'tokenCliente',
          tests: [estado(403)],
        }),
        peticion({
          nombre: 'Asesor entra al panel de administración (403)',
          ruta: 'admin/usuarios',
          token: 'tokenAgente',
          tests: [estado(403)],
        }),
        peticion({
          nombre: 'Registro pidiendo rol ADMIN (queda CLIENTE)',
          metodo: 'POST',
          ruta: 'auth/register',
          cuerpo: { email: 'intruso{{$randomInt}}@correo.com', password: 'Prueba2026', nombre: 'Intruso', rol: 'ADMIN' },
          descripcion: 'El servidor ignora el rol enviado por el cliente.',
          tests: [
            estado(201),
            'pm.test("El rol sigue siendo CLIENTE", () => pm.expect(pm.response.json().user.rol).to.eql("CLIENTE"));',
          ],
        }),
        peticion({
          nombre: 'Contraseña débil (400)',
          metodo: 'POST',
          ruta: 'auth/register',
          cuerpo: { email: 'debil{{$randomInt}}@correo.com', password: 'corta', nombre: 'Débil' },
          tests: [estado(400)],
        }),
        peticion({
          nombre: 'Identificador con formato inválido (400)',
          ruta: 'tickets/esto-no-es-un-id',
          token: 'tokenCliente',
          tests: [estado(400)],
        }),
        peticion({
          nombre: 'Identificador inexistente (404)',
          ruta: 'tickets/000000000000000000000000',
          token: 'tokenCliente',
          tests: [estado(404)],
        }),
      ],
    },
  ],
  event: [
    {
      listen: 'prerequest',
      script: {
        type: 'text/javascript',
        exec: [
          '// Calcula una fecha futura para el formulario de citas.',
          'const d = new Date();',
          'd.setDate(d.getDate() + 21);',
          'pm.environment.set("fechaFutura", d.toISOString().slice(0, 10));',
        ],
      },
    },
  ],
};

const entorno = {
  id: 'd1ff3r3n-e0v1-4a9b-8c2d-entorno2026',
  name: 'Differents — Local',
  values: [
    { key: 'baseUrl', value: 'http://localhost:3000/api', type: 'default', enabled: true },
    { key: 'tokenCliente', value: '', type: 'secret', enabled: true },
    { key: 'tokenOtroCliente', value: '', type: 'secret', enabled: true },
    { key: 'tokenAgente', value: '', type: 'secret', enabled: true },
    { key: 'tokenAdmin', value: '', type: 'secret', enabled: true },
    { key: 'clienteId', value: '', type: 'default', enabled: true },
    { key: 'adminId', value: '', type: 'default', enabled: true },
    { key: 'trajeId', value: '', type: 'default', enabled: true },
    { key: 'trajeNuevoId', value: '', type: 'default', enabled: true },
    { key: 'pedidoId', value: '', type: 'default', enabled: true },
    { key: 'ticketId', value: '', type: 'default', enabled: true },
    { key: 'categoriaId', value: '', type: 'default', enabled: true },
    { key: 'fechaFutura', value: '', type: 'default', enabled: true },
  ],
  _postman_variable_scope: 'environment',
};

const dir = __dirname;
fs.writeFileSync(path.join(dir, 'Differents.postman_collection.json'), json(coleccion));
fs.writeFileSync(path.join(dir, 'Differents.postman_environment.json'), json(entorno));

const total = coleccion.item.reduce((n, carpeta) => n + carpeta.item.length, 0);
console.log(`✓ Colección generada: ${coleccion.item.length} carpetas, ${total} peticiones`);
console.log('  postman/Differents.postman_collection.json');
console.log('  postman/Differents.postman_environment.json');
