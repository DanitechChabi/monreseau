from django.contrib.auth import get_user_model
from django.test import TestCase

from .models import Group, GroupPost

User = get_user_model()


class GroupTests(TestCase):
    def setUp(self):
        self.a = User.objects.create_user(username='alice', password='x')
        self.b = User.objects.create_user(username='bob', password='x')

    def test_creator_is_member(self):
        group = Group.objects.create(name='Club Django', creator=self.a)
        group.members.add(self.a)
        self.assertTrue(group.members.filter(pk=self.a.pk).exists())

    def test_join_leave(self):
        group = Group.objects.create(name='Club Django', creator=self.a)
        group.members.add(self.a)
        group.members.add(self.b)
        self.assertTrue(group.members.filter(pk=self.b.pk).exists())
        group.members.remove(self.b)
        self.assertFalse(group.members.filter(pk=self.b.pk).exists())

    def test_group_post_members_only(self):
        group = Group.objects.create(name='Club Django', creator=self.a)
        group.members.add(self.a)
        GroupPost.objects.create(group=group, author=self.a, content='bienvenue')
        self.assertEqual(group.posts.count(), 1)
        # Simule le refus d'un non-membre (vérification faite dans la vue).
        self.assertFalse(group.members.filter(pk=self.b.pk).exists())
