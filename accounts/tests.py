from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from core.models import Language

from .models import Profile

User = get_user_model()


class AccountTests(TestCase):
    def test_registration_creates_profile(self):
        """S'inscrire crée l'utilisateur ET son profil automatiquement."""
        client = Client()
        response = client.post(reverse('register'), {
            'username': 'alice',
            'email': 'alice@example.com',
            'password1': 'Motdepasse!123',
            'password2': 'Motdepasse!123',
        })
        self.assertEqual(response.status_code, 302)
        alice = User.objects.get(username='alice')
        self.assertTrue(Profile.objects.filter(user=alice).exists())

    def test_registration_logs_in(self):
        """Après l'inscription, l'utilisateur est connecté."""
        client = Client()
        client.post(reverse('register'), {
            'username': 'bob',
            'email': 'bob@example.com',
            'password1': 'Motdepasse!123',
            'password2': 'Motdepasse!123',
        })
        self.assertIn('_auth_user_id', client.session)

    def test_login_required_for_private_pages(self):
        """Les pages privées redirigent vers la connexion."""
        response = self.client.get(reverse('home'))
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse('login'), response.url)

    def test_profile_edit_updates(self):
        """Modifier son profil met à jour les données."""
        alice = User.objects.create_user(username='alice', password='x')
        client = Client()
        client.force_login(alice)
        response = client.post(reverse('edit_profile', kwargs={'username': alice.username}), {
            'username': 'alice',
            'email': 'alice@example.com',
            'bio': 'Je code en Django',
            'location': 'Paris',
        })
        self.assertEqual(response.status_code, 302)
        alice.profile.refresh_from_db()
        self.assertEqual(alice.profile.bio, 'Je code en Django')
        self.assertEqual(alice.profile.location, 'Paris')

    def test_profile_page_renders(self):
        """La page de profil répond correctement."""
        alice = User.objects.create_user(username='alice', password='x')
        client = Client()
        client.force_login(alice)
        response = client.get(reverse('profile', kwargs={'username': 'alice'}))
        self.assertEqual(response.status_code, 200)


class LanguageTests(TestCase):
    """Les langues béninoises sont seedées, choisies à l'inscription, modifiables."""

    def test_languages_seeded(self):
        """La data migration a seedé les principales langues béninoises."""
        for code in ['fon', 'yor', 'ajg', 'bba', 'ddn']:
            self.assertTrue(Language.objects.filter(code=code).exists(), code)
        # Seules fon et yor ont une interface traduite.
        ui_codes = set(Language.objects.filter(is_ui_available=True).values_list('code', flat=True))
        self.assertEqual(ui_codes, {'fon', 'yor'})

    def test_registration_saves_languages(self):
        """S'inscrire avec des langues les enregistre sur le profil."""
        fon = Language.objects.get(code='fon')
        yor = Language.objects.get(code='yor')
        client = Client()
        response = client.post(reverse('register'), {
            'username': 'koffi',
            'email': 'koffi@example.com',
            'password1': 'Motdepasse!123',
            'password2': 'Motdepasse!123',
            'languages': [fon.id, yor.id],
        })
        self.assertEqual(response.status_code, 302)
        koffi = User.objects.get(username='koffi')
        self.assertEqual(set(koffi.profile.languages.values_list('code', flat=True)), {'fon', 'yor'})

    def test_registration_sets_ui_language_from_first_available(self):
        """Une langue traduite choisie devient la langue d'interface par défaut."""
        fon = Language.objects.get(code='fon')
        client = Client()
        client.post(reverse('register'), {
            'username': 'gbede',
            'email': 'gbede@example.com',
            'password1': 'Motdepasse!123',
            'password2': 'Motdepasse!123',
            'languages': [fon.id],
        })
        gbede = User.objects.get(username='gbede')
        self.assertEqual(gbede.profile.ui_language.code, 'fon')

    def test_edit_profile_updates_languages(self):
        """Modifier son profil met à jour les langues parlées."""
        alice = User.objects.create_user(username='alice', password='x')
        fon = Language.objects.get(code='fon')
        yor = Language.objects.get(code='yor')
        client = Client()
        client.force_login(alice)
        response = client.post(reverse('edit_profile', kwargs={'username': 'alice'}), {
            'username': 'alice',
            'email': 'alice@example.com',
            'languages': [fon.id, yor.id],
        })
        self.assertEqual(response.status_code, 302)
        alice.profile.refresh_from_db()
        self.assertEqual(set(alice.profile.languages.values_list('code', flat=True)), {'fon', 'yor'})

    def test_language_switcher_persists_ui_language(self):
        """Changer la langue met à jour le cookie et le profil."""
        alice = User.objects.create_user(username='alice', password='x')
        client = Client()
        client.force_login(alice)
        response = client.post(reverse('set_language'), {'language': 'yor'})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(client.cookies['django_language'].value, 'yor')
        alice.profile.refresh_from_db()
        self.assertEqual(alice.profile.ui_language.code, 'yor')
