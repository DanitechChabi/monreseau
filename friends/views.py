from django.contrib import messages
from django.contrib.auth import get_user_model
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse
from django.views import View
from django.views.generic import ListView

from notifications.models import Notification
from notifications.services import create_notification

from .models import Friendship

User = get_user_model()


class FriendListView(LoginRequiredMixin, ListView):
    """Liste paginée de tous les amis acceptés."""

    template_name = 'friends/friend_list.html'
    context_object_name = 'friends'
    paginate_by = 24

    def get_queryset(self):
        ids = Friendship.friend_ids(self.request.user)
        return (
            User.objects
            .filter(id__in=ids)
            .select_related('profile')
            .order_by('username')
        )


class PendingRequestsView(LoginRequiredMixin, ListView):
    """Demandes d'amitié reçues, en attente d'une réponse."""

    template_name = 'friends/friend_requests.html'
    context_object_name = 'requests'

    def get_queryset(self):
        return (
            Friendship.objects
            .filter(to_user=self.request.user, status=Friendship.Status.PENDING)
            .select_related('from_user__profile')
        )


class FriendSuggestionsView(LoginRequiredMixin, ListView):
    """Personnes que l'on pourrait ajouter en ami (aucune relation existante)."""

    template_name = 'friends/friend_suggestions.html'
    context_object_name = 'suggestions'
    paginate_by = 24

    def get_queryset(self):
        user = self.request.user
        # Toute personne déjà liée à l'utilisateur (dans un sens ou l'autre,
        # en attente ou acceptée) est exclue, ainsi que soi-même.
        linked = Friendship.objects.filter(
            Q(from_user=user) | Q(to_user=user)
        ).values_list('from_user_id', 'to_user_id')
        exclude_ids = {user.id}
        for from_id, to_id in linked:
            exclude_ids.add(from_id)
            exclude_ids.add(to_id)
        return (
            User.objects
            .exclude(id__in=exclude_ids)
            .select_related('profile')
            .order_by('username')
        )


class SendFriendRequestView(LoginRequiredMixin, View):
    """Envoie une demande d'ami (POST uniquement)."""

    def post(self, request, user_id):
        target = get_object_or_404(User, pk=user_id)
        if target == request.user:
            messages.error(request, "Impossible de t'ajouter toi-même en ami.")
        elif Friendship.friendship_between(request.user, target) is not None:
            messages.error(request, 'Une demande est déjà en cours ou vous êtes déjà amis.')
        else:
            Friendship.objects.create(from_user=request.user, to_user=target)
            create_notification(
                recipient=target,
                actor=request.user,
                notification_type=Notification.Type.FRIEND_REQUEST,
                text=f"{request.user.username} t'a envoyé une demande d'ami",
                link=reverse('friend_requests'),
            )
            messages.success(request, f"Demande d'ami envoyée à {target.username}.")
        return redirect('profile', username=target.username)


class AcceptFriendRequestView(LoginRequiredMixin, View):
    """Accepte une demande d'ami reçue (POST uniquement)."""

    def post(self, request, pk):
        friendship = get_object_or_404(
            Friendship,
            pk=pk,
            to_user=request.user,
            status=Friendship.Status.PENDING,
        )
        friendship.status = Friendship.Status.ACCEPTED
        friendship.save(update_fields=['status', 'updated_at'])
        create_notification(
            recipient=friendship.from_user,
            actor=request.user,
            notification_type=Notification.Type.FRIEND_ACCEPTED,
            text=f'{request.user.username} a accepté ta demande d\'ami',
            link=reverse('profile', kwargs={'username': request.user.username}),
        )
        messages.success(request, f"Vous êtes maintenant amis avec {friendship.from_user.username}.")
        return redirect('friend_list')


class RejectFriendRequestView(LoginRequiredMixin, View):
    """Refuse une demande d'ami reçue (POST uniquement)."""

    def post(self, request, pk):
        friendship = get_object_or_404(
            Friendship,
            pk=pk,
            to_user=request.user,
            status=Friendship.Status.PENDING,
        )
        sender = friendship.from_user
        friendship.delete()
        messages.info(request, f"Demande d'ami de {sender.username} refusée.")
        return redirect('friend_requests')


class CancelFriendRequestView(LoginRequiredMixin, View):
    """Annule une demande d'ami que l'on a envoyée (POST uniquement)."""

    def post(self, request, pk):
        friendship = get_object_or_404(
            Friendship,
            pk=pk,
            from_user=request.user,
            status=Friendship.Status.PENDING,
        )
        target = friendship.to_user
        friendship.delete()
        messages.info(request, f'Demande d\'ami annulée pour {target.username}.')
        return redirect('profile', username=target.username)


class UnfriendView(LoginRequiredMixin, View):
    """Supprime la relation d'amitié avec quelqu'un (POST uniquement)."""

    def post(self, request, user_id):
        target = get_object_or_404(User, pk=user_id)
        friendship = Friendship.friendship_between(request.user, target)
        if friendship is not None and friendship.status == Friendship.Status.ACCEPTED:
            friendship.delete()
            messages.info(request, f"Vous n'êtes plus ami avec {target.username}.")
        return redirect('profile', username=target.username)
