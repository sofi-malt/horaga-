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
  created_at timestamptz not null default now(),
  tags text[] not null default '{}',
  special boolean not null default false
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

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  tagline text, tagline_am text, phone text, address text, hours text,
  map_url text, instagram text, facebook text, telegram text,
  telebirr_name text, telebirr_number text,
  cbe_name text, cbe_number text, payment_instructions text,
  cashier_pin text default '1234', kitchen_pin text default '1234'
);
insert into settings (id) values (1) on conflict do nothing;
alter table settings enable row level security;
create policy "public read settings" on settings for select using (true);
create policy "admin write settings" on settings for all to authenticated using (true) with check (true);

-- Orders table: from customer ordering to cashier confirmation and kitchen preparation
create table if not exists orders (
  id bigint generated always as identity primary key,
  order_number text not null,
  table_number text not null default 'General',
  customer_name text,
  customer_phone text,
  items jsonb not null default '[]'::jsonb,
  total numeric not null default 0,
  payment_method text not null default 'cash',
  payment_status text not null default 'pending',
  transaction_ref text,
  screenshot_url text,
  status text not null default 'pending_payment',
  rejection_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table orders enable row level security;
create policy "public read orders" on orders for select using (true);
create policy "public insert orders" on orders for insert with check (true);
create policy "public update orders" on orders for update using (true);
alter publication supabase_realtime add table orders;

-- Payment receipts storage bucket
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', true) on conflict (id) do nothing;
create policy "public read receipts" on storage.objects for select using (bucket_id = 'receipts');
create policy "public upload receipts" on storage.objects for insert with check (bucket_id = 'receipts');
create policy "public update receipts" on storage.objects for update using (bucket_id = 'receipts');
