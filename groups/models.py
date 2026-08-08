from django.conf import settings
from django.db import models
from django.urls import reverse


class Group(models.Model):
    """Groupe : un créateur, des membres, des publications."""

    name = models.CharField(max_length=100, verbose_name='Nom')
    description = models.TextField(blank=True, verbose_name='Description')
    image = models.ImageField(upload_to='groups/', blank=True, verbose_name='Image')
    creator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_groups',
        verbose_name='Créateur',
    )
    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='joined_groups',
        verbose_name='Membres',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'groupe'
        verbose_name_plural = 'groupes'

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return reverse('group_detail', kwargs={'pk': self.pk})

    def member_count(self):
        return self.members.count()


class GroupPost(models.Model):
    """Publication faite par un membre à l'intérieur d'un groupe."""

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='posts')
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='group_posts',
    )
    content = models.TextField(verbose_name='Contenu')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'publication de groupe'
        verbose_name_plural = 'publications de groupe'

    def __str__(self):
        return f'{self.author.username} → {self.group.name}: {self.content[:50]}'
