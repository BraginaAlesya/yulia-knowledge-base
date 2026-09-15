-- Run this file once in Supabase: SQL Editor -> New query -> Run.
-- It creates the access model. Materials are visible only to the owner
-- unless the owner later grants a trainer access to a specific item.

create type public.app_role as enum ('owner', 'technical_admin', 'trainer', 'client');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.app_role not null default 'client',
  created_at timestamptz not null default now()
);

create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 180),
  kind text not null check (kind in ('Практика', 'Методика', 'Статья', 'Видео', 'Аудио', 'Заметка')),
  summary text not null check (char_length(summary) between 1 and 3000),
  tags text[] not null default '{}',
  status text not null default 'Черновик' check (status in ('Опубликовано', 'Черновик', 'Архив')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.material_access (
  material_id uuid not null references public.materials(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (material_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.materials enable row level security;
alter table public.material_access enable row level security;

create policy "Users can see their profile; owners and technical admins can see the directory"
on public.profiles for select to authenticated
using ((select auth.uid()) = id or (select public.current_role()) in ('owner', 'technical_admin'));

create policy "Only the owner can change roles and profiles"
on public.profiles for update to authenticated
using ((select public.current_role()) = 'owner')
with check ((select public.current_role()) = 'owner');

create policy "Only the owner sees all materials; assigned users see their own"
on public.materials for select to authenticated
using (
  (select public.current_role()) = 'owner'
  or exists (
    select 1 from public.material_access access
    where access.material_id = materials.id and access.user_id = (select auth.uid())
  )
);

create policy "Only the owner can add materials"
on public.materials for insert to authenticated
with check ((select public.current_role()) = 'owner' and created_by = (select auth.uid()));

create policy "Only the owner can update materials"
on public.materials for update to authenticated
using ((select public.current_role()) = 'owner')
with check ((select public.current_role()) = 'owner');

create policy "Only the owner can delete materials"
on public.materials for delete to authenticated
using ((select public.current_role()) = 'owner');

create policy "Users see only their own assignments; owner manages assignments"
on public.material_access for select to authenticated
using ((select public.current_role()) = 'owner' or user_id = (select auth.uid()));

create policy "Only the owner manages material access"
on public.material_access for all to authenticated
using ((select public.current_role()) = 'owner')
with check ((select public.current_role()) = 'owner');

-- After Юлия and Алеся have opened their magic links once, run these two
-- statements with their actual email addresses, replacing the placeholders:
-- update public.profiles set full_name = 'Юлия', role = 'owner'
-- where id = (select id from auth.users where email = 'julia@example.com');
-- update public.profiles set full_name = 'Алеся', role = 'technical_admin'
-- where id = (select id from auth.users where email = 'alesya@example.com');

-- Library foundation: folders and role-based visibility.
-- Safe to run once after the initial schema above.
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  title text not null unique check (char_length(title) between 1 and 80),
  description text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.materials
  add column if not exists folder_id uuid references public.folders(id) on delete set null,
  add column if not exists access_roles public.app_role[] not null default array[]::public.app_role[],
  add column if not exists content_blocks jsonb not null default '[]'::jsonb,
  add column if not exists content_schema_version integer not null default 1;

alter table public.folders enable row level security;

drop policy if exists "Only the owner sees all materials; assigned users see their own" on public.materials;
create policy "Material visibility follows role"
on public.materials for select to authenticated
using (
  (select public.current_role()) = 'owner'
  or (
    status = 'Опубликовано'
    and (select public.current_role()) = any(access_roles)
  )
);

create policy "Only owners manage folders"
on public.folders for all to authenticated
using ((select public.current_role()) = 'owner')
with check ((select public.current_role()) = 'owner');

-- Trainers and clients can see a folder title only when it contains a material
-- already available to their role. They cannot create or change folders.
drop policy if exists "Visible folders follow visible materials" on public.folders;
create policy "Visible folders follow visible materials"
on public.folders for select to authenticated
using (
  (select public.current_role()) = 'owner'
  or exists (
    select 1
    from public.materials
    where materials.folder_id = folders.id
      and materials.status = 'Опубликовано'
      and (select public.current_role()) = any(materials.access_roles)
  )
);
