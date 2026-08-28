import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'social_network.settings.dev')
django.setup()

from accounts.models import User
from posts.models import Post, Like, Comment
from django.template import Template, Context

users = list(User.objects.all()[:3])
post = Post.objects.first()

# Check how post.comments.count works in template
t = Template("{% if user in post.likes.all %}LIKED{% else %}NOT{% endif %} | {{ post.comments.count }}")
c = Context({'user': users[0], 'post': post})
print("Template:", t.render(c))

# Also check conversation_list template logic
# {% with last=c.messages.last %} - is .last a property or method?
from messaging.models import Conversation, Message
conv = Conversation.objects.first()
if conv:
    print("conv.messages.last:", conv.messages.last())
    print("type of .last:", type(conv.messages.last))
else:
    print("no conversations")

# Check is_paginated context variable in home template
print("is_paginated comes from ListView context")