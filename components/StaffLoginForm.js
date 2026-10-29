'use client';
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { getDictionary } from '../lib/translations';

export default function StaffLoginForm({
  title = 'Staff Sign In',
  subtitle = 'Restricted Area. Authorized staff sign-in.',
  icon = '🔒',
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

  // 2FA Challenge state (if user has Google Authenticator active)
  const [mfaChallenge, setMfaChallenge] = useState(null); // { factorId, challengeId }
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
        // User has 2FA enabled! List factors and trigger challenge
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
            return; // Wait for OTP entry
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

  // 5. Send Password Reset Email
  const handleSendResetEmail = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    setBusyForgot(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
      redirectTo: typeof window !== 'undefined' ? window.location.href : undefined,
    });
    setBusyForgot(false);

    if (error) {
      setMsg({ text: error.message, bad: true });
    } else {
      setForgotSent(true);
      setMsg({ text: T.resetLinkSent, bad: false });
    }
  };

  return (
    <main className="wrap" style={{ maxWidth: 440, margin: '40px auto', padding: '0 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <img
          src="/logo.png"
          alt="Hiraga"
          style={{ width: 130, height: 'auto', marginBottom: 12 }}
        />
        <h2 style={{ margin: '0 0 6px', color: 'var(--o)', fontSize: '1.4rem' }}>
          {icon} {title}
        </h2>
        <p className="sm" style={{ margin: 0, color: 'var(--mu)' }}>
          {subtitle}
        </p>
      </div>

      <div className="panel" style={{ padding: 22, boxShadow: '0 12px 30px rgba(0,0,0,0.5)' }}>
        {/* If MFA Challenge is Required */}
        {mfaChallenge ? (
          <form onSubmit={handleVerifyMfaChallenge}>
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 6 }}>🛡️</div>
              <b style={{ fontSize: '1.05rem', display: 'block' }}>
                {lang === 'am' ? 'ባለ ሁለት ደረጃ ማረጋገጫ (2FA)' : 'Two-Factor Verification'}
              </b>
              <p className="sm" style={{ color: 'var(--mu)', margin: '4px 0 0' }}>
                {lang === 'am'
                  ? 'ከስልክዎ ጎግል ኦተንቲኬተር (Google Authenticator) መተግበሪያ የተሰጠውን ባለ 6-አሃዝ ኮድ ያስገቡ'
                  : 'Enter the 6-digit code from your Google Authenticator app'}
              </p>
            </div>

            <input
              required
              autoFocus
              placeholder="123456"
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
              className="btn o"
              style={{ width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 600 }}
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
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: 'var(--mu)',
                fontSize: '.82rem',
                marginTop: 12,
                cursor: 'pointer',
              }}
            >
              ← {lang === 'am' ? 'ተመለስ' : 'Cancel & Back to login'}
            </button>
          </form>
        ) : showForgot ? (
          /* Forgot Password View */
          <form onSubmit={handleSendResetEmail}>
            <b style={{ fontSize: '1rem', display: 'block', marginBottom: 6 }}>
              🔑 {T.forgotPassword}
            </b>
            <p className="sm" style={{ color: 'var(--mu)', marginTop: 0 }}>
              {lang === 'am'
                ? 'የመለያዎን ኢሜይል ያስገቡ። የይለፍ ቃል መቀየሪያ ሊንክ እንልክልዎታለን።'
                : 'Enter your staff email to receive a password reset link.'}
            </p>

            <input
              type="email"
              required
              autoFocus
              placeholder="staff@hiraga.com"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              style={{ width: '100%', marginBottom: 14 }}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowForgot(false)}
                className="btn sm x"
                style={{ flex: 1 }}
              >
                {lang === 'am' ? 'ተመለስ' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={busyForgot || forgotSent}
                className="btn sm o"
                style={{ flex: 2 }}
              >
                {busyForgot ? 'Sending...' : T.sendResetLink}
              </button>
            </div>
          </form>
        ) : (
          /* Main Login View */
          <div>
            {/* Free Mode Selector: Password vs Email OTP */}
            <div
              style={{
                display: 'flex',
                gap: 6,
                marginBottom: 16,
                background: 'rgba(255, 255, 255, 0.05)',
                padding: 4,
                borderRadius: 10,
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
                  padding: '7px 10px',
                  borderRadius: 8,
                  fontSize: '.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: loginMode === 'password' ? 'var(--o)' : 'transparent',
                  color: loginMode === 'password' ? '#fff' : 'var(--mu)',
                }}
              >
                🔑 {T.signInWithPassword}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginMode('email_otp');
                  setMsg({ text: '', bad: false });
                }}
                style={{
                  flex: 1,
                  padding: '7px 10px',
                  borderRadius: 8,
                  fontSize: '.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: loginMode === 'email_otp' ? '#8b5cf6' : 'transparent',
                  color: loginMode === 'email_otp' ? '#fff' : 'var(--mu)',
                }}
              >
                📧 {T.signInWithEmailOtp}
              </button>
            </div>

            {/* A: Standard Password Login */}
            {loginMode === 'password' && (
              <form onSubmit={handlePasswordLogin}>
                <label style={{ fontSize: '.84rem', color: 'var(--mu)', display: 'block', marginBottom: 4 }}>
                  {T.staffEmail} *
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="staff@hiraga.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', marginBottom: 12 }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ fontSize: '.84rem', color: 'var(--mu)' }}>
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
                      color: 'var(--o)',
                      fontSize: '.78rem',
                      cursor: 'pointer',
                      padding: 0,
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
                  style={{ width: '100%', marginBottom: 16 }}
                />

                <button
                  type="submit"
                  disabled={busy}
                  className="btn o"
                  style={{ width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 600 }}
                >
                  {busy ? 'Signing in...' : lang === 'am' ? 'ግባ' : 'Sign In'}
                </button>
              </form>
            )}

            {/* B: Free Email OTP Login (Passwordless) */}
            {loginMode === 'email_otp' && (
              <div>
                {!otpSent ? (
                  <form onSubmit={handleSendEmailOtp}>
                    <p className="sm" style={{ color: 'var(--mu)', marginTop: 0 }}>
                      {lang === 'am'
                        ? 'የይለፍ ቃል አያስፈልግዎትም! ኢሜይልዎን ያስገቡ፤ ባለ 6-አሃዝ የማረጋገጫ ኮድ ይላክልዎታል።'
                        : 'No password needed! Enter your email to receive a 100% free 6-digit login code.'}
                    </p>
                    <label style={{ fontSize: '.84rem', color: 'var(--mu)', display: 'block', marginBottom: 4 }}>
                      {T.staffEmail} *
                    </label>
                    <input
                      type="email"
                      required
                      autoFocus
                      placeholder="staff@hiraga.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{ width: '100%', marginBottom: 14 }}
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="btn"
                      style={{
                        width: '100%',
                        padding: '12px',
                        fontSize: '.95rem',
                        fontWeight: 600,
                        background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                        color: '#fff',
                      }}
                    >
                      {busy ? 'Sending...' : `✉️ ${T.sendEmailOtp}`}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyEmailOtp}>
                    <label style={{ fontSize: '.84rem', color: 'var(--mu)', display: 'block', marginBottom: 4 }}>
                      {T.enterEmailCode}
                    </label>
                    <input
                      required
                      autoFocus
                      placeholder="123456"
                      maxLength={6}
                      value={emailOtpCode}
                      onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, ''))}
                      style={{
                        width: '100%',
                        fontSize: '1.4rem',
                        letterSpacing: 6,
                        textAlign: 'center',
                        fontWeight: 700,
                        marginBottom: 14,
                      }}
                    />
                    <button
                      type="submit"
                      disabled={busy || emailOtpCode.length < 6}
                      className="btn o"
                      style={{ width: '100%', padding: '12px', fontSize: '.95rem', fontWeight: 600 }}
                    >
                      {busy ? 'Verifying...' : T.verifyAndSignIn}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setEmailOtpCode('');
                      }}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--mu)',
                        fontSize: '.8rem',
                        marginTop: 10,
                        cursor: 'pointer',
                      }}
                    >
                      ← {lang === 'am' ? 'ኢሜይል ቀይር' : 'Change email or resend'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}

        {msg.text && (
          <p
            className={msg.bad ? 'err' : 'ok'}
            style={{
              marginTop: 14,
              textAlign: 'center',
              fontSize: '.88rem',
              fontWeight: 600,
              padding: '6px 10px',
              borderRadius: 8,
              background: msg.bad ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
            }}
          >
            {msg.text}
          </p>
        )}

        {/* Language switch */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            type="button"
            onClick={() => onLangChange?.(lang === 'am' ? 'en' : 'am')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--mu)',
              fontSize: '.82rem',
              cursor: 'pointer',
            }}
          >
            🌐 {lang === 'am' ? 'Switch to English' : 'ወደ አማርኛ ቀይር'}
          </button>
        </div>
      </div>
    </main>
  );
}
