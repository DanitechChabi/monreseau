from django.contrib import messages
from django.contrib.auth import get_user_model
from html import escape
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse, reverse_lazy
from django.utils import timezone
from django.utils.translation import gettext as _
from django.views import View
from django.views.generic import CreateView, DeleteView, DetailView, ListView, UpdateView

from core.mixins import OwnerRequiredMixin
from notifications.models import Notification
from notifications.services import create_notification

from .forms import CommentForm, PostForm
from .models import (Block, Bookmark, Comment, Like, OnlineStatus, Poll, PollOption,
                     Post, Report, Story, TypingIndicator)


class ToggleBookmarkView(LoginRequiredMixin, View):
    """Ajoute ou retire un post des enregistrés (POST uniquement)."""

    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        bookmark, created = Bookmark.objects.get_or_create(user=request.user, post=post)
        if not created:
            bookmark.delete()
        return redirect(request.META.get('HTTP_REFERER', reverse('home')))


class BookmarksListView(LoginRequiredMixin, ListView):
    """Liste des posts enregistrés par l'utilisateur."""

    template_name = 'posts/bookmarks.html'
    context_object_name = 'posts'
    paginate_by = 10

    def get_queryset(self):
        return (
            Post.objects
            .filter(bookmarks__user=self.request.user)
            .select_related('author__profile')
            .prefetch_related('likes', 'comments__author__profile')
            .order_by('-bookmarks__created_at')
        )


class PostCreateView(LoginRequiredMixin, CreateView):
    """Crée une nouvelle publication."""

    model = Post
    form_class = PostForm
    template_name = 'posts/post_form.html'

    def form_valid(self, form):
        form.instance.author = self.request.user
        messages.success(self.request, _('Publication partagée !'))
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
    """Ajoute ou modifie une réaction sur une publication (POST uniquement)."""

    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        reaction_type = request.POST.get('reaction', Like.ReactionType.LIKE)
        if reaction_type not in dict(Like.ReactionType.choices):
            reaction_type = Like.ReactionType.LIKE

        like = Like.objects.filter(post=post, user=request.user).first()
        if like is not None:
            if like.reaction_type == reaction_type:
                like.delete()
            else:
                like.reaction_type = reaction_type
                like.save(update_fields=['reaction_type'])
                # Pas de notification — l'ami a déjà été notifié du premier like
        else:
            Like.objects.create(post=post, user=request.user, reaction_type=reaction_type)
            emoji = Like.REACTION_EMOJIS.get(reaction_type, '👍')
            create_notification(
                recipient=post.author,
                actor=request.user,
                notification_type=Notification.Type.LIKE,
                text=f'{request.user.username} a réagi {emoji} à ta publication',
                link=post.get_absolute_url(),
            )
        return redirect(request.META.get('HTTP_REFERER', reverse('home')))


class CommentCreateView(LoginRequiredMixin, View):
    """Ajoute un commentaire à une publication (POST uniquement)."""

    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        form = CommentForm(request.POST, request.FILES)
        if form.is_valid():
            content = form.cleaned_data.get('content', '').strip()
            audio = form.cleaned_data.get('audio')
            if not content and not audio:
                messages.error(request, _('Ton commentaire est vide.'))
                return redirect(request.META.get('HTTP_REFERER', reverse('post_detail', kwargs={'pk': post.pk})))
            comment = form.save(commit=False)
            comment.post = post
            comment.author = request.user
            comment.save()
            create_notification(
                recipient=post.author,
                actor=request.user,
                notification_type=Notification.Type.COMMENT,
                text=f'{request.user.username} a commenté ta publication',
                link=post.get_absolute_url(),
            )
            messages.success(request, _('Commentaire ajouté.'))
        else:
            messages.error(request, _('Ton commentaire est vide ou invalide.'))
        return redirect(request.META.get('HTTP_REFERER', reverse('post_detail', kwargs={'pk': post.pk})))


class CommentDeleteView(LoginRequiredMixin, View):
    """Supprime son propre commentaire (POST uniquement)."""

    def post(self, request, pk):
        comment = get_object_or_404(Comment, pk=pk)
        post = comment.post
        if comment.author != request.user:
            messages.error(request, _('Tu ne peux pas supprimer ce commentaire.'))
        else:
            comment.delete()
            messages.info(request, _('Commentaire supprimé.'))
        return redirect(reverse('post_detail', kwargs={'pk': post.pk}))


# ===== STORIES =====

class StoriesView(LoginRequiredMixin, View):
    """Affiche les stories des amis et de l'utilisateur."""

    def get(self, request):
        from friends.models import Friendship
        friend_ids = Friendship.friend_ids(request.user)
        friend_ids.add(request.user.id)
        stories = (
            Story.objects
            .filter(author_id__in=friend_ids, expires_at__gt=timezone.now())
            .select_related('author__profile')
            .order_by('-created_at')
        )
        return render(request, 'posts/stories.html', {'stories': stories})


class StoryCreateView(LoginRequiredMixin, View):
    """Crée une nouvelle story."""

    def post(self, request):
        story_type = request.POST.get('story_type', 'text')
        content = request.POST.get('content', '')
        bg_color = request.POST.get('bg_color', '#D4A017')
        image = request.FILES.get('image')
        video = request.FILES.get('video')
        audio = request.FILES.get('audio')

        if not content and not image and not video and not audio:
            messages.error(request, _('Ajoute du contenu à ta story.'))
            return redirect('home')

        Story.objects.create(
            author=request.user,
            story_type=story_type,
            content=content,
            bg_color=bg_color,
            image=image,
            video=video,
            audio=audio,
        )
        messages.success(request, _('Story publiée !'))
        return redirect('home')


class StoryViewView(LoginRequiredMixin, View):
    """Marque une story comme vue."""

    def post(self, request, pk):
        story = get_object_or_404(Story, pk=pk)
        story.views.add(request.user)
        return JsonResponse({'status': 'ok'})


# ===== POLLS =====

class PollVoteView(LoginRequiredMixin, View):
    """Vote sur un sondage."""

    def post(self, request, pk):
        option = get_object_or_404(PollOption, pk=pk)
        poll = option.poll
        if not poll.is_active:
            messages.error(request, _('Ce sondage est terminé.'))
            return redirect(request.META.get('HTTP_REFERER', 'home'))
        for opt in poll.options.all():
            opt.votes.remove(request.user)
        option.votes.add(request.user)
        return redirect(request.META.get('HTTP_REFERER', reverse('post_detail', kwargs={'pk': poll.post.pk})))


# ===== BLOCK / REPORT =====

class BlockUserView(LoginRequiredMixin, View):
    """Bloque un utilisateur."""

    def post(self, request, user_id):
        target = get_object_or_404(get_user_model(), pk=user_id)
        if target == request.user:
            messages.error(request, _('Tu ne peux pas te bloquer toi-même.'))
        else:
            Block.objects.get_or_create(blocker=request.user, blocked=target)
            messages.success(request, _('%(name)s est bloqué.') % {'name': target.username})
        return redirect('profile', username=target.username)


class UnblockUserView(LoginRequiredMixin, View):
    """Débloque un utilisateur."""

    def post(self, request, user_id):
        target = get_object_or_404(get_user_model(), pk=user_id)
        Block.objects.filter(blocker=request.user, blocked=target).delete()
        messages.success(request, _('%(name)s est débloqué.') % {'name': target.username})
        return redirect('profile', username=target.username)


class ReportView(LoginRequiredMixin, View):
    """Signale un contenu."""

    def post(self, request, pk):
        post = get_object_or_404(Post, pk=pk)
        reason = request.POST.get('reason', 'other')
        description = request.POST.get('description', '')
        Report.objects.create(
            reporter=request.user,
            post=post,
            reason=reason,
            description=description,
        )
        messages.success(request, _('Merci pour ton signalement. Nous allons le traiter.'))
        return redirect('home')


# ===== ONLINE STATUS =====

class HeartbeatView(LoginRequiredMixin, View):
    """Heartbeat pour le statut en ligne."""

    def post(self, request):
        status, _ = OnlineStatus.objects.get_or_create(user=request.user)
        status.is_online = True
        status.save(update_fields=['is_online', 'last_seen'])
        return JsonResponse({'status': 'ok'})


# ===== TYPING INDICATOR =====

class TypingView(LoginRequiredMixin, View):
    """Indicateur de frappe."""

    def post(self, request, conversation_id):
        from messaging.models import Conversation
        conv = get_object_or_404(Conversation, pk=conversation_id, participants=request.user)
        indicator, _ = TypingIndicator.objects.get_or_create(
            user=request.user, conversation=conv
        )
        indicator.last_typed = timezone.now()
        indicator.save(update_fields=['last_typed'])
        return JsonResponse({'status': 'ok'})


# ===== INFINITE SCROLL =====

class InfiniteFeedView(LoginRequiredMixin, View):
    """Charge plus de posts via AJAX (scroll infini)."""

    def get(self, request):
        try:
            page = max(1, int(request.GET.get('page', 1)))
        except (ValueError, TypeError):
            page = 1
        per_page = 5
        offset = (page - 1) * per_page
        posts = Post.objects.feed_for(request.user)[offset:offset + per_page]
        data = []
        for post in posts:
            data.append({
                'id': post.pk,
                'author': post.author.get_full_name() or post.author.username,
                'avatar': post.author.profile.avatar.url if post.author.profile.avatar else '',
                'content': escape(post.content),  # XSS: échappe le HTML
                'image': post.image.url if post.image else '',
                'likes': post.likes.count(),
                'comments': post.comments.count(),
                'created_at': post.created_at.strftime('%d/%m/%Y %H:%M'),
            })
        return JsonResponse({'posts': data, 'has_more': len(posts) == per_page})
