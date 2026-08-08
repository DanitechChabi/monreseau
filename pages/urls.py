from django.urls import path

from . import views

urlpatterns = [
    path('', views.PageListView.as_view(), name='page_list'),
]
