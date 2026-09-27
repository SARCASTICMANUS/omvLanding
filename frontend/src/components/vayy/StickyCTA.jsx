import React from "react";

// Replica of vayy_app/src/auth/components/BottomStickyButton.jsx
// height 56, radius 18, green glow shadow, label 16/700 ls .3, disabled opacity .5.

export default function StickyCTA({
  children,
  onClick,
  disabled = false,
  className = "",
  type = "button",
}) {
  return (
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-[480] flex justify-center px-6 pb-4 ${className}`}
    >
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className="pointer-events-auto h-14 w-full max-w-[560px] rounded-[18px] bg-[#009849] text-[16px] font-bold tracking-[0.3px] text-white shadow-[0_4px_12px_rgba(0,152,73,0.35)] transition-all active:opacity-90 disabled:opacity-50 lg:max-w-[720px]"
      >
        {children}
      </button>
    </div>
  );
}
