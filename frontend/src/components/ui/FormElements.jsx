import React from "react";
import { ChevronDown } from "lucide-react";

export function OverlappingField({
  label,
  children,
  className = "",
}) {
  return (
    <div className={`relative mb-4 pt-3 ${className}`}>
      <div className="absolute left-0 top-0 z-10 rounded-t-xl rounded-br-xl bg-[#b79926] px-4 py-1.5 text-[11px] font-black uppercase tracking-wider text-white shadow-sm">
        {label}
      </div>

      <div className="overflow-hidden rounded-2xl shadow-sm">
        {children}
      </div>
    </div>
  );
}

export function SelectField({
  value = "",
  options = [],
  onChange,
  placeholder = "Select...",
  className = "",
  selectClassName = "",
  optionLabelKey = "label",
  optionValueKey = "value",
  disabled = false,
  name,
}) {
  return (
    <div className={`relative group ${className}`}>
      <select
        name={name}
        value={value}
        onChange={(e) => onChange?.(e.target.value, e)}
        disabled={disabled}
        className={`w-full appearance-none rounded-xl bg-[#b79926] px-5 py-4 pr-12 text-sm font-bold text-white outline-none transition-all disabled:cursor-not-allowed disabled:opacity-60 ${selectClassName}`}
      >
        <option value="" disabled>
          {placeholder}
        </option>

        {options.map((opt, index) => {
          const isObject = typeof opt === "object" && opt !== null;
          const optionValue = isObject ? opt[optionValueKey] : opt;
          const optionLabel = isObject ? opt[optionLabelKey] : opt;

          return (
            <option
              key={`${String(optionValue)}-${index}`}
              value={optionValue}
              className="bg-white font-medium text-black"
            >
              {optionLabel}
            </option>
          );
        })}
      </select>

      <ChevronDown
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white"
        size={20}
      />
    </div>
  );
}

export function GrayInput({
  label,
  type = "text",
  className = "",
  inputClassName = "",
  ...props
}) {
  return (
    <div className={`mb-4 ${className}`}>
      {label ? (
        <label className="ml-1 mb-1 block text-[11px] font-black uppercase tracking-widest text-gray-500">
          {label}
        </label>
      ) : null}

      <input
        {...props}
        type={type}
        className={`w-full rounded-2xl border-none bg-[#999999] px-5 py-4 text-sm font-bold text-white outline-none transition-all placeholder:text-gray-200 focus:ring-2 focus:ring-[#b79926] ${inputClassName}`}
      />
    </div>
  );
}