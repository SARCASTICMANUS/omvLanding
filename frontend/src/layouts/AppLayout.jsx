import React from "react";
import { Navbar } from "../components/layout";
import { NotificationHandler } from "../components/shared";

const AppLayout = ({ children, showNavbar = true, flush = false }) => (
  <div className={`min-h-screen bg-slate-50 ${showNavbar && !flush ? "pt-20" : ""}`}>
    <NotificationHandler />
    {showNavbar && <Navbar />}
    <main>{children}</main>
  </div>
);

export default AppLayout;
