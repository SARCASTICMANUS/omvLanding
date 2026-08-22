import { useEffect, useState } from "react";
import { MusicPlayer } from "../components/MusicPlayer";
import WaitlistForm from "../components/WaitlistForm";
import coffeeImg from "../assets/coffee.webp";
import breakfastImg from "../assets/breakfast.webp";
import foodImg from "../assets/food.webp";
import cokeImg from "../assets/coke.webp";
import chaiaImg from "../assets/chaia.webp";
import momoImg from "../assets/momo.webp";
import ticketImg from "../assets/ticket.webp";
import deliveryImg from "../assets/fooddelivary.webp";
import cabImg from "../assets/cab.webp";
import vayyBg from "../assets/vayybg.webp";
import vayyBgMobile from "../assets/vayybgMobile.webp";

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
      "OMV connects you with people already \n travelling your way making everyday commutes more \n affordable, predictable, and efficient.",
    badge: "Launching in India — join early",
    primaryCta: "Join Waitlist",
    submitting: "Joining…",
    placeholder: "you@example.com",
    successTitle: "You're on the waitlist.",
    successBody: "We'll email you when onmyvayy launches near you.",
    addAnother: "Add another email",
    duplicateError: "This email is already on the waitlist.",
    genericError: "Something went wrong. Please try again.",
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
      "OMV aapko un logon se jodta hai jo aapke hi raaste par \n travel kar rahe hain taaki roz ke commutes \n affordable, predictable aur efficient ho jayein.",
    badge: "India mein launch ho raha hai — jaldi judiye",
    primaryCta: "Waitlist Join Karein",
    submitting: "Ho raha hai…",
    placeholder: "aap@example.com",
    successTitle: "Aap waitlist mein hain.",
    successBody: "Aapke shehar mein onmyvayy launch hote hi email karenge.",
    addAnother: "Ek aur email add karein",
    duplicateError: "Yeh email pehle se waitlist mein hai.",
    genericError: "Kuch galat ho gaya. Phir se try karein.",
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
      className="relative inline-flex h-[3.8em] Md:mt-0 mt-10  items-center overflow-hidden md:h-[7.3em]"
      aria-live="polite"
    >
      <span
        key={`${lang}-${index}`}
        className="animate-hook-in flex flex-col items-center   gap-0.5 bg-[linear-gradient(90deg,#009849,#22C55E,#009849)] bg-[length:200%_100%] bg-clip-text text-transparent md:gap-1"
      >
        {HOOK_IMAGES[index]?.img ? (
          <img
            src={HOOK_IMAGES[index].img}
            alt=""
            aria-hidden
            loading="eager"
            fetchpriority="high"
            decoding="async"
            className="inline-block h-[2.4em] w-auto  rounded-lg md:h-[5.6em]   md:rounded-xl"
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

export default function Landing() {
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
      {/* Mobile background */}
      <div
        aria-hidden
        className="pointer-events-none absolute  inset-0 -z-20 bg-cover md:hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.20), rgba(255,255,255,0.20)), url(${vayyBgMobile})`,
          backgroundPosition: "center 30%",
        }}
      />
      {/* Desktop background */}
      <div
        aria-hidden
        className="pointer-events-none   absolute inset-0 -z-20 hidden bg-cover bg-center md:cover md:block"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.15), rgba(255,255,255,0.15)), url(${vayyBg})`,
        }}
      />
      {/* Glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 "
        style={{
          background:
            "radial-gradient(60% 50% at 85% 10%, rgba(255, 190, 140, 0.35), transparent 0%), radial-gradient(50% 40% at 10% 90%, rgba(0, 152, 73, 0.08), transparent 60%)",
        }}
      />

      {/* Badge — in-flow on mobile (centered above h1), fixed top-right on desktop */}
      <div
        key={`badge-${contentKey}`}
        className="animate-lang-fade  relative z-50 mx-auto mt-4 flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-medium text-white shadow-lg shadow-black/5 backdrop-blur-md sm:px-4 sm:py-1.5 sm:text-sm md:fixed md:left-auto md:top-6 md:right-6 md:translate-x-0 md:inline-flex"
      >
        <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2 ">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#009849] opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#009849] sm:h-2 sm:w-2" />
        </span>
        {copy.badge}
      </div>

      {/* Mobile: normal flow content. Desktop: centered flex layout. */}
      <div className="relative z-10 w-full px-5 pb-[130px] pt-10 md:flex md:min-h-screen  md:flex-col md:items-center md:justify-center md:px-1 md:pb-0 md:pt-0">
        <main className="w-full max-w-6xl text-center">
          {/* Hero headline */}
          <h1
            key={`h1-${contentKey}`}
            className="animate-lang-fade mx-auto   max-w-[300px] text-balance text-center text-[23px] font-bold leading-[1.15] tracking-[-0.02em] text-white sm:text-[32px] sm:max-w-[360px]  md:mt-[-16rem] md:max-w-2xl md:text-3xl md:text-neutral-900"
          >
            <span className="block">{copy.line1}</span>
            <RotatingHook lang={lang} />
          </h1>

          {/* Description */}
          <p
            key={`desc-${contentKey}`}
            className="animate-lang-fade mx-auto   mt-3 max-w-[280px] text-center text-[10px] font-semibold leading-[1.5] text-neutral-700 sm:text-sm sm:max-w-[300px] md:mt-8 md:max-w-lg md:text-base"
          >
            {copy.description.split("\n").map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </p>

          {/* Waitlist form */}
          <div key={`form-${contentKey}`}  className="animate-lang-fade mx-auto mt-6 md:mt-8  ">
            <WaitlistForm
              submitLabel={copy.primaryCta}
              submittingLabel={copy.submitting}
              placeholder={copy.placeholder}
              successTitle={copy.successTitle}
              successBody={copy.successBody}
              addAnotherLabel={copy.addAnother}
              duplicateError={copy.duplicateError}
              genericError={copy.genericError}
            />
          </div>
        </main>
      </div>

      {/* Music player — fixed bottom on mobile, in-flow on desktop */}
      <section className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 pt-2 md:static md:w-full md:px-6 md:pb-5 md:pt-4">
        <div className="mx-auto flex max-w-6xl justify-center">
          <MusicPlayer />
        </div>
      </section>
    </div>
  );
}
