from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import redirect
from django.urls import reverse_lazy
from django.views.generic import CreateView, DetailView, UpdateView

from .forms import ProfileUpdateForm, UserRegisterForm, UserUpdateForm
from .models import User


class RegisterView(CreateView):
    """Inscription d'un nouvel utilisateur, puis connexion automatique."""

    form_class = UserRegisterForm
    template_name = 'accounts/register.html'
    success_url = reverse_lazy('home')

    def form_valid(self, form):
        response = super().form_valid(form)
        login(self.request, self.object)
        messages.success(self.request, f'Bienvenue {self.object.username} ! Ton compte a été créé.')
        return response


class ProfileView(DetailView):
    """Page publique du profil d'un utilisateur."""

    model = User
    template_name = 'accounts/profile.html'
    context_object_name = 'profile_user'
    slug_field = 'username'
    slug_url_kwarg = 'username'

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        user = self.object

        # Publications de l'utilisateur (l'app posts arrive à la Phase 3).
        post_qs = getattr(user, 'posts', None)
        if post_qs is not None:
            context['posts'] = (
                post_qs.select_related('author__profile')
                .prefetch_related('likes', 'comments__author__profile')
                .order_by('-created_at')
            )
        else:
            context['posts'] = []

        # État de la relation d'amitié (rempli à la Phase 2).
        context['is_friend'] = False
        context['friendship_pending'] = False
        context['friend_count'] = 0
        return context


class EditProfileView(LoginRequiredMixin, UpdateView):
    """Modification de son propre compte + profil (deux formulaires en un)."""

    model = User
    template_name = 'accounts/edit_profile.html'
    slug_field = 'username'
    slug_url_kwarg = 'username'

    def get_object(self, queryset=None):
        # On ne peut modifier que son propre profil.
        return self.request.user

    def get_form_class(self):
        return UserUpdateForm

    def get_success_url(self):
        return reverse_lazy('profile', kwargs={'username': self.object.username})

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        if self.request.POST:
            context['profile_form'] = ProfileUpdateForm(
                self.request.POST, self.request.FILES, instance=self.request.user.profile
            )
        else:
            context['profile_form'] = ProfileUpdateForm(instance=self.request.user.profile)
        return context

    def form_valid(self, form):
        context = self.get_context_data()
        profile_form = context['profile_form']
        if profile_form.is_valid():
            self.object = form.save()
            profile_form.save()
            messages.success(self.request, 'Ton profil a bien été mis à jour.')
            return redirect(self.get_success_url())
        # Le formulaire principal était valide mais pas le profil -> on réaffiche.
        return self.render_to_response(context)
