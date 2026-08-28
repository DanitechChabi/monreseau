from django.db import models
from django.utils.translation import gettext_lazy as _


class Language(models.Model):
    """Langue parlée au Bénin (Fon, Yoruba, Adja, Bariba…).

    ``code`` est un code ISO 639-3 et sert aussi de code locale Django pour les
    langues dont l'interface est traduite (``fon``, ``yor``…).
    """

    code = models.CharField(
        max_length=8,
        unique=True,
        verbose_name=_('Code ISO'),
        help_text=_('Code ISO 639-3 (ex. fon, yor)'),
    )
    name = models.CharField(max_length=100, verbose_name=_('Nom'))
    name_native = models.CharField(
        max_length=100, blank=True, verbose_name=_('Nom d’origine')
    )
    is_active = models.BooleanField(default=True, verbose_name=_('Active'))
    is_ui_available = models.BooleanField(
        default=False,
        verbose_name=_('Interface traduite'),
        help_text=_("Vrai si l'interface du site existe dans cette langue."),
    )

    class Meta:
        ordering = ['name']
        verbose_name = _('Langue')
        verbose_name_plural = _('Langues')

    def __str__(self):
        return self.name_native or self.name
