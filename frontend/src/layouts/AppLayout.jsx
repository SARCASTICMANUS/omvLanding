import React from "react";
import Navbar from "../components/Layout/Navbar";

const AppLayout = ({ children, showNavbar = true, flush = false }) => (
  <div className={`min-h-screen bg-slate-50 w-full overflow-x-hidden relative ${showNavbar && !flush ? "pt-[64px] sm:pt-[57px]" : ""}`}>
    {showNavbar && <Navbar />}
    <main className="w-full">{children}</main>
  </div>
);

export default AppLayout;

