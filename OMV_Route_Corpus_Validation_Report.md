# OMV Authoritative Route Corpus Recovery

**Audit date:** 2026-10-19  
**Result:** Lucknow and Noida are both **BLOCKED**. The current master CSV and companion GeoJSON remain empty because no complete route meets the v1 importer contract with defensible source evidence. No migration, import, or publishing operation was performed.

## Deliverables and parser result

- `OMV_Master_Route_Corpus_v1.csv` — v1 header, 0 data rows.
- `OMV_Master_Route_Geometry_v1.geojson` — valid FeatureCollection, 0 features.
- This report — source inventory, route-level gap assessment, and missing artifacts.

The CSV headers are the exact v1 contract. The real parser in `backend/vayy/transport/services/admin_import_service.py` was called directly without a database write:

| Check | Result |
|---|---|
| Decoded CSV data rows | 0 |
| `normalize_master_v1(rows, "lucknow")` | Rejected: `ValueError: Schema version 1 CSV contains no data rows.` |
| Parsed companion GeoJSON | 0 features, 0 parser errors |
| Import-ready city route groups | 0 |

The empty GeoJSON is syntactically valid; it does not represent a successful route validation or Dry Run.

## Lucknow source inventory

| Artifact | Physical / historical evidence | Provenance and assessment | Decision |
|---|---|---|---|
| `vayy_app/assets/lko_routes_data.json` and duplicate `frontend/src/assets/lko_routes_data.json` | Present; Git history adds it in `89ed2b13`. Contains 14 directional internal route IDs and 442 ordered stop rows. | 66 rows contain in-range coordinates (LKO-01: 18, LKO-02: 18, LKO-05: 30); 376 have no coordinates. No source references, official route/stop IDs, aliases, or route geometry. File metadata does not establish where coordinates came from. | Internal candidate only; no rows admitted. |
| `vayy_app/assets/OMV_Lucknow_Route_Stop_Master.xlsx` and duplicate under `frontend/src/assets/` | Present; 419 route-stop entries across 14 directions. | Its Data Notes say data was OCR-extracted and visually normalized from images inside a supplied ZIP; no coordinates were visible; IDs are internal; it is not an official live transport feed. The ZIP and all 14 referenced images are absent from the workspace and inspected history. | Useful reconstruction aid, not independently auditable without original images. |
| `vayy_app/Routes/LKO-01_Route_Coordinates.xlsx` | Present; 18 ordered coordinate rows; committed with the internal data in `89ed2b13`. | Its 18 labels/sequences/coordinates agree with LKO-01 in the JSON, but no capture/source URL, survey record, or original map is supplied. The workbook route register/master says 17 stops. | Coordinates are internally linked, not source-verified; no matching line geometry. |
| `vayy_app/Routes/OMV_Lucknow_Route_Stop_Master - LKO-07.csv` | Present; 34 coordinate-bearing sequenced rows and an embedded 571-point path. Header metadata cites `Industrial Area - High Court.jpeg`; that image is absent. | CSV metadata says 29 stops; CSV has 34 sequenced records; JSON says 29; workbook register/master says 23. Repeated labels also occur. The candidate path is not accepted as route geometry while its source and route-stop conflicts remain unresolved. | Excluded. |
| `lucknow_named_stops_coordinates.csv` | Present; 30/30 coordinate values pass range checks. | All rows have blank route name/code; no direction, order, or geometry. | Stop-only list; cannot be assigned to routes. |
| Historical `lkoStops.csv` / `routes_20260926_230218.csv` | Found in Git history; current files absent. Historical export has 463 rows, including 136 ordered-stop/polyline records tagged `stop_cards`; the 9 `official`-tagged records have no ordered stops/polyline. | Route-bearing entries are scrape/card records and include unrelated businesses and places; not an authoritative city route feed. The requested `routes_20260926_230218.geojson` is absent from workspace and history. | Excluded. |
| Historical `vayy_app/vayyRoutes/routePolylines.json` | Found in Git history (`a25d75bc`, “green polyline updated”); current file absent. | It has a `STD003` Transport Nagar → Kamta line and internal `STOP...` IDs, with no source/provenance or mapping to LKO-01…LKO-14. It is not a valid companion geometry for the current route IDs. | Excluded. |
| LCTSL City Bus official timetable | Public source: [Lucknow City Bus route-wise timetable](https://citybus.upgov.net/time-table). | Current route codes and coarse corridor descriptions are published (for example 101, 202, 801/801-E and PMI routes). The descriptions are not exhaustive ordered stop lists and provide no stop coordinates or route LineStrings. The 14 internal LKO IDs have no demonstrated mapping to these codes. | Authoritative route context only; not import-ready. |

### Lucknow route-by-route assessment

“JSON rows” and “workbook rows” describe internal candidate data, not verified service. “Coordinate rows” are only values present and range-valid in the JSON. Because the original screenshot ZIP/images and coordinate provenance are unavailable, **verified stop count is 0 for every route**. All candidate stop associations remain unresolved for authoritative import. No route has a matching validated companion geometry.

| Internal route | Direction in candidate data | JSON rows / coordinate rows | Workbook rows | Other unresolved rows (no JSON coordinate) | Geometry / confidence |
|---|---|---:|---:|---:|---|
| LKO-01 | High Court (Kamta) → Dubagga Bus Station | 18 / 18 | 17 | 0 | Missing; low (internal data; 17/18 stop conflict) |
| LKO-02 | Dubagga Bus Station → High Court (Kamta) | 18 / 18 | 17 | 0 | Missing; low (internal data; 17/18 stop conflict) |
| LKO-03 | Ghanta Ghar (Chowk) → Naimisaranya | 41 / 0 | 41 | 41 | Missing; low (OCR source images absent) |
| LKO-04 | Naimisaranya → Ghanta Ghar (Chowk) | 41 / 0 | 40 | 41 | Missing; low (40/41 count conflict; images absent) |
| LKO-05 | Balaganj Chauraha → Viraj Khand | 30 / 30 | 30 | 0 | Missing; low (coordinates have no provenance) |
| LKO-06 | Viraj Khand → Balaganj Chauraha | 30 / 0 | 30 | 30 | Missing; low (OCR source images absent) |
| LKO-07 | Industrial Area → High Court (Kamta) | 29 / 0 | 23 | 29 | Candidate path only; very low (23/29/34 conflict; image absent) |
| LKO-08 | High Court (Kamta) → Industrial Area | 29 / 0 | 23 | 29 | Missing; low (reverse-route source image absent) |
| LKO-09 | Rajajipuram Bus Terminus → B.B.D. | 36 / 0 | 34 | 36 | Missing; low (34/36 count conflict; image absent) |
| LKO-10 | B.B.D. → Rajajipuram Bus Terminus | 36 / 0 | 35 | 36 | Missing; low (35/36 count conflict; image absent) |
| LKO-11 | Rajajipuram Bus Terminus → B.B.D. via Kathauta | 26 / 0 | 25 | 26 | Missing; low (25/26 count conflict; image absent) |
| LKO-12 | B.B.D. → Rajajipuram Bus Terminus via Kathauta | 26 / 0 | 24 | 26 | Missing; low (24/26 count conflict; image absent) |
| LKO-13 | Dubagga Bus Station → Mohanlalganj Bus Terminal | 41 / 0 | 40 | 41 | Missing; low (40/41 count conflict; image absent) |
| LKO-14 | Mohanlalganj Bus Terminal → Dubagga Bus Station | 41 / 0 | 40 | 41 | Missing; low (40/41 count conflict; image absent) |

The 66 coordinate-bearing values are structurally attached to route and sequence in the JSON. Only LKO-01’s 18 are duplicated in its coordinate workbook, and that still lacks source evidence and conflicts with the 17-stop route register. This establishes an internal link, not a reliable source link. Therefore **none of the 66 can currently be promoted as verified route stops**.

### LKO-07 conflict

The conflict is confirmed, its origin is not resolved:

- Workbook Route Register and LKO-07 sheet: 23 stops.
- JSON: `stop_count` 29 and 29 stop rows.
- LKO-07 CSV header metadata: 29 stops; its data contains 34 numbered stop rows.
- The same CSV contains 571 path vertices, but references an unavailable image and has no independent source reference. It cannot be safely converted into the companion GeoJSON.

The source ZIP/images, original LKO-07 route card, and an authoritative route/stop feed are needed to identify whether any count is correct.

## Noida source inventory and route assessment

| Artifact | Evidence and provenance | Decision |
|---|---|---|
| `noida_places.csv` | Mentioned in historical `docs/vayy_app/migration-debt.md`; not present in the workspace and not found as a tracked Git artifact. The note records 1,172 input rows, 975 unique names, 44 conflicts, 2 unresolved, and a failed stop-import attempt. The original CSV, provider, query coverage, and provenance are unavailable, so the note cannot authenticate current DB contents. | Missing source; do not infer routes from it. |
| Local Noida database stop catalog | Read-only ORM inspection: 1,170 stops; all 1,170 `route=NULL`, global, and marked `verified`; 0 Noida routes. 975 distinct case-folded names, no blank names or aliases, 7 repeated coordinate points at 6 decimal places. Repeated names are mostly place/charging/fuel businesses (e.g. IndianOil 41, IGL CNG 35, Battery Smart Swapping Station 27). Coordinate bounds span latitude 18.992176–29.177511 and longitude 73.062507–88.445085, so this is not a Noida-only catalog. | Not route data. Database `verified` status is unsupported by traceable provenance here. |
| Noida DB schema | Live DB lacks `transport_stop.source_name` and `source_reference` columns present in current working-tree model; querying them failed with `UndefinedColumn`. No migration was applied. | Provenance cannot be audited on these DB rows; schema/data gap. |
| NMRC official 2019 route-code/bus-stoppage PDF | [Route Code & Bus Stoppage PDF](https://nmrcnoida.com/writereaddata/Portal/images/Pdf/Summary-of-new-Route-With-Route-Code-25032019-new.pdf) describes route codes, origins/destinations and via/catchment place names. | Useful official historical route identity/corridor evidence, but not coordinate-bearing GIS/GeoJSON, and current operation is unconfirmed. Not import-ready. |
| NMRC feeder-service EOI | [NMRC feeder bus EOI](https://www.nmrcnoida.com/Content/pdf/210/EoI.pdf), Appendix 2 lists proposed P1001, P1002, P1004–P1006, P1008–P1011. | Official proposal evidence; its “covered areas” are not complete stop lists or a route geometry. Not proof of active service. |
| NMRC current network map | [NMRC Network Map page](https://www.nmrcnoida.com/Passenger-Information/Metro-Rail/Network-Map) identifies existing/proposed metro network, not the feeder bus routes’ stop coordinates or lines. | Does not resolve feeder route corpus. |

### NMRC proposal route-by-route assessment

These are route identities in an official feeder-service proposal, **not verified active Noida routes**. Listed areas are proposal coverage text, not validated ordered stop associations. Verified stop count is 0 and route geometry is missing for each.

| Proposed route code | EOI service type / metro station | Coverage text (summary) | Stop/geometry status | Confidence |
|---|---|---|---|---|
| P1001 | To & fro / Pari Chowk | Omega IV, UPSIDC Industrial Site | 0 verified ordered stops; no geometry | Official proposal only |
| P1002 | Two-way loop / Alpha I, GNIDA | Alpha I, Beta I, Gamma I, ETA I/II, Omicorn, Aicher Market, Jaypee | 0; no geometry | Official proposal only |
| P1004 | Two-way loop / Sector 51 | Sector 33, RTO, Jal Vayu Vihar, Sectors 15, 16, 18 | 0; no geometry | Official proposal only |
| P1005 | Two-way loop / Sector 51 | Sectors 63/62, JSS, Jaypee University | 0; no geometry | Official proposal only |
| P1006 | Two-way loop / Pari Chowk, Knowledge Park | Knowledge Park II, Sharda University, Galgotia College, AWHO, P3 Market, PH II | 0; no geometry | Official proposal only |
| P1008 | To and fro / NSEZ | Noida Phase II, NSEZ, Kulesara, Habibpur Village | 0; no geometry | Official proposal only |
| P1009 | To and fro / Sector 76 | Sector 76, Stellar One, Arihant Arden, Stellar Jeevan, ACE City | 0; no geometry | Official proposal only |
| P1010 | Two-way loop / Sectors 51, 50, 76 | Sectors 76/50/121/122, Parthala, Ek Murthi, Techzone IV | 0; no geometry | Official proposal only |
| P1011 | To and fro / Sectors 51, 50 | Sector 71/50/122/121, Parthala, Gaur Chowk, Gaur City | 0; no geometry | Official proposal only |

NMRC’s 2019 route-code PDF also lists feeder codes and high-level via descriptions, but no matched GIS features or traceable stop-coordinate table was found in the project or the reviewed official material. The EOI’s loop/to-and-fro labels do not supply separately validated directional stop orders.

## Exact missing source artifacts

### Lucknow

1. The original ZIP said to contain the 14 route-card images, plus the 14 named source images in the workbook register (listed above), especially `Industrial Area - High Court.jpeg` and its reverse.
2. A source-backed coordinate record for each stop (or authoritative feed providing stop ID and coordinates) and documentation of coordinate collection method for the 66 JSON values.
3. A route-geometry file from the operator/source with route IDs, directions, and provenance. `routes_20260926_230218.geojson` was not found in disk or Git history.
4. LKO-01 and LKO-02 stop-count reconciliation (17 vs 18), and LKO-07 reconciliation (23 vs 29 vs 34) against original evidence.
5. Current LCTSL route-code mapping for the 14 internal directional records; the official timetable does not establish that mapping.

### Noida

1. The original `noida_places.csv`, source/provider/query metadata, and import source log; current database rows cannot be attributed to it.
2. An operator/authority-confirmed current Noida bus/feeder route list, with direction-specific stable IDs and complete ordered stop lists.
3. Coordinate source for each listed stop and an official GIS/GeoJSON/shapefile or trace-backed route geometry keyed to route/direction.
4. Confirmation whether the proposed NMRC EOI routes were actually operated and their current stop patterns; proposal text alone is insufficient.
5. Apply the already-existing DB migration only through the separately approved environment workflow; it was not applied in this audit.

## Import decision

No route satisfies all v1 prerequisites: a source-backed identity and direction, at least two source-verified ordered stops with valid coordinates, and a valid matching LineString geometry. The existing master CSV and GeoJSON therefore remain empty. No city is ready for Dry Run.

| City | Corpus routes admitted | Ordered stop rows admitted | Matching geometry | Status |
|---|---:|---:|---:|---|
| Lucknow (`lucknow`) | 0 | 0 | 0 | **BLOCKED** |
| Noida (`noida`) | 0 | 0 | 0 | **BLOCKED** |

### Next steps, by dependency

1. Recover Lucknow’s original screenshot ZIP/images and the original Noida place CSV plus provenance. Keep the current empty v1 files untouched until this is resolved.
2. Obtain city-operator/authority-confirmed route-stop order, stable IDs, and source coordinates for both cities; reconcile the named count conflicts before enrichment.
3. Obtain matching source route geometries (do not substitute OSRM/map-routed guesses).
4. Normalize only fully sourced routes; call the current v1 parser and geometry matcher in no-write validation; then run separate city Dry Runs for review.
5. Consider import only after validation and target-environment review; leave all routes private and stops provisional pending approval.
