from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.urls import reverse

from .models import Notification
from .services import create_notification

User = get_user_model()


class NotificationTests(TestCase):
    def setUp(self):
        self.a = User.objects.create_user(username='alice', password='x')
        self.b = User.objects.create_user(username='bob', password='x')

    def test_create_notification_skips_self(self):
        """On ne se notifie pas soi-même (like sur son propre post, etc.)."""
        result = create_notification(
            recipient=self.a,
            actor=self.a,
            notification_type=Notification.Type.LIKE,
            text='auto',
        )
        self.assertIsNone(result)
        self.assertEqual(Notification.objects.count(), 0)

    def test_create_notification_for_other(self):
        create_notification(
            recipient=self.b,
            actor=self.a,
            notification_type=Notification.Type.LIKE,
            text='a aimé ton post',
        )
        self.assertEqual(Notification.objects.count(), 1)
        self.assertFalse(Notification.objects.get().is_read)

    def test_visiting_list_marks_read(self):
        create_notification(
            recipient=self.b,
            actor=self.a,
            notification_type=Notification.Type.COMMENT,
            text='a commenté',
        )
        client = Client()
        client.force_login(self.b)
        response = client.get(reverse('notification_list'))
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Notification.objects.filter(recipient=self.b, is_read=False).exists())

    def test_unread_count_endpoint(self):
        create_notification(
            recipient=self.b,
            actor=self.a,
            notification_type=Notification.Type.MESSAGE,
            text='message',
        )
        client = Client()
        client.force_login(self.b)
        response = client.get(reverse('notification_unread_count'))
        self.assertEqual(response.json()['count'], 1)
