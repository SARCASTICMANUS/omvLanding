import React, { useMemo, useState, useEffect } from "react";
import {
  ArrowUpDown,
  Bus,
  Clock,
  Clock3,
  Crosshair,
  MapPin,
  Route,
  Search,
  ShieldCheck,
  TrafficCone,
} from "lucide-react";
import { LocationSearch } from "../../components/map";
import api from "../../lib/api";
import { API_PATHS } from "../../constants/apiPaths";
import splashScreen1 from "../../assets/SplashScreen1.png";
import { hasValidCoords } from "./driverFlowUtils";
// import api from "../../lib/api";

const brandGreen = "#009849";

function PlannerField({
  label,
  placeholder,
  onSelect,
  initialValue,
  icon: Icon,
}) {
  return (
    <div className="relative z-20">
      <label className="mb-3 flex items-center gap-3 text-[17px] font-extrabold text-[#0b171c] lg:text-[14px]">
        <Icon
          size={24}
          className="text-[#0aa658]"
          fill={brandGreen}
          strokeWidth={2.5}
        />
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
          className="pointer-events-none absolute right-5 top-1/2 z-20 -translate-y-1/2 text-[#7b8da3]"
          strokeWidth={2.2}
        />
      </div>
    </div>
  );
}

function FeatureItem({ icon: Icon, title, copy }) {
  return (
    <div className="flex min-w-0 items-center gap-5">
      <div className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full bg-[#dff4ea] text-[#0aa658]">
        <Icon size={32} strokeWidth={2.4} />
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
  const pickup = search.pickup || search.source;
  const destination = search.destination;

  const pickupLabel = pickup?.name || pickup?.display_name?.split(",")[0] || "Unknown Start";
  const destLabel = destination?.name || destination?.display_name?.split(",")[0] || "Unknown End";

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
          {pickupLabel}
        </div>
        <div className="truncate text-[11px] font-medium text-[#64748b]">
          To: {destLabel}
        </div>
      </div>
    </button>
  );
}

export default function DriverTripPlanner({
  onNext,
  loading = false,
  initialSource = null,
  initialDestination = null,
  onOpenPreview,
}) {
  const [source, setSource] = useState(initialSource);
  const [destination, setDestination] = useState(initialDestination);
  const [recentSearches, setRecentSearches] = useState([]);

  useEffect(() => {
    // Fetch recent searches - using passenger endpoint as a known working path
    api.get(API_PATHS.auth.recentSearches)
      .then(res => {
        setRecentSearches(Array.isArray(res.data) ? res.data : []);
      })
      .catch(err => console.error("Failed to fetch recent searches", err));
  }, []);

  const canProceed = useMemo(
    () => hasValidCoords(source) && hasValidCoords(destination),
    [source, destination],
  );

  const handleSwap = () => {
    const s = source;
    const d = destination;
    setSource(d);
    setDestination(s);
  };

  const handleNext = () => {
    if (!canProceed || loading) return;
    onNext?.({ from: source, to: destination });
  };

  const handleRecentClick = (search) => {
    setSource(search.pickup || search.source);
    setDestination(search.destination);
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-white font-sans text-[#071419] sm:bg-none">
      <section className="relative flex w-full flex-col overflow-hidden">
        <main className="relative z-10 mx-auto flex w-full max-w-full flex-1 flex-col">
          <section className="relative min-h-[320px] w-full flex-1">
            <div className="absolute inset-0 w-full h-full sm:flex sm:justify-end sm:bg-[#ffffff]">
              <img
                src={splashScreen1}
                alt="Vayy Driver Hero"
                className="h-full w-full object-cover p-0 m-0 sm:w-[40rem] sm:object-top lg:mt-[-8.5rem] lg:h-[23rem] lg:w-[40rem] lg:object-top"
              />
              <div className="absolute inset-0 bg-black/5" />
            </div>

            <div className="absolute inset-0 z-20 flex flex-col justify-center px-[20px] text-left sm:px-[40px] lg:mt-[-85px] lg:px-[60px]">
              <h1 className="text-[42px] font-black leading-[1.05] tracking-tight text-[#08161b] sm:text-[48px] lg:text-[48px]">
                Operate Your <br />
                <span className="bg-gradient-to-r from-[#078f48] to-[#17b965] bg-clip-text text-transparent lg:text-[50px]">
                  Driver Route
                </span>
              </h1>
              <p className="mt-4 max-w-[450px] text-[15px] font-medium leading-[1.6] text-[#33475b] sm:text-[16px] lg:text-[14px]">
                Enter source and destination points to search saved operational
                routes, review route details, and start the trip live.
              </p>
            </div>
          </section>

          <section className="relative z-30 mt-[-20px] w-full rounded-t-[20px] border-t border-[#e6ebef] bg-white p-[30px] shadow-[0_-15px_50px_rgba(18,38,48,0.12)] sm:p-[32px] lg:mt-[-6.5rem] lg:p-[30px]">
            <PlannerField
              label="Start Point"
              placeholder="Search source / depot / first boarding stop"
              onSelect={setSource}
              initialValue={source?.display_name || source?.name || ""}
              icon={MapPin}
            />

            <div className="relative my-[24px] flex items-center justify-center">
              <div className="absolute h-full border-l border-dashed border-[#d5dde7]" />
              <button
                type="button"
                onClick={handleSwap}
                className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#e1e8ee] bg-white text-[#1e303a] shadow-sm"
                aria-label="Swap start and destination"
              >
                <ArrowUpDown size={18} strokeWidth={2.2} />
              </button>
            </div>

            <PlannerField
              label="Destination"
              placeholder="Search destination / terminal / last stop"
              onSelect={setDestination}
              initialValue={
                destination?.display_name || destination?.name || ""
              }
              icon={MapPin}
            />

            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed || loading}
              className="mt-[30px] flex h-[64px] w-full items-center justify-center gap-4 rounded-[14px] bg-[#079f4f] text-[18px] font-bold text-white transition hover:bg-[#068a44] disabled:opacity-50 sm:h-[56px] sm:text-[16px]"
              style={{ boxShadow: "0 18px 38px rgba(0,152,73,0.18)" }}
            >
              <Search size={22} strokeWidth={2.5} />
              {loading ? "Searching Routes..." : "Search Saved Routes"}
            </button>

            {/* Recent Searches Section */}
            {recentSearches.length > 0 && (
              <div className="mt-8">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[13px] font-black uppercase tracking-widest text-[#94a3b8]">
                    Recent Trips
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

            {/* <div className="mt-8 rounded-[18px] border border-[#ebf2ed] bg-[#f6fbf8] p-4">
              <div className="mb-3 flex items-center gap-2">
                <Route size={16} className="text-[#079f4f]" />
                <span className="text-[13px] font-black uppercase tracking-widest text-[#5f6f83]">
                  Driver Flow
                </span>
              </div>
              <ul className="space-y-2 text-[13px] font-medium text-[#425466]">
                <li>Search all matching saved operational routes.</li>
                <li>
                  Review route cards, timings, stop count, and live status.
                </li>
                <li>Confirm the route and start live bus operations.</li>
              </ul>
            </div> */}

            {/* code */}
          </section>

          <section className="relative z-20 mt-0 grid w-full gap-8 bg-[#edf8f3] p-[30px] sm:p-[32px] lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-center lg:p-[40px]">
            <FeatureItem
              icon={TrafficCone}
              title="Operational Search"
              copy="Find all saved routes matching the searched endpoints without best-match prioritization."
            />
            <div className="hidden h-[64px] w-px border-l border-dashed border-[#bdcbd5] lg:block" />
            <FeatureItem
              icon={ShieldCheck}
              title="Live Driver Control"
              copy="Start trips, publish GPS, and move into the live operational tracking view."
            />
            <div className="hidden h-[64px] w-px border-l border-dashed border-[#bdcbd5] lg:block" />
            <FeatureItem
              icon={Bus}
              title="Route Review"
              copy="Inspect stops, timings, ETA, distance, and route status before going live."
            />
          </section>
        </main>
      </section>
    </div>
  );
}
