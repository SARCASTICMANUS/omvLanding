import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../features/auth/authSlice';
import { APP_ROUTES } from '../../constants/routes';
import mmm from '../../assets/mmm.png';
import { Sun, User, LogOut, Menu, X, LogIn } from 'lucide-react';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state) => state.auth || {});
  
  const [isOpen, setIsOpen] = useState(false);

  /* ── Check if currently on Trip Planner (e.g. root) ── */
  const isTransparent = location.pathname === "/";

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

  const handleLogout = () => {
    dispatch(logout());
    setIsOpen(false);
    navigate('/');
  };

  const userRole = useSelector((state) => state.auth?.user?.role);
  const isDriver = userRole === 'driver';

  const navItems = [
    { name: 'Home',          path: APP_ROUTES.root },
    { name: isDriver ? 'Driver Live' : 'Live Tracking', path: isDriver ? APP_ROUTES.driverLive : APP_ROUTES.passengerLive },
    { name: 'Routes',        path: APP_ROUTES.routes },
    { name: 'About Us',      path: APP_ROUTES.about },
    { name: 'Support',       path: APP_ROUTES.contact },
  ];


  return (
    <>
      {/* ── NAVBAR BAR ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-[500] items-center justify-between px-5 py-3 box-border transition-all duration-300 hidden lg:flex ${isTransparent ? 'bg-transparent shadow-none' : 'bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm'}`}
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img src={mmm} alt="Vayy Logo" className="h-8 w-8 object-contain" />
          <span className={`text-xl font-black tracking-tight ${isTransparent ? 'text-white' : 'text-brand-ink'}`}>VAYY</span>
        </Link>

        {/* ── Desktop nav links (center) ── */}
        <div className="hidden lg:flex items-center gap-8">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`text-sm font-semibold transition-colors duration-150 ${
                location.pathname === item.path
                  ? 'text-brand-primary'
                  : 'text-brand-muted hover:text-brand-ink'
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
        <div className="hidden lg:flex items-center gap-4 text-brand-muted">
          <button
            type="button"
            aria-label="Toggle theme"
            className="transition-colors text-brand-muted hover:text-brand-primary"
          >
            <Sun size={20} />
          </button>

          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <Link
                to="/profile"
                className="flex items-center gap-2 text-sm font-semibold transition-colors text-brand-muted hover:text-brand-primary"
              >
                <User size={18} /> Profile
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-2 text-sm font-semibold transition-colors text-brand-muted hover:text-red-600"
              >
                <LogOut size={18} /> Logout
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-2 text-sm font-bold text-white bg-brand-primary px-4 py-2 rounded-vayy hover:bg-brand-primaryHover transition-colors"
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
          className={`lg:hidden flex items-center justify-center w-10 h-10 rounded-vayy border transition-colors ${isTransparent ? 'border-white/20 text-white hover:bg-white/10' : 'border-gray-200 text-brand-ink hover:bg-gray-50'}`}
        >
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* ── MOBILE MENU OVERLAY ── */}
      {isOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm"
            style={{ zIndex: 490 }}
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div
            className="lg:hidden fixed left-0 right-0 bg-white shadow-2xl"
            style={{
              top: 57,
              zIndex: 495,
              maxHeight: 'calc(100vh - 57px)',
              overflowY: 'auto',
              overflowX: 'hidden',
              width: '100%',
            }}
          >
            <div className="flex flex-col divide-y divide-gray-100">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center px-6 py-4 text-base font-semibold transition-colors ${
                    location.pathname === item.path
                      ? 'text-brand-primary bg-green-50'
                      : 'text-brand-ink hover:bg-gray-50'
                  }`}
                >
                  {location.pathname === item.path && (
                    <span className="w-1.5 h-5 bg-brand-primary rounded-full mr-3 shrink-0" />
                  )}
                  {item.name}
                </Link>
              ))}
            </div>

            <div className="p-5 flex flex-col gap-4 border-t border-gray-100 bg-gray-50">
              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 py-3 rounded-vayy bg-white border border-gray-200 text-brand-ink font-bold text-sm hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <Sun size={18} /> Settings
                </button>
              </div>

              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-vayy border-2 border-red-100 text-red-600 font-bold text-sm hover:bg-red-50 transition-colors"
                >
                  <LogOut size={18} /> Logout
                </button>
              ) : (
                <Link
                  to="/login"
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-vayy bg-brand-primary text-white font-bold text-sm hover:bg-brand-primaryHover transition-colors shadow-lg shadow-green-200"
                >
                  <LogIn size={18} /> Login
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default Navbar;
