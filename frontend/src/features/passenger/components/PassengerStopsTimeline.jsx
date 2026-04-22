import React from "react";
import { ChevronLeft, MapPin } from "lucide-react";

export default function PassengerStopsTimeline({
  selectedTrip,
  pickup,
  destination,
  onBack,
  onTrackNow,
  onEditRoute,
}) {
  const stops = selectedTrip?.stops || [];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-[390px] px-4 py-4">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center text-white"
        >
          <ChevronLeft size={20} strokeWidth={2.6} />
        </button>

        <h1 className="text-2xl font-extrabold">Track Buses</h1>

        <div className="mt-4 rounded-2xl bg-white p-4 text-black">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-black/50">Route</p>
              <p className="font-bold">
                {selectedTrip?.route_name || "Selected Route"}
              </p>
            </div>

            <button
              type="button"
              onClick={onEditRoute}
              className="rounded-lg bg-black px-3 py-2 text-xs font-bold text-white"
            >
              Edit
            </button>
          </div>

          <div className="mt-4 space-y-2">
            <p>
              <strong>Pickup:</strong>{" "}
              {pickup?.display_name || pickup?.name || "Not selected"}
            </p>
            <p>
              <strong>Destination:</strong>{" "}
              {destination?.display_name || destination?.name || "Not selected"}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl bg-white p-4 text-black">
          <p className="mb-4 text-sm font-extrabold">Bus Stops</p>

          {stops.length > 0 ? (
            <div className="space-y-4">
              {stops.map((stop, index) => (
                <div key={stop.id || index} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span
                      className={`h-3 w-3 rounded-full ${
                        index === 0
                          ? "bg-green-500"
                          : index === stops.length - 1
                          ? "bg-red-500"
                          : "bg-neutral-400"
                      }`}
                    />
                    {index !== stops.length - 1 && (
                      <span className="mt-1 h-10 w-[2px] bg-neutral-300" />
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-bold">
                      {stop.name || `Stop ${index + 1}`}
                    </p>
                    <p className="text-xs text-black/50">
                      {stop.arrival_time || stop.departure_time || "ETA pending"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-black/60">
              <MapPin size={14} />
              <span>No stops found for this trip.</span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onTrackNow}
          className="mt-5 flex h-[48px] w-full items-center justify-center rounded-[10px] bg-[#ffe600] text-[13px] font-extrabold text-black"
        >
          Track Now
        </button>
      </div>
    </div>
  );
}