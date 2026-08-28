# Généré à la main : seed des langues béninoises (idempotent).

from django.db import migrations

# (code ISO 639-3, nom français, nom d'origine, interface traduite ?)
LANGUAGES = [
    ('fon', 'Fon', 'Fɔ̀ngbè', True),
    ('yor', 'Yoruba', 'Yorùbá', True),
    ('ajg', 'Adja', 'Aja-gbè', False),
    ('guw', 'Goun', 'Gungbe', False),
    ('bba', 'Bariba', 'Baatɔnum', False),
    ('ddn', 'Dendi', 'Dandawa', False),
    ('gej', 'Gen (Mina)', 'Gɛngbe', False),
    ('fue', 'Peul', 'Fulfulde', False),
    ('tbz', 'Ditammari', 'Ditammari', False),
    ('wwa', 'Waama', 'Waama', False),
    ('pil', 'Yom', 'Pila-Pila', False),
    ('dop', 'Lokpa', 'Lukpa', False),
    ('ayb', 'Ayizo', 'Ayizo-gbe', False),
    ('ife', 'Ifè', 'Ifè', False),
    ('mkl', 'Mokole', 'Mokole', False),
    ('xna', 'Nago', 'Nago', False),
    ('blo', 'Anii', 'Anii', False),
    ('bqc', 'Boko', 'Boko', False),
    ('xwl', 'Xwla', 'Xwlagbe', False),
    ('xwe', 'Xweda', 'Xwedagbe', False),
    ('kqk', 'Kotafon', 'Kɔtagbe', False),
    ('tfi', 'Tofin', 'Tofingbe', False),
    ('cbe', 'Cabe', 'Cabe', False),
    ('kbp', 'Kabiyé', 'Kabɩyɛ', False),
    ('sxw', 'Saxwe', 'Saxwe-gbe', False),
]


def seed_languages(apps, schema_editor):
    Language = apps.get_model('core', 'Language')
    for code, name, name_native, is_ui in LANGUAGES:
        Language.objects.update_or_create(
            code=code,
            defaults={
                'name': name,
                'name_native': name_native,
                'is_ui_available': is_ui,
                'is_active': True,
            },
        )


def unseed_languages(apps, schema_editor):
    Language = apps.get_model('core', 'Language')
    Language.objects.filter(code__in=[row[0] for row in LANGUAGES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_languages, unseed_languages),
    ]
