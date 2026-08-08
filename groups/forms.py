from django import forms

from .models import Group


class GroupForm(forms.ModelForm):
    """Formulaire de création / modification d'un groupe."""

    class Meta:
        model = Group
        fields = ['name', 'description', 'image']
        widgets = {
            'description': forms.Textarea(attrs={'rows': 3}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields.values():
            field.widget.attrs['class'] = 'form-control'
