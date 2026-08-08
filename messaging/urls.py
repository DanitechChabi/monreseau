from django.urls import path

from . import views

urlpatterns = [
    path('', views.ConversationListView.as_view(), name='conversation_list'),
    path('new/<int:user_id>/', views.StartConversationView.as_view(), name='conversation_new'),
    path('<int:pk>/', views.ConversationDetailView.as_view(), name='conversation_detail'),
    path('unread-count/', views.UnreadMessagesCountView.as_view(), name='message_unread_count'),
]
