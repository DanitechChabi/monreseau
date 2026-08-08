from django.conf import settings
from django.db import models
from django.urls import reverse


class PostQuerySet(models.QuerySet):
    """Queryset personnalisé pour les publications."""

    def feed_for(self, user):
        """Fil d'actualité : publications de l'utilisateur et de ses amis.

        La politique « qui apparaît dans le fil » est une règle du domaine des
        amis, encapsulée ici pour être réutilisable (page d'accueil, API plus
        tard…). Import différé de `friends` pour éviter tout cycle d'import.
        """
        from friends.models import Friendship
        friend_ids = Friendship.friend_ids(user)
        friend_ids.add(user.id)
        return (
            self.filter(author_id__in=friend_ids)
            .select_related('author__profile')
            .prefetch_related('likes', 'comments__author__profile')
            .order_by('-created_at')
        )


class Post(models.Model):
    """Publication : un texte et/ou une image."""

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='posts',
    )
    content = models.TextField(blank=True, verbose_name='Contenu')
    image = models.ImageField(upload_to='posts/', blank=True, verbose_name='Image')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = PostQuerySet.as_manager()

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'publication'
        verbose_name_plural = 'publications'

    def __str__(self):
        return f'{self.author.username}: {self.content[:50] or "[image]"}'

    def get_absolute_url(self):
        return reverse('post_detail', kwargs={'pk': self.pk})


class Like(models.Model):
    """« J'aime » sur une publication (un utilisateur, une fois)."""

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='likes')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='likes',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['post', 'user'], name='unique_post_like'),
        ]
        verbose_name = 'j\'aime'
        verbose_name_plural = 'j\'aime'

    def __str__(self):
        return f'{self.user.username} aime le post #{self.post_id}'


class Comment(models.Model):
    """Commentaire sous une publication."""

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='comments',
    )
    content = models.TextField(verbose_name='Commentaire')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = 'commentaire'
        verbose_name_plural = 'commentaires'

    def __str__(self):
        return f'{self.author.username}: {self.content[:50]}'
