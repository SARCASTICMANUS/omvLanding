import React from "react";

// Replica of vayy_app/src/shared/components/common/MetricChip.jsx
// bg #f9fafb, 1px #E5E7EB border, radius 10, px-3 py-2, value 13/800, label 11 muted

export default function MetricChip({ icon: Icon, label, value, green = false, className = "" }) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-v-sm border px-3 py-2 ${
        green
          ? "border-[#BBF7D0] bg-[#DCfce7]"
          : "border-[#E5E7EB] bg-[#f9fafb]"
      } ${className}`}
    >
      {Icon && <Icon size={16} className={green ? "text-[#009849]" : "text-[#6B7280]"} />}
      <span className="flex flex-col leading-none">
        <span
          className={`text-[13px] font-extrabold ${
            green ? "text-[#009849]" : "text-[#111827]"
          }`}
        >
          {value}
        </span>
        {label && <span className="mt-0.5 text-[11px] text-[#6B7280]">{label}</span>}
      </span>
    </div>
  );
}
