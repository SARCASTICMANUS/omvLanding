import React from "react";
import { useNavigate } from "react-router-dom";

// Replica of vayy_app/src/shared/components/navigation/Header.jsx
// back hit-box 38x38, chevron glyph #111827, title 22/900, subtitle 13/700 primary.

export default function ScreenHeader({
  title,
  subtitle,
  onBack,
  right = null,
  className = "",
}) {
  const navigate = useNavigate();
  const handleBack = onBack || (() => navigate(-1));

  return (
    <header
      className={`flex min-h-[56px] items-center justify-between px-4 py-3 ${className}`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Back"
          className="flex h-[38px] w-[38px] items-center justify-center text-[#111827] transition-opacity active:opacity-60"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 18l-6-6l6-6" />
          </svg>
        </button>
        <div className="flex flex-col">
          <span className="text-[22px] font-black leading-tight text-[#111827]">
            {title}
          </span>
          {subtitle && (
            <span className="text-[13px] font-bold text-[#009849]">{subtitle}</span>
          )}
        </div>
      </div>
      {right}
    </header>
  );
}
