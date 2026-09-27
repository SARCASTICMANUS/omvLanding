import React from "react";

// Replica of vayy_app/src/shared/components/common/VayyCard.jsx
// white, radius 18, 1px #F0F0F0 border, padding 16, shadow-sm

export default function VayyCard({ className = "", children, ...props }) {
  return (
    <div
      className={`rounded-vayy border border-[#F0F0F0] bg-white p-4 shadow-v-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
