from django import template
from posts.models import Bookmark, Like

register = template.Library()


@register.filter
def get_user_reaction(post, user):
    """Retourne la réaction de l'utilisateur sur un post, ou None."""
    if not user or not user.is_authenticated:
        return None
    try:
        return Like.objects.get(post=post, user=user)
    except Like.DoesNotExist:
        return None


@register.filter
def get_unique_reactions(post):
    """Retourne les types de réactions uniques sur un post avec emoji et label."""
    reaction_types = (
        Like.objects
        .filter(post=post)
        .values_list('reaction_type', flat=True)
        .distinct()
    )
    result = []
    for rt in reaction_types:
        display = dict(Like.ReactionType.choices).get(rt, rt)
        emoji = Like.REACTION_EMOJIS.get(rt, '👍')
        result.append((rt, display, emoji))
    return result


@register.filter
def is_bookmarked(post, user):
    """Retourne True si l'utilisateur a enregistré ce post."""
    if not user or not user.is_authenticated:
        return False
    return Bookmark.objects.filter(user=user, post=post).exists()
