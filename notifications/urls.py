from django.urls import path

from . import views

urlpatterns = [
    path('', views.NotificationListView.as_view(), name='notification_list'),
    path('unread-count/', views.UnreadCountView.as_view(), name='notification_unread_count'),
]
