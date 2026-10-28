import { supabase } from './supabase';
import { TRANSLATIONS } from './translations';

const CHANNEL_NAME = 'hiraga_orders_sync';
const LOCAL_STORAGE_KEY = 'hiraga_local_orders';

// In-memory / Cross-tab Broadcast Channel
let broadcastChannel = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  } catch (e) {
    console.warn('BroadcastChannel not supported', e);
  }
}

// Local cache helper
function getLocalOrders() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalOrders(orders) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(orders));
    if (broadcastChannel) {
      broadcastChannel.postMessage({ type: 'ORDER_SYNC', orders });
    }
  } catch (e) {
    console.warn('Failed to save local orders', e);
  }
}

// Shrink receipt image before upload
export function shrinkImage(file, maxDimension = 900) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/jpeg',
        0.82
      );
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

// Convert blob to DataURL fallback
export function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

// Upload screenshot to Supabase storage or return data URL
export async function uploadReceiptScreenshot(file) {
  if (!file) return null;
  const optimizedBlob = await shrinkImage(file, 1000);
  const fileName = `receipt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`;

  try {
    const { data, error } = await supabase.storage
      .from('receipts')
      .upload(fileName, optimizedBlob, { contentType: 'image/jpeg' });

    if (!error && data?.path) {
      const pub = supabase.storage.from('receipts').getPublicUrl(fileName);
      return pub.data.publicUrl;
    }
  } catch (err) {
    console.warn('Supabase storage upload failed, falling back to data URL:', err);
  }

  // Fallback to data URL if bucket is not created yet
  return await blobToDataUrl(optimizedBlob);
}

// Generate next order number
export function generateOrderNumber() {
  const num = Math.floor(100 + Math.random() * 900);
  return `#${num}`;
}

// Fetch all orders
export async function fetchOrders() {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      // Merge with any local orders not yet synced
      return data;
    }
  } catch (err) {
    console.warn('Supabase fetchOrders failed, using local store:', err);
  }

  // Fallback to local store
  return getLocalOrders();
}

// Fetch single order
export async function fetchOrderById(id) {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!error && data) return data;
  } catch (err) {
    console.warn('Supabase fetchOrderById failed:', err);
  }

  // Fallback local
  const locals = getLocalOrders();
  return locals.find((o) => String(o.id) === String(id)) || null;
}

// Create new order
export async function createOrder(orderPayload) {
  const newOrder = {
    order_number: orderPayload.order_number || generateOrderNumber(),
    table_number: String(orderPayload.table_number || 'General'),
    customer_name: orderPayload.customer_name?.trim() || null,
    customer_phone: orderPayload.customer_phone?.trim() || null,
    items: orderPayload.items || [],
    total: Number(orderPayload.total) || 0,
    payment_method: orderPayload.payment_method || 'cash',
    payment_status: orderPayload.payment_status || 'pending',
    transaction_ref: orderPayload.transaction_ref?.trim() || null,
    screenshot_url: orderPayload.screenshot_url || null,
    status: orderPayload.status || (orderPayload.payment_method === 'cash' ? 'pending_payment' : 'pending_payment'),
    notes: orderPayload.notes?.trim() || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('orders')
      .insert([newOrder])
      .select();

    if (!error && data && data[0]) {
      // Update local storage too
      const local = getLocalOrders();
      saveLocalOrders([data[0], ...local.filter((o) => o.id !== data[0].id)]);
      return { ok: true, order: data[0] };
    }
  } catch (err) {
    console.warn('Supabase createOrder failed, storing locally:', err);
  }

  // Fallback to local store with pseudo-id
  const localOrder = {
    ...newOrder,
    id: Date.now(),
  };
  const local = getLocalOrders();
  const updated = [localOrder, ...local];
  saveLocalOrders(updated);
  return { ok: true, order: localOrder };
}

// Update order status or fields
export async function updateOrder(id, patch) {
  const patchWithTime = {
    ...patch,
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('orders')
      .update(patchWithTime)
      .eq('id', id)
      .select();

    if (!error && data && data[0]) {
      const local = getLocalOrders();
      saveLocalOrders(local.map((o) => (String(o.id) === String(id) ? data[0] : o)));
      return { ok: true, order: data[0] };
    }
  } catch (err) {
    console.warn('Supabase updateOrder failed, updating locally:', err);
  }

  // Fallback local update
  const local = getLocalOrders();
  let updatedOrder = null;
  const updated = local.map((o) => {
    if (String(o.id) === String(id)) {
      updatedOrder = { ...o, ...patchWithTime };
      return updatedOrder;
    }
    return o;
  });
  saveLocalOrders(updated);
  return { ok: true, order: updatedOrder };
}

// Real-time listener for orders across tabs / Supabase
export function subscribeToOrders(callback) {
  let sub = null;

  // 1. Supabase Realtime channel
  try {
    sub = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          callback({ event: payload.eventType, order: payload.new, old: payload.old });
        }
      )
      .subscribe();
  } catch (err) {
    console.warn('Supabase realtime subscription failed:', err);
  }

  // 2. BroadcastChannel cross-tab listener (instant multi-tab synchronization on same browser)
  const onBroadcast = (e) => {
    if (e.data && e.data.type === 'ORDER_SYNC') {
      callback({ event: 'SYNC', orders: e.data.orders });
    }
  };

  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', onBroadcast);
  }

  // 3. Storage event listener for cross-window fallback
  const onStorage = (e) => {
    if (e.key === LOCAL_STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        callback({ event: 'SYNC', orders: parsed });
      } catch {}
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }

  // Unsubscribe function
  return () => {
    if (sub) {
      supabase.removeChannel(sub);
    }
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', onBroadcast);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}

// Status definitions & helper translations
export const ORDER_STATUSES = {
  pending_payment: {
    key: 'pending_payment',
    en: TRANSLATIONS.status_pending_payment.en,
    am: TRANSLATIONS.status_pending_payment.am,
    badge: 'Pending Payment',
    color: '#f59e0b',
    step: 1,
  },
  confirmed: {
    key: 'confirmed',
    en: TRANSLATIONS.status_confirmed.en,
    am: TRANSLATIONS.status_confirmed.am,
    badge: 'Confirmed',
    color: '#3b82f6',
    step: 2,
  },
  preparing: {
    key: 'preparing',
    en: TRANSLATIONS.status_preparing.en,
    am: TRANSLATIONS.status_preparing.am,
    badge: 'In Kitchen',
    color: '#a855f7',
    step: 3,
  },
  ready: {
    key: 'ready',
    en: TRANSLATIONS.status_ready.en,
    am: TRANSLATIONS.status_ready.am,
    badge: 'Ready',
    color: '#10b981',
    step: 4,
  },
  completed: {
    key: 'completed',
    en: TRANSLATIONS.status_completed.en,
    am: TRANSLATIONS.status_completed.am,
    badge: 'Completed',
    color: '#6b7280',
    step: 5,
  },
  cancelled: {
    key: 'cancelled',
    en: TRANSLATIONS.status_cancelled.en,
    am: TRANSLATIONS.status_cancelled.am,
    badge: 'Cancelled',
    color: '#ef4444',
    step: 0,
  },
};
