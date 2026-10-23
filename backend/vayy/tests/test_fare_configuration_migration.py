"""Regression coverage for the 0007 fare-configuration schema repair.

The fakes below mirror the *real* signatures used by the migration:

  * ``DatabaseIntrospection.get_constraints(cursor, table_name)`` takes a cursor.
    Calling it with only the table name raises TypeError, which is what an
    earlier draft of this migration did.
  * ``schema_editor.execute()`` opens its own cursor, so the migration issues
    its ``UPDATE ... RETURNING`` on the cursor handed to ``_reconcile``.
"""

import importlib
from types import SimpleNamespace

import pytest
from django.db import IntegrityError, transaction

from operations.models import FareConfiguration


migration_0007 = importlib.import_module(
    "operations.migrations.0007_active_fare_configuration_constraint"
)


class _FakeApps:
    def __init__(self):
        fields = {name: SimpleNamespace(column=name) for name in ("vehicle_type", "is_active")}
        self.model = SimpleNamespace(
            _meta=SimpleNamespace(
                db_table="operations_fareconfiguration",
                get_field=fields.__getitem__,
            )
        )

    def get_model(self, app_label, model_name):
        assert (app_label, model_name) == ("operations", "FareConfiguration")
        return self.model


class _FakeIntrospection:
    def __init__(self, constraints):
        self.constraints = constraints

    def get_constraints(self, cursor, table_name):
        # Signature guard: a missing cursor is the bug this suite exists for.
        assert cursor is not None, "get_constraints() requires a cursor"
        assert table_name == "operations_fareconfiguration"
        return self.constraints


class _FakeCursor:
    """Context manager standing in for connection.cursor()."""

    def __init__(self, returning_rows=()):
        self.returning_rows = list(returning_rows)
        self.statements = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params=None):
        self.statements.append(str(sql))

    def fetchall(self):
        rows, self.returning_rows = self.returning_rows, []
        return rows


class _FakeConnection:
    def __init__(self, constraints, cursor):
        self.introspection = _FakeIntrospection(constraints)
        self._cursor = cursor

    def cursor(self):
        return self._cursor


class _FakeSchemaEditor:
    sql_delete_index = "DROP INDEX %(name)s"
    sql_delete_unique = "ALTER TABLE %(table)s DROP CONSTRAINT %(name)s"

    def __init__(self, constraints=None, returning_rows=()):
        self.cursor = _FakeCursor(returning_rows)
        self.connection = _FakeConnection(constraints or {}, self.cursor)
        self.executed = []
        self.added_constraints = []

    @staticmethod
    def quote_name(name):
        return '"{}"'.format(name)

    def execute(self, sql):
        self.executed.append(str(sql))

    def add_constraint(self, model, constraint):
        self.added_constraints.append((model, constraint))


def _names(editor):
    return [constraint.name for _, constraint in editor.added_constraints]


def test_reconcile_allows_a_database_without_the_legacy_constraint():
    editor = _FakeSchemaEditor({})

    migration_0007._reconcile(_FakeApps(), editor)

    assert editor.executed == []
    assert _names(editor) == [migration_0007.ACTIVE_CONSTRAINT]


def test_reconcile_drops_an_existing_legacy_unique_constraint_by_introspection():
    editor = _FakeSchemaEditor(
        {
            "unexpected_legacy_name": {
                "columns": ["vehicle_type", "is_active"],
                "primary_key": False,
                "unique": True,
                "index": False,
            }
        }
    )

    migration_0007._reconcile(_FakeApps(), editor)

    assert editor.executed == [
        'ALTER TABLE "operations_fareconfiguration" '
        'DROP CONSTRAINT "unexpected_legacy_name"'
    ]
    assert _names(editor) == [migration_0007.ACTIVE_CONSTRAINT]


def test_reconcile_never_matches_the_primary_key():
    editor = _FakeSchemaEditor(
        {
            "operations_fareconfiguration_pkey": {
                "columns": ["id"],
                "primary_key": True,
                "unique": True,
                "index": False,
            }
        }
    )

    migration_0007._reconcile(_FakeApps(), editor)

    assert editor.executed == []


def test_reconcile_is_a_noop_when_the_active_constraint_already_exists():
    editor = _FakeSchemaEditor(
        {
            migration_0007.ACTIVE_CONSTRAINT: {
                "columns": ["vehicle_type"],
                "primary_key": False,
                "unique": True,
                "index": False,
            }
        }
    )

    migration_0007._reconcile(_FakeApps(), editor)

    assert editor.executed == []
    assert _names(editor) == []


def test_reconcile_deactivates_surplus_rows_on_its_own_cursor():
    """The UPDATE ... RETURNING must run on the migration's cursor, otherwise
    schema_editor.execute() swallows the result and the data change is silent."""
    editor = _FakeSchemaEditor({}, returning_rows=[("bike", "2026-01-01T00:00:00Z")])

    migration_0007._reconcile(_FakeApps(), editor)

    assert any("UPDATE" in s and "RETURNING" in s for s in editor.cursor.statements)


@pytest.mark.django_db
def test_fare_configuration_allows_multiple_inactive_rows_but_one_active_row():
    FareConfiguration.objects.create(vehicle_type="bike", base_fare=100, per_km_rate=20)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            FareConfiguration.objects.create(vehicle_type="bike", base_fare=120, per_km_rate=25)

    FareConfiguration.objects.create(vehicle_type="bike", base_fare=80, per_km_rate=15, is_active=False)
    FareConfiguration.objects.create(vehicle_type="bike", base_fare=90, per_km_rate=16, is_active=False)

    assert FareConfiguration.objects.filter(vehicle_type="bike", is_active=False).count() == 2
