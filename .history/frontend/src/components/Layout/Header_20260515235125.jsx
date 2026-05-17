import React, { useState, useRef, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../../features/auth/authSlice";
import { Menu, X, LogOut, User } from "lucide-react";

const Header = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    dispatch(logout());
  };

  return (
    <header className="sticky top-0 z-[60] border-b border-gray-100 bg-white w-10">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        
        {/* LEFT: Hamburger Button */}
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="relative z-[70] rounded-lg p-2 hover:bg-gray-100 transition text-gray-700"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>


      </div>

      {/* DROPDOWN MENU - Now a compact block */}
      {open && (
        <div
          ref={menuRef}
          className="absolute top-14 left-4 w-64 rounded-xl border border-gray-100 bg-white p-4 shadow-xl z-[60]"
        >
          {/* User Info */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600">
              <User size={18} />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-900 truncate max-w-[140px]">
                {user?.name || "User"}
              </span>
              <span className="text-xs text-gray-500 capitalize">
                {user?.role || "guest"}
              </span>
            </div>
          </div>

          <div className="h-px bg-gray-100 mb-3" />

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      )}
    </header>
  );
};

export default Header;