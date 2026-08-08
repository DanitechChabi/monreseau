from django.contrib import admin

from .models import Group, GroupPost


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ['name', 'creator', 'member_count', 'created_at']
    list_filter = ['created_at']
    search_fields = ['name', 'description']
    filter_horizontal = ['members']


@admin.register(GroupPost)
class GroupPostAdmin(admin.ModelAdmin):
    list_display = ['group', 'author', 'content_preview', 'created_at']
    search_fields = ['content', 'author__username']

    @admin.display(description='Contenu')
    def content_preview(self, obj):
        return obj.content[:80]
