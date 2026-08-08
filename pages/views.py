from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import TemplateView


class PageListView(LoginRequiredMixin, TemplateView):
    """Placeholder — la vraie liste des pages arrive en Phase 7."""

    template_name = '_under_construction.html'
