-- Passe 3 : présences et attestations de participation.
--
-- Principe : l'inscription ne donne jamais droit à une attestation ; seule une
-- présence validée par un organisateur (attendance.status = 'present') ouvre ce droit.
-- Toutes les écritures passent par les Edge Functions (clé service_role), qui
-- vérifient l'administrateur et alimentent le journal d'audit. Les
-- administrateurs connectés n'ont que la lecture (RLS). Aucune lecture publique :
-- la page de vérification passe par la fonction verify-certificate.

create table public.attendance (
  registration_id uuid primary key references public.registrations (id) on delete cascade,
  status text not null check (status in ('present', 'absent')),
  minutes integer check (minutes is null or minutes between 0 and 1440),
  source text not null check (source in ('manual', 'csv')),
  validated_by text not null,
  validated_at timestamptz not null default now()
);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique check (public_code ~ '^[A-Z]{2,5}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$'),
  registration_id uuid not null unique references public.registrations (id) on delete cascade,
  holder_name text not null check (char_length(holder_name) between 2 and 160),
  status text not null default 'eligible' check (status in ('eligible', 'issued', 'sent', 'revoked')),
  revoked_reason text,
  file_path text,
  -- Date du webinaire figée à l'émission (l'attestation n'est jamais régénérée).
  event_date date,
  issued_at timestamptz,
  sent_at timestamptz,
  send_attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  constraint certificates_revocation_reason check (status <> 'revoked' or char_length(coalesce(revoked_reason, '')) >= 3),
  constraint certificates_issued_has_file check (status not in ('issued', 'sent') or file_path is not null)
);
create index certificates_status_idx on public.certificates (status);

create table public.audit_log (
  id bigint generated always as identity primary key,
  action text not null,
  admin text not null,
  target text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);

alter table public.attendance enable row level security;
alter table public.certificates enable row level security;
alter table public.audit_log enable row level security;

revoke all on public.attendance, public.certificates, public.audit_log from anon, authenticated;
grant select on public.attendance, public.certificates, public.audit_log to authenticated;

create policy "admins lisent les présences" on public.attendance
  for select to authenticated using (public.is_admin());
create policy "admins lisent les attestations" on public.certificates
  for select to authenticated using (public.is_admin());
create policy "admins lisent le journal d'audit" on public.audit_log
  for select to authenticated using (public.is_admin());

-- Vue d'administration : inscription + présence + attestation (RLS appliquée à l'appelant).
create view public.admin_attendance with (security_invoker = true) as
select
  r.id as registration_id, r.event_id, r.full_name, r.email, r.organisation, r.country, r.status as registration_status,
  a.status as attendance_status, a.minutes, a.source as attendance_source, a.validated_by, a.validated_at,
  c.id as certificate_id, c.public_code, c.holder_name, c.status as certificate_status, c.revoked_reason,
  c.issued_at, c.sent_at, c.send_attempts, c.last_error
from public.registrations r
left join public.attendance a on a.registration_id = r.id
left join public.certificates c on c.registration_id = r.id;
revoke all on public.admin_attendance from anon, authenticated;
grant select on public.admin_attendance to authenticated;

-- Stockage privé des PDF (Supabase uniquement ; ignoré sur un PostgreSQL nu).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('attestations', 'attestations', false, 5242880, array['application/pdf'])
    on conflict (id) do update set public = false;
  end if;
end;
$$;

-- Journal d'envoi : nouveau type « certificate ».
alter table public.email_log drop constraint email_log_type_check;
alter table public.email_log add constraint email_log_type_check
  check (type in ('confirmation', 'event_details', 'admin_login', 'certificate'));

-- La purge RGPD supprime aussi présences et attestations (cascade sur registrations).
