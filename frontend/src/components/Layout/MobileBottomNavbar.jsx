import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { Home, Route, Map, Bell, User } from "lucide-react";

export default function MobileBottomNavbar() {
  const location = useLocation();
  const { isAuthenticated, user } = useSelector((state) => state.auth || {});
  
  // Passenger slice notifications count
  const passengerNotifications = useSelector(
    (state) => state.passenger?.notifications || []
  );

  // If not logged in, do not render bottom nav
  if (!isAuthenticated) return null;

  const role = user?.role || "passenger";

  // Determine Live Tracking and Profile paths based on user role
  const livePath = role === "driver" ? "/driver/live" : "/passenger/live";
  const profilePath =
    role === "driver" ? "/driver/profile/update" : "/passenger/profile/update";

  const navItems = [
    {
      name: "Home",
      path: "/",
      icon: Home,
      isActive: (pathname) => pathname === "/" || pathname === "/dashboard",
    },
    {
      name: "Routes",
      path: "/routes",
      icon: Route,
      isActive: (pathname) => pathname === "/routes",
    },
    {
      name: "Live Map",
      path: livePath,
      icon: Map,
      isActive: (pathname) =>
        pathname === "/driver/live" || pathname === "/passenger/live",
      isLive: true,
    },
    {
      name: "Alerts",
      path: "/notifications",
      icon: Bell,
      isActive: (pathname) => pathname === "/notifications",
      badgeCount: role === "driver" ? 0 : passengerNotifications.length,
    },
    {
      name: "Profile",
      path: profilePath,
      icon: User,
      isActive: (pathname) =>
        pathname === "/driver/profile/update" ||
        pathname === "/passenger/profile/update",
    },
  ];

  return (
    <div
      className="xl:hidden fixed left-4 right-4 z-[490] flex h-[68px] items-center justify-around rounded-[18px] border border-white/20 bg-white/75 px-2 shadow-[0_8px_32px_0_rgba(15,23,42,0.12)] backdrop-blur-md transition-all duration-300"
      style={{
        bottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {navItems.map((item) => {
        const active = item.isActive(location.pathname);
        const Icon = item.icon;
        
        // Colors from Vayy Design System
        // Active item uses #009849. Live tracking uses #00E676.
        const activeColor = item.isLive ? "#00E676" : "#009849";
        const color = active ? activeColor : "#94a3b8";

        return (
          <Link
            key={item.name}
            to={item.path}
            className="relative flex flex-col items-center justify-center gap-0.5 py-1 w-14 rounded-xl transition-all duration-200 active:scale-90"
            aria-label={item.name}
          >
            <div className="relative flex items-center justify-center">
              <Icon
                size={21}
                color={color}
                strokeWidth={active ? 2.5 : 2}
                className={`transition-colors duration-200 ${
                  active && item.isLive ? "animate-pulse" : ""
                }`}
              />
              
              {/* Notification Badge */}
              {item.badgeCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-sm">
                  {item.badgeCount}
                </span>
              )}

              {/* Live Tracking Indicator Dot */}
              {item.isLive && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00E676] opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00E676]"></span>
                </span>
              )}
            </div>

            {/* Text label below icon */}
            <span
              className="text-[10px] font-semibold leading-none tracking-tight transition-colors duration-200 truncate w-full text-center"
              style={{ color }}
            >
              {item.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
