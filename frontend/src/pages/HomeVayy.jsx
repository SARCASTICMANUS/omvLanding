import React from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Search, LocateFixed, ChevronRight, Zap, Mic, ArrowRight } from "lucide-react";
import { APP_ROUTES } from "../constants/routes";
import namasteIcon from "../assets/vayyNamaste.webp";
import bikeImage from "../assets/vayyPulsureBike.webp";
import autoImage from "../assets/vayySideAuto.webp";
import omvIcon from "../assets/omvIcon.png";

const GREETING = "namaste,";
const SUBLINE = "Aaj aap kahan jaana chahte hain?";

// SplashCarousel slides → landing "why OMV" cards
const SLIDES = [
  {
    key: "waiting",
    title: "Tired of Waiting?",
    subtitle:
      "Long ETAs, ride cancellations, surge pricing. Traditional ride-hailing wastes your time. OMV is different.",
  },
  {
    key: "discover",
    title: "See Rides on Your Route",
    subtitle:
      "Discover autos and bikes already moving your way. Vehicles pass your stop — you just raise your hand.",
  },
  {
    key: "action",
    title: "Walk. Raise Hand. Go.",
    subtitle:
      "Walk to your nearest stop, raise your hand as the vehicle approaches, and board instantly. No booking needed.",
  },
  {
    key: "benefit",
    title: "Smart Commuting, Lower Fuel Shares",
    subtitle:
      "Live tracking, route-based matching, and smarter daily commutes with OMV.",
  },
];

function useTypewriter(text, speed, start = true) {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
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
      className="group flex w-full items-center overflow-hidden rounded-[18px] border border-[#F0F0F0] bg-white text-left shadow-v-sm transition-transform duration-200 hover:-translate-y-0.5 hover:border-brand-primary/30 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
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

export default function HomeVayy() {
  const navigate = useNavigate();
  const greeting = useTypewriter(GREETING, 60);
  const subLine = useTypewriter(SUBLINE, 30, greeting.length >= GREETING.length);
  const showCursor = greeting.length < GREETING.length;

  return (
    <div className="min-h-screen bg-brand-canvas pb-12 font-sans text-brand-ink">
      {/* ── Green brand hero (IntroPage header language) ── */}
      <header className="relative overflow-hidden rounded-b-[32px] bg-brand-primary px-5 pb-8 pt-8 text-white sm:px-6">
        <span
          className="pointer-events-none absolute -right-[40px] -top-[60px] h-[70%] w-[70%] rotate-[25deg] rounded-[120px] bg-[#00B857] opacity-25"
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute -right-[20px] -top-[80px] h-[60%] w-[50%] rotate-[35deg] rounded-[100px] bg-white/10"
          aria-hidden="true"
        />

        <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-7">
          {/* Brand row */}
          <div className="flex items-center justify-between gap-3">
            <img src={omvIcon} alt="OMV" className="h-7 w-auto object-contain" />
            <button
              type="button"
              onClick={() => navigate(APP_ROUTES.login)}
              className="rounded-full border border-white/40 px-4 py-2 text-[13px] font-bold tracking-[0.3px] text-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Log in
            </button>
          </div>

          {/* Greeting */}
          <div>
            <div className="flex items-center gap-2">
              <img src={namasteIcon} alt="" className="h-[38px] w-[30px] object-contain" />
              <p className="font-geom-700 flex items-center text-[38px] leading-tight text-white">
                {greeting}
                {showCursor && (
                  <span
                    className="ml-0.5 inline-block h-7 w-0.5 animate-pulse bg-white"
                    aria-hidden="true"
                  />
                )}
              </p>
            </div>
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
              <span className="block truncate text-[14px] font-bold">Detecting location...</span>
            </span>
            <button
              type="button"
              onClick={() => {}}
              aria-label="Refresh current location"
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center overflow-hidden rounded-[12px] bg-white/20 transition-colors hover:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <LocateFixed size={18} />
            </button>
          </div>

          {/* Search bar → auth */}
          <div>
            <button
              type="button"
              onClick={() => navigate(APP_ROUTES.login)}
              className="flex w-full items-center gap-2.5 rounded-[20px] bg-white px-4 py-[13px] text-left shadow-[0_6px_16px_rgba(0,0,0,0.12)] transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Search size={20} className="shrink-0 text-brand-light" />
              <span className="flex-1 text-[15px] font-medium text-brand-light">
                Office, Metro ya College?
              </span>
              <Mic size={20} className="shrink-0 text-brand-light" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 pt-8 sm:px-6">
        {/* ── Choose your ride ── */}
        <h2 className="mb-4 text-[20px] font-extrabold tracking-[-0.3px] text-[#0D1B2A]">
          Choose your ride
        </h2>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
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
            onSelect={() => navigate(APP_ROUTES.login)}
          />
          <ModeCard
            title="Shared Auto"
            subtitle="Share a ride that is already on your route."
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
            onSelect={() => navigate(APP_ROUTES.login)}
          />
        </div>

        {/* Why OMV */}
        <h2 className="mb-4 mt-9 text-[20px] font-extrabold tracking-[-0.3px] text-[#0D1B2A]">
          Why OMV
        </h2>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {SLIDES.map((slide, index) => (
            <article
              key={slide.key}
              className="rounded-[18px] border border-[#F0F0F0] bg-white p-5 shadow-v-sm"
            >
              <p className="mb-3 text-[12px] font-extrabold tracking-[2px] text-brand-primary">
                {`0${index + 1}`}
              </p>
              <h3 className="mb-3 text-[22px] font-black leading-[28px] text-[#111827]">
                {slide.title}
              </h3>
              <p className="text-[15px] font-medium leading-[22px] text-brand-muted">
                {slide.subtitle}
              </p>
            </article>
          ))}
        </div>

        {/* ── Quick links ── */}
        {/* ── Get Started CTA (SplashCarousel footer button) ── */}
        <div className="mt-8 rounded-[18px] border border-[#F0F0F0] bg-white p-6 text-center shadow-v-sm">
          <h2 className="text-[24px] font-black leading-[30px] text-[#111827]">Ready to ride?</h2>
          <p className="mx-auto mt-2 max-w-md text-[15px] font-medium leading-[22px] text-brand-muted">
            Walk to your stop, raise your hand, and go. Smart commuting starts with OMV.
          </p>
          <button
            type="button"
            onClick={() => navigate(APP_ROUTES.register)}
            className="mx-auto mt-5 flex h-14 w-full max-w-sm items-center justify-center gap-2 rounded-[18px] bg-[#009849] px-7 text-[16px] font-extrabold tracking-[0.3px] text-white shadow-v-lg transition-colors hover:bg-[#007A3B] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 active:scale-[0.99]"
          >
            Get Started
            <ArrowRight size={18} />
          </button>
          <button
            type="button"
            onClick={() => navigate(APP_ROUTES.login)}
            className="mt-3 text-[14px] font-bold text-brand-primary transition-colors hover:text-brand-primaryHover"
          >
            I already have an account
          </button>
        </div>
      </main>
    </div>
  );
}
