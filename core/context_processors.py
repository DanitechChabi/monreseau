"""
Context processors globaux — rendus disponibles sur toutes les pages.

`unread_counts` fournit le nombre de notifications et de messages non lus,
utilisé pour les badges de la navbar. Il est volontairement tolérant : si les
modèles n'existent pas encore (apps construites plus tard dans le projet), il
retourne simplement 0 au lieu de planter.
"""
from django.apps import apps


def _get_model(app_label, model_name):
    """Retourne le modèle demandé, ou None s'il n'existe pas encore."""
    try:
        return apps.get_model(app_label, model_name)
    except LookupError:
        return None


def unread_counts(request):
    counts = {'notifications': 0, 'messages': 0}
    if request.user.is_authenticated:
        Notification = _get_model('notifications', 'Notification')
        if Notification is not None:
            counts['notifications'] = Notification.objects.filter(
                recipient=request.user, is_read=False
            ).count()

        Message = _get_model('messaging', 'Message')
        if Message is not None:
            counts['messages'] = Message.unread_count_for(request.user)
    return {'unread_counts': counts}
