from django.contrib import admin

from .models import Conversation, Message


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ['id', 'participants_preview', 'created_at']

    @admin.display(description='Participants')
    def participants_preview(self, obj):
        return ', '.join(u.username for u in obj.participants.all()[:4])


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['sender', 'conversation', 'is_read', 'created_at']
    list_filter = ['is_read', 'created_at']
