from django.conf import settings
from django.db import models
from django.urls import reverse


class Conversation(models.Model):
    """Conversation privée (ici : entre deux participants)."""

    participants = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='conversations',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'conversation'
        verbose_name_plural = 'conversations'

    def __str__(self):
        names = ', '.join(u.username for u in self.participants.all())
        return f'Conversation ({names})'

    def get_absolute_url(self):
        return reverse('conversation_detail', kwargs={'pk': self.pk})


class Message(models.Model):
    """Un message envoyé dans une conversation."""

    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='messages',
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_messages',
    )
    body = models.TextField(verbose_name='Message')
    is_read = models.BooleanField(default=False, verbose_name='Lu')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = 'message'
        verbose_name_plural = 'messages'

    def __str__(self):
        return f'{self.sender.username}: {self.body[:50]}'

    @classmethod
    def unread_count_for(cls, user):
        """Nombre de messages non lus destinés à `user` (toutes conversations)."""
        return (
            cls.objects
            .filter(conversation__participants=user)
            .exclude(sender=user)
            .filter(is_read=False)
            .distinct()
            .count()
        )
