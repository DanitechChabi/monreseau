from django.contrib.auth import get_user_model
from django.test import TestCase

from .models import Friendship

User = get_user_model()


class FriendshipModelTests(TestCase):
    def setUp(self):
        self.a = User.objects.create_user(username='alice', password='x')
        self.b = User.objects.create_user(username='bob', password='x')
        self.c = User.objects.create_user(username='charlie', password='x')

    def test_friend_ids_union_both_directions(self):
        """friend_ids() couvre les deux sens (from→to et to→from)."""
        Friendship.objects.create(from_user=self.a, to_user=self.b, status=Friendship.Status.ACCEPTED)
        Friendship.objects.create(from_user=self.c, to_user=self.a, status=Friendship.Status.ACCEPTED)
        self.assertEqual(Friendship.friend_ids(self.a), {self.b.pk, self.c.pk})

    def test_pending_requests_not_friends(self):
        """Une demande en attente ne fait pas encore de deux personnes des amis."""
        Friendship.objects.create(from_user=self.a, to_user=self.b)
        self.assertFalse(Friendship.are_friends(self.a, self.b))

    def test_accept_makes_friends(self):
        """Après acceptation, a et b sont amis (dans les deux sens)."""
        rel = Friendship.objects.create(from_user=self.a, to_user=self.b)
        rel.status = Friendship.Status.ACCEPTED
        rel.save()
        self.assertTrue(Friendship.are_friends(self.a, self.b))
        self.assertTrue(Friendship.are_friends(self.b, self.a))

    def test_friendship_between_detects_reverse(self):
        """friendship_between() trouve la relation dans l'un OU l'autre sens."""
        Friendship.objects.create(from_user=self.b, to_user=self.a)
        self.assertIsNotNone(Friendship.friendship_between(self.a, self.b))
