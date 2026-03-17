import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../../features/auth/authSlice";
import { Menu, LogOut, User } from "lucide-react";

const Header = ({ toggleSidebar }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  return (
    <header className="bg-white h-16 shadow-sm flex items-center justify-between px-6 z-20 relative">
      <div className="flex items-center gap-4">
        {/* Mobile Sidebar Toggle */}
        <button onClick={toggleSidebar} className="lg:hidden text-gray-600">
          <Menu size={24} />
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
            V
          </div>
          <span className="text-xl font-bold text-gray-800 tracking-tight">
            Vayy
          </span>
        </div>
      </div>

      {/* User Info & Actions */}
      <div className="flex items-center gap-6">
        <div className="hidden md:flex flex-col items-end">
          <span className="text-sm font-bold text-gray-800">
            {user?.name || "User"}
          </span>
          <span className="text-xs text-gray-500 capitalize px-2 py-0.5 bg-gray-100 rounded-full">
            {user?.role}
          </span>
        </div>

        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-600">
          <User size={20} />
        </div>

        <button
          onClick={() => dispatch(logout())}
          className="text-gray-500 hover:text-red-600 transition-colors"
          title="Logout"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
};

export default Header;
