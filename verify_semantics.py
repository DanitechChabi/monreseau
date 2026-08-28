import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'social_network.settings.dev')
django.setup()

from accounts.models import User
from posts.models import Post, Like, Comment
from django.test import RequestFactory
from django.contrib.auth.models import AnonymousUser

rf = RequestFactory()
request = rf.get('/')
request.user = AnonymousUser()

users = list(User.objects.all()[:3])
print("users:", [u.username for u in users])
post = Post.objects.first()
if post is None:
    print("no posts; creating one")
    post = Post.objects.create(author=users[0], content="test")
likes_qs = post.likes.all()
print("likes count:", likes_qs.count())

# Make users[0] like the post
Like.objects.get_or_create(post=post, user=users[0])
print("likes count after like:", post.likes.all().count())

liker = users[0]
print("liker in post.likes.all() (python `in`):", liker in post.likes.all())
print("liker == like (each):", [liker == l for l in post.likes.all()])

from django.template import Template, Context
t = Template("{% if user in post.likes.all %}LIKED{% else %}NOT_LIKED{% endif %}")
c = Context({'user': liker, 'post': post})
print("template result:", t.render(c))
