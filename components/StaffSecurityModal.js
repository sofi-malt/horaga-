'use client';
import { useState, useEffect } from 'react';
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
        issuer: 'Hiraga Restaurant',
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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(6px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#121210',
          border: '1px solid var(--bd, #27272a)',
          borderRadius: 16,
          maxWidth: 540,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 24,
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: '1px solid var(--bd)',
          }}
        >
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              🔐 {T.securitySettings}
            </h2>
            <div style={{ fontSize: '.82rem', color: 'var(--mu)' }}>
              {session.user?.email} •{' '}
              <span style={{ color: 'var(--o)', fontWeight: 600 }}>
                {session.user?.user_metadata?.role?.toUpperCase() || 'STAFF'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn sm x"
            style={{ padding: '4px 10px', fontSize: '1rem' }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <button
            type="button"
            onClick={() => setActiveTab('password')}
            className={`btn sm ${activeTab === 'password' ? 'o' : 'x'}`}
            style={{ flex: 1, padding: '8px 12px', fontSize: '.88rem' }}
          >
            🔑 {T.changePassword}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('2fa')}
            className={`btn sm ${activeTab === '2fa' ? 'o' : 'x'}`}
            style={{ flex: 1, padding: '8px 12px', fontSize: '.88rem' }}
          >
            🛡️ {T.twoFactorTitle}
          </button>
        </div>

        {/* TAB 1: CHANGE PASSWORD */}
        {activeTab === 'password' && (
          <form onSubmit={handleUpdatePassword}>
            <p className="sm" style={{ color: 'var(--mu)', marginTop: 0 }}>
              {lang === 'am'
                ? 'በስራ አስኪያጅ የተሰጠዎትን ጊዜያዊ የይለፍ ቃል ወደራስዎ ሚስጥራዊ የይለፍ ቃል እዚህ መቀየር ይችላሉ።'
                : 'Update your temporary staff password to your own private secret password.'}
            </p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: '.82rem', color: 'var(--mu)', display: 'block', marginBottom: 4 }}>
                {T.newPassword} *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ width: '100%', paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--mu)',
                    cursor: 'pointer',
                    fontSize: '.85rem',
                  }}
                >
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: '.82rem', color: 'var(--mu)', display: 'block', marginBottom: 4 }}>
                {T.confirmNewPassword} *
              </label>
              <input
                type={showPw ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            {pwMsg.text && (
              <div
                className={pwMsg.bad ? 'err' : 'ok'}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: '.88rem',
                  marginBottom: 14,
                  background: pwMsg.bad ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                  border: `1px solid ${pwMsg.bad ? '#ef4444' : '#22c55e'}`,
                }}
              >
                {pwMsg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={busyPw}
              className="btn o"
              style={{ width: '100%', padding: '12px', fontSize: '.95rem', fontWeight: 600 }}
            >
              {busyPw ? 'Updating...' : T.updatePasswordBtn}
            </button>
          </form>
        )}

        {/* TAB 2: DOUBLE VERIFICATION (100% FREE 2FA) */}
        {activeTab === '2fa' && (
          <div>
            {/* Section A: Google Authenticator */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--bd)',
                borderRadius: 12,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <b style={{ fontSize: '1rem', color: '#60a5fa' }}>
                  📱 {T.googleAuthTitle}
                </b>
                {hasActiveTotp ? (
                  <span
                    style={{
                      fontSize: '.72rem',
                      background: 'rgba(34, 197, 94, 0.2)',
                      color: '#4ade80',
                      padding: '3px 8px',
                      borderRadius: 999,
                      fontWeight: 700,
                    }}
                  >
                    ● ACTIVE
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '.72rem',
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: 'var(--mu)',
                      padding: '3px 8px',
                      borderRadius: 999,
                    }}
                  >
                    100% FREE
                  </span>
                )}
              </div>
              <p className="sm" style={{ color: 'var(--mu)', marginTop: 0, lineHeight: 1.4 }}>
                {T.googleAuthDesc}
              </p>

              {/* Status & Actions */}
              {loadingMfa ? (
                <p className="sm">Checking 2FA status...</p>
              ) : hasActiveTotp ? (
                <div>
                  <div
                    style={{
                      background: 'rgba(34, 197, 94, 0.1)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      color: '#4ade80',
                      padding: '10px 12px',
                      borderRadius: 8,
                      fontSize: '.85rem',
                      marginBottom: 10,
                      fontWeight: 600,
                    }}
                  >
                    ✓ {T.twoFactorActive}
                  </div>
                  <button
                    onClick={() => handleDisableMfa(mfaFactors[0].id)}
                    className="btn sm x"
                    disabled={busyMfa}
                    style={{ fontSize: '.8rem' }}
                  >
                    {T.disable2fa}
                  </button>
                </div>
              ) : enrollingFactor ? (
                /* Enrollment In Progress (Show QR Code & Confirm) */
                <form onSubmit={confirmMfaEnrollment} style={{ marginTop: 12 }}>
                  <div style={{ textAlign: 'center', background: '#fff', padding: 12, borderRadius: 12, marginBottom: 10 }}>
                    {enrollingFactor.totp?.qr_code && (
                      <img
                        src={enrollingFactor.totp.qr_code}
                        alt="2FA QR Code"
                        style={{ width: 180, height: 180, display: 'inline-block' }}
                      />
                    )}
                  </div>
                  <p className="sm" style={{ textAlign: 'center', margin: '4px 0 10px', color: 'var(--mu)' }}>
                    Scan with Google Authenticator or Microsoft Authenticator app on your phone.
                  </p>

                  {/* Secret Key manual entry option */}
                  {enrollingFactor.totp?.secret && (
                    <div
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '8px 10px',
                        borderRadius: 8,
                        fontSize: '.78rem',
                        marginBottom: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontFamily: 'monospace', letterSpacing: 1 }}>
                        Key: {enrollingFactor.totp.secret}
                      </span>
                      <button
                        type="button"
                        onClick={() => copySecret(enrollingFactor.totp.secret)}
                        className="btn sm x"
                        style={{ padding: '2px 8px', fontSize: '.72rem' }}
                      >
                        {copiedSecret ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  )}

                  <label style={{ fontSize: '.82rem', color: 'var(--mu)', display: 'block', marginBottom: 4 }}>
                    {T.enterOtpPrompt}
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      required
                      autoFocus
                      placeholder="e.g. 123456"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      style={{
                        flex: 1,
                        fontSize: '1.2rem',
                        letterSpacing: 4,
                        textAlign: 'center',
                        fontWeight: 700,
                      }}
                    />
                    <button type="submit" disabled={busyMfa || otpCode.length < 6} className="btn o" style={{ padding: '0 16px' }}>
                      {busyMfa ? 'Verifying...' : T.verifyAndActivate}
                    </button>
                  </div>
                </form>
              ) : (
                /* Not enrolled yet -> Button to Start */
                <button
                  type="button"
                  onClick={startMfaEnrollment}
                  disabled={busyMfa}
                  className="btn o sm"
                  style={{ fontWeight: 600 }}
                >
                  {busyMfa ? 'Generating QR...' : `➕ ${T.enableGoogleAuth}`}
                </button>
              )}

              {mfaMsg.text && (
                <div
                  className={mfaMsg.bad ? 'err' : 'ok'}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 8,
                    fontSize: '.85rem',
                    marginTop: 10,
                    background: mfaMsg.bad ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                  }}
                >
                  {mfaMsg.text}
                </div>
              )}
            </div>

            {/* Section B: Email OTP (Always available backup) */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--bd)',
                borderRadius: 12,
                padding: 16,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <b style={{ fontSize: '1rem', color: '#a78bfa' }}>
                  📧 {T.emailOtpTitle}
                </b>
                <span
                  style={{
                    fontSize: '.72rem',
                    background: 'rgba(167, 139, 250, 0.2)',
                    color: '#c4b5fd',
                    padding: '3px 8px',
                    borderRadius: 999,
                    fontWeight: 700,
                  }}
                >
                  ● ALWAYS AVAILABLE
                </span>
              </div>
              <p className="sm" style={{ color: 'var(--mu)', marginTop: 0, lineHeight: 1.4 }}>
                {T.emailOtpDesc}
              </p>

              <button
                type="button"
                onClick={handleTestEmailOtp}
                disabled={busyEmailOtp}
                className="btn sm x"
                style={{ fontSize: '.8rem' }}
              >
                {busyEmailOtp
                  ? 'Sending code...'
                  : emailOtpSent
                  ? '✓ Test Code Sent to your Email!'
                  : '✉️ Send Test 6-Digit Code to My Email'}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <button onClick={onClose} className="btn x" style={{ padding: '8px 18px' }}>
            {lang === 'am' ? 'ዝጋ' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
