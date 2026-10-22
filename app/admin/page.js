'use client';
import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { supabase } from '../../lib/supabase';
import { TAGS } from '../../lib/tags';

const EMPTY = { name: '', name_am: '', description: '', description_am: '', price: '', category_id: '', available: true, image_url: '', tags: [], special: false };

const shrink = (file) => new Promise((res) => {
  const im = new Image();
  im.onload = () => {
    const k = Math.min(1, 900 / Math.max(im.width, im.height));
    const c = document.createElement('canvas');
    c.width = im.width * k; c.height = im.height * k;
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

  const say = (text, bad = false) => setMsg({ text, bad });
  const load = useCallback(async () => {
    const [c, i, s] = await Promise.all([
      supabase.from('categories').select('*').order('sort').order('id'),
      supabase.from('items').select('*').order('sort').order('id'),
      supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
    ]);
    setCats(c.data || []); setItems(i.data || []); setSt(s.data || {});
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (session) load(); }, [session, load]);

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
      const up = await supabase.storage.from('menu').upload(path, await shrink(file), { contentType: 'image/jpeg' });
      if (up.error) { setBusy(false); return say('Picture upload failed: ' + up.error.message, true); }
      image_url = supabase.storage.from('menu').getPublicUrl(path).data.publicUrl;
    }
    const row = {
      name: f.name.trim(), name_am: f.name_am.trim() || null,
      description: f.description.trim() || null, description_am: f.description_am.trim() || null,
      price: Number(f.price) || 0, category_id: f.category_id || null, available: f.available, image_url, tags: f.tags || [], special: !!f.special,
    };
    const { error } = editId ? await supabase.from('items').update(row).eq('id', editId) : await supabase.from('items').insert(row);
    setBusy(false);
    if (error) return say(error.message, true);
    setF(EMPTY); setFile(null); setEditId(null); say('Saved.'); load();
  };

  const edit = (i) => { setEditId(i.id); setFile(null); setF({ ...EMPTY, ...i, price: i.price, category_id: i.category_id || '', tags: i.tags || [] }); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const toggle = async (i) => { await supabase.from('items').update({ available: !i.available }).eq('id', i.id); load(); };
  const del = async (i) => { if (confirm(`Delete "${i.name}"?`)) { await supabase.from('items').delete().eq('id', i.id); load(); } };
  const addCat = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('categories').insert({ name: newCat.name.trim(), name_am: newCat.name_am.trim() || null, sort: cats.length });
    if (error) return say(error.message, true);
    setNewCat({ name: '', name_am: '' }); load();
  };
  const delCat = async (c) => { if (confirm(`Delete category "${c.name}"? Its dishes stay in the menu under "Other".`)) { await supabase.from('categories').delete().eq('id', c.id); load(); } };
  const reorder = async (table, list, row, dir, group) => {
    const sib = list.filter((r) => group(r) === group(row));
    const other = sib[sib.indexOf(row) + dir];
    if (!other) return;
    const arr = [...list], a = arr.indexOf(row), b = arr.indexOf(other);
    [arr[a], arr[b]] = [arr[b], arr[a]];
    await Promise.all(arr.map((r, n) => (r.sort === n ? null : supabase.from(table).update({ sort: n }).eq('id', r.id))).filter(Boolean));
    load();
  };
  const saveInfo = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('settings').upsert({ ...st, id: 1 });
    say(error ? error.message : 'Restaurant info saved.', !!error);
  };
  const backup = async () => {
    const [c, i, s] = await Promise.all([supabase.from('categories').select('*'), supabase.from('items').select('*'), supabase.from('settings').select('*')]);
    const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), categories: c.data, items: i.data, settings: s.data }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `hiraga-menu-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  };
  const printCard = () => {
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Hiraga QR card</title><style>body{margin:0;background:#000;color:#fff;font-family:system-ui;text-align:center;padding:30px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.l{width:300px}.q{width:320px;background:#fff;padding:14px;border-radius:18px}h1{margin:14px 0 4px;color:#f59e0b}p{color:#aaa;margin:0 0 14px}</style></head><body><img class="l" src="${location.origin}/logo.png"><h1>Scan for our menu</h1><p>ምናሌውን ለማየት ስካን ያድርጉ</p><img class="q" src="${qr.img}">${tbl ? `<h1>Table ${tbl.replace(/[<>&"]/g, '')}</h1>` : ''}<script>onload=function(){setTimeout(print,400)}<\/script></body></html>`);
    w.document.close();
  };
  const makeQr = async () => {
    const url = location.origin + (tbl ? `?table=${encodeURIComponent(tbl)}` : '');
    setQr({ url, img: await QRCode.toDataURL(url, { width: 700, margin: 2 }) });
  };

  if (session === undefined) return <main className="wrap"><p className="empty">Loading...</p></main>;

  if (!session) return (
    <main className="wrap">
      <div className="top"><img src="/logo.png" alt="Hiraga Restaurant" /></div>
      <form className="panel" onSubmit={login}>
        <h2 style={{ marginTop: 0 }}>Admin sign in</h2>
        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" required placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className="btn">Sign in</button>
        <p className="err">{msg.text}</p>
      </form>
    </main>
  );

  return (
    <main className="wrap">
      <div className="bar"><b>Hiraga admin</b><span><a href="/" style={{ color: 'var(--o)' }}>View menu</a>{' '}<button className="btn x" onClick={() => supabase.auth.signOut()}>Sign out</button></span></div>
      <p className={msg.bad ? 'err' : 'ok'}>{msg.text}</p>

      <form className="panel" onSubmit={save}>
        <h2 style={{ marginTop: 0 }}>{editId ? 'Edit dish' : 'Add a dish'}</h2>
        <div className="row">
          <input required placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input placeholder="Name in Amharic (optional)" value={f.name_am || ''} onChange={(e) => setF({ ...f, name_am: e.target.value })} />
        </div>
        <textarea rows={2} placeholder="Description" value={f.description || ''} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <textarea rows={2} placeholder="Description in Amharic (optional)" value={f.description_am || ''} onChange={(e) => setF({ ...f, description_am: e.target.value })} />
        <div className="row">
          <input required type="number" min="0" step="any" placeholder="Price (ETB)" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
          <select value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })}>
            <option value="">No category</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0] || null)} />
        {f.image_url && !file && <p className="sm">A picture is already attached. Choose a file to replace it.</p>}
        <div className="row">{TAGS.map((t) => (
          <label key={t.k}><input type="checkbox" style={{ width: 'auto' }} checked={(f.tags || []).includes(t.k)} onChange={(e) => setF({ ...f, tags: e.target.checked ? [...(f.tags || []), t.k] : (f.tags || []).filter((x) => x !== t.k) })} /> {t.en}</label>
        ))}</div>
        <label><input type="checkbox" style={{ width: 'auto' }} checked={!!f.special} onChange={(e) => setF({ ...f, special: e.target.checked })} /> Today's special</label><br />
        <label><input type="checkbox" style={{ width: 'auto' }} checked={f.available} onChange={(e) => setF({ ...f, available: e.target.checked })} /> Available today</label>
        <div className="row" style={{ marginTop: 8 }}>
          <button className="btn" disabled={busy}>{busy ? 'Saving...' : 'Save dish'}</button>
          {editId && <button type="button" className="btn x" onClick={() => { setEditId(null); setF(EMPTY); setFile(null); }}>Cancel</button>}
        </div>
      </form>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Categories</h2>
        {cats.map((c) => <div className="al" key={c.id}><div>{c.name}{c.name_am ? ` / ${c.name_am}` : ''}</div><button className="btn x" aria-label="Move up" onClick={() => reorder('categories', cats, c, -1, () => 0)}>↑</button><button className="btn x" aria-label="Move down" onClick={() => reorder('categories', cats, c, 1, () => 0)}>↓</button><button className="btn x" onClick={() => delCat(c)}>Delete</button></div>)}
        <form className="row" onSubmit={addCat}>
          <input required placeholder="New category" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
          <input placeholder="In Amharic (optional)" value={newCat.name_am} onChange={(e) => setNewCat({ ...newCat, name_am: e.target.value })} />
          <button className="btn o">Add category</button>
        </form>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Dishes ({items.length})</h2>
        {!items.length && <p className="empty">No dishes yet. Add the first one above.</p>}
        {items.map((i) => (
          <div className="al" key={i.id} style={{ opacity: i.available ? 1 : 0.55 }}>
            {i.image_url ? <img src={i.image_url} alt="" /> : <div className="ph">🍽️</div>}
            <div><b>{i.name}</b><div className="sm">{Number(i.price).toLocaleString()} ETB</div></div>
            <button className="btn x" aria-label="Move up" onClick={() => reorder('items', items, i, -1, (r) => r.category_id)}>↑</button>
            <button className="btn x" aria-label="Move down" onClick={() => reorder('items', items, i, 1, (r) => r.category_id)}>↓</button>
            <button className="btn x" onClick={() => toggle(i)}>{i.available ? 'Sold out' : 'Available'}</button>
            <button className="btn x" onClick={() => edit(i)}>Edit</button>
            <button className="btn x" onClick={() => del(i)}>Delete</button>
          </div>
        ))}
      </div>

      <form className="panel" onSubmit={saveInfo}>
        <h2 style={{ marginTop: 0 }}>Restaurant info</h2>
        <div className="row">
          <input placeholder="Tagline" value={st.tagline || ''} onChange={(e) => setSt({ ...st, tagline: e.target.value })} />
          <input placeholder="Tagline in Amharic" value={st.tagline_am || ''} onChange={(e) => setSt({ ...st, tagline_am: e.target.value })} />
        </div>
        <textarea rows={3} placeholder={'Opening hours, e.g.\nMon-Sat 7:00-22:00\nSun 8:00-21:00'} value={st.hours || ''} onChange={(e) => setSt({ ...st, hours: e.target.value })} />
        <input placeholder="Address" value={st.address || ''} onChange={(e) => setSt({ ...st, address: e.target.value })} />
        <div className="row">
          <input placeholder="Phone" value={st.phone || ''} onChange={(e) => setSt({ ...st, phone: e.target.value })} />
          <input placeholder="Google Maps link" value={st.map_url || ''} onChange={(e) => setSt({ ...st, map_url: e.target.value })} />
        </div>
        <div className="row">
          <input placeholder="Instagram link" value={st.instagram || ''} onChange={(e) => setSt({ ...st, instagram: e.target.value })} />
          <input placeholder="Facebook link" value={st.facebook || ''} onChange={(e) => setSt({ ...st, facebook: e.target.value })} />
          <input placeholder="Telegram link" value={st.telegram || ''} onChange={(e) => setSt({ ...st, telegram: e.target.value })} />
        </div>
        <button className="btn">Save restaurant info</button>
      </form>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Backup</h2>
        <p className="sm">Download all categories, dishes and restaurant info as one file. Do this once a week.</p>
        <button className="btn x" onClick={backup}>Download backup</button>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>QR code</h2>
        <div className="row">
          <input placeholder="Table number (leave empty for one general QR)" value={tbl} onChange={(e) => setTbl(e.target.value)} />
          <button className="btn o" onClick={makeQr}>Create QR</button>
        </div>
        {qr.img && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <img src={qr.img} alt="QR code" style={{ background: '#fff', borderRadius: 12, width: 240 }} />
            <p className="sm">{qr.url}</p>
            <a className="btn" style={{ display: 'inline-block', textDecoration: 'none' }} href={qr.img} download={`hiraga-qr${tbl ? '-table-' + tbl : ''}.png`}>Download PNG</a>{' '}
            <button className="btn o" onClick={printCard}>Print table card</button>
          </div>
        )}
      </div>
    </main>
  );
}
