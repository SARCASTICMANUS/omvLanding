import logging
from decimal import Decimal
from typing import Dict, Any, Optional
from django.db import transaction, IntegrityError
from django.utils import timezone

from accounts.models import User, Wallet, Transaction
from common.constants import (
    TX_TYPE_CREDIT, TX_TYPE_DEBIT,
    TX_STATUS_PENDING, TX_STATUS_COMPLETED, TX_STATUS_FAILED
)
from communication.services.notification_service import NotificationService

logger = logging.getLogger(__name__)


class WalletService:
    """
    Handles financial transactions, balance management, and payment processing.
    """

    @staticmethod
    def get_or_create_wallet(user: User) -> Wallet:
        wallet, created = Wallet.objects.get_or_create(user=user)
        return wallet

    @staticmethod
    @transaction.atomic
    def add_funds(user: User, amount: Decimal, reference: str = "", metadata: Optional[Dict] = None) -> Transaction:
        """
        Credits the user's wallet.
        """
        wallet = Wallet.objects.select_for_update().get(user=user)
        
        transaction = Transaction.objects.create(
            wallet=wallet,
            amount=amount,
            type=TX_TYPE_CREDIT,
            status=TX_STATUS_COMPLETED,
            reference=reference,
            metadata=metadata or {}
        )

        wallet.balance += amount
        wallet.save()

        NotificationService.create(
            user=user,
            title="Wallet Credited",
            message=f"Your wallet has been credited with {wallet.currency} {amount}.",
            metadata={"transaction_id": str(transaction.id), "balance": str(wallet.balance)}
        )

        logger.info(f"Credited {amount} to user {user.id}'s wallet. New balance: {wallet.balance}")
        return transaction

    @staticmethod
    @transaction.atomic
    def deduct_funds(user: User, amount: Decimal, reference: str = "", metadata: Optional[Dict] = None) -> Transaction:
        """
        Debits the user's wallet.
        """
        wallet = Wallet.objects.select_for_update().get(user=user)

        if wallet.balance < amount:
            logger.error(f"Insufficient funds for user {user.id}. Required: {amount}, Available: {wallet.balance}")
            transaction = Transaction.objects.create(
                wallet=wallet,
                amount=amount,
                type=TX_TYPE_DEBIT,
                status=TX_STATUS_FAILED,
                reference=reference,
                metadata={"error": "Insufficient funds"}
            )
            raise ValueError("Insufficient funds")

        transaction = Transaction.objects.create(
            wallet=wallet,
            amount=amount,
            type=TX_TYPE_DEBIT,
            status=TX_STATUS_COMPLETED,
            reference=reference,
            metadata=metadata or {}
        )

        wallet.balance -= amount
        wallet.save()

        NotificationService.create(
            user=user,
            title="Wallet Debited",
            message=f"Your wallet has been debited with {wallet.currency} {amount}.",
            metadata={"transaction_id": str(transaction.id), "balance": str(wallet.balance)}
        )

        logger.info(f"Debited {amount} from user {user.id}'s wallet. New balance: {wallet.balance}")
        return transaction

    @staticmethod
    @transaction.atomic
    def transfer_funds(sender: User, receiver: User, amount: Decimal, reference: str = "", metadata: Optional[Dict] = None):
        """
        Transfers funds between two users (e.g., Passenger to Driver).

        The two legs write two Transaction rows, so they cannot share a
        reference: Transaction.reference carries a UNIQUE constraint (see
        Transaction.Meta.constraints). Each leg gets its own suffixed
        reference, and `reference` itself must be unique per logical transfer.
        """
        logger.info(f"Transferring {amount} from {sender.id} to {receiver.id}")

        # An empty reference stays empty on both legs - it is excluded from the
        # unique index, and suffixing it would fabricate a constant, colliding
        # reference like ":debit" for every untagged transfer.
        debit_reference = f"{reference}:debit" if reference else ""
        credit_reference = f"{reference}:credit" if reference else ""

        # Deduct from sender
        debit_tx = WalletService.deduct_funds(
            sender, amount, debit_reference, 
            {**(metadata or {}), "transfer_to": str(receiver.id)}
        )

        # Credit to receiver
        credit_tx = WalletService.add_funds(
            receiver, amount, credit_reference, 
            {**(metadata or {}), "transfer_from": str(sender.id)}
        )

        return debit_tx, credit_tx

    @staticmethod
    @transaction.atomic
    def settle_debit(
        sender: User,
        receiver: User,
        amount: Decimal,
        reference: str,
        metadata: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """
        Idempotent, two-leg passenger -> driver settlement for one ride segment.

        `reference` identifies the *logical* settlement (e.g.
        ``trip_<trip_id>:p<boarding_request_id>``) and must be unique per
        settlement unit. Each leg is persisted under its own suffixed
        reference so ``Transaction.reference`` can be UNIQUE.

        Guarantees, by way of that unique constraint plus row locks:

        * Re-running with the same reference never moves money twice.
        * The debit leg is written as TX_STATUS_PENDING *before* the balance is
          touched. If the passenger cannot pay, the row is flipped to
          TX_STATUS_FAILED and committed, so the obligation survives as a
          durable, queryable record instead of vanishing with a rolled-back
          savepoint.
        * Concurrent attempts serialise on the sender's Wallet row.

        Deliberately does **not** raise on a business failure (insufficient
        funds): the caller must be able to keep settling the other passengers
        and then record the trip as partially settled. Infrastructure errors
        still propagate, because those must roll the caller's transaction back.

        Returns a dict:
            {
              "settled":        bool,  # fully settled after this call
              "already_settled": bool, # nothing was moved; prior state reused
              "debit":  Transaction,
              "credit": Transaction | None,
              "error":  str | None,     # business-level failure reason
            }
        """
        if not reference:
            raise ValueError("settle_debit requires a non-empty idempotency reference")

        debit_reference = f"{reference}:debit"
        credit_reference = f"{reference}:credit"
        base_metadata = dict(metadata or {})

        debit = WalletService._reserve_debit(sender, amount, debit_reference, base_metadata)
        credit = Transaction.objects.filter(reference=credit_reference).first()

        if debit.status == TX_STATUS_COMPLETED:
            # Debit already landed on a previous attempt. Finish a missing or
            # failed credit leg, then report that we moved nothing.
            if credit is None or credit.status != TX_STATUS_COMPLETED:
                credit = WalletService._apply_credit(
                    receiver, amount, credit_reference,
                    {**base_metadata, "transfer_from": str(sender.id)},
                )
            return {
                "settled": True,
                "already_settled": True,
                "debit": debit,
                "credit": credit,
                "error": None,
            }

        wallet = Wallet.objects.select_for_update().get(user=sender)

        if wallet.balance < amount:
            debit.status = TX_STATUS_FAILED
            debit.metadata = {
                **debit.metadata,
                "error": "Insufficient funds",
                "required": str(amount),
                "available": str(wallet.balance),
            }
            debit.save(update_fields=["status", "metadata", "updated_at"])
            logger.error(
                "Insufficient funds settling %s: user=%s required=%s available=%s",
                reference, sender.id, amount, wallet.balance,
            )
            return {
                "settled": False,
                "already_settled": False,
                "debit": debit,
                "credit": credit,
                "error": "Insufficient funds",
            }

        # Funds are available: turn the reservation into a settled debit.
        wallet.balance -= amount
        wallet.save(update_fields=["balance", "updated_at"])

        debit.status = TX_STATUS_COMPLETED
        debit.metadata = {**debit.metadata, "balance_after": str(wallet.balance)}
        debit.save(update_fields=["status", "metadata", "updated_at"])

        credit = WalletService._apply_credit(
            receiver, amount, credit_reference,
            {**base_metadata, "transfer_from": str(sender.id)},
        )

        logger.info(
            "Settled %s from user %s's wallet. New balance: %s",
            amount, sender.id, wallet.balance,
        )
        return {
            "settled": True,
            "already_settled": False,
            "debit": debit,
            "credit": credit,
            "error": None,
        }

    @staticmethod
    def _reserve_debit(user: User, amount: Decimal, reference: str, metadata: Dict[str, Any]) -> Transaction:
        """
        Get-or-create the PENDING debit leg for a reference.

        A leg that previously failed but is still owed is revived to PENDING,
        so TX_STATUS_PENDING consistently means "outstanding obligation" for
        the whole life of a retry rather than just the first attempt.

        Relying on the unique constraint (not on a check-then-insert) means two
        concurrent retries cannot both create a reservation: the loser gets an
        IntegrityError, re-reads the winner's row, and settles from it.
        """
        existing = Transaction.objects.filter(reference=reference).first()
        if existing is not None:
            if existing.status == TX_STATUS_FAILED:
                existing.status = TX_STATUS_PENDING
                existing.metadata = {**(existing.metadata or {}), "phase": "retry_pending"}
                existing.save(update_fields=["status", "metadata", "updated_at"])
            return existing

        wallet = Wallet.objects.get_or_create(user=user)[0]
        try:
            with transaction.atomic():
                return Transaction.objects.create(
                    wallet=wallet,
                    amount=amount,
                    type=TX_TYPE_DEBIT,
                    status=TX_STATUS_PENDING,
                    reference=reference,
                    metadata={**metadata, "phase": "pending"},
                )
        except IntegrityError:
            # Another worker reserved this reference first.
            return Transaction.objects.get(reference=reference)

    @staticmethod
    def _apply_credit(user: User, amount: Decimal, reference: str, metadata: Dict[str, Any]) -> Transaction:
        """
        Idempotently credit the receiver's wallet under a unique reference.
        """
        existing = Transaction.objects.filter(reference=reference).first()
        if existing is not None and existing.status == TX_STATUS_COMPLETED:
            return existing

        wallet = Wallet.objects.select_for_update().get_or_create(user=user)[0]
        wallet.balance += amount
        wallet.save(update_fields=["balance", "updated_at"])

        if existing is not None:
            existing.status = TX_STATUS_COMPLETED
            existing.metadata = {**existing.metadata, "balance_after": str(wallet.balance)}
            existing.save(update_fields=["status", "metadata", "updated_at"])
            return existing

        return Transaction.objects.create(
            wallet=wallet,
            amount=amount,
            type=TX_TYPE_CREDIT,
            status=TX_STATUS_COMPLETED,
            reference=reference,
            metadata={**metadata, "balance_after": str(wallet.balance)},
        )

