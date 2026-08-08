from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'

    def ready(self):
        # Importe le module de signaux pour que la création automatique
        # du profil soit enregistrée dès le chargement de l'app.
        import accounts.signals  # noqa: F401
