"""
Make Transaction.reference unique so wallet movements are idempotent.

Two things this has to get right before the constraint can be added:

1. Historical rows. Settlement used f"trip_{trip.id}" for *every* passenger on
   a trip, and WalletService.transfer_funds wrote the same reference for both
   the debit and the credit leg. So production almost certainly contains
   reference collisions. Any surviving duplicate is released by nulling its
   reference - the original value is preserved in metadata so the history
   remains auditable.

2. Empty references. reference is null=True/blank=True and the service
   default is "". A plain unique=True would fail on the second untagged row, so
   the constraint is partial: it only applies to non-empty references.
   Postgres already treats NULLs as distinct, hence the isnull=False guard.
"""

from django.db import migrations, models
from django.db.models import Q


def release_duplicate_references(apps, schema_editor):
    """
    Null out the reference of all but the oldest row in each duplicate group.
    """
    Transaction = apps.get_model("accounts", "Transaction")

    duplicates = (
        Transaction.objects.exclude(reference__isnull=True)
        .exclude(reference="")
        .values("reference")
        .annotate(row_count=models.Count("id"))
        .filter(row_count__gt=1)
    )

    released = 0
    for group in duplicates:
        keeper = (
            Transaction.objects.filter(reference=group["reference"])
            .order_by("created_at", "id")
            .first()
        )
        losers = Transaction.objects.filter(reference=group["reference"]).exclude(
            id=keeper.id
        )
        for row in losers:
            metadata = dict(row.metadata or {})
            metadata["duplicate_reference_released"] = group["reference"]
            row.reference = None
            row.metadata = metadata
            row.save(update_fields=["reference", "metadata"])
            released += 1

    if released:
        print(
            f"transaction reference migration: released {released} duplicate "
            f"reference(s) to satisfy the unique constraint"
        )


def restore_duplicate_references(apps, schema_editor):
    """
    Reverse: put the original reference back on the rows we released. Those rows
    keep their distinguishing marker in metadata, so this cannot silently merge
    them back into a colliding group on a second forward run.
    """
    Transaction = apps.get_model("accounts", "Transaction")

    for row in Transaction.objects.exclude(metadata__isnull=True).iterator():
        original = (row.metadata or {}).get("duplicate_reference_released")
        if not original or row.reference is not None:
            continue
        metadata = dict(row.metadata or {})
        metadata.pop("duplicate_reference_released", None)
        row.reference = original
        row.metadata = metadata
        row.save(update_fields=["reference", "metadata"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_paymentorder"),
    ]

    operations = [
        migrations.RunPython(
            release_duplicate_references,
            restore_duplicate_references,
        ),
        migrations.AddConstraint(
            model_name="transaction",
            constraint=models.UniqueConstraint(
                condition=Q(reference__isnull=False) & ~Q(reference=""),
                fields=("reference",),
                name="uniq_transaction_reference_nonempty",
            ),
        ),
    ]
