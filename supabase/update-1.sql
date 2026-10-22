-- Update 1: tags, Today's special, restaurant info.
-- Already ran schema.sql before? Run ONLY this file once in the Supabase SQL Editor.
-- Fresh install? schema.sql already includes this, do not run it twice.

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
