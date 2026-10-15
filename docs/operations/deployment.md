# Development and Deployment Operations

## Before you start

- Install Docker Desktop and Docker Compose for containerized development.
- For local JS work, use the Node version supported by each package's dependencies and lockfile.
- For backend-only work, use the Python version and system GIS libraries supported by the backend image.
- Copy variable names from `.env.example`; create local secrets separately and never commit `.env`.

## Docker Compose

The repository contains `docker-compose.yaml` for the local stack and `docker-compose-prod.yaml` for production-oriented deployment. Review both files before running them; they may start different services, mount different files, or use different environment requirements.

Common commands from repository root:

```bash
docker compose config --services
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs -f
docker compose logs -f web
docker compose exec web python manage.py check
docker compose down
```

Use the actual service names printed by `docker compose config --services`; do not assume the backend service is named `web` in every Compose file.

## Environment configuration

- Root `.env.example` documents root/Compose configuration names.
- Backend Django settings read environment-driven database, Redis, Celery, security, JWT, and OSRM values.
- Web clients may have separate Vite/Expo public build-time variables.
- Never place production secrets in public client variables. Any variable with a public prefix is bundled into client artifacts and must be treated as public.
- Keep `.env`, signing files, OAuth credentials, service-account JSON and private certificates out of Git.

## Routing and proxies

Nginx config files determine which SPA/API receives a URL, the admin mount prefix, static/media behavior and WebSocket proxying. After changing a base path or route, verify:
1. root web app opens;
2. admin mount path opens;
3. nested routes survive browser refresh;
4. API requests reach Django and keep authorization headers;
5. WebSocket upgrade requests reach ASGI;
6. static/media URLs and API docs behave as intended.

## Production readiness checklist

- [ ] Production secrets supplied by deployment environment/secret manager.
- [ ] `DEBUG=False`, allowed hosts and CORS/CSRF origins explicitly configured.
- [ ] HTTPS and secure cookie/token policies verified.
- [ ] Database backups, migrations and rollback procedure tested.
- [ ] PostGIS and required PostgreSQL extensions enabled.
- [ ] Redis persistence/availability and access control reviewed.
- [ ] Celery worker and scheduler lifecycle explicitly configured and monitored.
- [ ] OSRM data/profile availability and external routing timeouts verified.
- [ ] Health checks cover required dependencies rather than only returning a fixed HTTP 200.
- [ ] Logs redact tokens, OTPs, payment data, private documents and personal information.
- [ ] Static/media storage, upload limits and access policies reviewed.
- [ ] Build, lint, API integration, WebSocket, payment webhook, KYC and mobile-device checks passed.
- [ ] Rate limits, error monitoring, metrics and alerting configured.
- [ ] Restore and incident-response runbooks documented.

A successful image build or `manage.py check` alone is not proof of production readiness. Deploy only after environment-specific checks and smoke tests.
