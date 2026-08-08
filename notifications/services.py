from .models import Notification


def create_notification(*, recipient, actor, notification_type, text='', link=''):
    """Crée une notification.

    Point d'entrée unique pour créer une notification depuis n'importe quelle
    action (demande d'ami, like, commentaire…). Ne crée rien si l'acteur est
    aussi le destinataire (ex. : aimer son propre post).
    """
    if recipient is None or recipient == actor:
        return None
    return Notification.objects.create(
        recipient=recipient,
        actor=actor,
        notification_type=notification_type,
        text=text,
        link=link,
    )
