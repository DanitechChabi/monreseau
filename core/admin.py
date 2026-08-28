from django.contrib import admin

from .models import Language


@admin.register(Language)
class LanguageAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'name_native', 'is_active', 'is_ui_available']
    list_filter = ['is_active', 'is_ui_available']
    search_fields = ['code', 'name', 'name_native']
