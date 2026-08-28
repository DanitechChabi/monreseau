from django.contrib.auth import views as auth_views
from django.urls import path

from . import views
from .forms import LoginForm

urlpatterns = [
    path('register/', views.RegisterView.as_view(), name='register'),
    path(
        'login/',
        auth_views.LoginView.as_view(
            template_name='registration/login.html',
            authentication_form=LoginForm,
            redirect_authenticated_user=True,
        ),
        name='login',
    ),
    path('logout/', auth_views.LogoutView.as_view(), name='logout'),
    path('u/<str:username>/', views.ProfileView.as_view(), name='profile'),
    path('u/<str:username>/edit/', views.EditProfileView.as_view(), name='edit_profile'),
]
