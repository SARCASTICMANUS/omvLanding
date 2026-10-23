"""Parsing and validation helpers for the admin city-data import API.

These helpers are deliberately independent of Django so the file contract can
be checked without a database or a PostGIS installation.
"""

import csv
import io
import json
import math


MASTER_V1_COLUMNS = (
    "schema_version", "city_id", "city_name", "route_id", "route_number",
    "route_name", "direction_id", "direction_name", "stop_sequence",
    "stop_id", "stop_name", "stop_aliases_json", "latitude", "longitude",
    "boarding_allowed", "alighting_allowed", "route_geometry_id",
    "source_name", "source_reference",
)


def valid_coordinate(lat, lng):
    try:
        lat, lng = float(lat), float(lng)
    except (TypeError, ValueError):
        return False
    return (
        math.isfinite(lat)
        and math.isfinite(lng)
        and -90 <= lat <= 90
        and -180 <= lng <= 180
        and not (lat == 0 and lng == 0)
    )


def _key(value):
    return str(value or "").strip().lower().replace(" ", "_")


def _value(row, *names):
    normalized = {_key(key): value for key, value in row.items()}
    return next(
        (normalized[name] for name in names if normalized.get(name) not in (None, "")),
        None,
    )


def decode_tabular_upload(raw, extension):
    """Return a list of row dictionaries from CSV, JSON, or Excel bytes."""
    extension = extension.lower().lstrip(".")
    if extension in ("xlsx", "xlsm"):
        from openpyxl import load_workbook

        workbook = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
        try:
            values = list(workbook.active.iter_rows(values_only=True))
            if not values:
                return []
            headers = [_key(value) for value in values[0]]
            return [
                {headers[index]: value for index, value in enumerate(row) if index < len(headers)}
                for row in values[1:]
                if any(value not in (None, "") for value in row)
            ]
        finally:
            workbook.close()

    decoded = raw.decode("utf-8-sig")
    if extension == "json":
        payload = json.loads(decoded)
        if isinstance(payload, list):
            records = payload
        elif isinstance(payload, dict):
            if any(key in payload for key in ("stops_ordered", "stops")) and any(
                key in payload for key in ("route_name", "route", "name", "route_code", "route_id")
            ):
                records = [payload]
            else:
                records = payload.get("routes", payload.get("stops", payload.get("data", [])))
        else:
            raise ValueError("JSON must contain an array of route or stop records.")
        if isinstance(records, dict):
            if any(key in records for key in ("stops_ordered", "stops", "stop_name", "lat", "latitude")):
                records = [records]
            else:
                records = [
                    {"route_code": key, **value}
                    for key, value in records.items()
                    if isinstance(value, dict)
                ]
        if not isinstance(records, list):
            raise ValueError("JSON routes/stops must be an array.")
        return [record for record in records if isinstance(record, dict)]
    if extension != "csv":
        raise ValueError("Supported corpus files are CSV, XLSX, XLSM, or JSON.")

    try:
        dialect = csv.Sniffer().sniff(decoded[:8192], delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    reader = csv.DictReader(io.StringIO(decoded, newline=""), dialect=dialect)
    if not reader.fieldnames or not any(str(name or "").strip() for name in reader.fieldnames):
        raise ValueError("CSV must have a header row.")
    return [dict(row) for row in reader if row and any(value not in (None, "") for value in row.values())]


def normalize_import_records(records):
    """Normalize flat stop rows and route rows with nested ``stops_ordered``.

    Returns route groups, global stop candidates, row errors, and warnings.
    A missing sequence in a flat route file preserves CSV row order.
    """
    routes = {}
    global_stops = {}
    errors = []
    warnings = []

    def point_from(record, sequence, row_number):
        name = _value(record, "stop_name", "name", "station", "origin", "start_name")
        lat = _value(record, "lat", "latitude", "stop_lat")
        lng = _value(record, "lng", "lon", "longitude", "stop_lon", "long")
        if name is None or lat is None or lng is None:
            errors.append({"row": row_number, "reason": "stop name and latitude/longitude are required"})
            return None
        if not valid_coordinate(lat, lng):
            errors.append({"row": row_number, "reason": "latitude/longitude are invalid or outside valid bounds"})
            return None
        explicit_sequence = _value(record, "sequence", "seq", "stop_sequence", "order", "stop_order")
        try:
            order = int(explicit_sequence) if explicit_sequence not in (None, "") else sequence
            if order < 0:
                raise ValueError
        except (TypeError, ValueError):
            errors.append({"row": row_number, "reason": "stop sequence must be a non-negative integer"})
            return None
        return {
            "name": str(name).strip()[:255],
            "lat": float(lat),
            "lng": float(lng),
            "sequence": order,
        }

    for row_number, row in enumerate(records, start=2):
        nested = _value(row, "stops_ordered", "stops")
        route_name = str(
            _value(row, "route_name", "route", "line")
            or (_value(row, "name") if nested not in (None, "") else "")
            or ""
        ).strip()[:255]
        route_code = str(_value(row, "route_code", "route_id", "bus_number", "route_number") or "").strip()[:50]
        route_name = route_name or route_code

        if nested not in (None, ""):
            if isinstance(nested, str):
                try:
                    nested = json.loads(nested)
                except json.JSONDecodeError:
                    errors.append({"row": row_number, "reason": "stops_ordered must contain valid JSON"})
                    continue
            if not route_name or not isinstance(nested, list):
                errors.append({"row": row_number, "reason": "route name and a stops_ordered array are required"})
                continue
            points = []
            for child_index, stop in enumerate(nested):
                if not isinstance(stop, dict):
                    errors.append({"row": row_number, "reason": f"stop {child_index + 1} must be an object"})
                    continue
                point = point_from(stop, child_index, row_number)
                if point:
                    points.append(point)
            route_key = (route_name, route_code)
            routes.setdefault(route_key, []).extend(points)
            continue

        route_key = (route_name, route_code)
        point = point_from(row, len(routes.get(route_key, [])), row_number)
        if not point:
            continue
        if route_name:
            routes.setdefault(route_key, []).append(point)
        else:
            key = (point["name"].casefold(), round(point["lat"], 6), round(point["lng"], 6))
            global_stops[key] = point

    normalized_routes = {}
    for route_key, points in routes.items():
        points.sort(key=lambda point: point["sequence"])
        sequences = [point["sequence"] for point in points]
        if len(points) < 2:
            errors.append({"row": route_key[0], "reason": "a route needs at least two valid ordered stops"})
            continue
        if len(sequences) != len(set(sequences)):
            errors.append({"row": route_key[0], "reason": "route stop sequence contains duplicates"})
            continue
        normalized_routes[route_key] = points

    if normalized_routes:
        warnings.append("Routes remain private and their stops provisional until an administrator verifies and publishes them.")
    return normalized_routes, list(global_stops.values()), errors, warnings


def normalize_noida_route_stop_rows(records, city_identifiers):
    """Validate one-row-per-stop Noida imports and group by route direction.

    ``city_identifiers`` contains the selected City's slug and database UUID.
    Any invalid row makes its route-direction group non-importable so an
    incomplete sequence cannot accidentally become searchable.
    """
    required_columns = {
        "city_id", "route_id", "route_name", "route_number", "direction_id",
        "stop_sequence", "stop_id", "stop_name", "latitude", "longitude",
    }
    headers = {_key(key) for key in records[0]} if records else set()
    missing_columns = sorted(required_columns - headers)
    if missing_columns:
        raise ValueError("Missing required columns: " + ", ".join(missing_columns))
    if not records:
        raise ValueError("The uploaded file contains no data rows.")

    accepted_city_ids = {str(value).strip().casefold() for value in city_identifiers if value}
    errors = []
    groups = {}
    invalid_group_keys = set()
    invalid_row_numbers = set()

    def row_error(row_number, reason, group_key=None):
        errors.append({"row": row_number, "reason": reason})
        invalid_row_numbers.add(row_number)
        if group_key is not None:
            invalid_group_keys.add(group_key)

    for row_number, row in enumerate(records, start=2):
        values = {
            column: _value(row, column)
            for column in required_columns
        }
        city_id = str(values["city_id"] or "").strip()
        route_id = str(values["route_id"] or "").strip()
        direction_id = str(values["direction_id"] or "").strip()
        group_key = ("noida", route_id, direction_id) if route_id and direction_id else None

        if not route_id:
            row_error(row_number, "route_id is required.")
            continue
        if not direction_id:
            row_error(row_number, "direction_id is required.")
            continue

        group = groups.setdefault(group_key, {
            "city_id": "noida",
            "route_id": route_id,
            "direction_id": direction_id,
            "route_name": "",
            "route_number": "",
            "stops": [],
            "row_numbers": [],
        })
        group["row_numbers"].append(row_number)

        if city_id.casefold() not in accepted_city_ids:
            row_error(row_number, "city_id must identify the selected Noida city.", group_key)
        if not city_id:
            row_error(row_number, "city_id is required.", group_key)

        row_values = {}
        for column in ("route_name", "route_number", "stop_id", "stop_name"):
            value = str(values[column] or "").strip()
            if not value:
                row_error(row_number, f"{column} is required.", group_key)
            row_values[column] = value

        for column in ("route_id", "direction_id", "stop_id"):
            if len(str(values[column] or "").strip()) > 100:
                row_error(row_number, f"{column} must be at most 100 characters.", group_key)
        if len(row_values["route_name"]) > 255 or len(row_values["stop_name"]) > 255:
            row_error(row_number, "route_name and stop_name must be at most 255 characters.", group_key)
        if len(row_values["route_number"]) > 100:
            row_error(row_number, "route_number must be at most 100 characters.", group_key)

        route_name = row_values["route_name"]
        route_number = row_values["route_number"]
        if group["route_name"] and route_name and group["route_name"] != route_name:
            row_error(row_number, "route_name must be consistent within a route direction.", group_key)
        if group["route_number"] and route_number and group["route_number"] != route_number:
            row_error(row_number, "route_number must be consistent within a route direction.", group_key)
        group["route_name"] = group["route_name"] or route_name
        group["route_number"] = group["route_number"] or route_number

        try:
            sequence_value = values["stop_sequence"]
            sequence = int(sequence_value)
            if isinstance(sequence_value, float) and not sequence_value.is_integer():
                raise ValueError
            if isinstance(sequence_value, str) and str(sequence) != sequence_value.strip().lstrip("+"):
                raise ValueError
            if sequence < 0:
                raise ValueError
        except (TypeError, ValueError):
            row_error(row_number, "stop_sequence must be a non-negative integer.", group_key)
            sequence = None

        latitude = values["latitude"]
        longitude = values["longitude"]
        if latitude in (None, "") or longitude in (None, ""):
            row_error(row_number, "latitude and longitude are required.", group_key)
            coordinates = None
        elif not valid_coordinate(latitude, longitude):
            row_error(row_number, "latitude/longitude are invalid or outside valid bounds.", group_key)
            coordinates = None
        else:
            coordinates = (float(longitude), float(latitude))

        if all(row_values.values()) and sequence is not None and coordinates is not None:
            group["stops"].append({
                "row": row_number,
                "stop_id": row_values["stop_id"],
                "name": row_values["stop_name"],
                "sequence": sequence,
                "longitude": coordinates[0],
                "latitude": coordinates[1],
            })

    valid_groups = {}
    for group_key, group in groups.items():
        stops = group["stops"]
        sequences = [stop["sequence"] for stop in stops]
        stop_ids = [stop["stop_id"].casefold() for stop in stops]
        if len(sequences) != len(set(sequences)):
            row_error(group["row_numbers"][0], "duplicate stop_sequence in this route direction.", group_key)
        if len(stop_ids) != len(set(stop_ids)):
            row_error(group["row_numbers"][0], "duplicate stop_id in this route direction.", group_key)
        if len(stops) < 2:
            row_error(group["row_numbers"][0], "a route direction needs at least two valid stops.", group_key)

        if group_key in invalid_group_keys:
            continue
        group["stops"] = sorted(stops, key=lambda stop: stop["sequence"])
        valid_groups[group_key] = group

    valid_rows = sum(len(group["row_numbers"]) for group in valid_groups.values())
    return valid_groups, errors, valid_rows, len(groups)


def parse_geojson_routes(raw):
    """Map GeoJSON LineString features to route code/name keys."""
    payload = json.loads(raw.decode("utf-8-sig"))
    if not isinstance(payload, dict) or payload.get("type") != "FeatureCollection":
        raise ValueError("Geometry file must be a GeoJSON FeatureCollection.")
    features = {}
    errors = []
    for index, feature in enumerate(payload.get("features") or [], start=1):
        if not isinstance(feature, dict):
            errors.append({"row": index, "reason": "GeoJSON feature must be an object"})
            continue
        properties = feature.get("properties") or {}
        geometry = feature.get("geometry") or {}
        name = str(properties.get("route_name") or properties.get("name") or "").strip()
        code = str(properties.get("route_code") or properties.get("route_id") or "").strip()
        coordinates = geometry.get("coordinates") or []
        if geometry.get("type") != "LineString" or len(coordinates) < 2:
            errors.append({"row": index, "reason": "route geometry must be a LineString with at least two points"})
            continue
        valid = []
        for coordinate in coordinates:
            if not isinstance(coordinate, (list, tuple)) or len(coordinate) < 2 or not valid_coordinate(coordinate[1], coordinate[0]):
                valid = []
                break
            valid.append((float(coordinate[0]), float(coordinate[1])))
        if len(valid) < 2:
            errors.append({"row": index, "reason": "route geometry contains invalid coordinates"})
            continue
        if code:
            features[("code", code.casefold())] = valid
        if name:
            features[("name", name.casefold())] = valid
    return features, errors


def _parse_bool(value):
    normalized = str(value or "").strip().casefold()
    if normalized in {"true", "1", "yes"}:
        return True
    if normalized in {"false", "0", "no"}:
        return False
    raise ValueError("must be true or false")


def normalize_master_v1(records, city_filter):
    """Validate v1 route-stop rows and return only one selected city's groups.

    Identity is scoped as ``(city_id, route_id, direction_id)``. The city id
    in v1 is the stable City.slug, not a database-generated UUID.
    """
    if not records:
        raise ValueError("Schema version 1 CSV contains no data rows.")

    headers = {_key(header) for header in records[0]}
    missing = [column for column in MASTER_V1_COLUMNS if column not in headers]
    extra = sorted(headers.difference(MASTER_V1_COLUMNS))
    if missing or extra:
        details = []
        if missing:
            details.append("missing columns: " + ", ".join(missing))
        if extra:
            details.append("unsupported columns: " + ", ".join(extra))
        raise ValueError("Schema version 1 CSV has " + "; ".join(details) + ".")

    selected_city = str(city_filter or "").strip().casefold()
    if not selected_city:
        raise ValueError("Select a city to filter this multi-city master CSV.")

    groups = {}
    errors = []
    excluded_rows = 0
    selected_rows = 0
    stop_id_fingerprints = {}

    for row_number, raw in enumerate(records, start=2):
        row = {_key(key): value for key, value in raw.items()}
        version = str(row.get("schema_version") or "").strip()
        if version != "1":
            errors.append({"row": row_number, "reason": f"unsupported schema_version {version!r}; expected '1'"})
            continue

        city_id = str(row.get("city_id") or "").strip().casefold()
        if not city_id:
            errors.append({"row": row_number, "reason": "city_id is required so this row can be filtered safely"})
            continue
        if city_id != selected_city:
            excluded_rows += 1
            continue
        selected_rows += 1

        def required(name):
            value = str(row.get(name) or "").strip()
            if not value:
                raise ValueError(f"{name} is required")
            return value

        try:
            city_name = required("city_name")
            route_id = required("route_id")
            route_number = str(row.get("route_number") or "").strip()
            route_name = required("route_name")
            direction_id = required("direction_id")
            direction_name = required("direction_name")
            stop_id = required("stop_id")
            stop_name = required("stop_name")
            geometry_id = required("route_geometry_id")
            source_name = required("source_name")
            source_reference = required("source_reference")
            sequence_text = required("stop_sequence")
            sequence = int(sequence_text)
            if str(sequence) != sequence_text or sequence < 1:
                raise ValueError("stop_sequence must be a positive integer")
            latitude = float(required("latitude"))
            longitude = float(required("longitude"))
            if not valid_coordinate(latitude, longitude):
                raise ValueError("latitude/longitude are invalid or outside valid bounds")
            aliases_text = str(row.get("stop_aliases_json") or "").strip()
            aliases = json.loads(aliases_text) if aliases_text else []
            if not isinstance(aliases, list) or any(not isinstance(alias, str) or not alias.strip() for alias in aliases):
                raise ValueError("stop_aliases_json must be a JSON array of non-empty strings")
            try:
                boarding_allowed = _parse_bool(row.get("boarding_allowed"))
            except ValueError as exc:
                raise ValueError(f"boarding_allowed {exc}") from exc
            try:
                alighting_allowed = _parse_bool(row.get("alighting_allowed"))
            except ValueError as exc:
                raise ValueError(f"alighting_allowed {exc}") from exc
            if len(city_id) > 100 or len(route_id) > 100 or len(direction_id) > 100 or len(stop_id) > 100:
                raise ValueError("city_id, route_id, direction_id, and stop_id must be at most 100 characters")
            if len(route_number) > 100 or len(geometry_id) > 100:
                raise ValueError("route_number and route_geometry_id must be at most 100 characters")
            if len(source_name) > 255 or len(source_reference) > 500:
                raise ValueError("source_name must be at most 255 characters and source_reference at most 500")
            if len(city_name) > 255 or len(route_name) > 255 or len(direction_name) > 255 or len(stop_name) > 255:
                raise ValueError("city_name, route_name, direction_name, and stop_name must be at most 255 characters")
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            errors.append({"row": row_number, "reason": str(exc)})
            continue

        group_key = (city_id, route_id, direction_id)
        metadata = {
            "city_name": city_name,
            "route_number": route_number,
            "route_name": route_name,
            "direction_name": direction_name,
            "route_geometry_id": geometry_id,
        }
        group = groups.setdefault(group_key, {**metadata, "stops": [], "row_numbers": []})
        for field, value in metadata.items():
            if group[field] != value:
                errors.append({"row": row_number, "reason": f"{field} conflicts within route identity {route_id}/{direction_id}"})
        group["row_numbers"].append(row_number)

        fingerprint_key = (city_id, stop_id)
        fingerprint = (stop_name.casefold(), round(latitude, 6), round(longitude, 6))
        previous = stop_id_fingerprints.get(fingerprint_key)
        if previous is not None and previous != fingerprint:
            errors.append({"row": row_number, "reason": f"stop_id {stop_id!r} has conflicting name or coordinates in city {city_id}"})
        else:
            stop_id_fingerprints[fingerprint_key] = fingerprint

        group["stops"].append({
            "source_stop_id": stop_id,
            "name": stop_name,
            "aliases": [alias.strip() for alias in aliases],
            "lat": latitude,
            "lng": longitude,
            "sequence": sequence,
            "boarding_allowed": boarding_allowed,
            "alighting_allowed": alighting_allowed,
            "source_name": source_name,
            "source_reference": source_reference,
            "row_number": row_number,
        })

    if selected_rows == 0:
        errors.append({"row": None, "reason": f"No rows found for selected city_id {selected_city!r}."})

    for (city_id, route_id, direction_id), group in groups.items():
        sequences = [stop["sequence"] for stop in group["stops"]]
        if len(sequences) < 2:
            errors.append({"row": group["row_numbers"][0], "reason": f"route {route_id}/{direction_id} needs at least two stops"})
        if len(sequences) != len(set(sequences)):
            errors.append({"row": group["row_numbers"][0], "reason": f"duplicate stop_sequence in route {route_id}/{direction_id}"})
        stop_ids = [stop["source_stop_id"] for stop in group["stops"]]
        if len(stop_ids) != len(set(stop_ids)):
            errors.append({"row": group["row_numbers"][0], "reason": f"duplicate stop_id in route {route_id}/{direction_id}"})
        group["stops"].sort(key=lambda stop: stop["sequence"])

    return groups, errors, excluded_rows


def parse_master_v1_geojson(raw):
    """Parse v1 route geometry keyed by the composite city and route identity."""
    payload = json.loads(raw.decode("utf-8-sig"))
    if not isinstance(payload, dict) or payload.get("type") != "FeatureCollection":
        raise ValueError("Schema version 1 route geometry must be a GeoJSON FeatureCollection.")
    features = {}
    errors = []
    for index, feature in enumerate(payload.get("features") or [], start=1):
        if not isinstance(feature, dict):
            errors.append({"row": index, "city_id": None, "reason": "GeoJSON feature must be an object"})
            continue
        if feature.get("type") != "Feature":
            errors.append({"row": index, "city_id": None, "reason": "GeoJSON members must have type 'Feature'"})
            continue
        properties = feature.get("properties") or {}
        city_id = str(properties.get("city_id") or "").strip().casefold()
        route_id = str(properties.get("route_id") or "").strip()
        geometry_id = str(properties.get("route_geometry_id") or "").strip()
        geometry = feature.get("geometry") or {}
        coordinates = geometry.get("coordinates") or []
        if not city_id or not route_id:
            errors.append({"row": index, "city_id": city_id or None, "reason": "GeoJSON feature properties must include city_id and route_id"})
            continue
        if geometry.get("type") != "LineString" or len(coordinates) < 2:
            errors.append({"row": index, "city_id": city_id, "reason": "route geometry must be a LineString with at least two points"})
            continue
        valid = []
        for coordinate in coordinates:
            if not isinstance(coordinate, (list, tuple)) or len(coordinate) < 2 or not valid_coordinate(coordinate[1], coordinate[0]):
                valid = []
                break
            valid.append((float(coordinate[0]), float(coordinate[1])))
        if len(valid) < 2:
            errors.append({"row": index, "city_id": city_id, "reason": "route geometry contains invalid coordinates"})
            continue
        key = (city_id, route_id)
        if key in features:
            errors.append({"row": index, "city_id": city_id, "reason": f"duplicate geometry for city_id={city_id!r}, route_id={route_id!r}"})
            continue
        features[key] = {"geometry_id": geometry_id, "coordinates": valid, "row": index}
    return features, errors
