'use client';
import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '../../lib/supabase';
import { TAGS } from '../../lib/tags';

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

  const say = (text, bad = false) => setMsg({ text, bad });

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
    if (session) load();
  }, [session, load]);

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
      `<html><head><title>Hiraga QR card</title><style>body{margin:0;background:#000;color:#fff;font-family:system-ui;text-align:center;padding:30px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.l{width:300px}.q{width:320px;background:#fff;padding:14px;border-radius:18px}h1{margin:14px 0 4px;color:#f59e0b}p{color:#aaa;margin:0 0 14px}</style></head><body><img class="l" src="${location.origin}/logo.png"><h1>Scan for our menu</h1><p>ምናሌውን ለማየት ስካን ያድርጉ</p><img class="q" src="${qr.img}">${tbl ? `<h1>Table ${tbl.replace(/[<>&"]/g, '')}</h1>` : ''}<script>onload=function(){setTimeout(print,400)}<\/script></body></html>`
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
create policy "public update receipts" on storage.objects for update using (bucket_id = 'receipts');`;

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
      <main className="wrap">
        <div className="top">
          <img src="/logo.png" alt="Hiraga Restaurant" />
        </div>
        <form className="panel" onSubmit={login}>
          <h2 style={{ marginTop: 0 }}>Admin sign in</h2>
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          <button className="btn">Sign in</button>
          <p className="err">{msg.text}</p>
        </form>
      </main>
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

        <h3 style={{ fontSize: '1.1rem', color: 'var(--g)', margin: '14px 0 6px' }}>
          🔒 Staff Authentication (Cashier & Head Chef)
        </h3>
        <p className="sm">
          The Cashier Desk (<code>/cashier</code>) and Kitchen Display (<code>/kitchen</code>) are protected and require staff email &amp; password sign-in. To add staff accounts, go to your Supabase Dashboard &gt; <b>Authentication</b> &gt; <b>Users</b> &gt; <b>Add user</b>.
        </p>
        <div style={{ display: 'flex', gap: 10, margin: '8px 0 14px' }}>
          <a href="/cashier" className="btn sm o">Open Cashier Station</a>
          <a href="/kitchen" className="btn sm" style={{ background: 'var(--b)', color: '#fff' }}>Open Kitchen KDS</a>
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
    </main>
  );
}
