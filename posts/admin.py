from django.contrib import admin

from .models import Comment, Like, Post


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ['author', 'content_preview', 'created_at', 'updated_at']
    list_filter = ['created_at']
    search_fields = ['content', 'author__username']

    @admin.display(description='Contenu')
    def content_preview(self, obj):
        return obj.content[:80]


@admin.register(Like)
class LikeAdmin(admin.ModelAdmin):
    list_display = ['user', 'post', 'created_at']


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ['author', 'content_preview', 'post', 'created_at']
    search_fields = ['content', 'author__username']

    @admin.display(description='Contenu')
    def content_preview(self, obj):
        return obj.content[:80]
