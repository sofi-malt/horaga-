'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  fetchOrders,
  updateOrder,
  createOrder,
  subscribeToOrders,
  ORDER_STATUSES,
} from '../../lib/orders';
import { playChime } from '../../lib/audio';
import StaffLoginForm from '../../components/StaffLoginForm';
import StaffSecurityModal from '../../components/StaffSecurityModal';

export default function CashierPage() {
  const [session, setSession] = useState(undefined);
  const [lang, setLang] = useState('am');
  const [showSecurityModal, setShowSecurityModal] = useState(false);

  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('pending'); // 'pending' | 'kitchen' | 'ready' | 'completed' | 'all'
  const [search, setSearch] = useState('');
  const [activeReceiptImage, setActiveReceiptImage] = useState(null);
  const [rejectingOrder, setRejectingOrder] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [printableOrder, setPrintableOrder] = useState(null);

  // Quick POS Walk-in order modal
  const [showPOS, setShowPOS] = useState(false);
  const [posTable, setPosTable] = useState('');
  const [posCustomer, setPosCustomer] = useState('');
  const [posItems, setPosItems] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [posTotal, setPosTotal] = useState(0);
  const [posWaiter, setPosWaiter] = useState('');

  // Waiter assignment & ambiguity resolution state
  const [waiters, setWaiters] = useState([]);
  const [waiterFilter, setWaiterFilter] = useState('all');
  const [assigningWaiterOrder, setAssigningWaiterOrder] = useState(null);
  const [selectedWaiterName, setSelectedWaiterName] = useState('');
  const [customWaiterInput, setCustomWaiterInput] = useState('');

  // Check auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setBusyLogin(true);
    setLoginMsg({ text: '', bad: false });

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pw,
    });

    setBusyLogin(false);
    if (error) {
      setLoginMsg({ text: error.message, bad: true });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const loadOrders = useCallback(async () => {
    const list = await fetchOrders();
    setOrders(list || []);
  }, []);

  useEffect(() => {
    if (!session) return;

    loadOrders();

    // Fetch menu items for cashier POS
    supabase
      .from('items')
      .select('*')
      .eq('available', true)
      .order('name')
      .then(({ data }) => setMenuItems(data || []));

    // Fetch registered waiters list for assignment
    supabase
      .from('staff')
      .select('id, name, email')
      .eq('role', 'waiter')
      .order('name')
      .then(({ data }) => setWaiters(data || []));

    // Listen to real-time order updates
    const unsubscribe = subscribeToOrders(({ event, order, orders: allOrders }) => {
      if (allOrders) {
        setOrders(allOrders);
      } else if (order) {
        if (event === 'INSERT') {
          playChime('new_order');
        }
        loadOrders();
      }
    });

    return () => unsubscribe();
  }, [session, loadOrders]);

  // Actions
  const handleConfirmPayment = async (order) => {
    playChime('confirmed');
    await updateOrder(order.id, {
      status: 'confirmed',
      payment_status: 'confirmed',
    });
    loadOrders();
  };

  const handleMarkReady = async (order) => {
    playChime('ready');
    await updateOrder(order.id, { status: 'ready' });
    loadOrders();
  };

  const handleCompleteOrder = async (order) => {
    await updateOrder(order.id, { status: 'completed' });
    loadOrders();
  };

  const handleRejectOrder = async () => {
    if (!rejectingOrder) return;
    playChime('alert');
    await updateOrder(rejectingOrder.id, {
      status: 'cancelled',
      payment_status: 'rejected',
      rejection_reason: rejectReason.trim() || 'Payment could not be verified',
    });
    setRejectingOrder(null);
    setRejectReason('');
    loadOrders();
  };

  // Waiter Assignment
  const handleSaveWaiterAssignment = async (e) => {
    e.preventDefault();
    if (!assigningWaiterOrder) return;
    const finalWaiter = (customWaiterInput.trim() || selectedWaiterName.trim() || null);
    await updateOrder(assigningWaiterOrder.id, { waiter_name: finalWaiter });
    setAssigningWaiterOrder(null);
    setSelectedWaiterName('');
    setCustomWaiterInput('');
    loadOrders();
  };

  // Printing
  const printReceipt = (order) => {
    setPrintableOrder(order);
    setTimeout(() => {
      window.print();
    }, 200);
  };

  // POS Add item
  const addPosItem = (item) => {
    const exist = posItems.find((p) => p.id === item.id);
    let updated;
    if (exist) {
      updated = posItems.map((p) => (p.id === item.id ? { ...p, qty: p.qty + 1 } : p));
    } else {
      updated = [
        ...posItems,
        {
          id: item.id,
          name: item.name,
          name_am: item.name_am,
          price: Number(item.price),
          qty: 1,
          notes: '',
        },
      ];
    }
    setPosItems(updated);
    setPosTotal(updated.reduce((sum, i) => sum + i.price * i.qty, 0));
  };

  const updatePosQty = (id, delta) => {
    const updated = posItems
      .map((p) => (p.id === id ? { ...p, qty: p.qty + delta } : p))
      .filter((p) => p.qty > 0);
    setPosItems(updated);
    setPosTotal(updated.reduce((sum, i) => sum + i.price * i.qty, 0));
  };

  const submitPosOrder = async (e) => {
    e.preventDefault();
    if (!posItems.length) return;

    await createOrder({
      table_number: posTable.trim() || 'Counter Walk-in',
      customer_name: posCustomer.trim() || 'Walk-in Guest',
      items: posItems,
      total: posTotal,
      payment_method: 'cash',
      payment_status: 'confirmed',
      status: 'confirmed',
      waiter_name: posWaiter.trim() || null,
      confirmed_by: session.user?.email || 'cashier',
    });

    setShowPOS(false);
    setPosTable('');
    setPosCustomer('');
    setPosWaiter('');
    setPosItems([]);
    setPosTotal(0);
    loadOrders();
  };

  // Loading session state
  if (session === undefined) {
    return (
      <main className="wrap" style={{ textAlign: 'center', paddingTop: 80 }}>
        <p className="empty">Checking cashier authorization...</p>
      </main>
    );
  }

  // If not signed in: Free Staff Login with Password, Email OTP, or 2FA
  if (!session) {
    return (
      <StaffLoginForm
        title={lang === 'am' ? 'የካሼር መግቢያ' : 'Cashier Desk Sign In'}
        subtitle={
          lang === 'am'
            ? 'የተፈቀደላቸው የካሼር ሰራተኞች ብቻ'
            : 'Restricted Area. Authorized cashier staff sign-in.'
        }
        icon="💵"
        lang={lang}
        onLangChange={setLang}
        onLoginSuccess={(s) => setSession(s)}
      />
    );
  }

  // Filter orders
  const pendingCount = orders.filter((o) => o.status === 'pending_payment').length;
  const kitchenCount = orders.filter((o) => ['confirmed', 'preparing'].includes(o.status)).length;
  const readyCount = orders.filter((o) => o.status === 'ready').length;

  const filteredOrders = orders
    .filter((o) => {
      if (filter === 'pending') return o.status === 'pending_payment';
      if (filter === 'kitchen') return ['confirmed', 'preparing'].includes(o.status);
      if (filter === 'ready') return o.status === 'ready';
      if (filter === 'completed') return ['completed', 'cancelled'].includes(o.status);
      return true; // all
    })
    .filter((o) => {
      if (waiterFilter === 'all') return true;
      if (waiterFilter === 'unassigned') return !o.waiter_name;
      return o.waiter_name?.toLowerCase() === waiterFilter.toLowerCase();
    })
    .filter((o) => {
      if (!search) return true;
      const term = search.toLowerCase();
      return (
        (o.order_number && o.order_number.toLowerCase().includes(term)) ||
        (o.table_number && o.table_number.toLowerCase().includes(term)) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(term)) ||
        (o.waiter_name && o.waiter_name.toLowerCase().includes(term)) ||
        (o.transaction_ref && o.transaction_ref.toLowerCase().includes(term))
      );
    });

  const timeAgo = (iso) => {
    if (!iso) return '';
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (diff < 1) return 'Just now';
    if (diff === 1) return '1m ago';
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff / 60)}h ago`;
  };

  return (
    <main className="wrap-wide noprint">
      {/* Top Navbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--bd)',
          padding: '14px 0',
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo.png" alt="Logo" style={{ height: 40, width: 'auto' }} />
          <div>
            <h1 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--o)' }}>
              💵 Cashier Desk
            </h1>
            <span className="sm">
              Staff: <b>{session.user?.email}</b>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            className={`btn sm ${soundEnabled ? 'o' : 'x'}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
            title="Audio notification chime"
          >
            {soundEnabled ? '🔔 Sound On' : '🔕 Muted'}
          </button>
          <button className="btn sm" onClick={() => setShowPOS(true)}>
            + New Walk-in Order
          </button>
          <button
            className="btn sm o"
            onClick={() => setShowSecurityModal(true)}
            title="Change Password & 2FA"
          >
            🔑 {lang === 'am' ? 'የይለፍ ቃልና ደህንነት' : 'Security & Password'}
          </button>
          <a href="/kitchen" className="btn sm x">
            👨‍🍳 Kitchen KDS
          </a>
          <a href="/admin" className="btn sm x">
            ⚙️ Admin
          </a>
          <button className="btn sm danger" onClick={handleSignOut} title="Sign out of Cashier Desk">
            Sign out
          </button>
        </div>
      </div>

      {/* Overview Stat Badges */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <button
          className={`panel ${filter === 'pending' ? 'urgent' : ''}`}
          style={{ margin: 0, cursor: 'pointer', textAlign: 'left', padding: 12 }}
          onClick={() => setFilter('pending')}
        >
          <div className="sm">Pending Payment</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--o)' }}>
            {pendingCount}
          </div>
        </button>

        <button
          className={`panel ${filter === 'kitchen' ? 'urgent' : ''}`}
          style={{ margin: 0, cursor: 'pointer', textAlign: 'left', padding: 12 }}
          onClick={() => setFilter('kitchen')}
        >
          <div className="sm">In Kitchen Cooking</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--b)' }}>
            {kitchenCount}
          </div>
        </button>

        <button
          className={`panel ${filter === 'ready' ? 'kitchen-ready' : ''}`}
          style={{ margin: 0, cursor: 'pointer', textAlign: 'left', padding: 12 }}
          onClick={() => setFilter('ready')}
        >
          <div className="sm">Ready for Serving</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--g)' }}>
            {readyCount}
          </div>
        </button>

        <button
          className="panel"
          style={{ margin: 0, cursor: 'pointer', textAlign: 'left', padding: 12 }}
          onClick={() => setFilter('all')}
        >
          <div className="sm">Total Orders Today</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--tx)' }}>
            {orders.length}
          </div>
        </button>
      </div>

      {/* Filter Tabs and Search */}
      <div className="row" style={{ marginBottom: 16 }}>
        <div className="tabs" style={{ position: 'static', padding: 0, flex: '1 1 320px' }}>
          <button
            className={`tab ${filter === 'pending' ? 'on' : ''}`}
            onClick={() => setFilter('pending')}
          >
            Pending Approval ({pendingCount})
          </button>
          <button
            className={`tab ${filter === 'kitchen' ? 'on' : ''}`}
            onClick={() => setFilter('kitchen')}
          >
            Kitchen ({kitchenCount})
          </button>
          <button
            className={`tab ${filter === 'ready' ? 'on' : ''}`}
            onClick={() => setFilter('ready')}
          >
            Ready ({readyCount})
          </button>
          <button
            className={`tab ${filter === 'completed' ? 'on' : ''}`}
            onClick={() => setFilter('completed')}
          >
            Completed
          </button>
          <button
            className={`tab ${filter === 'all' ? 'on' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flex: '1 1 340px' }}>
          <select
            value={waiterFilter}
            onChange={(e) => setWaiterFilter(e.target.value)}
            style={{ maxWidth: 160, margin: 0, fontSize: '.85rem' }}
            title="Filter by assigned waiter"
          >
            <option value="all">🛎️ All Waiters</option>
            <option value="unassigned">⚠️ Unassigned</option>
            {waiters.map((w) => (
              <option key={w.id} value={w.name}>
                🛎️ {w.name}
              </option>
            ))}
          </select>
          <input
            style={{ flex: 1, margin: 0 }}
            placeholder="Search by Order #, Table, Waiter..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Orders Grid */}
      {!filteredOrders.length ? (
        <div className="empty">
          No orders found in this view.
          <br />
          <button className="btn sm x" style={{ marginTop: 12 }} onClick={loadOrders}>
            🔄 Refresh List
          </button>
        </div>
      ) : (
        <div className="order-grid">
          {filteredOrders.map((ord) => {
            const isPending = ord.status === 'pending_payment';
            const isReady = ord.status === 'ready';

            return (
              <div
                key={ord.id}
                className={`order-card ${isPending ? 'urgent' : ''} ${isReady ? 'kitchen-ready' : ''}`}
              >
                <div>
                  {/* Card Header */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: 8,
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: '1.25rem',
                          fontWeight: 800,
                          color: 'var(--o)',
                          marginRight: 8,
                        }}
                      >
                        {ord.order_number}
                      </span>
                      <b style={{ fontSize: '1.1rem' }}>Table {ord.table_number}</b>
                    </div>
                    <span className="sm">{timeAgo(ord.created_at)}</span>
                  </div>

                  {/* Customer Info */}
                  {(ord.customer_name || ord.customer_phone) && (
                    <div className="sm" style={{ marginBottom: 8 }}>
                      👤 {ord.customer_name || 'Guest'}{' '}
                      {ord.customer_phone && `(${ord.customer_phone})`}
                    </div>
                  )}

                  {/* Status Badge */}
                  <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      className={`badge ${
                        ord.status === 'pending_payment'
                          ? 'orange'
                          : ord.status === 'confirmed'
                          ? 'blue'
                          : ord.status === 'preparing'
                          ? 'purple'
                          : ord.status === 'ready'
                          ? 'green'
                          : ord.status === 'cancelled'
                          ? 'red'
                          : 'gray'
                      }`}
                    >
                      ● {ORDER_STATUSES[ord.status]?.en || ord.status}
                    </span>
                    {ord.confirmed_by && (
                      <span className="sm" style={{ fontSize: '.72rem', color: 'var(--mu)' }}>
                        Verified by: {ord.confirmed_by}
                      </span>
                    )}
                  </div>

                  {/* Waiter Attribution Badge & Quick Assignment */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderRadius: 8,
                      marginBottom: 10,
                      background: ord.waiter_name ? 'rgba(139, 92, 246, 0.12)' : 'rgba(239, 68, 68, 0.1)',
                      border: `1px solid ${ord.waiter_name ? 'rgba(139, 92, 246, 0.3)' : 'rgba(239, 68, 68, 0.25)'}`,
                    }}
                  >
                    <span style={{ fontSize: '.84rem', fontWeight: 600, color: ord.waiter_name ? '#c4b5fd' : '#fca5a5' }}>
                      🛎️ {ord.waiter_name ? `Waiter: ${ord.waiter_name}` : '⚠️ No Waiter Assigned'}
                    </span>
                    <button
                      type="button"
                      className="btn sm x"
                      style={{ fontSize: '.74rem', padding: '2px 8px' }}
                      onClick={() => {
                        setAssigningWaiterOrder(ord);
                        setSelectedWaiterName(ord.waiter_name || '');
                        setCustomWaiterInput('');
                      }}
                    >
                      {ord.waiter_name ? 'Change Waiter' : '➕ Assign Waiter'}
                    </button>
                  </div>

                  {/* Ordered Items List */}
                  <div
                    style={{
                      background: 'var(--card-subtle)',
                      borderRadius: 10,
                      padding: 10,
                      margin: '10px 0',
                    }}
                  >
                    {ord.items?.map((it, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '3px 0',
                          fontSize: '.9rem',
                        }}
                      >
                        <div>
                          <b>{it.qty}x</b> {it.name}
                          {it.notes && (
                            <div style={{ fontSize: '.78rem', color: 'var(--o)' }}>
                              📝 {it.notes}
                            </div>
                          )}
                        </div>
                        <span>{(it.price * it.qty).toLocaleString()} ETB</span>
                      </div>
                    ))}
                    {ord.notes && (
                      <div
                        style={{
                          marginTop: 6,
                          paddingTop: 6,
                          borderTop: '1px dashed var(--bd)',
                          fontSize: '.82rem',
                          color: 'var(--o)',
                        }}
                      >
                        <b>General Note:</b> {ord.notes}
                      </div>
                    )}
                  </div>

                  {/* Payment Proof Verification Box */}
                  <div
                    style={{
                      border: '1px solid var(--bd)',
                      borderRadius: 10,
                      padding: 10,
                      margin: '10px 0',
                      fontSize: '.85rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>Payment Method:</span>
                      <b>{ord.payment_method === 'cash' ? '💵 Cash' : '📱 Digital Transfer'}</b>
                    </div>

                    {ord.transaction_ref && (
                      <div style={{ wordBreak: 'break-all', marginTop: 4 }}>
                        <span className="sm">Transaction Ref/Link:</span>
                        <div style={{ fontWeight: 600, color: 'var(--o)' }}>
                          {ord.transaction_ref.startsWith('http') ? (
                            <a
                              href={ord.transaction_ref}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: 'var(--b)' }}
                            >
                              🔗 Open Transaction Link
                            </a>
                          ) : (
                            ord.transaction_ref
                          )}
                        </div>
                      </div>
                    )}

                    {ord.screenshot_url && (
                      <div style={{ marginTop: 8 }}>
                        <div className="sm" style={{ marginBottom: 4 }}>
                          Payment Screenshot / Receipt:
                        </div>
                        <img
                          src={ord.screenshot_url}
                          alt="Receipt Proof"
                          style={{
                            height: 70,
                            borderRadius: 8,
                            cursor: 'pointer',
                            border: '1px solid var(--bd)',
                          }}
                          onClick={() => setActiveReceiptImage(ord.screenshot_url)}
                          title="Click to view full screenshot"
                        />
                      </div>
                    )}
                  </div>

                  {/* Total Amount */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontWeight: 800,
                      fontSize: '1.2rem',
                      margin: '10px 0',
                    }}
                  >
                    <span>Total:</span>
                    <span style={{ color: 'var(--o)' }}>
                      {Number(ord.total).toLocaleString()} ETB
                    </span>
                  </div>

                  {ord.rejection_reason && (
                    <div style={{ color: '#ff8a7a', fontSize: '.84rem', margin: '6px 0' }}>
                      <b>Rejection:</b> {ord.rejection_reason}
                    </div>
                  )}
                </div>

                {/* Cashier Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                  {isPending && (
                    <>
                      <button className="btn" onClick={() => handleConfirmPayment(ord)}>
                        ✅ Confirm Payment & Send to Kitchen
                      </button>
                      <button
                        className="btn danger sm"
                        onClick={() => {
                          setRejectingOrder(ord);
                          setRejectReason('');
                        }}
                      >
                        ❌ Reject Order
                      </button>
                    </>
                  )}

                  {ord.status === 'confirmed' && (
                    <div className="sm" style={{ textAlign: 'center', color: 'var(--b)' }}>
                      ⏳ Sent to Kitchen (Waiting for Chef)
                    </div>
                  )}

                  {ord.status === 'preparing' && (
                    <div className="sm" style={{ textAlign: 'center', color: 'var(--p)' }}>
                      👨‍🍳 Chef is currently preparing this dish
                    </div>
                  )}

                  {isReady && (
                    <button className="btn" onClick={() => handleCompleteOrder(ord)}>
                      🍽️ Mark Served & Completed
                    </button>
                  )}

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn x sm" style={{ flex: 1 }} onClick={() => printReceipt(ord)}>
                      🖨️ Print Bill
                    </button>
                    {['confirmed', 'preparing'].includes(ord.status) && (
                      <button className="btn sm o" style={{ flex: 1 }} onClick={() => handleMarkReady(ord)}>
                        Mark Ready
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Screenshot Lightbox Modal */}
      {activeReceiptImage && (
        <div className="lightbox" onClick={() => setActiveReceiptImage(null)}>
          <div style={{ maxWidth: 800, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <img src={activeReceiptImage} alt="Payment Receipt" />
            <div style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => setActiveReceiptImage(null)}>
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Prompt Modal */}
      {rejectingOrder && (
        <div className="mod" onClick={() => setRejectingOrder(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="in">
              <h3 style={{ color: '#ff8a7a' }}>Reject Order {rejectingOrder.order_number}</h3>
              <p className="sm">
                Provide a reason why this order/payment is rejected so the customer is notified.
              </p>
              <textarea
                rows={3}
                placeholder="e.g. Transaction code not received on Telebirr, screenshot unclear, or item out of stock."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn danger" style={{ flex: 1 }} onClick={handleRejectOrder}>
                  Confirm Rejection
                </button>
                <button className="btn x" onClick={() => setRejectingOrder(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Walk-in POS Modal */}
      {showPOS && (
        <div className="mod" onClick={() => setShowPOS(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 650 }}>
            <div className="in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Create Walk-in / Phone Order</h3>
                <button className="btn x sm" onClick={() => setShowPOS(false)}>
                  ✕
                </button>
              </div>

              <form onSubmit={submitPosOrder} style={{ marginTop: 14 }}>
                <div className="row">
                  <input
                    required
                    placeholder="Table # or Walk-in"
                    value={posTable}
                    onChange={(e) => setPosTable(e.target.value)}
                  />
                  <input
                    placeholder="Customer Name (optional)"
                    value={posCustomer}
                    onChange={(e) => setPosCustomer(e.target.value)}
                  />
                </div>

                <div style={{ marginTop: 8, marginBottom: 6 }}>
                  <label style={{ fontSize: '.82rem', color: 'var(--mu)', display: 'block', marginBottom: 3 }}>
                    Assign Waiter for this Order (አስተናጋጅ ምረጥ):
                  </label>
                  <select
                    value={posWaiter}
                    onChange={(e) => setPosWaiter(e.target.value)}
                    style={{ width: '100%', margin: 0 }}
                  >
                    <option value="">Counter Walk-in (No Waiter)</option>
                    {waiters.map((w) => (
                      <option key={w.id} value={w.name}>
                        🛎️ Waiter: {w.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ fontWeight: 700, margin: '10px 0 6px' }}>Select Dishes:</div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                    gap: 6,
                    maxHeight: 180,
                    overflowY: 'auto',
                    border: '1px solid var(--bd)',
                    borderRadius: 10,
                    padding: 8,
                  }}
                >
                  {menuItems.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="btn sm x"
                      style={{ textAlign: 'left', display: 'block', padding: '6px 8px' }}
                      onClick={() => addPosItem(m)}
                    >
                      <div style={{ fontWeight: 600 }}>{m.name}</div>
                      <div className="sm">{m.price} ETB</div>
                    </button>
                  ))}
                </div>

                {/* Selected POS items */}
                {posItems.length > 0 && (
                  <div style={{ marginTop: 14, borderTop: '1px solid var(--bd)', paddingTop: 10 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Selected Items:</div>
                    {posItems.map((p) => (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '4px 0',
                        }}
                      >
                        <span>
                          {p.name} ({p.price} ETB)
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            className="btn x sm"
                            onClick={() => updatePosQty(p.id, -1)}
                          >
                            -
                          </button>
                          <b>{p.qty}</b>
                          <button
                            type="button"
                            className="btn x sm"
                            onClick={() => updatePosQty(p.id, 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontWeight: 800,
                        fontSize: '1.15rem',
                        marginTop: 10,
                      }}
                    >
                      <span>Total:</span>
                      <span style={{ color: 'var(--o)' }}>{posTotal.toLocaleString()} ETB</span>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn"
                  style={{ width: '100%', marginTop: 14, padding: 12 }}
                  disabled={!posItems.length}
                >
                  Confirm & Send to Kitchen ({posTotal.toLocaleString()} ETB)
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Assign / Change Waiter Modal Popup */}
      {assigningWaiterOrder && (
        <div className="mod" onClick={() => setAssigningWaiterOrder(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>
                  🛎️ Assign Waiter to Order {assigningWaiterOrder.order_number}
                </h3>
                <button className="btn x sm" onClick={() => setAssigningWaiterOrder(null)}>
                  ✕
                </button>
              </div>
              <p className="sm" style={{ color: 'var(--mu)', marginTop: 4 }}>
                Resolves waiter ambiguity for Table {assigningWaiterOrder.table_number}. The selected waiter is officially recorded as the server for this order.
              </p>

              <form onSubmit={handleSaveWaiterAssignment} style={{ marginTop: 14 }}>
                <label style={{ fontSize: '.84rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Select from Registered Waiters:
                </label>
                <select
                  value={selectedWaiterName}
                  onChange={(e) => {
                    setSelectedWaiterName(e.target.value);
                    setCustomWaiterInput('');
                  }}
                  style={{ width: '100%', marginBottom: 12 }}
                >
                  <option value="">-- Choose Waiter --</option>
                  {waiters.map((w) => (
                    <option key={w.id} value={w.name}>
                      🛎️ {w.name} ({w.email})
                    </option>
                  ))}
                </select>

                <label style={{ fontSize: '.84rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Or Type Custom Waiter Name:
                </label>
                <input
                  placeholder="e.g. Dawit, Tigist..."
                  value={customWaiterInput}
                  onChange={(e) => {
                    setCustomWaiterInput(e.target.value);
                    setSelectedWaiterName('');
                  }}
                  style={{ width: '100%', marginBottom: 16 }}
                />

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn x"
                    onClick={() => setAssigningWaiterOrder(null)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn o" style={{ fontWeight: 600 }}>
                    Save Waiter Assignment
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Printable Receipt Hidden Template */}
      {printableOrder && (
        <div id="printable-receipt">
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 18, color: '#000' }}>HIRAGA RESTAURANT</h2>
            <div>Official Guest Receipt</div>
            <div>Order {printableOrder.order_number}</div>
            <div>Table: {printableOrder.table_number}</div>
            <div>Server / Waiter: {printableOrder.waiter_name || 'Counter Staff'}</div>
            <div>Date: {new Date(printableOrder.created_at).toLocaleString()}</div>
          </div>
          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
          {printableOrder.items?.map((it, idx) => (
            <div
              key={idx}
              style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}
            >
              <span>
                {it.qty}x {it.name}
              </span>
              <span>{(it.price * it.qty).toLocaleString()} ETB</span>
            </div>
          ))}
          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 800,
              fontSize: 15,
            }}
          >
            <span>TOTAL:</span>
            <span>{Number(printableOrder.total).toLocaleString()} ETB</span>
          </div>
          <div style={{ margin: '8px 0', fontSize: 12 }}>
            Payment: {printableOrder.payment_method?.toUpperCase()} (
            {printableOrder.payment_status?.toUpperCase()})
            {printableOrder.transaction_ref && <div>Ref: {printableOrder.transaction_ref}</div>}
          </div>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <div>Thank you for dining with us!</div>
            <div>እባክዎ ደግመው ይጎብኙን!</div>
          </div>
        </div>
      )}

      {/* 100% Free Staff Security, Password Change & 2FA Modal */}
      <StaffSecurityModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        session={session}
        lang={lang}
      />
    </main>
  );
}
