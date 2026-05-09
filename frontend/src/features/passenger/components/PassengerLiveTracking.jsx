// VAYY | src/features/passenger/components/PassengerLiveTracking.jsx | Status: ✅ Map Refactor Complete
// Clean tracking view with modern map styling and reliable websocket integration.

import React, { useState, useRef, useEffect } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { 
  Navigation, 
  Clock, 
  Bus, 
  RefreshCw, 
  MapPin, 
  ChevronLeft, 
  Share2, 
  AlertTriangle,
  Info
} from "lucide-react";
import api, { getWsUrl } from "../../../lib/api";

const PassengerLiveTracking = ({ tripId, onBack }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [tripData, setTripIdData] = useState(null);
  const [busData, setBusData] = useState({ pos: null, eta: [] });
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState("connecting");
  const [myPos, setMyPos] = useState(null);

  const ws = useRef(null);
  const markers = useRef({});

  // 1. Initial REST Fetch
  useEffect(() => {
    const init = async () => {
      try {
        const res = await api.get(`/api/passenger/trips/${tripId}/`);
        setTripIdData(res.data);
      } catch (err) {
        console.error("Trip init failed", err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [tripId]);

  // 2. Initialize Map (Only after loading is false)
  useEffect(() => {
    if (loading || map.current || !mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: [78.9629, 20.5937],
      zoom: 12,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "top-right");

    // Once map loads, try to find user location
    navigator.geolocation.getCurrentPosition((pos) => {
       setMyPos({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [loading]);

  // 3. Setup WebSocket
  useEffect(() => {
    if (loading) return;

    const token = localStorage.getItem("token");
    const wsUrl = getWsUrl(`/ws/public/global/passenger/${tripId}/?token=${token}`);
    
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => setWsStatus("connected");
    ws.current.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "city_vehicle_update" || data.type === "vehicle_update") {
        setBusData({
          pos: [data.lat, data.lon],
          eta: data.next_stop_eta || []
        });
      }
    };
    ws.current.onclose = () => setWsStatus("disconnected");

    return () => ws.current?.close();
  }, [loading, tripId]);

  // 4. Update Markers & Sync Bounds
  useEffect(() => {
    if (!map.current) return;

    const points = [];

    // Bus Marker
    if (busData.pos) {
      const [lat, lon] = busData.pos;
      points.push([lon, lat]);

      if (!markers.current.bus) {
        const el = document.createElement("div");
        el.className = "flex items-center justify-center bg-emerald-600 text-white w-10 h-10 rounded-full border-4 border-white shadow-xl";
        el.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2h2"></path><path d="M5 17V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10"></path><circle cx="7" cy="17" r="2"></circle><circle cx="17" cy="17" r="2" ></circle></svg>`;
        
        markers.current.bus = new maplibregl.Marker({ element: el })
          .setLngLat([lon, lat])
          .addTo(map.current);
      } else {
        markers.current.bus.setLngLat([lon, lat]);
      }
    }

    // My Position Marker
    if (myPos) {
      points.push([myPos.lon, myPos.lat]);
      if (!markers.current.me) {
        const el = document.createElement("div");
        el.style.width = "16px";
        el.style.height = "16px";
        el.style.borderRadius = "50%";
        el.style.backgroundColor = "#00E676";
        el.style.border = "3px solid white";
        el.style.boxShadow = "0 0 10px rgba(0,0,0,0.3)";
        
        markers.current.me = new maplibregl.Marker({ element: el })
          .setLngLat([myPos.lon, myPos.lat])
          .addTo(map.current);
      } else {
        markers.current.me.setLngLat([myPos.lon, myPos.lat]);
      }
    }

    // Auto Zoom
    if (points.length > 0) {
      const bounds = points.reduce(
        (acc, coord) => acc.extend(coord), 
        new maplibregl.LngLatBounds(points[0], points[0])
      );
      map.current.fitBounds(bounds, { padding: 100, duration: 2000 });
    }

  }, [busData, myPos]);

  if (loading) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 gap-4">
      <RefreshCw className="animate-spin text-emerald-600" size={40} />
      <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">Syncing Satellite Data...</p>
    </div>
  );

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden font-sans">
      {/* Top Header Overlay */}
      <div className="absolute top-0 left-0 right-0 z-[1000] p-4 flex items-center justify-between pointer-events-none">
        <button 
          onClick={onBack}
          className="p-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-slate-100 pointer-events-auto active:scale-95 transition-transform"
        >
          <ChevronLeft size={24} className="text-slate-700" />
        </button>
        
        <div className="flex flex-col items-end gap-2">
          <div className="px-4 py-2 bg-slate-900/90 backdrop-blur-md text-white rounded-2xl shadow-xl flex items-center gap-2 border border-slate-700">
             <div className={`w-2 h-2 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
             <span className="text-[10px] font-black uppercase tracking-widest">{wsStatus === 'connected' ? 'Live Stream' : 'Connection Lost'}</span>
          </div>
        </div>
      </div>

      {/* Main Map */}
      <div ref={mapContainer} className="flex-1 bg-slate-200" />

      {/* Bottom Information Sheet */}
      <div className="bg-white border-t border-slate-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-[1000] px-6 pt-6 pb-8">
        <div className="max-w-2xl mx-auto space-y-6">
          
          {/* Trip Summary */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900 leading-tight">
                {tripData?.bus_number ? `Bus ${tripData.bus_number}` : "City Vehicle"}
              </h2>
              <p className="text-slate-500 font-medium flex items-center gap-2">
                <MapPin size={14} className="text-emerald-500" />
                {tripData?.route_name || "Active Route"}
              </p>
            </div>
            <div className="flex flex-col items-end">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ETA TO NEXT STOP</span>
               <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-2xl font-black text-xl border border-emerald-100">
                  {busData.eta?.[0] ? Math.ceil(busData.eta[0].duration_seconds / 60) : '--'} <span className="text-xs">MINS</span>
               </div>
            </div>
          </div>

          <div className="h-px bg-slate-100 w-full" />

          {/* Action Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
              <div className="p-2 bg-white rounded-xl shadow-sm">
                <Clock className="text-slate-400" size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Next Stop</p>
                <p className="text-sm font-bold text-slate-700 truncate w-32">{busData.eta?.[0]?.stop_name || 'Calculating...'}</p>
              </div>
            </div>
            
            <button className="bg-emerald-600 text-white rounded-2xl flex items-center justify-center gap-2 font-black text-sm uppercase tracking-widest hover:bg-emerald-700 transition shadow-lg shadow-emerald-200 active:scale-95">
              <Share2 size={18} />
              Share Trip
            </button>
          </div>

          {/* Alert / Info */}
          {!busData.pos && (
             <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="text-amber-500 mt-0.5" size={18} />
                <div>
                   <p className="text-sm font-bold text-amber-900">Awaiting Signal</p>
                   <p className="text-xs text-amber-700">The vehicle's location is currently being resolved. Please stay tuned.</p>
                </div>
             </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default PassengerLiveTracking;
