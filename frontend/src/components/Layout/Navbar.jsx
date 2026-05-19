import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../features/auth/authSlice';
import mmm from '../../assets/mmm.png';
import { Sun, Globe, User, LogOut, Menu, X, ChevronDown } from 'lucide-react';

const Navbar = () => {
  const location = useLocation();
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state) => state.auth || {});
  const [isOpen, setIsOpen] = useState(false);

  /* ── Close menu on route change ── */
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  /* ── Lock body scroll when mobile menu is open ── */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const navItems = [
    { name: 'Home',         path: '/' },
    { name: 'Live Tracking', path: '/tracking' },
    { name: 'Routes',       path: '/routes' },
    { name: 'About Us',     path: '/about' },
    { name: 'Support',      path: '/contact' },
  ];

  return (
    <>
      {/* ── NAVBAR BAR ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-[500] flex items-center justify-between px-5 py-3 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm box-border"
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src={mmm} alt="Vayy Logo" className="h-8 w-8 object-contain" />
          <span className="text-xl font-black tracking-tight text-gray-900">VAYY</span>
        </Link>

        {/* ── Desktop nav links (center) ── */}
        <div className="hidden lg:flex items-center gap-8">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className={`text-sm font-semibold transition-colors duration-150 ${
                location.pathname === item.path
                  ? 'text-[#009849]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              style={
                location.pathname === item.path
                  ? { borderBottom: '2.5px solid #009849', paddingBottom: 2 }
                  : {}
              }
            >
              {item.name}
            </Link>
          ))}
        </div>

        {/* ── Desktop right actions ── */}
        <div className="hidden lg:flex items-center gap-4 text-gray-600">
          <button
            type="button"
            aria-label="Toggle theme"
            className="hover:text-[#009849] transition-colors"
          >
            <Sun size={20} />
          </button>

          <button
            type="button"
            className="flex items-center gap-1 text-sm font-semibold border border-gray-200 rounded-lg px-3 py-1.5 hover:border-[#009849] hover:text-[#009849] transition-colors"
          >
            <Globe size={15} /> English <ChevronDown size={13} />
          </button>

          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => dispatch(logout())}
              className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-red-600 transition-colors"
            >
              <LogOut size={18} /> Logout
            </button>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-2 text-sm font-bold text-white bg-[#009849] px-4 py-2 rounded-xl hover:bg-[#007a3d] transition-colors"
            >
              <User size={16} /> Login
            </Link>
          )}
        </div>

        {/* ── Hamburger toggle (mobile only) ── */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isOpen}
          className="lg:hidden flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 text-gray-900 hover:bg-gray-50 transition-colors"
        >
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* ── MOBILE MENU OVERLAY ──
          Fixed fullscreen, no horizontal overflow, no drag needed
      ── */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm"
            style={{ zIndex: 490 }}
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-down panel */}
          <div
            className="lg:hidden fixed left-0 right-0 bg-white shadow-2xl"
            style={{
              top: 57,          /* navbar height */
              zIndex: 495,
              maxHeight: 'calc(100vh - 57px)',
              overflowY: 'auto',
              /* prevent any horizontal scroll */
              overflowX: 'hidden',
              width: '100%',
            }}
          >
            {/* Nav links */}
            <div className="flex flex-col divide-y divide-gray-100">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center px-6 py-4 text-base font-semibold transition-colors ${
                    location.pathname === item.path
                      ? 'text-[#009849] bg-green-50'
                      : 'text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  {location.pathname === item.path && (
                    <span className="w-1.5 h-5 bg-[#009849] rounded-full mr-3 shrink-0" />
                  )}
                  {item.name}
                </Link>
              ))}
            </div>

            {/* Bottom actions */}
            <div className="p-5 flex flex-col gap-3 border-t border-gray-100 bg-gray-50">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => { dispatch(logout()); setIsOpen(false); }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-red-200 text-red-600 font-bold text-sm hover:bg-red-50 transition-colors"
                >
                  <LogOut size={18} /> Logout
                </button>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#009849] text-white font-bold text-sm hover:bg-[#007a3d] transition-colors"
                >
                  <User size={18} /> Sign In
                </Link>
              )}

              <div className="flex items-center justify-center gap-6 pt-1">
                <button
                  type="button"
                  aria-label="Toggle theme"
                  className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-[#009849] transition-colors"
                >
                  <Sun size={18} /> Theme
                </button>
                <span className="text-gray-200">|</span>
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-[#009849] transition-colors"
                >
                  <Globe size={18} /> English
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default Navbar;