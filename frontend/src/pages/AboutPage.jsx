import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Compass, Info } from "lucide-react";
import { VayyCard } from "../components/vayy";

// Mobile info-screen style: green rounded-b-[32px] header + white content cards.

export default function AboutPage() {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] pb-24 font-sans lg:pb-16">
      {/* ── Green header (LandingInfoScreen) ── */}
      <header className="relative overflow-hidden rounded-b-[32px] bg-[#009849] px-5 pb-4 pt-5">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <span className="absolute -right-10 -top-16 h-[90%] w-[70%] rotate-[25deg] rounded-[120px] bg-[#00B857] opacity-25" />
          <span className="absolute -right-5 -top-20 h-[70%] w-[50%] rotate-[35deg] rounded-[100px] bg-white/10" />
        </div>
        <div className="relative z-10 mx-auto flex w-full max-w-3xl items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Go back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#111827] shadow-[0_2px_8px_rgba(0,0,0,0.18)] transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <ChevronLeft size={22} strokeWidth={2.5} />
          </button>
          <h1 className="text-[20px] font-black leading-tight text-white">About OMV</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-3.5 px-5 pb-10 pt-5">
        <VayyCard className="p-[18px]">
          <span className="mb-3 flex h-[52px] w-[52px] items-center justify-center rounded-[16px] bg-[#ECFAF1]">
            <Info size={26} className="text-[#009849]" aria-hidden="true" />
          </span>
          <p className="text-[14px] font-medium leading-[22px] text-[#374151]">
            OMV helps people share everyday bike journeys already travelling nearby.
            Find a ride along your route, see your pickup details,
            and follow the trip live from your phone or browser.
          </p>
        </VayyCard>

        <VayyCard className="p-[18px]">
          <span className="mb-3 flex h-[52px] w-[52px] items-center justify-center rounded-[16px] bg-[#EFF6FF]">
            <Compass size={26} className="text-[#2563EB]" aria-hidden="true" />
          </span>
          <h2 className="mb-2 text-[16px] font-extrabold text-[#111827]">Our Vision</h2>
          <p className="text-[14px] font-medium leading-[22px] text-[#374151]">
            To make local travel easier by helping riders and drivers meet on journeys
            they already share, with clear trip details and live updates along the way.
          </p>
        </VayyCard>
      </main>
    </div>
  );
}
