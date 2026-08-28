import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'social_network.settings.dev')
django.setup()

from accounts.models import User
from posts.models import Post, Like, Comment
from django.template import Template, Context

users = list(User.objects.all()[:3])
post = Post.objects.first()

# Check post.likes.count and post.comments.count
t = Template("likes={{ post.likes.count }} comments={{ post.comments.count }}")
c = Context({'post': post})
print("Template:", t.render(c))

# Also check request.user in post.likes.all with correct logic
# Should be: request.user.id in post.likes.values_list('user_id', flat=True)
# Or better: post.likes.filter(user=request.user).exists()

# What about post.comments.count - is it a method or property?
print("post.comments.count:", post.comments.count)
print("type:", type(post.comments.count))
