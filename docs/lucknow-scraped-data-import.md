# Lucknow scraped transport import

The repository currently contains a small named-stop CSV, while the richer
LkoStops.csv and routes_*.geojson are supplied separately. The named-stop CSV
contains no route membership or stop order, so it can seed only a provisional
global stop catalogue. Do not import the old OMV_Lucknow_Route_Stop_Master.xlsx
using import_lko_routes.py: that legacy command fabricates placeholder
coordinates.

For the richer scrape, copy the source files to a local data folder and run:

    python manage.py import_scraped_city_transport --csv ../data/LkoStops.csv --geojson ../data/routes_20260926_230218.geojson --city Lucknow --dry-run

Review route counts and stop quality first. The admin console's Dynamic Routing
→ Upload stops accepts the stop/route file and an optional matching GeoJSON file
in the same upload form. Route groups are imported only when their source
LineString geometry matches by `route_code`/`route_id` or `route_name`/`name`.
Without geometry, route groups are reported as unresolved and are not imported
as routes. Flat stop-only files can still be imported as provisional global
stops, without route membership.

For command-line import, pass the matching geometry file. The importer now
rejects route groups without matching source geometry rather than drawing a
route from stop coordinates:

    python manage.py import_scraped_city_transport --csv ../data/LkoStops.csv --geojson ../data/routes_20260926_230218.geojson --city Lucknow

Only after verifying route-stop sequence and geometry from a trusted source should you explicitly enable production matching:

    python manage.py import_scraped_city_transport --csv ../data/LkoStops.csv --geojson ../data/routes_20260926_230218.geojson --city Lucknow --trust-source

Without --trust-source, route records are private and stops remain provisional.
They will not be selected by the public-route matcher or the hand-raise flow.
The importer preserves source stop coordinates and source LineString geometry,
rejects invalid coordinate pairs, does not fabricate route endpoints or route
paths, and is transactional. The admin API always imports routes as private and
stops as provisional; an administrator must verify and publish them separately.

## Accepted admin corpus columns

### Multi-city master CSV, schema version 1

Dynamic Routing also accepts one master CSV with exactly these columns:

```text
schema_version,city_id,city_name,route_id,route_number,route_name,direction_id,direction_name,stop_sequence,stop_id,stop_name,stop_aliases_json,latitude,longitude,boarding_allowed,alighting_allowed,route_geometry_id,source_name,source_reference
```

Each row is one ordered route-stop association. `schema_version` must be `1`;
`city_id` is the existing city's `City.slug` (for example, `lucknow`), and a
city must already exist before Dry Run. Route identity is the tuple
`(city_id, route_id, direction_id)`, so equal route IDs or numbers in different
cities and opposite directions remain separate routes. `stop_id` is the
source-stable ID for a physical stop within its city; repeated use must retain
the same name and coordinates. It is not globally shared across cities.

`stop_aliases_json` is a JSON string array, and the two access flags accept
`true`/`false`, `yes`/`no`, or `1`/`0`. Coordinates are decimal WGS84
latitude/longitude; missing, invalid, non-finite, out-of-range, and `(0, 0)`
coordinates are rejected. Each route-direction needs at least two rows with
unique positive `stop_sequence` values. Source and geometry IDs must be
preserved from the authoritative dataset; the importer does not create them.

Upload the companion GeoJSON FeatureCollection in the geometry file control.
It must contain a LineString feature for each selected `(city_id, route_id)`
with `properties.city_id`, `properties.route_id`, and
`properties.route_geometry_id`. The same route geometry is used for both
directions when they share a `route_id`; provide a distinct `route_id` when
direction-specific geometry differs. Geometry coordinates follow GeoJSON
`[longitude, latitude]` order. This companion is required for every route
being applied. The city filter selects one existing city from the master
file; other cities' valid rows are reported as excluded and can be imported
later from the same files.

Dry Run is read-only and returns row-level blockers plus a short-lived token
bound to the selected city and the CSV/GeoJSON content digests. Apply requires
the same files, city, and token. Any selected-city validation error blocks
the entire Apply. A successful Apply is transactional and idempotent for the
stable source identities. Imported routes stay private and stops stay
provisional regardless of CSV values; publication and verification remain
admin review actions.

Do not include a `verification_status` or publication column in this schema.
Those are controlled by server-side review and are intentionally not trusted
from uploaded data.

- Flat stop rows: `stop_name,lat,lng` with optional `route_name,route_code,sequence`.
  When route fields are present, row order supplies sequence if no sequence
  column is provided.
- Route-per-row CSV: `route_name,route_code,stops_ordered`, where
  `stops_ordered` is a JSON array of objects containing `name`, `lat`, `lng`,
  and optional `sequence`.
- JSON route arrays may use a `stops` array with the same stop object fields.
- Route imports also need a GeoJSON FeatureCollection with LineString features
  whose properties include a matching `route_code`/`route_id` or
  `route_name`/`name`.

`(0, 0)`, non-finite and out-of-range coordinates are rejected. An upload with
no usable rows fails with row-level validation errors. Dry Run does not write to
the database. Apply runs inside a database transaction; it does not publish
routes or mark uploaded stops verified.
