import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * LoginPage — Glassmorphic dark login card with gradient accents.
 * Uses native <input> without DaisyUI input classes to avoid
 * theme variable conflicts with background/color.
 */
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      const message =
        err?.message ||
        err?.response?.data?.error ||
        'Login failed. Please check your credentials.';
      setError(message);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '44px',
    paddingLeft: '44px',
    paddingRight: '16px',
    borderRadius: '12px',
    fontSize: '14px',
    background: 'rgba(255,255,255,0.07)',
    border: '1.5px solid rgba(255,255,255,0.15)',
    color: '#f3f4f6',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
    boxSizing: 'border-box',
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(168,85,247,0.8)';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(168,85,247,0.18)';
    e.currentTarget.style.background = 'rgba(255,255,255,0.10)';
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
    e.currentTarget.style.boxShadow = 'none';
    e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f0c29 0%, #1a1040 50%, #0f0c29 100%)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      
      {/* Animated gradient orbs */}
      <div style={{ position: 'absolute', top: '15%', left: '10%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)', filter: 'blur(40px)', animation: 'pulse 8s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: '350px', height: '350px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.20) 0%, transparent 70%)', filter: 'blur(40px)', animation: 'pulse 12s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', top: '50%', left: '55%', width: '280px', height: '280px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)', filter: 'blur(40px)', animation: 'pulse 6s ease-in-out infinite' }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        style={{
          width: '100%',
          maxWidth: '420px',
          borderRadius: '20px',
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top gradient accent line */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #8b5cf6, #ec4899, #06b6d4)', borderRadius: '20px 20px 0 0' }} />

        <div style={{ padding: '36px 36px 32px' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '60px', borderRadius: '16px', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', fontSize: '28px', boxShadow: '0 8px 24px rgba(139,92,246,0.35)', marginBottom: '16px' }}>
              📈
            </div>
            <h1 style={{ margin: '0 0 6px', fontSize: '28px', fontWeight: 900, background: 'linear-gradient(135deg, #c4b5fd, #f9a8d4, #7dd3fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', letterSpacing: '-0.5px' }}>
              Auto Trade
            </h1>
            <p style={{ margin: 0, fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2.5px' }}>
              Intraday Trading Signals Engine
            </p>
          </div>

          {/* Error Alert */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: '16px' }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}
              >
                <span style={{ color: '#f87171', fontSize: '16px', flexShrink: 0 }}>⚠</span>
                <span style={{ color: '#fca5a5', fontSize: '13px', lineHeight: 1.4 }}>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Email Field */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)', fontSize: '15px', pointerEvents: 'none', zIndex: 1 }}>✉</span>
                <input
                  id="login-email"
                  type="email"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)', fontSize: '15px', pointerEvents: 'none', zIndex: 1 }}>🔒</span>
                <input
                  id="login-password"
                  type="password"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: 1.02, boxShadow: '0 12px 28px rgba(139,92,246,0.45)' }}
              whileTap={{ scale: 0.98 }}
              id="login-submit"
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 800,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.75 : 1,
                boxShadow: '0 8px 24px rgba(139,92,246,0.30)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                letterSpacing: '0.3px',
                marginTop: '4px',
                transition: 'opacity 0.2s',
              }}
            >
              {isLoading ? (
                <>
                  <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  Authenticating…
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <span style={{ fontSize: '16px' }}>→</span>
                </>
              )}
            </motion.button>
          </form>

          {/* Register link */}
          <p style={{ textAlign: 'center', marginTop: '22px', fontSize: '13px', color: 'rgba(255,255,255,0.4)', marginBottom: 0 }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: '#c4b5fd', fontWeight: 700, textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#a78bfa')}
              onMouseLeave={e => (e.currentTarget.style.color = '#c4b5fd')}
            >
              Create free account
            </Link>
          </p>
        </div>
      </motion.div>

      {/* Spinner keyframe */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
