import React from "react";

// Replica of vayy_app/src/shared/components/common/RouteLine.jsx
// 12px green start dot -> dashed track -> green fill to progress% ->
// 26px white/green knob riding the track -> 14px white end dot with red ring.

export default function RouteLine({ progress = 0, knobIcon = null, className = "" }) {
  const pct = Math.max(0, Math.min(100, Number(progress) || 0));

  return (
    <div className={`flex h-[34px] items-center ${className}`}>
      <span className="h-3 w-3 shrink-0 rounded-full bg-[#009849]" />
      <div className="relative mx-1 h-[2px] flex-1 rounded-full border-t-2 border-dashed border-[#E5E7EB]">
        <span
          className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[#009849] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
        <span
          className="absolute top-1/2 flex h-[26px] w-[26px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#009849] bg-white text-[#009849] shadow-v-sm transition-all duration-500"
          style={{ left: `${pct}%` }}
        >
          {knobIcon}
        </span>
      </div>
      <span className="h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[#EF4444] bg-white" />
    </div>
  );
}
