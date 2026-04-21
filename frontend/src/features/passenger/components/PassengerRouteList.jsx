import React, { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ChevronLeft,
  ArrowRight,
  BusFront,
  RefreshCw,
  MapPin,
} from "lucide-react";

function formatEtaMinutes(etaSeconds) {
  return Math.max(1, Math.ceil(Number(etaSeconds || 2700) / 60));
}

function formatDistanceText(trip) {
  if (trip?.distance_text) return trip.distance_text;
  if (trip?.distance_km) return `${trip.distance_km} km`;
  return "45 km";
}

function formatDurationText(trip) {
  if (trip?.duration_text) return trip.duration_text;
  if (trip?.eta_seconds) return `${formatEtaMinutes(trip.eta_seconds)} min`;
  return "45 min";
}

function hasValidCoords(point) {
  return (
    point &&
    typeof point.lat === "number" &&
    Number.isFinite(point.lat) &&
    typeof point.lon === "number" &&
    Number.isFinite(point.lon)
  );
}

function createCircleMarker(color, size = 18) {
  const el = document.createElement("div");
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = "9999px";
  el.style.backgroundColor = color;
  el.style.border = "3px solid white";
  el.style.boxShadow = "0 6px 18px rgba(0,0,0,0.24)";
  el.style.cursor = "grab";
  return el;
}

function RouteMapPreview({
  pickup,
  destination,
  onUpdatePickup,
  onUpdateDestination,
}) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({ pickup: null, destination: null });
  const isMapReadyRef = useRef(false);
  const latestDataRef = useRef({ pickup, destination });

  const routeSourceId = "route-preview-source";
  const routeLayerId = "route-preview-layer";

  useEffect(() => {
    latestDataRef.current = { pickup, destination };
  }, [pickup, destination]);

  const updateRouteLine = () => {
    const map = mapRef.current;
    if (!map || !isMapReadyRef.current) return;

    const source = map.getSource(routeSourceId);
    if (!source) return;

    const currentPickup = latestDataRef.current.pickup;
    const currentDestination = latestDataRef.current.destination;

    if (hasValidCoords(currentPickup) && hasValidCoords(currentDestination)) {
      source.setData({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [currentPickup.lon, currentPickup.lat],
            [currentDestination.lon, currentDestination.lat],
          ],
        },
        properties: {},
      });
      return;
    }

    source.setData({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [],
      },
      properties: {},
    });
  };

  const fitMapToPoints = () => {
    const map = mapRef.current;
    if (!map || !isMapReadyRef.current) return;

    const currentPickup = latestDataRef.current.pickup;
    const currentDestination = latestDataRef.current.destination;

    const points = [];
    if (hasValidCoords(currentPickup)) {
      points.push([currentPickup.lon, currentPickup.lat]);
    }
    if (hasValidCoords(currentDestination)) {
      points.push([currentDestination.lon, currentDestination.lat]);
    }

    if (points.length === 0) {
      map.easeTo({
        center: [78.9629, 20.5937],
        zoom: 4.6,
        duration: 700,
      });
      return;
    }

    if (points.length === 1) {
      map.easeTo({
        center: points[0],
        zoom: 16,
        duration: 700,
      });
      return;
    }

    const bounds = points.reduce(
      (acc, coord) => acc.extend(coord),
      new maplibregl.LngLatBounds(points[0], points[0]),
    );

    map.fitBounds(bounds, {
      padding: { top: 60, bottom: 60, left: 50, right: 50 },
      duration: 800,
      maxZoom: 16,
    });
  };

  const syncMarkers = () => {
    const map = mapRef.current;
    if (!map || !isMapReadyRef.current) return;

    const currentPickup = latestDataRef.current.pickup;
    const currentDestination = latestDataRef.current.destination;

    if (hasValidCoords(currentPickup)) {
      if (!markersRef.current.pickup) {
        const marker = new maplibregl.Marker({
          element: createCircleMarker("#67d31f", 18),
          draggable: true,
        })
          .setLngLat([currentPickup.lon, currentPickup.lat])
          .addTo(map);

        marker.on("dragstart", () => {
          const el = marker.getElement();
          if (el) el.style.cursor = "grabbing";
        });

        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          const latestPickup = latestDataRef.current.pickup || {};

          const updatedPickup = {
            ...latestPickup,
            lon: lngLat.lng,
            lat: lngLat.lat,
            name: latestPickup.name || "Pickup",
            display_name:
              latestPickup.display_name || latestPickup.name || "Pickup",
          };

          latestDataRef.current = {
            ...latestDataRef.current,
            pickup: updatedPickup,
          };

          const el = marker.getElement();
          if (el) el.style.cursor = "grab";

          onUpdatePickup?.(updatedPickup);
          updateRouteLine();
          fitMapToPoints();
        });

        markersRef.current.pickup = marker;
      } else {
        markersRef.current.pickup.setLngLat([currentPickup.lon, currentPickup.lat]);
      }
    } else if (markersRef.current.pickup) {
      markersRef.current.pickup.remove();
      markersRef.current.pickup = null;
    }

    if (hasValidCoords(currentDestination)) {
      if (!markersRef.current.destination) {
        const marker = new maplibregl.Marker({
          element: createCircleMarker("#ff2a2a", 18),
          draggable: true,
        })
          .setLngLat([currentDestination.lon, currentDestination.lat])
          .addTo(map);

        marker.on("dragstart", () => {
          const el = marker.getElement();
          if (el) el.style.cursor = "grabbing";
        });

        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          const latestDestination = latestDataRef.current.destination || {};

          const updatedDestination = {
            ...latestDestination,
            lon: lngLat.lng,
            lat: lngLat.lat,
            name: latestDestination.name || "Drop",
            display_name:
              latestDestination.display_name ||
              latestDestination.name ||
              "Drop",
          };

          latestDataRef.current = {
            ...latestDataRef.current,
            destination: updatedDestination,
          };

          const el = marker.getElement();
          if (el) el.style.cursor = "grab";

          onUpdateDestination?.(updatedDestination);
          updateRouteLine();
          fitMapToPoints();
        });

        markersRef.current.destination = marker;
      } else {
        markersRef.current.destination.setLngLat([
          currentDestination.lon,
          currentDestination.lat,
        ]);
      }
    } else if (markersRef.current.destination) {
      markersRef.current.destination.remove();
      markersRef.current.destination = null;
    }
  };

  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: [78.9629, 20.5937],
      zoom: 4.6,
      attributionControl: false,
    });

    mapRef.current = map;

    const handleLoad = () => {
      isMapReadyRef.current = true;

      if (!map.getSource(routeSourceId)) {
        map.addSource(routeSourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [],
            },
            properties: {},
          },
        });
      }

      if (!map.getLayer(routeLayerId)) {
        map.addLayer({
          id: routeLayerId,
          type: "line",
          source: routeSourceId,
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#7CFF3A",
            "line-width": 5,
            "line-opacity": 0.92,
            "line-dasharray": [2, 2],
          },
        });
      }

      syncMarkers();
      updateRouteLine();
      fitMapToPoints();
    };

    map.on("load", handleLoad);

    return () => {
      isMapReadyRef.current = false;

      if (markersRef.current.pickup) {
        markersRef.current.pickup.remove();
        markersRef.current.pickup = null;
      }

      if (markersRef.current.destination) {
        markersRef.current.destination.remove();
        markersRef.current.destination = null;
      }

      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !isMapReadyRef.current) return;
    syncMarkers();
    updateRouteLine();
    fitMapToPoints();
  }, [pickup, destination]);

  return (
    <div className="relative h-[220px] w-full overflow-hidden rounded-[20px] border border-white/10 bg-[#0a0a0a] sm:h-[260px] lg:h-[280px]">
      <div ref={mapContainer} className="h-full w-full" />

      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-black/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
        Drag pickup / drop
      </div>
    </div>
  );
}

function RouteCard({ trip, onTrackNow, pickup, destination }) {
  const busNo =
    trip?.bus_number ||
    trip?.vehicle_number ||
    trip?.vehicle_no ||
    "UP 32 DC 0003";

  const eta = formatEtaMinutes(trip?.eta_seconds);

  const fromLabel =
    pickup?.name ||
    pickup?.display_name?.split(",")?.[0] ||
    trip?.pickup_name ||
    "Noida";

  const toLabel =
    destination?.name ||
    destination?.display_name?.split(",")?.[0] ||
    trip?.destination_name ||
    "Delhi";

  const busIndex =
    trip?.bus_index ??
    trip?.bus_order ??
    trip?.bus_serial ??
    trip?.bus_sequence ??
    0;

  return (
    <div className="overflow-hidden rounded-[18px] bg-white shadow-[0_10px_28px_rgba(0,0,0,0.18)]">
      <div className="px-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <div className="mt-[2px] flex h-8 w-8 items-center justify-center rounded-[8px] bg-white text-black shadow-sm ring-1 ring-black/5">
              <BusFront size={16} strokeWidth={2.2} />
            </div>

            <div>
              <p className="text-[8px] font-medium leading-none text-black/60">
                Vehicle No
              </p>
              <p className="mt-[3px] text-[10px] font-bold leading-none text-black">
                {busNo}
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[8px] font-medium leading-none text-black/50">
              ETA: {eta} min
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="h-[7px] w-[7px] rounded-full bg-[#67d31f]" />
            </div>
            <p className="truncate text-[16px] font-extrabold leading-none text-black">
              {fromLabel}
            </p>
          </div>

          <div className="mx-3 flex flex-1 items-center justify-center">
            <ArrowRight size={14} strokeWidth={2.8} className="text-black" />
          </div>

          <div className="min-w-0 text-right">
            <div className="mb-1 flex items-center justify-end gap-1.5">
              <span className="h-[7px] w-[7px] rounded-full bg-[#ff2a2a]" />
            </div>
            <p className="truncate text-[16px] font-extrabold leading-none text-black">
              {toLabel}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-[9px] font-medium text-black/70">
          <span>
            {formatDistanceText(trip)} • {formatDurationText(trip)}
          </span>
          <span className="font-bold text-black">Bus {busIndex}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onTrackNow(trip)}
        className="mt-4 flex h-[46px] w-full items-center justify-center bg-[#ffe600] text-[14px] font-extrabold text-black transition hover:brightness-105 active:scale-[0.99]"
      >
        Track Now
      </button>
    </div>
  );
}

function DesktopPromoPanel() {
  return (
    <div className="relative hidden min-h-[100dvh] flex-1 overflow-hidden lg:block">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=1600&auto=format&fit=crop')",
        }}
      />
      <div className="absolute inset-0 bg-black/35" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/20" />

      <div className="relative z-10 flex h-full items-center px-16 xl:px-24">
        <div className="max-w-[420px] text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">
            Smarter urban travel
          </p>
          <h2 className="mt-4 text-5xl font-black leading-[1.05]">
            Everyday city commute.
          </h2>
          <p className="mt-5 text-xl leading-relaxed text-white/85">
            Adjust pickup and drop points, compare routes instantly, and move
            into live tracking with a cleaner booking flow.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PassengerRouteList({
  onBack,
  onChooseRoute,
  trips = [],
  loading = false,
  pickup,
  destination,
  onUpdatePickup,
  onUpdateDestination,
  onReSearchRoutes,
}) {
  const [showAllBuses, setShowAllBuses] = useState(false);

  const visibleTrips = useMemo(() => {
    if (!Array.isArray(trips)) return [];
    return showAllBuses ? trips : trips.slice(0, 1);
  }, [trips, showAllBuses]);

  const handleTrackNow = (trip) => onChooseRoute?.(trip);

  const pickupText =
    pickup?.display_name || pickup?.name || "Choose pickup point";
  const destinationText =
    destination?.display_name || destination?.name || "Choose drop point";

  return (
    <div className="min-h-[100dvh] bg-[#f2f2f2] text-white lg:bg-white">
      <div className="flex min-h-[100dvh] w-full">
        <div className="w-full bg-[#050505] lg:max-w-[520px] lg:min-w-[520px] lg:bg-[#f2f2f2]">
          <div className="mx-auto w-full max-w-[390px] lg:max-w-none">
            <div className="px-3 pt-4 lg:px-0 lg:pt-0">
              <div className="lg:min-h-[100dvh] lg:border-r lg:border-black/8 lg:bg-[#f2f2f2]">
                <div
                  className="relative overflow-hidden rounded-t-[6px] rounded-b-[28px] px-3 pb-5 pt-4 lg:min-h-[100dvh] lg:rounded-none lg:bg-[#f2f2f2] lg:px-10 lg:pb-10 lg:pt-10"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 0%, rgba(95,255,69,0.18), transparent 26%), linear-gradient(180deg, #07110b 0%, #040404 100%)",
                  }}
                >
                  <button
                    type="button"
                    onClick={onBack}
                    className="mb-3 inline-flex items-center text-white lg:text-black"
                  >
                    <ChevronLeft size={22} strokeWidth={2.7} />
                  </button>

                  <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-white lg:text-[36px] lg:text-black">
                    Choose Your Route
                  </h1>

                  <div className="mt-5 hidden rounded-[18px] border border-black/10 bg-white p-4 text-black lg:block">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <MapPin size={16} className="mt-0.5 text-[#67d31f]" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/45">
                            Pickup
                          </p>
                          <p className="truncate text-sm font-semibold">
                            {pickupText}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <MapPin size={16} className="mt-0.5 text-[#ff2a2a]" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-black/45">
                            Drop
                          </p>
                          <p className="truncate text-sm font-semibold">
                            {destinationText}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="relative z-10 mt-4 lg:mt-6">
                    <RouteMapPreview
                      pickup={pickup}
                      destination={destination}
                      onUpdatePickup={onUpdatePickup}
                      onUpdateDestination={onUpdateDestination}
                    />
                  </div>

                  <div className="relative z-10 mt-4 lg:mt-6">
                    {loading ? (
                      <div className="rounded-[18px] bg-white p-5 text-center text-black">
                        Loading routes...
                      </div>
                    ) : visibleTrips.length > 0 ? (
                      <div className="space-y-4">
                        {visibleTrips.map((trip, index) => (
                          <RouteCard
                            key={trip.trip_id || trip.id || index}
                            trip={trip}
                            onTrackNow={handleTrackNow}
                            pickup={pickup}
                            destination={destination}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-[18px] bg-white p-5 text-center text-black">
                        No route found
                      </div>
                    )}
                  </div>

                  <div className="mt-4 space-y-3 lg:mt-6">
                    <button
                      type="button"
                      onClick={() => setShowAllBuses((prev) => !prev)}
                      className="flex h-[50px] w-full items-center justify-center rounded-[12px] bg-[#00f08a] text-[13px] font-extrabold text-black shadow-[0_10px_24px_rgba(0,240,138,0.24)] transition hover:brightness-105 active:scale-[0.99]"
                    >
                      {showAllBuses
                        ? "Show featured bus"
                        : "Click to see all Buses"}
                    </button>

                    <button
                      type="button"
                      onClick={onReSearchRoutes}
                      disabled={!pickup || !destination || loading}
                      className="flex h-[46px] w-full items-center justify-center gap-2 rounded-[12px] bg-white/10 text-[13px] font-extrabold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50 lg:bg-black lg:text-white lg:hover:bg-black/90"
                    >
                      <RefreshCw size={16} />
                      Refresh Routes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DesktopPromoPanel />

        <style>{`
          .maplibregl-ctrl-bottom-left,
          .maplibregl-ctrl-bottom-right,
          .maplibregl-ctrl-top-right {
            display: none !important;
          }
        `}</style>
      </div>
    </div>
  );
}