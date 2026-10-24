'use client';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { TAGS } from '../lib/tags';

const TEXT = {
  en: { search: 'Search the menu', all: 'All', sold: 'Sold out', loading: 'Loading menu...', empty: 'No dishes match your search.', fail: 'The menu could not load. Please ask the staff.', table: 'Table', close: 'Close', cur: 'ETB', special: "Today's special", hours: 'Opening hours', find: 'Find us', tagline: 'Fresh food, made with care' },
  am: { search: 'ምናሌውን ይፈልጉ', all: 'ሁሉም', sold: 'አልቋል', loading: 'ምናሌው በመጫን ላይ ነው...', empty: 'ምንም ምግብ አልተገኘም።', fail: 'ምናሌው አልተከፈተም። እባክዎ ሰራተኞችን ይጠይቁ።', table: 'ጠረጴዛ', close: 'ዝጋ', cur: 'ብር', special: 'የዛሬ ልዩ', hours: 'የስራ ሰዓት', find: 'አድራሻ', tagline: 'በጥንቃቄ የተዘጋጀ ትኩስ ምግብ' },
};

export default function Menu() {
  const [cats, setCats] = useState([]);
  const [items, setItems] = useState([]);
  const [st, setSt] = useState({});
  const [cat, setCat] = useState(0);
  const [q, setQ] = useState('');
  const [lang, setLang] = useState('en');
  const [theme, setTheme] = useState('dark');
  const [table, setTable] = useState('');
  const [state, setState] = useState('loading');
  const [open, setOpen] = useState(null);
  const L = TEXT[lang];

  useEffect(() => {
    setTable(new URLSearchParams(location.search).get('table') || '');
    setLang(localStorage.getItem('lang') || 'en');
    const th = localStorage.getItem('theme') || 'dark';
    setTheme(th); document.documentElement.dataset.theme = th;
    (async () => {
      try {
        const [c, i, s] = await Promise.all([
          supabase.from('categories').select('*').order('sort').order('id'),
          supabase.from('items').select('*').order('sort').order('id'),
          supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
        ]);
        if (c.error || i.error) return setState('error');
        setCats(c.data || []); setItems(i.data || []); setSt(s.data || {}); setState('ok');
      } catch {
        setState('error');
      }
    })();
  }, []);

  const pick = (l) => { setLang(l); localStorage.setItem('lang', l); };
  const flip = () => { const n = theme === 'dark' ? 'light' : 'dark'; setTheme(n); localStorage.setItem('theme', n); document.documentElement.dataset.theme = n; };
  const t = (o, k) => (lang === 'am' && o[k + '_am']) || o[k] || '';
  const shown = items.filter((i) => (!cat || i.category_id === cat) && (!q || (i.name + ' ' + (i.name_am || '') + ' ' + (i.description || '')).toLowerCase().includes(q.toLowerCase())));
  const groups = cats.map((c) => ({ c, list: shown.filter((i) => i.category_id === c.id) })).filter((g) => g.list.length);
  const loose = shown.filter((i) => !cats.some((c) => c.id === i.category_id));
  if (loose.length) groups.push({ c: { id: 0, name: 'Other', name_am: 'ሌሎች' }, list: loose });
  const specials = !q && !cat ? items.filter((i) => i.special && i.available) : [];

  const Chips = ({ i }) => (i.tags && i.tags.length ? (
    <div className="chips">{TAGS.filter((x) => i.tags.includes(x.k)).map((x) => <span key={x.k} className={'chip' + (x.k === 'spicy' || x.k === 'chef' ? ' hot' : '')}>{x[lang]}</span>)}</div>
  ) : null);

  const Card = ({ i, hl }) => (
    <button className={'it' + (i.available ? '' : ' off') + (hl ? ' spec' : '')} onClick={() => setOpen(i)}>
      {i.image_url ? <img src={i.image_url} alt="" loading="lazy" /> : <div className="ph">🍽️</div>}
      <div>
        <h3>{t(i, 'name')}</h3>
        <Chips i={i} />
        <p>{t(i, 'description')}</p>
        <span className="pr">{Number(i.price).toLocaleString()} {L.cur}</span>
        {!i.available && <span className="sold">{L.sold}</span>}
      </div>
    </button>
  );

  const hasInfo = ['phone', 'address', 'hours', 'map_url', 'instagram', 'facebook', 'telegram'].some((k) => st[k]);

  return (
    <main className="wrap">
      <div className="top"><img src="/logo.png" alt="Hiraga Restaurant" /></div>
      <p className="tagline">{t(st, 'tagline') || L.tagline}</p>
      <div className="bar">
        <span className="tag">{table ? `${L.table} ${table}` : ''}</span>
        <span className="lang">
          <button className="icon" onClick={flip} aria-label="Dark or light mode">{theme === 'dark' ? '☀️' : '🌙'}</button>{' '}
          <button className={lang === 'en' ? 'on' : ''} onClick={() => pick('en')}>EN</button>{' '}
          <button className={lang === 'am' ? 'on' : ''} onClick={() => pick('am')}>አማ</button>
        </span>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.search} aria-label={L.search} />
      <div className="tabs">
        <button className={'tab' + (!cat ? ' on' : '')} onClick={() => setCat(0)}>{L.all}</button>
        {cats.map((c) => <button key={c.id} className={'tab' + (cat === c.id ? ' on' : '')} onClick={() => setCat(c.id)}>{t(c, 'name')}</button>)}
      </div>
      {state === 'loading' && <div className="empty">{L.loading}</div>}
      {state === 'error' && <div className="empty">{L.fail}</div>}
      {state === 'ok' && !groups.length && <div className="empty">{L.empty}</div>}
      {specials.length > 0 && <section><h2>{L.special}</h2>{specials.map((i) => <Card key={'s' + i.id} i={i} hl />)}</section>}
      {groups.map(({ c, list }) => (
        <section key={c.id}><h2>{t(c, 'name')}</h2>{list.map((i) => <Card key={i.id} i={i} />)}</section>
      ))}
      {hasInfo && (
        <footer className="info">
          {st.hours && <><b>{L.hours}</b>{'\n'}{st.hours}{'\n\n'}</>}
          {st.address && <><b>{L.find}</b>{'\n'}{st.address}{'\n\n'}</>}
          {st.phone && <a href={'tel:' + st.phone.replace(/[^+\d]/g, '')}>{st.phone}</a>}
          {st.map_url && <a href={st.map_url} target="_blank" rel="noreferrer">Map</a>}
          {st.instagram && <a href={st.instagram} target="_blank" rel="noreferrer">Instagram</a>}
          {st.facebook && <a href={st.facebook} target="_blank" rel="noreferrer">Facebook</a>}
          {st.telegram && <a href={st.telegram} target="_blank" rel="noreferrer">Telegram</a>}
        </footer>
      )}
      {open && (
        <div className="mod" onClick={() => setOpen(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            {open.image_url && <img src={open.image_url} alt={t(open, 'name')} />}
            <div className="in">
              <h3>{t(open, 'name')}</h3>
              <Chips i={open} />
              <p>{t(open, 'description')}</p>
              <p className="pr">{Number(open.price).toLocaleString()} {L.cur}</p>
              <button className="btn x" onClick={() => setOpen(null)}>{L.close}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
