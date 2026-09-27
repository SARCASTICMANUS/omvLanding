import React, { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../../features/auth/authSlice";
import { APP_ROUTES } from "../../constants/routes";
import { DRIVER_ROLES } from "../../constants/roles";
import { normalizeRole } from "../../utils/roles";
import { User, LogOut, Bell, LogIn } from "lucide-react";
import omvIcon from "../../assets/omvIcon.png";

// Desktop: fixed top nav (web-only affordance).
// Mobile: guests get a slim 56px top bar; authenticated users get the
// bottom tab bar instead (exact mobile parity — no hamburger menu).

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.auth || {});
  const notifications = useSelector(
    (state) => state.passenger?.notifications || []
  );
  const unreadCount = notifications.filter((n) => !n?.read).length;

  const isTransparent = location.pathname === "/";
  const hideGuestHomeNav = !isAuthenticated && isTransparent;

  useEffect(() => {
    document.body.style.overflow = "";
  }, [location.pathname]);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/");
  };

  const isDriver = DRIVER_ROLES.includes(normalizeRole(user?.role));

  const navItems = isAuthenticated
    ? [
        { name: "Home", path: APP_ROUTES.root },
        { name: "My Trips", path: APP_ROUTES.trips },
        ...(!isDriver ? [{ name: "Alerts", path: APP_ROUTES.notifications }] : []),
      ]
    : [
        { name: "Routes", path: APP_ROUTES.routes },
        { name: "About Us", path: APP_ROUTES.about },
        { name: "Support", path: APP_ROUTES.contact },
      ];

  return (
    <>
      {/* ── DESKTOP NAVBAR ── */}
      {!hideGuestHomeNav && <nav
        className={`fixed inset-x-0 top-0 z-[500] hidden items-center justify-between px-5 py-3 lg:flex ${
          isTransparent
            ? "bg-transparent shadow-none"
            : "border-b border-gray-100 bg-white/90 shadow-sm backdrop-blur-md"
        }`}
      >
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand-primary text-lg font-black text-white">O</span>
          <img
            src={omvIcon}
            alt="OMV"
            className={`h-6 w-[68px] object-contain ${isTransparent ? "brightness-0 invert" : "brightness-0"}`}
          />
        </Link>

        <div className="flex items-center gap-8">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`text-sm font-semibold transition-colors duration-150 ${
                location.pathname === item.path
                  ? "text-brand-primary"
                  : "text-brand-muted hover:text-brand-ink"
              }`}
              style={
                location.pathname === item.path
                  ? { borderBottom: "2.5px solid #009849", paddingBottom: 2 }
                  : {}
              }
            >
              {item.name}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4 text-brand-muted">
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <Link
                to={APP_ROUTES.notifications}
                aria-label={
                  unreadCount > 0 ? `Alerts (${unreadCount} unread)` : "Alerts"
                }
                className={`relative transition-colors ${
                  location.pathname === APP_ROUTES.notifications
                    ? "text-brand-primary"
                    : "text-brand-muted hover:text-brand-primary"
                }`}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
              <Link
                to={APP_ROUTES.profile}
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
              to={APP_ROUTES.login}
              className="flex items-center gap-2 rounded-vayy bg-brand-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-primaryHover"
            >
              <User size={16} /> Login
            </Link>
          )}
        </div>
      </nav>}

      {/* ── MOBILE TOP BAR (guests only; authed users use the tab bar) ── */}
      {!isAuthenticated && !hideGuestHomeNav && (
        <nav className="fixed inset-x-0 top-0 z-[500] flex h-14 items-center justify-between border-b border-[#F0F0F0] bg-white px-4 lg:hidden">
          <Link to="/" className="flex items-center gap-2">
            <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-brand-primary text-base font-black text-white">O</span>
            <img src={omvIcon} alt="OMV" className="h-5 w-[56px] object-contain brightness-0" />
          </Link>
          <Link
            to={APP_ROUTES.login}
            className="flex items-center gap-1.5 rounded-vayy bg-brand-primary px-4 py-2 text-sm font-bold text-white"
          >
            <LogIn size={15} /> Login
          </Link>
        </nav>
      )}
    </>
  );
};

export default Navbar;
