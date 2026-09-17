import { useState } from "react";
import { useNavigate } from "react-router-dom";
import splash1 from "../assets/splash1.png";
import splash2 from "../assets/splash2.png";
import splash3 from "../assets/splash3.png";
import splash4 from "../assets/splash4.png";
import splash5 from "../assets/splash5.png";

const SPLASHES = [
  { img: splash1, headline: "Still Waiting?", subtitle: "Your daily commute shouldn't start with a long wait." },
  { img: splash2, headline: "Too Crowded.\nToo Slow.", subtitle: "Skip packed buses and unpredictable waits." },
  { img: splash3, headline: "Someone's Already\nGoing Your Way.", subtitle: "Find a ride already moving along your route." },
  { img: splash4, headline: "Share the Journey.", subtitle: "Marshals pick up Buddies along their route." },
  { img: splash5, headline: "Stop Waiting.\nStart Moving.", subtitle: "Join OMV" },
];

export default function SplashPreview() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);

  const next = () => {
    if (current < SPLASHES.length - 1) setCurrent(current + 1);
  };

  const prev = () => {
    if (current > 0) setCurrent(current - 1);
  };

  const splash = SPLASHES[current];

  return (
    <div className="relative min-h-screen bg-white overflow-hidden">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="absolute left-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/10 text-white backdrop-blur-sm"
      >
        ←
      </button>

      {/* Splash image */}
      <img
        src={splash.img}
        alt={splash.headline}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-white via-white/50 to-transparent" />

      {/* Text overlay */}
      <div className="absolute bottom-24 left-8 right-8 z-10">
        <h2 className="text-3xl font-black text-[#009849] leading-tight whitespace-pre-line">
          {splash.headline}
        </h2>
        <p className="mt-2 text-base font-medium text-gray-500">
          {splash.subtitle}
        </p>
      </div>

      {/* Dots + navigation */}
      <div className="absolute bottom-10 left-0 right-0 z-10 flex items-center justify-between px-8">
        <div className="flex gap-2">
          {SPLASHES.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === current ? "w-7 bg-[#009849]" : "w-2 bg-gray-300"
              }`}
            />
          ))}
        </div>
        <button
          onClick={() => current === SPLASHES.length - 1 ? navigate(-1) : next()}
          className="rounded-full bg-[#009849] px-7 py-3 text-sm font-bold text-white shadow-lg shadow-[#009849]/30"
        >
          {current === SPLASHES.length - 1 ? "Join" : "Next"}
        </button>
      </div>
    </div>
  );
}
