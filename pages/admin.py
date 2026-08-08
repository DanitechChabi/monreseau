from django.contrib import admin

from .models import Page, PagePost


@admin.register(Page)
class PageAdmin(admin.ModelAdmin):
    list_display = ['name', 'owner', 'follower_count', 'created_at']
    search_fields = ['name', 'description']
    filter_horizontal = ['followers']


@admin.register(PagePost)
class PagePostAdmin(admin.ModelAdmin):
    list_display = ['page', 'author', 'content_preview', 'created_at']
    search_fields = ['content', 'author__username']

    @admin.display(description='Contenu')
    def content_preview(self, obj):
        return obj.content[:80]
