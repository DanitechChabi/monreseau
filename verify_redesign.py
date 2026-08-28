"""Chargement + rendu de tous les templates (vérification rapide)."""
import os
import glob

import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'social_network.settings.dev')
django.setup()

from django.test import Client
from django.contrib.auth import get_user_model
from django.template.loader import get_template
from groups.models import Group
from pages.models import Page
from posts.models import Post

BASES = [
    'templates/', 'accounts/templates/', 'core/templates/',
    'friends/templates/', 'posts/templates/', 'groups/templates/',
    'pages/templates/', 'messaging/templates/', 'notifications/templates/',
]


def rel_name(path):
    norm = path.replace('\\', '/')
    for base in BASES:
        if norm.startswith(base):
            return norm[len(base):]
    return None


print('== Chargement de tous les templates ==')
errors = 0
for path in sorted(set(glob.glob('templates/*.html') + glob.glob('*/templates/**/*.html', recursive=True))):
    rel = rel_name(path)
    if rel is None:
        continue
    try:
        get_template(rel)
        print('  OK', rel)
    except Exception as exc:
        errors += 1
        print('  ERR LOAD', rel, '->', exc)

print('\n== Rendu des pages (login requises) ==')
User = get_user_model()
u = User.objects.get(username='testuser')
c = Client()
c.force_login(u)
g = Group.objects.first()
p = Page.objects.first()
post = Post.objects.first()
urls = [
    '/', '/search/?q=test',
    '/accounts/u/testuser/', '/accounts/u/testuser/edit/',
    '/friends/', '/friends/requests/', '/friends/suggestions/',
    '/notifications/', '/messages/', '/groups/', '/pages/',
]
if g:
    urls += [f'/groups/{g.pk}/', f'/groups/{g.pk}/edit/', '/groups/create/']
if p:
    urls += [f'/pages/{p.pk}/', f'/pages/{p.pk}/edit/', '/pages/create/']
if post:
    urls += [f'/posts/{post.pk}/', '/posts/create/']
for url in urls:
    try:
        r = c.get(url)
        status = 'OK' if r.status_code == 200 else f'HTTP {r.status_code}'
        print(f'  {status}  {url}')
    except Exception as exc:
        errors += 1
        print(f'  ERR RENDER {url} -> {type(exc).__name__}: {exc}')

print(f'\n== Total erreurs : {errors} ==')
