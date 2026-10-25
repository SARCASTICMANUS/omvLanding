# Admin stop import and route setup handover

**Snapshot date:** 2026-10-25  
**Scope:** Admin stop creation, route membership, and the current Noida upload failure.

## Current import flow

In **Dynamic Routing > Upload stops**, the current Admin source accepts one city file. For the multi-sheet XLSX format:

- `Stops` supplies the city's global stop catalogue, including stops that are not on a route.
- `Route_Stop_Master` supplies each ordered route-stop association. Stops found only in this sheet are also added to the global catalogue.
- A complete version 1 route master in XLSX may omit `schema_version`; the importer detects it and supplies version `1`. A version 1 CSV must include `schema_version=1` and the complete v1 columns documented in [Lucknow import instructions](lucknow-scraped-data-import.md).
- City is detected from `city_name`. An unknown city is created on Apply. This XLSX path does not need a separate GeoJSON upload. Without source geometry, the map line joins the ordered stop coordinates directly; it is approximate, not road or rail geometry, and its road distance stays unset.
- A stop with a valid source ID and coordinates but no name is imported with a generated `Nearest OMV Stop` or `OMV Stop N` label. Legacy `Unnamed stop (<stop_id>)` placeholders are normalized by migration `0011`; stops remain provisional with boarding and alighting disabled until reviewed. Missing IDs or invalid coordinates still block Apply.
- Dry Run does not write rows. Apply is enabled only when there are no blocking errors and uses a short-lived token bound to the exact file. Imported routes are private and stops provisional until an administrator reviews and publishes them.

## Noida workbook preflight

The local `OMV_NOIDA_Stops.xlsx` was inspected without writing to the database. It contains 4,334 rows in `Stops` and 40,245 in `Route_Stop_Master`. The route sheet has the v1 fields except `schema_version`; the parser found 952 route directions, no missing/invalid route fields, no repeated sequence numbers, and no invalid coordinates. There are 4,528 unique route stop IDs; 350 are absent from `Stops`, so the importer adds them from route rows. The total catalogue is 4,684 stops (4,334 sheet IDs plus 350 route-only IDs).

All 4,334 stop rows have valid IDs and coordinates. Seventy-four have a blank name; their source marks them rejected/unassociated, but the importer now retains the coordinates under generated placeholder names and disables boarding/alighting. This was a static file preflight only; the workbook has not been run through the live API or imported.

Noida has 274 repeated stop visits across 192 route directions. Their sequence numbers are unique and continuous. The route search and ordered-stop editor now allow a physical stop to occur multiple times in one direction, which is needed to preserve the source route order.

## Earlier upload errors and current deployment state

The current `DynamicRouting.jsx` submits just `file` and `mode` (plus `apply_token` on Apply). The earlier browser request also included `city_slug=noida`, from the older form. The reported `/zxcv/` 502 is no longer active; the current one-file Admin upload form loads.

The HTTP 400 is caused by `RequestResponseLoggingMiddleware` reading `request.body` before checking for multipart. Django's default `DATA_UPLOAD_MAX_MEMORY_SIZE` is 2.5 MB; its raw-body check raises before DRF parses the uploaded file. Reproduced without authentication: Lucknow's 29 KB workbook reaches the API and returns the expected 401, while Noida's 4 MB workbook receives Django's HTML 400. The middleware now skips reading multipart bodies, and a regression test covers this. Rebuild the backend `web` service from this checkout with `docker compose -f docker-compose.yaml up -d --build --force-recreate web`, then run Dry Run from a logged-in Admin session.

## How Admin adds stops and connects them to routes

| Admin area | What it does | Data behavior |
|---|---|---|
| **Dynamic Routing > Upload stops** | Imports a city workbook or route master | Creates global city stops and ordered route memberships from the file. Use this for the supplied multi-city master/workbook. |
| **Dynamic Routing > Stops** | Searches and filters the stop inventory | Read-only inventory view; it does not add stops. |
| **Fixed Routing > Routes** | Creates a route direction or edits its ordered stops | Searches existing global stops by name or map radius, lets the admin order them, builds a road preview, then saves route memberships. New routes remain private until published. It reuses global stop records; it does not create the physical stop itself. |
| **`POST /transport/admin/stops/`** | Admin stop CRUD API | The serializer allows `route` to be omitted; sending `city`, `name`, and `location` with no route creates a global stop. `is_global` is derived by the server. |
| **`POST /transport/admin/stops-bulk/`** | Legacy CSV bulk endpoint | A CSV row without a route becomes a global stop; this endpoint is not called by the current Dynamic Routing Upload panel. |
| **Fixed Routing > Routes > route import** | Older CSV/Excel route wizard | Calls `/transport/admin/route-import/` and creates route-owned legacy Stop rows. This is a different data path from the shared global-stop catalogue and route associations. |

The older standalone `Stops.jsx` form sends a route field and does not provide a city-global-stop workflow. In `RouteExplorer.jsx`, the map's **Add Stop** control only adds a draft row; `handleSave` skips rows without an ID, so a newly added row is not persisted by that control. Prefer the workbook importer for initial stop data and **Fixed Routing > Routes** for associating existing global stops with a route.

## Handoff steps

1. Confirm the active Compose project/file is the one rooted at this checkout. Restore the `admin` service and verify `/zxcv/` returns HTTP 200.
2. Submit either workbook using **Dynamic Routing > Upload stops > Dry Run**. Confirm the expected counts: Lucknow 174 global stops, 11 directions, 82 ordered memberships; Noida 4,684 global stops, 952 directions, 40,245 ordered memberships.
3. Review warnings/errors, especially Noida's generated names for 74 unnamed stops and approximate stop-coordinate geometry. Apply only when `can_apply=true`, using the same file selected for that Dry Run.
4. After Apply, review the provisional global stops and private routes. Use **Fixed Routing > Routes** to adjust ordered memberships or publish only reviewed route directions.

## Verification limits

The workbook inspection and normalizer preflight ran locally from the exact XLSX files. The multipart-size 400 is reproduced and fixed in source, but this fix was made after the user's latest container rebuild. A logged-in Dry Run/Apply and database route diagnostic are still pending; the workbooks remain unimported. Stops and routes will be created provisional/private and are not ready for passenger search until reviewed and published. The uploaded workbooks and an Excel lock file are untracked workspace files; stage only intended project assets.
