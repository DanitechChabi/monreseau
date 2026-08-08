from django.urls import path

from . import views

urlpatterns = [
    path('', views.FriendListView.as_view(), name='friend_list'),
]
