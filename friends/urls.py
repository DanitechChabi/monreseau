from django.urls import path

from . import views

urlpatterns = [
    path('', views.FriendListView.as_view(), name='friend_list'),
    path('requests/', views.PendingRequestsView.as_view(), name='friend_requests'),
    path('suggestions/', views.FriendSuggestionsView.as_view(), name='friend_suggestions'),
    path('send/<int:user_id>/', views.SendFriendRequestView.as_view(), name='send_friend_request'),
    path('accept/<int:pk>/', views.AcceptFriendRequestView.as_view(), name='accept_friend_request'),
    path('reject/<int:pk>/', views.RejectFriendRequestView.as_view(), name='reject_friend_request'),
    path('cancel/<int:pk>/', views.CancelFriendRequestView.as_view(), name='cancel_friend_request'),
    path('unfriend/<int:user_id>/', views.UnfriendView.as_view(), name='unfriend'),
]
