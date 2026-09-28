import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { MapPin, Search, LocateFixed, ChevronRight, Zap, Mic } from "lucide-react";
import api from "../../../lib/api";
import { APP_ROUTES } from "../../../constants/routes";
import namasteIcon from "../../../assets/vayyNamaste.webp";
import bikeImage from "../../../assets/vayyPulsureBike.webp";
import autoImage from "../../../assets/vayySideAuto.webp";

const GREETING = "namaste,";
const SUBLINE = "Aaj aap kahan jaana chahte hain?";

function useTypewriter(text, speed, start = true) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!start) return undefined;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      const t = setTimeout(() => setIndex(text.length), 0);
      return () => clearTimeout(t);
    }
    let i = index;
    const timer = setInterval(() => {
      i += 1;
      setIndex(i);
      if (i >= text.length) clearInterval(timer);
    }, speed);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speed, start]);

  return start ? text.slice(0, index) : "";
}

function ModeCard({ title, subtitle, badge, image, cta, onSelect, imageAlt, compactFooter = false }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex w-full items-center overflow-hidden rounded-[22px] bg-white text-left shadow-[0_4px_14px_rgba(0,0,0,0.08)] transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
    >
      <div className={`min-w-0 flex-1 py-[18px] pl-[18px] ${compactFooter ? "pr-2" : "pr-4"}`}>
        <h3 className="text-[20px] font-extrabold leading-tight text-[#0D1B2A]">{title}</h3>
        <p className="mt-1 text-[13px] font-medium leading-[18px] text-[#5A6B7D]">{subtitle}</p>
        <div className={`mt-3.5 flex items-center justify-between ${compactFooter ? "gap-1" : "gap-3"}`}>
          <span className={`inline-flex items-center gap-[5px] rounded-full bg-[#E8F5EE] py-[5px] font-semibold text-brand-primary ${compactFooter ? "whitespace-nowrap px-2 text-[10px]" : "px-2.5 text-[11px]"}`}>
            {badge}
          </span>
          <span className={`inline-flex items-center gap-0.5 pr-1 font-bold text-brand-primary ${compactFooter ? "whitespace-nowrap text-[12px]" : "text-[13px]"}`}>
            {cta}
            <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
      <div className={`relative -mr-1 flex h-[150px] shrink-0 items-center justify-center ${compactFooter ? "w-[100px]" : "w-[120px]"}`}>
        <img
          src={image}
          alt={imageAlt}
          className={`object-contain transition-transform duration-300 group-hover:scale-105 ${compactFooter ? "h-[130px] w-[96px]" : "h-[140px] w-[110px]"}`}
          loading="lazy"
        />
        <span
          className="absolute -bottom-2.5 h-5 w-20 rounded-[40px] bg-[rgba(0,152,73,0.08)]"
          aria-hidden="true"
        />
      </div>
    </button>
  );
}

export default function PassengerHome() {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth || {});
  const displayName =
    user?.full_name || user?.name || user?.first_name || user?.display_name || "there";

  const [currentLoc, setCurrentLoc] = useState("Current location");
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState(null);
  const greeting = useTypewriter(GREETING, 60);
  const subLine = useTypewriter(SUBLINE, 30, greeting.length >= GREETING.length);
  const showName = greeting.length >= GREETING.length;
  const revGeocodeRef = useRef(null);

  const locateMe = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocError("Location is not available in this browser.");
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await api.get("/api/transport/geocode/reverse/", {
            params: { lat: latitude, lon: longitude },
          });
          const data = res.data?.data ?? res.data ?? {};
          const placeName =
            data?.name || data?.address?.road || data?.address?.neighbourhood ||
            data?.display_name?.split(",")?.[0];
          setCurrentLoc(placeName || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          revGeocodeRef.current = { lat: latitude, lon: longitude };
        } catch {
          setCurrentLoc(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          revGeocodeRef.current = { lat: latitude, lon: longitude };
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        setLocError(
          err?.code === 1
            ? "Location permission denied. Allow location to see nearby rides."
            : "Unable to detect your location. Try again.",
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => {
    locateMe();
  }, [locateMe]);

  const goPlanner = () => {
    navigate(`${APP_ROUTES.passengerLive}?mode=bike`);
  };

  const goAutoPlanner = () => {
    navigate(`${APP_ROUTES.passengerLive}?mode=auto`);
  };

  return (
    <div className="h-[calc(100dvh-96px)] min-h-0 overflow-y-auto overscroll-y-contain bg-[#F5F7FA] pb-10 font-sans text-brand-ink lg:h-auto lg:min-h-[calc(100dvh-72px)] lg:overflow-y-visible">
      {/* ── Green header (IntroPage: greeting + location + search) ── */}
      <header className="relative flex min-h-[360px] flex-col overflow-hidden rounded-b-[28px] bg-brand-primary px-5 pb-6 pt-8 text-white sm:min-h-[400px] sm:px-6">
        <span
          className="pointer-events-none absolute -right-[40px] -top-[60px] h-[90%] w-[70%] rotate-[25deg] rounded-[120px] bg-[#00B857] opacity-25"
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute -right-[20px] -top-[80px] h-[70%] w-[50%] rotate-[35deg] rounded-[100px] bg-white/10"
          aria-hidden="true"
        />

        <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4">
          {/* Greeting */}
          <div>
            <div className="flex flex-col items-start">
              <img src={namasteIcon} alt="" className="mb-[6px] h-[38px] w-[30px] object-contain" />
              <p className="font-geom-700 flex items-center text-[38px] leading-tight text-white">
                {greeting}
                {greeting.length < GREETING.length && (
                  <span
                    className="ml-0.5 inline-block h-7 w-0.5 animate-pulse bg-white"
                    aria-hidden="true"
                  />
                )}
              </p>
            </div>

            {showName && <p className="text-[28px] font-black leading-[34px]">{displayName}</p>}

            <div className="mt-1 flex flex-wrap items-center">
              {subLine ? (
                <p className="text-[16px] font-medium leading-[22px] text-white/85">{subLine}</p>
              ) : null}
              {subLine.length > 0 && subLine.length < SUBLINE.length && (
                <span
                  className="ml-0.5 inline-block h-[18px] w-0.5 animate-pulse bg-white"
                  aria-hidden="true"
                />
              )}
            </div>
          </div>

          {/* Current location */}
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
              <MapPin size={22} />
              <span
                className="absolute inset-0 animate-ping rounded-full bg-white/25"
                aria-hidden="true"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.4px] text-white/60">
                Current Location
              </span>
              <span className="block truncate text-[14px] font-bold" title={currentLoc}>
                {locating ? "Detecting…" : currentLoc}
              </span>
            </span>
            <button
              type="button"
              onClick={locateMe}
              aria-label="Refresh current location"
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-white/20 transition-colors hover:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <LocateFixed size={18} className={locating ? "animate-spin" : ""} />
            </button>
          </div>

          {/* Search bar → trip planner */}
          <div>
            <button
              type="button"
              onClick={goPlanner}
              className="flex w-full items-center gap-2.5 rounded-[20px] bg-white px-4 py-[13px] text-left shadow-[0_6px_16px_rgba(0,0,0,0.12)] transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Search size={20} className="shrink-0 text-brand-light" />
              <span className="flex-1 text-[15px] font-medium text-brand-light">
                Office, Metro ya College?
              </span>
              <Mic size={20} className="shrink-0 text-brand-light" />
            </button>
            {locError && (
              <p className="mt-2 text-xs font-semibold text-amber-200" role="alert">
                {locError}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* ── Choose your ride ── */}
      <main className="mx-auto w-full max-w-3xl px-5 pb-10 pt-6 sm:px-6">
        <h2 className="mb-4 text-[20px] font-extrabold tracking-[-0.3px] text-[#0D1B2A]">
          Choose your ride
        </h2>

        <div className="grid grid-cols-1 gap-3.5">
          <ModeCard
            title="Bike Ride"
            subtitle="Fast point-to-point ride."
            badge={
              <>
                <Zap size={12} className="text-[#F5A623]" />
                <span>Quick match</span>
              </>
            }
            image={bikeImage}
            imageAlt="Bike ride"
            cta="Ride Now"
            onSelect={goPlanner}
          />
          <ModeCard
            title="Shared Auto"
            subtitle="Jo auto already aapke route par hai."
            badge={
              <>
                <span className="h-2 w-2 rounded-full bg-[#00C853]" aria-hidden="true" />
                <span>Live route matching</span>
              </>
            }
            image={autoImage}
            imageAlt="Shared auto"
            cta="Ride Now"
            compactFooter
            onSelect={goAutoPlanner}
          />
        </div>

      </main>
    </div>
  );
}
