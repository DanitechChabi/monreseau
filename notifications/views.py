from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import JsonResponse
from django.views import View
from django.views.generic import ListView

from .models import Notification


class NotificationListView(LoginRequiredMixin, ListView):
    """Liste des notifications de l'utilisateur, marquées comme lues à la visite."""

    template_name = 'notifications/notification_list.html'
    context_object_name = 'notifications'
    paginate_by = 20

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)

    def get(self, request, *args, **kwargs):
        # Le simple fait de visiter la page marque toutes les notifications
        # comme lues -> le badge de la navbar se vide immédiatement.
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return super().get(request, *args, **kwargs)


class UnreadCountView(LoginRequiredMixin, View):
    """Retourne le nombre de notifications non lues (JSON, pour le polling)."""

    def get(self, request):
        count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return JsonResponse({'count': count})
