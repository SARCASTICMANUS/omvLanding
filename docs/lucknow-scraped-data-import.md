# Lucknow scraped transport import

The repository currently contains a small named-stop CSV, while the richer
LkoStops.csv and routes_*.geojson are supplied separately. The named-stop CSV
contains no route membership or stop order, so it can seed only a provisional
global stop catalogue. Do not import the old OMV_Lucknow_Route_Stop_Master.xlsx
using import_lko_routes.py: that legacy command fabricates placeholder
coordinates.

For the richer scrape, copy the source files to a local data folder and run:

    python manage.py import_scraped_city_transport --csv ../data/LkoStops.csv --geojson ../data/routes_20260926_230218.geojson --city Lucknow --dry-run

Review route counts and stop quality first. The command-line scraped-data
workflow below requires matching source GeoJSON. The Admin console's Dynamic
Routing > Upload stops accepts a city master XLSX workbook or a complete v1
master CSV. The workbook can omit `schema_version`; the importer adds version 1
when it detects the complete route-master sheet. Without source GeoJSON, its
route line connects the ordered stop coordinates directly and is approximate,
not road or rail geometry. Routes remain private until reviewed.

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
`city_id` is the city's `City.slug` (for example, `lucknow`). Route identity is the tuple
`(city_id, route_id, direction_id)`, so equal route IDs or numbers in different
cities and opposite directions remain separate routes. `stop_id` is the
source-stable ID for a physical stop within its city; repeated use must retain
the same name and coordinates. It is not globally shared across cities.

`stop_aliases_json` is a JSON string array, and the two access flags accept
`true`/`false`, `yes`/`no`, or `1`/`0`. Coordinates are decimal WGS84
latitude/longitude; missing, invalid, non-finite, out-of-range, and `(0, 0)`
coordinates are rejected. Each route-direction needs at least two rows with
unique positive `stop_sequence` values. Source IDs should be preserved from the
authoritative dataset. When GeoJSON is supplied, `route_geometry_id` must
match it. Without GeoJSON, the importer creates a deterministic geometry ID for
the approximate stop-sequence line during Apply.

An XLSX workbook may provide these route-stop rows in a sheet with the complete
v1 columns except `schema_version`. The importer detects that sheet even when
it is not active, supplies version `1`, and matches its `city_name` to an
existing city or creates it on Apply. If the workbook also has a `Stops` sheet with the stop catalogue
columns, every stop in that sheet is imported, including stops not assigned to
a route; route-only stops missing from the catalogue are included from the
route rows. A CSV route master uses its route rows as the stop catalogue.
Missing global stops are created as provisional. Without GeoJSON, Apply creates
a stop-sequence LineString from the supplied coordinates and assigns a
deterministic geometry ID. This is an approximate connector, not road or rail
geometry; imported routes remain private until an administrator reviews and
replaces the path with trusted geometry.

When a matching GeoJSON FeatureCollection is supplied through the API, it must
contain a LineString feature for each selected `(city_id, route_id)` with
`properties.city_id`, `properties.route_id`, and
`properties.route_geometry_id`. Geometry coordinates follow GeoJSON
`[longitude, latitude]` order. Without GeoJSON, the workbook/route-master
import connects the ordered stop coordinates directly and does not calculate
road distance. One upload must identify a single city by its `city_name`; the
importer creates the city on Apply if it does not exist.

Rows with a valid `stop_id` and coordinates but no `stop_name` are retained as
provisional global stops with a generated `Nearest OMV Stop` or `OMV Stop N`
label. Legacy `Unnamed stop (<stop_id>)` labels are converted by migration
`0011`. Boarding and alighting remain disabled until an administrator supplies
a name and reviews the stop. Rows with missing IDs or invalid coordinates
still block Apply.

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
