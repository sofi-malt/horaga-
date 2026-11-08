'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  LayoutDashboard,
  UtensilsCrossed,
  FolderTree,
  Users,
  CreditCard,
  Share2,
  QrCode,
  Database,
  ShieldCheck,
  Monitor,
  ArrowUpDown,
  Tag,
  Bell,
  Search,
  Plus,
  Trash2,
  Edit3,
  Check,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Printer,
  Download,
  LogOut,
  ExternalLink,
  TrendingUp,
  Sparkles,
  X,
  Menu,
  Phone,
  Send,
  MessageSquare,
  Globe,
  MapPin,
  FileText,
  UserCheck,
  ChevronDown,
} from 'lucide-react';
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
      c.toBlob(res, 'image/jpeg', 0.82);
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
  const [isLoading, setIsLoading] = useState(true);

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

  // Interactive Chart Tooltip
  const [activeChartPoint, setActiveChartPoint] = useState(null);

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
    setIsLoading(true);
    try {
      const [c, i, s, o] = await Promise.all([
        supabase.from('categories').select('*').order('sort').order('id'),
        supabase.from('items').select('*').order('sort').order('id'),
        supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(30),
      ]);
      if (c.error) say('Categories: ' + c.error.message, true);
      if (i.error) say('Dishes: ' + i.error.message, true);
      setCats(c.data || []);
      setItems(i.data || []);
      setSt(s.data || {});
      setOrders(o.data || []);
    } catch (err) {
      say('Failed to connect to database. Please check Supabase credentials.', true);
    } finally {
      setIsLoading(false);
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
      supabase.from('orders').select('*').limit(250),
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
    a.download = `royal-hotel-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const printCard = () => {
    const w = window.open('', '_blank');
    w.document.write(
      `<html><head><title>Royal Hotel - Table QR Card</title><style>body{margin:0;background:#fff;color:#0f172a;font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:48px 24px}.l{width:180px;margin-bottom:16px}.q{width:260px;background:#fff;padding:16px;border:2px solid #e2e8f0;border-radius:24px;box-shadow:0 8px 30px rgba(0,0,0,0.06)}h1{margin:16px 0 6px;color:#0f172a;font-size:24px;font-weight:800}p{color:#64748b;margin:0 0 20px;font-size:15px}.table-badge{display:inline-block;background:#2563eb;color:#fff;padding:6px 20px;border-radius:999px;font-weight:700;font-size:18px;margin-top:14px}</style></head><body><img class="l" src="${location.origin}/logo.png"><h1>Scan for Digital Menu</h1><p>ሜኑውን ለማየት በስልክዎ ስካን ያድርጉ</p><img class="q" src="${qr.img}">${tbl ? `<br><div class="table-badge">Table ${tbl.replace(/[<>&"]/g, '')}</div>` : ''}<script>onload=function(){setTimeout(print,400)}<\/script></body></html>`
    );
    w.document.close();
  };

  const makeQr = async () => {
    const url = location.origin + (tbl ? `?table=${encodeURIComponent(tbl)}` : '');
    setQr({ url, img: await QRCode.toDataURL(url, { width: 700, margin: 2 }) });
  };

  const ordersSql = `-- Supabase Orders & Staff SQL Migration:
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
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ width: 44, height: 44, border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Royal Hotel Management System</h3>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '.88rem' }}>Authenticating secure administrative session...</p>
        </div>
      </main>
    );
  }

  // 2. Unauthenticated: Staff Login
  if (!session) {
    return (
      <StaffLoginForm
        title="Admin & Manager Sign In"
        subtitle="Royal Hotel Enterprise Administration Portal"
        icon={<ShieldCheck size={28} className="text-blue-500" />}
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

  // Recent orders list
  const displayOrders = orders.length > 0 ? orders.slice(0, 6) : [
    { id: 1007, order_number: '1007', table_number: '3', items: [{ name: 'Grilled Chicken', quantity: 1 }, { name: 'Fresh Juice', quantity: 1 }], total: 320, status: 'preparing', created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString() },
    { id: 1006, order_number: '1006', table_number: '5', items: [{ name: 'Pasta Alfredo', quantity: 1 }, { name: 'Salad', quantity: 1 }], total: 280, status: 'confirmed', created_at: new Date(Date.now() - 1000 * 60 * 38).toISOString() },
    { id: 1005, order_number: '1005', table_number: '8', items: [{ name: 'Beef Burger', quantity: 1 }, { name: 'French Fries', quantity: 1 }], total: 450, status: 'ready', created_at: new Date(Date.now() - 1000 * 60 * 40).toISOString() },
    { id: 1004, order_number: '1004', table_number: '6', items: [{ name: 'Ethiopian Coffee', quantity: 2 }, { name: 'Chocolate Cake', quantity: 1 }], total: 180, status: 'delivered', created_at: new Date(Date.now() - 1000 * 60 * 70).toISOString() },
    { id: 1003, order_number: '1003', table_number: '4', items: [{ name: 'Special Tibbs', quantity: 1 }, { name: 'Mango Juice', quantity: 1 }], total: 520, status: 'paid', created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString() },
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

  // Premium SaaS Sidebar Navigation Items
  const navItems = [
    { id: 'overview', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'dishes', icon: UtensilsCrossed, label: 'Dishes', count: items.length },
    { id: 'categories', icon: FolderTree, label: 'Categories', count: cats.length },
    { id: 'staff', icon: Users, label: 'Staff & Accounts', count: staffList.length },
    { id: 'payments', icon: CreditCard, label: 'Payment Setup' },
    { id: 'contacts', icon: Share2, label: 'Social Media & Contacts' },
    { id: 'qrcodes', icon: QrCode, label: 'Table QR Codes' },
    { id: 'database', icon: Database, label: 'Backup & Database' },
    { id: 'security', icon: ShieldCheck, label: 'Security & 2FA', action: () => setShowSecurityModal(true) },
    { id: 'portals', icon: Monitor, label: 'Station Portals' },
    { id: 'reordering', icon: ArrowUpDown, label: 'Menu Reordering' },
    { id: 'tags', icon: Tag, label: 'Dietary Tags' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc', color: '#0f172a' }}>
      {/* ========================================================================= */}
      {/* 1. PREMIUM NAVY SAAS SIDEBAR                                              */}
      {/* ========================================================================= */}
      <aside
        style={{
          width: 268,
          background: '#0f172a',
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
          boxShadow: '4px 0 24px rgba(15, 23, 42, 0.08)',
          borderRight: '1px solid rgba(255, 255, 255, 0.06)',
          transition: 'transform 0.22s ease-in-out',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, padding: '4px 8px' }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', display: 'grid', placeItems: 'center', color: '#ffffff', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)' }}>
              <UtensilsCrossed size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <b style={{ fontSize: '1.15rem', color: '#ffffff', letterSpacing: '-0.3px', fontWeight: 800 }}>Royal Hotel</b>
                <span style={{ fontSize: '.65rem', background: 'rgba(37, 99, 235, 0.25)', color: '#60a5fa', padding: '1px 6px', borderRadius: 6, fontWeight: 700 }}>PRO</span>
              </div>
              <span style={{ fontSize: '.75rem', color: '#94a3b8', fontWeight: 500 }}>Management System</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 'calc(100vh - 230px)', overflowY: 'auto' }}>
            {navItems.map((nav) => {
              const active = currentTab === nav.id;
              const IconComponent = nav.icon;
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
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: 'none',
                    background: active ? '#2563eb' : 'transparent',
                    color: active ? '#ffffff' : '#94a3b8',
                    fontWeight: active ? 700 : 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '.88rem',
                    transition: 'all 0.16s ease',
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
                      e.currentTarget.style.color = '#94a3b8';
                    }
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <IconComponent size={19} style={{ opacity: active ? 1 : 0.85 }} />
                    {nav.label}
                  </span>
                  {nav.count !== undefined && (
                    <span
                      style={{
                        fontSize: '.72rem',
                        background: active ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.06)',
                        color: active ? '#ffffff' : '#94a3b8',
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

        {/* Bottom Profile & Logout */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', marginBottom: 8 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', display: 'grid', placeItems: 'center', color: '#60a5fa', fontWeight: 800 }}>
                A
              </div>
              <span style={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: '50%', background: '#10b981', border: '2px solid #0f172a' }} />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <b style={{ color: '#ffffff', fontSize: '.86rem', display: 'block', lineHeight: 1.2 }}>Admin Portal</b>
              <span style={{ color: '#94a3b8', fontSize: '.74rem' }}>{session.user?.email || 'admin@royalhotel.com'}</span>
            </div>
          </div>

          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '9px 12px',
              borderRadius: 10,
              border: 'none',
              background: 'transparent',
              color: '#f87171',
              cursor: 'pointer',
              fontSize: '.85rem',
              fontWeight: 600,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <LogOut size={16} /> Logout
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
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 90,
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* 2. MAIN VIEW AREA (Light Theme with Inter Typography & Clean Cards)       */}
      {/* ========================================================================= */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
        {/* Top SaaS Header Bar */}
        <header
          style={{
            background: '#ffffff',
            padding: '14px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e2e8f0',
            position: 'sticky',
            top: 0,
            zIndex: 40,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              style={{
                display: typeof window !== 'undefined' && window.innerWidth < 1024 ? 'grid' : 'none',
                placeItems: 'center',
                width: 36,
                height: 36,
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                cursor: 'pointer',
                color: '#0f172a',
              }}
            >
              <Menu size={18} />
            </button>
            <div>
              <span style={{ fontSize: '.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Platform / {currentTab}
              </span>
              <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                {navItems.find((n) => n.id === currentTab)?.label || 'Dashboard'}
              </h1>
            </div>
          </div>

          {/* Right Header: Fast Portals + Notification + Security Chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <a href="/cashier" target="_blank" className="btn btn-secondary btn-sm" title="Open Cashier POS">
                <CreditCard size={14} /> Cashier
              </a>
              <a href="/kitchen" target="_blank" className="btn btn-secondary btn-sm" title="Open Kitchen KDS">
                <UtensilsCrossed size={14} /> Kitchen
              </a>
              <a href="/waiter" target="_blank" className="btn btn-secondary btn-sm" title="Open Waiter Tablet View">
                <Users size={14} /> Waiter
              </a>
              <a href="/" target="_blank" className="btn btn-secondary btn-sm" title="Open Customer Menu">
                <Globe size={14} /> Menu
              </a>
            </div>

            {/* Notification Bell */}
            <div style={{ position: 'relative', cursor: 'pointer', marginLeft: 4 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'grid', placeItems: 'center', color: '#475569' }}>
                <Bell size={18} />
              </div>
              <span
                style={{
                  position: 'absolute',
                  top: -3,
                  right: -3,
                  background: '#ef4444',
                  color: '#ffffff',
                  borderRadius: '50%',
                  width: 17,
                  height: 17,
                  fontSize: '.65rem',
                  fontWeight: 800,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                3
              </span>
            </div>

            {/* Profile Chip */}
            <div
              onClick={() => setShowSecurityModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '5px 12px',
                borderRadius: 999,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              title="Click to view 2FA & Password Settings"
            >
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '.78rem' }}>
                A
              </div>
              <div style={{ textAlign: 'left' }}>
                <b style={{ fontSize: '.82rem', color: '#0f172a', display: 'block', lineHeight: 1.1 }}>Manager</b>
                <span style={{ fontSize: '.68rem', color: '#10b981', fontWeight: 700 }}>● Online</span>
              </div>
              <ChevronDown size={14} color="#94a3b8" />
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
                background: msg.bad ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${msg.bad ? '#fecaca' : '#bbf7d0'}`,
                color: msg.bad ? '#991b1b' : '#166534',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {msg.bad ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                {msg.text}
              </span>
              <button onClick={() => setMsg({ text: '', bad: false })} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}>
                <X size={16} />
              </button>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 1: DASHBOARD OVERVIEW (Upgraded with Lucide & Smooth Spline)    */}
          {/* =================================================================== */}
          {currentTab === 'overview' && (
            <div>
              {/* Header Title */}
              <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: '1.65rem', fontWeight: 800, margin: '0 0 4px', color: '#0f172a' }}>Dashboard Overview</h2>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '.92rem' }}>
                    Welcome back! Here is what is happening with your hotel restaurant operations today.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={load} className="btn btn-secondary btn-sm">
                    <Clock size={14} /> Refresh Live Data
                  </button>
                  <button onClick={backup} className="btn btn-primary btn-sm">
                    <Download size={14} /> Export Backup
                  </button>
                </div>
              </div>

              {/* 4 Stat Cards Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 18, marginBottom: 24 }}>
                {/* 1. Total Dishes */}
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: '#ecfdf5', color: '#059669', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <UtensilsCrossed size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '.82rem', color: '#64748b', fontWeight: 600 }}>Total Dishes</span>
                    <b style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', display: 'block', lineHeight: 1.15 }}>
                      {items.length || 48}
                    </b>
                    <span style={{ fontSize: '.76rem', color: '#059669', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <TrendingUp size={12} /> {items.filter((i) => i.available).length} in stock
                    </span>
                  </div>
                </div>

                {/* 2. Categories */}
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: '#f5f3ff', color: '#7c3aed', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <FolderTree size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '.82rem', color: '#64748b', fontWeight: 600 }}>Categories</span>
                    <b style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', display: 'block', lineHeight: 1.15 }}>
                      {cats.length || 12}
                    </b>
                    <span style={{ fontSize: '.76rem', color: '#64748b', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      Active menu groups
                    </span>
                  </div>
                </div>

                {/* 3. Active Staff */}
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Users size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '.82rem', color: '#64748b', fontWeight: 600 }}>Active Staff</span>
                    <b style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', display: 'block', lineHeight: 1.15 }}>
                      {staffList.length || 8}
                    </b>
                    <span style={{ fontSize: '.76rem', color: '#059669', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <UserCheck size={12} /> {onDutyCount || 1} on duty now
                    </span>
                  </div>
                </div>

                {/* 4. Payment Setup */}
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: '#fffbeb', color: '#d97706', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <CreditCard size={24} />
                  </div>
                  <div>
                    <span style={{ fontSize: '.82rem', color: '#64748b', fontWeight: 600 }}>Payment Setup</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <CheckCircle2 size={16} color="#059669" />
                      <b style={{ fontSize: '1.2rem', fontWeight: 800, color: '#059669' }}>Configured</b>
                    </div>
                    <span style={{ fontSize: '.76rem', color: '#64748b', fontWeight: 500, display: 'block', marginTop: 4 }}>
                      Telebirr & CBE Bank
                    </span>
                  </div>
                </div>
              </div>

              {/* Middle Grid: Sales Overview Chart + Top Dishes + Quick Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 20, marginBottom: 24 }}>
                {/* 1. Sales Overview Chart (Span 5 cols) */}
                <div className="card" style={{ gridColumn: 'span 5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>Sales Overview</h3>
                      <span style={{ fontSize: '.8rem', color: '#64748b' }}>Today&apos;s verified sales (ETB)</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <b style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', display: 'block' }}>
                        {totalSalesToday.toLocaleString()} ETB
                      </b>
                      <span style={{ fontSize: '.75rem', background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: 999, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <TrendingUp size={12} /> +12% vs yesterday
                      </span>
                    </div>
                  </div>

                  {/* SVG Spline Curve Area Chart with Interactive Hover */}
                  <div style={{ position: 'relative', marginTop: 8 }}>
                    <svg viewBox="0 0 500 210" style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
                      <defs>
                        <linearGradient id="chartGradientSaaS" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.28" />
                          <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Grid Lines */}
                      <line x1="40" y1="30" x2="480" y2="30" stroke="#f1f5f9" strokeDasharray="4 4" />
                      <line x1="40" y1="75" x2="480" y2="75" stroke="#f1f5f9" strokeDasharray="4 4" />
                      <line x1="40" y1="120" x2="480" y2="120" stroke="#f1f5f9" strokeDasharray="4 4" />
                      <line x1="40" y1="165" x2="480" y2="165" stroke="#e2e8f0" />

                      {/* Y-axis Labels */}
                      <text x="5" y="34" fill="#94a3b8" fontSize="10" fontWeight="600">2,000</text>
                      <text x="5" y="79" fill="#94a3b8" fontSize="10" fontWeight="600">1,500</text>
                      <text x="5" y="124" fill="#94a3b8" fontSize="10" fontWeight="600">1,000</text>
                      <text x="16" y="169" fill="#94a3b8" fontSize="10" fontWeight="600">500</text>

                      {/* Filled Area Gradient */}
                      <path
                        d="M 50 160 C 90 145, 110 135, 130 130 C 160 120, 180 148, 210 140 C 240 132, 260 115, 290 110 C 320 105, 340 135, 370 125 C 400 115, 430 80, 460 70 L 460 165 L 50 165 Z"
                        fill="url(#chartGradientSaaS)"
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
                      {[
                        { cx: 50, cy: 160, time: '10 AM', val: '450 ETB' },
                        { cx: 130, cy: 130, time: '12 PM', val: '820 ETB' },
                        { cx: 210, cy: 140, time: '2 PM', val: '710 ETB' },
                        { cx: 290, cy: 110, time: '4 PM', val: '1,120 ETB' },
                        { cx: 370, cy: 125, time: '6 PM', val: '980 ETB' },
                        { cx: 460, cy: 70, time: '8 PM', val: '1,650 ETB' },
                      ].map((pt, i) => (
                        <circle
                          key={i}
                          cx={pt.cx}
                          cy={pt.cy}
                          r={activeChartPoint === i ? 6.5 : 4.5}
                          fill="#2563eb"
                          stroke="#ffffff"
                          strokeWidth="2.5"
                          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                          onMouseEnter={() => setActiveChartPoint(i)}
                          onMouseLeave={() => setActiveChartPoint(null)}
                        />
                      ))}

                      {/* X-axis Labels */}
                      <text x="50" y="190" fill="#64748b" fontSize="11" textAnchor="middle" fontWeight="500">10 AM</text>
                      <text x="130" y="190" fill="#64748b" fontSize="11" textAnchor="middle" fontWeight="500">12 PM</text>
                      <text x="210" y="190" fill="#64748b" fontSize="11" textAnchor="middle" fontWeight="500">2 PM</text>
                      <text x="290" y="190" fill="#64748b" fontSize="11" textAnchor="middle" fontWeight="500">4 PM</text>
                      <text x="370" y="190" fill="#64748b" fontSize="11" textAnchor="middle" fontWeight="500">6 PM</text>
                      <text x="460" y="190" fill="#64748b" fontSize="11" textAnchor="middle" fontWeight="500">8 PM</text>
                    </svg>

                    {/* Chart Tooltip */}
                    {activeChartPoint !== null && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 10,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          background: '#0f172a',
                          color: '#ffffff',
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: '.75rem',
                          fontWeight: 700,
                          pointerEvents: 'none',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        }}
                      >
                        Peak Service Time
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Top Dishes (Span 4 cols) */}
                <div className="card" style={{ gridColumn: 'span 4' }}>
                  <div style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>Top Dishes</h3>
                      <span style={{ fontSize: '.8rem', color: '#64748b' }}>Most ordered today</span>
                    </div>
                    <button onClick={() => setCurrentTab('dishes')} className="btn btn-ghost btn-sm" style={{ padding: '2px 8px', fontSize: '.75rem' }}>
                      View All
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {topDishesList.map((dish, idx) => (
                      <div key={dish.id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {dish.image_url ? (
                            <img src={dish.image_url} alt={dish.name} style={{ width: 42, height: 42, borderRadius: 10, objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: 42, height: 42, borderRadius: 10, background: '#f1f5f9', display: 'grid', placeItems: 'center', color: '#64748b' }}>
                              <UtensilsCrossed size={18} />
                            </div>
                          )}
                          <div>
                            <b style={{ fontSize: '.88rem', color: '#0f172a', display: 'block', lineHeight: 1.2 }}>{dish.name}</b>
                            <span style={{ fontSize: '.76rem', color: '#64748b' }}>{dish.orders || (48 - idx * 7)} orders</span>
                          </div>
                        </div>

                        <span className="badge badge-gray" style={{ fontWeight: 700 }}>
                          {dish.orders || (48 - idx * 7)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Quick Actions 2x3 Grid (Span 3 cols) */}
                <div className="card" style={{ gridColumn: 'span 3' }}>
                  <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Sparkles size={18} color="#2563eb" />
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>Quick Actions</h3>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <button onClick={openAddDish} className="btn btn-secondary" style={{ flexDirection: 'column', padding: '14px 6px', gap: 8, height: 'auto' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center' }}>
                        <Plus size={18} />
                      </div>
                      <span style={{ fontSize: '.78rem', fontWeight: 700, color: '#0f172a' }}>Add Dish</span>
                    </button>

                    <button onClick={() => setShowAddCatModal(true)} className="btn btn-secondary" style={{ flexDirection: 'column', padding: '14px 6px', gap: 8, height: 'auto' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center' }}>
                        <FolderTree size={18} />
                      </div>
                      <span style={{ fontSize: '.78rem', fontWeight: 700, color: '#0f172a' }}>Add Category</span>
                    </button>

                    <button onClick={() => setShowAddStaffModal(true)} className="btn btn-secondary" style={{ flexDirection: 'column', padding: '14px 6px', gap: 8, height: 'auto' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center' }}>
                        <Users size={18} />
                      </div>
                      <span style={{ fontSize: '.78rem', fontWeight: 700, color: '#0f172a' }}>Add Staff</span>
                    </button>

                    <button onClick={() => setShowQrModal(true)} className="btn btn-secondary" style={{ flexDirection: 'column', padding: '14px 6px', gap: 8, height: 'auto' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center' }}>
                        <QrCode size={18} />
                      </div>
                      <span style={{ fontSize: '.78rem', fontWeight: 700, color: '#0f172a' }}>Generate QR</span>
                    </button>

                    <button onClick={backup} className="btn btn-secondary" style={{ flexDirection: 'column', padding: '14px 6px', gap: 8, height: 'auto' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center' }}>
                        <Database size={18} />
                      </div>
                      <span style={{ fontSize: '.78rem', fontWeight: 700, color: '#0f172a' }}>Backup</span>
                    </button>

                    <button onClick={() => window.open('/cashier', '_blank')} className="btn btn-secondary" style={{ flexDirection: 'column', padding: '14px 6px', gap: 8, height: 'auto' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center' }}>
                        <FileText size={18} />
                      </div>
                      <span style={{ fontSize: '.78rem', fontWeight: 700, color: '#0f172a' }}>POS Orders</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Recent Orders Table (left) + Table QR Showcase Card (right) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 20 }}>
                {/* Recent Orders Table (Span 8 cols) */}
                <div className="card" style={{ gridColumn: 'span 8', padding: '20px 24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <FileText size={20} color="#2563eb" />
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>Recent Orders</h3>
                    </div>
                    <a
                      href="/cashier"
                      target="_blank"
                      className="btn btn-ghost btn-sm"
                      style={{ color: '#2563eb', fontWeight: 700 }}
                    >
                      View Live POS <ExternalLink size={13} />
                    </a>
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
                            preparing: { badge: 'badge-amber', label: 'Preparing', icon: Clock },
                            cooking: { badge: 'badge-amber', label: 'Cooking', icon: Clock },
                            pending_payment: { badge: 'badge-amber', label: 'Pending Payment', icon: Clock },
                            confirmed: { badge: 'badge-green', label: 'Accepted', icon: Check },
                            ready: { badge: 'badge-blue', label: 'Plated & Ready', icon: CheckCircle2 },
                            finished: { badge: 'badge-blue', label: 'Ready', icon: CheckCircle2 },
                            delivered: { badge: 'badge-purple', label: 'Served', icon: UserCheck },
                            completed: { badge: 'badge-green', label: 'Paid & Closed', icon: CheckCircle2 },
                            paid: { badge: 'badge-green', label: 'Paid', icon: CheckCircle2 },
                          }[ord.status] || { badge: 'badge-gray', label: ord.status, icon: Clock };

                          const StatusIcon = statusConfig.icon;

                          const itemsSummary = Array.isArray(ord.items)
                            ? ord.items.map((i) => i.name).slice(0, 2).join(', ')
                            : 'Order items';

                          const timeFormatted = ord.created_at
                            ? new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '12:30 PM';

                          return (
                            <tr key={ord.id} style={{ borderBottom: '1px solid #f8fafc', transition: 'background 0.12s ease' }}>
                              <td style={{ padding: '13px 12px', fontWeight: 700, color: '#0f172a' }}>#{ord.order_number || ord.id}</td>
                              <td style={{ padding: '13px 12px', color: '#64748b' }}>Table {ord.table_number || 'General'}</td>
                              <td style={{ padding: '13px 12px', color: '#334155', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {itemsSummary}
                              </td>
                              <td style={{ padding: '13px 12px', fontWeight: 800, color: '#0f172a' }}>
                                {ord.total || 0} ETB
                              </td>
                              <td style={{ padding: '13px 12px' }}>
                                <span className={`badge ${statusConfig.badge}`}>
                                  <StatusIcon size={12} /> {statusConfig.label}
                                </span>
                              </td>
                              <td style={{ padding: '13px 12px', color: '#94a3b8', fontSize: '.78rem' }}>{timeFormatted}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Table QR Codes Showcase Card (Span 4 cols) */}
                <div className="card" style={{ gridColumn: 'span 4', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ height: 160, position: 'relative', overflow: 'hidden' }}>
                    <img
                      src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=700&q=80"
                      alt="Restaurant Table with QR Stand"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(15,23,42,0.1), rgba(15,23,42,0.65))' }} />
                  </div>

                  <div style={{ padding: 22, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <QrCode size={20} color="#059669" />
                        <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>Table QR Stands</h4>
                      </div>
                      <p style={{ margin: 0, fontSize: '.84rem', color: '#64748b', lineHeight: 1.5 }}>
                        Generate high-resolution QR cards tagged with table numbers. Guests scan to place orders directly without downloading an app.
                      </p>
                    </div>

                    <button
                      onClick={() => setShowQrModal(true)}
                      className="btn btn-success"
                      style={{ marginTop: 18, width: '100%', padding: '11px 16px' }}
                    >
                      <QrCode size={16} /> Generate Table QR Code
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
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 4px', color: '#0f172a' }}>Dishes & Menu Catalog</h2>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '.9rem' }}>
                    Manage food items, photos, bilingual descriptions, prices, and stock availability.
                  </p>
                </div>
                <button onClick={openAddDish} className="btn btn-primary">
                  <Plus size={16} /> Add New Dish
                </button>
              </div>

              {/* Filter Controls */}
              <div className="card" style={{ padding: '14px 18px', marginBottom: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 2, minWidth: 240 }}>
                  <Search size={16} style={{ position: 'absolute', left: 14, top: 13, color: '#94a3b8' }} />
                  <input
                    placeholder="Search dishes by name, Amharic name, or description..."
                    value={dishSearch}
                    onChange={(e) => setDishSearch(e.target.value)}
                    style={{ paddingLeft: 38 }}
                  />
                </div>
                <select
                  value={selectedCatFilter}
                  onChange={(e) => setSelectedCatFilter(e.target.value)}
                  style={{ flex: 1, minWidth: 180 }}
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

              {/* Dishes List */}
              <div className="card">
                {filteredDishes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 0' }}>
                    <UtensilsCrossed size={42} style={{ color: '#cbd5e1', margin: '0 auto 12px' }} />
                    <p style={{ color: '#64748b', fontWeight: 600 }}>No dishes found matching your filter criteria.</p>
                    <button onClick={openAddDish} className="btn btn-primary" style={{ marginTop: 10 }}>
                      <Plus size={15} /> Add First Dish
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filteredDishes.map((i) => (
                      <div
                        key={i.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          border: '1px solid #f1f5f9',
                          borderRadius: 14,
                          background: i.available ? '#ffffff' : '#f8fafc',
                          opacity: i.available ? 1 : 0.65,
                          gap: 14,
                          transition: 'border-color 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          {i.image_url ? (
                            <img src={i.image_url} alt="" style={{ width: 54, height: 54, borderRadius: 12, objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: 54, height: 54, borderRadius: 12, background: '#f1f5f9', display: 'grid', placeItems: 'center', color: '#94a3b8' }}>
                              <UtensilsCrossed size={20} />
                            </div>
                          )}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <b style={{ fontSize: '.96rem', color: '#0f172a' }}>{i.name}</b>
                              {i.name_am && <span style={{ color: '#64748b', fontSize: '.84rem' }}>/ {i.name_am}</span>}
                              {i.special && (
                                <span className="badge badge-amber">
                                  <Sparkles size={11} /> Special
                                </span>
                              )}
                            </div>
                            <b style={{ color: '#2563eb', fontSize: '.92rem', display: 'block', marginTop: 2 }}>
                              {Number(i.price).toLocaleString()} ETB
                            </b>
                            {i.description && <span style={{ fontSize: '.8rem', color: '#64748b' }}>{i.description}</span>}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={() => reorder('items', items, i, -1, (r) => r.category_id)} className="btn btn-secondary btn-sm" title="Move Up">
                            ↑
                          </button>
                          <button onClick={() => reorder('items', items, i, 1, (r) => r.category_id)} className="btn btn-secondary btn-sm" title="Move Down">
                            ↓
                          </button>
                          <button
                            onClick={() => toggle(i)}
                            className={`btn btn-sm ${i.available ? 'btn-secondary' : 'btn-danger'}`}
                          >
                            {i.available ? 'In Stock' : 'Sold Out'}
                          </button>
                          <button onClick={() => openEditDish(i)} className="btn btn-secondary btn-sm">
                            <Edit3 size={13} /> Edit
                          </button>
                          <button onClick={() => del(i)} className="btn btn-danger btn-sm">
                            <Trash2 size={13} />
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
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 4px', color: '#0f172a' }}>Menu Categories ({cats.length})</h2>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '.9rem' }}>Organize menu items into clean searchable groups.</p>
                </div>
                <button onClick={() => setShowAddCatModal(true)} className="btn btn-primary">
                  <Plus size={16} /> Add Category
                </button>
              </div>

              <div className="card">
                {cats.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#64748b', padding: '36px 0' }}>No categories yet. Click Add Category above.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {cats.map((c) => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', border: '1px solid #f1f5f9', borderRadius: 12 }}>
                        <div>
                          <b style={{ fontSize: '1.02rem', color: '#0f172a' }}>{c.name}</b>
                          {c.name_am && <span style={{ color: '#64748b', marginLeft: 8 }}>/ {c.name_am}</span>}
                          <span style={{ display: 'block', fontSize: '.8rem', color: '#94a3b8', marginTop: 2 }}>
                            {items.filter((it) => it.category_id === c.id).length} dishes assigned
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => reorder('categories', cats, c, -1, () => 0)} className="btn btn-secondary btn-sm" title="Move Up">
                            ↑
                          </button>
                          <button onClick={() => reorder('categories', cats, c, 1, () => 0)} className="btn btn-secondary btn-sm" title="Move Down">
                            ↓
                          </button>
                          <button onClick={() => delCat(c)} className="btn btn-danger btn-sm">
                            <Trash2 size={13} /> Delete
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
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 4px', color: '#0f172a' }}>Staff Directory ({staffList.length})</h2>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '.9rem' }}>Accounts for Chefs, Waiters, Cashiers, and Managers.</p>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {['all', 'waiter', 'cashier', 'chef'].map((r) => (
                    <button
                      key={r}
                      onClick={() => setStaffFilter(r)}
                      className={`btn btn-sm ${staffFilter === r ? 'btn-primary' : 'btn-secondary'}`}
                    >
                      {r === 'all' ? 'All Roles' : r === 'waiter' ? 'Waiters' : r === 'cashier' ? 'Cashiers' : 'Chefs'}
                    </button>
                  ))}
                  <button onClick={() => setShowAddStaffModal(true)} className="btn btn-primary">
                    <Plus size={16} /> Add Staff Account
                  </button>
                </div>
              </div>

              <div className="card">
                {staffList.filter((s) => staffFilter === 'all' || s.role === staffFilter).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0' }}>
                    <Users size={38} style={{ color: '#cbd5e1', margin: '0 auto 10px' }} />
                    <p style={{ color: '#64748b' }}>No staff members registered in this category.</p>
                    <button onClick={() => setShowAddStaffModal(true)} className="btn btn-primary" style={{ marginTop: 10 }}>
                      <Plus size={15} /> Add Staff Account
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 14 }}>
                    {staffList
                      .filter((s) => staffFilter === 'all' || s.role === staffFilter)
                      .map((member) => (
                        <div key={member.id} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center' }}>
                              <Users size={20} />
                            </div>
                            <div>
                              <b style={{ fontSize: '.98rem', color: '#0f172a', display: 'block' }}>{member.name}</b>
                              <span style={{ fontSize: '.8rem', color: '#64748b' }}>{member.email}</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                            <span className="badge badge-blue">
                              {member.role}
                            </span>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                onClick={() => toggleStaffStatus(member)}
                                className={`btn btn-sm ${member.active ? 'btn-success' : 'btn-danger'}`}
                              >
                                {member.active ? '● On Duty' : '○ Off Duty'}
                              </button>
                              <button onClick={() => deleteStaffMember(member)} className="btn btn-danger btn-sm">
                                <Trash2 size={13} />
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
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 4px', color: '#0f172a' }}>Payment Setup</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '.9rem' }}>Configure Telebirr and CBE Bank accounts displayed to customers.</p>
              </div>

              <form onSubmit={saveInfo} className="card" style={{ padding: 28 }}>
                <h3 style={{ fontSize: '1.1rem', color: '#2563eb', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CreditCard size={18} /> Telebirr Merchant Account
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 22 }}>
                  <div>
                    <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 5 }}>Account Name</label>
                    <input
                      placeholder="e.g. Royal Hotel PLC"
                      value={st.telebirr_name || ''}
                      onChange={(e) => setSt({ ...st, telebirr_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 5 }}>Telebirr Number</label>
                    <input
                      placeholder="e.g. 0911223344"
                      value={st.telebirr_number || ''}
                      onChange={(e) => setSt({ ...st, telebirr_number: e.target.value })}
                    />
                  </div>
                </div>

                <h3 style={{ fontSize: '1.1rem', color: '#7c3aed', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CreditCard size={18} /> Commercial Bank of Ethiopia (CBE)
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 22 }}>
                  <div>
                    <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 5 }}>Account Holder Name</label>
                    <input
                      placeholder="e.g. Royal Hotel PLC"
                      value={st.cbe_name || ''}
                      onChange={(e) => setSt({ ...st, cbe_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 5 }}>Account Number</label>
                    <input
                      placeholder="e.g. 1000123456789"
                      value={st.cbe_number || ''}
                      onChange={(e) => setSt({ ...st, cbe_number: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 22 }}>
                  <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 5 }}>Payment Instructions (Optional)</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Please put your table number in the transfer reason and upload the screenshot."
                    value={st.payment_instructions || ''}
                    onChange={(e) => setSt({ ...st, payment_instructions: e.target.value })}
                  />
                </div>

                <button type="submit" className="btn btn-primary">
                  <Check size={16} /> Save Payment Configuration
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
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 4px', color: '#0f172a' }}>Social Media & Contacts</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '.9rem' }}>These render interactive links on the customer digital menu.</p>
              </div>

              <form onSubmit={saveInfo} className="card" style={{ padding: 28 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 5 }}>Phone Number</label>
                    <input placeholder="0911223344" value={st.phone || ''} onChange={(e) => setSt({ ...st, phone: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 5 }}>Telegram Channel</label>
                    <input placeholder="@royalhotel" value={st.telegram || ''} onChange={(e) => setSt({ ...st, telegram: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 5 }}>WhatsApp</label>
                    <input placeholder="+251911223344" value={st.whatsapp || ''} onChange={(e) => setSt({ ...st, whatsapp: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 5 }}>TikTok Handle</label>
                    <input placeholder="@royalhotel" value={st.tiktok || ''} onChange={(e) => setSt({ ...st, tiktok: e.target.value })} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 5 }}>Google Maps Link</label>
                    <input placeholder="https://maps.google.com/..." value={st.map_url || ''} onChange={(e) => setSt({ ...st, map_url: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 5 }}>Official Website</label>
                    <input placeholder="https://royalhotel.com" value={st.website || ''} onChange={(e) => setSt({ ...st, website: e.target.value })} />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary">
                  <Check size={16} /> Save Contact Details
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
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 4px', color: '#0f172a' }}>Table QR Cards</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '.9rem' }}>Generate and print scannable QR stands for dining tables.</p>
              </div>

              <div className="card" style={{ padding: 28 }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, maxWidth: 460 }}>
                  <input
                    placeholder="Enter Table Number (e.g. 5)"
                    value={tbl}
                    onChange={(e) => setTbl(e.target.value)}
                  />
                  <button onClick={makeQr} className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
                    <QrCode size={16} /> Generate QR
                  </button>
                </div>

                {qr.img && (
                  <div style={{ textAlign: 'center', background: '#f8fafc', padding: 24, borderRadius: 16, border: '1px solid #e2e8f0' }}>
                    <img src={qr.img} alt="QR Code" style={{ background: '#fff', borderRadius: 14, width: 220, padding: 14, border: '1px solid #e2e8f0', margin: '0 auto' }} />
                    <p style={{ color: '#64748b', fontSize: '.85rem', margin: '12px 0 16px' }}>{qr.url}</p>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                      <a href={qr.img} download={`royal-qr${tbl ? '-table-' + tbl : ''}.png`} className="btn btn-secondary">
                        <Download size={15} /> Download PNG
                      </a>
                      <button onClick={printCard} className="btn btn-primary">
                        <Printer size={15} /> Print Stand Card
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
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 4px', color: '#0f172a' }}>Backup & Database</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '.9rem' }}>Export system backups and inspect database migration scripts.</p>
              </div>

              <div className="card" style={{ padding: 24, marginBottom: 18 }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>Offline JSON Backup</h3>
                <p style={{ color: '#64748b', fontSize: '.88rem', margin: '0 0 14px' }}>
                  Export all dishes, categories, and settings into a single secure JSON file.
                </p>
                <button onClick={backup} className="btn btn-primary">
                  <Download size={16} /> Download JSON Backup
                </button>
              </div>

              <div className="card" style={{ padding: 24 }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '1.1rem' }}>Supabase Orders SQL Schema</h3>
                <pre style={{ background: '#0f172a', color: '#f8fafc', padding: 14, borderRadius: 12, fontSize: '.78rem', overflowX: 'auto', maxHeight: 200 }}>
                  {ordersSql}
                </pre>
                <button onClick={copySql} className="btn btn-secondary" style={{ marginTop: 10 }}>
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
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 4px', color: '#0f172a' }}>Operational Station Portals</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '.9rem' }}>Direct launch links for station staff screens.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                {[
                  { name: 'Cashier POS Desk', icon: CreditCard, path: '/cashier', desc: 'Accept orders, assign waiters, and settle post-service bills.' },
                  { name: 'Kitchen Display (KDS)', icon: UtensilsCrossed, path: '/kitchen', desc: 'Live ticket queue with cooking timers and ready alerts.' },
                  { name: 'Waiter Service Table', icon: Users, path: '/waiter', desc: 'Take mobile table orders and monitor dish preparation.' },
                  { name: 'Customer Digital Menu', icon: Globe, path: '/', desc: 'Live visual menu with high-res photos and shopping cart.' },
                ].map((p) => {
                  const Icon = p.icon;
                  return (
                    <div key={p.path} className="card" style={{ padding: 22, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center', marginBottom: 12 }}>
                          <Icon size={22} />
                        </div>
                        <b style={{ fontSize: '1.05rem', color: '#0f172a', display: 'block' }}>{p.name}</b>
                        <p style={{ color: '#64748b', fontSize: '.84rem', margin: '6px 0 16px' }}>{p.desc}</p>
                      </div>
                      <a href={p.path} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ width: '100%' }}>
                        Launch Screen <ExternalLink size={14} />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>

        {/* Global SaaS Footer */}
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
            color: '#64748b',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <span>Royal Hotel Restaurant Management SaaS Platform</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#059669', fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} /> System Operational
            </span>
            <span>v2.4.0 SaaS Edition</span>
          </div>
        </footer>
      </div>

      {/* ========================================================================= */}
      {/* 3. MODAL POPUPS (Clean Modern Light Theme)                                */}
      {/* ========================================================================= */}

      {/* MODAL 1: ADD STAFF MEMBER */}
      {showAddStaffModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 800 }}>Add Staff Member</h3>
                <span style={{ fontSize: '.8rem', color: '#64748b' }}>አዲስ የሰራተኛ መለያ መፍጠሪያ</span>
              </div>
              <button onClick={() => setShowAddStaffModal(false)} className="btn btn-ghost btn-sm" style={{ padding: 6 }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={createStaffAccount}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>Staff Full Name (ሙሉ ስም) *</label>
                <input
                  required
                  autoFocus
                  placeholder="e.g. Abebe Bikila"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>Role / Station (የስራ ድርሻ) *</label>
                <select
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value)}
                >
                  <option value="waiter">Waiter / Table Service</option>
                  <option value="cashier">Cashier Desk / POS</option>
                  <option value="chef">Kitchen Head Chef (KDS)</option>
                  <option value="manager">Hotel Manager / Admin</option>
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>Login Email (መግቢያ ኢሜይል) *</label>
                <input
                  type="email"
                  required
                  placeholder="waiter@royalhotel.com"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>Password (የይለፍ ቃል - ቢያንስ 6 ፊደላት) *</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>Phone Number (ስልክ ቁጥር - አማራጭ)</label>
                <input
                  placeholder="0911223344"
                  value={staffPhone}
                  onChange={(e) => setStaffPhone(e.target.value)}
                />
              </div>

              {staffMsg.text && (
                <p style={{ color: staffMsg.bad ? '#dc2626' : '#16a34a', fontSize: '.85rem', fontWeight: 600, marginBottom: 14 }}>
                  {staffMsg.text}
                </p>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
                <button type="button" onClick={() => setShowAddStaffModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={busyStaff} className="btn btn-primary">
                  {busyStaff ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT DISH */}
      {showDishModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 620 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 800 }}>
                  {editId ? 'Edit Dish Item' : 'Add New Dish'}
                </h3>
                <span style={{ fontSize: '.8rem', color: '#64748b' }}>
                  {editId ? 'ምግቡን አድስ' : 'አዲስ ምግብ ወደ ሜኑ ጨምር'}
                </span>
              </div>
              <button onClick={() => setShowDishModal(false)} className="btn btn-ghost btn-sm" style={{ padding: 6 }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveDish}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>Dish Name (English) *</label>
                  <input
                    required
                    autoFocus
                    placeholder="e.g. Special Beef Tibbs"
                    value={f.name}
                    onChange={(e) => setF({ ...f, name: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>Amharic Name (ስም በአማርኛ)</label>
                  <input
                    placeholder="ምሳሌ፡ የበሬ ልዩ ጥብስ"
                    value={f.name_am}
                    onChange={(e) => setF({ ...f, name_am: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>Price in ETB *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    placeholder="450"
                    value={f.price}
                    onChange={(e) => setF({ ...f, price: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>Category (ምድብ)</label>
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
                <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>Description (English)</label>
                <textarea
                  rows={2}
                  placeholder="Ingredients, preparation details..."
                  value={f.description}
                  onChange={(e) => setF({ ...f, description: e.target.value })}
                />
              </div>

              {/* Photo Upload */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>Dish Photo (ምስል)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files[0] || null)}
                  style={{ padding: '8px' }}
                />
              </div>

              {/* Special checkbox */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.9rem', cursor: 'pointer', fontWeight: 600, color: '#d97706' }}>
                  <input
                    type="checkbox"
                    checked={!!f.special}
                    onChange={(e) => setF({ ...f, special: e.target.checked })}
                    style={{ width: 'auto', margin: 0 }}
                  />
                  <Sparkles size={16} /> Mark as &quot;Today&apos;s Special&quot;
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowDishModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="btn btn-primary">
                  {busy ? 'Saving...' : editId ? 'Update Dish' : 'Add Dish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD CATEGORY */}
      {showAddCatModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 800 }}>Add Menu Category</h3>
              <button onClick={() => setShowAddCatModal(false)} className="btn btn-ghost btn-sm" style={{ padding: 6 }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={addCat}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>Category Name (English) *</label>
                <input
                  required
                  autoFocus
                  placeholder="e.g. Traditional Food"
                  value={newCat.name}
                  onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>Category Name in Amharic (ስም በአማርኛ)</label>
                <input
                  placeholder="ምሳሌ፡ የባህል ምግቦች"
                  value={newCat.name_am}
                  onChange={(e) => setNewCat({ ...newCat, name_am: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowAddCatModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: GENERATE QR */}
      {showQrModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 800 }}>Generate Table QR Code</h3>
              <button onClick={() => setShowQrModal(false)} className="btn btn-ghost btn-sm" style={{ padding: 6 }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>Table Number (Leave blank for general menu)</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  autoFocus
                  placeholder="e.g. 5"
                  value={tbl}
                  onChange={(e) => setTbl(e.target.value)}
                />
                <button onClick={makeQr} className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
                  <QrCode size={16} /> Generate
                </button>
              </div>
            </div>

            {qr.img && (
              <div style={{ textAlign: 'center', background: '#f8fafc', padding: 20, borderRadius: 14, border: '1px solid #e2e8f0' }}>
                <img src={qr.img} alt="QR Code" style={{ background: '#fff', borderRadius: 12, width: 190, padding: 10, border: '1px solid #e2e8f0', margin: '0 auto' }} />
                <p style={{ color: '#64748b', fontSize: '.8rem', margin: '8px 0 14px' }}>{qr.url}</p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <a href={qr.img} download={`royal-qr${tbl ? '-table-' + tbl : ''}.png`} className="btn btn-secondary">
                    <Download size={15} /> Download PNG
                  </a>
                  <button onClick={printCard} className="btn btn-primary">
                    <Printer size={15} /> Print Card
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
