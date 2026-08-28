"""
Configuration partagée du projet social_network.

Les réglages spécifiques à l'environnement (DEBUG, SECRET_KEY, ALLOWED_HOSTS…)
vivent dans `dev.py` / `prod.py`. On pointe vers eux via `DJANGO_SETTINGS_MODULE`.
"""
from pathlib import Path

# Base paths
# base.py est dans social_network/settings/ -> BASE_DIR remonte de 3 niveaux
BASE_DIR = Path(__file__).resolve().parent.parent.parent


# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Apps locales
    'core',
    'accounts',
    'friends',
    'posts',
    'notifications',
    'messaging',
    'groups',
    'pages',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.locale.LocaleMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    # Applique la langue d'interface choisie dans le profil (si connecté).
    'core.middleware.ProfileLanguageMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'social_network.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                # Badges non-lus (notifications + messages) affichés dans la navbar
                'core.context_processors.unread_counts',
                # Contacts + suggestions pour la colonne droite (façon Facebook)
                'core.context_processors.sidebar_data',
            ],
        },
    },
]

WSGI_APPLICATION = 'social_network.wsgi.application'


# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}


# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]


# Internationalization
LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Langues disponibles. `fr` est la langue source ; fon et yor ont une
# interface (partiellement) traduite ; les autres langues béninoises servent
# de « profil » (choix des langues parlées) et retombent sur le français.
LANGUAGES = [
    ('fr', 'Français'),
    ('fon', 'Fɔ̀ngbè'),
    ('yor', 'Yorùbá'),
    ('ajg', 'Adja'),
    ('guw', 'Goun'),
    ('bba', 'Bariba'),
    ('ddn', 'Dendi'),
    ('gej', 'Gen (Mina)'),
    ('fue', 'Peul'),
    ('tbz', 'Ditammari'),
    ('wwa', 'Waama'),
    ('pil', 'Yom'),
    ('dop', 'Lokpa'),
    ('ayb', 'Ayizo'),
    ('ife', 'Ifè'),
    ('mkl', 'Mokole'),
    ('xna', 'Nago'),
    ('blo', 'Anii'),
    ('bqc', 'Boko'),
    ('xwl', 'Xwla'),
    ('xwe', 'Xweda'),
    ('kqk', 'Kotafon'),
    ('tfi', 'Tofin'),
    ('cbe', 'Cabe'),
    ('kbp', 'Kabiyé'),
    ('sxw', 'Saxwe'),
]

# Fichiers de traduction (locale/<code>/LC_MESSAGES/django.po + .mo)
LOCALE_PATHS = [BASE_DIR / 'locale']


# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATICFILES_DIRS = [BASE_DIR / 'static']

# Fichiers téléversés (avatars, covers, images de posts…)
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# Authentification
# Modèle utilisateur personnalisé -> DOIT être défini avant la première migration.
AUTH_USER_MODEL = 'accounts.User'

LOGIN_URL = 'login'
LOGIN_REDIRECT_URL = 'home'
LOGOUT_REDIRECT_URL = 'home'


# Email (console en dev, aucune vraie notification par e-mail pour l'instant)
MAILERS = {
    'default': {
        'BACKEND': 'django.core.mail.backends.console.EmailBackend',
    },
}
