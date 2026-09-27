import React, { useRef } from "react";

// Replica of vayy_app/src/auth/components/OTPInput.jsx
// 6 boxes 48x56, radius 12, border 1.5px #e5e7eb, text 22/700 #111827, gap 10.
// Filled -> border #009849 bg #f0faf2 | error -> border #ef4444 bg #fef2f2.

export default function OTPInput({
  length = 6,
  value = [],
  onChange,
  onComplete,
  error = false,
  disabled = false,
  className = "",
}) {
  const refs = useRef([]);

  const chars = Array.isArray(value) ? value : [];
  const setAt = (i, ch) => {
    const next = [...chars];
    next[i] = ch;
    onChange?.(next);
    if (next.filter(Boolean).length === length) onComplete?.(next.join(""));
  };

  const handleChange = (i, e) => {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) return;
    const ch = raw[raw.length - 1];
    setAt(i, ch);
    if (raw.length === 1 && i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      if (!chars[i] && i > 0) {
        refs.current[i - 1]?.focus();
        setAt(i - 1, "");
      } else {
        setAt(i, "");
      }
    }
  };

  const handlePaste = (e) => {
    const text = (e.clipboardData?.getData("text") || "").replace(/\D/g, "").slice(0, length);
    if (!text) return;
    e.preventDefault();
    const next = Array.from({ length }, (_, i) => text[i] || "");
    onChange?.(next);
    onComplete?.(next.join(""));
    refs.current[Math.min(text.length, length - 1)]?.focus();
  };

  return (
    <div className={`flex items-center justify-center gap-2.5 ${className}`}>
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={6}
          disabled={disabled}
          value={chars[i] || ""}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          aria-label={`Digit ${i + 1}`}
          className={`h-14 w-12 rounded-[12px] border-[1.5px] bg-white text-center text-[22px] font-bold text-[#111827] outline-none transition-colors disabled:opacity-60 ${
            error
              ? "border-[#ef4444] bg-[#fef2f2]"
              : chars[i]
                ? "border-[#009849] bg-[#f0faf2]"
                : "border-[#e5e7eb] focus:border-[#009849]"
          }`}
        />
      ))}
    </div>
  );
}
