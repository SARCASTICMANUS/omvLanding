import React, { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Bus,
  ChevronDown,
  Crosshair,
  Globe2,
  MapPin,
  Menu,
  Search,
  ShieldCheck,
  Sun,
} from "lucide-react";
import LocationSearch from "../../../components/LocationSearch";
import loginBus from "../../../assets/loginBus.png";
import splashScreen1 from "../../../assets/splashScreen1.png";

const brandGreen = "#079f4f";

function VayyLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#12c46a] to-[#008e43] text-[23px] font-black text-white shadow-[0_10px_22px_rgba(0,153,77,0.25)]">
        V
      </div>
      <span className="text-[22px] font-black tracking-[0.02em] text-[#071419]">
        VAYY
      </span>
    </div>
  );
}

// function CityIllustration() {
//   return (
//     <div className="pointer-events-none absolute inset-y-0 right-0 hidden bg-green-500 overflow-hidden lg:block">
//       <svg
//         viewBox="0 0 620 245"
//         className="h-full w-full"
//         role="img"
//         aria-label="city bus route illustration"
//       >
//         <defs>
//           <linearGradient id="busBody" x1="0" x2="1" y1="0" x2="1">
//             <stop offset="0%" stopColor="#2eb979" />
//             <stop offset="100%" stopColor="#7ed6ab" />
//           </linearGradient>
//           <linearGradient id="roadFade" x1="0" x2="1">
//             <stop offset="0%" stopColor="#dbe8e2" stopOpacity="0" />
//             <stop offset="70%" stopColor="#c9ded5" stopOpacity="0.9" />
//           </linearGradient>
//         </defs>

//         <g opacity="0.46" fill="#dcebe4">
//           <rect x="218" y="71" width="19" height="116" />
//           <path d="M247 99h23v88h-23zM258 86l11 13h-22z" />
//           <rect x="287" y="62" width="24" height="125" />
//           <rect x="327" y="107" width="24" height="80" />
//           <rect x="365" y="83" width="31" height="104" />
//           <rect x="411" y="116" width="25" height="71" />
//           <rect x="458" y="52" width="53" height="135" rx="2" />
//           <rect x="532" y="76" width="36" height="111" rx="2" />
//           <rect x="585" y="45" width="35" height="142" rx="2" />
//         </g>

//         <g opacity="0.35" stroke="#cbded5" strokeWidth="2" fill="none">
//           <path d="M92 185v-25m0 0c-17-5-25-18-20-32 5-13 19-19 32-13 10-17 38-11 38 11 14 3 23 13 20 28-3 13-14 21-31 21" />
//           <path d="M559 184v-34m0 0c-21-6-30-22-24-38 7-17 27-22 43-13 12-20 43-10 43 14" />
//         </g>

//         <path
//           d="M168 196 C270 179, 352 189, 446 171 C505 160, 568 158, 620 166"
//           fill="none"
//           stroke="url(#roadFade)"
//           strokeWidth="12"
//           strokeLinecap="round"
//         />

//         <path
//           d="M410 25c6 26 38 25 39 49 1 23-31 20-31 42 0 17 17 22 36 19"
//           fill="none"
//           stroke="#8ab8a1"
//           strokeDasharray="6 8"
//           strokeLinecap="round"
//           strokeWidth="2.3"
//         />
//         <path
//           d="M408 12c-13 0-22 10-22 22 0 17 22 43 22 43s22-26 22-43c0-12-9-22-22-22z"
//           fill="#16a765"
//         />
//         <circle cx="408" cy="33" r="8" fill="white" />

//         <g transform="translate(363 139)">
//           <path
//             d="M0 17c0-17 7-25 24-25h78c17 0 27 9 29 26l5 52H7L0 17z"
//             fill="url(#busBody)"
//             stroke="#2d9364"
//             strokeWidth="1.5"
//           />
//           <path d="M12 3h82c14 0 23 7 25 19H9c1-9 2-15 3-19z" fill="#3b9974" opacity="0.75" />
//           <rect x="13" y="13" width="37" height="28" rx="3" fill="#265f57" opacity="0.85" />
//           <rect x="56" y="13" width="31" height="28" rx="3" fill="#265f57" opacity="0.85" />
//           <rect x="94" y="13" width="23" height="28" rx="3" fill="#265f57" opacity="0.85" />
//           <path d="M5 51h127l2 19H8L5 51z" fill="#9ad9b5" opacity="0.68" />
//           <circle cx="32" cy="72" r="12" fill="#293f3c" />
//           <circle cx="105" cy="72" r="12" fill="#293f3c" />
//           <circle cx="32" cy="72" r="5" fill="#d8eee4" />
//           <circle cx="105" cy="72" r="5" fill="#d8eee4" />
//           <rect x="3" y="27" width="5" height="17" rx="2" fill="#234943" />
//         </g>

//         <g transform="translate(534 92)">
//           <rect x="0" y="0" width="48" height="48" rx="8" fill="#7cc9a4" opacity="0.85" />
//           <Bus x="12" y="11" width="24" height="24" color="white" strokeWidth="2.5" />
//           <path d="M24 48v48" stroke="#93b9a8" strokeWidth="4" />
//         </g>

//         <g opacity="0.35" fill="#cbded5">
//           <path d="M501 44c7-5 16-4 21 2 5-5 13-5 19 0" fill="none" stroke="#cbded5" strokeWidth="2" strokeLinecap="round" />
//           <circle cx="214" cy="151" r="16" />
//           <circle cx="244" cy="161" r="11" />
//           <circle cx="284" cy="154" r="14" />
//         </g>
//       </svg>
//     </div>
//   );
// }

function PlannerField({ label, placeholder, onSelect, icon }) {
  return (
    <div className="relative z-20">
      <label className="mb-3 flex items-center gap-3 text-[17px] lg:text-[14px] font-extrabold text-[#0b171c]">
        {React.createElement(icon, {
          size: 24,
          className: "text-[#0aa658]",
          fill: brandGreen,
          strokeWidth: 2.5,
        })}
        {label}
      </label>

      <div className="relative">
        <LocationSearch
          placeholder={placeholder}
          onSelect={onSelect}
          className="h-[64px] w-full rounded-[10px] border border-[#cfd8e5] lg:h-[45px] lg:text-[14px] bg-white pl-[54px] pr-[54px] text-[17px] font-medium text-[#14242c] shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)] outline-none transition focus:border-[#8fa6ba] focus:ring-4 focus:ring-[#dcebe4]"
        />
        <Crosshair
          size={21}
          className="pointer-events-none absolute  right-5 top-1/2 z-20 -translate-y-1/2 text-[#7b8da3]"
          strokeWidth={2.2}
        />
      </div>
    </div>
  );
}

function FeatureItem({ icon, title, copy }) {
  return (
    <div className="flex min-w-0 items-center gap-5">
      <div className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full bg-[#dff4ea] text-[#0aa658]">
        {React.createElement(icon, { size: 32, strokeWidth: 2.4 })}
      </div>
      <div>
        <h3 className="text-[16px] font-extrabold text-[#102027]">{title}</h3>
        <p className="mt-2 max-w-[260px] text-[13px] font-medium leading-6 text-[#5f6f83]">
          {copy}
        </p>
      </div>
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
    <div className="min-h-screen bg-white sm:bg-none font-sans text-[#071419]">
      <section className="relative flex min-h-[calc(100vh-64px)] w-full flex-col overflow-hidden">
        
        {/* Main Content Container: Unified immersive layout */}
        <main className="relative z-10 flex flex-1 flex-col w-full max-w-full mx-auto">
          
          {/* Hero Section: Hero image fills available space above the card */}
          <section className="relative w-full  flex-1 min-h-[320px]">
            {/* Background Image */}
            <div className='absolute sm:relative sm:bg-[#ffffff] inset-0 w-full h-full sm:flex sm:justify-end'>
              <img src={splashScreen1} alt="Vayy Hero" className='w-full h-full object-cover p-0 m-0 sm:w-[40rem] lg:w-[40rem] lg:h-[23rem] lg:mt-[-8.5rem]  sm:object-top lg:object-top ' />
              <div className="absolute inset-0 bg-black/5" />
            </div>

            {/* Heading Content: Centered over image */}
            <div className="absolute inset-0 flex flex-col justify-center px-[20px] sm:px-[40px] lg:px-[60px] lg:mt-[-85px] text-left z-20">
              <h1 className="text-[42px] sm:text-[48px] lg:text-[48px] font-black leading-[1.05] tracking-tight text-[#08161b]">
                Choose Your <br />
                <span className="bg-gradient-to-r from-[#078f48] to-[#17b965] bg-clip-text text-transparent lg:text-[50px]">
                  Route
                </span>
              </h1>
              <p className="mt-4 max-w-[450px] text-[15px] sm:text-[16px] lg:text-[14px] font-medium leading-[1.6] text-[#33475b]">
                Enter your pickup and drop locations <br />
                to find the best bus routes <br />
                and track in real-time.
              </p>
            </div>
          </section>

          {/* Search Card Section: Attached to bottom, overlaps hero */}
          <section className="relative z-30 mt-[-20px] lg:mt-[-6.5rem] w-full bg-white rounded-t-[20px] border-t border-[#e6ebef] p-[30px] sm:p-[32px] lg:p-[30px] shadow-[0_-15px_50px_rgba(18,38,48,0.12)]">
            <PlannerField
            
              label="Pickup Point"
              placeholder="Search pickup location "
              onSelect={setPickup}
              
              icon={MapPin}r
            />

            <div className="relative my-[24px]  flex items-center justify-center">
              <div className="absolute h-full border-l border-dashed border-[#d5dde7]" />
              <button
                type="button"
                className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e1e8ee] bg-white text-[#1e303a] shadow-sm"
                aria-label="Swap pickup and drop"
              >
                <ArrowUpDown size={18} strokeWidth={2.2} className="lg:h-8 "/>
              </button>
            </div>

            <PlannerField
            
              label="Drop Location "
              placeholder="Enter your destination"
              onSelect={setDestination}
              icon={MapPin}
            />

            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed || loading}
              className="mt-[30px] flex h-[64px] sm:h-[56px] w-full items-center justify-center gap-4 rounded-[14px] bg-[#079f4f] text-[18px] sm:text-[16px] font-bold text-white transition hover:bg-[#068a44] shadow-lg shadow-[#079f4f]/20 disabled:opacity-50"
            >
              <Search size={22} strokeWidth={2.5} />
              {loading ? "Searching..." : "Search Vayy Rides"}
            </button>
          </section>

          {/* Feature List: Flush with search card */}
          <section className="relative z-20 mt-0 grid w-full gap-8 bg-[#edf8f3] p-[30px] sm:p-[32px] lg:p-[40px] lg:grid-cols-[1fr_auto_1fr] lg:items-center">
            <FeatureItem
              icon={ShieldCheck}
              title={
                <>
                  Safe. <br />
                  Reliable. <br />
                  On Time.
                </>
              }
              copy="Real-time transit tracking powered by Vayy Geospatial."
            />
            <div className="hidden h-[64px] w-px border-l border-dashed border-[#bdcbd5] lg:block" />
            <FeatureItem
              icon={Bus}
              title="Live Tracking"
              copy="Track buses in real-time and get accurate arrival updates."
            />
          </section>
        </main>

        <footer className="relative z-20 mt-0 flex flex-col gap-6 border-t border-[#dbe4ea] bg-white px-[20px] sm:px-[40px] py-[24px] text-[13px] font-medium text-[#637286] sm:flex-row sm:items-center sm:justify-between">
          <span>&copy; 2025 Vayy. All rights reserved.</span>
          <nav className="flex flex-wrap gap-7">
            <a href="#" className="transition hover:text-[#079f4f]">
              Terms of Service
            </a>
            <a href="#" className="transition hover:text-[#079f4f]">
              Privacy Policy
            </a>
            <a href="#" className="transition hover:text-[#079f4f]">
              Contact Us
            </a>
          </nav>
        </footer>
      </section>
    </div>
  );
}