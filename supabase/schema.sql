-- Run this once in Supabase: SQL Editor -> New query -> Run

create table categories (
  id bigint generated always as identity primary key,
  name text not null,
  name_am text,
  sort int not null default 0
);

create table items (
  id bigint generated always as identity primary key,
  category_id bigint references categories(id) on delete set null,
  name text not null,
  name_am text,
  description text,
  description_am text,
  price numeric not null default 0,
  image_url text,
  available boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

alter table categories enable row level security;
alter table items enable row level security;

-- Everyone can read the menu
create policy "public read categories" on categories for select using (true);
create policy "public read items" on items for select using (true);

-- Only signed-in admins can change it
create policy "admin write categories" on categories for all to authenticated using (true) with check (true);
create policy "admin write items" on items for all to authenticated using (true) with check (true);

-- Picture storage
insert into storage.buckets (id, name, public) values ('menu', 'menu', true) on conflict do nothing;
create policy "public read pictures" on storage.objects for select using (bucket_id = 'menu');
create policy "admin add pictures" on storage.objects for insert to authenticated with check (bucket_id = 'menu');
create policy "admin change pictures" on storage.objects for update to authenticated using (bucket_id = 'menu');
create policy "admin remove pictures" on storage.objects for delete to authenticated using (bucket_id = 'menu');
alter table items add column if not exists tags text[] not null default '{}';
alter table items add column if not exists special boolean not null default false;

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  tagline text, tagline_am text, phone text, address text, hours text,
  map_url text, instagram text, facebook text, telegram text
);
insert into settings (id) values (1) on conflict do nothing;
alter table settings enable row level security;
create policy "public read settings" on settings for select using (true);
create policy "admin write settings" on settings for all to authenticated using (true) with check (true);
