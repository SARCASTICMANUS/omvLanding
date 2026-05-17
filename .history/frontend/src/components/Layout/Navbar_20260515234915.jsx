import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../features/auth/authSlice';
import mmm from '../../assets/mmm.png';
import { Sun, Globe, User, LogOut, Menu, X } from 'lucide-react';

const Navbar = () => {
  const location = useLocation();
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.auth || {});
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { name: 'Home', path: '/' },
    { name: 'Live Tracking', path: '/tracking' },
    { name: 'Routes', path: '/routes' },
    { name: 'About Us', path: '/about' },
    { name: 'Support', path: '/contact' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-transparent backdrop-blur-md border-b border-white/10 shadow-none">
      <div className="flex items-center gap-2">
        <img src={mmm} alt="Vayy Logo" className="h-8 w-8" />
        <span className="text-xl font-bold tracking-tight text-gray-900">VAYY</span>
      </div>

      {/* Desktop Menu */}
      <div className="hidden lg:flex items-center gap-8">
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            className={`text-sm font-medium transition ${
              location.pathname === item.path ? 'text-emerald-600' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {item.name}
          </Link>
        ))}
      </div>

      <div className="hidden lg:flex items-center gap-6 text-gray-600">
        <Sun size={20} className="cursor-pointer hover:text-emerald-600" />
        {isAuthenticated ? (
          <button onClick={() => dispatch(logout())} className="text-gray-600 hover:text-red-600">
            <LogOut size={20} />
          </button>
        ) : (
          <Link to="/login" className="flex items-center gap-2 text-emerald-600 font-medium">
             <User size={20} /> Login
          </Link>
        )}
      </div>

      {/* Hamburger Toggle */}
      <div className="lg:hidden bg-">
        <button onClick={() => setIsOpen(!isOpen)} className="text-gray-900">
          {isOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 w-full bg-white border-b border-gray-100 p-6 flex flex-col gap-4 lg:hidden shadow-lg">
          {navItems.map((item) => (
            <Link key={item.name} to={item.path} onClick={() => setIsOpen(false)} className="text-lg font-medium text-gray-900">
              {item.name}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
