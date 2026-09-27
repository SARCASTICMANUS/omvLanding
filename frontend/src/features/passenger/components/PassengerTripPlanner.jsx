import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpDown, ChevronRight, Clock, MapPin, Search, Flag } from "lucide-react";
import { LocationSearch } from "../../../components/map";
import api from "../../../lib/api";
import { API_PATHS } from "../../../constants/apiPaths";
import heroBg from "../../../assets/new-bg1.png";
import bikeImg1 from "../../../assets/vayyWithPassengerbike.webp";
import bikeImg2 from "../../../assets/vayyWithPassengerbike2.webp";
import bikeImg3 from "../../../assets/vayyWithPassengerbike3.webp";
import bikeImg4 from "../../../assets/vayyWithoutPassengerBike.webp";
import bikeImg5 from "../../../assets/vayyWithoutPassengerBike2.webp";
import bikeImg6 from "../../../assets/vayyWithoutPassengerBike3.webp";
import bikeImg7 from "../../../assets/vayyWithoutPassengerBike4.webp";
import autoImg1 from "../../../assets/vayyWithPassengerAuto.webp";
import autoImg2 from "../../../assets/vayyWithoutPassengerAuto.webp";
import autoComingSoonImg from "../../../assets/vayyAutoBoarding.webp";

const RIDE_IMAGES = [bikeImg1, bikeImg2, bikeImg3, bikeImg4, bikeImg5, bikeImg6, bikeImg7];
const AUTO_IMAGES = [autoImg1, autoImg2];
const RIDE_DURATION = 4000;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function SearchField({ label, placeholder, value, onSelect, isPickup }) {
  return (
    <div className="relative mb-4 flex min-h-[56px] items-center gap-3 rounded-[16px] border border-[#E5E7EB] bg-white px-3 py-2 shadow-v-sm transition-colors focus-within:border-[#009849] focus-within:ring-2 focus-within:ring-[#009849]/15">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-white ${
          isPickup ? "bg-[#009849]" : "bg-[#f59e0b]"
        }`}
        aria-hidden="true"
      >
        {isPickup ? <MapPin size={16} /> : <Flag size={14} />}
      </span>
      <div className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase leading-tight tracking-[0.3px] text-[#6B7280]">
          {label}
        </span>
        <div className="[&>div>svg]:hidden">
          <LocationSearch
            placeholder={placeholder}
            onSelect={onSelect}
            initialValue={value}
            iconPosition="right"
            className="w-full border-0 bg-transparent py-0 pl-0 pr-10 text-[14px] font-semibold text-[#111827] outline-none placeholder:font-medium placeholder:text-[#9CA3AF]"
          />
        </div>
      </div>
    </div>
  );
}

function RecentRow({ item, onClick }) {
  const fromName = item.pickup?.name || item.pickup?.display_name || "Unknown Start";
  const toName = item.destination?.name || item.destination?.display_name || "Unknown End";

  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      className="group mb-2.5 flex w-full items-center gap-3 rounded-[14px] border border-[#F3F4F6] bg-white px-3.5 py-3.5 text-left transition-colors hover:border-[#009849]/40 hover:bg-[#F8FBFA]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#F3F4F6] text-[#6B7280]">
        <Clock size={18} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[12px] font-black text-[#111827]">{fromName}</span>
        <span className="truncate text-[12px] font-medium text-[#6B7280]">To: {toName}</span>
      </span>
      <ChevronRight
        size={16}
        className="shrink-0 text-[#D1D5DB] transition-colors group-hover:text-[#009849]"
      />
    </button>
  );
}

export default function PassengerTripPlanner({
  onBack,
  onNext,
  loading = false,
  mode = "bike",
}) {
  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);
  const [imgIndex, setImgIndex] = useState(0);
  const [autoImgIndex, setAutoImgIndex] = useState(0);
  const [riding, setRiding] = useState(false);
  const [reducedMotion] = useState(prefersReducedMotion);

  useEffect(() => {
    // Fetch recent searches
    api.get(API_PATHS.auth.recentSearches)
      .then(res => {
        setRecentSearches(Array.isArray(res.data) ? res.data : []);
      })
      .catch(err => console.error("Failed to fetch recent searches", err));
  }, []);

  useEffect(() => {
    if (mode !== "auto" || reducedMotion) return undefined;
    const timer = setInterval(() => {
      setAutoImgIndex((index) => (index + 1) % AUTO_IMAGES.length);
    }, 7000);
    return () => clearInterval(timer);
  }, [mode, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return undefined;
    if (!riding) {
      const startTimer = setTimeout(() => setRiding(true), 80);
      return () => clearTimeout(startTimer);
    }
    const rideTimer = setTimeout(() => {
      setImgIndex((prev) => (prev + 1) % RIDE_IMAGES.length);
      setRiding(false);
    }, RIDE_DURATION);
    return () => clearTimeout(rideTimer);
  }, [riding, reducedMotion]);

  const canProceed = useMemo(() => {
    return Boolean(
      pickup?.lat && pickup?.lon && destination?.lat && destination?.lon
    );
  }, [pickup, destination]);

  const handleSwap = () => {
    const p = pickup;
    setPickup(destination);
    setDestination(p);
  };

  const handleNext = () => {
    if (!canProceed || loading) return;
    onNext?.({ from: pickup, to: destination });
  };

  const handleRecentClick = (search) => {
    setPickup(search.pickup);
    setDestination(search.destination);
  };

  const vehiclePosition = reducedMotion
    ? "translate-x-[calc(50vw_-_50%)] transition-none"
    : riding
      ? "translate-x-[calc(100vw_+_80px)] transition-transform duration-[4000ms] ease-linear"
      : "-translate-x-[35vw] transition-none";

  if (mode === "auto") {
    return (
      <div className="flex min-h-screen w-full flex-col bg-white font-sans text-[#111827]">
        <section className="relative h-[300px] w-full shrink-0 overflow-hidden">
          <img src={heroBg} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
          <img
            src={AUTO_IMAGES[autoImgIndex]}
            alt=""
            aria-hidden="true"
            className="absolute bottom-[22px] left-0 h-[110px] w-[190px] max-w-[55vw] animate-[omv-auto-ride_7s_linear_infinite] object-contain"
          />
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to home"
              className="absolute left-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#111827] shadow-v-md transition active:scale-95"
            >
              <ArrowLeft size={22} strokeWidth={2.5} />
            </button>
          ) : null}
        </section>
        <section className="relative z-10 -mt-5 flex flex-1 flex-col rounded-t-[35px] bg-white px-5 pb-8 pt-5 shadow-[0_-6px_24px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center">
            <div className="flex flex-col items-center gap-3 rounded-[22px] bg-white px-7 py-8 text-center">
              <img src={autoComingSoonImg} alt="" className="h-[120px] w-[160px] object-contain" />
              <h1 className="text-[20px] font-black text-[#111827]">Coming Soon</h1>
              <p className="max-w-sm text-[14px] font-medium leading-5 text-[#6B7280]">
                Shared Auto matching is coming soon. Please try Bike Ride for now.
              </p>
            </div>
          </div>
        </section>
        <style>{`@keyframes omv-auto-ride { from { transform: translateX(-45vw); } to { transform: translateX(calc(100vw + 80px)); } }`}</style>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#F5F7FA] font-sans text-[#111827]">
      <section className="relative h-[300px] w-full shrink-0 overflow-hidden">
        <img src={heroBg} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
        <img
          src={RIDE_IMAGES[imgIndex]}
          alt=""
          aria-hidden="true"
          className={`pointer-events-none absolute bottom-[15px] left-0 h-[120px] w-[50vw] max-w-[420px] object-contain ${vehiclePosition}`}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[60px] shadow-[0_-4px_12px_rgba(0,0,0,0.15)]" aria-hidden="true" />
      </section>
      <section className="relative z-10 -mt-5 flex flex-1 flex-col rounded-t-[35px] bg-white px-5 pb-8 pt-5 shadow-[0_-6px_24px_rgba(0,0,0,0.08)]">
        <div className="mx-auto w-full max-w-[560px]">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to home"
              className="mb-3 flex h-10 w-10 items-center justify-center rounded-full text-[#111827] transition hover:bg-[#F3F4F6] active:scale-95"
            >
              <ArrowLeft size={22} strokeWidth={2.5} />
            </button>
          ) : null}
          <SearchField
            isPickup
            label="Pickup Stop"
            placeholder="Search pickup location"
            onSelect={setPickup}
            value={pickup?.display_name || pickup?.name || ""}
          />

          <div className="-mt-1.5 mb-3.5 flex justify-center">
            <button
              type="button"
              onClick={handleSwap}
              aria-label="Swap pickup and destination"
              className="flex h-8 w-8 items-center justify-center rounded-full border-[1.5px] border-[#E5E7EB] bg-white shadow-v-sm transition active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#009849]"
            >
              <ArrowUpDown size={18} className="text-[#009849]" />
            </button>
          </div>

          <SearchField
            label="Destination"
            placeholder="Enter your destination"
            onSelect={setDestination}
            value={destination?.display_name || destination?.name || ""}
          />

          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed || loading}
            className="mt-2 flex h-[52px] w-full items-center justify-center gap-2 rounded-[16px] bg-[#009849] shadow-v-md transition active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
          >
            <Search size={18} className="text-white" strokeWidth={2.5} />
            <span className="text-[15px] font-extrabold text-white">
              {loading ? "Searching..." : "Search OMV Rides"}
            </span>
          </button>

          {/* Recent searches */}
          {recentSearches.length > 0 && (
            <div className="pb-10 pt-5">
              <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.5px] text-[#9CA3AF]">
                RECENT SEARCHES
              </h3>
              {recentSearches.map((search, idx) => (
                <RecentRow key={idx} item={search} onClick={handleRecentClick} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
