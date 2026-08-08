from django.urls import path

from . import views

urlpatterns = [
    path('', views.ConversationListView.as_view(), name='conversation_list'),
]
