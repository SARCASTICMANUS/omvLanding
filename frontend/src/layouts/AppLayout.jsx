import React from "react";
import { useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { Navbar, MobileBottomNavbar } from "../components/Layout";
import { NotificationHandler } from "../components/Shared";
import VerificationGate from "../features/verification/VerificationGate";

// Mobile shell: guests clear the 56px top bar, authed users clear the
// fixed 62px bottom tab bar (mobile parity). Desktop clears the top nav.

const AppLayout = ({ children, showNavbar = true, flush = false }) => {
  const location = useLocation();
  const isAuthenticated = useSelector(
    (state) => state.auth?.isAuthenticated
  );
  const hideGuestHomeNav = !isAuthenticated && location.pathname === "/";

  const shellPad =
    showNavbar && !flush
      ? isAuthenticated
        ? "pt-0 lg:pt-[72px] pb-[96px] lg:pb-0"
        : hideGuestHomeNav
          ? ""
          : "pt-14 lg:pt-[72px] lg:pb-0"
      : "";

  return (
    <div className={`min-h-screen bg-[#F8FAF9] ${shellPad}`}>
      <NotificationHandler />
      {showNavbar && <Navbar />}
      <main className="w-full">{children}</main>
      {showNavbar && <MobileBottomNavbar />}
      {/* Mounted LAST and outside <main> so the overlay sits above the router
          outlet: deep links, back/forward and reloads change the route
          underneath but can never reveal an unreachable page. */}
      <VerificationGate />
    </div>
  );
};

export default AppLayout;
