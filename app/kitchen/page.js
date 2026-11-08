'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  UtensilsCrossed,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ShieldCheck,
  CreditCard,
  Users,
  LogOut,
  RefreshCw,
  Flame,
  CheckSquare,
  Square,
  RotateCcw,
} from 'lucide-react';
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
  const [lang, setLang] = useState('en');
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
        if (order.status === 'confirmed' && soundEnabled) {
          playChime('new_order');
        }
        loadOrders();
      }
    });

    return () => unsubscribe();
  }, [session, soundEnabled, loadOrders]);

  // Chef accepts order and starts preparing
  const handleStartCooking = async (orderId) => {
    if (soundEnabled) playChime('confirmed');
    await updateOrder(orderId, { status: 'preparing' });
    loadOrders();
  };

  // Chef finishes plating and marks order ready
  const handleMarkReady = async (orderId) => {
    if (soundEnabled) playChime('ready');
    await updateOrder(orderId, { status: 'ready' });
    loadOrders();
  };

  // Order served and cleared from kitchen
  const handleCompleteOrder = async (orderId) => {
    await updateOrder(orderId, { status: 'completed' });
    loadOrders();
  };

  // Recall order back to active
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
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ width: 44, height: 44, border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Royal Hotel KDS</h3>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '.88rem' }}>Connecting to live kitchen ticket stream...</p>
        </div>
      </main>
    );
  }

  // If not signed in: Free Staff Login with Password, Email OTP, or 2FA
  if (!session) {
    return (
      <StaffLoginForm
        title="Kitchen Display (KDS) Sign In"
        subtitle="Restricted Terminal. Head Chef & Kitchen Staff sign-in."
        icon={<UtensilsCrossed size={28} color="#2563eb" />}
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
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a' }}>
      {/* Top KDS SaaS Header */}
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
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'grid', placeItems: 'center', color: '#ffffff', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)' }}>
            <UtensilsCrossed size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.3px' }}>
                KITCHEN DISPLAY SYSTEM (KDS)
              </h1>
              <span style={{ fontSize: '.68rem', background: '#f59e0b', color: '#1a1100', padding: '2px 8px', borderRadius: 999, fontWeight: 800 }}>
                LIVE QUEUE
              </span>
            </div>
            <span style={{ fontSize: '.76rem', color: '#94a3b8' }}>
              Head Chef: <b>{session.user?.email}</b>
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="btn btn-secondary btn-sm"
            style={{ background: soundEnabled ? '#eff6ff' : '#ffffff', color: soundEnabled ? '#2563eb' : '#64748b' }}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            {soundEnabled ? 'Chimes Active' : 'Muted'}
          </button>

          <button onClick={toggleFullscreen} className="btn btn-secondary btn-sm">
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>

          <button onClick={() => setShowSecurityModal(true)} className="btn btn-secondary btn-sm" title="2FA & Password">
            <ShieldCheck size={15} /> Security
          </button>

          <a href="/cashier" target="_blank" className="btn btn-secondary btn-sm">
            <CreditCard size={15} /> Cashier Desk
          </a>

          <a href="/waiter" target="_blank" className="btn btn-secondary btn-sm">
            <Users size={15} /> Waiter View
          </a>

          <button onClick={handleSignOut} className="btn btn-danger btn-sm">
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </header>

      {/* Main KDS Workspace */}
      <main style={{ maxWidth: 1500, margin: '0 auto', padding: '22px 28px' }}>
        {/* Ticket Queue Tabs */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <button
            onClick={() => setTab('active')}
            className={`btn ${tab === 'active' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '10px 22px', fontSize: '.92rem' }}
          >
            <Flame size={16} /> Active Cooking Tickets ({activeOrders.length})
          </button>
          <button
            onClick={() => setTab('ready')}
            className={`btn ${tab === 'ready' ? 'btn-success' : 'btn-secondary'}`}
            style={{ padding: '10px 22px', fontSize: '.92rem' }}
          >
            <CheckCircle2 size={16} /> Ready for Pickup ({readyOrders.length})
          </button>
          <button
            onClick={() => setTab('history')}
            className={`btn ${tab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '10px 22px', fontSize: '.92rem' }}
          >
            <Clock size={16} /> Served Today ({historyOrders.length})
          </button>
        </div>

        {/* Tickets Grid */}
        {!displayedOrders.length ? (
          <div className="card" style={{ textAlign: 'center', padding: '64px 20px' }}>
            <UtensilsCrossed size={48} style={{ color: '#cbd5e1', margin: '0 auto 12px' }} />
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>All Cooking Tickets Cleared!</h3>
            <p style={{ color: '#64748b', fontSize: '.9rem', margin: '6px 0 16px' }}>
              No orders waiting in this queue. New customer orders will ring here automatically.
            </p>
            <button onClick={loadOrders} className="btn btn-secondary btn-sm">
              <RefreshCw size={14} /> Refresh KDS
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 18 }}>
            {displayedOrders.map((ord) => {
              const minutes = getTimerMinutes(ord.created_at);
              const isUrgent = minutes >= 18;
              const isMedium = minutes >= 10 && minutes < 18;
              const isPreparing = ord.status === 'preparing';
              const isReady = ord.status === 'ready';

              return (
                <div
                  key={ord.id}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    border: isReady
                      ? '2px solid #10b981'
                      : isUrgent
                      ? '2px solid #ef4444'
                      : isPreparing
                      ? '2px solid #2563eb'
                      : '2px solid #f59e0b',
                    boxShadow: isUrgent
                      ? '0 6px 20px rgba(239, 68, 68, 0.18)'
                      : isReady
                      ? '0 6px 20px rgba(16, 185, 129, 0.12)'
                      : '0 2px 8px rgba(0,0,0,0.04)',
                    padding: 22,
                  }}
                >
                  <div>
                    {/* Header: Table Number & Timer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: 14, marginBottom: 14 }}>
                      <div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
                          TABLE {ord.table_number.toUpperCase()}
                        </div>
                        <div style={{ color: '#2563eb', fontWeight: 800, fontSize: '1rem', marginTop: 2 }}>
                          Order #{ord.order_number}
                        </div>
                        {ord.waiter_name && (
                          <div style={{ fontSize: '.84rem', color: '#7c3aed', fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Users size={14} /> Server: {ord.waiter_name}
                          </div>
                        )}
                      </div>

                      {/* Timer Badge */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          borderRadius: 10,
                          fontWeight: 800,
                          fontSize: '.95rem',
                          background: isUrgent ? '#fee2e2' : isMedium ? '#fef3c7' : '#f1f5f9',
                          color: isUrgent ? '#b91c1c' : isMedium ? '#b45309' : '#334155',
                          border: `1px solid ${isUrgent ? '#fca5a5' : isMedium ? '#fde68a' : '#e2e8f0'}`,
                        }}
                      >
                        <Clock size={16} /> {minutes} min
                      </div>
                    </div>

                    {/* Special Preparation Note */}
                    {ord.notes && (
                      <div
                        style={{
                          background: '#fffbeb',
                          border: '1px solid #fde68a',
                          borderRadius: 10,
                          padding: '8px 12px',
                          marginBottom: 14,
                          fontSize: '.86rem',
                          color: '#b45309',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <AlertTriangle size={16} /> SPECIAL: {ord.notes}
                      </div>
                    )}

                    {/* Items Checklist */}
                    <div style={{ marginBottom: 16 }}>
                      {ord.items?.map((it, idx) => {
                        const isChecked = !!checkedItems[`${ord.id}_${idx}`];

                        return (
                          <div
                            key={idx}
                            onClick={() => toggleItemCheck(ord.id, idx)}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 12,
                              padding: '10px 0',
                              borderBottom: '1px dashed #f1f5f9',
                              cursor: 'pointer',
                              opacity: isChecked ? 0.45 : 1,
                              transition: 'opacity 0.15s ease',
                            }}
                          >
                            <span
                              style={{
                                background: '#2563eb',
                                color: '#ffffff',
                                fontWeight: 800,
                                fontSize: '.9rem',
                                padding: '2px 8px',
                                borderRadius: 6,
                                flexShrink: 0,
                                marginTop: 2,
                              }}
                            >
                              {it.qty}x
                            </span>

                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: isChecked ? '#94a3b8' : '#0f172a', textDecoration: isChecked ? 'line-through' : 'none' }}>
                                {it.name}
                                {it.name_am && (
                                  <span style={{ fontSize: '.88rem', color: '#64748b', fontWeight: 600, marginLeft: 8 }}>
                                    ({it.name_am})
                                  </span>
                                )}
                              </div>
                              {it.notes && (
                                <div style={{ fontSize: '.8rem', color: '#d97706', fontWeight: 600, marginTop: 2 }}>
                                  Prep Note: {it.notes}
                                </div>
                              )}
                            </div>

                            <span style={{ color: isChecked ? '#10b981' : '#cbd5e1', marginTop: 4 }}>
                              {isChecked ? <CheckSquare size={20} /> : <Square size={20} />}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Chef Action Buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                    {ord.status === 'confirmed' && (
                      <button
                        onClick={() => handleStartCooking(ord.id)}
                        className="btn btn-primary"
                        style={{ padding: '14px', fontSize: '1rem', fontWeight: 800 }}
                      >
                        <Flame size={18} /> Accept & Start Cooking
                      </button>
                    )}

                    {ord.status === 'preparing' && (
                      <button
                        onClick={() => handleMarkReady(ord.id)}
                        className="btn btn-success"
                        style={{ padding: '14px', fontSize: '1.05rem', fontWeight: 800 }}
                      >
                        <CheckCircle2 size={18} /> Plated & Ready for Table!
                      </button>
                    )}

                    {ord.status === 'ready' && (
                      <button
                        onClick={() => handleCompleteOrder(ord.id)}
                        className="btn btn-primary"
                        style={{ padding: '12px', fontSize: '1rem', fontWeight: 700 }}
                      >
                        <CheckCircle2 size={18} /> Food Picked Up / Served
                      </button>
                    )}

                    {ord.status === 'completed' && (
                      <button onClick={() => handleRecallOrder(ord.id)} className="btn btn-secondary btn-sm">
                        <RotateCcw size={14} /> Recall Back to Active Queue
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

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
