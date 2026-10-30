'use client';
import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '../../lib/supabase';
import { TAGS } from '../../lib/tags';
import StaffLoginForm from '../../components/StaffLoginForm';
import StaffSecurityModal from '../../components/StaffSecurityModal';

const EMPTY = {
  name: '',
  name_am: '',
  description: '',
  description_am: '',
  price: '',
  category_id: '',
  available: true,
  image_url: '',
  tags: [],
  special: false,
};

const shrink = (file) =>
  new Promise((res) => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 900 / Math.max(im.width, im.height));
      const c = document.createElement('canvas');
      c.width = im.width * k;
      c.height = im.height * k;
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      c.toBlob(res, 'image/jpeg', 0.8);
    };
    im.src = URL.createObjectURL(file);
  });

export default function Admin() {
  const [session, setSession] = useState(undefined);
  const [cats, setCats] = useState([]);
  const [items, setItems] = useState([]);
  const [f, setF] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [file, setFile] = useState(null);
  const [newCat, setNewCat] = useState({ name: '', name_am: '' });
  const [msg, setMsg] = useState({ text: '', bad: false });
  const [busy, setBusy] = useState(false);
  const [tbl, setTbl] = useState('');
  const [qr, setQr] = useState({ url: '', img: '' });
  const [st, setSt] = useState({});
  const [copiedSql, setCopiedSql] = useState(false);

  // Modern Navigation & View Tabs
  const [currentTab, setCurrentTab] = useState('overview'); // 'overview' | 'dishes' | 'categories' | 'staff' | 'payments' | 'contacts' | 'qrcodes' | 'database'
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Modals & Popups
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showDishModal, setShowDishModal] = useState(false);
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);

  // Filter & Search
  const [dishSearch, setDishSearch] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState('all');

  // Staff accounts state
  const [staffList, setStaffList] = useState([]);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRole, setStaffRole] = useState('waiter'); // 'chef', 'waiter', 'cashier', 'manager'
  const [staffPhone, setStaffPhone] = useState('');
  const [busyStaff, setBusyStaff] = useState(false);
  const [staffMsg, setStaffMsg] = useState({ text: '', bad: false });
  const [staffFilter, setStaffFilter] = useState('all');

  const say = (text, bad = false) => {
    setMsg({ text, bad });
    if (!bad) setTimeout(() => setMsg({ text: '', bad: false }), 4000);
  };

  const loadStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/staff');
      const data = await res.json();
      if (data?.staff) setStaffList(data.staff);
    } catch (e) {
      console.warn('Failed to load staff list:', e);
    }
  }, []);

  const createStaffAccount = async (e) => {
    e.preventDefault();
    if (!staffName.trim() || !staffEmail.trim() || !staffPassword.trim()) {
      setStaffMsg({ text: 'Please fill in name, email, and password.', bad: true });
      return;
    }
    if (staffPassword.length < 6) {
      setStaffMsg({ text: 'Password must be at least 6 characters.', bad: true });
      return;
    }
    setBusyStaff(true);
    setStaffMsg({ text: '', bad: false });
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: staffName,
          email: staffEmail,
          password: staffPassword,
          role: staffRole,
          phone: staffPhone,
        }),
      });
      const data = await res.json();
      setBusyStaff(false);
      if (!res.ok || data.error) {
        setStaffMsg({ text: data.error || 'Failed to create staff account', bad: true });
      } else {
        say(`✓ Account created successfully for ${staffName} (${staffRole})!`);
        setStaffName('');
        setStaffEmail('');
        setStaffPassword('');
        setStaffPhone('');
        setShowAddStaffModal(false);
        loadStaff();
      }
    } catch (err) {
      setBusyStaff(false);
      setStaffMsg({ text: err.message || 'Network error', bad: true });
    }
  };

  const toggleStaffStatus = async (staff) => {
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: staff.id, active: !staff.active }),
      });
      if (res.ok) {
        setStaffList(staffList.map((s) => (s.id === staff.id ? { ...s, active: !s.active } : s)));
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const deleteStaffMember = async (staff) => {
    if (!window.confirm(`Are you sure you want to remove ${staff.name} (${staff.role})?`)) return;
    try {
      const res = await fetch(`/api/admin/staff?id=${staff.id}&auth_id=${staff.auth_user_id || ''}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setStaffList(staffList.filter((s) => s.id !== staff.id));
        say(`Removed ${staff.name}`);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const load = useCallback(async () => {
    try {
      const [c, i, s] = await Promise.all([
        supabase.from('categories').select('*').order('sort').order('id'),
        supabase.from('items').select('*').order('sort').order('id'),
        supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
      ]);
      if (c.error) say('Categories: ' + c.error.message, true);
      if (i.error) say('Dishes: ' + i.error.message, true);
      setCats(c.data || []);
      setItems(i.data || []);
      setSt(s.data || {});
    } catch (err) {
      say('Failed to connect to database. Please check Supabase credentials.', true);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      load();
      loadStaff();
    }
  }, [session, load, loadStaff]);

  const saveDish = async (e) => {
    e.preventDefault();
    setBusy(true);
    let image_url = f.image_url;
    if (file) {
      const path = `${Date.now()}.jpg`;
      const up = await supabase.storage
        .from('menu')
        .upload(path, await shrink(file), { contentType: 'image/jpeg' });
      if (up.error) {
        setBusy(false);
        return say('Picture upload failed: ' + up.error.message, true);
      }
      image_url = supabase.storage.from('menu').getPublicUrl(path).data.publicUrl;
    }
    const row = {
      name: f.name.trim(),
      name_am: f.name_am.trim() || null,
      description: f.description.trim() || null,
      description_am: f.description_am.trim() || null,
      price: Number(f.price) || 0,
      category_id: f.category_id || null,
      available: f.available,
      image_url,
      tags: f.tags || [],
      special: !!f.special,
    };
    const { error } = editId
      ? await supabase.from('items').update(row).eq('id', editId)
      : await supabase.from('items').insert(row);
    setBusy(false);
    if (error) return say(error.message, true);
    setF(EMPTY);
    setFile(null);
    setEditId(null);
    setShowDishModal(false);
    say(editId ? 'Dish updated successfully!' : 'Dish added successfully!');
    load();
  };

  const openAddDish = () => {
    setEditId(null);
    setFile(null);
    setF(EMPTY);
    setShowDishModal(true);
  };

  const openEditDish = (i) => {
    setEditId(i.id);
    setFile(null);
    setF({
      ...EMPTY,
      ...i,
      price: i.price,
      category_id: i.category_id || '',
      tags: i.tags || [],
    });
    setShowDishModal(true);
  };

  const toggle = async (i) => {
    await supabase.from('items').update({ available: !i.available }).eq('id', i.id);
    load();
  };

  const del = async (i) => {
    if (confirm(`Delete "${i.name}"?`)) {
      await supabase.from('items').delete().eq('id', i.id);
      say(`Deleted "${i.name}"`);
      load();
    }
  };

  const addCat = async (e) => {
    e.preventDefault();
    if (!newCat.name.trim()) return;
    const { error } = await supabase.from('categories').insert({
      name: newCat.name.trim(),
      name_am: newCat.name_am.trim() || null,
      sort: cats.length,
    });
    if (error) return say(error.message, true);
    setNewCat({ name: '', name_am: '' });
    setShowAddCatModal(false);
    say('Category added successfully!');
    load();
  };

  const delCat = async (c) => {
    if (confirm(`Delete category "${c.name}"? Its dishes stay in the menu under "Other".`)) {
      await supabase.from('categories').delete().eq('id', c.id);
      say(`Category "${c.name}" deleted.`);
      load();
    }
  };

  const reorder = async (table, list, row, dir, group) => {
    const sib = list.filter((r) => group(r) === group(row));
    const other = sib[sib.indexOf(row) + dir];
    if (!other) return;
    const arr = [...list],
      a = arr.indexOf(row),
      b = arr.indexOf(other);
    [arr[a], arr[b]] = [arr[b], arr[a]];
    await Promise.all(
      arr.map((r, n) =>
        r.sort === n ? null : supabase.from(table).update({ sort: n }).eq('id', r.id)
      ).filter(Boolean)
    );
    load();
  };

  const saveInfo = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('settings').upsert({ ...st, id: 1 });
    say(error ? error.message : 'Settings saved successfully!', !!error);
  };

  const backup = async () => {
    const [c, i, s] = await Promise.all([
      supabase.from('categories').select('*'),
      supabase.from('items').select('*'),
      supabase.from('settings').select('*'),
    ]);
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exported: new Date().toISOString(),
            categories: c.data,
            items: i.data,
            settings: s.data,
          },
          null,
          2
        ),
      ],
      { type: 'application/json' }
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hiraga-menu-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const printCard = () => {
    const w = window.open('', '_blank');
    w.document.write(
      `<html><head><title>Hiraga QR card</title><style>body{margin:0;background:#000;color:#fff;font-family:system-ui;text-align:center;padding:30px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.l{width:300px}.q{width:320px;background:#fff;padding:14px;border-radius:18px}h1{margin:14px 0 4px;color:#f59e0b}p{color:#aaa;margin:0 0 14px}</style></head><body><img class="l" src="${location.origin}/logo.png"><h1>Scan for our menu</h1><p>ሜኑውን ለማየት ስካን ያድርጉ</p><img class="q" src="${qr.img}">${tbl ? `<h1>Table ${tbl.replace(/[<>&"]/g, '')}</h1>` : ''}<script>onload=function(){setTimeout(print,400)}<\/script></body></html>`
    );
    w.document.close();
  };

  const makeQr = async () => {
    const url = location.origin + (tbl ? `?table=${encodeURIComponent(tbl)}` : '');
    setQr({ url, img: await QRCode.toDataURL(url, { width: 700, margin: 2 }) });
  };

  const ordersSql = `-- Run this query in Supabase SQL Editor:
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

alter table settings add column if not exists telebirr_name text;
alter table settings add column if not exists telebirr_number text;
alter table settings add column if not exists cbe_name text;
alter table settings add column if not exists cbe_number text;
alter table settings add column if not exists payment_instructions text;
alter table settings add column if not exists whatsapp text;
alter table settings add column if not exists tiktok text;
alter table settings add column if not exists youtube text;
alter table settings add column if not exists twitter text;
alter table settings add column if not exists email text;
alter table settings add column if not exists website text;
alter table settings add column if not exists cashier_pin text default '1234';
alter table settings add column if not exists kitchen_pin text default '1234';

insert into storage.buckets (id, name, public) values ('receipts', 'receipts', true) on conflict (id) do nothing;
create policy "public read receipts" on storage.objects for select using (bucket_id = 'receipts');
create policy "public upload receipts" on storage.objects for insert with check (bucket_id = 'receipts');
create policy "public update receipts" on storage.objects for update using (bucket_id = 'receipts');

create table if not exists staff (
  id bigint generated always as identity primary key,
  auth_user_id uuid,
  name text not null,
  email text not null unique,
  role text not null default 'waiter',
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table staff enable row level security;
create policy "public read staff" on staff for select using (true);
create policy "admin write staff" on staff for all to authenticated using (true) with check (true);`;

  const copySql = () => {
    navigator.clipboard?.writeText(ordersSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  // 1. Session Loading
  if (session === undefined) {
    return (
      <main className="wrap" style={{ textAlign: 'center', paddingTop: 80 }}>
        <p className="empty">Loading administrator portal...</p>
      </main>
    );
  }

  // 2. Unauthenticated: Modern Login
  if (!session) {
    return (
      <StaffLoginForm
        title="Admin & Manager Sign In"
        subtitle="Full administrative control for Hiraga Restaurant."
        icon="⚙️"
        lang="en"
        onLoginSuccess={(s) => setSession(s)}
      />
    );
  }

  // Filter dishes by search and category
  const filteredDishes = items
    .filter((it) => {
      if (selectedCatFilter === 'all') return true;
      if (selectedCatFilter === 'uncategorized') return !it.category_id;
      return String(it.category_id) === String(selectedCatFilter);
    })
    .filter((it) => {
      if (!dishSearch.trim()) return true;
      const s = dishSearch.toLowerCase();
      return (
        it.name?.toLowerCase().includes(s) ||
        it.name_am?.toLowerCase().includes(s) ||
        it.description?.toLowerCase().includes(s)
      );
    });

  // Active staff count
  const onDutyCount = staffList.filter((s) => s.active).length;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg, #0b0b0a)', color: 'var(--tx, #f6f3ea)' }}>
      {/* ========================================================================= */}
      {/* 1. MODERN COLLAPSIBLE SIDEBAR                                             */}
      {/* ========================================================================= */}
      <aside
        style={{
          width: 270,
          background: '#121210',
          borderRight: '1px solid var(--bd, #27272a)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          height: '100vh',
          flexShrink: 0,
          padding: '20px 14px',
          boxSizing: 'border-box',
          zIndex: 100,
          transition: 'transform 0.25s ease',
          ...(typeof window !== 'undefined' && window.innerWidth < 860
            ? {
                position: 'fixed',
                transform: mobileNavOpen ? 'translateX(0)' : 'translateX(-100%)',
                boxShadow: mobileNavOpen ? '0 0 50px rgba(0,0,0,0.8)' : 'none',
              }
            : {}),
        }}
      >
        <div>
          {/* Logo & Hotel Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, paddingLeft: 6 }}>
            <img src="/logo.png" alt="Hiraga" style={{ width: 44, height: 44, objectFit: 'contain' }} />
            <div>
              <b style={{ fontSize: '1.1rem', display: 'block', color: 'var(--o)' }}>Hiraga Admin</b>
              <span style={{ fontSize: '.75rem', color: 'var(--mu)' }}>Hotel Management System</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              { id: 'overview', icon: '📊', label: 'Dashboard Overview' },
              { id: 'dishes', icon: '🍽️', label: 'Dishes & Menu', badge: items.length },
              { id: 'categories', icon: '📁', label: 'Categories', badge: cats.length },
              { id: 'staff', icon: '👥', label: 'Staff & Roles', badge: staffList.length },
              { id: 'payments', icon: '💳', label: 'Payments & Banks' },
              { id: 'contacts', icon: '📱', label: 'Social & Contacts' },
              { id: 'qrcodes', icon: '🏷️', label: 'Table QR Cards' },
              { id: 'database', icon: '💾', label: 'Backup & Database' },
            ].map((nav) => {
              const active = currentTab === nav.id;
              return (
                <button
                  key={nav.id}
                  onClick={() => {
                    setCurrentTab(nav.id);
                    setMobileNavOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: 'none',
                    background: active ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                    color: active ? '#fbbf24' : 'var(--tx)',
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '.92rem',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.1rem' }}>{nav.icon}</span> {nav.label}
                  </span>
                  {nav.badge !== undefined && (
                    <span
                      style={{
                        fontSize: '.72rem',
                        background: active ? '#f59e0b' : 'rgba(255,255,255,0.08)',
                        color: active ? '#1a1100' : 'var(--mu)',
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontWeight: 700,
                      }}
                    >
                      {nav.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Station Shortcuts & Auth */}
        <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 16 }}>
          <span style={{ fontSize: '.72rem', color: 'var(--mu)', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 8, paddingLeft: 6 }}>
            Station Portals
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
            <a href="/cashier" target="_blank" className="btn sm x" style={{ fontSize: '.78rem', justifyContent: 'flex-start', padding: '6px 8px' }}>
              💵 Cashier
            </a>
            <a href="/kitchen" target="_blank" className="btn sm x" style={{ fontSize: '.78rem', justifyContent: 'flex-start', padding: '6px 8px' }}>
              👨‍🍳 Kitchen
            </a>
            <a href="/waiter" target="_blank" className="btn sm x" style={{ fontSize: '.78rem', justifyContent: 'flex-start', padding: '6px 8px' }}>
              🛎️ Waiter
            </a>
            <a href="/" target="_blank" className="btn sm x" style={{ fontSize: '.78rem', justifyContent: 'flex-start', padding: '6px 8px' }}>
              🌐 Menu
            </a>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 10, marginBottom: 8 }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
              <span style={{ fontSize: '.78rem', color: 'var(--mu)', display: 'block' }}>Signed in as:</span>
              <b style={{ fontSize: '.82rem' }}>{session.user?.email}</b>
            </div>
            <button
              onClick={() => setShowSecurityModal(true)}
              className="btn sm x"
              style={{ padding: '4px 8px' }}
              title="Password & 2FA"
            >
              🔑
            </button>
          </div>

          <button
            onClick={() => supabase.auth.signOut()}
            className="btn sm x"
            style={{ width: '100%', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 90,
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* 2. MAIN CONTENT AREA                                                      */}
      {/* ========================================================================= */}
      <main style={{ flex: 1, padding: '24px 28px', maxWidth: 1140, boxSizing: 'border-box', overflowY: 'auto' }}>
        {/* Top Header Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="btn sm x"
              style={{ display: typeof window !== 'undefined' && window.innerWidth < 860 ? 'flex' : 'none', padding: '6px 12px' }}
            >
              ☰ Menu
            </button>
            <h1 style={{ margin: 0, fontSize: '1.6rem', color: 'var(--tx)', textTransform: 'capitalize' }}>
              {currentTab === 'overview'
                ? '📊 Dashboard Overview'
                : currentTab === 'dishes'
                ? '🍽️ Dishes & Menu Management'
                : currentTab === 'categories'
                ? '📁 Category Management'
                : currentTab === 'staff'
                ? '👥 Staff & Account Directory'
                : currentTab === 'payments'
                ? '💳 Payment Accounts (Telebirr & CBE)'
                : currentTab === 'contacts'
                ? '📱 Social Media & Hotel Info'
                : currentTab === 'qrcodes'
                ? '🏷️ Table QR Code Generator'
                : '💾 Backup & Database Setup'}
            </h1>
          </div>

          {/* Quick Context Action Button depending on active tab */}
          <div style={{ display: 'flex', gap: 8 }}>
            {currentTab === 'dishes' && (
              <button onClick={openAddDish} className="btn o" style={{ fontWeight: 600 }}>
                ➕ Add New Dish
              </button>
            )}
            {currentTab === 'categories' && (
              <button onClick={() => setShowAddCatModal(true)} className="btn o" style={{ fontWeight: 600 }}>
                ➕ Add Category
              </button>
            )}
            {currentTab === 'staff' && (
              <button onClick={() => setShowAddStaffModal(true)} className="btn o" style={{ fontWeight: 600 }}>
                ➕ Add Staff Member
              </button>
            )}
            {currentTab === 'qrcodes' && (
              <button onClick={() => setShowQrModal(true)} className="btn o" style={{ fontWeight: 600 }}>
                ➕ Generate New QR
              </button>
            )}
          </div>
        </div>

        {/* Global Toast Message */}
        {msg.text && (
          <div
            className={msg.bad ? 'err' : 'ok'}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              marginBottom: 16,
              background: msg.bad ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
              border: `1px solid ${msg.bad ? '#ef4444' : '#22c55e'}`,
              fontWeight: 600,
            }}
          >
            {msg.text}
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 1: DASHBOARD OVERVIEW                                            */}
        {/* ===================================================================== */}
        {currentTab === 'overview' && (
          <div>
            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 24 }}>
              <div className="panel" style={{ margin: 0, padding: 18, background: 'linear-gradient(145deg, #181816, #121210)' }}>
                <span style={{ fontSize: '.85rem', color: 'var(--mu)', display: 'block', marginBottom: 4 }}>🍽️ Menu Dishes</span>
                <b style={{ fontSize: '1.8rem', color: 'var(--o)' }}>{items.length}</b>
                <span style={{ fontSize: '.78rem', color: 'var(--mu)', display: 'block', marginTop: 4 }}>
                  {items.filter((i) => i.available).length} available • {items.filter((i) => !i.available).length} sold out
                </span>
              </div>

              <div className="panel" style={{ margin: 0, padding: 18, background: 'linear-gradient(145deg, #181816, #121210)' }}>
                <span style={{ fontSize: '.85rem', color: 'var(--mu)', display: 'block', marginBottom: 4 }}>📁 Menu Categories</span>
                <b style={{ fontSize: '1.8rem', color: 'var(--g)' }}>{cats.length}</b>
                <span style={{ fontSize: '.78rem', color: 'var(--mu)', display: 'block', marginTop: 4 }}>Active groupings</span>
              </div>

              <div className="panel" style={{ margin: 0, padding: 18, background: 'linear-gradient(145deg, #181816, #121210)' }}>
                <span style={{ fontSize: '.85rem', color: 'var(--mu)', display: 'block', marginBottom: 4 }}>👥 Staff Members</span>
                <b style={{ fontSize: '1.8rem', color: '#60a5fa' }}>{staffList.length}</b>
                <span style={{ fontSize: '.78rem', color: '#4ade80', display: 'block', marginTop: 4 }}>
                  ● {onDutyCount} currently On Duty
                </span>
              </div>

              <div className="panel" style={{ margin: 0, padding: 18, background: 'linear-gradient(145deg, #181816, #121210)' }}>
                <span style={{ fontSize: '.85rem', color: 'var(--mu)', display: 'block', marginBottom: 4 }}>💳 Payment Config</span>
                <b style={{ fontSize: '1.1rem', color: st.telebirr_number ? '#34d399' : '#f87171', display: 'block', marginTop: 6 }}>
                  {st.telebirr_number ? '✓ Telebirr Active' : '⚠ Telebirr Missing'}
                </b>
                <span style={{ fontSize: '.78rem', color: 'var(--mu)', display: 'block', marginTop: 4 }}>
                  {st.cbe_number ? '✓ CBE Active' : '⚠ CBE Missing'}
                </span>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="panel" style={{ marginBottom: 24, padding: 18 }}>
              <b style={{ fontSize: '1.05rem', display: 'block', marginBottom: 12 }}>⚡ Quick Actions (Popup Windows)</b>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={openAddDish} className="btn o" style={{ fontWeight: 600 }}>
                  ➕ Add New Dish
                </button>
                <button onClick={() => setShowAddStaffModal(true)} className="btn" style={{ background: '#3b82f6', color: '#fff', fontWeight: 600 }}>
                  ➕ Add Staff Member
                </button>
                <button onClick={() => setShowAddCatModal(true)} className="btn x" style={{ fontWeight: 600 }}>
                  ➕ Add Category
                </button>
                <button onClick={() => setShowQrModal(true)} className="btn x" style={{ fontWeight: 600 }}>
                  🏷️ Generate Table QR
                </button>
              </div>
            </div>

            {/* Overview Recent Dishes & Staff Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18 }}>
              {/* Dishes snippet */}
              <div className="panel" style={{ margin: 0, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <b style={{ fontSize: '1.02rem' }}>🍽️ Recent Dishes</b>
                  <button onClick={() => setCurrentTab('dishes')} className="btn sm x" style={{ fontSize: '.78rem' }}>
                    View All ({items.length}) →
                  </button>
                </div>
                {items.slice(0, 5).map((it) => (
                  <div key={it.id} className="al" style={{ padding: '8px 0' }}>
                    {it.image_url ? <img src={it.image_url} alt="" /> : <div className="ph" style={{ fontSize: 18 }}>🍽️</div>}
                    <div>
                      <b style={{ fontSize: '.92rem' }}>{it.name}</b>
                      <div className="sm">{it.price} ETB</div>
                    </div>
                    <button onClick={() => toggle(it)} className={`btn sm ${it.available ? 'x' : 'danger'}`} style={{ fontSize: '.75rem' }}>
                      {it.available ? 'Available' : 'Sold Out'}
                    </button>
                  </div>
                ))}
              </div>

              {/* Staff snippet */}
              <div className="panel" style={{ margin: 0, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <b style={{ fontSize: '1.02rem' }}>👥 Active Staff Roster</b>
                  <button onClick={() => setCurrentTab('staff')} className="btn sm x" style={{ fontSize: '.78rem' }}>
                    Manage Staff ({staffList.length}) →
                  </button>
                </div>
                {staffList.slice(0, 5).map((s) => (
                  <div key={s.id} className="al" style={{ padding: '8px 0' }}>
                    <div style={{ fontSize: '1.3rem' }}>
                      {s.role === 'chef' ? '👨‍🍳' : s.role === 'waiter' ? '🛎️' : s.role === 'cashier' ? '💵' : '👔'}
                    </div>
                    <div>
                      <b style={{ fontSize: '.92rem' }}>{s.name}</b>
                      <div className="sm">{s.email}</div>
                    </div>
                    <span style={{ fontSize: '.75rem', color: s.active ? '#4ade80' : '#ef4444', fontWeight: 600 }}>
                      {s.active ? '● On Duty' : '○ Off Duty'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 2: DISHES & MENU MANAGEMENT                                       */}
        {/* ===================================================================== */}
        {currentTab === 'dishes' && (
          <div>
            {/* Filter Bar */}
            <div className="panel" style={{ padding: '14px 16px', marginBottom: 18, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 260 }}>
                <input
                  placeholder="🔍 Search dishes by name..."
                  value={dishSearch}
                  onChange={(e) => setDishSearch(e.target.value)}
                  style={{ margin: 0, flex: 2 }}
                />
                <select
                  value={selectedCatFilter}
                  onChange={(e) => setSelectedCatFilter(e.target.value)}
                  style={{ margin: 0, flex: 1 }}
                >
                  <option value="all">All Categories ({items.length})</option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                  <option value="uncategorized">Uncategorized</option>
                </select>
              </div>
              <button onClick={openAddDish} className="btn o" style={{ fontWeight: 600 }}>
                ➕ Add New Dish
              </button>
            </div>

            {/* Dishes List */}
            <div className="panel" style={{ padding: 16 }}>
              {filteredDishes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <p className="empty" style={{ margin: '0 0 12px' }}>No dishes found matching your filter.</p>
                  <button onClick={openAddDish} className="btn o">➕ Add the First Dish</button>
                </div>
              ) : (
                filteredDishes.map((i) => (
                  <div className="al" key={i.id} style={{ opacity: i.available ? 1 : 0.6, padding: '12px 0' }}>
                    {i.image_url ? <img src={i.image_url} alt="" /> : <div className="ph">🍽️</div>}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <b>{i.name}</b>
                        {i.name_am && <span style={{ color: 'var(--mu)', fontSize: '.85rem' }}>/ {i.name_am}</span>}
                        {i.special && (
                          <span style={{ fontSize: '.72rem', background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', padding: '2px 6px', borderRadius: 4 }}>
                            ⭐ Special
                          </span>
                        )}
                      </div>
                      <div className="sm" style={{ color: 'var(--o)', fontWeight: 700, margin: '2px 0' }}>
                        {Number(i.price).toLocaleString()} ETB
                      </div>
                      {i.description && <div className="sm">{i.description}</div>}
                    </div>

                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn x sm" onClick={() => reorder('items', items, i, -1, (r) => r.category_id)} title="Move up">
                        ↑
                      </button>
                      <button className="btn x sm" onClick={() => reorder('items', items, i, 1, (r) => r.category_id)} title="Move down">
                        ↓
                      </button>
                      <button className={`btn sm ${i.available ? 'x' : 'o'}`} onClick={() => toggle(i)}>
                        {i.available ? 'Sold Out' : 'Available'}
                      </button>
                      <button className="btn sm x" onClick={() => openEditDish(i)}>
                        Edit
                      </button>
                      <button className="btn sm x" style={{ color: '#ef4444' }} onClick={() => del(i)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 3: CATEGORIES                                                     */}
        {/* ===================================================================== */}
        {currentTab === 'categories' && (
          <div>
            <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div>
                <b style={{ fontSize: '1.05rem' }}>Categories ({cats.length})</b>
                <p className="sm" style={{ margin: '2px 0 0' }}>Manage menu categories and sorting order.</p>
              </div>
              <button onClick={() => setShowAddCatModal(true)} className="btn o">
                ➕ Add Category
              </button>
            </div>

            <div className="panel" style={{ padding: 16 }}>
              {cats.length === 0 ? (
                <p className="empty">No categories yet. Click "Add Category" above.</p>
              ) : (
                cats.map((c) => (
                  <div className="al" key={c.id}>
                    <div>
                      <b>{c.name}</b>
                      {c.name_am && <span style={{ color: 'var(--mu)', marginLeft: 8 }}>/ {c.name_am}</span>}
                      <span className="sm" style={{ display: 'block', color: 'var(--mu)' }}>
                        {items.filter((it) => it.category_id === c.id).length} dishes
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn x sm" onClick={() => reorder('categories', cats, c, -1, () => 0)}>
                        ↑
                      </button>
                      <button className="btn x sm" onClick={() => reorder('categories', cats, c, 1, () => 0)}>
                        ↓
                      </button>
                      <button className="btn x sm" style={{ color: '#ef4444' }} onClick={() => delCat(c)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 4: STAFF MANAGEMENT                                              */}
        {/* ===================================================================== */}
        {currentTab === 'staff' && (
          <div>
            <div className="panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
              <div>
                <b style={{ fontSize: '1.05rem' }}>Staff Directory ({staffList.length})</b>
                <p className="sm" style={{ margin: '2px 0 0' }}>Accounts for Chefs, Waiters, and Cashiers.</p>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 4 }}>
                  {['all', 'chef', 'waiter', 'cashier'].map((r) => (
                    <button
                      key={r}
                      onClick={() => setStaffFilter(r)}
                      className={`btn sm ${staffFilter === r ? 'o' : 'x'}`}
                      style={{ fontSize: '.75rem', padding: '3px 8px' }}
                    >
                      {r === 'all' ? 'All' : r === 'chef' ? '👨‍🍳 Chefs' : r === 'waiter' ? '🛎️ Waiters' : '💵 Cashiers'}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowAddStaffModal(true)} className="btn o" style={{ fontWeight: 600 }}>
                  ➕ Add Staff Member
                </button>
              </div>
            </div>

            <div className="panel" style={{ padding: 16 }}>
              {staffList.filter((s) => staffFilter === 'all' || s.role === staffFilter).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 0' }}>
                  <p className="empty" style={{ margin: '0 0 12px' }}>No staff members registered in this category.</p>
                  <button onClick={() => setShowAddStaffModal(true)} className="btn o">➕ Add Staff Member</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {staffList
                    .filter((s) => staffFilter === 'all' || s.role === staffFilter)
                    .map((member) => (
                      <div
                        key={member.id}
                        className="al"
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--bd)',
                          borderRadius: 12,
                          padding: '12px 16px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <span style={{ fontSize: '1.6rem', background: 'rgba(255, 255, 255, 0.05)', padding: 10, borderRadius: 10 }}>
                            {member.role === 'chef' ? '👨‍🍳' : member.role === 'waiter' ? '🛎️' : member.role === 'cashier' ? '💵' : '👔'}
                          </span>
                          <div>
                            <b style={{ fontSize: '1rem' }}>{member.name}</b>
                            <div style={{ fontSize: '.84rem', color: 'var(--mu)', display: 'flex', gap: 10, marginTop: 2 }}>
                              <span>{member.email}</span>
                              {member.phone && <span>• 📞 {member.phone}</span>}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              fontSize: '.75rem',
                              fontWeight: 700,
                              padding: '3px 10px',
                              borderRadius: 999,
                              textTransform: 'uppercase',
                              background:
                                member.role === 'chef'
                                  ? 'rgba(59, 130, 246, 0.2)'
                                  : member.role === 'waiter'
                                  ? 'rgba(139, 92, 246, 0.2)'
                                  : member.role === 'cashier'
                                  ? 'rgba(16, 185, 129, 0.2)'
                                  : 'rgba(245, 158, 11, 0.2)',
                              color:
                                member.role === 'chef'
                                  ? '#60a5fa'
                                  : member.role === 'waiter'
                                  ? '#a78bfa'
                                  : member.role === 'cashier'
                                  ? '#34d399'
                                  : '#fbbf24',
                            }}
                          >
                            {member.role}
                          </span>

                          <button
                            onClick={() => toggleStaffStatus(member)}
                            className={`btn sm ${member.active ? 'ok' : 'x'}`}
                            style={{ fontSize: '.75rem' }}
                          >
                            {member.active ? '● On Duty' : '○ Off Duty'}
                          </button>

                          <button
                            onClick={() => deleteStaffMember(member)}
                            className="btn sm x"
                            style={{ fontSize: '.75rem', color: '#ef4444' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 5: PAYMENTS & BANK ACCOUNTS                                       */}
        {/* ===================================================================== */}
        {currentTab === 'payments' && (
          <form className="panel" onSubmit={saveInfo} style={{ padding: 22 }}>
            <h2 style={{ marginTop: 0 }}>Payment Accounts (Telebirr & CBE)</h2>
            <p className="sm">Set up payment accounts shown to customers during digital checkout.</p>

            <h3 style={{ fontSize: '1.1rem', color: 'var(--o)', margin: '16px 0 8px' }}>📱 Telebirr Account</h3>
            <div className="row">
              <input
                placeholder="Telebirr Account Name (e.g. Hiraga Hotel)"
                value={st.telebirr_name || ''}
                onChange={(e) => setSt({ ...st, telebirr_name: e.target.value })}
              />
              <input
                placeholder="Telebirr Number (e.g. 0911223344)"
                value={st.telebirr_number || ''}
                onChange={(e) => setSt({ ...st, telebirr_number: e.target.value })}
              />
            </div>

            <h3 style={{ fontSize: '1.1rem', color: 'var(--b)', margin: '16px 0 8px' }}>🏦 Commercial Bank of Ethiopia (CBE)</h3>
            <div className="row">
              <input
                placeholder="CBE Account Name (e.g. Hiraga Restaurant PLC)"
                value={st.cbe_name || ''}
                onChange={(e) => setSt({ ...st, cbe_name: e.target.value })}
              />
              <input
                placeholder="CBE Account Number (e.g. 1000123456789)"
                value={st.cbe_number || ''}
                onChange={(e) => setSt({ ...st, cbe_number: e.target.value })}
              />
            </div>

            <h3 style={{ fontSize: '1.1rem', margin: '16px 0 8px' }}>Payment Instructions (Optional)</h3>
            <textarea
              rows={3}
              placeholder="e.g. Please put your table number in the transfer reason and upload the receipt screenshot."
              value={st.payment_instructions || ''}
              onChange={(e) => setSt({ ...st, payment_instructions: e.target.value })}
            />

            <button type="submit" className="btn o" style={{ marginTop: 14 }}>
              Save Payment Accounts
            </button>
          </form>
        )}

        {/* ===================================================================== */}
        {/* TAB 6: SOCIAL MEDIA & CONTACTS                                        */}
        {/* ===================================================================== */}
        {currentTab === 'contacts' && (
          <form className="panel" onSubmit={saveInfo} style={{ padding: 22 }}>
            <h2 style={{ marginTop: 0 }}>Restaurant Contacts & Hypermedia</h2>
            <p className="sm">These links render interactive vector icons on the customer digital menu.</p>

            <div className="row">
              <input placeholder="Phone (e.g. 0911223344)" value={st.phone || ''} onChange={(e) => setSt({ ...st, phone: e.target.value })} />
              <input placeholder="Telegram (e.g. @hiragarestaurant)" value={st.telegram || ''} onChange={(e) => setSt({ ...st, telegram: e.target.value })} />
            </div>

            <div className="row">
              <input placeholder="WhatsApp (e.g. +251911223344)" value={st.whatsapp || ''} onChange={(e) => setSt({ ...st, whatsapp: e.target.value })} />
              <input placeholder="TikTok (e.g. @hiragahotel)" value={st.tiktok || ''} onChange={(e) => setSt({ ...st, tiktok: e.target.value })} />
            </div>

            <div className="row">
              <input placeholder="Instagram (e.g. hiragarestaurant)" value={st.instagram || ''} onChange={(e) => setSt({ ...st, instagram: e.target.value })} />
              <input placeholder="Facebook (e.g. hiragarestaurant)" value={st.facebook || ''} onChange={(e) => setSt({ ...st, facebook: e.target.value })} />
            </div>

            <div className="row">
              <input placeholder="Google Maps link" value={st.map_url || ''} onChange={(e) => setSt({ ...st, map_url: e.target.value })} />
              <input placeholder="Website URL (e.g. https://hiragahotel.com)" value={st.website || ''} onChange={(e) => setSt({ ...st, website: e.target.value })} />
            </div>

            <h3 style={{ fontSize: '1.1rem', margin: '16px 0 8px' }}>Tagline & Operating Hours</h3>
            <div className="row">
              <input placeholder="Tagline" value={st.tagline || ''} onChange={(e) => setSt({ ...st, tagline: e.target.value })} />
              <input placeholder="Tagline in Amharic" value={st.tagline_am || ''} onChange={(e) => setSt({ ...st, tagline_am: e.target.value })} />
            </div>
            <textarea
              rows={3}
              placeholder={'Opening hours, e.g.\nMon-Sat 7:00-22:00\nSun 8:00-21:00'}
              value={st.hours || ''}
              onChange={(e) => setSt({ ...st, hours: e.target.value })}
            />

            <button type="submit" className="btn o" style={{ marginTop: 14 }}>
              Save Contact Details
            </button>
          </form>
        )}

        {/* ===================================================================== */}
        {/* TAB 7: TABLE QR CARDS                                                 */}
        {/* ===================================================================== */}
        {currentTab === 'qrcodes' && (
          <div className="panel" style={{ padding: 22 }}>
            <h2 style={{ marginTop: 0 }}>Table QR Cards</h2>
            <p className="sm">Generate and print high-resolution QR cards for each dining table.</p>

            <div className="row" style={{ maxWidth: 440 }}>
              <input
                placeholder="Table number (leave empty for general QR)"
                value={tbl}
                onChange={(e) => setTbl(e.target.value)}
              />
              <button className="btn o" onClick={makeQr}>
                Generate QR
              </button>
            </div>

            {qr.img && (
              <div style={{ textAlign: 'center', marginTop: 20, background: 'rgba(255,255,255,0.02)', padding: 20, borderRadius: 16 }}>
                <img src={qr.img} alt="QR code" style={{ background: '#fff', borderRadius: 14, width: 220 }} />
                <p className="sm" style={{ margin: '8px 0 14px' }}>{qr.url}</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <a className="btn" href={qr.img} download={`hiraga-qr${tbl ? '-table-' + tbl : ''}.png`}>
                    Download PNG
                  </a>
                  <button className="btn o" onClick={printCard}>
                    Print Table Card
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================== */}
        {/* TAB 8: BACKUP & DATABASE SETUP                                        */}
        {/* ===================================================================== */}
        {currentTab === 'database' && (
          <div>
            <div className="panel" style={{ padding: 22, marginBottom: 18 }}>
              <h2 style={{ marginTop: 0 }}>Weekly System Backup</h2>
              <p className="sm">Download all categories, dishes, and restaurant settings as a single JSON backup file.</p>
              <button className="btn x" onClick={backup}>
                📥 Download Backup
              </button>
            </div>

            <div className="panel" style={{ padding: 22 }}>
              <h2 style={{ marginTop: 0 }}>Database Orders & Staff SQL Schema</h2>
              <p className="sm">Run this SQL script in your Supabase SQL Editor if you ever need to reset or migrate.</p>
              <pre
                style={{
                  background: '#090907',
                  border: '1px solid var(--bd)',
                  borderRadius: 12,
                  padding: 14,
                  fontSize: '.78rem',
                  overflowX: 'auto',
                  maxHeight: 220,
                }}
              >
                {ordersSql}
              </pre>
              <button className="btn sm o" style={{ marginTop: 10 }} onClick={copySql}>
                {copiedSql ? '✓ Copied SQL to Clipboard!' : '📋 Copy SQL Script'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* 3. POPUP MODALS                                                           */}
      {/* ========================================================================= */}

      {/* MODAL 1: ADD STAFF MEMBER POPUP */}
      {showAddStaffModal && (
        <div style={modalBackdropStyle}>
          <div style={modalCardStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--tx)' }}>➕ Add Staff Member</h2>
                <span style={{ fontSize: '.8rem', color: 'var(--mu)' }}>አዲስ የሰራተኛ መለያ መፍጠሪያ</span>
              </div>
              <button onClick={() => setShowAddStaffModal(false)} className="btn sm x">✕</button>
            </div>

            <form onSubmit={createStaffAccount}>
              <label style={labelStyle}>Staff Full Name (ሙሉ ስም) *</label>
              <input
                required
                autoFocus
                placeholder="e.g. Abebe Bikila"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                style={{ width: '100%', marginBottom: 12 }}
              />

              <label style={labelStyle}>Role / Position (የስራ ድርሻ) *</label>
              <select
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value)}
                style={{ width: '100%', marginBottom: 12 }}
              >
                <option value="chef">👨‍🍳 Head Chef / Kitchen (KDS)</option>
                <option value="waiter">🛎️ Waiter / Table Service</option>
                <option value="cashier">💵 Cashier Desk / POS</option>
                <option value="manager">👔 Hotel Manager / Admin</option>
              </select>

              <label style={labelStyle}>Email Address (መግቢያ ኢሜይል) *</label>
              <input
                type="email"
                required
                placeholder="staff@hiraga.com"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                style={{ width: '100%', marginBottom: 12 }}
              />

              <label style={labelStyle}>Password (የይለፍ ቃል - ቢያንስ 6 ፊደላት) *</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={staffPassword}
                onChange={(e) => setStaffPassword(e.target.value)}
                style={{ width: '100%', marginBottom: 12 }}
              />

              <label style={labelStyle}>Phone Number (ስልክ ቁጥር - አማራጭ)</label>
              <input
                placeholder="0911223344"
                value={staffPhone}
                onChange={(e) => setStaffPhone(e.target.value)}
                style={{ width: '100%', marginBottom: 16 }}
              />

              {staffMsg.text && (
                <p className={staffMsg.bad ? 'err' : 'ok'} style={{ marginBottom: 14 }}>
                  {staffMsg.text}
                </p>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAddStaffModal(false)} className="btn x">
                  Cancel
                </button>
                <button type="submit" disabled={busyStaff} className="btn o">
                  {busyStaff ? 'Creating...' : '➕ Create Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT DISH POPUP */}
      {showDishModal && (
        <div style={modalBackdropStyle}>
          <div style={{ ...modalCardStyle, maxWidth: 640 }}>
            <div style={modalHeaderStyle}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--tx)' }}>
                  {editId ? '✏️ Edit Dish' : '➕ Add New Dish'}
                </h2>
                <span style={{ fontSize: '.8rem', color: 'var(--mu)' }}>
                  {editId ? 'ምግቡን አድስ' : 'አዲስ ምግብ ወደ ሜኑ ጨምር'}
                </span>
              </div>
              <button onClick={() => setShowDishModal(false)} className="btn sm x">✕</button>
            </div>

            <form onSubmit={saveDish}>
              <div className="row">
                <div>
                  <label style={labelStyle}>Dish Name (English) *</label>
                  <input
                    required
                    autoFocus
                    placeholder="e.g. Special Beef Tibbs"
                    value={f.name}
                    onChange={(e) => setF({ ...f, name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Dish Name in Amharic (ስም በአማርኛ)</label>
                  <input
                    placeholder="ምሳሌ፡ የበሬ ልዩ ጥብስ"
                    value={f.name_am}
                    onChange={(e) => setF({ ...f, name_am: e.target.value })}
                  />
                </div>
              </div>

              <div className="row">
                <div>
                  <label style={labelStyle}>Price in ETB (ዋጋ) *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="any"
                    placeholder="450"
                    value={f.price}
                    onChange={(e) => setF({ ...f, price: e.target.value })}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Category (ምድብ)</label>
                  <select
                    value={f.category_id}
                    onChange={(e) => setF({ ...f, category_id: e.target.value })}
                  >
                    <option value="">No category</option>
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.name_am ? `/ ${c.name_am}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Description (English)</label>
                <textarea
                  rows={2}
                  placeholder="Ingredients, preparation details..."
                  value={f.description}
                  onChange={(e) => setF({ ...f, description: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Description in Amharic (መግለጫ በአማርኛ)</label>
                <textarea
                  rows={2}
                  placeholder="የምግቡ ዝርዝር..."
                  value={f.description_am}
                  onChange={(e) => setF({ ...f, description_am: e.target.value })}
                />
              </div>

              {/* Photo upload */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Dish Photo (ፎቶ)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files[0] || null)}
                />
                {f.image_url && !file && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                    <img src={f.image_url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />
                    <span className="sm">Existing photo attached. Upload new file to replace.</span>
                  </div>
                )}
              </div>

              {/* Tags & Special */}
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Dietary Tags & Chef's Special</label>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 4 }}>
                  {TAGS.map((t) => (
                    <label key={t.k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.85rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        style={{ width: 'auto', margin: 0 }}
                        checked={(f.tags || []).includes(t.k)}
                        onChange={(e) =>
                          setF({
                            ...f,
                            tags: e.target.checked
                              ? [...(f.tags || []), t.k]
                              : (f.tags || []).filter((x) => x !== t.k),
                          })
                        }
                      />
                      {t.en}
                    </label>
                  ))}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.85rem', cursor: 'pointer', color: 'var(--o)', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      style={{ width: 'auto', margin: 0 }}
                      checked={!!f.special}
                      onChange={(e) => setF({ ...f, special: e.target.checked })}
                    />
                    ⭐ Today's Special
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowDishModal(false)} className="btn x">
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="btn o">
                  {busy ? 'Saving...' : editId ? 'Update Dish' : 'Add Dish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD CATEGORY POPUP */}
      {showAddCatModal && (
        <div style={modalBackdropStyle}>
          <div style={modalCardStyle}>
            <div style={modalHeaderStyle}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--tx)' }}>➕ Add Category</h2>
              <button onClick={() => setShowAddCatModal(false)} className="btn sm x">✕</button>
            </div>

            <form onSubmit={addCat}>
              <label style={labelStyle}>Category Name (English) *</label>
              <input
                required
                autoFocus
                placeholder="e.g. Traditional Dishes"
                value={newCat.name}
                onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                style={{ width: '100%', marginBottom: 12 }}
              />

              <label style={labelStyle}>Category Name in Amharic (ስም በአማርኛ)</label>
              <input
                placeholder="ምሳሌ፡ የባህል ምግቦች"
                value={newCat.name_am}
                onChange={(e) => setNewCat({ ...newCat, name_am: e.target.value })}
                style={{ width: '100%', marginBottom: 18 }}
              />

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAddCatModal(false)} className="btn x">
                  Cancel
                </button>
                <button type="submit" className="btn o">
                  Add Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: GENERATE TABLE QR POPUP */}
      {showQrModal && (
        <div style={modalBackdropStyle}>
          <div style={modalCardStyle}>
            <div style={modalHeaderStyle}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--tx)' }}>🏷️ Generate Table QR Card</h2>
              <button onClick={() => setShowQrModal(false)} className="btn sm x">✕</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Table Number (or leave blank for General menu QR)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  autoFocus
                  placeholder="e.g. 5"
                  value={tbl}
                  onChange={(e) => setTbl(e.target.value)}
                  style={{ flex: 1, margin: 0 }}
                />
                <button className="btn o" onClick={makeQr}>Generate</button>
              </div>
            </div>

            {qr.img && (
              <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 12 }}>
                <img src={qr.img} alt="QR code" style={{ background: '#fff', borderRadius: 12, width: 200 }} />
                <p className="sm" style={{ margin: '8px 0 12px' }}>{qr.url}</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <a className="btn sm" href={qr.img} download={`hiraga-qr${tbl ? '-table-' + tbl : ''}.png`}>
                    Download PNG
                  </a>
                  <button className="btn sm o" onClick={printCard}>
                    Print Table Card
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 5: 100% FREE STAFF SECURITY & 2FA MODAL */}
      <StaffSecurityModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        session={session}
        lang="en"
      />
    </div>
  );
}

// Inline Styles for Modern Glassmorphic Modals
const modalBackdropStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.82)',
  backdropFilter: 'blur(6px)',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
};

const modalCardStyle = {
  background: '#141412',
  border: '1px solid var(--bd, #27272a)',
  borderRadius: 18,
  maxWidth: 540,
  width: '100%',
  maxHeight: '92vh',
  overflowY: 'auto',
  padding: 24,
  boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
};

const modalHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: 18,
  paddingBottom: 12,
  borderBottom: '1px solid var(--bd, #27272a)',
};

const labelStyle = {
  fontSize: '.82rem',
  color: 'var(--mu, #9d9a8e)',
  display: 'block',
  marginBottom: 4,
  fontWeight: 600,
};
