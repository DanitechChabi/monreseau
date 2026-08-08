from django.urls import path

from . import views

urlpatterns = [
    path('', views.GroupListView.as_view(), name='group_list'),
    path('create/', views.GroupCreateView.as_view(), name='group_create'),
    path('<int:pk>/', views.GroupDetailView.as_view(), name='group_detail'),
    path('<int:pk>/edit/', views.GroupUpdateView.as_view(), name='group_update'),
    path('<int:pk>/delete/', views.GroupDeleteView.as_view(), name='group_delete'),
    path('<int:pk>/join/', views.JoinGroupView.as_view(), name='group_join'),
    path('<int:pk>/leave/', views.LeaveGroupView.as_view(), name='group_leave'),
    path('<int:pk>/post/', views.GroupPostCreateView.as_view(), name='group_post_create'),
]
