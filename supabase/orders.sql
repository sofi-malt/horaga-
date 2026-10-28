-- Run this in Supabase: SQL Editor -> New query -> Run
-- This creates the orders table, security policies, and payment receipts storage bucket.

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
  screenshot_url text, -- Receipt screenshot public URL
  status text not null default 'pending_payment', -- 'pending_payment', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'
  rejection_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table orders enable row level security;

-- Policies for orders
-- Customers can place and read orders
create policy "public read orders" on orders for select using (true);
create policy "public insert orders" on orders for insert with check (true);
create policy "public update orders" on orders for update using (true);

-- Enable Realtime for orders
alter publication supabase_realtime add table orders;

-- Add payment settings to settings table if not present
alter table settings add column if not exists telebirr_name text;
alter table settings add column if not exists telebirr_number text;
alter table settings add column if not exists cbe_name text;
alter table settings add column if not exists cbe_number text;
alter table settings add column if not exists payment_instructions text;

-- Storage bucket for customer payment receipts / transaction screenshots
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', true) on conflict (id) do nothing;
create policy "public read receipts" on storage.objects for select using (bucket_id = 'receipts');
create policy "public upload receipts" on storage.objects for insert with check (bucket_id = 'receipts');
create policy "public update receipts" on storage.objects for update using (bucket_id = 'receipts');
