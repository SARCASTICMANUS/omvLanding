import React, { useMemo, useState } from "react";
import {
  ChevronLeft,
  MapPin,
  Navigation,
  ArrowRight,
  Compass,
} from "lucide-react";
import LocationSearch from "../../../components/LocationSearch";
import img from "../../../assets/img1.png";

/**
 * Reusable label with Vayy branding typography
 */
function InputLabel({ children, icon: Icon }) {
  return (
    <label className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-neutral-400">
      {Icon && <Icon size={14} className="text-black" strokeWidth={2.5} />}
      {children}
    </label>
  );
}

/**
 * Modern Input wrapper with glassmorphism transition
 * Important: do NOT hide overflow here, otherwise autocomplete gets clipped.
 */
function InputShell({ children }) {
  return (
    <div className="group relative z-20 flex w-full items-center rounded-xl border border-neutral-100 bg-neutral-50 transition-all duration-300 focus-within:border-black focus-within:bg-white focus-within:ring-1 focus-within:ring-black">
      <div className="w-full rounded-xl">{children}</div>
    </div>
  );
}

export default function PassengerTripPlanner({
  onBack,
  onNext,
  loading = false,
}) {
  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);

  const canProceed = useMemo(() => {
    return Boolean(
      pickup?.lat && pickup?.lon && destination?.lat && destination?.lon
    );
  }, [pickup, destination]);

  const handleNext = () => {
    if (!canProceed || loading) return;
    onNext?.({ from: pickup, to: destination });
  };

  return (
    <div className="relative min-h-screen w-full bg-white">
      {/* Background Image Layer: Visible only on Desktop (LG) */}
      <div className="absolute inset-0 z-0 hidden lg:block">
        <img
          src={img}
          alt="Vayy Urban Mobility"
          className="h-full w-full object-cover grayscale-[10%]"
        />
        <div className="absolute inset-0 bg-black/30" />
      </div>

      <div className="relative z-10 flex min-h-screen">
        {/* LEFT PANEL: The functional Vayy UI */}
        <div className="flex w-full flex-col bg-white px-8 pt-12 sm:px-12 lg:h-screen lg:w-[480px] lg:shadow-[30px_0_60px_-15px_rgba(0,0,0,0.15)]">
          {/* Header */}
          <div className="mb-14 flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              className="group flex h-10 w-10 items-center justify-center rounded-full border border-neutral-100 transition-all hover:bg-black hover:text-white"
              aria-label="Go back"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>

            <h1 className="text-2xl font-black tracking-tighter text-black">
              VAYY
            </h1>

            <div className="w-10" />
          </div>

          <div className="flex-1">
            <h2 className="mb-8 text-xl font-bold tracking-tight text-neutral-900">
              Where are you headed?
            </h2>

            <div className="space-y-8">
              {/* Pickup Input Block */}
              <div className="animate-in fade-in slide-in-from-left-4 relative z-30 duration-500">
                <InputLabel icon={MapPin}>Pickup Point</InputLabel>
                <InputShell>
                  <LocationSearch
                    placeholder="Search pickup location"
                    onSelect={setPickup}
                    className="w-full border-none bg-transparent px-5 py-4 text-[15px] placeholder:text-neutral-400 outline-none focus:ring-0"
                  />
                </InputShell>
              </div>

              {/* Destination Input Block */}
              <div className="animate-in fade-in slide-in-from-left-4 relative z-20 duration-700">
                <div className="absolute -top-8 left-4 h-8 w-[1px] bg-neutral-100" />

                <InputLabel icon={Navigation}>Drop Location</InputLabel>
                <InputShell>
                  <LocationSearch
                    placeholder="Enter your destination"
                    onSelect={setDestination}
                    className="w-full border-none bg-transparent px-5 py-4 text-[15px] placeholder:text-neutral-400 outline-none focus:ring-0"
                  />
                </InputShell>
              </div>
            </div>
          </div>

          {/* Action CTA */}
          <div className="pb-12 pt-8">
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed || loading}
              className="group relative flex h-[64px] w-full items-center justify-center overflow-hidden rounded-2xl bg-black text-[16px] font-bold text-white transition-all hover:bg-neutral-900 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400"
            >
              <span className="relative z-10">
                {loading ? "Searching for routes..." : "Search Vayy Rides"}
              </span>

              {!loading && canProceed && (
                <ArrowRight
                  className="absolute right-6 transition-transform group-hover:translate-x-1"
                  size={20}
                  strokeWidth={2.5}
                />
              )}
            </button>

            <p className="mt-6 text-center text-[12px] leading-relaxed text-neutral-400">
              Real-time transit tracking powered by Vayy Geospatial. <br />
              Please enable location for a better experience.
            </p>
          </div>
        </div>

        {/* RIGHT SECTION: Visual Branding Overlay (Desktop Only) */}
        <div className="hidden flex-1 flex-col justify-end p-24 lg:flex">
          <div className="animate-in fade-in slide-in-from-bottom-6 max-w-xl duration-1000">
            <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-xl backdrop-blur-xl">
              <Compass className="text-white" size={32} />
            </div>

            <h2 className="text-7xl font-black leading-[1.05] text-white drop-shadow-2xl">
              Redefining <br />
              <span className="text-white/90">urban travel.</span>
            </h2>

            <p className="mt-8 max-w-md text-xl font-medium leading-relaxed text-white/80 drop-shadow-lg">
              Experience a resilient, low-latency tracking platform built for the
              modern city.
            </p>

            <div className="mt-10 flex gap-3">
              <div className="h-1.5 w-12 rounded-full bg-white" />
              <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
              <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}