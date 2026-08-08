from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Modèle utilisateur personnalisé.

    Remplace ``django.contrib.auth.models.User`` dès la première migration
    (``AUTH_USER_MODEL = 'accounts.User'``). Il n'ajoute aucun champ pour
    l'instant, mais le fait d'utiliser un modèle dédié nous permettra plus tard
    d'ajouter des champs (ou un login par e-mail) sans devoir tout recréer.
    """

    class Meta:
        verbose_name = 'utilisateur'
        verbose_name_plural = 'utilisateurs'


class Profile(models.Model):
    """Informations publiques d'un utilisateur (avatar, bio, etc.)."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
    )
    avatar = models.ImageField(upload_to='avatars/', blank=True)
    cover = models.ImageField(upload_to='covers/', blank=True)
    bio = models.TextField(max_length=500, blank=True, verbose_name='Biographie')
    birth_date = models.DateField(null=True, blank=True, verbose_name='Date de naissance')
    location = models.CharField(max_length=100, blank=True, verbose_name='Localisation')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Profil de {self.user.username}'
