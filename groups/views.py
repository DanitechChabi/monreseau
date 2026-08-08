from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import TemplateView


class GroupListView(LoginRequiredMixin, TemplateView):
    """Placeholder — la vraie liste des groupes arrive en Phase 6."""

    template_name = '_under_construction.html'
