import React from 'react';
import { ChevronDown } from 'lucide-react';

// The gold "bubble" label that overlaps the input
export const OverlappingField = ({ label, children, className = "" }) => (
  <div className={`relative pt-3 mb-4 ${className}`}>
    <div className="absolute top-0 left-0 bg-[#b79926] text-white text-[11px] font-black px-4 py-1.5 rounded-t-xl rounded-br-xl z-10 shadow-sm uppercase tracking-wider">
      {label}
    </div>
    <div className="rounded-2xl overflow-hidden shadow-sm">
      {children}
    </div>
  </div>
);

// The custom gold dropdown
export const SelectField = ({ value, options, onChange }) => (
  <div className="relative group">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[#b79926] text-white py-4 px-5 rounded-xl appearance-none font-bold text-sm outline-none cursor-pointer"
    >
      <option value="" disabled>Select...</option>
      {options.map((opt) => (
        <option key={opt} value={opt} className="bg-white text-black font-medium">
          {opt}
        </option>
      ))}
    </select>
    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-white pointer-events-none" size={20} />
  </div>
);

// The solid gray input used for Email, DOB, and Vehicle No
export const GrayInput = ({ label, type = "text", ...props }) => (
  <div className="mb-4">
    {label && <label className="block text-[11px] font-black uppercase mb-1 ml-1 text-gray-500 tracking-widest">{label}</label>}
    <input
      {...props}
      type={type}
      className="w-full bg-[#999999] text-white placeholder:text-gray-200 py-4 px-5 rounded-2xl font-bold text-sm outline-none border-none focus:ring-2 focus:ring-[#b79926] transition-all"
    />
  </div>
);