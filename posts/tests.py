from django.contrib.auth import get_user_model
from django.test import TestCase

from friends.models import Friendship
from .models import Comment, Like, Post

User = get_user_model()


class PostFeedTests(TestCase):
    def setUp(self):
        self.a = User.objects.create_user(username='alice', password='x')
        self.b = User.objects.create_user(username='bob', password='x')
        self.c = User.objects.create_user(username='charlie', password='x')
        Friendship.objects.create(
            from_user=self.a, to_user=self.b, status=Friendship.Status.ACCEPTED
        )

    def test_feed_includes_friends_and_self_only(self):
        """Le fil contient les posts de soi-même et des amis, jamais des étrangers."""
        pa = Post.objects.create(author=self.a, content='post alice')
        pb = Post.objects.create(author=self.b, content='post bob')
        pc = Post.objects.create(author=self.c, content='post charlie')

        feed = Post.objects.feed_for(self.a)
        self.assertIn(pa, feed)
        self.assertIn(pb, feed)
        self.assertNotIn(pc, feed)

    def test_feed_ordered_by_recency(self):
        """Le fil est trié du plus récent au plus ancien."""
        older = Post.objects.create(author=self.a, content='ancien')
        newer = Post.objects.create(author=self.b, content='récent')
        feed = list(Post.objects.feed_for(self.a))
        self.assertEqual(feed[0], newer)
        self.assertEqual(feed[1], older)


class LikeTests(TestCase):
    def setUp(self):
        self.a = User.objects.create_user(username='alice', password='x')
        self.b = User.objects.create_user(username='bob', password='x')

    def test_like_unique_per_user(self):
        """Un utilisateur ne peut liker qu'une seule fois (contrainte unique)."""
        post = Post.objects.create(author=self.a, content='bonjour')
        Like.objects.create(post=post, user=self.b)
        with self.assertRaises(Exception):
            Like.objects.create(post=post, user=self.b)

    def test_like_toggle(self):
        """Le toggle like/unlike crée puis supprime le like."""
        post = Post.objects.create(author=self.a, content='bonjour')
        Like.objects.create(post=post, user=self.b)
        self.assertEqual(Like.objects.filter(post=post).count(), 1)
        Like.objects.filter(post=post, user=self.b).delete()
        self.assertEqual(Like.objects.filter(post=post).count(), 0)


class CommentTests(TestCase):
    def setUp(self):
        self.a = User.objects.create_user(username='alice', password='x')
        self.b = User.objects.create_user(username='bob', password='x')

    def test_comment_attached_to_post(self):
        post = Post.objects.create(author=self.a, content='super post')
        comment = Comment.objects.create(post=post, author=self.b, content='génial !')
        self.assertEqual(post.comments.count(), 1)
        self.assertEqual(comment.post, post)
