import React from "react";
import omvIcon from "../../assets/omvIcon.png";

// Replica of vayy_app/src/shared/components/common/Logo.jsx
// Green app mark paired with the OMV wordmark asset.

export default function Logo({ className = "", size = 38 }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span
        className="flex items-center justify-center rounded-[12px] bg-[#009849] font-black text-white"
        style={{ width: size, height: size, fontSize: size * 0.53 }}
      >
        O
      </span>
      <img
        src={omvIcon}
        alt="OMV"
        className="h-6 w-[68px] object-contain brightness-0"
      />
    </div>
  );
}
