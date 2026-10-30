'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import {
  fetchOrders,
  updateOrder,
  subscribeToOrders,
} from '../../lib/orders';
import { playChime } from '../../lib/audio';
import StaffLoginForm from '../../components/StaffLoginForm';
import StaffSecurityModal from '../../components/StaffSecurityModal';

export default function KitchenPage() {
  const [session, setSession] = useState(undefined);
  const [lang, setLang] = useState('am');
  const [showSecurityModal, setShowSecurityModal] = useState(false);

  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState('active'); // 'active' | 'ready' | 'history'
  const [checkedItems, setCheckedItems] = useState({});
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);

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

  // Update clock every 10 seconds for ticket timers
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

    const unsubscribe = subscribeToOrders(({ event, order, orders: allOrders }) => {
      if (allOrders) {
        setOrders(allOrders);
      } else if (order) {
        if (order.status === 'confirmed') {
          playChime('new_order');
        }
        loadOrders();
      }
    });

    return () => unsubscribe();
  }, [session, loadOrders]);

  // Chef accepts order and starts preparing
  const handleStartCooking = async (orderId) => {
    playChime('confirmed');
    await updateOrder(orderId, { status: 'preparing' });
    loadOrders();
  };

  // Chef finishes plating and marks order ready
  const handleMarkReady = async (orderId) => {
    playChime('ready');
    await updateOrder(orderId, { status: 'ready' });
    loadOrders();
  };

  // Order served and cleared from kitchen
  const handleCompleteOrder = async (orderId) => {
    await updateOrder(orderId, { status: 'completed' });
    loadOrders();
  };

  // Recall order back to active if chef made a mistake
  const handleRecallOrder = async (orderId) => {
    await updateOrder(orderId, { status: 'preparing' });
    loadOrders();
  };

  // Toggle item checkmark
  const toggleItemCheck = (orderId, itemIdx) => {
    const key = `${orderId}_${itemIdx}`;
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Loading session state
  if (session === undefined) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: '#0a0a08',
          color: '#f6f3ea',
          textAlign: 'center',
          paddingTop: 80,
        }}
      >
        <p className="empty">Checking kitchen authorization...</p>
      </main>
    );
  }

  // If not signed in: Free Staff Login with Password, Email OTP, or 2FA
  if (!session) {
    return (
      <StaffLoginForm
        title={lang === 'am' ? 'የኩሽና ሼፍ መግቢያ (KDS)' : 'Kitchen Display (KDS) Sign In'}
        subtitle={
          lang === 'am'
            ? 'የተፈቀደላቸው የኩሽና ሰራተኞች ብቻ'
            : 'Restricted Area. Head of Chef & Kitchen Staff sign-in.'
        }
        icon="👨‍🍳"
        lang={lang}
        onLangChange={setLang}
        onLoginSuccess={(s) => setSession(s)}
      />
    );
  }

  // Filter orders
  const activeOrders = orders.filter((o) =>
    ['confirmed', 'preparing'].includes(o.status)
  );
  const readyOrders = orders.filter((o) => o.status === 'ready');
  const historyOrders = orders.filter((o) => o.status === 'completed');

  const displayedOrders =
    tab === 'active'
      ? activeOrders
      : tab === 'ready'
      ? readyOrders
      : historyOrders;

  const getTimerMinutes = (iso) => {
    if (!iso) return 0;
    return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0a0a08',
        color: '#f6f3ea',
        padding: '16px 20px 40px',
      }}
    >
      {/* Kitchen Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2px solid #2a2a24',
          paddingBottom: 14,
          marginBottom: 16,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: '2rem' }}>👨‍🍳</span>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '1.6rem',
                color: 'var(--g)',
                fontWeight: 900,
                letterSpacing: '.5px',
              }}
            >
              KITCHEN DISPLAY (KDS)
            </h1>
            <span className="sm">
              Head Chef: <b>{session.user?.email}</b>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            className={`btn sm ${soundEnabled ? 'o' : 'x'}`}
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? '🔔 Alert Bell On' : '🔕 Muted'}
          </button>
          <button className="btn sm x" onClick={toggleFullscreen}>
            {isFullscreen ? 'Exit Fullscreen' : '⛶ Fullscreen'}
          </button>
          <button
            className="btn sm o"
            onClick={() => setShowSecurityModal(true)}
            title="Change Password & 2FA"
          >
            🔑 {lang === 'am' ? 'የይለፍ ቃልና ደህንነት' : 'Security'}
          </button>
          <a href="/cashier" className="btn sm x">
            💵 Cashier
          </a>
          <a href="/admin" className="btn sm x">
            ⚙️ Admin
          </a>
          <button className="btn sm danger" onClick={handleSignOut} title="Sign out of Kitchen Display">
            Sign out
          </button>
        </div>
      </div>

      {/* Tabs / Queues */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 18,
          borderBottom: '1px solid #2a2a24',
          paddingBottom: 10,
        }}
      >
        <button
          className={`tab ${tab === 'active' ? 'on' : ''}`}
          style={{ fontSize: '1.05rem', fontWeight: 700, padding: '8px 20px' }}
          onClick={() => setTab('active')}
        >
          🔥 ACTIVE TICKETS ({activeOrders.length})
        </button>
        <button
          className={`tab ${tab === 'ready' ? 'on' : ''}`}
          style={{ fontSize: '1.05rem', fontWeight: 700, padding: '8px 20px' }}
          onClick={() => setTab('ready')}
        >
          🍽️ READY FOR SERVING ({readyOrders.length})
        </button>
        <button
          className={`tab ${tab === 'history' ? 'on' : ''}`}
          style={{ fontSize: '1.05rem', fontWeight: 700, padding: '8px 20px' }}
          onClick={() => setTab('history')}
        >
          ✅ SERVED TODAY ({historyOrders.length})
        </button>
      </div>

      {/* Ticket Grid */}
      {!displayedOrders.length ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--mu)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 10 }}>🎉</div>
          <h2 style={{ color: 'var(--tx)', margin: '0 0 6px' }}>All caught up!</h2>
          <p>No tickets currently in this view.</p>
          <button className="btn sm x" onClick={loadOrders} style={{ marginTop: 10 }}>
            🔄 Refresh Tickets
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 16,
          }}
        >
          {displayedOrders.map((ord) => {
            const minutes = getTimerMinutes(ord.created_at);
            const isUrgent = minutes >= 18;
            const isMedium = minutes >= 10 && minutes < 18;
            const isPreparing = ord.status === 'preparing';
            const isReady = ord.status === 'ready';

            return (
              <div
                key={ord.id}
                style={{
                  background: isReady ? '#102213' : '#171714',
                  border: `2px solid ${
                    isReady
                      ? 'var(--g)'
                      : isUrgent
                      ? 'var(--r-color)'
                      : isPreparing
                      ? 'var(--p)'
                      : 'var(--o)'
                  }`,
                  borderRadius: 16,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: isUrgent ? '0 0 16px rgba(239, 68, 68, 0.25)' : 'none',
                }}
              >
                <div>
                  {/* Top Bar: Table & Ticket Number */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      borderBottom: '1px solid #2a2a24',
                      paddingBottom: 10,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: '1.7rem',
                          fontWeight: 900,
                          lineHeight: 1.1,
                          color: '#fff',
                        }}
                      >
                        TABLE {ord.table_number.toUpperCase()}
                      </div>
                      <div style={{ color: 'var(--o)', fontWeight: 700, fontSize: '1.1rem' }}>
                        {ord.order_number}
                      </div>
                      {ord.waiter_name && (
                        <div style={{ fontSize: '.86rem', color: '#a78bfa', fontWeight: 700, marginTop: 3 }}>
                          🛎️ Waiter: {ord.waiter_name}
                        </div>
                      )}
                    </div>

                    {/* Timer Badge */}
                    <div
                      style={{
                        background: isUrgent
                          ? '#ef4444'
                          : isMedium
                          ? '#f59e0b'
                          : '#2a2a24',
                        color: isUrgent || isMedium ? '#000' : 'var(--tx)',
                        fontWeight: 900,
                        fontSize: '1rem',
                        padding: '4px 10px',
                        borderRadius: 8,
                        textAlign: 'center',
                      }}
                    >
                      ⏱️ {minutes}m
                    </div>
                  </div>

                  {/* Customer General Note */}
                  {ord.notes && (
                    <div
                      style={{
                        background: 'rgba(245, 158, 11, 0.18)',
                        border: '1px solid var(--o)',
                        borderRadius: 8,
                        padding: '6px 10px',
                        marginBottom: 12,
                        fontSize: '.95rem',
                        color: 'var(--o)',
                        fontWeight: 700,
                      }}
                    >
                      ⚠️ SPECIAL NOTE: {ord.notes}
                    </div>
                  )}

                  {/* Kitchen Items Checklist */}
                  <div style={{ marginBottom: 14 }}>
                    {ord.items?.map((it, idx) => {
                      const isChecked = !!checkedItems[`${ord.id}_${idx}`];

                      return (
                        <div
                          key={idx}
                          className={`kitchen-item ${isChecked ? 'done' : ''}`}
                          onClick={() => toggleItemCheck(ord.id, idx)}
                          title="Click to check off item"
                        >
                          <span className="kitchen-qty">{it.qty}x</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: '1.15rem' }}>
                              {it.name}
                              {it.name_am && (
                                <span style={{ fontSize: '.9rem', color: 'var(--mu)', marginLeft: 6 }}>
                                  ({it.name_am})
                                </span>
                              )}
                            </div>
                            {it.notes && (
                              <div className="kitchen-note">
                                🔔 {it.notes}
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: '1.2rem', opacity: isChecked ? 1 : 0.2 }}>
                            {isChecked ? '✅' : '⬜'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Chef Bottom Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  {ord.status === 'confirmed' && (
                    <button
                      className="btn p"
                      style={{ padding: '14px', fontSize: '1.1rem', fontWeight: 800 }}
                      onClick={() => handleStartCooking(ord.id)}
                    >
                      👨‍🍳 Accept & Start Cooking
                    </button>
                  )}

                  {ord.status === 'preparing' && (
                    <button
                      className="btn"
                      style={{
                        padding: '14px',
                        fontSize: '1.15rem',
                        fontWeight: 900,
                        background: 'var(--g)',
                        color: '#06120a',
                      }}
                      onClick={() => handleMarkReady(ord.id)}
                    >
                      🍽️ PLATED & READY FOR TABLE!
                    </button>
                  )}

                  {ord.status === 'ready' && (
                    <button
                      className="btn"
                      style={{ padding: '12px', fontSize: '1.05rem', fontWeight: 800 }}
                      onClick={() => handleCompleteOrder(ord.id)}
                    >
                      ✅ Food Picked Up / Served
                    </button>
                  )}

                  {ord.status === 'completed' && (
                    <button className="btn x sm" onClick={() => handleRecallOrder(ord.id)}>
                      ↩️ Recall back to Active
                    </button>
                  )}
                </div>
              </div>
            );
          })}
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
