-- Données de développement local (appliquées par `supabase db reset`).
-- En production, ajoutez les administrateurs depuis l'éditeur SQL :
--   insert into public.admins (email) values ('prenom.nom@archivexa.example');
insert into public.admins (email) values ('admin@example.org') on conflict do nothing;
