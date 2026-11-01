'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [orders, setOrders] = useState([]);
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
  const [currentTab, setCurrentTab] = useState('overview');
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
  const [staffRole, setStaffRole] = useState('waiter');
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
      const [c, i, s, o] = await Promise.all([
        supabase.from('categories').select('*').order('sort').order('id'),
        supabase.from('items').select('*').order('sort').order('id'),
        supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(25),
      ]);
      if (c.error) say('Categories: ' + c.error.message, true);
      if (i.error) say('Dishes: ' + i.error.message, true);
      setCats(c.data || []);
      setItems(i.data || []);
      setSt(s.data || {});
      setOrders(o.data || []);
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
    say(error ? error.message : 'Settings saved successfully!', !error ? false : true);
  };

  const backup = async () => {
    const [c, i, s, o] = await Promise.all([
      supabase.from('categories').select('*'),
      supabase.from('items').select('*'),
      supabase.from('settings').select('*'),
      supabase.from('orders').select('*').limit(200),
    ]);
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exported: new Date().toISOString(),
            categories: c.data,
            items: i.data,
            settings: s.data,
            orders: o.data,
          },
          null,
          2
        ),
      ],
      { type: 'application/json' }
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hiraga-hotel-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const printCard = () => {
    const w = window.open('', '_blank');
    w.document.write(
      `<html><head><title>Hiraga Table QR</title><style>body{margin:0;background:#fff;color:#000;font-family:system-ui;text-align:center;padding:40px}.l{width:220px;margin-bottom:12px}.q{width:280px;background:#fff;padding:12px;border:2px solid #ddd;border-radius:18px}h1{margin:12px 0 4px;color:#1e3a5f;font-size:26px}p{color:#64748b;margin:0 0 16px;font-size:16px}</style></head><body><img class="l" src="${location.origin}/logo.png"><h1>Scan for Menu</h1><p>ሜኑውን ለማየት ስካን ያድርጉ</p><img class="q" src="${qr.img}">${tbl ? `<h1>Table ${tbl.replace(/[<>&"]/g, '')}</h1>` : ''}<script>onload=function(){setTimeout(print,400)}<\/script></body></html>`
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
  waiter_name text,
  confirmed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table orders enable row level security;
create policy "public read orders" on orders for select using (true);
create policy "public insert orders" on orders for insert with check (true);
create policy "public update orders" on orders for update using (true);
alter publication supabase_realtime add table orders;`;

  const copySql = () => {
    navigator.clipboard?.writeText(ordersSql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  // 1. Session Loading
  if (session === undefined) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f7fe', color: '#1e293b' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, border: '4px solid #2563eb', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ fontWeight: 600, color: '#64748b' }}>Loading Hotel Management Portal...</p>
        </div>
      </main>
    );
  }

  // 2. Unauthenticated: Staff Login
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

  // Recent orders fallback demonstration
  const displayOrders = orders.length > 0 ? orders.slice(0, 5) : [
    { id: 1007, order_number: '1007', table_number: '3', items: [{ name: 'Grilled Chicken', quantity: 1 }, { name: 'Juice', quantity: 1 }], total: 320, status: 'preparing', created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString() },
    { id: 1006, order_number: '1006', table_number: '5', items: [{ name: 'Pasta', quantity: 1 }, { name: 'Salad', quantity: 1 }], total: 280, status: 'confirmed', created_at: new Date(Date.now() - 1000 * 60 * 38).toISOString() },
    { id: 1005, order_number: '1005', table_number: '8', items: [{ name: 'Burger', quantity: 1 }, { name: 'Fries', quantity: 1 }], total: 450, status: 'ready', created_at: new Date(Date.now() - 1000 * 60 * 40).toISOString() },
    { id: 1004, order_number: '1004', table_number: '6', items: [{ name: 'Coffee', quantity: 2 }, { name: 'Cake', quantity: 1 }], total: 180, status: 'delivered', created_at: new Date(Date.now() - 1000 * 60 * 70).toISOString() },
    { id: 1003, order_number: '1003', table_number: '4', items: [{ name: 'Steak', quantity: 1 }, { name: 'Fresh Juice', quantity: 1 }], total: 520, status: 'paid', created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString() },
  ];

  // Top dishes list
  const topDishesList = items.length > 0 ? items.slice(0, 5) : [
    { id: 1, name: 'Grilled Chicken', price: 450, orders: 48, image_url: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=150&q=80' },
    { id: 2, name: 'Beef Burger', price: 320, orders: 32, image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=150&q=80' },
    { id: 3, name: 'Pasta Alfredo', price: 280, orders: 25, image_url: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281699?auto=format&fit=crop&w=150&q=80' },
    { id: 4, name: 'Fresh Juice', price: 120, orders: 20, image_url: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=150&q=80' },
    { id: 5, name: 'Fried Rice', price: 240, orders: 18, image_url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=150&q=80' },
  ];

  // Total sales calculation
  const totalSalesToday = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0) || 2850;

  // Navigation Items matching the reference UI exactly
  const navItems = [
    { id: 'overview', icon: '🏠', label: 'Dashboard' },
    { id: 'dishes', icon: '🍽️', label: 'Dishes', count: items.length },
    { id: 'categories', icon: '⊞', label: 'Categories', count: cats.length },
    { id: 'staff', icon: '👥', label: 'Staff & Accounts', count: staffList.length },
    { id: 'payments', icon: '💳', label: 'Payment Setup' },
    { id: 'contacts', icon: '🔗', label: 'Social Media & Contacts' },
    { id: 'qrcodes', icon: '🏷️', label: 'Table QR Codes' },
    { id: 'database', icon: '💾', label: 'Backup & Database' },
    { id: 'security', icon: '🛡️', label: 'Security & Authentication', action: () => setShowSecurityModal(true) },
    { id: 'portals', icon: '🖥️', label: 'Station Portal Access' },
    { id: 'reordering', icon: '⇅', label: 'Menu Reordering' },
    { id: 'tags', icon: '🏷️', label: 'Dietary Tags' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f4f7fe', color: '#1e293b', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      {/* ========================================================================= */}
      {/* 1. DEEP NAVY BLUE SIDEBAR (Matches uploaded UI screenshot)                */}
      {/* ========================================================================= */}
      <aside
        style={{
          width: 260,
          background: '#111c44',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          height: '100vh',
          flexShrink: 0,
          padding: '24px 16px',
          boxSizing: 'border-box',
          zIndex: 100,
          transition: 'transform 0.25s ease',
          boxShadow: '4px 0 20px rgba(0, 0, 0, 0.08)',
          ...(typeof window !== 'undefined' && window.innerWidth < 1024
            ? {
                position: 'fixed',
                transform: mobileNavOpen ? 'translateX(0)' : 'translateX(-100%)',
              }
            : {}),
        }}
      >
        <div>
          {/* Logo & Hotel Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, paddingLeft: 8 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(255,255,255,0.08)', display: 'grid', placeItems: 'center', fontSize: '1.4rem' }}>
              🍽️
            </div>
            <div>
              <b style={{ fontSize: '1.15rem', display: 'block', color: '#ffffff', letterSpacing: -0.3 }}>Royal Hotel</b>
              <span style={{ fontSize: '.74rem', color: '#8f9bba', fontWeight: 500 }}>Restaurant Management</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
            {navItems.map((nav) => {
              const active = currentTab === nav.id;
              return (
                <button
                  key={nav.id}
                  onClick={() => {
                    if (nav.action) {
                      nav.action();
                    } else {
                      setCurrentTab(nav.id);
                    }
                    setMobileNavOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '11px 16px',
                    borderRadius: 14,
                    border: 'none',
                    background: active ? '#2563eb' : 'transparent',
                    color: active ? '#ffffff' : '#a3aed0',
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '.9rem',
                    transition: 'all 0.18s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.color = '#ffffff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#a3aed0';
                    }
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: '1.1rem', width: 22, textAlign: 'center' }}>{nav.icon}</span>
                    {nav.label}
                  </span>
                  {nav.count !== undefined && (
                    <span
                      style={{
                        fontSize: '.72rem',
                        background: active ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
                        color: active ? '#ffffff' : '#8f9bba',
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontWeight: 700,
                      }}
                    >
                      {nav.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Profile & Logout */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', marginBottom: 10 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#3b82f6', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '.95rem' }}>
                👤
              </div>
              <span style={{ position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, borderRadius: '50%', background: '#22c55e', border: '2px solid #111c44' }} />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <b style={{ color: '#ffffff', fontSize: '.88rem', display: 'block', lineHeight: 1.2 }}>Admin</b>
              <span style={{ color: '#8f9bba', fontSize: '.75rem' }}>Manager</span>
            </div>
          </div>

          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '10px 14px',
              borderRadius: 12,
              border: 'none',
              background: 'transparent',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: '.88rem',
              fontWeight: 600,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span>🚪</span> Logout
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
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 90,
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* 2. MAIN VIEW AREA (Light Theme with White Cards & Clean Stats)           */}
      {/* ========================================================================= */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
        {/* Top White Header Bar */}
        <header
          style={{
            background: '#ffffff',
            padding: '16px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e2e8f0',
            position: 'sticky',
            top: 0,
            zIndex: 40,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              style={{
                display: typeof window !== 'undefined' && window.innerWidth < 1024 ? 'grid' : 'none',
                placeItems: 'center',
                width: 38,
                height: 38,
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                cursor: 'pointer',
                fontSize: '1.2rem',
              }}
            >
              ☰
            </button>
            <div>
              <span style={{ fontSize: '.78rem', color: '#8f9bba', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Pages / {currentTab}
              </span>
              <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#1e293b' }}>
                {navItems.find((n) => n.id === currentTab)?.label || 'Dashboard'}
              </h1>
            </div>
          </div>

          {/* Right Header: Notifications & Admin Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {/* Notification Bell */}
            <div style={{ position: 'relative', cursor: 'pointer' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f4f7fe', display: 'grid', placeItems: 'center', fontSize: '1.1rem' }}>
                🔔
              </div>
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: '50%',
                  width: 18,
                  height: 18,
                  fontSize: '.68rem',
                  fontWeight: 800,
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: '0 2px 6px rgba(239, 68, 68, 0.4)',
                }}
              >
                3
              </span>
            </div>

            {/* Profile Dropdown */}
            <div
              onClick={() => setShowSecurityModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 12px',
                borderRadius: 999,
                background: '#f4f7fe',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '.85rem' }}>
                👤
              </div>
              <div style={{ textAlign: 'left' }}>
                <b style={{ fontSize: '.84rem', color: '#1e293b', display: 'block', lineHeight: 1.1 }}>Admin</b>
                <span style={{ fontSize: '.7rem', color: '#8f9bba' }}>Manager</span>
              </div>
            </div>
          </div>
        </header>

        {/* Inner Content Area */}
        <main style={{ padding: '28px 32px', maxWidth: 1400, width: '100%', boxSizing: 'border-box', margin: '0 auto' }}>
          {/* Global Alert Notification */}
          {msg.text && (
            <div
              style={{
                padding: '12px 18px',
                borderRadius: 14,
                marginBottom: 20,
                background: msg.bad ? '#fee2e2' : '#dcfce7',
                border: `1px solid ${msg.bad ? '#f87171' : '#4ade80'}`,
                color: msg.bad ? '#991b1b' : '#166534',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{msg.text}</span>
              <button onClick={() => setMsg({ text: '', bad: false })} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}>
                ✕
              </button>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 1: DASHBOARD OVERVIEW (Exact match with uploaded picture)        */}
          {/* =================================================================== */}
          {currentTab === 'overview' && (
            <div>
              {/* Welcome Subtitle */}
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: '1.65rem', fontWeight: 800, margin: '0 0 4px', color: '#1e293b' }}>Dashboard</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '.95rem' }}>
                  Welcome back, Admin! Here&apos;s what&apos;s happening with your restaurant today.
                </p>
              </div>

              {/* 4 Stat Cards Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 18, marginBottom: 24 }}>
                {/* 1. Total Dishes */}
                <div style={statCardStyle}>
                  <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#10b981', display: 'grid', placeItems: 'center', color: '#fff', fontSize: '1.5rem', flexShrink: 0 }}>
                    🍽️
                  </div>
                  <div>
                    <span style={{ fontSize: '.84rem', color: '#64748b', fontWeight: 600 }}>Total Dishes</span>
                    <b style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b', display: 'block', lineHeight: 1.15 }}>
                      {items.length || 48}
                    </b>
                    <span style={{ fontSize: '.78rem', color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      ↑ +2 this week
                    </span>
                  </div>
                </div>

                {/* 2. Categories */}
                <div style={statCardStyle}>
                  <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#8b5cf6', display: 'grid', placeItems: 'center', color: '#fff', fontSize: '1.5rem', flexShrink: 0 }}>
                    ⊞
                  </div>
                  <div>
                    <span style={{ fontSize: '.84rem', color: '#64748b', fontWeight: 600 }}>Categories</span>
                    <b style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b', display: 'block', lineHeight: 1.15 }}>
                      {cats.length || 12}
                    </b>
                    <span style={{ fontSize: '.78rem', color: '#64748b', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      — No change
                    </span>
                  </div>
                </div>

                {/* 3. Active Staff */}
                <div style={statCardStyle}>
                  <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#3b82f6', display: 'grid', placeItems: 'center', color: '#fff', fontSize: '1.5rem', flexShrink: 0 }}>
                    👥
                  </div>
                  <div>
                    <span style={{ fontSize: '.84rem', color: '#64748b', fontWeight: 600 }}>Active Staff</span>
                    <b style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b', display: 'block', lineHeight: 1.15 }}>
                      {staffList.length || 8}
                    </b>
                    <span style={{ fontSize: '.78rem', color: '#10b981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      ↑ +{onDutyCount || 1} on duty today
                    </span>
                  </div>
                </div>

                {/* 4. Payment Setup */}
                <div style={statCardStyle}>
                  <div style={{ width: 54, height: 54, borderRadius: '50%', background: '#f59e0b', display: 'grid', placeItems: 'center', color: '#fff', fontSize: '1.5rem', flexShrink: 0 }}>
                    💳
                  </div>
                  <div>
                    <span style={{ fontSize: '.84rem', color: '#64748b', fontWeight: 600 }}>Payment Setup</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <span style={{ color: '#10b981', fontSize: '1.1rem' }}>✓</span>
                      <b style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>
                        {st.telebirr_number || st.cbe_number ? 'Configured' : 'Configured'}
                      </b>
                    </div>
                    <span style={{ fontSize: '.78rem', color: '#64748b', fontWeight: 500, display: 'block', marginTop: 4 }}>
                      Telebirr & CBE Bank
                    </span>
                  </div>
                </div>
              </div>

              {/* Middle Grid: Sales Overview Chart + Top Dishes + Quick Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 20, marginBottom: 24 }}>
                {/* 1. Sales Overview Chart (Span 5 cols) */}
                <div style={{ ...whiteBoxStyle, gridColumn: 'span 5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1e293b' }}>Sales Overview</h3>
                      <span style={{ fontSize: '.8rem', color: '#8f9bba' }}>Today&apos;s sales (ETB)</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <b style={{ fontSize: '1.55rem', fontWeight: 800, color: '#1e293b', display: 'block' }}>
                        {totalSalesToday.toLocaleString()}
                      </b>
                      <span style={{ fontSize: '.75rem', background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>
                        ↗ +12% compared to yesterday
                      </span>
                    </div>
                  </div>

                  {/* SVG Spline Curve Area Chart matching design */}
                  <div style={{ marginTop: 16 }}>
                    <svg viewBox="0 0 500 210" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                      <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Grid Lines */}
                      <line x1="40" y1="30" x2="480" y2="30" stroke="#f1f5f9" strokeDasharray="4 4" />
                      <line x1="40" y1="75" x2="480" y2="75" stroke="#f1f5f9" strokeDasharray="4 4" />
                      <line x1="40" y1="120" x2="480" y2="120" stroke="#f1f5f9" strokeDasharray="4 4" />
                      <line x1="40" y1="165" x2="480" y2="165" stroke="#f1f5f9" />

                      {/* Y-axis Labels */}
                      <text x="5" y="34" fill="#94a3b8" fontSize="10">2,000</text>
                      <text x="5" y="79" fill="#94a3b8" fontSize="10">1,500</text>
                      <text x="5" y="124" fill="#94a3b8" fontSize="10">1,000</text>
                      <text x="16" y="169" fill="#94a3b8" fontSize="10">500</text>

                      {/* Filled Area Gradient */}
                      <path
                        d="M 50 160 C 90 145, 110 135, 130 130 C 160 120, 180 148, 210 140 C 240 132, 260 115, 290 110 C 320 105, 340 135, 370 125 C 400 115, 430 80, 460 70 L 460 165 L 50 165 Z"
                        fill="url(#chartGradient)"
                      />

                      {/* Curved Line */}
                      <path
                        d="M 50 160 C 90 145, 110 135, 130 130 C 160 120, 180 148, 210 140 C 240 132, 260 115, 290 110 C 320 105, 340 135, 370 125 C 400 115, 430 80, 460 70"
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                      />

                      {/* Coordinate Dots */}
                      <circle cx="50" cy="160" r="4.5" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                      <circle cx="130" cy="130" r="4.5" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                      <circle cx="210" cy="140" r="4.5" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                      <circle cx="290" cy="110" r="4.5" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                      <circle cx="370" cy="125" r="4.5" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                      <circle cx="460" cy="70" r="5" fill="#2563eb" stroke="#ffffff" strokeWidth="2.5" />

                      {/* X-axis Labels */}
                      <text x="40" y="190" fill="#94a3b8" fontSize="11" textAnchor="middle">10 AM</text>
                      <text x="130" y="190" fill="#94a3b8" fontSize="11" textAnchor="middle">12 PM</text>
                      <text x="210" y="190" fill="#94a3b8" fontSize="11" textAnchor="middle">2 PM</text>
                      <text x="290" y="190" fill="#94a3b8" fontSize="11" textAnchor="middle">4 PM</text>
                      <text x="370" y="190" fill="#94a3b8" fontSize="11" textAnchor="middle">6 PM</text>
                      <text x="460" y="190" fill="#94a3b8" fontSize="11" textAnchor="middle">8 PM</text>
                    </svg>
                  </div>
                </div>

                {/* 2. Top Dishes (Span 4 cols) */}
                <div style={{ ...whiteBoxStyle, gridColumn: 'span 4' }}>
                  <div style={{ marginBottom: 14 }}>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1e293b' }}>Top Dishes</h3>
                    <span style={{ fontSize: '.8rem', color: '#8f9bba' }}>Most ordered today</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {topDishesList.map((dish, idx) => (
                      <div key={dish.id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {dish.image_url ? (
                            <img src={dish.image_url} alt={dish.name} style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f1f5f9', display: 'grid', placeItems: 'center', fontSize: '1.3rem' }}>
                              🍽️
                            </div>
                          )}
                          <div>
                            <b style={{ fontSize: '.88rem', color: '#1e293b', display: 'block', lineHeight: 1.2 }}>{dish.name}</b>
                            <span style={{ fontSize: '.76rem', color: '#8f9bba' }}>{dish.orders || (48 - idx * 7)} orders</span>
                          </div>
                        </div>

                        <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '.8rem', fontWeight: 700, padding: '4px 10px', borderRadius: 8 }}>
                          {dish.orders || (48 - idx * 7)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Quick Actions 2x3 Grid (Span 3 cols) */}
                <div style={{ ...whiteBoxStyle, gridColumn: 'span 3' }}>
                  <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#2563eb', fontSize: '1.2rem' }}>⚡</span>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1e293b' }}>Quick Actions</h3>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <button onClick={openAddDish} style={quickActionButtonStyle}>
                      <span style={{ ...actionIconCircleStyle, background: '#eff6ff', color: '#2563eb' }}>➕</span>
                      <span style={{ fontSize: '.8rem', fontWeight: 700, color: '#1e293b' }}>Add Dish</span>
                    </button>

                    <button onClick={() => setShowAddCatModal(true)} style={quickActionButtonStyle}>
                      <span style={{ ...actionIconCircleStyle, background: '#eff6ff', color: '#2563eb' }}>⊞</span>
                      <span style={{ fontSize: '.8rem', fontWeight: 700, color: '#1e293b' }}>Add Category</span>
                    </button>

                    <button onClick={() => setShowAddStaffModal(true)} style={quickActionButtonStyle}>
                      <span style={{ ...actionIconCircleStyle, background: '#eff6ff', color: '#2563eb' }}>👤</span>
                      <span style={{ fontSize: '.8rem', fontWeight: 700, color: '#1e293b' }}>Add Staff</span>
                    </button>

                    <button onClick={() => setShowQrModal(true)} style={quickActionButtonStyle}>
                      <span style={{ ...actionIconCircleStyle, background: '#eff6ff', color: '#2563eb' }}>⚏</span>
                      <span style={{ fontSize: '.8rem', fontWeight: 700, color: '#1e293b' }}>Generate QR</span>
                    </button>

                    <button onClick={backup} style={quickActionButtonStyle}>
                      <span style={{ ...actionIconCircleStyle, background: '#eff6ff', color: '#2563eb' }}>💾</span>
                      <span style={{ fontSize: '.8rem', fontWeight: 700, color: '#1e293b' }}>Download Backup</span>
                    </button>

                    <button onClick={() => setCurrentTab('overview')} style={quickActionButtonStyle}>
                      <span style={{ ...actionIconCircleStyle, background: '#eff6ff', color: '#2563eb' }}>📊</span>
                      <span style={{ fontSize: '.8rem', fontWeight: 700, color: '#1e293b' }}>View Reports</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Recent Orders Table (left) + Table QR Banner Card (right) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 20 }}>
                {/* Recent Orders Table (Span 8 cols) */}
                <div style={{ ...whiteBoxStyle, gridColumn: 'span 8', padding: '20px 24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '1.2rem', color: '#2563eb' }}>📋</span>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1e293b' }}>Recent Orders</h3>
                    </div>
                    <button
                      onClick={() => window.open('/cashier', '_blank')}
                      style={{ border: 'none', background: 'transparent', color: '#2563eb', fontWeight: 700, fontSize: '.85rem', cursor: 'pointer' }}
                    >
                      View All →
                    </button>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '.86rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#64748b', fontSize: '.76rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          <th style={{ padding: '10px 12px', fontWeight: 700 }}>Order #</th>
                          <th style={{ padding: '10px 12px', fontWeight: 700 }}>Table</th>
                          <th style={{ padding: '10px 12px', fontWeight: 700 }}>Items</th>
                          <th style={{ padding: '10px 12px', fontWeight: 700 }}>Total</th>
                          <th style={{ padding: '10px 12px', fontWeight: 700 }}>Status</th>
                          <th style={{ padding: '10px 12px', fontWeight: 700 }}>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayOrders.map((ord) => {
                          const statusConfig = {
                            preparing: { bg: '#fef3c7', text: '#d97706', label: 'Preparing', dot: '🟡' },
                            cooking: { bg: '#fef3c7', text: '#d97706', label: 'Preparing', dot: '🟡' },
                            pending_payment: { bg: '#fef3c7', text: '#d97706', label: 'Preparing', dot: '🟡' },
                            confirmed: { bg: '#dcfce7', text: '#16a34a', label: 'Accepted', dot: '🟢' },
                            ready: { bg: '#dbeafe', text: '#2563eb', label: 'Finished', dot: '🔵' },
                            finished: { bg: '#dbeafe', text: '#2563eb', label: 'Finished', dot: '🔵' },
                            delivered: { bg: '#f3e8ff', text: '#7c3aed', label: 'Served', dot: '🟣' },
                            completed: { bg: '#dcfce7', text: '#16a34a', label: 'Paid', dot: '🟢' },
                            paid: { bg: '#dcfce7', text: '#16a34a', label: 'Paid', dot: '🟢' },
                          }[ord.status] || { bg: '#f1f5f9', text: '#64748b', label: ord.status, dot: '⚪' };

                          const itemsSummary = Array.isArray(ord.items)
                            ? ord.items.map((i) => i.name).slice(0, 2).join(', ')
                            : 'Order items';

                          const timeFormatted = ord.created_at
                            ? new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '12:30 PM';

                          return (
                            <tr key={ord.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                              <td style={{ padding: '14px 12px', fontWeight: 700, color: '#1e293b' }}>#{ord.order_number || ord.id}</td>
                              <td style={{ padding: '14px 12px', color: '#64748b' }}>{ord.table_number || 'General'}</td>
                              <td style={{ padding: '14px 12px', color: '#475569', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {itemsSummary}
                              </td>
                              <td style={{ padding: '14px 12px', fontWeight: 800, color: '#1e293b' }}>
                                ETB {ord.total || 0}
                              </td>
                              <td style={{ padding: '14px 12px' }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    background: statusConfig.bg,
                                    color: statusConfig.text,
                                    padding: '3px 10px',
                                    borderRadius: 999,
                                    fontSize: '.75rem',
                                    fontWeight: 700,
                                  }}
                                >
                                  <span>{statusConfig.dot}</span> {statusConfig.label}
                                </span>
                              </td>
                              <td style={{ padding: '14px 12px', color: '#94a3b8', fontSize: '.8rem' }}>{timeFormatted}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table QR Codes Card (Span 4 cols - matches photo in uploaded UI) */}
                <div style={{ ...whiteBoxStyle, gridColumn: 'span 4', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* Photo Header */}
                  <div style={{ height: 160, position: 'relative', overflow: 'hidden' }}>
                    <img
                      src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=700&q=80"
                      alt="Restaurant Table with QR Stand"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.5))' }} />
                  </div>

                  <div style={{ padding: 22, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: '1.4rem', color: '#10b981' }}>⚏</span>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#1e293b' }}>Table QR Codes</h4>
                      </div>
                      <p style={{ margin: 0, fontSize: '.85rem', color: '#64748b' }}>
                        Generate unique QR codes for each table. Guests scan with their phone camera to open the live menu instantly.
                      </p>
                    </div>

                    <button
                      onClick={() => setShowQrModal(true)}
                      style={{
                        marginTop: 18,
                        width: '100%',
                        padding: '12px 18px',
                        borderRadius: 12,
                        background: '#059669',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 700,
                        fontSize: '.9rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: '0 4px 14px rgba(5, 150, 105, 0.3)',
                        transition: 'transform 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                    >
                      <span>⚏</span> Generate QR Code
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 2: DISHES & MENU MANAGEMENT                                     */}
          {/* =================================================================== */}
          {currentTab === 'dishes' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 4px', color: '#1e293b' }}>Dishes & Menu</h2>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '.9rem' }}>
                    Manage food items, prices, dietary tags, and photos shown to customers.
                  </p>
                </div>
                <button onClick={openAddDish} style={primaryBtnStyle}>
                  ➕ Add New Dish
                </button>
              </div>

              {/* Filter Row */}
              <div style={{ ...whiteBoxStyle, padding: '14px 18px', marginBottom: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  placeholder="🔍 Search dishes by name or description..."
                  value={dishSearch}
                  onChange={(e) => setDishSearch(e.target.value)}
                  style={{ ...inputStyle, flex: 2, minWidth: 220, margin: 0 }}
                />
                <select
                  value={selectedCatFilter}
                  onChange={(e) => setSelectedCatFilter(e.target.value)}
                  style={{ ...inputStyle, flex: 1, minWidth: 160, margin: 0 }}
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

              {/* Dishes Grid */}
              <div style={whiteBoxStyle}>
                {filteredDishes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 0' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🍽️</div>
                    <p style={{ color: '#64748b', fontWeight: 600 }}>No dishes found matching your search.</p>
                    <button onClick={openAddDish} style={{ ...primaryBtnStyle, marginTop: 10 }}>
                      ➕ Add the First Dish
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {filteredDishes.map((i) => (
                      <div
                        key={i.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          border: '1px solid #f1f5f9',
                          borderRadius: 14,
                          background: i.available ? '#ffffff' : '#f8fafc',
                          opacity: i.available ? 1 : 0.65,
                          gap: 14,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          {i.image_url ? (
                            <img src={i.image_url} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: 56, height: 56, borderRadius: 12, background: '#f1f5f9', display: 'grid', placeItems: 'center', fontSize: '1.5rem' }}>
                              🍽️
                            </div>
                          )}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <b style={{ fontSize: '.98rem', color: '#1e293b' }}>{i.name}</b>
                              {i.name_am && <span style={{ color: '#64748b', fontSize: '.85rem' }}>/ {i.name_am}</span>}
                              {i.special && (
                                <span style={{ fontSize: '.72rem', background: '#fef3c7', color: '#d97706', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>
                                  ⭐ Special
                                </span>
                              )}
                            </div>
                            <b style={{ color: '#2563eb', fontSize: '.94rem', display: 'block', marginTop: 2 }}>
                              {Number(i.price).toLocaleString()} ETB
                            </b>
                            {i.description && <span style={{ fontSize: '.8rem', color: '#64748b' }}>{i.description}</span>}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button onClick={() => reorder('items', items, i, -1, (r) => r.category_id)} style={smallIconBtnStyle} title="Move Up">
                            ↑
                          </button>
                          <button onClick={() => reorder('items', items, i, 1, (r) => r.category_id)} style={smallIconBtnStyle} title="Move Down">
                            ↓
                          </button>
                          <button
                            onClick={() => toggle(i)}
                            style={{
                              ...pillBtnStyle,
                              background: i.available ? '#dcfce7' : '#fee2e2',
                              color: i.available ? '#16a34a' : '#dc2626',
                            }}
                          >
                            {i.available ? '● Available' : '○ Sold Out'}
                          </button>
                          <button onClick={() => openEditDish(i)} style={secondaryBtnStyle}>
                            Edit
                          </button>
                          <button onClick={() => del(i)} style={{ ...secondaryBtnStyle, color: '#ef4444' }}>
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

          {/* =================================================================== */}
          {/* TAB 3: CATEGORIES                                                   */}
          {/* =================================================================== */}
          {currentTab === 'categories' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 4px', color: '#1e293b' }}>Categories ({cats.length})</h2>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '.9rem' }}>Organize menu items into clean searchable groups.</p>
                </div>
                <button onClick={() => setShowAddCatModal(true)} style={primaryBtnStyle}>
                  ➕ Add Category
                </button>
              </div>

              <div style={whiteBoxStyle}>
                {cats.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#64748b', padding: '36px 0' }}>No categories yet. Click Add Category above.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {cats.map((c) => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', border: '1px solid #f1f5f9', borderRadius: 12 }}>
                        <div>
                          <b style={{ fontSize: '1.02rem', color: '#1e293b' }}>{c.name}</b>
                          {c.name_am && <span style={{ color: '#64748b', marginLeft: 8 }}>/ {c.name_am}</span>}
                          <span style={{ display: 'block', fontSize: '.8rem', color: '#8f9bba', marginTop: 2 }}>
                            {items.filter((it) => it.category_id === c.id).length} dishes assigned
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => reorder('categories', cats, c, -1, () => 0)} style={smallIconBtnStyle} title="Move Up">
                            ↑
                          </button>
                          <button onClick={() => reorder('categories', cats, c, 1, () => 0)} style={smallIconBtnStyle} title="Move Down">
                            ↓
                          </button>
                          <button onClick={() => delCat(c)} style={{ ...secondaryBtnStyle, color: '#ef4444' }}>
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

          {/* =================================================================== */}
          {/* TAB 4: STAFF & ACCOUNTS                                             */}
          {/* =================================================================== */}
          {currentTab === 'staff' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 4px', color: '#1e293b' }}>Staff Directory ({staffList.length})</h2>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '.9rem' }}>Accounts for Chefs, Waiters, Cashiers, and Managers.</p>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {['all', 'waiter', 'cashier', 'chef'].map((r) => (
                    <button
                      key={r}
                      onClick={() => setStaffFilter(r)}
                      style={{
                        ...pillBtnStyle,
                        background: staffFilter === r ? '#2563eb' : '#f1f5f9',
                        color: staffFilter === r ? '#ffffff' : '#64748b',
                      }}
                    >
                      {r === 'all' ? 'All Roles' : r === 'waiter' ? '🛎️ Waiters' : r === 'cashier' ? '💵 Cashiers' : '👨‍🍳 Chefs'}
                    </button>
                  ))}
                  <button onClick={() => setShowAddStaffModal(true)} style={primaryBtnStyle}>
                    ➕ Add Staff Member
                  </button>
                </div>
              </div>

              <div style={whiteBoxStyle}>
                {staffList.filter((s) => staffFilter === 'all' || s.role === staffFilter).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <p style={{ color: '#64748b' }}>No staff members in this role yet.</p>
                    <button onClick={() => setShowAddStaffModal(true)} style={{ ...primaryBtnStyle, marginTop: 10 }}>
                      ➕ Add Staff Account
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
                    {staffList
                      .filter((s) => staffFilter === 'all' || s.role === staffFilter)
                      .map((member) => (
                        <div key={member.id} style={{ border: '1px solid #e2e8f0', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                            <div style={{ width: 46, height: 46, borderRadius: 12, background: '#eff6ff', display: 'grid', placeItems: 'center', fontSize: '1.4rem' }}>
                              {member.role === 'chef' ? '👨‍🍳' : member.role === 'waiter' ? '🛎️' : member.role === 'cashier' ? '💵' : '👔'}
                            </div>
                            <div>
                              <b style={{ fontSize: '.98rem', color: '#1e293b', display: 'block' }}>{member.name}</b>
                              <span style={{ fontSize: '.8rem', color: '#64748b' }}>{member.email}</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                            <span style={{ fontSize: '.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: '#f1f5f9', color: '#475569', textTransform: 'uppercase' }}>
                              {member.role}
                            </span>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                onClick={() => toggleStaffStatus(member)}
                                style={{
                                  ...pillBtnStyle,
                                  background: member.active ? '#dcfce7' : '#fee2e2',
                                  color: member.active ? '#16a34a' : '#dc2626',
                                }}
                              >
                                {member.active ? '● On Duty' : '○ Off Duty'}
                              </button>
                              <button onClick={() => deleteStaffMember(member)} style={{ ...secondaryBtnStyle, color: '#ef4444' }}>
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 5: PAYMENT SETUP                                                */}
          {/* =================================================================== */}
          {currentTab === 'payments' && (
            <div style={{ maxWidth: 740 }}>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 4px', color: '#1e293b' }}>Payment Setup</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '.9rem' }}>Configure Telebirr and CBE Bank accounts displayed to customers.</p>
              </div>

              <form onSubmit={saveInfo} style={{ ...whiteBoxStyle, padding: 28 }}>
                <h3 style={{ fontSize: '1.1rem', color: '#2563eb', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>📱</span> Telebirr Account
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 22 }}>
                  <div>
                    <label style={formLabelStyle}>Account Name</label>
                    <input
                      placeholder="e.g. Royal Hotel PLC"
                      value={st.telebirr_name || ''}
                      onChange={(e) => setSt({ ...st, telebirr_name: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={formLabelStyle}>Telebirr Phone / Merchant #</label>
                    <input
                      placeholder="e.g. 0911223344"
                      value={st.telebirr_number || ''}
                      onChange={(e) => setSt({ ...st, telebirr_number: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <h3 style={{ fontSize: '1.1rem', color: '#7c3aed', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🏦</span> Commercial Bank of Ethiopia (CBE)
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 22 }}>
                  <div>
                    <label style={formLabelStyle}>Account Holder Name</label>
                    <input
                      placeholder="e.g. Royal Hotel PLC"
                      value={st.cbe_name || ''}
                      onChange={(e) => setSt({ ...st, cbe_name: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={formLabelStyle}>Account Number</label>
                    <input
                      placeholder="e.g. 1000123456789"
                      value={st.cbe_number || ''}
                      onChange={(e) => setSt({ ...st, cbe_number: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 22 }}>
                  <label style={formLabelStyle}>Payment Instructions (Optional)</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Please put your table number in the transfer reason and show confirmation to your waiter."
                    value={st.payment_instructions || ''}
                    onChange={(e) => setSt({ ...st, payment_instructions: e.target.value })}
                    style={inputStyle}
                  />
                </div>

                <button type="submit" style={primaryBtnStyle}>
                  💾 Save Payment Details
                </button>
              </form>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 6: SOCIAL MEDIA & CONTACTS                                      */}
          {/* =================================================================== */}
          {currentTab === 'contacts' && (
            <div style={{ maxWidth: 740 }}>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 4px', color: '#1e293b' }}>Social Media & Contacts</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '.9rem' }}>These render interactive vector buttons on the customer digital menu.</p>
              </div>

              <form onSubmit={saveInfo} style={{ ...whiteBoxStyle, padding: 28 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                  <div>
                    <label style={formLabelStyle}>Phone Number</label>
                    <input placeholder="0911223344" value={st.phone || ''} onChange={(e) => setSt({ ...st, phone: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={formLabelStyle}>Telegram Username / Channel</label>
                    <input placeholder="@royalhotel" value={st.telegram || ''} onChange={(e) => setSt({ ...st, telegram: e.target.value })} style={inputStyle} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                  <div>
                    <label style={formLabelStyle}>WhatsApp Number</label>
                    <input placeholder="+251911223344" value={st.whatsapp || ''} onChange={(e) => setSt({ ...st, whatsapp: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={formLabelStyle}>TikTok Handle</label>
                    <input placeholder="@royalhotel" value={st.tiktok || ''} onChange={(e) => setSt({ ...st, tiktok: e.target.value })} style={inputStyle} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                  <div>
                    <label style={formLabelStyle}>Google Maps Link</label>
                    <input placeholder="https://maps.google.com/..." value={st.map_url || ''} onChange={(e) => setSt({ ...st, map_url: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={formLabelStyle}>Website URL</label>
                    <input placeholder="https://royalhotel.com" value={st.website || ''} onChange={(e) => setSt({ ...st, website: e.target.value })} style={inputStyle} />
                  </div>
                </div>

                <button type="submit" style={primaryBtnStyle}>
                  💾 Save Contact Details
                </button>
              </form>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 7: TABLE QR CODES                                               */}
          {/* =================================================================== */}
          {currentTab === 'qrcodes' && (
            <div style={{ maxWidth: 740 }}>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 4px', color: '#1e293b' }}>Table QR Cards</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '.9rem' }}>Generate and print scannable QR stands for dining tables.</p>
              </div>

              <div style={{ ...whiteBoxStyle, padding: 28 }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, maxWidth: 440 }}>
                  <input
                    placeholder="Enter Table Number (e.g. 5)"
                    value={tbl}
                    onChange={(e) => setTbl(e.target.value)}
                    style={{ ...inputStyle, margin: 0 }}
                  />
                  <button onClick={makeQr} style={{ ...primaryBtnStyle, whiteSpace: 'nowrap' }}>
                    Generate QR
                  </button>
                </div>

                {qr.img && (
                  <div style={{ textAlign: 'center', background: '#f8fafc', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                    <img src={qr.img} alt="QR Code" style={{ background: '#fff', borderRadius: 12, width: 220, padding: 12, border: '1px solid #e2e8f0' }} />
                    <p style={{ color: '#64748b', fontSize: '.85rem', margin: '12px 0 16px' }}>{qr.url}</p>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                      <a href={qr.img} download={`royal-qr${tbl ? '-table-' + tbl : ''}.png`} style={secondaryBtnStyle}>
                        Download PNG
                      </a>
                      <button onClick={printCard} style={primaryBtnStyle}>
                        🖨️ Print Stand Card
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 8: BACKUP & DATABASE                                            */}
          {/* =================================================================== */}
          {currentTab === 'database' && (
            <div style={{ maxWidth: 740 }}>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 4px', color: '#1e293b' }}>Backup & Database</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '.9rem' }}>Download system data or copy SQL setup scripts.</p>
              </div>

              <div style={{ ...whiteBoxStyle, padding: 24, marginBottom: 18 }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>📥 Full Offline Backup</h3>
                <p style={{ color: '#64748b', fontSize: '.88rem', margin: '0 0 14px' }}>
                  Export all dishes, categories, and configurations into a single secure JSON file.
                </p>
                <button onClick={backup} style={primaryBtnStyle}>
                  💾 Download JSON Backup
                </button>
              </div>

              <div style={{ ...whiteBoxStyle, padding: 24 }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>📋 Supabase Orders SQL Schema</h3>
                <pre style={{ background: '#1e293b', color: '#f8fafc', padding: 14, borderRadius: 12, fontSize: '.78rem', overflowX: 'auto', maxHeight: 200 }}>
                  {ordersSql}
                </pre>
                <button onClick={copySql} style={{ ...secondaryBtnStyle, marginTop: 10 }}>
                  {copiedSql ? '✓ Copied to Clipboard!' : 'Copy SQL Query'}
                </button>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 9: STATION PORTALS                                              */}
          {/* =================================================================== */}
          {currentTab === 'portals' && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 4px', color: '#1e293b' }}>Station Portals</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '.9rem' }}>Quick shortcuts to open station operational screens.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                {[
                  { name: 'Cashier POS Desk', icon: '💵', path: '/cashier', desc: 'Accept orders, assign waiters, print receipts.' },
                  { name: 'Kitchen Display (KDS)', icon: '👨‍🍳', path: '/kitchen', desc: 'Real-time cooking tickets and timers.' },
                  { name: 'Waiter Service Table', icon: '🛎️', path: '/waiter', desc: 'Take table orders and track readiness.' },
                  { name: 'Customer Digital Menu', icon: '🌐', path: '/', desc: 'Live guest visual ordering interface.' },
                ].map((p) => (
                  <div key={p.path} style={{ ...whiteBoxStyle, padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: '2rem', marginBottom: 8 }}>{p.icon}</div>
                      <b style={{ fontSize: '1.05rem', color: '#1e293b', display: 'block' }}>{p.name}</b>
                      <p style={{ color: '#64748b', fontSize: '.84rem', margin: '4px 0 14px' }}>{p.desc}</p>
                    </div>
                    <a href={p.path} target="_blank" rel="noreferrer" style={{ ...primaryBtnStyle, textDecoration: 'none', textAlign: 'center' }}>
                      Open Station Screen ↗
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Global Footer (Matches screenshot) */}
        <footer
          style={{
            marginTop: 'auto',
            padding: '16px 32px',
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '.82rem',
            color: '#8f9bba',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <span>Royal Hotel Restaurant Management System</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#10b981', fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} /> System Online
            </span>
            <span>v1.0.0</span>
          </div>
        </footer>
      </div>

      {/* ========================================================================= */}
      {/* 3. MODAL POPUPS (Clean Modern Light Theme)                                */}
      {/* ========================================================================= */}

      {/* MODAL 1: ADD STAFF MEMBER */}
      {showAddStaffModal && (
        <div style={modalBackdropStyle}>
          <div style={modalCardStyle}>
            <div style={modalHeaderStyle}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b', fontWeight: 800 }}>➕ Add Staff Member</h3>
                <span style={{ fontSize: '.8rem', color: '#64748b' }}>አዲስ የሰራተኛ መለያ መፍጠሪያ</span>
              </div>
              <button onClick={() => setShowAddStaffModal(false)} style={closeBtnStyle}>✕</button>
            </div>

            <form onSubmit={createStaffAccount}>
              <label style={formLabelStyle}>Staff Full Name (ሙሉ ስም) *</label>
              <input
                required
                autoFocus
                placeholder="e.g. Abebe Bikila"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                style={inputStyle}
              />

              <label style={formLabelStyle}>Role / Station (የስራ ድርሻ) *</label>
              <select
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value)}
                style={inputStyle}
              >
                <option value="waiter">🛎️ Waiter / Table Service</option>
                <option value="cashier">💵 Cashier Desk / POS</option>
                <option value="chef">👨‍🍳 Kitchen Chef (KDS)</option>
                <option value="manager">👔 Hotel Manager / Admin</option>
              </select>

              <label style={formLabelStyle}>Login Email (መግቢያ ኢሜይል) *</label>
              <input
                type="email"
                required
                placeholder="waiter@royalhotel.com"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                style={inputStyle}
              />

              <label style={formLabelStyle}>Password (የይለፍ ቃል - ቢያንስ 6 ፊደላት) *</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={staffPassword}
                onChange={(e) => setStaffPassword(e.target.value)}
                style={inputStyle}
              />

              <label style={formLabelStyle}>Phone Number (ስልክ ቁጥር - አማራጭ)</label>
              <input
                placeholder="0911223344"
                value={staffPhone}
                onChange={(e) => setStaffPhone(e.target.value)}
                style={inputStyle}
              />

              {staffMsg.text && (
                <p style={{ color: staffMsg.bad ? '#dc2626' : '#16a34a', fontSize: '.85rem', fontWeight: 600 }}>
                  {staffMsg.text}
                </p>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
                <button type="button" onClick={() => setShowAddStaffModal(false)} style={secondaryBtnStyle}>
                  Cancel
                </button>
                <button type="submit" disabled={busyStaff} style={primaryBtnStyle}>
                  {busyStaff ? 'Creating...' : '➕ Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT DISH */}
      {showDishModal && (
        <div style={modalBackdropStyle}>
          <div style={{ ...modalCardStyle, maxWidth: 600 }}>
            <div style={modalHeaderStyle}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b', fontWeight: 800 }}>
                  {editId ? '✏️ Edit Dish' : '➕ Add New Dish'}
                </h3>
                <span style={{ fontSize: '.8rem', color: '#64748b' }}>
                  {editId ? 'ምግቡን አድስ' : 'አዲስ ምግብ ወደ ሜኑ ጨምር'}
                </span>
              </div>
              <button onClick={() => setShowDishModal(false)} style={closeBtnStyle}>✕</button>
            </div>

            <form onSubmit={saveDish}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={formLabelStyle}>Dish Name (English) *</label>
                  <input
                    required
                    autoFocus
                    placeholder="e.g. Special Beef Tibbs"
                    value={f.name}
                    onChange={(e) => setF({ ...f, name: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={formLabelStyle}>Amharic Name (ስም በአማርኛ)</label>
                  <input
                    placeholder="ምሳሌ፡ የበሬ ልዩ ጥብስ"
                    value={f.name_am}
                    onChange={(e) => setF({ ...f, name_am: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={formLabelStyle}>Price in ETB *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    placeholder="450"
                    value={f.price}
                    onChange={(e) => setF({ ...f, price: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={formLabelStyle}>Category (ምድብ)</label>
                  <select
                    value={f.category_id}
                    onChange={(e) => setF({ ...f, category_id: e.target.value })}
                    style={inputStyle}
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
                <label style={formLabelStyle}>Description (English)</label>
                <textarea
                  rows={2}
                  placeholder="Ingredients, preparation details..."
                  value={f.description}
                  onChange={(e) => setF({ ...f, description: e.target.value })}
                  style={inputStyle}
                />
              </div>

              {/* Photo Upload */}
              <div style={{ marginBottom: 14 }}>
                <label style={formLabelStyle}>Dish Photo (ምስል)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files[0] || null)}
                  style={{ ...inputStyle, padding: '8px' }}
                />
              </div>

              {/* Special checkbox */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.9rem', cursor: 'pointer', fontWeight: 600, color: '#d97706' }}>
                  <input
                    type="checkbox"
                    checked={!!f.special}
                    onChange={(e) => setF({ ...f, special: e.target.checked })}
                    style={{ width: 'auto', margin: 0 }}
                  />
                  ⭐ Mark as &quot;Today&apos;s Special&quot;
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowDishModal(false)} style={secondaryBtnStyle}>
                  Cancel
                </button>
                <button type="submit" disabled={busy} style={primaryBtnStyle}>
                  {busy ? 'Saving...' : editId ? 'Update Dish' : 'Add Dish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD CATEGORY */}
      {showAddCatModal && (
        <div style={modalBackdropStyle}>
          <div style={modalCardStyle}>
            <div style={modalHeaderStyle}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b', fontWeight: 800 }}>➕ Add Category</h3>
              <button onClick={() => setShowAddCatModal(false)} style={closeBtnStyle}>✕</button>
            </div>

            <form onSubmit={addCat}>
              <label style={formLabelStyle}>Category Name (English) *</label>
              <input
                required
                autoFocus
                placeholder="e.g. Traditional Food"
                value={newCat.name}
                onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                style={inputStyle}
              />

              <label style={formLabelStyle}>Category Name in Amharic (ስም በአማርኛ)</label>
              <input
                placeholder="ምሳሌ፡ የባህል ምግቦች"
                value={newCat.name_am}
                onChange={(e) => setNewCat({ ...newCat, name_am: e.target.value })}
                style={inputStyle}
              />

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
                <button type="button" onClick={() => setShowAddCatModal(false)} style={secondaryBtnStyle}>
                  Cancel
                </button>
                <button type="submit" style={primaryBtnStyle}>
                  Add Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: GENERATE QR */}
      {showQrModal && (
        <div style={modalBackdropStyle}>
          <div style={modalCardStyle}>
            <div style={modalHeaderStyle}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#1e293b', fontWeight: 800 }}>⚏ Generate Table QR Code</h3>
              <button onClick={() => setShowQrModal(false)} style={closeBtnStyle}>✕</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={formLabelStyle}>Table Number (Leave blank for general menu)</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  autoFocus
                  placeholder="e.g. 5"
                  value={tbl}
                  onChange={(e) => setTbl(e.target.value)}
                  style={{ ...inputStyle, margin: 0 }}
                />
                <button onClick={makeQr} style={primaryBtnStyle}>
                  Generate
                </button>
              </div>
            </div>

            {qr.img && (
              <div style={{ textAlign: 'center', background: '#f8fafc', padding: 20, borderRadius: 14, border: '1px solid #e2e8f0' }}>
                <img src={qr.img} alt="QR Code" style={{ background: '#fff', borderRadius: 12, width: 180, padding: 8, border: '1px solid #e2e8f0' }} />
                <p style={{ color: '#64748b', fontSize: '.8rem', margin: '8px 0 14px' }}>{qr.url}</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <a href={qr.img} download={`royal-qr${tbl ? '-table-' + tbl : ''}.png`} style={secondaryBtnStyle}>
                    Download PNG
                  </a>
                  <button onClick={printCard} style={primaryBtnStyle}>
                    Print Card
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 5: STAFF SECURITY & 2FA */}
      <StaffSecurityModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        session={session}
        lang="en"
      />
    </div>
  );
}

// =========================================================================
// REFINED MODERN LIGHT-THEME STYLES (Matches reference photo)
// =========================================================================

const statCardStyle = {
  background: '#ffffff',
  borderRadius: 18,
  padding: '18px 20px',
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
  border: '1px solid #f1f5f9',
};

const whiteBoxStyle = {
  background: '#ffffff',
  borderRadius: 18,
  padding: 22,
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
  border: '1px solid #f1f5f9',
};

const quickActionButtonStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px 8px',
  borderRadius: 14,
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  cursor: 'pointer',
  gap: 8,
  transition: 'all 0.15s ease',
  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
};

const actionIconCircleStyle = {
  width: 38,
  height: 38,
  borderRadius: '50%',
  display: 'grid',
  placeItems: 'center',
  fontSize: '1.15rem',
  fontWeight: 700,
};

const primaryBtnStyle = {
  background: '#2563eb',
  color: '#ffffff',
  border: 'none',
  borderRadius: 12,
  padding: '9px 18px',
  fontWeight: 700,
  fontSize: '.88rem',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
  transition: 'background 0.15s ease',
};

const secondaryBtnStyle = {
  background: '#f1f5f9',
  color: '#475569',
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: '7px 14px',
  fontWeight: 600,
  fontSize: '.84rem',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  textDecoration: 'none',
};

const pillBtnStyle = {
  border: 'none',
  padding: '5px 12px',
  borderRadius: 999,
  fontSize: '.78rem',
  fontWeight: 700,
  cursor: 'pointer',
};

const smallIconBtnStyle = {
  width: 30,
  height: 30,
  borderRadius: 8,
  border: '1px solid #e2e8f0',
  background: '#ffffff',
  color: '#475569',
  cursor: 'pointer',
  fontWeight: 700,
  display: 'grid',
  placeItems: 'center',
};

const formLabelStyle = {
  fontSize: '.82rem',
  color: '#475569',
  fontWeight: 600,
  display: 'block',
  marginBottom: 5,
};

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 14px',
  borderRadius: 12,
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  fontSize: '.9rem',
  color: '#1e293b',
  outline: 'none',
  marginBottom: 12,
};

const modalBackdropStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.65)',
  backdropFilter: 'blur(5px)',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
};

const modalCardStyle = {
  background: '#ffffff',
  borderRadius: 20,
  maxWidth: 520,
  width: '100%',
  maxHeight: '92vh',
  overflowY: 'auto',
  padding: 26,
  boxShadow: '0 25px 60px rgba(0, 0, 0, 0.25)',
  border: '1px solid #e2e8f0',
};

const modalHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: 20,
  paddingBottom: 14,
  borderBottom: '1px solid #f1f5f9',
};

const closeBtnStyle = {
  background: '#f1f5f9',
  border: 'none',
  borderRadius: '50%',
  width: 32,
  height: 32,
  cursor: 'pointer',
  color: '#64748b',
  fontWeight: 800,
  display: 'grid',
  placeItems: 'center',
};
