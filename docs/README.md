# VAYY Documentation

This folder is the canonical home for VAYY engineering and product documentation. Keep documentation here instead of scattering project guides among application directories.

## Documentation map

| Area | Guide | Covers |
|---|---|---|
| Whole system | [Project overview](overview.md) | Applications, ownership and shared rules |
| Handover | [Engineering handover](project-handover.md) | Current checkout, runtime snapshot, route readiness and next steps |
| Architecture | [System overview](architecture/system-overview.md) | Repository responsibilities, data flow and integrations |
| Engineering rules | [Project mandates](architecture/project-mandates.md) | Geospatial, real-time, caching and consistency rules |
| Scalability | [Scalability report](architecture/scalability-report.md) | Current scaling risks and staged growth plan |
| Backend | [Backend guide](backend/README.md) | Django apps, API groups, data and local commands |
| API reference | [API reference](backend/api-reference.md) | API prefixes and important endpoint families |
| Backend deep reference | [Backend domain reference](backend/domain-reference.md) | Detailed domain flows, WebSockets, broker topology and development notes from the existing backend guide |
| Admin console | [Admin guide](admin/README.md) | Admin UI pages, authentication, API use and commands |
| Web frontend | [Frontend guide](frontend/README.md) | React SPA architecture, modules, API and commands |
| Frontend architecture | [Frontend architecture note](frontend/architecture.md) | Intended folder ownership and migration rules |
| Mobile app | [Mobile guide](vayy_app/README.md) | Expo app architecture, navigation, maps and commands |
| Mobile product model | [Product context](vayy_app/product-context.md) | Route-first product concept and passenger/driver journeys |
| Mobile workflow reference | [Screen/workflow reference](vayy_app/workflow-reference.md) | Screen and journey notes moved from the app README; validate paths against current source |
| Mobile known debt | [Migration debt](vayy_app/migration-debt.md) | Previously investigated defects/fixes |
| Mobile bike flow | [Bike flow audit](vayy_app/bike-flow-audit.md) | Audit findings and proposed passenger bike-ride improvements |
| Deployment | [Operations guide](operations/deployment.md) | Docker, environment configuration, checks and deployment safety |

Historical source documents that contained useful context were moved into this tree and retained with clear names. Treat older flow audits and folder maps as snapshots, not as proof of current implementation. Generated build logs, vendored dependency licenses, code comments, and user-facing legal documents are not engineering guides and remain with their relevant code/assets.

## Repository areas

- `backend/`: Django project and its domain apps.
- `frontend/`: React/Vite web application for passenger and driver workflows.
- `admin/`: React/Vite operations and administration console.
- `vayy_app/`: Expo/React Native mobile application.
- `docker-compose.yaml`, `docker-compose-prod.yaml`, and Nginx configs: container orchestration and HTTP routing.

## Documentation conventions

1. Describe the implementation currently present in code; label proposed work as proposed.
2. Do not document secrets or real credentials. Use environment-variable names and `.env.example`.
3. When an endpoint or route changes, update the corresponding API and client guide.
4. Preserve tool-discovered instruction files (`GEMINI.md`, `AGENTS.md`) at their original locations; they point contributors to the canonical docs.
5. Record the command and environment used when claiming a check passed. A build check is not a substitute for device, integration, or production verification.
