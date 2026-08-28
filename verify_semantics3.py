import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'social_network.settings.dev')
django.setup()

from accounts.models import User
from posts.models import Post, Like, Comment
from django.template import Template, Context

users = list(User.objects.all()[:3])
post = Post.objects.first()

# The bug: user in post.likes.all() compares User vs Like objects
t = Template("{% if user in post.likes.all %}LIKED{% else %}NOT_LIKED{% endif %}")
c = Context({'user': users[0], 'post': post})
print("Template result (should be LIKED):", t.render(c))

# Check if comment_count uses .count properly
print("post.comments.count:", post.comments.count())
t2 = Template("{{ post.comments.count }}")
c2 = Context({'post': post})
print("Template count:", t2.render(c2))
