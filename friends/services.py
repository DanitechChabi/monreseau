"""Services d'amitié partagés (vues + colonne droite « Contacts »)."""

from django.contrib.auth import get_user_model
from django.db.models import Q

from .models import Friendship

User = get_user_model()


def friend_users(user, limit=None):
    """Amis acceptés de ``user``, avec leur profil préchargé."""
    ids = Friendship.friend_ids(user)
    qs = User.objects.filter(id__in=ids).select_related('profile').order_by('username')
    if limit:
        qs = qs[:limit]
    return qs


def suggest_friends(user, limit=None):
    """Personnes sans relation existante avec ``user`` (suggestions).

    Reprend la logique d'exclusion de ``FriendSuggestionsView``.
    """
    linked = Friendship.objects.filter(
        Q(from_user=user) | Q(to_user=user)
    ).values_list('from_user_id', 'to_user_id')
    exclude_ids = {user.id}
    for from_id, to_id in linked:
        exclude_ids.add(from_id)
        exclude_ids.add(to_id)
    qs = User.objects.exclude(id__in=exclude_ids).select_related('profile').order_by('username')
    if limit:
        qs = qs[:limit]
    return qs
