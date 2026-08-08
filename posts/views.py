from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse, reverse_lazy
from django.views import View
from django.views.generic import CreateView, DeleteView, DetailView, UpdateView

from core.mixins import OwnerRequiredMixin

from .forms import CommentForm, PostForm
from .models import Comment, Like, Post


class PostCreateView(LoginRequiredMixin, CreateView):
    """Crée une nouvelle publication."""

    model = Post
    form_class = PostForm
    template_name = 'posts/post_form.html'

    def form_valid(self, form):
        form.instance.author = self.request.user
        messages.success(self.request, 'Publication partagée !')
        return super().form_valid(form)

    def get_success_url(self):
        return reverse('home')


class PostDetailView(LoginRequiredMixin, DetailView):
    """Affiche une publication avec ses commentaires."""

    model = Post
    template_name = 'posts/post_detail.html'
    context_object_name = 'post'

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .select_related('author__profile')
            .prefetch_related('likes', 'comments__author__profile')
        )

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['comment_form'] = CommentForm()
        return context


class PostUpdateView(LoginRequiredMixin, OwnerRequiredMixin, UpdateView):
    """Modifie sa propre publication."""

    model = Post
    form_class = PostForm
    template_name = 'posts/post_form.html'

    def get_success_url(self):
        return reverse('post_detail', kwargs={'pk': self.object.pk})


class PostDeleteView(LoginRequiredMixin, OwnerRequiredMixin, DeleteView):
    """Supprime sa propre publication (avec page de confirmation)."""

    model = Post
    template_name = 'posts/post_confirm_delete.html'
    success_url = reverse_lazy('home')


class ToggleLikeView(LoginRequiredMixin, View):
    """Ajoute ou retire un « j'aime » (POST uniquement)."""

    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        like = Like.objects.filter(post=post, user=request.user).first()
        if like is not None:
            like.delete()
        else:
            Like.objects.create(post=post, user=request.user)
            # Notification à l'auteur du post (câblée en Phase 4).
        return redirect(request.META.get('HTTP_REFERER', reverse('home')))


class CommentCreateView(LoginRequiredMixin, View):
    """Ajoute un commentaire à une publication (POST uniquement)."""

    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        form = CommentForm(request.POST)
        if form.is_valid():
            comment = form.save(commit=False)
            comment.post = post
            comment.author = request.user
            comment.save()
            messages.success(request, 'Commentaire ajouté.')
            # Notification à l'auteur du post (câblée en Phase 4).
        else:
            messages.error(request, 'Ton commentaire est vide ou invalide.')
        return redirect(request.META.get('HTTP_REFERER', reverse('post_detail', kwargs={'pk': post.pk})))


class CommentDeleteView(LoginRequiredMixin, View):
    """Supprime son propre commentaire (POST uniquement)."""

    def post(self, request, pk):
        comment = get_object_or_404(Comment, pk=pk)
        post = comment.post
        if comment.author != request.user:
            messages.error(request, 'Tu ne peux pas supprimer ce commentaire.')
        else:
            comment.delete()
            messages.info(request, 'Commentaire supprimé.')
        return redirect(reverse('post_detail', kwargs={'pk': post.pk}))
