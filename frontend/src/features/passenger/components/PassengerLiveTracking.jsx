import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  ChevronLeft,
  MapPin,
  Clock,
  Hand,
  RefreshCw,
} from "lucide-react";
import api, { getWsUrl } from "../../../lib/api";

function formatMinutesFromEta(nextStopEta) {
  if (!nextStopEta?.[0]?.duration_seconds) return "--";
  return Math.max(1, Math.ceil(nextStopEta[0].duration_seconds / 60));
}

export default function PassengerLiveTracking({
  selectedTrip,
  pickup,
  destination,
  onBack,
  onUpdatePickup,
  onUpdateDestination,
  onRefreshRoutes,
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const ws = useRef(null);
  const markers = useRef({});
  const watchId = useRef(null);
  const reconnectTimeout = useRef(null);
  const reconnectAttempts = useRef(0);

  const [busData, setBusData] = useState({
    trip_id: selectedTrip?.trip_id || null,
    bus_number: selectedTrip?.bus_number || null,
    vehicle_number: selectedTrip?.vehicle_number || null,
    route_name: selectedTrip?.route_name || null,
    next_stop: selectedTrip?.next_stop || null,
    next_stop_eta: [],
    pos: null,
    stops: [],
  });

  const [wsStatus, setWsStatus] = useState("disconnected");
  const [loading, setLoading] = useState(false);
  const [myPos, setMyPos] = useState(null);
  const [isLocationActive, setIsLocationActive] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [distanceToNearestStop, setDistanceToNearestStop] = useState("");
  const [isRouteDirty, setIsRouteDirty] = useState(false);

  const tripId = selectedTrip?.trip_id || null;
  const maxReconnectDelay = 30000;
  const routeSourceId = "pickup-destination-route";
  const routeLayerId = "pickup-destination-route-layer";

  useEffect(() => {
    setBusData({
      trip_id: selectedTrip?.trip_id || null,
      bus_number: selectedTrip?.bus_number || null,
      vehicle_number: selectedTrip?.vehicle_number || null,
      route_name: selectedTrip?.route_name || null,
      next_stop: selectedTrip?.next_stop || null,
      next_stop_eta: [],
      pos: null,
      stops: [],
    });
  }, [selectedTrip]);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: [78.9629, 20.5937],
      zoom: 4,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      if (!map.current) return;

      if (!map.current.getSource(routeSourceId)) {
        map.current.addSource(routeSourceId, {
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

      if (!map.current.getLayer(routeLayerId)) {
        map.current.addLayer({
          id: routeLayerId,
          type: "line",
          source: routeSourceId,
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#111111",
            "line-width": 4,
            "line-opacity": 0.7,
            "line-dasharray": [2, 2],
          },
        });
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!tripId) {
      setLoading(false);
      setWsStatus("disconnected");
      return;
    }

    let active = true;

    const fetchTripSnapshot = async () => {
      try {
        setLoading(true);

        const res = await api.get("/api/passenger/dashboard/");
        const trip = (res.data?.active_trips || []).find(
          (item) => item.trip_id === tripId,
        );

        if (trip && active) {
          setBusData((prev) => ({
            ...prev,
            trip_id: trip.trip_id,
            bus_number: trip.bus_number,
            vehicle_number: trip.vehicle_number,
            route_name: trip.route_name,
            stops: trip.stops || [],
          }));
        }
      } catch (error) {
        console.error("Failed to load trip snapshot", error);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchTripSnapshot();

    return () => {
      active = false;
    };
  }, [tripId]);

  useEffect(() => {
    if (!tripId) {
      cleanupWebSocket();
      setWsStatus("disconnected");
      return;
    }

    const connectWebSocket = () => {
      cleanupWebSocket();
      setWsStatus("connecting");

      const token = localStorage.getItem("token");
      const groupId = "public";
      const socketUrl = getWsUrl(`/ws/public/${groupId}/passenger/${tripId}/?token=${token || ""}`);

      ws.current = new WebSocket(socketUrl);

      ws.current.onopen = () => {
        setWsStatus("connected");
        reconnectAttempts.current = 0;
      };

      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (
          data.type === "city_vehicle_update" ||
          data.type === "university_vehicle_update" ||
          data.type === "vehicle_update"
        ) {
          setBusData((prev) => ({
            ...prev,
            trip_id: data.trip_id || prev.trip_id,
            bus_number: data.bus_number || prev.bus_number,
            route_id: data.route_id || prev.route_id,
            next_stop_eta: data.next_stop_eta || prev.next_stop_eta,
            next_stop:
              data.next_stop_eta?.[0]?.stop_name || prev.next_stop || null,
            pos:
              typeof data.lat === "number" && typeof data.lon === "number"
                ? [data.lat, data.lon]
                : prev.pos,
          }));
        }

        if (data.type === "vehicle_stopped") {
          setWsStatus("disconnected");
        }
      };

      ws.current.onclose = () => {
        setWsStatus("disconnected");
        scheduleReconnect();
      };

      ws.current.onerror = () => {};
    };

    connectWebSocket();

    return () => {
      cleanupWebSocket();
    };
  }, [tripId]);

  const scheduleReconnect = () => {
    if (!tripId) return;

    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);

    const delay = Math.min(
      1000 * Math.pow(2, reconnectAttempts.current),
      maxReconnectDelay,
    );

    reconnectTimeout.current = setTimeout(() => {
      reconnectAttempts.current += 1;

      const token = localStorage.getItem("token");
      const groupId = "public";
      const socketUrl = getWsUrl(`/ws/public/${groupId}/passenger/${tripId}/?token=${token || ""}`);

      cleanupWebSocket();
      setWsStatus("connecting");

      ws.current = new WebSocket(socketUrl);

      ws.current.onopen = () => {
        setWsStatus("connected");
        reconnectAttempts.current = 0;
      };

      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (
          data.type === "city_vehicle_update" ||
          data.type === "university_vehicle_update" ||
          data.type === "vehicle_update"
        ) {
          setBusData((prev) => ({
            ...prev,
            trip_id: data.trip_id || prev.trip_id,
            bus_number: data.bus_number || prev.bus_number,
            route_id: data.route_id || prev.route_id,
            next_stop_eta: data.next_stop_eta || prev.next_stop_eta,
            next_stop:
              data.next_stop_eta?.[0]?.stop_name || prev.next_stop || null,
            pos:
              typeof data.lat === "number" && typeof data.lon === "number"
                ? [data.lat, data.lon]
                : prev.pos,
          }));
        }
      };

      ws.current.onclose = () => {
        setWsStatus("disconnected");
        scheduleReconnect();
      };

      ws.current.onerror = () => {};
    }, delay);
  };

  const cleanupWebSocket = () => {
    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);

    if (ws.current) {
      ws.current.onclose = null;
      ws.current.close();
      ws.current = null;
    }
  };

  const createCircleMarker = (color, size = 16) => {
    const el = document.createElement("div");
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.borderRadius = "999px";
    el.style.backgroundColor = color;
    el.style.border = "3px solid white";
    el.style.boxShadow = "0 4px 14px rgba(0,0,0,0.18)";
    return el;
  };

  const createTriangleMarker = () => {
    const el = document.createElement("div");
    el.style.width = "48px";
    el.style.height = "48px";
    el.style.borderRadius = "999px";
    el.style.backgroundColor = "#22c55e";
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.boxShadow = "0 8px 22px rgba(34,197,94,0.35)";
    el.style.border = "4px solid white";
    el.style.transition = "transform 400ms ease";

    const inner = document.createElement("div");
    inner.style.width = "0";
    inner.style.height = "0";
    inner.style.borderLeft = "10px solid transparent";
    inner.style.borderRight = "10px solid transparent";
    inner.style.borderBottom = "18px solid black";
    inner.style.transform = "translateY(-2px)";
    el.appendChild(inner);

    return el;
  };

  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    const hasPickup = Boolean(pickup?.lon && pickup?.lat);
    const hasDestination = Boolean(destination?.lon && destination?.lat);

    const source = map.current.getSource(routeSourceId);
    if (!source) return;

    if (hasPickup && hasDestination) {
      source.setData({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [pickup.lon, pickup.lat],
            [destination.lon, destination.lat],
          ],
        },
        properties: {},
      });
    } else {
      source.setData({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [],
        },
        properties: {},
      });
    }
  }, [pickup, destination]);

  useEffect(() => {
    if (!map.current) return;

    const points = [];

    if (pickup?.lon && pickup?.lat) {
      points.push([pickup.lon, pickup.lat]);

      if (!markers.current.pickup) {
        markers.current.pickup = new maplibregl.Marker({
          element: createCircleMarker("#22c55e", 14),
          draggable: true,
        })
          .setLngLat([pickup.lon, pickup.lat])
          .setPopup(
            new maplibregl.Popup().setText(
              `Pickup: ${pickup.display_name || pickup.name || "Pickup"}`,
            ),
          )
          .addTo(map.current);

        markers.current.pickup.on("dragend", () => {
          const lngLat = markers.current.pickup.getLngLat();

          onUpdatePickup?.({
            ...pickup,
            lon: lngLat.lng,
            lat: lngLat.lat,
            name: pickup?.name || "Pickup",
            display_name: pickup?.display_name || pickup?.name || "Pickup",
          });

          setIsRouteDirty(true);
        });
      } else {
        markers.current.pickup.setLngLat([pickup.lon, pickup.lat]);
      }
    } else if (markers.current.pickup) {
      markers.current.pickup.remove();
      delete markers.current.pickup;
    }

    if (destination?.lon && destination?.lat) {
      points.push([destination.lon, destination.lat]);

      if (!markers.current.destination) {
        markers.current.destination = new maplibregl.Marker({
          element: createCircleMarker("#ef4444", 14),
          draggable: true,
        })
          .setLngLat([destination.lon, destination.lat])
          .setPopup(
            new maplibregl.Popup().setText(
              `Destination: ${destination.display_name || destination.name || "Destination"}`,
            ),
          )
          .addTo(map.current);

        markers.current.destination.on("dragend", () => {
          const lngLat = markers.current.destination.getLngLat();

          onUpdateDestination?.({
            ...destination,
            lon: lngLat.lng,
            lat: lngLat.lat,
            name: destination?.name || "Destination",
            display_name:
              destination?.display_name ||
              destination?.name ||
              "Destination",
          });

          setIsRouteDirty(true);
        });
      } else {
        markers.current.destination.setLngLat([destination.lon, destination.lat]);
      }
    } else if (markers.current.destination) {
      markers.current.destination.remove();
      delete markers.current.destination;
    }

    if (myPos?.lon && myPos?.lat) {
      points.push([myPos.lon, myPos.lat]);

      if (!markers.current.me) {
        markers.current.me = new maplibregl.Marker({
          element: createCircleMarker("#4f46e5", 14),
        })
          .setLngLat([myPos.lon, myPos.lat])
          .setPopup(new maplibregl.Popup().setText("You are here"))
          .addTo(map.current);
      } else {
        markers.current.me.setLngLat([myPos.lon, myPos.lat]);
      }
    } else if (markers.current.me) {
      markers.current.me.remove();
      delete markers.current.me;
    }

    if (busData?.pos) {
      const [lat, lon] = busData.pos;
      points.push([lon, lat]);

      if (!markers.current.bus) {
        markers.current.bus = new maplibregl.Marker({
          element: createTriangleMarker(),
        })
          .setLngLat([lon, lat])
          .setPopup(
            new maplibregl.Popup().setHTML(`
              <div style="text-align:center;font-weight:700;color:#0f172a;">
                ${busData.bus_number ? `Bus ${busData.bus_number}` : "Public Bus"}
              </div>
              <div style="font-size:12px;color:#64748b;text-align:center;">
                ${busData.route_name || "Public Route"}
              </div>
            `),
          )
          .addTo(map.current);
      } else {
        markers.current.bus.setLngLat([lon, lat]);
      }
    } else if (markers.current.bus) {
      markers.current.bus.remove();
      delete markers.current.bus;
    }

    if (points.length > 0) {
      const bounds = points.reduce(
        (acc, coord) => acc.extend(coord),
        new maplibregl.LngLatBounds(points[0], points[0]),
      );

      map.current.fitBounds(bounds, {
        padding: 80,
        duration: 1200,
      });
    }
  }, [pickup, destination, myPos, busData, onUpdatePickup, onUpdateDestination]);

  useEffect(() => {
    if (!myPos || !busData?.stops?.length) {
      setDistanceToNearestStop("");
      return;
    }

    let min = Infinity;

    for (const stop of busData.stops) {
      const d =
        Math.sqrt(
          Math.pow(myPos.lat - stop.lat, 2) + Math.pow(myPos.lon - stop.lon, 2),
        ) * 111320;

      if (d < min) min = d;
    }

    if (Number.isFinite(min)) {
      setDistanceToNearestStop(
        min < 1000 ? `${Math.round(min)}m` : `${(min / 1000).toFixed(1)}km`,
      );
    }
  }, [myPos, busData?.stops]);

  const startTracking = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported");
      return;
    }

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const nextPos = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        };

        setMyPos(nextPos);
        setLocationError("");

        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(
            JSON.stringify({
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
            }),
          );
        }
      },
      (err) => {
        let msg = "Location unavailable";

        if (err.code === 1) {
          msg = "Location permission denied";
          setIsLocationActive(false);

          if (watchId.current) {
            navigator.geolocation.clearWatch(watchId.current);
            watchId.current = null;
          }
        } else if (err.code === 2) {
          msg = "Position unavailable";
        } else if (err.code === 3) {
          msg = "Location timeout";
        }

        setLocationError(msg);
      },
      {
        enableHighAccuracy: false,
        maximumAge: 10000,
        timeout: 10000,
      },
    );
  };

  const toggleLocationSharing = () => {
    if (isLocationActive) {
      if (watchId.current) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }

      setIsLocationActive(false);
      setLocationError("");
      setIsHandRaised(false);
      return;
    }

    setIsLocationActive(true);
    setLocationError("");
    startTracking();
  };

  const toggleHandRaise = () => {
    if (!isLocationActive) {
      alert("Activate location first to raise hand");
      return;
    }

    const next = !isHandRaised;
    setIsHandRaised(next);

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(
        JSON.stringify({
          type: "toggle_hand_raise",
          lat: myPos?.lat,
          lon: myPos?.lon,
        }),
      );
    }
  };

  const handleRefreshRoutes = async () => {
    if (typeof onRefreshRoutes === "function") {
      await onRefreshRoutes();
    } else {
      window.dispatchEvent(new Event("reFetchRoutes"));
    }

    setIsRouteDirty(false);
  };

  useEffect(() => {
    return () => {
      cleanupWebSocket();

      if (watchId.current) {
        navigator.geolocation.clearWatch(watchId.current);
      }

      Object.values(markers.current).forEach((marker) => marker?.remove?.());
      markers.current = {};
    };
  }, []);

  if (!pickup && !destination && !selectedTrip) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#171717] px-4 text-center text-white">
        No location selected.
      </div>
    );
  }

  const routeTitle = busData.bus_number
    ? `Bus ${busData.bus_number}`
    : busData.vehicle_number
      ? `Vehicle ${busData.vehicle_number}`
      : selectedTrip
        ? "Selected Route"
        : "Route Preview";

  const routeSubtitle =
    busData.route_name || selectedTrip?.route_name || "Public Route";

  return (
    <div className="min-h-screen bg-[#171717] px-2 py-2 sm:px-6 sm:py-8">
      <div className="mx-auto grid w-full max-w-[1180px] gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="order-2 overflow-hidden rounded-none border border-black bg-[#efefef] shadow-[0_18px_50px_rgba(0,0,0,0.28)] sm:rounded-[22px] lg:order-1">
          <div className="px-3 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-6">
            <div className="relative mb-5 flex items-center justify-center">
              <button
                type="button"
                onClick={onBack}
                className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full p-1 text-black"
                aria-label="Go back"
              >
                <ChevronLeft size={22} strokeWidth={2.5} />
              </button>

              <h1 className="text-[16px] font-semibold text-black sm:text-[22px]">
                Live Screen
              </h1>
            </div>

            <div className="space-y-4">
              <div className="rounded-[14px] bg-[#d1d1d1] p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-black/55">
                      Route
                    </p>
                    <h2 className="text-[18px] font-bold text-black">
                      {routeTitle}
                    </h2>
                    <p className="text-[12px] font-medium text-black/70">
                      {routeSubtitle}
                    </p>
                  </div>

                  <div className="rounded-[10px] bg-white px-3 py-2 text-center shadow-sm">
                    <p className="text-[16px] font-black text-black">
                      {selectedTrip
                        ? formatMinutesFromEta(busData.next_stop_eta)
                        : "--"}
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-black/50">
                      min
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-[13px] text-black">
                    <Clock size={15} className="shrink-0 text-black/70" />
                    <span>
                      Next Stop:{" "}
                      <strong>
                        {selectedTrip
                          ? busData.next_stop || "Calculating..."
                          : "Drag pickup/drop to refine route"}
                      </strong>
                    </span>
                  </div>

                  {distanceToNearestStop && selectedTrip && (
                    <div className="flex items-center gap-3 text-[13px] text-black">
                      <MapPin size={15} className="shrink-0 text-black/70" />
                      <span>
                        Distance: <strong>{distanceToNearestStop}</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[14px] bg-[#a6a6a6] p-4 text-[12px] text-black">
                <p className="mb-2 font-bold">Edit Stops</p>
                <div className="space-y-2">
                  <p>
                    <strong>Pickup:</strong>{" "}
                    {pickup?.display_name || pickup?.name || "Not selected"}
                  </p>
                  <p>
                    <strong>Destination:</strong>{" "}
                    {destination?.display_name ||
                      destination?.name ||
                      "Not selected"}
                  </p>
                  <p className="pt-2 text-[11px] text-black/65">
                    Drag the green and red markers on the map to adjust pickup and
                    drop points.
                  </p>
                </div>

                {isRouteDirty && (
                  <button
                    type="button"
                    onClick={handleRefreshRoutes}
                    className="mt-4 w-full rounded-[12px] bg-black px-4 py-3 text-[13px] font-bold text-white"
                  >
                    Refresh Routes
                  </button>
                )}
              </div>

              <div className="rounded-[14px] bg-[#a6a6a6] p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-black/60">
                  Connection
                </p>

                <div className="flex items-center gap-3">
                  <span
                    className={`h-3 w-3 rounded-full ${
                      wsStatus === "connected"
                        ? "bg-green-500 animate-pulse"
                        : "bg-orange-500"
                    }`}
                  />
                  <span className="text-[13px] font-semibold text-black">
                    {selectedTrip
                      ? wsStatus === "connected"
                        ? "Live connection active"
                        : "Connecting..."
                      : "Map preview active"}
                  </span>
                </div>
              </div>

              <div className="rounded-[14px] bg-[#a6a6a6] p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-black/60">
                  My Location Status
                </p>

                <div className="mb-4 text-[13px] font-semibold text-black">
                  {locationError ? (
                    <span className="text-red-600">{locationError}</span>
                  ) : isLocationActive ? (
                    "Sharing Live"
                  ) : (
                    "Not Sharing"
                  )}
                </div>

                <button
                  type="button"
                  onClick={toggleLocationSharing}
                  className={`w-full rounded-[12px] px-4 py-3 text-[13px] font-bold text-white transition ${
                    isLocationActive ? "bg-red-500" : "bg-[#2dd4bf]"
                  }`}
                >
                  {isLocationActive ? "Stop Sharing" : "Start Sharing"}
                </button>
              </div>

              <div className="rounded-[14px] bg-[#a6a6a6] p-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-black/60">
                  Signal Driver
                </p>

                <button
                  type="button"
                  onClick={toggleHandRaise}
                  disabled={!isLocationActive || !selectedTrip}
                  className={`flex w-full items-center justify-center gap-2 rounded-[12px] px-4 py-3 text-[13px] font-bold transition ${
                    isHandRaised
                      ? "bg-[#f59e0b] text-white"
                      : "bg-white text-black"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <Hand
                    size={16}
                    className={isHandRaised ? "animate-bounce" : ""}
                  />
                  {isHandRaised ? "Lower Hand" : "Raise Hand To Stop"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="order-1 min-h-[420px] overflow-hidden rounded-none border border-black bg-[#efefef] shadow-[0_18px_50px_rgba(0,0,0,0.28)] sm:rounded-[22px] lg:order-2 lg:min-h-[760px]">
          {loading ? (
            <div className="flex h-full min-h-[420px] items-center justify-center">
              <RefreshCw className="animate-spin text-black" />
            </div>
          ) : (
            <div ref={mapContainer} className="h-[420px] w-full lg:h-[760px]" />
          )}
        </div>
      </div>
    </div>
  );
}