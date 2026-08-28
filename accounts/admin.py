from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Profile, User

admin.site.register(User, UserAdmin)


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'location', 'ui_language', 'created_at']
    search_fields = ['user__username', 'user__email']
    filter_horizontal = ['languages']
    list_select_related = ['ui_language']
