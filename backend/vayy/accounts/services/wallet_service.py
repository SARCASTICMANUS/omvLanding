import logging
from decimal import Decimal
from typing import Dict, Any, Optional
from django.db import transaction
from django.utils import timezone

from accounts.models import User, Wallet, Transaction
from common.constants import (
    TX_TYPE_CREDIT, TX_TYPE_DEBIT,
    TX_STATUS_COMPLETED, TX_STATUS_FAILED
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
        """
        logger.info(f"Transferring {amount} from {sender.id} to {receiver.id}")
        
        # Deduct from sender
        debit_tx = WalletService.deduct_funds(
            sender, amount, reference, 
            {**(metadata or {}), "transfer_to": str(receiver.id)}
        )

        # Credit to receiver
        credit_tx = WalletService.add_funds(
            receiver, amount, reference, 
            {**(metadata or {}), "transfer_from": str(sender.id)}
        )

        return debit_tx, credit_tx
