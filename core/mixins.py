from django.contrib.auth.mixins import UserPassesTestMixin


class OwnerRequiredMixin(UserPassesTestMixin):
    """Réserve une vue au propriétaire de l'objet.

    Le champ propriétaire s'appelle `author` par défaut ; les modèles dont le
    propriétaire a un autre nom (`creator`, `owner`…) peuvent surcharger
    `owner_field`.
    """

    owner_field = 'author'

    def test_func(self):
        obj = self.get_object()
        owner = getattr(obj, self.owner_field, None)
        if owner is None:
            return False
        return owner == self.request.user
