from django.urls import path

from . import views

urlpatterns = [
    path('create/', views.PostCreateView.as_view(), name='post_create'),
    path('bookmarks/', views.BookmarksListView.as_view(), name='post_bookmarks'),
    path('feed/ajax/', views.InfiniteFeedView.as_view(), name='infinite_feed'),
    path('stories/', views.StoriesView.as_view(), name='stories'),
    path('stories/create/', views.StoryCreateView.as_view(), name='story_create'),
    path('stories/<int:pk>/view/', views.StoryViewView.as_view(), name='story_view'),
    path('poll/<int:pk>/vote/', views.PollVoteView.as_view(), name='poll_vote'),
    path('<int:pk>/', views.PostDetailView.as_view(), name='post_detail'),
    path('<int:pk>/edit/', views.PostUpdateView.as_view(), name='post_update'),
    path('<int:pk>/delete/', views.PostDeleteView.as_view(), name='post_delete'),
    path('<int:pk>/like/', views.ToggleLikeView.as_view(), name='post_like'),
    path('<int:pk>/bookmark/', views.ToggleBookmarkView.as_view(), name='post_bookmark'),
    path('<int:pk>/report/', views.ReportView.as_view(), name='post_report'),
    path('<int:pk>/comments/new/', views.CommentCreateView.as_view(), name='comment_create'),
    path('comments/<int:pk>/delete/', views.CommentDeleteView.as_view(), name='comment_delete'),
    path('heartbeat/', views.HeartbeatView.as_view(), name='heartbeat'),
    path('typing/<int:conversation_id>/', views.TypingView.as_view(), name='typing'),
]
