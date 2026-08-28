"""
Réglages de production — utilisés par Render via
DJANGO_SETTINGS_MODULE=social_network.settings.prod.
"""
import os

import dj_database_url

from .base import *  # noqa: F401,F403
from .base import BASE_DIR, MIDDLEWARE

# --- Sécurité ---
# SECRET_KEY fourni par Render (envVars: generateValue dans render.yaml).
# Jamais de clé en dur ici.
SECRET_KEY = os.environ['SECRET_KEY']

DEBUG = False

RENDER_HOST = os.environ.get('RENDER_EXTERNAL_HOSTNAME', '')
ALLOWED_HOSTS = [
    h for h in ([RENDER_HOST, 'localhost', '127.0.0.1']
                + os.environ.get('ALLOWED_HOSTS', '').split(','))
    if h
]

# --- Base de données PostgreSQL ---
# DATABASE_URL est injectée par Render (render.yaml -> fromDatabase).
DATABASES = {
    'default': dj_database_url.config(conn_max_age=600, conn_health_checks=True)
}

# --- Fichiers statiques (Whitenoise) ---
STATIC_ROOT = BASE_DIR / 'staticfiles'

STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        # Compression + en-têtes de cache SANS renommage par hash : le PWA
        # référence des chemins bruts (/static/sw.js, icônes du manifest…),
        # qui casseraient avec CompressedManifestStaticFilesStorage.
        'BACKEND': 'whitenoise.storage.CompressedStaticFilesStorage',
    },
}

# Whitenoise doit servir les statiques avant tout autre middleware.
MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')

# --- HTTPS / proxy Render ---
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000  # 1 an
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

if RENDER_HOST:
    CSRF_TRUSTED_ORIGINS = [f'https://{RENDER_HOST}']

# --- Fichiers téléversés (media) ---
# Sur le tier gratuit de Render, le disque est éphémère : les uploads sont
# perdus à chaque redéploiement/restart. À terme : brancher Cloudinary / S3 / R2
# comme DEFAULT_FILE_STORAGE pour des fichiers durables.
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
