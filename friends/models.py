from django.conf import settings
from django.db import models
from django.db.models import Q


class Friendship(models.Model):
    """Relation d'amitié entre deux utilisateurs.

    Design volontairement simple : une seule table couvre tout le cycle
    (demande en attente → acceptée). Rejeter / annuler / supprimer un ami se
    traduit simplement par la suppression de la ligne, ce qui permet à deux
    personnes de se renvoyer une demande plus tard.
    """

    class Status(models.TextChoices):
        PENDING = 'pending', 'En attente'
        ACCEPTED = 'accepted', 'Acceptée'

    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='friendship_requests_sent',
    )
    to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='friendship_requests_received',
    )
    status = models.CharField(
        max_length=10,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name='Statut',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'amitié'
        verbose_name_plural = 'amitiés'
        constraints = [
            models.UniqueConstraint(
                fields=['from_user', 'to_user'],
                name='unique_friendship_pair',
            ),
        ]

    def __str__(self):
        return f'{self.from_user.username} ↔ {self.to_user.username} ({self.status})'

    @classmethod
    def friendship_between(cls, a, b):
        """Retourne la relation entre a et b (dans un sens ou l'autre), ou None."""
        return cls.objects.filter(
            Q(from_user=a, to_user=b) | Q(from_user=b, to_user=a)
        ).first()

    @classmethod
    def are_friends(cls, a, b):
        """Vrai si a et b sont amis (relation acceptée dans un sens ou l'autre)."""
        rel = cls.friendship_between(a, b)
        return rel is not None and rel.status == cls.Status.ACCEPTED

    @classmethod
    def friend_ids(cls, user):
        """Identifiants de tous les amis acceptés de `user` (dans les 2 sens)."""
        sent = cls.objects.filter(
            from_user=user, status=cls.Status.ACCEPTED
        ).values_list('to_user_id', flat=True)
        received = cls.objects.filter(
            to_user=user, status=cls.Status.ACCEPTED
        ).values_list('from_user_id', flat=True)
        return set(sent) | set(received)
