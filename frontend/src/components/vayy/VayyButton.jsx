import React from "react";

// Replica of vayy_app/src/shared/components/common/VayyButton.jsx
// radius 14, label 15/700, sizes sm 40 / md 48 / lg 56

const SIZES = {
  sm: "min-h-10 px-4 text-[13px] gap-1.5",
  md: "min-h-12 px-5 text-[15px] gap-2",
  lg: "min-h-14 px-6 text-[15px] gap-2",
};

const VARIANTS = {
  primary: "bg-[#009849] text-white border border-[#009849]",
  outline: "bg-white text-[#009849] border-[1.5px] border-[#009849]",
  ghost: "bg-transparent text-[#009849] border border-transparent",
  danger: "bg-[#EF4444] text-white border border-[#EF4444]",
};

export default function VayyButton({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  disabled = false,
  className = "",
  children,
  type = "button",
  ...props
}) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center rounded-v-md font-bold transition-all duration-150 active:opacity-[0.84] disabled:opacity-60 disabled:pointer-events-none ${
        SIZES[size] || SIZES.md
      } ${VARIANTS[variant] || VARIANTS.primary} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
