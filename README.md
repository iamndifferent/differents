# Differents — Sastrería a medida

Plataforma completa de sastrería masculina: sitio editorial de seis capítulos,
catálogo con pedidos y sistema de incidencias con cuatro niveles de acceso.
API en **Node.js + Express** sobre **MongoDB** (Mongoose).

---

## Índice

1. [Qué incluye](#qué-incluye)
2. [Base de datos: MongoDB Atlas](#base-de-datos-mongodb-atlas)
3. [Publicado en internet](#publicar-en-internet)
4. [Probar con Postman](#probar-con-postman)
5. [Cómo funcionan las incidencias](#cómo-funcionan-las-incidencias)
6. [Estructura del proyecto](#estructura-del-proyecto)
7. [Seguridad](#seguridad)

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


## Base de datos: MongoDB Atlas

Atlas es el MongoDB en la nube de la propia empresa. 


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


## Publicado en internet
https://differents.onrender.com


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



Las fotografías de los capítulos IV y V son marcadores a la espera de la
sesión fotográfica. Para sustituirlas, deje los archivos en `public/img/` y
cambie el bloque `placeholder-photo` correspondiente en `public/index.html`
por una etiqueta `<img>`.
