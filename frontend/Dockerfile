# syntax=docker/dockerfile:1
# Multi-stage build: compile the Vite SPA, then serve the static files via nginx.
# Mirrors ../admin/Dockerfile.
#
# The SPA is served from the ROOT path (/), not from a subdirectory. The
# omv-backend front door (../omv-backend/nginx.frontend.conf) owns :80 and routes:
#   /            -> this SPA        (landing page / passenger + driver app)
#   /zxcv/       -> ../admin        (web admin SPA)
#   /api/ /ws/   -> the Django `web` service
#
# Vite 7 requires Node 20.19+ / 22.12+.
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Public deployment path. Must include leading and trailing slashes.
# BASE_PATH drives Vite's `base`, which in turn drives the router basename
# (src/App.jsx), the service worker scope (src/main.jsx) and every emitted
# asset URL. "/" mounts the SPA at the origin root.
ARG BASE_PATH=/
ENV BASE_PATH=${BASE_PATH}

# API origin only - API_PATHS already include the "/api/" prefix and the WS
# paths include "/ws/", so this must NOT be set to "/api".
# Same-origin in production (nginx proxies /api/ and /ws/ to the Django web
# service), which keeps the app free of CORS issues.
ARG VITE_API_URL=https://onmyvayy.com
ENV VITE_API_URL=${VITE_API_URL}

# Dynamic route creation switch. `true` makes route creation call the backend
# Dynamic Route API and render the generated route in the existing Route Card.
# Set to `false` at build time to roll back to the legacy fixed-route lookup.
ARG VITE_DYNAMIC_ROUTE_CREATION_ENABLED=true
ENV VITE_DYNAMIC_ROUTE_CREATION_ENABLED=${VITE_DYNAMIC_ROUTE_CREATION_ENABLED}

RUN npm run build

# --- Runtime: static server ---
FROM nginx:alpine

# Copy to the document ROOT. The compose front door (nginx.frontend.conf) mounts
# over the nginx.conf below, but keep this image self-consistent so it also works
# standalone: the SPA must resolve at /, not /omv/.
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
