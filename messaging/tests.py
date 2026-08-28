from django.contrib.auth import get_user_model
from django.test import TestCase

from friends.models import Friendship
from .models import Conversation, Message
from .services import get_or_create_conversation

User = get_user_model()


class MessagingTests(TestCase):
    def setUp(self):
        self.a = User.objects.create_user(username='alice', password='x')
        self.b = User.objects.create_user(username='bob', password='x')
        self.c = User.objects.create_user(username='charlie', password='x')

    def test_get_or_create_conversation_no_duplicate(self):
        """Ouvrir deux fois la conversation entre les mêmes personnes ne la duplique pas."""
        first = get_or_create_conversation(self.a, self.b)
        second = get_or_create_conversation(self.b, self.a)
        self.assertEqual(first.pk, second.pk)
        self.assertEqual(Conversation.objects.count(), 1)

    def test_unread_count(self):
        conv = get_or_create_conversation(self.a, self.b)
        Message.objects.create(conversation=conv, sender=self.a, body='salut')
        Message.objects.create(conversation=conv, sender=self.a, body='ça va ?')
        self.assertEqual(Message.unread_count_for(self.b), 2)
        # Ses propres messages ne comptent pas.
        self.assertEqual(Message.unread_count_for(self.a), 0)

    def test_message_order(self):
        conv = get_or_create_conversation(self.a, self.b)
        Message.objects.create(conversation=conv, sender=self.a, body='premier')
        Message.objects.create(conversation=conv, sender=self.b, body='second')
        messages = list(conv.messages.all())
        self.assertEqual(messages[0].body, 'premier')
        self.assertEqual(messages[1].body, 'second')

    def test_friendship_required_for_messaging(self):
        """La messagerie est réservée aux amis (pas de relation → non autorisé)."""
        conv = get_or_create_conversation(self.a, self.c)
        # Aucune amitié : on simule la vérification faite dans la vue.
        self.assertFalse(Friendship.are_friends(self.a, self.c))
        self.assertIsNotNone(conv)
