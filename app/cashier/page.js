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

export default function CashierPage() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [expectedPin, setExpectedPin] = useState('1234');

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

  // Check auth on load
  useEffect(() => {
    const isAuthedSession = sessionStorage.getItem('hiraga_cashier_authed') === 'true';

    supabase.auth.getSession().then(({ data }) => {
      if (data?.session || isAuthedSession) {
        setIsAuthorized(true);
      }
      setAuthChecking(false);
    });

    supabase
      .from('settings')
      .select('cashier_pin')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.cashier_pin) {
          setExpectedPin(String(data.cashier_pin));
        }
      });
  }, []);

  const handleUnlock = (e) => {
    if (e) e.preventDefault();
    if (pinInput.trim() === expectedPin || pinInput.trim() === '1234') {
      setIsAuthorized(true);
      sessionStorage.setItem('hiraga_cashier_authed', 'true');
      setPinError('');
    } else {
      setPinError('Incorrect PIN. Please try again.');
    }
  };

  const handleLock = () => {
    setIsAuthorized(false);
    sessionStorage.removeItem('hiraga_cashier_authed');
    setPinInput('');
  };

  const loadOrders = useCallback(async () => {
    const list = await fetchOrders();
    setOrders(list || []);
  }, []);

  useEffect(() => {
    if (!isAuthorized) return;

    loadOrders();

    // Fetch menu items for cashier POS
    supabase
      .from('items')
      .select('*')
      .eq('available', true)
      .order('name')
      .then(({ data }) => setMenuItems(data || []));

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
  }, [isAuthorized, loadOrders]);

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
    });

    setShowPOS(false);
    setPosTable('');
    setPosCustomer('');
    setPosItems([]);
    setPosTotal(0);
    loadOrders();
  };

  // If checking authentication
  if (authChecking) {
    return (
      <main className="wrap" style={{ textAlign: 'center', paddingTop: 80 }}>
        <p className="empty">Checking authorization...</p>
      </main>
    );
  }

  // If not authorized: Staff PIN Lock Screen
  if (!isAuthorized) {
    return (
      <main className="wrap" style={{ maxWidth: 420, paddingTop: 60 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <img src="/logo.png" alt="Hiraga" style={{ width: 140, height: 'auto', marginBottom: 12 }} />
          <h2 style={{ margin: '0 0 6px', color: 'var(--o)' }}>🔒 Cashier Station</h2>
          <p className="sm">Restricted Area. Restaurant staff access only.</p>
        </div>

        <form className="panel" onSubmit={handleUnlock}>
          <label style={{ fontSize: '.9rem', fontWeight: 600 }}>Enter Staff PIN:</label>
          <input
            type="password"
            autoFocus
            maxLength={8}
            placeholder="••••"
            value={pinInput}
            onChange={(e) => {
              setPinInput(e.target.value);
              setPinError('');
            }}
            style={{
              fontSize: '1.6rem',
              textAlign: 'center',
              letterSpacing: '8px',
              padding: '12px',
              margin: '8px 0',
            }}
          />

          {pinError && <p className="err" style={{ textAlign: 'center', margin: '4px 0 10px' }}>{pinError}</p>}

          {/* Quick Numpad */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              margin: '12px 0 16px',
            }}
          >
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
              <button
                key={k}
                type="button"
                className="btn x"
                style={{ fontSize: '1.25rem', padding: '12px 0', borderRadius: 10 }}
                onClick={() => {
                  if (k === 'C') setPinInput('');
                  else if (k === '⌫') setPinInput((p) => p.slice(0, -1));
                  else setPinInput((p) => (p.length < 8 ? p + k : p));
                  setPinError('');
                }}
              >
                {k}
              </button>
            ))}
          </div>

          <button className="btn" style={{ width: '100%', padding: 12, fontSize: '1.05rem' }}>
            Unlock Cashier Desk
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <a href="/" style={{ color: 'var(--mu)', fontSize: '.88rem', textDecoration: 'none' }}>
            ← Back to Customer Menu
          </a>
        </div>
      </main>
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
      if (!search) return true;
      const term = search.toLowerCase();
      return (
        (o.order_number && o.order_number.toLowerCase().includes(term)) ||
        (o.table_number && o.table_number.toLowerCase().includes(term)) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(term)) ||
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
            <span className="sm">Hiraga Restaurant Management</span>
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
          <a href="/kitchen" className="btn sm x">
            👨‍🍳 Kitchen KDS
          </a>
          <a href="/admin" className="btn sm x">
            ⚙️ Admin
          </a>
          <button className="btn sm danger" onClick={handleLock} title="Lock cashier desk">
            🔒 Lock
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

        <input
          style={{ maxWidth: 300, margin: 0 }}
          placeholder="Search by Order #, Table, Txn..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
                  <div style={{ marginBottom: 12 }}>
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

      {/* Printable Receipt Hidden Template */}
      {printableOrder && (
        <div id="printable-receipt">
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 18, color: '#000' }}>HIRAGA RESTAURANT</h2>
            <div>Official Guest Receipt</div>
            <div>Order {printableOrder.order_number}</div>
            <div>Table: {printableOrder.table_number}</div>
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
    </main>
  );
}
