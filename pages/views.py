from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse_lazy
from django.views import View
from django.views.generic import CreateView, DeleteView, DetailView, ListView, UpdateView

from core.mixins import OwnerRequiredMixin

from .forms import PageForm
from .models import Page, PagePost


class PageListView(LoginRequiredMixin, ListView):
    """Liste de toutes les pages."""

    template_name = 'pages/page_list.html'
    context_object_name = 'pages'
    paginate_by = 12

    def get_queryset(self):
        return Page.objects.all().order_by('name')


class PageDetailView(LoginRequiredMixin, DetailView):
    """Page d'une page : publications + abonnés."""

    model = Page
    template_name = 'pages/page_detail.html'
    context_object_name = 'page'

    def get_queryset(self):
        return Page.objects.prefetch_related(
            'followers__profile',
            'posts__author__profile',
        )

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['is_follower'] = self.object.followers.filter(pk=self.request.user.pk).exists()
        return context


class PageCreateView(LoginRequiredMixin, CreateView):
    """Crée une page ; le propriétaire en devient automatiquement abonné."""

    model = Page
    form_class = PageForm
    template_name = 'pages/page_form.html'

    def form_valid(self, form):
        form.instance.owner = self.request.user
        response = super().form_valid(form)
        self.object.followers.add(self.request.user)
        messages.success(self.request, f'Page « {self.object.name} » créée !')
        return response

    def get_success_url(self):
        return self.object.get_absolute_url()


class PageUpdateView(LoginRequiredMixin, OwnerRequiredMixin, UpdateView):
    """Modifie une page (réservé à son propriétaire)."""

    model = Page
    owner_field = 'owner'
    form_class = PageForm
    template_name = 'pages/page_form.html'

    def get_success_url(self):
        return self.object.get_absolute_url()


class PageDeleteView(LoginRequiredMixin, OwnerRequiredMixin, DeleteView):
    """Supprime une page (réservé à son propriétaire)."""

    model = Page
    owner_field = 'owner'
    template_name = 'pages/page_confirm_delete.html'
    success_url = reverse_lazy('page_list')


class FollowPageView(LoginRequiredMixin, View):
    """Suit une page (POST uniquement)."""

    def post(self, request, pk):
        page = get_object_or_404(Page, pk=pk)
        page.followers.add(request.user)
        messages.success(request, f'Tu suis maintenant la page « {page.name} ».')
        return redirect(page.get_absolute_url())


class UnfollowPageView(LoginRequiredMixin, View):
    """Ne plus suivre une page (POST uniquement)."""

    def post(self, request, pk):
        page = get_object_or_404(Page, pk=pk)
        page.followers.remove(request.user)
        messages.info(request, f'Tu ne suis plus la page « {page.name} ».')
        return redirect(page.get_absolute_url())


class PagePostCreateView(LoginRequiredMixin, View):
    """Publie sur sa propre page (POST uniquement)."""

    def post(self, request, pk):
        page = get_object_or_404(Page, pk=pk)
        if page.owner != request.user:
            messages.error(request, 'Seul le propriétaire peut publier sur sa page.')
            return redirect(page.get_absolute_url())
        content = request.POST.get('content', '').strip()
        image = request.FILES.get('image')
        if content or image:
            PagePost.objects.create(page=page, author=request.user, content=content, image=image)
            messages.success(request, 'Publication ajoutée à la page.')
        else:
            messages.error(request, 'Ta publication est vide.')
        return redirect(page.get_absolute_url())
