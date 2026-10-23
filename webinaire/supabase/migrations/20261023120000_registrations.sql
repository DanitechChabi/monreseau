-- Webinaire Archivexa · Docflow — inscriptions, confirmation par e-mail, administration.
--
-- Principes :
--   * RLS activée sur toutes les tables ; aucune lecture publique des inscriptions.
--   * Les Edge Functions utilisent la clé service_role (qui contourne la RLS) et
--     passent par les fonctions SQL ci-dessous pour les opérations atomiques.
--   * Les administrateurs (table admins) lisent les données via leur session
--     Supabase Auth, filtrée par la fonction is_admin().

-- ---------------------------------------------------------------------------
-- Types et tables
-- ---------------------------------------------------------------------------

create type public.registration_status as enum ('pending_confirmation', 'confirmed', 'cancelled');

create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  full_name text not null check (char_length(full_name) between 3 and 120),
  email text not null check (
    email = lower(btrim(email)) and char_length(email) <= 254 and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'
  ),
  organisation text not null check (char_length(organisation) between 1 and 160),
  job_title text not null check (char_length(job_title) between 1 and 120),
  country text not null check (country in ('BJ', 'NE', 'other')),
  phone text check (phone is null or char_length(phone) <= 30),
  status public.registration_status not null default 'pending_confirmation',
  email_confirmed_at timestamptz,
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  constraint registrations_event_email_key unique (event_id, email)
);
create index registrations_event_created_idx on public.registrations (event_id, created_at desc);

create table public.confirmation_tokens (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index confirmation_tokens_registration_idx on public.confirmation_tokens (registration_id);

-- Journal des envois. Aucune adresse e-mail n'y est stockée.
create table public.email_log (
  id bigint generated always as identity primary key,
  registration_id uuid references public.registrations (id) on delete cascade,
  type text not null check (type in ('confirmation', 'event_details', 'admin_login')),
  -- Pour event_details : empreinte des réglages envoyés (un envoi par version).
  reference text,
  provider_message_id text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error_code text,
  created_at timestamptz not null default now()
);
create index email_log_registration_idx on public.email_log (registration_id, created_at desc);

-- Compteurs de limitation de débit. key = HMAC de l'e-mail ou de l'IP (jamais en clair).
create table public.rate_limits (
  key text not null,
  action text not null,
  window_start timestamptz not null default now(),
  count integer not null default 0,
  primary key (key, action)
);

create table public.admins (
  email text primary key check (email = lower(btrim(email))),
  created_at timestamptz not null default now()
);

-- Réglages modifiables depuis /admin. NULL = non renseigné (rien n'est affiché).
create table public.event_settings (
  event_id text primary key,
  event_date date,
  event_time time,
  qa_duration_minutes integer check (qa_duration_minutes between 1 and 600),
  join_url text check (join_url ~ '^https://'),
  contact_email text check (contact_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  updated_at timestamptz not null default now(),
  updated_by text
);
insert into public.event_settings (event_id) values ('maitrise-information-2026');

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.registrations enable row level security;
alter table public.confirmation_tokens enable row level security;
alter table public.email_log enable row level security;
alter table public.rate_limits enable row level security;
alter table public.admins enable row level security;
alter table public.event_settings enable row level security;

-- Défense en profondeur : aucun droit pour les visiteurs anonymes.
revoke all on public.registrations, public.confirmation_tokens, public.email_log,
  public.rate_limits, public.admins, public.event_settings from anon;
-- Les sessions connectées n'ont que la lecture (et la mise à jour des réglages), filtrées par la RLS.
revoke all on public.registrations, public.confirmation_tokens, public.email_log,
  public.rate_limits, public.admins, public.event_settings from authenticated;
grant select on public.registrations, public.email_log, public.admins, public.event_settings to authenticated;
grant update (event_date, event_time, qa_duration_minutes, join_url, contact_email)
  on public.event_settings to authenticated;

-- L'adresse vient du JWT Supabase (lien magique => adresse vérifiée).
create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.admins a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

create policy "admins lisent les inscriptions" on public.registrations
  for select to authenticated using (public.is_admin());
create policy "admins lisent le journal" on public.email_log
  for select to authenticated using (public.is_admin());
create policy "admins lisent la liste des admins" on public.admins
  for select to authenticated using (public.is_admin());
create policy "admins lisent les réglages" on public.event_settings
  for select to authenticated using (public.is_admin());
create policy "admins modifient les réglages" on public.event_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- confirmation_tokens et rate_limits : aucune politique => accessibles au seul service_role.

-- Horodatage et auteur des modifications, fixés côté serveur.
create function public.event_settings_touch() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.jwt() ->> 'email';
  return new;
end;
$$;
create trigger event_settings_touch before update on public.event_settings
  for each row execute function public.event_settings_touch();

-- Vue d'administration : inscription + dernier envoi. security_invoker => la RLS
-- des tables sous-jacentes s'applique à l'utilisateur qui interroge la vue.
create view public.admin_registrations with (security_invoker = true) as
select
  r.id, r.event_id, r.full_name, r.email, r.organisation, r.job_title, r.country, r.phone,
  r.status, r.email_confirmed_at, r.marketing_consent, r.created_at,
  l.type as last_email_type, l.status as last_email_status,
  l.error_code as last_email_error, l.created_at as last_email_at
from public.registrations r
left join lateral (
  select e.type, e.status, e.error_code, e.created_at
  from public.email_log e
  where e.registration_id = r.id
  order by e.created_at desc, e.id desc
  limit 1
) l on true;
revoke all on public.admin_registrations from anon, authenticated;
grant select on public.admin_registrations to authenticated;

-- ---------------------------------------------------------------------------
-- Fonctions appelées par les Edge Functions (service_role uniquement)
-- ---------------------------------------------------------------------------

-- Compte un appel et indique s'il reste sous le plafond de la fenêtre courante.
create function public.rate_limit_hit(p_key text, p_action text, p_window_seconds integer, p_max integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits as rl (key, action, window_start, count)
  values (p_key, p_action, now(), 1)
  on conflict (key, action) do update set
    count = case when rl.window_start <= now() - make_interval(secs => p_window_seconds) then 1 else rl.count + 1 end,
    window_start = case when rl.window_start <= now() - make_interval(secs => p_window_seconds) then now() else rl.window_start end
  returning count into v_count;
  return v_count <= p_max;
end;
$$;

-- Inscription atomique : en cas de doublon (event_id, email), aucune nouvelle ligne.
create function public.register_participant(
  p_event_id text, p_full_name text, p_email text, p_organisation text, p_job_title text,
  p_country text, p_phone text, p_marketing_consent boolean
)
returns table (id uuid, event_id text, full_name text, email text, status public.registration_status, created boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.registrations as r
    (event_id, full_name, email, organisation, job_title, country, phone, marketing_consent)
  values (p_event_id, p_full_name, lower(btrim(p_email)), p_organisation, p_job_title, p_country,
          nullif(btrim(coalesce(p_phone, '')), ''), coalesce(p_marketing_consent, false))
  on conflict on constraint registrations_event_email_key do nothing
  returning r.id into v_id;

  return query
    select r.id, r.event_id, r.full_name, r.email, r.status, (v_id is not null)
    from public.registrations r
    where r.event_id = p_event_id and r.email = lower(btrim(p_email));
end;
$$;

-- Remplace les jetons de l'inscription par un nouveau (l'ancien lien devient invalide).
create function public.issue_confirmation_token(p_registration_id uuid, p_token_hash text, p_expires_at timestamptz)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  delete from public.confirmation_tokens where registration_id = p_registration_id;
  insert into public.confirmation_tokens (registration_id, token_hash, expires_at)
  values (p_registration_id, p_token_hash, p_expires_at);
end;
$$;

-- Vérifie le jeton (hash, expiration, non-réutilisation) et confirme l'inscription.
create function public.confirm_registration(p_token_hash text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_token public.confirmation_tokens%rowtype;
  v_status public.registration_status;
begin
  select * into v_token from public.confirmation_tokens where token_hash = p_token_hash for update;
  if not found or v_token.used_at is not null then
    return 'invalid';
  end if;
  select r.status into v_status from public.registrations r where r.id = v_token.registration_id for update;
  if v_status = 'cancelled' then
    return 'invalid';
  end if;
  if v_token.expires_at <= now() then
    return 'expired';
  end if;
  update public.confirmation_tokens set used_at = now() where id = v_token.id;
  update public.registrations
    set status = 'confirmed', email_confirmed_at = coalesce(email_confirmed_at, now())
    where id = v_token.registration_id;
  return 'ok';
end;
$$;

-- Inscrits confirmés sans envoi réussi d'un e-mail de ce type pour cette référence.
create function public.confirmed_missing_email(p_event_id text, p_type text, p_reference text)
returns table (id uuid, event_id text, full_name text, email text, status public.registration_status)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.event_id, r.full_name, r.email, r.status
  from public.registrations r
  where r.event_id = p_event_id
    and r.status = 'confirmed'
    and not exists (
      select 1 from public.email_log e
      where e.registration_id = r.id and e.type = p_type and e.reference = p_reference and e.status = 'sent'
    )
  order by r.created_at;
$$;

-- Purge RGPD : inscriptions plus anciennes que la durée de conservation, compteurs périmés.
create function public.purge_expired_data(p_months integer)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.registrations where created_at < now() - make_interval(months => p_months);
  get diagnostics v_deleted = row_count;
  delete from public.email_log where registration_id is null and created_at < now() - make_interval(months => p_months);
  delete from public.rate_limits where window_start < now() - interval '2 days';
  delete from public.confirmation_tokens where expires_at < now() - interval '30 days';
  return v_deleted;
end;
$$;

-- Par défaut, PostgreSQL rend les fonctions exécutables par tous : on restreint.
revoke execute on function public.rate_limit_hit(text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.register_participant(text, text, text, text, text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.issue_confirmation_token(uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.confirm_registration(text) from public, anon, authenticated;
revoke execute on function public.confirmed_missing_email(text, text, text) from public, anon, authenticated;
revoke execute on function public.purge_expired_data(integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, text, integer, integer) to service_role;
grant execute on function public.register_participant(text, text, text, text, text, text, text, boolean) to service_role;
grant execute on function public.issue_confirmation_token(uuid, text, timestamptz) to service_role;
grant execute on function public.confirm_registration(text) to service_role;
grant execute on function public.confirmed_missing_email(text, text, text) to service_role;
grant execute on function public.purge_expired_data(integer) to service_role;

-- ---------------------------------------------------------------------------
-- Lecture publique des réglages non sensibles (date, heure, durée Q&R, contact).
-- Le lien de participation n'est jamais exposé publiquement.
-- ---------------------------------------------------------------------------

create function public.get_public_event_settings(p_event_id text)
returns json
language sql stable security definer set search_path = ''
as $$
  select json_build_object(
    'date', s.event_date,
    'time', to_char(s.event_time, 'HH24:MI'),
    'qaDurationMinutes', s.qa_duration_minutes,
    'contactEmail', s.contact_email
  )
  from public.event_settings s
  where s.event_id = p_event_id;
$$;
revoke execute on function public.get_public_event_settings(text) from public;
grant execute on function public.get_public_event_settings(text) to anon, authenticated, service_role;
