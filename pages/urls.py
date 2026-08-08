from django.urls import path

from . import views

urlpatterns = [
    path('', views.PageListView.as_view(), name='page_list'),
    path('create/', views.PageCreateView.as_view(), name='page_create'),
    path('<int:pk>/', views.PageDetailView.as_view(), name='page_detail'),
    path('<int:pk>/edit/', views.PageUpdateView.as_view(), name='page_update'),
    path('<int:pk>/delete/', views.PageDeleteView.as_view(), name='page_delete'),
    path('<int:pk>/follow/', views.FollowPageView.as_view(), name='page_follow'),
    path('<int:pk>/unfollow/', views.UnfollowPageView.as_view(), name='page_unfollow'),
    path('<int:pk>/post/', views.PagePostCreateView.as_view(), name='page_post_create'),
]
