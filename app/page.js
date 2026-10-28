'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { TAGS } from '../lib/tags';
import {
  createOrder,
  subscribeToOrders,
  fetchOrderById,
  uploadReceiptScreenshot,
  ORDER_STATUSES,
} from '../lib/orders';
import { playChime } from '../lib/audio';
import SocialMediaBar from '../components/SocialMedia';

const TEXT = {
  en: {
    search: 'Search the menu',
    all: 'All',
    sold: 'Sold out',
    loading: 'Loading menu...',
    empty: 'No dishes match your search.',
    fail: 'The menu could not load. Please ask the staff.',
    table: 'Table',
    close: 'Close',
    cur: 'ETB',
    special: "Today's special",
    hours: 'Opening hours',
    find: 'Find us',
    tagline: 'Fresh food, made with care',
    addToOrder: 'Add to Order',
    viewCart: 'View Order',
    cartTitle: 'Your Order',
    cartEmpty: 'Your order is currently empty.',
    tableNumber: 'Table Number (or Takeaway)',
    custName: 'Your Name (optional)',
    custPhone: 'Phone Number (optional)',
    orderNotes: 'Special kitchen requests (e.g. no pepper)',
    payMethod: 'Payment Method',
    payCash: 'Cash at Counter',
    payDigital: 'Telebirr / CBE / Bank Transfer',
    transferTo: 'Transfer payment to:',
    cbeAcc: 'CBE Account',
    telebirrAcc: 'Telebirr',
    copied: 'Copied!',
    copy: 'Copy',
    txnRef: 'Transaction Reference or Link',
    txnPlaceholder: 'e.g. CBE transaction code, Telebirr txn ID or link',
    screenshotProof: 'Attach Payment Screenshot / Receipt',
    screenshotChange: 'Change screenshot',
    submitOrder: 'Confirm & Place Order',
    submitting: 'Submitting Order...',
    myOrder: 'My Order',
    activeOrder: 'Active Order',
    orderSuccess: 'Order placed successfully!',
    orderNum: 'Order #',
    status: 'Status',
    total: 'Total',
    qty: 'Qty',
    backToMenu: 'Back to Menu',
    callStaff: 'Need help? Ask our staff',
    rejection: 'Cashier note:',
    itemNotes: 'Item request (e.g. extra sauce)',
  },
  am: {
    search: 'ምናሌውን ይፈልጉ',
    all: 'ሁሉም',
    sold: 'አልቋል',
    loading: 'ምናሌው በመጫን ላይ ነው...',
    empty: 'ምንም ምግብ አልተገኘም።',
    fail: 'ምናሌው አልተከፈተም። እባክዎ ሰራተኞችን ይጠይቁ።',
    table: 'ጠረጴዛ',
    close: 'ዝጋ',
    cur: 'ብር',
    special: 'የዛሬ ልዩ',
    hours: 'የስራ ሰዓት',
    find: 'አድራሻ',
    tagline: 'በጥንቃቄ የተዘጋጀ ትኩስ ምግብ',
    addToOrder: 'ወደ ትዕዛዝ ጨምር',
    viewCart: 'ትዕዛዝህን ተመልከት',
    cartTitle: 'የእርስዎ ትዕዛዝ',
    cartEmpty: 'ምንም ምግብ አልተመረጠም።',
    tableNumber: 'የጠረጴዛ ቁጥር (ወይም የሚወሰድ)',
    custName: 'ስምዎ (አማራጭ)',
    custPhone: 'ስልክ ቁጥር (አማራጭ)',
    orderNotes: 'ለኩሽናው ልዩ ማስታወሻ',
    payMethod: 'የክፍያ ዘዴ',
    payCash: 'በጥሬ ገንዘብ (ካሸር ጋር)',
    payDigital: 'በቴሌብር / ንግድ ባንክ (CBE)',
    transferTo: 'ወደዚህ ሂሳብ ያስተላልፉ:',
    cbeAcc: 'የንግድ ባንክ (CBE)',
    telebirrAcc: 'ቴሌብር',
    copied: 'ተገልብጧል!',
    copy: 'ቅዳ',
    txnRef: 'የግብይት ኮድ (Transaction Code) ወይም ሊንክ',
    txnPlaceholder: 'ለምሳሌ፡ የቴሌብር ኮድ ወይም የንግድ ባንክ ደረሰኝ ቁጥር',
    screenshotProof: 'የክፍያ ደረሰኝ ስክሪንሾት (ፎቶ) ይጫኑ',
    screenshotChange: 'ፎቶውን ቀይር',
    submitOrder: 'ትዕዛዙን አረጋግጥና ላክ',
    submitting: 'ትዕዛዝ በመላክ ላይ...',
    myOrder: 'የእኔ ትዕዛዝ',
    activeOrder: 'ወቅታዊ ትዕዛዝ',
    orderSuccess: 'ትዕዛዝዎ በተሳካ ሁኔታ ተልኳል!',
    orderNum: 'የትዕዛዝ ቁጥር',
    status: 'ሁኔታ',
    total: 'አጠቃላይ ድምር',
    qty: 'ብዛት',
    backToMenu: 'ወደ ምናሌ ተመለስ',
    callStaff: 'እርዳታ ይፈልጋሉ? አስተናጋጁን ይጠይቁ',
    rejection: 'ከካሸሩ የተሰጠ ማስታወሻ:',
    itemNotes: 'ለዚህ ምግብ ልዩ ምርጫ',
  },
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

  // Customer item selection modal
  const [open, setOpen] = useState(null);
  const [modalQty, setModalQty] = useState(1);
  const [modalNotes, setModalNotes] = useState('');

  // Cart state
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Checkout inputs
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [payMethod, setPayMethod] = useState('cash'); // 'cash' | 'digital'
  const [txnRef, setTxnRef] = useState('');
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState('');

  // Active Order Tracking
  const [activeOrder, setActiveOrder] = useState(null);
  const [showOrderTracker, setShowOrderTracker] = useState(false);

  const L = TEXT[lang];

  // Initialize
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tableParam = searchParams.get('table');
    if (tableParam) setTable(tableParam);

    setLang(localStorage.getItem('lang') || 'en');
    const th = localStorage.getItem('theme') || 'dark';
    setTheme(th);
    document.documentElement.dataset.theme = th;

    // Check if there is an active order stored locally
    const lastOrderId = localStorage.getItem('hiraga_active_order_id');
    if (lastOrderId) {
      fetchOrderById(lastOrderId).then((ord) => {
        if (ord && ord.status !== 'completed' && ord.status !== 'cancelled') {
          setActiveOrder(ord);
        }
      });
    }

    // Load menu data
    (async () => {
      try {
        const [c, i, s] = await Promise.all([
          supabase.from('categories').select('*').order('sort').order('id'),
          supabase.from('items').select('*').order('sort').order('id'),
          supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
        ]);
        if (c.error || i.error) return setState('error');
        setCats(c.data || []);
        setItems(i.data || []);
        setSt(s.data || {});
        setState('ok');
      } catch {
        setState('error');
      }
    })();
  }, []);

  // Subscribe to real-time order updates
  useEffect(() => {
    const unsubscribe = subscribeToOrders(({ order, orders }) => {
      if (activeOrder) {
        if (order && String(order.id) === String(activeOrder.id)) {
          if (order.status !== activeOrder.status) {
            playChime(order.status === 'ready' ? 'ready' : 'confirmed');
          }
          setActiveOrder(order);
        } else if (orders) {
          const matched = orders.find((o) => String(o.id) === String(activeOrder.id));
          if (matched) {
            if (matched.status !== activeOrder.status) {
              playChime(matched.status === 'ready' ? 'ready' : 'confirmed');
            }
            setActiveOrder(matched);
          }
        }
      }
    });
    return () => unsubscribe();
  }, [activeOrder]);

  const pick = (l) => {
    setLang(l);
    localStorage.setItem('lang', l);
  };

  const flip = () => {
    const n = theme === 'dark' ? 'light' : 'dark';
    setTheme(n);
    localStorage.setItem('theme', n);
    document.documentElement.dataset.theme = n;
  };

  const t = (o, k) => (lang === 'am' && o[k + '_am']) || o[k] || '';

  const shown = items.filter(
    (i) =>
      (!cat || i.category_id === cat) &&
      (!q ||
        (i.name + ' ' + (i.name_am || '') + ' ' + (i.description || ''))
          .toLowerCase()
          .includes(q.toLowerCase()))
  );

  const groups = cats
    .map((c) => ({ c, list: shown.filter((i) => i.category_id === c.id) }))
    .filter((g) => g.list.length);
  const loose = shown.filter((i) => !cats.some((c) => c.id === i.category_id));
  if (loose.length) groups.push({ c: { id: 0, name: 'Other', name_am: 'ሌሎች' }, list: loose });
  const specials = !q && !cat ? items.filter((i) => i.special && i.available) : [];

  const Chips = ({ i }) =>
    i.tags && i.tags.length ? (
      <div className="chips">
        {TAGS.filter((x) => i.tags.includes(x.k)).map((x) => (
          <span
            key={x.k}
            className={'chip' + (x.k === 'spicy' || x.k === 'chef' ? ' hot' : '')}
          >
            {x[lang]}
          </span>
        ))}
      </div>
    ) : null;

  const openDishModal = (i) => {
    setOpen(i);
    setModalQty(1);
    setModalNotes('');
  };

  const addToCartFromModal = () => {
    if (!open) return;
    const existingIndex = cart.findIndex(
      (c) => c.id === open.id && c.notes === modalNotes.trim()
    );

    if (existingIndex > -1) {
      const copy = [...cart];
      copy[existingIndex].qty += modalQty;
      setCart(copy);
    } else {
      setCart([
        ...cart,
        {
          id: open.id,
          name: open.name,
          name_am: open.name_am,
          price: Number(open.price),
          qty: modalQty,
          notes: modalNotes.trim(),
          image_url: open.image_url,
        },
      ]);
    }
    setOpen(null);
  };

  const updateCartQty = (index, delta) => {
    const copy = [...cart];
    const newQty = copy[index].qty + delta;
    if (newQty <= 0) {
      copy.splice(index, 1);
    } else {
      copy[index].qty = newQty;
    }
    setCart(copy);
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const handleScreenshotChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setScreenshotFile(file);
      setScreenshotPreview(URL.createObjectURL(file));
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard?.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(''), 2500);
  };

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (!cart.length) return;

    if (payMethod === 'digital' && !txnRef && !screenshotFile) {
      alert(
        lang === 'am'
          ? 'እባክዎ የክፍያ ማረጋገጫ (የግብይት ኮድ ወይም ስክሪንሾት) ያስገቡ'
          : 'Please enter transaction reference or upload a payment screenshot.'
      );
      return;
    }

    setIsSubmitting(true);
    let screenshot_url = null;

    if (screenshotFile) {
      try {
        screenshot_url = await uploadReceiptScreenshot(screenshotFile);
      } catch (err) {
        console.warn('Screenshot upload error:', err);
      }
    }

    const orderPayload = {
      table_number: table.trim() || 'General / Bar',
      customer_name: custName.trim() || null,
      customer_phone: custPhone.trim() || null,
      items: cart,
      total: cartTotal,
      payment_method: payMethod,
      payment_status: payMethod === 'cash' ? 'pending' : 'submitted',
      transaction_ref: txnRef.trim() || null,
      screenshot_url,
      status: 'pending_payment',
      notes: orderNotes.trim() || null,
    };

    const res = await createOrder(orderPayload);
    setIsSubmitting(false);

    if (res.ok && res.order) {
      playChime('confirmed');
      setActiveOrder(res.order);
      localStorage.setItem('hiraga_active_order_id', res.order.id);
      setCart([]);
      setIsCartOpen(false);
      setShowOrderTracker(true);
    } else {
      alert(lang === 'am' ? 'ትዕዛዝ መላክ አልተቻለም' : 'Failed to place order. Please try again.');
    }
  };

  const Card = ({ i, hl }) => (
    <div
      className={'it' + (i.available ? '' : ' off') + (hl ? ' spec' : '')}
      onClick={() => i.available && openDishModal(i)}
    >
      {i.image_url ? (
        <img src={i.image_url} alt="" loading="lazy" />
      ) : (
        <div className="ph">🍽️</div>
      )}
      <div style={{ flex: 1 }}>
        <h3>{t(i, 'name')}</h3>
        <Chips i={i} />
        <p>{t(i, 'description')}</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <span className="pr">
            {Number(i.price).toLocaleString()} {L.cur}
          </span>
          {i.available ? (
            <button
              className="btn sm o"
              onClick={(e) => {
                e.stopPropagation();
                openDishModal(i);
              }}
            >
              + {lang === 'am' ? 'ምረጥ' : 'Order'}
            </button>
          ) : (
            <span className="sold">{L.sold}</span>
          )}
        </div>
      </div>
    </div>
  );

  const hasInfo = [
    'phone',
    'address',
    'hours',
    'map_url',
    'instagram',
    'facebook',
    'telegram',
    'whatsapp',
    'tiktok',
    'youtube',
    'twitter',
    'email',
    'website',
  ].some((k) => st[k]);

  return (
    <main className="wrap">
      {/* Header */}
      <div className="top">
        <img src="/logo.png" alt="Hiraga Restaurant" />
      </div>
      <p className="tagline">{t(st, 'tagline') || L.tagline}</p>

      {/* Bar: Table tag, Active order pill, and Lang switch */}
      <div className="bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {table ? (
            <span className="tag">
              {L.table} {table}
            </span>
          ) : null}
          {activeOrder && (
            <button
              className="btn sm b"
              style={{ fontSize: '.78rem', padding: '3px 9px' }}
              onClick={() => setShowOrderTracker(true)}
            >
              🔔 {L.myOrder} ({activeOrder.order_number})
            </button>
          )}
        </div>

        <span className="lang">
          <button className="icon" onClick={flip} aria-label="Dark or light mode">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>{' '}
          <button className={lang === 'en' ? 'on' : ''} onClick={() => pick('en')}>
            EN
          </button>{' '}
          <button className={lang === 'am' ? 'on' : ''} onClick={() => pick('am')}>
            አማ
          </button>
        </span>
      </div>

      {/* Search and Category Tabs */}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={L.search}
        aria-label={L.search}
      />
      <div className="tabs">
        <button className={'tab' + (!cat ? ' on' : '')} onClick={() => setCat(0)}>
          {L.all}
        </button>
        {cats.map((c) => (
          <button
            key={c.id}
            className={'tab' + (cat === c.id ? ' on' : '')}
            onClick={() => setCat(c.id)}
          >
            {t(c, 'name')}
          </button>
        ))}
      </div>

      {/* Menu Status / Dishes List */}
      {state === 'loading' && <div className="empty">{L.loading}</div>}
      {state === 'error' && <div className="empty">{L.fail}</div>}
      {state === 'ok' && !groups.length && <div className="empty">{L.empty}</div>}

      {specials.length > 0 && (
        <section>
          <h2>{L.special}</h2>
          {specials.map((i) => (
            <Card key={'s' + i.id} i={i} hl />
          ))}
        </section>
      )}

      {groups.map(({ c, list }) => (
        <section key={c.id}>
          <h2>{t(c, 'name')}</h2>
          {list.map((i) => (
            <Card key={i.id} i={i} />
          ))}
        </section>
      ))}

      {/* Footer Info & Hypermedia Social Links */}
      {hasInfo && (
        <footer className="info" style={{ textAlign: 'center' }}>
          {st.hours && (
            <div style={{ marginBottom: 12 }}>
              <b style={{ color: 'var(--tx)', display: 'block', fontSize: '.95rem' }}>{L.hours}</b>
              <div style={{ whiteSpace: 'pre-line', fontSize: '.9rem', color: 'var(--mu)' }}>{st.hours}</div>
            </div>
          )}
          {st.address && (
            <div style={{ marginBottom: 14 }}>
              <b style={{ color: 'var(--tx)', display: 'block', fontSize: '.95rem' }}>{L.find}</b>
              <div style={{ fontSize: '.9rem', color: 'var(--mu)' }}>{st.address}</div>
            </div>
          )}

          {/* Hypermedia Social and Contact Icon Buttons */}
          <SocialMediaBar settings={st} lang={lang} />
        </footer>
      )}

      {/* Dish Customization & Add-to-Cart Modal */}
      {open && (
        <div className="mod" onClick={() => setOpen(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            {open.image_url && <img src={open.image_url} alt={t(open, 'name')} />}
            <div className="in">
              <h3>{t(open, 'name')}</h3>
              <Chips i={open} />
              <p>{t(open, 'description')}</p>
              <p className="pr">
                {Number(open.price).toLocaleString()} {L.cur}
              </p>

              <div style={{ margin: '14px 0' }}>
                <label style={{ display: 'block', fontSize: '.9rem', marginBottom: 4 }}>
                  {L.itemNotes}:
                </label>
                <input
                  type="text"
                  placeholder={lang === 'am' ? 'ምሳሌ፡ በርበሬ አይብዛበት' : 'e.g. Extra spicy, no onions'}
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  margin: '18px 0 10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    className="btn x"
                    style={{ width: 40, height: 40, padding: 0 }}
                    onClick={() => setModalQty(Math.max(1, modalQty - 1))}
                  >
                    -
                  </button>
                  <b style={{ fontSize: '1.2rem', minWidth: 26, textAlign: 'center' }}>
                    {modalQty}
                  </b>
                  <button
                    type="button"
                    className="btn x"
                    style={{ width: 40, height: 40, padding: 0 }}
                    onClick={() => setModalQty(modalQty + 1)}
                  >
                    +
                  </button>
                </div>

                <button className="btn" style={{ flex: 1 }} onClick={addToCartFromModal}>
                  {L.addToOrder} • {(Number(open.price) * modalQty).toLocaleString()} {L.cur}
                </button>
              </div>

              <button className="btn x" style={{ width: '100%', marginTop: 8 }} onClick={() => setOpen(null)}>
                {L.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Cart Bar */}
      {cart.length > 0 && !isCartOpen && (
        <div className="cart-bar" onClick={() => setIsCartOpen(true)}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className="cart-badge">{cartItemCount}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                {cartTotal.toLocaleString()} {L.cur}
              </div>
              <div style={{ fontSize: '.78rem', color: 'var(--mu)' }}>
                {table ? `${L.table} ${table}` : 'Hiraga Order'}
              </div>
            </div>
          </div>
          <button className="btn o" style={{ margin: 0, padding: '8px 18px' }}>
            {L.viewCart} ➔
          </button>
        </div>
      )}

      {/* Cart & Checkout Sheet */}
      {isCartOpen && (
        <div className="mod" onClick={() => setIsCartOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '94%' }}>
            <div className="in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>{L.cartTitle}</h3>
                <button className="btn x sm" onClick={() => setIsCartOpen(false)}>
                  ✕
                </button>
              </div>

              {/* Items List */}
              <div style={{ margin: '14px 0', borderTop: '1px solid var(--bd)' }}>
                {cart.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 0',
                      borderBottom: '1px solid var(--bd)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                      <div style={{ fontWeight: 600 }}>{t(item, 'name')}</div>
                      {item.notes && (
                        <div style={{ fontSize: '.8rem', color: 'var(--o)' }}>
                          📝 {item.notes}
                        </div>
                      )}
                      <div className="sm">
                        {Number(item.price).toLocaleString()} {L.cur} × {item.qty} ={' '}
                        <b>{(item.price * item.qty).toLocaleString()} {L.cur}</b>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        className="btn x sm"
                        style={{ width: 30, height: 30, padding: 0 }}
                        onClick={() => updateCartQty(idx, -1)}
                      >
                        -
                      </button>
                      <span style={{ fontWeight: 700, minWidth: 20, textAlign: 'center' }}>
                        {item.qty}
                      </span>
                      <button
                        className="btn x sm"
                        style={{ width: 30, height: 30, padding: 0 }}
                        onClick={() => updateCartQty(idx, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  margin: '12px 0 16px',
                }}
              >
                <span>{L.total}:</span>
                <span style={{ color: 'var(--o)' }}>
                  {cartTotal.toLocaleString()} {L.cur}
                </span>
              </div>

              <form onSubmit={handleSubmitOrder}>
                {/* Table Number */}
                <label style={{ fontSize: '.88rem', fontWeight: 600 }}>{L.tableNumber}</label>
                <input
                  required
                  placeholder={lang === 'am' ? 'ምሳሌ፡ ጠረጴዛ 5' : 'e.g. Table 4, Takeaway'}
                  value={table}
                  onChange={(e) => setTable(e.target.value)}
                />

                {/* Customer Details */}
                <div className="row">
                  <div>
                    <label style={{ fontSize: '.88rem' }}>{L.custName}</label>
                    <input
                      placeholder="Name"
                      value={custName}
                      onChange={(e) => setCustName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '.88rem' }}>{L.custPhone}</label>
                    <input
                      placeholder="09..."
                      value={custPhone}
                      onChange={(e) => setCustPhone(e.target.value)}
                    />
                  </div>
                </div>

                {/* General Order Notes */}
                <label style={{ fontSize: '.88rem' }}>{L.orderNotes}</label>
                <textarea
                  rows={2}
                  placeholder={lang === 'am' ? 'ማንኛውም ተጨማሪ ጥያቄ...' : 'Any special preparation notes...'}
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                />

                {/* Payment Method Selector */}
                <label style={{ fontSize: '.9rem', fontWeight: 700, marginTop: 12, display: 'block' }}>
                  {L.payMethod}
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '8px 0 12px' }}>
                  <button
                    type="button"
                    className={`btn ${payMethod === 'cash' ? '' : 'x'}`}
                    style={{ padding: '10px 8px', fontSize: '.9rem' }}
                    onClick={() => setPayMethod('cash')}
                  >
                    💵 {L.payCash}
                  </button>
                  <button
                    type="button"
                    className={`btn ${payMethod === 'digital' ? 'o' : 'x'}`}
                    style={{ padding: '10px 8px', fontSize: '.9rem' }}
                    onClick={() => setPayMethod('digital')}
                  >
                    📱 {L.payDigital}
                  </button>
                </div>

                {/* Digital Payment Details & Verification */}
                {payMethod === 'digital' && (
                  <div
                    style={{
                      background: 'var(--card-subtle)',
                      border: '1px solid var(--bd)',
                      borderRadius: 14,
                      padding: 12,
                      margin: '10px 0 16px',
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--o)' }}>
                      {L.transferTo}
                    </div>

                    {/* Telebirr Info */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 0',
                        borderBottom: '1px solid var(--bd)',
                        fontSize: '.9rem',
                      }}
                    >
                      <div>
                        <b>{L.telebirrAcc}:</b> {st.telebirr_number || '0911223344'}
                        {st.telebirr_name && <span className="sm"> ({st.telebirr_name})</span>}
                      </div>
                      <button
                        type="button"
                        className="btn sm x"
                        onClick={() =>
                          copyToClipboard(st.telebirr_number || '0911223344', 'telebirr')
                        }
                      >
                        {copyFeedback === 'telebirr' ? L.copied : L.copy}
                      </button>
                    </div>

                    {/* CBE Info */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '6px 0',
                        fontSize: '.9rem',
                      }}
                    >
                      <div>
                        <b>{L.cbeAcc}:</b> {st.cbe_number || '1000123456789'}
                        {st.cbe_name && <span className="sm"> ({st.cbe_name})</span>}
                      </div>
                      <button
                        type="button"
                        className="btn sm x"
                        onClick={() =>
                          copyToClipboard(st.cbe_number || '1000123456789', 'cbe')
                        }
                      >
                        {copyFeedback === 'cbe' ? L.copied : L.copy}
                      </button>
                    </div>

                    {/* Transaction Reference / Link */}
                    <div style={{ marginTop: 12 }}>
                      <label style={{ fontSize: '.84rem', fontWeight: 600 }}>
                        {L.txnRef}:
                      </label>
                      <input
                        placeholder={L.txnPlaceholder}
                        value={txnRef}
                        onChange={(e) => setTxnRef(e.target.value)}
                      />
                    </div>

                    {/* Screenshot Upload */}
                    <div style={{ marginTop: 8 }}>
                      <label style={{ fontSize: '.84rem', fontWeight: 600 }}>
                        📷 {L.screenshotProof}:
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleScreenshotChange}
                        style={{ marginTop: 4 }}
                      />
                      {screenshotPreview && (
                        <div style={{ textAlign: 'center', marginTop: 8 }}>
                          <img
                            src={screenshotPreview}
                            alt="Receipt Preview"
                            style={{
                              maxHeight: 160,
                              borderRadius: 10,
                              border: '1px solid var(--bd)',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  className="btn"
                  style={{ width: '100%', marginTop: 12, padding: '13px' }}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? L.submitting : `${L.submitOrder} • ${cartTotal.toLocaleString()} ${L.cur}`}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Live Order Status Tracker Modal */}
      {showOrderTracker && activeOrder && (
        <div className="mod" onClick={() => setShowOrderTracker(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0 }}>
                    {L.orderNum} {activeOrder.order_number}
                  </h3>
                  <span className="sm">
                    {L.table}: <b>{activeOrder.table_number}</b> •{' '}
                    {new Date(activeOrder.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <button className="btn x sm" onClick={() => setShowOrderTracker(false)}>
                  ✕
                </button>
              </div>

              {/* Status Badge */}
              <div style={{ margin: '16px 0 12px' }}>
                <span
                  className={`badge ${
                    activeOrder.status === 'pending_payment'
                      ? 'orange'
                      : activeOrder.status === 'confirmed'
                      ? 'blue'
                      : activeOrder.status === 'preparing'
                      ? 'purple'
                      : activeOrder.status === 'ready'
                      ? 'green'
                      : activeOrder.status === 'cancelled'
                      ? 'red'
                      : 'gray'
                  }`}
                  style={{ fontSize: '.9rem', padding: '6px 14px' }}
                >
                  ● {ORDER_STATUSES[activeOrder.status]?.[lang] || activeOrder.status}
                </span>
              </div>

              {/* Visual Step Progress */}
              {activeOrder.status !== 'cancelled' && (
                <div className="steps">
                  <div
                    className={`step-item ${
                      activeOrder.status ? 'done' : ''
                    } ${activeOrder.status === 'pending_payment' ? 'active' : ''}`}
                  >
                    <div className="step-dot">1</div>
                    <div className="step-label">
                      {lang === 'am' ? 'ተልኳል' : 'Submitted'}
                    </div>
                  </div>
                  <div
                    className={`step-item ${
                      ['confirmed', 'preparing', 'ready', 'completed'].includes(
                        activeOrder.status
                      )
                        ? 'done'
                        : ''
                    } ${activeOrder.status === 'confirmed' ? 'active' : ''}`}
                  >
                    <div className="step-dot">2</div>
                    <div className="step-label">
                      {lang === 'am' ? 'የተረጋገጠ' : 'Confirmed'}
                    </div>
                  </div>
                  <div
                    className={`step-item ${
                      ['preparing', 'ready', 'completed'].includes(activeOrder.status)
                        ? 'done'
                        : ''
                    } ${activeOrder.status === 'preparing' ? 'active' : ''}`}
                  >
                    <div className="step-dot">3</div>
                    <div className="step-label">
                      {lang === 'am' ? 'ኩሽና' : 'Cooking'}
                    </div>
                  </div>
                  <div
                    className={`step-item ${
                      ['ready', 'completed'].includes(activeOrder.status) ? 'done' : ''
                    } ${activeOrder.status === 'ready' ? 'active' : ''}`}
                  >
                    <div className="step-dot">4</div>
                    <div className="step-label">
                      {lang === 'am' ? 'ዝግጁ' : 'Ready!'}
                    </div>
                  </div>
                </div>
              )}

              {/* Rejection notice if cancelled */}
              {activeOrder.status === 'cancelled' && activeOrder.rejection_reason && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid #ef4444',
                    borderRadius: 12,
                    padding: 12,
                    margin: '12px 0',
                    color: '#ff8a7a',
                  }}
                >
                  <b>{L.rejection}</b> {activeOrder.rejection_reason}
                </div>
              )}

              {/* Ready banner */}
              {activeOrder.status === 'ready' && (
                <div
                  style={{
                    background: 'rgba(98, 189, 44, 0.2)',
                    border: '1px solid var(--g)',
                    borderRadius: 12,
                    padding: 12,
                    margin: '14px 0',
                    textAlign: 'center',
                    fontWeight: 700,
                  }}
                >
                  🍽️{' '}
                  {lang === 'am'
                    ? 'ምግብዎ ተዘጋጅቷል! አስተናጋጁ ወደ ጠረጴዛዎ ያመጣልዎታል ወይም ከካውንተሩ መውሰድ ይችላሉ።'
                    : 'Your food is ready! The staff is bringing it to your table or you can pick it up at the counter.'}
                </div>
              )}

              {/* Ordered items breakdown */}
              <div
                style={{
                  background: 'var(--card-subtle)',
                  borderRadius: 12,
                  padding: 12,
                  margin: '14px 0',
                }}
              >
                <b style={{ fontSize: '.9rem' }}>{lang === 'am' ? 'የታዘዙ ምግቦች:' : 'Ordered Items:'}</b>
                {activeOrder.items?.map((it, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '.9rem',
                      padding: '4px 0',
                    }}
                  >
                    <span>
                      {it.qty}x {t(it, 'name')}
                      {it.notes && (
                        <span style={{ fontSize: '.78rem', color: 'var(--o)' }}>
                          {' '}
                          ({it.notes})
                        </span>
                      )}
                    </span>
                    <b>{(it.price * it.qty).toLocaleString()} {L.cur}</b>
                  </div>
                ))}

                <div
                  style={{
                    borderTop: '1px solid var(--bd)',
                    marginTop: 8,
                    paddingTop: 8,
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 800,
                  }}
                >
                  <span>{L.total}:</span>
                  <span style={{ color: 'var(--o)' }}>
                    {Number(activeOrder.total).toLocaleString()} {L.cur}
                  </span>
                </div>
              </div>

              {/* Payment Proof details */}
              <div style={{ fontSize: '.85rem', color: 'var(--mu)', marginBottom: 14 }}>
                <div>
                  <b>{L.payMethod}:</b>{' '}
                  {activeOrder.payment_method === 'cash' ? L.payCash : L.payDigital}
                </div>
                {activeOrder.transaction_ref && (
                  <div>
                    <b>{L.txnRef}:</b> {activeOrder.transaction_ref}
                  </div>
                )}
                {activeOrder.screenshot_url && (
                  <div style={{ marginTop: 6 }}>
                    <b>Receipt Proof:</b> Attached
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn x"
                  style={{ flex: 1 }}
                  onClick={() => setShowOrderTracker(false)}
                >
                  {L.backToMenu}
                </button>
                {activeOrder.status === 'completed' && (
                  <button
                    className="btn o"
                    style={{ flex: 1 }}
                    onClick={() => {
                      localStorage.removeItem('hiraga_active_order_id');
                      setActiveOrder(null);
                      setShowOrderTracker(false);
                    }}
                  >
                    {lang === 'am' ? 'አዲስ ትዕዛዝ ጀምር' : 'Place New Order'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
