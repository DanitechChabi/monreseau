"""Configuration des URLs racine du projet social_network."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('core.urls')),
    path('accounts/', include('accounts.urls')),
    path('friends/', include('friends.urls')),
    path('posts/', include('posts.urls')),
    path('notifications/', include('notifications.urls')),
    path('messages/', include('messaging.urls')),
    path('groups/', include('groups.urls')),
    path('pages/', include('pages.urls')),
]

# En développement, Django sert lui-même les fichiers téléversés (/media/).
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
