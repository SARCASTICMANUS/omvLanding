import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, Link } from "react-router-dom";
import { loginUser } from "../features/auth/authSlice";
import { Loader } from "lucide-react";
import loginBusImage from "../assets/loginBus.png";

/* ─────────────────────────────────────────────
   Inline SVG Icons (no extra deps)
───────────────────────────────────────────── */
const MailIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);

const LockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const MicrosoftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 23 23">
    <path fill="#f3f3f3" d="M0 0h23v23H0z"/>
    <path fill="#f35325" d="M1 1h10v10H1z"/>
    <path fill="#81bc06" d="M12 1h10v10H12z"/>
    <path fill="#05a6f0" d="M1 12h10v10H1z"/>
    <path fill="#ffba08" d="M12 12h10v10H12z"/>
  </svg>
);

const GlobeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);


const LoginPage = () => {
  const [formData, setFormData] = React.useState({ email: "", password: "" });

  const { loading, error, isAuthenticated, user } = useSelector(
    (state) => state.auth,
  );

  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === "admin") navigate("/admin");
      else navigate("/");
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(loginUser(formData));
  };

  return (
    <>
      <style>{`
        .vayy-root * { box-sizing: border-box; margin: 0; padding: 0; }
        .vayy-root { font-family: inherit; }

        .left-panel {
          background: linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url("${loginBusImage}") center center / 115% 100% no-repeat; 
          position: relative;
          overflow: hidden;
        }

        .logo-box {
          width: 44px;
          height: 44px;
          background: #00E676;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 22px;
          color: #030f04;
        }

        .feature-icon {
          width: 44px;
          height: 44px;
          background: rgba(0,230,118,0.15);
          border: 1px solid rgba(0,230,118,0.25);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 10px;
        }

        .form-input {
          width: 100%;
          height: 52px;
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          background: white;
          padding: 0 16px 0 44px;
          font-size: 15px;
          font-family: inherit;
          color: #111827;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .form-input:focus {
          border-color: #00C96B;
          box-shadow: 0 0 0 3px rgba(0,201,107,0.12);
        }
        .form-input::placeholder { color: #9ca3af; }

        .sign-in-btn {
          width: 100%;
          height: 52px;
          background: #00C96B;
          border: none;
          border-radius: 10px;
          color: white;
          font-weight: 700;
          font-size: 16px;
          font-family: inherit;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: background 0.2s, transform 0.15s;
        }
        .sign-in-btn:hover:not(:disabled) { background: #00b560; transform: translateY(-1px); }
        .sign-in-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        .social-btn {
          flex: 1;
          height: 48px;
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          background: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          color: #374151;
          transition: border-color 0.2s, background 0.2s;
        }
        .social-btn:hover { border-color: #d1d5db; background: #f9fafb; }

        .lang-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 6px 12px;
          background: white;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          cursor: pointer;
          font-family: inherit;
        }

        .checkbox-custom {
          width: 16px;
          height: 16px;
          border: 2px solid #d1d5db;
          border-radius: 4px;
          cursor: pointer;
          accent-color: #00C96B;
        }
      `}</style>

      <div className="vayy-root" style={{ minHeight: '100vh', display: 'flex', backgroundColor: '#f9fafb' }}>

        {/* ── LEFT PANEL ── */}
        <div className="left-panel" style={{ display: 'flex', width: '50%', padding: '40px 50px', flexDirection: 'column', justifyContent: 'flex-start', gap: 50 }}
          ref={el => { if (el) el.style.display = window.innerWidth >= 1024 ? 'flex' : 'none'; }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="logo-box">V</div>
            <div>
              <div style={{ color: 'white', fontWeight: 800, fontSize: 18, letterSpacing: 1 }}>VAYY</div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11 }}>Smart. Simple. Seamless.</div>
            </div>
          </div>

          {/* Hero text */}
          <div>
            <h2 style={{ color: 'white', fontSize: 52, fontWeight: 900, lineHeight: 1.1, letterSpacing: -1 }}>
              Better Commutes.<br />
              <span style={{ color: '#00E676' }}>Smarter</span> Cities.
            </h2>
            <div style={{ width: 48, height: 4, background: '#00E676', borderRadius: 2, margin: '20px 0' }} />
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, lineHeight: 1.7, maxWidth: 380 }}>
              Real-time tracking for fixed-route transit. Connecting passengers and drivers with reliable technology.
            </p>
          </div>

        

          {/* Feature pills */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 34, position: 'absolute', bottom: 40 }}>
            {[
              { label: 'Live Tracking', sub: 'Real-time bus updates', icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00E676" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              )},
              { label: 'Reliable Service', sub: 'On-time and dependable', icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00E676" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              )},
              { label: 'Better Connectivity', sub: 'Seamless travel experience', icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00E676" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              )},
            ].map(f => (
              <div key={f.label} style={{ textAlign: 'center', padding: '16px 12px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14 }}>
                <div className="feature-icon">{f.icon}</div>
                <div style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>{f.label}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 4 }}>{f.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'white', padding: '40px 24px', position: 'relative' }}>

          {/* Language selector */}
          <div style={{ position: 'absolute', top: 20, right: 24 }}>
            <button className="lang-btn">
              <GlobeIcon />
              English
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
            </button>
          </div>

          <div style={{ width: '100%', maxWidth: 440 }}>
            {/* Heading */}
            <div style={{ marginBottom: 36 }}>
              <h2 style={{ fontSize: 36, fontWeight: 900, color: '#111827', letterSpacing: -0.5 }}>Welcome Back</h2>
              <p style={{ color: '#6b7280', fontSize: 15, marginTop: 8 }}>Sign in to continue to your account</p>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                <p style={{ color: '#dc2626', fontWeight: 700, fontSize: 14 }}>Login Failed</p>
                <p style={{ color: '#ef4444', fontSize: 13, marginTop: 4 }}>{error.detail || 'Invalid email or password.'}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>
                    <MailIcon />
                  </span>
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="form-input"
                  />
                </div>
              </div>

              {/* Password */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>
                    <LockIcon />
                  </span>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="form-input"
                  />
                </div>
              </div>

              {/* Remember + Forgot */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151', cursor: 'pointer' }}>
                  <input type="checkbox" className="checkbox-custom" />
                  Remember me
                </label>
                <a href="#" style={{ fontSize: 14, fontWeight: 600, color: '#00a855', textDecoration: 'none' }}>
                  Forgot password?
                </a>
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading} className="sign-in-btn" style={{ marginBottom: 24 }}>
                {loading ? (
                  <Loader className="animate-spin" size={20} />
                ) : (
                  <>Sign In <ArrowRightIcon /></>
                )}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
              <span style={{ fontSize: 13, color: '#9ca3af', whiteSpace: 'nowrap' }}>or continue with</span>
              <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
            </div>

            {/* Social */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
              <button className="social-btn">
                <GoogleIcon /> Continue with Google
              </button>
              <button className="social-btn">
                <MicrosoftIcon /> Continue with Microsoft
              </button>
            </div>

            {/* Register link */}
            <p style={{ textAlign: 'center', fontSize: 14, color: '#6b7280' }}>
              Don't have an account?{' '}
              <Link to="/register" style={{ color: '#00a855', fontWeight: 700, textDecoration: 'none' }}>
                Create free account
              </Link>
            </p>
          </div>
        </div>

        {/* Responsive left panel toggle */}
        <style>{`
          @media (min-width: 1024px) {
            .left-panel { display: flex !important; }
          }
          @media (max-width: 1023px) {
            .left-panel { display: none !important; }
          }
        `}</style>
      </div>
    </>
  );
};

export default LoginPage;
