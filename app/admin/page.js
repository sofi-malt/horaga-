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
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [newCat, setNewCat] = useState({ name: '', name_am: '' });
  const [msg, setMsg] = useState({ text: '', bad: false });
  const [busy, setBusy] = useState(false);
  const [tbl, setTbl] = useState('');
  const [qr, setQr] = useState({ url: '', img: '' });
  const [st, setSt] = useState({});
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);

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

  const say = (text, bad = false) => setMsg({ text, bad });

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
        setStaffMsg({
          text: `✓ Account created successfully for ${staffName} (${staffRole})!`,
          bad: false,
        });
        setStaffName('');
        setStaffEmail('');
        setStaffPassword('');
        setStaffPhone('');
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

  const login = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    say(error ? error.message : '', !!error);
  };

  const save = async (e) => {
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
    say('Saved.');
    load();
  };

  const edit = (i) => {
    setEditId(i.id);
    setFile(null);
    setF({
      ...EMPTY,
      ...i,
      price: i.price,
      category_id: i.category_id || '',
      tags: i.tags || [],
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggle = async (i) => {
    await supabase.from('items').update({ available: !i.available }).eq('id', i.id);
    load();
  };

  const del = async (i) => {
    if (confirm(`Delete "${i.name}"?`)) {
      await supabase.from('items').delete().eq('id', i.id);
      load();
    }
  };

  const addCat = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('categories').insert({
      name: newCat.name.trim(),
      name_am: newCat.name_am.trim() || null,
      sort: cats.length,
    });
    if (error) return say(error.message, true);
    setNewCat({ name: '', name_am: '' });
    load();
  };

  const delCat = async (c) => {
    if (confirm(`Delete category "${c.name}"? Its dishes stay in the menu under "Other".`)) {
      await supabase.from('categories').delete().eq('id', c.id);
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
    say(error ? error.message : 'Restaurant info saved.', !!error);
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

  if (session === undefined)
    return (
      <main className="wrap">
        <p className="empty">Loading...</p>
      </main>
    );

  if (!session)
    return (
      <StaffLoginForm
        title="Admin & Manager Sign In"
        subtitle="Full administrative control for Hiraga Restaurant."
        icon="⚙️"
        lang="en"
        onLoginSuccess={(s) => setSession(s)}
      />
    );

  return (
    <main className="wrap">
      {/* Top Bar with shortcuts */}
      <div className="bar" style={{ flexWrap: 'wrap', gap: 10 }}>
        <b>⚙️ Hiraga Admin</b>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <a href="/cashier" className="btn sm o">
            💵 Cashier Desk
          </a>
          <a href="/kitchen" className="btn sm" style={{ background: 'var(--b)', color: '#fff' }}>
            👨‍🍳 Kitchen KDS
          </a>
          <a href="/waiter" className="btn sm" style={{ background: '#8b5cf6', color: '#fff' }}>
            🛎️ Waiter Desk
          </a>
          <button
            className="btn sm o"
            onClick={() => setShowSecurityModal(true)}
            title="Change Password & 2FA"
          >
            🔑 Security & Password
          </button>
          <a href="/" style={{ color: 'var(--o)', fontSize: '.9rem' }}>
            View menu
          </a>
          <button className="btn sm x" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>
      <p className={msg.bad ? 'err' : 'ok'}>{msg.text}</p>

      {/* Dish Form */}
      <form className="panel" onSubmit={save}>
        <h2 style={{ marginTop: 0 }}>{editId ? 'Edit dish' : 'Add a dish'}</h2>
        <div className="row">
          <input
            required
            placeholder="Name"
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
          <input
            placeholder="Name in Amharic (optional)"
            value={f.name_am || ''}
            onChange={(e) => setF({ ...f, name_am: e.target.value })}
          />
        </div>
        <textarea
          rows={2}
          placeholder="Description"
          value={f.description || ''}
          onChange={(e) => setF({ ...f, description: e.target.value })}
        />
        <textarea
          rows={2}
          placeholder="Description in Amharic (optional)"
          value={f.description_am || ''}
          onChange={(e) => setF({ ...f, description_am: e.target.value })}
        />
        <div className="row">
          <input
            required
            type="number"
            min="0"
            step="any"
            placeholder="Price (ETB)"
            value={f.price}
            onChange={(e) => setF({ ...f, price: e.target.value })}
          />
          <select
            value={f.category_id}
            onChange={(e) => setF({ ...f, category_id: e.target.value })}
          >
            <option value="">No category</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files[0] || null)}
        />
        {f.image_url && !file && (
          <p className="sm">A picture is already attached. Choose a file to replace it.</p>
        )}
        <div className="row">
          {TAGS.map((t) => (
            <label key={t.k}>
              <input
                type="checkbox"
                style={{ width: 'auto' }}
                checked={(f.tags || []).includes(t.k)}
                onChange={(e) =>
                  setF({
                    ...f,
                    tags: e.target.checked
                      ? [...(f.tags || []), t.k]
                      : (f.tags || []).filter((x) => x !== t.k),
                  })
                }
              />{' '}
              {t.en}
            </label>
          ))}
        </div>
        <label>
          <input
            type="checkbox"
            style={{ width: 'auto' }}
            checked={!!f.special}
            onChange={(e) => setF({ ...f, special: e.target.checked })}
          />{' '}
          Today's special
        </label>
        <br />
        <label>
          <input
            type="checkbox"
            style={{ width: 'auto' }}
            checked={f.available}
            onChange={(e) => setF({ ...f, available: e.target.checked })}
          />{' '}
          Available today
        </label>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn" disabled={busy}>
            {busy ? 'Saving...' : 'Save dish'}
          </button>
          {editId && (
            <button
              type="button"
              className="btn x"
              onClick={() => {
                setEditId(null);
                setF(EMPTY);
                setFile(null);
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Categories */}
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Categories</h2>
        {cats.map((c) => (
          <div className="al" key={c.id}>
            <div>
              {c.name}
              {c.name_am ? ` / ${c.name_am}` : ''}
            </div>
            <button
              className="btn x sm"
              aria-label="Move up"
              onClick={() => reorder('categories', cats, c, -1, () => 0)}
            >
              ↑
            </button>
            <button
              className="btn x sm"
              aria-label="Move down"
              onClick={() => reorder('categories', cats, c, 1, () => 0)}
            >
              ↓
            </button>
            <button className="btn x sm" onClick={() => delCat(c)}>
              Delete
            </button>
          </div>
        ))}
        <form className="row" onSubmit={addCat}>
          <input
            required
            placeholder="New category"
            value={newCat.name}
            onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
          />
          <input
            placeholder="In Amharic (optional)"
            value={newCat.name_am}
            onChange={(e) => setNewCat({ ...newCat, name_am: e.target.value })}
          />
          <button className="btn o">Add category</button>
        </form>
      </div>

      {/* Dishes List */}
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Dishes ({items.length})</h2>
        {!items.length && (
          <p className="empty">No dishes yet. Add the first one above.</p>
        )}
        {items.map((i) => (
          <div className="al" key={i.id} style={{ opacity: i.available ? 1 : 0.55 }}>
            {i.image_url ? <img src={i.image_url} alt="" /> : <div className="ph">🍽️</div>}
            <div>
              <b>{i.name}</b>
              <div className="sm">{Number(i.price).toLocaleString()} ETB</div>
            </div>
            <button
              className="btn x sm"
              aria-label="Move up"
              onClick={() => reorder('items', items, i, -1, (r) => r.category_id)}
            >
              ↑
            </button>
            <button
              className="btn x sm"
              aria-label="Move down"
              onClick={() => reorder('items', items, i, 1, (r) => r.category_id)}
            >
              ↓
            </button>
            <button className="btn x sm" onClick={() => toggle(i)}>
              {i.available ? 'Sold out' : 'Available'}
            </button>
            <button className="btn x sm" onClick={() => edit(i)}>
              Edit
            </button>
            <button className="btn x sm" onClick={() => del(i)}>
              Delete
            </button>
          </div>
        ))}
      </div>

      {/* Staff Management & Account Creation */}
      <div className="panel" id="staff-section">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 8,
          }}
        >
          <h2 style={{ margin: 0 }}>👥 Staff & Account Management (የሰራተኞች መለያ መፍጠሪያ)</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/cashier" target="_blank" className="btn sm o">
              💵 Cashier Desk
            </a>
            <a
              href="/kitchen"
              target="_blank"
              className="btn sm"
              style={{ background: 'var(--b)', color: '#fff' }}
            >
              👨‍🍳 Kitchen KDS
            </a>
            <a
              href="/waiter"
              target="_blank"
              className="btn sm"
              style={{ background: '#8b5cf6', color: '#fff' }}
            >
              🛎️ Waiter Desk
            </a>
          </div>
        </div>
        <p className="sm" style={{ color: 'var(--mu)', marginTop: 0 }}>
          Create and manage accounts for your Head Chef, Waiters, and Cashiers. Staff can sign in to their respective portals with their email and password.
        </p>

        {/* Staff Creation Form */}
        <form
          onSubmit={createStaffAccount}
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--bd)',
            borderRadius: 14,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <b style={{ fontSize: '1rem', display: 'block', marginBottom: 12, color: 'var(--fg)' }}>
            ➕ Create New Staff Account (አዲስ የሰራተኛ መለያ ፍጠር)
          </b>

          <div className="row">
            <div style={{ flex: 1 }}>
              <label
                style={{
                  fontSize: '.8rem',
                  color: 'var(--mu)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Staff Full Name (ሙሉ ስም) *
              </label>
              <input
                required
                placeholder="e.g. Abebe Bikila"
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
              />
            </div>

            <div style={{ flex: 1 }}>
              <label
                style={{
                  fontSize: '.8rem',
                  color: 'var(--mu)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Role / Position (የስራ ድርሻ) *
              </label>
              <select
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value)}
                style={{
                  background: 'var(--bg)',
                  color: 'var(--fg)',
                  border: '1px solid var(--bd)',
                  borderRadius: 8,
                  padding: '9px 12px',
                  width: '100%',
                  fontSize: '.95rem',
                }}
              >
                <option value="chef">👨‍🍳 Head Chef / Kitchen (KDS)</option>
                <option value="waiter">🛎️ Waiter / Table Service</option>
                <option value="cashier">💵 Cashier Desk / POS</option>
                <option value="manager">👔 Hotel Manager / Admin</option>
              </select>
            </div>
          </div>

          <div className="row" style={{ marginTop: 10 }}>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  fontSize: '.8rem',
                  color: 'var(--mu)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Email Address (መግቢያ ኢሜይል) *
              </label>
              <input
                type="email"
                required
                placeholder="staff@hiraga.com"
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
              />
            </div>

            <div style={{ flex: 1 }}>
              <label
                style={{
                  fontSize: '.8rem',
                  color: 'var(--mu)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Password (የይለፍ ቃል - ቢያንስ 6 ፊደል) *
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={staffPassword}
                onChange={(e) => setStaffPassword(e.target.value)}
              />
            </div>

            <div style={{ flex: 1 }}>
              <label
                style={{
                  fontSize: '.8rem',
                  color: 'var(--mu)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Phone Number (ስልክ ቁጥር - አማራጭ)
              </label>
              <input
                placeholder="0911223344"
                value={staffPhone}
                onChange={(e) => setStaffPhone(e.target.value)}
              />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 14,
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <button
              type="submit"
              disabled={busyStaff}
              className="btn o"
              style={{ padding: '10px 20px', fontWeight: 600 }}
            >
              {busyStaff ? 'Creating account...' : '➕ Create Staff Account'}
            </button>
            {staffMsg.text && (
              <span
                className={staffMsg.bad ? 'err' : 'ok'}
                style={{ fontSize: '.9rem', fontWeight: 600 }}
              >
                {staffMsg.text}
              </span>
            )}
          </div>
        </form>

        {/* Staff Directory */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <b style={{ fontSize: '1rem' }}>
              📋 Staff Directory ({staffList.length}) (የተመዘገቡ ሰራተኞች)
            </b>
            <div style={{ display: 'flex', gap: 6 }}>
              {['all', 'chef', 'waiter', 'cashier'].map((r) => (
                <button
                  key={r}
                  onClick={() => setStaffFilter(r)}
                  className={`btn sm ${staffFilter === r ? 'o' : 'x'}`}
                  style={{ fontSize: '.75rem', padding: '2px 8px' }}
                >
                  {r === 'all'
                    ? 'All'
                    : r === 'chef'
                    ? '👨‍🍳 Chefs'
                    : r === 'waiter'
                    ? '🛎️ Waiters'
                    : '💵 Cashiers'}
                </button>
              ))}
            </div>
          </div>

          {staffList.filter((s) => staffFilter === 'all' || s.role === staffFilter).length === 0 ? (
            <p className="empty" style={{ margin: '14px 0' }}>
              No staff members registered in this category yet. Add your first staff member above.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {staffList
                .filter((s) => staffFilter === 'all' || s.role === staffFilter)
                .map((member) => (
                  <div
                    key={member.id}
                    className="al"
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--bd)',
                      borderRadius: 10,
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span
                        style={{
                          fontSize: '1.4rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          padding: 8,
                          borderRadius: 8,
                        }}
                      >
                        {member.role === 'chef'
                          ? '👨‍🍳'
                          : member.role === 'waiter'
                          ? '🛎️'
                          : member.role === 'cashier'
                          ? '💵'
                          : '👔'}
                      </span>
                      <div>
                        <b>{member.name}</b>
                        <div
                          style={{
                            fontSize: '.82rem',
                            color: 'var(--mu)',
                            display: 'flex',
                            gap: 8,
                          }}
                        >
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
                          border: `1px solid ${
                            member.role === 'chef'
                              ? '#3b82f6'
                              : member.role === 'waiter'
                              ? '#8b5cf6'
                              : member.role === 'cashier'
                              ? '#10b981'
                              : '#f59e0b'
                          }`,
                        }}
                      >
                        {member.role === 'chef'
                          ? 'Head Chef'
                          : member.role === 'waiter'
                          ? 'Waiter'
                          : member.role === 'cashier'
                          ? 'Cashier'
                          : 'Manager'}
                      </span>

                      <button
                        onClick={() => toggleStaffStatus(member)}
                        className={`btn sm ${member.active ? 'ok' : 'x'}`}
                        style={{
                          fontSize: '.75rem',
                          padding: '3px 8px',
                          background: member.active
                            ? 'rgba(34, 197, 94, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                          color: member.active ? '#4ade80' : '#f87171',
                          border: `1px solid ${member.active ? '#22c55e' : '#ef4444'}`,
                        }}
                      >
                        {member.active ? '● On Duty' : '○ Off Duty'}
                      </button>

                      <button
                        onClick={() => deleteStaffMember(member)}
                        className="btn sm x"
                        style={{ fontSize: '.75rem', padding: '3px 8px' }}
                        title="Remove staff member"
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

      {/* Restaurant Info & Payment Accounts */}
      <form className="panel" onSubmit={saveInfo}>
        <h2 style={{ marginTop: 0 }}>Restaurant & Payment Accounts</h2>
        <p className="sm">
          Set up bank and mobile transfer accounts shown to customers during checkout.
        </p>

        <h3 style={{ fontSize: '1.1rem', color: 'var(--o)', margin: '14px 0 6px' }}>
          📱 Telebirr Details
        </h3>
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

        <h3 style={{ fontSize: '1.1rem', color: 'var(--b)', margin: '14px 0 6px' }}>
          🏦 Commercial Bank of Ethiopia (CBE)
        </h3>
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



        <h3 style={{ fontSize: '1.1rem', margin: '14px 0 6px' }}>General Information</h3>
        <div className="row">
          <input
            placeholder="Tagline"
            value={st.tagline || ''}
            onChange={(e) => setSt({ ...st, tagline: e.target.value })}
          />
          <input
            placeholder="Tagline in Amharic"
            value={st.tagline_am || ''}
            onChange={(e) => setSt({ ...st, tagline_am: e.target.value })}
          />
        </div>
        <textarea
          rows={3}
          placeholder={'Opening hours, e.g.\nMon-Sat 7:00-22:00\nSun 8:00-21:00'}
          value={st.hours || ''}
          onChange={(e) => setSt({ ...st, hours: e.target.value })}
        />
        <input
          placeholder="Address"
          value={st.address || ''}
          onChange={(e) => setSt({ ...st, address: e.target.value })}
        />
        <h3 style={{ fontSize: '1.1rem', margin: '14px 0 6px', color: 'var(--o)' }}>
          🌐 Hypermedia Contact & Social Media Links
        </h3>
        <p className="sm">
          Shown as interactive icon buttons in the customer menu footer. Enter full links or usernames.
        </p>

        <div className="row">
          <input
            placeholder="Phone Number (e.g. +251911223344)"
            value={st.phone || ''}
            onChange={(e) => setSt({ ...st, phone: e.target.value })}
          />
          <input
            placeholder="WhatsApp (e.g. +251911223344 or wa.me/...)"
            value={st.whatsapp || ''}
            onChange={(e) => setSt({ ...st, whatsapp: e.target.value })}
          />
        </div>

        <div className="row">
          <input
            placeholder="Telegram (e.g. @hiragarestaurant or t.me/...)"
            value={st.telegram || ''}
            onChange={(e) => setSt({ ...st, telegram: e.target.value })}
          />
          <input
            placeholder="TikTok (e.g. @hiragafood or tiktok.com/...)"
            value={st.tiktok || ''}
            onChange={(e) => setSt({ ...st, tiktok: e.target.value })}
          />
        </div>

        <div className="row">
          <input
            placeholder="Instagram (e.g. @hiragarestaurant or instagram.com/...)"
            value={st.instagram || ''}
            onChange={(e) => setSt({ ...st, instagram: e.target.value })}
          />
          <input
            placeholder="Facebook Page (e.g. facebook.com/hiragarestaurant)"
            value={st.facebook || ''}
            onChange={(e) => setSt({ ...st, facebook: e.target.value })}
          />
        </div>

        <div className="row">
          <input
            placeholder="YouTube (e.g. @hiragahotel or youtube.com/...)"
            value={st.youtube || ''}
            onChange={(e) => setSt({ ...st, youtube: e.target.value })}
          />
          <input
            placeholder="X / Twitter (e.g. @hiragarestaurant or x.com/...)"
            value={st.twitter || ''}
            onChange={(e) => setSt({ ...st, twitter: e.target.value })}
          />
        </div>

        <div className="row">
          <input
            placeholder="Google Maps link"
            value={st.map_url || ''}
            onChange={(e) => setSt({ ...st, map_url: e.target.value })}
          />
          <input
            placeholder="Official Website URL (e.g. https://hiragahotel.com)"
            value={st.website || ''}
            onChange={(e) => setSt({ ...st, website: e.target.value })}
          />
        </div>

        <div className="row">
          <input
            placeholder="Email Address (e.g. info@hiragahotel.com)"
            value={st.email || ''}
            onChange={(e) => setSt({ ...st, email: e.target.value })}
          />
        </div>
        <button className="btn">Save Restaurant & Social Info</button>
      </form>

      {/* Supabase Orders SQL Setup */}
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Database & Orders SQL Setup</h2>
        <p className="sm">
          Run this SQL script in your Supabase project (<b>SQL Editor</b> &gt; <b>New Query</b> &gt; <b>Run</b>) to create the <code>orders</code> table and <code>receipts</code> bucket for customer screenshots.
        </p>
        <div style={{ position: 'relative' }}>
          <pre
            style={{
              background: '#090907',
              border: '1px solid var(--bd)',
              borderRadius: 12,
              padding: 12,
              fontSize: '.78rem',
              overflowX: 'auto',
              maxHeight: 200,
            }}
          >
            {ordersSql}
          </pre>
          <button
            className="btn sm o"
            style={{ marginTop: 8 }}
            onClick={copySql}
          >
            {copiedSql ? '✓ Copied SQL to Clipboard!' : '📋 Copy SQL to Clipboard'}
          </button>
        </div>
      </div>

      {/* Backup */}
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Backup</h2>
        <p className="sm">
          Download all categories, dishes and restaurant info as one file. Do this once a week.
        </p>
        <button className="btn x" onClick={backup}>
          Download backup
        </button>
      </div>

      {/* QR Code */}
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>QR code</h2>
        <div className="row">
          <input
            placeholder="Table number (leave empty for one general QR)"
            value={tbl}
            onChange={(e) => setTbl(e.target.value)}
          />
          <button className="btn o" onClick={makeQr}>
            Create QR
          </button>
        </div>
        {qr.img && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <img
              src={qr.img}
              alt="QR code"
              style={{ background: '#fff', borderRadius: 12, width: 240 }}
            />
            <p className="sm">{qr.url}</p>
            <a
              className="btn"
              style={{ display: 'inline-block', textDecoration: 'none' }}
              href={qr.img}
              download={`hiraga-qr${tbl ? '-table-' + tbl : ''}.png`}
            >
              Download PNG
            </a>{' '}
            <button className="btn o" onClick={printCard}>
              Print table card
            </button>
          </div>
        )}
      </div>

      {/* 100% Free Staff Security, Password Change & 2FA Modal */}
      <StaffSecurityModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        session={session}
        lang="en"
      />
    </main>
  );
}
