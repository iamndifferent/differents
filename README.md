# Differents — Sastrería a medida

Plataforma completa de sastrería masculina: sitio editorial de seis capítulos,
catálogo con pedidos y sistema de incidencias con cuatro niveles de acceso.
API en **Node.js + Express** sobre **MongoDB** (Mongoose).

---

## Índice

1. [Qué incluye](#qué-incluye)
2. [Arrancar en local](#arrancar-en-local)
3. [Base de datos: MongoDB Atlas](#base-de-datos-mongodb-atlas)
4. [Probar con Postman](#probar-con-postman)
5. [Publicar en internet](#publicar-en-internet)
6. [Rutas de la API](#rutas-de-la-api)
7. [Cómo funcionan las incidencias](#cómo-funcionan-las-incidencias)
8. [Estructura del proyecto](#estructura-del-proyecto)
9. [Seguridad](#seguridad)
10. [Antes de enseñarlo](#antes-de-enseñarlo)

---

## Qué incluye

**Sitio público (seis capítulos)**

| Capítulo | Contenido |
| --- | --- |
| I · La Visión | Portada a pantalla completa |
| II · Los Tejidos | Selector de lana merina, cachemira y seda |
| III · El Corte | Selector de solapa de pico, muesca y esmoquin |
| IV · El Atelier | Cuadrícula editorial del proceso de prueba |
| V · Los Detalles | Ojales, botones de asta y generador de monograma |
| VI · Cita Privada | Formulario de reserva que guarda en MongoDB |

**Plataforma**

- Catálogo con filtros y pedidos con control de stock
- Incidencias con conversación, notas internas y auditoría
- Cuatro roles: visitante, cliente, asesor y administrador
- Panel de administración con métricas, usuarios, catálogo y citas

---

## Arrancar en local

Necesita **Node.js 18 o superior** y una base MongoDB (local o en Atlas).

```bash
# 1. Instalar dependencias
npm install

# 2. Crear el archivo de configuración
cp .env.example .env

# 3. Generar una clave para los tokens y pegarla en .env (JWT_SECRET)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 4. Cargar los datos de ejemplo
npm run seed

# 5. Arrancar
npm start
```

Abra `http://localhost:3000`.

### Credenciales de ejemplo

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Administrador | `admin@differents.com` | `Admin2026!` |
| Asesor | `sastre@differents.com` | `Agente2026!` |
| Asesor | `soporte@differents.com` | `Agente2026!` |
| Cliente | `juan@correo.com` | `Cliente2026!` |
| Cliente | `pedro@correo.com` | `Cliente2026!` |

> Son sólo para desarrollo. Bórrelas o cámbielas antes de publicar.

### Comandos disponibles

| Comando | Qué hace |
| --- | --- |
| `npm start` | Arranca el servidor |
| `npm run dev` | Arranca y reinicia al guardar cambios |
| `npm run seed` | Vacía las colecciones y carga los datos de ejemplo |
| `npm run seed -- --keep` | Añade lo que falte sin borrar nada |
| `npm run test:offline` | 56 pruebas que no necesitan base de datos |
| `npm run test:api` | Pruebas completas de extremo a extremo |

---

## Base de datos: MongoDB Atlas

Atlas es el MongoDB en la nube de la propia empresa. Tiene un plan gratuito
(M0) suficiente para este proyecto.

1. Cree una cuenta en <https://www.mongodb.com/cloud/atlas/register>.
2. **Build a Database → M0 (Free)**. Elija la región más cercana.
3. **Database Access → Add New Database User**. Anote usuario y contraseña.
   Si la contraseña lleva símbolos como `@`, `#` o `/`, tendrá que
   codificarlos en la URL (por ejemplo `@` se escribe `%40`).
4. **Network Access → Add IP Address**.
   - Para probar desde su ordenador: *Add Current IP Address*.
   - Para que funcione desde Render: `0.0.0.0/0` (permite cualquier origen;
     la base sigue protegida por usuario y contraseña).
5. **Database → Connect → Drivers** y copie la cadena. Tendrá esta forma:

```
mongodb+srv://USUARIO:CONTRASENA@cluster0.xxxxx.mongodb.net/differents?retryWrites=true&w=majority
```

6. Péguela en `MONGODB_URI` dentro de su `.env`.

> Escriba `differents` como nombre de base justo antes del `?`. Si lo omite,
> Mongoose usará `test`.

### Ver los datos

- **MongoDB Compass** (aplicación de escritorio, gratuita): pegue la misma
  cadena de conexión y verá las colecciones con su contenido.
- **Atlas → Browse Collections**: lo mismo desde el navegador.

Colecciones que crea el proyecto: `usuarios`, `trajes`, `pedidos`, `tickets`,
`citas`, `categoriasoportes` y `contadors`.

---

## Probar con Postman

En la carpeta `postman/` hay dos archivos listos para importar.

### Importar

1. Abra Postman → **Import** → arrastre los dos archivos:
   - `Differents.postman_collection.json` (50 peticiones en 8 carpetas)
   - `Differents.postman_environment.json` (las variables)
2. Arriba a la derecha, seleccione el entorno **Differents — Local**.
3. Si su servidor no está en `localhost:3000`, cambie la variable `baseUrl`.

### Usar

La colección se encarga del token sola: al ejecutar los *login* de la carpeta
**01 · Autenticación**, guarda cada token en su variable. A partir de ahí, el
resto de carpetas ya funcionan sin que toque nada.

Lo mismo ocurre con los identificadores: al listar trajes guarda `trajeId`, al
crear un pedido guarda `pedidoId`, al abrir una incidencia guarda `ticketId`.

**Para ejecutarlo todo de golpe:** botón derecho sobre la colección →
**Run collection** → *Run*. Verá las 50 peticiones con sus comprobaciones.
Ejecútelas en el orden en que están, porque unas dependen de otras.

### Carpetas

| Carpeta | Qué prueba |
| --- | --- |
| 00 · Estado | Que la API responde y MongoDB está conectado |
| 01 · Autenticación | Registro, login de los cuatro usuarios, perfil |
| 02 · Catálogo | Listado público, filtros y búsqueda |
| 03 · Pedidos | Crear pedido y control de stock |
| 04 · Incidencias | Ciclo completo: abrir, responder, resolver, cerrar |
| 05 · Citas | Formulario del Capítulo VI y sus validaciones |
| 06 · Administración | Métricas, usuarios, catálogo y citas |
| 07 · Seguridad | IDOR, permisos por rol y validaciones |

La carpeta de seguridad es la interesante para una demostración: comprueba que
un cliente **no** puede leer la incidencia de otro aunque conozca su
identificador, que un cliente no entra en el panel de administración y que el
rol enviado en el registro se ignora.

### Regenerar la colección

Si añade rutas a la API:

```bash
node postman/generar-coleccion.js
```

---

## Publicar en internet

El proyecto sirve la web y la API desde el mismo servidor, así que con un solo
despliegue tiene las dos cosas.

### Opción A — Render (recomendada, tiene plan gratuito)

1. Suba el proyecto a un repositorio de GitHub.
2. Entre en <https://dashboard.render.com> → **New → Blueprint**.
3. Elija su repositorio. Render leerá `render.yaml` automáticamente.
4. Le pedirá dos valores:
   - `MONGODB_URI`: la cadena de Atlas.
   - `CORS_ORIGIN`: la URL que le asigne Render, por ejemplo
     `https://differents.onrender.com`.
   `JWT_SECRET` lo genera Render solo.
5. **Apply**. En unos minutos tendrá la web publicada.
6. Cargue los datos de ejemplo una vez: pestaña **Shell** del servicio →
   `npm run seed`.

> El plan gratuito de Render duerme el servicio tras 15 minutos sin visitas.
> La primera petición después tarda unos 30 segundos. Para una presentación,
> ábrala un minuto antes.

### Opción B — Railway

1. <https://railway.app> → **New Project → Deploy from GitHub repo**.
2. En **Variables**, añada `MONGODB_URI`, `JWT_SECRET` y `CORS_ORIGIN`.
3. En **Settings → Networking**, pulse *Generate Domain*.

### Opción C — Docker

Para un VPS o cualquier proveedor de contenedores:

```bash
docker build -t differents .
docker run -p 3000:3000 --env-file .env differents
```

### Lista de comprobación antes de publicar

- [ ] `JWT_SECRET` es una clave aleatoria larga, no la del ejemplo
- [ ] `NODE_ENV=production`
- [ ] `CORS_ORIGIN` es su dominio, no `*`
- [ ] En Atlas, *Network Access* permite la IP del servidor
- [ ] El archivo `.env` **no** está subido al repositorio
- [ ] Ha cambiado las contraseñas de ejemplo

El servidor se niega a arrancar en producción si `JWT_SECRET` sigue teniendo
el valor de ejemplo.

---

## Rutas de la API

Todas cuelgan de `/api`. La columna «Acceso» indica quién puede llamarlas.

### Públicas

| Método | Ruta | Para qué |
| --- | --- | --- |
| GET | `/health` | Estado del servicio y de MongoDB |
| GET | `/trajes` | Catálogo. Filtros: `categoria`, `corte`, `precio_min`, `precio_max`, `buscar` |
| GET | `/trajes/:id` | Ficha de un traje |
| GET | `/categorias-soporte` | Motivos de incidencia |
| POST | `/citas` | Reservar cita privada |
| POST | `/auth/register` | Alta de cliente |
| POST | `/auth/login` | Iniciar sesión |

### Con sesión

| Método | Ruta | Acceso |
| --- | --- | --- |
| GET | `/auth/me` | Cualquiera con sesión |
| PUT | `/auth/profile` | Cualquiera con sesión |
| POST | `/pedidos` | Cliente |
| GET | `/pedidos` | Cliente (los suyos) · Equipo (todos) |
| POST | `/tickets` | Cliente |
| GET | `/tickets` | Cliente (las suyas) · Equipo (todas) |
| GET | `/tickets/:id` | Dueño o equipo |
| POST | `/tickets/:id/mensajes` | Dueño o equipo |
| PUT | `/tickets/:id` | Cliente (cerrar/reabrir) · Equipo (todo) |

### Administración

Todas exigen rol `ADMIN`.

| Método | Ruta |
| --- | --- |
| GET | `/admin/metricas` |
| GET | `/admin/usuarios` · PUT `/admin/usuarios/:id` |
| GET | `/admin/agentes` |
| GET | `/admin/trajes` · POST · PUT `/:id` · DELETE `/:id` |
| GET | `/admin/citas` · PUT `/admin/citas/:id` |
| POST | `/admin/categorias-soporte` |

### Códigos de respuesta

| Código | Significado |
| --- | --- |
| 200 / 201 | Correcto |
| 400 | Datos mal enviados |
| 401 | Falta el token o ha caducado |
| 403 | Sin permiso para ese recurso |
| 404 | No existe |
| 409 | Conflicto: duplicado o transición no permitida |
| 413 | Contenido demasiado grande |
| 429 | Demasiadas peticiones |

---

## Cómo funcionan las incidencias

Cada incidencia tiene un código `DIF-AÑO-NNNN` y recorre cinco estados:

```
ABIERTO → EN_CURSO → PENDIENTE_CLIENTE → RESUELTO → CERRADO
```

Las transiciones permitidas están declaradas en
`src/routes/tickets.routes.js`. Cualquier salto que no figure ahí se rechaza
con un 409: no se puede, por ejemplo, pasar de `CERRADO` a `RESUELTO`.

**Quién hace qué**

- **Cliente**: abre la incidencia y escribe mensajes. Cuando está `RESUELTO`
  puede confirmar el cierre o reabrirla. Si responde a una incidencia en
  `PENDIENTE_CLIENTE`, vuelve sola a `EN_CURSO`.
- **Asesor**: cambia estado y prioridad y escribe notas internas. Si actúa
  sobre una incidencia sin dueño, se la autoasigna.
- **Administrador**: todo lo anterior, y es el único que puede reabrir una
  incidencia cerrada.

**Notas internas.** Un mensaje con `es_nota_interna: true` sólo lo ven asesores
y administradores. El filtrado se hace en el servidor, no en la pantalla: al
cliente ni siquiera le llega.

**Auditoría.** Cada cambio de estado, prioridad o asignación queda registrado
con quién lo hizo y los valores anterior y nuevo. El cliente tampoco recibe
este registro.

### Decisión de diseño en MongoDB

En la versión anterior con SQL, los mensajes y el historial eran dos tablas
aparte que había que unir con `JOIN`. Aquí van **dentro del propio documento**
del ticket, porque nunca se consultan sueltos: siempre se leen junto a su
incidencia. Una sola lectura devuelve la conversación completa.

Los códigos secuenciales (`DIF-2026-0001`) usan la colección `contadors` con
`$inc`, que es una operación atómica. Es el equivalente en MongoDB al
`AUTOINCREMENT` de SQL, y garantiza que dos peticiones simultáneas no reciban
el mismo número.

---

## Estructura del proyecto

```
differents/
├── src/
│   ├── server.js              Arranque, middlewares y montaje de rutas
│   ├── seed.js                Datos de ejemplo
│   ├── config/db.js           Conexión a MongoDB
│   ├── models/                Esquemas de Mongoose
│   │   ├── Usuario.js         Con cifrado de contraseña
│   │   ├── Traje.js           Stock por talla
│   │   ├── Pedido.js          Guarda nombre y precio del momento de compra
│   │   ├── Ticket.js          Mensajes e historial embebidos
│   │   ├── Cita.js
│   │   ├── CategoriaSoporte.js
│   │   ├── Contador.js        Códigos secuenciales atómicos
│   │   └── plugins/
│   ├── middleware/
│   │   ├── auth.js            JWT, roles y comprobación IDOR
│   │   └── validar.js         Validación y limpieza de entradas
│   └── routes/                Una ruta por área
├── public/
│   ├── index.html             Los seis capítulos y la plataforma
│   ├── app.js                 Toda la lógica del navegador
│   └── img/
├── postman/                   Colección y entorno
├── test/
│   ├── offline.test.js        56 pruebas sin base de datos
│   └── smoke.test.js          Pruebas completas
├── render.yaml                Despliegue en Render
├── Dockerfile
└── .env.example
```

---

## Seguridad

| Medida | Dónde |
| --- | --- |
| Contraseñas cifradas con bcrypt | `models/Usuario.js` |
| Tokens JWT con caducidad | `middleware/auth.js` |
| El rol nunca se acepta del cliente | `routes/auth.routes.js` |
| Comprobación IDOR en cada recurso | `middleware/auth.js` |
| Validación de entradas | `express-validator` en cada ruta |
| Limpieza contra XSS | `middleware/validar.js` |
| Cabeceras de seguridad | `helmet` en `server.js` |
| Límite de peticiones | 300 cada 15 min · 20 en login |
| Límite de tamaño del cuerpo | 200 KB |
| Token revisado contra la base | `middleware/auth.js` |

Dos detalles que conviene conocer:

- **IDOR.** Al pedir una incidencia, el servidor compara el dueño del documento
  con el usuario del token. Cambiar el identificador en la URL devuelve 403.
  La carpeta 07 de Postman lo demuestra.
- **Token revisado en cada petición.** No basta con que la firma sea válida:
  se vuelve a leer el usuario. Si le desactiva la cuenta a alguien, su token
  deja de servir al instante.

### Limitación conocida

La política de seguridad de contenido (CSP) incluye `'unsafe-inline'` para
scripts, porque el HTML usa atributos `onclick`. Si quiere endurecerlo, mueva
esos manejadores a `addEventListener` dentro de `app.js` y quite esa directiva
de `src/server.js`.

---

## Antes de enseñarlo

Hay textos de ejemplo en la web que debería revisar o sustituir:

- La cifra «+2.400 caballeros vestidos» del Capítulo I
- Los precios de los tres niveles (690 €, 1.290 €, 2.400 €)
- Las ciudades de los ateliers y los plazos de entrega
- Los nombres y precios de los ocho trajes del catálogo

Las fotografías de los capítulos IV y V son marcadores a la espera de la
sesión fotográfica. Para sustituirlas, deje los archivos en `public/img/` y
cambie el bloque `placeholder-photo` correspondiente en `public/index.html`
por una etiqueta `<img>`.
