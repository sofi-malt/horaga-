'use client';
import { useState } from 'react';
import {
  Lock,
  KeyRound,
  ShieldCheck,
  Mail,
  Check,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Globe,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getDictionary } from '../lib/translations';

export default function StaffLoginForm({
  title = 'Staff Sign In',
  subtitle = 'Royal Hotel Enterprise Terminal. Authorized staff sign-in.',
  icon = null,
  lang = 'am',
  onLangChange,
  onLoginSuccess,
}) {
  const T = getDictionary(lang);
  const [loginMode, setLoginMode] = useState('password'); // 'password' or 'email_otp'

  // Standard password fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: '', bad: false });

  // 2FA Challenge state
  const [mfaChallenge, setMfaChallenge] = useState(null);
  const [totpCode, setTotpCode] = useState('');

  // Email OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState('');

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [busyForgot, setBusyForgot] = useState(false);

  // 1. Password login + MFA Check
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg({ text: '', bad: false });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      setBusy(false);
      setMsg({ text: error.message, bad: true });
      return;
    }

    // Check if user has MFA enrolled
    try {
      const { data: aal, error: aalErr } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (!aalErr && aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totpFactor = factors?.totp?.find((f) => f.status === 'verified');

        if (totpFactor) {
          const { data: challengeData, error: challengeErr } =
            await supabase.auth.mfa.challenge({ factorId: totpFactor.id });

          setBusy(false);
          if (!challengeErr && challengeData) {
            setMfaChallenge({
              factorId: totpFactor.id,
              challengeId: challengeData.id,
            });
            return;
          }
        }
      }
    } catch (e) {
      console.warn('MFA check error:', e);
    }

    setBusy(false);
    if (typeof onLoginSuccess === 'function') {
      onLoginSuccess(data?.session);
    }
  };

  // 2. Verify Google Authenticator Code during login
  const handleVerifyMfaChallenge = async (e) => {
    e.preventDefault();
    if (!mfaChallenge || totpCode.length < 6) return;

    setBusy(true);
    setMsg({ text: '', bad: false });

    try {
      const { data, error } = await supabase.auth.mfa.verify({
        factorId: mfaChallenge.factorId,
        challengeId: mfaChallenge.challengeId,
        code: totpCode.trim(),
      });

      setBusy(false);
      if (error) {
        setMsg({
          text:
            lang === 'am'
              ? 'የተሳሳተ ኮድ ነው። እባክዎ እንደገና ይሞክሩ።'
              : 'Invalid authenticator code. Try again.',
          bad: true,
        });
      } else {
        if (typeof onLoginSuccess === 'function') {
          onLoginSuccess(data?.session);
        }
      }
    } catch (err) {
      setBusy(false);
      setMsg({ text: err.message, bad: true });
    }
  };

  // 3. Send 6-Digit Email OTP
  const handleSendEmailOtp = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setBusy(true);
    setMsg({ text: '', bad: false });

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false },
    });

    setBusy(false);
    if (error) {
      setMsg({ text: error.message, bad: true });
    } else {
      setOtpSent(true);
      setMsg({
        text:
          lang === 'am'
            ? '✓ ባለ 6-አሃዝ ኮድ ወደ ኢሜይልዎ ተልኳል!'
            : '✓ 6-Digit code sent to your email!',
        bad: false,
      });
    }
  };

  // 4. Verify 6-Digit Email OTP
  const handleVerifyEmailOtp = async (e) => {
    e.preventDefault();
    if (!emailOtpCode.trim()) return;

    setBusy(true);
    setMsg({ text: '', bad: false });

    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: emailOtpCode.trim(),
      type: 'email',
    });

    setBusy(false);
    if (error) {
      setMsg({ text: error.message, bad: true });
    } else {
      if (typeof onLoginSuccess === 'function') {
        onLoginSuccess(data?.session);
      }
    }
  };

  // 5. Send Password Reset Email Link
  const handleSendResetEmail = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    setBusyForgot(true);
    setMsg({ text: '', bad: false });

    const { error } = await supabase.auth.resetPasswordForEmail(
      forgotEmail.trim().toLowerCase(),
      {
        redirectTo: `${window.location.origin}/admin`,
      }
    );

    setBusyForgot(false);
    if (error) {
      setMsg({ text: error.message, bad: true });
    } else {
      setForgotSent(true);
      setMsg({
        text:
          lang === 'am'
            ? '✓ የይለፍ ቃል መቀየሪያ ሊንክ ወደ ኢሜይልዎ ተልኳል!'
            : '✓ Password reset link sent to your email inbox!',
        bad: false,
      });
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '24px 16px' }}>
      <div style={{ maxWidth: 440, width: '100%' }}>
        {/* Header Branding */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 54, height: 54, borderRadius: 16, background: '#0f172a', display: 'grid', placeItems: 'center', margin: '0 auto 14px', color: '#60a5fa', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)' }}>
            {icon || <Lock size={26} />}
          </div>
          <h2 style={{ margin: '0 0 6px', color: '#0f172a', fontSize: '1.45rem', fontWeight: 800 }}>
            {title}
          </h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: '.88rem' }}>
            {subtitle}
          </p>
        </div>

        <div className="card" style={{ padding: 26, boxShadow: '0 10px 30px rgba(0,0,0,0.06)' }}>
          {/* If MFA Challenge is Required */}
          {mfaChallenge ? (
            <form onSubmit={handleVerifyMfaChallenge}>
              <div style={{ textAlign: 'center', marginBottom: 18 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center', margin: '0 auto 8px' }}>
                  <ShieldCheck size={24} />
                </div>
                <b style={{ fontSize: '1.05rem', color: '#0f172a', display: 'block' }}>
                  {lang === 'am' ? 'ባለ ሁለት ደረጃ ማረጋገጫ (2FA)' : 'Two-Factor Verification'}
                </b>
                <p style={{ color: '#64748b', fontSize: '.84rem', margin: '4px 0 0' }}>
                  {lang === 'am'
                    ? 'ከስልክዎ ጎግል ኦተንቲኬተር (Google Authenticator) መተግበሪያ የተሰጠውን ባለ 6-አሃዝ ኮድ ያስገቡ'
                    : 'Enter the 6-digit verification code from your authenticator app'}
                </p>
              </div>

              <input
                required
                autoFocus
                placeholder="••••••"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                style={{
                  width: '100%',
                  fontSize: '1.4rem',
                  letterSpacing: 6,
                  textAlign: 'center',
                  fontWeight: 700,
                  marginBottom: 16,
                }}
              />

              <button
                type="submit"
                disabled={busy || totpCode.length < 6}
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', fontSize: '.95rem' }}
              >
                {busy ? 'Verifying...' : lang === 'am' ? 'አረጋግጥና ግባ' : 'Verify & Sign In'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMfaChallenge(null);
                  setTotpCode('');
                  supabase.auth.signOut();
                }}
                className="btn btn-ghost"
                style={{ width: '100%', marginTop: 10, fontSize: '.82rem' }}
              >
                <ArrowLeft size={14} /> {lang === 'am' ? 'ተመለስ' : 'Cancel & Back to login'}
              </button>
            </form>
          ) : showForgot ? (
            /* Forgot Password View */
            <form onSubmit={handleSendResetEmail}>
              <b style={{ fontSize: '1.05rem', color: '#0f172a', display: 'block', marginBottom: 6 }}>
                {T.forgotPassword}
              </b>
              <p style={{ color: '#64748b', fontSize: '.84rem', margin: '0 0 16px' }}>
                {lang === 'am'
                  ? 'የመለያዎን ኢሜይል ያስገቡ። የይለፍ ቃል መቀየሪያ ሊንክ እንልክልዎታለን።'
                  : 'Enter your staff email to receive a password reset link.'}
              </p>

              <input
                type="email"
                required
                autoFocus
                placeholder="staff@royalhotel.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                style={{ marginBottom: 16 }}
              />

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  {lang === 'am' ? 'ተመለስ' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={busyForgot || forgotSent}
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                >
                  {busyForgot ? 'Sending...' : T.sendResetLink}
                </button>
              </div>
            </form>
          ) : (
            /* Main Login View */
            <div>
              {/* Tab Selector: Password vs Email OTP */}
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  marginBottom: 18,
                  background: '#f1f5f9',
                  padding: 4,
                  borderRadius: 12,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('password');
                    setMsg({ text: '', bad: false });
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 9,
                    fontSize: '.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    background: loginMode === 'password' ? '#ffffff' : 'transparent',
                    color: loginMode === 'password' ? '#0f172a' : '#64748b',
                    boxShadow: loginMode === 'password' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {T.signInWithPassword}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('email_otp');
                    setMsg({ text: '', bad: false });
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 9,
                    fontSize: '.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    background: loginMode === 'email_otp' ? '#ffffff' : 'transparent',
                    color: loginMode === 'email_otp' ? '#0f172a' : '#64748b',
                    boxShadow: loginMode === 'email_otp' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {T.signInWithEmailOtp}
                </button>
              </div>

              {/* A: Standard Password Login */}
              {loginMode === 'password' && (
                <form onSubmit={handlePasswordLogin}>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                      {T.staffEmail} *
                    </label>
                    <input
                      type="email"
                      required
                      autoFocus
                      placeholder="staff@royalhotel.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600 }}>
                        Password *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(email);
                          setShowForgot(true);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#2563eb',
                          fontSize: '.78rem',
                          cursor: 'pointer',
                          padding: 0,
                          fontWeight: 600,
                        }}
                      >
                        {T.forgotPassword}
                      </button>
                    </div>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={busy}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '12px', fontSize: '.95rem' }}
                  >
                    {busy ? 'Signing in...' : lang === 'am' ? 'ግባ' : 'Sign In'}
                  </button>
                </form>
              )}

              {/* B: Email OTP Login */}
              {loginMode === 'email_otp' && (
                <div>
                  {!otpSent ? (
                    <form onSubmit={handleSendEmailOtp}>
                      <p style={{ color: '#64748b', fontSize: '.84rem', margin: '0 0 14px' }}>
                        {lang === 'am'
                          ? 'የይለፍ ቃል አያስፈልግዎትም! ኢሜይልዎን ያስገቡ፤ ባለ 6-አሃዝ የማረጋገጫ ኮድ ይላክልዎታል።'
                          : 'Passwordless login: Enter your staff email to receive a 6-digit authentication code.'}
                      </p>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                          {T.staffEmail} *
                        </label>
                        <input
                          type="email"
                          required
                          autoFocus
                          placeholder="staff@royalhotel.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={busy}
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '12px', fontSize: '.95rem' }}
                      >
                        <Mail size={16} /> {busy ? 'Sending...' : T.sendEmailOtp}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyEmailOtp}>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ fontSize: '.82rem', color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                          {T.enterEmailCode}
                        </label>
                        <input
                          required
                          autoFocus
                          placeholder="••••••"
                          maxLength={6}
                          value={emailOtpCode}
                          onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, ''))}
                          style={{
                            width: '100%',
                            fontSize: '1.4rem',
                            letterSpacing: 6,
                            textAlign: 'center',
                            fontWeight: 700,
                          }}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={busy || emailOtpCode.length < 6}
                        className="btn btn-primary"
                        style={{ width: '100%', padding: '12px', fontSize: '.95rem' }}
                      >
                        {busy ? 'Verifying...' : T.verifyAndSignIn}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOtpSent(false);
                          setEmailOtpCode('');
                        }}
                        className="btn btn-ghost"
                        style={{ width: '100%', marginTop: 8, fontSize: '.8rem' }}
                      >
                        <ArrowLeft size={13} /> {lang === 'am' ? 'ኢሜይል ቀይር' : 'Change email or resend'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}

          {msg.text && (
            <div
              style={{
                marginTop: 16,
                textAlign: 'center',
                fontSize: '.85rem',
                fontWeight: 600,
                padding: '8px 12px',
                borderRadius: 10,
                background: msg.bad ? '#fef2f2' : '#f0fdf4',
                color: msg.bad ? '#991b1b' : '#166534',
                border: `1px solid ${msg.bad ? '#fecaca' : '#bbf7d0'}`,
              }}
            >
              {msg.text}
            </div>
          )}

          {/* Language Switch */}
          <div style={{ textAlign: 'center', marginTop: 18, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
            <button
              type="button"
              onClick={() => onLangChange?.(lang === 'am' ? 'en' : 'am')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                fontSize: '.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 600,
              }}
            >
              <Globe size={14} /> {lang === 'am' ? 'Switch to English' : 'ወደ አማርኛ ቀይር'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
