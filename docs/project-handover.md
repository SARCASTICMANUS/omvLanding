# OMV / VAYY Engineering Handover

**Snapshot date:** 2026-10-22
**Branch:** `feat/wsx`
**Working tree:** not clean; 39 tracked paths are modified and 39 paths are untracked, including this report and its index entry. Treat all as uncommitted work. Review before committing, cleaning, or changing branches.

## Project and architecture

OMV (also called VAYY in repository documentation) is a route-first mobility platform. The repository contains the Django API in `backend/vayy/`, separate Vite applications in `frontend/` and `admin/`, and the Expo/React Native client in `vayy_app/`.

The local Compose stack connects Django/DRF and Channels to PostgreSQL/PostGIS, Redis, RabbitMQ and Celery. Nginx fronts the web clients and API. OSRM supplies road routing where configured. Backend source is bind-mounted into the `web` and `celery` containers; run Django commands in Compose so they use the stack's configured environment and database.

Typical mobile journey flow:

1. The passenger chooses pickup and destination in `vayy_app`.
2. The app calls `POST /api/transport/routes/dynamic-preview/` through its route service.
3. Backend transport services resolve the city, discover nearby global stops, and match public route directions using ordered route-stop associations.
4. OSRM supplies supported road-routing results. Client screens normalize and render the response.
5. Driver verification and vehicle/document operations use the accounts and operations APIs; server verification state controls access.

The global `Stop` inventory is shared; `RouteStopAssociation` records connect existing stops to route directions and sequence. A nearby stop alone does not prove that a public transport journey exists.

## Current working-tree changes

These are present locally and have not been reviewed or committed as a single change set:

- Backend and admin routing/import work: global stop discovery, ordered route membership, route search, OSRM integration, importer/diagnostic commands, and route administration.
- Passenger/driver app work: route preview, stop and map presentation, walking-distance handling, and related API normalization.
- Driver KYC/verification work: vehicle/document verification guards and a verification gate that opens the existing registration form. A prior web crash in the gate was addressed by moving navigation-state handling to the container and using a navigation ref; that browser flow still needs a runtime smoke check.
- New tests, migrations, route corpus/geometry files, and import notes are untracked. There are also untracked setup logs and temporary files; inspect them before deciding whether to retain or commit them. Do not expose their contents in public logs or documentation.

The changes are not all equally verified. Do not infer that a modified or newly added test has passed just because it is present in the working tree.

## Live development environment

`docker compose ps` was run from the repository root. The `web`, `db` (PostGIS), and `osrm` containers reported healthy. `admin`, `frontend`, `nginx`, `celery`, `redis`, and `rabbitmq` were running; those without a Compose health check showed `Up` rather than `healthy`.

Use the existing stack and keep `.env` values private. From the repository root:

```powershell
docker compose up -d
docker compose ps
docker compose exec web python manage.py check
docker compose exec web python manage.py diagnose_lucknow_route_search
```

The read-only Lucknow diagnostic completed successfully in the `web` container using Python 3.12. It emitted a DRF warning that a `min_value` should be an integer or `Decimal`; the warning did not stop the command. No database rows were changed by this diagnostic.

## Current Lucknow route readiness

The diagnostic resolves Lucknow as:

| Measure | Live value |
|---|---:|
| City ID | `2ed93d9f-0d08-4cba-93eb-c965f8d17f17` |
| Routing active | Yes |
| City centroid | Missing (`null`) |
| Maximum configured walk-to-stop distance | 3,000 m |
| Global stops / with coordinates / without coordinates | 1,559 / 1,559 / 0 |
| Route records / public route records | 13 / 0 |
| Route directions | 13 |
| Global route-stop association rows / distinct associated stops | 26 / 4 |
| Directions with at least two global ordered-stop associations | 13 |
| Directions with at least two legacy route-owned stops | 0 |
| Routes missing geometry | 0 |

For the diagnostic's built-in SGPGI → IIM coordinates, it found 20 pickup candidates and 18 destination candidates (all eligible under the reported boarding/alighting flags), but returned **no valid public ordered route direction**. The association and geometry counts do not make a route passenger-available: there are no public routes. Do not claim SGPGI → IIM works until a legitimate route has been reviewed, published, and the authenticated dynamic-preview API returns it.

The route corpus and GeoJSON currently in the working tree are inputs for review/import, not evidence of published production service. Follow `docs/lucknow-scraped-data-import.md`; preserve source identities and geometry, and do not create memberships from proximity alone.

## Verification status and known limitations

| Area | Evidence in this handover snapshot | Still needed |
|---|---|---|
| Compose/database | Services inspected; read-only Django route diagnostic exited successfully | Authenticated API smoke test against current public route data |
| Route availability | Diagnostic found no matching public direction | Review/import/publish genuine route membership and verify direction order |
| OSRM walking | OSRM container is up; current configured profile is car routing | A pedestrian-capable profile/service and truthful walking distance/duration/geometry verification |
| Mobile KYC navigation | Gate/navigation code is in the uncommitted tree | Browser and Android device check: open form, load existing details, upload documents, submit, return to pending/rejected/verified state |
| Automated checks | `docs/mobile/ISSUE_FIX_LOG.md` records earlier targeted mobile checks; it also records incomplete full lint and missing device flow coverage | Re-run relevant backend tests, mobile lint/export, and web/admin builds against this exact tree before release |

The report's live checks were `docker compose ps` and `docker compose exec -T web python manage.py diagnose_lucknow_route_search`. No full test suite, full lint, build, authenticated route request, or device flow was run for this handover. Historical verification notes should be treated as historical, not as a pass for the current working tree.

## Handoff priorities

1. Preserve the working tree; review the 39 modified and 39 untracked paths and identify generated logs/temp files before staging anything.
2. Review the route corpus and GeoJSON, then run the documented dry-run importer. Validate source geometry and stop order before applying or publishing.
3. Create/publish only genuine route directions, then rerun the Lucknow diagnostic and authenticated dynamic-preview request. Confirm SGPGI → IIM specifically.
4. Re-run backend tests/system checks and frontend/admin/mobile lint/build checks; record exact commands and outcomes.
5. Smoke-test the KYC gate and registration submission in web and Android. Verify that required vehicle data and all document slots persist and that the server's returned verification stage is accurate.
6. Decide separately whether pedestrian routing is a release requirement; current car-profile OSRM output must not be labeled as walking directions.

See [system overview](architecture/system-overview.md), [backend guide](backend/README.md), [API reference](backend/api-reference.md), [mobile guide](vayy_app/README.md), [deployment guide](operations/deployment.md), and [Lucknow import instructions](lucknow-scraped-data-import.md) for deeper detail.
