import React from "react";

// Replica of vayy_app/src/shared/components/common/LiveDot.jsx
// 10px solid #00E676 dot + halo ring scaling 1 -> 1.9 -> 1 on an 800ms loop.

export default function LiveDot({ size = 10, className = "" }) {
  return (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00E676] opacity-[0.22]"
        style={{ animationDuration: "800ms" }}
      />
      <span
        className="relative inline-flex rounded-full bg-[#00E676]"
        style={{ width: size, height: size }}
      />
    </span>
  );
}
