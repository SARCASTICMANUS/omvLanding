import React, { useMemo, useState } from "react";
import { ChevronLeft, ArrowRight, Bus, Clock } from "lucide-react";
import img from "../../../assets/img1.png"; // Keeping the Vayy branding image

/**
 * Single Route Card - Styled like the reference but with Vayy aesthetics
 */
function RouteCard({ trip, selected, onSelect }) {
  const title = trip.route_name || `Route ${trip.trip_id}`;
  
  return (
    <button
      type="button"
      onClick={() => onSelect(trip)}
      className={`w-full rounded-2xl p-6 transition-all duration-300 border-2 ${
        selected
          ? "border-black bg-white shadow-lg translate-x-1"
          : "border-transparent bg-neutral-100 hover:bg-neutral-200"
      }`}
    >
      <div className="flex flex-col gap-4">
        {/* Route Header */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">
            {title}
          </span>
          {selected && (
             <div className="h-2 w-2 rounded-full bg-black animate-pulse" />
          )}
        </div>

        {/* Path Info */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-lg font-bold text-black">Noida</span>
            <span className="text-[10px] font-bold uppercase text-neutral-400">ETA: --</span>
          </div>

          <ArrowRight size={20} className="text-neutral-300" />

          <div className="flex flex-col text-right">
            <span className="text-lg font-bold text-black">Delhi</span>
            <span className="text-[10px] font-bold uppercase text-neutral-400">
                {Math.max(1, Math.ceil(Number(trip.eta_seconds || 2700) / 60))} min
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function PassengerRouteList({
  onBack,
  onChooseRoute,
  trips = [],
  loading = false,
}) {
  const [selectedTrip, setSelectedTrip] = useState(null);

  const handleChoose = () => {
    if (!selectedTrip || loading) return;
    onChooseRoute?.(selectedTrip);
  };

  return (
    <div className="relative min-h-screen w-full bg-white overflow-hidden">
      
      {/* Desktop Background Image */}
      <div className="hidden lg:block absolute inset-0 z-0">
        <img 
          src={img} 
          alt="Vayy Background" 
          className="h-full w-full object-cover grayscale-[20%]"
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <div className="relative z-10 flex min-h-screen">
        
        {/* LEFT PANEL: Route Selection */}
        <div className="flex w-full flex-col bg-white px-8 pt-12 sm:px-12 lg:h-screen lg:w-[480px] lg:shadow-[30px_0_60px_-15px_rgba(0,0,0,0.15)]">
          
          {/* Header */}
          <div className="mb-10 flex items-center justify-between">
             <button
              type="button"
              onClick={onBack}
              className="group flex h-10 w-10 items-center justify-center rounded-full border border-neutral-100 transition-all hover:bg-black hover:text-white"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <h1 className="text-2xl font-black tracking-tighter">VAYY</h1>
            <div className="w-10" />
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar pb-6">
            <h2 className="mb-2 text-xl font-bold text-neutral-900">Choose Your Route</h2>
            <p className="mb-8 text-xs font-bold uppercase tracking-widest text-neutral-400">Available Routes</p>
            
            <div className="space-y-4">
              {loading ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="h-32 w-full animate-pulse rounded-2xl bg-neutral-100" />
                ))
              ) : trips.length > 0 ? (
                trips.map((trip) => (
                  <RouteCard
                    key={trip.trip_id}
                    trip={trip}
                    selected={selectedTrip?.trip_id === trip.trip_id}
                    onSelect={setSelectedTrip}
                  />
                ))
              ) : (
                <div className="py-20 text-center">
                    <Bus className="mx-auto mb-4 text-neutral-200" size={48} />
                    <p className="text-neutral-400 font-bold uppercase text-[11px] tracking-widest">No routes available</p>
                </div>
              )}
            </div>
          </div>

          {/* CTA Area */}
          <div className="pb-12 pt-6 bg-white border-t border-neutral-50">
            <button
              type="button"
              onClick={handleChoose}
              disabled={!selectedTrip || loading}
              className="group relative flex h-[64px] w-full items-center justify-center overflow-hidden rounded-2xl bg-black text-[16px] font-bold text-white transition-all hover:bg-neutral-900 active:scale-[0.98] disabled:bg-neutral-100 disabled:text-neutral-400"
            >
              <span className="relative z-10">
                {loading ? "Confirming..." : "Confirm Selected Route"}
              </span>
              {!loading && selectedTrip && (
                <ArrowRight className="absolute right-6 transition-transform group-hover:translate-x-1" size={20} />
              )}
            </button>
          </div>
        </div>

        {/* RIGHT CONTENT: Branding (Desktop) */}
        <div className="hidden flex-1 flex-col justify-end p-24 lg:flex">
            <div className="max-w-xl animate-in fade-in slide-in-from-bottom-6 duration-1000">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20">
                    <Clock className="text-white" size={32} />
                </div>
                <h2 className="text-6xl font-black leading-[1.1] text-white">
                  Real-time <br /> precision.
                </h2>
                <p className="mt-6 text-xl text-white/80 max-w-sm">
                  Select a route to view live bus locations and highly accurate arrival times.
                </p>
            </div>
        </div>

      </div>
    </div>
  );
}