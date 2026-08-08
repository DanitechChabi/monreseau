from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import TemplateView


class HomeView(LoginRequiredMixin, TemplateView):
    """Page d'accueil (fil d'actualité).

    Version provisoire : le vrai fil (posts des amis + soi-même) arrive avec
    l'app posts. Voir `core/views.py` réécrit en Phase 3.
    """

    template_name = 'core/home.html'


class SearchView(LoginRequiredMixin, TemplateView):
    """Recherche de personnes.

    Version provisoire : la recherche réelle (par nom / username) arrive en
    Phase 3, une fois les modèles `accounts` et `friends` en place.
    """

    template_name = 'core/search_results.html'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['q'] = self.request.GET.get('q', '').strip()
        return context
