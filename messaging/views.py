from django.contrib import messages
from django.contrib.auth import get_user_model
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect
from django.views import View
from django.views.generic import DetailView, ListView

from friends.models import Friendship
from notifications.models import Notification
from notifications.services import create_notification

from .forms import MessageForm
from .models import Conversation, Message
from .services import conversations_for, get_or_create_conversation

User = get_user_model()


class ConversationListView(LoginRequiredMixin, ListView):
    """Liste des conversations, avec aperçu du dernier message."""

    template_name = 'messaging/conversation_list.html'
    context_object_name = 'conversations'
    paginate_by = 20

    def get_queryset(self):
        return (
            conversations_for(self.request.user)
            .prefetch_related('participants__profile', 'messages')
        )


class ConversationDetailView(LoginRequiredMixin, DetailView):
    """Fil de discussion : affiche les messages et permet d'en envoyer."""

    model = Conversation
    template_name = 'messaging/conversation_detail.html'
    context_object_name = 'conversation'

    def get_queryset(self):
        # Seul un participant peut voir la conversation.
        return (
            Conversation.objects
            .filter(participants=self.request.user)
            .prefetch_related('participants__profile', 'messages__sender__profile')
        )

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['message_form'] = MessageForm()
        context['other_user'] = self.object.participants.exclude(pk=self.request.user.pk).first()
        return context

    def get(self, request, *args, **kwargs):
        # L'ouverture du fil marque comme lus les messages reçus.
        conversation = self.get_object()
        conversation.messages.exclude(sender=request.user).filter(is_read=False).update(is_read=True)
        return super().get(request, *args, **kwargs)

    def post(self, request, pk):
        conversation = self.get_object()
        form = MessageForm(request.POST)
        if form.is_valid():
            message = form.save(commit=False)
            message.conversation = conversation
            message.sender = request.user
            message.save()
            other = conversation.participants.exclude(pk=request.user.pk).first()
            if other is not None:
                create_notification(
                    recipient=other,
                    actor=request.user,
                    notification_type=Notification.Type.MESSAGE,
                    text=f'{request.user.username} t\'a envoyé un message',
                    link=conversation.get_absolute_url(),
                )
        return redirect(conversation.get_absolute_url())


class StartConversationView(LoginRequiredMixin, View):
    """Ouvre (ou crée) une conversation avec un ami (POST uniquement)."""

    def post(self, request, user_id):
        target = get_object_or_404(User, pk=user_id)
        if target == request.user:
            messages.error(request, "Impossible de te parler à toi-même.")
            return redirect('home')
        if not Friendship.are_friends(request.user, target):
            messages.error(request, 'Tu ne peux envoyer un message qu\'à tes amis.')
            return redirect('profile', username=target.username)
        conversation = get_or_create_conversation(request.user, target)
        return redirect(conversation.get_absolute_url())


class UnreadMessagesCountView(LoginRequiredMixin, View):
    """Nombre de messages non lus (JSON, pour le polling du badge)."""

    def get(self, request):
        count = Message.unread_count_for(request.user)
        return JsonResponse({'count': count})
