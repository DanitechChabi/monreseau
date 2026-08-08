from django import forms

from .models import Message


class MessageForm(forms.ModelForm):
    """Formulaire d'envoi d'un message."""

    class Meta:
        model = Message
        fields = ['body']
        widgets = {
            'body': forms.Textarea(attrs={'rows': 2, 'placeholder': 'Écrire un message…'}),
        }
        labels = {'body': ''}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['body'].widget.attrs['class'] = 'form-control'
