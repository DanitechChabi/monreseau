from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import TemplateView


class ConversationListView(LoginRequiredMixin, TemplateView):
    """Placeholder — la vraie liste des conversations arrive en Phase 5."""

    template_name = '_under_construction.html'
