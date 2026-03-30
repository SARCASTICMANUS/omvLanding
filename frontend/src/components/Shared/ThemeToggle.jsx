import React from 'react';
import { Sun, Moon } from 'lucide-react';

const ThemeToggle = ({ theme, toggleTheme, isDark }) => {
  return (
    <button
      onClick={toggleTheme}
      className="p-3 rounded-2xl bg-bg-main border border-gray-100 dark:border-white/5 text-text-main hover:bg-primary-action hover:text-white transition-all duration-300 shadow-sm flex items-center justify-center group"
      aria-label="Toggle operational mode"
    >
      {isDark ? (
        <Sun className="w-5 h-5 group-hover:rotate-90 transition-transform duration-500" />
      ) : (
        <Moon className="w-5 h-5 group-hover:-rotate-12 transition-transform duration-500" />
      )}
    </button>
  );
};

export default ThemeToggle;
