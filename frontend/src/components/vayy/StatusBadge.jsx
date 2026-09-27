import React from "react";

// Replica of vayy_app/src/shared/components/common/StatusBadge.jsx

const TONES = {
  success: "bg-[#DCfce7] border-[#BBF7D0] text-[#009849]",
  error: "bg-[#FEF2F2] border-[#FECACA] text-[#EF4444]",
  warning: "bg-[#FEF3C7] border-[#FDE68A] text-[#F59E0B]",
  neutral: "bg-[#F3F4F6] border-[#E5E7EB] text-[#6B7280]",
  live: "bg-[#E0F5E8] border-[#BBF7D0] text-[#007A3B]",
};

export default function StatusBadge({ tone = "success", className = "", children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-extrabold leading-none ${
        TONES[tone] || TONES.success
      } ${className}`}
    >
      {children}
    </span>
  );
}
