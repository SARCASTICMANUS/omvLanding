import React, { useEffect, useState } from "react";
import { Clock, Loader2, MapPin, Star } from "lucide-react";
import { StatusBadge, VayyCard } from "../components/vayy";
import api from "../lib/api";
import { API_PATHS } from "../constants/apiPaths";

const unwrapTrips = (payload) => {
  const data = payload?.data ?? payload;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
};

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return String(dateStr);
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function TripsPage() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.get(API_PATHS.ride.history, { params: { page: 1 } })
      .then((response) => {
        if (active) setTrips(unwrapTrips(response.data));
      })
      .catch(() => {
        if (active) setError("Your trip history could not be loaded. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <div className="min-h-screen bg-brand-canvas font-sans text-brand-ink">
      <header className="relative overflow-hidden rounded-b-[32px] bg-[#009849] px-6 pb-5 pt-8">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <span className="absolute -right-10 -top-16 h-[90%] w-[70%] rotate-[25deg] rounded-[120px] bg-[#00B857] opacity-25" />
          <span className="absolute -right-5 -top-20 h-[70%] w-[50%] rotate-[35deg] rounded-[120px] bg-white/10" />
        </div>
        <div className="relative z-10 mx-auto w-full max-w-2xl lg:max-w-3xl">
          <h1 className="text-[26px] font-black leading-tight text-white">My Trips</h1>
          <p className="mt-1 text-[13px] font-medium text-white/75">Your journey history</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pb-8 pt-4 lg:max-w-3xl">
        {loading ? (
          <div className="flex min-h-48 items-center justify-center" role="status" aria-label="Loading trips">
            <Loader2 size={28} className="animate-spin text-[#009849]" />
          </div>
        ) : error ? (
          <p role="alert" className="rounded-[16px] border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>
        ) : trips.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Clock size={48} className="text-[#9CA3AF]" aria-hidden="true" />
            <p className="text-lg font-bold text-[#6B7280]">No journeys yet</p>
            <p className="text-sm font-medium text-[#9CA3AF]">Your trip history will appear here</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-label="Trip history">
            {trips.map((trip, index) => {
              const completed = String(trip.status || "completed").toLowerCase() === "completed";
              const vehicle = trip.vehicle || {};
              const rating = typeof trip.rating === "number" ? trip.rating : Number(trip.rating?.score);
              return (
                <li key={trip.id ?? index} className="h-full">
                  <VayyCard className="flex h-full flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <MapPin size={17} className="shrink-0 text-[#009849]" />
                        <h2 className="truncate text-[15px] font-extrabold text-[#111827]">
                          {trip.route_name || trip.route || "Your ride"}
                        </h2>
                      </div>
                      <StatusBadge tone={completed ? "success" : "warning"} className="shrink-0">
                        {trip.status || "completed"}
                      </StatusBadge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-semibold text-[#6B7280]">
                      <span>{formatDate(trip.started_at || trip.ended_at)}</span>
                      {(trip.vehicle_number || vehicle.vehicle_number) ? (
                        <span>{trip.vehicle_number || vehicle.vehicle_number}</span>
                      ) : null}
                      {(trip.vehicle_type || vehicle.vehicle_type) ? (
                        <span className="capitalize">{trip.vehicle_type || vehicle.vehicle_type}</span>
                      ) : null}
                      {Number.isFinite(rating) && rating > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[#B7791F]"><Star size={13} fill="currentColor" />{rating.toFixed(1)}</span>
                      ) : null}
                    </div>
                  </VayyCard>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
