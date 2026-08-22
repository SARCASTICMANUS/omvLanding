/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ChevronDown, 
  Compass, 
  Navigation, 
  Play, 
  Bus, 
  MapPin, 
  Users, 
  Clock, 
  CheckCircle2, 
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  LogOut,
  StopCircle,
  Plus,
  Minus,
  Box,
  Globe,
  HelpCircle,
  Menu,
  X
} from 'lucide-react';
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion } from 'framer-motion';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// --- Assets/Icons ---
import api from "../../lib/api";
import { API_PATHS } from "../../constants/apiPaths";
import DriverManifest from "./DriverManifest";
import DriverRouteList from "./DriverRouteList";
import DriverStopsTimeline from "./DriverStopsTimeline";
import DriverTripPlanner from "./DriverTripPlanner";
import notificationService from "../../services/notificationService";
import {
  getDistance,
  getPreviewOptions,
  getPreviewPath,
  getRoutePath,
  getStopLngLat,
} from "../../components/map/utils/routeGeometry";

// --- Components ---

const SidebarCard = ({ title, children, className = "" }) => (
  <div className={`p-4 ${className}`}>
    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">{title}</h3>
    {children}
  </div>
);

const StatItem = ({ icon: Icon, label, value, colorClass }) => (
  <div className="bg-white border border-slate-100 rounded-xl p-3 flex flex-col gap-1 shadow-sm hover:border-slate-200 transition-colors">
    <div className={`w-8 h-8 rounded-lg ${colorClass} flex items-center justify-center mb-1`}>
      {React.createElement(Icon, { size: 16 })}
    </div>
    <span className="text-[10px] font-medium text-slate-500">{label}</span>
    <span className="text-xs font-bold text-slate-800">{value}</span>
  </div>
);

const getOrderedStops = (stops = []) =>
  [...stops].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

const getNextStopsFromPosition = (stops = [], position, limit = 3) => {
  const orderedStops = getOrderedStops(stops);
  if (!position || orderedStops.length === 0) return orderedStops.slice(0, limit);

  let nearestIndex = 0;
  let nearestDistance = Infinity;
  orderedStops.forEach((stop, index) => {
    const coord = getStopLngLat(stop);
    if (!coord) return;
    const distance = getDistance(position, coord);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return orderedStops.slice(nearestIndex, nearestIndex + limit);
};

const driverPreviewScreens = {
  DriverTripPlanner,
  DriverRouteList,
  DriverStopsTimeline,
};

export default function MapDriver({
  initialRouteData = null,
  initialTripData = null,
  startLiveOnMount = false,
  showTemporaryPreview = true,
  onBack,
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  
  // --- User Logic States ---
  const [availableRoutes, setAvailableRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [routePath, setRoutePath] = useState(null);
  const [tripData, setTripData] = useState(null);
  const [currentPos, setCurrentPos] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDriving, setIsDriving] = useState(false);
  const [passengers, setPassengers] = useState({});
  const [nextStops, setNextStops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showManifest, setShowManifest] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [is3DView, setIs3DView] = useState(false);
  const [isSatellite, setIsSatellite] = useState(false);
  const [mapPitch, setMapPitch] = useState(0);
  const [mapBearing, setMapBearing] = useState(0);
  const [previewScreen, setPreviewScreen] = useState("");
  const hasEmbeddedTripSeed = Boolean(initialRouteData || initialTripData);
  const isPreviewTrip = String(initialTripData?.trip_id || tripData?.trip_id || "").startsWith("preview-");

  // Notifications logic
  useEffect(() => {
    notificationService.requestPermission();
    
    const handleVisibilityChange = () => {
      if (document.hidden && isDriving) {
        notificationService.notify("VAYY Driver Active", {
          body: "Keep the app open for accurate tracking and manifest updates.",
          tag: "driver-bg-alert",
          renotify: true
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [isDriving]);

  // Simulation Refs
  const ws = useRef(null);
  const simulationInterval = useRef(null);
  const pollIntervalRef = useRef(null);
  const vehicleMarker = useRef(null);
  const prevPos = useRef(null);

  // Dynamic values
  const activePassengerCount = useMemo(() => {
    return Object.values(passengers).filter(p => p.status === 'onboard').length;
  }, [passengers]);

  const distanceTravelled = useMemo(() => {
    if (!routePath || currentIndex === 0) return 0;
    let dist = 0;
    for (let i = 0; i < currentIndex; i++) {
      dist += getDistance(routePath[i], routePath[i+1]);
    }
    return dist;
  }, [routePath, currentIndex]);

  const totalTripDistance = tripData?.total_distance || 0;

  const clearIntervals = () => {
    if (simulationInterval.current) {
      clearInterval(simulationInterval.current);
      simulationInterval.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const beginDriveSimulation = (liveTripData, path) => {
    if (!Array.isArray(path) || path.length === 0) return;

    clearIntervals();
    setIsDriving(true);
    setCurrentSpeed(35);
    setCurrentPos(path[0]);
    setCurrentIndex(0);
    setTripData(liveTripData);
    setNextStops(getNextStopsFromPosition(liveTripData?.stops || [], path[0]));

    let index = 0;
    simulationInterval.current = setInterval(() => {
      if (index >= path.length) {
        stopDrive();
        return;
      }

      setCurrentPos(path[index]);
      setCurrentIndex(index);
      setNextStops(getNextStopsFromPosition(liveTripData?.stops || [], path[index]));

      if (liveTripData?.trip_id && !String(liveTripData.trip_id).startsWith("preview-") && index % 6 === 0) {
        api
          .post(API_PATHS.tracking.ingest, {
            type: "gps",
            trip_id: liveTripData.trip_id,
            lat: path[index][1],
            lon: path[index][0],
          })
          .catch((err) => console.warn("Driver telemetry sync failed", err));
      }

      setCurrentSpeed((prev) => {
        const delta = Math.floor(Math.random() * 11) - 5;
        const next = prev + delta;
        return Math.max(10, Math.min(60, next));
      });

      index += 2;
    }, 1000);
  };

  const applyRouteSeed = (routeSeed, tripSeed = null) => {
    if (!routeSeed) return;

    const derivedPath =
      routeSeed?.previewPath?.length > 0
        ? routeSeed.previewPath
        : getRoutePath(routeSeed);
    const orderedStops = getOrderedStops(routeSeed?.stops || tripSeed?.stops || []);
    const mergedTrip = {
      ...routeSeed,
      ...(tripSeed || {}),
      stops: orderedStops,
      total_distance:
        tripSeed?.total_distance ||
        routeSeed?.total_distance ||
        routeSeed?.total_distance_meters ||
        0,
    };

    setSelectedRouteId(String(routeSeed?.id || tripSeed?.route_id || ""));
    setRoutePath(derivedPath);
    setTripData(mergedTrip);

    if (derivedPath.length > 0) {
      setCurrentPos(derivedPath[0]);
      setCurrentIndex(0);
      updateRenderedRoute(derivedPath);
    }

    if (startLiveOnMount && tripSeed?.trip_id) {
      beginDriveSimulation(mergedTrip, derivedPath);
    }
  };

  const updateRenderedRoute = (path) => {
    if (!map.current || !mapLoaded) return;

    const source = map.current.getSource("route");
    if (!source) return;

    source.setData({
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: path || [],
        },
      }],
    });
    map.current.triggerRepaint();

    if (path && path.length > 0) {
      const bounds = new maplibregl.LngLatBounds(path[0], path[0]);
      path.forEach(coord => bounds.extend(coord));
      map.current.fitBounds(bounds, { padding: 50 });
    }
  };

  // Initialize Map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;
    
    const initMap = (center = [77.3000, 28.5500]) => {
        const m = new maplibregl.Map({
          container: mapContainer.current,
          style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
          center: center,
          zoom: 14,
          pitch: 0,
          bearing: 0,
        });

        m.on("load", () => {
          setMapLoaded(true);
          setMapPitch(m.getPitch());
          setMapBearing(m.getBearing());
          m.addSource("route", {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } }
          });

          m.addLayer({
            id: "route",
            type: "line",
            source: "route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#10b981", "line-width": 8, "line-opacity": 0.4 }
          });
        });

        m.on("moveend", () => {
          setMapPitch(m.getPitch());
          setMapBearing(m.getBearing());
        });

        map.current = m;
    };

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => initMap([pos.coords.longitude, pos.coords.latitude]),
            () => initMap() // Fallback on error
        );
    } else {
        initMap();
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        setMapLoaded(false);
      }
    };
  }, []);

  // Sync Route Path and Stops
  useEffect(() => {
    console.log("Syncing map route:", routePath);
    if (!map.current || !mapLoaded) return;
    
    const source = map.current.getSource("route");
    const layer = map.current.getLayer("route");
    
    if (source) {
        console.log("Source found, updating data...");
        source.setData({
            type: "FeatureCollection",
            features: [{
              type: "Feature",
              properties: {},
              geometry: {
                  type: "LineString",
                  coordinates: routePath || [],
              },
            }]
        });
        
        if (!layer) {
            console.log("Layer missing, re-adding...");
            map.current.addLayer({
                id: "route",
                type: "line",
                source: "route",
                layout: { "line-join": "round", "line-cap": "round" },
                paint: { "line-color": "#10b981", "line-width": 8, "line-opacity": 0.8 }
            });
        }
        map.current.triggerRepaint();
    } else {
        console.log("Source missing, creating it...");
        map.current.addSource("route", {
            type: "geojson",
            data: {
                type: "FeatureCollection",
                features: [{
                  type: "Feature",
                  properties: {},
                  geometry: {
                      type: "LineString",
                      coordinates: routePath || [],
                  },
                }]
            }
        });
        map.current.addLayer({
            id: "route",
            type: "line",
            source: "route",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#10b981", "line-width": 8, "line-opacity": 0.8 }
        });
    }

    // Clear existing markers
    document.querySelectorAll('.stop-marker').forEach(m => m.remove());

    // Render Stops if tripData has stops
    if (tripData?.stops) {
      tripData.stops.forEach((stop) => {
        const stopLngLat = getStopLngLat(stop);
        if (!stopLngLat) return;

        const el = document.createElement("div");
        el.className = "stop-marker";
        el.style.backgroundColor = "#ef4444";
        el.style.borderRadius = "50%";
        el.style.width = "12px";
        el.style.height = "12px";
        el.style.border = "2px solid white";
        
        new maplibregl.Marker({ element: el })
          .setLngLat(stopLngLat)
          .setPopup(new maplibregl.Popup({ offset: 25 }).setText(stop.name || "Stop"))
          .addTo(map.current);
      });
    }

    if (routePath && routePath.length > 0 && !isDriving) {
      const bounds = new maplibregl.LngLatBounds(routePath[0], routePath[0]);
      routePath.forEach(coord => bounds.extend(coord));
      map.current.fitBounds(bounds, { padding: 50 });
    }
  }, [routePath, tripData, isDriving, mapLoaded]);

  // Sync Vehicle Marker
  useEffect(() => {
    if (!map.current || !mapLoaded || !currentPos) return;

    if (!vehicleMarker.current) {
      const el = document.createElement("div");
      el.className = "custom-bus-icon";
      el.innerHTML = `
        <div class="relative w-12 h-12 flex items-center justify-center">
          <div class="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping scale-150"></div>
          <div class="relative bg-emerald-600 w-8 h-12 rounded-lg border-2 border-white shadow-2xl flex flex-col items-center justify-center overflow-hidden">
            <div class="w-full h-2 bg-emerald-400 mb-1"></div>
            <div class="w-6 h-4 bg-white/20 rounded-sm"></div>
          </div>
        </div>
      `;
      vehicleMarker.current = new maplibregl.Marker({ element: el })
        .setLngLat(currentPos)
        .addTo(map.current);
    } else {
      vehicleMarker.current.setLngLat(currentPos);
    }

    if (isDriving) {
      let bearing = map.current.getBearing();
      if (prevPos.current) {
        const [lon1, lat1] = prevPos.current;
        const [lon2, lat2] = currentPos;
        bearing = (Math.atan2(lon2 - lon1, lat2 - lat1) * 180) / Math.PI;
      }
      prevPos.current = currentPos;

      map.current.easeTo({
        center: currentPos,
        zoom: 17,
        pitch: 60,
        bearing: bearing,
        duration: 1000,
      });

      const el = vehicleMarker.current.getElement();
      const inner = el.querySelector(".relative.bg-emerald-600");
      if (inner) inner.style.transform = `rotate(${bearing}deg)`;
    }
  }, [currentPos, isDriving, mapLoaded]);

  // Satellite View Toggle logic
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (isSatellite) {
      if (!map.current.getSource('satellite')) {
        map.current.addSource('satellite', {
          type: 'raster',
          tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          ],
          tileSize: 256,
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        });
      }
      
      if (!map.current.getLayer('satellite')) {
        map.current.addLayer({
          id: 'satellite',
          type: 'raster',
          source: 'satellite',
        }, map.current.getLayer('route') ? 'route' : undefined);
      } else {
        map.current.setLayoutProperty('satellite', 'visibility', 'visible');
      }
    } else {
      if (map.current.getLayer('satellite')) {
        map.current.setLayoutProperty('satellite', 'visibility', 'none');
      }
    }
  }, [isSatellite, mapLoaded]);

  // Load Routes on Mount
  useEffect(() => {
    api.get(API_PATHS.transport.driverRoutes)
      .then((res) => setAvailableRoutes(res.data))
      .catch((err) => console.error("Failed to load routes", err));
  }, []);

  useEffect(() => {
    if (!hasEmbeddedTripSeed) return;
    applyRouteSeed(initialRouteData || initialTripData, initialTripData);
  }, [hasEmbeddedTripSeed, initialRouteData, initialTripData, startLiveOnMount]);

  // Poll Trip Status
  useEffect(() => {
    if (!isDriving || !tripData?.trip_id || isPreviewTrip) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    const pollTrip = async () => {
      try {
        const res = await api.get(API_PATHS.operations.tripNextStops(tripData.trip_id));
        if (res.data.next_stops) {
          setNextStops(res.data.next_stops);
        }
        if (res.data.passengers) {
          setPassengers(res.data.passengers);
        }
      } catch (err) {
        console.error("Poll failed", err);
      }
    };

    pollIntervalRef.current = setInterval(pollTrip, 3000);
    pollTrip();

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isDriving, tripData, isPreviewTrip]);

  const handleLoadRoute = async () => {
    if (!selectedRouteId) return;
    const selectedRoute = availableRoutes.find(r => r.id === selectedRouteId);
    console.log("Selected route from available:", selectedRoute);
    if (!selectedRoute) return;

    setRoutePath(null);
    setLoading(true);
    try {
      let routeDetails = selectedRoute;
      if (!routeDetails.stops || !routeDetails.path_coords) {
        const routeRes = await api.get(`${API_PATHS.transport.routes}${selectedRoute.city ? `?city=${selectedRoute.city}` : ""}`);
        const routes = Array.isArray(routeRes.data) ? routeRes.data : routeRes.data?.results || [];
        routeDetails = routes.find((route) => String(route.id) === String(selectedRouteId)) || selectedRoute;
      }

      const savedPath = getRoutePath(routeDetails);
      const stops = Array.isArray(routeDetails.stops) ? routeDetails.stops : [];
      const orderedStops = [...stops].sort((a, b) => (a.order || 0) - (b.order || 0));
      const firstPoint = savedPath[0] || getStopLngLat(orderedStops[0]);
      const lastPoint = savedPath[savedPath.length - 1] || getStopLngLat(orderedStops[orderedStops.length - 1]);

      if (!firstPoint || !lastPoint) {
        throw new Error("Selected route does not include coordinates for preview rendering.");
      }

      const start = { lat: firstPoint[1], lon: firstPoint[0] };
      const end = { lat: lastPoint[1], lon: lastPoint[0] };

      const res = await api.post(API_PATHS.transport.routePreview, { 
          start, 
          end,
          stops: orderedStops
            .map((stop, i) => {
              const coord = getStopLngLat(stop);
              if (!coord) return null;
              return {
                lat: coord[1],
                lon: coord[0],
                name: stop.name,
                order: stop.order ?? i,
              };
            })
            .filter(Boolean)
      });
      
      console.log("Preview response data:", res.data);
      const previewOptions = getPreviewOptions(res.data);
      const activePreview = previewOptions[0] || {};
      const path = getPreviewPath(activePreview).length > 0 ? getPreviewPath(activePreview) : savedPath;
      console.log("Setting routePath:", path);
      setRoutePath(path);

      updateRenderedRoute(path);
      
      const combinedTripData = {
        ...routeDetails,
        total_distance: activePreview.distance || routeDetails.total_distance || routeDetails.total_distance_meters || selectedRoute.total_distance || 0,
        trip_id: null,
        stops: orderedStops
      };
      console.log("Setting tripData:", combinedTripData);
      setTripData(combinedTripData);
      
      if (path && path.length > 0) {
        setCurrentPos(path[0]);
        setCurrentIndex(0);
      }
    } catch (err) {
      console.error("Failed to load route preview", err);
    } finally {
      setLoading(false);
    }
  };

  const startDrive = async () => {
    if (!selectedRouteId || !routePath) return;
    try {
      // Actually start the trip now
      const res = await api.post(API_PATHS.operations.tripStart, { route_id: selectedRouteId });
      const liveTripData = {
        ...tripData,
        ...res.data,
        stops: res.data.stops || tripData?.stops || [],
      };

      notificationService.notify("Trip Started", {
        body: `Your trip for ${res.data.route_name} has begun.`,
        tag: "trip-start"
      });

      beginDriveSimulation(liveTripData, routePath);
    } catch (err) {
      console.error("Failed to start trip", err);
    }
  };

  const stopDrive = async () => {
    const activeTripId = tripData?.trip_id;
    clearIntervals();
    if (ws.current) ws.current.close();

    if (activeTripId && !String(activeTripId).startsWith("preview-")) {
      api.post(API_PATHS.operations.dispatchComplete(activeTripId)).catch((err) => {
        console.warn("Failed to end trip on server", err);
      });
    }

    setIsDriving(false);
    setRoutePath(null);
    setTripData(null);
    setSelectedRouteId(hasEmbeddedTripSeed ? selectedRouteId : "");
    setCurrentSpeed(0);
    setCurrentIndex(0);
    setNextStops([]);
    if (vehicleMarker.current) {
      vehicleMarker.current.remove();
      vehicleMarker.current = null;
    }
    if (map.current && mapLoaded) {
      map.current.easeTo({ pitch: 0, bearing: 0, zoom: 13 });
    }
    setIs3DView(false);
    onBack?.();
  };

  const toggle3DView = () => {
    if (!map.current || !mapLoaded) return;

    const nextIs3DView = !is3DView;
    setIs3DView(nextIs3DView);

    map.current.easeTo({
      pitch: nextIs3DView ? 60 : 0,
      bearing: nextIs3DView ? map.current.getBearing() || -20 : 0,
      duration: 600,
    });
  };

  const zoomMap = (delta) => {
    if (!map.current || !mapLoaded) return;

    map.current.easeTo({
      zoom: map.current.getZoom() + delta,
      duration: 300,
    });
  };

  const resetMapView = () => {
    if (!map.current || !mapLoaded) return;

    setIs3DView(false);
    map.current.easeTo({
      pitch: 0,
      bearing: 0,
      duration: 600,
    });
  };

  const isMapTiltedOrRotated = Math.abs(mapPitch) > 1 || Math.abs(mapBearing) > 1;
  const PreviewComponent = previewScreen ? driverPreviewScreens[previewScreen] : null;
  const previewRouteSeed = useMemo(() => {
    const fallbackRoute = availableRoutes.find((route) => route?.stops?.length) || availableRoutes[0];
    if (!fallbackRoute) return null;
    return {
      ...fallbackRoute,
      source_name: fallbackRoute.source_name || fallbackRoute.stops?.[0]?.name,
      destination_name:
        fallbackRoute.destination_name ||
        fallbackRoute.stops?.[fallbackRoute.stops.length - 1]?.name,
    };
  }, [availableRoutes]);
  const previewSource = useMemo(() => {
    const firstStop = previewRouteSeed?.stops?.[0];
    return firstStop
      ? {
          name: firstStop.name,
          display_name: firstStop.name,
          lat: Number(firstStop.lat),
          lon: Number(firstStop.lon),
        }
      : null;
  }, [previewRouteSeed]);
  const previewDestination = useMemo(() => {
    const lastStop = previewRouteSeed?.stops?.[previewRouteSeed.stops.length - 1];
    return lastStop
      ? {
          name: lastStop.name,
          display_name: lastStop.name,
          lat: Number(lastStop.lat),
          lon: Number(lastStop.lon),
        }
      : null;
  }, [previewRouteSeed]);

  const renderPreviewContent = () => {
    if (previewScreen === "DriverTripPlanner") {
      return <DriverTripPlanner />;
    }

    if (previewScreen === "DriverRouteList") {
      return (
        <DriverRouteList
          source={previewSource}
          destination={previewDestination}
          routes={previewRouteSeed ? [previewRouteSeed] : []}
          allRoutesCount={previewRouteSeed ? 1 : 0}
          onBack={() => setPreviewScreen("")}
          onSelectRoute={() => setPreviewScreen("DriverStopsTimeline")}
        />
      );
    }

    if (previewScreen === "DriverStopsTimeline") {
      return (
        <div className="h-full min-h-screen bg-slate-950 px-4 pb-4 pt-20 sm:px-6 lg:px-8">
          <div className="mx-auto flex h-full max-w-5xl flex-col">
            <button
              type="button"
              onClick={() => setPreviewScreen("")}
              className="mb-4 w-fit rounded-[18px] border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-black text-slate-200"
            >
              Back to Preview
            </button>
            <DriverStopsTimeline
              route={previewRouteSeed}
              currentStopIndex={1}
              className="flex-1 overflow-hidden"
            />
          </div>
        </div>
      );
    }

    return PreviewComponent ? <PreviewComponent /> : null;
  };

  return (
    <div className="isolate relative flex h-[calc(100vh-5rem)] w-full bg-slate-50 font-sans overflow-x-hidden overflow-y-hidden">
      
      {/* Background Map */}
      <div ref={mapContainer} className="absolute inset-0 z-0 h-full w-full overflow-x-hidden" />

      {/* Mobile Toggle Button */}
      <button 
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute left-4 top-20 z-[1100] flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-600 shadow-lg lg:hidden"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar Content */}
      <aside className={`fixed left-0 top-0 z-[1000] flex h-full w-full flex-col pb-6 pt-16 pointer-events-none transition-transform duration-300 sm:w-[380px] sm:pt-20 lg:relative lg:ml-6 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <motion.div 
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="bg-white/95 backdrop-blur-md lg:rounded-3xl shadow-2xl shadow-slate-900/5 border border-white h-full flex flex-col pointer-events-auto overflow-hidden"
        >
          <div className="bg-slate-900 p-6 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                <Navigation size={24} className="transform rotate-45" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white tracking-tight">Driver Console</h2>
                <p className="text-xs font-medium text-slate-400">Manage your assigned route</p>
              </div>
            </div>
            {isDriving && (
              <div className="flex items-center gap-2">
                 <button
                  onClick={() => setShowManifest(!showManifest)}
                  className={`px-3 py-1 rounded text-[10px] font-bold uppercase border transition-all ${showManifest ? 'bg-emerald-600 border-emerald-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                >
                  {showManifest ? "Hide Manifest" : "Show Manifest"}
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-2">
            {!hasEmbeddedTripSeed && !isDriving && !routePath && (
              <SidebarCard title="Route Assignment">
                <div className="space-y-4">
                  <div className="relative bg-slate-50 border border-slate-100 rounded-2xl p-4 w-full overflow-hidden group">
                    <div className="flex items-center gap-3 w-full">
                      <Bus size={18} className="text-slate-400 flex-shrink-0" />
                      <select 
                        className="w-full bg-transparent text-xs font-bold text-slate-700 outline-none appearance-none cursor-pointer truncate"
                        style={{ maxWidth: 'calc(100% - 40px)' }}
                        value={selectedRouteId}
                        onChange={(e) => setSelectedRouteId(e.target.value)}
                      >
                        <option value="">Select Route</option>
                        {availableRoutes.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="text-slate-400" />
                    </div>
                  </div>
                  <button 
                    onClick={handleLoadRoute}
                    disabled={!selectedRouteId || loading}
                    className="w-full bg-emerald-500 hover:bg-brand-hover text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-3 disabled:bg-slate-300"
                  >
                    {loading ? <Clock className="animate-spin" size={18} /> : <Play size={18} fill="white" />}
                    <span className="text-sm">{loading ? 'Loading...' : 'Load Route'}</span>
                  </button>
                </div>
              </SidebarCard>
            )}

            {showTemporaryPreview && (
              <SidebarCard title="Temporary Preview">
                <div className="space-y-3">
                  <p className="text-[11px] leading-5 text-slate-500">
                    Open driver components from <code>src/driver/components</code> directly in the web app for layout review.
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {Object.keys(driverPreviewScreens).map((screenName) => (
                      <button
                        key={screenName}
                        onClick={() => setPreviewScreen(screenName)}
                        className={`rounded-xl border px-3 py-3 text-left text-xs font-bold transition-colors ${
                          previewScreen === screenName
                            ? "border-cyan-300 bg-cyan-50 text-cyan-700"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        {screenName}
                      </button>
                    ))}
                  </div>
                  {previewScreen && (
                    <button
                      onClick={() => setPreviewScreen("")}
                      className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200"
                    >
                      Close Preview
                    </button>
                  )}
                </div>
              </SidebarCard>
            )}

            {!hasEmbeddedTripSeed && routePath && !isDriving && (
              <SidebarCard title="Ready to Start">
                <div className="space-y-4">
                   <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest">Total Distance</p>
                      <p className="text-xl font-black text-slate-800">
                        {(totalTripDistance / 1000).toFixed(1)} km
                      </p>
                    </div>
                    <MapPin className="text-emerald-300" size={24} />
                  </div>
                  <button 
                    onClick={startDrive}
                    className="w-full bg-emerald-500 hover:bg-brand-hover text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-3"
                  >
                    <Play size={18} fill="white" />
                    <span className="text-sm">Start Trip</span>
                  </button>
                  <button onClick={stopDrive} className="w-full text-slate-400 text-xs hover:text-red-500 font-bold flex justify-center items-center gap-2 pointer-events-auto">
                    <LogOut size={14} /> Cancel
                  </button>
                </div>
              </SidebarCard>
            )}

            {isDriving && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <SidebarCard title="Next Stops">
                  <div className="space-y-2">
                    {nextStops.length === 0 ? (
                      <div className="text-xs text-slate-400 text-center py-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        Polling live updates...
                      </div>
                    ) : (
                      nextStops.map((stop, idx) => (
                        <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between ${idx === 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${idx === 0 ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
                              <MapPin size={14} />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800">{stop.name}</p>
                              <p className="text-[10px] font-medium text-slate-400">Arriving in {3 + idx} mins</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-white rounded-md border border-slate-100 shadow-sm">
                            <Users size={12} className="text-emerald-500" />
                            <span className="text-[10px] font-bold text-slate-700">{stop.waiting_count || 0}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <button 
                    onClick={stopDrive}
                    className="w-full mt-6 bg-red-50 hover:bg-red-100 text-red-500 py-4 rounded-xl font-bold transition-all border border-red-100 flex items-center justify-center gap-3"
                  >
                    <StopCircle size={18} />
                    <span className="text-sm">End Trip</span>
                  </button>
                </SidebarCard>
              </motion.div>
            )}

            <SidebarCard title="Vehicle Details">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm hover:border-slate-200 transition-colors">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                    <Bus size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Number</p>
                    <p className="text-xs font-black text-slate-800 tracking-tight">{tripData?.vehicle_number || "UP16 AT 1234"}</p>
                  </div>
                </div>
                <div className="bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm hover:border-slate-200 transition-colors">
                  <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                   <Compass size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Type</p>
                    <p className="text-xs font-black text-slate-800">{tripData?.vehicle_type || "Electric"}</p>
                  </div>
                </div>
              </div>
            </SidebarCard>

            <SidebarCard title="Route Stats">
              <div className="grid grid-cols-2 gap-3">
                <StatItem icon={Clock} label="ETA" value={isDriving ? "22 mins" : "---"} colorClass="bg-slate-50 text-slate-500" />
                <StatItem icon={CheckCircle2} label="Status" value={isDriving ? "On Time" : "Ready"} colorClass="bg-emerald-50 text-emerald-500" />
              </div>
            </SidebarCard>
          </div>

          <div className="mt-auto p-4 px-6 mb-2 border-t border-slate-100">
            <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between group cursor-pointer hover:bg-slate-100 transition-colors pointer-events-auto">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-400 shadow-sm border border-slate-100">
                  <HelpCircle size={16} />
                </div>
                <span className="text-xs font-bold text-slate-600">Assistance Required?</span>
              </div>
              <ChevronRight size={16} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </motion.div>
      </aside>

      {/* Floating Bottom Console */}
      <div className="pointer-events-auto absolute bottom-6 left-1/2 z-[900] w-[90%] -translate-x-1/2 transform overflow-x-hidden sm:bottom-10 sm:w-max">
        <AnimatePresence>
          {isDriving && (
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-white/95 backdrop-blur-md px-6 sm:px-10 py-4 sm:py-5 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl border border-white flex flex-row items-center justify-around sm:gap-12"
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-800 shadow-sm border border-slate-100">
                  <Navigation size={16} className="sm:size-18 transform rotate-45" />
                </div>
                <div>
                  <p className="hidden sm:block text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Distance</p>
                  <p className="text-sm sm:text-lg font-black text-slate-800 tabular-nums tracking-tighter">
                    {(distanceTravelled / 1000).toFixed(1)} / {(totalTripDistance / 1000).toFixed(1)} km
                  </p>
                </div>
              </div>
              <div className="w-px h-8 sm:h-10 bg-slate-100 mx-2" />
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100">
                  <TrendingUp size={16} className="sm:size-18" />
                </div>
                <div>
                  <p className="hidden sm:block text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Current Speed</p>
                  <p className="text-sm sm:text-lg font-black text-slate-800 tabular-nums tracking-tighter">{currentSpeed} km/h</p>
                </div>
              </div>
              <div className="w-px h-8 sm:h-10 bg-slate-100 mx-2" />
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-800 shadow-sm border border-slate-100">
                  <Users size={16} className="sm:size-18" />
                </div>
                <div>
                  <p className="hidden sm:block text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Passengers</p>
                  <p className="text-sm sm:text-lg font-black text-slate-800 tabular-nums tracking-tighter">{activePassengerCount} Active</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Map Control: Side */}
      <div className="pointer-events-auto absolute right-4 top-44 z-[900] flex flex-col gap-2 sm:right-6">
        <button
          onClick={() => zoomMap(1)}
          disabled={!mapLoaded}
          aria-label="Zoom in"
          title="Zoom in"
          className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-xl shadow-lg border border-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={20} />
        </button>
        <button
          onClick={() => zoomMap(-1)}
          disabled={!mapLoaded}
          aria-label="Zoom out"
          title="Zoom out"
          className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-xl shadow-lg border border-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Minus size={20} />
        </button>
        <button
          onClick={toggle3DView}
          disabled={!mapLoaded}
          aria-label="Toggle 3D view"
          title="3D view"
          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl shadow-lg border flex items-center justify-center transition-colors ${
            is3DView
              ? 'bg-emerald-500 border-emerald-400 text-white hover:bg-emerald-600'
              : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Box size={20} />
        </button>
        <button
          onClick={() => setIsSatellite(!isSatellite)}
          disabled={!mapLoaded}
          aria-label="Toggle Satellite view"
          title="Satellite view"
          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl shadow-lg border flex items-center justify-center transition-colors ${
            isSatellite
              ? 'bg-indigo-500 border-indigo-400 text-white hover:bg-indigo-600'
              : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Globe size={20} />
        </button>
        <button
          onClick={resetMapView}
          disabled={!mapLoaded}
          aria-label="Reset map view"
          title="Reset map view"
          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl shadow-lg border flex items-center justify-center transition-colors mt-2 ${
            isMapTiltedOrRotated
              ? 'bg-slate-900 border-slate-800 text-white hover:bg-slate-800'
              : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Compass size={20} />
        </button>
      </div>

      {/* Right Bottom Legend */}
      <div className="pointer-events-auto absolute bottom-10 right-6 z-[900] hidden sm:block">
        <motion.div 
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="bg-white/90 backdrop-blur-md p-6 rounded-[2rem] shadow-xl border border-white space-y-4 w-52"
        >
          <div className="flex items-center gap-3 group cursor-pointer hover:translate-x-1 transition-transform">
            <div className="w-6 h-1.5 bg-emerald-500 rounded-full shadow-sm" />
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Live Route</span>
          </div>
          <div className="flex items-center gap-3 group cursor-pointer hover:translate-x-1 transition-transform">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white shadow-md ring-4 ring-emerald-50" />
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Pickup Points</span>
          </div>
          <div className="flex items-center gap-3 group cursor-pointer hover:translate-x-1 transition-transform">
            <div className="w-2.5 h-2.5 bg-slate-300 rounded-full border-2 border-white shadow-md" />
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Upcoming Stops</span>
          </div>
        </motion.div>
      </div>

      {/* Right Side Manifest */}
      <AnimatePresence>
        {isDriving && showManifest && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute right-0 top-0 w-full sm:w-96 h-full z-[1001]"
          >
            <div className="relative h-full">
               <button 
                onClick={() => setShowManifest(false)}
                className="absolute top-20 -left-12 w-10 h-10 bg-white border border-slate-200 rounded-xl shadow-lg flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors pointer-events-auto"
              >
                <ChevronRight size={20} />
              </button>
              <DriverManifest
                vehicleId={tripData?.vehicle_id || "VAYY-123"}
                tripId={tripData?.trip_id}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {PreviewComponent && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="absolute inset-0 z-[1200] overflow-y-auto bg-slate-950/80 backdrop-blur-sm"
          >
            <div className="sticky top-0 z-10 flex justify-end p-4">
              <button
                onClick={() => setPreviewScreen("")}
                className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-200"
              >
                Close {previewScreen}
              </button>
            </div>
            {renderPreviewContent()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
