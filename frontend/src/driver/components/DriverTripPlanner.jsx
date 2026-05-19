import React, { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Bus,
  Clock3,
  Crosshair,
  MapPin,
  Route,
  Search,
  ShieldCheck,
  TrafficCone,
} from "lucide-react";
import { LocationSearch } from "../../components/map";
import splashScreen1 from "../../assets/SplashScreen1.png";
import { hasValidCoords } from "./driverFlowUtils";

const brandGreen = "#009849";

function PlannerField({ label, placeholder, onSelect, initialValue, icon: Icon }) {
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

export default function DriverTripPlanner({
  onNext,
  loading = false,
  initialSource = null,
  initialDestination = null,
  onOpenPreview,
}) {
  const [source, setSource] = useState(initialSource);
  const [destination, setDestination] = useState(initialDestination);

  const canProceed = useMemo(
    () => hasValidCoords(source) && hasValidCoords(destination),
    [source, destination],
  );

  const handleSwap = () => {
    setSource(destination);
    setDestination(source);
  };

  const handleNext = () => {
    if (!canProceed || loading) return;
    onNext?.({ from: source, to: destination });
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
                Enter source and destination points
                to search saved operational routes,
                review route details,
                and start the trip live.
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
              initialValue={destination?.display_name || destination?.name || ""}
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

            <div className="mt-8 rounded-[18px] border border-[#ebf2ed] bg-[#f6fbf8] p-4">
              <div className="mb-3 flex items-center gap-2">
                <Route size={16} className="text-[#079f4f]" />
                <span className="text-[13px] font-black uppercase tracking-widest text-[#5f6f83]">
                  Driver Flow
                </span>
              </div>
              <ul className="space-y-2 text-[13px] font-medium text-[#425466]">
                <li>Search all matching saved operational routes.</li>
                <li>Review route cards, timings, stop count, and live status.</li>
                <li>Confirm the route and start live bus operations.</li>
              </ul>
            </div>

            {onOpenPreview && (
              <div className="mt-6 rounded-[18px] border border-dashed border-[#cfe4d5] bg-[#fbfefd] p-4">
                <span className="text-[13px] font-black uppercase tracking-widest text-[#94a3b8]">
                  Temporary Preview
                </span>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => onOpenPreview("routes")}
                    className="rounded-[12px] border border-[#dce7df] bg-white px-4 py-3 text-left text-[12px] font-bold text-[#1e293b] transition hover:border-[#079f4f] hover:bg-[#f8fbfa]"
                  >
                    Preview Route List
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenPreview("review")}
                    className="rounded-[12px] border border-[#dce7df] bg-white px-4 py-3 text-left text-[12px] font-bold text-[#1e293b] transition hover:border-[#079f4f] hover:bg-[#f8fbfa]"
                  >
                    Preview Trip Review
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenPreview("timeline")}
                    className="rounded-[12px] border border-[#dce7df] bg-white px-4 py-3 text-left text-[12px] font-bold text-[#1e293b] transition hover:border-[#079f4f] hover:bg-[#f8fbfa]"
                  >
                    Preview Stops Timeline
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenPreview("live")}
                    className="rounded-[12px] border border-[#dce7df] bg-white px-4 py-3 text-left text-[12px] font-bold text-[#1e293b] transition hover:border-[#079f4f] hover:bg-[#f8fbfa]"
                  >
                    Preview Live Tracking
                  </button>
                </div>
              </div>
            )}
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
