import React, { useState, useRef, useEffect } from "react";
import { useSelector } from "react-redux";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMapEvents,
  useMap,
  Polyline,
} from "react-leaflet";
import L from "leaflet";
import api from "../utils/api";
import {
  Loader,
  MapPin,
  Navigation,
  AlertCircle,
  Search,
  Bus,
  Info,
} from "lucide-react";

// --- Helper: Auto Zoom to Bounds ---
const MapUpdater = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      const latLngBounds = L.latLngBounds(bounds);
      map.fitBounds(latLngBounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  return null;
};

const MapPassenger = ({ onBack }) => {
  const { user } = useSelector((state) => state.auth);

  const [myPos, setMyPos] = useState(null);
  const [universityVehicles, setUniversityVehicles] = useState({}); // { trip_id: { lat, lon, vehicle_number } }
  const [activeTrip, setActiveTrip] = useState(null); // { trip_id, vehicle_number, etc }
  const [nearbyStops, setNearbyStops] = useState([]);
  const [selectedStop, setSelectedStop] = useState(null);
  const [showStops, setShowStops] = useState(false);

  // Tracking State
  const [eta, setEta] = useState(null);
  const [stopMetrics, setStopMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState([]);

  const ws = useRef(null);
  const heartbeatRef = useRef(null);

  // 1. Initial Setup: Fetch Campus Routes & Connect to University Group
  useEffect(() => {
    if (user?.university) {
      fetchRoutes();
      connectToUniversityGroup();
    }
    return () => {
      if (ws.current) ws.current.close();
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [user?.university]);

  // Fetch nearby stops based on position
  useEffect(() => {
    if (myPos) {
      fetchNearbyStops();
    }
  }, [myPos]);

  const fetchRoutes = async () => {
    try {
      const res = await api.get(`/api/routes/?university=${user.university}`);
      setRoutes(res.data);
    } catch (err) {
      console.error("Failed to load campus routes");
    }
  };

  const fetchNearbyStops = async () => {
    try {
      const res = await api.get(
        `/api/passenger/nearby-stops/?lat=${myPos.lat}&lon=${myPos.lon}`,
      );
      setNearbyStops(res.data);
    } catch (err) {
      console.error("Failed to fetch nearby stops");
    }
  };

  const connectToUniversityGroup = (tripId = null) => {
    const wsUrl = `ws://localhost:8000/ws/tracking/${user.university}/student/${tripId ? `${tripId}/` : ""}`;

    if (ws.current) ws.current.close();
    ws.current = new WebSocket(wsUrl);

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (
        data.type === "university_vehicle_update" ||
        data.type === "vehicle_update"
      ) {
        console.log("Vehicle Update Received:", data);
        setUniversityVehicles((prev) => ({
          ...prev,
          [data.trip_id]: {
            lat: data.lat,
            lon: data.lon,
            vehicle_number:
              data.vehicle_number ||
              prev[data.trip_id]?.vehicle_number ||
              "Bus",
            lastUpdate: Date.now(),
          },
        }));
      }

      if (data.type === "eta_update") {
        setEta(data.data);
        if (data.stop_metrics) {
          setStopMetrics(data.stop_metrics);
        }
      }

      if (data.type === "vehicle_stopped" || data.type === "trip_ended") {
        setUniversityVehicles((prev) => {
          const next = { ...prev };
          delete next[data.trip_id];
          return next;
        });
        if (activeTrip?.trip_id === data.trip_id) {
          alert("This vehicle has ended its trip.");
          stopTracking();
        }
      }
    };
  };

  const startTracking = (tripId, vehicleNumber) => {
    setActiveTrip({ trip_id: tripId, vehicle_number: vehicleNumber });
    setEta(null);
    setStopMetrics(null);
    connectToUniversityGroup(tripId);

    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(sendLocationForEta, 4000);
  };

  const sendLocationForEta = () => {
    if (ws.current?.readyState === WebSocket.OPEN && myPos) {
      const payload = { lat: myPos.lat, lon: myPos.lon };
      if (selectedStop) {
        payload.stop_id = selectedStop.id;
      }
      ws.current.send(JSON.stringify(payload));
    }
  };

  const stopTracking = () => {
    setActiveTrip(null);
    setEta(null);
    setStopMetrics(null);
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    if (ws.current) ws.current.close();
    connectToUniversityGroup();
  };

  const vehicleList = Object.entries(universityVehicles);

  return (
    <div className="h-full relative font-sans bg-slate-50">
      {/* --- Sidebar UI --- */}
      <div className="absolute top-4 left-4 w-96 bg-white rounded-[2rem] shadow-2xl z-[1000] flex flex-col max-h-[90vh] overflow-hidden border border-slate-100 ring-1 ring-slate-900/5 transition-all">
        <div className="bg-slate-900 p-6 text-white">
          <div className="flex justify-between items-center mb-1">
            <h2 className="font-black text-2xl flex items-center gap-2 tracking-tighter">
              <Bus size={26} className="text-indigo-400" /> Vayy Passenger
            </h2>
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-800 rounded-xl transition"
            >
              <Info size={18} className="opacity-60" />
            </button>
          </div>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
            {user?.university_name || "Official Transit Network"}
          </p>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
          {!activeTrip ? (
            <>
              {/* Location Context */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">
                    Your Pickup Context
                  </p>
                  {myPos && (
                    <button
                      onClick={() => setShowStops(!showStops)}
                      className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                    >
                      {showStops ? "Hide Nearby Stops" : "Find Nearby Stops"}
                    </button>
                  )}
                </div>

                <div
                  className={`p-4 rounded-2xl border-2 transition-all ${myPos ? "bg-indigo-50/50 border-indigo-100" : "bg-slate-50 border-slate-100 border-dashed"}`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-2 rounded-xl ${myPos ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-400"}`}
                    >
                      <MapPin size={20} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-black text-slate-800">
                        {myPos ? "Position Locked" : "Identify Yourself"}
                      </p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">
                        {myPos
                          ? `${myPos.lat.toFixed(4)}, ${myPos.lon.toFixed(4)}`
                          : "Tap map to set standby point"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Nearby Stops List */}
                {showStops && nearbyStops.length > 0 && (
                  <div className="space-y-2 animate-in slide-in-from-top-4 duration-300">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">
                      Suggested Stops
                    </p>
                    <div className="grid gap-2">
                      {nearbyStops.map((stop) => (
                        <button
                          key={stop.id}
                          onClick={() => {
                            setSelectedStop(stop);
                            setShowStops(false);
                          }}
                          className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${selectedStop?.id === stop.id ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-white border-slate-100 hover:border-indigo-200"}`}
                        >
                          <div
                            className={`p-1.5 rounded-lg ${selectedStop?.id === stop.id ? "bg-white/20" : "bg-indigo-50 text-indigo-600"}`}
                          >
                            <School size={14} />
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <p className="text-xs font-black truncate">
                              {stop.name}
                            </p>
                            <p
                              className={`text-[9px] font-bold uppercase ${selectedStop?.id === stop.id ? "text-indigo-100" : "text-slate-400"}`}
                            >
                              University Stop
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Active Vehicles */}
              <div className="space-y-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex justify-between">
                  Live Campus Fleet <span>{vehicleList.length} Active</span>
                </p>

                {vehicleList.length > 0 ? (
                  <div className="space-y-3">
                    {vehicleList.map(([id, v]) => (
                      <button
                        key={id}
                        onClick={() => startTracking(id, v.vehicle_number)}
                        className="w-full relative overflow-hidden group"
                      >
                        <div className="p-5 bg-white border-2 border-slate-100 rounded-3xl group-hover:border-indigo-600 group-hover:shadow-xl transition-all text-left">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="text-xl font-black text-slate-900 tracking-tighter">
                                {v.vehicle_number}
                              </p>
                              <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                                <Navigation
                                  size={10}
                                  className="fill-indigo-500"
                                />{" "}
                                Active Trip
                              </p>
                            </div>
                            <div className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded-full uppercase">
                              Live
                            </div>
                          </div>
                          <div className="flex items-center gap-4 pt-3 border-t border-slate-50">
                            <div className="flex-1">
                              <p className="text-[9px] font-black text-slate-400 uppercase">
                                Route Status
                              </p>
                              <p className="text-[11px] font-bold text-slate-600">
                                En-route to Hub
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[9px] font-black text-slate-400 uppercase">
                                Action
                              </p>
                              <p className="text-[11px] font-black text-indigo-600">
                                Track Now →
                              </p>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center bg-slate-50 rounded-[2.5rem] border-4 border-dashed border-slate-100">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                      <Bus
                        className="text-slate-200 absolute inset-0 animate-pulse"
                        size={64}
                      />
                      <Loader
                        className="text-indigo-600 absolute bottom-0 right-0 animate-spin"
                        size={24}
                      />
                    </div>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                      Scanning Fleet Signals...
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Selected Vehicle / ETA View */
            <div className="space-y-6 animate-in zoom-in-95 duration-500">
              <div className="bg-slate-900 p-8 rounded-[2.5rem] text-center shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/20 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                <p className="relative text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-4">
                  Focusing Signal
                </p>
                <div className="relative flex justify-center items-center gap-4 mb-2">
                  <div className="w-12 h-0.5 bg-indigo-500/30"></div>
                  <h3 className="text-4xl font-black text-white tracking-tighter">
                    {activeTrip.vehicle_number}
                  </h3>
                  <div className="w-12 h-0.5 bg-indigo-500/30"></div>
                </div>
                <p className="relative text-xs font-bold text-slate-400 mb-6">
                  Real-time Telemetry Active
                </p>

                <div className="relative grid grid-cols-2 gap-4">
                  <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Time to Stop
                    </p>
                    <p className="text-2xl font-black text-white">
                      {stopMetrics?.vehicle_to_stop
                        ? Math.ceil(stopMetrics.vehicle_to_stop.duration / 60)
                        : "--"}
                      <span className="text-xs ml-1 text-slate-400">m</span>
                    </p>
                  </div>
                  <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Dist to Stop
                    </p>
                    <p className="text-2xl font-black text-white">
                      {stopMetrics?.vehicle_to_stop
                        ? (
                            stopMetrics.vehicle_to_stop.total_distance / 1000
                          ).toFixed(1)
                        : "--"}
                      <span className="text-xs ml-1 text-slate-400">km</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Duel Metric Card */}
              <div className="space-y-3">
                <div className="p-6 bg-white border-2 border-slate-100 rounded-3xl shadow-lg">
                  <div className="flex flex-col gap-6">
                    {/* Passenger to Stop */}
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                        <MapPin size={24} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          You → {selectedStop?.name || "Target Stop"}
                        </p>
                        <div className="flex items-baseline gap-2">
                          <p className="text-2xl font-black text-slate-800">
                            {stopMetrics?.me_to_stop
                              ? (
                                  stopMetrics.me_to_stop.total_distance / 1000
                                ).toFixed(2)
                              : "--"}
                            <span className="text-sm ml-1 font-bold">km</span>
                          </p>
                          <p className="text-xs font-bold text-slate-500">
                            (
                            {stopMetrics?.me_to_stop
                              ? Math.ceil(stopMetrics.me_to_stop.duration / 60)
                              : "--"}{" "}
                            min walk)
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Visual Path Connector */}
                    <div className="flex justify-center ml-12 -my-2">
                      <div className="w-1 h-8 bg-slate-100 rounded-full flex flex-col justify-between py-1">
                        <div className="w-full h-1 bg-blue-400 rounded-full"></div>
                        <div className="w-full h-1 bg-indigo-400 rounded-full"></div>
                      </div>
                    </div>

                    {/* Vehicle to Stop */}
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                        <Bus size={24} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Vehicle → Stop
                        </p>
                        <div className="flex items-baseline gap-2">
                          <p className="text-2xl font-black text-slate-800">
                            {stopMetrics?.vehicle_to_stop
                              ? (
                                  stopMetrics.vehicle_to_stop.total_distance /
                                  1000
                                ).toFixed(2)
                              : "--"}
                            <span className="text-sm ml-1 font-bold">km</span>
                          </p>
                          <p className="text-xs font-bold text-slate-500">
                            (
                            {stopMetrics?.vehicle_to_stop
                              ? Math.ceil(
                                  stopMetrics.vehicle_to_stop.duration / 60,
                                )
                              : "--"}{" "}
                            min drive)
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {!myPos && (
                <div className="p-5 bg-amber-50 border border-amber-100 rounded-3xl flex items-start gap-4">
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                    <AlertCircle size={20} />
                  </div>
                  <p className="text-[11px] font-bold text-amber-800 leading-relaxed text-left">
                    <span className="font-black uppercase block mb-1 tracking-tighter">
                      Precision Lost
                    </span>
                    Identify your pickup standby point on the map to unlock
                    accurate wait times.
                  </p>
                </div>
              )}

              <button
                onClick={stopTracking}
                className="w-full bg-slate-100 text-slate-900 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-200 transition shadow-sm active:scale-95"
              >
                Release Signal & Global Tracking
              </button>
            </div>
          )}
        </div>
      </div>

      <MapContainer
        center={[12.9716, 77.5946]} // Fallback coords
        zoom={14}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        <useMapEvents
          click={(e) => setMyPos({ lat: e.latlng.lat, lon: e.latlng.lng })}
        />

        {/* Draw Campus Routes (Static lines) */}
        {routes.map((r) => (
          <Polyline
            key={r.id}
            positions={r.path_coords}
            color="#6366f1"
            weight={3}
            opacity={0.15}
          />
        ))}

        {/* My Position */}
        {myPos && (
          <CircleMarker
            center={[myPos.lat, myPos.lon]}
            radius={10}
            pathOptions={{
              color: "white",
              fillColor: "#2563eb",
              fillOpacity: 1,
              weight: 4,
            }}
          >
            <Popup className="font-sans font-bold text-xs">Standby Point</Popup>
          </CircleMarker>
        )}

        {/* Stops */}
        {nearbyStops.map((stop) => (
          <CircleMarker
            key={stop.id}
            center={[stop.lat, stop.lon]}
            radius={selectedStop?.id === stop.id ? 12 : 6}
            pathOptions={{
              color: "white",
              fillColor: selectedStop?.id === stop.id ? "#4f46e5" : "#94a3b8",
              fillOpacity: 1,
              weight: 3,
            }}
            eventHandlers={{ click: () => setSelectedStop(stop) }}
          >
            <Popup className="font-sans font-black text-[10px] uppercase">
              {stop.name}
            </Popup>
          </CircleMarker>
        ))}

        {/* Global University Vehicles */}
        {vehicleList.map(([id, v]) => {
          if (!v || typeof v.lat !== "number" || typeof v.lon !== "number")
            return null;
          return (
            <CircleMarker
              key={id}
              center={[v.lat, v.lon]}
              radius={activeTrip?.trip_id === id ? 14 : 9}
              pathOptions={{
                color: "white",
                fillColor: activeTrip?.trip_id === id ? "#10b981" : "#475569",
                fillOpacity: 1,
                weight: activeTrip?.trip_id === id ? 5 : 2,
              }}
              eventHandlers={{
                click: () => startTracking(id, v.vehicle_number),
              }}
            >
              <Popup className="font-sans font-black text-[10px] uppercase">
                {v.vehicle_number || "Bus"}
              </Popup>
            </CircleMarker>
          );
        })}

        <MapUpdater
          bounds={
            activeTrip
              ? [
                  universityVehicles[activeTrip.trip_id],
                  myPos,
                  selectedStop,
                ].filter(Boolean)
              : [myPos, ...vehicleList.map((v) => v[1])].filter(Boolean)
          }
        />
      </MapContainer>
    </div>
  );
};

export default MapPassenger;
