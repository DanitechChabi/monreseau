from django.utils import translation


class ProfileLanguageMiddleware:
    """Applique la langue d'interface choisie dans le profil de l'utilisateur.

    À placer après ``AuthenticationMiddleware`` : pour tout utilisateur
    connecté, active la langue stockée dans ``Profile.ui_language`` (le
    sélecteur de langue et l'inscription la tiennent à jour). Les utilisateurs
    anonymes utilisent la logique habituelle de ``LocaleMiddleware``.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, 'user', None)
        if user is not None and user.is_authenticated:
            try:
                ui_language = user.profile.ui_language
            except Exception:
                ui_language = None
            if ui_language is not None and ui_language.is_active:
                translation.activate(ui_language.code)
        return self.get_response(request)
