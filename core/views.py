from django.conf import settings
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import Q
from django.shortcuts import redirect
from django.urls import reverse
from django.utils import translation
from django.utils.http import url_has_allowed_host_and_scheme
from django.views import View
from django.views.generic import ListView

from accounts.models import User
from posts.forms import PostForm
from posts.models import Post

from .models import Language


class HomeView(LoginRequiredMixin, ListView):
    """Fil d'actualité : publications des amis et de soi-même."""

    template_name = 'core/home.html'
    context_object_name = 'posts'
    paginate_by = 10

    def get_queryset(self):
        return Post.objects.feed_for(self.request.user)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['post_form'] = PostForm()
        return context


class SearchView(LoginRequiredMixin, ListView):
    """Recherche de personnes par pseudo, prénom ou nom."""

    template_name = 'core/search_results.html'
    context_object_name = 'results'
    paginate_by = 24

    def get_queryset(self):
        q = self.request.GET.get('q', '').strip()
        if not q:
            return User.objects.none()
        return (
            User.objects
            .filter(
                Q(username__icontains=q)
                | Q(first_name__icontains=q)
                | Q(last_name__icontains=q)
            )
            .select_related('profile')
            .order_by('username')
        )

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['q'] = self.request.GET.get('q', '').strip()
        return context


class SetLanguageView(View):
    """Change la langue de l'interface (POST ``language`` = code ISO).

    Persiste le choix sur le profil (si connecté) et dans le cookie,
    puis redirige vers la page d'origine.
    """

    def _safe_redirect_url(self, request, url):
        """Valide que l'URL est locale (empêche les redirections ouvertes)."""
        if url_has_allowed_host_and_scheme(url, allowed_hosts={request.get_host()}):
            return url
        return reverse('home')

    def post(self, request):
        code = request.POST.get('language', '')
        next_url = self._safe_redirect_url(
            request,
            request.POST.get('next') or request.META.get('HTTP_REFERER') or 'home',
        )

        if code == settings.LANGUAGE_CODE or code == 'fr':
            # Français = langue par défaut → on efface le choix du profil.
            translation.activate('fr')
            response = redirect(next_url)
            response.set_cookie(settings.LANGUAGE_COOKIE_NAME, 'fr', max_age=365 * 24 * 3600)
            if request.user.is_authenticated and hasattr(request.user, 'profile'):
                request.user.profile.ui_language = None
                request.user.profile.save(update_fields=['ui_language'])
            return response

        lang = Language.objects.filter(code=code, is_active=True).first()
        if lang is None:
            return redirect(next_url)

        translation.activate(lang.code)
        response = redirect(next_url)
        response.set_cookie(settings.LANGUAGE_COOKIE_NAME, lang.code, max_age=365 * 24 * 3600)

        if request.user.is_authenticated and hasattr(request.user, 'profile'):
            request.user.profile.ui_language = lang
            request.user.profile.save(update_fields=['ui_language'])

        return response
