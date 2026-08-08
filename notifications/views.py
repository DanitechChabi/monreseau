from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import TemplateView


class NotificationListView(LoginRequiredMixin, TemplateView):
    """Placeholder — la vraie liste des notifications arrive en Phase 4."""

    template_name = '_under_construction.html'
