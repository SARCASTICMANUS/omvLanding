/**
 * Landing page (route "/").
 *
 * WHERE TO EDIT CONTENT:
 * - Hero text, rotating hooks, badge copy     -> COPY object below
 * - Badge / h1 / spacing on the page          -> <main> section in Landing()
 * - Rotating hook sizes + photos               -> RotatingHook() below
 * - Background images                          -> vayyBg / vayyBgMobile imports + background <div>s
 */
import { useEffect, useState } from "react";
import { MusicPlayer } from "../components/MusicPlayer";
import WaitlistForm from "../components/WaitlistForm";
import coffeeImg from "../assets/coffee.png";
import breakfastImg from "../assets/breakfast.png";
import foodImg from "../assets/food.png";
import cokeImg from "../assets/coke.png";
import chaiaImg from "../assets/chaia.png";
import momoImg from "../assets/momo.png";
import ticketImg from "../assets/ticket.png";
import deliveryImg from "../assets/fooddelivary.png";
import cabImg from "../assets/cab.png";
import vayyBg from "../assets/vayybg.png";
import vayyBgMobile from "../assets/vayybgMobile.png";

// ============================================================
// ALL PAGE TEXT LIVES HERE — edit these strings to change copy.
// `en` = English, `hi` = Hindi. The page auto-switches every 20s.
// ============================================================
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
    successBody: "We'll email you when VAYY launches near you.",
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
    successBody: "Aapke shehar mein VAYY launch hote hi email karenge.",
    addAnother: "Ek aur email add karein",
    duplicateError: "Yeh email pehle se waitlist mein hai.",
    genericError: "Kuch galat ho gaya. Phir se try karein.",
  },
};

// Photos used for specific hooks (index matches COPY.hooks order).
// An empty object {} shows the emoji instead of a photo. Add/swap imports at top.
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

/**
 * Rotating "hook" line under the headline. Cycles through COPY.hooks every 3s.
 * - Phrases/emoji to change  -> COPY.hooks
 * - Photo per phrase         -> HOOK_IMAGES
 * - Sizes: container h-[4.6em] (mobile) / h-[8.3em] (desktop); photo h-[3em] / h-[5.6em]
 */
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
      className="relative inline-flex h-[4.6em] items-center overflow-hidden md:h-[7.3em]"
      aria-live="polite"
    >
      <span
        key={`${lang}-${index}`}
        className="animate-hook-in flex flex-col items-center gap-1 bg-[linear-gradient(90deg,#009849,#22C55E,#009849)] bg-[length:200%_100%] bg-clip-text text-transparent"
      >
        {HOOK_IMAGES[index]?.img ? (
          <img
            src={HOOK_IMAGES[index].img}
            alt=""
            aria-hidden
            className="inline-block h-[3em] w-auto rounded-xl md:h-[5.6em]"
          />
        ) : (
          <span className="not-italic text-[1.1em] leading-none md:text-[1.6em]">
            {copy.hooks[index].emoji}
          </span>
        )}
        <span>{copy.hooks[index].text}</span>
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
    }, 20000);

    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden font-manrope text-neutral-900 antialiased">
      {/* Mobile background image (bus-stand scene) — swap the PNG at the vayyBgMobile import */}
      {/* Mobile background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 bg-cover bg-center md:hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.15), rgba(255,255,255,0.15)), url(${vayyBgMobile})`,
        }}
      />
      {/* Desktop background image — swap the PNG at the vayyBg import */}
      {/* Desktop background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 hidden bg-cover bg-center md:block"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.15), rgba(255,255,255,0.15)), url(${vayyBg})`,
        }}
      />
      {/* Subtle warm radial glow — adjust colors/position here */}
      {/* Subtle warm radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 85% 10%, rgba(255, 190, 140, 0.35), transparent 0%), radial-gradient(50% 40% at 10% 90%, rgba(0, 152, 73, 0.08), transparent 60%)",
        }}
      />

      <div>
        {/* Hero */}
        {/* Hero: badge (mt-4 mobile only) -> h1 -> rotating hook -> description. */}
        <main className="mx-auto max-w-6xl px-6 pb-1 pt-1 text-center md:px-10 md:pb-1 ">
          {/* "Launching in India" pill — mt-4 applies on mobile only (cleared on md+) */}
          <div
            key={`badge-${contentKey}`}
            className="animate-lang-fade mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-neutral-700 shadow-lg shadow-black/5 backdrop-blur-md md:mt-0"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#009849] opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#009849]" />
            </span>
            {copy.badge}
          </div>

          <h1
            key={`h1-${contentKey}`}
            className="animate-lang-fade mx-auto max-w-6xl 
            text-balance text-center text-2xl font-bold leading-tight
             tracking-[-0.02em] text-neutral-900 sm:text-2xl md:text-3xl lg:text-4xl xl:text-2xl"
          >
            <span className="block">{copy.line1}</span>
            <RotatingHook lang={lang} />
          </h1>

          {/* Sub-headline — sizes: text-base on mobile, text-neutral-700 color */}
          <p
            key={`desc-${contentKey}`}
            className="animate-lang-fade mx-auto  
             max-w-lg text-center text-base font-semibold leading-snug text-neutral-700"
          >
            {copy.description.split("\n").map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </p>

          {/* Waitlist email capture — form + backend live in src/components/WaitlistForm.jsx */}
          <div key={`form-${contentKey}`} className="animate-lang-fade mx-auto mt-8">
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

      {/* Music player at the bottom — player UI + track logic live in src/components/MusicPlayer.jsx */}
      {/* Music player at the bottom */}
      <section className="relative z-10 mx-auto flex w-full flex-col items-center px-6 pb-16 pt-10">
        <MusicPlayer />
      </section>
    </div>
  );
}
