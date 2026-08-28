import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'social_network.settings.dev')
django.setup()

from accounts.models import User
from posts.models import Post, Like, Comment
users = list(User.objects.all()[:3])
post = Post.objects.first()
print("likes:", post.likes.all())
print("like object:", post.likes.all()[0] if post.likes.all() else None)
print("user:", users[0])
print("like.user:", post.likes.all()[0].user if post.likes.all() else None)
print("Correct check:", users[0].id in post.likes.values_list('user_id', flat=True))