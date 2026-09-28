# syntax=docker/dockerfile:1
# Multi-stage build: compile the Vite SPA, then serve the static files via nginx.
# Mirrors ../admin/Dockerfile. The built app is hosted under the /omv base path
# and is proxied by the root nginx (see ../nginx.conf and ../nginx.prod.conf).
# Vite 7 requires Node 20.19+ / 22.12+.
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Public deployment path. Must include leading and trailing slashes.
# BASE_PATH drives Vite's `base`, which in turn drives the router basename,
# the service worker scope, and every emitted asset URL.
ARG BASE_PATH=/omv/
ENV BASE_PATH=${BASE_PATH}

# API origin only - API_PATHS already include the "/api/" prefix and the WS
# paths include "/ws/", so this must NOT be set to "/api".
# Same-origin in production (nginx proxies /api/ and /ws/ to the Django web
# service), which keeps the app free of CORS issues.
ARG VITE_API_URL=https://onmyvayy.com
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# --- Runtime: static server ---
FROM nginx:alpine

# Copy into the "omv" subdirectory so that the /omv/... URLs emitted by Vite
# resolve to real files without any rewriting.
COPY --from=build /app/dist /usr/share/nginx/html/omv
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
