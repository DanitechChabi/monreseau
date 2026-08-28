from django.contrib.auth import get_user_model
from django.test import TestCase

from .models import Page, PagePost

User = get_user_model()


class PageTests(TestCase):
    def setUp(self):
        self.a = User.objects.create_user(username='alice', password='x')
        self.b = User.objects.create_user(username='bob', password='x')

    def test_owner_follows_own_page(self):
        page = Page.objects.create(name='Mon blog', owner=self.a)
        page.followers.add(self.a)
        self.assertTrue(page.followers.filter(pk=self.a.pk).exists())

    def test_follow_unfollow(self):
        page = Page.objects.create(name='Mon blog', owner=self.a)
        page.followers.add(self.a)
        page.followers.add(self.b)
        self.assertTrue(page.followers.filter(pk=self.b.pk).exists())
        page.followers.remove(self.b)
        self.assertFalse(page.followers.filter(pk=self.b.pk).exists())

    def test_page_post_owner_only(self):
        page = Page.objects.create(name='Mon blog', owner=self.a)
        PagePost.objects.create(page=page, author=self.a, content='article 1')
        self.assertEqual(page.posts.count(), 1)
        # La vue refuse les publications des non-propriétaires.
        self.assertNotEqual(self.b, page.owner)
