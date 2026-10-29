-- =========================================================================
-- HIRAGA RESTAURANT: DATABASE MIGRATION FOR ORDERS, STORAGE & ACTORS
-- Run this in Supabase: SQL Editor -> New query -> Paste & Click Run
-- =========================================================================

-- 1. ORDERS TABLE
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. ENABLE ROW LEVEL SECURITY & POLICIES
alter table orders enable row level security;

drop policy if exists "public read orders" on orders;
create policy "public read orders" on orders for select using (true);
drop policy if exists "public insert orders" on orders;
create policy "public insert orders" on orders for insert with check (true);
drop policy if exists "public update orders" on orders;
create policy "public update orders" on orders for update using (true);

-- 3. ENABLE REALTIME PUBLICATION FOR ORDERS
do $$ begin
  alter publication supabase_realtime add table orders;
exception when others then null;
end $$;

-- 4. SETTINGS TABLE UPDATES (Payment info, social media, staff config)
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

-- 5. PAYMENT SCREENSHOTS STORAGE BUCKET
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', true) on conflict (id) do nothing;

drop policy if exists "public read receipts" on storage.objects;
create policy "public read receipts" on storage.objects for select using (bucket_id = 'receipts');
drop policy if exists "public upload receipts" on storage.objects;
create policy "public upload receipts" on storage.objects for insert with check (bucket_id = 'receipts');
drop policy if exists "public update receipts" on storage.objects;
create policy "public update receipts" on storage.objects for update using (bucket_id = 'receipts');
