import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../features/auth/authSlice';
import mmm from '../../assets/mmm.png';
import { Sun, Globe, User, LogOut } from 'lucide-react';

const Navbar = () => {
  const location = useLocation();
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.auth || {});

  const navItems = [
    { name: 'Home', path: '/' },
    { name: 'Live Tracking', path: '/tracking' },
    { name: 'Routes', path: '/routes' },
    { name: 'About Us', path: '/about' },
    { name: 'Support', path: '/contact' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 bg-transparent backdrop-blur-md border-b border-white/10 shadow-none">
      <div className="flex items-center gap-2">
        <img src={mmm} alt="Vayy Logo" className="h-8 w-8" />
        <span className="text-xl font-bold tracking-tight text-gray-900">VAYY</span>
      </div>

      <div className="flex items-center gap-8">
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            className={`text-sm font-medium transition ${
              location.pathname === item.path ? 'text-emerald-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {item.name}
            {location.pathname === item.path && (
              <div className="absolute mt-2 h-0.5 w-8 bg-emerald-600 rounded-full" />
            )}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-6 text-gray-600">
        <Sun size={20} className="cursor-pointer hover:text-emerald-600" />
        <div className="flex items-center gap-1 cursor-pointer hover:text-emerald-600">
          <Globe size={20} />
          <span className="text-sm font-medium">English</span>
        </div>
        
        {isAuthenticated ? (
          <div className="flex items-center gap-3">
             <div className="flex flex-col items-end">
                <span className="text-xs font-semibold text-gray-900">{user?.name || "User"}</span>
             </div>
             <button onClick={() => dispatch(logout())} className="text-gray-600 hover:text-red-600">
                <LogOut size={20} />
             </button>
          </div>
        ) : (
          <Link to="/login" className="flex items-center gap-2 text-emerald-600 font-medium">
             <User size={20} />
             Login
          </Link>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
