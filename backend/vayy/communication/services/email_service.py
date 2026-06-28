from django.core.mail import send_mail


class EmailService:

    @staticmethod
    def send(
        subject,
        message,
        recipient,
    ):
        send_mail(
            subject,
            message,
            None,
            [recipient],
            fail_silently=False,
        )