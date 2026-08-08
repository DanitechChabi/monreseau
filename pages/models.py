from django.conf import settings
from django.db import models
from django.urls import reverse


class Page(models.Model):
    """Page (personne, marque, organisation…) suivie par des utilisateurs."""

    name = models.CharField(max_length=100, verbose_name='Nom')
    description = models.TextField(blank=True, verbose_name='Description')
    image = models.ImageField(upload_to='pages/', blank=True, verbose_name='Image')
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='owned_pages',
        verbose_name='Propriétaire',
    )
    followers = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='followed_pages',
        verbose_name='Abonnés',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'page'
        verbose_name_plural = 'pages'

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        return reverse('page_detail', kwargs={'pk': self.pk})

    def follower_count(self):
        return self.followers.count()


class PagePost(models.Model):
    """Publication faite sur une page (par son propriétaire)."""

    page = models.ForeignKey(Page, on_delete=models.CASCADE, related_name='posts')
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='page_posts',
    )
    content = models.TextField(verbose_name='Contenu')
    image = models.ImageField(upload_to='page_posts/', blank=True, verbose_name='Image')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'publication de page'
        verbose_name_plural = 'publications de page'

    def __str__(self):
        return f'{self.author.username} → {self.page.name}: {self.content[:50]}'
