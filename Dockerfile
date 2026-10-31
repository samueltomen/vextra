# syntax=docker/dockerfile:1

# --- Build : interface web + serveur Node (un seul fichier JavaScript) --------
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/domain/package.json packages/domain/
RUN pnpm install --frozen-lockfile

COPY . .
# Pas de VITE_API_URL : le navigateur appelle l'API sur la même origine.
RUN pnpm --filter @cronping/web build \
 && pnpm --filter @cronping/api build:node

# --- Exécution : aucune dépendance, juste Node et deux dossiers ---------------
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8787 \
    WEB_ROOT=./web
WORKDIR /app

COPY --from=build /repo/apps/api/dist-node/server.mjs ./server.mjs
COPY --from=build /repo/apps/web/dist ./web

USER node
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.mjs"]
