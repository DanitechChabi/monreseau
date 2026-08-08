from django.db.models import Count, Max, Q

from .models import Conversation


def get_or_create_conversation(user_a, user_b):
    """Retrouve la conversation entre deux utilisateurs, ou en crée une.

    Évite les doublons : on ne crée une conversation que si aucune n'existe
    déjà avec exactement ces deux participants.
    """
    conv = (
        Conversation.objects
        .filter(participants=user_a)
        .filter(participants=user_b)
        .first()
    )
    if conv is not None:
        return conv
    conv = Conversation.objects.create()
    conv.participants.add(user_a, user_b)
    return conv


def conversations_for(user):
    """Conversations de l'utilisateur, triées par activité récente,
    avec un compteur de messages non lus pour chacune."""
    return (
        Conversation.objects
        .filter(participants=user)
        .annotate(
            last_activity=Max('messages__created_at'),
            unread=Count(
                'messages',
                filter=Q(messages__is_read=False) & ~Q(messages__sender=user),
            ),
        )
        .order_by('-last_activity')
    )
