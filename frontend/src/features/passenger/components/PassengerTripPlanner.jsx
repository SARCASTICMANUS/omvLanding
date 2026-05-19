import React, { useMemo, useState, useEffect } from "react";
import {
  ArrowUpDown,
  Bus,
  ChevronDown,
  Clock,
  Crosshair,
  Globe2,
  MapPin,
  Menu,
  Search,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { LocationSearch } from "../../../components/map";
import api from "../../../lib/api";
import splashScreen1 from "../../../assets/SplashScreen1.png";

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



function PlannerField({ label, placeholder, onSelect, initialValue, icon }) {
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
          initialValue={initialValue}
          className="h-[52px] w-full rounded-[10px] border border-[#cfd8e5] bg-white pl-[54px] pr-[54px] text-[15px] font-medium text-[#14242c] shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)] outline-none transition focus:border-[#8fa6ba] focus:ring-4 focus:ring-[#dcebe4]"
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

function RecentSearchItem({ search, onClick }) {
  return (
    <button
      onClick={() => onClick(search)}
      className="group flex w-full items-center gap-3 rounded-[12px] border border-[#f0f3f6] bg-white p-3 text-left transition hover:border-[#079f4f] hover:bg-[#f8fbfa] hover:shadow-sm"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-[#64748b] group-hover:bg-[#dff4ea] group-hover:text-[#079f4f]">
        <Clock size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold text-[#1e293b]">
          {search.pickup?.name || search.pickup?.display_name?.split(",")[0]}
        </div>
        <div className="truncate text-[11px] font-medium text-[#64748b]">
          To: {search.destination?.name || search.destination?.display_name?.split(",")[0]}
        </div>
      </div>
    </button>
  );
}

export default function PassengerTripPlanner({
  onNext,
  loading = false,
}) {
  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);

  useEffect(() => {
    // Fetch recent searches
    api.get("/api/passenger/recent-searches/")
      .then(res => {
        setRecentSearches(Array.isArray(res.data) ? res.data : []);
      })
      .catch(err => console.error("Failed to fetch recent searches", err));
  }, []);

  const canProceed = useMemo(() => {
    return Boolean(
      pickup?.lat && pickup?.lon && destination?.lat && destination?.lon
    );
  }, [pickup, destination]);

  const handleNext = () => {
    if (!canProceed || loading) return;
    onNext?.({ from: pickup, to: destination });
  };

  const handleRecentClick = (search) => {
    setPickup(search.pickup);
    setDestination(search.destination);
  };

  return (
    <div className="min-h-screen bg-white sm:bg-none font-sans text-[#071419]">
      <section className="relative flex w-full flex-col overflow-hidden -mt-5">
        
        {/* Main Content Container: Unified immersive layout */}
        <main className="relative z-10 flex flex-1 flex-col w-full max-w-full mx-auto">
          
          {/* Hero Section: Hero image fills available space above the card */}
          <section className="relative w-full  flex-1 min-h-[320px]">
            {/* Background Image */}
            <div className='absolute sm:relative  sm:bg-[#ffffff] inset-0 w-full h-full sm:flex sm:justify-end'>
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

          {/* Search Card Section */}
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
          

            {/* Recent Searches Section */}
            {recentSearches.length > 0 && (
              <div className="mt-8">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[13px] font-black uppercase tracking-widest text-[#94a3b8]">
                    Recent Searches
                  </span>
                  <div className="h-px flex-1 bg-[#f1f5f9] ml-4" />
                </div>
                <div className="space-y-2">
                  {recentSearches.map((search, idx) => (
                    <RecentSearchItem
                      key={idx}
                      search={search}
                      onClick={handleRecentClick}
                    />
                  ))}
                </div>
              </div>
            )}
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

        {/* <footer className="relative z-20 mt-0 flex flex-col gap-6 border-t border-[#dbe4ea] bg-white px-[20px] sm:px-[40px] py-[24px] text-[13px] font-medium text-[#637286] sm:flex-row sm:items-center sm:justify-between">
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
        </footer> */}
      </section>
    </div>
  );
}
