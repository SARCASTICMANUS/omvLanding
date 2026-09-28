import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ChevronLeft,
  Clock3,
  Crosshair,
  Flag,
  Footprints,
  Minus,
  Plus,
  RefreshCw,
  Route,
  Scan,
  Wallet,
} from "lucide-react";
import { MetricChip, SheetHandle } from "../../../components/vayy";
import api from "../../../lib/api";
import { API_PATHS } from "../../../constants/apiPaths";
import handRaiseImg from "../../../assets/VayyHandRaise.webp";

const ARRIVAL_THRESHOLD_METERS = 500;

function hasCoords(point) {
  return (
    point &&
    typeof point.lat === "number" &&
    Number.isFinite(point.lat) &&
    typeof point.lon === "number" &&
    Number.isFinite(point.lon)
  );
}

function money(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "\u20B9--";
  return `\u20B9${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`;
}

function stopName(stop, fallback) {
  return stop?.name || fallback?.name || fallback?.display_name || "--";
}

function formatDistance(meters) {
  const value = Number(meters);
  if (!Number.isFinite(value)) return "--";
  if (value < 1000) return `${Math.round(value)}m`;
  return `${(value / 1000).toFixed(1)} km`;
}

function walkingTimeText(meters) {
  const value = Number(meters);
  if (!Number.isFinite(value)) return "-- min walk";
  const minutes = Math.max(1, Math.ceil(value / 1.4 / 60));
  return `${minutes} min walk`;
}

function distanceBetweenMeters(first, second) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const latDelta = toRadians(second.lat - first.lat);
  const lonDelta = toRadians(second.lon - first.lon);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(first.lat)) *
      Math.cos(toRadians(second.lat)) *
      Math.sin(lonDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toLngLat(coord) {
  if (!Array.isArray(coord) || coord.length < 2) return null;
  const first = Number(coord[0]);
  const second = Number(coord[1]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  if (Math.abs(first) <= 90 && Math.abs(second) <= 180) return [second, first];
  return [first, second];
}

function getRouteCoordinates(trip, from, to) {
  const rawPath =
    trip?.route_geometry ||
    trip?.path_coords ||
    trip?.route_path ||
    trip?.path ||
    trip?.route?.path_coords ||
    trip?.route?.route_geometry;
  if (Array.isArray(rawPath) && rawPath.length > 1) {
    const normalized = rawPath.map(toLngLat).filter(Boolean);
    if (normalized.length > 1) return normalized;
  }
  if (rawPath?.type === "LineString" && Array.isArray(rawPath.coordinates)) {
    const normalized = rawPath.coordinates.map(toLngLat).filter(Boolean);
    if (normalized.length > 1) return normalized;
  }
  if (hasCoords(from) && hasCoords(to)) {
    return [
      [from.lon, from.lat],
      [to.lon, to.lat],
    ];
  }
  return [];
}

function createStopPin(tone, label) {
  const halo = tone === "pickup" ? "bg-[#009849]/15" : "bg-[#EF4444]/15";
  const dot = tone === "pickup" ? "bg-[#009849]" : "bg-[#EF4444]";

  const wrap = document.createElement("div");
  wrap.className = "flex flex-col items-center";

  const labelBox = document.createElement("div");
  labelBox.className =
    "max-w-[150px] truncate rounded-[12px] bg-white px-3 py-2 text-[13px] font-bold leading-none text-[#111827] shadow-[0_4px_12px_rgba(0,0,0,0.18)]";
  labelBox.textContent = label;

  const arrow = document.createElement("span");
  arrow.className = "-mt-[5px] h-2.5 w-2.5 rotate-45 bg-white";

  const outer = document.createElement("span");
  outer.className = `mt-[6px] flex h-[50px] w-[50px] items-center justify-center rounded-full ${halo}`;

  const inner = document.createElement("span");
  inner.className = `flex h-9 w-9 items-center justify-center rounded-full ${dot} text-white`;
  const pip = document.createElement("span");
  pip.className = "h-3 w-3 rounded-full bg-white";
  inner.appendChild(pip);
  outer.appendChild(inner);

  wrap.append(labelBox, arrow, outer);
  return wrap;
}

export default function PassengerPreRide({
  selectedTrip,
  pickup,
  destination,
  onEstimate,
  onBack,
  onConfirm,
}) {
  const mode = "bike";
  const [showConfirm, setShowConfirm] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState({ key: null, data: null, error: null });
  const [followMode, setFollowMode] = useState(true);
  const [sheetHeight, setSheetHeight] = useState(320);
  const onEstimateRef = useRef(onEstimate);

  useEffect(() => {
    if (!navigator.geolocation) return undefined;
    let alive = true;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (alive) setUserLocation({ lat: coords.latitude, lon: coords.longitude });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 },
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    onEstimateRef.current = onEstimate;
  }, [onEstimate]);

  const pickupStop = selectedTrip?.pickup_stop || null;
  const dropStop = selectedTrip?.dropoff_stop || null;
  const from = hasCoords(pickupStop) ? pickupStop : pickup;
  const to = hasCoords(dropStop) ? dropStop : destination;
  const requestKey = `${attempt}:${mode}`;
  const missingCoords = !hasCoords(from) || !hasCoords(to);
  const pending = !missingCoords && outcome.key !== requestKey;
  const estimate = {
    loading: pending,
    data: pending ? null : outcome.data,
    error: missingCoords ? "Location details unavailable" : outcome.error,
  };

  useEffect(() => {
    if (missingCoords) return undefined;
    let alive = true;
    api
      .post(API_PATHS.ride.estimate, {
        pickup_lat: from.lat,
        pickup_lng: from.lon,
        drop_lat: to.lat,
        drop_lng: to.lon,
        vehicle_type: mode,
      })
      .then((response) => {
        if (!alive) return;
        const data = response.data?.data ?? response.data ?? null;
        setOutcome({ key: requestKey, data, error: null });
        onEstimateRef.current?.(data);
      })
      .catch(() => {
        if (!alive) return;
        setOutcome({ key: requestKey, data: null, error: "Couldn't calculate the fare" });
      });
    return () => {
      alive = false;
    };
  }, [missingCoords, from, to, mode, requestKey]);

  const handleRetry = () => setAttempt((value) => value + 1);

  const canRequest = Boolean((selectedTrip?.id || selectedTrip?.route_id) && (pickupStop?.id || pickupStop?.stop_id));
  const rideMode = { label: "Bike" };
  const modeLabel = "bike";
  const walkMinutes = selectedTrip?.walk_minutes || null;

  const pickupName = stopName(pickupStop, pickup);
  const dropName = stopName(dropStop, destination);
  const pickupDistance = userLocation && hasCoords(pickupStop)
    ? distanceBetweenMeters(userLocation, pickupStop)
    : null;
  const isNearby = pickupDistance == null || pickupDistance <= ARRIVAL_THRESHOLD_METERS;
  const ready = canRequest && !missingCoords && isNearby;
  const waitMinutes = Math.max(1, Math.ceil((selectedTrip?.eta_seconds || 300) / 60));

  const distText = formatDistance(pickupDistance);
  const walkText = walkingTimeText(pickupDistance);

  const distanceValue =
    estimate.data?.distance_km != null
      ? `${estimate.data.distance_km} km`
      : selectedTrip?.distance_km != null
        ? `${selectedTrip.distance_km} km`
        : "--";
  const durationValue =
    estimate.data?.duration_minutes != null
      ? `${Math.ceil(estimate.data.duration_minutes)} min`
      : selectedTrip?.eta_seconds
        ? `${Math.max(1, Math.ceil(selectedTrip.eta_seconds / 60))} min`
        : "--";

  const routeCoords = getRouteCoordinates(selectedTrip, from, to);
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const sheetRef = useRef(null);
  const mapDataRef = useRef({ from, to, pickupName, dropName, routeCoords });
  const mapKey = `${from?.lat ?? ""}|${from?.lon ?? ""}|${to?.lat ?? ""}|${to?.lon ?? ""}|${pickupName}|${dropName}|${selectedTrip?.id ?? ""}`;

  useEffect(() => {
    mapDataRef.current = { from, to, pickupName, dropName, routeCoords };
  });

  useEffect(() => {
    const container = mapContainer.current;
    if (!container) return undefined;
    const data = mapDataRef.current;
    const center = hasCoords(data.from) ? [data.from.lon, data.from.lat] : [80.9462, 26.8467];
    const map = new maplibregl.Map({
      container,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center,
      zoom: 13,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    mapRef.current = map;
    const markers = [];

    const fitRoute = () => {
      const points = [...(mapDataRef.current.routeCoords || [])];
      const start = mapDataRef.current.from;
      const end = mapDataRef.current.to;
      if (hasCoords(start)) points.push([start.lon, start.lat]);
      if (hasCoords(end)) points.push([end.lon, end.lat]);
      if (points.length < 2) {
        map.easeTo({ center, zoom: 14, duration: 600 });
        return;
      }
      const bounds = points.reduce(
        (acc, coord) => acc.extend(coord),
        new maplibregl.LngLatBounds(points[0], points[0]),
      );
      map.fitBounds(bounds, {
        padding: { top: 170, bottom: 320, left: 60, right: 60 },
        duration: 800,
        maxZoom: 14,
      });
    };

    map.on("load", () => {
      if (!map.getSource("preride-route")) {
        map.addSource("preride-route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: data.routeCoords },
          },
        });
      }
      if (!map.getLayer("preride-route-line")) {
        map.addLayer({
          id: "preride-route-line",
          type: "line",
          source: "preride-route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#009849", "line-width": 5, "line-opacity": 0.95 },
        });
      }
      if (hasCoords(data.from)) {
        markers.push(
          new maplibregl.Marker({ element: createStopPin("pickup", data.pickupName), anchor: "bottom" })
            .setLngLat([data.from.lon, data.from.lat])
            .addTo(map),
        );
      }
      if (hasCoords(data.to)) {
        markers.push(
          new maplibregl.Marker({ element: createStopPin("drop", data.dropName), anchor: "bottom" })
            .setLngLat([data.to.lon, data.to.lat])
            .addTo(map),
        );
      }
      fitRoute();
    });

    return () => {
      markers.forEach((marker) => marker.remove());
      map.remove();
      mapRef.current = null;
    };
  }, [mapKey]);

  useEffect(() => {
    const element = sheetRef.current;
    if (!element || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect?.height;
      if (height && height > 0) setSheetHeight(height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const handleZoom = (zoomIn) => {
    setFollowMode(false);
    if (zoomIn) mapRef.current?.zoomIn();
    else mapRef.current?.zoomOut();
  };

  const handleRecenterRouteBounds = () => {
    setFollowMode(false);
    const map = mapRef.current;
    if (!map) return;
    const data = mapDataRef.current;
    const points = [...(data.routeCoords || [])];
    if (hasCoords(data.from)) points.push([data.from.lon, data.from.lat]);
    if (hasCoords(data.to)) points.push([data.to.lon, data.to.lat]);
    if (points.length < 2) return;
    const bounds = points.reduce(
      (acc, coord) => acc.extend(coord),
      new maplibregl.LngLatBounds(points[0], points[0]),
    );
    map.fitBounds(bounds, {
      padding: { top: 170, bottom: 320, left: 60, right: 60 },
      duration: 800,
      maxZoom: 14,
    });
  };

  const handleGetCurrentLocation = () => {
    setFollowMode(true);
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        mapRef.current?.easeTo({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: 16,
          duration: 900,
        });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 },
    );
  };

  return (
    <div className="fixed inset-0 z-[500] flex flex-col overflow-hidden bg-vayy-canvas font-sans">
      {/* Layer 1: Map */}
      <div ref={mapContainer} className="absolute inset-0 bg-[#E7ECEF]" />

      {/* Layer 2: Floating header */}
      <header className="absolute inset-x-0 top-0 z-30 overflow-hidden rounded-b-[32px] bg-[#009849] px-5 pb-3 pt-4 shadow-[0_4px_18px_rgba(0,152,73,0.25)]">
        <span className="pointer-events-none absolute -right-10 -top-16 h-[190%] w-[70%] rotate-[25deg] rounded-[120px] bg-[#00B857] opacity-25" />
        <span className="pointer-events-none absolute -right-6 -top-24 h-[170%] w-[50%] rotate-[35deg] rounded-[100px] bg-white/10" />
        <div className="relative mx-auto flex w-full max-w-[720px] items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#111827] shadow-[0_2px_8px_rgba(0,0,0,0.1)] transition active:scale-95"
          >
            <ChevronLeft size={24} strokeWidth={2.6} />
          </button>
          <h1 className="text-[22px] font-extrabold tracking-[-0.3px] text-white">Hand Raise</h1>
        </div>
      </header>

      {/* Layer 3: Top context cards */}
      <div className="pointer-events-none absolute inset-x-0 top-[86px] z-20 px-4">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-2.5">
          <div className="pointer-events-auto flex items-center gap-4 rounded-[24px] bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
            <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[16px] bg-[#ECFAF1] text-[#009849]">
              <Flag size={24} strokeWidth={2.4} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-[#888888]">Nearest stop</p>
              <p className="text-[19px] font-extrabold leading-tight text-[#111827] sm:text-[22px]">
                <span className="text-[#009849]">{distText}</span>
              {pickupDistance != null ? ` away \u00B7 ${walkText}` : ""}
              </p>
            </div>
            <div className="shrink-0 rounded-[14px] bg-[#ECFAF1] px-3.5 py-2 text-center">
              <p className="text-[16px] font-extrabold leading-none text-[#009849]">~{waitMinutes} min</p>
              <p className="mt-1 text-[10px] font-semibold text-[#6B7280]">wait</p>
            </div>
          </div>
        </div>
      </div>

      {/* Layer 4: Floating map controls */}
      <div
        className="absolute right-4 z-20 flex flex-col gap-0.5 rounded-[18px] bg-white p-1.5 shadow-[0_6px_20px_rgba(0,0,0,0.14)]"
        style={{ bottom: sheetHeight + 20 }}
      >
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => handleZoom(true)}
          className="flex h-11 w-12 items-center justify-center rounded-[12px] text-[#111827] transition hover:bg-slate-50 active:scale-95"
        >
          <Plus size={22} strokeWidth={2.4} />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => handleZoom(false)}
          className="flex h-11 w-12 items-center justify-center rounded-[12px] text-[#111827] transition hover:bg-slate-50 active:scale-95"
        >
          <Minus size={22} strokeWidth={2.4} />
        </button>
        <span className="mx-3 my-1 h-px bg-[#F0F0F0]" />
        <button
          type="button"
          aria-label="My location"
          onClick={handleGetCurrentLocation}
          className={`flex h-11 w-12 items-center justify-center rounded-[12px] transition active:scale-95 ${
            followMode ? "bg-[#009849] text-white" : "text-[#111827] hover:bg-slate-50"
          }`}
        >
          <Crosshair size={20} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          aria-label="Fit route"
          onClick={handleRecenterRouteBounds}
          className="flex h-11 w-12 items-center justify-center rounded-[12px] text-[#111827] transition hover:bg-slate-50 active:scale-95"
        >
          <Scan size={20} strokeWidth={2.3} />
        </button>
      </div>

      {/* Layer 5: Bottom data sheet */}
      <div
        ref={sheetRef}
        className="absolute inset-x-0 bottom-0 z-30 mx-auto max-h-[76vh] w-full max-w-[560px] overflow-y-auto rounded-t-[32px] bg-white px-5 pb-6 pt-3 shadow-[0_-8px_30px_rgba(0,0,0,0.10)] sm:px-6 lg:max-w-[720px]"
      >
        <SheetHandle />

        <div className="mb-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.3px] text-[#9CA3AF]">
            Selected Route
          </p>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#009849]" />
            <p className="min-w-0 flex-1 truncate text-[15px] font-bold text-[#111827]">
              {pickupName} &rarr; {dropName}
            </p>
          </div>
        </div>

        <div className="mb-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.3px] text-[#9CA3AF]">
            Nearest Pickup Stop
          </p>
          <p className="text-[15px] font-bold text-[#111827]">{pickupName}</p>
          {walkMinutes ? (
            <p className="mt-0.5 text-[12px] font-semibold text-[#6B7280]">
              ~{walkMinutes} min walk to pickup
            </p>
          ) : null}
        </div>

        <div
          className={`mb-4 flex items-start gap-2.5 rounded-[14px] p-3.5 ${
            ready ? "bg-[#ECFAF1]" : "bg-[#FEF2F2]"
          }`}
        >
          <span
            className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
              ready ? "bg-[#009849]" : "bg-[#EF4444]"
            }`}
          />
          <div className="min-w-0 flex-1">
            <p
              className={`text-[13px] font-semibold leading-[18px] ${
                ready ? "text-[#065F46]" : "text-[#991B1B]"
              }`}
            >
              {!canRequest || missingCoords
                ? "Pickup details are unavailable. Go back and choose another route."
                : pickupDistance == null
                  ? "Location unavailable. Raise your hand when you're at the pickup point."
                  : ready
                    ? "You're near the pickup point. Nearby Marshals can be notified."
                    : "Move closer to the pickup point to raise your hand."}
            </p>
            {pickupDistance != null ? (
              <p
                className={`mt-1 text-[13px] font-bold ${
                  ready ? "text-[#009849]" : "text-[#DC2626]"
                }`}
              >
                {distText} away &middot; {walkText}
              </p>
            ) : null}
          </div>
        </div>

        <div className="hidden mb-4 rounded-[14px] border border-[#F0F0F0] bg-[#F9FAF9] p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.3px] text-[#9CA3AF]">
              <Wallet size={14} /> Estimated fare
            </span>
            <span className="rounded-full bg-[#E0F5E8] px-3 py-1 text-[11px] font-black uppercase tracking-[0.3px] text-[#009849]">
              {rideMode.label}
            </span>
          </div>

          {estimate.loading ? (
            <div className="flex items-center gap-3 text-sm font-bold text-[#9CA3AF]">
              <RefreshCw size={16} className="animate-spin" />
              Calculating fare...
            </div>
          ) : estimate.error ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-bold text-[#6B7280]">{estimate.error}</span>
              {missingCoords ? null : (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="flex h-9 items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-4 text-xs font-extrabold text-[#374151] transition hover:bg-slate-50"
                >
                  <RefreshCw size={13} /> Retry
                </button>
              )}
            </div>
          ) : (
            <div>
              <p className="text-[36px] font-black leading-none text-[#009849]">
                {money(estimate.data?.estimated_fare)}
              </p>
              <p className="mt-1.5 text-xs font-semibold text-[#6B7280]">
                {estimate.data?.surge_multiplier && Number(estimate.data.surge_multiplier) > 1
                  ? `${estimate.data.surge_multiplier}x surge applied`
                  : "Upfront estimate, final fare on completion"}
              </p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <MetricChip icon={Route} label="Distance" value={distanceValue} />
            <MetricChip icon={Clock3} label="Duration" value={durationValue} />
            <MetricChip
              icon={Footprints}
              label="Walk to stop"
              value={walkMinutes ? `~${walkMinutes} min` : "--"}
              green
            />
          </div>
        </div>

        {!canRequest ? (
          <p className="mb-4 rounded-[14px] border border-[#FDE68A] bg-[#FEF3C7] p-4 text-sm font-bold text-[#92400E]">
            We couldn't identify the pickup stop for this route. Go back and pick your stops again.
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          disabled={!ready}
          className="flex h-14 w-full items-center justify-center rounded-[18px] bg-[#009849] text-[17px] font-extrabold text-white shadow-[0_4px_14px_rgba(0,152,73,0.3)] transition hover:bg-[#007A3B] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#009849]/30 disabled:shadow-none"
        >
          <span aria-hidden="true">&#9995;</span>&nbsp; Raise Hand
        </button>
      </div>

      {showConfirm ? (
        <div
          className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/50 px-6"
          role="dialog"
          aria-modal="true"
          aria-label="Raise Hand confirmation"
          onKeyDown={(event) => {
            if (event.key === "Escape") setShowConfirm(false);
          }}
        >
          <div className="w-full max-w-[340px] rounded-[24px] bg-white px-6 pb-7 pt-6 text-center shadow-2xl">
            <span className="mx-auto mb-4 flex h-[102px] w-[102px] items-center justify-center rounded-[36px]">
              <img src={handRaiseImg} alt="" className="h-[104px] w-[104px] object-contain" />
            </span>
            <h2 className="text-[22px] font-black text-[#111827]">Raise Hand?</h2>
            <p className="mt-2 text-sm font-medium leading-5 text-[#6B7280]">
              Nearby
              <br />
              {modeLabel} drivers will be notified that you are waiting at {stopName(pickupStop, pickup)}.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                autoFocus
                onClick={() => setShowConfirm(false)}
                className="h-[52px] flex-1 rounded-[16px] border-[1.5px] border-[#E5E7EB] text-[15px] font-bold text-[#374151] transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  onConfirm?.();
                }}
                className="h-[52px] flex-1 rounded-[16px] bg-[#009849] text-[15px] font-extrabold text-white transition hover:bg-[#007A3B] active:scale-[0.99]"
              >
                Raise Hand
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
