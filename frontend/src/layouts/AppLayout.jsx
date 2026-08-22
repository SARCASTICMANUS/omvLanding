import React from "react";
import { Navbar, MobileBottomNavbar } from "../components/layout";
import { NotificationHandler } from "../components/shared";

const AppLayout = ({ children, showNavbar = true, flush = false }) => (
  <div className={`min-h-screen bg-slate-50 ${showNavbar && !flush ? "pt-0 lg:pt-20 pb-[120px] lg:pb-0" : ""}`}>
    <NotificationHandler />
    {showNavbar && <Navbar />}
    <main className="w-full">{children}</main>
    {showNavbar && <MobileBottomNavbar />}
  </div>
);

export default AppLayout;
