'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  CreditCard,
  UtensilsCrossed,
  Printer,
  Volume2,
  VolumeX,
  Plus,
  Search,
  Users,
  UserCheck,
  UserPlus,
  FileText,
  Clock,
  Check,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  ShieldCheck,
  LogOut,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
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
  const [lang, setLang] = useState('en');
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
        if (event === 'INSERT' && soundEnabled) {
          playChime('new_order');
        }
        loadOrders();
      }
    });

    return () => unsubscribe();
  }, [session, soundEnabled, loadOrders]);

  // Actions
  const handleConfirmPayment = async (order) => {
    if (soundEnabled) playChime('confirmed');
    await updateOrder(order.id, {
      status: 'confirmed',
      payment_status: 'confirmed',
    });
    loadOrders();
  };

  const handleMarkReady = async (order) => {
    if (soundEnabled) playChime('ready');
    await updateOrder(order.id, { status: 'ready' });
    loadOrders();
  };

  const handleCompleteOrder = async (order) => {
    await updateOrder(order.id, { status: 'completed' });
    loadOrders();
  };

  const handleRejectOrder = async () => {
    if (!rejectingOrder) return;
    if (soundEnabled) playChime('alert');
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
    }, 250);
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
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ width: 44, height: 44, border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Royal Hotel Cashier POS</h3>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '.88rem' }}>Authenticating cashier terminal...</p>
        </div>
      </main>
    );
  }

  // If not signed in: Free Staff Login with Password, Email OTP, or 2FA
  if (!session) {
    return (
      <StaffLoginForm
        title="Cashier Desk Sign In"
        subtitle="Restricted Terminal. Authorized cashier staff sign-in."
        icon={<CreditCard size={28} color="#2563eb" />}
        lang={lang}
        onLangChange={setLang}
        onLoginSuccess={(s) => setSession(s)}
      />
    );
  }

  // Filter orders counts
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
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a' }} className="noprint">
      {/* Top SaaS Header */}
      <header
        style={{
          background: '#0f172a',
          color: '#ffffff',
          padding: '16px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14,
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#2563eb', display: 'grid', placeItems: 'center', color: '#ffffff' }}>
            <CreditCard size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>Cashier POS Station</h1>
              <span style={{ fontSize: '.68rem', background: '#2563eb', color: '#ffffff', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>
                TERMINAL #1
              </span>
            </div>
            <span style={{ fontSize: '.76rem', color: '#94a3b8' }}>
              Cashier: <b>{session.user?.email}</b>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="btn btn-secondary btn-sm"
            style={{ background: soundEnabled ? '#eff6ff' : '#ffffff', color: soundEnabled ? '#2563eb' : '#64748b' }}
            title="Audio alerts"
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            {soundEnabled ? 'Chimes Active' : 'Muted'}
          </button>

          <button onClick={() => setShowPOS(true)} className="btn btn-primary btn-sm">
            <Plus size={15} /> New Walk-in Order
          </button>

          <button onClick={() => setShowSecurityModal(true)} className="btn btn-secondary btn-sm" title="2FA & Password">
            <ShieldCheck size={15} /> Security
          </button>

          <a href="/kitchen" target="_blank" className="btn btn-secondary btn-sm">
            <UtensilsCrossed size={15} /> Kitchen KDS
          </a>

          <a href="/admin" target="_blank" className="btn btn-secondary btn-sm">
            Admin Portal
          </a>

          <button onClick={handleSignOut} className="btn btn-danger btn-sm">
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 28px' }}>
        {/* Stat Cards Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 20 }}>
          <div
            onClick={() => setFilter('pending')}
            className="card"
            style={{
              cursor: 'pointer',
              borderLeft: filter === 'pending' ? '4px solid #f59e0b' : '1px solid #e2e8f0',
              background: filter === 'pending' ? '#fffbeb' : '#ffffff',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '.84rem', color: '#64748b', fontWeight: 600 }}>Pending Approval</span>
              <span className="badge badge-amber">{pendingCount}</span>
            </div>
            <b style={{ fontSize: '1.8rem', fontWeight: 800, color: '#d97706', display: 'block', marginTop: 4 }}>
              {pendingCount}
            </b>
          </div>

          <div
            onClick={() => setFilter('kitchen')}
            className="card"
            style={{
              cursor: 'pointer',
              borderLeft: filter === 'kitchen' ? '4px solid #2563eb' : '1px solid #e2e8f0',
              background: filter === 'kitchen' ? '#eff6ff' : '#ffffff',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '.84rem', color: '#64748b', fontWeight: 600 }}>In Kitchen Cooking</span>
              <span className="badge badge-blue">{kitchenCount}</span>
            </div>
            <b style={{ fontSize: '1.8rem', fontWeight: 800, color: '#2563eb', display: 'block', marginTop: 4 }}>
              {kitchenCount}
            </b>
          </div>

          <div
            onClick={() => setFilter('ready')}
            className="card"
            style={{
              cursor: 'pointer',
              borderLeft: filter === 'ready' ? '4px solid #10b981' : '1px solid #e2e8f0',
              background: filter === 'ready' ? '#ecfdf5' : '#ffffff',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '.84rem', color: '#64748b', fontWeight: 600 }}>Plated & Ready</span>
              <span className="badge badge-green">{readyCount}</span>
            </div>
            <b style={{ fontSize: '1.8rem', fontWeight: 800, color: '#059669', display: 'block', marginTop: 4 }}>
              {readyCount}
            </b>
          </div>

          <div
            onClick={() => setFilter('all')}
            className="card"
            style={{
              cursor: 'pointer',
              borderLeft: filter === 'all' ? '4px solid #0f172a' : '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '.84rem', color: '#64748b', fontWeight: 600 }}>Total Orders Today</span>
              <span className="badge badge-gray">{orders.length}</span>
            </div>
            <b style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', display: 'block', marginTop: 4 }}>
              {orders.length}
            </b>
          </div>
        </div>

        {/* Filter Toolbar & Waiter Selection */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: 6, background: '#ffffff', padding: 4, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            {[
              { id: 'pending', label: 'Pending Approval', count: pendingCount },
              { id: 'kitchen', label: 'In Kitchen', count: kitchenCount },
              { id: 'ready', label: 'Ready to Serve', count: readyCount },
              { id: 'completed', label: 'Completed' },
              { id: 'all', label: 'All Orders', count: orders.length },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                className={`btn btn-sm ${filter === t.id ? 'btn-primary' : 'btn-ghost'}`}
                style={{ borderRadius: 8, padding: '6px 14px' }}
              >
                {t.label} {t.count !== undefined ? `(${t.count})` : ''}
              </button>
            ))}
          </div>

          {/* Search & Waiter Filter */}
          <div style={{ display: 'flex', gap: 10, flex: '1 1 360px', justifyContent: 'flex-end' }}>
            <select
              value={waiterFilter}
              onChange={(e) => setWaiterFilter(e.target.value)}
              style={{ maxWidth: 170, fontSize: '.85rem', margin: 0 }}
            >
              <option value="all">All Waiters</option>
              <option value="unassigned">⚠️ Unassigned</option>
              {waiters.map((w) => (
                <option key={w.id} value={w.name}>
                  {w.name}
                </option>
              ))}
            </select>

            <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
              <input
                placeholder="Search order #, table, waiter..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 34, margin: 0 }}
              />
            </div>

            <button onClick={loadOrders} className="btn btn-secondary btn-sm" title="Refresh">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Orders Grid */}
        {!filteredOrders.length ? (
          <div className="card" style={{ textAlign: 'center', padding: '64px 20px' }}>
            <ShoppingBag size={48} style={{ color: '#cbd5e1', margin: '0 auto 12px' }} />
            <h4 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>No orders found in this view</h4>
            <p style={{ color: '#64748b', fontSize: '.88rem', margin: '6px 0 16px' }}>
              Orders placed by guests or waiters will appear here instantly.
            </p>
            <button onClick={loadOrders} className="btn btn-secondary btn-sm">
              <RefreshCw size={14} /> Refresh Terminal
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
            {filteredOrders.map((ord) => {
              const isPending = ord.status === 'pending_payment';
              const isReady = ord.status === 'ready';

              return (
                <div
                  key={ord.id}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: isPending ? '1.5px solid #f59e0b' : isReady ? '1.5px solid #10b981' : '1px solid #e2e8f0',
                    boxShadow: isPending ? '0 4px 16px rgba(245, 158, 11, 0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                    padding: 20,
                  }}
                >
                  <div>
                    {/* Top Row: Order #, Table, Time */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginRight: 8 }}>
                          #{ord.order_number}
                        </span>
                        <span className="badge badge-blue" style={{ fontSize: '.8rem' }}>
                          Table {ord.table_number}
                        </span>
                      </div>
                      <span style={{ fontSize: '.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} /> {timeAgo(ord.created_at)}
                      </span>
                    </div>

                    {/* Customer Info */}
                    {(ord.customer_name || ord.customer_phone) && (
                      <div style={{ fontSize: '.84rem', color: '#64748b', marginBottom: 8 }}>
                        Guest: <b style={{ color: '#0f172a' }}>{ord.customer_name || 'Walk-in'}</b>{' '}
                        {ord.customer_phone && `(${ord.customer_phone})`}
                      </div>
                    )}

                    {/* Status Badge */}
                    <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span
                        className={`badge ${
                          ord.status === 'pending_payment'
                            ? 'badge-amber'
                            : ord.status === 'confirmed'
                            ? 'badge-blue'
                            : ord.status === 'preparing'
                            ? 'badge-purple'
                            : ord.status === 'ready'
                            ? 'badge-green'
                            : ord.status === 'cancelled'
                            ? 'badge-red'
                            : 'badge-gray'
                        }`}
                      >
                        ● {ORDER_STATUSES[ord.status]?.en || ord.status}
                      </span>

                      {ord.confirmed_by && (
                        <span style={{ fontSize: '.72rem', color: '#94a3b8' }}>
                          Verified: {ord.confirmed_by}
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
                        borderRadius: 10,
                        marginBottom: 12,
                        background: ord.waiter_name ? '#f5f3ff' : '#fff1f2',
                        border: `1px solid ${ord.waiter_name ? '#ddd6fe' : '#fecdd3'}`,
                      }}
                    >
                      <span style={{ fontSize: '.82rem', fontWeight: 600, color: ord.waiter_name ? '#6d28d9' : '#be123c', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Users size={14} />
                        {ord.waiter_name ? `Server: ${ord.waiter_name}` : 'Unassigned Waiter'}
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '.74rem', padding: '2px 8px' }}
                        onClick={() => {
                          setAssigningWaiterOrder(ord);
                          setSelectedWaiterName(ord.waiter_name || '');
                          setCustomWaiterInput('');
                        }}
                      >
                        {ord.waiter_name ? 'Change' : 'Assign'}
                      </button>
                    </div>

                    {/* Ordered Items List */}
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #f1f5f9',
                        borderRadius: 10,
                        padding: 12,
                        marginBottom: 12,
                      }}
                    >
                      {ord.items?.map((it, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '3px 0',
                            fontSize: '.88rem',
                          }}
                        >
                          <div>
                            <b>{it.qty}x</b> {it.name}
                            {it.notes && (
                              <div style={{ fontSize: '.76rem', color: '#d97706' }}>
                                Note: {it.notes}
                              </div>
                            )}
                          </div>
                          <span style={{ fontWeight: 600 }}>{(it.price * it.qty).toLocaleString()} ETB</span>
                        </div>
                      ))}
                      {ord.notes && (
                        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #e2e8f0', fontSize: '.8rem', color: '#d97706' }}>
                          <b>Customer Note:</b> {ord.notes}
                        </div>
                      )}
                    </div>

                    {/* Payment Proof / Method Box */}
                    <div
                      style={{
                        border: '1px solid #f1f5f9',
                        background: '#ffffff',
                        borderRadius: 10,
                        padding: 10,
                        marginBottom: 14,
                        fontSize: '.84rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: '#64748b' }}>Payment Mode:</span>
                        <b>{ord.payment_method === 'cash' ? '💵 Cash Settle' : '📱 Digital Transfer'}</b>
                      </div>

                      {ord.transaction_ref && (
                        <div style={{ marginTop: 4 }}>
                          <span style={{ fontSize: '.76rem', color: '#64748b' }}>Txn Reference:</span>
                          <div style={{ fontWeight: 700, color: '#2563eb', wordBreak: 'break-all' }}>
                            {ord.transaction_ref}
                          </div>
                        </div>
                      )}

                      {ord.screenshot_url && (
                        <div style={{ marginTop: 8 }}>
                          <span style={{ fontSize: '.76rem', color: '#64748b', display: 'block', marginBottom: 4 }}>
                            Receipt Screenshot:
                          </span>
                          <img
                            src={ord.screenshot_url}
                            alt="Receipt Proof"
                            style={{
                              height: 64,
                              borderRadius: 8,
                              cursor: 'pointer',
                              border: '1px solid #e2e8f0',
                            }}
                            onClick={() => setActiveReceiptImage(ord.screenshot_url)}
                            title="Click to view full screenshot"
                          />
                        </div>
                      )}
                    </div>

                    {/* Total Amount */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <span style={{ fontSize: '.9rem', color: '#64748b', fontWeight: 600 }}>Total Payable:</span>
                      <b style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
                        {Number(ord.total).toLocaleString()} ETB
                      </b>
                    </div>
                  </div>

                  {/* Cashier Action Buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {isPending && (
                      <>
                        <button onClick={() => handleConfirmPayment(ord)} className="btn btn-primary" style={{ width: '100%' }}>
                          <Check size={16} /> Confirm & Send to Kitchen
                        </button>
                        <button
                          onClick={() => {
                            setRejectingOrder(ord);
                            setRejectReason('');
                          }}
                          className="btn btn-danger btn-sm"
                          style={{ width: '100%' }}
                        >
                          <X size={14} /> Reject Order
                        </button>
                      </>
                    )}

                    {ord.status === 'confirmed' && (
                      <div style={{ textAlign: 'center', padding: '6px 0', fontSize: '.82rem', color: '#2563eb', fontWeight: 600 }}>
                        ⏳ Dispatched to Kitchen (Waiting for Chef)
                      </div>
                    )}

                    {ord.status === 'preparing' && (
                      <div style={{ textAlign: 'center', padding: '6px 0', fontSize: '.82rem', color: '#7c3aed', fontWeight: 600 }}>
                        👨‍🍳 Chef is actively preparing food
                      </div>
                    )}

                    {isReady && (
                      <button onClick={() => handleCompleteOrder(ord)} className="btn btn-success" style={{ width: '100%' }}>
                        <CheckCircle2 size={16} /> Mark Served & Settle Bill
                      </button>
                    )}

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => printReceipt(ord)} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                        <Printer size={14} /> Print Bill
                      </button>
                      {['confirmed', 'preparing'].includes(ord.status) && (
                        <button onClick={() => handleMarkReady(ord)} className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
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
      </main>

      {/* Screenshot Lightbox Modal */}
      {activeReceiptImage && (
        <div className="modal-backdrop" onClick={() => setActiveReceiptImage(null)}>
          <div style={{ maxWidth: 640, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <img src={activeReceiptImage} alt="Payment Receipt" style={{ borderRadius: 16, maxHeight: '80vh', margin: '0 auto', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }} />
            <button onClick={() => setActiveReceiptImage(null)} className="btn btn-primary" style={{ marginTop: 14 }}>
              Close Preview
            </button>
          </div>
        </div>
      )}

      {/* Walk-in POS Modal */}
      {showPOS && (
        <div className="modal-backdrop" onClick={() => setShowPOS(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Plus size={20} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 800 }}>Create Walk-in / Phone Order</h3>
              </div>
              <button onClick={() => setShowPOS(false)} className="btn btn-ghost btn-sm" style={{ padding: 6 }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitPosOrder}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>Table Number or Counter *</label>
                  <input
                    required
                    placeholder="e.g. Table 5 or Counter"
                    value={posTable}
                    onChange={(e) => setPosTable(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>Customer Name (Optional)</label>
                  <input
                    placeholder="e.g. Walk-in Guest"
                    value={posCustomer}
                    onChange={(e) => setPosCustomer(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>Assign Waiter (አስተናጋጅ ምረጥ):</label>
                <select
                  value={posWaiter}
                  onChange={(e) => setPosWaiter(e.target.value)}
                >
                  <option value="">Counter Walk-in (No Waiter)</option>
                  {waiters.map((w) => (
                    <option key={w.id} value={w.name}>
                      Waiter: {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: 8 }}>Select Dishes from Menu:</div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                  gap: 8,
                  maxHeight: 180,
                  overflowY: 'auto',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: 10,
                  marginBottom: 14,
                }}
              >
                {menuItems.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ textAlign: 'left', display: 'block', padding: '8px 10px', height: 'auto' }}
                    onClick={() => addPosItem(m)}
                  >
                    <div style={{ fontWeight: 700, fontSize: '.84rem', color: '#0f172a' }}>{m.name}</div>
                    <div style={{ fontSize: '.76rem', color: '#2563eb' }}>{m.price} ETB</div>
                  </button>
                ))}
              </div>

              {/* Selected POS items */}
              {posItems.length > 0 && (
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: '.88rem', marginBottom: 8 }}>Order Items:</div>
                  {posItems.map((p) => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: '.88rem' }}>
                      <span>
                        {p.name} ({p.price} ETB)
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '2px 8px' }} onClick={() => updatePosQty(p.id, -1)}>
                          -
                        </button>
                        <b>{p.qty}</b>
                        <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '2px 8px' }} onClick={() => updatePosQty(p.id, 1)}>
                          +
                        </button>
                      </div>
                    </div>
                  ))}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.2rem', marginTop: 12 }}>
                    <span>Total Amount:</span>
                    <span style={{ color: '#2563eb' }}>{posTotal.toLocaleString()} ETB</span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px' }}
                disabled={!posItems.length}
              >
                <Check size={16} /> Confirm & Send to Kitchen ({posTotal.toLocaleString()} ETB)
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Waiter Assignment Modal */}
      {assigningWaiterOrder && (
        <div className="modal-backdrop" onClick={() => setAssigningWaiterOrder(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <UserCheck size={20} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                  Assign Waiter (Order #{assigningWaiterOrder.order_number})
                </h3>
              </div>
              <button onClick={() => setAssigningWaiterOrder(null)} className="btn btn-ghost btn-sm" style={{ padding: 6 }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ color: '#64748b', fontSize: '.84rem', margin: '0 0 16px' }}>
              Assign an official server for Table {assigningWaiterOrder.table_number}. The waiter identity will appear on KDS kitchen tickets and thermal receipts.
            </p>

            <form onSubmit={handleSaveWaiterAssignment}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Select Registered Waiter:
                </label>
                <select
                  value={selectedWaiterName}
                  onChange={(e) => {
                    setSelectedWaiterName(e.target.value);
                    setCustomWaiterInput('');
                  }}
                >
                  <option value="">-- Choose Waiter --</option>
                  {waiters.map((w) => (
                    <option key={w.id} value={w.name}>
                      {w.name} ({w.email})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Or Type Custom Server Name:
                </label>
                <input
                  placeholder="e.g. Dawit, Tigist, Helen..."
                  value={customWaiterInput}
                  onChange={(e) => {
                    setCustomWaiterInput(e.target.value);
                    setSelectedWaiterName('');
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setAssigningWaiterOrder(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Check size={16} /> Save Server Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Receipt Template */}
      {printableOrder && (
        <div id="printable-receipt">
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 18, color: '#000' }}>ROYAL HOTEL RESTAURANT</h2>
            <div>Official Guest Invoice</div>
            <div>Order #{printableOrder.order_number}</div>
            <div>Table: {printableOrder.table_number}</div>
            <div>Server / Waiter: {printableOrder.waiter_name || 'Front Desk'}</div>
            <div>Date: {new Date(printableOrder.created_at).toLocaleString()}</div>
          </div>
          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
          {printableOrder.items?.map((it, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span>{it.qty}x {it.name}</span>
              <span>{(it.price * it.qty).toLocaleString()} ETB</span>
            </div>
          ))}
          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15 }}>
            <span>TOTAL:</span>
            <span>{Number(printableOrder.total).toLocaleString()} ETB</span>
          </div>
          <div style={{ margin: '8px 0', fontSize: 12 }}>
            Payment: {printableOrder.payment_method?.toUpperCase()} ({printableOrder.payment_status?.toUpperCase()})
            {printableOrder.transaction_ref && <div>Ref: {printableOrder.transaction_ref}</div>}
          </div>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <div>Thank you for choosing Royal Hotel!</div>
            <div>እባክዎ ደግመው ይጎብኙን!</div>
          </div>
        </div>
      )}

      {/* Staff Security & 2FA Modal */}
      <StaffSecurityModal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        session={session}
        lang={lang}
      />
    </div>
  );
}
