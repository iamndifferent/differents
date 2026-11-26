# Imagen para desplegar en cualquier proveedor que acepte contenedores
# (Railway, Fly.io, Google Cloud Run, Azure, un VPS propio…).
#
#   docker build -t differents .
#   docker run -p 3000:3000 --env-file .env differents

FROM node:22-alpine

WORKDIR /app

# Las dependencias primero: así Docker reaprovecha la caché mientras
# sólo cambie el código y no el package.json.
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src ./src
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# No ejecutar como root.
USER node

# Comprobación de salud del contenedor.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
