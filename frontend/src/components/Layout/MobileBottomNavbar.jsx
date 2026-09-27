import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { Home, History, Bell, User, LayoutDashboard } from "lucide-react";
import { DRIVER_ROLES } from "../../constants/roles";
import { normalizeRole } from "../../utils/roles";

// Exact replica of the mobile React Navigation tab bar
// (vayy_app/src/navigation/PassengerNavigator.jsx + DriverNavigator.jsx):
// white bar, borderTop 1px #F0F0F0, top radius 12, height 62 + safe-area,
// label 10/700, active tint #009849, absolute bottom.

export default function MobileBottomNavbar() {
  const location = useLocation();
  const { isAuthenticated, user } = useSelector((state) => state.auth || {});

  const passengerNotifications = useSelector(
    (state) => state.passenger?.notifications || []
  );

  if (!isAuthenticated) return null;

  const role = normalizeRole(user?.role);
  const isDriver = DRIVER_ROLES.includes(role);

  // Tab sets mirror the mobile navigators exactly.
  const navItems = isDriver
    ? [
        {
          name: "Home",
          path: "/driver/live",
          icon: LayoutDashboard,
          active: (p) => p === "/driver/live" || p === "/",
        },
        {
          name: "My Trips",
          path: "/trips",
          icon: History,
          active: (p) => p === "/trips",
        },
        {
          name: "Profile",
          path: "/profile",
          icon: User,
          active: (p) => p === "/profile",
        },
      ]
    : [
        {
          name: "Home",
          path: "/",
          icon: Home,
          active: (p) => p === "/" || p === "/passenger/live",
        },
        {
          name: "My Trips",
          path: "/trips",
          icon: History,
          active: (p) => p === "/trips",
        },
        {
          name: "Alerts",
          path: "/notifications",
          icon: Bell,
          active: (p) => p === "/notifications",
          badgeCount: passengerNotifications.filter((n) => !n?.read).length,
        },
        {
          name: "Profile",
          path: "/profile",
          icon: User,
          active: (p) => p === "/profile",
        },
      ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[490] border-t border-[#F0F0F0] bg-white lg:hidden"
      style={{
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        paddingTop: 4,
        paddingBottom: "calc(14px + env(safe-area-inset-bottom, 0px))",
      }}
      aria-label="Primary"
    >
      <div className="flex h-[62px] items-stretch justify-around">
        {navItems.map((item) => {
          const isActive = item.active(location.pathname);
          const Icon = item.icon;
          const color = isActive ? "#009849" : "#9CA3AF";

          return (
            <Link
              key={item.name}
              to={item.path}
              className="relative flex flex-1 flex-col items-center justify-center gap-1 pt-1 transition-transform active:scale-95"
              aria-current={isActive ? "page" : undefined}
            >
              <span className="relative">
                <Icon size={24} color={color} strokeWidth={isActive ? 2.4 : 2} />
                {item.badgeCount > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#EF4444] px-1 text-[9px] font-bold leading-none text-white">
                    {item.badgeCount > 99 ? "99+" : item.badgeCount}
                  </span>
                )}
              </span>
              <span
                className="w-full truncate px-1 text-center text-[10px] font-bold leading-none"
                style={{ color }}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
