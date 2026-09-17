import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MusicPlayer } from "../components/MusicPlayer";
import coffeeImg from "../assets/coffee.webp";
import breakfastImg from "../assets/breakfast.webp";
import foodImg from "../assets/food.webp";
import cokeImg from "../assets/coke.webp";
import chaiaImg from "../assets/chaia.webp";
import momoImg from "../assets/momo.webp";
import ticketImg from "../assets/ticket.webp";
import deliveryImg from "../assets/fooddelivary.webp";
import cabImg from "../assets/cab.webp";
import bgMobile from "../assets/new-bg-mobile.png";
import bgLandscape from "../assets/new-bg-landscape.png";
import bgWidescreen from "../assets/new-bg-widescreen.png";
import bikeStyled from "../assets/bikeStyled.png";
import bikeWithBuddy from "../assets/2bikeStyled.png";
import girlScooty from "../assets/girlScooty.png";
import girlScooty2 from "../assets/2girlScooty.png";

const FORM_URL = "https://forms.gle/StUs6RQTXGrhceMC6";

const COPY = {
  en: {
    line1: "What if your daily commute cost less than…",
    hooks: [
      { emoji: "☕", text: "your morning coffee." },
      { emoji: "🥪", text: "your breakfast." },
      { emoji: "🍛", text: "your office lunch." },
      { emoji: "🥤", text: "a bottle of Coke." },
      { emoji: "🧋", text: "your evening chai." },
      { emoji: "🥟", text: "a plate of momos." },
      { emoji: "🍿", text: "a movie ticket." },
      { emoji: "📦", text: "your food delivery." },
      { emoji: "🚖", text: "one cab ride." },
    ],
    description:
      "OMV connects you with people already travelling your way making everyday commutes more affordable, predictable, and efficient.",
    badge: "Launching in Lucknow — join early",
    primaryCta: "Join Waitlist",
  },
  hi: {
    line1: "Agar aapke roz ke safar ka kharcha hota sirf…",
    hooks: [
      { emoji: "☕", text: "ek chai jitna." },
      { emoji: "🥪", text: "ek breakfast jitna." },
      { emoji: "🍛", text: "ek lunch jitna." },
      { emoji: "🥤", text: "ek Coke jitna." },
      { emoji: "🧋", text: "evening snacks jitna." },
      { emoji: "🥟", text: "ek plate momos jitna." },
      { emoji: "🍿", text: "ek movie ticket jitna." },
      { emoji: "📦", text: "ek food delivery jitna." },
      { emoji: "🚖", text: "ek cab ride jitna." },
    ],
    description:
      "OMV aapko un logon se jodta hai jo aapke hi raaste par travel kar rahe hain taaki roz ke commutes  \n  affordable, predictable aur efficient ho jayein.",
    badge: "Lucknow mein launch ho raha hai — jaldi judiye",
    primaryCta: "Waitlist Join Karein",
  },
};

const HOOK_IMAGES = [
  { img: coffeeImg },
  { img: breakfastImg },
  { img: foodImg },
  { img: cokeImg },
  { img: chaiaImg },
  { img: momoImg },
  { img: ticketImg },
  { img: deliveryImg },
  { img: cabImg },
];

function RotatingHook({ lang }) {
  const copy = COPY[lang];
  const total = copy.hooks.length;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [lang]);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % total);
    }, 3000);
    return () => clearInterval(id);
  }, [total]);

  return (
    <span
      className="relative inline-flex h-[3em] Md:mt-0 mt-5  items-center overflow-hidden md:h-[5.5em]"
      aria-live="polite"
    >
      <span
        key={`${lang}-${index}`}
        className="animate-hook-in flex flex-col items-center   gap-0.5 text-white font-bold md:gap-1"
      >
        {HOOK_IMAGES[index]?.img ? (
          <img
            src={HOOK_IMAGES[index].img}
            alt=""
            aria-hidden
            loading="eager"
            fetchpriority="high"
            decoding="async"
            className="inline-block h-[1.8em] w-auto  rounded-lg md:h-[4em]   md:rounded-xl"
          />
        ) : (
          <span className="not-italic text-[1.1em]  leading-none md:text-[1.6em]">
            {copy.hooks[index].emoji}
          </span>
        )}
        <span className="text-[0.85em]  md:text-[1em]">{copy.hooks[index].text}</span>
      </span>
    </span>
  );
}

export default function LandingPageAnimated() {
  const [lang, setLang] = useState("en");
  const [contentKey, setContentKey] = useState(0);

  const copy = COPY[lang];

  useEffect(() => {
    const id = setInterval(() => {
      setLang((l) => (l === "en" ? "hi" : "en"));
      setContentKey((k) => k + 1);
    }, 60000);

    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative min-h-screen   overflow-hidden font-manrope text-neutral-900 antialiased">
      <style>{`
        @keyframes vehicle1 {
          0% { transform: translateX(-120%); visibility: visible; }
          16.67% { transform: translateX(calc(100vw + 120%)); visibility: visible; }
          16.68%, 100% { transform: translateX(-120%); visibility: hidden; }
        }
        @keyframes vehicle2 {
          0%, 25% { transform: translateX(-120%); visibility: hidden; }
          25.01% { transform: translateX(-120%); visibility: visible; }
          41.67% { transform: translateX(calc(100vw + 120%)); visibility: visible; }
          41.68%, 100% { transform: translateX(-120%); visibility: hidden; }
        }
        @keyframes vehicle3 {
          0%, 50% { transform: translateX(-120%); visibility: hidden; }
          50.01% { transform: translateX(-120%); visibility: visible; }
          66.67% { transform: translateX(calc(100vw + 120%)); visibility: visible; }
          66.68%, 100% { transform: translateX(-120%); visibility: hidden; }
        }
        @keyframes vehicle4 {
          0%, 75% { transform: translateX(-120%); visibility: hidden; }
          75.01% { transform: translateX(-120%); visibility: visible; }
          91.67% { transform: translateX(calc(100vw + 120%)); visibility: visible; }
          91.68%, 100% { transform: translateX(-120%); visibility: hidden; }
        }
      `}</style>

      {/* Background — mobile */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 bg-cover bg-center md:hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(0,57,35,0.6), rgba(0,101,58,0.0)), url(${bgMobile})`,
        }}
      />
      {/* Background — landscape */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 hidden bg-cover bg-center md:block xl:hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(0,57,35,0.6), rgba(0,101,58,0.0)), url(${bgLandscape})`,
        }}
      />
      {/* Background — widescreen */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 hidden bg-cover bg-center xl:block"
        style={{
          backgroundImage: `linear-gradient(rgba(0,57,35,0.6), rgba(0,101,58,0.0)), url(${bgWidescreen})`,
        }}
      />
      {/* Glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 "
        style={{
          background:
            "radial-gradient(60% 50% at 85% 10%, rgba(255, 190, 140, 0.25), transparent 0%), radial-gradient(50% 40% at 10% 90%, rgba(0, 152, 73, 0.08), transparent 60%)",
        }}
      />

      {/* Top bar — nav links + badge on right */}
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center gap-4 px-5 py-4 md:px-6 md:py-4 overflow-x-auto whitespace-nowrap">
        <Link to="/support?tab=privacy" className="text-[11px] font-medium text-white/70 hover:text-white transition-colors md:text-sm shrink-0">
          Privacy
        </Link>
        <Link to="/support?tab=terms" className="text-[11px] font-medium text-white/70 hover:text-white transition-colors md:text-sm shrink-0">
          Terms
        </Link>
        <Link to="/support?tab=faq" className="text-[11px] font-medium text-white/70 hover:text-white transition-colors md:text-sm shrink-0">
          FAQ
        </Link>
        <Link to="/support?tab=contact" className="text-[11px] font-medium text-white/70 hover:text-white transition-colors md:text-sm shrink-0">
          Support
        </Link>

        <div
          key={`badge-${contentKey}`}
          className="animate-lang-fade ml-auto flex items-center gap-1.5 whitespace-nowrap rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-medium text-white shadow-lg backdrop-blur-md shrink-0"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#009849] opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#009849]" />
          </span>
          {copy.badge}
        </div>
      </div>

      {/* Hero content */}
      <div className="relative z-10 w-full px-5 pb-[130px] pt-16 md:flex md:min-h-screen  md:flex-col md:items-center md:justify-center md:px-1 md:pb-0 md:pt-0 md:pb-24">
        <main className="w-full max-w-6xl text-center">
          {/* Headline — centered */}
          <h1
            key={`h1-${contentKey}`}
            className="animate-lang-fade mx-auto mt-2 max-w-[300px] text-balance text-center text-[23px] font-bold leading-[1.15] tracking-[-0.02em] text-white sm:text-[32px] sm:max-w-[360px] md:mt-[-15rem] md:max-w-2xl md:text-3xl"
          >
            {copy.line1}
          </h1>

          {/* Rotating hook images */}
          <div className="mt-4">
            <RotatingHook lang={lang} />
          </div>

          {/* Description */}
          <p
            key={`desc-${contentKey}`}
            className="animate-lang-fade mx-auto   mt-3 max-w-[280px] text-center text-[10px] font-semibold leading-[1.5] text-white/70 sm:text-sm sm:max-w-[300px] md:mt-1 md:max-w-lg md:text-base"
          >
            {copy.description.split("\n").map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </p>

          {/* Music player — below description */}
          <div className="animate-lang-fade mx-auto mt-5 flex justify-center md:mt-6">
            <MusicPlayer
              ctaButton={
                <a
                  href={FORM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative inline-flex h-8 shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full bg-[#009849] px-3.5 text-[11px] font-medium text-white transition-all duration-300 hover:scale-[1.05] hover:bg-[#007a3a] active:scale-[0.97] md:h-9 md:px-4 md:text-xs"
                >
                  <span className="relative z-10 inline-flex items-center gap-1.5">
                    {copy.primaryCta}
                    <span className="inline-block transition-transform duration-300 group-hover:translate-x-1">→</span>
                  </span>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-0 animate-shine bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.5)_50%,transparent_70%)]"
                  />
                </a>
              }
            />
          </div>
        </main>
      </div>

      {/* Moving vehicles — 4s crossing, 6s apart, one by one */}
      <div className="pointer-events-none absolute bottom-20 left-0 right-0 z-30 md:bottom-16">
        <img
          src={bikeStyled}
          alt=""
          aria-hidden
          className="absolute md:bottom-3 bottom-48 h-[230px] w-auto md:h-[200px]"
          style={{ animation: "vehicle1 24s linear infinite" }}
        />
        <img
          src={bikeWithBuddy}
          alt=""
          aria-hidden
          className="absolute md:bottom-3 bottom-48 h-[230px] w-auto md:h-[200px]"
          style={{ animation: "vehicle2 24s linear infinite" }}
        />
        <img
          src={girlScooty}
          alt=""
          aria-hidden
          className="absolute md:bottom-3 bottom-48 h-[230px] w-auto md:h-[200px]"
          style={{ animation: "vehicle3 24s linear infinite" }}
        />
        <img
          src={girlScooty2}
          alt=""
          aria-hidden
          className="absolute md:bottom-3 bottom-48 h-[230px] w-auto md:h-[200px]"
          style={{ animation: "vehicle4 24s linear infinite" }}
        />
      </div>
    </div>
  );
}
