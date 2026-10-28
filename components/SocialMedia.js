'use client';
import React from 'react';

// Crisp, lightweight vector SVGs for all contact and social platforms
export const ICONS = {
  phone: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
      <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1.02l-2.2 2.2z" />
    </svg>
  ),
  telegram: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
    </svg>
  ),
  whatsapp: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 012.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 01-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24M8.53 7.33c-.16 0-.35.06-.53.27-.18.21-.69.67-.69 1.63 0 .96.7 1.89.8 2.02.1.13 1.37 2.1 3.32 2.94.46.2.83.33 1.11.42.47.15.89.13 1.22.08.38-.06 1.15-.47 1.31-.93.16-.46.16-.85.11-.93-.05-.08-.18-.13-.37-.23-.19-.1-1.15-.57-1.33-.63-.18-.06-.31-.1-.44.1-.13.19-.51.63-.62.76-.11.13-.23.15-.42.05-.19-.1-.8-.3-1.53-.94-.57-.51-.95-1.13-1.06-1.33-.11-.19-.01-.3.08-.39.09-.08.19-.23.29-.34.1-.11.13-.19.19-.31.06-.13.03-.24-.01-.34-.05-.1-.44-1.06-.6-1.45-.16-.39-.32-.33-.44-.34h-.38z" />
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.88 2.89 2.89 0 01-2.88-2.88 2.89 2.89 0 012.88-2.88c.28 0 .54.04.79.11V9.41a6.34 6.34 0 00-.79-.05 6.33 6.33 0 00-6.33 6.33 6.33 6.33 0 006.33 6.33 6.33 6.33 0 006.33-6.33V8.89a8.28 8.28 0 004.97 1.63v-3.5a4.85 4.85 0 01-1.2-.33z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  map_url: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z" />
    </svg>
  ),
  email: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
    </svg>
  ),
  website: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
    </svg>
  ),
};

// Colors for brand identity
export const BRAND_COLORS = {
  phone: '#10b981',
  telegram: '#229ED9',
  whatsapp: '#25D366',
  tiktok: '#ff0050',
  instagram: '#E1306C',
  facebook: '#1877F2',
  youtube: '#FF0000',
  twitter: '#f6f3ea',
  map_url: '#EA4335',
  email: '#F59E0B',
  website: '#3B82F6',
};

// URL formatter helpers
export function formatSocialUrl(key, raw) {
  if (!raw) return '';
  const val = raw.trim();

  if (key === 'phone') {
    return 'tel:' + val.replace(/[^+\d]/g, '');
  }
  if (key === 'email') {
    return val.startsWith('mailto:') ? val : `mailto:${val}`;
  }
  if (key === 'whatsapp') {
    const cleanNum = val.replace(/[^+\d]/g, '');
    return val.startsWith('http') ? val : `https://wa.me/${cleanNum}`;
  }
  if (key === 'telegram') {
    if (val.startsWith('http')) return val;
    const user = val.replace(/^@/, '');
    return `https://t.me/${user}`;
  }
  if (key === 'tiktok') {
    if (val.startsWith('http')) return val;
    const user = val.startsWith('@') ? val : `@${val}`;
    return `https://www.tiktok.com/${user}`;
  }
  if (key === 'instagram') {
    if (val.startsWith('http')) return val;
    const user = val.replace(/^@/, '');
    return `https://www.instagram.com/${user}`;
  }
  if (key === 'facebook') {
    if (val.startsWith('http')) return val;
    return `https://www.facebook.com/${val}`;
  }
  if (key === 'youtube') {
    if (val.startsWith('http')) return val;
    return `https://www.youtube.com/${val.startsWith('@') ? val : '@' + val}`;
  }
  if (key === 'twitter') {
    if (val.startsWith('http')) return val;
    const user = val.replace(/^@/, '');
    return `https://x.com/${user}`;
  }
  if (key === 'website' || key === 'map_url') {
    if (!val.startsWith('http://') && !val.startsWith('https://')) {
      return `https://${val}`;
    }
    return val;
  }
  return val;
}

export const LABELS = {
  en: {
    phone: 'Call Us',
    telegram: 'Telegram',
    whatsapp: 'WhatsApp',
    tiktok: 'TikTok',
    instagram: 'Instagram',
    facebook: 'Facebook',
    youtube: 'YouTube',
    twitter: 'X (Twitter)',
    map_url: 'Find on Map',
    email: 'Email Us',
    website: 'Website',
    connectTitle: 'Connect & Follow Us',
  },
  am: {
    phone: 'ይደውሉልን',
    telegram: 'ቴሌግራም',
    whatsapp: 'ዋትስአፕ',
    tiktok: 'ቲክቶክ',
    instagram: 'ኢንስታግራም',
    facebook: 'ፌስቡክ',
    youtube: 'ዩቲዩብ',
    twitter: 'ኤክስ (ትዊተር)',
    map_url: 'አድራሻ በካርታ',
    email: 'ኢሜይል',
    website: 'ድህረ ገጽ',
    connectTitle: 'ማህበራዊ ገጾቻችንን ይጎብኙ',
  },
};

export default function SocialMediaBar({ settings = {}, lang = 'en' }) {
  const L = LABELS[lang] || LABELS.en;

  const activeChannels = [
    { key: 'phone', val: settings.phone },
    { key: 'telegram', val: settings.telegram },
    { key: 'whatsapp', val: settings.whatsapp },
    { key: 'tiktok', val: settings.tiktok },
    { key: 'instagram', val: settings.instagram },
    { key: 'facebook', val: settings.facebook },
    { key: 'youtube', val: settings.youtube },
    { key: 'twitter', val: settings.twitter },
    { key: 'map_url', val: settings.map_url },
    { key: 'email', val: settings.email },
    { key: 'website', val: settings.website },
  ].filter((c) => c.val && c.val.trim().length > 0);

  if (!activeChannels.length) return null;

  return (
    <div style={{ marginTop: 28, paddingTop: 18, borderTop: '1px solid var(--bd)' }}>
      <h4
        style={{
          margin: '0 0 14px',
          fontSize: '1rem',
          color: 'var(--tx)',
          textAlign: 'center',
          fontWeight: 700,
          letterSpacing: '.3px',
        }}
      >
        ✨ {L.connectTitle}
      </h4>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {activeChannels.map(({ key, val }) => {
          const href = formatSocialUrl(key, val);
          const icon = ICONS[key];
          const color = BRAND_COLORS[key] || 'var(--o)';
          const label = L[key] || key;

          return (
            <a
              key={key}
              href={href}
              target={key === 'phone' || key === 'email' ? undefined : '_blank'}
              rel="noreferrer"
              aria-label={label}
              title={label}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--card-subtle)',
                border: '1px solid var(--bd)',
                color: color,
                textDecoration: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px) scale(1.08)';
                e.currentTarget.style.borderColor = color;
                e.currentTarget.style.boxShadow = `0 8px 20px ${color}33`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.borderColor = 'var(--bd)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.18)';
              }}
            >
              {icon}
            </a>
          );
        })}
      </div>
    </div>
  );
}
