"""
Bulk stop creation from a CSV.

Kept separate from the view so the row parsing and validation can be exercised
without HTTP, and so the admin UI can preview a file before anything is
written.

Two flavours of stop share the table (see the ``Stop`` model):

* route stop - ``route`` is set and ``order`` positions it on that route.
* global stop - ``route`` is NULL, matched to driver journeys by proximity.

A row becomes a global stop unless it names a route, so the common case (a
sheet of boarding points for the new journey flow) needs no extra columns.
"""

import csv
import io

from django.db import transaction
from django.db.models import Q

from transport.models import City, Route, Stop

# Header aliases, so a sheet exported from a spreadsheet works without editing.
# Keys are the canonical names; values are accepted lowercased header names.
HEADER_ALIASES = {
    "name": ("name", "stop", "stop_name", "stopname", "title", "label"),
    "lat": ("lat", "latitude"),
    "lon": ("lon", "lng", "long", "longitude"),
    "city": ("city", "city_name", "cityname"),
    "route": ("route", "route_name", "routename", "route_code", "routecode"),
    "order": ("order", "sequence", "seq", "position", "stop_order", "index"),
    "nearby_landmark": (
        "nearby_landmark",
        "nearbylandmark",
        "landmark",
        "nearby",
        "address",
    ),
}

# Accepted case-insensitively, so "Name", "name" and "NAME" all resolve.
_CANONICAL_BY_LOWER = {
    alias: canonical
    for canonical, aliases in HEADER_ALIASES.items()
    for alias in aliases
}

REQUIRED_HEADERS = ("name", "lat", "lon")

# Refuse a file that is not really a table, rather than importing one stop.
MIN_USEFUL_ROWS = 1

# Guard against a pasted spreadsheet being posted as a "CSV". Well past any
# real stop list for a single city, and small enough that the response stays
# reviewable in the UI.
MAX_ROWS = 5000


class RowError(Exception):
    """One row could not be imported; carries per-field messages."""


def parse_header(fieldnames):
    """
    Map a CSV header row to canonical names.

    Raises ``RowError`` when a required column is absent, since without lat/lon
    there is nothing to match a stop on.
    """
    if not fieldnames:
        raise RowError("The file has no header row.")

    seen = {}
    for raw in fieldnames:
        if raw is None:
            continue
        # Strip a BOM per-field as well as from the file, so this function is
        # safe for any caller rather than only ones that pre-cleaned the text.
        key = str(raw).strip().lstrip("\ufeff").lower().replace(" ", "_")
        # First match wins, so a stray duplicate column cannot rename a field.
        seen.setdefault(key, _CANONICAL_BY_LOWER.get(key))

    canonical = {key: name for key, name in seen.items() if name}
    missing = [h for h in REQUIRED_HEADERS if h not in canonical.values()]
    if missing:
        readable = ", ".join(HEADER_ALIASES[h][0] for h in missing)
        raise RowError(
            f"Missing required column(s): {readable}. "
            "Expected name, lat and lon columns."
        )
    return canonical


def _to_float(value, field, row_number):
    text = ("" if value is None else str(value)).strip()
    if not text:
        raise RowError(f"Row {row_number}: {field} is required.")
    try:
        number = float(text)
    except ValueError:
        raise RowError(f"Row {row_number}: {field} '{text}' is not a number.")
    if number != number or number in (float("inf"), float("-inf")):
        raise RowError(f"Row {row_number}: {field} '{text}' is not a finite number.")
    return number


def normalise_row(row, row_number):
    """
    Validate one CSV row into a dict, or raise ``RowError`` describing why not.

    Returns canonical keys so callers never juggle header spellings.
    """
    canonical = parse_header(row.keys())

    def get(field):
        for key, name in canonical.items():
            if name == field:
                return ("" if row[key] is None else str(row[key])).strip()
        return ""

    name = get("name")
    if not name:
        raise RowError(f"Row {row_number}: name is required.")
    if len(name) > 255:
        raise RowError(f"Row {row_number}: name is longer than 255 characters.")

    lat = _to_float(get("lat"), "lat", row_number)
    lon = _to_float(get("lon"), "lon", row_number)

    # Bounds first: a coordinate outside these cannot be made valid by any
    # other column, and rejecting it here beats a PostGIS error later.
    if not (-90 <= lat <= 90):
        raise RowError(f"Row {row_number}: lat {lat} is outside -90..90.")
    if not (-180 <= lon <= 180):
        raise RowError(f"Row {row_number}: lon {lon} is outside -180..180.")

    raw_order = get("order")
    order = 0
    if raw_order:
        try:
            order = int(float(raw_order))
        except ValueError:
            raise RowError(
                f"Row {row_number}: order '{raw_order}' is not a whole number."
            )
        if order < 0:
            raise RowError(f"Row {row_number}: order must not be negative.")

    landmark = get("nearby_landmark")
    if len(landmark) > 255:
        raise RowError(
            f"Row {row_number}: nearby_landmark is longer than 255 characters."
        )

    return {
        "name": name,
        "lat": lat,
        "lon": lon,
        "city": get("city"),
        "route": get("route"),
        "order": order,
        "nearby_landmark": landmark,
        "row": row_number,
    }


def load_rows(csv_text):
    """
    Parse CSV text into validated rows.

    Returns ``(rows, errors)`` where ``errors`` is
    ``[{"row": n, "error": "..."}]``. A bad row never stops the rest of the
    file: the admin needs the whole list of problems, not just the first.
    """
    if not csv_text or not csv_text.strip():
        raise RowError("The uploaded file is empty.")

    # utf-8-sig drops a BOM, which spreadsheet exports add and which would
    # otherwise turn the first header into "﻿name" and fail to match.
    text = csv_text.lstrip("\ufeff")
    reader = csv.DictReader(io.StringIO(text))

    rows, errors = [], []
    try:
        # Fail fast on a missing header, but as RowError so the view reports it
        # the same way as any other problem.
        parse_header(reader.fieldnames)
    except RowError as exc:
        return [], [{"row": 1, "error": str(exc)}]

    for index, raw in enumerate(reader, start=2):  # row 1 is the header
        try:
            rows.append(normalise_row(raw, index))
        except RowError as exc:
            errors.append({"row": index, "error": str(exc)})

    return rows, errors


def validate_rows(rows):
    """
    Attach the resolved City/Route to each row and flag duplicates.

    Mutates ``rows`` in place, setting ``route_obj``/``city_obj`` and a
    ``status`` of either ``ready`` or ``duplicate``. Duplicates are detected
    two ways: against the database, and within the file itself, so uploading
    the same sheet twice does not double the stops.
    """
    cities = {}
    city_names = {row["city"] for row in rows if row["city"]}
    if city_names:
        for city in City.objects.filter(name__in=city_names):
            cities[city.name] = city

    # Routes can be named by name or by code, so match either in one query.
    route_refs = {row["route"] for row in rows if row["route"]}
    routes = {}
    if route_refs:
        for route in Route.objects.filter(
            Q(name__in=route_refs) | Q(route_code__in=route_refs)
        ):
            routes.setdefault(route.name, route)
            if route.route_code:
                routes.setdefault(route.route_code, route)

    # Existing stops, keyed for duplicate detection. Global stops have no route;
    # route stops are scoped to their route.
    existing_global = {
        (stop.name.strip().lower(), round(stop.location.y, 5), round(stop.location.x, 5))
        for stop in Stop.objects.filter(route__isnull=True)
    }
    existing_route = {}
    for stop in Stop.objects.filter(route__isnull=False).select_related("route"):
        existing_route.setdefault(stop.route_id, set()).add(
            (stop.name.strip().lower(), round(stop.location.y, 5), round(stop.location.x, 5))
        )

    seen_in_file = set()
    used_orders = {}

    for row in rows:
        row["errors"] = []

        route_obj = routes.get(row["route"]) if row["route"] else None
        if row["route"] and route_obj is None:
            row["errors"].append(
                f"Row {row['row']}: route '{row['route']}' does not exist."
            )

        city_obj = cities.get(row["city"]) if row["city"] else None
        if row["city"] and city_obj is None:
            row["errors"].append(
                f"Row {row['row']}: city '{row['city']}' does not exist."
            )

        # A row that named a route but did not match one is an error, not a
        # silent downgrade to a global stop: the file asked for something
        # specific and quietly creating a different thing is worse than failing.
        row["route_obj"] = route_obj
        row["city_obj"] = city_obj

        # Any unresolved reference invalidates the row. Checked here rather than
        # per-reference, so a bad city cannot leave the row looking "ready".
        if row["errors"]:
            row["status"] = "error"
            continue

        key = (row["name"].strip().lower(), round(row["lat"], 5), round(row["lon"], 5))

        if route_obj is None:
            duplicate = key in existing_global or key in seen_in_file
        else:
            bucket = used_orders.setdefault(route_obj.id, set())
            order_taken = row["order"] in bucket
            duplicate = key in existing_route.get(route_obj.id, set()) or order_taken

        if duplicate:
            row["status"] = "duplicate"
            continue

        # Route stops must respect the (route, order) unique constraint.
        if route_obj is not None:
            used_orders.setdefault(route_obj.id, set()).add(row["order"])

        seen_in_file.add(key)
        row["status"] = "ready"

    return rows


@transaction.atomic
def import_rows(rows, dry_run=False):
    """
    Create the ready rows, skipping duplicates.

    One transaction: either the whole valid file lands or none of it does, so a
    failure part way cannot leave a half-imported sheet behind.
    """
    created = []

    for row in rows:
        if row["status"] != "ready":
            continue

        location = f"SRID=4326;POINT({row['lon']} {row['lat']})"
        stop = Stop(
            name=row["name"],
            route=row["route_obj"],
            city=row["city_obj"],
            location=location,
            order=row["order"],
            nearby_landmark=row["nearby_landmark"],
        )
        # save() derives is_global from route_id, so a global row needs no
        # explicit flag here.
        stop.save()
        created.append(stop)

    if dry_run:
        # Roll the whole unit back so a preview leaves nothing behind. Done once
        # at the end rather than per row, so every reported row is validated.
        transaction.set_rollback(True)

    return created


def summarise(rows, created, parse_errors):
    """Counts plus the row numbers behind them, so the UI can list them."""
    duplicates = [row["row"] for row in rows if row["status"] == "duplicate"]
    invalid = [
        {"row": row["row"], "error": "; ".join(row["errors"])}
        for row in rows
        if row.get("errors")
    ]
    invalid.extend(parse_errors)

    return {
        "total": len(rows) + len(parse_errors),
        "created": len(created),
        "duplicate": len(duplicates),
        "duplicate_rows": duplicates,
        "invalid": len(invalid),
        "errors": invalid[:200],  # enough to act on without a huge response
    }


def bulk_import(csv_text, dry_run=False):
    """
    Full pipeline: parse -> validate -> create.

    Returns ``(summary, created)``. Invalid rows are counted and described in
    the summary; they never block the valid ones.
    """
    rows, parse_errors = load_rows(csv_text)

    if len(rows) > MAX_ROWS:
        raise RowError(f"This file has {len(rows)} rows; the limit is {MAX_ROWS}.")

    # Nothing usable at all: report the first problem rather than a bare count.
    if parse_errors and not rows:
        raise RowError(parse_errors[0]["error"])

    validate_rows(rows)

    # import_rows only acts on rows marked "ready", so the full list can be
    # passed through. Summarise must also see every row: dropping the failed
    # ones first would report invalid=0 and tell the admin a bad file imported
    # cleanly.
    created = import_rows(rows, dry_run=dry_run)
    return summarise(rows, created, parse_errors), created