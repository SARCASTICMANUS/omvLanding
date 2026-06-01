import React from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function MobileBackButton({ onClick, className = "" }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onClick) {
      onClick();
    } else {
      // Default fallback is standard browser history back
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate("/");
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`lg:hidden fixed top-4 left-4 z-[400] flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/60 text-[#071419] shadow-md backdrop-blur-md transition-all hover:bg-white/80 active:scale-95 ${className}`}
      aria-label="Go back"
      style={{
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
      }}
    >
      <ArrowLeft size={20} strokeWidth={2.5} />
    </button>
  );
}
