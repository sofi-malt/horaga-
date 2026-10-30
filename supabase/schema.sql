-- =========================================================================
-- HIRAGA RESTAURANT: COMPLETE DATABASE SETUP FOR ALL ACTORS
-- Run this in Supabase: SQL Editor -> New query -> Paste & Click Run
-- =========================================================================

-- 1. CATEGORIES TABLE
create table if not exists categories (
  id bigint generated always as identity primary key,
  name text not null,
  name_am text,
  sort int not null default 0
);

-- 2. DISHES / ITEMS TABLE
create table if not exists items (
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

-- Ensure all columns exist if updating an existing table
alter table items add column if not exists tags text[] not null default '{}';
alter table items add column if not exists special boolean not null default false;

-- 3. SETTINGS & PAYMENT CONFIGURATION TABLE
create table if not exists settings (
  id int primary key default 1 check (id = 1),
  tagline text,
  tagline_am text,
  phone text,
  address text,
  hours text,
  map_url text,
  instagram text,
  facebook text,
  telegram text,
  whatsapp text,
  tiktok text,
  youtube text,
  twitter text,
  email text,
  website text,
  telebirr_name text,
  telebirr_number text,
  cbe_name text,
  cbe_number text,
  payment_instructions text,
  cashier_pin text default '1234',
  kitchen_pin text default '1234'
);

-- Insert default row if not exists
insert into settings (id) values (1) on conflict (id) do nothing;

-- Ensure all columns exist in settings
alter table settings add column if not exists whatsapp text;
alter table settings add column if not exists tiktok text;
alter table settings add column if not exists youtube text;
alter table settings add column if not exists twitter text;
alter table settings add column if not exists email text;
alter table settings add column if not exists website text;
alter table settings add column if not exists telebirr_name text;
alter table settings add column if not exists telebirr_number text;
alter table settings add column if not exists cbe_name text;
alter table settings add column if not exists cbe_number text;
alter table settings add column if not exists payment_instructions text;
alter table settings add column if not exists cashier_pin text default '1234';
alter table settings add column if not exists kitchen_pin text default '1234';

-- 4. ORDERS TABLE (From Customer -> Cashier Verification -> Kitchen Preparation)
create table if not exists orders (
  id bigint generated always as identity primary key,
  order_number text not null,
  table_number text not null default 'General',
  customer_name text,
  customer_phone text,
  items jsonb not null default '[]'::jsonb,
  total numeric not null default 0,
  payment_method text not null default 'cash', -- 'cash', 'telebirr', 'cbe', 'bank_transfer'
  payment_status text not null default 'pending', -- 'pending', 'submitted', 'confirmed', 'rejected'
  transaction_ref text, -- Transaction code or reference link
  screenshot_url text, -- Payment receipt photo public URL
  status text not null default 'pending_payment', -- 'pending_payment', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'
  rejection_reason text,
  notes text,
  waiter_name text, -- Waiter responsible for this table
  confirmed_by text, -- Cashier who confirmed or handled the payment
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure columns exist if table is already created
alter table orders add column if not exists waiter_name text;
alter table orders add column if not exists confirmed_by text;

-- 5. STAFF & ACTORS DIRECTORY (Hotel Manager, Chef, Waiter, Cashier)
create table if not exists staff (
  id bigint generated always as identity primary key,
  auth_user_id uuid,
  name text not null,
  email text not null unique,
  role text not null default 'waiter', -- 'chef', 'waiter', 'cashier', 'manager'
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 6. ROW LEVEL SECURITY (RLS) POLICIES
alter table categories enable row level security;
alter table items enable row level security;
alter table settings enable row level security;
alter table orders enable row level security;
alter table staff enable row level security;

-- Staff policies
drop policy if exists "public read staff" on staff;
create policy "public read staff" on staff for select using (true);
drop policy if exists "admin write staff" on staff;
create policy "admin write staff" on staff for all to authenticated using (true) with check (true);

-- Category policies
drop policy if exists "public read categories" on categories;
create policy "public read categories" on categories for select using (true);
drop policy if exists "admin write categories" on categories;
create policy "admin write categories" on categories for all to authenticated using (true) with check (true);

-- Items policies
drop policy if exists "public read items" on items;
create policy "public read items" on items for select using (true);
drop policy if exists "admin write items" on items;
create policy "admin write items" on items for all to authenticated using (true) with check (true);

-- Settings policies
drop policy if exists "public read settings" on settings;
create policy "public read settings" on settings for select using (true);
drop policy if exists "admin write settings" on settings;
create policy "admin write settings" on settings for all to authenticated using (true) with check (true);

-- Orders policies (Allows Customers, Cashier, and Kitchen to operate)
drop policy if exists "public read orders" on orders;
create policy "public read orders" on orders for select using (true);
drop policy if exists "public insert orders" on orders;
create policy "public insert orders" on orders for insert with check (true);
drop policy if exists "public update orders" on orders;
create policy "public update orders" on orders for update using (true);

-- 6. ENABLE SUPABASE REALTIME FOR LIVE ORDERS (Cashier & Kitchen auto-sync)
do $$ begin
  alter publication supabase_realtime add table orders;
exception when others then null;
end $$;

-- 7. STORAGE BUCKETS FOR PICTURES & RECEIPTS
insert into storage.buckets (id, name, public) values ('menu', 'menu', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', true) on conflict (id) do nothing;

-- Storage policies for Menu pictures
drop policy if exists "public read pictures" on storage.objects;
create policy "public read pictures" on storage.objects for select using (bucket_id = 'menu');
drop policy if exists "admin add pictures" on storage.objects;
create policy "admin add pictures" on storage.objects for insert to authenticated with check (bucket_id = 'menu');
drop policy if exists "admin change pictures" on storage.objects;
create policy "admin change pictures" on storage.objects for update to authenticated using (bucket_id = 'menu');
drop policy if exists "admin remove pictures" on storage.objects;
create policy "admin remove pictures" on storage.objects for delete to authenticated using (bucket_id = 'menu');

-- Storage policies for Customer Payment Screenshots / Receipts
drop policy if exists "public read receipts" on storage.objects;
create policy "public read receipts" on storage.objects for select using (bucket_id = 'receipts');
drop policy if exists "public upload receipts" on storage.objects;
create policy "public upload receipts" on storage.objects for insert with check (bucket_id = 'receipts');
drop policy if exists "public update receipts" on storage.objects;
create policy "public update receipts" on storage.objects for update using (bucket_id = 'receipts');
