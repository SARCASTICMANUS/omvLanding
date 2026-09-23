"""Scoped, truncation-free recovery for out-of-sync Django migration history.

Use case: the DB schema is already up to date but ``django_migrations`` rows
are missing (e.g. a squashed history or an accidental wipe). Normally this
makes ``migrate`` error out trying to re-apply already-applied migrations.

This command re-records ONLY the migrations that:
  * are missing from ``django_migrations`` for their app, AND
  * belong to an app whose current tables all exist in the database.

It never truncates or edits ``django_migrations`` wholesale, and it never
fakes a migration for an app whose schema is absent (that app must be migrated
properly). This is the safe replacement for ``TRUNCATE django_migrations``.
"""

from django.apps import apps as django_apps
from django.core.management.base import BaseCommand
from django.db import connection
from django.db.migrations.loader import MigrationLoader
from django.db.migrations.recorder import MigrationRecorder


class Command(BaseCommand):
    help = (
        "Re-record missing django_migrations rows for apps whose schema already "
        "exists, without truncating the full migration history."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--noinput",
            "--no-input",
            action="store_true",
            help="Do not prompt for confirmation before faking migrations.",
        )

    def handle(self, *args, **options):
        noinput = options["noinput"]
        loader = MigrationLoader(connection, ignore_no_migrations=True)
        recorder = MigrationRecorder(connection)

        apps_with_migrations = sorted(loader.migrations.keys())

        model_tables = self._covered_model_tables()

        total_recorded = 0
        for app_label in apps_with_migrations:
            if app_label not in django_apps.app_configs:
                continue

            recorded = {
                name
                for (app, name) in recorder.applied_migrations()
                if app == app_label
            }
            local_names = {
                name for (app, name) in loader.graph.nodes.keys() if app == app_label
            }

            missing = local_names - recorded
            if not missing:
                continue

            if missing != local_names:
                self.stdout.write(
                    self.style.WARNING(
                        f"[{app_label}] partial history mismatch "
                        f"({len(recorded)} recorded / {len(local_names)} local); "
                        f"skipping - manual review required."
                    )
                )
                continue

            if not all(
                table in model_tables
                for table in self._app_model_tables(app_label)
            ):
                self.stdout.write(
                    self.style.WARNING(
                        f"[{app_label}] schema not present; leaving for migrate."
                    )
                )
                continue

            if not noinput and not self._confirm(app_label, sorted(missing)):
                continue

            for name in sorted(missing):
                recorder.record_applied(app_label, name)
                total_recorded += 1
                self.stdout.write(
                    self.style.SUCCESS(f"  reconciled {app_label}.{name}")
                )

        if total_recorded:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Re-recorded {total_recorded} migration(s). "
                    "Run manage.py migrate to complete any remaining work."
                )
            )
        else:
            self.stdout.write("Nothing to reconcile.")

    def _covered_model_tables(self):
        return set(connection.introspection.table_names())

    def _app_model_tables(self, app_label):
        try:
            app_config = django_apps.get_app_config(app_label)
        except LookupError:
            return []
        return sorted(
            model._meta.db_table
            for model in app_config.get_models()
            if model._meta.managed and not model._meta.proxy
        )

    def _confirm(self, app_label, names):
        joined = ", ".join(names)
        answer = input(
            f"Mark {len(names)} unrecorded migration(s) for app '{app_label}' "
            f"as applied ({joined})? [y/N]: "
        )
        return answer.strip().lower() in ("y", "yes")