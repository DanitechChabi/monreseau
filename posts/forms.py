from django import forms

from .models import Comment, Post


class PostForm(forms.ModelForm):
    """Formulaire de publication (texte + image)."""

    class Meta:
        model = Post
        fields = ['content', 'image']
        widgets = {
            'content': forms.Textarea(attrs={'rows': 3, 'placeholder': 'Quoi de neuf ?'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            field.widget.attrs['class'] = 'form-control'


class CommentForm(forms.ModelForm):
    """Formulaire de commentaire (texte ou audio)."""

    class Meta:
        model = Comment
        fields = ['content', 'audio']
        widgets = {
            'content': forms.Textarea(attrs={
                'rows': 2,
                'placeholder': 'Écrire un commentaire…',
            }),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            field.widget.attrs['class'] = 'form-control'
