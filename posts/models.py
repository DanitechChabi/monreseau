from django.conf import settings
from django.db import models
from django.urls import reverse
from django.utils import timezone


class PostQuerySet(models.QuerySet):
    """Queryset personnalisé pour les publications."""

    def feed_for(self, user):
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


class Bookmark(models.Model):
    """Post sauvegardé / enregistré par un utilisateur."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='bookmarks',
    )
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='bookmarks')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'post'], name='unique_bookmark'),
        ]
        verbose_name = 'bookmark'
        verbose_name_plural = 'bookmarks'

    def __str__(self):
        return f'{self.user.username} enregistre le post #{self.post_id}'


class Like(models.Model):
    """Réaction sur une publication (un utilisateur, une réaction à la fois)."""

    class ReactionType(models.TextChoices):
        LIKE = 'like', 'J\'aime'
        LOVE = 'love', 'Adore'
        CELEBRATE = 'celebrate', 'Féliciter'
        FUNNY = 'funny', 'Réjouir'
        INSIGHTFUL = 'insightful', 'Inspirant'
        SUPPORT = 'support', 'Soutenir'

    REACTION_EMOJIS = {
        'like': '👍',
        'love': '❤️',
        'celebrate': '🎉',
        'funny': '😊',
        'insightful': '💡',
        'support': '🤝',
    }

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='likes')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='likes',
    )
    reaction_type = models.CharField(
        max_length=12,
        choices=ReactionType.choices,
        default=ReactionType.LIKE,
        verbose_name='Réaction',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['post', 'user'], name='unique_post_like'),
        ]
        verbose_name = 'réaction'
        verbose_name_plural = 'réactions'

    def __str__(self):
        return f'{self.user.username} réagit "{self.get_reaction_type_display()}" au post #{self.post_id}'

    @property
    def emoji(self):
        return self.REACTION_EMOJIS.get(self.reaction_type, '👍')


class Comment(models.Model):
    """Commentaire sous une publication."""

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='comments',
    )
    content = models.TextField(blank=True, verbose_name='Commentaire')
    audio = models.FileField(
        upload_to='comments/audio/%Y/%m/',
        blank=True,
        verbose_name='Message audio',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = 'commentaire'
        verbose_name_plural = 'commentaires'

    def __str__(self):
        return f'{self.author.username}: {self.content[:50]}'


class Story(models.Model):
    """Story éphémère (expirée après 24h)."""

    class StoryType(models.TextChoices):
        IMAGE = 'image', 'Image'
        VIDEO = 'video', 'Vidéo'
        TEXT = 'text', 'Texte'
        AUDIO = 'audio', 'Audio'

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='stories',
    )
    story_type = models.CharField(
        max_length=6,
        choices=StoryType.choices,
        default=StoryType.IMAGE,
    )
    content = models.TextField(blank=True, verbose_name='Texte')
    image = models.ImageField(upload_to='stories/%Y/%m/%d/', blank=True, verbose_name='Image')
    video = models.FileField(upload_to='stories/video/%Y/%m/%d/', blank=True, verbose_name='Vidéo')
    audio = models.FileField(upload_to='stories/audio/%Y/%m/%d/', blank=True, verbose_name='Audio')
    bg_color = models.CharField(max_length=7, default='#D4A017', verbose_name='Couleur de fond')
    views = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='viewed_stories',
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(verbose_name='Expire le')

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'story'
        verbose_name_plural = 'stories'

    def __str__(self):
        return f'Story de {self.author.username} ({self.created_at:%d/%m %H:%M})'

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timezone.timedelta(hours=24)
        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    @property
    def view_count(self):
        return self.views.count()

    @property
    def time_remaining(self):
        delta = self.expires_at - timezone.now()
        if delta.total_seconds() <= 0:
            return 'Expirée'
        hours = int(delta.total_seconds() // 3600)
        minutes = int((delta.total_seconds() % 3600) // 60)
        return f'{hours}h {minutes}m'


class Poll(models.Model):
    """Sondage dans une publication."""

    post = models.OneToOneField(Post, on_delete=models.CASCADE, related_name='poll')
    question = models.CharField(max_length=200, verbose_name='Question')
    ends_at = models.DateTimeField(null=True, blank=True, verbose_name='Se termine le')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'sondage'
        verbose_name_plural = 'sondages'

    def __str__(self):
        return f'Sondage: {self.question[:50]}'

    @property
    def total_votes(self):
        return sum(opt.votes.count() for opt in self.options.all())

    @property
    def is_active(self):
        if self.ends_at is None:
            return True
        return timezone.now() < self.ends_at


class PollOption(models.Model):
    """Option d'un sondage."""

    poll = models.ForeignKey(Poll, on_delete=models.CASCADE, related_name='options')
    text = models.CharField(max_length=200, verbose_name='Option')
    votes = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='poll_votes',
        blank=True,
    )

    class Meta:
        verbose_name = 'option de sondage'
        verbose_name_plural = 'options de sondage'

    def __str__(self):
        return f'{self.text} ({self.votes.count()} votes)'

    @property
    def vote_count(self):
        return self.votes.count()

    def vote_percentage(self):
        total = self.poll.total_votes
        if total == 0:
            return 0
        return round((self.votes.count() / total) * 100)


class Block(models.Model):
    """Blocage d'un utilisateur."""

    blocker = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='blocking',
    )
    blocked = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='blocked_by',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['blocker', 'blocked'], name='unique_block'),
        ]
        verbose_name = 'blocage'
        verbose_name_plural = 'blocages'

    def __str__(self):
        return f'{self.blocker.username} bloque {self.blocked.username}'


class Report(models.Model):
    """Signalement d'un contenu."""

    class Reason(models.TextChoices):
        SPAM = 'spam', 'Spam'
        HARASSMENT = 'harassment', 'Harcèlement'
        HATE = 'hate', 'Discours de haine'
        VIOLENCE = 'violence', 'Violence'
        NUDITY = 'nudity', 'Nudité'
        OTHER = 'other', 'Autre'

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reports_made',
    )
    post = models.ForeignKey(
        Post, on_delete=models.CASCADE, null=True, blank=True, related_name='reports',
    )
    reason = models.CharField(max_length=12, choices=Reason.choices)
    description = models.TextField(blank=True, verbose_name='Description')
    created_at = models.DateTimeField(auto_now_add=True)
    resolved = models.BooleanField(default=False, verbose_name='Résolu')

    class Meta:
        verbose_name = 'signalement'
        verbose_name_plural = 'signalements'

    def __str__(self):
        return f'{self.reporter.username} signale {self.get_reason_display()}'


class OnlineStatus(models.Model):
    """Statut en ligne d'un utilisateur (heartbeat)."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='online_status',
    )
    last_seen = models.DateTimeField(auto_now=True)
    is_online = models.BooleanField(default=False)

    class Meta:
        verbose_name = 'statut en ligne'
        verbose_name_plural = 'statuts en ligne'

    def __str__(self):
        return f'{self.user.username} — {"en ligne" if self.is_online else "hors ligne"}'

    @property
    def status_text(self):
        if self.is_online:
            return 'En ligne'
        delta = timezone.now() - self.last_seen
        if delta.total_seconds() < 300:
            return 'Actif il y a quelques instants'
        elif delta.total_seconds() < 3600:
            return f'Actif il y a {int(delta.total_seconds() // 60)} min'
        elif delta.total_seconds() < 86400:
            return f'Actif il y a {int(delta.total_seconds() // 3600)} h'
        return f'Actif il y a {int(delta.total_seconds() // 86400)} j'


class TypingIndicator(models.Model):
    """Indicateur de frappe dans une conversation."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='typing_indicators',
    )
    conversation = models.ForeignKey(
        'messaging.Conversation',
        on_delete=models.CASCADE,
        related_name='typing_indicators',
    )
    last_typed = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'indicateur de frappe'
        verbose_name_plural = 'indicateurs de frappe'

    def __str__(self):
        return f'{self.user.username} écrit dans la conversation #{self.conversation_id}'
