from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse_lazy
from django.utils.translation import gettext as _
from django.views import View
from django.views.generic import CreateView, DeleteView, DetailView, ListView, UpdateView

from core.mixins import OwnerRequiredMixin

from .forms import GroupForm
from .models import Group, GroupPost


class GroupListView(LoginRequiredMixin, ListView):
    """Liste de tous les groupes."""

    template_name = 'groups/group_list.html'
    context_object_name = 'groups'
    paginate_by = 12

    def get_queryset(self):
        return Group.objects.all().order_by('name')


class GroupDetailView(LoginRequiredMixin, DetailView):
    """Page d'un groupe : membres + publications."""

    model = Group
    template_name = 'groups/group_detail.html'
    context_object_name = 'group'

    def get_queryset(self):
        return Group.objects.prefetch_related(
            'members__profile',
            'posts__author__profile',
        )

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['is_member'] = self.object.members.filter(pk=self.request.user.pk).exists()
        return context


class GroupCreateView(LoginRequiredMixin, CreateView):
    """Crée un groupe ; le créateur en devient automatiquement membre."""

    model = Group
    form_class = GroupForm
    template_name = 'groups/group_form.html'

    def form_valid(self, form):
        form.instance.creator = self.request.user
        response = super().form_valid(form)
        self.object.members.add(self.request.user)
        messages.success(self.request, _('Groupe « %(name)s » créé !') % {'name': self.object.name})
        return response

    def get_success_url(self):
        return self.object.get_absolute_url()


class GroupUpdateView(LoginRequiredMixin, OwnerRequiredMixin, UpdateView):
    """Modifie un groupe (réservé à son créateur)."""

    model = Group
    owner_field = 'creator'
    form_class = GroupForm
    template_name = 'groups/group_form.html'

    def get_success_url(self):
        return self.object.get_absolute_url()


class GroupDeleteView(LoginRequiredMixin, OwnerRequiredMixin, DeleteView):
    """Supprime un groupe (réservé à son créateur)."""

    model = Group
    owner_field = 'creator'
    template_name = 'groups/group_confirm_delete.html'
    success_url = reverse_lazy('group_list')


class JoinGroupView(LoginRequiredMixin, View):
    """Rejoint un groupe (POST uniquement)."""

    def post(self, request, pk):
        group = get_object_or_404(Group, pk=pk)
        group.members.add(request.user)
        messages.success(request, _("Tu as rejoint le groupe « %(name)s ».") % {'name': group.name})
        return redirect(group.get_absolute_url())


class LeaveGroupView(LoginRequiredMixin, View):
    """Quitte un groupe (POST uniquement)."""

    def post(self, request, pk):
        group = get_object_or_404(Group, pk=pk)
        group.members.remove(request.user)
        messages.info(request, _("Tu as quitté le groupe « %(name)s ».") % {'name': group.name})
        return redirect(group.get_absolute_url())


class GroupPostCreateView(LoginRequiredMixin, View):
    """Publie un message dans un groupe (POST uniquement, membres seulement)."""

    def post(self, request, pk):
        group = get_object_or_404(Group, pk=pk)
        if not group.members.filter(pk=request.user.pk).exists():
            messages.error(request, _('Rejoins le groupe avant de pouvoir y publier.'))
            return redirect(group.get_absolute_url())
        content = request.POST.get('content', '').strip()
        if content:
            GroupPost.objects.create(group=group, author=request.user, content=content)
            messages.success(request, _('Publication ajoutée au groupe.'))
        else:
            messages.error(request, _('Ta publication est vide.'))
        return redirect(group.get_absolute_url())
