'use client';
import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  KeyRound,
  QrCode,
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  X,
  Eye,
  EyeOff,
  Mail,
  Trash2,
  Lock,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getDictionary } from '../lib/translations';

export default function StaffSecurityModal({ isOpen, onClose, session, lang = 'am' }) {
  const T = getDictionary(lang);
  const [activeTab, setActiveTab] = useState('password'); // 'password' or '2fa'

  // Change Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busyPw, setBusyPw] = useState(false);
  const [pwMsg, setPwMsg] = useState({ text: '', bad: false });

  // 2FA state
  const [mfaFactors, setMfaFactors] = useState([]);
  const [loadingMfa, setLoadingMfa] = useState(false);
  const [enrollingFactor, setEnrollingFactor] = useState(null); // { id, totp: { qr_code, secret, uri } }
  const [otpCode, setOtpCode] = useState('');
  const [busyMfa, setBusyMfa] = useState(false);
  const [mfaMsg, setMfaMsg] = useState({ text: '', bad: false });
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Email OTP test state
  const [busyEmailOtp, setBusyEmailOtp] = useState(false);
  const [emailOtpSent, setEmailOtpSent] = useState(false);

  // Load existing MFA factors when modal opens
  const loadMfaFactors = async () => {
    try {
      setLoadingMfa(true);
      const { data, error } = await supabase.auth.mfa.listFactors();
      setLoadingMfa(false);
      if (!error && data) {
        setMfaFactors(data.totp || []);
      }
    } catch (e) {
      setLoadingMfa(false);
      console.warn('Failed to load MFA factors:', e);
    }
  };

  useEffect(() => {
    if (isOpen && session) {
      loadMfaFactors();
      setPwMsg({ text: '', bad: false });
      setMfaMsg({ text: '', bad: false });
      setEnrollingFactor(null);
      setOtpCode('');
    }
  }, [isOpen, session]);

  if (!isOpen || !session) return null;

  // Handle password change
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPwMsg({ text: '', bad: false });

    if (newPassword.length < 6) {
      setPwMsg({
        text: lang === 'am' ? 'የይለፍ ቃል ቢያንስ 6 ፊደላት መሆን አለበት።' : 'Password must be at least 6 characters.',
        bad: true,
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwMsg({ text: T.passwordMismatch, bad: true });
      return;
    }

    setBusyPw(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    setBusyPw(false);

    if (error) {
      setPwMsg({ text: error.message, bad: true });
    } else {
      setPwMsg({ text: T.passwordSuccess, bad: false });
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  // Start Google Authenticator enrollment
  const startMfaEnrollment = async () => {
    setBusyMfa(true);
    setMfaMsg({ text: '', bad: false });
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'Royal Hotel',
      });
      setBusyMfa(false);
      if (error) {
        setMfaMsg({ text: error.message, bad: true });
      } else {
        setEnrollingFactor(data);
      }
    } catch (err) {
      setBusyMfa(false);
      setMfaMsg({ text: err.message, bad: true });
    }
  };

  // Confirm and activate Google Authenticator
  const confirmMfaEnrollment = async (e) => {
    e.preventDefault();
    if (!enrollingFactor || !otpCode.trim()) return;

    setBusyMfa(true);
    setMfaMsg({ text: '', bad: false });
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollingFactor.id,
        code: otpCode.trim(),
      });
      setBusyMfa(false);

      if (error) {
        setMfaMsg({
          text: lang === 'am' ? 'የተሳሳተ ኮድ ነው። እባክዎ እንደገና ይሞክሩ።' : 'Invalid code. Please try again.',
          bad: true,
        });
      } else {
        setMfaMsg({
          text: lang === 'am' ? '✓ ጎግል ኦተንቲኬተር በተሳካ ሁኔታ በርቷል!' : '✓ Google Authenticator successfully activated!',
          bad: false,
        });
        setEnrollingFactor(null);
        setOtpCode('');
        loadMfaFactors();
      }
    } catch (err) {
      setBusyMfa(false);
      setMfaMsg({ text: err.message, bad: true });
    }
  };

  // Unenroll / Disable 2FA
  const handleDisableMfa = async (factorId) => {
    if (
      !window.confirm(
        lang === 'am'
          ? 'ባለ ሁለት ደረጃ ማረጋገጫን ማጥፋት እርግጠኛ ነዎት?'
          : 'Are you sure you want to disable 2-Factor Authentication?'
      )
    )
      return;

    setBusyMfa(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      setBusyMfa(false);
      if (error) {
        setMfaMsg({ text: error.message, bad: true });
      } else {
        setMfaMsg({
          text: lang === 'am' ? '2FA ጠፍቷል።' : '2FA has been disabled.',
          bad: false,
        });
        loadMfaFactors();
      }
    } catch (err) {
      setBusyMfa(false);
      setMfaMsg({ text: err.message, bad: true });
    }
  };

  // Copy secret key
  const copySecret = (text) => {
    navigator.clipboard?.writeText(text);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2500);
  };

  // Test sending an Email OTP
  const handleTestEmailOtp = async () => {
    setBusyEmailOtp(true);
    setEmailOtpSent(false);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: session.user.email,
        options: { shouldCreateUser: false },
      });
      setBusyEmailOtp(false);
      if (!error) {
        setEmailOtpSent(true);
      }
    } catch (e) {
      setBusyEmailOtp(false);
      console.warn(e);
    }
  };

  const hasActiveTotp = mfaFactors.some((f) => f.status === 'verified');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={22} color="#2563eb" /> {T.securitySettings}
            </h3>
            <div style={{ fontSize: '.8rem', color: '#64748b' }}>
              {session.user?.email} • <b style={{ color: '#2563eb' }}>{session.user?.user_metadata?.role?.toUpperCase() || 'STAFF'}</b>
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: 6 }}>
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, background: '#f1f5f9', padding: 4, borderRadius: 12 }}>
          <button
            type="button"
            onClick={() => setActiveTab('password')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'password' ? '#ffffff' : 'transparent',
              color: activeTab === 'password' ? '#0f172a' : '#64748b',
              fontWeight: 700,
              fontSize: '.84rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'password' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <KeyRound size={15} /> {T.changePassword}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('2fa')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === '2fa' ? '#ffffff' : 'transparent',
              color: activeTab === '2fa' ? '#0f172a' : '#64748b',
              fontWeight: 700,
              fontSize: '.84rem',
              cursor: 'pointer',
              boxShadow: activeTab === '2fa' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <ShieldCheck size={15} /> {T.twoFactorAuth}
            {hasActiveTotp && (
              <span className="badge badge-green" style={{ fontSize: '.68rem', padding: '1px 6px' }}>
                ON
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: CHANGE PASSWORD */}
        {activeTab === 'password' && (
          <form onSubmit={handleUpdatePassword}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                {T.newPassword} (ቢያንስ 6 ፊደላት) *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: 12,
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#94a3b8',
                  }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                {T.confirmNewPassword} *
              </label>
              <input
                type={showPw ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {pwMsg.text && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  marginBottom: 14,
                  fontSize: '.84rem',
                  fontWeight: 600,
                  background: pwMsg.bad ? '#fef2f2' : '#f0fdf4',
                  color: pwMsg.bad ? '#991b1b' : '#166534',
                  border: `1px solid ${pwMsg.bad ? '#fecaca' : '#bbf7d0'}`,
                }}
              >
                {pwMsg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={busyPw}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px' }}
            >
              {busyPw ? 'Updating...' : T.updatePassword}
            </button>
          </form>
        )}

        {/* TAB 2: 2-FACTOR AUTH (GOOGLE AUTHENTICATOR) */}
        {activeTab === '2fa' && (
          <div>
            {/* If currently in enrollment flow (display QR code) */}
            {enrollingFactor ? (
              <form onSubmit={confirmMfaEnrollment}>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <b style={{ fontSize: '1rem', color: '#0f172a', display: 'block' }}>
                    {T.scanQrWithGoogleAuth}
                  </b>
                  <p style={{ color: '#64748b', fontSize: '.82rem', margin: '4px 0 14px' }}>
                    {lang === 'am'
                      ? 'ጎግል ኦተንቲኬተር (Google Authenticator) መተግበሪያን ከስልክዎ ከፍተው ከታች ያለውን QR ስካን ያድርጉ'
                      : 'Open Google Authenticator or Microsoft Authenticator and scan this QR code:'}
                  </p>

                  {enrollingFactor.totp?.qr_code && (
                    <div style={{ background: '#f8fafc', padding: 14, borderRadius: 12, display: 'inline-block', border: '1px solid #e2e8f0' }}>
                      <img
                        src={enrollingFactor.totp.qr_code}
                        alt="2FA QR Code"
                        style={{ width: 170, height: 170, margin: '0 auto', borderRadius: 8 }}
                      />
                    </div>
                  )}

                  {enrollingFactor.totp?.secret && (
                    <div style={{ marginTop: 12, fontSize: '.8rem', color: '#64748b' }}>
                      <span>Manual Secret Code: </span>
                      <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: 4, fontWeight: 700, color: '#0f172a' }}>
                        {enrollingFactor.totp.secret}
                      </code>
                      <button
                        type="button"
                        onClick={() => copySecret(enrollingFactor.totp.secret)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 8px', marginLeft: 8 }}
                      >
                        {copiedSecret ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                    {T.enter6DigitCode}
                  </label>
                  <input
                    required
                    autoFocus
                    placeholder="••••••"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    style={{
                      width: '100%',
                      fontSize: '1.4rem',
                      letterSpacing: 6,
                      textAlign: 'center',
                      fontWeight: 700,
                    }}
                  />
                </div>

                {mfaMsg.text && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      marginBottom: 14,
                      fontSize: '.84rem',
                      fontWeight: 600,
                      background: mfaMsg.bad ? '#fef2f2' : '#f0fdf4',
                      color: mfaMsg.bad ? '#991b1b' : '#166534',
                      border: `1px solid ${mfaMsg.bad ? '#fecaca' : '#bbf7d0'}`,
                    }}
                  >
                    {mfaMsg.text}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEnrollingFactor(null);
                      setOtpCode('');
                    }}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busyMfa || otpCode.length < 6}
                    className="btn btn-primary"
                    style={{ flex: 2 }}
                  >
                    {busyMfa ? 'Verifying...' : T.verifyAndActivate}
                  </button>
                </div>
              </form>
            ) : (
              /* Standard 2FA Status & Manage View */
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 12, background: hasActiveTotp ? '#f0fdf4' : '#fffbeb', border: `1px solid ${hasActiveTotp ? '#bbf7d0' : '#fde68a'}`, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: hasActiveTotp ? '#ecfdf5' : '#fef3c7', color: hasActiveTotp ? '#059669' : '#d97706', display: 'grid', placeItems: 'center' }}>
                      <ShieldCheck size={22} />
                    </div>
                    <div>
                      <b style={{ color: hasActiveTotp ? '#166534' : '#92400e', fontSize: '.95rem', display: 'block' }}>
                        {hasActiveTotp ? T.twoFactorActive : T.twoFactorDisabled}
                      </b>
                      <span style={{ fontSize: '.78rem', color: '#64748b' }}>
                        Google Authenticator (TOTP)
                      </span>
                    </div>
                  </div>

                  {!hasActiveTotp ? (
                    <button
                      type="button"
                      disabled={busyMfa || loadingMfa}
                      onClick={startMfaEnrollment}
                      className="btn btn-primary btn-sm"
                    >
                      {busyMfa ? 'Starting...' : T.enable2FaNow}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDisableMfa(mfaFactors[0]?.id)}
                      className="btn btn-danger btn-sm"
                    >
                      <Trash2 size={13} /> {T.disable2Fa}
                    </button>
                  )}
                </div>

                {mfaMsg.text && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      marginBottom: 14,
                      fontSize: '.84rem',
                      fontWeight: 600,
                      background: mfaMsg.bad ? '#fef2f2' : '#f0fdf4',
                      color: mfaMsg.bad ? '#991b1b' : '#166534',
                      border: `1px solid ${mfaMsg.bad ? '#fecaca' : '#bbf7d0'}`,
                    }}
                  >
                    {mfaMsg.text}
                  </div>
                )}

                {/* Email OTP Test Feature */}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 14, marginTop: 14 }}>
                  <b style={{ fontSize: '.88rem', color: '#0f172a', display: 'block', marginBottom: 4 }}>
                    Email OTP Alternative
                  </b>
                  <p style={{ color: '#64748b', fontSize: '.8rem', margin: '0 0 10px' }}>
                    Staff can also log in without a password using a 6-digit code delivered to their email inbox.
                  </p>
                  <button
                    type="button"
                    disabled={busyEmailOtp}
                    onClick={handleTestEmailOtp}
                    className="btn btn-secondary btn-sm"
                  >
                    <Mail size={13} /> {busyEmailOtp ? 'Sending...' : 'Test Send 6-Digit Email Code'}
                  </button>
                  {emailOtpSent && (
                    <span style={{ fontSize: '.8rem', color: '#059669', marginLeft: 8, fontWeight: 600 }}>
                      ✓ Test code sent to {session.user.email}!
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
