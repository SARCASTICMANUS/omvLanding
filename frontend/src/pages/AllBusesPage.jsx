import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  BusFront,
  ChevronRight,
  Filter,
  Info,
  MapPin,
  RefreshCw,
  Search,
  Snowflake,
  TrendingUp,
} from "lucide-react";
import MobileBackButton from "../components/Layout/MobileBackButton";
import api from "../lib/api";
import { APP_ROUTES } from "../constants/routes";

/* ─────────────────────────────────────────────
   ROUTE PROGRESS LINE
   Green solid → bus marker → gray dashed → red dot
───────────────────────────────────────────── */
function RouteLine({ progress = 40 }) {
  return (
    <div className="flex items-center gap-0 w-full mt-2 mb-1">
      {/* green start dot */}
      <span
        className="w-[13px] h-[13px] rounded-full bg-[#009849] flex-shrink-0"
        style={{ boxShadow: "0 0 0 3px rgba(0,152,73,0.18)" }}
      />

      {/* green solid fill */}
      <div
        className="h-[3px] bg-[#009849] flex-shrink-0"
        style={{ width: `${progress}%` }}
      />

      {/* bus icon marker */}
      <div className="w-8 h-8 rounded-full bg-white border-2 border-[#009849] flex items-center justify-center flex-shrink-0 -mx-1 z-10 shadow-sm">
        <BusFront size={14} color="#009849" strokeWidth={2.5} />
      </div>

      {/* gray dashed remaining */}
      <div
        className="flex-1 h-[2px] flex-shrink-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to right, #d1d5db 0, #d1d5db 6px, transparent 6px, transparent 12px)",
        }}
      />

      {/* red end dot */}
      <span
        className="w-[13px] h-[13px] rounded-full bg-transparent border-2 border-red-500 flex-shrink-0"
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   METRIC CHIP
───────────────────────────────────────────── */
function MetricChip({ icon: Icon, label, green = false }) {
  return (
    <div className="flex items-center gap-1.5 border border-gray-100 rounded-xl px-3 py-2 bg-white">
      <Icon size={14} color={green ? "#009849" : "#6b7280"} strokeWidth={2} />
      <span
        className={`text-[12px] font-semibold ${
          green ? "text-[#009849]" : "text-gray-600"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   BUS CARD
───────────────────────────────────────────── */
function BusCard({ trip, onChooseRoute }) {
  const busNo    = trip?.bus_number || trip?.vehicle_number || trip?.vehicle_no || "UP 32 DC 0003";
  const eta      = Math.max(1, Math.ceil(Number(trip?.eta_seconds || 2700) / 60));
  const seatType = trip?.seat_type || trip?.vehicle_type || trip?.bus_type || "AC Bus";
  const distance = trip?.distance_km   || trip?.distance_text  || "45 km";
  const stops    = trip?.stops_count   || trip?.stop_count     || 8;
  const from     = trip?.pickup_name   || trip?.startLabel     || "Noida";
  const to       = trip?.destination_name || trip?.endLabel    || "Delhi";
  const startT   = trip?.start_time    || "7:00 AM";
  const endT     = trip?.end_time      || "3:00 PM";

  return (
    <div
      className="bg-white rounded-[18px] border border-gray-100 shadow-sm cursor-pointer
                 hover:border-[#009849] hover:shadow-md transition-all duration-200 overflow-hidden"
      onClick={() => onChooseRoute?.(trip)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onChooseRoute?.(trip)}
    >
      <div className="flex items-stretch">

        {/* ── LEFT: bus icon + LIVE badge ── */}
        <div className="flex flex-col items-center justify-between p-4 pr-0 flex-shrink-0">
          <div className="w-[68px] h-[68px] rounded-[16px] bg-green-50 border border-green-200
                          flex items-center justify-center">
            <BusFront size={32} color="#009849" strokeWidth={2} />
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            <span className="w-2 h-2 rounded-full bg-[#009849] animate-pulse" />
            <span className="text-[11px] font-extrabold text-[#009849] tracking-wide">LIVE</span>
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 p-4 min-w-0">

          {/* Row 1: Vehicle No + On Time + ETA + arrow */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                Vehicle No.
              </p>
              <p className="text-[18px] font-black text-gray-900 leading-tight">{busNo}</p>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              {/* On Time badge */}
              <div className="flex items-center gap-1.5 bg-green-50 border border-green-200
                              rounded-full px-3 py-1">
                <span className="w-2 h-2 rounded-full bg-[#009849]" />
                <span className="text-[12px] font-bold text-[#009849]">On Time</span>
              </div>

              {/* ETA */}
              <div className="text-right">
                <p className="text-[10px] font-semibold text-gray-400 uppercase">ETA</p>
                <p className="text-[22px] font-black text-gray-900 leading-none">
                  {eta}
                  <span className="text-[13px] font-bold text-[#009849] ml-1">min</span>
                </p>
              </div>

              {/* Chevron */}
              <ChevronRight size={18} color="#9ca3af" className="mt-1 flex-shrink-0" />
            </div>
          </div>

          {/* Row 2: Route line */}
          <div className="mt-3">
            <div className="flex justify-between items-baseline mb-0.5">
              <div>
                <p className="text-[15px] font-black text-gray-900">{from}</p>
                <p className="text-[12px] text-gray-400">{startT}</p>
              </div>
              <div className="text-right">
                <p className="text-[15px] font-black text-gray-900">{to}</p>
                <p className="text-[12px] text-gray-400">{endT}</p>
              </div>
            </div>
            <RouteLine progress={42} />
          </div>

          {/* Row 3: Metric chips */}
          <div className="flex flex-wrap gap-2 mt-3">
            <MetricChip icon={TrendingUp}
              label={typeof distance === "number" ? `${distance} km` : distance} />
            <MetricChip icon={MapPin} label={`${stops} Stops`} />
            <MetricChip icon={Snowflake} label={seatType} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   LOADING SKELETON
───────────────────────────────────────────── */
function BusCardSkeleton() {
  return (
    <div className="bg-white rounded-[18px] border border-gray-100 shadow-sm p-4 flex gap-4 animate-pulse">
      <div className="w-[68px] h-[68px] rounded-[16px] bg-gray-100 flex-shrink-0" />
      <div className="flex-1 space-y-3">
        <div className="h-4 bg-gray-100 rounded w-1/3" />
        <div className="h-6 bg-gray-100 rounded w-1/2" />
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="flex gap-2">
          <div className="h-8 bg-gray-100 rounded-xl w-20" />
          <div className="h-8 bg-gray-100 rounded-xl w-20" />
          <div className="h-8 bg-gray-100 rounded-xl w-20" />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN EXPORT — AllBusesPage
───────────────────────────────────────────── */
export default function AllBusesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [trips,      setTrips]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const pickupName = searchParams.get("pName") || "Current Location";
  const destName   = searchParams.get("dName") || "Destination";

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/passenger/dashboard/");
      const data = response.data;
      let allTrips = [];
      if      (Array.isArray(data.active_trips)) allTrips = data.active_trips;
      else if (Array.isArray(data.results))      allTrips = data.results;
      else if (Array.isArray(data))              allTrips = data;
      setTrips(allTrips);
    } catch (error) {
      console.error("Failed to fetch all trips", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTrips(); }, []);

  const handleBusClick = (trip) => {
    const tripId = trip.id || trip.trip_id;
    navigate(APP_ROUTES.tracking.replace(":tripId", tripId));
  };

  const filteredBuses = trips.filter(bus =>
    (bus.bus_number  || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (bus.route_name  || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCount = filteredBuses.length;

  return (
    <div className="min-h-screen bg-[#F8FAF9] font-[Plus_Jakarta_Sans,sans-serif]">
      {/* Mobile back button for small screens */}
      <MobileBackButton onClick={() => navigate(-1)} />

      {/* ══════════════════════════════════
          STICKY HEADER  (breadcrumb + title + filters)
      ══════════════════════════════════ */}
      <div className="bg-white border-b border-gray-100 sticky top-0 lg:top-[64px] z-40 shadow-sm">
        <div className="max-w-[1200px] mx-auto px-5 py-5">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 mb-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-500
                         hover:text-[#009849] transition-colors cursor-pointer bg-none border-none"
            >
              <ArrowLeft size={14} strokeWidth={2.5} />
              Track Buses
            </button>
          </div>

          {/* Title row */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-[24px] lg:text-[28px] font-black text-gray-900 leading-tight">
                Buses running on your route
              </h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {["Real-time updates","Accurate ETA","Live tracking"].map((item, i) => (
                  <React.Fragment key={item}>
                    {i > 0 && <span className="text-gray-300 text-sm">•</span>}
                    <span className="text-[13px] text-gray-500 font-medium">{item}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Filter chips row */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Active buses pill */}
              <div className="flex items-center gap-2 bg-green-50 border border-green-200
                              rounded-full px-4 py-2">
                <span className="w-2 h-2 rounded-full bg-[#009849] animate-pulse" />
                <span className="text-[13px] font-bold text-[#009849]">
                  {loading ? "..." : activeCount} Active Buses
                </span>
              </div>

              {/* Filter btn */}
              <button type="button" className="flex items-center gap-2 bg-white border border-gray-200
                rounded-full px-4 py-2 text-[13px] font-semibold text-gray-700
                hover:border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer">
                <Filter size={14} color="#374151" />
                Filter
              </button>

              {/* Sort btn */}
              <button type="button" className="flex items-center gap-2 bg-white border border-gray-200
                rounded-full px-4 py-2 text-[13px] font-semibold text-gray-700
                hover:border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer">
                <ArrowUpDown size={14} color="#374151" />
                Sort by ETA
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="mt-4 bg-gray-50 rounded-[14px] px-4 py-3 flex items-center gap-3
                          border border-gray-100 focus-within:border-[#009849]
                          focus-within:ring-2 focus-within:ring-[#009849]/10 transition-all">
            <Search size={17} color="#9ca3af" className="flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by bus number or route..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none w-full text-[14px]
                         font-semibold text-gray-900 placeholder:text-gray-400
                         placeholder:font-normal"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="text-gray-400 hover:text-gray-600 cursor-pointer flex-shrink-0
                           bg-none border-none text-[18px] leading-none"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════ */}
      <main className="max-w-[1200px] mx-auto px-5 py-6 pb-28 lg:pb-10">

        {/* Route context chip */}
        <div className="flex items-center gap-3 mb-5 bg-white rounded-[14px] border border-gray-100
                        shadow-sm px-4 py-3 w-fit">
          <MapPin size={15} color="#009849" className="flex-shrink-0" />
          <span className="text-[13px] font-bold text-gray-700">
            {pickupName}
          </span>
          <ArrowRight size={14} color="#9ca3af" className="flex-shrink-0" />
          <span className="text-[13px] font-bold text-gray-700">
            {destName}
          </span>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col gap-4">
            {[1,2,3].map(i => <BusCardSkeleton key={i} />)}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && filteredBuses.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center
                            justify-center mb-4">
              <BusFront size={28} color="#9ca3af" />
            </div>
            <h3 className="text-[18px] font-black text-gray-900 mb-2">
              {searchTerm ? "No buses match your search" : "No buses available"}
            </h3>
            <p className="text-[14px] text-gray-500 mb-6 max-w-sm">
              {searchTerm
                ? `No buses found for "${searchTerm}". Try a different search.`
                : "No active buses on this route right now. Please check back shortly."}
            </p>
            <button
              type="button"
              onClick={fetchTrips}
              className="flex items-center gap-2 bg-[#009849] text-white px-5 py-2.5
                         rounded-[12px] font-bold text-[14px] hover:bg-[#007a3d]
                         transition-colors cursor-pointer border-none"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        )}

        {/* ── Bus cards list ── */}
        {!loading && filteredBuses.length > 0 && (
          <div className="flex flex-col gap-4">
            {filteredBuses.map((trip) => (
              <BusCard
                key={trip.id || trip.trip_id}
                trip={trip}
                onChooseRoute={handleBusClick}
              />
            ))}
          </div>
        )}
      </main>

      {/* ══════════════════════════════════
          MOBILE BOTTOM DISCLAIMER BAR
      ══════════════════════════════════ */}
      <div className="lg:hidden fixed bottom-[68px] left-0 right-0 bg-green-50
                      border-t border-green-100 px-4 py-3 z-40">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full bg-[#009849] flex items-center
                            justify-center flex-shrink-0 mt-0.5">
              <Info size={11} color="white" />
            </div>
            <p className="text-[12px] text-gray-600 font-medium leading-snug">
              All timings are estimated. Real-time updates may vary based on traffic conditions.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchTrips}
            className="flex-shrink-0 w-8 h-8 rounded-full border border-green-200
                       bg-white flex items-center justify-center hover:bg-green-50
                       cursor-pointer"
          >
            <RefreshCw size={14} color="#009849" />
          </button>
        </div>
      </div>
    </div>
  );
}