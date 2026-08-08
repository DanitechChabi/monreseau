from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import TemplateView


class FriendListView(LoginRequiredMixin, TemplateView):
    """Placeholder — la vraie liste des amis arrive en Phase 2."""

    template_name = '_under_construction.html'
