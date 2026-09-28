import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { ArrowUpDown, Clock, Flag, LocateFixed, Map, MapPin } from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { LocationSearch } from "../../components/map";
import api from "../../lib/api";
import { API_PATHS } from "../../constants/apiPaths";
import { hasValidCoords } from "./driverFlowUtils";
import bikeMarker from "../../assets/vayyTopBike1.webp";
import autoMarker from "../../assets/vayyTopAuto.webp";
import namasteIcon from "../../assets/vayyNamaste.webp";

const COMPACT_SHEET_HEIGHT = 240;

function PlannerField({ label, placeholder, onSelect, initialValue, tone = "pickup" }) {
  const isPickup = tone === "pickup";

  return (
    <div className="relative z-20">
      <label className="mb-2 flex items-center gap-2 text-[12px] font-bold tracking-[0.3px] text-[#374151]">
        <span
          className={`h-2 w-2 rounded-full ${isPickup ? "bg-[#009849]" : "bg-[#f59e0b]"}`}
          aria-hidden="true"
        />
        {label}
      </label>

      <div className="relative">
        <div className="[&>div>div>svg]:hidden">
          <LocationSearch
            placeholder={placeholder}
            onSelect={onSelect}
            initialValue={initialValue}
            className="h-[52px] w-full rounded-[14px] border border-white/70 bg-white/85 pl-10 pr-4 text-[15px] font-medium text-[#111827] outline-none backdrop-blur-md transition focus:border-[#009849] focus:ring-4 focus:ring-[#009849]/12"
          />
        </div>
        {isPickup ? (
          <MapPin
            size={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#009849]"
          />
        ) : (
          <Flag
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#f59e0b]"
          />
        )}
      </div>
    </div>
  );
}

function RecentSearchItem({ search, onClick }) {
  const pickup = search.pickup || search.source;
  const destination = search.destination;

  const pickupLabel =
    pickup?.name || pickup?.display_name?.split(",")[0] || "Unknown Start";
  const destLabel =
    destination?.name || destination?.display_name?.split(",")[0] || "Unknown End";

  return (
    <button
      type="button"
      onClick={() => onClick(search)}
      className="flex w-full items-center gap-2.5 rounded-[12px] px-1 py-2 text-left transition hover:bg-[#F8FBFA]"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F3F4F6] text-[#9CA3AF]">
        <Clock size={14} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-bold text-[#111827]">
          {pickupLabel}
        </span>
        <span className="mt-0.5 block truncate text-[11px] font-medium text-[#6B7280]">
          To: {destLabel}
        </span>
      </span>
    </button>
  );
}

export default function DriverTripPlanner({
  onNext,
  loading = false,
  initialSource = null,
  initialDestination = null,
}) {
  const [source, setSource] = useState(initialSource);
  const [destination, setDestination] = useState(initialDestination);
  const [recentSearches, setRecentSearches] = useState([]);
  const [sheetHeight, setSheetHeight] = useState(COMPACT_SHEET_HEIGHT);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [sheetDragging, setSheetDragging] = useState(false);
  const rootRef = useRef(null);
  // Measured height of the root container. Kept in state (not read off the ref
  // during render) so the locate button offset stays reactive to resize.
  const [rootHeight, setRootHeight] = useState(0);
  const sheetHeightRef = useRef(COMPACT_SHEET_HEIGHT);
  const sheetDragRef = useRef({
    active: false,
    moved: false,
    startY: 0,
    startHeight: COMPACT_SHEET_HEIGHT,
  });
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  const { user } = useSelector((state) => state.auth || {});
  const driverMapMarker = user?.role === "autodriver" ? autoMarker : bikeMarker;
  const locateDriver = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = [coords.longitude, coords.latitude];
        mapRef.current?.easeTo({ center: point, zoom: 15, duration: 700 });
        if (!markerRef.current && mapRef.current) {
          const element = document.createElement("div");
          element.className = "flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-lg";
          const image = document.createElement("img");
          image.src = driverMapMarker;
          image.alt = "";
          image.className = "h-10 w-10 object-contain";
          element.appendChild(image);
          markerRef.current = new maplibregl.Marker({ element, anchor: "center" })
            .setLngLat(point)
            .addTo(mapRef.current);
        } else {
          markerRef.current?.setLngLat(point);
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 },
    );
  }, [driverMapMarker]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return undefined;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: [80.9462, 26.8467],
      zoom: 12,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    mapRef.current = map;
    map.on("load", () => map.resize());
    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => map.resize())
      : null;
    if (resizeObserver && mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }
    locateDriver();
    return () => {
      resizeObserver?.disconnect();
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [locateDriver]);

  useEffect(() => {
    // Fetch recent searches - using passenger endpoint as a known working path
    api.get(API_PATHS.auth.recentSearches)
      .then(res => {
        const payload = res.data?.data ?? res.data;
        setRecentSearches(Array.isArray(payload) ? payload : []);
      })
      .catch(err => console.error("Failed to fetch recent searches", err));
  }, []);

  // Track the root container height so getMaxSheetHeight() stays accurate
  // without reading a ref during render.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return undefined;
    const measure = () => setRootHeight(el.clientHeight || 0);
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const getMaxSheetHeight = () => {
    const viewportHeight = rootHeight || window.innerHeight;
    return Math.max(
      COMPACT_SHEET_HEIGHT,
      Math.min(viewportHeight - 16, Math.round(viewportHeight * 0.9)),
    );
  };

  const setSheetHeightAndRef = (height) => {
    sheetHeightRef.current = height;
    setSheetHeight(height);
  };

  const handleSheetPointerDown = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    sheetDragRef.current = {
      active: true,
      moved: false,
      startY: event.clientY,
      startHeight: sheetHeightRef.current,
    };
    setSheetDragging(true);
  };

  const handleSheetPointerMove = (event) => {
    const drag = sheetDragRef.current;
    if (!drag.active) return;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaY) > 4) drag.moved = true;
    if (!drag.moved) return;
    const nextHeight = Math.max(
      COMPACT_SHEET_HEIGHT,
      Math.min(getMaxSheetHeight(), drag.startHeight - deltaY),
    );
    setSheetHeightAndRef(nextHeight);
  };

  const finishSheetDrag = (event) => {
    const drag = sheetDragRef.current;
    if (!drag.active) return;
    drag.active = false;
    setSheetDragging(false);
    const target = sheetHeightRef.current >= (COMPACT_SHEET_HEIGHT + getMaxSheetHeight()) / 2
      ? getMaxSheetHeight()
      : COMPACT_SHEET_HEIGHT;
    setSheetExpanded(target > COMPACT_SHEET_HEIGHT);
    setSheetHeightAndRef(target);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleSheetClick = () => {
    if (sheetDragRef.current.moved) {
      sheetDragRef.current.moved = false;
      return;
    }
    const expand = !sheetExpanded;
    const target = expand ? getMaxSheetHeight() : COMPACT_SHEET_HEIGHT;
    setSheetExpanded(expand);
    setSheetHeightAndRef(target);
  };

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
    const getLatitude = (point) => Number(point?.lat ?? point?.latitude ?? point?.y);
    const getLongitude = (point) => Number(point?.lon ?? point?.lng ?? point?.longitude ?? point?.x);
    api.post(API_PATHS.auth.recentSearches, {
      pickup_name: source?.name || source?.display_name || "",
      pickup_lat: getLatitude(source),
      pickup_lon: getLongitude(source),
      destination_name: destination?.name || destination?.display_name || "",
      destination_lat: getLatitude(destination),
      destination_lon: getLongitude(destination),
    }).then(() => {
      api.get(API_PATHS.auth.recentSearches).then((response) => {
        const data = response.data?.data ?? response.data;
        if (Array.isArray(data)) setRecentSearches(data);
      }).catch(() => {});
    }).catch(() => {});
    onNext?.({ from: source, to: destination });
  };

  const handleRecentClick = (search) => {
    setSource(search.pickup || search.source);
    setDestination(search.destination);
  };

  const driverName =
    user?.full_name || user?.name || user?.first_name || "Driver";
  return (
    <div ref={rootRef} className="relative min-h-[calc(100dvh-64px)] w-full overflow-hidden bg-[#E9ECEF] font-sans text-[#111827] lg:min-h-[calc(100dvh-72px)]">
      <div ref={mapContainerRef} className="absolute inset-0 z-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[260px] bg-gradient-to-b from-[#0A163C]/95 to-transparent px-5 pt-12 text-white sm:px-8">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-center gap-2">
            <img src={namasteIcon} alt="" className="h-[38px] w-[30px] object-contain" />
            <p className="text-[38px] font-black leading-tight">
              <span className="font-geom-700 text-[#FFD700]">namaste,</span>
            </p>
          </div>
          <p className="font-geom-700 mt-1 text-[28px] leading-tight text-white">{driverName}</p>
          <p className="mt-2 text-[14px] font-semibold text-white/85">Aaj aap kahan jaana chahte hain?</p>
        </div>
      </div>
      <button
        type="button"
        onClick={locateDriver}
        aria-label="Center map on my location"
        className="absolute right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#111827] shadow-v-md transition active:scale-95"
        style={{ bottom: `${Math.min(sheetHeight + 24, getMaxSheetHeight())}px` }}
      >
        <LocateFixed size={20} />
      </button>
      {/* Drag-up route search sheet */}
        <main className="absolute inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[680px] px-0 sm:px-4">
        <section
          className={`flex flex-col overflow-hidden rounded-t-[30px] border border-white/70 bg-white/95 shadow-[0_-8px_30px_rgba(0,0,0,0.14)] backdrop-blur-xl sm:rounded-[30px] ${sheetDragging ? "" : "transition-[height] duration-300 ease-out"}`}
          style={{ height: `${sheetHeight}px` }}
        >
          <button
            type="button"
            aria-expanded={sheetExpanded}
            aria-label={sheetExpanded ? "Collapse route search sheet" : "Expand for recent searches"}
            onPointerDown={handleSheetPointerDown}
            onPointerMove={handleSheetPointerMove}
            onPointerUp={finishSheetDrag}
            onPointerCancel={finishSheetDrag}
            onClick={handleSheetClick}
            className="flex h-[56px] w-full shrink-0 touch-none cursor-grab flex-col items-center justify-center active:cursor-grabbing"
          >
            <span className="h-1 w-10 rounded-full bg-[#E5E7EB]" />
            <span className="mt-2 text-[12px] font-medium text-[#9CA3AF]">
              {sheetExpanded ? "Drag down to close" : "Drag up for recent searches"}
            </span>
          </button>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">
            <PlannerField
              label="Start Point"
              placeholder="Search starting location"
              onSelect={setSource}
              initialValue={source?.display_name || source?.name || ""}
              tone="pickup"
            />

            <div className="my-4 flex items-center justify-center gap-3 px-1">
              <span className="h-px flex-1 border-t border-dashed border-[#E5E7EB]" />
              <button
                type="button"
                onClick={handleSwap}
                aria-label="Swap start and destination"
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#009849] text-white shadow-v-md transition active:scale-95"
              >
                <ArrowUpDown size={16} strokeWidth={2.4} />
              </button>
              <span className="h-px flex-1 border-t border-dashed border-[#E5E7EB]" />
            </div>

            <PlannerField
              label="Destination"
              placeholder="Enter your destination"
              onSelect={setDestination}
              initialValue={destination?.display_name || destination?.name || ""}
              tone="drop"
            />

            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed || loading}
              className="mt-5 flex h-14 w-full items-center justify-center gap-2.5 rounded-[18px] bg-[#009849] text-[15px] font-extrabold text-white shadow-[0_4px_16px_rgba(0,152,73,0.35)] transition hover:bg-[#007A3B] active:scale-[0.99] disabled:pointer-events-none disabled:opacity-45"
            >
              <Map size={18} strokeWidth={2.4} />
              {loading ? "Searching..." : "Find Best Route"}
            </button>

            {sheetExpanded && recentSearches.length > 0 && (
              <div className="mt-5 border-t border-[#F3F4F6] pt-4">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.6px] text-[#9CA3AF]">
                  <Clock size={13} /> Recent searches
                </div>
                <div className="flex flex-col divide-y divide-[#F3F4F6]">
                  {recentSearches.map((search, index) => (
                    <RecentSearchItem
                      key={search.id || index}
                      search={search}
                      onClick={handleRecentClick}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
