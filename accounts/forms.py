from django import forms
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm

from core.models import Language
from .models import Profile, User


def _active_languages():
    return Language.objects.filter(is_active=True)


def _languages_field():
    """Champ « langues parlées » (cases à cocher), réutilisé partout."""
    return forms.ModelMultipleChoiceField(
        queryset=_active_languages(),
        widget=forms.CheckboxSelectMultiple,
        required=False,
        label='Langues parlées',
        help_text='Choisis les langues béninoises que tu parles (Fon, Yoruba, Adja…).',
    )


def _add_bootstrap_classes(fields):
    """Ajoute les classes Bootstrap selon le type de widget.

    Les widgets texte reçoivent ``form-control`` ; les cases à cocher
    ``form-check-input`` (sinon ``form-control`` casse leur affichage).
    """
    text_widgets = (
        forms.TextInput, forms.EmailInput, forms.URLInput, forms.NumberInput,
        forms.PasswordInput, forms.DateInput, forms.DateTimeInput, forms.TimeInput,
        forms.Textarea, forms.Select, forms.SelectMultiple, forms.FileInput,
        forms.ClearableFileInput,
    )
    for field in fields.values():
        widget = field.widget
        if isinstance(widget, forms.CheckboxSelectMultiple):
            widget.attrs['class'] = 'form-check-input'
        elif isinstance(widget, forms.RadioSelect):
            widget.attrs['class'] = 'form-check-input'
        else:
            widget.attrs['class'] = 'form-control'


class UserRegisterForm(UserCreationForm):
    """Formulaire d'inscription : identifiants + infos du compte + langues."""

    email = forms.EmailField(required=True, label='Adresse e-mail')
    first_name = forms.CharField(max_length=150, required=False, label='Prénom')
    last_name = forms.CharField(max_length=150, required=False, label='Nom')
    languages = _languages_field()

    class Meta:
        model = User
        fields = ['username', 'first_name', 'last_name', 'email']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        _add_bootstrap_classes(self.fields)


class LoginForm(AuthenticationForm):
    """Connexion avec les classes Bootstrap."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        _add_bootstrap_classes(self.fields)


class UserUpdateForm(forms.ModelForm):
    """Modification des informations du compte."""

    email = forms.EmailField(required=True, label='Adresse e-mail')

    class Meta:
        model = User
        fields = ['username', 'first_name', 'last_name', 'email']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        _add_bootstrap_classes(self.fields)


class ProfileUpdateForm(forms.ModelForm):
    """Modification des informations publiques du profil."""

    languages = _languages_field()
    ui_language = forms.ModelChoiceField(
        queryset=_active_languages(),
        required=False,
        label='Langue de l’interface',
        help_text='Langue utilisée pour afficher le site (vide = français).',
    )

    class Meta:
        model = Profile
        fields = [
            'avatar', 'cover', 'bio', 'birth_date', 'location',
            'languages', 'ui_language',
        ]
        widgets = {
            'bio': forms.Textarea(attrs={'rows': 3}),
            'birth_date': forms.DateInput(attrs={'type': 'date'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        _add_bootstrap_classes(self.fields)
