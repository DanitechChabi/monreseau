from django import forms

from .models import Message


class MessageForm(forms.ModelForm):
    """Formulaire d'envoi de message (texte ou audio)."""

    class Meta:
        model = Message
        fields = ['body', 'audio']
        widgets = {
            'body': forms.Textarea(attrs={
                'rows': 2,
                'placeholder': 'Écrire un message…',
                'class': 'form-control',
            }),
        }
        labels = {'body': ''}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
