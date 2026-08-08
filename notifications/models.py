from django.conf import settings
from django.db import models


class Notification(models.Model):
    """Notification destinée à un utilisateur (demande d'ami, like, etc.)."""

    class Type(models.TextChoices):
        FRIEND_REQUEST = 'friend_request', 'Demande d\'ami'
        FRIEND_ACCEPTED = 'friend_accepted', 'Demande d\'ami acceptée'
        LIKE = 'like', 'J\'aime'
        COMMENT = 'comment', 'Commentaire'
        MESSAGE = 'message', 'Message'

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='+',
        null=True,
        blank=True,
        verbose_name='Auteur',
    )
    notification_type = models.CharField(
        max_length=20,
        choices=Type.choices,
        verbose_name='Type',
    )
    text = models.CharField(max_length=255)
    link = models.CharField(max_length=255, blank=True)
    is_read = models.BooleanField(default=False, verbose_name='Lue')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'notification'
        verbose_name_plural = 'notifications'

    def __str__(self):
        return f'[{self.recipient}] {self.text}'
