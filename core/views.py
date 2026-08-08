from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import Q
from django.views.generic import ListView

from accounts.models import User
from posts.forms import PostForm
from posts.models import Post


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
