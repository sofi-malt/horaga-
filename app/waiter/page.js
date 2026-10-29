'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fetchOrders, updateOrder, createOrder, subscribeToOrders } from '../../lib/orders';
import { playChime } from '../../lib/audio';
import { getDictionary } from '../../lib/translations';
import StaffLoginForm from '../../components/StaffLoginForm';
import StaffSecurityModal from '../../components/StaffSecurityModal';

export default function WaiterPage() {
  const [session, setSession] = useState(undefined);
  const [lang, setLang] = useState('am'); // Default to Amharic for local staff
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const T = getDictionary(lang);

  const [orders, setOrders] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState('ready'); // 'ready', 'preparing', 'completed', 'new_order'
  const [now, setNow] = useState(Date.now());

  // Waiter Taking Table Order POS state
  const [showPOS, setShowPOS] = useState(false);
  const [posTable, setPosTable] = useState('');
  const [posCustomer, setPosCustomer] = useState('');
  const [posNotes, setPosNotes] = useState('');
  const [posItems, setPosItems] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [posBusy, setPosBusy] = useState(false);

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

  // Clock for elapsed time
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const loadOrders = useCallback(async () => {
    const list = await fetchOrders();
    setOrders(list || []);
  }, []);

  useEffect(() => {
    if (!session) return;
    loadOrders();

    // Fetch menu items for waiter POS
    supabase
      .from('items')
      .select('id, name, name_am, price, available')
      .eq('available', true)
      .order('sort')
      .then(({ data }) => {
        if (data) setMenuItems(data);
      });

    // Realtime subscription
    const unsubscribe = subscribeToOrders((payload) => {
      loadOrders();
      if (soundEnabled && payload.eventType === 'UPDATE' && payload.new?.status === 'ready') {
        playChime('ready');
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [session, soundEnabled, loadOrders]);

  // Mark order served / delivered to table
  const handleMarkServed = async (orderId) => {
    if (soundEnabled) playChime('confirmed');
    await updateOrder(orderId, { status: 'completed' });
    loadOrders();
  };

  // POS Functions
  const addPosItem = (item) => {
    const existing = posItems.find((i) => i.id === item.id);
    if (existing) {
      setPosItems(
        posItems.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i))
      );
    } else {
      setPosItems([
        ...posItems,
        {
          id: item.id,
          name: item.name,
          name_am: item.name_am,
          price: item.price,
          quantity: 1,
        },
      ]);
    }
  };

  const removePosItem = (itemId) => {
    const existing = posItems.find((i) => i.id === itemId);
    if (existing?.quantity > 1) {
      setPosItems(
        posItems.map((i) => (i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i))
      );
    } else {
      setPosItems(posItems.filter((i) => i.id !== itemId));
    }
  };

  const posTotal = posItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const handleCreateWaiterOrder = async (e) => {
    e.preventDefault();
    if (!posTable.trim()) {
      alert('Please specify the table number.');
      return;
    }
    if (posItems.length === 0) {
      alert('Please select at least one dish.');
      return;
    }

    setPosBusy(true);
    const result = await createOrder({
      table_number: posTable.trim(),
      customer_name: posCustomer.trim() || 'Waiter Order',
      items: posItems,
      total: posTotal,
      payment_method: 'cash',
      payment_status: 'pending',
      status: 'confirmed', // Sent straight to kitchen
      notes: posNotes.trim() || 'Order taken by waiter',
    });

    setPosBusy(false);
    if (result.ok) {
      if (soundEnabled) playChime('new_order');
      setShowPOS(false);
      setPosTable('');
      setPosCustomer('');
      setPosNotes('');
      setPosItems([]);
      loadOrders();
    } else {
      alert('Failed to submit order. Please try again.');
    }
  };

  // Filter orders
  const readyOrders = orders.filter((o) => o.status === 'ready');
  const preparingOrders = orders.filter((o) => o.status === 'preparing');
  const recentCompleted = orders
    .filter((o) => o.status === 'completed')
    .slice(0, 10);

  // Elapsed time formatter
  const getElapsed = (dateStr) => {
    if (!dateStr) return '';
    const diff = Math.floor((now - new Date(dateStr).getTime()) / 60000);
    if (diff <= 0) return 'Just now';
    if (diff === 1) return '1 min ago';
    return `${diff} mins ago`;
  };

  // 1. Loading State
  if (session === undefined) {
    return (
      <main className="wrap" style={{ textAlign: 'center', padding: '60px 16px' }}>
        <p className="empty">Checking waiter session...</p>
      </main>
    );
  }

  // 2. Authentication Screen: Free Staff Login with Password, Email OTP, or 2FA
  if (!session) {
    return (
      <StaffLoginForm
        title={lang === 'am' ? 'የአስተናጋጅ ገጽ መግቢያ' : 'Waiter Service Desk Sign In'}
        subtitle={
          lang === 'am'
            ? 'በሆቴሉ ስራ አስኪያጅ የተሰጠዎትን መለያ ያስገቡ'
            : 'Sign in with your staff account created by the manager'
        }
        icon="🛎️"
        lang={lang}
        onLangChange={setLang}
        onLoginSuccess={(s) => setSession(s)}
      />
    );
  }

  // 3. Authenticated Waiter Service Screen
  return (
    <main className="wrap" style={{ maxWidth: 1100, padding: '16px 12px 80px' }}>
      {/* Top Bar */}
      <div
        className="bar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          padding: '12px 16px',
          background: 'var(--bg-panel, #121210)',
          border: '1px solid var(--bd, #27272a)',
          borderRadius: 14,
          marginBottom: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '1.6rem' }}>🛎️</span>
          <div>
            <b style={{ fontSize: '1.15rem' }}>
              {lang === 'am' ? 'የአስተናጋጅ ገጽ' : 'Waiter Service Desk'}
            </b>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <span
                style={{
                  fontSize: '.72rem',
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'rgba(139, 92, 246, 0.2)',
                  color: '#a78bfa',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  fontWeight: 600,
                }}
              >
                🛎️ {session.user?.user_metadata?.full_name || session.user?.email}
              </span>
              <span
                style={{
                  fontSize: '.72rem',
                  padding: '2px 6px',
                  borderRadius: 999,
                  background: 'rgba(34, 197, 94, 0.2)',
                  color: '#4ade80',
                  fontWeight: 600,
                }}
              >
                ● {lang === 'am' ? 'ስራ ላይ' : 'On Duty'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowPOS(true)}
            className="btn sm"
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff',
              fontWeight: 600,
            }}
          >
            ➕ {lang === 'am' ? 'አዲስ የጠረጴዛ ትዕዛዝ' : 'New Table Order'}
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="btn sm o"
            style={{ fontSize: '.8rem' }}
          >
            {soundEnabled ? '🔔 Sound ON' : '🔕 Sound OFF'}
          </button>

          <button
            onClick={() => setShowSecurityModal(true)}
            className="btn sm o"
            style={{ fontSize: '.8rem' }}
            title="Change Password & 2FA"
          >
            🔑 {lang === 'am' ? 'የይለፍ ቃልና ደህንነት' : 'Security'}
          </button>

          <button
            onClick={() => setLang(lang === 'am' ? 'en' : 'am')}
            className="btn sm o"
            style={{ fontSize: '.8rem' }}
          >
            {lang === 'am' ? 'EN' : 'አማ'}
          </button>

          <button onClick={handleSignOut} className="btn sm x" style={{ fontSize: '.8rem' }}>
            {lang === 'am' ? 'ውጣ' : 'Sign out'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('ready')}
          style={{
            flex: '1 1 180px',
            padding: '12px 16px',
            borderRadius: 12,
            border: activeTab === 'ready' ? '2px solid #8b5cf6' : '1px solid var(--bd)',
            background: activeTab === 'ready' ? 'rgba(139, 92, 246, 0.15)' : 'var(--bg-panel)',
            color: activeTab === 'ready' ? '#c4b5fd' : 'var(--fg)',
            cursor: 'pointer',
            textAlign: 'left',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>🍽️ {lang === 'am' ? 'ለመቅረብ የተዘጋጁ' : 'Ready to Serve'}</span>
          <span
            style={{
              background: readyOrders.length > 0 ? '#ef4444' : 'rgba(255,255,255,0.1)',
              color: '#fff',
              fontSize: '.8rem',
              padding: '2px 8px',
              borderRadius: 999,
              fontWeight: 700,
            }}
          >
            {readyOrders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('preparing')}
          style={{
            flex: '1 1 180px',
            padding: '12px 16px',
            borderRadius: 12,
            border: activeTab === 'preparing' ? '2px solid #3b82f6' : '1px solid var(--bd)',
            background: activeTab === 'preparing' ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-panel)',
            color: activeTab === 'preparing' ? '#93c5fd' : 'var(--fg)',
            cursor: 'pointer',
            textAlign: 'left',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>👨‍🍳 {lang === 'am' ? 'በኩሽና በመዘጋጀት ላይ' : 'Cooking in Kitchen'}</span>
          <span
            style={{
              background: 'rgba(59, 130, 246, 0.3)',
              color: '#93c5fd',
              fontSize: '.8rem',
              padding: '2px 8px',
              borderRadius: 999,
              fontWeight: 700,
            }}
          >
            {preparingOrders.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          style={{
            flex: '1 1 180px',
            padding: '12px 16px',
            borderRadius: 12,
            border: activeTab === 'completed' ? '2px solid #10b981' : '1px solid var(--bd)',
            background: activeTab === 'completed' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-panel)',
            color: activeTab === 'completed' ? '#6ee7b7' : 'var(--fg)',
            cursor: 'pointer',
            textAlign: 'left',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>✅ {lang === 'am' ? 'የተስተናገዱ' : 'Served History'}</span>
          <span
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: 'var(--mu)',
              fontSize: '.8rem',
              padding: '2px 8px',
              borderRadius: 999,
              fontWeight: 600,
            }}
          >
            {recentCompleted.length}
          </span>
        </button>
      </div>

      {/* 1. READY TO SERVE ORDERS (Primary Focus for Waiters) */}
      {activeTab === 'ready' && (
        <div>
          {readyOrders.length === 0 ? (
            <div
              className="panel"
              style={{
                textAlign: 'center',
                padding: '48px 16px',
                background: 'rgba(255,255,255,0.02)',
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: 10 }}>🎉</div>
              <h3 style={{ margin: '0 0 6px' }}>
                {lang === 'am' ? 'ሁሉም ምግቦች ለደንበኛ ደርሰዋል!' : 'All orders served!'}
              </h3>
              <p className="sm" style={{ color: 'var(--mu)', margin: 0 }}>
                {lang === 'am'
                  ? 'ኩሽናው ምግብ አዘጋጅቶ ሲያጠናቅቅ እዚህ ላይ ወዲያውኑ ይታያል።'
                  : 'As soon as the kitchen marks an order ready, it will ring and appear here.'}
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 16,
              }}
            >
              {readyOrders.map((ord) => (
                <div
                  key={ord.id}
                  style={{
                    background: 'linear-gradient(180deg, #18181b 0%, #09090b 100%)',
                    border: '2px solid #8b5cf6',
                    borderRadius: 16,
                    padding: 16,
                    boxShadow: '0 8px 24px rgba(139, 92, 246, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    {/* Header */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 12,
                        paddingBottom: 10,
                        borderBottom: '1px dashed #3f3f46',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: '1.4rem',
                            fontWeight: 800,
                            color: '#a78bfa',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          📍 {lang === 'am' ? 'ጠረጴዛ' : 'Table'} {ord.table_number}
                        </div>
                        <div style={{ fontSize: '.85rem', color: 'var(--mu)' }}>
                          {ord.order_number} {ord.customer_name ? `• ${ord.customer_name}` : ''}
                        </div>
                      </div>
                      <div
                        style={{
                          background: '#8b5cf6',
                          color: '#fff',
                          fontSize: '.75rem',
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 999,
                        }}
                      >
                        ⏱️ {getElapsed(ord.updated_at || ord.created_at)}
                      </div>
                    </div>

                    {/* Items List */}
                    <div style={{ marginBottom: 14 }}>
                      {Array.isArray(ord.items) &&
                        ord.items.map((it, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '6px 0',
                              borderBottom: '1px solid rgba(255,255,255,0.05)',
                            }}
                          >
                            <span style={{ fontSize: '1rem', fontWeight: 600 }}>
                              <span
                                style={{
                                  color: '#fbbf24',
                                  fontWeight: 800,
                                  marginRight: 6,
                                  fontSize: '1.1rem',
                                }}
                              >
                                {it.quantity}x
                              </span>
                              {lang === 'am' && it.name_am ? it.name_am : it.name}
                            </span>
                            {it.notes && (
                              <span
                                style={{
                                  fontSize: '.75rem',
                                  color: '#f59e0b',
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                }}
                              >
                                {it.notes}
                              </span>
                            )}
                          </div>
                        ))}
                    </div>

                    {ord.notes && (
                      <div
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: 8,
                          padding: '8px 10px',
                          fontSize: '.82rem',
                          color: '#e4e4e7',
                          marginBottom: 14,
                        }}
                      >
                        📝 {ord.notes}
                      </div>
                    )}
                  </div>

                  {/* Mark Delivered Action */}
                  <button
                    onClick={() => handleMarkServed(ord.id)}
                    className="btn"
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#fff',
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                    }}
                  >
                    ✅ {lang === 'am' ? 'ለደንበኛ ደርሷል (አስተናግድ)' : 'Delivered to Table (Complete)'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. PREPARING IN KITCHEN (Status tracker for waiters) */}
      {activeTab === 'preparing' && (
        <div>
          {preparingOrders.length === 0 ? (
            <div className="panel" style={{ textAlign: 'center', padding: '36px 16px' }}>
              <p className="empty" style={{ margin: 0 }}>
                {lang === 'am'
                  ? 'በአሁኑ ሰዓት በኩሽና በመዘጋጀት ላይ ያለ ምግብ የለም።'
                  : 'No orders are actively being cooked in the kitchen right now.'}
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 14,
              }}
            >
              {preparingOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="panel"
                  style={{
                    border: '1px solid #3b82f6',
                    background: 'rgba(59, 130, 246, 0.04)',
                    padding: 14,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <b style={{ color: '#60a5fa', fontSize: '1.1rem' }}>
                      📍 {lang === 'am' ? 'ጠረጴዛ' : 'Table'} {ord.table_number}
                    </b>
                    <span
                      style={{
                        fontSize: '.75rem',
                        background: 'rgba(59, 130, 246, 0.2)',
                        color: '#93c5fd',
                        padding: '2px 8px',
                        borderRadius: 999,
                      }}
                    >
                      🔥 {lang === 'am' ? 'በመዘጋጀት ላይ' : 'Cooking'} ({getElapsed(ord.updated_at)})
                    </span>
                  </div>

                  <div style={{ fontSize: '.88rem', color: '#e4e4e7', marginBottom: 6 }}>
                    {Array.isArray(ord.items) &&
                      ord.items.map((it, idx) => (
                        <div key={idx} style={{ padding: '2px 0' }}>
                          <b style={{ color: '#fbbf24' }}>{it.quantity}x</b>{' '}
                          {lang === 'am' && it.name_am ? it.name_am : it.name}
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. COMPLETED SERVED ORDERS */}
      {activeTab === 'completed' && (
        <div className="panel" style={{ padding: 16 }}>
          <h3 style={{ margin: '0 0 12px' }}>
            {lang === 'am' ? 'በቅርብ የተስተናገዱ ትዕዛዞች' : 'Recently Served Orders'}
          </h3>
          {recentCompleted.length === 0 ? (
            <p className="empty">{lang === 'am' ? 'ምንም አልተገኘም' : 'No orders served yet'}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentCompleted.map((ord) => (
                <div
                  key={ord.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div>
                    <b>
                      📍 {lang === 'am' ? 'ጠረጴዛ' : 'Table'} {ord.table_number}
                    </b>{' '}
                    <span style={{ color: 'var(--mu)', fontSize: '.85rem' }}>
                      ({ord.order_number})
                    </span>
                    <div style={{ fontSize: '.8rem', color: 'var(--mu)' }}>
                      {Array.isArray(ord.items)
                        ? ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')
                        : ''}
                    </div>
                  </div>
                  <span
                    style={{
                      color: '#4ade80',
                      fontSize: '.8rem',
                      fontWeight: 600,
                      background: 'rgba(34, 197, 94, 0.1)',
                      padding: '4px 8px',
                      borderRadius: 6,
                    }}
                  >
                    ✓ {lang === 'am' ? 'ተስተናግዷል' : 'Served'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. WAITER POS MODAL (Take Table Order on the fly) */}
      {showPOS && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(5px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#121210',
              border: '1px solid var(--bd)',
              borderRadius: 16,
              maxWidth: 580,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: 20,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
                paddingBottom: 10,
                borderBottom: '1px solid var(--bd)',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
                🛎️ {lang === 'am' ? 'አዲስ የጠረጴዛ ትዕዛዝ ውሰድ' : 'Take Table Order'}
              </h2>
              <button
                onClick={() => setShowPOS(false)}
                className="btn sm x"
                style={{ padding: '4px 10px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWaiterOrder}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '.8rem', color: 'var(--mu)', display: 'block', marginBottom: 4 }}>
                    {lang === 'am' ? 'የጠረጴዛ ቁጥር *' : 'Table Number *'}
                  </label>
                  <input
                    required
                    placeholder="e.g. 5"
                    value={posTable}
                    onChange={(e) => setPosTable(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '.8rem', color: 'var(--mu)', display: 'block', marginBottom: 4 }}>
                    {lang === 'am' ? 'የደንበኛ ስም (አማራጭ)' : 'Customer Name (optional)'}
                  </label>
                  <input
                    placeholder="Guest"
                    value={posCustomer}
                    onChange={(e) => setPosCustomer(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Dish Selection */}
              <label style={{ fontSize: '.8rem', color: 'var(--mu)', display: 'block', marginBottom: 6 }}>
                {lang === 'am' ? 'ምግቦችን ይምረጡ' : 'Select Dishes from Menu'}
              </label>
              <div
                style={{
                  maxHeight: 180,
                  overflowY: 'auto',
                  border: '1px solid var(--bd)',
                  borderRadius: 10,
                  padding: 8,
                  marginBottom: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {menuItems.map((dish) => (
                  <div
                    key={dish.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 10px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: 8,
                    }}
                  >
                    <span>
                      {lang === 'am' && dish.name_am ? dish.name_am : dish.name} -{' '}
                      <b style={{ color: 'var(--o)' }}>{dish.price} ETB</b>
                    </span>
                    <button
                      type="button"
                      onClick={() => addPosItem(dish)}
                      className="btn sm o"
                      style={{ padding: '2px 10px' }}
                    >
                      + Add
                    </button>
                  </div>
                ))}
              </div>

              {/* Order Cart */}
              {posItems.length > 0 && (
                <div
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--bd)',
                    borderRadius: 10,
                    padding: 10,
                    marginBottom: 12,
                  }}
                >
                  <b style={{ fontSize: '.9rem', display: 'block', marginBottom: 6 }}>
                    {lang === 'am' ? 'የተመረጡ ምግቦች:' : 'Selected Items:'}
                  </b>
                  {posItems.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '4px 0',
                      }}
                    >
                      <span>
                        {item.name} ({item.price} ETB)
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => removePosItem(item.id)}
                          className="btn sm x"
                          style={{ padding: '1px 6px' }}
                        >
                          -
                        </button>
                        <b>{item.quantity}</b>
                        <button
                          type="button"
                          onClick={() => addPosItem(item)}
                          className="btn sm o"
                          style={{ padding: '1px 6px' }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                  <div
                    style={{
                      borderTop: '1px solid var(--bd)',
                      marginTop: 8,
                      paddingTop: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontWeight: 700,
                    }}
                  >
                    <span>Total:</span>
                    <span style={{ color: 'var(--o)' }}>{posTotal} ETB</span>
                  </div>
                </div>
              )}

              <input
                placeholder={lang === 'am' ? 'ልዩ ማስታወሻ...' : 'Kitchen notes (e.g. no pepper)'}
                value={posNotes}
                onChange={(e) => setPosNotes(e.target.value)}
                style={{ width: '100%', marginBottom: 14 }}
              />

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowPOS(false)}
                  className="btn x"
                  style={{ flex: 1 }}
                >
                  {lang === 'am' ? 'ሰርዝ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={posBusy || posItems.length === 0}
                  className="btn o"
                  style={{ flex: 2 }}
                >
                  {posBusy ? 'Submitting...' : lang === 'am' ? 'ትዕዛዙን ላክ' : 'Send to Kitchen & Cashier'}
                </button>
              </div>
            </form>
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
