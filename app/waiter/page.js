'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  Plus,
  Volume2,
  VolumeX,
  ShieldCheck,
  LogOut,
  Flame,
  ShoppingBag,
  AlertTriangle,
  UtensilsCrossed,
  X,
  Check,
  Search,
} from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState('ready'); // 'ready', 'preparing', 'completed'
  const [now, setNow] = useState(Date.now());

  // Waiter Taking Table Order POS state
  const [showPOS, setShowPOS] = useState(false);
  const [posTable, setPosTable] = useState('');
  const [posCustomer, setPosCustomer] = useState('');
  const [posNotes, setPosNotes] = useState('');
  const [posItems, setPosItems] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [posBusy, setPosBusy] = useState(false);
  const [dishSearch, setDishSearch] = useState('');

  // Check auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

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
    const waiterIdentity = session.user?.user_metadata?.full_name || session.user?.email?.split('@')[0] || 'Waiter';
    const result = await createOrder({
      table_number: posTable.trim(),
      customer_name: posCustomer.trim() || 'Waiter Order',
      items: posItems,
      total: posTotal,
      payment_method: 'cash',
      payment_status: 'pending',
      status: 'confirmed', // Sent straight to kitchen
      waiter_name: waiterIdentity,
      notes: posNotes.trim() || `Order taken by ${waiterIdentity}`,
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
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ width: 44, height: 44, border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Royal Hotel Waiter Desk</h3>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: '.88rem' }}>Authenticating server terminal...</p>
        </div>
      </main>
    );
  }

  // 2. Authentication Screen
  if (!session) {
    return (
      <StaffLoginForm
        title={lang === 'am' ? 'የአስተናጋጅ ገጽ መግቢያ' : 'Waiter Service Desk Sign In'}
        subtitle={
          lang === 'am'
            ? 'በሆቴሉ ስራ አስኪያጅ የተሰጠዎትን መለያ ያስገቡ'
            : 'Sign in with your staff account created by the manager'
        }
        icon={<Users size={28} color="#2563eb" />}
        lang={lang}
        onLangChange={setLang}
        onLoginSuccess={(s) => setSession(s)}
      />
    );
  }

  const waiterName = session.user?.user_metadata?.full_name || session.user?.email?.split('@')[0] || 'Waiter';

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a' }}>
      {/* Top Header */}
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
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#7c3aed', display: 'grid', placeItems: 'center', color: '#ffffff' }}>
            <Users size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                {lang === 'am' ? 'የአስተናጋጅ አገልግሎት ገጽ' : 'Waiter Service Terminal'}
              </h1>
              <span style={{ fontSize: '.68rem', background: '#10b981', color: '#ffffff', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>
                ● ON DUTY
              </span>
            </div>
            <span style={{ fontSize: '.76rem', color: '#94a3b8' }}>
              Server: <b>{waiterName}</b> ({session.user?.email})
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowPOS(true)}
            className="btn btn-primary btn-sm"
          >
            <Plus size={15} /> {lang === 'am' ? 'አዲስ የጠረጴዛ ትዕዛዝ' : 'New Table Order'}
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="btn btn-secondary btn-sm"
            style={{ background: soundEnabled ? '#eff6ff' : '#ffffff', color: soundEnabled ? '#2563eb' : '#64748b' }}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            {soundEnabled ? 'Chime ON' : 'Muted'}
          </button>

          <button onClick={() => setShowSecurityModal(true)} className="btn btn-secondary btn-sm" title="2FA & Password">
            <ShieldCheck size={15} /> Security
          </button>

          <button
            onClick={() => setLang(lang === 'am' ? 'en' : 'am')}
            className="btn btn-secondary btn-sm"
          >
            {lang === 'am' ? 'English' : 'አማርኛ'}
          </button>

          <button onClick={handleSignOut} className="btn btn-danger btn-sm">
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </header>

      {/* Main Waiter Workspace */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('ready')}
            className={`btn ${activeTab === 'ready' ? 'btn-success' : 'btn-secondary'}`}
            style={{ flex: '1 1 200px', justifyContent: 'space-between', padding: '12px 18px', fontSize: '.92rem' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UtensilsCrossed size={16} />
              {lang === 'am' ? 'ለመቅረብ የተዘጋጁ ምግቦች' : 'Ready to Serve'}
            </span>
            <span style={{ background: readyOrders.length > 0 ? '#b91c1c' : 'rgba(0,0,0,0.08)', color: '#fff', fontSize: '.75rem', padding: '2px 8px', borderRadius: 999, fontWeight: 800 }}>
              {readyOrders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('preparing')}
            className={`btn ${activeTab === 'preparing' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: '1 1 200px', justifyContent: 'space-between', padding: '12px 18px', fontSize: '.92rem' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Flame size={16} />
              {lang === 'am' ? 'በኩሽና በመዘጋጀት ላይ' : 'Cooking in Kitchen'}
            </span>
            <span className="badge badge-blue">
              {preparingOrders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`btn ${activeTab === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: '1 1 200px', justifyContent: 'space-between', padding: '12px 18px', fontSize: '.92rem' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={16} />
              {lang === 'am' ? 'የተስተናገዱ' : 'Served History'}
            </span>
            <span className="badge badge-gray">
              {recentCompleted.length}
            </span>
          </button>
        </div>

        {/* 1. READY TO SERVE ORDERS */}
        {activeTab === 'ready' && (
          <div>
            {readyOrders.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
                <CheckCircle2 size={48} style={{ color: '#10b981', margin: '0 auto 12px' }} />
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>
                  {lang === 'am' ? 'ሁሉም ምግቦች ለደንበኛ ደርሰዋል!' : 'All orders served to tables!'}
                </h3>
                <p style={{ color: '#64748b', fontSize: '.88rem', margin: '6px 0 0' }}>
                  {lang === 'am'
                    ? 'ኩሽናው ምግብ አዘጋጅቶ ሲያጠናቅቅ እዚህ ላይ ወዲያውኑ ይታያል።'
                    : 'As soon as the kitchen marks an order ready, it will ring and appear here for pickup.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {readyOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="card"
                    style={{
                      border: '2px solid #10b981',
                      boxShadow: '0 6px 20px rgba(16, 185, 129, 0.15)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      padding: 20,
                    }}
                  >
                    <div>
                      {/* Card Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: 12, marginBottom: 12 }}>
                        <div>
                          <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#0f172a' }}>
                            TABLE {ord.table_number.toUpperCase()}
                          </div>
                          <div style={{ fontSize: '.84rem', color: '#64748b' }}>
                            Order #{ord.order_number} {ord.customer_name ? `• ${ord.customer_name}` : ''}
                          </div>
                          {ord.waiter_name && (
                            <div style={{ fontSize: '.8rem', color: '#7c3aed', fontWeight: 700, marginTop: 2 }}>
                              Server: {ord.waiter_name}
                            </div>
                          )}
                        </div>

                        <span className="badge badge-green" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} /> {getElapsed(ord.updated_at || ord.created_at)}
                        </span>
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
                                borderBottom: '1px solid #f8fafc',
                                fontSize: '.95rem',
                              }}
                            >
                              <span>
                                <b style={{ color: '#2563eb', marginRight: 6 }}>{it.quantity}x</b>
                                {lang === 'am' && it.name_am ? it.name_am : it.name}
                              </span>
                              {it.notes && (
                                <span className="badge badge-amber" style={{ fontSize: '.72rem' }}>
                                  {it.notes}
                                </span>
                              )}
                            </div>
                          ))}
                      </div>

                      {ord.notes && (
                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 10px', fontSize: '.82rem', color: '#b45309', marginBottom: 14 }}>
                          Note: {ord.notes}
                        </div>
                      )}
                    </div>

                    {/* Mark Delivered Action */}
                    <button
                      onClick={() => handleMarkServed(ord.id)}
                      className="btn btn-success"
                      style={{ width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 800 }}
                    >
                      <CheckCircle2 size={18} /> {lang === 'am' ? 'ለደንበኛ ደርሷል (አጠናቅቅ)' : 'Delivered to Table (Complete)'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. PREPARING IN KITCHEN */}
        {activeTab === 'preparing' && (
          <div>
            {preparingOrders.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '48px 20px' }}>
                <Clock size={40} style={{ color: '#cbd5e1', margin: '0 auto 10px' }} />
                <p style={{ color: '#64748b', margin: 0 }}>
                  {lang === 'am'
                    ? 'በአሁኑ ሰዓት በኩሽና በመዘጋጀት ላይ ያለ ምግብ የለም።'
                    : 'No orders are actively cooking in the kitchen right now.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 14 }}>
                {preparingOrders.map((ord) => (
                  <div key={ord.id} className="card" style={{ borderLeft: '4px solid #2563eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <b style={{ color: '#0f172a', fontSize: '1.15rem' }}>
                        TABLE {ord.table_number}
                      </b>
                      <span className="badge badge-blue">
                        <Flame size={12} /> Cooking ({getElapsed(ord.updated_at)})
                      </span>
                    </div>

                    <div style={{ fontSize: '.88rem', color: '#334155' }}>
                      {Array.isArray(ord.items) &&
                        ord.items.map((it, idx) => (
                          <div key={idx} style={{ padding: '3px 0' }}>
                            <b style={{ color: '#2563eb' }}>{it.quantity}x</b>{' '}
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
          <div className="card" style={{ padding: 22 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem' }}>
              {lang === 'am' ? 'በቅርብ የተስተናገዱ ትዕዛዞች' : 'Recently Served Orders'}
            </h3>
            {recentCompleted.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#64748b', padding: '24px 0' }}>
                {lang === 'am' ? 'ምንም አልተገኘም' : 'No orders served yet'}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recentCompleted.map((ord) => (
                  <div
                    key={ord.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      background: '#f8fafc',
                      borderRadius: 12,
                      border: '1px solid #f1f5f9',
                    }}
                  >
                    <div>
                      <b style={{ color: '#0f172a' }}>Table {ord.table_number}</b>{' '}
                      <span style={{ color: '#64748b', fontSize: '.84rem' }}>
                        (#{ord.order_number})
                      </span>
                      <div style={{ fontSize: '.82rem', color: '#64748b', marginTop: 2 }}>
                        {Array.isArray(ord.items)
                          ? ord.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')
                          : ''}
                      </div>
                    </div>
                    <span className="badge badge-green">
                      <Check size={12} /> {lang === 'am' ? 'ተስተናግዷል' : 'Served'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 4. WAITER POS MODAL (Take Table Order on the fly) */}
      {showPOS && (
        <div className="modal-backdrop" onClick={() => setShowPOS(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Plus size={20} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                  {lang === 'am' ? 'አዲስ የጠረጴዛ ትዕዛዝ ውሰድ' : 'Take Table Order'}
                </h3>
              </div>
              <button onClick={() => setShowPOS(false)} className="btn btn-ghost btn-sm" style={{ padding: 6 }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateWaiterOrder}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    {lang === 'am' ? 'የጠረጴዛ ቁጥር *' : 'Table Number *'}
                  </label>
                  <input
                    required
                    placeholder="e.g. 5"
                    value={posTable}
                    onChange={(e) => setPosTable(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    {lang === 'am' ? 'የደንበኛ ስም (አማራጭ)' : 'Customer Name (Optional)'}
                  </label>
                  <input
                    placeholder="e.g. Guest"
                    value={posCustomer}
                    onChange={(e) => setPosCustomer(e.target.value)}
                  />
                </div>
              </div>

              {/* Dish Selection Grid */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  {lang === 'am' ? 'ምግቦችን ይምረጡ' : 'Select Dishes from Menu'}
                </label>
                <div
                  style={{
                    maxHeight: 180,
                    overflowY: 'auto',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: 8,
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
                        padding: '8px 12px',
                        background: '#f8fafc',
                        borderRadius: 8,
                        border: '1px solid #f1f5f9',
                      }}
                    >
                      <span style={{ fontSize: '.88rem', fontWeight: 600, color: '#0f172a' }}>
                        {lang === 'am' && dish.name_am ? dish.name_am : dish.name} -{' '}
                        <b style={{ color: '#2563eb' }}>{dish.price} ETB</b>
                      </span>
                      <button
                        type="button"
                        onClick={() => addPosItem(dish)}
                        className="btn btn-primary btn-sm"
                        style={{ padding: '4px 10px' }}
                      >
                        + Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Cart */}
              {posItems.length > 0 && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, marginBottom: 14 }}>
                  <b style={{ fontSize: '.88rem', display: 'block', marginBottom: 8, color: '#0f172a' }}>
                    {lang === 'am' ? 'የተመረጡ ምግቦች:' : 'Selected Items:'}
                  </b>
                  {posItems.map((item) => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: '.86rem' }}>
                      <span>
                        {item.name} ({item.price} ETB)
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button type="button" onClick={() => removePosItem(item.id)} className="btn btn-secondary btn-sm" style={{ padding: '2px 8px' }}>
                          -
                        </button>
                        <b>{item.quantity}</b>
                        <button type="button" onClick={() => addPosItem(item)} className="btn btn-secondary btn-sm" style={{ padding: '2px 8px' }}>
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.1rem' }}>
                    <span>Total:</span>
                    <span style={{ color: '#2563eb' }}>{posTotal.toLocaleString()} ETB</span>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <input
                  placeholder={lang === 'am' ? 'ልዩ ማስታወሻ...' : 'Kitchen notes (e.g. no pepper)'}
                  value={posNotes}
                  onChange={(e) => setPosNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setShowPOS(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                  {lang === 'am' ? 'ሰርዝ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={posBusy || posItems.length === 0}
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                >
                  {posBusy ? 'Submitting...' : lang === 'am' ? 'ትዕዛዙን ወደ ኩሽና ላክ' : 'Send to Kitchen & Cashier'}
                </button>
              </div>
            </form>
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
