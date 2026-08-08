"""
Réglages de développement — à utiliser via DJANGO_SETTINGS_MODULE=social_network.settings.dev
"""
from .base import *

# SECURITY WARNING: à remplacer en production !
SECRET_KEY = 'django-insecure-dev-only-key-not-for-production'

DEBUG = True

ALLOWED_HOSTS = ['127.0.0.1', 'localhost', 'testserver']
